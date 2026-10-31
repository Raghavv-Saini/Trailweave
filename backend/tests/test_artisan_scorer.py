"""
Unit tests for Track 2 Ticket 06: Artisan Smart Recommendation Scorer
Verifies spatial detour buffer (<=15 mins), preference filtering, budget headroom, and rationale formatting.
"""
from datetime import time
from app.engine.artisan_scorer import ArtisanRecommendationScorer


def get_mock_route_stops():
    return [
        {
            "id": "stop_cp",
            "place_id": "place_city_palace",
            "name": "City Palace Udaipur",
            "latitude": 24.5764,
            "longitude": 73.6835,
            "sequence_in_day": 1,
            "visit_status": "visited",
            "entry_fee_inr": 330,
        },
        {
            "id": "stop_jt",
            "place_id": "place_jagdish_temple",
            "name": "Jagdish Temple",
            "latitude": 24.5794,
            "longitude": 73.6841,
            "sequence_in_day": 2,
            "visit_status": "pending",
            "entry_fee_inr": 0,
        },
        {
            "id": "stop_bh",
            "place_id": "place_bagore_haveli",
            "name": "Bagore Ki Haveli",
            "latitude": 24.5798,
            "longitude": 73.6800,
            "sequence_in_day": 3,
            "visit_status": "pending",
            "entry_fee_inr": 100,
        },
    ]


def get_mock_candidates():
    return [
        {
            "id": "artisan_mohanlal",
            "artisan_id": "artisan_mohanlal",
            "place_id": "place_mohanlal_studio",
            "artisan_name": "Master Mohanlal Sharma",
            "craft_type": "Pichwai & Miniature Painting",
            "latitude": 24.5796,
            "longitude": 73.6844,
            "has_workshop": True,
            "workshop_fee_inr": 300,
            "workshop_duration_minutes": 45,
            "opening_time": time(10, 0),
            "closing_time": time(20, 0),
        },
        {
            "id": "artisan_pottery",
            "artisan_id": "artisan_pottery",
            "place_id": "place_pottery_studio",
            "artisan_name": "Master Kavita Kumhar",
            "craft_type": "Terracotta Pottery & Clay Sculpting",
            "latitude": 24.5815,
            "longitude": 73.6820,
            "has_workshop": True,
            "workshop_fee_inr": 250,
            "workshop_duration_minutes": 45,
            "opening_time": time(9, 30),
            "closing_time": time(19, 30),
        },
        {
            "id": "artisan_leather",
            "artisan_id": "artisan_leather",
            "place_id": "place_leather_craft",
            "artisan_name": "Ramesh Chandra Parmar",
            "craft_type": "Handcrafted Camel Leather",
            "latitude": 24.5840,
            "longitude": 73.6865,
            "has_workshop": False,
            "workshop_fee_inr": 0,
            "workshop_duration_minutes": 20,
            "opening_time": time(10, 30),
            "closing_time": time(20, 30),
        },
        {
            "id": "artisan_far",
            "artisan_id": "artisan_far",
            "place_id": "place_far_studio",
            "artisan_name": "Distant Kumbhalgarh Crafts",
            "craft_type": "Stone Carving",
            "latitude": 25.1500,
            "longitude": 73.5800,
            "has_workshop": True,
            "workshop_fee_inr": 400,
            "workshop_duration_minutes": 60,
            "opening_time": time(9, 0),
            "closing_time": time(18, 0),
        },
    ]


def test_detour_buffer_and_distant_studio_filtering():
    scorer = ArtisanRecommendationScorer()
    stops = get_mock_route_stops()
    candidates = get_mock_candidates()

    results = scorer.score_candidates(
        route_stops=stops,
        candidate_artisans=candidates,
        remaining_budget=2000,
        preference="both",
        max_detour_minutes=15,
    )

    place_ids = [r["place_id"] for r in results]
    assert "place_far_studio" not in place_ids, "Distant candidate beyond 15m detour must be filtered"
    for r in results:
        assert r["detour_minutes"] <= 15


def test_exclude_already_scheduled_artisan():
    scorer = ArtisanRecommendationScorer()
    stops = get_mock_route_stops()
    # Add Mohanlal to route stops
    stops.append({
        "id": "stop_ml",
        "place_id": "place_mohanlal_studio",
        "name": "Master Mohanlal Miniature Art Studio",
        "latitude": 24.5796,
        "longitude": 73.6844,
        "sequence_in_day": 4,
        "visit_status": "pending",
        "entry_fee_inr": 300,
    })

    candidates = get_mock_candidates()
    results = scorer.score_candidates(
        route_stops=stops,
        candidate_artisans=candidates,
        remaining_budget=2000,
        preference="both",
    )

    place_ids = [r["place_id"] for r in results]
    assert "place_mohanlal_studio" not in place_ids, "Artisan already in route stops must be excluded"


def test_workshop_preference_filtering():
    scorer = ArtisanRecommendationScorer()
    stops = get_mock_route_stops()
    candidates = get_mock_candidates()

    # Preference: workshops only
    workshop_results = scorer.score_candidates(
        route_stops=stops,
        candidate_artisans=candidates,
        remaining_budget=2000,
        preference="workshops",
    )

    for r in workshop_results:
        assert r["offering_type"] == "workshop"
        assert r["has_workshop"] is True
        assert r["fee_inr"] > 0
    # Ramesh has no workshop, so must be excluded
    assert not any(r["place_id"] == "place_leather_craft" for r in workshop_results)


def test_store_visit_preference_filtering():
    scorer = ArtisanRecommendationScorer()
    stops = get_mock_route_stops()
    candidates = get_mock_candidates()

    # Preference: store visits only
    store_results = scorer.score_candidates(
        route_stops=stops,
        candidate_artisans=candidates,
        remaining_budget=2000,
        preference="store_visits",
    )

    for r in store_results:
        assert r["offering_type"] == "store"
        assert r["fee_inr"] == 0.0
        assert r["duration_minutes"] == 20
        assert "store visit" in r["rationale"]


def test_budget_headroom_filtering():
    scorer = ArtisanRecommendationScorer()
    stops = get_mock_route_stops()
    candidates = get_mock_candidates()

    # Low budget: ₹260 remaining
    # Mohanlal (₹300) exceeds budget, Pottery (₹250) fits
    results = scorer.score_candidates(
        route_stops=stops,
        candidate_artisans=candidates,
        remaining_budget=260,
        preference="workshops",
    )

    assert any(r["place_id"] == "place_pottery_studio" for r in results)
    assert not any(r["place_id"] == "place_mohanlal_studio" for r in results)


def test_transparent_rationale_string_format():
    scorer = ArtisanRecommendationScorer()
    stops = get_mock_route_stops()
    candidates = get_mock_candidates()

    results = scorer.score_candidates(
        route_stops=stops,
        candidate_artisans=candidates,
        remaining_budget=1500,
        preference="workshops",
    )

    for r in results:
        rationale = r["rationale"]
        assert f"{r['detour_minutes']} min detour" in rationale
        assert f"₹{int(r['fee_inr'])} workshop fee" in rationale
        assert "open until" in rationale
        assert "fits under your ₹1,500 budget" in rationale
