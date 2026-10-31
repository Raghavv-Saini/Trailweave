from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class TripStopResponse(BaseModel):
    id: str
    trip_id: str
    place_id: str
    name: Optional[str] = None
    day_number: int = 1
    sequence_in_day: int
    planned_arrival: Optional[datetime] = None
    planned_departure: Optional[datetime] = None
    suggested_duration_minutes: int
    actual_duration_minutes: Optional[int] = None
    is_pinned: bool = False
    visit_status: str = "pending"
    source_attribution: Optional[str] = None
    private_notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ItineraryVersionResponse(BaseModel):
    id: str
    trip_id: str
    version_number: int
    total_estimated_cost_inr: float
    total_estimated_duration_minutes: int
    stops: List[TripStopResponse] = []

    model_config = ConfigDict(from_attributes=True)


class TripResponse(BaseModel):
    id: str
    user_id: str
    title: Optional[str] = None
    destination: str = "Udaipur"
    duration_type: str = "single_day"
    total_days: int = 1
    budget_inr: float
    budget_mode: str = "total"
    artisan_preference: str = "both"
    revision: int = 1
    current_itinerary_version_id: Optional[str] = None
    status: str = "planned"
    active_version: Optional[ItineraryVersionResponse] = None

    model_config = ConfigDict(from_attributes=True)
