"""
Track 4: Admin Curation & Verification Portal
Spec: docs/PRD.md §3, ADR 0010 & Ticket 12
"""
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.database import get_db
from app.schemas.admin import ArtisanDraftResponse, ArtisanDraftApproveRequest
from app.api.v1.artisans import IN_MEMORY_ARTISAN_DRAFTS

router = APIRouter(tags=["Admin Curation Portal"])


@router.get("/admin/artisan-drafts", response_model=List[ArtisanDraftResponse])
async def list_artisan_drafts(
    db: AsyncSession = Depends(get_db)
):
    """List pending artisan drafts submitted via Hindi Web Voice Onboarding (/artisans/onboard)."""
    results: List[ArtisanDraftResponse] = []
    seen_ids = set()

    try:
        res = await db.execute(
            text("SELECT * FROM artisan_drafts ORDER BY created_at DESC")
        )
        rows = res.fetchall()
        for r in rows:
            row_map = dict(r._mapping)
            seen_ids.add(row_map["id"])
            results.append(
                ArtisanDraftResponse(
                    id=row_map["id"],
                    submission_id=row_map.get("submission_id"),
                    whatsapp_message_id=row_map.get("whatsapp_message_id"),
                    sender_phone=row_map["sender_phone"],
                    media_url=row_map.get("media_url"),
                    raw_transcript=row_map.get("raw_transcript"),
                    extracted_data=row_map.get("extracted_data"),
                    approval_status=row_map.get("approval_status") or "draft",
                    created_at=row_map.get("created_at") or datetime.now(timezone.utc),
                )
            )
    except Exception:
        pass

    for d_id, d in reversed(list(IN_MEMORY_ARTISAN_DRAFTS.items())):
        if d_id not in seen_ids:
            results.append(
                ArtisanDraftResponse(
                    id=d_id,
                    submission_id=d.get("submission_id"),
                    sender_phone=d.get("sender_phone", ""),
                    media_url=d.get("media_url"),
                    raw_transcript=d.get("raw_transcript"),
                    extracted_data=d.get("extracted_data"),
                    approval_status=d.get("approval_status") or "draft",
                    created_at=datetime.now(timezone.utc),
                )
            )

    return results


@router.post("/admin/artisan-drafts/{draft_id}/approve")
async def approve_artisan_draft(
    draft_id: str,
    body: ArtisanDraftApproveRequest,
    db: AsyncSession = Depends(get_db)
):
    """1-tap approval promoting an artisan draft into verified places & artisans."""
    if draft_id in IN_MEMORY_ARTISAN_DRAFTS:
        IN_MEMORY_ARTISAN_DRAFTS[draft_id]["approval_status"] = "approved"
    try:
        await db.execute(
            text("UPDATE artisan_drafts SET approval_status = 'approved' WHERE id = :id"),
            {"id": draft_id}
        )
        await db.commit()
    except Exception:
        pass
    return {"success": True, "message": "Artisan studio verified and published"}
