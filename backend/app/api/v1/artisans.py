"""
Track 2 & Track 4: Artisan Studio Directory & Recommendation Endpoints
Spec: docs/API_SPEC.md §1.2 & §1.3
"""
import json
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.database import get_db
from app.schemas.artisans import (
    ArtisanResponse,
    ArtisanRecommendationResponse,
    ArtisanRecommendationItem,
    TransientArtisanRecommendationRequest,
)
from app.engine.artisan_scorer import ArtisanRecommendationScorer

router = APIRouter(tags=["Artisan Directory & Recommendations"])


@router.get("/artisans", response_model=List[ArtisanResponse])
async def list_artisans(
    has_workshop: Optional[bool] = Query(None, description="Filter for hands-on workshops"),
    max_fee: Optional[float] = Query(None, description="Max workshop fee in INR"),
    craft_type: Optional[str] = Query(None, description="Filter by craft type"),
    db: AsyncSession = Depends(get_db)
):
    """Browse verified Udaipur artisan studios and masterclasses."""
    query = """
        SELECT a.*, p.address
        FROM artisans a
        LEFT JOIN places p ON a.place_id = p.id
        WHERE a.profile_status = 'approved'
    """
    params = {}
    if has_workshop is not None:
        query += " AND a.has_workshop = :has_workshop"
        params["has_workshop"] = has_workshop
    if max_fee is not None:
        query += " AND a.workshop_fee_inr <= :max_fee"
        params["max_fee"] = max_fee
    if craft_type:
        query += " AND a.craft_type ILIKE :craft_type"
        params["craft_type"] = f"%{craft_type}%"

    query += " ORDER BY a.created_at DESC"

    res = await db.execute(text(query), params)
    rows = res.fetchall()

    return [
        ArtisanResponse(
            id=r.id,
            artisan_name=r.artisan_name,
            craft_type=r.craft_type,
            place_id=r.place_id,
            address=r.address,
            phone_number=r.phone_number,
            bio=r.bio,
            has_workshop=r.has_workshop,
            workshop_fee_inr=float(r.workshop_fee_inr) if r.workshop_fee_inr else 0.0,
            workshop_duration_minutes=r.workshop_duration_minutes,
            workshop_description=r.workshop_description,
            profile_status=r.profile_status
        )
        for r in rows
    ]


