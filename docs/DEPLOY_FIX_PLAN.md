# TrailWeave Free-Tier Deployment Fix Plan

This implementation plan details the four fixes required for deploying TrailWeave strictly on free tiers (Vercel Hobby for frontend, Render Free for backend, and external Supabase DB).

> [!IMPORTANT]
> **No code changes have been made.** This plan identifies the exact files, line numbers, and changes proposed. Implementation will begin only after explicit user approval.

---

## FIX 1 (Blocking) — Standardize Frontend API URL Convention to Bare Origin

### Context & Callers Audit
The frontend currently has divergent expectations for `process.env.NEXT_PUBLIC_API_URL`:
- **Bare Origin expected (`http://localhost:8000` / `https://api.example.com`)**:
  - `frontend/context/AuthContext.tsx` (lines 5, 140, 220, 280, 321): calls `${API_BASE_URL}/api/v1/auth/...` and `${API_BASE_URL}/api/v1/admin/team`
  - `frontend/context/TripContext.tsx` (lines 6, 398, 449, 544, 598, 639, 718, 808): calls `${API_BASE_URL}/api/trips...`
  - `frontend/lib/pushNotifications.ts` (lines 6, 72): calls `${API_BASE_URL}/api/trips/${tripId}/push/subscribe`
  - `frontend/components/trip/UpcomingStopEditor.tsx` (lines 79, 81): calls `${apiUrl}/api/trips/...`
  - `frontend/app/trip/page.tsx` (lines 319, 321): calls `${apiUrl}/api/trips/...`
- **Origin + `/api/v1` expected**:
  - `frontend/app/artisans/onboard/page.tsx` (lines 238, 496, 561, 664, 710): defaults to `"http://localhost:8000/api/v1"` and calls `${apiBase}/artisans/...`
  - `frontend/lib/api.ts` (line 6): defaults to `"http://localhost:8000/api/v1"`. **Callers check**: `fetchFromApi` has **zero callers** across the entire codebase (`grep -rn "fetchFromApi"` returns only the definition).
- **Hardcoded localhost call found during audit**:
  - `frontend/components/trip/TripToTrailModal.tsx` (lines 149, 244): hardcodes `http://localhost:8000/api/v1/trips/...` instead of reading `NEXT_PUBLIC_API_URL`.

### Standardized Decision
Standardize on the **BARE origin** (e.g., `https://api.example.com` or `http://localhost:8000` with no trailing path or slash). Backend mounts every feature router under both `/api` and `/api/v1` (`backend/app/main.py:54-64`), so client callers append their respective `/api/...` or `/api/v1/...` routes.

### Exact Files and Lines to Touch

1. **`frontend/app/artisans/onboard/page.tsx`**:
   - **Line 238**:
     ```ts
     // Replace:
     process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
     // With:
     process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
     ```
   - **Line 496**:
     ```ts
     // Replace:
     const res = await fetch(`${apiBase}/artisans/onboard`, {
     // With:
     const res = await fetch(`${apiBase}/api/v1/artisans/onboard`, {
     ```
   - **Line 561**:
     ```ts
     // Replace:
     const res = await fetch(`${apiBase}/artisans/login`, {
     // With:
     const res = await fetch(`${apiBase}/api/v1/artisans/login`, {
     ```
   - **Line 664**:
     ```ts
     // Replace:
     const res = await fetch(`${apiBase}/artisans/me/catalogue`, {
     // With:
     const res = await fetch(`${apiBase}/api/v1/artisans/me/catalogue`, {
     ```
   - **Line 710**:
     ```ts
     // Replace:
     const res = await fetch(`${apiBase}/artisans/me/catalogue`, {
     // With:
     const res = await fetch(`${apiBase}/api/v1/artisans/me/catalogue`, {
     ```

2. **`frontend/lib/api.ts`**:
   - Align to bare origin standard while remaining safe for future callers:
   - **Line 6**:
     ```ts
     // Replace:
     const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
     // With:
     const rawBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
     const API_BASE_URL = rawBase.replace(/\/+$/, "").endsWith("/api/v1") ? rawBase.replace(/\/+$/, "") : `${rawBase.replace(/\/+$/, "")}/api/v1`;
     ```

3. **`frontend/components/trip/TripToTrailModal.tsx`**:
   - **Lines 149, 244**:
     Replace hardcoded `http://localhost:8000` with `process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"` to prevent production requests from failing on Vercel:
     ```ts
     const apiOrigin = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
     const res = await fetch(`${apiOrigin}/api/v1/trips/${tripId}/draft-trail-content`, ...);
     ...
     const res = await fetch(`${apiOrigin}/api/v1/trips/${tripId}/publish-trail`, ...);
     ```

---

## FIX 2 — Move Hardcoded Auth Secrets to Environment Variables

### Context
`backend/app/core/security.py` lines 34–36 hardcoded:
- `PIN_HASH_SALT`
- `PASSWORD_HASH_SALT`
- `JWT_SECRET_KEY`

These values were public in git history and must never be fallen back to. If unset, the backend must fail fast with a descriptive error.

### Exact Files and Lines to Touch

