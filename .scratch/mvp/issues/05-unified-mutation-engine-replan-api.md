# 05: Unified Mutation Engine & Revision-Locked Replan API

**What to build:**
The core replanning and concurrency engine that serves as the single authorized mutation pathway for both direct manual UI adjustments and conversational AI modifications. It exposes endpoints to preview candidate modifications and accept validated proposals. It guarantees data integrity via monotonic trip revisions and optimistic concurrency control, returning HTTP 409 Conflict if a modification is submitted against a stale revision.

**Blocked by:** 04: Deterministic Itinerary Planner & Relative Duration Solver

**Status:** ready-for-agent

- [ ] `POST /api/trips/{trip_id}/replan-preview` accepts candidate operations (`skip_stop`, `add_stop`, `remove_stop`, `reorder_stops`, `pin_stop`) bound to a `base_revision`.
- [ ] Replan engine evaluates feasibility: verifies venue opening hours, recalculates transit times, and checks remaining budget.
- [ ] Returns structured `ReplanProposal` containing candidate stop sequence and before/after diff (cost delta, duration delta, closing-hour warnings).
- [ ] `POST /api/trips/{trip_id}/replan-accept` validates that `expected_revision == trip.revision`.
- [ ] On revision match: executes atomic database transaction that increments `trip.revision`, stores snapshot in `itinerary_versions`, updates `trip_stops`, records entry in `trip_events`, and marks proposal `accepted`.
- [ ] On revision mismatch: rejects commit with `HTTP 409 Conflict` and payload returning current revision number.
- [ ] `GET /api/trips/{trip_id}/events` returns append-only audit trail of recent accepted events.
