# [ARCHIVED / HISTORICAL BRIEF]
> [!NOTE]
> **Archival Notice:** This document is an intermediate delta brief (v2 -> v3) specifying the Active In-Trip Companion, unified mutation engine, and revision locking.
> All decisions, architecture patterns, and API contracts from this brief have been incorporated into [`docs/PRD.md`](../PRD.md), [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md), and ADRs 0004 & 0005. This document is retained solely for historical provenance.

---

# FairPath — Consolidated PRD Change Summary

**Scope:** All product and architecture changes discussed **after** the earlier `FairPath_Trip_to_Trail_Feature_Spec.md` was requested and generated.  
**Product:** FairPath — community-powered travel discovery, active trip companion, and inclusive local tourism.  
**Destination / pilot:** Udaipur, Rajasthan.  
**Event:** Aravalli Build Championship, 31 October–1 November 2026.  
**Document type:** **Delta / PRD revision brief**, not a replacement for the original Detailed PRD or the separate Trip-to-Trail specification.  
**Status:** Recommended design direction. MVP prioritization, illustrative weights, API shapes, and architecture details must be confirmed during implementation.

> **Instructions for the PRD-editing agent:** Read the original FairPath Detailed PRD, the Trip-to-Trail Feature Specification, and this document. Integrate these changes into a single coherent revised PRD. Do **not** simply append this summary. Preserve the creator/artisan ecosystem, Fair-Path recommendation principles, privacy boundaries, and original requirements that are not explicitly superseded here.

---

## 1. Executive summary of what changed

The product is no longer just a professional-creator-led travel itinerary planner with an optional share feature. Its end-to-end experience is now **community-led discovery + personalized planning + an actively editable in-trip companion + post-trip contribution**.

The proposed primary journey is:

**Open FairPath → Discover community trails → Filter and mix complete trails or individual stops → Generate a feasible itinerary → Start an Active Trip → Navigate and modify the remaining journey manually or by asking AI → Finish Trip → Review actual experiences → Publish a new community trail → Inspire the next traveler.**

The most significant architectural decision is a **single source of truth** for the ongoing trip:

- Tourists can manually add, skip, remove, reorder, replace, pin, or reschedule eligible stops.
- The same tourist can ask a Gemini-powered assistant in natural language to propose equivalent or more complex modifications.
- **Both interfaces call the same authorized FastAPI Trip Modification / Planning Engine.**
- **PostgreSQL holds the authoritative accepted trip and its revision history.** Neither React state nor LLM conversation history is the canonical itinerary.
- The AI always works from the latest accepted trip state and relevant change events. It can acknowledge manual changes and propose further alterations without referring back to an obsolete initial plan.
- Changes that affect routing or the feasible itinerary are **drafted → validated → previewed → accepted → atomically committed**, not applied by arbitrary AI output.
- Gemini receives access through **backend tool/function calling** for the MVP; MCP is an optional future adapter, not a requirement.

### What stays unchanged

- Udaipur-first, responsive web MVP.
- Fair-Path Engine's mission: relevant discovery for smaller local businesses and artisans, not pay-to-rank placement.
- Artisan onboarding and data updates through WhatsApp voice/text, with speech recognition, structured extraction, and approval before publishing.
- Maps/directions and deterministic constraints for accurate routing, scheduling, opening hours, and budgets.
- The separate **Trip-to-Trail** workflow: private actual trip → reviewed draft → explicitly published community trail, with privacy safeguards and provenance.
- Professional travel creators may still participate, but do not dominate content acquisition or the main user flow.

---

## 2. New homepage and first-run experience

**Change:** Replace a blank chatbot / influencer-first flow with a community-first travel discovery interface. The primary user should see valuable structured travel content immediately.

### Recommended homepage

For the Udaipur MVP:

- FairPath branding, destination header, simple search / location selector.
- Featured community trails and visual category chips: Heritage, Food, Art & Crafts, Nature, Hidden Gems, Budget.
- Two prominent entry paths:
  - **Explore Community Trails** (**primary**): learn from real travelers' and locals' curated journeys.
  - **Plan From Scratch** (**secondary**): enter preferences without selecting an existing trail.
- Access to saved trails, planned trips, and the persistent **My Trip** section.
- AI chat is a contextual capability, **not** the primary first screen.

Both entry paths eventually enter the **same Trip Builder**; there must not be two incompatible itinerary engines.

### Collect only essential preferences

- Trip date / applicable time window.
- Available duration or end time.
- Maximum budget in INR.
- Starting point (chosen landmark or permission-based location).
- Interests and optionally travel mode (walking/driving).

