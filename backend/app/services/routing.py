"""
Routing & Transit Duration Service
Used in Track 2 (Tickets 04, 05, 06) for transit time matrix calculations.
"""
import math
from typing import Tuple


def haversine_distance_meters(coord1: Tuple[float, float], coord2: Tuple[float, float]) -> float:
    """Computes great-circle distance between two (lat, lon) coordinates in meters."""
    lat1, lon1 = coord1
    lat2, lon2 = coord2
    R = 6371000  # Earth radius in meters

    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def estimate_transit_minutes(
    coord1: Tuple[float, float],
    coord2: Tuple[float, float],
    mode: str = "auto_rickshaw"
) -> int:
    """Estimates transit duration accounting for Udaipur Old City narrow lane speeds."""
    dist_m = haversine_distance_meters(coord1, coord2)
    # Average Old City speeds: walking ~4 km/h (66 m/min), auto ~12 km/h (200 m/min)
    speed_mpm = 66 if mode == "walking" or dist_m < 500 else 200
    minutes = math.ceil(dist_m / speed_mpm)
    return max(5, minutes)
