# 13: End-to-End Hackathon Demo Flow & Simulated Signals Verification

**What to build:**
Comprehensive end-to-end integration and demonstration harness designed specifically for the 4-minute presentation at the Aravalli Build Championship. It links all 4 developer streams, provides simulation toggles (such as simulated venue closure and crowd surges) clearly badged as `SIMULATED`, and runs through the complete script: User A contributes a finished trail -> User B discovers and mixes stops -> Trip Builder optimizes with an artisan studio -> User B navigates the active trip with manual check-in fallback -> User B executes manual edits (Revision 2) -> User B adapts via AI companion (Revision 3) -> User B publishes derivative trail -> Artisan completes WhatsApp voice onboarding.

**Blocked by:** 03: Trip-to-Trail Contribution & Privacy-Aware Publishing, 08: Upcoming Stop Manual Editor (View / Edit Mode), 09: AI Travel Companion & Web Push Transition Notifications, 12: Admin Curation & Place Verification Portal (/admin)

**Status:** ready-for-agent

- [ ] End-to-end scripted demo flow verified across mobile viewport and admin portal within the 4-minute time limit.
- [ ] Admin / Demo toolbar toggle to trigger simulated signals (`SIMULATED` badge displayed on UI):
  - Simulated temple temporary closing / crowd delay.
  - GPS alleyway drift simulation demonstrating 1-tap **Manual Check-in Fallback**.
  - Missed checkout simulation demonstrating 20-minute grace buffer auto-resolution.
- [ ] Concurrency test verifying that concurrent updates on the same trip revision cleanly return `HTTP 409 Conflict`.
- [ ] Live WhatsApp voice note playback and automated transcription -> extraction -> approval workflow demo ready.
- [ ] Complete cross-browser mobile responsive layout verified on iOS Safari and Android Chrome PWAs.
- [ ] Integration smoke test suite passes verifying health of all primary API endpoints.
