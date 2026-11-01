from datetime import datetime
from typing import List, Literal, Optional, Any, Dict
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.trips import TripStopResponse


class ReplanOperation(BaseModel):
    type: Literal[
        "add_stop",
        "remove_stop",
        "skip_stop",
        "reorder_stops",
        "pin_stop",
        "update_travel_mode",
        "update_stop_duration",
        "reschedule_stop",
        "update_budget",
    ]
    place_id: Optional[str] = None
    stop_id: Optional[str] = None
    new_order: Optional[int] = None
    day_number: Optional[int] = 1
    is_pinned: Optional[bool] = None
    travel_mode: Optional[Literal["walking", "auto_rickshaw", "cab"]] = None
    duration_minutes: Optional[int] = None
    planned_arrival_time: Optional[str] = None
    custom_place_name: Optional[str] = None
    custom_category: Optional[str] = None
    custom_address: Optional[str] = None
    custom_latitude: Optional[float] = None
    custom_longitude: Optional[float] = None
    custom_entry_fee_inr: Optional[float] = None
    budget_inr: Optional[float] = None


class ReplanPreviewRequest(BaseModel):
    base_revision: int
    requested_by: str = "manual_editor"
    operations: List[ReplanOperation]


class ValidationDiff(BaseModel):
    cost_delta_inr: float = 0.0
    duration_delta_minutes: int = 0
    stops_added: List[str] = Field(default_factory=list)
    stops_skipped: List[str] = Field(default_factory=list)
    stops_removed: List[str] = Field(default_factory=list)
    closing_hour_conflicts: List[str] = Field(default_factory=list)
    travel_mode_changed: List[str] = Field(default_factory=list)
    durations_updated: List[str] = Field(default_factory=list)
    rescheduled_stops: List[str] = Field(default_factory=list)
    budget_updated_inr: Optional[float] = None


class ReplanProposalResponse(BaseModel):
    proposal_id: str
    base_revision: int
    is_feasible: bool
    validation_diff: ValidationDiff
    candidate_stops: List[TripStopResponse] = Field(default_factory=list)
    expires_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReplanAcceptRequest(BaseModel):
    proposal_id: str
    expected_revision: int


class ReplanAcceptResponse(BaseModel):
    success: bool
    new_revision: int
    message: str


class TripEventResponse(BaseModel):
    id: str
    trip_id: str
    resulting_revision: int
    actor: str
    source: str
    event_type: str
    payload: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
