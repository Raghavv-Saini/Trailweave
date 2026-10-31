# ADR 0002: Pivot from Creator Trails to User-Submitted Curated Itineraries

## Status
Accepted

## Context
The initial TrailWeave specification relied on third-party content creators (social media travel vloggers) to supply discovery trails. However, relying on external creators introduced unnecessary complexity around rights, link degradation, attribution tracking, and a separate creator portal. Furthermore, real tourists executing actual trips on the ground in Udaipur generate authentic, time-tested itinerary data.

## Decision

### 1. Remove Content Creator Role & Creator Trails
- The `creator` user role, creator registration, and creator publishing portal are removed from the scope.
- Pre-seeded and user-discovered trails will now be sourced directly from actual travelers and local curation.

### 2. End-of-Trip Crowdsourced Submission Loop
- When a tourist finishes their itinerary (or taps "Complete Trip" in Live Day Mode), the app presents an opt-in prompt:
  > **"Share your Udaipur journey?"**
  > *"Would you like to submit your completed itinerary to be featured in our Curated Section for other travelers?"*
- If the user consents, they can optionally add:
  - A custom trip title (e.g., *"My Relaxed Heritage & Lake Walk"*).
  - Overall trip rating and brief tips/notes for future visitors.
  - Actual expenditure feedback.
- The submitted itinerary is tagged with `approval_status: pending_confirmation` and forwarded to the Admin curation queue.

### 3. Community Curated Section
- Approved user submissions are featured in the **"Curated Traveler Trails"** discovery section of the mobile PWA.
- Incoming tourists can:
  - Browse real itineraries completed by other travelers.
  - Filter by budget, duration, and vibe (e.g., solo, budget, culture).
  - Adopt or clone an itinerary into their planner, which the constraint solver then adapts to their specific starting location and available hours.

### 4. Simplified RBAC Roles
The application access model is streamlined to 3 core roles:
1. `tourist`: Browses curated itineraries, builds trips with AI, navigates live, discovers artisans, and submits completed itineraries.
2. `artisan`: Onboards via WhatsApp voice/text, maintains physical workshop listing.
3. `admin`: Curation queue for artisan drafts and community-submitted itineraries, city catalog manager, and demo controls.

## Consequences
- **Higher Authenticity**: Itineraries reflect real, walking-tested Udaipur routes rather than idealized social media videos.
- **Organic Data Moat**: TrailWeave builds a growing catalog of real traveler routes over time.
- **Leaner Architecture**: Eliminates social embed dependencies, video ingestion pipelines, and creator payout/attribution complexity.
