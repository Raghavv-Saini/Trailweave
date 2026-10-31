# 01: Project Foundation, Core PostGIS Schema & Udaipur Seed Data

**What to build:**
A running development environment and database foundation providing the single authoritative source of truth for the entire team. This sets up the Next.js 15 PWA frontend shell, FastAPI backend service, and Supabase PostgreSQL instance with PostGIS support. It provisions all 10 core tables (`places`, `artisans`, `trips`, `itinerary_versions`, `trip_stops`, `trip_events`, `replan_proposals`, `community_trails`, `community_trail_stops`, `artisan_drafts`) and loads verified seed data for Udaipur heritage sites and artisan studios.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Next.js 15 PWA project scaffolded with Tailwind CSS, Lucide icons, and mobile viewport setup.
- [ ] FastAPI backend service scaffolded with CORS, Pydantic v2 schemas conforming to API_SPEC.md, and database connection pool.
- [ ] PostgreSQL migration executed provisioning all 10 tables, spatial PostGIS geometry columns, and GIST indexes.
- [ ] Seed data populated for key Udaipur landmarks: City Palace, Jagdish Temple, Saheliyon Ki Bari, Bagore Ki Haveli, Sukhadia Circle street food, and Master Mohanlal Miniature Painting Studio.
- [ ] At least 2 pre-populated community trails ("Udaipur Royal Palaces & Crafts", "Old City Evening Heritage Walk") available in database.
- [ ] Docker Compose or setup script spins up local environment and passes a basic health check (`GET /health`).
