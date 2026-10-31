# Track 3: Active In-Trip Companion & Mobile Experience

**Assigned to:** Developer 3 (Mobile Experience & Geofencing Lead)

## Focus Area
Deliver the live in-trip companion experience: persistent operational dashboard, 100m geofence auto-checkin, 1-tap Manual Check-in Fallback, upcoming stop Edit Mode, Web Push notifications, and conversational Gemini Flash companion.

## Tickets
1. [`07-active-trip-view-manual-checkin.md`](07-active-trip-view-manual-checkin.md) *(Start here! Unblocked)*
2. [`08-upcoming-stop-manual-editor.md`](08-upcoming-stop-manual-editor.md) *(Blocked by 05, 07)*
3. [`09-ai-companion-push-notifications.md`](09-ai-companion-push-notifications.md) *(Blocked by 05, 07)*

## Key API Contracts
- `POST /api/trips/{trip_id}/stops/{stop_id}/visit` — Record stop arrival
- `POST /api/trips/{trip_id}/stops/{stop_id}/checkout` — Record stop departure
- `POST /api/trips/{trip_id}/assistant/messages` — Conversational companion with tool calling
See [`docs/API_SPEC.md`](../../API_SPEC.md).
