# 11: Dedicated Artisan Studio Directory (/artisans)

**What to build:**
A dedicated public discovery page (`/artisans`) in the mobile PWA showcasing verified local artisan studios across Udaipur. Cultural tourists can browse authentic master craftsmen by craft tradition (Pichwai painting, miniature art, terracotta pottery, leather craft, puppetry), view studio photo galleries, read master heritage stories, check retail opening hours, review hands-on workshop offerings (fee per person, duration, what you will learn), and tap a direct "Add to Basket / Itinerary" button with real-time budget and schedule feasibility verification.

**Blocked by:** 01: Project Foundation, Core PostGIS Schema & Udaipur Seed Data

**Status:** ready-for-agent

- [ ] Mobile-optimized directory page `/artisans` listing verified master craftsmen and studios.
- [ ] Craft category filter chips (`All`, `Pichwai & Miniature Painting`, `Pottery`, `Puppetry`, `Textiles & Weaving`).
- [ ] Workshop filter toggle allowing tourists to specifically find hands-on masterclasses vs retail-only studios.
- [ ] Artisan studio card displaying craft type, master artisan name, physical workshop address, store hours, and workshop fees/duration.
- [ ] Studio detail modal/view showing rich heritage bio, photo gallery, and map view showing walking proximity from Old City landmarks.
- [ ] Direct 1-tap "Add to Basket / Itinerary" button that verifies schedule and budget feasibility before adding the studio stop.
- [ ] Endpoints `GET /api/artisans` and `GET /api/artisans/{id}` implemented and documented.
