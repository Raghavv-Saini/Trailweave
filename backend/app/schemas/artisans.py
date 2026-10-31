from typing import Optional
from pydantic import BaseModel, ConfigDict


class ArtisanBase(BaseModel):
    artisan_name: str
    craft_type: str
    place_id: str
    phone_number: Optional[str] = None
    bio: Optional[str] = None
    has_workshop: bool = False
    workshop_fee_inr: float = 0
    workshop_duration_minutes: int = 45
    workshop_description: Optional[str] = None
    profile_status: str = "approved"


class ArtisanResponse(ArtisanBase):
    id: str
    address: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
