# 12: Admin Curation & Place Verification Portal (/admin)

**What to build:**
A responsive administration and curation dashboard (`/admin`) for the TrailWeave operations team. Curators can review pending artisan voice drafts received via WhatsApp, listen to the original voice note audio, review the Hindi transcript, edit extracted details (e.g. adjust coordinates, workshop fees, or operating hours), and approve drafts with a single tap to publish them into the canonical `places` and `artisans` tables. Additionally, curators can toggle featured community trails and import places using Google Places API search.

**Blocked by:** 01: Project Foundation, Core PostGIS Schema & Udaipur Seed Data, 10: WhatsApp Webhook & Hindi Voice Note Extraction Pipeline

**Status:** ready-for-agent

- [ ] Secure curator dashboard accessible at `/admin`.
- [ ] Artisan Drafts queue displaying unapproved incoming WhatsApp profiles (`approval_status = 'draft'`).
- [ ] Draft detail view with audio playback of voice note, raw Hindi transcript, and side-by-side extracted JSON preview.
- [ ] Interactive form to verify and refine physical studio latitude/longitude, category, opening hours, and workshop fees.
- [ ] 1-tap "Approve & Publish" action that atomically creates verified records in `places` and `artisans` tables and updates draft status to `approved`.
- [ ] "Reject" action with optional internal reason note.
- [ ] Community Trail moderation section to mark high-quality submitted trails as `is_featured = true`.
- [ ] Google Places API integration bar allowing curators to search live Udaipur venues and import verified details into `places`.
