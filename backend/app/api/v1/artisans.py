"""
Track 2 & Track 4: Artisan Studio Directory, Hindi Web Voice Onboarding,
4-Digit PIN Auth, Self-Service Catalogue & Recommendation Endpoints.
Spec: docs/API_SPEC.md §1.2, §1.3 & §1.5, ADR 0009, ADR 0010
Tickets: 06, 10, 11
"""
import json
import uuid
import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Body, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.core.database import get_db
from app.core.security import (
    normalize_phone_number,
    validate_four_digit_pin,
    hash_pin,
    verify_pin,
)
from app.schemas.artisans import (
    ArtisanResponse,
    ArtisanOnboardRequest,
    ArtisanLoginRequest,
    ArtisanCatalogueAddRequest,
    ArtisanCatalogueDeleteRequest,
    ArtisanPortalProfileResponse,
    ArtisanRecommendationResponse,
    ArtisanRecommendationItem,
    TransientArtisanRecommendationRequest,
)
from app.services.stt import SpeechToTextService
from app.services.gemini import GeminiArtisanExtractionService
from app.engine.artisan_scorer import ArtisanRecommendationScorer

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Artisan Directory, Voice Onboarding & Recommendations"])

# In-memory store synced with PostgreSQL so tests & demo mode work seamlessly
IN_MEMORY_ARTISAN_DRAFTS: Dict[str, Dict[str, Any]] = {
    "draft_shankar_demo": {
        "id": "draft_shankar_demo",
        "submission_id": "sub_shankar_demo",
        "source_type": "draft",
        "approval_status": "draft",
        "sender_phone": "+919829099887",
        "media_url": None,
        "raw_transcript": (
            "नमस्ते, मैं शंकर लाल कुम्हार हूँ। मेरी टेराकोटा पॉटरी की दुकान हाथीपोल में है। "
            "हम 45 मिनट की वर्कशॉप कराते हैं जिसकी फीस 250 रुपये है।"
        ),
        "extracted_data": {
            "artisan_name": "Shankar Lal Kumhar",
            "craft_type": "Terracotta Pottery & Clay Sculpting",
            "place_name": "Shankar Lal Terracotta Pottery Studio",
            "address": "Hathi Pole Bazaar, Old City, Udaipur",
            "latitude": 24.5840,
            "longitude": 73.6865,
            "has_workshop": True,
            "workshop_fee_inr": 250.0,
            "workshop_duration_minutes": 45,
            "workshop_description": "Hands-on 45-minute terracotta pottery workshop with Shankar Lal Kumhar in Hathi Pole Bazaar.",
            "opening_time": "10:00",
            "closing_time": "19:30",
            "admin_brief": (
                "Artisan Shankar Lal Kumhar runs a Terracotta Pottery & Clay Sculpting studio "
                "in Hathi Pole Bazaar offering a 45-minute hands-on workshop for ₹250."
            ),
            "missing_info_checklist": [
                "Confirm daily opening and closing hours"
            ],
            "pin_hash": hash_pin("1234"),
            "catalogue_images": [
                "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=900&q=80",
                "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=900&q=80",
            ],
        },
    }
}

