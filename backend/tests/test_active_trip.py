from datetime import datetime, timezone
from types import SimpleNamespace
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import get_db


class FakeResult:
    def __init__(self, one=None, many=None):
        self._one = one
        self._many = many or []

    def fetchone(self):
        return self._one

    def fetchall(self):
        return self._many


class FakeAsyncSession:
    def __init__(self):
        self.executed_queries = []
        self.committed = False
        self.stops = {
            "stop_ms": SimpleNamespace(
                id="stop_ms",
                trip_id="trip_demo_udaipur",
                itinerary_version_id="ver_demo_1",
                place_id="place_mohanlal_studio",
                name="Master Mohanlal Miniature Art Studio",
                address="14 Jagdish Chowk, Old City, Udaipur, Rajasthan 313001",
                latitude=24.5796,
                longitude=73.6844,
                category="artisan_studio",
                entry_fee_inr=0,
                day_number=1,
                sequence_in_day=2,
                planned_arrival=datetime(2026, 10, 31, 11, 45, tzinfo=timezone.utc),
                planned_departure=datetime(2026, 10, 31, 12, 30, tzinfo=timezone.utc),
                suggested_duration_minutes=45,
                actual_duration_minutes=None,
                is_pinned=True,
                visit_status="pending",
                source_attribution="TrailWeave Artisan Recommendation",
                private_notes="45-min miniature painting masterclass",
            )
        }

    async def execute(self, statement, params=None):
        sql = str(statement)
        self.executed_queries.append((sql, params))
        if "SELECT * FROM trips WHERE id =" in sql:
            return FakeResult(
                one=SimpleNamespace(
                    id="trip_demo_udaipur",
                    user_id="user_demo_raghav",
                    title="My Udaipur Cultural Journey",
                    destination="Udaipur",
                    duration_type="single_day",
                    total_days=1,
                    budget_inr=1500,
                    budget_mode="total",
                    artisan_preference="both",
                    revision=1,
                    current_itinerary_version_id="ver_demo_1",
                    status="in_progress",
                )
            )
        if "SELECT * FROM itinerary_versions WHERE id =" in sql:
            return FakeResult(
                one=SimpleNamespace(
                    id="ver_demo_1",
                    trip_id="trip_demo_udaipur",
                    version_number=1,
                    total_estimated_cost_inr=730,
                    total_estimated_duration_minutes=285,
                )
            )
        if "FROM trip_stops s" in sql:
            return FakeResult(many=list(self.stops.values()))
        if "SELECT * FROM trip_stops WHERE id =" in sql:
            stop_id = params.get("stop_id") if params else None
            return FakeResult(one=self.stops.get(stop_id))
        if "UPDATE trip_stops" in sql:
            stop_id = params.get("stop_id") if params else None
            if stop_id in self.stops:
                self.stops[stop_id].visit_status = "visited"
                if params and "actual_duration" in params:
                    self.stops[stop_id].actual_duration_minutes = params["actual_duration"]
            return FakeResult()
        if "INSERT INTO trip_events" in sql:
            return FakeResult()
        return FakeResult()

    async def commit(self):
        self.committed = True


@pytest.mark.asyncio
async def test_active_trip_get_and_visit_checkout_audit():
    fake_db = FakeAsyncSession()

    async def override_get_db():
        yield fake_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. GET /api/trips/trip_demo_udaipur returns enriched stop metadata
            get_res = await client.get("/api/trips/trip_demo_udaipur")
            assert get_res.status_code == 200
            trip_data = get_res.json()
            assert trip_data["id"] == "trip_demo_udaipur"
            stop = trip_data["active_version"]["stops"][0]
            assert stop["id"] == "stop_ms"
            assert stop["address"] == "14 Jagdish Chowk, Old City, Udaipur, Rajasthan 313001"
            assert stop["latitude"] == 24.5796
            assert stop["longitude"] == 73.6844
            assert stop["image_url"].startswith("https://")
            assert stop["is_pinned"] is True

            # 2. POST /api/trips/{trip_id}/stops/{stop_id}/visit with manual_fallback
            visit_res = await client.post(
                "/api/trips/trip_demo_udaipur/stops/stop_ms/visit",
                json={
                    "checkin_method": "manual_fallback",
                    "arrival_timestamp": "2026-10-31T11:46:00Z",
                },
            )
            assert visit_res.status_code == 200
            visit_data = visit_res.json()
            assert visit_data["success"] is True
            assert visit_data["visit_status"] == "visited"
            assert visit_data["checkin_method"] == "manual_fallback"

            # 3. POST /api/trips/{trip_id}/stops/{stop_id}/checkout with grace_buffer_timeout (+20m)
            checkout_res = await client.post(
                "/api/trips/trip_demo_udaipur/stops/stop_ms/checkout",
                json={
                    "checkout_method": "grace_buffer_timeout",
                    "departure_timestamp": "2026-10-31T12:51:00Z",
                },
            )
            assert checkout_res.status_code == 200
            checkout_data = checkout_res.json()
            assert checkout_data["success"] is True
            assert checkout_data["checkout_method"] == "grace_buffer_timeout"
            # 45 mins suggested + 20 mins grace buffer = 65 mins
            assert checkout_data["actual_duration_minutes"] == 65
    finally:
        app.dependency_overrides.clear()

