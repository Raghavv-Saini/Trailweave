"""
Deterministic Itinerary Planner & Relative Duration Solver.
Spec: Ticket 04, ADR 0003, ADR 0006, ADR 0007.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, time, timedelta, timezone
from typing import Dict, List, Literal, Optional, Any
try:
    import httpx
except ImportError:
    httpx = None

IST = timezone(timedelta(hours=5, minutes=30))

TravelMode = Literal["walking", "auto_rickshaw", "cab"]
ArtisanPreference = Literal["workshop", "store", "both", "none"]
BudgetMode = Literal["total", "per_day"]

TIME_SLOT_ORDER: Dict[str, int] = {
    "morning": 0,
    "afternoon": 1,
    "sunset_evening": 2,
    "evening": 3,
    "night": 4,
}


@dataclass
class StartLocation:
    name: str = "Hotel Swaroop Vilas"
    latitude: float = 24.5854
    longitude: float = 73.6812


@dataclass
class PlaceCandidate:
    id: str
    name: str
    category: str
    latitude: float
    longitude: float
    entry_fee_inr: float = 0.0
    typical_duration_minutes: int = 45
    opening_time: Optional[time] = None
    closing_time: Optional[time] = None
    has_workshop: bool = False
    workshop_fee_inr: float = 0.0
    workshop_duration_minutes: int = 45
    day_number: Optional[int] = None
    sequence_in_day: Optional[int] = None
    suggested_duration_minutes: Optional[int] = None
    time_slot: Optional[str] = None
    source_attribution: Optional[str] = None
    private_notes: Optional[str] = None


@dataclass
class PlannerConfig:
    start_location: StartLocation
    start_datetime: datetime
    total_days: int = 1
    budget_inr: float = 2000.0
    budget_mode: BudgetMode = "total"
    travel_mode: TravelMode = "auto_rickshaw"
    artisan_preference: ArtisanPreference = "both"
    optimize_route: bool = True
    google_maps_api_key: str = ""


@dataclass
class PlannedStop:
    place_id: str
    name: str
    category: str
    latitude: float
    longitude: float
    day_number: int
    sequence_in_day: int
    planned_arrival: datetime
    planned_departure: datetime
    suggested_duration_minutes: int
    transit_minutes_from_prev: int
    estimated_cost_inr: float
    time_slot: Optional[str] = None
    source_attribution: Optional[str] = None
    private_notes: Optional[str] = None


@dataclass
class SolvedItinerary:
    is_feasible: bool
    stops: List[PlannedStop]
    total_estimated_cost_inr: float
    total_estimated_duration_minutes: int
    budget_exceeded: bool = False
    budget_limit_inr: float = 0.0
    closing_hour_conflicts: List[str] = field(default_factory=list)
    route_geometry: Dict[str, Any] = field(default_factory=dict)


def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Compute great-circle distance in meters between two WGS84 coordinates."""
    r = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(d_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2.0) ** 2
    )
    return 2.0 * r * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


def compute_fallback_transit_minutes(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
    travel_mode: TravelMode,
) -> int:
    """Deterministic Udaipur transit time estimation from coordinates."""
    dist_m = haversine_distance_meters(lat1, lon1, lat2, lon2)
    if dist_m < 25.0:
        return 2
    road_dist_km = (dist_m * 1.3) / 1000.0
    speed_kmh = {
        "walking": 4.5,
        "auto_rickshaw": 18.0,
        "cab": 22.0,
    }.get(travel_mode, 18.0)
    raw_minutes = math.ceil((road_dist_km / speed_kmh) * 60.0)
    return max(5, raw_minutes)


