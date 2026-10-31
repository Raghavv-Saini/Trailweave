# Track 2: Trip Engine & Backend Services

**Assigned to:** Developer 2 (Backend & Engine Lead)

## Focus Area
Deliver the authoritative single source of truth in PostgreSQL/Supabase, the deterministic itinerary solver, optimistic concurrency replan engine, and artisan recommendation scorer.

## Tickets
1. [`01-foundation-postgis-schema-seed.md`](01-foundation-postgis-schema-seed.md) *(Start here! Unblocked)*
2. [`04-deterministic-itinerary-planner.md`](04-deterministic-itinerary-planner.md) *(Blocked by 01)*
3. [`05-unified-mutation-engine-replan-api.md`](05-unified-mutation-engine-replan-api.md) *(Blocked by 04)*
4. [`06-artisan-smart-recommendation-scorer.md`](06-artisan-smart-recommendation-scorer.md) *(Blocked by 04)*

## Key API Contracts
- `POST /api/trips` — Create / initialize trip
- `GET /api/trips/{trip_id}` — Authoritative trip state & current revision
- `POST /api/trips/{trip_id}/replan-preview` — Provisional candidate proposal
- `POST /api/trips/{trip_id}/replan-accept` — Revision-locked commit (HTTP 409 check)
See [`docs/API_SPEC.md`](../../API_SPEC.md) and [`docs/DATABASE_SCHEMA.md`](../../DATABASE_SCHEMA.md).
