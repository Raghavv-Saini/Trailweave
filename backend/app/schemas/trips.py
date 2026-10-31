from datetime import datetime, timezone, timedelta
from typing import List, Literal, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


class StartLocationInput(BaseModel):
    name: str = "Hotel Swaroop Vilas"
    latitude: float = 24.5854
    longitude: float = 73.6812


class BasketStopInput(BaseModel):
    place_id: str
    day_number: Optional[int] = None
    sequence_in_day: Optional[int] = None
    suggested_duration_minutes: Optional[int] = None
    time_slot: Optional[str] = None
    source_attribution: Optional[str] = None
    private_notes: Optional[str] = None


class TravelRequest(BaseModel):
    user_id: str = "tourist_demo"
    title: Optional[str] = None
    destination: str = "Udaipur"
    start_datetime: datetime = Field(
        default_factory=lambda: datetime(
            2026, 11, 1, 9, 0, tzinfo=timezone(timedelta(hours=5, minutes=30))
        )
    )
    total_days: int = 1
    budget_inr: float = 2000.0
    budget_mode: Literal["total", "per_day"] = "total"
    travel_mode: Literal["walking", "auto_rickshaw", "cab"] = "auto_rickshaw"
    artisan_preference: Literal["workshop", "store", "both", "none"] = "both"
    start_location: StartLocationInput = Field(default_factory=StartLocationInput)
    place_ids: List[str] = Field(default_factory=list)
    stops: List[BasketStopInput] = Field(default_factory=list)
    source_trail_id: Optional[str] = None
    optimize_route: bool = True
    allow_warnings: bool = False


class TripStopResponse(BaseModel):
    id: str
    trip_id: str
    place_id: str
    name: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    category: Optional[str] = None
    entry_fee_inr: Optional[float] = 0.0
    image_url: Optional[str] = None
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
    route_geometry: Optional[Dict[str, Any]] = None
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
