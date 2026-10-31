"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { dispatchTransitionNotification } from "@/lib/pushNotifications";

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
  action: "visit" | "checkout" | "replan_committed";
  method?: string;
  endpoint: string;
  timestamp: string;
}

export interface ReplanOperation {
  type: "add_stop" | "remove_stop" | "skip_stop" | "reorder_stops" | "pin_stop";
  place_id?: string;
  stop_id?: string;
  new_order?: number;
  is_pinned?: boolean;
}

export interface ValidationDiff {
  cost_delta_inr: number;
  duration_delta_minutes: number;
  stops_added: string[];
  stops_skipped: string[];
  stops_removed: string[];
  closing_hour_conflicts: string[];
}

export interface ReplanProposal {
  proposal_id: string;
  base_revision: number;
  is_feasible: boolean;
  validation_diff: ValidationDiff;
  candidate_stops: Array<Record<string, unknown>>;
  expires_at: string;
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
  requestReplanPreview: (operations: ReplanOperation[]) => Promise<ReplanProposal>;
  commitReplan: (
    proposalId: string,
    expectedRevision: number,
    finalStops: TripStop[]
  ) => Promise<ReplanAcceptResult>;
  simulateRemoteRevisionIncrement: () => void;
  sendCompanionMessage: (message: string) => Promise<CompanionResponse>;
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
  },
  {
    id: "stop_jt",
    place_id: "place_jagdish_temple",
    name: "Jagdish Temple",
    ...PLACE_DEFAULTS.place_jagdish_temple,
    day_number: 1,
    sequence_in_day: 3,
    planned_arrival: "2026-10-31T12:40:00Z",
    planned_departure: "2026-10-31T13:10:00Z",
    suggested_duration_minutes: 30,
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
    planned_arrival: "2026-10-31T13:15:00Z",
    planned_departure: "2026-10-31T14:45:00Z",
    suggested_duration_minutes: 90,
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
    planned_arrival: "2026-10-31T15:15:00Z",
    planned_departure: "2026-10-31T16:15:00Z",
    suggested_duration_minutes: 60,
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
    planned_arrival: "2026-10-31T17:00:00Z",
    planned_departure: "2026-10-31T18:00:00Z",
    suggested_duration_minutes: 60,
    actual_duration_minutes: null,
    visit_status: "pending",
    is_pinned: false,
  },
];

const TripContext = createContext<TripContextType | undefined>(undefined);

export function TripProvider({ children }: { children: React.ReactNode }) {
  const [tripId] = useState<string>("trip_udaipur_heritage_01");
  const [tripTitle, setTripTitle] = useState<string>("Udaipur Living Heritage & Crafts Walk");
  const [revision, setRevision] = useState<number>(1);
  const [stops, setStops] = useState<TripStop[]>(INITIAL_DEMO_STOPS);
  const [auditEvents, setAuditEvents] = useState<TripAuditEvent[]>([]);

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
              image_url: String(s.image_url || defaults.image_url || existing?.image_url || ""),
              day_number: Number(s.day_number || 1),
              sequence_in_day: Number(s.sequence_in_day || 1),
              planned_arrival:
                typeof s.planned_arrival === "string" ? s.planned_arrival : existing?.planned_arrival,
              planned_departure:
                typeof s.planned_departure === "string" ? s.planned_departure : existing?.planned_departure,
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

  const sendCompanionMessage = async (message: string): Promise<CompanionResponse> => {
    const endpoint = `/api/trips/${tripId}/assistant/messages`;
    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (res.ok) {
        const data = await res.json();
        return {
          response_narrative: data.response_narrative,
          replan_proposal: data.replan_proposal,
          acknowledged_events: data.acknowledged_events || [],
        };
      }
    } catch {
      // Offline / network fallback
    }

    // Local cultured companion evaluation fallback
    const msgLower = message.toLowerCase();
    const pending = stops.filter((s) => s.visit_status === "pending");
    const hasPriorSkip = stops.some((s) => s.visit_status === "skipped");
    const ackText = hasPriorSkip
      ? "I see you skipped a stop earlier on your route, so I've taken that into account! "
      : "";

    const isReplanIntent = ["skip", "drop", "tired", "tea", "rooftop", "workshop", "pottery", "add"].some((k) =>
      msgLower.includes(k)
    );

    if (isReplanIntent && pending.length > 0) {
      const stopToSkip = pending[0];
      const ops: ReplanOperation[] = [
        { type: "skip_stop", stop_id: stopToSkip.id },
        { type: "add_stop", place_id: "place_sukhadia_circle", new_order: stopToSkip.sequence_in_day },
      ];
      const proposal = await requestReplanPreview(ops);

      return {
        response_narrative: `Khamma Ghani! ${ackText}I completely understand wanting a gentler pace. I've prepared a proposal to skip ${stopToSkip.name} and guide you toward Sukhadia Circle for lakeside evening tea. Review the proposal below and tap 'Accept' to update to Revision ${revision + 1}.`,
        replan_proposal: proposal,
        acknowledged_events: hasPriorSkip ? ["Acknowledged prior manual skip"] : [],
      };
    }

    return {
      response_narrative: `Khamma Ghani! ${ackText}I am keeping an eye on your journey through Udaipur (currently on Revision ${revision}). Ask me anytime to skip stops, discover Mewar craft masterclasses, or find nearby rooftop cafes!`,
      replan_proposal: null,
      acknowledged_events: hasPriorSkip ? ["Acknowledged prior manual skip"] : [],
    };
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
