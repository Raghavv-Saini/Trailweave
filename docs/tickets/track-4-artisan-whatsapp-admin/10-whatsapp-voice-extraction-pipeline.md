# 10: WhatsApp Webhook & Hindi Voice Note Extraction Pipeline

**What to build:**
A zero-barrier artisan onboarding pipeline that allows local Udaipur craftsmen to register their studios using natural Hindi voice notes or text on WhatsApp. The service ingests WhatsApp webhook payloads via Meta Cloud API, transcribes voice notes with Google Cloud Speech-to-Text V2 (`hi-IN`), extracts structured workshop data using Gemini Flash, records an unapproved draft in `artisan_drafts`, and automatically sends a friendly Hindi WhatsApp confirmation reply back to the artisan.

**Blocked by:** None (can start immediately with Meta Webhook + Google STT + Gemini Flash configuration)

**Status:** ready-for-agent

- [ ] `GET /api/whatsapp/webhook` implements Meta challenge token verification (`hub.mode`, `hub.verify_token`, `hub.challenge`).
- [ ] `POST /api/whatsapp/webhook` securely receives inbound WhatsApp messages and audio notes.
- [ ] Downloads incoming audio media file via Meta Graph API.
- [ ] Transcribes audio using Google Cloud Speech-to-Text V2 with Hindi (`hi-IN`) model.
- [ ] Prompts Gemini Flash to extract typed JSON fields: `artisan_name`, `craft_type`, `address`, `has_workshop` (boolean), `workshop_fee_inr` (numeric), `workshop_duration_minutes` (integer), `workshop_description`, `opening_time`, and `closing_time`.
- [ ] Stores extraction result in `artisan_drafts` table with `approval_status = 'draft'` and links raw transcript and media URL.
- [ ] Sends automated WhatsApp reply message in Hindi confirming received details and asking the artisan to confirm (हाँ / नहीं).
- [ ] Fallback handling for incoming typed text messages skipping the STT step.
