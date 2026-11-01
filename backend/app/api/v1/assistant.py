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
    history: List[Dict[str, str]] = Field(default_factory=list)
    client_trip_state: Optional[Dict[str, Any]] = None


class CompanionMessageResponse(BaseModel):
    response_narrative: str
    replan_proposal: Optional[Dict[str, Any]] = None
    acknowledged_events: List[str] = Field(default_factory=list)
    trip_updated: bool = False
    new_revision: Optional[int] = None


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
    target_trip_id = trip_id
    trip_res = await db.execute(
        text("SELECT id FROM trips WHERE id = :id"),
        {"id": target_trip_id}
    )
    if not trip_res.fetchone():
        if target_trip_id in ["trip_udaipur_heritage_01", "trip_demo_udaipur"]:
            demo_res = await db.execute(
                text("SELECT id FROM trips WHERE id = 'trip_demo_udaipur'")
            )
            if demo_res.fetchone():
                target_trip_id = "trip_demo_udaipur"

    res = await companion_service.process_companion_chat(
        trip_id=target_trip_id,
        user_message=body.message,
        db=db,
        history=body.history,
        client_trip_state=body.client_trip_state,
    )
    return CompanionMessageResponse(
        response_narrative=res["response_narrative"],
        replan_proposal=res.get("replan_proposal"),
        acknowledged_events=res.get("acknowledged_events", []),
        trip_updated=bool(res.get("trip_updated", False)),
        new_revision=res.get("new_revision"),
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
    target_trip_id = trip_id
    trip_res = await db.execute(
        text("SELECT id FROM trips WHERE id = :id"),
        {"id": target_trip_id}
    )
    if not trip_res.fetchone() and target_trip_id in ["trip_udaipur_heritage_01", "trip_demo_udaipur"]:
        demo_res = await db.execute(
            text("SELECT id FROM trips WHERE id = 'trip_demo_udaipur'")
        )
        if demo_res.fetchone():
            target_trip_id = "trip_demo_udaipur"

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
    target_trip_id = trip_id
    trip_res = await db.execute(
        text("SELECT id FROM trips WHERE id = :id"),
        {"id": target_trip_id}
    )
    if not trip_res.fetchone() and target_trip_id in ["trip_udaipur_heritage_01", "trip_demo_udaipur"]:
        demo_res = await db.execute(
            text("SELECT id FROM trips WHERE id = 'trip_demo_udaipur'")
        )
        if demo_res.fetchone():
            target_trip_id = "trip_demo_udaipur"

    tip = await companion_service.generate_transition_notification(
        trip_id=target_trip_id,
        completed_stop_id=completed_stop_id or "",
        db=db
    )
    return TransitionTipResponse(**tip)
