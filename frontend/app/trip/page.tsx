"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Header } from "@/components/common/Header";
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