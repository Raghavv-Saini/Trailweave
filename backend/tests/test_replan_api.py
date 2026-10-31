import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text

from app.main import app
from app.core.database import async_session_maker


@pytest.mark.asyncio
async def test_replan_preview_and_accept_lifecycle_with_revision_locking():
    transport = ASGITransport(app=app)

    # 1. Create a baseline trip
    create_payload = {
        "user_id": "test_tourist_replan_user",
        "title": "Udaipur Replan Test Trip",
        "start_datetime": "2026-11-01T09:00:00+05:30",
        "total_days": 1,
        "budget_inr": 2000,
        "budget_mode": "total",
        "travel_mode": "auto_rickshaw",
        "artisan_preference": "workshop",
        "start_location": {
            "name": "Hotel Swaroop Vilas",
            "latitude": 24.5854,
            "longitude": 73.6812,
        },
        "place_ids": [
            "place_city_palace",
            "place_jagdish_temple",
            "place_bagore_haveli",
        ],
        "optimize_route": True,
    }

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create trip
        create_resp = await client.post("/api/trips", json=create_payload)
        assert create_resp.status_code == 201, create_resp.text
        trip_data = create_resp.json()
        trip_id = trip_data["id"]
        assert trip_data["revision"] == 1
        initial_version_id = trip_data["current_itinerary_version_id"]
        initial_stops = trip_data["active_version"]["stops"]
        assert len(initial_stops) == 3

        stop_to_skip = initial_stops[1]["id"]  # second stop

        # 2. Replan Preview: skip stop 2 and add Mohanlal studio
        preview_payload = {
            "base_revision": 1,
            "requested_by": "manual_editor",
            "operations": [
                {"type": "skip_stop", "stop_id": stop_to_skip},
                {
                    "type": "add_stop",
                    "place_id": "place_mohanlal_studio",
                    "new_order": 2,
                    "day_number": 1,
                },
            ],
        }

        prev_resp = await client.post(f"/api/trips/{trip_id}/replan-preview", json=preview_payload)
        assert prev_resp.status_code == 200, prev_resp.text
        proposal_data = prev_resp.json()
        proposal_id = proposal_data["proposal_id"]
        assert proposal_data["base_revision"] == 1
        assert proposal_data["is_feasible"] is True
        assert stop_to_skip in proposal_data["validation_diff"]["stops_skipped"]
        assert "place_mohanlal_studio" in proposal_data["validation_diff"]["stops_added"]

        candidate_stops = proposal_data["candidate_stops"]
        assert len(candidate_stops) == 4
        skipped_candidate = next(s for s in candidate_stops if s["id"] == stop_to_skip)
        assert skipped_candidate["visit_status"] == "skipped"

        # Verify proposal stored as 'pending' in database
        async with async_session_maker() as session:
            p_res = await session.execute(
                text("SELECT * FROM replan_proposals WHERE id = :id"),
                {"id": proposal_id},
            )
            p_row = p_res.fetchone()
            assert p_row is not None
            assert p_row.status == "pending"

        # 3. Test Optimistic Concurrency Failure (Stale Revision 409 Conflict)
        conflict_payload = {
            "proposal_id": proposal_id,
            "expected_revision": 999,  # Mismatch! Current is 1
        }
        conflict_resp = await client.post(f"/api/trips/{trip_id}/replan-accept", json=conflict_payload)
        assert conflict_resp.status_code == 409
        conflict_data = conflict_resp.json()
        assert conflict_data["current_revision"] == 1
        assert "Revision mismatch" in conflict_data["detail"]

        # 4. Accept Proposal with matching revision (1)
        accept_payload = {
            "proposal_id": proposal_id,
            "expected_revision": 1,
        }
        accept_resp = await client.post(f"/api/trips/{trip_id}/replan-accept", json=accept_payload)
        assert accept_resp.status_code == 200, accept_resp.text
        accept_data = accept_resp.json()
        assert accept_data["success"] is True
        assert accept_data["new_revision"] == 2

        # 5. Verify authoritative trip updated in DB
        get_trip_resp = await client.get(f"/api/trips/{trip_id}")
        assert get_trip_resp.status_code == 200
        updated_trip = get_trip_resp.json()
        assert updated_trip["revision"] == 2
        assert updated_trip["current_itinerary_version_id"] != initial_version_id
        assert updated_trip["active_version"]["version_number"] == 2
        new_stops = updated_trip["active_version"]["stops"]
        assert len(new_stops) == 4
        assert any(s["place_id"] == "place_mohanlal_studio" for s in new_stops)
        assert any(s["place_id"] == "place_jagdish_temple" and s["visit_status"] == "skipped" for s in new_stops)

        # 6. Verify proposal marked 'accepted'
        async with async_session_maker() as session:
            p_check = await session.execute(
                text("SELECT status FROM replan_proposals WHERE id = :id"),
                {"id": proposal_id},
            )
            assert p_check.scalar() == "accepted"

        # 7. Verify GET /api/trips/{trip_id}/events contains replan_committed
        events_resp = await client.get(f"/api/trips/{trip_id}/events")
        assert events_resp.status_code == 200
        events = events_resp.json()
        replan_event = next((e for e in events if e["event_type"] == "replan_committed"), None)
        assert replan_event is not None
        assert replan_event["resulting_revision"] == 2
        assert replan_event["source"] == "manual_editor"
        assert replan_event["payload"]["proposal_id"] == proposal_id

        # 8. Clean up created test trip
        async with async_session_maker() as session:
            await session.execute(text("DELETE FROM trips WHERE id = :id"), {"id": trip_id})
            await session.commit()


@pytest.mark.asyncio
async def test_replan_preview_rejects_modifying_visited_stop_with_400():
    transport = ASGITransport(app=app)
    create_payload = {
        "user_id": "test_tourist_visited_freeze",
        "title": "Visited Freeze Trip",
        "start_datetime": "2026-11-01T09:00:00+05:30",
        "total_days": 1,
        "budget_inr": 1500,
        "place_ids": ["place_city_palace", "place_jagdish_temple"],
    }

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        create_resp = await client.post("/api/trips", json=create_payload)
        trip_id = create_resp.json()["id"]
        first_stop_id = create_resp.json()["active_version"]["stops"][0]["id"]

        # Mark first stop visited
        visit_resp = await client.post(
            f"/api/trips/{trip_id}/stops/{first_stop_id}/visit",
            json={"checkin_method": "manual_fallback"},
        )
        assert visit_resp.status_code == 200

        # Attempt to skip the visited stop
        preview_payload = {
            "base_revision": 1,
            "requested_by": "manual_editor",
            "operations": [{"type": "skip_stop", "stop_id": first_stop_id}],
        }
        prev_resp = await client.post(f"/api/trips/{trip_id}/replan-preview", json=preview_payload)
        assert prev_resp.status_code == 400
        assert f"Cannot modify already completed stop {first_stop_id}" in prev_resp.json()["detail"]

        # Clean up
        async with async_session_maker() as session:
            await session.execute(text("DELETE FROM trips WHERE id = :id"), {"id": trip_id})
            await session.commit()
