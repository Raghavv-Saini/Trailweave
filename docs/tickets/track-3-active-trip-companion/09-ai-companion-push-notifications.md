# 09: AI Travel Companion & Web Push Transition Notifications

**What to build:**
An intelligent, cultured in-trip AI companion powered by Gemini Flash that delivers proactive guidance and conversational itinerary adaptations. Upon departure checkout from any stop, the system dispatches a personalized Web Push notification via Service Worker offering practical tips for the next stop. In the mobile app, tourists can chat with the companion ("I'm tired, can we skip the fort and find a rooftop tea shop nearby?"). The companion acknowledges prior manual skips/edits and uses typed backend tool calling (`search_places`, `propose_trip_changes`) to generate an interactive proposal card for 1-tap tourist acceptance.

**Blocked by:** 05: Unified Mutation Engine & Revision-Locked Replan API, 07: Active Trip Operational View & Manual Check-in Fallback

**Status:** resolved

- [x] Web Push Service Worker registers push subscription and triggers transition notifications on checkout with contextual gate, weather, and scenic tips.
- [x] In-app companion concierge card and drawer accessible on the active trip screen.
- [x] Backend endpoint `POST /api/trips/{trip_id}/assistant/messages` injects fresh PostgreSQL trip revision state and recent change events from `trip_events`.
- [x] Companion system prompt conditions Gemini Flash as a warm, knowledgeable "Cultured Local Companion" in Udaipur.
- [x] Companion explicitly acknowledges prior user manual edits (e.g. "I see you skipped the museum earlier...") before proposing alterations.
- [x] Companion interacts via strictly typed tool contracts (`get_current_trip`, `get_recent_trip_events`, `search_places`, `get_place_details`, `propose_trip_changes`).
- [x] Propose tool dispatches candidate operations to the deterministic Trip Engine and embeds an interactive `ReplanProposalCard` inside chat.
- [x] Tourist can review proposal diff in-chat and tap "Accept", triggering atomic commit to Revision N+1 and refreshing the active timeline.

## Comments

### Implementation Summary
1. **Gemini Companion Service & Strictly Typed Tools (`backend/app/services/gemini.py`)**:
   - Conditioned prompt for Gemini Flash as a warm, knowledgeable "Cultured Local Companion" in Udaipur ("Khamma Ghani", Old City pedestrian alleys, temple etiquette, afternoon heat management, scenic sunset lighting over Lake Pichola, verified artisan craft traditions).
   - Implemented strictly typed tool definitions matching `API_SPEC.md §2`: `get_current_trip`, `get_recent_trip_events`, `search_places`, `get_place_details`, and `propose_trip_changes`.
   - Tool executor connects directly to PostgreSQL database and `UnifiedMutationEngine` to evaluate candidate mutations deterministically and store provisional proposals with `requested_by = 'ai_assistant'`.
   - High-fidelity offline / fallback engine analyzing traveler intent and recent `trip_events` to acknowledge previous manual edits before staging new proposals.
   - Built contextual transition notification generator (`generate_transition_notification`) producing gate hours, weather/heat alerts, and scenic alley advice for upcoming stops.

2. **Assistant API & Web Push Endpoints (`backend/app/api/v1/assistant.py` & `trips.py`)**:
   - `POST /api/trips/{trip_id}/assistant/messages`: Injects authoritative PostgreSQL trip revision state and recent `trip_events`, returns companion response narrative with embedded proposal card.
   - `POST /api/trips/{trip_id}/push/subscribe`: Subscribes active traveler to Web Push alerts.
   - `GET /api/trips/{trip_id}/notifications/transition`: Retrieves contextual transition guidance for the upcoming stop.
   - Updated `POST /api/trips/{trip_id}/stops/{stop_id}/checkout` in `trips.py` to trigger contextual transition notifications and record `transition_notification_dispatched` in `trip_events`.

3. **Web Push Service Worker Registration & Notification Dispatcher (`frontend/lib/pushNotifications.ts`)**:
   - Registered `/sw.js` Service Worker with native notification permission handling.
   - Handles transition notifications displaying custom icons, badges, deep link navigation, and rich advice (gate hours, heat, scenic route).

4. **In-App Companion Concierge Card (`frontend/components/trip/CompanionConciergeCard.tsx`)**:
   - Prominent, culturally-styled card embedded in the Active Trip Operational View (`frontend/app/trip/page.tsx`).
   - Features live status indicator, dynamic advice for the upcoming stop, prior manual edit acknowledgment banner, and 1-tap "Ask Companion" action.
   - Includes a toggle button to register Web Push lockscreen notifications.