IN_MEMORY_APPROVED_ARTISANS: Dict[str, Dict[str, Any]] = {
    "artisan_mohanlal": {
        "id": "artisan_mohanlal",
        "place_id": "place_mohanlal_studio",
        "source_type": "artisan",
        "approval_status": "approved",
        "artisan_name": "Master Mohanlal Sharma",
        "craft_type": "Pichwai & Miniature Painting",
        "phone_number": "+919829012345",
        "place_name": "Master Mohanlal Miniature Art Studio",
        "address": "14 Jagdish Chowk, Old City, Udaipur, Rajasthan 313001",
        "latitude": 24.5796,
        "longitude": 73.6844,
        "bio": "4th generation Udaipur miniature artist specializing in natural stone pigments and squirrel-hair brushes.",
        "has_workshop": True,
        "workshop_fee_inr": 300.0,
        "workshop_duration_minutes": 45,
        "workshop_description": "Hands-on miniature painting masterclass on handmade vintage paper.",
        "opening_time": "10:00",
        "closing_time": "20:00",
        "admin_brief": "Approved 4th-generation miniature artist at 14 Jagdish Chowk offering 45-minute Wasli painting workshops for ₹300.",
        "missing_info_checklist": [],
        "raw_transcript": "नमस्ते, मैं मास्टर मोहनलाल हूँ। मेरी दुकान जगदीश चौक में है। हम 400 साल पुरानी पिछवाई और लघु चित्रकारी सिखाते हैं।",
        "pin_hash": hash_pin("1234"),
        "catalogue_images": [
            "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=900&q=80",
            "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=900&q=80",
        ],
    },
    "artisan_pottery": {
        "id": "artisan_pottery",
        "place_id": "place_pottery_studio",
        "source_type": "artisan",
        "approval_status": "approved",
        "artisan_name": "Master Kavita Kumhar",
        "craft_type": "Terracotta Pottery & Clay Sculpting",
        "phone_number": "+919829023456",
        "place_name": "Kavita Terracotta Pottery & Clay Studio",
        "address": "22 Chandpole Ghat Road, Old City, Udaipur, Rajasthan 313001",
        "latitude": 24.5815,
        "longitude": 73.6820,
        "bio": "Renowned Mewar potter crafting heritage earthenware and terracotta votive plaques.",
        "has_workshop": True,
        "workshop_fee_inr": 250.0,
        "workshop_duration_minutes": 45,
        "workshop_description": "Wheel throwing and traditional Mewar terracotta clay sculpting masterclass.",
        "opening_time": "09:30",
        "closing_time": "19:30",
        "admin_brief": "Approved Molela terracotta potter on Chandpole Ghat Road offering 45-minute wheel pottery sessions for ₹250.",
        "missing_info_checklist": [],
        "raw_transcript": "नमस्ते, मैं कविता कुम्हार हूँ। चांदपोल घाट रोड पर हमारा टेराकोटा पॉटरी स्टूडियो है।",
        "pin_hash": hash_pin("1234"),
        "catalogue_images": [
            "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=900&q=80",
            "https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=900&q=80",
        ],
    },
    "artisan_puppetry": {
        "id": "artisan_puppetry",
        "place_id": "place_puppetry_workshop",
        "source_type": "artisan",
        "approval_status": "approved",
        "artisan_name": "Babu Bhatt Puppeteer",
        "craft_type": "Kathputli Traditional String Puppetry",
        "phone_number": "+919829034567",
        "place_name": "Udaipur Traditional Kathputli Puppetry Workshop",
        "address": "Gangaur Ghat Road, Old City, Udaipur, Rajasthan 313001",
        "latitude": 24.5788,
        "longitude": 73.6815,
        "bio": "Master puppeteer preserving 1,000-year-old Rajasthani wooden string puppet theater traditions.",
        "has_workshop": True,
        "workshop_fee_inr": 200.0,
        "workshop_duration_minutes": 45,
        "workshop_description": "Learn string manipulation, carving, and live traditional Rajasthani puppet theater storytelling.",
        "opening_time": "10:00",
        "closing_time": "19:00",
        "admin_brief": "Approved Kathputli puppeteer on Gangaur Ghat Road offering 45-minute string puppetry workshops for ₹200.",
        "missing_info_checklist": [],
        "raw_transcript": "नमस्ते, मैं बाबू भट्ट हूँ। गणगौर घाट रोड पर हमारा कठपुतली वर्कशॉप है।",
        "pin_hash": hash_pin("1234"),
        "catalogue_images": [
            "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=900&q=80",
        ],
    },
    "artisan_leather": {
        "id": "artisan_leather",
        "place_id": "place_leather_craft",
        "source_type": "artisan",
        "approval_status": "approved",
        "artisan_name": "Ramesh Chandra Parmar",
        "craft_type": "Handcrafted Camel Leather & Mojari Juttis",
        "phone_number": "+919829045678",
        "place_name": "Mewar Royal Leather & Jutti Craft Studio",
        "address": "Hathi Pole Bazaar, Udaipur, Rajasthan 313001",
        "latitude": 24.5840,
        "longitude": 73.6865,
        "bio": "Heritage cobbler and artisan crafting durable vegetable-tanned camel leather juttis with silk embroidery.",
        "has_workshop": False,
        "workshop_fee_inr": 0.0,
        "workshop_duration_minutes": 20,
        "workshop_description": "Browse master leather embroidery and hand-stitching techniques.",
        "opening_time": "10:30",
        "closing_time": "20:30",
        "admin_brief": "Approved camel leather & Mojari jutti studio in Hathi Pole Bazaar.",
        "missing_info_checklist": [],
        "raw_transcript": "नमस्ते, मैं रमेश चंद्र परमार हूँ। हाथीपोल बाजार में हमारी चमड़े की मोजड़ी और डायरी की दुकान है।",
        "pin_hash": hash_pin("1234"),
        "catalogue_images": [
            "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=900&q=80",
        ],
    },
}


def _parse_json_list(val: Any) -> List[str]:
    if isinstance(val, list):
        return [str(x) for x in val if x]
    if isinstance(val, str) and val.strip():
        try:
            parsed = json.loads(val)
            if isinstance(parsed, list):
                return [str(x) for x in parsed if x]
        except Exception:
            pass
    return []


def _parse_json_dict(val: Any) -> Dict[str, Any]:
    if isinstance(val, dict):
        return dict(val)
    if isinstance(val, str) and val.strip():
        try:
            parsed = json.loads(val)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass
    return {}


def _build_portal_response_from_draft(
    draft_id: str,
    sender_phone: str,
    approval_status: str,
    raw_transcript: Optional[str],
    extracted: Dict[str, Any],
) -> ArtisanPortalProfileResponse:
    return ArtisanPortalProfileResponse(
        id=draft_id,
        source_type="draft",
        approval_status=approval_status or "draft",
        artisan_name=extracted.get("artisan_name") or "Master Artisan",
        craft_type=extracted.get("craft_type") or "Traditional Mewar Craft",
        phone_number=sender_phone,
        place_name=extracted.get("place_name"),
        address=extracted.get("address") or "Old City, Udaipur",
        latitude=float(extracted["latitude"]) if extracted.get("latitude") is not None else 24.5796,
        longitude=float(extracted["longitude"]) if extracted.get("longitude") is not None else 73.6844,
        has_workshop=bool(extracted.get("has_workshop", False)),
        workshop_fee_inr=float(extracted.get("workshop_fee_inr") or 0.0),
        workshop_duration_minutes=int(extracted.get("workshop_duration_minutes") or 45),
        workshop_description=extracted.get("workshop_description"),
        opening_time=extracted.get("opening_time") or "10:00",
        closing_time=extracted.get("closing_time") or "19:30",
        admin_brief=extracted.get("admin_brief"),
        missing_info_checklist=_parse_json_list(extracted.get("missing_info_checklist")),
        raw_transcript=raw_transcript,
        catalogue_images=_parse_json_list(extracted.get("catalogue_images")),
    )


