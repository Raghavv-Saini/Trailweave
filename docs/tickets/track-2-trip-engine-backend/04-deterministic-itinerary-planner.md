# 04: Deterministic Itinerary Planner & Relative Duration Solver

**What to build:**
A deterministic scheduling engine that converts a basket of chosen places or community trail into an optimized, feasible personal itinerary. The tourist configures their travel parameters (daily start location/hotel, trip dates, budget cap, travel mode, and artisan preference). The backend validates venue opening and closing hours, computes transit time matrices, enforces budget limits, and optimizes the stop sequence into an authoritative `itinerary_version` stored in PostgreSQL with concrete arrival and departure timestamps.

**Blocked by:** 01: Project Foundation, Core PostGIS Schema & Udaipur Seed Data

**Status:** resolved

- [x] Solver ingests selected places, tourist start location (e.g., Hotel Swaroop Vilas), start time, and total budget.
- [x] Validates operating hours for all Udaipur places, preventing arrivals during closed windows.
- [x] Computes transit durations and walking/auto-rickshaw routes between successive stops.
- [x] Enforces hard budget constraints: computes total entry and workshop fees and flags or rejects infeasible schedules.
- [x] Expands relative duration model (`suggested_duration_minutes`, `time_slot`, `day_number`) into absolute timestamps (`planned_arrival`, `planned_departure`).
- [x] Supports both single-day (morning to evening) and multi-day (Day 1, Day 2, Day 3) itineraries.
- [x] Persists output as an authoritative `trips` record (`revision = 1`) and immutable `itinerary_versions` snapshot with initial `trip_stops`.

## Comments

### Implementation Summary
- **Deterministic Planner Service (`backend/app/services/planner.py`)**:
  - Implemented `solve_itinerary()` accepting `PlaceCandidate` items and `PlannerConfig` (`start_location`, `start_datetime`, `total_days`, `budget_inr`, `budget_mode`, `travel_mode`, `artisan_preference`, `optimize_route`, `google_maps_api_key`).
  - **Route Optimization & Multi-Day Distribution**: Groups stops across `Day 1..total_days` (auto-distributing unassigned basket stops with spatial affinity to avoid cross-city bouncing) and sequences stops within each day by `time_slot`, waiting penalties (`opening_time`), and spatial proximity starting each morning at `start_location`.
  - **Hybrid Transit Calculation**: Queries Google Distance Matrix API (`walking` / `driving` with live `departure_time` traffic) when `GOOGLE_MAPS_API_KEY` is configured, falling back deterministically to WGS84 Haversine distance with Udaipur old-city mode speeds (`walking`: 4.5 km/h, `auto_rickshaw`: 18 km/h, `cab`: 22 km/h, 1.3x winding factor, 5-min minimum buffer). Resilient optional import for `httpx`.
  - **Operating Hours & Budget Validation**:
    - Normalizes `start_datetime` to Udaipur local IST (`UTC+05:30`), preventing 5.5-hour timezone distortion when clients send UTC ISO strings.
    - Accurately validates venues open until post-midnight hours (e.g., 01:00 AM) without false positive conflicts.
    - Shifts early arrivals forward to `opening_time`, flags departures or arrivals past `closing_time` in `closing_hour_conflicts`, adapts artisan studio durations and fees (`workshop` vs `store` per ADR 0006), and validates `total` and `per_day` budget caps.
  - **Route Geometry Metadata**: Enriches `itinerary_versions.route_geometry` with `start_datetime`, `start_location`, and `travel_mode` for seamless replan preview computations.
- **FastAPI Endpoint (`POST /api/trips` in `backend/app/api/v1/trips.py`)**:
  - Accepts `TravelRequest` (`place_ids`, `stops`, or `source_trail_id` to clone a `CommunityTrail`).
  - Preserves curated sequence when cloning community trails by defaulting `optimize_route` to `False` unless user explicitly requests re-optimization.
  - Records initial trip creation audit event (`event_type: 'trip_created'`) in `trip_events`.
  - Returns `warnings` array in `TripResponse` when warnings are allowed.
  - Rejects infeasible schedules with `HTTP 422` and structured conflict details when `allow_warnings=False`.
  - Atomically persists `trips` (`revision = 1`), `itinerary_versions` (`version_number = 1` with `route_geometry`), and `trip_stops` with concrete `planned_arrival` and `planned_departure` timestamps.
- **Engine & Routing Consolidation**:
  - `backend/app/engine/planner.py`: Re-exports `DeterministicPlanner` wrapping `solve_itinerary` and shared types (`PlannerConfig`, `PlaceCandidate`, `StartLocation`).
  - `backend/app/services/routing.py`: Harmonized haversine and transit time calculations with `planner.py`.
- **Spec & ADR Sync**:
  - Recorded [`docs/adr/0007-deterministic-itinerary-planner-and-transit-routing.md`](../../adr/0007-deterministic-itinerary-planner-and-transit-routing.md).
  - Updated [`docs/API_SPEC.md`](../../API_SPEC.md) §1.3 with `POST /api/trips`.

### Verification Notes
- Unit test suite (`backend/tests/test_planner_engine.py`, 8 tests) covering:
  - Single-day optimization and timestamp expansion
  - Operating hour clamps and closing hour violations
  - Post-midnight closing times without false conflict
  - UTC ISO datetime normalization to IST without distortion
  - Hard budget constraints and artisan preference duration/fee adaptation
  - Multi-day spatial clustering and per-day budget validation
  - Google Distance Matrix traffic query fallback
  - Curated trail sequence preservation when `optimize_route = False`
