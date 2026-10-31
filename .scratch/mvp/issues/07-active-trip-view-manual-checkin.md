# 07: Active Trip Operational View & Manual Check-in Fallback

**What to build:**
A persistent mobile in-trip execution interface that guides tourists in real time through Udaipur. It displays the current stop card, upcoming stops timeline, navigation deep links, and live progress indicators (visited/skipped/remaining). It provides smart geofencing with automated 100m proximity check-in prompts, a prominent 1-tap **Manual Check-in Fallback** on every card for narrow old-city alleys and GPS dead zones, and a 20-minute missed-checkout grace buffer recovery.

**Blocked by:** None (can start immediately against mock active trip JSON; integrates with 01: Project Foundation, Core PostGIS Schema & Udaipur Seed Data and 04: Deterministic Itinerary Planner)

**Status:** ready-for-agent

- [ ] Mobile-optimized active trip dashboard accessible via persistent "My Trip" navigation.
- [ ] Operational view displays current active stop card with place image, address, planned departure, and deep-link button opening Google Maps directions.
- [ ] Timeline lists all stops for the day with clear status badges (`pending`, `visited`, `skipped`) and pinned indicators.
- [ ] HTML5 geolocation watcher monitors user coordinates and triggers an arrival check-in prompt when within 100m of the active stop.
- [ ] Prominent 1-tap **Manual Check-in Fallback** button rendered on every stop card, enabling instant check-in without requiring GPS permissions or cellular lock.
- [ ] Manual departure checkout button that records departure timestamp and advances the active stop pointer.
- [ ] 20-minute missed-checkout grace buffer: if traveler departs without tapping checkout, automatically resolves departure after planned duration + 20 minutes.
- [ ] Calls `POST /api/trips/{trip_id}/stops/{stop_id}/visit` and `/checkout` with method audit (`manual_fallback` vs `geofence_proximity`).
