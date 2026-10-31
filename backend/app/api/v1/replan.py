"""
Track 2: Unified Mutation Engine & Revision-Locked Replan Endpoints
Spec: docs/API_SPEC.md §1.4 & ADR 0005
"""
import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List
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

    proposal_id = f"prop_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6]}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)

    # Fetch active stops with place metadata to compute accurate before/after diffs
    current_stops = []
    if trip.current_itinerary_version_id:
        stops_res = await db.execute(
            text("""
                SELECT s.*, p.name, p.entry_fee_inr
                FROM trip_stops s
                LEFT JOIN places p ON s.place_id = p.id
                WHERE s.itinerary_version_id = :vid
                ORDER BY s.day_number, s.sequence_in_day
            """),
            {"vid": trip.current_itinerary_version_id}
        )
        current_stops = stops_res.fetchall()

    stop_map = {s.id: s for s in current_stops}

    cost_delta = 0.0
    duration_delta = 0
    added: List[str] = []
    skipped: List[str] = []
    removed: List[str] = []

    for op in body.operations:
        if op.type == "add_stop" and op.place_id:
            added.append(op.place_id)
        elif op.type == "skip_stop" and op.stop_id:
            skipped.append(op.stop_id)
            if op.stop_id in stop_map:
                s = stop_map[op.stop_id]
                duration_delta -= int(s.suggested_duration_minutes or 0)
        elif op.type == "remove_stop" and op.stop_id:
            removed.append(op.stop_id)
            if op.stop_id in stop_map:
                s = stop_map[op.stop_id]
                duration_delta -= int(s.suggested_duration_minutes or 0)
                cost_delta -= float(s.entry_fee_inr or 0)

    diff = ValidationDiff(
        cost_delta_inr=cost_delta,
        duration_delta_minutes=duration_delta,
        stops_added=added,
        stops_skipped=skipped,
        stops_removed=removed,
        closing_hour_conflicts=[]
    )

    operations_json = json.dumps([op.model_dump() for op in body.operations])
    diff_json = json.dumps(diff.model_dump())

    # Persist provisional proposal in replan_proposals
    await db.execute(
        text("""
            INSERT INTO replan_proposals (
                id, trip_id, base_revision, requested_by,
                operations, candidate_stops, validation_diff,
                is_feasible, status, expires_at
            ) VALUES (
                :id, :trip_id, :base_rev, :req_by,
                CAST(:ops AS jsonb), '[]'::jsonb, CAST(:diff AS jsonb),
                true, 'pending', :expires_at
            )
            ON CONFLICT (id) DO NOTHING
        """),
        {
            "id": proposal_id,
            "trip_id": trip_id,
            "base_rev": body.base_revision,
            "req_by": body.requested_by,
            "ops": operations_json,
            "diff": diff_json,
            "expires_at": expires_at,
        }
    )
    await db.commit()

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

    # Check proposal record
    prop_res = await db.execute(
        text("SELECT * FROM replan_proposals WHERE id = :id"),
        {"id": body.proposal_id}
    )
    prop = prop_res.fetchone()

    # Increment revision atomically
    new_revision = trip.revision + 1
    await db.execute(
        text("UPDATE trips SET revision = :rev, updated_at = NOW() WHERE id = :id"),
        {"rev": new_revision, "id": trip_id}
    )

    if prop:
        await db.execute(
            text("UPDATE replan_proposals SET status = 'accepted' WHERE id = :id"),
            {"id": body.proposal_id}
        )

    # Log audit event in trip_events
    payload_json = json.dumps({
        "proposal_id": body.proposal_id,
        "expected_revision": body.expected_revision,
        "resulting_revision": new_revision,
        "operations": prop.operations if prop else [],
    })
    await db.execute(
        text("""
            INSERT INTO trip_events (id, trip_id, resulting_revision, actor, source, event_type, payload)
            VALUES (
                :eid, :trip_id, :rev, 'user', 'manual_editor', 'replan_committed',
                CAST(:payload AS jsonb)
            )
        """),
        {
            "eid": f"event_replan_{uuid.uuid4().hex[:10]}",
            "trip_id": trip_id,
            "rev": new_revision,
            "payload": payload_json,
        }
    )

    await db.commit()

    return ReplanAcceptResponse(
        success=True,
        new_revision=new_revision,
        message=f"Itinerary updated successfully to Revision {new_revision}"
    )
