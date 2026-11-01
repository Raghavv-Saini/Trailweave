"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { dispatchTransitionNotification } from "@/lib/pushNotifications";
import {
  TravelMode,
  recalculateTimelineSchedule,
  calculateTransitMinutes,
} from "@/lib/transit";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type CheckinMethod = "manual_fallback" | "geofence_proximity";
export type CheckoutMethod = "manual_tap" | "grace_buffer_timeout";

export interface TripStop {
  id: string;
  place_id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category: string;
  entry_fee_inr: number;
  image_url: string;
  day_number: number;
  sequence_in_day: number;
  planned_arrival?: string;
  planned_departure?: string;
  suggested_duration_minutes: number;
  transit_minutes_from_prev?: number;
  actual_duration_minutes?: number | null;
  visit_status: "pending" | "visited" | "skipped";
  is_pinned: boolean;
  checkin_method?: CheckinMethod;
  arrival_timestamp?: string;
  checkout_method?: CheckoutMethod;
  departure_timestamp?: string;
  is_checked_out?: boolean;
}

export interface TripAuditEvent {
  id: string;
  stopId: string;
  stopName: string;
  action: "visit" | "checkout" | "replan_committed";
  method?: string;
  endpoint: string;
  timestamp: string;
}

export interface ReplanOperation {
  type:
    | "add_stop"
    | "remove_stop"
    | "skip_stop"
    | "reorder_stops"
    | "pin_stop"
    | "update_travel_mode"
    | "update_stop_duration"
    | "reschedule_stop"
    | "update_budget";
  place_id?: string;
  stop_id?: string;
  new_order?: number;
  is_pinned?: boolean;
  travel_mode?: "walking" | "auto_rickshaw" | "cab";
  duration_minutes?: number;
  planned_arrival_time?: string;
  budget_inr?: number;
  custom_place_name?: string;
  custom_category?: string;
  custom_address?: string;
  custom_latitude?: number;
  custom_longitude?: number;
  custom_entry_fee_inr?: number;
}

export interface ValidationDiff {
  cost_delta_inr: number;
  duration_delta_minutes: number;
  stops_added: string[];
  stops_skipped: string[];
  stops_removed: string[];
  closing_hour_conflicts: string[];
  travel_mode_changed?: string[];
  durations_updated?: string[];
  rescheduled_stops?: string[];
  budget_updated_inr?: number | null;
}

export interface ReplanProposal {
  proposal_id: string;
  base_revision: number;
  is_feasible: boolean;
  validation_diff: ValidationDiff;
  candidate_stops: Array<Record<string, unknown>>;
  expires_at: string;
  committed?: boolean;
  new_revision?: number;
}

export interface ReplanAcceptResult {
  success: boolean;
  new_revision?: number;
  message?: string;
  isConflict?: boolean;
  conflictRevision?: number;
  error?: string;
}

export interface CompanionResponse {
  response_narrative: string;
  replan_proposal?: ReplanProposal | null;
  acknowledged_events?: string[];
  trip_updated?: boolean;
  new_revision?: number | null;
}

export interface TripBuilderInput {
  title?: string;
  days: number;
  budgetInr?: number;
  travelMode?: "walking" | "auto_rickshaw" | "cab";
  places: Array<{
    id: string;
    name: string;
    category?: string;
    latitude?: number;
    longitude?: number;
    address?: string;
    entry_fee_inr?: number;
    typical_duration_minutes?: number;
  }>;
}