1. **`backend/app/core/config.py`**:
   - Add fields to `Settings` (around line 22):
     ```python
     JWT_SECRET_KEY: str = ""
     PIN_HASH_SALT: str = ""
     PASSWORD_HASH_SALT: str = ""
     WHATSAPP_VERIFY_TOKEN: str = ""
     ```

2. **`backend/app/core/security.py`**:
   - **Lines 34–37**:
     Remove hardcoded string literals. Import `settings` from `app.core.config` and `os`.
     Define a strict retrieval helper that fails immediately if unset, empty, or using the compromised strings:
     ```python
     import os
     from app.core.config import settings

     _COMPROMISED_SECRET_HASHES = {
         # SHA-256 digests of compromised legacy default secrets from public git history
         "759c144e1e5cbf801a9dac48f363f9011587002f88c27d6e32932fb9186a8a6a",
         "905c94fd7a15ae5a89c35bb055e6dd0908345418887bf835a4ddf8b806acf2dd",
         "dbabc115574ba4538f635df292ad89df59343942a96f5b3c78bf7e51d6b66945",
     }

     def _get_required_secret(name: str) -> str:
         val = (getattr(settings, name, "") or os.environ.get(name, "")).strip()
         if not val:
             raise RuntimeError(
                 f"Critical security configuration missing: '{name}' is not set. "
                 f"Please set '{name}' in your environment or .env file before starting TrailWeave."
             )
         if val in _COMPROMISED_LEGACY_SECRETS:
             raise RuntimeError(
                 f"Critical security configuration error: '{name}' is set to a compromised "
                 f"legacy value from git history. Please generate a new unique secret."
             )
         return val

     PIN_HASH_SALT = _get_required_secret("PIN_HASH_SALT")
     PASSWORD_HASH_SALT = _get_required_secret("PASSWORD_HASH_SALT")
     JWT_SECRET_KEY = _get_required_secret("JWT_SECRET_KEY")
     ```

3. **`.env.example`**:
   - Append placeholder keys with empty values (no real secrets):
     ```bash
     # Authentication & Security Secrets (Required)
     JWT_SECRET_KEY=""
     PIN_HASH_SALT=""
     PASSWORD_HASH_SALT=""

     # Meta WhatsApp Webhook Verification
     WHATSAPP_VERIFY_TOKEN=""
     ```

4. **Local `.env` (gitignored)**:
   - For local development and test execution, add local dummy/dev values to `.env` so local pytest suites run without hardcoded secrets in the repo.

---

## FIX 3 — WhatsApp Webhook Must Verify the Token

### Context
`backend/app/api/v1/whatsapp.py` lines 18–20 currently accept any caller passing `hub.mode == "subscribe"` without validating `hub.verify_token`.

### Exact Files and Lines to Touch

1. **`backend/app/api/v1/whatsapp.py`**:
   - **Line 5**:
     Add `from app.core.config import settings`.
   - **Lines 17–20**:
     Update `verify_whatsapp_webhook`:
     ```python
     @router.get("/whatsapp/webhook")
     async def verify_whatsapp_webhook(
         hub_mode: str = Query(None, alias="hub.mode"),
         hub_verify_token: str = Query(None, alias="hub.verify_token"),
         hub_challenge: str = Query(None, alias="hub.challenge"),
     ):
         """Handles Meta Webhook subscription verification handshake."""
         expected_token = (settings.WHATSAPP_VERIFY_TOKEN or "").strip()
         if not expected_token:
             return Response(content="Verification failed: webhook token unconfigured", status_code=status.HTTP_403_FORBIDDEN)

         if hub_mode == "subscribe" and hub_verify_token == expected_token:
             return Response(content=hub_challenge or "", media_type="text/plain")

         return Response(content="Verification failed", status_code=status.HTTP_403_FORBIDDEN)
     ```

2. **`.env.example`**:
   - `WHATSAPP_VERIFY_TOKEN=""` added alongside the auth secrets in Fix 2.

---

## FIX 4 — Deployment Readiness

### Exact Files to Touch / Create

1. **Create `backend/.python-version`**:
   - File content: `3.11\n`
   - Explicitly instructs Render Free and other platforms to use Python 3.11 runtime.

2. **PWA Missing Icons Flag (No Fake Files Fabricated)**:
   - `frontend/public/manifest.json` (lines 12, 17) and `frontend/public/sw.js` (lines 17, 18) reference `/icon-192.png` and `/icon-512.png`.
   - Neither file exists in `frontend/public/`.
   - **Flag**: Real branded PNG assets for `icon-192.png` (192x192) and `icon-512.png` (512x512) must be provided by the design team / brand owner before production release. Per instructions, placeholder or fabricated images will NOT be generated.

---

## Acceptance & Verification Strategy

After approval, the following automated checks will be executed non-interactively:
1. **Secret Leakage Check**:
   Grep for hardcoded secrets and verify no secret literals exist in tracked files.
2. **Backend Test Suite**:
   `cd backend && pytest tests -c pytest.ini`
3. **Frontend Test Suite & Build**:
   `cd frontend && npm test && npm run build`
4. **Endpoint Checks**:
   - Onboard page fetch URLs validated against `/api/v1/artisans/...`.
   - Webhook rejection tested for invalid/missing token.
