import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text
from app.main import app
from app.core.database import async_session_maker


@pytest.mark.asyncio
async def test_health_check_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["database"] == "connected"
        assert data["postgis"] == "installed"
        assert data["places_count"] >= 6
        assert data["trails_count"] >= 2


@pytest.mark.asyncio
async def test_ten_tables_exist():
    expected_tables = {
        "places",
        "artisans",
        "trips",
        "itinerary_versions",
        "trip_stops",
        "trip_events",
        "replan_proposals",
        "community_trails",
        "community_trail_stops",
        "artisan_drafts",
    }
    async with async_session_maker() as session:
        res = await session.execute(
            text(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
            )
        )
        existing_tables = {row[0] for row in res.fetchall()}
        missing = expected_tables - existing_tables
        assert not missing, f"Missing tables in PostgreSQL: {missing}"


@pytest.mark.asyncio
async def test_postgis_spatial_distance():
    async with async_session_maker() as session:
        res = await session.execute(
            text("""
                SELECT 
                    p1.name, p2.name,
                    round(ST_Distance(p1.geom::geography, p2.geom::geography)::numeric, 1) as dist
                FROM places p1, places p2
                WHERE p1.id = 'place_city_palace' AND p2.id = 'place_jagdish_temple';
            """)
        )
        row = res.fetchone()
        assert row is not None
        # City Palace to Jagdish Temple should be approx ~338 meters
        assert 300 < row[2] < 400


@pytest.mark.asyncio
async def test_seeded_places_and_artisans():
    async with async_session_maker() as session:
        # Check place
        place_res = await session.execute(
            text("SELECT id, name, category, entry_fee_inr FROM places WHERE id = 'place_mohanlal_studio';")
        )
        place = place_res.fetchone()
        assert place is not None
        assert place[1] == "Master Mohanlal Miniature Art Studio"
        assert place[2] == "artisan_studio"

        # Check linked artisan
        artisan_res = await session.execute(
            text("SELECT id, artisan_name, craft_type, has_workshop, workshop_fee_inr FROM artisans WHERE id = 'artisan_mohanlal';")
        )
        artisan = artisan_res.fetchone()
        assert artisan is not None
        assert artisan[1] == "Master Mohanlal Sharma"
        assert artisan[3] is True
        assert artisan[4] == 300


@pytest.mark.asyncio
async def test_seeded_community_trails():
    async with async_session_maker() as session:
        trails_res = await session.execute(
            text("SELECT id, title, duration_type, total_duration_hours FROM community_trails ORDER BY id;")
        )
        trails = trails_res.fetchall()
        assert len(trails) >= 2

        # Check stops for trail_royal_palaces_crafts
        stops_res = await session.execute(
            text("""
                SELECT sequence_in_day, place_id, suggested_duration_minutes, time_slot 
                FROM community_trail_stops 
                WHERE trail_id = 'trail_royal_palaces_crafts'
                ORDER BY sequence_in_day;
            """)
        )
        stops = stops_res.fetchall()
        assert len(stops) == 4
        assert stops[0][1] == "place_city_palace"
        assert stops[1][1] == "place_mohanlal_studio"
