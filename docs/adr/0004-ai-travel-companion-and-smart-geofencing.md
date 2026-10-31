# ADR 0004: AI Travel Companion Persona, Smart Geofencing & Push Notifications

## Status
Accepted

## Context
During live journey execution, tourists face cognitive fatigue managing schedules, tickets, navigation, and transit times. The user specified that the AI agent should be highly intelligent and embody the personality of a seasoned, thoughtful travel planner—proactive yet unobtrusive, handling all planning logistics so the traveler simply follows along. Furthermore, on-the-ground execution requires automated GPS check-ins, robust handling of missed checkouts, and personalized transition notifications delivered directly to the phone's lock screen.

## Decisions

### 1. AI Travel Companion Persona ("The Cultured Local Friend")
- **Voice & Archetype**: A seasoned traveler and local connoisseur who knows Udaipur intimately.
- **Personality Attributes**:
  - *Thoughtful & Observant*: Considers heat, walking terrain, crowd rhythms, and lighting for photography.
  - *Proactive, Not Intrusive*: Anticipates needs (reminding about shoe drop-offs at temples, ticket lines, or hydration) without spamming the user.
  - *High Craftsmanship*: Speaks with cultural warmth and elegance, avoiding robotic or generic alert syntax.
- **Prompt Architecture**: Powered by Gemini Flash with structured prompt conditioning on traveler preferences, time of day, current stop context, and remaining budget.

### 2. Smart GPS Geofencing (Check-ins & Checkouts)
- **Check-in Detection**:
  - *Automated Proximity*: HTML5 Geolocation API (`navigator.geolocation.watchPosition`) checks proximity. When within **100 meters** of a scheduled stop, prompts: *"Welcome to Jagdish Temple! Tap to check in."*
  - *Manual Check-in Fallback*: If location services are disabled, permissions denied, or GPS drifts in narrow old-city alleys, a prominent 1-tap **"Check In Manually"** button on every stop card immediately marks the stop active and records arrival time.
- **Checkout Handling**:
  - Tourist can tap *"Check Out / Ready to Move"*.
  - **Missed Checkout Resolution**: If the planned visit duration + **20-minute grace buffer** passes without manual checkout, the system automatically checks the user out, sets departure time to the elapsed window, and prompts the traveler:
    > *"Looks like you've wrapped up at City Palace! We've recorded your departure at 11:45 AM. Tap to adjust if needed."*

### 3. Transition Notifications Delivery
- **Delivery Mechanism**:
  - **Web Push Notifications (Service Worker API)**: Delivers native lock-screen notifications on mobile browsers (Android Chrome, iOS Safari 16.4+ Web Push) even when the browser is backgrounded or screen is locked.
  - **In-App Concierge Card**: Interactive dynamic banner on the active trip screen displaying the current message and action button.
- **Message Crafting**:
  - Rather than dry system alerts (*"Next stop: Bagore Ki Haveli at 14:00"*), Gemini Flash crafts a personalized, contextual message:
    > *"Right on time, Raghav! As the afternoon heat softens, we're heading to Bagore Ki Haveli right by Lake Pichola. Take the lakeside alley down Gangaur Ghat—it’s an easy 6-minute stroll. Head up to the haveli terrace for a great view before the puppet gallery closes."*

## Consequences
- Elevates TrailWeave from a mechanical scheduling tool to an intelligent, human-feeling travel companion.
- Service Worker registration and VAPID key configuration required for Web Push delivery.
- Grace buffer prevents itinerary timeline blockage if the tourist forgets to tap checkout.
