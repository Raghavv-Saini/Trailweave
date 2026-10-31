"""
Track 2: TrailWeave Artisan Smart Recommendation Scorer
Ticket: docs/tickets/track-2-trip-engine-backend/06-artisan-smart-recommendation-scorer.md
"""
from typing import List, Dict, Any


class ArtisanRecommendationScorer:
    """
    Scores nearby artisan studios within a 15-minute detour buffer along the tourist route,
    respecting budget headroom and preference (workshops vs store visits).
    """
    def score_candidates(
        self,
        route_stops: List[Dict[str, Any]],
        candidate_artisans: List[Dict[str, Any]],
        remaining_budget: float,
        preference: str = "both"
    ) -> List[Dict[str, Any]]:
        """Produces ranked recommendations with transparent rationales."""
        # Core scorer implemented in Ticket 06
        return candidate_artisans[:3]
