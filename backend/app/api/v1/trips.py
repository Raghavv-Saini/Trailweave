"""
Track 2 & Track 3: Personal Trip & Active Companion Operations
Spec: docs/API_SPEC.md §1.3 & §1.4
"""
import json
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.database import get_db
from app.schemas.trips import TripResponse, TripStopResponse, ItineraryVersionResponse

router = APIRouter(tags=["Personal Trips & In-Trip Companion"])

PLACE_IMAGE_MAP = {
    "place_city_palace": "https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=900&q=80",
    "place_mohanlal_studio": "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=900&q=80",
    "place_jagdish_temple": "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=900&q=80",
    "place_bagore_haveli": "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=900&q=80",
    "place_saheliyon_bari": "https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=900&q=80",
    "place_sukhadia_circle": "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=80",
}
DEFAULT_PLACE_IMAGE = "https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=900&q=80"


class VisitCheckinRequest(BaseModel):
    checkin_method: str = "manual_fallback"  # "manual_fallback" or "geofence_proximity"
    arrival_timestamp: Optional[datetime] = None


class CheckoutRequest(BaseModel):
    checkout_method: str = "manual_tap"  # "manual_tap" or "grace_buffer_timeout"
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
            # Fetch stops joined with canonical place metadata
            stops_res = await db.execute(
                text("""
                    SELECT
                        s.*,
                        p.name,
                        p.address,
                        p.latitude,
                        p.longitude,
                        p.category,
                        p.entry_fee_inr
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
                    address=s.address,
                    latitude=float(s.latitude) if s.latitude is not None else None,
                    longitude=float(s.longitude) if s.longitude is not None else None,
                    category=s.category,
                    entry_fee_inr=float(s.entry_fee_inr) if s.entry_fee_inr is not None else 0.0,
                    image_url=PLACE_IMAGE_MAP.get(s.place_id, DEFAULT_PLACE_IMAGE),
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
    """Record an arrival check-in (geofence_proximity or manual_fallback)."""
    stop_res = await db.execute(
        text("SELECT * FROM trip_stops WHERE id = :stop_id AND trip_id = :trip_id"),
        {"stop_id": stop_id, "trip_id": trip_id}
    )
    stop = stop_res.fetchone()
    if not stop:
        raise HTTPException(status_code=404, detail="Trip stop not found")

    arrival_ts = (body.arrival_timestamp or datetime.now(timezone.utc)).isoformat()
    checkin_method = body.checkin_method if body.checkin_method in ("manual_fallback", "geofence_proximity") else "manual_fallback"

    await db.execute(
        text("UPDATE trip_stops SET visit_status = 'visited' WHERE id = :stop_id"),
        {"stop_id": stop_id}
    )

    payload_json = json.dumps({
        "stop_id": stop_id,
        "checkin_method": checkin_method,
        "arrival_timestamp": arrival_ts,
    })

    await db.execute(
        text("""
            INSERT INTO trip_events (id, trip_id, resulting_revision, actor, source, event_type, payload)
            VALUES (
                :eid, :trip_id,
                (SELECT revision FROM trips WHERE id = :trip_id),
                'user', :source, 'stop_visited',
                CAST(:payload AS jsonb)
            )
        """),
        {
            "eid": f"event_visit_{int(datetime.now(timezone.utc).timestamp() * 1000)}",
            "trip_id": trip_id,
            "source": checkin_method,
            "payload": payload_json
        }
    )
    await db.commit()
    return {
        "success": True,
        "stop_id": stop_id,
        "visit_status": "visited",
        "checkin_method": checkin_method,
        "arrival_timestamp": arrival_ts
    }


@router.post("/trips/{trip_id}/stops/{stop_id}/checkout")
async def record_stop_checkout(
    trip_id: str,
    stop_id: str,
    body: CheckoutRequest,
    db: AsyncSession = Depends(get_db)
):
    """Record departure checkout (manual_tap or grace_buffer_timeout)."""
    stop_res = await db.execute(
        text("SELECT * FROM trip_stops WHERE id = :stop_id AND trip_id = :trip_id"),
        {"stop_id": stop_id, "trip_id": trip_id}
    )
    stop = stop_res.fetchone()
    if not stop:
        raise HTTPException(status_code=404, detail="Trip stop not found")

    departure_ts = (body.departure_timestamp or datetime.now(timezone.utc)).isoformat()
    checkout_method = (
        body.checkout_method
        if body.checkout_method in ("manual_tap", "grace_buffer_timeout")
        else "manual_tap"
    )
    actual_duration = (
        int(stop.suggested_duration_minutes) + 20
        if checkout_method == "grace_buffer_timeout"
        else int(stop.suggested_duration_minutes)
    )

    await db.execute(
        text("""
            UPDATE trip_stops
            SET visit_status = 'visited',
                actual_duration_minutes = :actual_duration
            WHERE id = :stop_id
        """),
        {"stop_id": stop_id, "actual_duration": actual_duration}
    )

    payload_json = json.dumps({
        "stop_id": stop_id,
        "checkout_method": checkout_method,
        "departure_timestamp": departure_ts,
        "actual_duration_minutes": actual_duration,
    })

    actor = "system" if checkout_method == "grace_buffer_timeout" else "user"
    await db.execute(
        text("""
            INSERT INTO trip_events (id, trip_id, resulting_revision, actor, source, event_type, payload)
            VALUES (
                :eid, :trip_id,
                (SELECT revision FROM trips WHERE id = :trip_id),
                :actor, :source, 'stop_checkout',
                CAST(:payload AS jsonb)
            )
        """),
        {
            "eid": f"event_checkout_{int(datetime.now(timezone.utc).timestamp() * 1000)}",
            "trip_id": trip_id,
            "actor": actor,
            "source": checkout_method,
            "payload": payload_json
        }
    )
    await db.commit()

    return {
        "success": True,
        "stop_id": stop_id,
        "checkout_method": checkout_method,
        "departure_timestamp": departure_ts,
        "actual_duration_minutes": actual_duration
    }


@router.post("/trips/{trip_id}/publish-trail", status_code=status.HTTP_201_CREATED)
async def publish_trip_to_trail(
    trip_id: str,
    body: PublishTrailRequest,
    db: AsyncSession = Depends(get_db)
):
    """Convert finished trip into publicly visible Community Trail."""
    trip_res = await db.execute(
        text("SELECT * FROM trips WHERE id = :id"),
        {"id": trip_id}
    )
    trip = trip_res.fetchone()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    trail_id = f"trail_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
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