interface TripContextType {
  tripId: string;
  tripTitle: string;
  revision: number;
  travelMode: TravelMode;
  setTravelMode: (mode: TravelMode) => void;
  stops: TripStop[];
  auditEvents: TripAuditEvent[];
  createTripFromBuilder: (input: TripBuilderInput) => Promise<void>;
  markVisited: (stopId: string, method?: CheckinMethod) => Promise<void>;
  markCheckout: (
    stopId: string,
    method?: CheckoutMethod,
    customDepartureIso?: string
  ) => Promise<void>;
  markSkipped: (stopId: string) => Promise<void>;
  refreshTrip: () => Promise<void>;
  resetDemoTrip: () => void;
  requestReplanPreview: (operations: ReplanOperation[]) => Promise<ReplanProposal>;
  commitReplan: (
    proposalId: string,
    expectedRevision: number,
    finalStops: TripStop[]
  ) => Promise<ReplanAcceptResult>;
  simulateRemoteRevisionIncrement: () => void;
  sendCompanionMessage: (
    message: string,
    history?: Array<{ role: string; text: string }>
  ) => Promise<CompanionResponse>;
}

const PLACE_DEFAULTS: Record<
  string,
  Pick<
    TripStop,
    "address" | "latitude" | "longitude" | "category" | "entry_fee_inr" | "image_url"
  >
> = {
  place_city_palace: {
    address: "Old City, Udaipur, Rajasthan 313001",
    latitude: 24.5764,
    longitude: 73.6835,
    category: "heritage",
    entry_fee_inr: 330,
    image_url:
      "https://images.unsplash.com/photo-1615836245337-f5b9b2303f10?auto=format&fit=crop&w=900&q=80",
  },
  place_mohanlal_studio: {
    address: "14 Jagdish Chowk, Old City, Udaipur, Rajasthan 313001",
    latitude: 24.5796,
    longitude: 73.6844,
    category: "artisan_studio",
    entry_fee_inr: 0,
    image_url:
      "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=900&q=80",
  },
  place_pottery_studio: {
    address: "22 Chandpole Ghat Road, Old City, Udaipur, Rajasthan 313001",
    latitude: 24.5815,
    longitude: 73.6820,
    category: "artisan_studio",
    entry_fee_inr: 0,
    image_url:
      "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=900&q=80",
  },
  place_puppetry_workshop: {
    address: "Gangaur Ghat Road, Old City, Udaipur, Rajasthan 313001",
    latitude: 24.5788,
    longitude: 73.6815,
    category: "artisan_studio",
    entry_fee_inr: 0,
    image_url:
      "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=900&q=80",
  },
  place_leather_craft: {
    address: "Hathi Pole Bazaar, Udaipur, Rajasthan 313001",
    latitude: 24.5840,
    longitude: 73.6865,
    category: "artisan_studio",
    entry_fee_inr: 0,
    image_url:
      "https://images.pexels.com/photos/4427645/pexels-photo-4427645.jpeg?auto=compress&cs=tinysrgb&w=900",
  },
  place_jagdish_temple: {
    address: "1 Jagdish Chowk, Old City, Udaipur, Rajasthan 313001",
    latitude: 24.5794,
    longitude: 73.6841,
    category: "heritage",
    entry_fee_inr: 0,
    image_url:
      "https://images.pexels.com/photos/15534239/pexels-photo-15534239.jpeg?auto=compress&cs=tinysrgb&w=900",
  },
  place_bagore_haveli: {
    address: "Gangaur Ghat Marg, Old City, Udaipur, Rajasthan 313001",
    latitude: 24.5798,
    longitude: 73.68,
    category: "heritage",
    entry_fee_inr: 100,
    image_url:
      "https://images.unsplash.com/photo-1722080711528-095791cd14d4?auto=format&fit=crop&w=900&q=80",
  },
  place_saheliyon_bari: {
    address: "Saheli Marg, New Vidhya Nagar, Udaipur, Rajasthan 313001",
    latitude: 24.6019,
    longitude: 73.6853,
    category: "attraction",
    entry_fee_inr: 50,
    image_url:
      "https://images.unsplash.com/photo-1651306614297-9c1301ad460e?auto=format&fit=crop&w=900&q=80",
  },
  place_sukhadia_circle: {
    address: "Sukhadia Circle, Panchwati, Udaipur, Rajasthan 313001",
    latitude: 24.6035,
    longitude: 73.6885,
    category: "dining",
    entry_fee_inr: 0,
    image_url:
      "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=80",
  },
};

