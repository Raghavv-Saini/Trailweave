# 03: Trip-to-Trail Contribution & Privacy-Aware Publishing

**What to build:**
The post-trip contribution flywheel that closes the community loop. When a tourist completes their Udaipur journey and taps "Finish Trip", the system guides them through a confirmation flow of which places were actually visited vs. skipped. Gemini Flash automatically drafts an engaging trail title, summary, and interest tags. The tourist reviews privacy settings (ensuring private accommodation, GPS tracks, and personal notes are excluded) and publishes their real-world journey as a new Community Trail in one tap.

**Blocked by:** 02: Community Trail Explorer & Stop Basket

**Status:** ready-for-agent

- [ ] "Finish Trip" action in active trip triggers the Trip-to-Trail completion flow.
- [ ] Review screen presents checklist of all planned stops with visited vs skipped status confirmed by tourist.
- [ ] AI draft generation endpoint prompts Gemini Flash to compose a descriptive trail title, markdown overview, estimated budget, and relevant tags from the confirmed visited stops.
- [ ] Privacy review toggles ensure private start locations (hotel/homestay) and user private notes are scrubbed before publishing (`exclude_private_notes: true`).
- [ ] `POST /api/trips/{trip_id}/publish-trail` creates a public `community_trails` record and associated `community_trail_stops` preserving relative durations.
- [ ] Published trail instantly appears in the Community Trail Explorer with the author's name and "Experienced Trail" badge.
