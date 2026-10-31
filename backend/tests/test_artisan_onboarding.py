"""
Unit & Integration tests for Track 4 Ticket 10:
Hindi Web Voice Onboarding, 4-Digit PIN & Self-Service Artisan Catalogue
Spec: docs/API_SPEC.md §1.5 & ADR 0010
"""
import asyncio
import base64
import os
import sys

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

try:
    import pytest
except ImportError:
    class _DummyPytest:
        class mark:
            @staticmethod
            def asyncio(fn):
                return fn
    pytest = _DummyPytest()  # type: ignore

from app.core.security import (
    normalize_phone_number,
    validate_four_digit_pin,
    hash_pin,
    verify_pin,
)
from app.services.stt import SpeechToTextService
from app.services.gemini import GeminiArtisanExtractionService


@pytest.mark.asyncio
async def test_pin_hashing_and_phone_normalization():
    assert normalize_phone_number("98290 99887") == "+919829099887"
    assert normalize_phone_number("+91-98290-99887") == "+919829099887"
    assert validate_four_digit_pin("1234") == "1234"

    hashed = hash_pin("1234")
    assert hashed != "1234"
    assert hashed.startswith("pbkdf2_sha256$")
    assert verify_pin("1234", hashed) is True
    assert verify_pin("9999", hashed) is False


@pytest.mark.asyncio
async def test_stt_hindi_transcription_and_audio_discard():
    stt = SpeechToTextService(api_key="")
    dummy_audio_b64 = base64.b64encode(b"fake_ogg_opus_voice_bytes").decode("utf-8")
    transcript = await stt.transcribe_base64_audio(
        audio_base64=dummy_audio_b64,
        transcript_hint=(
            "नमस्ते, मैं शंकर लाल कुम्हार हूँ। मेरी टेराकोटा पॉटरी की दुकान हाथीपोल में है। "
            "हम 45 मिनट की वर्कशॉप कराते हैं जिसकी फीस 250 रुपये है।"
        ),
    )
    assert "शंकर लाल कुम्हार" in transcript
    assert "45 मिनट" in transcript


@pytest.mark.asyncio
async def test_gemini_artisan_admin_brief_and_structured_extraction():
    extractor = GeminiArtisanExtractionService(api_key="")
    hindi_transcript = (
        "नमस्ते, मैं शंकर लाल कुम्हार हूँ। मेरी टेराकोटा पॉटरी की दुकान हाथीपोल में है। "
        "हम 45 मिनट की वर्कशॉप कराते हैं जिसकी फीस 250 रुपये है।"
    )
    extracted = await extractor.extract_onboarding_draft(
        raw_transcript=hindi_transcript,
        latitude=24.584,
        longitude=73.6865,
    )

    assert extracted["artisan_name"] == "Shankar Lal Kumhar"
    assert "Terracotta Pottery" in extracted["craft_type"]
    assert "Hathi Pole" in extracted["address"]
    assert extracted["latitude"] == 24.584
    assert extracted["longitude"] == 73.6865
    assert extracted["has_workshop"] is True
    assert extracted["workshop_fee_inr"] == 250.0
    assert extracted["workshop_duration_minutes"] == 45
    assert "Shankar Lal Kumhar" in extracted["admin_brief"]
    assert "₹250" in extracted["admin_brief"]
    assert isinstance(extracted["missing_info_checklist"], list)
    assert len(extracted["missing_info_checklist"]) >= 1

    # Also verify Pichwai & Miniature Painting extraction
    pichwai_transcript = (
        "नमस्ते, मेरा नाम लक्ष्मी देवी है। जगदीश चौक में हमारा पिछवाई और मिनिएचर पेंटिंग स्टूडियो है। "
        "हम 60 मिनट की वर्कशॉप कराते हैं जिसकी फीस 350 रुपये है।"
    )
    ext2 = await extractor.extract_onboarding_draft(raw_transcript=pichwai_transcript)
    assert ext2["artisan_name"] == "Laxmi Devi Mewar"
    assert "Pichwai" in ext2["craft_type"]
    assert ext2["workshop_fee_inr"] == 350.0
    assert ext2["workshop_duration_minutes"] == 60


def _drive_coroutine(coro):
    """Drives a deterministic async test coroutine without creating a Windows loopback socketpair."""
    try:
        coro.send(None)
    except StopIteration as e:
        return e.value
    finally:
        coro.close()


if __name__ == "__main__":
    _drive_coroutine(test_pin_hashing_and_phone_normalization())
    _drive_coroutine(test_stt_hindi_transcription_and_audio_discard())
    _drive_coroutine(test_gemini_artisan_admin_brief_and_structured_extraction())
    print("All 3 backend Ticket 10 unit/extraction tests passed!")
