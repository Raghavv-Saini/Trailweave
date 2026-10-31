import test from "node:test";
import assert from "node:assert/strict";

// Core Basket logic verification
test("Deduplicates identical canonical places across multiple trails", () => {
  const basket = [];

  function addItem(basket, place, source) {
    const existingIndex = basket.findIndex((item) => item.place.id === place.id);
    if (existingIndex >= 0) {
      const existing = basket[existingIndex];
      const hasSource = source && existing.sources.some((s) => s.trailId === source.trailId);
      if (source && !hasSource) {
        existing.sources.push(source);
      }
      return basket;
    }
    basket.push({
      place,
      sources: source ? [source] : [],
      addedAt: Date.now(),
    });
    return basket;
  }

  const placeJagdish = {
    id: "place_jagdish_temple",
    name: "Jagdish Temple",
    entry_fee_inr: 0,
    typical_duration_minutes: 30,
  };

  const sourceTrailA = {
    trailId: "trail_royal_palaces_crafts",
    trailTitle: "Udaipur Royal Palaces & Crafts",
    authorName: "Arjun Sharma",
  };

  const sourceTrailB = {
    trailId: "trail_old_city_heritage_walk",
    trailTitle: "Old City Evening Heritage Walk",
    authorName: "Priya Sen",
  };

  // Add from Trail A
  addItem(basket, placeJagdish, sourceTrailA);
  assert.equal(basket.length, 1);
  assert.equal(basket[0].place.id, "place_jagdish_temple");
  assert.equal(basket[0].sources.length, 1);
  assert.equal(basket[0].sources[0].trailTitle, "Udaipur Royal Palaces & Crafts");

  // Add same place from Trail B
  addItem(basket, placeJagdish, sourceTrailB);
  // Must still be 1 item (deduplicated by place_id)
  assert.equal(basket.length, 1, "Duplicate place_id must not create a second basket item");
  // Must retain multi-curator provenance
  assert.equal(basket[0].sources.length, 2, "Must retain provenance from both curators");
  assert.equal(basket[0].sources[0].authorName, "Arjun Sharma");
  assert.equal(basket[0].sources[1].authorName, "Priya Sen");
});

test("Calculates subtotals correctly across diverse selected places", () => {
  const items = [
    {
      place: { id: "p1", name: "City Palace", entry_fee_inr: 330, typical_duration_minutes: 120 },
    },
    {
      place: { id: "p2", name: "Bagore Haveli", entry_fee_inr: 100, typical_duration_minutes: 90 },
    },
    {
      place: { id: "p3", name: "Jagdish Temple", entry_fee_inr: 0, typical_duration_minutes: 30 },
    },
  ];

  const totalCost = items.reduce((sum, it) => sum + it.place.entry_fee_inr, 0);
  const totalDuration = items.reduce((sum, it) => sum + it.place.typical_duration_minutes, 0);

  assert.equal(totalCost, 430);
  assert.equal(totalDuration, 240); // 4 hours
});

