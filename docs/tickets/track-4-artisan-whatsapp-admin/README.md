# Track 4: Artisan WhatsApp Ingestion & Admin Curation

**Assigned to:** Developer 4 (Inclusive Local Tourism Lead)

## Focus Area
Deliver the zero-barrier artisan voice onboarding pipeline via WhatsApp, the public `/artisans` studio directory, and the curator verification dashboard at `/admin`.

## Tickets
1. [`10-whatsapp-voice-extraction-pipeline.md`](10-whatsapp-voice-extraction-pipeline.md) *(Start here! Unblocked)*
2. [`11-artisan-studio-directory.md`](11-artisan-studio-directory.md) *(Blocked by 01)*
3. [`12-admin-curation-verification-portal.md`](12-admin-curation-verification-portal.md) *(Blocked by 01, 10)*

## Key API Contracts
- `GET /api/whatsapp/webhook` & `POST /api/whatsapp/webhook` — Meta WhatsApp webhook
- `GET /api/artisans` & `GET /api/artisans/{id}` — Verified artisan studio directory
- `POST /api/admin/artisans/{draft_id}/approve` — Approve draft into verified place
See [`docs/API_SPEC.md`](../../API_SPEC.md).
