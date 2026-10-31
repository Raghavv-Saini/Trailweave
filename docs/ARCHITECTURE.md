# TrailWeave: System Architecture & Technical Design

**Status:** Authoritative Technical Specification  
**Pilot Destination:** Udaipur, Rajasthan, India  
**Target Event:** Aravalli Build Championship: Road to DevFest Udaipur  
**Related ADRs:** [ADR 0001](adr/0001-trailweave-architecture.md), [ADR 0004](adr/0004-ai-travel-companion-and-smart-geofencing.md), [ADR 0005](adr/0005-unified-trip-engine-and-active-companion.md), [ADR 0006](adr/0006-artisan-workshop-offerings-and-tourist-preferences.md)

---

## 1. System Topology & Technology Stack

TrailWeave uses a decoupled, mobile-first architecture designed for zero-install tourist accessibility, deterministic scheduling accuracy, and live in-trip AI accompaniment:

```mermaid
graph TD
    subgraph ClientLayers [Client Surfaces]
        TouristPWA["Tourist PWA (Next.js 15 / React / Tailwind CSS)<br/>• Mobile-first ergonomics<br/>• HTML5 Geolocation Watcher<br/>• Service Worker & Web Push Notifications"]
        AdminPortal["Admin / Curator Portal (`/admin`)<br/>• Place import & verification<br/>• Artisan draft approval queue"]
        WhatsAppUser["Local Artisan<br/>• WhatsApp Voice / Text Messaging"]
    end

    subgraph ExternalGateways [External Gateways]
        MetaAPI["Meta WhatsApp Cloud API Webhook"]
        GoogleMaps["Google Maps Platform<br/>• Deep-link Navigation<br/>• Directions / Matrix"]
        GoogleSTT["Google Cloud Speech-to-Text V2 (`hi-IN`)"]
    end

    subgraph BackendAPI [FastAPI Backend Service]
        FastAPIRouter["FastAPI REST Application"]
        TripEngine["Authoritative Trip Engine<br/>• Deterministic Constraint Solver<br/>• TrailWeave Artisan Scorer<br/>• Optimistic Concurrency Manager"]
        GeminiOrchestrator["Gemini Flash Agent Orchestrator<br/>• Tool / Function Calling Engine<br/>• Cultured Companion Persona"]
    end

    subgraph DataStorage [Database Layer]
        PostgreSQL[("Supabase PostgreSQL + PostGIS<br/>• Single Source of Truth<br/>• Spatial Indexes (GIST)<br/>• Monotonic Revisions")]
    end

    TouristPWA -->|HTTPS / REST API| FastAPIRouter
    AdminPortal -->|HTTPS / REST API| FastAPIRouter
    WhatsAppUser -->|Audio / Text| MetaAPI
    MetaAPI -->|Webhook POST| FastAPIRouter
    FastAPIRouter --> GoogleSTT
    FastAPIRouter --> GeminiOrchestrator
    FastAPIRouter --> TripEngine
    TripEngine --> PostgreSQL
    TouristPWA -.->|Deep link| GoogleMaps
```

### Component Stack Summary
- **Frontend**: Next.js (App Router), React, Tailwind CSS, Lucide icons, HTML5 Geolocation API, Web Push Service Worker.
- **Backend**: Python 3.11+, FastAPI, Pydantic v2, Google GenAI SDK.
- **Database**: Supabase PostgreSQL with PostGIS extension for geospatial operations and spatial indexing.
- **Speech & AI**: Google Cloud STT V2 (`hi-IN`), Gemini 1.5/2.0 Flash for structured extraction and conversational tool calling.
- **Messaging Gateway**: Meta WhatsApp Cloud API webhooks.

---

## 2. Single Authoritative Source of Truth & Concurrency Control

Neither React local state nor LLM conversational context is canonical. **PostgreSQL holds the sole authoritative accepted state** of an itinerary.