Keep these controls editable during discovery and planning. Do not make users repeat them at each step.

---

## 3. Community Trail Explorer and filtering

**Change:** Make community trail discovery a principal feature, not an ancillary directory of professional creators.

### Trail cards

Each card should display, where available:

- Title, curator display name, description, city, stop count.
- Indicative or self-reported budget and trip duration (labeled correctly).
- Categories/tags and optional cover photo.
- Trail status: planned or self-reported experienced (not automatically independently verified).
- Date updated and relevant community usefulness signals.
- Clear action(s) to use the entire trail or take only selected places.

### Filters

**Personal fit:** interests, budget, duration, starting area, travel mode, intended visit date.  
**Discovery context:** trail category, artisan/craft inclusion, geographical proximity, walkability/travel style, recency, planned vs experienced, curator type (ordinary traveler, local resident, professional creator).

**Important distinction:** discovery fit and itinerary feasibility are different.

- **Full trail fits (preliminary):** Original trail estimates are within the chosen time and budget.
- **Partial match:** Original full trail may exceed limits, but individual stops could still fit.
- **Needs validation:** User-selected combination has not yet been routed/scheduled for their actual date and starting point.

Do not hide every expensive or lengthy trail; allow partial stop selection. A traveler with ₹800 should still be able to select a ₹200 experience from a ₹2,000 community trail.

### Community ranking, initial hypothesis only

A possible ranking mix discussed:

| Signal | Provisional weight |
|---|---:|
| Interest relevance | 30% |
| Time/budget compatibility | 25% |
| Geographic relevance | 20% |
| Freshness and completeness | 15% |
| Community usefulness | 10% |

These are **unvalidated starting weights**, not achieved performance or a final fairness policy. Rank on relevance/trust before popularity; don't let commissions or follower counts dominate. Give new curators a chance to be discovered.

---

## 4. Mixing multiple community trails and selecting stops

**Change:** Users must be able to create a trip by combining selected experiences from more than one community trail. They are not restricted to one itinerary or one curator.

### Three actions on each trail

1. **Use as Base:** Start a personal trip from one trail; personalize it later.
2. **Add All Stops:** Add all of a trail's candidate stops to an existing selection.
3. **Pick Stops:** Expand the trail and select individual experiences.

### Trip basket / selection requirements

- Maintain selected stops persistently while the user moves between trail cards, details, and Trip Builder.
- Allow add, remove, and replace before generation.
- Normalize to **canonical place IDs**; deduplicate identical places across trails.
- Preserve one-to-many provenance when multiple curators recommended the same place.
- Show indicative stop-level prices and visit durations without implying transport or opening-hour feasibility is already confirmed.
- Once selected, pass a **candidate stop set** to the deterministic planner to validate and order; do not directly combine displayed trail schedules.

### Trip Builder UI

**Desktop:** timeline/stop list beside interactive route map.  
**Mobile:** timeline-first layout with switchable map.

The builder should allow users to update preferences, review recommendation sources, remove/change stops, request optimization, and decide whether to add Fair-Path artisan suggestions. Its result is a **planned trip** ready to be started.

---

## 5. New central feature: Persistent “My Trip” / Active Trip Companion

**Change:** A trip must remain usable **during** travel, not just at initial generation and final publishing.

### Navigation and trip structure

- Include a persistent **My Trip** destination in the app's main navigation.
- **My Trips** lists planned/saved, in-progress, paused (optional), and completed trips.
- When a trip is started, an **Active Trip** page becomes its operational home.
- **MVP simplification:** One in-progress trip per user; users may still save multiple future plans. Enforce on the backend if adopted.

### Suggested trip lifecycle

`planned → in_progress → completed`  
Optional state: `paused` with resume/restart policy. Publishing a community trail is **a separate, explicit operation** after completion.

### What the Active Trip page should show

- Trip status and progress: number visited, skipped, remaining.
- Current/next destination prominently above the fold.
- Planned arrival/departure, estimated visit duration, price, source attribution, and any booking status (where known).
- Scrollable trip timeline and corresponding map/route.
- Clear quick actions: **Visited**, **Skip**, **Running Late**, **Add Break**, **Find Nearby**, **Edit Trip**.
- Persistent access to contextual **Ask FairPath AI**.
- One-tap external navigation/directions link where suitable.
- Current budget and time remaining based on actual/reported progress plus trusted estimates; label uncertainty.
- Entry point to **Finish Trip**, which leads to the existing Trip-to-Trail flow.

**Do not silently mark a place visited simply because the user was near it or the scheduled arrival time passed.** Actual visits are self-reported unless a separate verified check-in system is implemented.

