# 10. Pivot to Hindi Web Voice Artisan Onboarding, Self-Service Catalogue & Full Admin Contact Directory

Date: 2026-10-31
Status: Accepted
Supersedes: WhatsApp Business API sections of [ADR 0001](0001-trailweave-architecture.md), [ADR 0002](0002-pivot-to-user-curated-itineraries.md), and [ADR 0006](0006-artisan-workshop-offerings-and-tourist-preferences.md)

---

## Context

In the initial TrailWeave specification (ADR 0001, ADR 0006), local Udaipur artisans were expected to onboard via the Meta WhatsApp Cloud API by sending Hindi voice notes to a WhatsApp Business number.

During implementation, three practical constraints emerged:
1. **Meta Business Account Barrier**: The Meta WhatsApp Cloud API requires a verified Meta Business Account and approved phone number provisioning, which blocks zero-friction deployment and live hackathon onboarding.
2. **Artisan Catalogue & Artifact Visuals**: Craftsmen need to showcase visual photos of their work and artifacts (`catalogue_images`) to tourists and need the ability to add or remove photos later through their own simple Hindi interface without relying on an admin to manage their photos.
3. **Admin Brief & Direct Phone Follow-Up**: Rather than relying on an automated multi-turn WhatsApp bot to interrogate the artisan, the operations curator in `/admin` needs a concise **English Admin Brief** + **Missing Info Checklist** extracted from the artisan's Hindi voice note, alongside the artisan's phone number and a **1-tap Call (`tel:`)** action so the admin can speak with the artisan directly, verify details, and view all onboarded artisans' complete profiles and contact numbers in one place.

---

## Decision

We replace the Meta WhatsApp Cloud API webhook pipeline with a **Hindi-First Web/PWA Voice Onboarding & Self-Service Catalogue Portal (`/artisans/onboard`)** paired with an **Admin Brief & Contact Directory (`/admin`)**:

### 1. Role Split at App Entry / Header (`Tourist` vs. `कारीगर / Artisan`)
- The top navigation header and home screen provide an explicit role switch between **Tourist** and **Artisan (`कारीगर`)**.
- **Tourist Mode**: Retains the public **Artisan Studio Directory (`/artisans`)**, where tourists browse verified studios, view the artisan's uploaded craft/artifact photo gallery (`catalogue_images`), and add retail visits or hands-on workshops to their itinerary.
- **Artisan Mode (`/artisans/onboard`)**: Launches a mobile-first, **Hindi-primary Artisan Portal** with two modes:
  1. **नया पंजीकरण (New Voice Onboarding & Signup)**
  2. **मेरी दुकान / मेरा कैटलॉग (Returning Artisan Login & Catalogue Manager)**

### 2. Hindi Voice Onboarding + UPI-Style 4-Digit PIN (`POST /api/artisans/onboard`)
- **Credentials**: Artisans register with their **Phone Number (`phone_number`)** and a **4-Digit Numeric PIN (`4-अंकों का पिन`)** familiar from UPI/mobile banking in India, eliminating complex English password requirements and paid SMS OTP gateways.
- **1-Tap Hindi Voice Note**: Artisans record a Hindi voice note directly in the browser (or upload an audio file / type optional Hindi text), optionally tap **"अपना वर्तमान स्थान साझा करें" (Share Current GPS Location)**, and optionally pick/snap **photos of their work and artifacts (`catalogue_images`)**.
- **Google Cloud Speech-to-Text (`hi-IN`) & Audio Privacy**: The backend transcribes the Hindi audio via Google Cloud Speech-to-Text (`hi-IN`) (with live browser `hi-IN` speech capture + deterministic fallback when cloud credentials are not configured) and **immediately discards the raw audio bytes** after transcription (`media_url = NULL`).
- **Gemini Flash Admin Brief & Field Extraction**: Gemini Flash processes the Hindi transcript and populates `artisan_drafts.extracted_data` with:
  - `admin_brief`: A concise 2–3 sentence English summary of the artisan's Hindi message.
  - `missing_info_checklist`: Specific missing details the Admin should ask for when calling the artisan.
  - Pre-filled structured fields (`artisan_name`, `craft_type`, `place_name`, `address`, `latitude`, `longitude`, `has_workshop`, `workshop_fee_inr`, `workshop_duration_minutes`, `workshop_description`, `opening_time`, `closing_time`).

### 3. Self-Service Artisan Catalogue Management (`POST /api/artisans/login`, `POST/DELETE /api/artisans/me/catalogue`)
- Returning artisans log in using their **Phone Number + 4-Digit PIN** (or resume their saved device session).
- Their dashboard is strictly focused on:
  1. Viewing their current **Verification / Approval Status** (`समीक्षाधीन / Under Review` vs. `स्वीकृत और लाइव / Approved & Live`).
  2. **Adding or removing photos** of their craft and artifacts (`catalogue_images`) at any time.
- Admins do not upload or delete artisan catalogue photos; photo curation belongs to the artisan.

### 4. Comprehensive Admin Curation & Contact Portal (`/admin`)
- **Voice Onboarding Drafts Queue**: Displays incoming `artisan_drafts` with the **English Admin Brief**, **Missing Info Checklist**, **Raw Hindi Transcript**, a read-only preview of the artisan's uploaded catalogue photos, a **1-Tap Call (`tel:{sender_phone}`) button**, an editable verification form, and **1-Tap Approve & Publish** / **Reject** actions.
- **All Artisans & Contact Info Directory (`GET /api/admin/artisans`, `PATCH /api/admin/artisans/{id}`)**: Allows the Admin to view **all information for every artisan**—including phone numbers with 1-tap `tel:` call links, craft type, studio address, coordinates, opening/closing hours, workshop pricing/duration, bio, status, and catalogue photos—and update any artisan's operational metadata after speaking with them.
- **Places & Community Trails Curation**: Provides toggles for featuring community trails (`PATCH /api/admin/trails/{id}/feature`) and importing verified Udaipur places (`POST /api/admin/places`).

---

## Consequences

- **Positive**: Zero dependency on Meta Business verification or third-party messaging webhooks; works immediately on any mobile browser in Hindi.
- **Positive**: Artisans have full self-service control over their craft/artifact photo catalogue (`catalogue_images`) via a low-friction 4-digit PIN.
- **Positive**: Admins receive an actionable English brief + missing-info checklist and can call any pending or approved artisan with 1 tap (`tel:`).
- **Trade-off**: Requires artisans to open the mobile web onboarding page (`/artisans/onboard`) rather than sending a message inside WhatsApp, mitigated by making the entire onboarding UI Hindi-first with 1-tap voice recording and UPI-style 4-digit PIN login.
