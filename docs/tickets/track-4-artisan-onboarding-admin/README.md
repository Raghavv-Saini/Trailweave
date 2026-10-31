# Track 4: Artisan Hindi Web Voice Onboarding, Self-Service Catalogue & Admin Curation

**Assigned to:** Developer 4 (Inclusive Local Tourism Lead)

## Focus Area
Deliver the zero-barrier Hindi Web Voice Onboarding & Self-Service Catalogue Portal (`/artisans/onboard`) with UPI-style 4-digit PIN authentication, the public `/artisans` studio directory with artifact photo galleries, and the curator verification & artisan contact dashboard at `/admin`.

## Tickets
1. [`10-hindi-web-voice-onboarding-catalogue.md`](10-hindi-web-voice-onboarding-catalogue.md) *(Start here! Unblocked)*
2. [`11-artisan-studio-directory.md`](11-artisan-studio-directory.md) *(Blocked by 01)*
3. [`12-admin-curation-verification-portal.md`](12-admin-curation-verification-portal.md) *(Blocked by 01, 10)*

## Key API Contracts
- `POST /api/artisans/onboard` — Hindi voice note transcription (`hi-IN`), 4-digit PIN signup, `catalogue_images`, and Gemini Admin Brief generation
- `POST /api/artisans/login` — Returning artisan login via phone number + 4-digit PIN
- `POST /api/artisans/me/catalogue` & `DELETE /api/artisans/me/catalogue` — Self-service craft & artifact photo management
- `GET /api/artisans` & `GET /api/artisans/{id}` — Verified artisan studio directory with `catalogue_images`
- `GET /api/admin/artisan-drafts` & `POST /api/admin/artisan-drafts/{draft_id}/approve` — Admin draft review & 1-tap promotion
- `GET /api/admin/artisans` & `PATCH /api/admin/artisans/{artisan_id}` — Full artisan info & phone contact directory
See [`docs/API_SPEC.md`](../../API_SPEC.md) and [`ADR 0010`](../../adr/0010-web-voice-artisan-onboarding-and-catalogue.md).
