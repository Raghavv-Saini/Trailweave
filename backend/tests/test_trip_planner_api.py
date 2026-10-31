import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text

from app.main import app
from app.core.database import async_session_maker


@pytest.mark.asyncio
async def test_create_trip_from_selected_places_persists_trip_version_and_stops():
    transport = ASGITransport(app=app)
    payload = {
        "user_id": "test_tourist_planner_1",
        "title": "Udaipur Heritage & Miniature Art Day",
        "start_datetime": "2026-11-01T09:00:00+05:30",
        "total_days": 1,
        "budget_inr": 1500,
        "budget_mode": "total",
        "travel_mode": "auto_rickshaw",
        "artisan_preference": "workshop",
        "start_location": {
            "name": "Hotel Swaroop Vilas",
            "latitude": 24.5854,
            "longitude": 73.6812,
        },
        "place_ids": [
            "place_mohanlal_studio",
            "place_city_palace",
            "place_jagdish_temple",
        ],
        "optimize_route": True,
    }

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/trips", json=payload)
        assert resp.status_code == 201, resp.text
        data = resp.json()

        trip_id = data["id"]
        assert data["revision"] == 1
        assert data["status"] == "planned"
        assert data["budget_inr"] == 1500.0
        assert data["artisan_preference"] == "workshop"
        assert data["active_version"] is not None
        assert data["active_version"]["version_number"] == 1
        assert data["active_version"]["total_estimated_cost_inr"] == 630.0
        stops = data["active_version"]["stops"]
        assert len(stops) == 3
        assert stops[0]["sequence_in_day"] == 1
        assert stops[0]["planned_arrival"] is not None
        assert stops[0]["planned_departure"] is not None

        # Verify GET /api/trips/{trip_id} returns the exact persisted state
        get_resp = await client.get(f"/api/trips/{trip_id}")
        assert get_resp.status_code == 200
        fetched = get_resp.json()
        assert fetched["id"] == trip_id
        assert fetched["revision"] == 1
        assert len(fetched["active_version"]["stops"]) == 3

    # Cleanup test trip
    async with async_session_maker() as session:
        await session.execute(text("DELETE FROM trips WHERE id = :id"), {"id": trip_id})
        await session.commit()


@pytest.mark.asyncio
async def test_create_trip_from_community_trail_clones_and_expands_relative_stops():
    transport = ASGITransport(app=app)
    payload = {
        "user_id": "test_tourist_trail_clone",
        "start_datetime": "2026-11-01T09:00:00+05:30",
        "budget_inr": 1500,
        "travel_mode": "walking",
        "artisan_preference": "workshop",
        "source_trail_id": "trail_royal_palaces_crafts",
    }

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/trips", json=payload)
        assert resp.status_code == 201, resp.text
        data = resp.json()
        trip_id = data["id"]
        assert data["revision"] == 1
        stops = data["active_version"]["stops"]
        assert len(stops) == 4
        for s in stops:
            assert s["planned_arrival"] is not None
            assert s["planned_departure"] is not None
            assert s["source_attribution"] == "Arjun Sharma"

    async with async_session_maker() as session:
        await session.execute(text("DELETE FROM trips WHERE id = :id"), {"id": trip_id})
        await session.commit()


@pytest.mark.asyncio
async def test_create_trip_rejects_budget_or_closing_violation_with_422():
    transport = ASGITransport(app=app)
    infeasible_payload = {
        "user_id": "test_tourist_infeasible",
        "start_datetime": "2026-11-01T16:45:00+05:30",
        "budget_inr": 200,
        "place_ids": ["place_city_palace"],
        "allow_warnings": False,
    }

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/trips", json=infeasible_payload)
        assert resp.status_code == 422
        detail = resp.json()["detail"]
        assert detail["budget_exceeded"] is True
        assert detail["total_estimated_cost_inr"] == 330.0
        assert len(detail["closing_hour_conflicts"]) == 1
