# 06: TrailWeave Artisan Smart Recommendation Scorer

**What to build:**
An inclusive, constraint-aware recommendation engine that discovers and surfaces verified Udaipur artisan studios directly within the tourist's itinerary. Rather than burying local craftsmen in an obscure directory, the engine scores nearby artisan workshops (miniature art, pottery, puppetry) along the tourist's active route, respecting the tourist's budget and experience preference (hands-on workshop vs. quick retail visit), presenting an actionable proposal with transparent detour impact.

**Blocked by:** 04: Deterministic Itinerary Planner & Relative Duration Solver

**Status:** resolved

- [x] Spatial search queries verified `artisans` and `places` within a 15-minute detour buffer of planned route stops.
- [x] Filters by tourist's artisan preference: `workshops` (45–75 mins, hands-on fee), `store_visits` (15–25 mins, ₹0 entry), or `both`.
- [x] Verifies candidate artisan opening hours and confirms workshop fee fits within remaining trip budget.
- [x] Generates transparent recommendation rationale string (e.g., *"Master Mohanlal Miniature Art Studio: 6 min detour, ₹300 workshop fee, open until 7 PM, fits under your ₹2,000 budget"*).
- [x] Produces an actionable candidate recommendation card in the Trip Builder and active trip planner with a 1-tap "Accept & Add to Route" action.
- [x] Integration with replan preview to seamlessly inject the accepted studio into the route schedule.

## Comments

### Implementation Summary
- **Recommendation Engine (`backend/app/engine/artisan_scorer.py`)**:
  - Implemented `ArtisanRecommendationScorer.score_candidates()` evaluating incremental transit detour along route stops (`Transit(A -> Art) + Transit(Art -> B) - Transit(A -> B)`), anchored to visited stops or starting location.
  - Enforced 15-minute detour buffer threshold (`detour_minutes <= 15`).
  - Implemented preference adaptation (`workshops`: 45–75m, fee required; `store_visits`: 20m, ₹0 fee; `both`: workshops prioritized with automatic fallback to retail visit if budget is tight).
  - Enforced venue operating hours compatibility and budget headroom constraints (`fee <= remaining_budget`).
  - Added candidate deduplication excluding artisans already present in itinerary stops.
  - Generated transparent, human-readable rationale strings (e.g. *"Master Kavita Kumhar: 5 min detour, ₹250 workshop fee, open until 7:30 PM, fits under your ₹1,070 budget"*).
  - Ranked candidates by minimal detour minutes, workshop preference bonus, and craft variety.
- **API Endpoints & Schemas (`backend/app/api/v1/artisans.py`, `backend/app/schemas/artisans.py`)**:
  - `GET /api/trips/{trip_id}/recommendations/artisans` (and alias `/trips/{trip_id}/artisan-recommendations`): Loads active trip, computes remaining budget from scheduled stops, queries verified approved artisans, and returns ranked recommendations.
  - `POST /api/trips/recommendations/artisans`: Transient recommendation scoring for pre-trip baskets and Trip Builder candidate stops.
- **Seed Data Enhancement (`backend/app/db/seed.py`)**:
  - Seeded 3 additional verified Udaipur artisan studios into database and seed files:
    - *Master Kavita Kumhar* (Terracotta Pottery & Clay Sculpting, Chandpole Ghat, ₹250 workshop fee)
    - *Babu Bhatt Puppeteer* (Kathputli Traditional String Puppetry, Gangaur Ghat, ₹200 workshop fee)
    - *Ramesh Chandra Parmar* (Handcrafted Camel Leather & Mojari Juttis, Hathi Pole, ₹0 retail store visit)
- **Frontend Recommendation Cards & Replan Integration (`frontend/`)**:
  - Created `ArtisanRecommendationCard.tsx` with craft badges, detour indicators, rationale callout, and 1-tap **"Accept & Add to Route"** button.
  - Integrated into Operational View (`frontend/app/trip/page.tsx`): Tapping "Accept & Add to Route" triggers `requestReplanPreview` with an `add_stop` operation and opens `ReplanPreviewModal` for atomic revision commitment.
  - Integrated into Direct-Manipulation Stop Editor (`frontend/components/trip/UpcomingStopEditor.tsx`): Surfaces nearby artisans with direct insertion into upcoming stops timeline.
  - Integrated into Trip Basket (`frontend/components/basket/BasketDrawer.tsx`): Surfaces smart detour recommendations that can be added to the pre-trip basket with 1 tap.
- **Specifications & ADR Sync**:
  - Recorded [`docs/adr/0009-artisan-smart-recommendation-scorer-and-detour-engine.md`](../../adr/0009-artisan-smart-recommendation-scorer-and-detour-engine.md).
  - Updated [`docs/API_SPEC.md`](../../API_SPEC.md) with REST endpoint schemas and query parameters.

### Verification Notes
- **Backend Unit Tests (`backend/tests/test_artisan_scorer.py`, 6 tests)**:
  - Verified 15-minute detour buffer filtering (distant studios filtered out).
  - Verified exclusion of already scheduled artisans.
  - Verified workshop, store visit, and dual preference modes.
  - Verified budget headroom enforcement.
  - Verified transparent rationale string syntax.
- **Backend API Integration Tests (`backend/tests/test_artisan_recommendations_api.py`, 2 tests)**:
  - Verified `GET /api/trips/{trip_id}/recommendations/artisans` returns 200 with ranked recommendations.
  - Verified `POST /api/trips/recommendations/artisans` returns 200 with workshop filtering.
- **Frontend Tests (`frontend/tests/artisan_recommendation.test.mjs`, 2 tests + 2 basket tests = 4 tests passing)**:
  - Verified duplicate filtering, detour threshold, and 1-tap accept sequence reindexing with `add_stop` operation derivation.
- **Frontend Production Build**: `npm run build` compiled with 0 errors and 0 type warnings.
- **Regression Suite**: All 29 unit and integration tests passing (`pytest backend/tests`).
