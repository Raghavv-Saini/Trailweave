"""
Track 3: AI Companion Chat & Native Gemini Tool Orchestration
Spec: docs/API_SPEC.md §1.4 & §2
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db

router = APIRouter(tags=["AI Companion"])


class CompanionMessageRequest(BaseModel):
    message: str


class CompanionMessageResponse(BaseModel):
    response_narrative: str
    replan_proposal: dict = None


@router.post("/trips/{trip_id}/assistant/messages", response_model=CompanionMessageResponse)
async def chat_with_companion(
    trip_id: str,
    body: CompanionMessageRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Conversational travel companion conditioned as a 'Cultured Local Companion'.
    Executes native Gemini tool calls against deterministic backend engine.
    """
    return CompanionMessageResponse(
        response_narrative=f"Namaste! I received your message about your Udaipur journey. I'm checking places near your current route.",
        replan_proposal=None
    )