### View mode vs Edit mode

- **View Mode:** next stop, progress, map, quick actions, accepted schedule.
- **Edit Mode:** interactive editing of **remaining upcoming stops**, plus draft preview and save/discard.
- Already visited stops are historical and non-draggable. Skipped stops remain recorded in history.

---

## 6. Manual customization of an ongoing itinerary

**Change:** Provide a real, predictable editor in addition to AI chat; users should never be forced to phrase simple changes as prompts.

| Manual action | UI affordance | Meaning / backend handling |
|---|---|---|
| Reorder remaining stops | Drag handle or accessible Up/Down | Respect explicit order, recompute timing/route |
| Skip a stop | Skip action | Record *planned but not visited*, remove from remaining execution |
| Remove a future stop | Remove from draft | Change the future plan; retain prior version for audit |
| Add a stop | Search community places / artisan suggestions | Check canonical place, travel time, costs, hours |
| Replace stop | Search suggested alternatives | Validate proposed substitution |
| Pin / keep stop | Pin control | Optimizer must attempt to retain; not proof that visit is feasible |
| Fix appointment time | Time/booking constraint | Treat as a hard time window if confirmed |
| Adjust visit duration | Duration selector | Recompute downstream schedule |
| Adjust remaining trip time/budget | Preference controls | Revalidate before acceptance |

### UX and state rules

- Only **upcoming** stops can be freely reordered or removed.
- **Pinned** means “do not auto-drop this”; **fixed-time / confirmed booking** is a separate stronger constraint.
- A stop may be moved manually even if it creates an infeasible schedule; the app must **explain the conflict** and ask for correction before accepting the plan.
- Manual order is user intent: **do not silently re-optimize/reorder** when the user merely dragged a stop. Offer explicit **Optimize My Trip** for algorithmic reordering.
- **Skip** and **Remove** have different semantics: skip records an attempted/planned-but-not-visited stop; remove edits the future plan (history remains in prior versions).
- Skipping a confirmed or prepaid experience in the app **does not cancel an external booking or guarantee a refund**. Flag the separate reservation action.
- When editing, work in a local **draft**. The accepted itinerary stays intact until backend validation and user approval.

### Suggested React implementation

- `ActiveTripPage` loads current trip state.
- `TripTimeline` renders stop cards; `EditableStopList` supports reorder operations (e.g., dnd-kit or accessible arrow controls).
- `PlaceSearchDrawer` searches curated places/community stops/artisans.
- `ReplanPreview` displays before/after, feasibility warnings, costs/times, and proposed actions.
- `TripMap` reads the same accepted trip query.
- `FairPathAssistant` uses trip-aware chat and displays accepted activity notifications.
- React local draft state is temporary; it must not be treated as the server source of truth.

---

## 7. User-initiated replanning during travel

**Change:** Plan changes must be a first-class workflow, not “regenerate the whole itinerary and hope.”

### Typical triggers

- Tourist skips or removes the next attraction.
- A visit takes longer than expected, and the tourist selects **Running Late**.
- Tourist wants a break or an earlier end.
- Tourist finds a nearby community-recommended place.
- Tourist wants an artisan workshop added/replaced.
- A known closure or declined experience request means an existing stop is unavailable.
- Tourist's remaining spending/time changes.

### Replan logic

1. Load the **latest accepted trip revision**.
2. Freeze already visited stops and actual history.
3. Determine effective starting point for the remaining trip (permission-based current location, manually selected current position, or sufficiently reliable fallback).
4. Apply requested operations to a **temporary candidate plan**.
5. Keep locked/fixed commitments unless user explicitly authorizes changes; never silently alter confirmed bookings.
6. Obtain travel-time/distance data from the map/routing provider.
7. Validate visit times, remaining budget, opening hours, duration, booking/availability, and user-requested order.
8. If feasible, return a **proposal** with before/after comparison. If infeasible, return precise conflicts and alternative actions.
9. On user acceptance, commit new itinerary version plus event log atomically.
10. Refresh timeline, map, progress, and AI context.

Simple remaining-route feasibility can be handled by a deterministic sequential scheduler/heuristic. Larger auto-optimization is optional using beam search or OR-Tools. LLM prose alone must never be trusted for distances or hard constraints.

---

## 8. One source of truth shared by manual editing and the AI

**This is the most important architecture decision from the later discussion.**

### Authoritative ownership

