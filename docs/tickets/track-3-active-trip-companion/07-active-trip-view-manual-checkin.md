# 07: Active Trip Operational View & Manual Check-in Fallback

**What to build:**
A persistent mobile in-trip execution interface that guides tourists in real time through Udaipur. It displays the current stop card, upcoming stops timeline, navigation deep links, and live progress indicators (visited/skipped/remaining). It provides smart geofencing with automated 100m proximity check-in prompts, a prominent 1-tap **Manual Check-in Fallback** on every card for narrow old-city alleys and GPS dead zones, and a 20-minute missed-checkout grace buffer recovery.

**Blocked by:** None (can start immediately against mock active trip JSON; integrates with 01: Project Foundation, Core PostGIS Schema & Udaipur Seed Data and 04: Deterministic Itinerary Planner)

**Status:** resolved

- [x] Mobile-optimized active trip dashboard accessible via persistent "My Trip" navigation.
- [x] Operational view displays current active stop card with place image, address, planned departure, and deep-link button opening Google Maps directions.
- [x] Timeline lists all stops for the day with clear status badges (`pending`, `visited`, `skipped`) and pinned indicators.
- [x] HTML5 geolocation watcher monitors user coordinates and triggers an arrival check-in prompt when within 100m of the active stop.
- [x] Prominent 1-tap **Manual Check-in Fallback** button rendered on every stop card, enabling instant check-in without requiring GPS permissions or cellular lock.
- [x] Manual departure checkout button that records departure timestamp and advances the active stop pointer.
- [x] 20-minute missed-checkout grace buffer: if traveler departs without tapping checkout, automatically resolves departure after planned duration + 20 minutes.
- [x] Calls `POST /api/trips/{trip_id}/stops/{stop_id}/visit` and `/checkout` with method audit (`manual_fallback` vs `geofence_proximity`).

## Comments

### Implementation Summary
- **Persistent "My Trip" Navigation**:
  - Updated [`frontend/components/common/BottomNav.tsx`](../../../frontend/components/common/BottomNav.tsx) with a live status indicator dot on "My Trip" (`/trip`) and wired [`frontend/app/page.tsx`](../../../frontend/app/page.tsx) to use `<BottomNav />` plus a direct "Open My Active Trip" CTA.
- **Active Stop Card (`ActiveStopCard.tsx`)**:
  - Enhanced [`frontend/components/trip/ActiveStopCard.tsx`](../../../frontend/components/trip/ActiveStopCard.tsx) to display place image, category & entry fee badge, `Pinned` indicator (`is_pinned`), full street address, formatted `planned_arrival` and `planned_departure` times, and a Google Maps walking directions deep link (`https://www.google.com/maps/dir/?api=1&destination=...&travelmode=walking`).
  - Rendered a prominent 1-tap **Manual Check-in Fallback** button on the active stop card and an in-card 100m geofence arrival alert when within 100 meters.
- **Day Itinerary Timeline (`TimelineList.tsx`)**:
  - Updated [`frontend/components/trip/TimelineList.tsx`](../../../frontend/components/trip/TimelineList.tsx) to display status badges (`pending`, `visited`, `skipped`), `Pinned` badges, street addresses, planned time windows, check-in/checkout audit method pills (`manual_fallback`, `geofence_proximity`, `manual_tap`, `grace_buffer_timeout`), a 1-tap **Manual Check-in Fallback** button on every pending stop card, and a **Depart & Check Out** action on visited stops awaiting departure checkout.
- **Smart Geofencing, 1-Tap Manual Fallback & 20-Minute Grace Buffer (`app/trip/page.tsx` & `TripContext.tsx`)**:
  - Implemented HTML5 `navigator.geolocation.watchPosition` in [`frontend/app/trip/page.tsx`](../../../frontend/app/trip/page.tsx) with Haversine distance calculation to trigger the arrival check-in modal ([`ManualCheckinModal.tsx`](../../../frontend/components/trip/ManualCheckinModal.tsx)) when within $\le 100\text{m}$ of the active stop.
  - Configured check-in (`/visit`) to immediately advance the active stop pointer to the next pending stop while allowing departure checkout (`/checkout`) from the visited stop's timeline card or active touring banner.
  - Added a 20-minute missed-checkout grace buffer watcher (`suggested_duration_minutes + 20m`) that automatically resolves departure with `checkout_method: "grace_buffer_timeout"`.
  - Added a collapsible **Geofence & Grace Buffer Demo Simulator** bar on `/trip` to simulate `<100m` GPS arrival and fast-forward the `+20m` grace buffer timeout during live demos.
- **Backend API & Seed Sync (`backend/app/api/v1/trips.py`, `schemas/trips.py`, `db/seed.py`, `docs/API_SPEC.md`)**:
  - Enriched `GET /api/trips/{trip_id}` stop payloads with joined place metadata (`address`, `latitude`, `longitude`, `category`, `entry_fee_inr`, `image_url`) and synced [`docs/API_SPEC.md`](../../API_SPEC.md).
  - Updated `POST /api/trips/{trip_id}/stops/{stop_id}/visit` and `/checkout` to record `trip_events` audit entries with `manual_fallback` vs `geofence_proximity` and `manual_tap` vs `grace_buffer_timeout`.
  - Added idempotent seed data for `trip_demo_udaipur` in [`backend/app/db/seed.py`](../../../backend/app/db/seed.py).

### Verification Notes
- `npx tsc --noEmit` in `frontend/` passed with 0 TypeScript errors.
- `python -m py_compile` passed across all modified backend modules and [`backend/tests/test_active_trip.py`](../../../backend/tests/test_active_trip.py).