const INITIAL_DEMO_STOPS: TripStop[] = [
  {
    id: "stop_cp",
    place_id: "place_city_palace",
    name: "City Palace Udaipur",
    ...PLACE_DEFAULTS.place_city_palace,
    day_number: 1,
    sequence_in_day: 1,
    planned_arrival: "2026-10-31T09:30:00+05:30",
    planned_departure: "2026-10-31T11:30:00+05:30",
    suggested_duration_minutes: 120,
    transit_minutes_from_prev: 10,
    actual_duration_minutes: 120,
    visit_status: "visited",
    is_pinned: false,
    checkin_method: "geofence_proximity",
    arrival_timestamp: "2026-10-31T09:32:00+05:30",
    checkout_method: "manual_tap",
    departure_timestamp: "2026-10-31T11:30:00+05:30",
    is_checked_out: true,
  },
  {
    id: "stop_ms",
    place_id: "place_mohanlal_studio",
    name: "Master Mohanlal Miniature Art Studio",
    ...PLACE_DEFAULTS.place_mohanlal_studio,
    day_number: 1,
    sequence_in_day: 2,
    planned_arrival: "2026-10-31T11:45:00+05:30",
    planned_departure: "2026-10-31T12:30:00+05:30",
    suggested_duration_minutes: 45,
    transit_minutes_from_prev: 15,
    actual_duration_minutes: null,
    visit_status: "pending",
    is_pinned: true,
  },
  {
    id: "stop_jt",
    place_id: "place_jagdish_temple",
    name: "Jagdish Temple",
    ...PLACE_DEFAULTS.place_jagdish_temple,
    day_number: 1,
    sequence_in_day: 3,
    planned_arrival: "2026-10-31T12:40:00+05:30",
    planned_departure: "2026-10-31T13:10:00+05:30",
    suggested_duration_minutes: 30,
    transit_minutes_from_prev: 10,
    actual_duration_minutes: null,
    visit_status: "pending",
    is_pinned: false,
  },
  {
    id: "stop_bh",
    place_id: "place_bagore_haveli",
    name: "Bagore Ki Haveli",
    ...PLACE_DEFAULTS.place_bagore_haveli,
    day_number: 1,
    sequence_in_day: 4,
    planned_arrival: "2026-10-31T13:15:00+05:30",
    planned_departure: "2026-10-31T14:45:00+05:30",
    suggested_duration_minutes: 90,
    transit_minutes_from_prev: 5,
    actual_duration_minutes: null,
    visit_status: "pending",
    is_pinned: false,
  },
  {
    id: "stop_sb",
    place_id: "place_saheliyon_bari",
    name: "Saheliyon Ki Bari",
    ...PLACE_DEFAULTS.place_saheliyon_bari,
    day_number: 1,
    sequence_in_day: 5,
    planned_arrival: "2026-10-31T15:15:00+05:30",
    planned_departure: "2026-10-31T16:15:00+05:30",
    suggested_duration_minutes: 60,
    transit_minutes_from_prev: 30,
    actual_duration_minutes: null,
    visit_status: "pending",
    is_pinned: false,
  },
  {
    id: "stop_sc",
    place_id: "place_sukhadia_circle",
    name: "Sukhadia Circle Street Food",
    ...PLACE_DEFAULTS.place_sukhadia_circle,
    day_number: 1,
    sequence_in_day: 6,
    planned_arrival: "2026-10-31T17:00:00+05:30",
    planned_departure: "2026-10-31T18:00:00+05:30",
    suggested_duration_minutes: 60,
    transit_minutes_from_prev: 15,
    actual_duration_minutes: null,
    visit_status: "pending",
    is_pinned: false,
  },
];

const TripContext = createContext<TripContextType | undefined>(undefined);

