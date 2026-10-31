# ADR 0008: Unified Mutation Engine, Replan Lifecycle & Revision Locking

## Status
Accepted

## Context
In TrailWeave, active itineraries undergo real-time modifications during travel via two symmetrical pathways (ADR 0005):
1. **Manual Direct Editing** in the in-trip UI (Track 3) by skipping, adding, removing, reordering, or pinning upcoming stops.
2. **AI-Assisted Natural Language Modification** via Gemini companion tool calls (`propose_trip_changes`).

Without strict optimistic concurrency controls, parallel or interleaved edits from the user and AI could cause race conditions, lost updates, or schedules violating venue operating hours or tourist budget caps. Ticket 05 requires establishing the unified mutation engine, proposal preview lifecycle, and revision-locked atomic commits.

## Decisions

### 1. Unified Mutation Engine (`backend/app/engine/replan.py`)
- All itinerary mutations (`skip_stop`, `add_stop`, `remove_stop`, `reorder_stops`, `pin_stop`) route through `UnifiedMutationEngine.evaluate_mutation()`.
- **Frozen Completed Stops**: Historical stops with `visit_status = 'visited'` are immutable. Any attempt to modify, remove, skip, or reorder a visited stop immediately fails with `HTTP 400 Bad Request` ("Cannot modify already completed stop").
- **`skip_stop` Semantics**: The stop remains in the itinerary version with `visit_status = 'skipped'`, enabling the UI timeline to display it with a skipped badge. Transit bypasses the skipped stop directly to the next pending venue, and its duration and entry fee are omitted from active schedule calculations.
- **`remove_stop` Semantics**: Permanently deletes the upcoming stop from the itinerary sequence.
- **`add_stop` Semantics**: Inserts a new venue from the canonical catalog at the specified sequence position (`new_order`), fetching operating hours, fees, and artisan workshop metadata.
- **In-Flight Timeline Anchoring**: Upcoming stops are recalculated starting from the departure time and coordinates of the last completed stop (or current time if later). If no stops are completed, the trip's original `start_datetime` and `start_location` serve as the anchor.

### 2. Two-Phase Proposal Protocol (`replan-preview` -> `replan-accept`)
- **Provisional Proposal (`POST /api/trips/{trip_id}/replan-preview`)**:
  - Computes transit durations, clamps to venue opening hours, and detects venue closing conflicts.
  - Computes `ValidationDiff` (`cost_delta_inr`, `duration_delta_minutes`, `stops_added`, `stops_skipped`, `closing_hour_conflicts`).
  - Flags `is_feasible = False` if remaining budget is exceeded or closing hour conflicts occur.
  - Persists proposal in `replan_proposals` with `status = 'pending'` and a 15-minute expiration (`expires_at = NOW() + 15m`).
- **Atomic Concurrency-Locked Commit (`POST /api/trips/{trip_id}/replan-accept`)**:
  - Acquires row-level lock: `SELECT * FROM trips WHERE id = :id FOR UPDATE`.
  - Verifies `expected_revision == trip.revision`.
  - On revision mismatch: rejects immediately with `HTTP 409 Conflict` returning `{"detail": "...", "current_revision": trip.revision}`.
  - On revision match:
    1. Increments `trip.revision` (monotonic integer).
    2. Inserts new immutable `itinerary_versions` record with `version_number = new_revision`.
    3. Inserts updated `trip_stops` snapshot referencing the new itinerary version.
    4. Updates `trips.current_itinerary_version_id` and `trips.updated_at`.
    5. Updates `replan_proposals.status = 'accepted'`.
    6. Appends audit record to `trip_events` (`event_type = 'replan_committed'`).
    7. Atomically commits the database transaction.

### 3. Append-Only Event Log (`GET /api/trips/{trip_id}/events`)
- Exposes `trip_events` ordered by `created_at DESC` with configurable `limit` (1–100, default 20) for in-app timeline audits and fresh context injection for the Gemini assistant tool calls (`get_recent_trip_events`).

## Consequences
- Guaranteed mathematical and temporal consistency between manual and conversational edits.
- Zero race conditions or lost updates under concurrent interactions.
- Full compliance with ADR 0001, ADR 0005, and Ticket 05 acceptance criteria.