- **PostgreSQL/Supabase** stores the authoritative accepted trip, revision, current itinerary version, statuses, and event history.
- **FastAPI Trip Engine** owns authorization, allowed transitions, change validation, and committed modifications.
- **Next.js/React** shows the trip and holds unsaved UI drafts only.
- **Gemini** interprets requests and calls backend tools; it does **not** own or directly mutate the canonical state.

### Unified mutation pathway

```text
                       TOURIST
                         |
                 +-------+--------+
                 |                |
            Manual Editor     Gemini Chat
                 |                |
          Structured edits    Tool/function calls
                 |                |
                 +-------+--------+
                         |
                FastAPI Trip Engine
                         |
                  Replan Proposal
                         |
              Routing + Constraint Checks
                         |
                 Preview for User
                         |
                 Accept / Reject
                         |
          PostgreSQL transaction + revision
                         |
        Timeline / Map / AI read same new state
```

Do not create separate manual and AI versions of the optimizer, or independent chat-maintained itineraries.

### Read model / current state

The backend must be able to return:

- `trip_id`, authenticated owner, status, `revision`, active `itinerary_version`.
- Budget: initial, reported spent, remaining estimates.
- Current accepted stop sequence and statuses (`visited`, `skipped`, `upcoming`, etc.).
- Constraints: requested end time, travel mode, pinned stops, fixed appointments.
- Known artisan experience requests/confirmed reservations.
- Relevant prior creator/community trail attribution.
- Recent accepted events / summary of what changed.

Use stable IDs rather than relying on place names for operations.

---

## 9. Let users request the **same modifications** through AI

**Change:** AI is not just an explanatory chatbot. It is an alternate, natural-language interface to the **same authorized Trip Engine** used by manual actions.

### Example requests

- “I have two hours left; keep the painting workshop and cut down walking.”
- “Skip Bagore Ki Haveli and add a pottery experience nearby.”
- “I've spent ₹400 more than planned. Make the remaining trip cheaper.”
- “Replace this museum with a local market.”
- “Move lunch earlier, but don't change my confirmed artisan appointment.”

### Responsibilities

| Concern | Responsible component |
|---|---|
| Interpret vague intention / preferences | Gemini |
| Identify possible structured edits | Gemini with tool schemas |
| Fetch latest trip and changes | FastAPI + PostgreSQL |
| Search candidate places / artisan records | Backend search + Fair-Path ranking |
| Calculate travel times | Routing API |
| Respect hard feasibility constraints | Deterministic Trip Engine |
| Produce alteration proposal | Shared backend |
| Explain changes | Backend structured diff; optionally Gemini |
| Commit only user-approved proposal | Backend transaction |

### AI state freshness and acknowledgment

For **each new AI request**:

1. Authenticate the user and resolve which trip they may access.
2. Fetch the **latest accepted trip revision** (never assume earlier conversation messages are current).
3. Fetch a concise set of relevant accepted trip events since the previous AI context, when useful.
4. Supply this structured context to Gemini along with the user's request.
5. Let Gemini call read/search/proposal tools and respond using tool results.
6. If the plan changed manually, AI may naturally acknowledge the relevant edits: “I see you skipped the painting workshop and moved lunch after Bagore Ki Haveli.”
7. **Do not falsely claim a proposal was saved or a booking canceled**. State success only after server confirmation.

The UI can show a **deterministic activity notice** immediately after a successful manual commit (e.g., `Trip updated · revision 6`). This notice needs no LLM inference.

If a manual edit occurs while the AI is formulating a proposal, the proposal must be version-checked before acceptance and recomputed if stale.

### Tool access model

Expose backend operations to Gemini through **native function calling** for MVP. Recommended tool surface:

| Tool | Safety / purpose |
|---|---|
| `get_current_trip` | Read current authorized trip, revision and constraints |
| `get_recent_trip_events` | Read relevant accepted manual/AI updates |
| `search_places` | Search nearby places and public artisan listings |
| `get_place_details` | Fetch trusted place price, hours, available data |
| `propose_trip_changes` | Create candidate edits, schedule, validate, store proposal |
| `get_proposal` | Read computed proposal and conflicts |

**Do not expose unrestricted SQL, generic database update functions, or an AI-callable commit function that bypasses explicit application approval.** Authorization must use the authenticated backend session, not a `user_id` supplied by model output. Validate tool arguments and place IDs server-side.

### Native function calling versus MCP

- **Native Gemini tool/function calling:** chosen for the hackathon MVP; fewer moving parts for one FairPath application.
- **MCP server:** optional future interoperable adapter exposing the same FastAPI service capabilities to other supported AI clients. It is **not** necessary to synchronize the app or implement a tool-using assistant.
- Tool schemas are interfaces; the trusted backend remains responsible for actual execution.

