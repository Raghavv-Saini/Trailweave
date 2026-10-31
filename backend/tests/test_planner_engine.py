from datetime import datetime, time, timezone, timedelta
import pytest

from app.services.planner import (
    PlaceCandidate,
    StartLocation,
    PlannerConfig,
    solve_itinerary,
)

IST = timezone(timedelta(hours=5, minutes=30))


def make_udaipur_places() -> dict[str, PlaceCandidate]:
    return {
        "place_city_palace": PlaceCandidate(
            id="place_city_palace",
            name="City Palace Udaipur",
            category="heritage",
            latitude=24.5764,
            longitude=73.6835,
            entry_fee_inr=330.0,
            typical_duration_minutes=120,
            opening_time=time(9, 0),
            closing_time=time(17, 30),
        ),
        "place_jagdish_temple": PlaceCandidate(
            id="place_jagdish_temple",
            name="Jagdish Temple",
            category="heritage",
            latitude=24.5794,
            longitude=73.6841,
            entry_fee_inr=0.0,
            typical_duration_minutes=30,
            opening_time=time(5, 0),
            closing_time=time(22, 0),
        ),
        "place_mohanlal_studio": PlaceCandidate(
            id="place_mohanlal_studio",
            name="Master Mohanlal Miniature Art Studio",
            category="artisan_studio",
            latitude=24.5796,
            longitude=73.6844,
            entry_fee_inr=0.0,
            typical_duration_minutes=45,
            opening_time=time(10, 0),
            closing_time=time(20, 0),
            has_workshop=True,
            workshop_fee_inr=300.0,
            workshop_duration_minutes=45,
        ),
        "place_bagore_haveli": PlaceCandidate(
            id="place_bagore_haveli",
            name="Bagore Ki Haveli",
            category="heritage",
            latitude=24.5798,
            longitude=73.6800,
            entry_fee_inr=100.0,
            typical_duration_minutes=90,
            opening_time=time(10, 0),
            closing_time=time(20, 0),
        ),
        "place_sukhadia_circle": PlaceCandidate(
            id="place_sukhadia_circle",
            name="Sukhadia Circle Street Food",
            category="dining",
            latitude=24.6035,
            longitude=73.6885,
            entry_fee_inr=0.0,
            typical_duration_minutes=45,
            opening_time=time(17, 0),
            closing_time=time(23, 0),
        ),
        "place_saheliyon_bari": PlaceCandidate(
            id="place_saheliyon_bari",
            name="Saheliyon Ki Bari",
            category="attraction",
            latitude=24.6019,
            longitude=73.6853,
            entry_fee_inr=50.0,
            typical_duration_minutes=60,
            opening_time=time(9, 0),
            closing_time=time(19, 0),
        ),
        "place_night_lounge": PlaceCandidate(
            id="place_night_lounge",
            name="Ambrai Ghat Night Lounge",
            category="dining",
            latitude=24.5780,
            longitude=73.6805,
            entry_fee_inr=0.0,
            typical_duration_minutes=60,
            opening_time=time(18, 0),
            closing_time=time(1, 0),  # Closes at 01:00 AM post-midnight
        ),
    }


@pytest.mark.asyncio
async def test_single_day_itinerary_expands_timestamps_and_optimizes_route():
    places = make_udaipur_places()
    selected = [
        places["place_mohanlal_studio"],  # opens 10:00
        places["place_jagdish_temple"],   # opens 05:00, closer to Swaroop Vilas than City Palace
        places["place_city_palace"],      # opens 09:00
    ]
    config = PlannerConfig(
        start_location=StartLocation(
            name="Hotel Swaroop Vilas",
            latitude=24.5854,
            longitude=73.6812,
        ),
        start_datetime=datetime(2026, 11, 1, 9, 0, tzinfo=IST),
        total_days=1,
        budget_inr=1000.0,
        budget_mode="total",
        travel_mode="auto_rickshaw",
        artisan_preference="workshop",
        optimize_route=True,
    )

    plan = await solve_itinerary(selected, config)

    assert plan.is_feasible is True
    assert len(plan.stops) == 3
    # Jagdish Temple is nearest to Hotel Swaroop Vilas and open at 9 AM, whereas Mohanlal Studio doesn't open until 10 AM
    assert plan.stops[0].place_id == "place_jagdish_temple"
    assert plan.stops[0].sequence_in_day == 1
    assert plan.stops[0].day_number == 1
    assert plan.stops[0].planned_arrival > config.start_datetime
    assert (
        plan.stops[0].planned_departure - plan.stops[0].planned_arrival
    ) == timedelta(minutes=30)

    # Every subsequent stop arrives after the previous stop's departure + transit time
    for idx in range(1, len(plan.stops)):
        prev = plan.stops[idx - 1]
        curr = plan.stops[idx]
        assert curr.sequence_in_day == idx + 1
        assert curr.planned_arrival >= prev.planned_departure + timedelta(minutes=curr.transit_minutes_from_prev)
        assert curr.planned_departure == curr.planned_arrival + timedelta(minutes=curr.suggested_duration_minutes)

    # Cost = 0 (Jagdish) + 330 (City Palace) + 300 (Mohanlal workshop) = 630 INR
    assert plan.total_estimated_cost_inr == 630.0
    assert plan.total_estimated_duration_minutes > 195