async def _find_artisan_or_draft_by_phone(
    phone_norm: str,
    db: Optional[AsyncSession]
) -> Optional[Dict[str, Any]]:
    """
    Looks up an artisan account by normalized phone number across:
    1. Approved `artisans` table in PostgreSQL
    2. `artisan_drafts` table in PostgreSQL
    3. In-memory draft and approved artisan fallback stores
    """
    # 1. Check PostgreSQL artisans & artisan_drafts if db session is available
    if db is not None:
        try:
            art_res = await db.execute(
                text("""
                    SELECT a.*, p.name AS place_name, p.address, p.latitude, p.longitude,
                           p.opening_time, p.closing_time
                    FROM artisans a
                    LEFT JOIN places p ON a.place_id = p.id
                    WHERE a.phone_number = :phone
                    ORDER BY a.created_at DESC
                    LIMIT 1
                """),
                {"phone": phone_norm}
            )
            r = art_res.fetchone()
            if r is not None:
                row_map = dict(r._mapping)
                cat_imgs = _parse_json_list(row_map.get("catalogue_images"))
                if not cat_imgs and row_map.get("id") in IN_MEMORY_APPROVED_ARTISANS:
                    cat_imgs = IN_MEMORY_APPROVED_ARTISANS[row_map["id"]]["catalogue_images"]
                return {
                    "record_kind": "db_artisan",
                    "id": row_map["id"],
                    "source_type": "artisan",
                    "approval_status": row_map.get("profile_status") or "approved",
                    "artisan_name": row_map["artisan_name"],
                    "craft_type": row_map["craft_type"],
                    "phone_number": row_map.get("phone_number") or phone_norm,
                    "place_name": row_map.get("place_name") or f"{row_map['artisan_name']} Studio",
                    "address": row_map.get("address") or "Old City, Udaipur",
                    "latitude": float(row_map["latitude"]) if row_map.get("latitude") is not None else 24.5796,
                    "longitude": float(row_map["longitude"]) if row_map.get("longitude") is not None else 73.6844,
                    "has_workshop": bool(row_map.get("has_workshop", False)),
                    "workshop_fee_inr": float(row_map.get("workshop_fee_inr") or 0.0),
                    "workshop_duration_minutes": int(row_map.get("workshop_duration_minutes") or 45),
                    "workshop_description": row_map.get("workshop_description"),
                    "opening_time": str(row_map["opening_time"])[:5] if row_map.get("opening_time") else "10:00",
                    "closing_time": str(row_map["closing_time"])[:5] if row_map.get("closing_time") else "19:30",
                    "admin_brief": f"Verified studio of {row_map['artisan_name']} ({row_map['craft_type']}).",
                    "missing_info_checklist": [],
                    "raw_transcript": None,
                    "pin_hash": row_map.get("pin_hash"),
                    "catalogue_images": cat_imgs,
                }
        except Exception as e:
            logger.debug("DB artisan lookup skipped/fallback: %s", e)

        try:
            draft_res = await db.execute(
                text("""
                    SELECT * FROM artisan_drafts
                    WHERE sender_phone = :phone
                    ORDER BY created_at DESC
                    LIMIT 1
                """),
                {"phone": phone_norm}
            )
            dr = draft_res.fetchone()
            if dr is not None:
                d_map = dict(dr._mapping)
                ext = _parse_json_dict(d_map.get("extracted_data"))
                return {
                    "record_kind": "db_draft",
                    "id": d_map["id"],
                    "source_type": "draft",
                    "approval_status": d_map.get("approval_status") or "draft",
                    "artisan_name": ext.get("artisan_name") or "Master Artisan",
                    "craft_type": ext.get("craft_type") or "Traditional Mewar Craft",
                    "phone_number": d_map.get("sender_phone") or phone_norm,
                    "place_name": ext.get("place_name"),
                    "address": ext.get("address") or "Old City, Udaipur",
                    "latitude": float(ext["latitude"]) if ext.get("latitude") is not None else 24.5796,
                    "longitude": float(ext["longitude"]) if ext.get("longitude") is not None else 73.6844,
                    "has_workshop": bool(ext.get("has_workshop", False)),
                    "workshop_fee_inr": float(ext.get("workshop_fee_inr") or 0.0),
                    "workshop_duration_minutes": int(ext.get("workshop_duration_minutes") or 45),
                    "workshop_description": ext.get("workshop_description"),
                    "opening_time": ext.get("opening_time") or "10:00",
                    "closing_time": ext.get("closing_time") or "19:30",
                    "admin_brief": ext.get("admin_brief"),
                    "missing_info_checklist": _parse_json_list(ext.get("missing_info_checklist")),
                    "raw_transcript": d_map.get("raw_transcript"),
                    "pin_hash": ext.get("pin_hash"),
                    "catalogue_images": _parse_json_list(ext.get("catalogue_images")),
                    "extracted_data": ext,
                }
        except Exception as e:
            logger.debug("DB draft lookup skipped/fallback: %s", e)

    # 2. Check in-memory drafts (most recent first)
    for draft_id, d in reversed(list(IN_MEMORY_ARTISAN_DRAFTS.items())):
        if normalize_phone_number(d.get("sender_phone", "")) == phone_norm:
            ext = d.get("extracted_data") or {}
            return {
                "record_kind": "mem_draft",
                "id": draft_id,
                "source_type": "draft",
                "approval_status": d.get("approval_status") or "draft",
                "artisan_name": ext.get("artisan_name") or "Master Artisan",
                "craft_type": ext.get("craft_type") or "Traditional Mewar Craft",
                "phone_number": phone_norm,
                "place_name": ext.get("place_name"),
                "address": ext.get("address") or "Old City, Udaipur",
                "latitude": float(ext["latitude"]) if ext.get("latitude") is not None else 24.5796,
                "longitude": float(ext["longitude"]) if ext.get("longitude") is not None else 73.6844,
                "has_workshop": bool(ext.get("has_workshop", False)),
                "workshop_fee_inr": float(ext.get("workshop_fee_inr") or 0.0),
                "workshop_duration_minutes": int(ext.get("workshop_duration_minutes") or 45),
                "workshop_description": ext.get("workshop_description"),
                "opening_time": ext.get("opening_time") or "10:00",
                "closing_time": ext.get("closing_time") or "19:30",
                "admin_brief": ext.get("admin_brief"),
                "missing_info_checklist": _parse_json_list(ext.get("missing_info_checklist")),
                "raw_transcript": d.get("raw_transcript"),
                "pin_hash": ext.get("pin_hash"),
                "catalogue_images": _parse_json_list(ext.get("catalogue_images")),
                "extracted_data": ext,
            }

    # 3. Check in-memory approved artisans
    for art_id, a in IN_MEMORY_APPROVED_ARTISANS.items():
        if normalize_phone_number(a.get("phone_number", "")) == phone_norm:
            return {
                "record_kind": "mem_artisan",
                **a,
            }

    return None