export function TripProvider({ children }: { children: React.ReactNode }) {
  const [tripId, setTripId] = useState<string>("trip_demo_udaipur");
  const [tripTitle, setTripTitle] = useState<string>("Udaipur Living Heritage & Crafts Walk");
  const [revision, setRevision] = useState<number>(1);
  const [travelMode, setTravelModeState] = useState<TravelMode>("auto_rickshaw");
  const [stops, setStops] = useState<TripStop[]>(INITIAL_DEMO_STOPS);
  const [auditEvents, setAuditEvents] = useState<TripAuditEvent[]>([]);

  // Hydrate saved user-generated trip if present
  useEffect(() => {
    try {
      // Clear legacy cached keys so stale image URLs never persist across deployments
      localStorage.removeItem("trailweave_active_trip_v1");
      localStorage.removeItem("trailweave_active_trip_v2");

      const saved = localStorage.getItem("trailweave_active_trip_v3");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.tripId && Array.isArray(parsed?.stops) && parsed.stops.length > 0) {
          setTripId(parsed.tripId);
          setTripTitle(parsed.tripTitle || "My Udaipur Itinerary");
          setRevision(parsed.revision || 1);
          if (parsed.travelMode) {
            setTravelModeState(parsed.travelMode);
          }
          const syncedStops = parsed.stops.map((s: TripStop) => {
            const def = PLACE_DEFAULTS[s.place_id];
            return def ? { ...s, image_url: def.image_url } : s;
          });
          setStops(syncedStops);
          return;
        }
      }
    } catch {}
  }, []);

  const setTravelMode = useCallback(
    (mode: TravelMode) => {
      setTravelModeState(mode);
      setStops((prev) => {
        const updated = recalculateTimelineSchedule(prev, mode);
        try {
          localStorage.setItem(
            "trailweave_active_trip_v2",
            JSON.stringify({
              tripId,
              tripTitle,
              revision,
              travelMode: mode,
              stops: updated,
            })
          );
        } catch {}
        return updated;
      });
    },
    [tripId, tripTitle, revision]
  );

  const createTripFromBuilder = useCallback(
    async (input: TripBuilderInput) => {
      const totalDays = Math.max(1, input.days || 1);
      const customTitle =
        input.title?.trim() ||
        (totalDays === 1
          ? "Udaipur Single-Day Cultural Journey"
          : `Udaipur ${totalDays}-Day Heritage & Crafts Itinerary`);

      const chosenMode: TravelMode = input.travelMode || travelMode || "auto_rickshaw";
      setTravelModeState(chosenMode);

      const candidatePlaces =
        input.places && input.places.length > 0
          ? input.places
          : [
              { id: "place_city_palace", name: "City Palace Udaipur", typical_duration_minutes: 120 },
              { id: "place_jagdish_temple", name: "Jagdish Temple", typical_duration_minutes: 45 },
              { id: "place_mohanlal_studio", name: "Master Mohanlal Miniature Art Studio", typical_duration_minutes: 45 },
              { id: "place_bagore_haveli", name: "Bagore Ki Haveli", typical_duration_minutes: 90 },
              { id: "place_saheliyon_bari", name: "Saheliyon Ki Bari", typical_duration_minutes: 60 },
              { id: "place_sukhadia_circle", name: "Sukhadia Circle Street Food", typical_duration_minutes: 60 },
            ];

      // Build deterministic multi-day schedule using realistic transit calculation
      const baseStops: TripStop[] = candidatePlaces.map((p, idx) => {
        const dayNum = (idx % totalDays) + 1;
        const seqInDay = Math.floor(idx / totalDays) + 1;
        const defaults = PLACE_DEFAULTS[p.id] || PLACE_DEFAULTS.place_city_palace;
        const durationMins = p.typical_duration_minutes || 60;

        return {
          id: `stop_${p.id}_${idx + 1}`,
          place_id: p.id,
          name: p.name,
          address: p.address || defaults.address,
          latitude: p.latitude ?? defaults.latitude,
          longitude: p.longitude ?? defaults.longitude,
          category: p.category || defaults.category,
          entry_fee_inr: p.entry_fee_inr ?? defaults.entry_fee_inr,
          image_url: defaults.image_url,
          day_number: dayNum,
          sequence_in_day: seqInDay,
          suggested_duration_minutes: durationMins,
          actual_duration_minutes: null,
          visit_status: "pending",
          is_pinned: false,
        };
      });

      const generatedStops = recalculateTimelineSchedule(
        baseStops,
        chosenMode,
        "2026-11-01T09:30:00+05:30"
      );

        let finalTripId = `trip_custom_${Date.now().toString(36)}`;
        let finalRevision = 1;
        let finalStops = generatedStops;

        try {
          const res = await fetch(`${API_BASE_URL}/api/trips`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: "tourist_demo_user",
              title: customTitle,
              start_datetime: "2026-11-01T09:30:00+05:30",
              total_days: totalDays,
              budget_inr: input.budgetInr || 2500,
              budget_mode: "total",
              travel_mode: chosenMode,
              artisan_preference: "both",
              start_location: {
                name: "Udaipur Old City Center",
                latitude: 24.5794,
                longitude: 73.6841,
              },
              place_ids: candidatePlaces.map((p) => p.id),
              optimize_route: true,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.id) finalTripId = data.id;
            if (data.revision) finalRevision = data.revision;
            if (data.active_version?.stops?.length) {
              finalStops = data.active_version.stops.map((s: Record<string, unknown>, idx: number) => {
                const placeId = String(s.place_id || "");
                const defaults = PLACE_DEFAULTS[placeId] || {};
                return {
                  id: String(s.id || `stop_${placeId}_${idx + 1}`),
                  place_id: placeId,
                  name: String(s.name || placeId),
                  address: String(s.address || defaults.address || "Udaipur, Rajasthan"),
                  latitude: Number(s.latitude || defaults.latitude || 24.5854),
                  longitude: Number(s.longitude || defaults.longitude || 73.6812),
                  category: String(s.category || defaults.category || "heritage"),
                  entry_fee_inr: Number(s.entry_fee_inr ?? defaults.entry_fee_inr ?? 0),
                  image_url: String(defaults.image_url || s.image_url || ""),
                  day_number: Number(s.day_number || 1),
                  sequence_in_day: Number(s.sequence_in_day || idx + 1),
                  planned_arrival: typeof s.planned_arrival === "string" ? s.planned_arrival : undefined,
                  planned_departure: typeof s.planned_departure === "string" ? s.planned_departure : undefined,
                  suggested_duration_minutes: Number(s.suggested_duration_minutes || 45),
                  transit_minutes_from_prev: typeof s.transit_minutes_from_prev === "number" ? s.transit_minutes_from_prev : (idx === 0 ? 10 : 15),
                  actual_duration_minutes: null,
                  visit_status: "pending",
                  is_pinned: Boolean(s.is_pinned),
                };
              });
            }
          }
        } catch {}

        setTripId(finalTripId);
        setTripTitle(customTitle);
        setRevision(finalRevision);
        setStops(finalStops);
        setAuditEvents([]);

        try {
          localStorage.setItem(
            "trailweave_active_trip_v3",
            JSON.stringify({
              tripId: finalTripId,
              tripTitle: customTitle,
              revision: finalRevision,
              travelMode: chosenMode,
              stops: finalStops,
            })
          );
        } catch {}
    },
    [travelMode]
  );

  const refreshTrip = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/trips/${tripId}`);
      if (!res.ok) return;
      const data = await res.json();

      if (data.revision !== undefined) setRevision(data.revision);
      if (data.title) setTripTitle(data.title);

      if (data.active_version?.stops?.length) {
        setStops((prev) => {
          const prevMap = new Map(prev.map((s) => [s.id, s]));
          return data.active_version.stops.map((s: Record<string, unknown>) => {
            const stopId = String(s.id || "");
            const existing = prevMap.get(stopId);
            const placeId = String(s.place_id || "");
            const defaults = PLACE_DEFAULTS[placeId] || {};
            const visitStatus = (s.visit_status as TripStop["visit_status"]) || existing?.visit_status || "pending";
            const actualDuration =
              typeof s.actual_duration_minutes === "number"
                ? s.actual_duration_minutes
                : existing?.actual_duration_minutes ?? null;

            return {
              id: stopId,
              place_id: placeId,
              name: String(s.name || existing?.name || placeId),
              address: String(s.address || defaults.address || existing?.address || "Udaipur, Rajasthan"),
              latitude: Number(s.latitude || defaults.latitude || existing?.latitude || 24.5854),
              longitude: Number(s.longitude || defaults.longitude || existing?.longitude || 73.6812),
              category: String(s.category || defaults.category || existing?.category || "heritage"),
              entry_fee_inr: Number(s.entry_fee_inr ?? defaults.entry_fee_inr ?? 0),
              image_url: String(defaults.image_url || s.image_url || existing?.image_url || ""),
              day_number: Number(s.day_number || 1),
              sequence_in_day: Number(s.sequence_in_day || 1),
              planned_arrival:
                typeof s.planned_arrival === "string" ? s.planned_arrival : existing?.planned_arrival,
              planned_departure:
                typeof s.planned_departure === "string" ? s.planned_departure : existing?.planned_departure,
              suggested_duration_minutes: Number(s.suggested_duration_minutes || 45),
              transit_minutes_from_prev:
                typeof s.transit_minutes_from_prev === "number"
                  ? s.transit_minutes_from_prev
                  : existing?.transit_minutes_from_prev ?? 15,
              actual_duration_minutes: actualDuration,
              visit_status: visitStatus,
              is_pinned: Boolean(s.is_pinned),
              checkin_method: existing?.checkin_method,
              arrival_timestamp: existing?.arrival_timestamp,
              checkout_method: existing?.checkout_method,
              departure_timestamp: existing?.departure_timestamp,
              is_checked_out:
                existing?.is_checked_out !== undefined
                  ? existing.is_checked_out
                  : visitStatus === "visited" && actualDuration !== null,
            };
          });
        });
      }
    } catch {
      // Fallback to local state when backend is unreachable
    }
  }, [tripId]);

  useEffect(() => {
    refreshTrip();
  }, [refreshTrip]);

  const markVisited = async (stopId: string, method: CheckinMethod = "manual_fallback") => {
    const arrivalIso = new Date().toISOString();
    const targetStop = stops.find((s) => s.id === stopId);
    const endpoint = `/api/trips/${tripId}/stops/${stopId}/visit`;

    setStops((prev) =>
      prev.map((s) =>
        s.id === stopId
          ? {
              ...s,
              visit_status: "visited",
              checkin_method: method,
              arrival_timestamp: arrivalIso,
              is_checked_out: false,
            }
          : s
      )
    );

    setAuditEvents((prev) => [
      {
        id: `audit_${Date.now()}`,
        stopId,
        stopName: targetStop?.name || stopId,
        action: "visit",
        method,
        endpoint: `POST ${endpoint}`,
        timestamp: arrivalIso,
      },
      ...prev.slice(0, 9),
    ]);

    try {
      await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkin_method: method,
          arrival_timestamp: arrivalIso,
        }),
      });
    } catch {
      // Optimistic local state preserved when offline in old-city alleys
    }
  };

  const markCheckout = async (
    stopId: string,
    method: CheckoutMethod = "manual_tap",
    customDepartureIso?: string
  ) => {
    const departureIso = customDepartureIso || new Date().toISOString();
    const targetStop = stops.find((s) => s.id === stopId);
    const endpoint = `/api/trips/${tripId}/stops/${stopId}/checkout`;

    setStops((prev) =>
      prev.map((s) => {
        if (s.id !== stopId) return s;
        const actualDuration =
          method === "grace_buffer_timeout"
            ? s.suggested_duration_minutes + 20
            : s.suggested_duration_minutes;
        return {
          ...s,
          visit_status: "visited",
          is_checked_out: true,
          checkout_method: method,
          departure_timestamp: departureIso,
          actual_duration_minutes: actualDuration,
        };
      })
    );

    setAuditEvents((prev) => [
      {
        id: `audit_${Date.now()}`,
        stopId,
        stopName: targetStop?.name || stopId,
        action: "checkout",
        method,
        endpoint: `POST ${endpoint}`,
        timestamp: departureIso,
      },
      ...prev.slice(0, 9),
    ]);

    try {
      await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkout_method: method,
          departure_timestamp: departureIso,
        }),
      });
    } catch {
      // Optimistic local state preserved when offline
    }

    // Dispatch Web Push Transition Notification to lockscreen
    const remainingPending = stops.filter((s) => s.id !== stopId && s.visit_status === "pending");
    if (remainingPending.length > 0) {
      const nextVenue = remainingPending[0];
      dispatchTransitionNotification({
        title: `Next Stop: ${nextVenue.name}`,
        body: `Departed ${targetStop?.name || "stop"}. Heading to ${nextVenue.name}. Take the lakeside alley down Gangaur Ghat—an easy stroll!`,
        next_stop_id: nextVenue.id,
      });
    }
  };

  const markSkipped = async (stopId: string) => {
    setStops((prev) =>
      prev.map((s) => (s.id === stopId ? { ...s, visit_status: "skipped" } : s))
    );
  };

  const resetDemoTrip = () => {
    try {
      localStorage.removeItem("trailweave_active_trip_v1");
      localStorage.removeItem("trailweave_active_trip_v2");
      localStorage.removeItem("trailweave_active_trip_v3");
    } catch {}
    setTripId("trip_demo_udaipur");
    setTripTitle("Udaipur Living Heritage & Crafts Walk");
    setStops(INITIAL_DEMO_STOPS);
    setRevision(1);
    setAuditEvents([]);
  };

  // Replan Preview Dispatch
  const requestReplanPreview = async (operations: ReplanOperation[]): Promise<ReplanProposal> => {
    const endpoint = `/api/trips/${tripId}/replan-preview`;

    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base_revision: revision,
          requested_by: "manual_editor",
          operations,
        }),
      });

      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback: evaluate local proposal
    }

    // Local deterministic diff calculation fallback
    let costDelta = 0;
    let durationDelta = 0;
    const skipped: string[] = [];
    const removed: string[] = [];
    const added: string[] = [];

    const stopMap = new Map(stops.map((s) => [s.id, s]));

    for (const op of operations) {
      if (op.type === "skip_stop" && op.stop_id) {
        skipped.push(op.stop_id);
        const s = stopMap.get(op.stop_id);
        if (s) durationDelta -= s.suggested_duration_minutes || 0;
      } else if (op.type === "remove_stop" && op.stop_id) {
        removed.push(op.stop_id);
        const s = stopMap.get(op.stop_id);
        if (s) {
          durationDelta -= s.suggested_duration_minutes || 0;
          costDelta -= s.entry_fee_inr || 0;
        }
      } else if (op.type === "add_stop" && op.place_id) {
        added.push(op.place_id);
      }
    }

    return {
      proposal_id: `prop_local_${Date.now()}`,
      base_revision: revision,
      is_feasible: true,
      validation_diff: {
        cost_delta_inr: costDelta,
        duration_delta_minutes: durationDelta,
        stops_added: added,
        stops_skipped: skipped,
        stops_removed: removed,
        closing_hour_conflicts: [],
      },
      candidate_stops: [],
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  };

  // Revision-Locked Replan Commit (Enforces HTTP 409 Optimistic Concurrency)
  const commitReplan = async (
    proposalId: string,
    expectedRevision: number,
    finalStops: TripStop[]
  ): Promise<ReplanAcceptResult> => {
    // 1. Client-Side Concurrency Check
    if (expectedRevision !== revision) {
      return {
        success: false,
        isConflict: true,
        conflictRevision: revision,
        message: `Revision mismatch. Your edits were staged against Revision ${expectedRevision}, but the trip is already at Revision ${revision}. Please refresh and review latest updates.`,
      };
    }

    const endpoint = `/api/trips/${tripId}/replan-accept`;

    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposal_id: proposalId,
          expected_revision: expectedRevision,
        }),
      });

      if (res.status === 409) {
        let conflictRev = revision + 1;
        let conflictMsg = `Revision mismatch. Expected revision ${expectedRevision}, but trip has advanced.`;
        try {
          const errData = await res.json();
          if (errData.detail?.current_revision) conflictRev = errData.detail.current_revision;
          if (errData.detail?.message) conflictMsg = errData.detail.message;
        } catch {
          // Use default conflict details
        }
        setRevision(conflictRev);
        return {
          success: false,
          isConflict: true,
          conflictRevision: conflictRev,
          message: conflictMsg,
        };
      }

      if (res.ok) {
        const data = await res.json();
        const nextRev = data.new_revision ?? expectedRevision + 1;
        setRevision(nextRev);
        setStops(finalStops);

        setAuditEvents((prev) => [
          {
            id: `audit_replan_${Date.now()}`,
            stopId: "trip",
            stopName: "Manual Editor",
            action: "replan_committed",
            method: "replan-accept",
            endpoint: `POST ${endpoint}`,
            timestamp: new Date().toISOString(),
          },
          ...prev.slice(0, 9),
        ]);

        return {
          success: true,
          new_revision: nextRev,
          message: data.message || `Itinerary updated to Revision ${nextRev}`,
        };
      }
    } catch {
      // Backend offline fallback: apply locally with atomic revision increment
    }

    // Local optimistic commit
    const nextRev = expectedRevision + 1;
    setRevision(nextRev);
    setStops(finalStops);

    setAuditEvents((prev) => [
      {
        id: `audit_replan_${Date.now()}`,
        stopId: "trip",
        stopName: "Manual Editor",
        action: "replan_committed",
        method: "replan-accept",
        endpoint: `POST ${endpoint}`,
        timestamp: new Date().toISOString(),
      },
      ...prev.slice(0, 9),
    ]);

    return {
      success: true,
      new_revision: nextRev,
      message: `Itinerary updated to Revision ${nextRev}`,
    };
  };

  // Helper for testing: simulate concurrent update from another device / AI companion
  const simulateRemoteRevisionIncrement = () => {
    setRevision((prev) => prev + 1);
  };

  const sendCompanionMessage = async (
    message: string,
    history: Array<{ role: string; text: string }> = []
  ): Promise<CompanionResponse> => {
    const endpoint = `/api/trips/${tripId}/assistant/messages`;
    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history,
          client_trip_state: {
            title: tripTitle,
            revision,
            stops,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.trip_updated) {
          await refreshTrip();
        }
        return {
          response_narrative: data.response_narrative,
          replan_proposal: data.replan_proposal,
          acknowledged_events: data.acknowledged_events || [],
          trip_updated: Boolean(data.trip_updated),
          new_revision: data.new_revision ?? null,
        };
      }
    } catch {
      // Network error reaching backend
    }

    return {
      response_narrative:
        "Khamma Ghani! I couldn't reach the TrailWeave backend server at " +
        API_BASE_URL +
        ". Please ensure the backend service is running so I can manage your live itinerary and transit routes.",
      replan_proposal: null,
      acknowledged_events: [],
      trip_updated: false,
      new_revision: null,
    };
  };

  return (
    <TripContext.Provider
      value={{
        tripId,
        tripTitle,
        revision,
        travelMode,
        setTravelMode,
        stops,
        auditEvents,
        createTripFromBuilder,
        markVisited,
        markCheckout,
        markSkipped,
        refreshTrip,
        resetDemoTrip,
        requestReplanPreview,
        commitReplan,
        simulateRemoteRevisionIncrement,
        sendCompanionMessage,
      }}
    >
      {children}
    </TripContext.Provider>
  );
}

export function useTrip() {
  const context = useContext(TripContext);
  if (!context) {
    throw new Error("useTrip must be used within a TripProvider");
  }
  return context;
}
