# 11: Dedicated Artisan Studio Directory & Artifact Catalogue Gallery (/artisans)

**What to build:**
A dedicated public discovery page (`/artisans`) and studio profile view (`/artisans/[id]`) in the mobile PWA showcasing verified local artisan studios across Udaipur. Cultural tourists can browse authentic master craftsmen by craft tradition (Pichwai painting, miniature art, terracotta pottery, leather craft, puppetry), view the artisan's self-uploaded craft and artifact photo gallery (`catalogue_images`), read master heritage stories, check retail opening hours, review hands-on workshop offerings (fee per person, duration, what you will learn), and tap a direct "Add to Basket / Itinerary" button.

**Blocked by:** 01: Project Foundation, Core PostGIS Schema & Udaipur Seed Data

**Status:** ready-for-agent

- [ ] Mobile-optimized directory page `/artisans` listing verified master craftsmen and studios with craft photo previews (`catalogue_images`).
- [ ] Craft category filter chips (`All`, `Pichwai & Miniature Painting`, `Pottery`, `Puppetry`, `Leather & Textiles`).
- [ ] Workshop filter toggle allowing tourists to specifically find hands-on masterclasses vs retail-only studios.
- [ ] Artisan studio card displaying craft type, master artisan name, physical workshop address, store hours, workshop fees/duration, and artifact photo preview.
- [ ] Studio detail view (`/artisans/[id]`) showing rich heritage bio, the artisan's uploaded **Catalogue & Artifact Photo Gallery (`catalogue_images`)**, operating hours, and workshop masterclass details.
- [ ] Direct 1-tap "Add to Basket / Itinerary" button wired to `BasketContext`.
- [ ] Endpoints `GET /api/artisans` and `GET /api/artisans/{id}` returning full place, workshop, contact, and `catalogue_images` fields.