```mermaid
sequenceDiagram
    autonumber
    participant Client as Tourist PWA
    participant API as FastAPI Trip Engine
    participant DB as PostgreSQL (Supabase)
    participant AI as Gemini Flash Companion

    Note over DB: Trip Revision = 1
    Client->>API: POST /trips/{id}/replan-preview (operations)
    API->>API: Validate hours, budget, transit
    API-->>Client: Replan Proposal Preview (Diff, costs, timing)
    
    Client->>API: POST /trips/{id}/replan-accept (base_revision: 1)
    API->>DB: Check current revision == 1
    alt Revision matches
        API->>DB: ATOMIC COMMIT: Set Revision = 2, Snapshot version, Append trip_event
        API-->>Client: HTTP 200 OK (Revision 2)
        Client->>Client: Refresh timeline & active map
    else Revision mismatch (Stale commit)
        API-->>Client: HTTP 409 Conflict ("Trip updated from another session")
        Client->>API: GET /trips/{id} (Fetch latest state)
    end

    Note over Client,AI: AI Natural Language Modification
    Client->>API: POST /trips/{id}/assistant/messages ("Add pottery workshop nearby")
    API->>DB: Fetch latest trip state (Revision 2) + recent events
    API->>AI: Inject fresh state + system prompt + tool declarations
    AI->>API: Call propose_trip_changes(base_revision: 2, operations)
    API->>API: Deterministic feasibility evaluation
    API-->>Client: AI message + interactive Proposal Preview Card
    Client->>API: POST /trips/{id}/replan-accept (base_revision: 2)
    API->>DB: ATOMIC COMMIT: Set Revision = 3
    API-->>Client: HTTP 200 OK (Revision 3)
```

### Optimistic Concurrency Mechanics
1. **Revision Property**: The `trips` table maintains a strictly monotonic integer `revision` (starts at 1).
2. **Proposals**: Any modification (manual drag-and-drop or AI tool execution) generates a provisional `replan_proposals` record bound to a specific `base_revision`.
3. **Commit Guard**: When accepting a proposal, the client must supply `expected_revision`. If `expected_revision != trips.revision`, the transaction aborts immediately and returns **HTTP 409 Conflict**.
4. **Append-Only Event Log**: Every committed modification generates a record in `trip_events` (`actor`, `source`, `event_type`, `payload`), enabling the AI to know what recently happened.

---

## 3. Unified Mutation Architecture

Both direct manual user actions and natural-language AI requests route through the **exact same deterministic trip engine**:

```mermaid
graph TD
    subgraph Client [Tourist Mobile PWA]
        ManualUI["Manual Edit Mode<br/>• Drag & reorder stops<br/>• 1-tap Skip / Remove<br/>• Pin stop"]
        ChatUI["Gemini Chat Assistant<br/>• 'I'm tired, make it shorter'<br/>• 'Find a pottery workshop under ₹300'"]
    end

    subgraph BackendEngine [FastAPI Shared Trip Engine]
        ToolRouter["Gemini Tool Calling / API Router"]
        ConstraintSolver["Deterministic Constraint Solver<br/>• Opening/Closing hours check<br/>• Transit time matrix calculation<br/>• Hard budget limit validation"]
        TrailWeaveScorer["TrailWeave Artisan Scorer<br/>• Proximity & detour minimization<br/>• Workshop vs Store preference match<br/>• Budget headroom validation"]
        ProposalEngine["Proposal Generator & Diff Service<br/>• Before/After cost comparison<br/>• Duration impact calculation"]
    end

    subgraph DB [Supabase PostgreSQL]
        TripsTable[("trips (Authoritative Revision N)")]
        VersionsTable[("itinerary_versions (Immutable Snapshots)")]
        EventsTable[("trip_events (Append-Only Audit)")]
        ProposalsTable[("replan_proposals (Provisional)")]
    end

    ManualUI -->|POST /replan-preview| BackendEngine
    ChatUI -->|POST /assistant/messages| ToolRouter
    ToolRouter -->|propose_trip_changes| BackendEngine
    BackendEngine --> ConstraintSolver
    BackendEngine --> TrailWeaveScorer
    BackendEngine --> ProposalEngine
    ProposalEngine --> ProposalsTable
    ProposalEngine -->> Client: Return Proposal Preview (Diff, Times, Costs)
    Client -->|POST /replan-accept (expected_revision)| BackendEngine
    BackendEngine -->|Atomic Transaction: Revision N+1| TripsTable
    BackendEngine -->|Store Snapshot| VersionsTable
    BackendEngine -->|Append Event| EventsTable
    TripsTable -->> Client: UI Timeline, Map & AI Context Refresh
```