@router.post(
    "/artisans/onboard",
    response_model=ArtisanPortalProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
async def onboard_artisan_voice(
    body: ArtisanOnboardRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Track 4 (Ticket 10 & ADR 0010):
    Ingests a Hindi voice submission from /artisans/onboard along with the artisan's phone number,
    a 4-digit numeric PIN (4-अंकों का पिन), optional GPS coordinates, and optional self-uploaded
    craft/artifact photos (catalogue_images).
    1. Transcribes Hindi audio via Google Cloud Speech-to-Text (`hi-IN`) and immediately discards raw audio bytes.
    2. Prompts Gemini Flash to generate an English Admin Brief, Missing Info Checklist, and pre-filled fields.
    3. Stores the draft in `artisan_drafts` with `media_url = NULL`, hashed 4-digit PIN, and `catalogue_images`.
    """
    phone_norm = normalize_phone_number(body.phone_number)
    if not phone_norm or len(phone_norm) < 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a valid phone number (कृपया सही फ़ोन नंबर दर्ज करें)."
        )

    pin_hash_val = hash_pin(body.pin)

    # Step 1: Transcribe Hindi audio via STT (hi-IN) and immediately discard raw audio bytes
    stt_service = SpeechToTextService()
    raw_transcript = await stt_service.transcribe_base64_audio(
        audio_base64=body.audio_base64,
        transcript_hint=body.transcript_hint,
        text_message=body.text_message,
    )
    # Privacy guardrail: immediately clear audio payload reference
    body.audio_base64 = None

    # Step 2: Gemini Flash Admin Brief + Missing Info Checklist + Structured Field Extraction
    extractor = GeminiArtisanExtractionService()
    extracted_fields = await extractor.extract_onboarding_draft(
        raw_transcript=raw_transcript,
        latitude=body.latitude,
        longitude=body.longitude,
    )

    cleaned_images = [img.strip() for img in (body.catalogue_images or []) if img and img.strip()]

    extracted_data: Dict[str, Any] = {
        **extracted_fields,
        "pin_hash": pin_hash_val,
        "catalogue_images": cleaned_images,
    }

    draft_id = f"draft_{uuid.uuid4().hex[:8]}"
    submission_id = f"sub_{uuid.uuid4().hex[:10]}"

    # Save in-memory record first (guarantees availability in both DB and non-DB test environments)
    IN_MEMORY_ARTISAN_DRAFTS[draft_id] = {
        "id": draft_id,
        "submission_id": submission_id,
        "source_type": "draft",
        "approval_status": "draft",
        "sender_phone": phone_norm,
        "media_url": None,  # Raw audio discarded immediately per ADR 0010
        "raw_transcript": raw_transcript,
        "extracted_data": extracted_data,
    }

    # Step 3: Persist in PostgreSQL `artisan_drafts` with media_url = NULL
    try:
        await db.execute(
            text("""
                INSERT INTO artisan_drafts (
                    id, submission_id, sender_phone, media_url,
                    raw_transcript, extracted_data, approval_status
                ) VALUES (
                    :id, :submission_id, :sender_phone, NULL,
                    :raw_transcript, CAST(:extracted_data AS jsonb), 'draft'
                )
            """),
            {
                "id": draft_id,
                "submission_id": submission_id,
                "sender_phone": phone_norm,
                "raw_transcript": raw_transcript,
                "extracted_data": json.dumps(extracted_data),
            },
        )
        await db.commit()
    except Exception as e:
        logger.warning("Database insert into artisan_drafts fell back to in-memory store: %s", e)
        try:
            await db.rollback()
        except Exception:
            pass

    return _build_portal_response_from_draft(
        draft_id=draft_id,
        sender_phone=phone_norm,
        approval_status="draft",
        raw_transcript=raw_transcript,
        extracted=extracted_data,
    )


@router.post("/artisans/login", response_model=ArtisanPortalProfileResponse)
async def login_artisan_portal(
    body: ArtisanLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticates a returning artisan using their `phone_number` and 4-digit `pin`
    against either approved `artisans` or pending `artisan_drafts`.
    """
    phone_norm = normalize_phone_number(body.phone_number)
    if not phone_norm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number is required."
        )
    validate_four_digit_pin(body.pin)

    record = await _find_artisan_or_draft_by_phone(phone_norm, db)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="इस फ़ोन नंबर से कोई कारीगर खाता नहीं मिला (No artisan account or draft found for this phone number)."
        )

    if not verify_pin(body.pin, record.get("pin_hash")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="गलत 4-अंकों का पिन (Invalid 4-digit PIN)."
        )

    return ArtisanPortalProfileResponse(
        id=record["id"],
        source_type=record["source_type"],
        approval_status=record["approval_status"],
        artisan_name=record["artisan_name"],
        craft_type=record["craft_type"],
        phone_number=record["phone_number"],
        place_name=record.get("place_name"),
        address=record.get("address"),
        latitude=record.get("latitude"),
        longitude=record.get("longitude"),
        has_workshop=record.get("has_workshop", False),
        workshop_fee_inr=record.get("workshop_fee_inr", 0.0),
        workshop_duration_minutes=record.get("workshop_duration_minutes", 45),
        workshop_description=record.get("workshop_description"),
        opening_time=record.get("opening_time") or "10:00",
        closing_time=record.get("closing_time") or "19:30",
        admin_brief=record.get("admin_brief"),
        missing_info_checklist=record.get("missing_info_checklist", []),
        raw_transcript=record.get("raw_transcript"),
        catalogue_images=record.get("catalogue_images", []),
    )


