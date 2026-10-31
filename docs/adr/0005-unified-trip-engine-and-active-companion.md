# ADR 0005: Unified Trip Engine, Active In-Trip Companion & Revision-Safe AI Tools

## Status
Accepted

## Context
Following community-first discovery and multi-day modeling, the user specified that the in-trip execution experience must be actively usable and editable during travel. The system must support two symmetrical ways to modify an ongoing trip:
1. **Manual Direct Editing**: Dragging, reordering, skipping, adding, and pinning upcoming stops.
2. **AI-Assisted Natural Language Modification**: Asking the Gemini travel companion to alter the journey (e.g. *"I'm tired, skip the haveli and add a pottery workshop nearby under ₹300"*).

To prevent state desynchronization and LLM hallucinations, a single authoritative source of truth and a unified mutation pathway must be established.

## Decisions

### 1. PostgreSQL/Supabase as the Single Authoritative Source of Truth
- Neither React state nor LLM conversation memory is canonical.
- PostgreSQL (`trips`) stores the authoritative accepted trip with a monotonic integer `revision` and active `current_itinerary_version_id`.
- Immutable snapshots are preserved in `itinerary_versions`.
- Accepted modifications are recorded in an append-only `trip_events` audit table.

### 2. Unified Mutation Pathway via FastAPI Trip Engine
Both the Manual Editor and Gemini Assistant route through the exact same backend engine:
```text
                  +---------------------------+
                  |          TOURIST          |
                  +-------------+-------------+
                                |
                   +------------+------------+
                   |                         |
              Manual UI               Gemini Assistant
           (Direct actions)          (Tool / Function calls)
                   |                         |
                   +------------+------------+
                                |
                    FastAPI Shared Trip Engine
                                |
                       Replan Proposal
                                |
                   Routing + Constraint Checks
                                |
                         Preview for User
                                |
                         Accept / Reject
                                |
               PostgreSQL Atomic Commit (Revision + 1)
                                |
            Timeline, Map, & AI Read New State
```
- Changes that affect routes or schedules follow: **Draft/Request $\rightarrow$ Compute Proposal $\rightarrow$ Validate Constraints $\rightarrow$ Preview to User $\rightarrow$ User Accepts $\rightarrow$ Commit**.
- No change is committed directly by model output without explicit user acceptance.

### 3. Concurrency & Revision Locking (HTTP 409 Conflict)
- Every proposal tracks `base_revision`.
- On acceptance (`/api/trips/{id}/replan-accept`), the backend verifies `current_revision == expected_revision`.
- If a manual change occurs while the AI or user was reviewing a proposal, the backend returns **HTTP 409 Conflict**, preventing stale overwrites and prompting a re-preview.

### 4. Native Gemini Function Calling
- For the hackathon MVP, Gemini Flash interacts with the backend using **native function calling** (tool calling):
  - `get_current_trip(trip_id)`
  - `get_recent_trip_events(trip_id)`
  - `search_places(query, category, max_detour_minutes)`
  - `get_place_details(place_id)`
  - `propose_trip_changes(trip_id, base_revision, operations)`
  - `get_proposal(proposal_id)`
- Model-to-backend authorization is verified via the session JWT; the model cannot access unauthorized trips or execute arbitrary database queries.

### 5. Active Trip Companion Lifecycle
- States: `planned` $\rightarrow$ `in_progress` $\rightarrow$ `completed`.
- **View Mode**: Displays current/next stop, timeline, map, progress counters, quick action buttons (`Visited`, `Skip`, `Running Late`, `Find Nearby`).
- **Edit Mode**: Allows direct manipulation of upcoming stops (move up/down, add, remove, pin). Historical visited stops are frozen.
- **Trip-to-Trail Bridge**: When the trip is finished, self-reported actual visited stops feed directly into the Trip-to-Trail community publishing pipeline.

## Consequences
- Guaranteed mathematical consistency: AI and manual edits produce identical, feasible routes.
- Rock-solid demo reliability: Eliminates race conditions and LLM hallucination of distances or opening hours.
- Clear separation between temporary local drafts and committed server revisions.
