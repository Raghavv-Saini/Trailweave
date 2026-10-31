# 12: Admin Curation, Artisan Contact Directory & Place Verification Portal (/admin)

**What to build:**
A comprehensive administration, contact, and curation dashboard (`/admin`) for the TrailWeave operations team. Curators can review pending artisan voice drafts submitted via `/artisans/onboard`, read the AI-generated **English Admin Brief** and **Missing Info Checklist**, inspect the raw Hindi transcript and the artisan's uploaded craft photos (`catalogue_images` read-only preview), call the artisan directly with 1 tap (`tel:{sender_phone}`) to gather any missing info, edit extracted details, and approve drafts with a single tap to publish them into the canonical `places` and `artisans` tables. Additionally, curators have a full **All Artisans & Contact Info** directory to view and edit every onboarded artisan's complete information (including phone numbers, coordinates, hours, workshop fees, bio, and catalogue photos), plus basic curation controls to toggle featured community trails and import verified Udaipur places.

**Blocked by:** 01: Project Foundation, Core PostGIS Schema & Udaipur Seed Data, 10: Hindi Web Voice Onboarding, 4-Digit PIN & Self-Service Artisan Catalogue

**Status:** ready-for-agent

- [ ] Curator dashboard accessible at `/admin` organized into clear operational tabs (`Voice Onboarding Drafts`, `All Artisans & Contact Info`, `Trails & Places Curation`).
- [ ] **Voice Onboarding Drafts Queue** (`GET /api/admin/artisan-drafts`) displaying pending drafts with the **English Admin Brief**, **Missing Info to Ask Checklist**, **Raw Hindi Transcript**, **Phone Number + 1-Tap Call (`tel:`) button**, and read-only preview of the artisan's uploaded `catalogue_images`.
- [ ] Interactive verification form to complete/refine studio name, artisan name, craft type, address, latitude/longitude, opening/closing hours, and workshop pricing/duration.
- [ ] 1-tap **"Approve & Publish"** (`POST /api/admin/artisan-drafts/{draft_id}/approve`) that atomically creates/updates verified records in `places` and `artisans` (preserving the artisan's `phone_number`, `pin_hash`, and `catalogue_images`) and updates draft status to `approved`, plus **"Reject"** (`POST /api/admin/artisan-drafts/{draft_id}/reject`).
- [ ] **All Artisans & Contact Info Directory** (`GET /api/admin/artisans`, `PATCH /api/admin/artisans/{artisan_id}`) allowing the Admin to view all info of every artisan (including phone numbers with 1-tap `tel:` call buttons, studio address, coordinates, hours, workshop pricing, bio, status, and catalogue photos) and edit any artisan's profile after contacting them.
- [ ] **Community Trail & Place Curation** (`GET /api/admin/trails`, `PATCH /api/admin/trails/{trail_id}/feature`, `POST /api/admin/places`) to toggle `is_featured` on Community Trails and add/import verified Udaipur places into `places`.
