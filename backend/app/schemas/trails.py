from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class CommunityTrailStopResponse(BaseModel):
    id: str
    trail_id: str
    place_id: str
    place_name: Optional[str] = None
    day_number: int = 1
    sequence_in_day: int
    suggested_duration_minutes: int
    estimated_transit_minutes: int = 15
    time_slot: Optional[str] = None
    traveler_tip: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CommunityTrailResponse(BaseModel):
    id: str
    author_id: str
    author_name: str
    title: str
    description: Optional[str] = None
    destination: str = "Udaipur"
    duration_type: str = "single_day"
    total_days: int = 1
    total_duration_hours: Optional[float] = None
    estimated_cost_inr: Optional[float] = None
    tags: List[str] = []
    is_experienced: bool = True
    visibility: str = "public"
    is_featured: bool = False
    stops_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class CommunityTrailDetailResponse(CommunityTrailResponse):
    stops: List[CommunityTrailStopResponse] = []
