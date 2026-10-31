# AGENTS.md

Authoritative guidelines, workflows, and mandatory checks for all AI agents working on the TrailWeave codebase.

---

## 1. Hackathon Team & Track Structure

TrailWeave is organized into **4 parallel developer tracks** coordinated around pre-agreed contracts:
- Master Execution Board & Dependency Graph: [`docs/tickets/README.md`](docs/tickets/README.md)
- **Track 1**: Community Discovery & UGC (`docs/tickets/track-1-community-discovery/`)
- **Track 2**: Trip Engine & Deterministic Backend (`docs/tickets/track-2-trip-engine-backend/`)
- **Track 3**: Active In-Trip Companion & UI (`docs/tickets/track-3-active-trip-companion/`)
- **Track 4**: Artisan Voice Onboarding, Catalogue & Admin Portal (`docs/tickets/track-4-artisan-onboarding-admin/`)
- **Track 5**: Integration & End-to-End Demo (`docs/tickets/track-5-integration-demo/`)

---

## 2. Issue Tracker Protocol (`docs/tickets/`)

- **Canonical Tracker**: All project tickets live exclusively in `docs/tickets/`. (`.scratch/` is deprecated/ignored for tickets).
- **One File Per Ticket**: Tickets follow `docs/tickets/track-<N>-<slug>/<NN>-<slug>.md`.
- **Claiming Work**:
  1. Check dependencies in [`docs/tickets/README.md`](docs/tickets/README.md). Never start a ticket whose upstream dependencies are unresolved.
  2. Update the ticket header: set `Status: claimed` before writing code.
- **Completing Work**:
  1. Check off completed task items (`[x]`).
  2. Set `Status: resolved`.
  3. Append an implementation summary and verification notes under `## Comments` at the bottom of the ticket.

See [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md) and [`docs/agents/triage-labels.md`](docs/agents/triage-labels.md).

---

## 3. Design Decisions & Living Specs Protocol (`docs/`)

Other developers rely directly on the documented contracts to work in parallel without blocking.
**Never introduce silent architectural, schema, or API deviations in code.**

### Architecture Decision Records (`docs/adr/`)
- When making a design decision that is hard to reverse, impacts other tracks, or resolves an architectural trade-off:
  - Create a new ADR in [`docs/adr/`](docs/adr/) using sequential numbering (next is `0007-<slug>.md`).
  - Follow the standard format: Context, Decision, and Consequences (see `.agents/skills/domain-modeling/ADR-FORMAT.md`).

### Living Specifications Sync
Whenever an API endpoint, data schema, or system flow is added, changed, or refined:
- **API Changes**: Immediately update [`docs/API_SPEC.md`](docs/API_SPEC.md) (endpoints, payloads, Gemini tool contracts).
- **Database / Schema Changes**: Immediately update [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) (tables, columns, indexes, PostGIS geometry).
- **System Flow Changes**: Immediately update [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (topologies, concurrency rules, state machines).

---

## 4. Mandatory 4-Step Agent Execution Loop

Every agent turn or task execution MUST execute the following 4-step loop:

### Step 1: Pre-Flight Contract Check
- Read the assigned ticket in `docs/tickets/`.
- Verify in [`docs/tickets/README.md`](docs/tickets/README.md) that all upstream tickets listed under `Blocked by:` are resolved.
- Read the relevant sections of:
  - [`GLOSSARY.md`](GLOSSARY.md) (ubiquitous language)
  - [`docs/API_SPEC.md`](docs/API_SPEC.md) (target endpoints & Gemini tools)
  - [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) (PostgreSQL tables & types)
  - Relevant [`docs/adr/`](docs/adr/) decisions

### Step 2: Strict Domain & Vocabulary Adherence
- Use terms as strictly defined in [`GLOSSARY.md`](GLOSSARY.md) (e.g. `community_trail`, `trip_stops`, `replan_proposals`, `trip_events`, `visit_status`, `relative duration`).
- Do not invent synonyms or deviate from established domain language.
- Remember the core architectural principle: **The AI companion proposes changes (`propose_trip_changes`); the deterministic backend engine validates and commits them.**

### Step 3: Design Decision & Spec Sync
- If implementation requires resolving an architectural ambiguity, creating a new endpoint, or altering database fields:
  1. Record an ADR in `docs/adr/NNNN-<slug>.md`.
  2. Update `docs/API_SPEC.md` and/or `docs/DATABASE_SCHEMA.md`.
  3. Ensure no conflicts with existing ADRs (ADR 0001–0006). If contradicting a prior ADR, explicitly document the reason for reopening.

### Step 4: Verification & Ticket Lifecycle Update
- Verify implementation: run tests, type checks, or verify against contract schemas.
- Update the ticket file in `docs/tickets/`:
  - Check all fulfilled acceptance criteria (`[x]`).
  - Set `Status: resolved`.
  - Append diff highlights, design decisions, and testing notes under `## Comments`.
