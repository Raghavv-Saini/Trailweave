"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/common/Header";
import { useAuth } from "@/context/AuthContext";
import { BottomNav } from "@/components/common/BottomNav";
import { ActiveStopCard } from "@/components/trip/ActiveStopCard";
import { TimelineList } from "@/components/trip/TimelineList";
import { ManualCheckinModal } from "@/components/trip/ManualCheckinModal";
import { AIChatDrawer } from "@/components/trip/AIChatDrawer";
import { UpcomingStopEditor } from "@/components/trip/UpcomingStopEditor";
import { CompanionConciergeCard } from "@/components/trip/CompanionConciergeCard";
import { TripToTrailModal } from "@/components/trip/TripToTrailModal";
import { registerServiceWorker } from "@/lib/pushNotifications";
import {
  ArtisanRecommendationCard,
  ArtisanRecommendation,
} from "@/components/trip/ArtisanRecommendationCard";
import { ReplanPreviewModal } from "@/components/trip/ReplanPreviewModal";
import {
  CheckinMethod,
  TripStop,
  ReplanProposal,
  useTrip,
} from "@/context/TripContext";
import {
  Sparkles,
  Edit3,
  Compass,
  Radio,
  Timer,
  RotateCcw,
  CheckCircle2,
  Sliders,
  ChevronDown,
  ChevronUp,
  LogOut,
  Activity,
  ArrowRight,
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
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const {
    tripId,
    tripTitle,
    revision,
    stops,
    auditEvents,
    markVisited,
    markCheckout,
    resetDemoTrip,
    requestReplanPreview,
  } = useTrip();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login?redirect=/trip");
    }
  }, [isLoading, isAuthenticated, router]);

  // Mode switcher: Operational View vs Edit Mode
  const [viewMode, setViewMode] = useState<"operational" | "edit">("operational");

  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [promptStop, setPromptStop] = useState<TripStop | null>(null);
  const [promptMode, setPromptMode] = useState<CheckinMethod>("geofence_proximity");
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);

  // Recommendations & Replan Preview Modal State
  const [recommendations, setRecommendations] = useState<ArtisanRecommendation[]>([]);
  const [isRecsOpen, setIsRecsOpen] = useState(true);
  const [isRecPreviewOpen, setIsRecPreviewOpen] = useState(false);
  const [recProposal, setRecProposal] = useState<ReplanProposal | null>(null);
  const [recWorkingStops, setRecWorkingStops] = useState<TripStop[]>([]);
  const [isLoadingRecAction, setIsLoadingRecAction] = useState(false);

  // Geolocation & Demo Simulator State
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [gpsStatus, setGpsStatus] = useState<
    "watching" | "simulated" | "unavailable"
  >("watching");
  const [isSimOpen, setIsSimOpen] = useState(false);
  const [showRawEndpoints, setShowRawEndpoints] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: "checkin" | "checkout" | "grace_buffer";
    message: string;
  } | null>(null);

  const promptedStopIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    registerServiceWorker();
  }, []);

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

  // Active stop pointer: advances to next pending stop on check-in,
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

  // Computed distance (meters) to currently active stop
  const distanceToActiveMeters = useMemo(() => {
    if (!userCoords || !activeStop) return null;
    return calculateDistanceMeters(
      userCoords.lat,
      userCoords.lng,
      activeStop.latitude,
      activeStop.longitude
    );
  }, [userCoords, activeStop]);

  // Watch real device position via HTML5 Geolocation API (when simulated mode is not active)
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setGpsStatus("unavailable");
      return;
    }
    if (gpsStatus === "simulated") return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setGpsStatus("watching");
      },
      () => setGpsStatus("unavailable"),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [gpsStatus]);

  // 100-Meter Geofence Proximity Detection
  useEffect(() => {
    if (!userCoords) return;

    const pendingStops = stops.filter((s) => s.visit_status === "pending");
    for (const stop of pendingStops) {
      const dist = calculateDistanceMeters(
        userCoords.lat,
        userCoords.lng,
        stop.latitude,
        stop.longitude
      );

      if (dist <= 100 && !promptedStopIdsRef.current.has(stop.id)) {
        promptedStopIdsRef.current.add(stop.id);
        setPromptStop(stop);
        setPromptMode("geofence_proximity");
        setIsCheckinModalOpen(true);
        break;
      }
    }
  }, [userCoords, stops]);

  // Handle Arrival Check-in
  const handleGeofenceCheckin = async (
    stopId: string,
    method: CheckinMethod = "geofence_proximity"
  ) => {
    const target = stops.find((s) => s.id === stopId);
    await markVisited(stopId, method);
    setIsCheckinModalOpen(false);
    setSelectedStopId(null);

    if (target) {
      setStatusBanner({
        type: "checkin",
        message: `Arrived at ${target.name}! Check-in recorded (${method}). Touring in progress.`,
      });
    }
  };

  const handleInstantManualCheckin = (stopId: string) => {
    const target = stops.find((s) => s.id === stopId);
    if (!target) return;
    setPromptStop(target);
    setPromptMode("manual_fallback");
    setIsCheckinModalOpen(true);
  };

  // Handle Departure Checkout
  const handleManualCheckout = useCallback(
    async (stopId: string) => {
      const target = stops.find((s) => s.id === stopId);
      await markCheckout(stopId, "manual_tap");
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
    setUserCoords({
      lat: target.latitude + 0.00025,
      lng: target.longitude + 0.00015,
    });
  };

  // Simulator: Fast-Forward +20m Missed-Checkout Grace Buffer
  const handleSimulateGraceBufferTimeout = async () => {
    let target = touringStops[0];

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

  // Fetch active artisan recommendations
  useEffect(() => {
    let isMounted = true;
    const fetchRecs = async () => {
      try {
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(
          `${apiUrl}/api/trips/${tripId}/recommendations/artisans?preference=both`
        );
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.recommendations) {
            setRecommendations(data.recommendations);
            return;
          }
        }
      } catch {
        // Fallback
      }

      if (isMounted) {
        const scheduledPlaces = new Set(stops.map((s) => s.place_id));
        const mockRecs: ArtisanRecommendation[] = [
          {
            artisan_id: "artisan_pottery",
            place_id: "place_pottery_studio",
            artisan_name: "Master Kavita Kumhar",
            craft_type: "Terracotta Pottery & Clay Sculpting",
            offering_type: "workshop" as const,
            fee_inr: 250,
            duration_minutes: 45,
            detour_minutes: 5,
            optimal_insert_order: 2,
            rationale:
              "Master Kavita Kumhar: 5 min detour, ₹250 workshop fee, open until 7:30 PM, fits under your ₹1,070 budget",
            latitude: 24.5815,
            longitude: 73.682,
            address: "22 Chandpole Ghat Road, Old City, Udaipur",
            image_url:
              "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=900&q=80",
            has_workshop: true,
          },
          {
            artisan_id: "artisan_puppetry",
            place_id: "place_puppetry_workshop",
            artisan_name: "Babu Bhatt Puppeteer",
            craft_type: "Kathputli Traditional String Puppetry",
            offering_type: "workshop" as const,
            fee_inr: 200,
            duration_minutes: 45,
            detour_minutes: 5,
            optimal_insert_order: 2,
            rationale:
              "Babu Bhatt Puppeteer: 5 min detour, ₹200 workshop fee, open until 7 PM, fits under your ₹1,070 budget",
            latitude: 24.5788,
            longitude: 73.6815,
            address: "Gangaur Ghat Road, Old City, Udaipur",
            image_url:
              "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=900&q=80",
            has_workshop: true,
          },
          {
            artisan_id: "artisan_leather",
            place_id: "place_leather_craft",
            artisan_name: "Ramesh Chandra Parmar",
            craft_type: "Handcrafted Camel Leather & Mojari Juttis",
            offering_type: "store" as const,
            fee_inr: 0,
            duration_minutes: 20,
            detour_minutes: 6,
            optimal_insert_order: 3,
            rationale:
              "Ramesh Chandra Parmar: 6 min detour, ₹0 entry (store visit), open until 8:30 PM, fits under your ₹1,070 budget",
            latitude: 24.584,
            longitude: 73.6865,
            address: "Hathi Pole Bazaar, Udaipur",
            image_url:
              "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=900&q=80",
            has_workshop: false,
          },
        ].filter((r) => !scheduledPlaces.has(r.place_id));

        setRecommendations(mockRecs);
      }
    };

    fetchRecs();
    return () => {
      isMounted = false;
    };
  }, [tripId, stops]);

  // Handle 1-Tap "Accept & Add to Route"
  const handleAcceptOperationalRec = async (rec: ArtisanRecommendation) => {
    setIsLoadingRecAction(true);
    try {
      const op = {
        type: "add_stop" as const,
        place_id: rec.place_id,
        new_order: rec.optimal_insert_order,
      };

      const newStop: TripStop = {
        id: `stop_${rec.place_id}_${Date.now()}`,
        place_id: rec.place_id,
        name: rec.artisan_name,
        address: rec.address || "Old City, Udaipur",
        latitude: rec.latitude,
        longitude: rec.longitude,
        category: "artisan_studio",
        entry_fee_inr: rec.fee_inr,
        image_url:
          rec.image_url ||
          "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=900&q=80",
        day_number: 1,
        sequence_in_day: rec.optimal_insert_order,
        suggested_duration_minutes: rec.duration_minutes,
        visit_status: "pending",
        is_pinned: false,
      };

      const insertIdx = Math.min(
        Math.max(0, rec.optimal_insert_order - 1),
        stops.length
      );
      const updatedStops = [...stops];
      updatedStops.splice(insertIdx, 0, newStop);
      const reindexed = updatedStops.map((s, idx) => ({
        ...s,
        sequence_in_day: idx + 1,
      }));

      const proposal = await requestReplanPreview([op]);
      setRecWorkingStops(reindexed);
      setRecProposal(proposal);
      setIsRecPreviewOpen(true);
    } finally {
      setIsLoadingRecAction(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between bg-[#FDFBF7]">
      <Header
        title="Active Trip Companion"
        subtitle={`${tripTitle} • Rev ${revision}`}
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 sm:py-7 space-y-6">
        {/* Clear Toggle Between Operational View & Edit Mode */}
        <div className="flex rounded-2xl bg-neutral-200/70 p-1 text-xs font-bold shadow-2xs max-w-xs sm:max-w-sm">
          <button
            onClick={() => setViewMode("operational")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all cursor-pointer ${
              viewMode === "operational"
                ? "bg-white text-neutral-900 shadow-xs font-extrabold"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Operational View</span>
          </button>

          <button
            onClick={() => setViewMode("edit")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all cursor-pointer ${
              viewMode === "edit"
                ? "bg-[#1E3A5F] text-white shadow-xs font-extrabold"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Mode</span>
          </button>
        </div>

        {viewMode === "edit" ? (
          /* Direct-Manipulation Upcoming Stop Manual Editor */
          <UpcomingStopEditor onClose={() => setViewMode("operational")} />
        ) : (
          /* Operational View: 2-Column Split on Desktop */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            {/* Left Column (lg:col-span-7): Active Stop, Timeline & Audit */}
            <div className="lg:col-span-7 space-y-6">
              {/* Live Status / Grace Buffer Recovery Alert Banner */}
              {statusBanner && (
                <div
                  className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 shadow-2xs animate-in slide-in-from-top-1 ${
                    statusBanner.type === "grace_buffer"
                      ? "bg-amber-50 border-amber-200 text-amber-900"
                      : statusBanner.type === "checkout"
                      ? "bg-neutral-900 border-neutral-800 text-white"
                      : "bg-emerald-50 border-emerald-200 text-emerald-900"
                  }`}
                >
                  {statusBanner.type === "grace_buffer" ? (
                    <Timer className="w-4 h-4 text-[#1E3A5F] shrink-0 mt-0.5" />
                  ) : statusBanner.type === "checkout" ? (
                    <LogOut className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-bold leading-relaxed">{statusBanner.message}</p>
                  </div>
                  <button
                    onClick={() => setStatusBanner(null)}
                    className="text-[11px] font-bold opacity-60 hover:opacity-100 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Current Active Stop Card */}
              {activeStop && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#7A746B]">
                      Current Active Stop
                    </h3>
                    {selectedStopId && (
                      <button
                        onClick={() => setSelectedStopId(null)}
                        className="text-[11px] font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
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

              {/* Today's Itinerary Timeline */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#7A746B]">
                    Today&apos;s Itinerary Timeline
                  </h3>
                  <span className="text-[11px] text-[#7A746B] font-medium">
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

              {/* Live Companion Sync & Activity Log */}
              {auditEvents.length > 0 && (
                <div className="p-4 rounded-2xl bg-white border border-[#E8E4DC] shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#9E7432] flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-[#1E3A5F]" />
                      <span>Live Companion Activity & Sync Log</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowRawEndpoints((prev) => !prev)}
                      className="text-[10px] font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                    >
                      {showRawEndpoints ? "Hide API Details" : "View API Details"}
                    </button>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {auditEvents.map((ev) => {
                      const isGps = ev.method === "geofence_proximity";
                      const isGrace = ev.method === "grace_buffer_timeout";
                      const actionTitle =
                        ev.action === "visit"
                          ? `Checked in at ${ev.stopName}`
                          : ev.action === "checkout"
                          ? `Departed from ${ev.stopName}`
                          : "Itinerary re-planned & synced";

                      const methodBadge = isGps
                        ? "Auto GPS (100m)"
                        : isGrace
                        ? "20m Grace Buffer"
                        : ev.method === "manual_fallback" || ev.method === "manual_tap"
                        ? "1-Tap Verified"
                        : ev.method || ev.action;

                      let timeStr = "";
                      try {
                        timeStr = new Date(ev.timestamp).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                          timeZone: "Asia/Kolkata",
                        });
                      } catch {}

                      return (
                        <div
                          key={ev.id}
                          className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E8E4DC] text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-[#191C1E] truncate">
                              {actionTitle}
                            </span>
                            <span className="shrink-0 text-[10px] text-[#7A746B]">
                              {timeStr}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#1E3A5F]/10 text-[#1E3A5F] text-[10px] font-bold">
                              {isGps && <Radio className="w-2.5 h-2.5 text-emerald-600" />}
                              {methodBadge}
                            </span>
                          </div>
                          {showRawEndpoints && (
                            <div className="pt-1 border-t border-[#E8E4DC]/60 text-[10px] font-mono text-[#7A746B] truncate">
                              <code>{ev.endpoint}</code>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column (lg:col-span-5): Companion Concierge, Metrics, Recs & Simulator */}
            <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-20">
              {/* Live Progress Indicators (Visited / Skipped / Remaining) */}
              <div className="p-4 rounded-2xl bg-white border border-[#E8E4DC] shadow-2xs space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#191C1E] flex items-center gap-1.5">
                    <Radio
                      className={`w-3.5 h-3.5 ${
                        gpsStatus === "simulated"
                          ? "text-emerald-600 animate-pulse"
                          : gpsStatus === "watching"
                          ? "text-[#1E3A5F]"
                          : "text-[#9E7432]"
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
                  <span className="text-[11px] font-bold text-[#1E3A5F]">
                    {progressPercent}% Complete
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 rounded-full bg-[#F0ECE1] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#1E3A5F] to-emerald-600 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {/* Visited / Skipped / Remaining Counters */}
                <div className="grid grid-cols-3 gap-2 pt-0.5 text-center">
                  <div className="py-2 px-2 rounded-xl bg-emerald-50 border border-emerald-100">
                    <p className="text-sm font-extrabold text-emerald-800">
                      {visitedCount}
                    </p>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                      Visited
                    </p>
                  </div>
                  <div className="py-2 px-2 rounded-xl bg-[#F0ECE1] border border-[#E8E4DC]">
                    <p className="text-sm font-extrabold text-[#5A544B]">
                      {skippedCount}
                    </p>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#7A746B]">
                      Skipped
                    </p>
                  </div>
                  <div className="py-2 px-2 rounded-xl bg-[#FAF8F5] border border-[#E8E4DC]">
                    <p className="text-sm font-extrabold text-[#1E3A5F]">
                      {remainingCount}
                    </p>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#7A746B]">
                      Remaining
                    </p>
                  </div>
                </div>
              </div>

              {/* In-App Companion Concierge Card */}
              <CompanionConciergeCard onOpenChat={() => setIsAIChatOpen(true)} />

              {/* Trip-to-Trail Contribution Banner */}
              <div className="p-4 rounded-2xl bg-white border border-[#E8E4DC] shadow-2xs space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-[#191C1E]">
                      Wrapping up your journey?
                    </p>
                    <p className="text-[11px] text-[#5A544B] leading-relaxed">
                      Publish your verified visited stops as a Community Trail for future travelers.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPublishModalOpen(true)}
                  className="w-full py-2 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
                >
                  <span>Share Trail to Community</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Nearby Artisan Discoveries */}
              {recommendations.length > 0 && (
                <div className="rounded-2xl border border-[#E8E4DC] bg-white overflow-hidden shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setIsRecsOpen((prev) => !prev)}
                    className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-[#191C1E] hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#9E7432]" />
                      <span>
                        Nearby Artisan Discoveries ({recommendations.length} within 15m)
                      </span>
                    </span>
                    {isRecsOpen ? (
                      <ChevronUp className="w-4 h-4 text-[#7A746B]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#7A746B]" />
                    )}
                  </button>

                  {isRecsOpen && (
                    <div className="px-4 pb-4 pt-1 space-y-2.5 border-t border-[#F0ECE1]">
                      <p className="text-[11px] text-[#5A544B] leading-relaxed">
                        Constraint-aware studio workshops scored along your active route:
                      </p>
                      <div className="space-y-2">
                        {recommendations.map((rec) => (
                          <ArtisanRecommendationCard
                            key={rec.place_id}
                            recommendation={rec}
                            onAccept={handleAcceptOperationalRec}
                            isStaged={stops.some((s) => s.place_id === rec.place_id)}
                            isLoading={isLoadingRecAction}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Collapsible Hackathon Demo Simulator Controls */}
              <div className="rounded-2xl border border-[#E8E4DC] bg-[#FAF8F5] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsSimOpen((prev) => !prev)}
                  className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-[#191C1E] hover:bg-[#F0ECE1] cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-[#1E3A5F]" />
                    <span>Geofence &amp; Grace Buffer Demo Simulator</span>
                  </span>
                  {isSimOpen ? (
                    <ChevronUp className="w-4 h-4 text-[#7A746B]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#7A746B]" />
                  )}
                </button>

                {isSimOpen && (
                  <div className="px-4 pb-4 pt-1 space-y-2.5 border-t border-[#E8E4DC]">
                    <p className="text-[11px] text-[#5A544B]">
                      Test 100m GPS proximity detection and the 20-minute missed-checkout grace buffer live:
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleSimulateGeofenceArrival}
                        className="py-2 px-2.5 rounded-xl bg-white border border-[#E8E4DC] text-[#191C1E] font-bold text-[11px] flex items-center justify-center gap-1.5 hover:bg-[#FAF8F5] shadow-2xs cursor-pointer"
                      >
                        <Radio className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Simulate &lt;100m GPS</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSimulateGraceBufferTimeout}
                        className="py-2 px-2.5 rounded-xl bg-white border border-[#E8E4DC] text-[#191C1E] font-bold text-[11px] flex items-center justify-center gap-1.5 hover:bg-[#FAF8F5] shadow-2xs cursor-pointer"
                      >
                        <Timer className="w-3.5 h-3.5 text-[#1E3A5F]" />
                        <span>+20m Grace Buffer</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleResetDemo}
                      className="w-full py-1.5 px-2.5 rounded-xl bg-white hover:bg-[#F0ECE1] text-[#7A746B] border border-[#E8E4DC] font-semibold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset Demo Trip State</span>
                    </button>
                  </div>
                )}
              </div>
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

      {/* 1-Tap Recommendation Replan Preview Modal */}
      <ReplanPreviewModal
        isOpen={isRecPreviewOpen}
        onClose={() => setIsRecPreviewOpen(false)}
        proposal={recProposal}
        workingStops={recWorkingStops}
        onCommitSuccess={() => {
          setStatusBanner({
            type: "checkin",
            message:
              "Artisan studio successfully added to your route! Itinerary revision updated.",
          });
        }}
      />

      {/* Trip-to-Trail Publishing Modal */}
      <TripToTrailModal
        isOpen={isPublishModalOpen}
        tripId={tripId}
        stops={stops}
        onClose={() => setIsPublishModalOpen(false)}
        onTripCompleted={() => {
          setStatusBanner({
            type: "checkin",
            message:
              "🎉 Your Udaipur journey has been contributed as a public Community Trail!",
          });
        }}
        onConfirmVisited={async (stopIds) => {
          for (const id of stopIds) {
            await markVisited(id, "manual_fallback");
          }
        }}
      />

      <AIChatDrawer
        isOpen={isAIChatOpen}
        onClose={() => setIsAIChatOpen(false)}
      />
      <BottomNav />
    </div>
  );
}
