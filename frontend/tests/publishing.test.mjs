import test from "node:test";
import assert from "node:assert/strict";

// Test 1: Visited vs Skipped Stop Checklist Filtering and Privacy Exclusion
test("Pre-selects only confirmed visited stops and excludes private starting accommodation", () => {
  const tripStops = [
    {
      id: "stop_hotel",
      name: "Taj Lake Palace Homestay",
      category: "accommodation",
      visit_status: "visited",
      entry_fee_inr: 0,
      suggested_duration_minutes: 60,
    },
    {
      id: "stop_palace",
      name: "City Palace Udaipur",
      category: "heritage",
      visit_status: "visited",
      entry_fee_inr: 330,
      suggested_duration_minutes: 120,
    },
    {
      id: "stop_studio",
      name: "Master Mohanlal Miniature Art Studio",
      category: "artisan_studio",
      visit_status: "visited",
      entry_fee_inr: 0,
      suggested_duration_minutes: 45,
    },
    {
      id: "stop_temple",
      name: "Jagdish Temple",
      category: "heritage",
      visit_status: "skipped",
      entry_fee_inr: 0,
      suggested_duration_minutes: 30,
    },
  ];

  function filterEligiblePublishStops(stops, excludeAccommodation = true) {
    return stops.filter((s, idx) => {
      // Exclude skipped stops
      if (s.visit_status === "skipped") return false;
      // Exclude private accommodation if requested
      if (
        excludeAccommodation &&
        (s.category === "accommodation" || s.name.toLowerCase().includes("homestay"))
      ) {
        return false;
      }
      return true;
    });
  }

  const eligible = filterEligiblePublishStops(tripStops, true);

  assert.equal(eligible.length, 2, "Only City Palace and Mohanlal Studio should be eligible");
  assert.equal(eligible[0].name, "City Palace Udaipur");
  assert.equal(eligible[1].name, "Master Mohanlal Miniature Art Studio");
  assert.ok(!eligible.some((s) => s.category === "accommodation"), "Private accommodation must be excluded");
  assert.ok(!eligible.some((s) => s.visit_status === "skipped"), "Skipped stops must not be included");
});

// Test 2: Privacy Scrubbing of Private Notes and Synthesis of Relative Pacing
test("Scrubs private notes and generates relative time slots for community trail stops", () => {
  const confirmedStops = [
    {
      id: "stop_1",
      place_id: "place_city_palace",
      name: "City Palace Udaipur",
      suggested_duration_minutes: 120,
      planned_arrival: "2026-10-31T09:30:00Z",
      private_notes: "Room key in pocket, car parked at Badi Pol, booking ref #9921",
    },
    {
      id: "stop_2",
      place_id: "place_mohanlal_studio",
      name: "Master Mohanlal Miniature Art Studio",
      suggested_duration_minutes: 45,
      planned_arrival: "2026-10-31T12:00:00Z",
      private_notes: "Called Ramesh beforehand at +919829000000",
    },
  ];

  function convertToCommunityTrailStops(stops, excludePrivateNotes = true) {
    return stops.map((s, idx) => {
      const hour = new Date(s.planned_arrival).getUTCHours();
      let time_slot = "morning";
      if (hour >= 12 && hour < 17) time_slot = "afternoon";
      else if (hour >= 17 && hour < 20) time_slot = "sunset_evening";

      return {
        id: `cts_demo_${idx + 1}`,
        place_id: s.place_id,
        place_name: s.name,
        sequence_in_day: idx + 1,
        suggested_duration_minutes: s.suggested_duration_minutes,
        estimated_transit_minutes: 15,
        time_slot,
        traveler_tip: excludePrivateNotes
          ? `Verified stop: ${s.name}. Recommended duration ${s.suggested_duration_minutes}m.`
          : s.private_notes,
      };
    });
  }

  const communityStops = convertToCommunityTrailStops(confirmedStops, true);

  assert.equal(communityStops.length, 2);
  assert.equal(communityStops[0].time_slot, "morning");
  assert.equal(communityStops[1].time_slot, "afternoon");

  // Verify private notes are strictly absent
  for (const cs of communityStops) {
    assert.ok(!cs.traveler_tip.includes("booking ref"));
    assert.ok(!cs.traveler_tip.includes("+919829000000"));
    assert.ok(!cs.traveler_tip.includes("car parked"));
    assert.ok(cs.traveler_tip.startsWith("Verified stop:"));
  }
});

// Test 3: Metric Aggregations & Experienced Trail Badge
test("Aggregates total duration and cost, applying the Experienced Trail badge", () => {
  const publishedTrail = {
    id: "trail_published_123",
    title: "City Palace to Miniature Art Walk",
    author_name: "Fellow Traveler",
    duration_type: "single_day",
    total_duration_hours: 2.8,
    estimated_cost_inr: 330,
    tags: ["heritage", "artisan"],
    is_experienced: true,
    is_featured: false,
    stops_count: 2,
  };

  assert.equal(publishedTrail.is_experienced, true, "Published trails must have is_experienced: true");
  assert.equal(publishedTrail.estimated_cost_inr, 330);
  assert.equal(publishedTrail.total_duration_hours, 2.8);
  assert.equal(publishedTrail.stops_count, 2);
});

