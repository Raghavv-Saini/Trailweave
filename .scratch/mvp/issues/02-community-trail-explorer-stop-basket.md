# 02: Community Trail Explorer & Stop Basket

**What to build:**
A mobile-first discovery interface where tourists can explore authentic itineraries published by fellow travelers and cherry-pick stops into a personal Trip Basket. Tourists can browse featured trails on the homepage, apply category filters (Heritage, Food, Crafts), filter by duration (1-day vs multi-day) and budget, view full trail details with relative stop timings, and mix stops from multiple trails into a shared basket with automatic deduplication by canonical place ID.

**Blocked by:** None (can start immediately against mock fixtures; integrates with 01: Project Foundation, Core PostGIS Schema & Udaipur Seed Data)

**Status:** ready-for-agent

- [ ] Homepage displays community-first discovery feed with category chips and clear entry points: "Explore Community Trails" vs "Plan from Scratch".
- [ ] Trail Explorer filters community trails by duration (single_day, multi_day), budget cap, and interest tags.
- [ ] Trail card displays author provenance, total duration hours, estimated cost in INR, stop count, and "Experienced Trail" badge.
- [ ] Trail detail view shows the relative stop timeline (`suggested_duration_minutes`, `time_slot`, `traveler_tip`).
- [ ] "Use as Base" action clones all stops of a trail into the Trip Basket.
- [ ] "Pick Individual Stops" enables selecting specific stops across multiple different trails into the Trip Basket.
- [ ] Trip Basket persists selected places across pages and automatically deduplicates duplicate canonical places while preserving multi-curator provenance.
- [ ] Floating basket counter displays total selected stops and a 1-tap "Proceed to Trip Builder" button.