5. **Interactive ReplanProposalCard & Enhanced Chat Drawer (`frontend/components/trip/ReplanProposalCard.tsx` & `AIChatDrawer.tsx`)**:
   - Conversational chat interface with quick prompt pills ("I'm tired, can we skip the fort...", "Add Master Mohanlal studio...", dress etiquette, sunset spots).
   - Renders interactive `ReplanProposalCard` inside chat bubbles when the AI proposes itinerary changes.
   - Displays duration delta, cost delta, added/skipped stop badges, and feasibility status.
   - 1-tap "Accept & Update Route" button executes `commitReplan` through `POST /api/trips/{trip_id}/replan-accept`.
   - Handles `HTTP 409 Conflict` gracefully with a clear message and instant refresh option.

6. **Context Integration (`frontend/context/TripContext.tsx`)**:
   - Added `sendCompanionMessage(message)` calling `/api/trips/{trip_id}/assistant/messages` with intelligent fallback.
   - Wired `markCheckout` to automatically trigger `dispatchTransitionNotification` upon departure.

### Verification
- `frontend`: TypeScript compilation (`npx tsc --noEmit`) verified clean with 0 errors.
- `frontend`: ESLint (`npm run lint`) verified clean with 0 errors and 0 warnings.
- `frontend`: Node test runner (`npm test`) passed all 5 unit tests (`basket.test.mjs` and `companion.test.mjs`).
- `frontend`: Next.js production build (`npm run build`) succeeded with all static pages generated.
- `backend`: AST syntax verification passed on all updated Python files (`gemini.py`, `assistant.py`, `trips.py`, `test_companion_api.py`).

### Multi-Turn Agentic Travel Assistant & Expanded Itinerary Mutation Upgrade (2026-11-01)
1. **Model Fallback & Unbiased Prompt (`backend/app/services/gemini.py`)**:
   - Upgraded primary model from `gemini-3.1-flash-lite` (which was returning HTTP 503 under load) to `gemini-3-flash-preview` with automatic fallback across `["gemini-3-flash-preview", "gemini-3.5-flash", "gemini-flash-lite-latest", "gemini-3.1-flash-lite"]`.
   - Removed all hardcoded keyword-matching replies (`if "temple" in msg_lower`, `if "fatehsagar" in msg_lower`, etc.) in both `backend/app/services/gemini.py` and `frontend/context/TripContext.tsx` so pre-loaded stops (like Jagdish Temple or workshops) never bias the assistant into repeating canned answers.
   - Added a 19-venue `UDAIPUR_GAZETTEER` plus dynamic custom place creation so `add_stop` never silently overwrites unknown venues to `place_sukhadia_circle`.

2. **7-Tool Multi-Turn Agentic Loop (`backend/app/services/gemini.py`)**:
   - Implemented an iterative multi-step tool-calling loop (up to 4 rounds per turn) supporting:
     - `get_current_trip`
     - `get_recent_trip_events`
     - `search_places`
     - `get_place_details`
     - `calculate_transit_route` (live Google Routes API v2 transit time, distance, and INR fare calculation for `walking`, `auto_rickshaw`, and `cab` with Haversine road-factor fallback)
     - `propose_trip_changes` (supports `auto_commit=True` when the user confirms a prior proposal)
     - `execute_direct_trip_action` (`mark_visited`, `mark_checkout`, `update_budget`, `update_artisan_preference`)

3. **Expanded Deterministic Mutation Engine (`backend/app/schemas/replan.py`, `backend/app/engine/replan.py`, `backend/app/api/v1/replan.py`)**:
   - Added `update_travel_mode` (per-leg or trip-wide), `update_stop_duration`, `reschedule_stop`, `update_budget`, and custom place `add_stop` operations.
   - Auto-upserts custom places into `places` on preview/accept and persists `transit_minutes_from_prev` and `budget_updated_inr`.

4. **Stateful Multi-Turn Chat & Proposal UI (`frontend/context/TripContext.tsx`, `frontend/components/trip/AIChatDrawer.tsx`, `frontend/components/trip/ReplanProposalCard.tsx`)**:
   - `AIChatDrawer` and `sendCompanionMessage` now pass conversation `history` and `client_trip_state` to `POST /api/trips/{trip_id}/assistant/messages` and automatically refresh the active trip when `trip_updated` is true.
   - `ReplanProposalCard` renders diff badges for `travel_mode_changed`, `durations_updated`, `rescheduled_stops`, and `budget_updated_inr`.
