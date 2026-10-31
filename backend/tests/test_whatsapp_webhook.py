"""
Tests for Meta WhatsApp Cloud Webhook Verification (Track 4 / Fix 3).
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.config import settings


@pytest.mark.asyncio
async def test_whatsapp_webhook_verification_success():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token = settings.WHATSAPP_VERIFY_TOKEN
        resp = await client.get(
            "/api/v1/whatsapp/webhook",
            params={
                "hub.mode": "subscribe",
                "hub.verify_token": token,
                "hub.challenge": "challenge_code_12345",
            },
        )
        assert resp.status_code == 200
        assert resp.text == "challenge_code_12345"


@pytest.mark.asyncio
async def test_whatsapp_webhook_verification_mismatched_token():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(
            "/api/v1/whatsapp/webhook",
            params={
                "hub.mode": "subscribe",
                "hub.verify_token": "incorrect_token_abc",
                "hub.challenge": "challenge_code_12345",
            },
        )
        assert resp.status_code == 403


@pytest.mark.asyncio
async def test_whatsapp_webhook_verification_missing_mode():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token = settings.WHATSAPP_VERIFY_TOKEN
        resp = await client.get(
            "/api/v1/whatsapp/webhook",
            params={
                "hub.verify_token": token,
                "hub.challenge": "challenge_code_12345",
            },
        )
        assert resp.status_code == 403
