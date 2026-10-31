# GLOSSARY.md: TrailWeave Domain Terminology

This glossary defines the ubiquitous language for TrailWeave. All code, database schemas, APIs, and UI copy must adhere to these definitions.

---

### Core Domain Entities

#### 1. Canonical Place (`Place`)
A verified, physical geographic location in Udaipur with exact latitude/longitude coordinates, category (attraction, heritage, dining, nature, workshop), entry fee in INR, estimated visit duration in minutes, and operating hours.

#### 2. Community Curated Trail (`CommunityTrail`)
A real, completed itinerary (single-day or multi-day) submitted by a traveler with explicit consent at the end of their trip. Stored using a **relative duration model** (`suggested_duration_minutes`, `day_number`, `time_slot`), featuring verified places, traveler tips, total budget, and trip notes. Once reviewed, it is displayed in the Curated Section for other travelers to discover, clone, or adapt.

#### 3. Artisan (`Artisan`)
A local Udaipur craftsman, miniature painter, potter, textile weaver, or cultural enterprise with a physical store, studio, or workshop (`place_id`). Artisans are onboarded via WhatsApp voice/text and support two engagement modes:
- **Retail Store Visit**: Quick stop (15–25 mins) to observe craft-making and buy authentic items directly.
- **Hands-on Workshop**: An interactive masterclass (45–75 mins) where tourists create their own craft piece for a per-person fee (`workshop_fee_inr`).

#### 4. TrailWeave Recommendation (`TrailWeaveRecommendation`)
An inclusive, constraint-aware suggestion of a nearby Artisan workshop or local hidden gem. Never forced; proposed as an opt-in alternative with transparent rationale, detour time, and cost impact that strictly fits the tourist's budget and experience preference (workshop vs store visit).

#### 5. Travel Request (`TravelRequest`)
A tourist's input defining their journey parameters: single-day or multi-day duration, budget in INR (overall total or per-day), daily start locations (e.g. hotel), interests/tags, travel mode (walking, auto-rickshaw, cab), and selected anchor places or community trails.

#### 6. Personal Trip / Itinerary (`PersonalTrip` / `Itinerary`)
A private, user-specific instance of an itinerary stored in **My Trips**. Can be in-progress, active, or completed. When active, it binds the trail's relative durations to concrete calendar arrival/departure timestamps across Day 1, Day 2, etc., verifying feasibility against opening hours and daily budget limits.

#### 7. Artisan Draft (`ArtisanDraft`)
An unapproved profile extracted from a WhatsApp voice note or message. Contains transcription, extracted structured fields, and consent metadata. Must be reviewed and approved by an Admin before becoming publicly discoverable.

#### 8. Simulated Signal (`SimulatedSignal`)
A demonstration condition (e.g. temporary venue closure, crowd surge) explicitly flagged in the UI as `SIMULATED` to trigger and demonstrate adaptive re-planning without misrepresenting real-world live data.

#### 9. AI Travel Companion (`AITravelCompanion`)
The intelligent, cultured digital persona embedded in TrailWeave that manages itinerary logistics, monitors timing/buffers, and composes warm, personalized guidance for the traveler.

#### 10. Missed Checkout Grace Buffer (`MissedCheckoutGraceBuffer`)
A 20-minute time threshold applied after a stop's planned visit window. If the traveler departs without tapping checkout, the system automatically resolves the checkout, records the departure time, and prompts the user with the next stop transition.

#### 11. Transition Notification (`TransitionNotification`)
A personalized, contextual push notification sent to the traveler's phone lock screen and in-app banner guiding them smoothly to their next stop with practical tips and cultural context.

#### 12. Manual Check-in Fallback (`ManualCheckinFallback`)
An explicit 1-tap user action on any stop card allowing the traveler to check into a venue immediately without location services, essential for narrow old-city alleys, weak GPS locks, or denied browser location permissions.

#### 13. Trip Revision (`TripRevision`)
A monotonically increasing integer tracking the authoritative accepted state of a personal trip in PostgreSQL, used for optimistic concurrency control to prevent stale overwrites.

#### 14. Replan Proposal (`ReplanProposal`)
A provisional, validated candidate itinerary generated either via the manual editor or Gemini AI tool calling. Requires explicit tourist review and acceptance before committing as a new trip revision.

#### 15. Trip Event (`TripEvent`)
An append-only audit record capturing an accepted user or system action on a trip (e.g. `stop_visited`, `stop_skipped`, `stops_reordered`, `budget_adjusted`), powering the AI's contextual awareness of recent edits.

#### 16. Active Trip Companion (`ActiveTripCompanion`)
The persistent in-trip operational interface that tracks live journey execution, provides view/edit modes, manages geofencing, and coordinates two-way manual and AI itinerary modifications.

#### 17. Artisan Studio Directory (`ArtisanStudioDirectory`)
A dedicated discovery page (`/artisans`) showcasing verified local artisan studios in Udaipur, their craft traditions, retail hours, workshop pricing/duration, and a direct 1-tap "Add to Itinerary" action.

---

### Triage & Quality Roles

- **`data_status`**: `verified`, `reported`, `estimated`, `demo_simulated`, `unknown`
- **`approval_status`**: `draft`, `pending_confirmation`, `approved`, `rejected`
- **`user_role`**: `admin`, `tourist`, `artisan` (Creators replaced by crowdsourced tourist submissions)
