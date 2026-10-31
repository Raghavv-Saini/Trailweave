"""
Track 2: TrailWeave Artisan Smart Recommendation Scorer
Ticket: docs/tickets/track-2-trip-engine-backend/06-artisan-smart-recommendation-scorer.md
Spec: docs/API_SPEC.md & docs/adr/0009-artisan-smart-recommendation-scorer-and-detour-engine.md
"""
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, time, timedelta
from app.services.routing import estimate_transit_minutes

ARTISAN_IMAGE_MAP: Dict[str, str] = {
    "place_mohanlal_studio": "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=900&q=80",
    "place_pottery_studio": "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=900&q=80",
    "place_puppetry_workshop": "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=900&q=80",
    "place_leather_craft": "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=900&q=80",
}
DEFAULT_ARTISAN_IMAGE = "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=900&q=80"


def _format_time_display(t: Any) -> str:
    """Format time object or string to friendly format like '7 PM' or '7:30 PM'."""
    if not t:
        return "evening"
    if isinstance(t, str):
        try:
            parts = t.split(":")
            h, m = int(parts[0]), int(parts[1])
            t = time(h, m)
        except Exception:
            return t
    if isinstance(t, time):
        hour = t.hour
        minute = t.minute
        ampm = "AM" if hour < 12 else "PM"
        hour_12 = hour % 12
        if hour_12 == 0:
            hour_12 = 12
        if minute == 0:
            return f"{hour_12} {ampm}"
        return f"{hour_12}:{minute:02d} {ampm}"
    return str(t)


def _parse_time(t: Any) -> Optional[time]:
    """Parse time object or HH:MM string into datetime.time."""
    if not t:
        return None
    if isinstance(t, time):
        return t
    if isinstance(t, str):
        try:
            parts = t.split(":")
            return time(int(parts[0]), int(parts[1]))
        except Exception:
            return None
    return None


