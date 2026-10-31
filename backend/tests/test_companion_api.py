"""
Unit and Integration Tests for Track 3: AI Companion & Push Transition Notifications
Ticket: docs/tickets/track-3-active-trip-companion/09-ai-companion-push-notifications.md
Spec: docs/API_SPEC.md §1.4 & §2, ADR 0004, ADR 0005, ADR 0008
"""
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text

from app.main import app
from app.core.database import async_session_maker


@pytest.mark.asyncio
async def test_companion_message_acknowledges_prior_skips_and_proposes_changes():
    transport = ASGITransport(app=app)

    # 1. Create a baseline trip
    create_payload = {
        "user_id": "test_companion_tourist",
        "title": "Udaipur Companion Journey",
        "start_datetime": "2026-11-01T09:00:00+05:30",
        "total_days": 1,
        "budget_inr": 2500,
        "budget_mode": "total",
        "travel_mode": "auto_rickshaw",
        "artisan_preference": "both",
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
        create_resp = await client.post("/api/trips", json=create_payload)
        assert create_resp.status_code == 201, create_resp.text
        trip = create_resp.json()
        trip_id = trip["id"]
        assert trip["revision"] == 1
        stops = trip["active_version"]["stops"]
        second_stop_id = stops[1]["id"]  # jagdish temple

        # 2. Stage a manual skip on stop 2 and commit it (Revision 1 -> 2)
        preview_resp = await client.post(
            f"/api/trips/{trip_id}/replan-preview",
            json={
                "base_revision": 1,
                "requested_by": "manual_editor",
                "operations": [{"type": "skip_stop", "stop_id": second_stop_id}],
            },
        )
        assert preview_resp.status_code == 200
        prop_id = preview_resp.json()["proposal_id"]

        accept_resp = await client.post(
            f"/api/trips/{trip_id}/replan-accept",
            json={"proposal_id": prop_id, "expected_revision": 1},
        )
        assert accept_resp.status_code == 200
        assert accept_resp.json()["new_revision"] == 2

        # 3. Chat with companion: request adaptation ("I'm tired, can we skip the haveli and find a rooftop tea shop nearby?")
        chat_resp = await client.post(
            f"/api/trips/{trip_id}/assistant/messages",
            json={"message": "I'm tired, can we skip the haveli and find a rooftop tea shop nearby?"},
        )
        assert chat_resp.status_code == 200, chat_resp.text
        chat_data = chat_resp.json()

        # Verify companion persona narrative & acknowledgment of prior skip
        narrative = chat_data["response_narrative"]
        assert "Khamma Ghani" in narrative or "Namaste" in narrative
        # Acknowledges prior skip/action
        assert any(
            phrase in narrative.lower()
            for phrase in ["skipped", "earlier", "timeline", "noted", "kept that in mind"]
        )

        # Verify embedded replan proposal card generated via propose_trip_changes
        proposal = chat_data["replan_proposal"]
        assert proposal is not None
        assert proposal["base_revision"] == 2
        assert proposal["is_feasible"] is True
        proposal_id = proposal["proposal_id"]
        assert proposal_id.startswith("prop_ai_")

        # Validation diff
        diff = proposal["validation_diff"]
        assert len(diff["stops_added"]) > 0 or len(diff["stops_skipped"]) > 0

        # 4. 1-Tap Accept from chat: Tourist commits proposal atomically
        commit_resp = await client.post(
            f"/api/trips/{trip_id}/replan-accept",
            json={"proposal_id": proposal_id, "expected_revision": 2},
        )
        assert commit_resp.status_code == 200, commit_resp.text
        assert commit_resp.json()["new_revision"] == 3

        # 5. Verify authoritative trip now at Revision 3
        get_trip_resp = await client.get(f"/api/trips/{trip_id}")
        assert get_trip_resp.status_code == 200
        assert get_trip_resp.json()["revision"] == 3

        # 6. Clean up
        async with async_session_maker() as session:
            await session.execute(text("DELETE FROM trips WHERE id = :id"), {"id": trip_id})
            await session.commit()


@pytest.mark.asyncio
async def test_checkout_triggers_transition_push_notification_and_audit_event():
    transport = ASGITransport(app=app)

    create_payload = {
        "user_id": "test_checkout_notif_tourist",
        "title": "Transition Push Test Trip",
        "start_datetime": "2026-11-01T09:00:00+05:30",
        "total_days": 1,
        "budget_inr": 2000,
        "place_ids": ["place_city_palace", "place_bagore_haveli"],
    }

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        create_resp = await client.post("/api/trips", json=create_payload)
        assert create_resp.status_code == 201
        trip = create_resp.json()
        trip_id = trip["id"]
        stops = trip["active_version"]["stops"]
        first_stop_id = stops[0]["id"]

        # Register push subscription
        sub_resp = await client.post(
            f"/api/trips/{trip_id}/push/subscribe",
            json={
                "endpoint": "https://fcm.googleapis.com/fcm/send/fake-token",
                "keys": {"p256dh": "dummy-p256dh", "auth": "dummy-auth"},
            },
        )
        assert sub_resp.status_code == 200
        assert sub_resp.json()["success"] is True

        # Perform checkout on stop 1
        checkout_resp = await client.post(
            f"/api/trips/{trip_id}/stops/{first_stop_id}/checkout",
            json={"checkout_method": "manual_tap"},
        )
        assert checkout_resp.status_code == 200
        checkout_data = checkout_resp.json()

        # Check transition notification is present
        assert "transition_notification" in checkout_data
        notif = checkout_data["transition_notification"]
        assert "Bagore Ki Haveli" in notif["title"] or "Bagore Ki Haveli" in notif["next_stop_name"]
        assert "scenic_tip" in notif
        assert "gate_tip" in notif

        # Verify audit event in trip_events
        events_resp = await client.get(f"/api/trips/{trip_id}/events")
        assert events_resp.status_code == 200
        events = events_resp.json()
        dispatched_event = next(
            (e for e in events if e["event_type"] == "transition_notification_dispatched"),
            None
        )
        assert dispatched_event is not None
        assert dispatched_event["payload"]["next_stop_id"] == stops[1]["id"]

        # Clean up
        async with async_session_maker() as session:
            await session.execute(text("DELETE FROM trips WHERE id = :id"), {"id": trip_id})
            await session.commit()