async def _update_record_catalogue_images(
    record: Dict[str, Any],
    updated_images: List[str],
    db: Optional[AsyncSession],
) -> None:
    """Persists updated `catalogue_images` across PostgreSQL and in-memory stores."""
    rec_id = record["id"]
    phone_norm = normalize_phone_number(record["phone_number"])

    # Update in-memory stores
    if rec_id in IN_MEMORY_ARTISAN_DRAFTS:
        IN_MEMORY_ARTISAN_DRAFTS[rec_id].setdefault("extracted_data", {})["catalogue_images"] = updated_images
    for d in IN_MEMORY_ARTISAN_DRAFTS.values():
        if normalize_phone_number(d.get("sender_phone", "")) == phone_norm:
            d.setdefault("extracted_data", {})["catalogue_images"] = updated_images

    if rec_id in IN_MEMORY_APPROVED_ARTISANS:
        IN_MEMORY_APPROVED_ARTISANS[rec_id]["catalogue_images"] = updated_images
    for a in IN_MEMORY_APPROVED_ARTISANS.values():
        if normalize_phone_number(a.get("phone_number", "")) == phone_norm:
            a["catalogue_images"] = updated_images

    if db is not None:
        if record["source_type"] == "artisan":
            try:
                await db.execute(
                    text("""
                        UPDATE artisans
                        SET catalogue_images = CAST(:imgs AS jsonb)
                        WHERE id = :id
                    """),
                    {"id": rec_id, "imgs": json.dumps(updated_images)},
                )
                await db.commit()
            except Exception as e:
                logger.debug("DB artisan catalogue update fallback: %s", e)
                try:
                    await db.rollback()
                except Exception:
                    pass
        else:
            ext = dict(record.get("extracted_data") or {})
            ext["catalogue_images"] = updated_images
            try:
                await db.execute(
                    text("""
                        UPDATE artisan_drafts
                        SET extracted_data = CAST(:ext AS jsonb)
                        WHERE id = :id
                    """),
                    {"id": rec_id, "ext": json.dumps(ext)},
                )
                await db.commit()
            except Exception as e:
                logger.debug("DB draft catalogue update fallback: %s", e)
                try:
                    await db.rollback()
                except Exception:
                    pass


