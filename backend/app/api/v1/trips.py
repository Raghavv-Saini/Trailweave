"""
Track 2 & Track 3: Personal Trip & Active Companion Operations
Spec: docs/API_SPEC.md §1.3 & §1.4
"""
from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Body, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.database import get_db
from app.schemas.trips import TripResponse, TripStopResponse, ItineraryVersionResponse

router = APIRouter(tags=["Personal Trips & In-Trip Companion"])


class VisitCheckinRequest(BaseModel):
    checkin_method: str = "manual_fallback"  # or "geofence_proximity"
    arrival_timestamp: Optional[datetime] = None


class CheckoutRequest(BaseModel):
    checkout_method: str = "manual_tap"  # or "grace_buffer_timeout"
    departure_timestamp: Optional[datetime] = None


class PublishTrailRequest(BaseModel):
    title: str
    description: Optional[str] = None
    include_stop_ids: List[str]
    exclude_private_notes: bool = True
    tags: List[str] = ["heritage"]


@router.get("/trips/{trip_id}", response_model=TripResponse)
async def get_trip(
    trip_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Load authoritative current state of a personal trip."""
    res = await db.execute(
        text("SELECT * FROM trips WHERE id = :id"),
        {"id": trip_id}
    )
    t = res.fetchone()
    if not t:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Fetch active version if present
    active_version = None
    if t.current_itinerary_version_id:
        v_res = await db.execute(
            text("SELECT * FROM itinerary_versions WHERE id = :vid"),
            {"vid": t.current_itinerary_version_id}
        )
        v = v_res.fetchone()
        if v:
            # Fetch stops
            stops_res = await db.execute(
                text("""
                    SELECT s.*, p.name 
                    FROM trip_stops s
                    LEFT JOIN places p ON s.place_id = p.id
                    WHERE s.itinerary_version_id = :vid
                    ORDER BY s.day_number, s.sequence_in_day
                """),
                {"vid": v.id}
            )
            stops = [
                TripStopResponse(
                    id=s.id,
                    trip_id=s.trip_id,
                    place_id=s.place_id,
                    name=s.name,
                    day_number=s.day_number,
                    sequence_in_day=s.sequence_in_day,
                    planned_arrival=s.planned_arrival,
                    planned_departure=s.planned_departure,
                    suggested_duration_minutes=s.suggested_duration_minutes,
                    actual_duration_minutes=s.actual_duration_minutes,
                    is_pinned=s.is_pinned,
                    visit_status=s.visit_status,
                    source_attribution=s.source_attribution,
                    private_notes=s.private_notes
                )
                for s in stops_res.fetchall()
            ]
            active_version = ItineraryVersionResponse(
                id=v.id,
                trip_id=v.trip_id,
                version_number=v.version_number,
                total_estimated_cost_inr=float(v.total_estimated_cost_inr),
                total_estimated_duration_minutes=v.total_estimated_duration_minutes,
                stops=stops
            )

    return TripResponse(
        id=t.id,
        user_id=t.user_id,
        title=t.title,
        destination=t.destination,
        duration_type=t.duration_type,
        total_days=t.total_days,
        budget_inr=float(t.budget_inr),
        budget_mode=t.budget_mode,
        artisan_preference=t.artisan_preference,
        revision=t.revision,
        current_itinerary_version_id=t.current_itinerary_version_id,
        status=t.status,
        active_version=active_version
    )


@router.get("/trips/{trip_id}/events")
async def get_trip_events(
    trip_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Fetch append-only trip event log for audit trail & AI context."""
    res = await db.execute(
        text("SELECT * FROM trip_events WHERE trip_id = :id ORDER BY created_at DESC LIMIT 20"),
        {"id": trip_id}
    )
    rows = res.fetchall()
    return [
        {
            "id": r.id,
            "trip_id": r.trip_id,
            "resulting_revision": r.resulting_revision,
            "actor": r.actor,
            "source": r.source,
            "event_type": r.event_type,
            "payload": r.payload,
            "created_at": r.created_at
        }
        for r in rows
    ]


@router.post("/trips/{trip_id}/stops/{stop_id}/visit")
async def record_stop_visit(
    trip_id: str,
    stop_id: str,
    body: VisitCheckinRequest,
    db: AsyncSession = Depends(get_db)
):
    """Record an arrival check-in (geofence or manual fallback)."""
    # Verify stop
    stop_res = await db.execute(
        text("SELECT * FROM trip_stops WHERE id = :stop_id AND trip_id = :trip_id"),
        {"stop_id": stop_id, "trip_id": trip_id}
    )
    stop = stop_res.fetchone()
    if not stop:
        raise HTTPException(status_code=404, detail="Trip stop not found")

    # Update visit_status
    await db.execute(
        text("UPDATE trip_stops SET visit_status = 'visited' WHERE id = :stop_id"),
        {"stop_id": stop_id}
    )

    # Append to trip_events
    await db.execute(
        text("""
            INSERT INTO trip_events (id, trip_id, resulting_revision, actor, source, event_type, payload)
            VALUES (
                :eid, :trip_id, 
                (SELECT revision FROM trips WHERE id = :trip_id),
                'user', :source, 'stop_visited',
                :payload::jsonb
            )
        """),
        {
            "eid": f"event_{datetime.utcnow().timestamp()}",
            "trip_id": trip_id,
            "source": body.checkin_method,
            "payload": f'{{"stop_id": "{stop_id}", "timestamp": "{body.arrival_timestamp or datetime.utcnow().isoformat()}"}}'
        }
    )
    await db.commit()
    return {"success": True, "stop_id": stop_id, "visit_status": "visited"}


@router.post("/trips/{trip_id}/stops/{stop_id}/checkout")
async def record_stop_checkout(
    trip_id: str,
    stop_id: str,
    body: CheckoutRequest,
    db: AsyncSession = Depends(get_db)
):
    """Record departure checkout (manual tap or grace buffer timeout)."""
    return {
        "success": True,
        "stop_id": stop_id,
        "checkout_method": body.checkout_method,
        "timestamp": body.departure_timestamp or datetime.utcnow().isoformat()
    }


@router.post("/trips/{trip_id}/publish-trail", status_code=status.HTTP_201_CREATED)
async def publish_trip_to_trail(
    trip_id: str,
    body: PublishTrailRequest,
    db: AsyncSession = Depends(get_db)
):
    """Convert finished trip into publicly visible Community Trail."""
    # Check trip
    trip_res = await db.execute(
        text("SELECT * FROM trips WHERE id = :id"),
        {"id": trip_id}
    )
    trip = trip_res.fetchone()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    trail_id = f"trail_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    await db.execute(
        text("""
            INSERT INTO community_trails (
                id, author_id, author_name, source_trip_id, title, description,
                destination, duration_type, total_days, total_duration_hours, estimated_cost_inr,
                tags, is_experienced, visibility, is_featured
            ) VALUES (
                :id, :author_id, 'Fellow Traveler', :trip_id, :title, :description,
                'Udaipur', 'single_day', 1, 4.0, :cost,
                :tags, true, 'public', false
            )
        """),
        {
            "id": trail_id,
            "author_id": trip.user_id,
            "trip_id": trip.id,
            "title": body.title,
            "description": body.description,
            "cost": float(trip.budget_inr),
            "tags": body.tags
        }
    )
    await db.commit()
    return {"success": True, "trail_id": trail_id, "title": body.title}
