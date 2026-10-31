"""
Track 2 & Track 3: Personal Trip & Active Companion Operations
Spec: docs/API_SPEC.md §1.3 & §1.4
"""
import json
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user_id
from app.schemas.trips import (
    BasketStopInput,
    TravelRequest,
    TripResponse,
    TripStopResponse,
    ItineraryVersionResponse,
)
from app.services.gemini import GeminiTrailDraftService
from app.services.planner import (
    PlaceCandidate,
    PlannerConfig,
    StartLocation,
    solve_itinerary,
)

router = APIRouter(tags=["Personal Trips & In-Trip Companion"])

PLACE_IMAGE_MAP = {
    "place_city_palace": "https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=900&q=80",
    "place_mohanlal_studio": "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=900&q=80",
    "place_pottery_studio": "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=900&q=80",
    "place_puppetry_workshop": "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=900&q=80",
    "place_leather_craft": "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=900&q=80",
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


class DraftTrailRequest(BaseModel):
    include_stop_ids: Optional[List[str]] = None
    vibe_hint: Optional[str] = None


class DraftTrailResponse(BaseModel):
    title: str
    description: str
    tags: List[str]
    estimated_budget_inr: float
    total_duration_hours: float


class PublishTrailRequest(BaseModel):
    title: str
    description: Optional[str] = None
    include_stop_ids: List[str]
    exclude_private_notes: bool = True
    tags: List[str] = ["heritage"]
    visibility: str = "public"


async def _fetch_places_with_artisan_info(
    db: AsyncSession, place_ids: List[str]
) -> Dict[str, Any]:
    """Fetch canonical places with aggregated approved artisan workshop metadata (safe for 1:N artisans)."""
    if not place_ids:
        return {}
    places_res = await db.execute(
        text("""
            SELECT
                p.id,
                p.name,
                p.category,
                p.latitude,
                p.longitude,
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
                p.id, p.name, p.category, p.latitude, p.longitude,
                p.entry_fee_inr, p.typical_duration_minutes, p.opening_time, p.closing_time
        """),
        {"pids": list(set(place_ids))},
    )
    return {r.id: r for r in places_res.fetchall()}


def _build_place_candidate(row: Any, stop: BasketStopInput) -> PlaceCandidate:
    """Map database place row + stop input metadata into a PlaceCandidate."""
    return PlaceCandidate(
        id=row.id,
        name=row.name,
        category=row.category,
        latitude=float(row.latitude),
        longitude=float(row.longitude),
        entry_fee_inr=float(row.entry_fee_inr or 0),
        typical_duration_minutes=int(row.typical_duration_minutes or 45),
        opening_time=row.opening_time,
        closing_time=row.closing_time,
        has_workshop=bool(row.has_workshop),
        workshop_fee_inr=float(row.workshop_fee_inr or 0),
        workshop_duration_minutes=int(row.workshop_duration_minutes or 45),
        day_number=stop.day_number,
        sequence_in_day=stop.sequence_in_day,
        suggested_duration_minutes=stop.suggested_duration_minutes,
        time_slot=stop.time_slot,
        source_attribution=stop.source_attribution,
        private_notes=stop.private_notes,
    )


async def _load_candidates_from_request(
    body: TravelRequest, db: AsyncSession
) -> tuple[List[PlaceCandidate], str, int]:
    """Load PlaceCandidate list from either source_trail_id, stops basket, or place_ids."""
    inferred_title = body.title
    inferred_total_days = body.total_days

    if body.source_trail_id:
        trail_res = await db.execute(
            text("SELECT * FROM community_trails WHERE id = :tid"),
            {"tid": body.source_trail_id},
        )
        trail = trail_res.fetchone()
        if not trail:
            raise HTTPException(status_code=404, detail="Source community trail not found")
        if not inferred_title:
            inferred_title = trail.title
        if trail.total_days and trail.total_days > inferred_total_days:
            inferred_total_days = trail.total_days

        ts_res = await db.execute(
            text("""
                SELECT
                    place_id, day_number, sequence_in_day,
                    suggested_duration_minutes, time_slot, traveler_tip
                FROM community_trail_stops
                WHERE trail_id = :tid
                ORDER BY day_number, sequence_in_day
            """),
            {"tid": body.source_trail_id},
        )
        stop_inputs = [
            BasketStopInput(
                place_id=r.place_id,
                day_number=r.day_number,
                sequence_in_day=r.sequence_in_day,
                suggested_duration_minutes=r.suggested_duration_minutes,
                time_slot=r.time_slot,
                source_attribution=trail.author_name,
                private_notes=r.traveler_tip,
            )
            for r in ts_res.fetchall()
        ]
    else:
        stop_inputs = list(body.stops)
        if not stop_inputs and body.place_ids:
            seen: set[str] = set()
            for pid in body.place_ids:
                if pid not in seen:
                    seen.add(pid)
                    stop_inputs.append(BasketStopInput(place_id=pid))

    if not stop_inputs:
        raise HTTPException(
            status_code=400,
            detail="Must provide place_ids, stops, or source_trail_id to plan a trip.",
        )

    place_ids = [s.place_id for s in stop_inputs]
    place_map = await _fetch_places_with_artisan_info(db, place_ids)
    missing = [pid for pid in place_ids if pid not in place_map]
    if missing:
        raise HTTPException(
            status_code=404, detail=f"Canonical places not found: {missing}"
        )

    candidates = [_build_place_candidate(place_map[s.place_id], s) for s in stop_inputs]
    return candidates, inferred_title or "My Udaipur Cultural Journey", inferred_total_days


@router.post("/trips", response_model=TripResponse, status_code=status.HTTP_201_CREATED)
async def create_planned_trip(
    body: TravelRequest,
    db: AsyncSession = Depends(get_db),
):
    """Plan and persist an authoritative personal trip (revision = 1) using the deterministic solver."""
    candidates, trip_title, total_days = await _load_candidates_from_request(body, db)

    # Preserve curated sequence when cloning community trail unless user explicitly requests re-optimization
    optimize_route = body.optimize_route
    if body.source_trail_id and "optimize_route" not in body.model_fields_set:
        optimize_route = False

    config = PlannerConfig(
        start_location=StartLocation(
            name=body.start_location.name,
            latitude=body.start_location.latitude,
            longitude=body.start_location.longitude,
        ),
        start_datetime=body.start_datetime,
        total_days=total_days,
        budget_inr=body.budget_inr,
        budget_mode=body.budget_mode,
        travel_mode=body.travel_mode,
        artisan_preference=body.artisan_preference,
        optimize_route=optimize_route,
        google_maps_api_key=settings.GOOGLE_MAPS_API_KEY,
    )

    plan = await solve_itinerary(candidates, config)

    if not plan.is_feasible and not body.allow_warnings:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Schedule violates budget or venue operating hour constraints.",
                "is_feasible": False,
                "budget_exceeded": plan.budget_exceeded,
                "total_estimated_cost_inr": plan.total_estimated_cost_inr,
                "budget_limit_inr": plan.budget_limit_inr,
                "closing_hour_conflicts": plan.closing_hour_conflicts,
            },
        )

    trip_id = f"trip_{uuid.uuid4().hex[:10]}"
    version_id = f"ver_{uuid.uuid4().hex[:10]}"
    duration_type = "multi_day" if total_days > 1 else "single_day"

    await db.execute(
        text("""
            INSERT INTO trips (
                id, user_id, title, destination, duration_type, total_days,
                budget_inr, budget_mode, artisan_preference, revision,
                current_itinerary_version_id, status
            ) VALUES (
                :id, :user_id, :title, :destination, :duration_type, :total_days,
                :budget_inr, :budget_mode, :artisan_preference, 1,
                :version_id, 'planned'
            )
        """),
        {
            "id": trip_id,
            "user_id": body.user_id,
            "title": trip_title,
            "destination": body.destination,
            "duration_type": duration_type,
            "total_days": total_days,
            "budget_inr": body.budget_inr,
            "budget_mode": body.budget_mode,
            "artisan_preference": body.artisan_preference,
            "version_id": version_id,
        },
    )

    await db.execute(
        text("""
            INSERT INTO itinerary_versions (
                id, trip_id, version_number, total_estimated_cost_inr,
                total_estimated_duration_minutes, route_geometry
            ) VALUES (
                :id, :trip_id, 1, :cost, :duration, CAST(:route_geometry AS jsonb)
            )
        """),
        {
            "id": version_id,
            "trip_id": trip_id,
            "cost": plan.total_estimated_cost_inr,
            "duration": plan.total_estimated_duration_minutes,
            "route_geometry": json.dumps(plan.route_geometry),
        },
    )

    stop_responses: List[TripStopResponse] = []
    for s in plan.stops:
        stop_id = f"stop_{uuid.uuid4().hex[:10]}"
        await db.execute(
            text("""
                INSERT INTO trip_stops (
                    id, trip_id, itinerary_version_id, place_id, day_number,
                    sequence_in_day, planned_arrival, planned_departure,
                    suggested_duration_minutes, is_pinned, visit_status,
                    source_attribution, private_notes
                ) VALUES (
                    :id, :trip_id, :version_id, :place_id, :day_number,
                    :sequence_in_day, :planned_arrival, :planned_departure,
                    :suggested_duration_minutes, FALSE, 'pending',
                    :source_attribution, :private_notes
                )
            """),
            {
                "id": stop_id,
                "trip_id": trip_id,
                "version_id": version_id,
                "place_id": s.place_id,
                "day_number": s.day_number,
                "sequence_in_day": s.sequence_in_day,
                "planned_arrival": s.planned_arrival,
                "planned_departure": s.planned_departure,
                "suggested_duration_minutes": s.suggested_duration_minutes,
                "source_attribution": s.source_attribution,
                "private_notes": s.private_notes,
            },
        )
        stop_responses.append(
            TripStopResponse(
                id=stop_id,
                trip_id=trip_id,
                place_id=s.place_id,
                name=s.name,
                day_number=s.day_number,
                sequence_in_day=s.sequence_in_day,
                planned_arrival=s.planned_arrival,
                planned_departure=s.planned_departure,
                suggested_duration_minutes=s.suggested_duration_minutes,
                actual_duration_minutes=None,
                is_pinned=False,
                visit_status="pending",
                source_attribution=s.source_attribution,
                private_notes=s.private_notes,
            )
        )

    # Record initial trip creation audit event
    await db.execute(
        text("""
            INSERT INTO trip_events (id, trip_id, resulting_revision, actor, source, event_type, payload)
            VALUES (
                :eid, :trip_id, 1, 'user', 'itinerary_planner', 'trip_created',
                CAST(:payload AS jsonb)
            )
        """),
        {
            "eid": f"event_create_{uuid.uuid4().hex[:10]}",
            "trip_id": trip_id,
            "payload": json.dumps({
                "trip_id": trip_id,
                "title": trip_title,
                "version_id": version_id,
                "total_days": total_days,
                "stop_count": len(plan.stops),
                "total_estimated_cost_inr": plan.total_estimated_cost_inr,
                "total_estimated_duration_minutes": plan.total_estimated_duration_minutes,
                "is_feasible": plan.is_feasible,
            }),
        },
    )

    await db.commit()

    return TripResponse(
        id=trip_id,
        user_id=body.user_id,
        title=trip_title,
        destination=body.destination,
        duration_type=duration_type,
        total_days=total_days,
        budget_inr=body.budget_inr,
        budget_mode=body.budget_mode,
        artisan_preference=body.artisan_preference,
        revision=1,
        current_itinerary_version_id=version_id,
        status="planned",
        warnings=plan.closing_hour_conflicts,
        active_version=ItineraryVersionResponse(
            id=version_id,
            trip_id=trip_id,
            version_number=1,
            total_estimated_cost_inr=plan.total_estimated_cost_inr,
            total_estimated_duration_minutes=plan.total_estimated_duration_minutes,
            route_geometry=plan.route_geometry,
            stops=stop_responses,
        ),
    )


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
                route_geometry=getattr(v, "route_geometry", None),
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
    # Generate contextual transition notification for Web Push & In-App Concierge
    from app.services.gemini import GeminiCompanionService
    companion_service = GeminiCompanionService()
    transition_tip = await companion_service.generate_transition_notification(
        trip_id=trip_id,
        completed_stop_id=stop_id,
        db=db
    )

    await db.execute(
        text("""
            INSERT INTO trip_events (id, trip_id, resulting_revision, actor, source, event_type, payload)
            VALUES (
                :eid, :trip_id,
                (SELECT revision FROM trips WHERE id = :trip_id),
                'system', 'web_push_service', 'transition_notification_dispatched',
                CAST(:payload AS jsonb)
            )
        """),
        {
            "eid": f"event_notif_{int(datetime.now(timezone.utc).timestamp() * 1000)}",
            "trip_id": trip_id,
            "payload": json.dumps(transition_tip)
        }
    )
    await db.commit()

    return {
        "success": True,
        "stop_id": stop_id,
        "checkout_method": checkout_method,
        "departure_timestamp": departure_ts,
        "actual_duration_minutes": actual_duration,
        "transition_notification": transition_tip
    }


