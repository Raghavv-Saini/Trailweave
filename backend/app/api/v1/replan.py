"""
Track 2: Unified Mutation Engine & Revision-Locked Replan Endpoints
Spec: docs/API_SPEC.md §1.4, ADR 0005, ADR 0008
Ticket: docs/tickets/track-2-trip-engine-backend/05-unified-mutation-engine-replan-api.md
"""
import json
import uuid
from datetime import datetime, timezone, timedelta, time
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.core.config import settings
from app.core.database import get_db
from app.engine.replan import UnifiedMutationEngine, PLACE_IMAGE_MAP, DEFAULT_PLACE_IMAGE
from app.schemas.replan import (
    ReplanPreviewRequest,
    ReplanProposalResponse,
    ReplanAcceptRequest,
    ReplanAcceptResponse,
    ValidationDiff,
    TripEventResponse,
)
from app.schemas.trips import TripStopResponse
from app.services.planner import StartLocation

router = APIRouter(tags=["Unified Replan Engine"])
mutation_engine = UnifiedMutationEngine()


async def _fetch_trip_active_stops(
    db: AsyncSession, trip_id: str, version_id: str
) -> List[Dict[str, Any]]:
    """Fetch current stops with enriched place and artisan workshop metadata."""
    res = await db.execute(
        text("""
            SELECT
                s.id,
                s.trip_id,
                s.itinerary_version_id,
                s.place_id,
                s.day_number,
                s.sequence_in_day,
                s.planned_arrival,
                s.planned_departure,
                s.suggested_duration_minutes,
                s.actual_duration_minutes,
                s.is_pinned,
                s.visit_status,
                s.source_attribution,
                s.private_notes,
                p.name,
                p.address,
                p.latitude,
                p.longitude,
                p.category,
                p.entry_fee_inr,
                p.typical_duration_minutes,
                p.opening_time,
                p.closing_time,
                COALESCE(BOOL_OR(a.has_workshop), FALSE) AS has_workshop,
                COALESCE(MIN(a.workshop_fee_inr) FILTER (WHERE a.has_workshop), 0) AS workshop_fee_inr,
                COALESCE(MIN(a.workshop_duration_minutes) FILTER (WHERE a.has_workshop), 45) AS workshop_duration_minutes
            FROM trip_stops s
            LEFT JOIN places p ON s.place_id = p.id
            LEFT JOIN artisans a ON a.place_id = p.id AND a.profile_status = 'approved'
            WHERE s.trip_id = :trip_id AND s.itinerary_version_id = :vid
            GROUP BY
                s.id, s.trip_id, s.itinerary_version_id, s.place_id, s.day_number,
                s.sequence_in_day, s.planned_arrival, s.planned_departure,
                s.suggested_duration_minutes, s.actual_duration_minutes, s.is_pinned,
                s.visit_status, s.source_attribution, s.private_notes, p.name,
                p.address, p.latitude, p.longitude, p.category, p.entry_fee_inr,
                p.typical_duration_minutes, p.opening_time, p.closing_time
            ORDER BY s.day_number, s.sequence_in_day
        """),
        {"trip_id": trip_id, "vid": version_id},
    )
    rows = res.fetchall()
    stops = []
    for r in rows:
        stops.append({
            "id": r.id,
            "trip_id": r.trip_id,
            "itinerary_version_id": r.itinerary_version_id,
            "place_id": r.place_id,
            "day_number": r.day_number,
            "sequence_in_day": r.sequence_in_day,
            "planned_arrival": r.planned_arrival,
            "planned_departure": r.planned_departure,
            "suggested_duration_minutes": r.suggested_duration_minutes,
            "actual_duration_minutes": r.actual_duration_minutes,
            "is_pinned": r.is_pinned,
            "visit_status": r.visit_status,
            "source_attribution": r.source_attribution,
            "private_notes": r.private_notes,
            "name": r.name,
            "address": r.address,
            "latitude": float(r.latitude) if r.latitude is not None else 24.5764,
            "longitude": float(r.longitude) if r.longitude is not None else 73.6835,
            "category": r.category,
            "entry_fee_inr": float(r.entry_fee_inr or 0.0),
            "typical_duration_minutes": r.typical_duration_minutes,
            "opening_time": r.opening_time,
            "closing_time": r.closing_time,
            "has_workshop": r.has_workshop,
            "workshop_fee_inr": float(r.workshop_fee_inr or 0.0),
            "workshop_duration_minutes": int(r.workshop_duration_minutes or 45),
            "image_url": PLACE_IMAGE_MAP.get(r.place_id, DEFAULT_PLACE_IMAGE),
        })
    return stops


