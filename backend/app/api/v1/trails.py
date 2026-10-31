"""
Track 1: Community Discovery & UGC Endpoints
Spec: docs/API_SPEC.md §1.1 & §1.4
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.database import get_db
from app.schemas.trails import (
    CommunityTrailResponse,
    CommunityTrailDetailResponse,
    CommunityTrailStopResponse,
)

router = APIRouter(tags=["Community Discovery & UGC"])


@router.get("/trails", response_model=List[CommunityTrailResponse])
async def list_community_trails(
    duration_type: Optional[str] = Query(None, description="single_day or multi_day"),
    max_budget: Optional[float] = Query(None, description="Max budget in INR"),
    tags: Optional[str] = Query(None, description="Comma-separated interest tags"),
    is_featured: Optional[bool] = Query(None, description="Filter for featured trails"),
    db: AsyncSession = Depends(get_db)
):
    """Browse community curated trails with filtering."""
    query = """
        SELECT 
            t.id, t.author_id, t.author_name, t.title, t.description,
            t.destination, t.duration_type, t.total_days, t.total_duration_hours,
            t.estimated_cost_inr, t.tags, t.is_experienced, t.visibility, t.is_featured,
            COUNT(s.id) as stops_count
        FROM community_trails t
        LEFT JOIN community_trail_stops s ON t.id = s.trail_id
        WHERE t.visibility = 'public'
    """
    params = {}
    if duration_type:
        query += " AND t.duration_type = :duration_type"
        params["duration_type"] = duration_type
    if max_budget is not None:
        query += " AND t.estimated_cost_inr <= :max_budget"
        params["max_budget"] = max_budget
    if is_featured is not None:
        query += " AND t.is_featured = :is_featured"
        params["is_featured"] = is_featured

    query += " GROUP BY t.id ORDER BY t.is_featured DESC, t.created_at DESC"

    res = await db.execute(text(query), params)
    rows = res.fetchall()

    trails = []
    for r in rows:
        trails.append(
            CommunityTrailResponse(
                id=r.id,
                author_id=r.author_id,
                author_name=r.author_name,
                title=r.title,
                description=r.description,
                destination=r.destination,
                duration_type=r.duration_type,
                total_days=r.total_days,
                total_duration_hours=float(r.total_duration_hours) if r.total_duration_hours else None,
                estimated_cost_inr=float(r.estimated_cost_inr) if r.estimated_cost_inr else None,
                tags=r.tags or [],
                is_experienced=r.is_experienced,
                visibility=r.visibility,
                is_featured=r.is_featured,
                stops_count=r.stops_count
            )
        )
    return trails


@router.get("/trails/{trail_id}", response_model=CommunityTrailDetailResponse)
async def get_community_trail_details(
    trail_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Returns complete details and relative stops for a community trail."""
    trail_res = await db.execute(
        text("SELECT * FROM community_trails WHERE id = :id AND visibility = 'public'"),
        {"id": trail_id}
    )
    t = trail_res.fetchone()
    if not t:
        raise HTTPException(status_code=404, detail="Community trail not found")

    stops_res = await db.execute(
        text("""
            SELECT s.*, p.name as place_name 
            FROM community_trail_stops s
            LEFT JOIN places p ON s.place_id = p.id
            WHERE s.trail_id = :trail_id
            ORDER BY s.day_number, s.sequence_in_day
        """),
        {"trail_id": trail_id}
    )
    stops_rows = stops_res.fetchall()

    stops = [
        CommunityTrailStopResponse(
            id=s.id,
            trail_id=s.trail_id,
            place_id=s.place_id,
            place_name=s.place_name,
            day_number=s.day_number,
            sequence_in_day=s.sequence_in_day,
            suggested_duration_minutes=s.suggested_duration_minutes,
            estimated_transit_minutes=s.estimated_transit_minutes,
            time_slot=s.time_slot,
            traveler_tip=s.traveler_tip
        )
        for s in stops_rows
    ]

    return CommunityTrailDetailResponse(
        id=t.id,
        author_id=t.author_id,
        author_name=t.author_name,
        title=t.title,
        description=t.description,
        destination=t.destination,
        duration_type=t.duration_type,
        total_days=t.total_days,
        total_duration_hours=float(t.total_duration_hours) if t.total_duration_hours else None,
        estimated_cost_inr=float(t.estimated_cost_inr) if t.estimated_cost_inr else None,
        tags=t.tags or [],
        is_experienced=t.is_experienced,
        visibility=t.visibility,
        is_featured=t.is_featured,
        stops_count=len(stops),
        stops=stops
    )
