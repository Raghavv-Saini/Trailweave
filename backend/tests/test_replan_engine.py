from datetime import datetime, timezone, time, timedelta
import pytest

from app.engine.replan import UnifiedMutationEngine
from app.schemas.replan import ReplanOperation
from app.services.planner import StartLocation


@pytest.fixture
def mutation_engine():
    return UnifiedMutationEngine()


@pytest.fixture
def start_location():
    return StartLocation(
        name="Hotel Swaroop Vilas",
        latitude=24.5854,
        longitude=73.6812,
    )


@pytest.fixture
def base_trip_stops():
    # 3 stops in Udaipur
    t0 = datetime(2026, 11, 1, 9, 0, tzinfo=timezone.utc)
    return [
        {
            "id": "stop_1",
            "trip_id": "trip_test",
            "place_id": "place_city_palace",
            "name": "City Palace",
            "address": "Old City, Udaipur",
            "latitude": 24.5764,
            "longitude": 73.6835,
            "category": "heritage",
            "entry_fee_inr": 330.0,
            "day_number": 1,
            "sequence_in_day": 1,
            "planned_arrival": t0,
            "planned_departure": t0 + timedelta(minutes=90),
            "suggested_duration_minutes": 90,
            "actual_duration_minutes": None,
            "is_pinned": False,
            "visit_status": "pending",
            "opening_time": time(9, 30),
            "closing_time": time(17, 30),
            "has_workshop": False,
            "workshop_fee_inr": 0.0,
            "workshop_duration_minutes": 45,
        },
        {
            "id": "stop_2",
            "trip_id": "trip_test",
            "place_id": "place_jagdish_temple",
            "name": "Jagdish Temple",
            "address": "Jagdish Chowk, Udaipur",
            "latitude": 24.5790,
            "longitude": 73.6840,
            "category": "heritage",
            "entry_fee_inr": 0.0,
            "day_number": 1,
            "sequence_in_day": 2,
            "planned_arrival": t0 + timedelta(minutes=100),
            "planned_departure": t0 + timedelta(minutes=130),
            "suggested_duration_minutes": 30,
            "actual_duration_minutes": None,
            "is_pinned": False,
            "visit_status": "pending",
            "opening_time": time(5, 30),
            "closing_time": time(22, 0),
            "has_workshop": False,
            "workshop_fee_inr": 0.0,
            "workshop_duration_minutes": 45,
        },
        {
            "id": "stop_3",
            "trip_id": "trip_test",
            "place_id": "place_bagore_haveli",
            "name": "Bagore Ki Haveli",
            "address": "Gangaur Ghat, Udaipur",
            "latitude": 24.5794,
            "longitude": 73.6810,
            "category": "heritage",
            "entry_fee_inr": 100.0,
            "day_number": 1,
            "sequence_in_day": 3,
            "planned_arrival": t0 + timedelta(minutes=140),
            "planned_departure": t0 + timedelta(minutes=200),
            "suggested_duration_minutes": 60,
            "actual_duration_minutes": None,
            "is_pinned": False,
            "visit_status": "pending",
            "opening_time": time(9, 30),
            "closing_time": time(19, 0),
            "has_workshop": False,
            "workshop_fee_inr": 0.0,
            "workshop_duration_minutes": 45,
        },
    ]


@pytest.fixture
def places_catalog():
    return {
        "place_mohanlal_studio": {
            "id": "place_mohanlal_studio",
            "name": "Master Mohanlal Miniature Art Studio",
            "address": "14 Jagdish Chowk, Udaipur",
            "latitude": 24.5796,
            "longitude": 73.6844,
            "category": "artisan_studio",
            "entry_fee_inr": 0.0,
            "typical_duration_minutes": 45,
            "opening_time": time(10, 0),
            "closing_time": time(19, 0),
            "has_workshop": True,
            "workshop_fee_inr": 300.0,
            "workshop_duration_minutes": 45,
        }
    }


@pytest.mark.asyncio
async def test_replan_skip_stop_marks_skipped_and_bypasses(
    mutation_engine, start_location, base_trip_stops, places_catalog
):
    ops = [ReplanOperation(type="skip_stop", stop_id="stop_2")]
    start_dt = datetime(2026, 11, 1, 9, 0, tzinfo=timezone.utc)

    res = await mutation_engine.evaluate_mutation(
        current_stops=base_trip_stops,
        operations=ops,
        trip_id="trip_test",
        base_revision=1,
        budget_limit=2000.0,
        start_location=start_location,
        start_datetime=start_dt,
        travel_mode="walking",
        artisan_preference="workshop",
        places_catalog=places_catalog,
        now_override=start_dt,
    )

    assert res["is_feasible"] is True
    diff = res["validation_diff"]
    assert "stop_2" in diff.stops_skipped
    assert len(diff.stops_added) == 0

    stops = res["candidate_stops"]
    assert len(stops) == 3
    stop_2 = next(s for s in stops if s["id"] == "stop_2")
    assert stop_2["visit_status"] == "skipped"
    assert stop_2["suggested_duration_minutes"] == 0

    stop_3 = next(s for s in stops if s["id"] == "stop_3")
    assert stop_3["visit_status"] == "pending"