@router.post("/artisans/me/catalogue", response_model=ArtisanPortalProfileResponse)
async def add_artisan_catalogue_images(
    body: ArtisanCatalogueAddRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Appends one or more craft/artifact photos to the authenticated artisan's `catalogue_images` array.
    """
    phone_norm = normalize_phone_number(body.phone_number)
    validate_four_digit_pin(body.pin)

    record = await _find_artisan_or_draft_by_phone(phone_norm, db)
    if not record:
        raise HTTPException(status_code=404, detail="Artisan account not found.")
    if not verify_pin(body.pin, record.get("pin_hash")):
        raise HTTPException(status_code=401, detail="Invalid 4-digit PIN.")

    existing = list(record.get("catalogue_images") or [])
    for url in body.image_urls or []:
        cleaned = (url or "").strip()
        if cleaned and cleaned not in existing:
            existing.append(cleaned)

    await _update_record_catalogue_images(record, existing, db)
    record["catalogue_images"] = existing

    return ArtisanPortalProfileResponse(
        id=record["id"],
        source_type=record["source_type"],
        approval_status=record["approval_status"],
        artisan_name=record["artisan_name"],
        craft_type=record["craft_type"],
        phone_number=record["phone_number"],
        place_name=record.get("place_name"),
        address=record.get("address"),
        latitude=record.get("latitude"),
        longitude=record.get("longitude"),
        has_workshop=record.get("has_workshop", False),
        workshop_fee_inr=record.get("workshop_fee_inr", 0.0),
        workshop_duration_minutes=record.get("workshop_duration_minutes", 45),
        workshop_description=record.get("workshop_description"),
        opening_time=record.get("opening_time") or "10:00",
        closing_time=record.get("closing_time") or "19:30",
        admin_brief=record.get("admin_brief"),
        missing_info_checklist=record.get("missing_info_checklist", []),
        raw_transcript=record.get("raw_transcript"),
        catalogue_images=existing,
    )


@router.delete("/artisans/me/catalogue", response_model=ArtisanPortalProfileResponse)
async def remove_artisan_catalogue_image(
    body: Optional[ArtisanCatalogueDeleteRequest] = Body(None),
    phone_number: Optional[str] = Query(None),
    pin: Optional[str] = Query(None),
    image_url: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Removes one or more specified craft/artifact photos from the authenticated artisan's `catalogue_images` array.
    Supports either JSON request body or query parameters.
    """
    raw_phone = (body.phone_number if body else None) or phone_number or ""
    raw_pin = (body.pin if body else None) or pin or ""
    urls_to_remove = set()
    if body:
        if body.image_url:
            urls_to_remove.add(body.image_url.strip())
        for u in body.image_urls or []:
            if u and u.strip():
                urls_to_remove.add(u.strip())
    if image_url and image_url.strip():
        urls_to_remove.add(image_url.strip())

    phone_norm = normalize_phone_number(raw_phone)
    validate_four_digit_pin(raw_pin)

    record = await _find_artisan_or_draft_by_phone(phone_norm, db)
    if not record:
        raise HTTPException(status_code=404, detail="Artisan account not found.")
    if not verify_pin(raw_pin, record.get("pin_hash")):
        raise HTTPException(status_code=401, detail="Invalid 4-digit PIN.")

    existing = list(record.get("catalogue_images") or [])
    updated = [img for img in existing if img not in urls_to_remove]

    await _update_record_catalogue_images(record, updated, db)
    record["catalogue_images"] = updated

    return ArtisanPortalProfileResponse(
        id=record["id"],
        source_type=record["source_type"],
        approval_status=record["approval_status"],
        artisan_name=record["artisan_name"],
        craft_type=record["craft_type"],
        phone_number=record["phone_number"],
        place_name=record.get("place_name"),
        address=record.get("address"),
        latitude=record.get("latitude"),
        longitude=record.get("longitude"),
        has_workshop=record.get("has_workshop", False),
        workshop_fee_inr=record.get("workshop_fee_inr", 0.0),
        workshop_duration_minutes=record.get("workshop_duration_minutes", 45),
        workshop_description=record.get("workshop_description"),
        opening_time=record.get("opening_time") or "10:00",
        closing_time=record.get("closing_time") or "19:30",
        admin_brief=record.get("admin_brief"),
        missing_info_checklist=record.get("missing_info_checklist", []),
        raw_transcript=record.get("raw_transcript"),
        catalogue_images=updated,
    )


@router.get("/artisans", response_model=List[ArtisanResponse])
async def list_artisans(
    has_workshop: Optional[bool] = Query(None, description="Filter for hands-on workshops"),
    max_fee: Optional[float] = Query(None, description="Max workshop fee in INR"),
    craft_type: Optional[str] = Query(None, description="Filter by craft type"),
    db: AsyncSession = Depends(get_db),
):
    """Browse verified Udaipur artisan studios and masterclasses with catalogue_images."""
    if not isinstance(has_workshop, bool):
        has_workshop = None
    if not isinstance(max_fee, (int, float)):
        max_fee = None
    if not isinstance(craft_type, str):
        craft_type = None
    query = """
        SELECT a.*, p.address, p.latitude, p.longitude, p.opening_time, p.closing_time
        FROM artisans a
        LEFT JOIN places p ON a.place_id = p.id
        WHERE a.profile_status = 'approved'
    """
    params: Dict[str, Any] = {}
    if has_workshop is not None:
        query += " AND a.has_workshop = :has_workshop"
        params["has_workshop"] = has_workshop
    if max_fee is not None:
        query += " AND a.workshop_fee_inr <= :max_fee"
        params["max_fee"] = max_fee
    if craft_type:
        query += " AND a.craft_type ILIKE :craft_type"
        params["craft_type"] = f"%{craft_type}%"

    query += " ORDER BY a.created_at DESC"

    try:
        res = await db.execute(text(query), params)
        rows = res.fetchall()
    except Exception:
        rows = []

    results: List[ArtisanResponse] = []
    for r in rows:
        row_map = dict(r._mapping)
        cat_imgs = _parse_json_list(row_map.get("catalogue_images"))
        if not cat_imgs and r.id in IN_MEMORY_APPROVED_ARTISANS:
            cat_imgs = IN_MEMORY_APPROVED_ARTISANS[r.id]["catalogue_images"]
        results.append(
            ArtisanResponse(
                id=r.id,
                artisan_name=r.artisan_name,
                craft_type=r.craft_type,
                place_id=r.place_id,
                address=row_map.get("address"),
                latitude=float(row_map["latitude"]) if row_map.get("latitude") is not None else None,
                longitude=float(row_map["longitude"]) if row_map.get("longitude") is not None else None,
                opening_time=str(row_map["opening_time"])[:5] if row_map.get("opening_time") else None,
                closing_time=str(row_map["closing_time"])[:5] if row_map.get("closing_time") else None,
                phone_number=r.phone_number,
                bio=r.bio,
                catalogue_images=cat_imgs,
                has_workshop=r.has_workshop,
                workshop_fee_inr=float(r.workshop_fee_inr) if r.workshop_fee_inr else 0.0,
                workshop_duration_minutes=r.workshop_duration_minutes,
                workshop_description=r.workshop_description,
                profile_status=r.profile_status,
            )
        )

    # Merge any in-memory approved artisans not already present from DB
    existing_ids = {item.id for item in results}
    for a_id, a in IN_MEMORY_APPROVED_ARTISANS.items():
        record_id = a.get("id", a_id)
        if record_id in existing_ids:
            continue
        if has_workshop is not None and a.get("has_workshop") != has_workshop:
            continue
        if max_fee is not None and a.get("workshop_fee_inr", 0) > max_fee:
            continue
        if craft_type and craft_type.lower() not in a.get("craft_type", "").lower():
            continue
        results.append(
            ArtisanResponse(
                id=record_id,
                artisan_name=a.get("artisan_name", ""),
                craft_type=a.get("craft_type", ""),
                place_id=a.get("place_id", a_id),
                address=a.get("address"),
                latitude=a.get("latitude"),
                longitude=a.get("longitude"),
                opening_time=a.get("opening_time"),
                closing_time=a.get("closing_time"),
                phone_number=a.get("phone_number"),
                bio=a.get("bio"),
                catalogue_images=a.get("catalogue_images", []),
                has_workshop=a.get("has_workshop", False),
                workshop_fee_inr=float(a.get("workshop_fee_inr", 0)),
                workshop_duration_minutes=a.get("workshop_duration_minutes", 45),
                workshop_description=a.get("workshop_description"),
                profile_status=a.get("approval_status", "approved"),
            )
        )

    return results


@router.get("/artisans/{artisan_id}", response_model=ArtisanResponse)
async def get_artisan_details(
    artisan_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Fetch complete artisan profile, catalogue_images, and workshop offerings."""
    r = None
    try:
        res = await db.execute(
            text("""
                SELECT a.*, p.address, p.latitude, p.longitude, p.opening_time, p.closing_time
                FROM artisans a
                LEFT JOIN places p ON a.place_id = p.id
                WHERE a.id = :id AND a.profile_status = 'approved'
            """),
            {"id": artisan_id},
        )
        r = res.fetchone()
    except Exception:
        r = None

    if r:
        row_map = dict(r._mapping)
        cat_imgs = _parse_json_list(row_map.get("catalogue_images"))
        if not cat_imgs and r.id in IN_MEMORY_APPROVED_ARTISANS:
            cat_imgs = IN_MEMORY_APPROVED_ARTISANS[r.id]["catalogue_images"]

        return ArtisanResponse(
            id=r.id,
            artisan_name=r.artisan_name,
            craft_type=r.craft_type,
            place_id=r.place_id,
            address=row_map.get("address"),
            latitude=float(row_map["latitude"]) if row_map.get("latitude") is not None else None,
            longitude=float(row_map["longitude"]) if row_map.get("longitude") is not None else None,
            opening_time=str(row_map["opening_time"])[:5] if row_map.get("opening_time") else None,
            closing_time=str(row_map["closing_time"])[:5] if row_map.get("closing_time") else None,
            phone_number=r.phone_number,
            bio=r.bio,
            catalogue_images=cat_imgs,
            has_workshop=r.has_workshop,
            workshop_fee_inr=float(r.workshop_fee_inr) if r.workshop_fee_inr else 0.0,
            workshop_duration_minutes=r.workshop_duration_minutes,
            workshop_description=r.workshop_description,
            profile_status=r.profile_status,
        )

    if artisan_id in IN_MEMORY_APPROVED_ARTISANS:
        a = IN_MEMORY_APPROVED_ARTISANS[artisan_id]
        return ArtisanResponse(
            id=a.get("id", artisan_id),
            artisan_name=a.get("artisan_name", ""),
            craft_type=a.get("craft_type", ""),
            place_id=a.get("place_id", artisan_id),
            address=a.get("address"),
            latitude=a.get("latitude"),
            longitude=a.get("longitude"),
            opening_time=a.get("opening_time"),
            closing_time=a.get("closing_time"),
            phone_number=a.get("phone_number"),
            bio=a.get("bio"),
            catalogue_images=a.get("catalogue_images", []),
            has_workshop=a.get("has_workshop", False),
            workshop_fee_inr=float(a.get("workshop_fee_inr", 0)),
            workshop_duration_minutes=a.get("workshop_duration_minutes", 45),
            workshop_description=a.get("workshop_description"),
            profile_status=a.get("approval_status", "approved"),
        )

    raise HTTPException(status_code=404, detail="Artisan studio not found")


@router.get("/trips/{trip_id}/recommendations/artisans", response_model=ArtisanRecommendationResponse)
@router.get("/trips/{trip_id}/artisan-recommendations", response_model=ArtisanRecommendationResponse)
async def get_artisan_recommendations(
    trip_id: str,
    preference: Optional[str] = Query(None, description="Filter by preference: workshops, store_visits, or both"),
    max_detour_minutes: int = Query(15, description="Max allowed detour in minutes"),
    travel_mode: Optional[str] = Query(None, description="Override travel mode: walking, auto_rickshaw, cab"),
    db: AsyncSession = Depends(get_db),
):
    """
    Score and recommend nearby verified artisan studios along an active trip itinerary.
    Evaluates detour time along route stops, confirms opening hours, and checks budget headroom.
    """
    trip_res = await db.execute(
        text("SELECT * FROM trips WHERE id = :id"),
        {"id": trip_id},
    )
    trip = trip_res.fetchone()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    version_id = trip.current_itinerary_version_id

    stops_res = await db.execute(
        text("""
            SELECT ts.id, ts.place_id, ts.day_number, ts.sequence_in_day,
                   ts.suggested_duration_minutes, ts.visit_status, ts.is_pinned,
                   ts.planned_arrival, ts.planned_departure,
                   p.name, p.latitude, p.longitude, p.category, p.entry_fee_inr,
                   p.opening_time, p.closing_time
            FROM trip_stops ts
            JOIN places p ON ts.place_id = p.id
            WHERE ts.trip_id = :trip_id AND ts.itinerary_version_id = :ver_id
            ORDER BY ts.day_number ASC, ts.sequence_in_day ASC
        """),
        {"trip_id": trip_id, "ver_id": version_id},
    )
    stops_rows = stops_res.fetchall()
    route_stops = [dict(r._mapping) for r in stops_rows]

    resolved_pref = preference or trip.artisan_preference or "both"
    resolved_mode = travel_mode
    if not resolved_mode:
        ver_res = await db.execute(
            text("SELECT route_geometry FROM itinerary_versions WHERE id = :id"),
            {"id": version_id},
        )
        ver_row = ver_res.fetchone()
        if ver_row and ver_row.route_geometry:
            try:
                geom = ver_row.route_geometry if isinstance(ver_row.route_geometry, dict) else json.loads(ver_row.route_geometry)
                resolved_mode = geom.get("travel_mode")
            except Exception:
                pass
    if not resolved_mode:
        resolved_mode = "auto_rickshaw"

    total_budget = float(trip.budget_inr or 2000.0)
    spent = sum(
        float(s.get("entry_fee_inr") or 0.0)
        for s in route_stops
        if s.get("visit_status") != "skipped"
    )
    remaining_budget = max(0.0, total_budget - spent)

    art_res = await db.execute(
        text("""
            SELECT a.id, a.id as artisan_id, a.place_id, a.artisan_name, a.craft_type,
                   a.phone_number, a.bio, a.has_workshop, a.workshop_fee_inr,
                   a.workshop_duration_minutes, a.workshop_description,
                   p.name, p.latitude, p.longitude, p.address,
                   p.opening_time, p.closing_time, p.entry_fee_inr, p.typical_duration_minutes
            FROM artisans a
            JOIN places p ON a.place_id = p.id
            WHERE a.profile_status = 'approved'
        """)
    )
    art_rows = art_res.fetchall()
    candidates = [dict(r._mapping) for r in art_rows]

    scorer = ArtisanRecommendationScorer()
    scored = scorer.score_candidates(
        route_stops=route_stops,
        candidate_artisans=candidates,
        remaining_budget=remaining_budget,
        preference=resolved_pref,
        travel_mode=resolved_mode,
        max_detour_minutes=max_detour_minutes,
    )

    return ArtisanRecommendationResponse(
        trip_id=trip_id,
        preference=resolved_pref,
        travel_mode=resolved_mode,
        remaining_budget_inr=remaining_budget,
        total_candidates_evaluated=len(candidates),
        recommendations=[ArtisanRecommendationItem(**item) for item in scored],
    )


@router.post("/trips/recommendations/artisans", response_model=ArtisanRecommendationResponse)
async def score_transient_artisan_recommendations(
    req: TransientArtisanRecommendationRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Score and recommend nearby verified artisan studios for a transient route or basket.
    Used by the Trip Builder before a trip is persisted.
    """
    art_res = await db.execute(
        text("""
            SELECT a.id, a.id as artisan_id, a.place_id, a.artisan_name, a.craft_type,
                   a.phone_number, a.bio, a.has_workshop, a.workshop_fee_inr,
                   a.workshop_duration_minutes, a.workshop_description,
                   p.name, p.latitude, p.longitude, p.address,
                   p.opening_time, p.closing_time, p.entry_fee_inr, p.typical_duration_minutes
            FROM artisans a
            JOIN places p ON a.place_id = p.id
            WHERE a.profile_status = 'approved'
        """)
    )
    art_rows = art_res.fetchall()
    candidates = [dict(r._mapping) for r in art_rows]

    spent = sum(float(s.get("entry_fee_inr") or 0.0) for s in req.stops)
    remaining_budget = max(0.0, req.budget_inr - spent)

    scorer = ArtisanRecommendationScorer()
    scored = scorer.score_candidates(
        route_stops=req.stops,
        candidate_artisans=candidates,
        remaining_budget=remaining_budget,
        preference=req.preference,
        travel_mode=req.travel_mode,
        max_detour_minutes=req.max_detour_minutes,
        start_location=req.start_location,
    )

    return ArtisanRecommendationResponse(
        trip_id=None,
        preference=req.preference,
        travel_mode=req.travel_mode,
        remaining_budget_inr=remaining_budget,
        total_candidates_evaluated=len(candidates),
        recommendations=[ArtisanRecommendationItem(**item) for item in scored],
    )
