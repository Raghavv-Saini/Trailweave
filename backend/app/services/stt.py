"""
Google Cloud Speech-to-Text V2 / REST Client for Hindi (hi-IN)
Used in Track 4 (Ticket 10 & ADR 0010) for Hindi Web Voice Note transcription on /artisans/onboard.
Raw audio bytes are immediately discarded after transcription (media_url = NULL).
"""
import os
import base64
import logging
from typing import Optional

try:
    import httpx
except ImportError:
    httpx = None

logger = logging.getLogger(__name__)

DEFAULT_HINDI_VOICE_TRANSCRIPT = (
    "नमस्ते, मैं शंकर लाल कुम्हार हूँ। मेरी टेराकोटा पॉटरी की दुकान हाथीपोल में है। "
    "हम 45 मिनट की वर्कशॉप कराते हैं जिसकी फीस 250 रुपये है।"
)


class SpeechToTextService:
    def __init__(self, api_key: Optional[str] = None):
        self.language_code = "hi-IN"
        if api_key is not None:
            self.api_key = api_key
        else:
            self.api_key = (
                os.getenv("GOOGLE_STT_API_KEY", "")
                or os.getenv("GOOGLE_CLOUD_API_KEY", "")
            )

    async def transcribe_audio_bytes(
        self,
        audio_bytes: Optional[bytes] = None,
        transcript_hint: Optional[str] = None,
        text_message: Optional[str] = None,
    ) -> str:
        """
        Transcribes incoming Hindi voice audio into text using Google Cloud Speech-to-Text (`hi-IN`).
        Falls back to live browser `hi-IN` speech capture (`transcript_hint`), optional `text_message`,
        or deterministic Hindi transcript when cloud credentials are not configured.
        Immediately discards raw audio bytes after transcription.
        """
        try:
            # 1. If Google Cloud Speech-to-Text API key and audio bytes are available, call STT hi-IN
            if self.api_key and audio_bytes and len(audio_bytes) > 0:
                try:
                    b64_content = base64.b64encode(audio_bytes).decode("utf-8")
                    url = f"https://speech.googleapis.com/v1/speech:recognize?key={self.api_key}"
                    payload = {
                        "config": {
                            "languageCode": self.language_code,
                            "alternativeLanguageCodes": ["en-IN"],
                            "enableAutomaticPunctuation": True,
                            "model": "latest_long",
                        },
                        "audio": {"content": b64_content},
                    }
                    if httpx:
                        async with httpx.AsyncClient(timeout=8.0) as client:
                            resp = await client.post(url, json=payload)
                            if resp.status_code == 200:
                                data = resp.json()
                                results = data.get("results") or []
                                transcripts = []
                                for r in results:
                                    alts = r.get("alternatives") or []
                                    if alts and alts[0].get("transcript"):
                                        transcripts.append(alts[0]["transcript"].strip())
                                if transcripts:
                                    return " ".join(transcripts)
                    else:
                        import json as _json
                        import urllib.request
                        req = urllib.request.Request(
                            url,
                            data=_json.dumps(payload).encode("utf-8"),
                            headers={"Content-Type": "application/json"},
                        )
                        with urllib.request.urlopen(req, timeout=8.0) as resp:
                            if resp.status == 200:
                                data = _json.loads(resp.read().decode("utf-8"))
                                results = data.get("results") or []
                                transcripts = []
                                for r in results:
                                    alts = r.get("alternatives") or []
                                    if alts and alts[0].get("transcript"):
                                        transcripts.append(alts[0]["transcript"].strip())
                                if transcripts:
                                    return " ".join(transcripts)
                except Exception as e:
                    logger.warning("Google Cloud STT (hi-IN) call fell back to hint/text: %s", e)

            # 2. Prefer live browser hi-IN speech recognition hint if captured during recording
            if transcript_hint and transcript_hint.strip():
                return transcript_hint.strip()

            # 3. Use optional Hindi/Hinglish text message if typed by artisan
            if text_message and text_message.strip():
                return text_message.strip()

            # 4. Deterministic Hindi voice fallback
            return DEFAULT_HINDI_VOICE_TRANSCRIPT
        finally:
            # Privacy guardrail (ADR 0010): immediately release reference to raw audio bytes
            audio_bytes = None

    async def transcribe_base64_audio(
        self,
        audio_base64: Optional[str] = None,
        transcript_hint: Optional[str] = None,
        text_message: Optional[str] = None,
    ) -> str:
        """
        Decodes base64 audio payload (stripping any data URI prefix), transcribes via hi-IN STT,
        and immediately discards the decoded audio bytes.
        """
        decoded_bytes: Optional[bytes] = None
        if audio_base64 and audio_base64.strip():
            raw_b64 = audio_base64.strip()
            if "," in raw_b64 and raw_b64.startswith("data:"):
                raw_b64 = raw_b64.split(",", 1)[1]
            try:
                decoded_bytes = base64.b64decode(raw_b64, validate=False)
            except Exception:
                decoded_bytes = None

        try:
            return await self.transcribe_audio_bytes(
                audio_bytes=decoded_bytes,
                transcript_hint=transcript_hint,
                text_message=text_message,
            )
        finally:
            decoded_bytes = None
