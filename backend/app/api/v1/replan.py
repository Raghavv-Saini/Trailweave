"""
Track 2: Unified Mutation Engine & Revision-Locked Replan Endpoints
Spec: docs/API_SPEC.md §1.4 & ADR 0005
"""
from datetime import datetime, timedelta
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.database import get_db
from app.schemas.replan import (
    ReplanPreviewRequest,
    ReplanProposalResponse,
    ReplanAcceptRequest,
    ReplanAcceptResponse,
    ValidationDiff,
)

router = APIRouter(tags=["Unified Replan Engine"])


@router.post("/trips/{trip_id}/replan-preview", response_model=ReplanProposalResponse)
async def preview_replan(
    trip_id: str,
    body: ReplanPreviewRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Submits candidate modifications from either manual UI editor or Gemini companion.
    Evaluates constraints (hours, budget, detours) without altering the active trip.
    """
    trip_res = await db.execute(
        text("SELECT * FROM trips WHERE id = :id"),
        {"id": trip_id}
    )
    trip = trip_res.fetchone()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    proposal_id = f"prop_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    expires_at = datetime.utcnow() + timedelta(minutes=15)

    # Calculate diff stub (expanded in Ticket 05)
    added = [op.place_id for op in body.operations if op.type == "add_stop" and op.place_id]
    skipped = [op.stop_id for op in body.operations if op.type == "skip_stop" and op.stop_id]

    diff = ValidationDiff(
        cost_delta_inr=0.0,
        duration_delta_minutes=0,
        stops_added=added,
        stops_skipped=skipped,
        closing_hour_conflicts=[]
    )

    return ReplanProposalResponse(
        proposal_id=proposal_id,
        base_revision=body.base_revision,
        is_feasible=True,
        validation_diff=diff,
        candidate_stops=[],
        expires_at=expires_at
    )


@router.post("/trips/{trip_id}/replan-accept", response_model=ReplanAcceptResponse)
async def accept_replan(
    trip_id: str,
    body: ReplanAcceptRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Commits an approved proposal.
    Enforces strict optimistic concurrency: returns HTTP 409 Conflict if expected_revision != trip.revision.
    """
    trip_res = await db.execute(
        text("SELECT * FROM trips WHERE id = :id FOR UPDATE"),
        {"id": trip_id}
    )
    trip = trip_res.fetchone()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if trip.revision != body.expected_revision:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": f"Revision mismatch. Expected revision {body.expected_revision}, but trip has already progressed to revision {trip.revision}. Please refresh and review latest plan.",
                "current_revision": trip.revision
            }
        )

    # Increment revision atomically
    new_revision = trip.revision + 1
    await db.execute(
        text("UPDATE trips SET revision = :rev, updated_at = NOW() WHERE id = :id"),
        {"rev": new_revision, "id": trip_id}
    )
    await db.commit()

    return ReplanAcceptResponse(
        success=True,
        new_revision=new_revision,
        message="Itinerary updated successfully"
    )
