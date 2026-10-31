"""
Google Cloud Speech-to-Text V2 Client for Hindi (hi-IN)
Used in Track 4 (Ticket 10) for WhatsApp voice note transcription.
"""
from typing import Optional


class SpeechToTextService:
    def __init__(self):
        self.language_code = "hi-IN"

    async def transcribe_audio_bytes(self, audio_bytes: bytes) -> str:
        """Transcribes incoming OGG/Opus WhatsApp voice message into text."""
        # Stub for Ticket 10 implementation
        return "नमस्ते, मैं मास्टर मोहनलाल हूँ। मेरी दुकान जगदीश चौक में है। हम 400 साल पुरानी पिछवाई और लघु चित्रकारी सिखाते हैं।"
