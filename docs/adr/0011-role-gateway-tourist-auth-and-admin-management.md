# 11. Role Gateway Landing, Tourist Email/Password Authentication, Connected Trip Flows & Admin Team Management

Date: 2026-11-01
Status: Accepted
Related ADRs: [ADR 0001](0001-trailweave-architecture.md), [ADR 0005](0005-unified-trip-engine-and-active-companion.md), [ADR 0010](0010-web-voice-artisan-onboarding-and-catalogue.md)

---

## Context

In the initial multi-track integration of TrailWeave, the root route (`/`) served as an unauthenticated combined page displaying Community Trails, Artisan Onboarding links, and Admin Curation links simultaneously in the top navigation bar. Furthermore:
1. **Missing Role Selection & Login Gateway**: Visitors arriving at `http://localhost:3000/` had no dedicated landing page to choose their role (**Tourist**, **Artisan**, or **Admin**) or authenticate with email and password.
2. **Conflated Homepage vs. Community Trails**: The root `/` duplicated the Community Trails feed rather than functioning as a proper **Tourist Homepage** once logged in, while `/trails` was a separate route.
3. **Disconnected Trip Creation Flows**: Clicking "Plan From Scratch" or "Proceed to Trip Builder" in the Trip Basket navigated to `/trip` without passing the user's selected stops, duration, budget, or transport mode into the active itinerary state.
4. **Admin Superuser Delegation**: There was no mechanism for an authenticated Admin (`superuser`) to invite or provision additional administrators (`POST /api/v1/admin/team`), nor was `/admin` protected against unauthorized access.

---

## Decision

### 1. Root Entry (`http://localhost:3000/`): Role Selection Gateway & Tourist Homepage
- **Unauthenticated State (Role Selection Gateway)**:
  - Visiting `/` when unauthenticated presents an authoritative **Role Selection Landing Page** with three distinct pathways:
    1. **Tourist (`पर्यटक`)**: Sign Up or Log In with Email & Password (`/login`, `/signup`).
    2. **Master Artisan (`कारीगर`)**: Branch directly to the Hindi-first Voice Onboarding & 4-Digit PIN Studio Portal (`/artisans/onboard`).
    3. **Admin & Superuser (`प्रशासन`)**: Sign In with administrator credentials (`/login?role=admin`) to access `/admin`.
- **Authenticated Tourist State (Tourist Homepage at `/`)**:
  - Once authenticated as a Tourist, `/` renders the **Tourist Homepage**, featuring:
    - Personalized greeting and **Active Trip Status Banner** (resume active trip on `/trip` or start a new journey).
    - **Interactive Trip Builder** supporting both **Plan from Scratch** (days, budget, transport mode, candidate places) and **Build from Trip Basket**.
    - Quick navigation cards to **Community Trails (`/trails`)**, **Artisan Studios (`/artisans`)**, and **My Active Companion (`/trip`)**.

### 2. Dedicated Community Trails Endpoint (`/trails`) & Guarded Tourist Routes
- Community Trails discovery, filtering, and "Use as Base" curation live at `/trails`.
- Tourist routes (`/trails`, `/trip`, `/artisans`) require tourist (or admin) authentication, redirecting unauthenticated users to `/login`.
- Completing a trip on `/trip` and publishing it via **Publish as Community Trail** (`TripToTrailModal`) persists the new trail so it immediately appears in the `/trails` feed.

### 3. Strictly Separated Role Navigation
- **Tourist Navigation**: Displays only Tourist items (`Home (/)`, `Community Trails (/trails)`, `Artisan Studios (/artisans)`, `My Trip (/trip)`), Trip Basket, User Badge, and Log Out.
- **Artisan Navigation (`/artisans/onboard`)**: Displays Artisan Studio Portal context and a clean link to exit/switch role.
- **Admin Navigation (`/admin`)**: Displays Admin Curation & Superuser Portal context and Log Out.

### 4. Tourist Email/Password Auth & Superuser Admin Management (`users` Table)
- Introduce the `users` table (`id`, `email`, `hashed_password`, `full_name`, `role`, `is_active`, `created_at`, `updated_at`) supporting roles `'tourist'`, `'admin'`, and `'superuser'`.
- Pre-seed default superuser `admin@trailweave.org` (password: `admin123`) for immediate administrative access and demonstration.
- Expose authentication endpoints (`POST /api/v1/auth/signup`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me`) and admin team management endpoints (`GET /api/v1/admin/team`, `POST /api/v1/admin/team`) allowing admins to add new administrators.

---

## Consequences

- **Positive**: Clear, intuitive onboarding and role separation for Tourists, Artisans, and Admins from the very first screen (`/`).
- **Positive**: End-to-end connected UX where Basket selections and "Plan from Scratch" parameters generate real live itineraries on `/trip`, and completed trips publish directly back to `/trails`.
- **Positive**: Superuser admins can self-manage their operations team by provisioning additional admins inside `/admin`.