---

## 10. Proposed backend data model changes

Extend the original schema and the already-defined Trip-to-Trail community schema. The list below is focused on **active execution and synchronization**.

| Table / entity | Key role |
|---|---|
| `trips` | Owner, trip status, current revision, current accepted itinerary version, starting constraints |
| `trip_stops` | Accepted/actual stop status, canonical place ID, actual cost/duration, lock flags |
| `itinerary_versions` | Immutable accepted route/stop/schedule snapshots; provenance for rollback/audit |
| `trip_events` | Append-only accepted actions (`stop_visited`, `stop_skipped`, `stop_removed`, `stops_reordered`, `budget_changed`, `itinerary_replanned`, etc.) |
| `replan_proposals` | Pending/provisional candidate itinerary, base revision, validation result, expiry, user approval state |
| `trip_chat_messages` | Optional persistent AI conversation, linked to trip; *not* canonical itinerary |
| `experience_requests` | Optional artisan booking/request state, separate from itinerary presence |
| Existing `places`, `community_trails`, `trail_versions`, `trail_stops` | Canonical listing, publishing, and attribution layers preserved |

Recommended metadata:

- On a trip: `revision` (monotonic), `current_itinerary_version_id`, `status`, `updated_at`.
- On a proposal: `base_revision`, `actor/source`, operations, calculated route/schedule, feasibility, warnings/conflicts, expiry, approval state.
- On an event: `trip_id`, resulting revision, actor (`user` / `ai_assistant`), source (`manual_editor` / `ai_tool`), operation type, payload, creation timestamp, user approver where applicable.

**Event sourcing is not required**: an authoritative current snapshot plus immutable versions and an event audit log is sufficient for the MVP.

### Distinguish event semantics

- A direct **Visited** action records self-reported progress; it is not the same as accepting a new route.
- A **Skip** records that the tourist intentionally did not visit a planned stop.
- A **Remove** operation changes the future plan but leaves prior accepted versions available.
- A **Pin** constrains automated stop dropping, whereas a **confirmed booking** may constrain arrival time and require explicit cancellation/rescheduling.
- Current itinerary version and overall trip revision may differ: recording a visit can increment `revision` without requiring a new route snapshot, depending on implementation.

---

## 11. Recommended API and contract shape

Exact paths/names are proposals, not implementation facts.

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/trips/{trip_id}` | Load latest authorized active trip + revision |
| `GET` | `/api/trips/{trip_id}/events` | Load accepted change history |
| `POST` | `/api/trips/{trip_id}/stops/{stop_id}/visit` | Mark visited / record actual progress with authorization |
| `GET` | `/api/trips/{trip_id}/places/search` | Search canonical places, community stops, artisans |
| `POST` | `/api/trips/{trip_id}/replan-preview` | Preview manual or AI-requested operations |
| `POST` | `/api/trips/{trip_id}/replan-accept` | Accept validated proposal with revision check |
| `POST` | `/api/trips/{trip_id}/assistant/messages` | AI request with fresh trip context and tools |

### Example operations request

```json
{
  "base_revision": 7,
  "operations": [
    {"type": "skip_stop", "stop_id": "stop_04"},
    {"type": "add_stop", "place_id": "pottery_012"},
    {"type": "pin_stop", "stop_id": "stop_05", "pinned": true}
  ]
}
```

Operations should be fully typed and validated (e.g., `reorder`, `remove_stop`, `replace_stop`, `set_visit_duration`, `change_end_time`, `set_fixed_time`). The service computes a **proposal**, not an immediate commit.

### Example proposal acceptance

```json
{
  "proposal_id": "proposal_123",
  "expected_revision": 7
}
```

The backend must:

1. Verify trip ownership and proposal ownership.
2. Reject invalid, expired, or already-used proposals.
3. Verify the accepted trip still has `revision = expected_revision`.
4. Revalidate time-sensitive constraints where necessary.
5. Update accepted trip / itinerary version and append events **in one transaction**.
6. Return the new authoritative revision.

If revision mismatch occurs, return **HTTP 409 Conflict** and ask the frontend/assistant to reload and preview again. Never silently overwrite a later manual or AI modification.

---

## 12. Frontend synchronization strategy

Suggested component structure:

```text
ActiveTripPage
└── Shared trip query / TripProvider
    ├── ActiveTripHeader + Progress
    ├── TripTimeline
    │   ├── StopCards / Quick Actions
    │   └── EditableStopList (local draft)
    ├── TripMap
    ├── ReplanPreview
    └── FairPathAssistant
        ├── Messages
        └── AcceptedTripActivity
