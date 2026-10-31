from datetime import time
from typing import Optional
from pydantic import BaseModel, ConfigDict


class PlaceBase(BaseModel):
    name: str
    category: str
    latitude: float
    longitude: float
    address: str
    entry_fee_inr: float = 0
    typical_duration_minutes: int = 45
    opening_time: Optional[time] = None
    closing_time: Optional[time] = None
    data_status: str = "verified"


class PlaceResponse(PlaceBase):
    id: str

    model_config = ConfigDict(from_attributes=True)
