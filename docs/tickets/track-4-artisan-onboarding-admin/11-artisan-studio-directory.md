# 11: Dedicated Artisan Studio Directory & Artifact Catalogue Gallery (/artisans)

**What to build:**
A dedicated public discovery page (`/artisans`) and studio profile view (`/artisans/[id]`) in the mobile PWA showcasing verified local artisan studios across Udaipur. Cultural tourists can browse authentic master craftsmen by craft tradition (Pichwai painting, miniature art, terracotta pottery, leather craft, puppetry), view the artisan's self-uploaded craft and artifact photo gallery (`catalogue_images`), read master heritage stories, check retail opening hours, review hands-on workshop offerings (fee per person, duration, what you will learn), and tap a direct "Add to Basket / Itinerary" button.

**Blocked by:** 01: Project Foundation, Core PostGIS Schema & Udaipur Seed Data

**Status:** completed

- [x] Mobile-optimized directory page `/artisans` listing verified master craftsmen and studios with craft photo previews (`catalogue_images`).
- [x] Craft category filter chips (`All`, `Pichwai & Miniature Painting`, `Pottery`, `Puppetry`, `Leather & Textiles`).
- [x] Workshop filter toggle allowing tourists to specifically find hands-on masterclasses vs retail-only studios.
- [x] Artisan studio card displaying craft type, master artisan name, physical workshop address, store hours, workshop fees/duration, and artifact photo preview.
- [x] Studio detail view (`/artisans/[id]`) showing rich heritage bio, the artisan's uploaded **Catalogue & Artifact Photo Gallery (`catalogue_images`)**, operating hours, and workshop masterclass details.
- [x] Direct 1-tap "Add to Basket / Itinerary" button wired to `BasketContext`.
- [x] Endpoints `GET /api/artisans` and `GET /api/artisans/{id}` returning full place, workshop, contact, and `catalogue_images` fields.

---

## Comments

### Real-Time Sync with Voice Onboarding & Admin Approval (2026-11-01)
1. **Next.js Proxy Rewrites (`frontend/next.config.ts`)**:
   - Added rewrites for `/api/*` and `/api/v1/*` proxying from port 3000 to FastAPI on port 8000, preventing 404s when fetching `/api/artisans`.
2. **Database SQL Insert in `/admin`**:
   - Fixed `approve_artisan_draft` in `backend/app/api/v1/admin.py` to include `artisan_name` (`NOT NULL` column in DB) and `bio`, properly persisting approved artisans in PostgreSQL.
3. **In-Memory & Database Listing Merge**:
   - Updated `list_artisans()` in `backend/app/api/v1/artisans.py` to merge in-memory approved artisans with database results by ID so newly approved artisans appear immediately.
4. **Directory Multi-Source Hydration & New Listing Badge**:
   - Added `localStorage` hydration (`trailweave_approved_artisans`) to `frontend/app/artisans/page.tsx` and `[id]/page.tsx` for client-side continuity.
   - Added an animated **"नई लिस्टिंग (New)"** pill badge in `frontend/components/artisans/ArtisanCard.tsx`.
5. **Verification**:
   - 25 frontend tests passing (`node --test tests/*.test.mjs`).
   - 53 backend pytests passing (`pytest backend/tests/`).
   - TypeScript compiler passing with 0 errors (`npx tsc --noEmit`).