```

### P0 synchronization

- Fetch current trip state from FastAPI on page load.
- After an approved manual or AI change, refetch the authoritative state.
- Timeline, map, progress, and assistant context derive from that same result.
- If the active trip has changed while the user holds an edit draft, show a revision warning and offer refresh/reconcile; don't auto-overwrite an unreviewed draft.
- On API/network failure, **preserve the last accepted itinerary** and display error feedback.

### P1 synchronization

- Supabase Realtime/Broadcast notifications may signal that a revision changed (especially across tabs/devices).
- A notification triggers authenticated refetch; it does not become the canonical trip state.
- Cross-device edit conflicts still use server-side revision checks.

---

## 13. AI versus deterministic computation — final division of responsibilities

**No Gemini call for simple manual actions.** The deterministic Trip Engine handles ordinary editing, schedules and route checks.

| Scenario | Correct owner |
|---|---|
| Drag Restaurant before Museum | React draft + backend route validator |
| Skip next stop | Trip status/change service + recompute remaining plan |
| Add a chosen artisan stop | Place service + routing/scheduling constraints |
| Recalculate arrival/departure | Mapping provider + deterministic scheduler |
| Automatically optimize remaining flexible stops | Heuristic / optional OR-Tools |
| Find relevant alternative places | Database/Fair-Path scoring; optional Gemini interpretation |
| “I feel tired, keep my workshop, minimize walking” | Gemini extracts constraints; same Trip Engine validates/proposes |
| Describe a proposed alternative in natural language | Structured result, optionally Gemini |
| Save change after user accepts | Authorized backend transaction, never Gemini alone |

**Two user-facing modes** should remain visibly distinct:

- **Edit Manually:** user controls specific stop decisions/order; backend respects them and checks feasibility.
- **Optimize with FairPath:** system can propose reordering/removing optional stops or inserting relevant suggestions, while respecting user-locked and booked constraints.

**Ask FairPath AI** is an additional conversational interface to propose edits using the same service contract.

---

## 14. Connection to the existing Trip-to-Trail specification

Keep the earlier document's privacy and publication flow unchanged, but ensure it now consumes the **Active Trip's actual progress/events**, not just the initially generated plan.

At trip completion:

- User explicitly selects **Finish Trip**.
- Review visited, skipped, unsure, and added-in-trip stops.
- Preserve reported durations/spending, community attribution, and manual/AI changes in private trip history.
- Default public draft contains **self-reported visited** stops only; exclude private personal location/timestamps/notes unless deliberately approved.
- The user can edit/preview, set private/unlisted/public visibility, and explicitly publish.
- A published trail is a separate versioned **community object**; never expose full trip history to readers.
- Any future traveler reusing a published trail gets a new feasibility check and a new personal trip.
- If a user followed community trail A, then changed it during travel, the new trail should preserve permitted attribution to A without modifying A.

This is what makes the Active Trip feature central to the community flywheel: it captures useful self-reported differences between the *initial plan* and what the traveler *actually chose to do*.

---

## 15. New or expanded PRD functional requirements

| ID | Requirement | Suggested priority |
|---|---|---|
| DISC-01 | Show a community-first homepage and two entry paths | P0 |
| DISC-02 | Filter and rank community trails on user fit and provenance | P0 |
| DISC-03 | Use whole trail, add all stops, or pick individual stops | P0 |
| DISC-04 | Combine/deduplicate selections across trails; preserve attribution | P0 |
| DISC-05 | Route and feasibility-check a new personalized plan | P0 |
| AT-01 | Persistent **My Trip** page and active-trip status | P0 |
| AT-02 | Show progress, next stop, timeline, and map | P0 |
| AT-03 | Mark stops visited/skipped with accurate event semantics | P0 |
| AT-04 | Editable upcoming stop list: reorder/remove/add/pin | P0 |
| AT-05 | Support preview → validate → accept workflow | P0 |
| AT-06 | Preserve completed history and protected bookings during replanning | P0 |
| AT-07 | Record accepted itinerary revisions and trip events | P0 |
| ATS-01 | PostgreSQL is single authoritative source of accepted trip | P0 |
| ATS-02 | Manual editor and Gemini tools use same Trip Engine | P0 |
| ATS-03 | Gemini loads latest accepted trip revision and relevant events per request | P0 |
| ATS-04 | Gemini can acknowledge accepted manual edits and propose further changes | P0 |
| ATS-05 | Prevent stale proposals from overwriting newer revisions | P0 |
| ATS-06 | Update timeline/map/AI context after successful commits | P0 |
| ATS-07 | AI tool operations are authorized, validated, and approval-gated | P0 |
| AT-08 | Running-late and break workflows | P1 if time-constrained |
| AT-09 | Search nearby places / direct replace workflow | P1; basic add place P0 |
| ATS-08 | Realtime cross-device refresh and edit reconciliation | P1 |
| AT-10 | Fixed appointment editing / richer booking integration | P1 |
| AT-11 | Offline edits and background sync | P2 |
| ATS-09 | Optional MCP adapter for external AI clients | P2 |

**Prioritization warning:** The discussion proposed several P0 capabilities, but the two-day hackathon may not accommodate every one at production depth. Deliver one strong end-to-end scenario before polishing drag animation, complex ranking, realtime, or MCP.

---

## 16. End-to-end demonstration scenario

A single connected scenario should demonstrate the entire new product:

1. **User A** completed a curated Udaipur journey and publishes a privacy-reviewed community trail (the pre-existing Trip-to-Trail flow).
2. **User B** opens FairPath and sees community trails, not an empty chatbot.
3. User B sets interests, time, budget and start location, and **picks stops from User A plus another trail**.
4. FairPath deduplicates places, checks routing/feasibility, and creates a new planned trip with correct curator attribution.
5. User B opens **My Trip** and starts the journey; the Active Trip page displays the next stop, map and progress.
6. After visiting the first place, User B marks it **Visited**.
7. User B **manually skips a stop** and **reorders two remaining stops** in Edit Mode.
8. The backend returns a validated replan preview. User B accepts it; the accepted trip revision increments and the timeline/map refresh.
9. User B asks AI: **“I skipped the workshop. Can you find another local art experience that fits my updated budget and route?”**
10. Gemini reads the **new authoritative revision**, acknowledges the manual skip, and calls backend search + `propose_trip_changes` tools.
11. The user sees the alternative, accepts it, and the same Trip Engine commits the new version.
12. User B finishes the journey, reviews self-reported visits, and generates a new **Trip-to-Trail** draft with correct attribution and privacy controls.

**For the demo:** seeded curators, costs, availability, and trip events must be clearly identified as sample data if not verified. The key is a working data/state loop, not claims of live crowd or booking intelligence.

---

## 17. Acceptance / QA scenarios to add

1. Opening a trip returns the latest accepted revision and correct ownership.
2. An existing user can browse community trails and pick individual stops from multiple curators.
3. Duplicate place IDs collapse into one stop while preserving sources.
4. Changing discovery filters doesn't discard a user's selected places.
5. A manually dragged/reordered future stop changes **draft state only** until accepted.
6. Completed stops cannot be removed from actual visit history by a replan.
7. The planner honors user-specified manual order; auto-optimization requires explicit action.
8. Removing or skipping a stop with a confirmed booking flags separate booking implications.
9. When a preview fails budget/time/opening-hours checks, it reports the reason and leaves the accepted trip unchanged.
10. Successful acceptance stores the new itinerary and audit events atomically.
11. After a manual change, a fresh AI request receives the updated revision and can acknowledge that change.
12. AI-created proposals use the same validator and explicit acceptance flow as manual modifications.
13. A stale AI/manual proposal is rejected on version mismatch, e.g., HTTP 409.
14. AI or frontend cannot directly write unvalidated trip data or access another user's trip.
15. A realtime notification, where implemented, causes refetch rather than overwriting local accepted state.
16. Network failure preserves the last accepted trip with an explanatory error.
17. A reported visited stop is labeled self-reported, not automatically independently verified.
18. Trip-to-Trail uses the accepted actual trip statuses, not the initial planned route, and omits skipped/unknown stops by default.
19. Published community trails do not leak personal GPS traces, hotel addresses or sensitive private notes.
20. New travelers who reuse a trail receive a new date/location/budget validation.

---

## 18. Metrics newly relevant to this direction

Track not merely AI-generated plans but journey execution and community reuse:

- Community trail views → selected stops → personalized trip starts.
- Percentage of created trips actually started and self-reported completed.
- Frequency and categories of manual itinerary modifications.
- Feasibility and acceptance rates for replan proposals.
- AI tool proposal success and stale-revision conflict rates.
- Time to get a validated alternative after a skip.
- Number of artisans surfaced / inquired about in active journeys.
- Trip-to-Trail draft and publication conversions.
- Community trails reused to produce trips later reported completed (**suggested north-star metric**).

All metrics are proposed instrumentation, not achieved results.

---

## 19. Section-by-section instructions for rewriting the main PRD

| Existing PRD section | Required revision |
|---|---|
| Product vision / differentiation | Shift to community discovery + active trip execution + post-trip contribution; retain artisan inclusion |
| Personas | Ordinary tourist-curator, local resident curator, professional creator, artisan; user roles can overlap |
| Core user journey | Make Discover → Mix → Plan → **Active Trip** → Adapt → Finish → Publish the end-to-end default |
| Homepage / UX | Community-first homepage, filtered explorer, separate My Trip navigation, view/edit active trip and contextual AI |
| Functional requirements | Add DISC-, AT-, ATS- requirements and acceptance criteria above |
| Community features | Select whole/partial/multiple trails, attribution, fit labels, ranking without paid dominance |
| Planning / Fair-Path | Validate user selections; dynamically replan from current position/constraints; keep verified local artisan recommendations |
| LLM/agent section | Gemini interprets preferences and calls authorized backend tools, always with fresh current trip state |
| Technical architecture | Add shared Trip Engine and proposal/accept workflow; PostgreSQL is canonical state; MCP optional |
| Data model | Add trip revisions, immutable itinerary versions, events, proposals, chat records; maintain community source links |
| API contracts | Add current trip, events, edit preview/accept, stop status, places search, trip-aware assistant |
| Security / privacy | Approval-gated edits, authenticated tool access, concurrency checks, private actual-trip history |
| QA / NFRs | Stale revisions, AI acknowledgment, real route validation, booking constraints, failure recovery |
| Delivery plan | Prioritize end-to-end reliability over full social network, advanced agents, real-time crowds, and MCP |
| Demo and metrics | Show manual modification acknowledged by AI, AI modification reflected in UI, and subsequent Trip-to-Trail contribution |

---

## 20. Explicit decisions, proposals, and unresolved questions

### Strong decisions from the discussion

- One shared authoritative trip state; manual/AI are two interfaces, not two data stores.
- Active Trip page is a core product feature.
- Users can directly edit upcoming stops and also ask AI for alterations.
- AI must be aware of accepted manual changes via current backend state and recent event history.
- Structured backend validation, not LLM text, controls feasibility.
- User approval is required before a route-altering proposal is committed.
- Professional creators are optional community participants, not the only trail producers.
- Existing Trip-to-Trail privacy/consent principles remain.

### Recommended implementation choices (not yet final)

- Next.js + TypeScript frontend; React editor with drag-and-drop or accessible Up/Down controls.
- FastAPI shared application/service layer; Google Maps Routes for travel estimates.
- Supabase PostgreSQL (PostGIS) for place, trip, event, proposal and community data.
- Gemini native function calling first; MCP only as a later adapter.
- Replan preview/accept with revision checking; direct progress events can have lighter workflows.
- One ongoing trip per user for the MVP, multiple saved plans.
- Realtime refresh is optional after basic post-commit refetch works.

### Questions to resolve while implementing

- Exact minimum stop-count and status rules for Trip-to-Trail publication (follow existing spec).
- Whether a **Skip** action immediately records the skip and then proposes a separate route replan, or remains pending until the route change is accepted. Pick one transactional policy and make its UI explicit.
- Which already-booked experience changes can be requested in-app versus merely flagged for manual contact.
- Offline/poor-network behavior beyond preserving last accepted itinerary.
- Degree of natural-language modification coverage achievable in 48 hours.
- Whether first-release drag-and-drop is worth the complexity versus robust move-up/move-down buttons.
- Whether local GPS is supported at launch or the user selects a current landmark.
- Exact route cost quota, available model identifier, and WhatsApp test-number restrictions at integration time.

Do not present these unresolved points as completed implementation decisions in the revised PRD.

---

## 21. Short handoff prompt for the next agent

> Revise our existing FairPath Detailed PRD and the previously supplied Trip-to-Trail spec using this change summary. Reorganize FairPath around **community trail discovery, filtering and mixing; the unified Trip Builder; the persistent Active Trip Companion; two-way manual/AI itinerary editing through one FastAPI Trip Engine and PostgreSQL source of truth; and post-trip Trip-to-Trail publishing**. Add functional acceptance criteria, UI flow, trip state machine, schema changes, revision-safe proposal/accept APIs, backend tool contracts for Gemini function calling, privacy/booking safeguards, testing, and realistic hackathon priorities. Retain the Udaipur pilot, Fair-Path artisan-inclusion engine, and WhatsApp voice onboarding. Do not merely add isolated features or promote optional MCP to a hard MVP dependency. Treat all user visits as self-reported unless independently verified and clearly separate illustrative demo data from live data.

**Final product promise:** *Discover real journeys → make one yours → adapt it during travel → pass it on to the next traveler.*
