from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, ConfigDict


class ArtisanDraftResponse(BaseModel):
    id: str
    whatsapp_message_id: Optional[str] = None
    sender_phone: str
    media_url: Optional[str] = None
    raw_transcript: Optional[str] = None
    extracted_data: Optional[Dict[str, Any]] = None
    approval_status: str = "draft"
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ArtisanDraftApproveRequest(BaseModel):
    artisan_name: str
    craft_type: str
    place_name: str
    address: str
    latitude: float
    longitude: float
    has_workshop: bool = False
    workshop_fee_inr: float = 0
    workshop_duration_minutes: int = 45
    workshop_description: Optional[str] = None
