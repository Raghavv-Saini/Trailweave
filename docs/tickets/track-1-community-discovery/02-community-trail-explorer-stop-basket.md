# 02: Community Trail Explorer & Stop Basket

**What to build:**
A mobile-first discovery interface where tourists can explore authentic itineraries published by fellow travelers and cherry-pick stops into a personal Trip Basket. Tourists can browse featured trails on the homepage, apply category filters (Heritage, Food, Crafts), filter by duration (1-day vs multi-day) and budget, view full trail details with relative stop timings, and mix stops from multiple trails into a shared basket with automatic deduplication by canonical place ID.

**Blocked by:** None (can start immediately against mock fixtures; integrates with 01: Project Foundation, Core PostGIS Schema & Udaipur Seed Data)

**Status:** resolved

- [x] Homepage displays community-first discovery feed with category chips and clear entry points: "Explore Community Trails" vs "Plan from Scratch".
- [x] Trail Explorer filters community trails by duration (single_day, multi_day), budget cap, and interest tags.
- [x] Trail card displays author provenance, total duration hours, estimated cost in INR, stop count, and "Experienced Trail" badge.
- [x] Trail detail view shows the relative stop timeline (`suggested_duration_minutes`, `time_slot`, `traveler_tip`).
- [x] "Use as Base" action clones all stops of a trail into the Trip Basket.
- [x] "Pick Individual Stops" enables selecting specific stops across multiple different trails into the Trip Basket.
- [x] Trip Basket persists selected places across pages and automatically deduplicates duplicate canonical places while preserving multi-curator provenance.
- [x] Floating basket counter displays total selected stops and a 1-tap "Proceed to Trip Builder" button.

## Comments
### Implementation Summary
- **Authoritative Mock Dataset (`frontend/lib/mockData.ts`)**: Built typed Udaipur places, artisans, and community trails matching `API_SPEC.md` and `DATABASE_SCHEMA.md`. Restored clean TypeScript compilation across the entire frontend.
- **Stop Basket Context & Deduplication (`frontend/context/BasketContext.tsx`)**: Upgraded basket state with `localStorage` persistence, automatic canonical `place_id` deduplication, and multi-curator provenance retention (`sources: CuratorProvenance[]`).
- **Homepage Discovery Feed (`frontend/app/page.tsx`)**: Added clear dual entry points ("Explore Community Trails" vs "Plan from Scratch"), "Plan from Scratch" duration modal (1, 2, or 3 days), category chips, and featured trails list.
- **Community Trail Explorer & Filters (`frontend/app/trails/page.tsx`, `TrailFilterBar.tsx`)**: Filterable by duration (All, 1-Day, Multi-Day), budget chips (<₹500, <₹1,500, Any Budget), and interest tags.
- **Rich Trail Cards (`frontend/components/discovery/TrailCard.tsx`)**: Renders author provenance, total active duration, estimated cost in INR, stop count, "Experienced Trail" badge, "Use as Base" action, and "Pick Individual Stops" navigation.
- **Trail Detail View (`frontend/app/trails/[id]/page.tsx`)**: Dynamic route rendering relative stop timeline (`suggested_duration_minutes`, `time_slot`, `traveler_tip`), with 1-tap "Add Stop" / "In Basket" toggling and "Use as Base" confirmation modal.
- **Floating Basket Counter & Drawer (`FloatingBasketButton.tsx`, `BasketDrawer.tsx`)**: Persistent floating counter above bottom navigation; slide-up drawer showing deduplicated places with multi-curator badges, cost/time subtotal, delete actions, and 1-tap "Proceed to Trip Builder" handoff to `/trip`.

### Verification Notes
- **TypeScript**: `npx tsc --noEmit` passed with 0 errors.
- **ESLint**: `npx next lint` passed with 0 warnings and 0 errors.
- **Unit Tests**: `npm test` (`frontend/tests/basket.test.mjs`) passed 100% (2/2 tests covering deduplication, multi-curator provenance, and subtotal calculations).
- **Production Build**: `npm run build` completed successfully, generating static pages for all 10 app routes.
