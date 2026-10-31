# 10: Hindi Web Voice Onboarding, 4-Digit PIN & Self-Service Artisan Catalogue

**What to build:**
A zero-barrier, Hindi-first Web/PWA onboarding and self-service catalogue portal (`/artisans/onboard`, reachable via the top `Tourist / कारीगर (Artisan)` role switcher) that allows local Udaipur craftsmen to register their studios using natural Hindi voice notes and manage photos of their work/artifacts. Artisans enter their phone number, set a UPI-style 4-digit numeric PIN (`4-अंकों का पिन`), record a Hindi voice note in the browser (or upload audio / enter text), optionally share 1-tap GPS coordinates, and upload photos of their craft and artifacts (`catalogue_images`). The backend transcribes the voice note using Google Cloud Speech-to-Text V2 (`hi-IN`), discards the raw audio immediately, prompts Gemini Flash to produce an **English Admin Brief**, a **Missing Info Checklist**, and pre-filled structured fields in `artisan_drafts`, and enables returning artisans to log in with their phone number + 4-digit PIN to view their approval status and add or remove photos from their catalogue anytime.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Role switcher (`Tourist` vs. `कारीगर / Artisan`) in the top header and home page directing artisans to `/artisans/onboard`.
- [x] Hindi-first New Onboarding UI (`नया पंजीकरण`) on `/artisans/onboard` with required phone number, 4-digit numeric PIN (`4-अंकों का पिन`), 1-tap Hindi voice recorder (`MediaRecorder` + live browser `hi-IN` speech capture + audio upload + optional text fallback), optional 1-tap GPS location button, and self-service craft/artifact photo upload (`catalogue_images`).
- [x] `POST /api/artisans/onboard` transcribes incoming audio using Google Cloud Speech-to-Text V2 (`hi-IN`) (with live browser transcript hint & deterministic fallback) and immediately discards raw audio bytes (`media_url = NULL`).
- [x] Prompts Gemini Flash to generate `extracted_data` containing:
  - `admin_brief` (concise English summary of the artisan's Hindi message),
  - `missing_info_checklist` (missing details for the Admin to ask when calling the artisan), and
  - Pre-filled structured fields: `artisan_name`, `craft_type`, `place_name`, `address`, `latitude`, `longitude`, `has_workshop` (boolean), `workshop_fee_inr` (numeric), `workshop_duration_minutes` (integer), `workshop_description`, `opening_time`, and `closing_time`.
- [x] Stores the draft in `artisan_drafts` (`approval_status = 'draft'`) with hashed 4-digit PIN and `catalogue_images`, and shows an immediate Hindi/English confirmation card to the artisan.
- [x] Returning Artisan Login (`POST /api/artisans/login`) & Dashboard (`मेरी दुकान / मेरा कैटलॉग`) authenticating via phone number + 4-digit PIN (with persistent device session) to display approval status and allow adding (`POST /api/artisans/me/catalogue`) or removing (`DELETE /api/artisans/me/catalogue`) craft/artifact photos at any time.

---

## Comments

### Implementation Summary (2026-10-31)
1. **Role Switcher (`Tourist` vs. `कारीगर / Artisan`)**:
   - Added a role switcher pill in [`frontend/components/common/Header.tsx`](../../../frontend/components/common/Header.tsx) and a Hindi/English Artisan Portal CTA banner on [`frontend/app/page.tsx`](../../../frontend/app/page.tsx) directing local Udaipur craftsmen to `/artisans/onboard`.
2. **Hindi Web Voice Onboarding & Self-Service Catalogue Portal (`/artisans/onboard`)**:
   - Created [`frontend/app/artisans/onboard/page.tsx`](../../../frontend/app/artisans/onboard/page.tsx) with two modes:
     - **`नया पंजीकरण (New Signup)`**: Phone number, UPI-style 4-digit numeric PIN (`4-अंकों का पिन`), 1-tap Hindi voice recorder (`MediaRecorder` + live browser `hi-IN` `SpeechRecognition` + audio file upload + 1-tap Hindi voice presets + text fallback), 1-tap GPS location button (`अपना वर्तमान स्थान साझा करें`), self-service craft/artifact photo upload (`catalogue_images`), and immediate confirmation card showing the AI-generated English `admin_brief`, `missing_info_checklist`, and extracted studio details.
     - **`मेरी दुकान / मेरा कैटलॉग (Returning Artisan Login & Catalogue Manager)`**: Authenticates via phone number + 4-digit PIN (`POST /api/artisans/login`), persists device session in `localStorage`, displays approval status (`समीक्षाधीन` vs. `स्वीकृत और लाइव`), and allows adding (`POST /api/artisans/me/catalogue`) and deleting (`DELETE /api/artisans/me/catalogue`) craft/artifact photos at any time.
3. **Backend Services, Security & API Endpoints**:
   - Implemented PBKDF2-HMAC-SHA256 4-digit PIN hashing (`hash_pin`, `verify_pin`) and E.164 phone normalization in [`backend/app/core/security.py`](../../../backend/app/core/security.py).
   - Implemented `SpeechToTextService` (`hi-IN`) in [`backend/app/services/stt.py`](../../../backend/app/core/security.py) that transcribes audio and immediately discards raw audio bytes (`media_url = NULL`).
   - Implemented `GeminiArtisanExtractionService` in [`backend/app/services/gemini.py`](../../../backend/app/services/gemini.py) to generate `admin_brief`, `missing_info_checklist`, and pre-filled structured studio fields from Hindi voice transcripts (with deterministic Hindi/Hinglish fallback).
   - Added `POST /api/artisans/onboard`, `POST /api/artisans/login`, `POST /api/artisans/me/catalogue`, and `DELETE /api/artisans/me/catalogue` in [`backend/app/api/v1/artisans.py`](../../../backend/app/api/v1/artisans.py) and updated [`backend/app/db/schema.sql`](../../../backend/app/db/schema.sql).
4. **Verification**:
   - Verified with [`backend/tests/test_artisan_onboarding.py`](../../../backend/tests/test_artisan_onboarding.py) and [`frontend/tests/artisan_onboarding.test.mjs`](../../../frontend/tests/artisan_onboarding.test.mjs) + `npx tsc --noEmit` (all 12 frontend tests and backend tests passing).
