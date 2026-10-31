# 08: Upcoming Stop Manual Editor (View / Edit Mode)

**What to build:**
An interactive direct-manipulation editor inside the active in-trip experience. When tourists experience changing plans on the ground, they can toggle into "Edit Mode" to reorder upcoming stops, skip a stop (preserving historical record), remove a future stop, or pin a must-visit venue. Past visited stops are frozen and immutable. All manual edits invoke the backend replan preview, show a before/after diff summary, and atomically commit as a new trip revision.

**Blocked by:** 05: Unified Mutation Engine & Revision-Locked Replan API, 07: Active Trip Operational View & Manual Check-in Fallback

**Status:** ready-for-agent

- [ ] Clear toggle between "Operational View" and "Edit Mode" in the active trip screen.
- [ ] Visual lock on historical stops: stops marked `visited` or previously `skipped` are read-only and cannot be dragged, skipped, or removed.
- [ ] Upcoming `pending` stops can be reordered via drag-and-drop handles or up/down controls.
- [ ] "Skip" action marks an upcoming stop planned-but-not-visited, keeping it in the audit trail without removing it from the historical record.
- [ ] "Remove" action deletes an upcoming stop from the remaining itinerary.
- [ ] "Pin" toggle sets `is_pinned = true` on a stop, protecting it from being dropped during automated optimization.
- [ ] "Preview Changes" dispatches operations to `POST /api/trips/{trip_id}/replan-preview` and presents a confirmation modal showing duration/cost diffs.
- [ ] "Confirm & Apply" calls `POST /api/trips/{trip_id}/replan-accept` with the current revision, updating the active trip to Revision N+1.
- [ ] Gracefully handles `HTTP 409 Conflict` by prompting the user to refresh and review updates made from another session.