class ArtisanRecommendationScorer:
    """
    Scores nearby artisan studios within a 15-minute detour buffer along the tourist route,
    respecting budget headroom and preference (workshops vs store visits).
    """

    def score_candidates(
        self,
        route_stops: List[Dict[str, Any]],
        candidate_artisans: List[Dict[str, Any]],
        remaining_budget: float,
        preference: str = "both",
        travel_mode: str = "auto_rickshaw",
        max_detour_minutes: int = 15,
        start_location: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Produces ranked recommendations with transparent rationales.
        
        Args:
            route_stops: Active trip stops or builder candidate stops.
            candidate_artisans: Approved artisan records with place metadata.
            remaining_budget: Tourist's remaining budget in INR.
            preference: 'workshops', 'store_visits', or 'both'.
            travel_mode: 'walking', 'auto_rickshaw', or 'cab'.
            max_detour_minutes: Buffer limit (default 15 minutes).
            start_location: Optional start coordinates dict {'latitude': ..., 'longitude': ...}.
            
        Returns:
            List of scored and ranked artisan recommendation dicts.
        """
        normalized_pref = (preference or "both").lower().strip()
        if normalized_pref in ("workshop", "workshops"):
            pref_mode = "workshop"
        elif normalized_pref in ("store", "store_visit", "store_visits"):
            pref_mode = "store"
        else:
            pref_mode = "both"

        # 1. Places already in route
        scheduled_place_ids = {
            s.get("place_id") or s.get("id")
            for s in route_stops
            if (s.get("place_id") or s.get("id"))
        }

        # 2. Identify active / pending stops and anchor
        pending_stops = [
            s for s in route_stops
            if s.get("visit_status") not in ("visited", "skipped")
        ]
        visited_stops = [
            s for s in route_stops
            if s.get("visit_status") == "visited"
        ]

        anchor_coords: Optional[Tuple[float, float]] = None
        if visited_stops:
            last_v = visited_stops[-1]
            if last_v.get("latitude") and last_v.get("longitude"):
                anchor_coords = (float(last_v["latitude"]), float(last_v["longitude"]))
        elif start_location and start_location.get("latitude") and start_location.get("longitude"):
            anchor_coords = (float(start_location["latitude"]), float(start_location["longitude"]))

        scored: List[Dict[str, Any]] = []

        for candidate in candidate_artisans:
            place_id = candidate.get("place_id")
            artisan_id = candidate.get("id") or candidate.get("artisan_id")

            # Exclude artisans already scheduled
            if place_id in scheduled_place_ids or artisan_id in scheduled_place_ids:
                continue

            lat = float(candidate.get("latitude") or 0.0)
            lng = float(candidate.get("longitude") or 0.0)
            if lat == 0.0 or lng == 0.0:
                continue
            cand_coord = (lat, lng)

            has_workshop = bool(candidate.get("has_workshop"))
            workshop_fee = float(candidate.get("workshop_fee_inr") or 0.0)
            workshop_duration = int(candidate.get("workshop_duration_minutes") or 45)
            entry_fee = float(candidate.get("entry_fee_inr") or 0.0)
            store_duration = 20

            # Determine offering mode based on preference
            if pref_mode == "workshop":
                if not has_workshop:
                    continue
                offering_type = "workshop"
                fee = workshop_fee
                duration = workshop_duration
            elif pref_mode == "store":
                offering_type = "store"
                fee = entry_fee
                duration = store_duration
            else:  # pref_mode == "both"
                if has_workshop and (remaining_budget is None or workshop_fee <= remaining_budget):
                    offering_type = "workshop"
                    fee = workshop_fee
                    duration = workshop_duration
                else:
                    offering_type = "store"
                    fee = entry_fee
                    duration = store_duration

            # Budget Headroom Verification
            if remaining_budget is not None and fee > remaining_budget:
                if pref_mode == "both" and offering_type == "workshop":
                    # Fall back to zero-fee / retail store visit
                    offering_type = "store"
                    fee = entry_fee
                    duration = store_duration
                    if fee > remaining_budget:
                        continue
                else:
                    continue

            # Operating hours check
            opening = _parse_time(candidate.get("opening_time"))
            closing = _parse_time(candidate.get("closing_time"))

            # Calculate Detour along route stops
            best_detour: int = 999
            best_order: int = 1

            if not pending_stops:
                # No pending stops: calculate transit from anchor or start
                if anchor_coords:
                    best_detour = estimate_transit_minutes(anchor_coords, cand_coord, travel_mode)
                else:
                    best_detour = 5
                best_order = len(route_stops) + 1
            else:
                # Evaluate candidate insertion across all positions:
                # Option 0: Insert before first pending stop
                first_coord = (
                    float(pending_stops[0].get("latitude") or 24.5764),
                    float(pending_stops[0].get("longitude") or 73.6835)
                )
                if anchor_coords:
                    t_anc_to_cand = estimate_transit_minutes(anchor_coords, cand_coord, travel_mode)
                    t_cand_to_first = estimate_transit_minutes(cand_coord, first_coord, travel_mode)
                    t_anc_to_first = estimate_transit_minutes(anchor_coords, first_coord, travel_mode)
                    d0 = t_anc_to_cand + t_cand_to_first - t_anc_to_first
                else:
                    d0 = estimate_transit_minutes(cand_coord, first_coord, travel_mode)

                best_detour = max(1, d0)
                best_order = int(pending_stops[0].get("sequence_in_day") or 1)

                # Option i: Insert between pending_stops[i] and pending_stops[i+1]
                for i in range(len(pending_stops) - 1):
                    p_i = pending_stops[i]
                    p_next = pending_stops[i + 1]
                    coord_i = (float(p_i.get("latitude") or 24.5764), float(p_i.get("longitude") or 73.6835))
                    coord_next = (float(p_next.get("latitude") or 24.5764), float(p_next.get("longitude") or 73.6835))

                    t_i_cand = estimate_transit_minutes(coord_i, cand_coord, travel_mode)
                    t_cand_next = estimate_transit_minutes(cand_coord, coord_next, travel_mode)
                    t_i_next = estimate_transit_minutes(coord_i, coord_next, travel_mode)

                    detour_i = t_i_cand + t_cand_next - t_i_next
                    detour_i = max(1, detour_i)

                    if detour_i < best_detour:
                        best_detour = detour_i
                        # Optimal order is immediately after p_i
                        best_order = int(p_i.get("sequence_in_day") or (i + 1)) + 1

                # Option last: Append after the last pending stop
                last_coord = (
                    float(pending_stops[-1].get("latitude") or 24.5764),
                    float(pending_stops[-1].get("longitude") or 73.6835)
                )
                d_last = estimate_transit_minutes(last_coord, cand_coord, travel_mode)
                d_last = max(1, d_last)
                if d_last < best_detour:
                    best_detour = d_last
                    best_order = int(pending_stops[-1].get("sequence_in_day") or len(pending_stops)) + 1

            # Filter by 15-minute Detour Buffer
            if best_detour > max_detour_minutes:
                continue

            # Check operating hours compatibility if planned times exist
            closing_display = _format_time_display(closing)

            # Generate Transparent Rationale
            artisan_name = candidate.get("artisan_name") or candidate.get("name") or "Local Artisan"
            budget_str = f"₹{int(remaining_budget):,}" if remaining_budget is not None else "your"

            if offering_type == "workshop":
                rationale = (
                    f"{artisan_name}: {best_detour} min detour, ₹{int(fee)} workshop fee, "
                    f"open until {closing_display}, fits under your {budget_str} budget"
                )
            else:
                rationale = (
                    f"{artisan_name}: {best_detour} min detour, ₹0 entry (store visit), "
                    f"open until {closing_display}, fits under your {budget_str} budget"
                )

            image_url = (
                candidate.get("image_url")
                or ARTISAN_IMAGE_MAP.get(place_id)
                or DEFAULT_ARTISAN_IMAGE
            )

            scored.append({
                "artisan_id": str(artisan_id),
                "place_id": str(place_id),
                "artisan_name": str(artisan_name),
                "craft_type": str(candidate.get("craft_type") or "Traditional Rajasthani Craft"),
                "offering_type": offering_type,
                "fee_inr": float(fee),
                "duration_minutes": int(duration),
                "detour_minutes": int(best_detour),
                "optimal_insert_order": int(best_order),
                "rationale": rationale,
                "latitude": lat,
                "longitude": lng,
                "address": candidate.get("address"),
                "phone_number": candidate.get("phone_number"),
                "bio": candidate.get("bio"),
                "image_url": image_url,
                "opening_time": str(opening) if opening else None,
                "closing_time": str(closing) if closing else None,
                "has_workshop": has_workshop,
                "workshop_description": candidate.get("workshop_description"),
            })

        # Rank candidates:
        # 1. Detour minutes (lowest detour first)
        # 2. Offering match (workshop preference bonus if pref != 'store')
        # 3. Alphabetical tie-break
        def _rank_key(item: Dict[str, Any]) -> Tuple[int, int, str]:
            pref_penalty = 0
            if pref_mode in ("workshop", "both") and item["offering_type"] != "workshop":
                pref_penalty = 1
            return (item["detour_minutes"], pref_penalty, item["artisan_name"])

        scored.sort(key=_rank_key)
        return scored
