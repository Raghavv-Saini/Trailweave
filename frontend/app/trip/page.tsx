"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/common/Header";
import { BottomNav } from "@/components/common/BottomNav";
import { ActiveStopCard } from "@/components/trip/ActiveStopCard";
import { TimelineList } from "@/components/trip/TimelineList";
import { ManualCheckinModal } from "@/components/trip/ManualCheckinModal";
import { AIChatDrawer } from "@/components/trip/AIChatDrawer";
import { CheckinMethod, TripStop, useTrip } from "@/context/TripContext";
import {
  Sparkles,
  Edit3,
  Radio,
  Timer,
  RotateCcw,
  CheckCircle2,
  Sliders,
  ChevronDown,
  ChevronUp,
  LogOut,
  Activity,
} from "lucide-react";

/** Haversine distance in meters between two lat/lng coordinates */
function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
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
  return Math.round(R * c);
}

export default function ActiveTripPage() {
  const {
    tripTitle,
    revision,
    stops,
    auditEvents,
    markVisited,
    markCheckout,
    resetDemoTrip,
  } = useTrip();

  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [promptStop, setPromptStop] = useState<TripStop | null>(null);
  const [promptMode, setPromptMode] = useState<CheckinMethod>("geofence_proximity");
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);

  // Geolocation & Demo Simulator State
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [gpsStatus, setGpsStatus] = useState<
    "watching" | "simulated" | "unavailable"
  >("watching");
  const [isSimOpen, setIsSimOpen] = useState(true);
  const [statusBanner, setStatusBanner] = useState<{
    type: "checkin" | "checkout" | "grace_buffer";
    message: string;
  } | null>(null);

  const promptedStopIdsRef = useRef<Set<string>>(new Set());

  // Progress counters (visited / skipped / remaining)
  const visitedCount = useMemo(
    () => stops.filter((s) => s.visit_status === "visited").length,
    [stops]
  );
  const skippedCount = useMemo(
    () => stops.filter((s) => s.visit_status === "skipped").length,
    [stops]
  );
  const remainingCount = useMemo(
    () => stops.filter((s) => s.visit_status === "pending").length,
    [stops]
  );
  const progressPercent = useMemo(
    () =>
      stops.length > 0
        ? Math.round(((visitedCount + skippedCount) / stops.length) * 100)
        : 0,
    [stops.length, visitedCount, skippedCount]
  );

  // Active stop pointer: advances to next pending stop on check-in (per user preference),
  // or shows user-selected stop from timeline
  const nextPendingStop = useMemo(
    () => stops.find((s) => s.visit_status === "pending") || stops[stops.length - 1],
    [stops]
  );

  const activeStop = useMemo(() => {
    if (selectedStopId) {
      const found = stops.find((s) => s.id === selectedStopId);
      if (found) return found;
    }
    return nextPendingStop;
  }, [selectedStopId, stops, nextPendingStop]);

  // Stops currently checked-in (visited, awaiting departure checkout)
  const touringStops = useMemo(
    () => stops.filter((s) => s.visit_status === "visited" && !s.is_checked_out),
    [stops]
  );

  // Compute distance from userCoords to activeStop
  const distanceToActiveMeters = useMemo(() => {
    if (!userCoords || !activeStop) return null;
    return calculateDistanceMeters(
      userCoords.lat,
      userCoords.lng,
      activeStop.latitude,
      activeStop.longitude
    );
  }, [userCoords, activeStop]);

  // HTML5 Geolocation watcher (`navigator.geolocation.watchPosition`)
  useEffect(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setGpsStatus("unavailable");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setGpsStatus((prev) => (prev === "simulated" ? "simulated" : "watching"));
        setUserCoords((prev) =>
          gpsStatus === "simulated" && prev
            ? prev
            : {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              }
        );
      },
      () => {
        setGpsStatus((prev) => (prev === "simulated" ? "simulated" : "unavailable"));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 10000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [gpsStatus]);

  // Trigger 100m proximity arrival prompt when within 100m of an unvisited active stop
  useEffect(() => {
    if (
      activeStop &&
      activeStop.visit_status === "pending" &&
      typeof distanceToActiveMeters === "number" &&
      distanceToActiveMeters <= 100 &&
      !promptedStopIdsRef.current.has(activeStop.id)
    ) {
      promptedStopIdsRef.current.add(activeStop.id);
      setPromptStop(activeStop);
      setPromptMode("geofence_proximity");
      setIsCheckinModalOpen(true);
    }
  }, [activeStop, distanceToActiveMeters]);

  // 20-Minute Missed-Checkout Grace Buffer watcher
  // Resolves departure automatically when arrival_timestamp + suggested_duration_minutes + 20m elapses
  useEffect(() => {
    const interval = setInterval(() => {
      const nowMs = Date.now();
      touringStops.forEach((stop) => {
        if (!stop.arrival_timestamp) return;
        const arrivalMs = new Date(stop.arrival_timestamp).getTime();
        const graceWindowMs = (stop.suggested_duration_minutes + 20) * 60 * 1000;
        if (nowMs - arrivalMs >= graceWindowMs) {
          const autoDepartureIso = new Date(
            arrivalMs + graceWindowMs
          ).toISOString();
          markCheckout(stop.id, "grace_buffer_timeout", autoDepartureIso);
          setStatusBanner({
            type: "grace_buffer",
            message: `Looks like you've wrapped up at ${stop.name}! Planned ${stop.suggested_duration_minutes}m + 20m grace buffer elapsed — departure auto-recorded (grace_buffer_timeout).`,
          });
        }
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [touringStops, markCheckout]);

  // 1-Tap Instant Manual Check-in Fallback handler
  const handleInstantManualCheckin = useCallback(
    async (stopId: string) => {
      const target = stops.find((s) => s.id === stopId);
      await markVisited(stopId, "manual_fallback");
      // Clear manual selection so activeStop pointer advances immediately to next pending stop
      setSelectedStopId(null);
      if (target) {
        setStatusBanner({
          type: "checkin",
          message: `Checked in to ${target.name} via 1-Tap Manual Fallback (manual_fallback). Active pointer advanced to next stop.`,
        });
      }
    },
    [stops, markVisited]
  );

  // Geofence Check-in handler
  const handleGeofenceCheckin = useCallback(
    async (stopId: string, method: CheckinMethod = "geofence_proximity") => {
      const target = stops.find((s) => s.id === stopId);
      await markVisited(stopId, method);
      setSelectedStopId(null);
      if (target) {
        setStatusBanner({
          type: "checkin",
          message: `Checked in to ${target.name} via 100m Geofence (${method}). Active pointer advanced to next stop.`,
        });
      }
    },
    [stops, markVisited]
  );

  // Manual Departure Checkout handler
  const handleManualCheckout = useCallback(
    async (stopId: string) => {
      const target = stops.find((s) => s.id === stopId);
      await markCheckout(stopId, "manual_tap");
      // Advance active stop pointer to next pending stop
      setSelectedStopId(null);
      if (target) {
        setStatusBanner({
          type: "checkout",
          message: `Departed ${target.name} (manual_tap). Departure timestamp recorded & active pointer advanced.`,
        });
      }
    },
    [stops, markCheckout]
  );

  // Simulator: Simulate entering <100m GPS proximity of current active pending stop
  const handleSimulateGeofenceArrival = () => {
    const target =
      stops.find((s) => s.visit_status === "pending") || activeStop;
    if (!target) return;
    promptedStopIdsRef.current.delete(target.id);
    setSelectedStopId(target.id);
    setGpsStatus("simulated");
    // Place simulated coordinates ~32m away from target stop
    setUserCoords({
      lat: target.latitude + 0.00025,
      lng: target.longitude + 0.00015,
    });
  };

  // Simulator: Fast-Forward +20m Missed-Checkout Grace Buffer
  const handleSimulateGraceBufferTimeout = async () => {
    let target = touringStops[0];

    // If no stop is currently in touring state, check into the current pending stop first, then resolve its grace buffer
    if (!target) {
      const pending = stops.find((s) => s.visit_status === "pending");
      if (!pending) return;
      target = pending;
      await markVisited(target.id, "manual_fallback");
    }

    const totalElapsedMinutes = target.suggested_duration_minutes + 20;
    const baseArrivalMs = target.arrival_timestamp
      ? new Date(target.arrival_timestamp).getTime()
      : Date.now() - totalElapsedMinutes * 60 * 1000;
    const resolvedDepartureIso = new Date(
      baseArrivalMs + totalElapsedMinutes * 60 * 1000
    ).toISOString();

    await markCheckout(target.id, "grace_buffer_timeout", resolvedDepartureIso);
    setSelectedStopId(null);
    setStatusBanner({
      type: "grace_buffer",
      message: `20-min Grace Buffer Auto-Checkout: ${target.name} resolved after ${target.suggested_duration_minutes}m planned + 20m buffer (grace_buffer_timeout).`,
    });
  };

  const handleResetDemo = () => {
    promptedStopIdsRef.current.clear();
    setSelectedStopId(null);
    setUserCoords(null);
    setGpsStatus("watching");
    setStatusBanner(null);
    resetDemoTrip();
  };

  return (
    <div className="flex-1 flex flex-col justify-between bg-[#FDFBF7]">
      <Header
        title="Active Trip Companion"
        subtitle={`${tripTitle} • Rev ${revision}`}
      />

      <main className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">
        {/* Live Progress Indicators (Visited / Skipped / Remaining) */}
        <div className="p-3.5 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-neutral-800 flex items-center gap-1.5">
              <Radio
                className={`w-3.5 h-3.5 ${
                  gpsStatus === "simulated"
                    ? "text-emerald-600 animate-pulse"
                    : gpsStatus === "watching"
                    ? "text-[#E05A2B]"
                    : "text-amber-500"
                }`}
              />
              <span>
                {gpsStatus === "simulated"
                  ? "GPS: Simulated <100m Lock"
                  : gpsStatus === "watching"
                  ? "GPS Geofence Watcher (100m)"
                  : "Old City Alley Mode (Manual Ready)"}
              </span>
            </span>
            <span className="text-[11px] font-bold text-[#E05A2B]">
              {progressPercent}% Complete
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 rounded-full bg-neutral-100 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#E05A2B] to-emerald-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Visited / Skipped / Remaining Counters */}
          <div className="grid grid-cols-3 gap-2 pt-0.5 text-center">
            <div className="py-1.5 px-2 rounded-xl bg-emerald-50 border border-emerald-100">
              <p className="text-sm font-extrabold text-emerald-700">
                {visitedCount}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
                Visited
              </p>
            </div>
            <div className="py-1.5 px-2 rounded-xl bg-neutral-100 border border-neutral-200">
              <p className="text-sm font-extrabold text-neutral-700">
                {skippedCount}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                Skipped
              </p>
            </div>
            <div className="py-1.5 px-2 rounded-xl bg-amber-50 border border-amber-100">
              <p className="text-sm font-extrabold text-[#E05A2B]">
                {remainingCount}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-800">
                Remaining
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions Row: Ask Gemini Companion + Edit Mode */}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setIsAIChatOpen(true)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 text-[#E05A2B] border border-amber-200 text-xs font-bold shadow-2xs hover:bg-amber-100/70 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ask Gemini Companion</span>
          </button>

          <Link
            href="/trip/edit"
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 text-xs font-bold shadow-2xs"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Stops</span>
          </Link>
        </div>

        {/* Live Status / Grace Buffer Recovery Alert Banner */}
        {statusBanner && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-2 ${
              statusBanner.type === "grace_buffer"
                ? "bg-amber-50 border-amber-300 text-amber-950"
                : "bg-emerald-50 border-emerald-200 text-emerald-900"
            }`}
          >
            <div className="flex items-start gap-2">
              {statusBanner.type === "grace_buffer" ? (
                <Timer className="w-4 h-4 text-[#E05A2B] shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed font-medium">
                {statusBanner.message}
              </span>
            </div>
            <button
              onClick={() => setStatusBanner(null)}
              className="text-[10px] font-bold uppercase text-neutral-400 hover:text-neutral-700 shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Active Touring Strip for Visited Stops Awaiting Checkout */}
        {touringStops.length > 0 && (
          <div className="p-3 rounded-2xl bg-neutral-900 text-white space-y-2 shadow-sm">
            {touringStops.map((ts) => (
              <div
                key={ts.id}
                className="flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                    <Timer className="w-3 h-3" />
                    Currently Checked In • +20m Grace Buffer Active
                  </span>
                  <p className="text-xs font-bold truncate mt-0.5">{ts.name}</p>
                </div>
                <button
                  onClick={() => handleManualCheckout(ts.id)}
                  className="shrink-0 px-3 py-1.5 rounded-xl bg-[#E05A2B] hover:bg-[#c94d23] text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Depart & Check Out</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Current Active Stop Card */}
        {activeStop && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Current Active Stop
              </h3>
              {selectedStopId && (
                <button
                  onClick={() => setSelectedStopId(null)}
                  className="text-[11px] font-semibold text-[#E05A2B] hover:underline"
                >
                  Jump to Next Pending Stop
                </button>
              )}
            </div>
            <ActiveStopCard
              stop={activeStop}
              distanceMeters={distanceToActiveMeters}
              onManualCheckin={handleInstantManualCheckin}
              onGeofenceCheckin={(id) =>
                handleGeofenceCheckin(id, "geofence_proximity")
              }
              onCheckout={handleManualCheckout}
            />
          </div>
        )}

        {/* Collapsible Hackathon Demo Simulator Controls */}
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 overflow-hidden">
          <button
            type="button"
            onClick={() => setIsSimOpen((prev) => !prev)}
            className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-amber-950 hover:bg-amber-100/50 cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-[#E05A2B]" />
              <span>Geofence & Grace Buffer Demo Simulator</span>
            </span>
            {isSimOpen ? (
              <ChevronUp className="w-4 h-4 text-amber-700" />
            ) : (
              <ChevronDown className="w-4 h-4 text-amber-700" />
            )}
          </button>

          {isSimOpen && (
            <div className="px-3.5 pb-3.5 pt-1 space-y-2 border-t border-amber-200/50">
              <p className="text-[11px] text-amber-800">
                Test 100m GPS proximity detection and the 20-minute missed-checkout grace buffer live:
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleSimulateGeofenceArrival}
                  className="py-2 px-2.5 rounded-xl bg-white border border-amber-300 text-amber-950 font-bold text-[11px] flex items-center justify-center gap-1.5 hover:bg-amber-100/60 shadow-2xs cursor-pointer"
                >
                  <Radio className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Simulate &lt;100m GPS</span>
                </button>

                <button
                  type="button"
                  onClick={handleSimulateGraceBufferTimeout}
                  className="py-2 px-2.5 rounded-xl bg-white border border-amber-300 text-amber-950 font-bold text-[11px] flex items-center justify-center gap-1.5 hover:bg-amber-100/60 shadow-2xs cursor-pointer"
                >
                  <Timer className="w-3.5 h-3.5 text-[#E05A2B]" />
                  <span>+20m Grace Buffer</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleResetDemo}
                className="w-full py-1.5 px-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-600 font-semibold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Demo Trip State</span>
              </button>
            </div>
          )}
        </div>

        {/* Today's Itinerary Timeline */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Today&apos;s Itinerary Timeline
            </h3>
            <span className="text-[11px] text-neutral-400 font-medium">
              Tap any card to inspect
            </span>
          </div>
          <TimelineList
            stops={stops}
            activeStopId={activeStop?.id}
            onSelectStop={(stop) => setSelectedStopId(stop.id)}
            onManualCheckin={handleInstantManualCheckin}
            onCheckout={handleManualCheckout}
          />
        </div>

        {/* API Method Audit Log */}
        {auditEvents.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-neutral-900 text-neutral-100 space-y-2">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              <span>Live Check-in / Checkout API Audit Log</span>
            </h4>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {auditEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="text-[11px] font-mono bg-neutral-800/90 px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2"
                >
                  <span className="truncate text-neutral-200">
                    {ev.endpoint}
                  </span>
                  <span className="shrink-0 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px]">
                    {ev.method}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* 100m Geofence Arrival Check-in Modal */}
      <ManualCheckinModal
        stop={promptStop}
        isOpen={isCheckinModalOpen}
        mode={promptMode}
        distanceMeters={distanceToActiveMeters}
        onClose={() => setIsCheckinModalOpen(false)}
        onConfirm={(id, method) => handleGeofenceCheckin(id, method)}
      />

      <AIChatDrawer
        isOpen={isAIChatOpen}
        onClose={() => setIsAIChatOpen(false)}
      />
      <BottomNav />
    </div>
  );
}