@pytest.mark.asyncio
async def test_operating_hours_shifts_early_arrival_and_flags_closing_violation():
    places = make_udaipur_places()
    # Start at 08:00 AM for City Palace (opens 09:00 AM, closes 17:30)
    early_config = PlannerConfig(
        start_location=StartLocation("Hotel Swaroop Vilas", 24.5854, 73.6812),
        start_datetime=datetime(2026, 11, 1, 8, 0, tzinfo=IST),
        total_days=1,
        budget_inr=1000.0,
    )
    early_plan = await solve_itinerary([places["place_city_palace"]], early_config)
    assert early_plan.is_feasible is True
    assert early_plan.stops[0].planned_arrival.time() == time(9, 0)
    assert early_plan.stops[0].planned_departure.time() == time(11, 0)

    # Start at 16:30 for City Palace (needs 120 mins, closes 17:30 -> departs after 18:30)
    late_config = PlannerConfig(
        start_location=StartLocation("Hotel Swaroop Vilas", 24.5854, 73.6812),
        start_datetime=datetime(2026, 11, 1, 16, 30, tzinfo=IST),
        total_days=1,
        budget_inr=1000.0,
    )
    late_plan = await solve_itinerary([places["place_city_palace"]], late_config)
    assert late_plan.is_feasible is False
    assert len(late_plan.closing_hour_conflicts) == 1
    assert "City Palace Udaipur" in late_plan.closing_hour_conflicts[0]


@pytest.mark.asyncio
async def test_budget_constraint_and_artisan_preference_adaptation():
    places = make_udaipur_places()
    selected = [places["place_city_palace"], places["place_mohanlal_studio"]]

    # With workshop preference, cost = 330 + 300 = 630 > 400 budget -> infeasible
    workshop_cfg = PlannerConfig(
        start_location=StartLocation("Hotel Swaroop Vilas", 24.5854, 73.6812),
        start_datetime=datetime(2026, 11, 1, 9, 0, tzinfo=IST),
        total_days=1,
        budget_inr=400.0,
        artisan_preference="workshop",
    )
    workshop_plan = await solve_itinerary(selected, workshop_cfg)
    assert workshop_plan.is_feasible is False
    assert workshop_plan.budget_exceeded is True
    assert workshop_plan.total_estimated_cost_inr == 630.0

    # With store preference, Mohanlal Studio is a 20-min retail visit with 0 workshop fee -> cost = 330 <= 400 -> feasible!
    store_cfg = PlannerConfig(
        start_location=StartLocation("Hotel Swaroop Vilas", 24.5854, 73.6812),
        start_datetime=datetime(2026, 11, 1, 9, 0, tzinfo=IST),
        total_days=1,
        budget_inr=400.0,
        artisan_preference="store",
    )
    store_plan = await solve_itinerary(selected, store_cfg)
    assert store_plan.is_feasible is True
    assert store_plan.budget_exceeded is False
    assert store_plan.total_estimated_cost_inr == 330.0
    mohanlal_stop = next(s for s in store_plan.stops if s.place_id == "place_mohanlal_studio")
    assert mohanlal_stop.suggested_duration_minutes == 20
    assert mohanlal_stop.estimated_cost_inr == 0.0


@pytest.mark.asyncio
async def test_multi_day_itinerary_schedules_days_independently_from_start_location():
    places = make_udaipur_places()
    # 4 places across a 2-day trip without explicit day_number -> distributed across Day 1 and Day 2
    selected = [
        places["place_city_palace"],
        places["place_jagdish_temple"],
        places["place_saheliyon_bari"],
        places["place_bagore_haveli"],
    ]
    config = PlannerConfig(
        start_location=StartLocation("Hotel Swaroop Vilas", 24.5854, 73.6812),
        start_datetime=datetime(2026, 11, 1, 9, 0, tzinfo=IST),
        total_days=2,
        budget_inr=500.0,
        budget_mode="per_day",
        travel_mode="auto_rickshaw",
    )

    plan = await solve_itinerary(selected, config)

    assert plan.is_feasible is True
    day1_stops = [s for s in plan.stops if s.day_number == 1]
    day2_stops = [s for s in plan.stops if s.day_number == 2]
    assert len(day1_stops) == 2
    assert len(day2_stops) == 2

    # Sequence resets to 1 on each day, and Day 2 timestamps are on 2026-11-02
    assert [s.sequence_in_day for s in day1_stops] == [1, 2]
    assert [s.sequence_in_day for s in day2_stops] == [1, 2]
    assert day1_stops[0].planned_arrival.date().isoformat() == "2026-11-01"
    assert day2_stops[0].planned_arrival.date().isoformat() == "2026-11-02"
    assert "days" in plan.route_geometry
    assert len(plan.route_geometry["days"]) == 2


