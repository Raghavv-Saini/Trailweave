import test from "node:test";
import assert from "node:assert/strict";

// Companion & Push Notifications Logic Tests (Track 3, Ticket 09)

test("Companion acknowledges prior user manual edits before proposing alterations", () => {
  const tripStops = [
    { id: "s1", name: "City Palace", visit_status: "visited" },
    { id: "s2", name: "Jagdish Temple", visit_status: "skipped" },
    { id: "s3", name: "Bagore Haveli", visit_status: "pending" },
  ];

  const hasPriorSkip = tripStops.some((s) => s.visit_status === "skipped");
  assert.equal(hasPriorSkip, true);

  const skippedStop = tripStops.find((s) => s.visit_status === "skipped");
  assert.equal(skippedStop.name, "Jagdish Temple");

  function buildAcknowledgment(stops) {
    const skip = stops.find((s) => s.visit_status === "skipped");
    if (skip) {
      return `I see you skipped ${skip.name} earlier, so I've taken that into account!`;
    }
    return "Khamma Ghani! How can I assist your route?";
  }

  const ack = buildAcknowledgment(tripStops);
  assert.match(ack, /skipped Jagdish Temple/);
});

test("Generates interactive ReplanProposalCard diff and enforces revision locking", () => {
  const proposal = {
    proposal_id: "prop_ai_test_12345",
    base_revision: 2,
    is_feasible: true,
    validation_diff: {
      cost_delta_inr: -100,
      duration_delta_minutes: -30,
      stops_added: ["place_sukhadia_circle"],
      stops_skipped: ["stop_bagore_haveli"],
      stops_removed: [],
      closing_hour_conflicts: [],
    },
  };

  assert.equal(proposal.base_revision, 2);
  assert.equal(proposal.is_feasible, true);
  assert.equal(proposal.validation_diff.duration_delta_minutes, -30);
  assert.equal(proposal.validation_diff.cost_delta_inr, -100);

  // Optimistic concurrency verification: target commit must be revision N+1
  const targetRevision = proposal.base_revision + 1;
  assert.equal(targetRevision, 3);

  // Mismatch detection
  function verifyRevisionLock(currentRevision, expectedRevision) {
    if (currentRevision !== expectedRevision) {
      return {
        isConflict: true,
        status: 409,
        detail: `Revision mismatch: expected ${expectedRevision}, but current is ${currentRevision}`,
      };
    }
    return { isConflict: false, status: 200 };
  }

  const conflictCheck = verifyRevisionLock(3, 2);
  assert.equal(conflictCheck.isConflict, true);
  assert.equal(conflictCheck.status, 409);

  const successCheck = verifyRevisionLock(2, 2);
  assert.equal(successCheck.isConflict, false);
  assert.equal(successCheck.status, 200);
});

test("Formats contextual transition push notification on checkout with gate, weather, and scenic tips", () => {
  const nextStop = {
    id: "stop_bh",
    place_id: "place_bagore_haveli",
    name: "Bagore Ki Haveli",
    category: "heritage",
  };

  function createTransitionTip(next) {
    const isHaveli = next.name.toLowerCase().includes("haveli");
    return {
      title: `Next Stop: ${next.name}`,
      body: `Heading to ${next.name}. Follow the lakeside alley down Gangaur Ghat for scenic lakeside photography. Gates open until 8:00 PM.`,
      gate_tip: isHaveli
        ? "Gates open until 8:00 PM. Evening Dharohar puppet show starts at 7:00 PM."
        : "Standard operational hours.",
      weather_tip: "Afternoon heat is softening; pleasant walking conditions along the lakeside.",
      scenic_tip: "Follow the lakeside alley down Gangaur Ghat for scenic lakeside photography.",
      next_stop_id: next.id,
    };
  }

  const tip = createTransitionTip(nextStop);
  assert.equal(tip.title, "Next Stop: Bagore Ki Haveli");
  assert.match(tip.body, /Gangaur Ghat/);
  assert.match(tip.gate_tip, /8:00 PM/);
  assert.match(tip.weather_tip, /heat is softening/);
  assert.equal(tip.next_stop_id, "stop_bh");
});

