# 09: AI Travel Companion & Web Push Transition Notifications

**What to build:**
An intelligent, cultured in-trip AI companion powered by Gemini Flash that delivers proactive guidance and conversational itinerary adaptations. Upon departure checkout from any stop, the system dispatches a personalized Web Push notification via Service Worker offering practical tips for the next stop. In the mobile app, tourists can chat with the companion ("I'm tired, can we skip the fort and find a rooftop tea shop nearby?"). The companion acknowledges prior manual skips/edits and uses typed backend tool calling (`search_places`, `propose_trip_changes`) to generate an interactive proposal card for 1-tap tourist acceptance.

**Blocked by:** 05: Unified Mutation Engine & Revision-Locked Replan API, 07: Active Trip Operational View & Manual Check-in Fallback

**Status:** ready-for-agent

- [ ] Web Push Service Worker registers push subscription and triggers transition notifications on checkout with contextual gate, weather, and scenic tips.
- [ ] In-app companion concierge card and drawer accessible on the active trip screen.
- [ ] Backend endpoint `POST /api/trips/{trip_id}/assistant/messages` injects fresh PostgreSQL trip revision state and recent change events from `trip_events`.
- [ ] Companion system prompt conditions Gemini Flash as a warm, knowledgeable "Cultured Local Companion" in Udaipur.
- [ ] Companion explicitly acknowledges prior user manual edits (e.g. "I see you skipped the museum earlier...") before proposing alterations.
- [ ] Companion interacts via strictly typed tool contracts (`get_current_trip`, `get_recent_trip_events`, `search_places`, `get_place_details`, `propose_trip_changes`).
- [ ] Propose tool dispatches candidate operations to the deterministic Trip Engine and embeds an interactive `ReplanProposalCard` inside chat.
- [ ] Tourist can review proposal diff in-chat and tap "Accept", triggering atomic commit to Revision N+1 and refreshing the active timeline.
