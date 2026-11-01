"""
Track 2: Unified Mutation Engine & Feasibility Validator
Spec: docs/API_SPEC.md §1.4, ADR 0005, ADR 0008
Ticket: docs/tickets/track-2-trip-engine-backend/05-unified-mutation-engine-replan-api.md
"""
from __future__ import annotations

import copy
import uuid
from datetime import datetime, timezone, timedelta, time
from typing import List, Dict, Any, Optional, Tuple

from app.schemas.replan import ReplanOperation, ValidationDiff
from app.services.planner import (
    PlaceCandidate,
    StartLocation,
    TravelMode,
    ArtisanPreference,
    compute_transit_minutes,
    resolve_stop_duration_and_cost,
    _clamp_to_opening_time,
)

PLACE_IMAGE_MAP: Dict[str, str] = {
    "place_city_palace": "https://images.unsplash.com/photo-1615836245337-f5b9b2303f10?auto=format&fit=crop&w=900&q=80",
    "place_mohanlal_studio": "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=900&q=80",
    "place_pottery_studio": "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=900&q=80",
    "place_puppetry_workshop": "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=900&q=80",
    "place_leather_craft": "https://images.pexels.com/photos/4427645/pexels-photo-4427645.jpeg?auto=compress&cs=tinysrgb&w=900",
    "place_jagdish_temple": "https://images.pexels.com/photos/15534239/pexels-photo-15534239.jpeg?auto=compress&cs=tinysrgb&w=900",
    "place_bagore_haveli": "https://images.unsplash.com/photo-1722080711528-095791cd14d4?auto=format&fit=crop&w=900&q=80",
    "place_saheliyon_bari": "https://images.unsplash.com/photo-1651306614297-9c1301ad460e?auto=format&fit=crop&w=900&q=80",
    "place_sukhadia_circle": "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=80",
}
DEFAULT_PLACE_IMAGE = "https://images.unsplash.com/photo-1615836245337-f5b9b2303f10?auto=format&fit=crop&w=900&q=80"


def _stop_to_place_candidate(s: Dict[str, Any]) -> PlaceCandidate:
    """Convert stop dictionary or row into PlaceCandidate for duration/cost solver."""
    return PlaceCandidate(
        id=s.get("place_id") or s.get("id"),
        name=s.get("name") or "Stop",
        category=s.get("category") or "attraction",
        latitude=float(s.get("latitude") or 24.5764),
        longitude=float(s.get("longitude") or 73.6835),
        entry_fee_inr=float(s.get("entry_fee_inr") or 0.0),
        typical_duration_minutes=int(s.get("typical_duration_minutes") or s.get("suggested_duration_minutes") or 45),
        opening_time=s.get("opening_time"),
        closing_time=s.get("closing_time"),
        has_workshop=bool(s.get("has_workshop", False)),
        workshop_fee_inr=float(s.get("workshop_fee_inr") or 0.0),
        workshop_duration_minutes=int(s.get("workshop_duration_minutes") or 45),
        day_number=s.get("day_number", 1),
        sequence_in_day=s.get("sequence_in_day", 1),
        suggested_duration_minutes=s.get("suggested_duration_minutes"),
        time_slot=s.get("time_slot"),
        source_attribution=s.get("source_attribution"),
        private_notes=s.get("private_notes"),
    )


