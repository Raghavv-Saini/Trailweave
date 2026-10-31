from datetime import datetime
from typing import List, Literal, Optional, Any, Dict
from pydantic import BaseModel, ConfigDict


class ReplanOperation(BaseModel):
    type: Literal["add_stop", "remove_stop", "skip_stop", "reorder_stops", "pin_stop"]
    place_id: Optional[str] = None
    stop_id: Optional[str] = None
    new_order: Optional[int] = None


class ReplanPreviewRequest(BaseModel):
    base_revision: int
    requested_by: str = "manual_editor"
    operations: List[ReplanOperation]


class ValidationDiff(BaseModel):
    cost_delta_inr: float = 0.0
    duration_delta_minutes: int = 0
    stops_added: List[str] = []
    stops_skipped: List[str] = []
    closing_hour_conflicts: List[str] = []


class ReplanProposalResponse(BaseModel):
    proposal_id: str
    base_revision: int
    is_feasible: bool
    validation_diff: ValidationDiff
    candidate_stops: List[Dict[str, Any]] = []
    expires_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReplanAcceptRequest(BaseModel):
    proposal_id: str
    expected_revision: int


class ReplanAcceptResponse(BaseModel):
    success: bool
    new_revision: int
    message: str
