# 05: Unified Mutation Engine & Revision-Locked Replan API

**What to build:**
The core replanning and concurrency engine that serves as the single authorized mutation pathway for both direct manual UI adjustments and conversational AI modifications. It exposes endpoints to preview candidate modifications and accept validated proposals. It guarantees data integrity via monotonic trip revisions and optimistic concurrency control, returning HTTP 409 Conflict if a modification is submitted against a stale revision.

**Blocked by:** 04: Deterministic Itinerary Planner & Relative Duration Solver

**Status:** resolved

- [x] `POST /api/trips/{trip_id}/replan-preview` accepts candidate operations (`skip_stop`, `add_stop`, `remove_stop`, `reorder_stops`, `pin_stop`) bound to a `base_revision`.
- [x] Replan engine evaluates feasibility: verifies venue opening hours, recalculates transit times, and checks remaining budget.
- [x] Returns structured `ReplanProposal` containing candidate stop sequence and before/after diff (cost delta, duration delta, closing-hour warnings).
- [x] `POST /api/trips/{trip_id}/replan-accept` validates that `expected_revision == trip.revision`.
- [x] On revision match: executes atomic database transaction that increments `trip.revision`, stores snapshot in `itinerary_versions`, updates `trip_stops`, records entry in `trip_events`, and marks proposal `accepted`.
- [x] On revision mismatch: rejects commit with `HTTP 409 Conflict` and payload returning current revision number.
- [x] `GET /api/trips/{trip_id}/events` returns append-only audit trail of recent accepted events.

## Comments

### Implementation Summary
- **Unified Mutation Engine (`backend/app/engine/replan.py`)**:
  - Implemented `UnifiedMutationEngine.evaluate_mutation()` with full operation support: `skip_stop` (marked `visit_status = "skipped"`, bypassing duration, cost, and transit), `remove_stop` (sequence deletion), `add_stop` (catalog lookup with artisan workshop metadata and positioning at `new_order`), `reorder_stops` (sequence index update), and `pin_stop` (`is_pinned = True`).
  - Enforced frozen completed stops: any mutation targeting a stop with `visit_status == "visited"` raises `ValueError` returning `HTTP 400 Bad Request`.
  - Recalculates in-flight timelines anchored to the last completed stop's departure time and coordinates (or current time if later), falling back to `start_location` and `start_datetime` if no stops are completed.
  - Generates `ValidationDiff` (`cost_delta_inr`, `duration_delta_minutes`, `stops_added`, `stops_skipped`, `closing_hour_conflicts`) and flags `is_feasible = False` if budget is exceeded or closing conflicts exist.
- **FastAPI Endpoints (`backend/app/api/v1/replan.py`)**:
  - `POST /api/trips/{trip_id}/replan-preview`: Enriches active stops, runs mutation evaluation, persists provisional proposal in `replan_proposals` (`expires_at = NOW() + 15m`), and returns `ReplanProposalResponse`.
  - `POST /api/trips/{trip_id}/replan-accept`: Acquires row lock via `SELECT ... FOR UPDATE`, checks revision locking returning `HTTP 409 Conflict` on mismatch, atomically increments `trip.revision`, persists immutable `itinerary_versions` snapshot, inserts new `trip_stops`, updates `trips.current_itinerary_version_id`, marks proposal `accepted`, and appends `replan_committed` record to `trip_events`.
  - `GET /api/trips/{trip_id}/events`: Returns append-only audit log of recent events with configurable `limit` (default 20, max 100).
- **Specs & ADR Sync**:
  - Recorded [`docs/adr/0008-unified-mutation-engine-and-replan-lifecycle.md`](../../adr/0008-unified-mutation-engine-and-replan-lifecycle.md).
  - Updated schemas in `backend/app/schemas/replan.py`.

### Verification Notes
- **Unit Tests (`backend/tests/test_replan_engine.py`, 7 tests)**: Verified `skip_stop`, `add_stop`, `remove_stop`, `reorder_stops`, `pin_stop`, visited stop freezing (`HTTP 400`), budget cap overflow (`is_feasible = False`), and closing hour conflict detection.
- **Integration Tests (`backend/tests/test_replan_api.py`, 2 tests)**: Verified full proposal preview/accept lifecycle against PostgreSQL database with revision increment, immutable version snapshot, audit trail generation, and optimistic concurrency `HTTP 409 Conflict` handling on stale revision.
- **Full Backend Suite**: All 23 tests pass cleanly (`pytest backend/tests`).