@router.get("/artisans/{artisan_id}", response_model=ArtisanResponse)
async def get_artisan_details(
    artisan_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Fetch complete artisan profile and workshop offerings."""
    res = await db.execute(
        text("""
            SELECT a.*, p.address
            FROM artisans a
            LEFT JOIN places p ON a.place_id = p.id
            WHERE a.id = :id AND a.profile_status = 'approved'
        """),
        {"id": artisan_id}
    )
    r = res.fetchone()
    if not r:
        raise HTTPException(status_code=404, detail="Artisan studio not found")

    return ArtisanResponse(
        id=r.id,
        artisan_name=r.artisan_name,
        craft_type=r.craft_type,
        place_id=r.place_id,
        address=r.address,
        phone_number=r.phone_number,
        bio=r.bio,
        has_workshop=r.has_workshop,
        workshop_fee_inr=float(r.workshop_fee_inr) if r.workshop_fee_inr else 0.0,
        workshop_duration_minutes=r.workshop_duration_minutes,
        workshop_description=r.workshop_description,
        profile_status=r.profile_status
    )


@router.get("/trips/{trip_id}/recommendations/artisans", response_model=ArtisanRecommendationResponse)
@router.get("/trips/{trip_id}/artisan-recommendations", response_model=ArtisanRecommendationResponse)
async def get_artisan_recommendations(
    trip_id: str,
    preference: Optional[str] = Query(None, description="Filter by preference: workshops, store_visits, or both"),
    max_detour_minutes: int = Query(15, description="Max allowed detour in minutes"),
    travel_mode: Optional[str] = Query(None, description="Override travel mode: walking, auto_rickshaw, cab"),
    db: AsyncSession = Depends(get_db)
):
    """
    Score and recommend nearby verified artisan studios along an active trip itinerary.
    Evaluates detour time along route stops, confirms opening hours, and checks budget headroom.
    """
    # 1. Fetch trip
    trip_res = await db.execute(
        text("SELECT * FROM trips WHERE id = :id"),
        {"id": trip_id}
    )
    trip = trip_res.fetchone()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    version_id = trip.current_itinerary_version_id

    # 2. Fetch current version stops
    stops_res = await db.execute(
        text("""
            SELECT ts.id, ts.place_id, ts.day_number, ts.sequence_in_day,
                   ts.suggested_duration_minutes, ts.visit_status, ts.is_pinned,
                   ts.planned_arrival, ts.planned_departure,
                   p.name, p.latitude, p.longitude, p.category, p.entry_fee_inr,
                   p.opening_time, p.closing_time
            FROM trip_stops ts
            JOIN places p ON ts.place_id = p.id
            WHERE ts.trip_id = :trip_id AND ts.itinerary_version_id = :ver_id
            ORDER BY ts.day_number ASC, ts.sequence_in_day ASC
        """),
        {"trip_id": trip_id, "ver_id": version_id}
    )
    stops_rows = stops_res.fetchall()
    route_stops = [dict(r._mapping) for r in stops_rows]

    # 3. Resolve preference and travel mode
    resolved_pref = preference or trip.artisan_preference or "both"
    resolved_mode = travel_mode
    if not resolved_mode:
        ver_res = await db.execute(
            text("SELECT route_geometry FROM itinerary_versions WHERE id = :id"),
            {"id": version_id}
        )
        ver_row = ver_res.fetchone()
        if ver_row and ver_row.route_geometry:
            try:
                geom = ver_row.route_geometry if isinstance(ver_row.route_geometry, dict) else json.loads(ver_row.route_geometry)
                resolved_mode = geom.get("travel_mode")
            except Exception:
                pass
    if not resolved_mode:
        resolved_mode = "auto_rickshaw"

    # 4. Compute remaining budget
    total_budget = float(trip.budget_inr or 2000.0)
    spent = sum(
        float(s.get("entry_fee_inr") or 0.0)
        for s in route_stops
        if s.get("visit_status") != "skipped"
    )
    remaining_budget = max(0.0, total_budget - spent)

    # 5. Fetch approved artisans with place details
    art_res = await db.execute(
        text("""
            SELECT a.id, a.id as artisan_id, a.place_id, a.artisan_name, a.craft_type,
                   a.phone_number, a.bio, a.has_workshop, a.workshop_fee_inr,
                   a.workshop_duration_minutes, a.workshop_description,
                   p.name, p.latitude, p.longitude, p.address,
                   p.opening_time, p.closing_time, p.entry_fee_inr, p.typical_duration_minutes
            FROM artisans a
            JOIN places p ON a.place_id = p.id
            WHERE a.profile_status = 'approved'
        """)
    )
    art_rows = art_res.fetchall()
    candidates = [dict(r._mapping) for r in art_rows]

    # 6. Run Scorer
    scorer = ArtisanRecommendationScorer()
    scored = scorer.score_candidates(
        route_stops=route_stops,
        candidate_artisans=candidates,
        remaining_budget=remaining_budget,
        preference=resolved_pref,
        travel_mode=resolved_mode,
        max_detour_minutes=max_detour_minutes,
    )

    return ArtisanRecommendationResponse(
        trip_id=trip_id,
        preference=resolved_pref,
        travel_mode=resolved_mode,
        remaining_budget_inr=remaining_budget,
        total_candidates_evaluated=len(candidates),
        recommendations=[ArtisanRecommendationItem(**item) for item in scored]
    )


@router.post("/trips/recommendations/artisans", response_model=ArtisanRecommendationResponse)
async def score_transient_artisan_recommendations(
    req: TransientArtisanRecommendationRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Score and recommend nearby verified artisan studios for a transient route or basket.
    Used by the Trip Builder before a trip is persisted.
    """
    art_res = await db.execute(
        text("""
            SELECT a.id, a.id as artisan_id, a.place_id, a.artisan_name, a.craft_type,
                   a.phone_number, a.bio, a.has_workshop, a.workshop_fee_inr,
                   a.workshop_duration_minutes, a.workshop_description,
                   p.name, p.latitude, p.longitude, p.address,
                   p.opening_time, p.closing_time, p.entry_fee_inr, p.typical_duration_minutes
            FROM artisans a
            JOIN places p ON a.place_id = p.id
            WHERE a.profile_status = 'approved'
        """)
    )
    art_rows = art_res.fetchall()
    candidates = [dict(r._mapping) for r in art_rows]

    spent = sum(float(s.get("entry_fee_inr") or 0.0) for s in req.stops)
    remaining_budget = max(0.0, req.budget_inr - spent)

    scorer = ArtisanRecommendationScorer()
    scored = scorer.score_candidates(
        route_stops=req.stops,
        candidate_artisans=candidates,
        remaining_budget=remaining_budget,
        preference=req.preference,
        travel_mode=req.travel_mode,
        max_detour_minutes=req.max_detour_minutes,
        start_location=req.start_location,
    )

    return ArtisanRecommendationResponse(
        trip_id=None,
        preference=req.preference,
        travel_mode=req.travel_mode,
        remaining_budget_inr=remaining_budget,
        total_candidates_evaluated=len(candidates),
        recommendations=[ArtisanRecommendationItem(**item) for item in scored]
    )

