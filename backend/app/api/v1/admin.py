"""
Track 4: Admin Curation & Verification Portal
Spec: docs/PRD.md §3 & Ticket 12
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.database import get_db
from app.schemas.admin import ArtisanDraftResponse, ArtisanDraftApproveRequest

router = APIRouter(tags=["Admin Curation Portal"])


@router.get("/admin/artisan-drafts", response_model=List[ArtisanDraftResponse])
async def list_artisan_drafts(
    db: AsyncSession = Depends(get_db)
):
    """List pending artisan drafts from WhatsApp voice notes."""
    res = await db.execute(
        text("SELECT * FROM artisan_drafts ORDER BY created_at DESC")
    )
    rows = res.fetchall()
    return [
        ArtisanDraftResponse(
            id=r.id,
            whatsapp_message_id=r.whatsapp_message_id,
            sender_phone=r.sender_phone,
            media_url=r.media_url,
            raw_transcript=r.raw_transcript,
            extracted_data=r.extracted_data,
            approval_status=r.approval_status,
            created_at=r.created_at
        )
        for r in rows
    ]


@router.post("/admin/artisan-drafts/{draft_id}/approve")
async def approve_artisan_draft(
    draft_id: str,
    body: ArtisanDraftApproveRequest,
    db: AsyncSession = Depends(get_db)
):
    """1-tap approval promoting an artisan draft into verified places & artisans."""
    await db.execute(
        text("UPDATE artisan_drafts SET approval_status = 'approved' WHERE id = :id"),
        {"id": draft_id}
    )
    await db.commit()
    return {"success": True, "message": "Artisan studio verified and published"}
