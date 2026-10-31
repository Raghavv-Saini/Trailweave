"""
Track 3: AI Companion Chat & Native Gemini Tool Orchestration
Spec: docs/API_SPEC.md §1.4 & §2, ADR 0004, ADR 0005, ADR 0008
Ticket: docs/tickets/track-3-active-trip-companion/09-ai-companion-push-notifications.md
"""
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.core.database import get_db
from app.services.gemini import GeminiCompanionService

router = APIRouter(tags=["AI Companion"])
companion_service = GeminiCompanionService()

# In-memory store for Web Push subscriptions (keyed by trip_id)
PUSH_SUBSCRIPTIONS: Dict[str, Dict[str, Any]] = {}


class CompanionMessageRequest(BaseModel):
    message: str


class CompanionMessageResponse(BaseModel):
    response_narrative: str
    replan_proposal: Optional[Dict[str, Any]] = None
    acknowledged_events: List[str] = Field(default_factory=list)


class PushSubscriptionKeys(BaseModel):
    p256dh: Optional[str] = None
    auth: Optional[str] = None


class PushSubscriptionRequest(BaseModel):
    endpoint: str
    keys: Optional[PushSubscriptionKeys] = None


class TransitionTipResponse(BaseModel):
    title: str
    body: str
    gate_tip: str
    weather_tip: str
    scenic_tip: str
    next_stop_id: Optional[str] = None
    next_stop_name: Optional[str] = None


@router.post("/trips/{trip_id}/assistant/messages", response_model=CompanionMessageResponse)
async def chat_with_companion(
    trip_id: str,
    body: CompanionMessageRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Conversational travel companion conditioned as a 'Cultured Local Companion'.
    Injects fresh PostgreSQL trip revision state and recent change events from trip_events.
    Executes typed tool contracts (get_current_trip, get_recent_trip_events, search_places,
    get_place_details, propose_trip_changes) against the deterministic backend engine.
    """
    trip_res = await db.execute(
        text("SELECT id FROM trips WHERE id = :id"),
        {"id": trip_id}
    )
    if not trip_res.fetchone():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )

    res = await companion_service.process_companion_chat(
        trip_id=trip_id,
        user_message=body.message,
        db=db
    )
    return CompanionMessageResponse(
        response_narrative=res["response_narrative"],
        replan_proposal=res.get("replan_proposal"),
        acknowledged_events=res.get("acknowledged_events", [])
    )


@router.post("/trips/{trip_id}/push/subscribe")
async def register_push_subscription(
    trip_id: str,
    body: PushSubscriptionRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Registers a Web Push Service Worker subscription for active trip transition alerts.
    """
    trip_res = await db.execute(
        text("SELECT id FROM trips WHERE id = :id"),
        {"id": trip_id}
    )
    if not trip_res.fetchone():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )

    PUSH_SUBSCRIPTIONS[trip_id] = {
        "endpoint": body.endpoint,
        "keys": body.keys.model_dump() if body.keys else {},
    }
    return {
        "success": True,
        "trip_id": trip_id,
        "message": "Web Push subscription registered successfully"
    }


@router.get("/trips/{trip_id}/notifications/transition", response_model=TransitionTipResponse)
async def get_next_stop_transition_tip(
    trip_id: str,
    completed_stop_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves contextual gate, weather, and scenic tips for the upcoming stop.
    Used by Service Worker push and in-app concierge card.
    """
    tip = await companion_service.generate_transition_notification(
        trip_id=trip_id,
        completed_stop_id=completed_stop_id or "",
        db=db
    )
    return TransitionTipResponse(**tip)
