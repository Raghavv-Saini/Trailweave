from datetime import datetime
from typing import List, Literal, Optional, Any, Dict
from pydantic import BaseModel, ConfigDict, Field


class ReplanOperation(BaseModel):
    type: Literal["add_stop", "remove_stop", "skip_stop", "reorder_stops", "pin_stop"]
    place_id: Optional[str] = None
    stop_id: Optional[str] = None
    new_order: Optional[int] = None
    is_pinned: Optional[bool] = None


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


class ReplanProposalResponse(BaseModel):
    proposal_id: str
    base_revision: int
    is_feasible: bool
    validation_diff: ValidationDiff
    candidate_stops: List[Dict[str, Any]] = Field(default_factory=list)
    expires_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReplanAcceptRequest(BaseModel):
    proposal_id: str
    expected_revision: int


class ReplanAcceptResponse(BaseModel):
    success: bool
    new_revision: int
    message: str