async def compute_transit_minutes(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
    travel_mode: TravelMode,
    departure_time: datetime,
    google_maps_api_key: str = "",
) -> int:
    """Fetch transit duration via Google Routes API v2 (or legacy Distance Matrix) if key is set, else fallback."""
    if google_maps_api_key and httpx is not None:
        # 1. Primary: Google Routes API (v2 computeRoutes)
        routes_url = "https://routes.googleapis.com/directions/v2:computeRoutes"
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": google_maps_api_key,
            "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
        }
        routes_mode = "WALK" if travel_mode == "walking" else "DRIVE"
        payload = {
            "origin": {"location": {"latLng": {"latitude": lat1, "longitude": lon1}}},
            "destination": {"location": {"latLng": {"latitude": lat2, "longitude": lon2}}},
            "travelMode": routes_mode,
        }
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                resp = await client.post(routes_url, headers=headers, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    routes = data.get("routes") or []
                    if routes and "duration" in routes[0]:
                        dur_str = str(routes[0]["duration"]).rstrip("s")
                        secs = float(dur_str)
                        return max(2, math.ceil(secs / 60.0))
        except Exception:
            pass

        # 2. Secondary fallback: Legacy Google Distance Matrix API
        gmaps_mode = "walking" if travel_mode == "walking" else "driving"
        params: Dict[str, Any] = {
            "origins": f"{lat1},{lon1}",
            "destinations": f"{lat2},{lon2}",
            "mode": gmaps_mode,
            "key": google_maps_api_key,
        }
        if gmaps_mode == "driving":
            dep_epoch = int(departure_time.timestamp())
            now_epoch = int(datetime.now(departure_time.tzinfo or IST).timestamp())
            params["departure_time"] = max(dep_epoch, now_epoch)
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                resp = await client.get(
                    "https://maps.googleapis.com/maps/api/distancematrix/json",
                    params=params,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    rows = data.get("rows") or []
                    if rows and rows[0].get("elements"):
                        elem = rows[0]["elements"][0]
                        if elem.get("status") == "OK":
                            dur_obj = elem.get("duration_in_traffic") or elem.get("duration")
                            if dur_obj and "value" in dur_obj:
                                return max(2, math.ceil(float(dur_obj["value"]) / 60.0))
        except Exception:
            pass
    return compute_fallback_transit_minutes(lat1, lon1, lat2, lon2, travel_mode)


def _clamp_to_opening_time(
    arrival_est: datetime, opening_time: Optional[time]
) -> tuple[datetime, float]:
    """Shift early arrival to venue opening_time (evaluated in IST) and return (clamped_arrival, wait_minutes)."""
    if opening_time:
        # Check if arrival is before opening_time on the current day
        # (avoid false clamping if opening_time is post-midnight e.g. 01:00 AM while arrival is afternoon)
        is_night_opening = opening_time.hour < 5 and arrival_est.time().hour >= 12
        if arrival_est.time() < opening_time and not is_night_opening:
            open_dt = arrival_est.replace(
                hour=opening_time.hour,
                minute=opening_time.minute,
                second=0,
                microsecond=0,
            )
            wait_mins = max(0.0, (open_dt - arrival_est).total_seconds() / 60.0)
            return open_dt, wait_mins
    return arrival_est, 0.0


def resolve_stop_duration_and_cost(
    place: PlaceCandidate,
    artisan_preference: ArtisanPreference,
) -> tuple[int, float]:
    """Resolve stop visit duration (mins) and total fee (INR) based on artisan preference (ADR 0006)."""
    cost = float(place.entry_fee_inr or 0.0)
    if place.category == "artisan_studio" or place.has_workshop:
        if artisan_preference == "store":
            duration = (
                place.suggested_duration_minutes
                if (place.suggested_duration_minutes and place.suggested_duration_minutes <= 25)
                else 20
            )
            return duration, cost
        if artisan_preference in ("workshop", "both") and place.has_workshop:
            duration = (
                place.workshop_duration_minutes
                or place.suggested_duration_minutes
                or place.typical_duration_minutes
                or 45
            )
            return duration, cost + float(place.workshop_fee_inr or 0.0)
    duration = place.suggested_duration_minutes or place.typical_duration_minutes or 45
    return duration, cost


def _partition_candidates_by_day(
    candidates: List[PlaceCandidate],
    total_days: int,
    start_location: StartLocation,
    artisan_preference: ArtisanPreference = "both",
) -> Dict[int, List[PlaceCandidate]]:
    """Group stops into Day 1..total_days with spatial clustering and load balancing."""
    days: Dict[int, List[PlaceCandidate]] = {d: [] for d in range(1, max(1, total_days) + 1)}
    if total_days <= 1:
        days[1] = sorted(
            candidates,
            key=lambda c: (c.sequence_in_day if c.sequence_in_day is not None else 9999),
        )
        return days

    day_minutes: Dict[int, int] = {d: 0 for d in range(1, total_days + 1)}
    unassigned: List[PlaceCandidate] = []
    for c in candidates:
        if c.day_number and 1 <= c.day_number <= total_days:
            days[c.day_number].append(c)
            dur, _ = resolve_stop_duration_and_cost(c, artisan_preference)
            day_minutes[c.day_number] += dur
        else:
            unassigned.append(c)

    for d in days:
        days[d].sort(
            key=lambda c: (c.sequence_in_day if c.sequence_in_day is not None else 9999)
        )

    if unassigned:
        target_per_day = math.ceil(len(candidates) / total_days)

        # Iteratively assign remaining stops to the day with the highest spatial affinity
        while unassigned:
            best_pair = None
            best_affinity_score = float("inf")

            for item in unassigned:
                dur, _ = resolve_stop_duration_and_cost(item, artisan_preference)
                eligible_days = [
                    d for d in range(1, total_days + 1) if len(days[d]) < target_per_day
                ] or list(range(1, total_days + 1))

                for d in eligible_days:
                    # Compute distance to existing stops in that day, or to start location if day is empty
                    if days[d]:
                        # Distance to last assigned stop of that day
                        last_stop = days[d][-1]
                        dist = haversine_distance_meters(
                            last_stop.latitude, last_stop.longitude, item.latitude, item.longitude
                        )
                    else:
                        dist = haversine_distance_meters(
                            start_location.latitude, start_location.longitude, item.latitude, item.longitude
                        )

                    # Score combines spatial proximity, slot alignment, and day load balance
                    slot_rank = TIME_SLOT_ORDER.get(item.time_slot or "", 0)
                    load_penalty = day_minutes[d] * 2.0
                    count_penalty = len(days[d]) * 500.0
                    affinity = dist + slot_rank * 200.0 + load_penalty + count_penalty

                    if affinity < best_affinity_score:
                        best_affinity_score = affinity
                        best_pair = (item, d, dur)

            if best_pair:
                item, chosen_day, dur = best_pair
                unassigned.remove(item)
                days[chosen_day].append(item)
                day_minutes[chosen_day] += dur
            else:
                # Fallback safeguard
                item = unassigned.pop(0)
                dur, _ = resolve_stop_duration_and_cost(item, artisan_preference)
                chosen_day = min(range(1, total_days + 1), key=lambda d: len(days[d]))
                days[chosen_day].append(item)
                day_minutes[chosen_day] += dur

    return days


async def solve_itinerary(
    candidates: List[PlaceCandidate],
    config: PlannerConfig,
) -> SolvedItinerary:
    """Solve and schedule candidate stops into an authoritative itinerary."""
    total_days = max(1, config.total_days)

    # Normalize start_datetime to Udaipur IST (UTC+05:30)
    start_dt = (
        config.start_datetime.replace(tzinfo=IST)
        if config.start_datetime.tzinfo is None
        else config.start_datetime.astimezone(IST)
    )

    grouped_days = _partition_candidates_by_day(
        candidates, total_days, config.start_location, config.artisan_preference
    )

    planned_stops: List[PlannedStop] = []
    closing_hour_conflicts: List[str] = []
    total_cost = 0.0
    total_active_duration_minutes = 0
    daily_costs: Dict[int, float] = {}
    route_days: List[Dict[str, Any]] = []

    for day_num in range(1, total_days + 1):
        day_candidates = list(grouped_days.get(day_num, []))
        if not day_candidates:
            continue

        day_start_dt = start_dt + timedelta(days=day_num - 1)
        curr_lat = config.start_location.latitude
        curr_lon = config.start_location.longitude
        curr_time = day_start_dt
        seq = 1
        day_cost = 0.0
        day_legs: List[Dict[str, Any]] = []
        prev_name = config.start_location.name

        while day_candidates:
            if config.optimize_route:
                best_idx = 0
                best_score = float("inf")
                for idx, p in enumerate(day_candidates):
                    transit_mins = compute_fallback_transit_minutes(
                        curr_lat, curr_lon, p.latitude, p.longitude, config.travel_mode
                    )
                    arrival_est = curr_time + timedelta(minutes=transit_mins)
                    _, wait_mins = _clamp_to_opening_time(arrival_est, p.opening_time)
                    slot_rank = (
                        TIME_SLOT_ORDER.get(p.time_slot or "", 0) if p.time_slot else 0
                    )
                    # Use sequence_in_day as a gentle tie-breaker if available
                    seq_tiebreaker = (p.sequence_in_day * 0.1) if p.sequence_in_day is not None else 50.0
                    score = slot_rank * 1000.0 + wait_mins * 3.0 + transit_mins + seq_tiebreaker
                    if score < best_score:
                        best_score = score
                        best_idx = idx
                chosen = day_candidates.pop(best_idx)
            else:
                chosen = day_candidates.pop(0)

            transit_mins = await compute_transit_minutes(
                curr_lat,
                curr_lon,
                chosen.latitude,
                chosen.longitude,
                config.travel_mode,
                curr_time,
                config.google_maps_api_key,
            )
            arrival_raw = curr_time + timedelta(minutes=transit_mins)
            arrival, _ = _clamp_to_opening_time(arrival_raw, chosen.opening_time)
            duration_mins, cost_inr = resolve_stop_duration_and_cost(
                chosen, config.artisan_preference
            )
            departure = arrival + timedelta(minutes=duration_mins)

            if chosen.closing_time:
                close_dt = arrival.replace(
                    hour=chosen.closing_time.hour,
                    minute=chosen.closing_time.minute,
                    second=0,
                    microsecond=0,
                )
                # If closing_time is post-midnight (e.g. 00:00 - 04:59) and arrival was afternoon/evening,
                # or if closing_time is earlier than opening_time, wrap to the next morning
                if (chosen.opening_time and chosen.closing_time <= chosen.opening_time) or (
                    chosen.closing_time.hour < 5 and arrival.time().hour >= 12
                ):
                    close_dt += timedelta(days=1)

                if departure > close_dt or arrival >= close_dt:
                    closing_hour_conflicts.append(
                        f"{chosen.name} closes at {chosen.closing_time.strftime('%H:%M')} "
                        f"(planned {arrival.strftime('%H:%M')}–{departure.strftime('%H:%M')})"
                    )

            stop_obj = PlannedStop(
                place_id=chosen.id,
                name=chosen.name,
                category=chosen.category,
                latitude=chosen.latitude,
                longitude=chosen.longitude,
                day_number=day_num,
                sequence_in_day=seq,
                planned_arrival=arrival,
                planned_departure=departure,
                suggested_duration_minutes=duration_mins,
                transit_minutes_from_prev=transit_mins,
                estimated_cost_inr=cost_inr,
                time_slot=chosen.time_slot,
                source_attribution=chosen.source_attribution,
                private_notes=chosen.private_notes,
            )
            planned_stops.append(stop_obj)
            day_legs.append(
                {
                    "from_name": prev_name,
                    "from_lat": curr_lat,
                    "from_lng": curr_lon,
                    "to_place_id": chosen.id,
                    "to_name": chosen.name,
                    "to_lat": chosen.latitude,
                    "to_lng": chosen.longitude,
                    "travel_mode": config.travel_mode,
                    "distance_meters": round(
                        haversine_distance_meters(
                            curr_lat, curr_lon, chosen.latitude, chosen.longitude
                        ),
                        1,
                    ),
                    "transit_minutes": transit_mins,
                }
            )
            day_cost += cost_inr
            total_cost += cost_inr
            curr_lat, curr_lon = chosen.latitude, chosen.longitude
            curr_time = departure
            prev_name = chosen.name
            seq += 1

        daily_costs[day_num] = day_cost
        day_duration = int((curr_time - day_start_dt).total_seconds() // 60)
        total_active_duration_minutes += day_duration
        route_days.append(
            {
                "day_number": day_num,
                "start_location": {
                    "name": config.start_location.name,
                    "latitude": config.start_location.latitude,
                    "longitude": config.start_location.longitude,
                },
                "daily_cost_inr": day_cost,
                "daily_duration_minutes": day_duration,
                "legs": day_legs,
            }
        )

    if config.budget_mode == "per_day":
        budget_limit = config.budget_inr * total_days
        budget_exceeded = (total_cost > budget_limit) or any(
            dc > config.budget_inr for dc in daily_costs.values()
        )
    else:
        budget_limit = config.budget_inr
        budget_exceeded = total_cost > budget_limit

    is_feasible = (not budget_exceeded) and (len(closing_hour_conflicts) == 0)

    return SolvedItinerary(
        is_feasible=is_feasible,
        stops=planned_stops,
        total_estimated_cost_inr=total_cost,
        total_estimated_duration_minutes=total_active_duration_minutes,
        budget_exceeded=budget_exceeded,
        budget_limit_inr=budget_limit,
        closing_hour_conflicts=closing_hour_conflicts,
        route_geometry={
            "travel_mode": config.travel_mode,
            "start_datetime": start_dt.isoformat(),
            "start_location": {
                "name": config.start_location.name,
                "latitude": config.start_location.latitude,
                "longitude": config.start_location.longitude,
            },
            "days": route_days,
        },
    )