@pytest.mark.asyncio
async def test_replan_add_stop_inserts_and_recalculates(
    mutation_engine, start_location, base_trip_stops, places_catalog
):
    ops = [
        ReplanOperation(
            type="add_stop",
            place_id="place_mohanlal_studio",
            new_order=2,
            day_number=1,
        )
    ]
    start_dt = datetime(2026, 11, 1, 9, 0, tzinfo=timezone.utc)

    res = await mutation_engine.evaluate_mutation(
        current_stops=base_trip_stops,
        operations=ops,
        trip_id="trip_test",
        base_revision=1,
        budget_limit=2000.0,
        start_location=start_location,
        start_datetime=start_dt,
        travel_mode="walking",
        artisan_preference="workshop",
        places_catalog=places_catalog,
        now_override=start_dt,
    )

    assert res["is_feasible"] is True
    diff = res["validation_diff"]
    assert "place_mohanlal_studio" in diff.stops_added
    # Mohanlal workshop fee = 300 INR
    assert diff.cost_delta_inr == 300.0

    stops = res["candidate_stops"]
    assert len(stops) == 4
    assert stops[1]["place_id"] == "place_mohanlal_studio"
    assert stops[1]["sequence_in_day"] == 2
    assert stops[2]["id"] == "stop_2"
    assert stops[2]["sequence_in_day"] == 3


@pytest.mark.asyncio
async def test_replan_remove_stop_removes_from_sequence(
    mutation_engine, start_location, base_trip_stops, places_catalog
):
    ops = [ReplanOperation(type="remove_stop", stop_id="stop_3")]
    start_dt = datetime(2026, 11, 1, 9, 0, tzinfo=timezone.utc)

    res = await mutation_engine.evaluate_mutation(
        current_stops=base_trip_stops,
        operations=ops,
        trip_id="trip_test",
        base_revision=1,
        budget_limit=2000.0,
        start_location=start_location,
        start_datetime=start_dt,
        places_catalog=places_catalog,
        now_override=start_dt,
    )

    assert res["is_feasible"] is True
    stops = res["candidate_stops"]
    assert len(stops) == 2
    assert all(s["id"] != "stop_3" for s in stops)
    # Stop 3 had 100 INR entry fee
    assert res["validation_diff"].cost_delta_inr == -100.0


@pytest.mark.asyncio
async def test_replan_reorder_and_pin_stops(
    mutation_engine, start_location, base_trip_stops, places_catalog
):
    ops = [
        ReplanOperation(type="reorder_stops", stop_id="stop_3", new_order=1),
        ReplanOperation(type="pin_stop", stop_id="stop_3", is_pinned=True),
    ]
    start_dt = datetime(2026, 11, 1, 9, 0, tzinfo=timezone.utc)

    res = await mutation_engine.evaluate_mutation(
        current_stops=base_trip_stops,
        operations=ops,
        trip_id="trip_test",
        base_revision=1,
        budget_limit=2000.0,
        start_location=start_location,
        start_datetime=start_dt,
        places_catalog=places_catalog,
        now_override=start_dt,
    )

    stops = res["candidate_stops"]
    assert stops[0]["id"] == "stop_3"
    assert stops[0]["sequence_in_day"] == 1
    assert stops[0]["is_pinned"] is True


@pytest.mark.asyncio
async def test_replan_rejects_modifying_visited_stops(
    mutation_engine, start_location, base_trip_stops, places_catalog
):
    # Mark stop_1 as visited
    base_trip_stops[0]["visit_status"] = "visited"

    ops = [ReplanOperation(type="skip_stop", stop_id="stop_1")]
    start_dt = datetime(2026, 11, 1, 9, 0, tzinfo=timezone.utc)

    with pytest.raises(ValueError, match="Cannot modify already completed stop stop_1"):
        await mutation_engine.evaluate_mutation(
            current_stops=base_trip_stops,
            operations=ops,
            trip_id="trip_test",
            base_revision=1,
            budget_limit=2000.0,
            start_location=start_location,
            start_datetime=start_dt,
            places_catalog=places_catalog,
            now_override=start_dt,
        )


@pytest.mark.asyncio
async def test_replan_flags_budget_exceeded(
    mutation_engine, start_location, base_trip_stops, places_catalog
):
    # Total current cost = 330 (palace) + 0 (temple) + 100 (haveli) = 430 INR
    # Setting budget_limit to 400 INR makes it infeasible
    ops = []
    start_dt = datetime(2026, 11, 1, 9, 0, tzinfo=timezone.utc)

    res = await mutation_engine.evaluate_mutation(
        current_stops=base_trip_stops,
        operations=ops,
        trip_id="trip_test",
        base_revision=1,
        budget_limit=400.0,
        start_location=start_location,
        start_datetime=start_dt,
        places_catalog=places_catalog,
        now_override=start_dt,
    )

    assert res["is_feasible"] is False
    assert res["total_estimated_cost_inr"] == 430.0


@pytest.mark.asyncio
async def test_replan_flags_closing_hour_conflict(
    mutation_engine, start_location, base_trip_stops, places_catalog
):
    # Start late in the evening past closing time of Bagore Ki Haveli (19:00)
    start_dt = datetime(2026, 11, 1, 18, 30, tzinfo=timezone.utc)

    res = await mutation_engine.evaluate_mutation(
        current_stops=base_trip_stops,
        operations=[],
        trip_id="trip_test",
        base_revision=1,
        budget_limit=2000.0,
        start_location=start_location,
        start_datetime=start_dt,
        places_catalog=places_catalog,
        now_override=start_dt,
    )

    assert res["is_feasible"] is False
    assert len(res["validation_diff"].closing_hour_conflicts) > 0
