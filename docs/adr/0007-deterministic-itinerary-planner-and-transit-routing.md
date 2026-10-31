# ADR 0007: Deterministic Itinerary Planner, Route Optimization & Hybrid Transit Calculation

## Status
Accepted

## Context
Ticket 04 requires converting a tourist's `TravelRequest` (selected canonical places or a cloned `CommunityTrail`, daily start location/hotel such as Hotel Swaroop Vilas, start time, single-day or multi-day duration, `budget_inr`, `budget_mode`, `travel_mode`, and `artisan_preference`) into an authoritative `trips` record (`revision = 1`) and `itinerary_versions` snapshot (`version_number = 1`) with concrete `planned_arrival` and `planned_departure` timestamps. `docs/API_SPEC.md` previously omitted the creation endpoint (`POST /api/trips`), and transit calculation needed to support real-time routing while guaranteeing offline/test determinism per ADR 0001.

## Decisions

### 1. Authoritative Creation Contract (`POST /api/trips`)
- `POST /api/trips` accepts a `TravelRequest` containing either `stops` / `place_ids` (basket) or `source_trail_id` (cloning a `CommunityTrail`), along with `start_location`, `start_datetime`, `total_days`, `budget_inr`, `budget_mode` (`total` | `per_day`), `travel_mode` (`walking` | `auto_rickshaw` | `cab`), `artisan_preference` (`workshop` | `store` | `both` | `none`), and `allow_warnings` (default `false`).
- If the solved schedule violates hard budget constraints or venue closing hours and `allow_warnings` is `false`, the endpoint rejects the request with `HTTP 422 Unprocessable Entity` containing structured violation details (`budget_exceeded`, `closing_hour_conflicts`, `total_estimated_cost_inr`, `budget_limit_inr`). When feasible (or `allow_warnings=true`), it atomically persists `trips` (`revision = 1`), `itinerary_versions` (`version_number = 1`), and `trip_stops`.

### 2. Route Optimization & Multi-Day Sequencing
- The solver optimizes stop order within each day using time-slot buckets (`morning` -> `afternoon` -> `sunset_evening` -> `evening` -> `night`), venue `opening_time` / `closing_time` windows, and greedy nearest-neighbor spatial proximity from the current coordinates (starting each morning at `start_location`).
- If a tourist arrives before a venue's `opening_time`, `planned_arrival` shifts forward to `opening_time`.
- For multi-day trips (`total_days > 1`), stops without explicit `day_number` are balanced across days respecting daily active time windows and opening hours.
- Subsequent manual or AI reordering remains supported via the unified replan engine (`POST /api/trips/{trip_id}/replan-preview`).

### 3. Hybrid Transit Calculation (Google Distance Matrix / Routes API + PostGIS/Haversine Fallback)
- When `GOOGLE_MAPS_API_KEY` is configured, transit durations between coordinates are fetched from the Google Distance Matrix API (mapping `walking` -> `walking`, and `auto_rickshaw` / `cab` -> `driving` with live `departure_time` traffic).
- When `GOOGLE_MAPS_API_KEY` is absent, offline, or in deterministic unit tests, the engine computes great-circle distance and applies Udaipur mode speeds (`walking`: 4.5 km/h, `auto_rickshaw`: 18 km/h, `cab`: 22 km/h, with a 1.3x old-city road winding factor and 5-minute minimum buffer).

### 4. Artisan Engagement Adaptation (ADR 0006)
- For places linked to a verified `Artisan`:
  - `artisan_preference in ("workshop", "both")` (when `has_workshop = true`): uses `workshop_duration_minutes` (unless overridden) and adds `workshop_fee_inr` to stop cost.
  - `artisan_preference == "store"`: uses quick retail visit duration (20 mins default) and ₹0 workshop fee.

## Consequences
- Frontend (Track 1 & Track 3) and Backend (Track 2 Ticket 05 & Ticket 06) share a single deterministic scheduling core (`app/services/planner.py`) for both initial trip creation and subsequent replan previews.
