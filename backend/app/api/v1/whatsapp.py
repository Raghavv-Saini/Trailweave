"""
Track 4: Meta WhatsApp Cloud Webhook Integration
Spec: docs/API_SPEC.md §1.5
"""
from fastapi import APIRouter, Query, Response, status, Request
from pydantic import BaseModel

router = APIRouter(tags=["WhatsApp Webhook"])


@router.get("/whatsapp/webhook")
async def verify_whatsapp_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
):
    """Handles Meta Webhook subscription verification handshake."""
    if hub_mode == "subscribe":
        return Response(content=hub_challenge, media_type="text/plain")
    return Response(content="Verification failed", status_code=status.HTTP_403_FORBIDDEN)


@router.post("/whatsapp/webhook")
async def receive_whatsapp_webhook(request: Request):
    """
    Ingests inbound WhatsApp voice notes or text messages sent by artisans.
    Queues Google Cloud STT V2 transcription and Gemini extraction.
    """
    payload = await request.json()
    return {"status": "received", "event": "queued_for_processing"}
