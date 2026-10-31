# ADR 0006: Artisan Workshop Offerings & Tourist Experience Preference Timing

## Status
Accepted

## Context
A key pillar of TrailWeave is connecting cultural tourists with traditional artisans in Udaipur. However, tourist intent varies: some travelers want to physically participate in an interactive craft workshop (e.g., spending 60 minutes painting a miniature Pichwai motif or throwing clay on a potter's wheel), while others prefer dropping by for 15 minutes to observe the master at work and purchase authentic crafts directly. To match the right experience, the platform must capture workshop capabilities from artisans and query the tourist's preference at the optimal planning touchpoint.

## Decisions

### 1. Dual Artisan Offering Model
Every verified artisan profile captures two distinct modes of engagement:
- **Retail Store / Studio Visit**: Quick stop (15–25 mins) to view finished crafts, observe traditional techniques, and buy directly from the artisan. Entry fee is typically zero.
- **Hands-on Workshop / Masterclass**: Interactive session (45–75 mins) where tourists learn and create their own craft piece under the artisan's guidance, with a per-person workshop fee (e.g., ₹250–₹500).

### 2. Structured WhatsApp Voice Onboarding for Artisans
During the WhatsApp onboarding interaction, the AI voice agent prompts and extracts:
- `has_workshop`: boolean (whether the artisan offers workshops/classes).
- `workshop_fee_inr`: fee per participant.
- `workshop_duration_minutes`: duration (e.g., 45, 60 mins).
- `workshop_description`: what the participant learns or creates.
- General store opening hours and physical workshop coordinates (`place_id`).

### 3. Tourist Planning Timing & Experience Preferences
- **Initial Onboarding**: The conversational questionnaire proactively asks:
  > *"Would you like to try your hand at an interactive cultural workshop (like pottery or miniature painting), or do you prefer quick store visits to browse and buy crafts?"*
- **Trip Builder Filter**: An explicit toggle remains accessible in the Trip Builder at all times:
  - `Hands-on Workshops`
  - `Store Visits / Shopping`
  - `Both / Open to whatever fits best (Default)`
- **Scheduler Adaptation**:
  - Selecting **Workshops** allocates a 45–75 min visit window and factors the workshop fee into the total budget calculation.
  - Selecting **Store Visits** allocates a 15–25 min visit block with ₹0 entry cost.
  - The TrailWeave recommendation card explicitly identifies the type:
    > *"Master Mohanlal Miniature Painting — Hands-on Workshop: +45 mins, ₹250 fee, make your own keepsake painting."*

### 4. Dedicated Artisan Directory & 1-Tap Itinerary Insertion
- Standalone `/artisans` discovery page allowing tourists to explore all verified Udaipur artisans, filter by craft type (Pichwai, pottery, textiles, leather) and workshop availability.
- Each artisan studio profile displays:
  - Master artisan story, address/neighborhood, store opening hours.
  - Workshop availability badge with fee, duration, and curriculum.
  - Direct 1-tap **"Add to Itinerary / Basket"** action that validates schedule and budget feasibility in real time.

## Consequences
- Prevents schedule distortion: tourists are never scheduled for a 60-minute workshop when they only wanted to buy a souvenir, or rushed through a workshop in 15 minutes.
- Empowers traditional artisans to monetize their cultural skills through workshops in addition to physical retail sales.
- Provides intentional, browseable discovery for cultural craft enthusiasts independent of automated route recommendations.