class UnifiedMutationEngine:
    """
    Core replanning and mutation engine. Evaluates candidate operations
    (skip_stop, add_stop, remove_stop, reorder_stops, pin_stop) against
    constraints (opening hours, transit matrix, budget cap) and generates
    structured before/after diffs with candidate stop sequences.
    """

    async def evaluate_mutation(
        self,
        current_stops: List[Dict[str, Any]],
        operations: List[ReplanOperation],
        trip_id: str,
        base_revision: int,
        budget_limit: float,
        start_location: StartLocation,
        start_datetime: datetime,
        travel_mode: TravelMode = "auto_rickshaw",
        artisan_preference: ArtisanPreference = "both",
        places_catalog: Optional[Dict[str, Any]] = None,
        google_maps_api_key: str = "",
        now_override: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Applies candidate operations to the current trip stops, recalculates schedule,
        checks constraints, and returns candidate stops and diff.
        """
        places_catalog = places_catalog or {}

        # 1. Validation against frozen completed stops
        for op in operations:
            if op.type in (
                "skip_stop",
                "remove_stop",
                "reorder_stops",
                "pin_stop",
                "update_stop_duration",
                "reschedule_stop",
            ):
                target = next(
                    (
                        s
                        for s in current_stops
                        if s.get("id") == op.stop_id or s.get("place_id") == op.stop_id
                    ),
                    None,
                )
                if not target and op.stop_id:
                    target = next(
                        (
                            s
                            for s in current_stops
                            if op.stop_id.lower() in (s.get("name") or "").lower()
                        ),
                        None,
                    )
                if not target:
                    raise ValueError(f"Stop {op.stop_id} not found in trip")
                op.stop_id = target.get("id")
                if target.get("visit_status") == "visited" and op.type in ("skip_stop", "remove_stop", "reorder_stops"):
                    raise ValueError(f"Cannot modify already completed stop {op.stop_id}")
            elif op.type == "update_travel_mode" and op.stop_id:
                target = next(
                    (
                        s
                        for s in current_stops
                        if s.get("id") == op.stop_id
                        or s.get("place_id") == op.stop_id
                        or op.stop_id.lower() in (s.get("name") or "").lower()
                    ),
                    None,
                )
                if target:
                    op.stop_id = target.get("id")
            elif op.type == "add_stop":
                if op.place_id and op.place_id in places_catalog:
                    continue
                if op.custom_place_name or (op.place_id and op.place_id not in places_catalog):
                    slug = (
                        op.place_id
                        if (op.place_id and op.place_id.startswith("place_"))
                        else f"place_custom_{uuid.uuid4().hex[:8]}"
                    )
                    op.place_id = slug
                    places_catalog[slug] = {
                        "id": slug,
                        "name": op.custom_place_name or slug.replace("place_", "").replace("_", " ").title(),
                        "address": op.custom_address or "Udaipur, Rajasthan",
                        "latitude": float(op.custom_latitude if op.custom_latitude is not None else 24.5795),
                        "longitude": float(op.custom_longitude if op.custom_longitude is not None else 73.6835),
                        "category": op.custom_category or "attraction",
                        "entry_fee_inr": float(op.custom_entry_fee_inr or 0.0),
                        "typical_duration_minutes": int(op.duration_minutes or 45),
                        "opening_time": None,
                        "closing_time": None,
                        "has_workshop": (op.custom_category == "artisan_studio"),
                        "workshop_fee_inr": float(op.custom_entry_fee_inr or 0.0) if op.custom_category == "artisan_studio" else 0.0,
                        "workshop_duration_minutes": int(op.duration_minutes or 45),
                    }
                else:
                    raise ValueError(f"Place {op.place_id} not found in catalog")

        # 2. Partition into historical frozen (visited) and mutable upcoming stops
        visited_stops: List[Dict[str, Any]] = [
            copy.deepcopy(s) for s in current_stops if s.get("visit_status") == "visited"
        ]
        mutable_stops: List[Dict[str, Any]] = [
            copy.deepcopy(s) for s in current_stops if s.get("visit_status") != "visited"
        ]

        diff_stops_added: List[str] = []
        diff_stops_skipped: List[str] = []
        diff_stops_removed: List[str] = []
        diff_travel_mode_changed: List[str] = []
        diff_durations_updated: List[str] = []
        diff_rescheduled_stops: List[str] = []
        diff_budget_updated_inr: Optional[float] = None
        baseline_travel_mode: TravelMode = travel_mode

        # 3. Apply operations to mutable stops in sequence
        for op in operations:
            if op.type == "skip_stop":
                target = next((s for s in mutable_stops if s.get("id") == op.stop_id), None)
                if target:
                    target["visit_status"] = "skipped"
                    if op.stop_id not in diff_stops_skipped:
                        diff_stops_skipped.append(op.stop_id)

            elif op.type == "remove_stop":
                mutable_stops = [s for s in mutable_stops if s.get("id") != op.stop_id]
                if op.stop_id and op.stop_id not in diff_stops_removed:
                    diff_stops_removed.append(op.stop_id)

            elif op.type == "add_stop":
                place_meta = places_catalog[op.place_id]
                new_stop_id = f"stop_{op.place_id}_{uuid.uuid4().hex[:6]}"
                day_num = op.day_number or 1
                sug_dur = int(op.duration_minutes or place_meta.get("typical_duration_minutes") or 45)

                new_candidate_stop = {
                    "id": new_stop_id,
                    "trip_id": trip_id,
                    "place_id": op.place_id,
                    "name": place_meta.get("name"),
                    "address": place_meta.get("address"),
                    "latitude": float(place_meta.get("latitude")),
                    "longitude": float(place_meta.get("longitude")),
                    "category": place_meta.get("category"),
                    "entry_fee_inr": float(place_meta.get("entry_fee_inr") or 0.0),
                    "image_url": PLACE_IMAGE_MAP.get(op.place_id, DEFAULT_PLACE_IMAGE),
                    "day_number": day_num,
                    "sequence_in_day": len(mutable_stops) + 1,
                    "planned_arrival": None,
                    "planned_departure": None,
                    "suggested_duration_minutes": sug_dur,
                    "typical_duration_minutes": sug_dur,
                    "actual_duration_minutes": None,
                    "is_pinned": False,
                    "visit_status": "pending",
                    "source_attribution": "Replan Mutation Engine",
                    "private_notes": None,
                    "opening_time": place_meta.get("opening_time"),
                    "closing_time": place_meta.get("closing_time"),
                    "has_workshop": place_meta.get("has_workshop", False),
                    "workshop_fee_inr": place_meta.get("workshop_fee_inr", 0.0),
                    "workshop_duration_minutes": place_meta.get("workshop_duration_minutes", sug_dur),
                }
                if op.planned_arrival_time:
                    new_candidate_stop["custom_planned_arrival"] = op.planned_arrival_time
                if op.travel_mode:
                    new_candidate_stop["leg_travel_mode"] = op.travel_mode

                if op.new_order is not None and op.new_order > 0:
                    visited_offset = len(visited_stops)
                    rel_idx = max(0, op.new_order - 1 - visited_offset) if op.new_order > visited_offset else max(0, op.new_order - 1)
                    insert_idx = min(rel_idx, len(mutable_stops))
                    mutable_stops.insert(insert_idx, new_candidate_stop)
                else:
                    mutable_stops.append(new_candidate_stop)

                if op.place_id not in diff_stops_added:
                    diff_stops_added.append(op.place_id)

            elif op.type == "reorder_stops":
                target_idx = next(
                    (i for i, s in enumerate(mutable_stops) if s.get("id") == op.stop_id),
                    None,
                )
                if target_idx is not None:
                    target = mutable_stops.pop(target_idx)
                    visited_offset = len(visited_stops)
                    raw_order = op.new_order or 1
                    rel_pos = (raw_order - 1 - visited_offset) if raw_order > visited_offset else (raw_order - 1)
                    target_pos = min(max(0, rel_pos), len(mutable_stops))
                    mutable_stops.insert(target_pos, target)

            elif op.type == "pin_stop":
                target = next((s for s in mutable_stops if s.get("id") == op.stop_id), None)
                if target:
                    target["is_pinned"] = True if op.is_pinned is None else op.is_pinned

            elif op.type == "update_travel_mode":
                new_mode: TravelMode = op.travel_mode or "auto_rickshaw"
                if op.stop_id:
                    target = next((s for s in mutable_stops if s.get("id") == op.stop_id), None)
                    if target:
                        target["leg_travel_mode"] = new_mode
                        label = f"{target.get('name', op.stop_id)}: {new_mode}"
                        if label not in diff_travel_mode_changed:
                            diff_travel_mode_changed.append(label)
                else:
                    travel_mode = new_mode
                    label = f"All legs: {new_mode}"
                    if label not in diff_travel_mode_changed:
                        diff_travel_mode_changed.append(label)

            elif op.type == "update_stop_duration":
                target = next((s for s in mutable_stops if s.get("id") == op.stop_id), None)
                if target and op.duration_minutes and op.duration_minutes > 0:
                    target["suggested_duration_minutes"] = int(op.duration_minutes)
                    target["typical_duration_minutes"] = int(op.duration_minutes)
                    target["workshop_duration_minutes"] = int(op.duration_minutes)
                    label = f"{target.get('name', op.stop_id)} ({op.duration_minutes}m)"
                    if label not in diff_durations_updated:
                        diff_durations_updated.append(label)

            elif op.type == "reschedule_stop":
                target = next((s for s in mutable_stops if s.get("id") == op.stop_id), None)
                if target and op.planned_arrival_time:
                    target["custom_planned_arrival"] = op.planned_arrival_time
                    label = f"{target.get('name', op.stop_id)} -> {op.planned_arrival_time}"
                    if label not in diff_rescheduled_stops:
                        diff_rescheduled_stops.append(label)

            elif op.type == "update_budget":
                if op.budget_inr and op.budget_inr > 0:
                    budget_limit = float(op.budget_inr)
                    diff_budget_updated_inr = budget_limit

        # 4. Determine schedule timeline reference point
        if visited_stops:
            last_visited = visited_stops[-1]
            anchor_lat = float(last_visited.get("latitude") or start_location.latitude)
            anchor_lon = float(last_visited.get("longitude") or start_location.longitude)
            dep_val = last_visited.get("planned_departure")
            if isinstance(dep_val, str):
                dep_dt = datetime.fromisoformat(dep_val)
            elif isinstance(dep_val, datetime):
                dep_dt = dep_val
            else:
                dep_dt = start_datetime

            if now_override is not None:
                curr_time = max(dep_dt, now_override)
            else:
                now_local = datetime.now(dep_dt.tzinfo) if dep_dt.tzinfo else datetime.now(timezone.utc)
                if dep_dt.date() == now_local.date() and now_local > dep_dt:
                    curr_time = now_local
                else:
                    curr_time = dep_dt
            curr_lat = anchor_lat
            curr_lon = anchor_lon
        else:
            curr_lat = start_location.latitude
            curr_lon = start_location.longitude
            curr_time = start_datetime

        closing_hour_conflicts: List[str] = []
        total_estimated_cost = 0.0
        total_estimated_duration_minutes = 0

        # Calculate cost & duration for visited stops (historical)
        for s in visited_stops:
            dur, cost = resolve_stop_duration_and_cost(_stop_to_place_candidate(s), artisan_preference)
            actual_dur = s.get("actual_duration_minutes") or dur
            total_estimated_cost += cost
            total_estimated_duration_minutes += actual_dur

        # 5. Reschedule upcoming stops sequentially
        rescheduled_mutable_stops: List[Dict[str, Any]] = []
        visited_count_by_day: Dict[int, int] = {}
        for s in visited_stops:
            d = s.get("day_number", 1)
            visited_count_by_day[d] = visited_count_by_day.get(d, 0) + 1

        seq_counter_by_day = dict(visited_count_by_day)

        for s in mutable_stops:
            day_num = s.get("day_number", 1)
            seq_counter_by_day[day_num] = seq_counter_by_day.get(day_num, 0) + 1
            s["sequence_in_day"] = seq_counter_by_day[day_num]

            if s.get("visit_status") == "skipped":
                # Skipped stops do not advance transit or time; zero fee
                s["planned_arrival"] = curr_time
                s["planned_departure"] = curr_time
                s["suggested_duration_minutes"] = 0
                rescheduled_mutable_stops.append(s)
                continue

            # Active pending stop
            dest_lat = float(s["latitude"])
            dest_lon = float(s["longitude"])
            leg_mode: TravelMode = s.get("leg_travel_mode") or travel_mode
            transit_mins = await compute_transit_minutes(
                curr_lat,
                curr_lon,
                dest_lat,
                dest_lon,
                leg_mode,
                curr_time,
                google_maps_api_key,
            )

            raw_arrival = curr_time + timedelta(minutes=transit_mins)
            custom_arr_str = s.get("custom_planned_arrival")
            if custom_arr_str:
                try:
                    if "T" in str(custom_arr_str):
                        parsed_dt = datetime.fromisoformat(str(custom_arr_str).replace("Z", "+00:00"))
                        if raw_arrival.tzinfo and parsed_dt.tzinfo:
                            parsed_dt = parsed_dt.astimezone(raw_arrival.tzinfo)
                        raw_arrival = parsed_dt
                    else:
                        parts = str(custom_arr_str).strip().split(":")
                        hh = int(parts[0])
                        mm = int(parts[1]) if len(parts) > 1 else 0
                        raw_arrival = raw_arrival.replace(hour=hh, minute=mm, second=0, microsecond=0)
                except Exception:
                    pass

            open_t = s.get("opening_time")
            if isinstance(open_t, str):
                try:
                    open_t = time.fromisoformat(open_t)
                except Exception:
                    open_t = None
            arrival, wait_mins = _clamp_to_opening_time(raw_arrival, open_t)

            candidate_obj = _stop_to_place_candidate(s)
            if any(op.type == "update_stop_duration" and op.stop_id == s.get("id") for op in operations):
                dur_mins = int(s["suggested_duration_minutes"])
                _, cost_inr = resolve_stop_duration_and_cost(candidate_obj, artisan_preference)
            else:
                dur_mins, cost_inr = resolve_stop_duration_and_cost(candidate_obj, artisan_preference)
            departure = arrival + timedelta(minutes=dur_mins)

            close_t = s.get("closing_time")
            if isinstance(close_t, str):
                try:
                    close_t = time.fromisoformat(close_t)
                except Exception:
                    close_t = None

            if close_t:
                close_dt = arrival.replace(
                    hour=close_t.hour,
                    minute=close_t.minute,
                    second=0,
                    microsecond=0,
                )
                if departure > close_dt or arrival >= close_dt:
                    closing_hour_conflicts.append(
                        f"{s['name']} closes at {close_t.strftime('%H:%M')} "
                        f"(planned {arrival.strftime('%H:%M')}–{departure.strftime('%H:%M')})"
                    )

            s["planned_arrival"] = arrival
            s["planned_departure"] = departure
            s["suggested_duration_minutes"] = dur_mins
            s["transit_minutes_from_prev"] = transit_mins
            s["travel_mode"] = leg_mode
            s["cost_inr"] = cost_inr

            total_estimated_cost += cost_inr
            total_estimated_duration_minutes += transit_mins + int(wait_mins) + dur_mins

            curr_time = departure
            curr_lat = dest_lat
            curr_lon = dest_lon

            rescheduled_mutable_stops.append(s)

        all_candidate_stops = visited_stops + rescheduled_mutable_stops

        # 6. Calculate baseline vs candidate diffs
        original_total_cost = 0.0
        original_total_duration = 0
        base_lat = float(visited_stops[-1].get("latitude") or start_location.latitude) if visited_stops else start_location.latitude
        base_lon = float(visited_stops[-1].get("longitude") or start_location.longitude) if visited_stops else start_location.longitude
        for s in current_stops:
            if s.get("visit_status") != "skipped":
                dur, cost = resolve_stop_duration_and_cost(_stop_to_place_candidate(s), artisan_preference)
                original_total_cost += cost
                original_total_duration += s.get("actual_duration_minutes") or dur
                if diff_travel_mode_changed and s.get("visit_status") != "visited":
                    s_lat = float(s.get("latitude") or base_lat)
                    s_lon = float(s.get("longitude") or base_lon)
                    base_transit = await compute_transit_minutes(
                        base_lat,
                        base_lon,
                        s_lat,
                        s_lon,
                        baseline_travel_mode,
                        start_datetime,
                        google_maps_api_key,
                    )
                    original_total_duration += base_transit
                    base_lat, base_lon = s_lat, s_lon

        cost_delta_inr = round(total_estimated_cost - original_total_cost, 2)
        duration_delta_minutes = total_estimated_duration_minutes - original_total_duration
        budget_exceeded = total_estimated_cost > budget_limit
        is_feasible = (not budget_exceeded) and (len(closing_hour_conflicts) == 0)

        diff = ValidationDiff(
            cost_delta_inr=cost_delta_inr,
            duration_delta_minutes=duration_delta_minutes,
            stops_added=diff_stops_added,
            stops_skipped=diff_stops_skipped,
            stops_removed=diff_stops_removed,
            closing_hour_conflicts=closing_hour_conflicts,
            travel_mode_changed=diff_travel_mode_changed,
            durations_updated=diff_durations_updated,
            rescheduled_stops=diff_rescheduled_stops,
            budget_updated_inr=diff_budget_updated_inr,
        )

        # Route geometry
        coords = [
            [float(s["longitude"]), float(s["latitude"])]
            for s in all_candidate_stops
            if s.get("visit_status") != "skipped"
        ]
        route_geometry = {
            "type": "LineString",
            "travel_mode": travel_mode,
            "coordinates": coords,
        }

        return {
            "is_feasible": is_feasible,
            "validation_diff": diff,
            "candidate_stops": all_candidate_stops,
            "total_estimated_cost_inr": total_estimated_cost,
            "total_estimated_duration_minutes": total_estimated_duration_minutes,
            "route_geometry": route_geometry,
        }
