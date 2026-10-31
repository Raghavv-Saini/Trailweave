# 12: Admin Curation, Artisan Contact Directory & Place Verification Portal (/admin)

**What to build:**
A comprehensive administration, contact, and curation dashboard (`/admin`) for the TrailWeave operations team. Curators can review pending artisan voice drafts submitted via `/artisans/onboard`, read the AI-generated **English Admin Brief** and **Missing Info Checklist**, inspect the raw Hindi transcript and the artisan's uploaded craft photos (`catalogue_images` read-only preview), call the artisan directly with 1 tap (`tel:{sender_phone}`) to gather any missing info, edit extracted details, and approve drafts with a single tap to publish them into the canonical `places` and `artisans` tables. Additionally, curators have a full **All Artisans & Contact Info** directory to view and edit every onboarded artisan's complete information (including phone numbers, coordinates, hours, workshop fees, bio, and catalogue photos), plus basic curation controls to toggle featured community trails and import verified Udaipur places.

**Blocked by:** 01: Project Foundation, Core PostGIS Schema & Udaipur Seed Data, 10: Hindi Web Voice Onboarding, 4-Digit PIN & Self-Service Artisan Catalogue

**Status:** resolved

- [x] Curator dashboard accessible at `/admin` organized into clear operational tabs (`Voice Onboarding Drafts`, `All Artisans & Contact Info`, `Trails & Places Curation`).
- [x] **Voice Onboarding Drafts Queue** (`GET /api/admin/artisan-drafts`) displaying pending drafts with the **English Admin Brief**, **Missing Info to Ask Checklist**, **Raw Hindi Transcript**, **Phone Number + 1-Tap Call (`tel:`) button**, and read-only preview of the artisan's uploaded `catalogue_images`.
- [x] Interactive verification form to complete/refine studio name, artisan name, craft type, address, latitude/longitude, opening/closing hours, and workshop pricing/duration.
- [x] 1-tap **"Approve & Publish"** (`POST /api/admin/artisan-drafts/{draft_id}/approve`) that atomically creates/updates verified records in `places` and `artisans` (preserving the artisan's `phone_number`, `pin_hash`, and `catalogue_images`) and updates draft status to `approved`, plus **"Reject"** (`POST /api/admin/artisan-drafts/{draft_id}/reject`).
- [x] **All Artisans & Contact Info Directory** (`GET /api/admin/artisans`, `PATCH /api/admin/artisans/{artisan_id}`) allowing the Admin to view all info of every artisan (including phone numbers with 1-tap `tel:` call buttons, studio address, coordinates, hours, workshop pricing, bio, status, and catalogue photos) and edit any artisan's profile after contacting them.
- [x] **Community Trail & Place Curation** (`GET /api/admin/trails`, `PATCH /api/admin/trails/{trail_id}/feature`, `POST /api/admin/places`) to toggle `is_featured` on Community Trails and add/import verified Udaipur places into `places`.

---

## Comments

### Implementation Highlights
1. **Frontend Admin Curation Portal (`frontend/app/admin/page.tsx`)**:
   - Structured into 3 tabs: `Voice Onboarding Drafts`, `All Artisans & Contact Info`, and `Trails & Places Curation`.
   - **Voice Onboarding Drafts Queue**: Displays pending drafts with the AI-generated English Admin Brief callout, checkable Missing Info to Ask Checklist, formatted raw Hindi audio transcript, read-only preview grid of `catalogue_images` with full-screen lightbox modal, and 1-tap direct dial `tel:${sender_phone}` button.
   - **Interactive Studio Refinement**: Embedded expandable form allowing curators to review and update studio name, artisan name, craft type, address, operating hours, workshop toggle, and workshop fees/duration before approving.
   - **1-Tap Atomic Approval & Rejection**: Wired to `POST /api/admin/artisan-drafts/{draft_id}/approve` and `POST /api/admin/artisan-drafts/{draft_id}/reject` with feedback toasts and persistent directory updates.
   - **All Artisans & Contact Directory**: Full search and list view with 1-tap `tel:` phone call buttons, store hours, workshop offerings, bio, and inline profile editor calling `PATCH /api/admin/artisans/{artisan_id}`.
   - **Trails & Places Curation**: 1-tap toggle for `is_featured` on Community Trails (`PATCH /api/admin/trails/{trail_id}/feature`), and a quick-add form to verify and import new Udaipur places (`POST /api/admin/places`).

2. **Backend API Endpoints (`backend/app/api/v1/admin.py`)**:
   - `GET /api/admin/artisan-drafts`: Ingests from DB with in-memory fallback, serving full `admin_brief`, `missing_info_checklist`, and `catalogue_images`.
   - `POST /api/admin/artisan-drafts/{draft_id}/approve`: Atomically creates canonical `places` and `artisans` records, carrying forward `phone_number`, `pin_hash`, and uploaded artifact photos.
   - `POST /api/admin/artisan-drafts/{draft_id}/reject`: Updates draft status to rejected.
   - `GET /api/admin/artisans` & `PATCH /api/admin/artisans/{artisan_id}`: Serves and updates complete master artisan profiles and contact info.
   - `GET /api/admin/trails` & `PATCH /api/admin/trails/{trail_id}/feature`: Serves trails and updates `is_featured`.
   - `POST /api/admin/places`: Validates and inserts new verified places into the database and catalogue.

3. **Verification**:
   - Frontend: `node --test tests/*.test.mjs` (21/21 passing, including 5 new Ticket 12 verification tests in `tests/admin_portal.test.mjs`).
   - TypeScript: `npx tsc --noEmit` (0 errors).
   - Backend: `backend/tests/test_admin_portal.py` (5/5 tests passing).