---

## 4. Smart Geofencing & Lifecycle State Machine

To provide an intelligent in-trip companion without frustrating battery drain or GPS drift issues in Udaipur's historic old city, TrailWeave implements a hybrid geofencing model:

```mermaid
stateDiagram-v2
    [*] --> Planned: User taps "Start Trip"
    Planned --> InTransit: Approaching stop window
    
    state InTransit {
        [*] --> Navigating
        Navigating --> Within100m: HTML5 Geolocation detect <= 100m
        Navigating --> ManualCheckin: Weak GPS / User taps "Check In Manually"
    }

    Within100m --> StopActive: 1-Tap "Welcome! Tap to Check In"
    ManualCheckin --> StopActive: Immediate Check-in Commit

    state StopActive {
        [*] --> Touring
        Touring --> ManualCheckout: User taps "Ready to Move / Check Out"
        Touring --> BufferTimeout: Visit window elapsed + 20-min grace buffer
    }

    ManualCheckout --> StopCompleted: Record departure timestamp
    BufferTimeout --> StopCompleted: Auto-resolve checkout at elapsed window

    StopCompleted --> NextStopTransition: Fire AI Web Push Transition Notification
    NextStopTransition --> InTransit: More upcoming stops
    NextStopTransition --> TripFinished: Final stop reached
    
    TripFinished --> TripToTrail: User confirms visited stops & publishes
    TripToTrail --> [*]
```

### Geofencing Safeguards
1. **100-Meter Geofence Proximity**: Detected via browser `navigator.geolocation.watchPosition`. Triggers an in-app banner: *"Welcome to Jagdish Temple! Tap to check in."*
2. **Prominent 1-Tap Manual Check-in Fallback**: Narrow alleys in Jagdish Chowk or Gangaur Ghat often degrade GPS reception. Every stop card features a 1-tap **"Check In Manually"** button that requires zero satellite lock.
3. **20-Minute Missed Checkout Grace Buffer**: If a traveler gets immersed in City Palace and forgets to tap checkout, the system automatically resolves the checkout 20 minutes after the planned duration elapses, updates the remaining timeline, and guides the user forward.
4. **Transition Notifications**: Sent via Service Worker Web Push to lock screens:
   > *"Right on time, Raghav! Up next is City Palace. Enter via Badi Pol gate—it's cooler on the lake-facing pavilions right now. Stroll down via Gangaur Ghat."*

---

## 5. Division of Responsibilities: Deterministic Engine vs LLM

TrailWeave enforces a strict boundary between mathematical computation and natural language generation:

| Capability | Deterministic Backend (Python / PostGIS) | LLM (Gemini Flash) |
| :--- | :--- | :--- |
| **Geographic Distances & Transit Times** | Haversine / PostGIS `ST_Distance` / Transit Matrix. | Never computes transit numbers. |
| **Opening / Closing Hours Feasibility** | Hard boolean check against venue timetable. | Never hallucinates open hours. |
| **Budget & Expense Calculations** | Strict mathematical sum (`entry_fee + workshop_fee`). | Expresses costs in conversational summaries. |
| **Itinerary Commit & Database Write** | Authorized FastAPI transaction with revision check. | Proposes candidates via typed tools only; cannot execute SQL. |
| **Persona & Cultural Tone** | Supplies structured context (tourist name, preferences, stops). | Crafts warm, elegant, "Cultured Local Friend" narrative guidance. |
| **Voice Note Structured Extraction** | Receives audio stream and runs STT transcription. | Extracts structured JSON schema from Hindi/Mewari transcripts. |
