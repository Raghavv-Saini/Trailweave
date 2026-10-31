# 04: Deterministic Itinerary Planner & Relative Duration Solver

**What to build:**
A deterministic scheduling engine that converts a basket of chosen places or community trail into an optimized, feasible personal itinerary. The tourist configures their travel parameters (daily start location/hotel, trip dates, budget cap, travel mode, and artisan preference). The backend validates venue opening and closing hours, computes transit time matrices, enforces budget limits, and optimizes the stop sequence into an authoritative `itinerary_version` stored in PostgreSQL with concrete arrival and departure timestamps.

**Blocked by:** 01: Project Foundation, Core PostGIS Schema & Udaipur Seed Data

**Status:** ready-for-agent

- [ ] Solver ingests selected places, tourist start location (e.g., Hotel Swaroop Vilas), start time, and total budget.
- [ ] Validates operating hours for all Udaipur places, preventing arrivals during closed windows.
- [ ] Computes transit durations and walking/auto-rickshaw routes between successive stops.
- [ ] Enforces hard budget constraints: computes total entry and workshop fees and flags or rejects infeasible schedules.
- [ ] Expands relative duration model (`suggested_duration_minutes`, `time_slot`, `day_number`) into absolute timestamps (`planned_arrival`, `planned_departure`).
- [ ] Supports both single-day (morning to evening) and multi-day (Day 1, Day 2, Day 3) itineraries.
- [ ] Persists output as an authoritative `trips` record (`revision = 1`) and immutable `itinerary_versions` snapshot with initial `trip_stops`.
