# 06: TrailWeave Artisan Smart Recommendation Scorer

**What to build:**
An inclusive, constraint-aware recommendation engine that discovers and surfaces verified Udaipur artisan studios directly within the tourist's itinerary. Rather than burying local craftsmen in an obscure directory, the engine scores nearby artisan workshops (miniature art, pottery, puppetry) along the tourist's active route, respecting the tourist's budget and experience preference (hands-on workshop vs. quick retail visit), presenting an actionable proposal with transparent detour impact.

**Blocked by:** 04: Deterministic Itinerary Planner & Relative Duration Solver

**Status:** ready-for-agent

- [ ] Spatial search queries verified `artisans` and `places` within a 15-minute detour buffer of planned route stops.
- [ ] Filters by tourist's artisan preference: `workshops` (45–75 mins, hands-on fee), `store_visits` (15–25 mins, ₹0 entry), or `both`.
- [ ] Verifies candidate artisan opening hours and confirms workshop fee fits within remaining trip budget.
- [ ] Generates transparent recommendation rationale string (e.g., *"Master Mohanlal Miniature Art Studio: 6 min detour, ₹300 workshop fee, open until 7 PM, fits under your ₹2,000 budget"*).
- [ ] Produces an actionable candidate recommendation card in the Trip Builder and active trip planner with a 1-tap "Accept & Add to Route" action.
- [ ] Integration with replan preview to seamlessly inject the accepted studio into the route schedule.
