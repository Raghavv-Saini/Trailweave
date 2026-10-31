# Track 1: Community Discovery & UGC

**Assigned to:** Developer 1 (Community & UGC Lead)

## Focus Area
Deliver the community travel flywheel: discovery homepage, trail filters, stop mixing into a Trip Basket, and Trip-to-Trail publishing upon journey completion.

## Tickets
1. [`02-community-trail-explorer-stop-basket.md`](02-community-trail-explorer-stop-basket.md) *(Start here! Unblocked)*
2. [`03-trip-to-trail-publishing.md`](03-trip-to-trail-publishing.md) *(Blocked by 02)*

## Key API Contracts
- `GET /api/trails` — Browse community trails
- `GET /api/trails/{id}` — Full trail details & relative stops
- `POST /api/trips/{trip_id}/publish-trail` — Convert completed trip to published trail
See [`docs/API_SPEC.md`](../../API_SPEC.md) for request/response payloads.
