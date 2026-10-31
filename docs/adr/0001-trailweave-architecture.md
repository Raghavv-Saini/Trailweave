# ADR 0001: TrailWeave Mobile App & Backend Architecture

## Status
Accepted

## Context
TrailWeave is being developed for the **Aravalli Build Championship: Road to DevFest Udaipur** (31 October – 1 November 2026).
The original PRD specified a responsive web MVP + WhatsApp channel. Following technical grilling and user requirements refinement, a mobile app was deemed critical for tourist on-the-ground accessibility and ease of use. Additionally, end-to-end trip creation flexibility (from scratch with AI, from anchors, or from creator trails), strict budget adherence, and real WhatsApp integration with Google Cloud STT were specified.

## Decisions

### 1. Unified Mobile-First Progressive Web App (PWA)
- **Frontend Framework**: Next.js (App Router) + React + Tailwind CSS.
- **Form Factor**: Mobile-First PWA design with bottom navigation, touch ergonomics, and an installable PWA web manifest.
- **Rationale**: Instant zero-install accessibility on any phone via QR code/link (critical for tourists following creator video links), zero app-store approval delays, and single codebase covering mobile and administrative views.

### 2. Decoupled Backend & Database
- **Backend**: Python FastAPI running as an independent REST API service.
- **Database**: Supabase PostgreSQL with PostGIS extension for geospatial operations.
- **Rationale**: Python enables fast, deterministic heuristic scheduling algorithms, direct integration with Google Cloud STT, and Google GenAI SDKs.

### 3. Role-Based Access Control (RBAC)
- 3 primary roles: `tourist`, `artisan`, and `admin` (Creators pivoted to user-submitted community trails per ADR 0002).
- Authenticated via Supabase Auth with custom role claims/tables.

### 4. Trip Generation & Planning Flexibility
- **Mode 1 (Full AI Guided)**: Interactive chat / questionnaire building a trip from scratch.
- **Mode 2 (Anchor Places + Auto-Fill)**: Tourist selects 1-3 must-visit landmarks; engine completes the day.
- **Mode 3 (Community Curated Trails)**: Tourist selects and adapts real itineraries submitted by fellow travelers.
- All modes enforce hard budget (INR) and time-window constraints.

### 5. Constraint & TrailWeave Scheduling Engine
- Deterministic Python heuristic evaluator checking opening hours, transit matrix, visit buffers, and total spend.
- TrailWeave scoring hypothesis evaluates interest fit, proximity detour, price clarity, verification quality, and discovery opportunity.
- Generates truthful, transparent rationale explaining why an artisan or place was recommended.

### 6. Mapping & Navigation
- Interactive Google Maps embedded in the PWA with custom numbered markers and route polylines.
- 1-tap deep link into the phone's native Google Maps app (`google.com/maps/dir/...`) for turn-by-turn navigation.

### 7. Artisan Representation & Physical Grounding
- Every artisan is explicitly associated with a physical workshop, studio, or store address (`place_id`).
- When a tourist accepts a recommendation, that physical venue is inserted directly into the route timeline, respecting the user's budget.

### 8. WhatsApp Voice Onboarding & AI Pipeline
- Meta WhatsApp Cloud API webhooks (`GET` verification, `POST` event ingest).
- Audio downloaded via Meta Graph API.
- Transcribed via Google Cloud Speech-to-Text V2 (`hi-IN`), with Gemini Flash structured JSON entity extraction and conversational processing.

### 9. Live Day Mode with Proximity Detection
- Interactive trip execution screen with manual controls ("Mark Visited", "Skip", "Running Late", "Simulated Congestion").
- HTML5 Geolocation (`watchPosition`) checks tourists into stops when arriving within proximity.

## Consequences
- Clean separation between frontend PWA and backend API.
- Offline and mock fallbacks in `.env` ensure seamless local execution and demo reliability.
