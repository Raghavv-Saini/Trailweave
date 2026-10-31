"""
Track 4: Artisan Studio Directory Endpoints
Spec: docs/API_SPEC.md §1.2
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.database import get_db
from app.schemas.artisans import ArtisanResponse

router = APIRouter(tags=["Artisan Directory"])


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
