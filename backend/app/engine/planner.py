"""
Track 2: Deterministic Itinerary Planner & Relative Duration Solver
Ticket: docs/tickets/track-2-trip-engine-backend/04-deterministic-itinerary-planner.md
"""
from datetime import datetime, time
from typing import List, Dict, Any, Optional
from app.services.planner import (
    PlaceCandidate,
    PlannerConfig,
    StartLocation,
    SolvedItinerary,
    solve_itinerary,
)

__all__ = [
    "DeterministicPlanner",
    "PlaceCandidate",
    "PlannerConfig",
    "StartLocation",
    "SolvedItinerary",
    "solve_itinerary",
]


class DeterministicPlanner:
    """
    Expands relative duration model (suggested_duration_minutes, time_slot, day_number)
    into absolute timestamps (planned_arrival, planned_departure), validating opening/closing
    hours and total trip budget.
    """
    def __init__(self, start_time: time = time(9, 30), budget_inr: float = 2000):
        self.start_time = start_time
        self.budget_inr = budget_inr

    async def solve_itinerary(
        self,
        places: List[PlaceCandidate],
        start_date: datetime,
        start_location: Optional[StartLocation] = None,
        total_days: int = 1,
        optimize_route: bool = True,
    ) -> SolvedItinerary:
        """Plans stop sequence with concrete arrival and departure timestamps."""
        config = PlannerConfig(
            start_location=start_location or StartLocation(),
            start_datetime=start_date,
            total_days=total_days,
            budget_inr=self.budget_inr,
            optimize_route=optimize_route,
        )
        return await solve_itinerary(places, config)
