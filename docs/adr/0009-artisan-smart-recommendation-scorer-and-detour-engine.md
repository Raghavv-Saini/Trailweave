# ADR 0009: Artisan Smart Recommendation Scorer & Constraint-Aware Detour Engine

## Status
Accepted

## Context
A foundational value proposition of TrailWeave is connecting cultural tourists with traditional local artisans across Udaipur (miniature Pichwai painting, terracotta pottery, traditional wooden kathputli puppetry, and handcrafted camel leather craft). However, tourists rarely search through separate, disconnected directories during active travel. 

Ticket 06 requires building an inclusive, constraint-aware recommendation engine that scores nearby verified artisan studios directly along the tourist's itinerary within a 15-minute detour buffer, respecting the tourist's remaining trip budget and experience preference (hands-on workshop vs. quick retail store visit), generating transparent human-readable rationales, and enabling 1-tap route injection via the unified replan engine.

## Decisions

### 1. Spatial Detour Buffer Evaluation
- For any candidate artisan studio $A$ and a sequence of route stops $P_1, P_2, \dots, P_m$, the incremental detour incurred by inserting $A$ between stops $P_i$ and $P_{i+1}$ is computed using the hybrid transit routing service:
  $$\Delta T_i = \text{Transit}(P_i \to A) + \text{Transit}(A \to P_{i+1}) - \text{Transit}(P_i \to P_{i+1})$$
- Insertion before the first upcoming stop (anchored to the last visited stop or start hotel) and insertion after the final stop are also evaluated.
- A candidate qualifies if $\min_i \Delta T_i \le 15\text{ minutes}$. Candidates beyond the 15-minute buffer are strictly excluded.

### 2. Preference Adaptation & Budget Headroom Validation (ADR 0006)
- **`preference = 'workshops'`**: Filters exclusively for verified artisans where `has_workshop = True`, allocating the workshop duration (45–75 mins) and workshop fee.
- **`preference = 'store_visits'`**: Treats the visit as a 20-minute retail stop with ₹0 entry fee.
- **`preference = 'both'`**: Prioritizes interactive workshops when `has_workshop = True` and the workshop fee fits within `remaining_budget`. If budget headroom is insufficient, it automatically falls back to a ₹0 retail store visit rather than dropping the artisan entirely.
- Excludes artisans whose places are already present in the itinerary.

### 3. Transparent Human-Readable Rationale Generation
- Every recommendation produces an explanatory rationale string explicitly stating detour duration, cost, operating hours, and budget fit:
  - Workshop: `"{artisan_name}: {detour} min detour, ₹{fee} workshop fee, open until {closing_time}, fits under your ₹{budget} budget"`
  - Store: `"{artisan_name}: {detour} min detour, ₹0 entry (store visit), open until {closing_time}, fits under your ₹{budget} budget"`

### 4. Authoritative API Contracts
- `GET /api/trips/{trip_id}/recommendations/artisans`: Evaluates active itinerary stops, dynamically calculates remaining budget, and returns ranked recommendations.
- `POST /api/trips/recommendations/artisans`: Ingests transient route stops or basket items to provide instant detour recommendations in the Trip Builder prior to trip persistence.

### 5. Seamless Replan Preview Integration (ADR 0005 & ADR 0008)
- Tapping **"Accept & Add to Route"** in either the Active Trip companion or Upcoming Stop Editor stages an `add_stop` operation at `optimal_insert_order`.
- In the active companion, it invokes `POST /api/trips/{trip_id}/replan-preview`, launching the `ReplanPreviewModal` where the tourist reviews before-and-after duration and cost deltas, and commits the modification with optimistic revision locking.

## Consequences
- Elevates local craftsmen into active, high-intent travel flows without disrupting itinerary feasibility.
- Guarantees zero budget overruns and zero venue closing hour violations.
- Harmonizes discovery across both pre-trip planning (Basket / Trip Builder) and in-trip live navigation.