async def _fetch_places_catalog(db: AsyncSession, place_ids: List[str]) -> Dict[str, Any]:
    """Fetch place and approved artisan details for added places."""
    if not place_ids:
        return {}
    res = await db.execute(
        text("""
            SELECT
                p.id,
                p.name,
                p.address,
                p.latitude,
                p.longitude,
                p.category,
                p.entry_fee_inr,
                p.typical_duration_minutes,
                p.opening_time,
                p.closing_time,
                COALESCE(BOOL_OR(a.has_workshop), FALSE) AS has_workshop,
                COALESCE(MIN(a.workshop_fee_inr) FILTER (WHERE a.has_workshop), 0) AS workshop_fee_inr,
                COALESCE(MIN(a.workshop_duration_minutes) FILTER (WHERE a.has_workshop), 45) AS workshop_duration_minutes
            FROM places p
            LEFT JOIN artisans a ON a.place_id = p.id AND a.profile_status = 'approved'
            WHERE p.id = ANY(:pids)
            GROUP BY
                p.id, p.name, p.address, p.latitude, p.longitude, p.category,
                p.entry_fee_inr, p.typical_duration_minutes, p.opening_time, p.closing_time
        """),
        {"pids": list(set(place_ids))},
    )
    catalog = {}
    for r in res.fetchall():
        catalog[r.id] = {
            "id": r.id,
            "name": r.name,
            "address": r.address,
            "latitude": float(r.latitude),
            "longitude": float(r.longitude),
            "category": r.category,
            "entry_fee_inr": float(r.entry_fee_inr or 0.0),
            "typical_duration_minutes": r.typical_duration_minutes,
            "opening_time": r.opening_time,
            "closing_time": r.closing_time,
            "has_workshop": r.has_workshop,
            "workshop_fee_inr": float(r.workshop_fee_inr or 0.0),
            "workshop_duration_minutes": int(r.workshop_duration_minutes or 45),
        }
    return catalog


