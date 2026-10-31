"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

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
  action: "visit" | "checkout";
  method: CheckinMethod | CheckoutMethod;
  endpoint: string;
  timestamp: string;
}

interface TripContextType {
  tripId: string;
  tripTitle: string;
  revision: number;
  stops: TripStop[];
  auditEvents: TripAuditEvent[];
  markVisited: (stopId: string, method?: CheckinMethod) => Promise<void>;
  markCheckout: (
    stopId: string,
    method?: CheckoutMethod,
    customDepartureIso?: string
  ) => Promise<void>;
  markSkipped: (stopId: string) => Promise<void>;
  refreshTrip: () => Promise<void>;
  resetDemoTrip: () => void;
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
      "https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=900&q=80",
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
  place_jagdish_temple: {
    address: "1 Jagdish Chowk, Old City, Udaipur, Rajasthan 313001",
    latitude: 24.5794,
    longitude: 73.6841,
    category: "heritage",
    entry_fee_inr: 0,
    image_url:
      "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=900&q=80",
  },
  place_bagore_haveli: {
    address: "Gangaur Ghat Marg, Old City, Udaipur, Rajasthan 313001",
    latitude: 24.5798,
    longitude: 73.68,
    category: "heritage",
    entry_fee_inr: 100,
    image_url:
      "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=900&q=80",
  },
  place_saheliyon_bari: {
    address: "Saheli Marg, New Vidhya Nagar, Udaipur, Rajasthan 313001",
    latitude: 24.6019,
    longitude: 73.6853,
    category: "attraction",
    entry_fee_inr: 50,
    image_url:
      "https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=900&q=80",
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
    planned_arrival: "2026-10-31T09:30:00Z",
    planned_departure: "2026-10-31T11:30:00Z",
    suggested_duration_minutes: 120,
    actual_duration_minutes: 120,
    visit_status: "visited",
    is_pinned: false,
    checkin_method: "geofence_proximity",
    arrival_timestamp: "2026-10-31T09:32:00Z",
    checkout_method: "manual_tap",
    departure_timestamp: "2026-10-31T11:30:00Z",
    is_checked_out: true,
  },
  {
    id: "stop_ms",
    place_id: "place_mohanlal_studio",
    name: "Master Mohanlal Miniature Art Studio",
    ...PLACE_DEFAULTS.place_mohanlal_studio,
    day_number: 1,
    sequence_in_day: 2,
    planned_arrival: "2026-10-31T11:45:00Z",
    planned_departure: "2026-10-31T12:30:00Z",
    suggested_duration_minutes: 45,
    actual_duration_minutes: null,
    visit_status: "pending",
    is_pinned: true,
    is_checked_out: false,
  },
  {
    id: "stop_jt",
    place_id: "place_jagdish_temple",
    name: "Jagdish Temple",
    ...PLACE_DEFAULTS.place_jagdish_temple,
    day_number: 1,
    sequence_in_day: 3,
    planned_arrival: "2026-10-31T12:45:00Z",
    planned_departure: "2026-10-31T13:15:00Z",
    suggested_duration_minutes: 30,
    actual_duration_minutes: null,
    visit_status: "pending",
    is_pinned: false,
    is_checked_out: false,
  },
  {
    id: "stop_bh",
    place_id: "place_bagore_haveli",
    name: "Bagore Ki Haveli",
    ...PLACE_DEFAULTS.place_bagore_haveli,
    day_number: 1,
    sequence_in_day: 4,
    planned_arrival: "2026-10-31T13:30:00Z",
    planned_departure: "2026-10-31T15:00:00Z",
    suggested_duration_minutes: 90,
    actual_duration_minutes: null,
    visit_status: "pending",
    is_pinned: false,
    is_checked_out: false,
  },
];

const TripContext = createContext<TripContextType | undefined>(undefined);

export function TripProvider({ children }: { children: React.ReactNode }) {
  const [tripId] = useState("trip_demo_udaipur");
  const [tripTitle, setTripTitle] = useState("My Udaipur Cultural Journey");
  const [revision, setRevision] = useState(1);
  const [stops, setStops] = useState<TripStop[]>(INITIAL_DEMO_STOPS);
  const [auditEvents, setAuditEvents] = useState<TripAuditEvent[]>([]);

  const refreshTrip = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/trips/${tripId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.revision) setRevision(data.revision);
      if (data.title) setTripTitle(data.title);
      if (data.active_version?.stops && Array.isArray(data.active_version.stops)) {
        setStops((prev) => {
          const prevMap = new Map(prev.map((p) => [p.id, p]));
          return data.active_version.stops.map((s: Record<string, unknown>) => {
            const placeId = String(s.place_id || "");
            const defaults = PLACE_DEFAULTS[placeId] || PLACE_DEFAULTS.place_city_palace;
            const existing = prevMap.get(String(s.id));
            const visitStatus = (s.visit_status as "pending" | "visited" | "skipped") || "pending";
            const actualDuration =
              typeof s.actual_duration_minutes === "number"
                ? s.actual_duration_minutes
                : existing?.actual_duration_minutes ?? null;

            return {
              id: String(s.id),
              place_id: placeId,
              name: String(s.name || existing?.name || "Udaipur Stop"),
              address: String(s.address || existing?.address || defaults.address),
              latitude:
                typeof s.latitude === "number"
                  ? s.latitude
                  : existing?.latitude ?? defaults.latitude,
              longitude:
                typeof s.longitude === "number"
                  ? s.longitude
                  : existing?.longitude ?? defaults.longitude,
              category: String(s.category || existing?.category || defaults.category),
              entry_fee_inr:
                typeof s.entry_fee_inr === "number"
                  ? s.entry_fee_inr
                  : existing?.entry_fee_inr ?? defaults.entry_fee_inr,
              image_url: String(s.image_url || existing?.image_url || defaults.image_url),
              day_number: Number(s.day_number || 1),
              sequence_in_day: Number(s.sequence_in_day || 1),
              planned_arrival:
                typeof s.planned_arrival === "string"
                  ? s.planned_arrival
                  : existing?.planned_arrival,
              planned_departure:
                typeof s.planned_departure === "string"
                  ? s.planned_departure
                  : existing?.planned_departure,
              suggested_duration_minutes: Number(s.suggested_duration_minutes || 45),
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

  const markVisited = async (
    stopId: string,
    method: CheckinMethod = "manual_fallback"
  ) => {
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
  };

  const markSkipped = async (stopId: string) => {
    setStops((prev) =>
      prev.map((s) => (s.id === stopId ? { ...s, visit_status: "skipped" } : s))
    );
  };

  const resetDemoTrip = () => {
    setStops(INITIAL_DEMO_STOPS);
    setAuditEvents([]);
  };

  return (
    <TripContext.Provider
      value={{
        tripId,
        tripTitle,
        revision,
        stops,
        auditEvents,
        markVisited,
        markCheckout,
        markSkipped,
        refreshTrip,
        resetDemoTrip,
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
