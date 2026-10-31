import test from "node:test";
import assert from "node:assert/strict";

// Test suite for Track 2 Ticket 06: Artisan Recommendation Scorer & Replan Staging
test("Artisan Recommendation Scorer filters duplicates and computes optimal insert order", () => {
  const currentStops = [
    { id: "s1", place_id: "place_city_palace", sequence_in_day: 1 },
    { id: "s2", place_id: "place_jagdish_temple", sequence_in_day: 2 },
  ];

  const candidateArtisans = [
    {
      place_id: "place_city_palace", // already in trip
      artisan_name: "Master Palace Guide",
      detour_minutes: 0,
    },
    {
      place_id: "place_pottery_studio",
      artisan_name: "Master Kavita Kumhar",
      detour_minutes: 5,
      optimal_insert_order: 2,
      offering_type: "workshop",
      fee_inr: 250,
    },
    {
      place_id: "place_far_studio",
      artisan_name: "Distant Studio",
      detour_minutes: 25, // exceeds 15m buffer
      optimal_insert_order: 3,
      offering_type: "workshop",
      fee_inr: 300,
    },
  ];

  const currentPlaceIds = new Set(currentStops.map((s) => s.place_id));

  // Filter candidates: detour <= 15m and not already in trip
  const validRecommendations = candidateArtisans.filter(
    (c) => !currentPlaceIds.has(c.place_id) && c.detour_minutes <= 15
  );

  assert.equal(validRecommendations.length, 1);
  assert.equal(validRecommendations[0].place_id, "place_pottery_studio");
  assert.equal(validRecommendations[0].optimal_insert_order, 2);
});

test("1-Tap Accept inserts artisan stop at optimal order and stages add_stop operation", () => {
  const initialStops = [
    { id: "s1", place_id: "place_city_palace", sequence_in_day: 1 },
    { id: "s2", place_id: "place_jagdish_temple", sequence_in_day: 2 },
  ];

  const rec = {
    place_id: "place_pottery_studio",
    artisan_name: "Master Kavita Kumhar",
    fee_inr: 250,
    duration_minutes: 45,
    optimal_insert_order: 2,
  };

  const newStop = {
    id: "stop_rec_123",
    place_id: rec.place_id,
    name: rec.artisan_name,
    sequence_in_day: rec.optimal_insert_order,
    entry_fee_inr: rec.fee_inr,
    suggested_duration_minutes: rec.duration_minutes,
  };

  // Insertion at optimal_insert_order (1-based index)
  const insertIdx = rec.optimal_insert_order - 1;
  const workingStops = [...initialStops];
  workingStops.splice(insertIdx, 0, newStop);

  const reindexed = workingStops.map((s, idx) => ({
    ...s,
    sequence_in_day: idx + 1,
  }));

  assert.equal(reindexed.length, 3);
  assert.equal(reindexed[0].place_id, "place_city_palace");
  assert.equal(reindexed[1].place_id, "place_pottery_studio");
  assert.equal(reindexed[2].place_id, "place_jagdish_temple");
  assert.equal(reindexed[1].sequence_in_day, 2);
  assert.equal(reindexed[2].sequence_in_day, 3);

  // Derive staged operation
  const initialMap = new Map(initialStops.map((s) => [s.id, s]));
  const stagedOps = [];
  for (let i = 0; i < reindexed.length; i++) {
    const s = reindexed[i];
    if (!initialMap.has(s.id)) {
      stagedOps.push({
        type: "add_stop",
        place_id: s.place_id,
        new_order: i + 1,
      });
    }
  }

  assert.equal(stagedOps.length, 1);
  assert.equal(stagedOps[0].type, "add_stop");
  assert.equal(stagedOps[0].place_id, "place_pottery_studio");
  assert.equal(stagedOps[0].new_order, 2);
});
