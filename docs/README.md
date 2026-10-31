# TrailWeave Documentation Index

This directory contains the complete, authoritative documentation for **TrailWeave**, from initial product requirements to engineering designs, database schemas, API contracts, and active hackathon execution tickets.

---

## 📚 Documentation Map

```
docs/
├── README.md                      # This documentation guide & directory map
├── PRD.md                         # Single Authoritative Product Requirements Document (PRD v3.0)
├── ARCHITECTURE.md                # System Topology, Unified Mutation Engine & Concurrency Design
├── DATABASE_SCHEMA.md             # PostgreSQL 15 + PostGIS Schemas, Spatial Indexes & DDL
├── API_SPEC.md                    # REST Endpoints, Payloads, HTTP 409 & Gemini Tool Calling
│
├── tickets/                       # Hackathon Execution Board (13 Vertical Slices in 4 Tracks)
│   ├── README.md                  # Master dependency graph & developer assignment matrix
│   ├── track-1-community-discovery/ # Dev 1: Discovery, Stop Mixing & Trip-to-Trail Publishing
│   ├── track-2-trip-engine-backend/ # Dev 2: PostGIS DB, Itinerary Solver & Replan API
│   ├── track-3-active-trip-companion/ # Dev 3: Active Trip View, Geofencing & Push Notifications
│   ├── track-4-artisan-whatsapp-admin/ # Dev 4: WhatsApp Ingestion, /artisans & /admin Portal
│   ├── track-5-integration-demo/  # All Devs: End-to-End Demo Script & Simulated Signals
│   └── backlog-gaps/              # Post-MVP edge cases & open operational questions
│
├── adr/                           # Architecture Decision Records (ADR 0001–0006)
│   ├── 0001-trailweave-architecture.md
│   ├── 0002-pivot-to-user-curated-itineraries.md
│   ├── 0003-multiday-relative-duration-model.md
│   ├── 0004-ai-travel-companion-and-smart-geofencing.md
│   ├── 0005-unified-trip-engine-and-active-companion.md
│   └── 0006-artisan-workshop-offerings-and-tourist-preferences.md
│
├── agents/                        # Agentic workflows, triage guidelines & issue tracker setup
│   ├── domain.md
│   ├── issue-tracker.md
│   └── triage-labels.md
│
└── archive/                       # Historical revision briefs preserved for provenance
    ├── FairPath_Changes_Since_Trip_to_Trail_Spec.md
    └── flows.md
```

---

## 🧭 Document Guide

### 1. Core Specifications (Authoritative)
- **[`PRD.md`](PRD.md)**: Product vision, user personas (`tourist`, `artisan`, `admin`), scope (P0/P1/P2), and the 4-minute hackathon demo script.
- **[`ARCHITECTURE.md`](ARCHITECTURE.md)**: System topology, single source of truth in PostgreSQL, monotonic trip revisions, and deterministic vs LLM boundaries.
- **[`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md)**: Complete DDL for all 10 tables, spatial indices (`GIST`), triggers, ER diagram, and multi-day relative duration modeling.
- **[`API_SPEC.md`](API_SPEC.md)**: REST endpoints, optimistic concurrency error handling (`HTTP 409`), and native Gemini function calling schemas.

### 2. Hackathon Implementation Board
- **[`tickets/`](tickets/README.md)**: 13 vertical-slice issues organized into 4 parallel developer tracks. Starter tickets for each developer have zero runtime blockers to enable concurrent coding from Hour 0.

### 3. Decisions & Domain Language
- **[`adr/`](adr/)**: Immutable records of architectural pivots and design decisions.
- **[`../GLOSSARY.md`](../GLOSSARY.md)**: Ubiquitous language enforced across code, database schemas, APIs, and UI copy.

### 4. Agent Workflows
- **[`agents/`](agents/issue-tracker.md)**: Operational rules and tracker conventions for AI pair programmers and automated coding agents.