@router.post("/trips/{trip_id}/draft-trail-content", response_model=DraftTrailResponse)
async def draft_trail_content(
    trip_id: str,
    body: DraftTrailRequest,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Prompts Gemini Flash to compose an engaging trail title, markdown overview,
    estimated budget, and relevant tags from confirmed visited stops (Trip-to-Trail AI draft).
    """
    trip_res = await db.execute(text("SELECT * FROM trips WHERE id = :id"), {"id": trip_id})
    trip = trip_res.fetchone()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if trip.user_id and trip.user_id not in ("tourist_demo_user", current_user_id):
        raise HTTPException(status_code=403, detail="Not authorized to access this trip")

    if body.include_stop_ids:
        query = text("""
            SELECT ts.id, ts.place_id, ts.suggested_duration_minutes, p.name, p.category, p.entry_fee_inr
            FROM trip_stops ts
            JOIN places p ON ts.place_id = p.id
            WHERE ts.trip_id = :trip_id
              AND ts.id = ANY(:include_ids)
              AND ts.visit_status = 'visited'
              AND p.category NOT IN ('accommodation', 'hotel', 'homestay', 'lodging', 'start_location', 'origin')
            ORDER BY ts.day_number ASC, ts.sequence_in_day ASC
        """)
        params = {"trip_id": trip_id, "include_ids": body.include_stop_ids}
    else:
        query = text("""
            SELECT ts.id, ts.place_id, ts.suggested_duration_minutes, p.name, p.category, p.entry_fee_inr
            FROM trip_stops ts
            JOIN places p ON ts.place_id = p.id
            WHERE ts.trip_id = :trip_id
              AND ts.visit_status = 'visited'
              AND p.category NOT IN ('accommodation', 'hotel', 'homestay', 'lodging', 'start_location', 'origin')
            ORDER BY ts.day_number ASC, ts.sequence_in_day ASC
        """)
        params = {"trip_id": trip_id}

    stops_res = await db.execute(query, params)
    rows = stops_res.fetchall()
    visited_places = [
        {
            "id": r.id,
            "place_id": r.place_id,
            "name": r.name,
            "category": r.category,
            "entry_fee_inr": float(r.entry_fee_inr or 0),
            "suggested_duration_minutes": r.suggested_duration_minutes or 45,
        }
        for r in rows
    ]

    draft_service = GeminiTrailDraftService(api_key=settings.GEMINI_API_KEY)
    result = await draft_service.generate_trail_draft(visited_places, vibe_hint=body.vibe_hint)
    return DraftTrailResponse(**result)


@router.post("/trips/{trip_id}/publish-trail", status_code=status.HTTP_201_CREATED)
async def publish_trip_to_trail(
    trip_id: str,
    body: PublishTrailRequest,
    current_user_id: str = Depends(get_current_user_id),
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

    if trip.user_id and trip.user_id not in ("tourist_demo_user", current_user_id):
        raise HTTPException(status_code=403, detail="Not authorized to publish this trip")

    if not body.include_stop_ids:
        raise HTTPException(status_code=400, detail="Cannot publish trail without any included stops")

    # Fetch candidate stops strictly matching include_stop_ids, confirmed visited, and non-accommodation places
    stops_res = await db.execute(
        text("""
            SELECT 
                ts.id,
                ts.place_id,
                ts.day_number,
                ts.sequence_in_day,
                ts.suggested_duration_minutes,
                ts.actual_duration_minutes,
                ts.planned_arrival,
                ts.visit_status,
                ts.private_notes,
                p.name AS place_name,
                p.category AS place_category,
                p.entry_fee_inr,
                p.typical_duration_minutes
            FROM trip_stops ts
            JOIN places p ON ts.place_id = p.id
            WHERE ts.trip_id = :trip_id
              AND ts.id = ANY(:include_ids)
              AND ts.visit_status = 'visited'
              AND p.category NOT IN ('accommodation', 'hotel', 'homestay', 'lodging', 'start_location', 'origin')
            ORDER BY ts.day_number ASC, ts.sequence_in_day ASC
        """),
        {"trip_id": trip_id, "include_ids": body.include_stop_ids}
    )
    stops = stops_res.fetchall()
    if not stops:
        raise HTTPException(
            status_code=400,
            detail="No confirmed visited public stops found in the provided stop list"
        )

    # Compute aggregates from visited stops
    total_minutes = sum(s.suggested_duration_minutes or 45 for s in stops)
    total_duration_hours = round(max(total_minutes / 60.0, 1.0), 1)
    estimated_cost_inr = sum(float(s.entry_fee_inr or 0) for s in stops)
    total_days = max(s.day_number for s in stops) if stops else 1
    duration_type = "single_day" if total_days == 1 else "multi_day"

    trail_id = f"trail_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6]}"
    author_name = "Fellow Traveler"

    try:
        # Insert Community Trail
        await db.execute(
            text("""
                INSERT INTO community_trails (
                    id, author_id, author_name, source_trip_id, title, description,
                    destination, duration_type, total_days, total_duration_hours, estimated_cost_inr,
                    tags, is_experienced, visibility, is_featured, created_at
                ) VALUES (
                    :id, :author_id, :author_name, :trip_id, :title, :description,
                    'Udaipur', :duration_type, :total_days, :total_duration_hours, :cost,
                    :tags, true, :visibility, false, NOW()
                )
            """),
            {
                "id": trail_id,
                "author_id": trip.user_id,
                "author_name": author_name,
                "trip_id": trip.id,
                "title": body.title,
                "description": body.description or "A curated local journey through Udaipur.",
                "duration_type": duration_type,
                "total_days": total_days,
                "total_duration_hours": total_duration_hours,
                "cost": estimated_cost_inr,
                "tags": body.tags or ["heritage"],
                "visibility": body.visibility or "public"
            }
        )

        # Insert child Community Trail Stops with relative timing
        community_stops = []
        day_sequences: Dict[int, int] = {}
        for s in stops:
            day_num = s.day_number or 1
            day_sequences[day_num] = day_sequences.get(day_num, 0) + 1
            seq_in_day = day_sequences[day_num]

            # Determine relative time slot
            if s.planned_arrival:
                try:
                    arrival_hour = s.planned_arrival.hour
                    if 5 <= arrival_hour < 12:
                        time_slot = "morning"
                    elif 12 <= arrival_hour < 17:
                        time_slot = "afternoon"
                    elif 17 <= arrival_hour < 20:
                        time_slot = "sunset_evening"
                    else:
                        time_slot = "night"
                except Exception:
                    time_slot = "morning" if seq_in_day == 1 else "afternoon"
            else:
                time_slot = "morning" if seq_in_day == 1 else ("afternoon" if seq_in_day == 2 else "sunset_evening")

            # Traveler tip - strictly scrub private notes if exclude_private_notes is True
            if body.exclude_private_notes:
                traveler_tip = f"Verified stop: {s.place_name}. Recommended duration {s.suggested_duration_minutes}m."
            else:
                traveler_tip = s.private_notes or f"Verified stop: {s.place_name}."

            stop_id = f"cts_{trail_id}_{day_num}_{seq_in_day}"
            await db.execute(
                text("""
                    INSERT INTO community_trail_stops (
                        id, trail_id, place_id, day_number, sequence_in_day,
                        suggested_duration_minutes, estimated_transit_minutes,
                        time_slot, traveler_tip
                    ) VALUES (
                        :id, :trail_id, :place_id, :day_number, :sequence_in_day,
                        :suggested_duration_minutes, 15,
                        :time_slot, :traveler_tip
                    )
                """),
                {
                    "id": stop_id,
                    "trail_id": trail_id,
                    "place_id": s.place_id,
                    "day_number": day_num,
                    "sequence_in_day": seq_in_day,
                    "suggested_duration_minutes": s.suggested_duration_minutes or 45,
                    "time_slot": time_slot,
                    "traveler_tip": traveler_tip
                }
            )

            community_stops.append({
                "id": stop_id,
                "place_id": s.place_id,
                "place_name": s.place_name,
                "day_number": day_num,
                "sequence_in_day": seq_in_day,
                "suggested_duration_minutes": s.suggested_duration_minutes or 45,
                "estimated_transit_minutes": 15,
                "time_slot": time_slot,
                "traveler_tip": traveler_tip
            })

        # Mark the trip as completed
        await db.execute(
            text("UPDATE trips SET status = 'completed', completed_at = NOW() WHERE id = :id"),
            {"id": trip_id}
        )

        # Log audit event in trip_events
        await db.execute(
            text("""
                INSERT INTO trip_events (
                    id, trip_id, resulting_revision, actor, source, event_type, payload
                ) VALUES (
                    :eid, :trip_id, :rev, 'tourist', 'trip_to_trail', 'trip_published', :payload
                )
            """),
            {
                "eid": f"event_pub_{int(datetime.now(timezone.utc).timestamp() * 1000)}",
                "trip_id": trip_id,
                "rev": trip.revision,
                "payload": json.dumps({"trail_id": trail_id, "stops_count": len(community_stops)})
            }
        )

        await db.commit()

    except Exception:
        await db.rollback()
        raise

    return {
        "id": trail_id,
        "author_id": trip.user_id,
        "author_name": author_name,
        "source_trip_id": trip.id,
        "title": body.title,
        "description": body.description or "A curated local journey through Udaipur.",
        "destination": "Udaipur",
        "duration_type": duration_type,
        "total_days": total_days,
        "total_duration_hours": total_duration_hours,
        "estimated_cost_inr": estimated_cost_inr,
        "tags": body.tags or ["heritage"],
        "is_experienced": True,
        "visibility": body.visibility or "public",
        "is_featured": False,
        "stops_count": len(community_stops),
        "stops": community_stops
    }
