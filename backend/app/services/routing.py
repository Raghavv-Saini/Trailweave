"""
Routing & Transit Duration Service
Used in Track 2 (Tickets 04, 05, 06) for transit time matrix calculations.
"""
from typing import Tuple
from app.services.planner import (
    haversine_distance_meters as _haversine,
    compute_fallback_transit_minutes as _compute_fallback,
    TravelMode,
)


def haversine_distance_meters(coord1: Tuple[float, float], coord2: Tuple[float, float]) -> float:
    """Computes great-circle distance between two (lat, lon) coordinates in meters."""
    return _haversine(coord1[0], coord1[1], coord2[0], coord2[1])


def estimate_transit_minutes(
    coord1: Tuple[float, float],
    coord2: Tuple[float, float],
    mode: str = "auto_rickshaw"
) -> int:
    """Estimates transit duration accounting for Udaipur Old City narrow lane speeds."""
    travel_mode: TravelMode = "walking" if mode == "walking" else ("cab" if mode == "cab" else "auto_rickshaw")
    return _compute_fallback(coord1[0], coord1[1], coord2[0], coord2[1], travel_mode)
