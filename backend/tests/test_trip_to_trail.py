import unittest
from app.services.gemini import GeminiTrailDraftService


class TestTripToTrail(unittest.IsolatedAsyncioTestCase):
    async def test_gemini_trail_draft_fallback(self):
        """Verifies that the GeminiTrailDraftService generates high-quality deterministic drafts without an API key."""
        service = GeminiTrailDraftService(api_key="")

        visited_places = [
            {
                "id": "stop_1",
                "place_id": "place_city_palace",
                "name": "City Palace Udaipur",
                "category": "heritage",
                "entry_fee_inr": 330,
                "suggested_duration_minutes": 120,
            },
            {
                "id": "stop_2",
                "place_id": "place_mohanlal_studio",
                "name": "Master Mohanlal Miniature Art Studio",
                "category": "artisan_studio",
                "entry_fee_inr": 0,
                "suggested_duration_minutes": 45,
            },
            {
                "id": "stop_3",
                "place_id": "place_jagdish_temple",
                "name": "Jagdish Temple",
                "category": "heritage",
                "entry_fee_inr": 0,
                "suggested_duration_minutes": 30,
            },
        ]

        draft = await service.generate_trail_draft(visited_places, vibe_hint="artisan & heritage walk")

        self.assertIn("City Palace", draft["title"])
        self.assertIn("Jagdish Temple", draft["title"])
        self.assertIn("heritage", draft["tags"])
        self.assertIn("artisan", draft["tags"])
        self.assertEqual(draft["estimated_budget_inr"], 330)
        self.assertGreaterEqual(draft["total_duration_hours"], 3.0)
        self.assertIn("Master Mohanlal Miniature Art Studio", draft["description"])

    async def test_gemini_trail_draft_empty(self):
        """Verifies safe fallback when no visited places are provided."""
        service = GeminiTrailDraftService(api_key="")
        draft = await service.generate_trail_draft([])
        self.assertEqual(draft["title"], "Udaipur Old City Wander")
        self.assertIn("walking", draft["tags"])
        self.assertEqual(draft["estimated_budget_inr"], 0)


if __name__ == "__main__":
    unittest.main()
