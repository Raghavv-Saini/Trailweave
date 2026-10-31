"""
API integration tests for Track 2 Ticket 06: Artisan Recommendation Endpoints
Spec: docs/API_SPEC.md §1.2 & §1.3
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_get_artisan_recommendations_for_trip():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Query recommendations for demo trip
        resp = await client.get("/api/trips/trip_demo_udaipur/recommendations/artisans?preference=both")
        assert resp.status_code == 200, resp.text
        data = resp.json()

        assert data["trip_id"] == "trip_demo_udaipur"
        assert "recommendations" in data
        assert len(data["recommendations"]) > 0

        # Verify items have required contract fields
        for item in data["recommendations"]:
            assert item["artisan_name"]
            assert item["craft_type"]
            assert item["offering_type"] in ("workshop", "store")
            assert item["detour_minutes"] <= 15
            assert "rationale" in item
            assert item["latitude"] > 0
            assert item["longitude"] > 0
            # Ensure Mohanlal is excluded because it's already in trip_demo_udaipur
            assert item["place_id"] != "place_mohanlal_studio"


@pytest.mark.asyncio
async def test_post_transient_artisan_recommendations():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "stops": [
                {
                    "place_id": "place_city_palace",
                    "latitude": 24.5764,
                    "longitude": 73.6835,
                    "entry_fee_inr": 330,
                },
                {
                    "place_id": "place_jagdish_temple",
                    "latitude": 24.5794,
                    "longitude": 73.6841,
                    "entry_fee_inr": 0,
                },
            ],
            "budget_inr": 1500,
            "travel_mode": "auto_rickshaw",
            "preference": "workshops",
            "max_detour_minutes": 15,
        }

        resp = await client.post("/api/trips/recommendations/artisans", json=payload)
        assert resp.status_code == 200, resp.text
        data = resp.json()

        assert len(data["recommendations"]) > 0
        for item in data["recommendations"]:
            assert item["offering_type"] == "workshop"
            assert item["has_workshop"] is True
            assert item["fee_inr"] <= 1500 - 330
            assert "workshop fee" in item["rationale"]
