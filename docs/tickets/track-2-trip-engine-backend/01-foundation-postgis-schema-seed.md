# 01: Project Foundation, Core PostGIS Schema & Udaipur Seed Data

**What to build:**
A running development environment and database foundation providing the single authoritative source of truth for the entire team. This sets up the Next.js 15 PWA frontend shell, FastAPI backend service, and Supabase PostgreSQL instance with PostGIS support. It provisions all 10 core tables (`places`, `artisans`, `trips`, `itinerary_versions`, `trip_stops`, `trip_events`, `replan_proposals`, `community_trails`, `community_trail_stops`, `artisan_drafts`) and loads verified seed data for Udaipur heritage sites and artisan studios.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Next.js 15 PWA project scaffolded with Tailwind CSS, Lucide icons, and mobile viewport setup.
- [x] FastAPI backend service scaffolded with CORS, Pydantic v2 schemas conforming to API_SPEC.md, and database connection pool.
- [x] PostgreSQL migration executed provisioning all 10 tables, spatial PostGIS geometry columns, and GIST indexes.
- [x] Seed data populated for key Udaipur landmarks: City Palace, Jagdish Temple, Saheliyon Ki Bari, Bagore Ki Haveli, Sukhadia Circle street food, and Master Mohanlal Miniature Painting Studio.
- [x] At least 2 pre-populated community trails ("Udaipur Royal Palaces & Crafts", "Old City Evening Heritage Walk") available in database.
- [x] Docker Compose or setup script spins up local environment and passes a basic health check (`GET /health`).

## Comments
### Implementation Summary
- **Database & PostGIS**: Connected to live Supabase PostgreSQL (PostGIS 3.3). Applied `backend/app/db/schema.sql` provisioning all 10 tables (`places`, `artisans`, `trips`, `itinerary_versions`, `trip_stops`, `trip_events`, `replan_proposals`, `community_trails`, `community_trail_stops`, `artisan_drafts`), PostGIS point columns, automatic coordinate update trigger (`update_places_geom()`), and GIST spatial indexes.
- **Udaipur Seed Data**: Loaded verified dataset in `backend/app/db/seed.py`:
  - 6 Udaipur places (City Palace, Jagdish Temple, Saheliyon Ki Bari, Bagore Ki Haveli, Sukhadia Circle street food, Master Mohanlal Miniature Art Studio).
  - 1 verified artisan (Master Mohanlal Sharma, Pichwai & Miniature Painting).
  - 2 community trails ("Udaipur Royal Palaces & Crafts", "Old City Evening Heritage Walk") with 7 relative duration stops.
- **FastAPI Backend**:
  - Structured modular architecture with `app/main.py`, `app/core/config.py`, `app/core/database.py`, `app/schemas/` (Pydantic v2 domain schemas for places, artisans, trails, trips, and replan requests), and `app/api/v1/health.py`.
  - Configured async SQLAlchemy 2.0 with `asyncpg` connection pool (with statement cache disabled for Supabase transaction pooler compatibility).
- **Next.js 15 PWA Shell**:
  - Initialized Next.js 15 App Router with Tailwind CSS, TypeScript, and Lucide React.
  - Configured mobile viewport in `layout.tsx` (`userScalable: false`, `maximumScale: 1`).
  - Added PWA manifest `public/manifest.json`.
  - Created responsive mobile starter screen in `app/page.tsx` displaying system status and live connection to backend `/health`.
- **Developer Script**:
  - Added `scripts/run_dev.sh` to run seeding, test suite, and print commands to run backend and frontend.

### Verification Notes
- Pytest test suite (`backend/tests/test_foundation.py`) passed 100% (5/5 tests):
  1. `test_health_check_endpoint`: Verified `GET /health` returns status `ok`, database `connected`, postgis `installed`.
  2. `test_ten_tables_exist`: Verified all 10 tables exist in Supabase PostgreSQL schema.
  3. `test_postgis_spatial_distance`: Verified PostGIS spatial distance calculation (`ST_Distance` between City Palace and Jagdish Temple ~337.8m).
  4. `test_seeded_places_and_artisans`: Verified place and artisan records and workshop fees.
  5. `test_seeded_community_trails`: Verified multi-stop community trail records and relative duration attributes.
- Next.js build (`npm run build`) succeeded with zero TypeScript or ESLint errors.
