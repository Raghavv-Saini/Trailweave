# 08: Upcoming Stop Manual Editor (View / Edit Mode)

**What to build:**
An interactive direct-manipulation editor inside the active in-trip experience. When tourists experience changing plans on the ground, they can toggle into "Edit Mode" to reorder upcoming stops, skip a stop (preserving historical record), remove a future stop, or pin a must-visit venue. Past visited stops are frozen and immutable. All manual edits invoke the backend replan preview, show a before/after diff summary, and atomically commit as a new trip revision.

**Blocked by:** 05: Unified Mutation Engine & Revision-Locked Replan API, 07: Active Trip Operational View & Manual Check-in Fallback

**Status:** resolved

- [x] Clear toggle between "Operational View" and "Edit Mode" in the active trip screen.
- [x] Visual lock on historical stops: stops marked `visited` or previously `skipped` are read-only and cannot be dragged, skipped, or removed.
- [x] Upcoming `pending` stops can be reordered via drag-and-drop handles or up/down controls.
- [x] "Skip" action marks an upcoming stop planned-but-not-visited, keeping it in the audit trail without removing it from the historical record.
- [x] "Remove" action deletes an upcoming stop from the remaining itinerary.
- [x] "Pin" toggle sets `is_pinned = true` on a stop, protecting it from being dropped during automated optimization.
- [x] "Preview Changes" dispatches operations to `POST /api/trips/{trip_id}/replan-preview` and presents a confirmation modal showing duration/cost diffs.
- [x] "Confirm & Apply" calls `POST /api/trips/{trip_id}/replan-accept` with the current revision, updating the active trip to Revision N+1.
- [x] Gracefully handles `HTTP 409 Conflict` by prompting the user to refresh and review updates made from another session.

## Comments

### Implementation Summary
1. **Operational View vs. Edit Mode Toggle (`frontend/app/trip/page.tsx`)**:
   - Added a segmented view toggle `[ 🧭 Operational View | ✏️ Edit Mode ]` at the top of the in-trip active companion.
   - Seamlessly switches between the live timeline/geofence monitor and the direct-manipulation `UpcomingStopEditor`.
   - Also updated `frontend/app/trip/edit/page.tsx` for direct URL access.

2. **Visual Lock & Direct Stop Manipulation (`frontend/components/trip/UpcomingStopEditor.tsx`)**:
   - **Historical Immutability**: Historical stops (`visited` or previously `skipped`) are rendered with distinct locked UI (`🔒 Visited` / `🔒 Skipped`), dimmed backgrounds, and disabled controls preventing reordering, skipping, or deletion.
   - **Upcoming Reordering**: Interactive up/down controls allow repositioning upcoming `pending` stops while preserving day constraints.
   - **Pin Toggle**: `📌 Pinned` status switch marks high-priority stops (`is_pinned = true`) to safeguard them against automated replanning drops.
   - **Skip & Remove Actions**: Supports marking stops as planned-but-skipped (`⏭️ Skipped`) or removing them completely (`🗑️`).
   - **Dirty State Tracking**: Highlights staged modifications with a visual count badge and an instant "Discard" reset option.
   - **Conflict Testing Simulation**: Includes an interactive trigger for simulating concurrent remote revision increments.

3. **Replan Preview Confirmation Modal (`frontend/components/trip/ReplanPreviewModal.tsx`)**:
   - Dispatches staged operations to `POST /api/trips/{trip_id}/replan-preview`.
   - Displays clear revision transition target (`Revision N → Revision N+1`).
   - Summarizes duration and cost deltas along with itemized operation badges (reordered, pinned, skipped, removed, added).
   - Flags closing hour conflicts and constraint warnings.
   - Provides a "Confirm & Apply Revision" button that commits through `POST /api/trips/{trip_id}/replan-accept`.
   - In case of `HTTP 409 Conflict` (due to concurrent edits), displays a clear conflict warning modal explaining the version mismatch, with a "Refresh & Load Latest Plan" action.

4. **Trip Context Replan Integration (`frontend/context/TripContext.tsx`)**:
   - Added `requestReplanPreview(operations)` calling `/api/trips/{trip_id}/replan-preview`.
   - Added `commitReplan(proposalId, expectedRevision)` calling `/api/trips/{trip_id}/replan-accept`.
   - Implemented optimistic and server-verified revision checks, updating local state revision and re-syncing stops upon successful acceptance.

5. **Backend Replan Hardening (`backend/app/api/v1/replan.py` & `backend/app/schemas/replan.py`)**:
   - Extended `ReplanOperation` with `is_pinned: Optional[bool]`.
   - Extended `ValidationDiff` with `stops_removed: List[str]`.
   - In `POST /replan-preview`, computes realistic duration and cost deltas against current `trip_stops` and persists the provisional proposal into `replan_proposals` table.
   - In `POST /replan-accept`, enforces strict revision validation (`expected_revision == trip.revision`, raising `HTTP 409 Conflict` on mismatch), atomically increments revision to `N + 1`, and logs a structured `replan_committed` event in `trip_events`.

### Verification
- `frontend`: TypeScript compilation (`npx tsc --noEmit`) verified with 0 errors.
- `frontend`: ESLint (`npm run lint`) passed clean with 0 errors.
- Manual inspection of operational view toggle, edit mode transitions, and modal conflict handling confirmed.