@router.post("/trips/{trip_id}/replan-preview", response_model=ReplanProposalResponse)
async def preview_replan(
    trip_id: str,
    body: ReplanPreviewRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Submits candidate modifications from either manual UI editor or Gemini companion.
    Evaluates constraints (opening hours, transit matrix, budget) deterministically
    without altering the active trip, and stores a provisional proposal.
    """
    trip_res = await db.execute(
        text("SELECT * FROM trips WHERE id = :id"),
        {"id": trip_id}
    )
    trip = trip_res.fetchone()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if not trip.current_itinerary_version_id:
        raise HTTPException(status_code=400, detail="Trip has no active itinerary version to replan")

    # Fetch active stops
    current_stops = await _fetch_trip_active_stops(db, trip_id, trip.current_itinerary_version_id)

    # Fetch places catalog for any add_stop operations
    added_place_ids = [op.place_id for op in body.operations if op.type == "add_stop" and op.place_id]
    places_catalog = await _fetch_places_catalog(db, added_place_ids)

    # Reconstruct start location and departure
    start_location = StartLocation(
        name="Hotel Swaroop Vilas",
        latitude=24.5854,
        longitude=73.6812,
    )
    start_dt = getattr(trip, "start_datetime", None) or datetime.now(timezone.utc)
    if isinstance(start_dt, str):
        try:
            start_dt = datetime.fromisoformat(start_dt)
        except Exception:
            start_dt = datetime.now(timezone.utc)

    try:
        eval_result = await mutation_engine.evaluate_mutation(
            current_stops=current_stops,
            operations=body.operations,
            trip_id=trip_id,
            base_revision=body.base_revision,
            budget_limit=float(trip.budget_inr),
            start_location=start_location,
            start_datetime=start_dt,
            travel_mode=getattr(trip, "travel_mode", "auto_rickshaw") or "auto_rickshaw",
            artisan_preference=getattr(trip, "artisan_preference", "both") or "both",
            places_catalog=places_catalog,
            google_maps_api_key=settings.GOOGLE_MAPS_API_KEY,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    proposal_id = f"prop_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6]}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)

    candidate_stops_raw = eval_result["candidate_stops"]
    validation_diff: ValidationDiff = eval_result["validation_diff"]
    is_feasible: bool = eval_result["is_feasible"]
    total_cost: float = eval_result["total_estimated_cost_inr"]
    total_duration: int = eval_result["total_estimated_duration_minutes"]
    route_geometry: Dict[str, Any] = eval_result["route_geometry"]

    # Format candidate stops as TripStopResponse
    candidate_stop_responses: List[TripStopResponse] = []
    for s in candidate_stops_raw:
        candidate_stop_responses.append(
            TripStopResponse(
                id=s["id"],
                trip_id=trip_id,
                place_id=s["place_id"],
                name=s.get("name"),
                address=s.get("address"),
                latitude=float(s["latitude"]) if s.get("latitude") is not None else None,
                longitude=float(s["longitude"]) if s.get("longitude") is not None else None,
                category=s.get("category"),
                entry_fee_inr=float(s.get("entry_fee_inr") or 0.0),
                image_url=s.get("image_url") or PLACE_IMAGE_MAP.get(s["place_id"], DEFAULT_PLACE_IMAGE),
                day_number=s.get("day_number", 1),
                sequence_in_day=s.get("sequence_in_day", 1),
                planned_arrival=s.get("planned_arrival"),
                planned_departure=s.get("planned_departure"),
                suggested_duration_minutes=s.get("suggested_duration_minutes", 45),
                actual_duration_minutes=s.get("actual_duration_minutes"),
                is_pinned=s.get("is_pinned", False),
                visit_status=s.get("visit_status", "pending"),
                source_attribution=s.get("source_attribution"),
                private_notes=s.get("private_notes"),
            )
        )

    # Persist provisional proposal in database
    proposal_payload = {
        "candidate_stops": [c.model_dump(mode="json") for c in candidate_stop_responses],
        "validation_diff": validation_diff.model_dump(mode="json"),
        "total_estimated_cost_inr": total_cost,
        "total_estimated_duration_minutes": total_duration,
        "route_geometry": route_geometry,
    }

    await db.execute(
        text("""
            INSERT INTO replan_proposals (
                id, trip_id, base_revision, requested_by, operations,
                candidate_stops, validation_diff, is_feasible, status, expires_at
            ) VALUES (
                :id, :trip_id, :base_rev, :requested_by, CAST(:ops AS jsonb),
                CAST(:stops AS jsonb), CAST(:diff AS jsonb), :is_feasible, 'pending', :expires_at
            )
        """),
        {
            "id": proposal_id,
            "trip_id": trip_id,
            "base_rev": body.base_revision,
            "requested_by": body.requested_by,
            "ops": json.dumps([op.model_dump(mode="json") for op in body.operations]),
            "stops": json.dumps(proposal_payload),
            "diff": json.dumps(validation_diff.model_dump(mode="json")),
            "is_feasible": is_feasible,
            "expires_at": expires_at,
        }
    )
    await db.commit()

    return ReplanProposalResponse(
        proposal_id=proposal_id,
        base_revision=body.base_revision,
        is_feasible=is_feasible,
        validation_diff=validation_diff,
        candidate_stops=candidate_stop_responses,
        expires_at=expires_at,
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
    On revision match, executes atomic transaction updating revision, versions, stops, and events.
    """
    trip_res = await db.execute(
        text("SELECT * FROM trips WHERE id = :id FOR UPDATE"),
        {"id": trip_id}
    )
    trip = trip_res.fetchone()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Optimistic Concurrency Check
    if trip.revision != body.expected_revision:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "detail": f"Revision mismatch. Expected revision {body.expected_revision}, but trip has already progressed to revision {trip.revision}. Please refresh and review latest plan.",
                "current_revision": trip.revision
            }
        )

    # Retrieve proposal
    prop_res = await db.execute(
        text("SELECT * FROM replan_proposals WHERE id = :pid AND trip_id = :trip_id"),
        {"pid": body.proposal_id, "trip_id": trip_id}
    )
    proposal = prop_res.fetchone()
    if not proposal:
        raise HTTPException(status_code=404, detail="Replan proposal not found")

    if proposal.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Proposal cannot be accepted because its status is '{proposal.status}'"
        )

    now_utc = datetime.now(timezone.utc)
    if proposal.expires_at < now_utc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Proposal has expired. Please re-preview."
        )

    # Extract stored proposal payload
    stops_payload = proposal.candidate_stops
    if isinstance(stops_payload, str):
        stops_payload = json.loads(stops_payload)

    candidate_stops = stops_payload.get("candidate_stops", [])
    total_cost = float(stops_payload.get("total_estimated_cost_inr", 0.0))
    total_dur = int(stops_payload.get("total_estimated_duration_minutes", 0))
    route_geom = stops_payload.get("route_geometry", {})

    new_revision = trip.revision + 1
    new_version_id = f"ver_{trip_id}_{new_revision}_{uuid.uuid4().hex[:6]}"

    # 1. Insert new itinerary_versions record
    await db.execute(
        text("""
            INSERT INTO itinerary_versions (
                id, trip_id, version_number, total_estimated_cost_inr,
                total_estimated_duration_minutes, route_geometry
            ) VALUES (
                :vid, :trip_id, :vnum, :cost, :dur, CAST(:geom AS jsonb)
            )
        """),
        {
            "vid": new_version_id,
            "trip_id": trip_id,
            "vnum": new_revision,
            "cost": total_cost,
            "dur": total_dur,
            "geom": json.dumps(route_geom),
        }
    )

    # 2. Insert new trip_stops snapshot
    for s in candidate_stops:
        stop_id = f"stop_{uuid.uuid4().hex[:10]}"
        arr_val = s.get("planned_arrival")
        dep_val = s.get("planned_departure")

        if isinstance(arr_val, str):
            try:
                arr_val = datetime.fromisoformat(arr_val.replace("Z", "+00:00"))
            except Exception:
                arr_val = None

        if isinstance(dep_val, str):
            try:
                dep_val = datetime.fromisoformat(dep_val.replace("Z", "+00:00"))
            except Exception:
                dep_val = None

        await db.execute(
            text("""
                INSERT INTO trip_stops (
                    id, trip_id, itinerary_version_id, place_id, day_number,
                    sequence_in_day, planned_arrival, planned_departure,
                    suggested_duration_minutes, actual_duration_minutes,
                    is_pinned, visit_status, source_attribution, private_notes
                ) VALUES (
                    :id, :trip_id, :vid, :place_id, :day_number,
                    :sequence_in_day, :planned_arrival, :planned_departure,
                    :suggested_duration_minutes, :actual_duration_minutes,
                    :is_pinned, :visit_status, :source_attribution, :private_notes
                )
            """),
            {
                "id": stop_id,
                "trip_id": trip_id,
                "vid": new_version_id,
                "place_id": s["place_id"],
                "day_number": s.get("day_number", 1),
                "sequence_in_day": s.get("sequence_in_day", 1),
                "planned_arrival": arr_val,
                "planned_departure": dep_val,
                "suggested_duration_minutes": s.get("suggested_duration_minutes", 45),
                "actual_duration_minutes": s.get("actual_duration_minutes"),
                "is_pinned": s.get("is_pinned", False),
                "visit_status": s.get("visit_status", "pending"),
                "source_attribution": s.get("source_attribution"),
                "private_notes": s.get("private_notes"),
            }
        )

    # 3. Update trips table atomically
    await db.execute(
        text("""
            UPDATE trips
            SET revision = :new_rev,
                current_itinerary_version_id = :new_vid,
                updated_at = NOW()
            WHERE id = :trip_id
        """),
        {"new_rev": new_revision, "new_vid": new_version_id, "trip_id": trip_id}
    )

    # 4. Mark proposal as accepted
    await db.execute(
        text("UPDATE replan_proposals SET status = 'accepted' WHERE id = :pid"),
        {"pid": body.proposal_id}
    )

    # 5. Append replan_committed audit record to trip_events
    event_payload = {
        "proposal_id": body.proposal_id,
        "operations": proposal.operations if not isinstance(proposal.operations, str) else json.loads(proposal.operations),
        "validation_diff": proposal.validation_diff if not isinstance(proposal.validation_diff, str) else json.loads(proposal.validation_diff),
        "new_version_id": new_version_id,
    }

    await db.execute(
        text("""
            INSERT INTO trip_events (
                id, trip_id, resulting_revision, actor, source, event_type, payload
            ) VALUES (
                :eid, :trip_id, :resulting_rev, :actor, :source, 'replan_committed', CAST(:payload AS jsonb)
            )
        """),
        {
            "eid": f"event_replan_{int(datetime.now(timezone.utc).timestamp() * 1000)}",
            "trip_id": trip_id,
            "resulting_rev": new_revision,
            "actor": "ai_assistant" if proposal.requested_by == "ai_assistant" else "user",
            "source": proposal.requested_by,
            "payload": json.dumps(event_payload),
        }
    )

    await db.commit()

    return ReplanAcceptResponse(
        success=True,
        new_revision=new_revision,
        message=f"Itinerary updated successfully to Revision {new_revision}"
    )


@router.get("/trips/{trip_id}/events", response_model=List[TripEventResponse])
async def get_trip_events(
    trip_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Fetch append-only trip event log for audit trail & AI context."""
    res = await db.execute(
        text("SELECT * FROM trip_events WHERE trip_id = :id ORDER BY created_at DESC LIMIT :limit"),
        {"id": trip_id, "limit": limit}
    )
    rows = res.fetchall()
    return [
        TripEventResponse(
            id=r.id,
            trip_id=r.trip_id,
            resulting_revision=r.resulting_revision,
            actor=r.actor,
            source=r.source,
            event_type=r.event_type,
            payload=r.payload if isinstance(r.payload, dict) else (json.loads(r.payload) if r.payload else None),
            created_at=r.created_at,
        )
        for r in rows
    ]
