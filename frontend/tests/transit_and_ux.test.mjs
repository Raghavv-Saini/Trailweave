import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  calculateTransitMinutes,
  calculateMultiStopTransit,
  recalculateTimelineSchedule,
  formatMinutesToDuration,
} from "../lib/transit.ts";

test("Homepage pillar cards must not expose raw developer endpoint paths", () => {
  const homeSource = fs.readFileSync(path.resolve("app/page.tsx"), "utf-8");

  assert.ok(
    !homeSource.includes("(/trails)"),
    "Homepage cards must not contain raw '(/trails)' string"
  );
  assert.ok(
    !homeSource.includes("(/artisans)"),
    "Homepage cards must not contain raw '(/artisans)' string"
  );
  assert.ok(
    !homeSource.includes("(/trip)"),
    "Homepage cards must not contain raw '(/trip)' string"
  );

  // Check refined copy
  assert.ok(
    homeSource.includes("Explore Community Trails"),
    "Homepage must render 'Explore Community Trails'"
  );
  assert.ok(
    homeSource.includes("Explore Artisan Directory"),
    "Homepage must render 'Explore Artisan Directory'"
  );
  assert.ok(
    homeSource.includes("Go to Active Trip"),
    "Homepage must render 'Go to Active Trip'"
  );
});

test("Community Trail cards must not display raw hashtag '#' prefixes", () => {
  const cardSource = fs.readFileSync(
    path.resolve("components/discovery/TrailCard.tsx"),
    "utf-8"
  );

  assert.ok(
    !cardSource.includes("#{tag}"),
    "TrailCard must not render raw #{tag} hashtags"
  );
  assert.ok(
    cardSource.includes("getTagStyle"),
    "TrailCard must use semantic getTagStyle for cultural pills"
  );
});

test("TimelineList must not contain decorative emojis and must render vector icons", () => {
  const timelineSource = fs.readFileSync(
    path.resolve("components/trip/TimelineList.tsx"),
    "utf-8"
  );

  assert.ok(
    !timelineSource.includes("🚗"),
    "TimelineList must not contain car emoji (🚗)"
  );
  assert.ok(
    !timelineSource.includes("🚶"),
    "TimelineList must not contain walking emoji (🚶)"
  );
  assert.ok(
    !timelineSource.includes("🛺"),
    "TimelineList must not contain rickshaw emoji (🛺)"
  );

  assert.ok(
    timelineSource.includes("Footprints") && timelineSource.includes("Car"),
    "TimelineList must import and use clean Lucide vector icons"
  );
  assert.ok(
    timelineSource.includes("transitMinutes"),
    "TimelineList must render transit segment minutes"
  );
});

test("Artisans onboarding must not contain deprecated Google STT tag", () => {
  const onboardSource = fs.readFileSync(
    path.resolve("app/artisans/onboard/page.tsx"),
    "utf-8"
  );

  assert.ok(
    !onboardSource.includes("Google STT (hi-IN)"),
    "Artisans onboarding must remove deprecated 'Google STT (hi-IN)' badge"
  );
});

test("Transit engine calculates realistic Udaipur durations across transport modes", () => {
  // Coordinates: City Palace (24.5764, 73.6835) to Saheliyon Ki Bari (24.6033, 73.6875)
  // Distance ~3.0 km
  const walkMins = calculateTransitMinutes(24.5764, 73.6835, 24.6033, 73.6875, "walking");
  const autoMins = calculateTransitMinutes(24.5764, 73.6835, 24.6033, 73.6875, "auto_rickshaw");
  const cabMins = calculateTransitMinutes(24.5764, 73.6835, 24.6033, 73.6875, "cab");

  assert.ok(walkMins > autoMins, `Walking (${walkMins}m) must be slower than auto (${autoMins}m)`);
  assert.ok(cabMins >= 7, `Cab must satisfy minimum buffer`);
  assert.ok(walkMins >= 30, `Walking 3km in Old City should take >= 30 mins`);

  assert.equal(formatMinutesToDuration(90), "1h 30m");
  assert.equal(formatMinutesToDuration(45), "45m");
  assert.equal(formatMinutesToDuration(120), "2h");

  const multiStop = calculateMultiStopTransit(
    [
      { latitude: 24.5764, longitude: 73.6835, suggested_duration_minutes: 60 },
      { latitude: 24.5796, longitude: 73.6844, suggested_duration_minutes: 45 },
      { latitude: 24.5815, longitude: 73.682, suggested_duration_minutes: 30 },
    ],
    "auto_rickshaw"
  );

  assert.equal(multiStop.totalVisitMinutes, 135);
  assert.ok(multiStop.totalTransitMinutes > 0);
  assert.equal(
    multiStop.totalTripMinutes,
    multiStop.totalVisitMinutes + multiStop.totalTransitMinutes
  );
});

test("recalculateTimelineSchedule dynamically shifts pending arrivals based on mode", () => {
  const dummyStops = [
    {
      id: "s1",
      latitude: 24.5764,
      longitude: 73.6835,
      suggested_duration_minutes: 60,
      visit_status: "visited",
      planned_arrival: "2026-11-01T09:30:00.000Z",
      planned_departure: "2026-11-01T10:30:00.000Z",
    },
    {
      id: "s2",
      latitude: 24.6033,
      longitude: 73.6875,
      suggested_duration_minutes: 45,
      visit_status: "pending",
    },
  ];

  const autoSchedule = recalculateTimelineSchedule(dummyStops, "auto_rickshaw");
  const walkSchedule = recalculateTimelineSchedule(dummyStops, "walking");

  const autoArrival = new Date(autoSchedule[1].planned_arrival).getTime();
  const walkArrival = new Date(walkSchedule[1].planned_arrival).getTime();

  assert.ok(
    walkArrival > autoArrival,
    "Walking to distant stop must result in later arrival than auto rickshaw"
  );
  assert.ok(walkSchedule[1].transit_minutes_from_prev > autoSchedule[1].transit_minutes_from_prev);
});