@pytest.mark.asyncio
async def test_google_distance_matrix_used_when_api_key_present(monkeypatch):
    places = make_udaipur_places()
    called_urls = []

    class DummyResponse:
        status_code = 200

        def json(self):
            return {
                "status": "OK",
                "rows": [
                    {
                        "elements": [
                            {
                                "status": "OK",
                                "duration": {"value": 720},  # 12 mins
                                "duration_in_traffic": {"value": 840},  # 14 mins
                                "distance": {"value": 3200},
                            }
                        ]
                    }
                ],
            }

    async def fake_get(self, url, params=None, **kwargs):
        called_urls.append((url, params))
        return DummyResponse()

    import httpx

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)

    config = PlannerConfig(
        start_location=StartLocation("Hotel Swaroop Vilas", 24.5854, 73.6812),
        start_datetime=datetime(2026, 11, 1, 9, 0, tzinfo=IST),
        total_days=1,
        budget_inr=1000.0,
        travel_mode="cab",
        google_maps_api_key="test_gmaps_key",
    )

    plan = await solve_itinerary([places["place_city_palace"]], config)
    assert len(called_urls) >= 1
    assert plan.stops[0].transit_minutes_from_prev == 14
    assert plan.stops[0].planned_arrival == datetime(2026, 11, 1, 9, 14, tzinfo=IST)


@pytest.mark.asyncio
async def test_post_midnight_closing_time_does_not_false_trigger_conflict():
    """Verify places open until 1 AM post-midnight are feasible for evening arrivals."""
    places = make_udaipur_places()
    config = PlannerConfig(
        start_location=StartLocation("Hotel Swaroop Vilas", 24.5854, 73.6812),
        start_datetime=datetime(2026, 11, 1, 19, 0, tzinfo=IST),
        total_days=1,
        budget_inr=1000.0,
    )
    plan = await solve_itinerary([places["place_night_lounge"]], config)
    assert plan.is_feasible is True
    assert len(plan.closing_hour_conflicts) == 0
    assert plan.stops[0].planned_arrival.time() == time(19, 10) or plan.stops[0].planned_arrival.hour >= 19


@pytest.mark.asyncio
async def test_utc_start_datetime_normalizes_to_ist_without_distortion():
    """Verify UTC datetime (03:30Z = 09:00 IST) correctly maps to Udaipur local operating hours."""
    places = make_udaipur_places()
    # 03:30 UTC is exactly 09:00 IST
    utc_start = datetime(2026, 11, 1, 3, 30, tzinfo=timezone.utc)
    config = PlannerConfig(
        start_location=StartLocation("Hotel Swaroop Vilas", 24.5854, 73.6812),
        start_datetime=utc_start,
        total_days=1,
        budget_inr=1000.0,
    )
    plan = await solve_itinerary([places["place_city_palace"]], config)
    assert plan.is_feasible is True
    # City Palace opens at 9:00 AM IST. Arrival should be in IST morning, not shifted to 14:30!
    assert plan.stops[0].planned_arrival.astimezone(IST).time() == time(9, 0) or (
        plan.stops[0].planned_arrival.astimezone(IST).hour == 9
    )
    assert plan.route_geometry["start_datetime"].endswith("+05:30")


@pytest.mark.asyncio
async def test_curated_trail_sequence_strictly_preserved_when_optimize_route_false():
    """Verify stops with explicit sequence_in_day preserve their order when optimize_route=False."""
    places = make_udaipur_places()
    # Provide reverse order deliberately
    stop1 = places["place_city_palace"]
    stop1.sequence_in_day = 1
    stop2 = places["place_mohanlal_studio"]
    stop2.sequence_in_day = 2
    stop3 = places["place_jagdish_temple"]
    stop3.sequence_in_day = 3

    config = PlannerConfig(
        start_location=StartLocation("Hotel Swaroop Vilas", 24.5854, 73.6812),
        start_datetime=datetime(2026, 11, 1, 9, 0, tzinfo=IST),
        total_days=1,
        budget_inr=1000.0,
        optimize_route=False,
    )
    plan = await solve_itinerary([stop1, stop2, stop3], config)
    assert plan.stops[0].place_id == "place_city_palace"
    assert plan.stops[1].place_id == "place_mohanlal_studio"
    assert plan.stops[2].place_id == "place_jagdish_temple"
