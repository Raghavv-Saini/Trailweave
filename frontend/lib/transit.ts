/**
 * Deterministic Transit & Multi-Modal Routing Engine for Udaipur
 * Spec: ADR 0003, ADR 0007
 * Calculates realistic road travel durations and chronologically schedules itinerary stops.
 */

export type TravelMode = "walking" | "auto_rickshaw" | "cab";

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface TransitLeg {
  fromIndex: number;
  toIndex: number;
  distanceMeters: number;
  transitMinutes: number;
  travelMode: TravelMode;
}

export interface TransitSummary {
  legs: TransitLeg[];
  totalTransitMinutes: number;
  totalVisitMinutes: number;
  totalTripMinutes: number;
}

/** Compute great-circle distance in meters between two WGS84 coordinates */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const r = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(r * c);
}

/**
 * Calculates transit minutes between two coordinates tailored to Udaipur road network.
 * Speed and winding road factor reflect Old City pedestrian zones and winding streets.
 */
export function calculateTransitMinutes(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  mode: TravelMode = "auto_rickshaw"
): number {
  const distMeters = haversineDistanceMeters(lat1, lon1, lat2, lon2);
  if (distMeters < 30) {
    return 2;
  }

  // Winding road expansion factor and average urban speeds (km/h) for Udaipur
  const { speedKmh, roadFactor, minMinutes } = getModeParameters(mode);
  const roadDistKm = (distMeters * roadFactor) / 1000;
  const rawMinutes = Math.ceil((roadDistKm / speedKmh) * 60);

  return Math.max(minMinutes, rawMinutes);
}

function getModeParameters(mode: TravelMode): {
  speedKmh: number;
  roadFactor: number;
  minMinutes: number;
} {
  switch (mode) {
    case "walking":
      return { speedKmh: 4.5, roadFactor: 1.25, minMinutes: 3 };
    case "auto_rickshaw":
      return { speedKmh: 18.0, roadFactor: 1.35, minMinutes: 5 };
    case "cab":
      return { speedKmh: 22.0, roadFactor: 1.3, minMinutes: 7 };
    default:
      return { speedKmh: 18.0, roadFactor: 1.35, minMinutes: 5 };
  }
}

export function getTravelModeLabel(mode: TravelMode): string {
  switch (mode) {
    case "walking":
      return "Walking";
    case "auto_rickshaw":
      return "Auto Rickshaw";
    case "cab":
      return "Cab / Taxi";
  }
}

/** Format minutes into human-readable duration without slop */
export function formatMinutesToDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0m";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/** Calculate transit and visit totals across a sequence of stops */
export function calculateMultiStopTransit(
  stops: Array<{
    latitude: number;
    longitude: number;
    suggested_duration_minutes?: number;
    typical_duration_minutes?: number;
  }>,
  mode: TravelMode = "auto_rickshaw"
): TransitSummary {
  const legs: TransitLeg[] = [];
  let totalTransitMinutes = 0;
  let totalVisitMinutes = 0;

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    const visitDur =
      stop.suggested_duration_minutes || stop.typical_duration_minutes || 45;
    totalVisitMinutes += visitDur;

    if (i > 0) {
      const prev = stops[i - 1];
      const dist = haversineDistanceMeters(
        prev.latitude,
        prev.longitude,
        stop.latitude,
        stop.longitude
      );
      const legMins = calculateTransitMinutes(
        prev.latitude,
        prev.longitude,
        stop.latitude,
        stop.longitude,
        mode
      );
      legs.push({
        fromIndex: i - 1,
        toIndex: i,
        distanceMeters: dist,
        transitMinutes: legMins,
        travelMode: mode,
      });
      totalTransitMinutes += legMins;
    }
  }

  return {
    legs,
    totalTransitMinutes,
    totalVisitMinutes,
    totalTripMinutes: totalVisitMinutes + totalTransitMinutes,
  };
}

/**
 * Deterministically schedules stop arrival and departure timestamps.
 * Preserves timestamps for already-visited stops, and rolls forward pending stops
 * from either the last visited departure or the specified base start datetime.
 */
export function recalculateTimelineSchedule<
  T extends {
    id: string;
    latitude: number;
    longitude: number;
    suggested_duration_minutes: number;
    planned_arrival?: string;
    planned_departure?: string;
    transit_minutes_from_prev?: number;
    visit_status: "pending" | "visited" | "skipped";
    day_number?: number;
  }
>(
  stops: T[],
  mode: TravelMode = "auto_rickshaw",
  defaultStartIso: string = "2026-11-01T09:30:00+05:30"
): T[] {
  if (stops.length === 0) return [];

  // Group by day_number
  const days = Array.from(new Set(stops.map((s) => s.day_number || 1))).sort(
    (a, b) => a - b
  );

  const updatedStops: T[] = [];

  for (const day of days) {
    const dayStops = stops.filter((s) => (s.day_number || 1) === day);

    // Compute base start for this day
    const baseDate = new Date(defaultStartIso);
    baseDate.setDate(baseDate.getDate() + (day - 1));

    let prevLat = 24.5794; // Default to Udaipur City Center
    let prevLon = 73.6841;
    let cursorTime = new Date(baseDate.getTime());

    for (let i = 0; i < dayStops.length; i++) {
      const stop = dayStops[i];

      if (stop.visit_status === "visited" && stop.planned_departure) {
        // Preserved visited departure
        const dep = new Date(stop.planned_departure);
        if (!isNaN(dep.getTime())) {
          cursorTime = dep;
        }
        prevLat = stop.latitude;
        prevLon = stop.longitude;
        updatedStops.push({ ...stop });
        continue;
      }

      if (stop.visit_status === "skipped") {
        updatedStops.push({
          ...stop,
          transit_minutes_from_prev: 0,
        });
        continue;
      }

      // Calculate transit from previous coordinate
      const transitMinutes = calculateTransitMinutes(
        prevLat,
        prevLon,
        stop.latitude,
        stop.longitude,
        mode
      );

      const arrivalTime = new Date(
        cursorTime.getTime() + transitMinutes * 60 * 1000
      );
      const visitDur = stop.suggested_duration_minutes || 45;
      const departureTime = new Date(
        arrivalTime.getTime() + visitDur * 60 * 1000
      );

      cursorTime = departureTime;
      prevLat = stop.latitude;
      prevLon = stop.longitude;

      updatedStops.push({
        ...stop,
        transit_minutes_from_prev: transitMinutes,
        planned_arrival: arrivalTime.toISOString(),
        planned_departure: departureTime.toISOString(),
      });
    }
  }

  return updatedStops;
}
