"use client";

import React, { createContext, useContext, useState } from "react";

export interface TripStop {
  id: string;
  place_id: string;
  name: string;
  day_number: number;
  sequence_in_day: number;
  planned_arrival?: string;
  planned_departure?: string;
  suggested_duration_minutes: number;
  visit_status: "pending" | "visited" | "skipped";
  is_pinned: boolean;
}

interface TripContextType {
  tripId: string;
  revision: number;
  stops: TripStop[];
  markVisited: (stopId: string, method?: "manual_fallback" | "geofence_proximity") => Promise<void>;
  markSkipped: (stopId: string) => Promise<void>;
  refreshTrip: () => Promise<void>;
}

const TripContext = createContext<TripContextType | undefined>(undefined);

export function TripProvider({ children }: { children: React.ReactNode }) {
  const [tripId] = useState("trip_demo_udaipur");
  const [revision, setRevision] = useState(1);
  const [stops, setStops] = useState<TripStop[]>([
    {
      id: "stop_cp",
      place_id: "place_city_palace",
      name: "City Palace Udaipur",
      day_number: 1,
      sequence_in_day: 1,
      planned_arrival: "2026-10-31T09:30:00Z",
      planned_departure: "2026-10-31T11:30:00Z",
      suggested_duration_minutes: 120,
      visit_status: "visited",
      is_pinned: false,
    },
    {
      id: "stop_ms",
      place_id: "place_mohanlal_studio",
      name: "Master Mohanlal Miniature Art Studio",
      day_number: 1,
      sequence_in_day: 2,
      planned_arrival: "2026-10-31T11:45:00Z",
      planned_departure: "2026-10-31T12:30:00Z",
      suggested_duration_minutes: 45,
      visit_status: "pending",
      is_pinned: true,
    },
    {
      id: "stop_jt",
      place_id: "place_jagdish_temple",
      name: "Jagdish Temple",
      day_number: 1,
      sequence_in_day: 3,
      planned_arrival: "2026-10-31T12:45:00Z",
      planned_departure: "2026-10-31T13:15:00Z",
      suggested_duration_minutes: 30,
      visit_status: "pending",
      is_pinned: false,
    },
  ]);

  const markVisited = async (stopId: string, method = "manual_fallback") => {
    setStops((prev) =>
      prev.map((s) => (s.id === stopId ? { ...s, visit_status: "visited" } : s))
    );
  };

  const markSkipped = async (stopId: string) => {
    setStops((prev) =>
      prev.map((s) => (s.id === stopId ? { ...s, visit_status: "skipped" } : s))
    );
  };

  const refreshTrip = async () => {};

  return (
    <TripContext.Provider
      value={{
        tripId,
        revision,
        stops,
        markVisited,
        markSkipped,
        refreshTrip,
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
