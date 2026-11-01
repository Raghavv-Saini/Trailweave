"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  TripStop,
  ReplanOperation,
  ReplanProposal,
  useTrip,
} from "@/context/TripContext";
import { ReplanPreviewModal } from "@/components/trip/ReplanPreviewModal";
import {
  ArtisanRecommendationCard,
  ArtisanRecommendation,
} from "@/components/trip/ArtisanRecommendationCard";
import {
  Lock,
  ArrowUp,
  ArrowDown,
  Pin,
  SkipForward,
  Trash2,
  Sparkles,
  SlidersHorizontal,
  RotateCcw,
  Eye,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface UpcomingStopEditorProps {
  onClose?: () => void;
}

export function UpcomingStopEditor({ onClose }: UpcomingStopEditorProps) {
  const {
    tripId,
    revision,
    stops: initialStops,
    requestReplanPreview,
    simulateRemoteRevisionIncrement,
  } = useTrip();

  // Working copy of stops in the editor session
  const [workingStops, setWorkingStops] = useState<TripStop[]>(initialStops);
  const [removedStops, setRemovedStops] = useState<TripStop[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [proposal, setProposal] = useState<ReplanProposal | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [commitMessage, setCommitMessage] = useState<string | null>(null);

  // Recommendations state
  const [recommendations, setRecommendations] = useState<ArtisanRecommendation[]>([]);
  const [isRecommendationsOpen, setIsRecommendationsOpen] = useState(true);

  // Historical stops (immutable) vs Upcoming stops
  // Historical stops are stops that were ALREADY visited or skipped when entering the editor
  const historicalStopIds = useMemo(() => {
    return new Set(
      initialStops
        .filter((s) => s.visit_status === "visited" || s.visit_status === "skipped")
        .map((s) => s.id)
    );
  }, [initialStops]);

  const historicalStops = useMemo(() => {
    return workingStops.filter((s) => historicalStopIds.has(s.id));
  }, [workingStops, historicalStopIds]);

  const upcomingStops = useMemo(() => {
    return workingStops.filter((s) => !historicalStopIds.has(s.id));
  }, [workingStops, historicalStopIds]);

  // Fetch recommendations for current trip
  useEffect(() => {
    let isMounted = true;
    const fetchRecommendations = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
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
        // Fallback handled below
      }

      // Offline / Demo Fallback recommendations
      if (isMounted) {
        const scheduledPlaces = new Set(workingStops.map((s) => s.place_id));
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
              "Master Kavita Kumhar: 5 min detour, ₹250 workshop fee, open until 7:30 PM, fits under your budget",
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
              "Babu Bhatt Puppeteer: 5 min detour, ₹200 workshop fee, open until 7 PM, fits under your budget",
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
              "Ramesh Chandra Parmar: 6 min detour, ₹0 entry (store visit), open until 8:30 PM, fits under your budget",
            latitude: 24.584,
            longitude: 73.6865,
            address: "Hathi Pole Bazaar, Udaipur",
            image_url:
              "https://images.pexels.com/photos/4427645/pexels-photo-4427645.jpeg?auto=compress&cs=tinysrgb&w=900",
            has_workshop: false,
          },
        ].filter((r) => !scheduledPlaces.has(r.place_id));

        setRecommendations(mockRecs);
      }
    };

    fetchRecommendations();
    return () => {
      isMounted = false;
    };
  }, [tripId, workingStops]);

  // Derive staged operations between initialStops and workingStops
  const stagedOperations = useMemo<ReplanOperation[]>(() => {
    const ops: ReplanOperation[] = [];
    const initialMap = new Map(initialStops.map((s) => [s.id, s]));

    // 1. Check for newly added stops
    for (let i = 0; i < workingStops.length; i++) {
      const stop = workingStops[i];
      if (!initialMap.has(stop.id)) {
        ops.push({
          type: "add_stop",
          place_id: stop.place_id,
          new_order: i + 1,
        });
      }
    }

    // 2. Check for skipped or pinned changes
    for (const stop of upcomingStops) {
      const orig = initialMap.get(stop.id);
      if (!orig) continue;

      if (orig.visit_status !== stop.visit_status) {
        if (stop.visit_status === "skipped") {
          ops.push({ type: "skip_stop", stop_id: stop.id });
        }
      }

      if (orig.is_pinned !== stop.is_pinned) {
        ops.push({
          type: "pin_stop",
          stop_id: stop.id,
          is_pinned: stop.is_pinned,
        });
      }
    }

    // 3. Check for removed stops
    for (const rem of removedStops) {
      ops.push({ type: "remove_stop", stop_id: rem.id });
    }

    // 4. Check for reordering in upcoming stops (when length matches)
    const initialUpcomingIds = initialStops
      .filter((s) => !historicalStopIds.has(s.id))
      .map((s) => s.id);
    const currentUpcomingIds = upcomingStops.map((s) => s.id);

    const isReordered =
      initialUpcomingIds.length === currentUpcomingIds.length &&
      initialUpcomingIds.some((id, idx) => id !== currentUpcomingIds[idx]);

    if (isReordered) {
      currentUpcomingIds.forEach((id, idx) => {
        ops.push({
          type: "reorder_stops",
          stop_id: id,
          new_order: idx + 1,
        });
      });
    }

    return ops;
  }, [initialStops, workingStops, upcomingStops, removedStops, historicalStopIds]);

  const hasModifications = stagedOperations.length > 0;

  // Actions on upcoming stops
  const handleMoveUp = (stopId: string) => {
    const idxInUpcoming = upcomingStops.findIndex((s) => s.id === stopId);
    if (idxInUpcoming <= 0) return; // Cannot move above historical or top upcoming

    const newUpcoming = [...upcomingStops];
    const temp = newUpcoming[idxInUpcoming];
    newUpcoming[idxInUpcoming] = newUpcoming[idxInUpcoming - 1];
    newUpcoming[idxInUpcoming - 1] = temp;

    setWorkingStops([...historicalStops, ...newUpcoming]);
  };

  const handleMoveDown = (stopId: string) => {
    const idxInUpcoming = upcomingStops.findIndex((s) => s.id === stopId);
    if (idxInUpcoming === -1 || idxInUpcoming >= upcomingStops.length - 1) return;

    const newUpcoming = [...upcomingStops];
    const temp = newUpcoming[idxInUpcoming];
    newUpcoming[idxInUpcoming] = newUpcoming[idxInUpcoming + 1];
    newUpcoming[idxInUpcoming + 1] = temp;

    setWorkingStops([...historicalStops, ...newUpcoming]);
  };

  const handleTogglePin = (stopId: string) => {
    setWorkingStops((prev) =>
      prev.map((s) => (s.id === stopId ? { ...s, is_pinned: !s.is_pinned } : s))
    );
  };

  const handleToggleSkip = (stopId: string) => {
    setWorkingStops((prev) =>
      prev.map((s) => {
        if (s.id !== stopId) return s;
        const nextStatus = s.visit_status === "skipped" ? "pending" : "skipped";
        return { ...s, visit_status: nextStatus };
      })
    );
  };

  const handleRemove = (stopId: string) => {
    const target = workingStops.find((s) => s.id === stopId);
    if (!target) return;

    setRemovedStops((prev) => [...prev, target]);
    setWorkingStops((prev) => prev.filter((s) => s.id !== stopId));
  };

  const handleAcceptRecommendation = (rec: ArtisanRecommendation) => {
    if (workingStops.some((s) => s.place_id === rec.place_id)) return;

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
      workingStops.length
    );
    const updated = [...workingStops];
    updated.splice(insertIdx, 0, newStop);

    const reindexed = updated.map((s, idx) => ({
      ...s,
      sequence_in_day: idx + 1,
    }));

    setWorkingStops(reindexed);
  };

  const handleDiscardAll = () => {
    setWorkingStops(initialStops);
    setRemovedStops([]);
    setCommitMessage(null);
  };

  const handleOpenPreview = async () => {
    setIsLoadingPreview(true);
    try {
      const prop = await requestReplanPreview(stagedOperations);
      setProposal(prop);
      setIsPreviewOpen(true);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleCommitSuccess = () => {
    setCommitMessage("Itinerary revision updated successfully! Changes committed.");
    setRemovedStops([]);
    setTimeout(() => {
      if (onClose) onClose();
    }, 1500);
  };

  return (
    <div className="space-y-4">
      {/* Editor Header Card */}
      <div className="p-4 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-neutral-900 text-white">
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </span>
            <div>
              <h3 className="text-xs font-bold text-neutral-900">
                Direct-Manipulation Stop Editor
              </h3>
              <p className="text-[10px] text-neutral-500">
                Reorder, pin, skip, or prune upcoming stops with revision locking.
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-neutral-100 text-neutral-700 border border-neutral-200">
            Rev {revision}
          </span>
        </div>

        {/* Success Banner */}
        {commitMessage && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{commitMessage}</span>
          </div>
        )}

        {/* Legend / Tip */}
        <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1 border-t border-neutral-100">
          <span className="flex items-center gap-1">
            <Lock className="w-3 h-3 text-neutral-400" /> Historical stops are immutable
          </span>
          {hasModifications ? (
            <span className="font-bold text-[#1E3A5F]">
              {stagedOperations.length} modification{stagedOperations.length > 1 ? "s" : ""} staged
            </span>
          ) : (
            <span className="text-neutral-400">No staged changes</span>
          )}
        </div>
      </div>

      {/* Historical Stops Section (Locked) */}
      {historicalStops.length > 0 && (
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1 px-1">
            <Lock className="w-3 h-3 text-neutral-400" />
            Completed / Visited Stops (Locked • Read-Only)
          </span>

          <div className="space-y-2 opacity-75">
            {historicalStops.map((stop, idx) => (
              <div
                key={stop.id}
                className="p-3 rounded-xl border border-neutral-200 bg-neutral-50 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-neutral-200/80 text-neutral-500">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-neutral-400">
                        Stop #{idx + 1}
                      </span>
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-neutral-200 text-neutral-600">
                        {stop.visit_status === "visited" ? "Visited" : "Skipped"}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-neutral-700">{stop.name}</h4>
                  </div>
                </div>

                <span className="text-[10px] font-semibold text-neutral-400 italic">
                  Immutable historical record
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Artisan Studios (Within 15 Min Detour Buffer) */}
      {recommendations.length > 0 && (
        <div className="rounded-2xl border border-[#E8E4DC] bg-[#FBF9F5] overflow-hidden shadow-2xs">
          <button
            type="button"
            onClick={() => setIsRecommendationsOpen((prev) => !prev)}
            className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-[#191C1E] hover:bg-[#F4EFEA] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#1E3A5F]" />
              <span>
                Nearby Artisan Workshops ({recommendations.length} within 15m detour)
              </span>
            </span>
            {isRecommendationsOpen ? (
              <ChevronUp className="w-4 h-4 text-[#7A746B]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#7A746B]" />
            )}
          </button>

          {isRecommendationsOpen && (
            <div className="px-3.5 pb-3.5 pt-1 space-y-2.5 border-t border-[#E8E4DC]">
              <p className="text-[11px] text-[#7A746B] leading-relaxed">
                Add verified Udaipur craftsmen into your itinerary with transparent detour impact:
              </p>
              <div className="space-y-2">
                {recommendations.map((rec) => (
                  <ArtisanRecommendationCard
                    key={rec.place_id}
                    recommendation={rec}
                    onAccept={handleAcceptRecommendation}
                    isStaged={workingStops.some((s) => s.place_id === rec.place_id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upcoming Stops Section (Editable) */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold text-[#7A746B] uppercase tracking-wider flex items-center gap-1 px-1">
          <Sparkles className="w-3 h-3 text-[#1E3A5F]" />
          Upcoming Itinerary Stops (Direct Manipulation)
        </span>

        {upcomingStops.length === 0 ? (
          <div className="p-6 rounded-2xl bg-neutral-50 border border-dashed border-neutral-300 text-center space-y-1">
            <p className="text-xs font-bold text-neutral-700">No upcoming stops left</p>
            <p className="text-[11px] text-neutral-500">
              All upcoming stops have been removed or visited.
            </p>
            {removedStops.length > 0 && (
              <button
                onClick={handleDiscardAll}
                className="mt-2 text-xs font-bold text-[#1E3A5F] hover:underline cursor-pointer"
              >
                Restore removed stops
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {upcomingStops.map((stop, idx) => {
              const isFirstUpcoming = idx === 0;
              const isLastUpcoming = idx === upcomingStops.length - 1;
              const isSkippedInEditor = stop.visit_status === "skipped";

              return (
                <div
                  key={stop.id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isSkippedInEditor
                      ? "border-stone-300 bg-[#FBF9F5]"
                      : stop.is_pinned
                      ? "border-[#1E3A5F]/40 bg-white shadow-2xs"
                      : "border-neutral-200 bg-white shadow-2xs hover:border-neutral-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    {/* Stop Info */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold text-neutral-400">
                          Stop #{historicalStops.length + idx + 1}
                        </span>

                        <span className="text-[10px] font-semibold text-neutral-500 capitalize">
                          {stop.category}
                        </span>

                        {stop.is_pinned && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-[#1E3A5F]/10 text-[#1E3A5F] border border-[#1E3A5F]/20 flex items-center gap-0.5">
                            <Pin className="w-2.5 h-2.5" /> Pinned
                          </span>
                        )}

                        {isSkippedInEditor && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-stone-100 text-stone-700 border border-stone-300 flex items-center gap-0.5">
                            <SkipForward className="w-2.5 h-2.5" /> Skipped (Audit Kept)
                          </span>
                        )}
                      </div>

                      <h4
                        className={`text-xs font-extrabold ${
                          isSkippedInEditor ? "text-neutral-500 line-through" : "text-neutral-900"
                        }`}
                      >
                        {stop.name}
                      </h4>

                      <div className="flex items-center gap-3 text-[11px] text-neutral-500">
                        <span>{stop.suggested_duration_minutes}m visit</span>
                        <span>•</span>
                        <span>{stop.entry_fee_inr > 0 ? `₹${stop.entry_fee_inr}` : "Free Entry"}</span>
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Move Up */}
                      <button
                        onClick={() => handleMoveUp(stop.id)}
                        disabled={isFirstUpcoming}
                        title="Move Earlier in Route"
                        className="p-1.5 rounded-lg border border-neutral-200 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors disabled:opacity-25 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>

                      {/* Move Down */}
                      <button
                        onClick={() => handleMoveDown(stop.id)}
                        disabled={isLastUpcoming}
                        title="Move Later in Route"
                        className="p-1.5 rounded-lg border border-neutral-200 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors disabled:opacity-25 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>

                      {/* Pin Toggle */}
                      <button
                        onClick={() => handleTogglePin(stop.id)}
                        title={stop.is_pinned ? "Unpin Stop" : "Pin Must-Visit Stop"}
                        className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                          stop.is_pinned
                            ? "bg-[#1E3A5F]/10 text-[#1E3A5F] border-[#1E3A5F]/30"
                            : "border-neutral-200 text-neutral-400 hover:text-[#1E3A5F] hover:bg-[#1E3A5F]/5"
                        }`}
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </button>

                      {/* Skip Toggle */}
                      <button
                        onClick={() => handleToggleSkip(stop.id)}
                        title={isSkippedInEditor ? "Unskip Stop" : "Skip Stop (Keep Audit)"}
                        className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                          isSkippedInEditor
                            ? "bg-[#1E3A5F] text-white border-[#1E3A5F]"
                            : "border-neutral-200 text-neutral-400 hover:text-[#1E3A5F] hover:bg-[#1E3A5F]/5"
                        }`}
                      >
                        <SkipForward className="w-3.5 h-3.5" />
                      </button>

                      {/* Remove */}
                      <button
                        onClick={() => handleRemove(stop.id)}
                        title="Prune / Delete Stop from Trip"
                        className="p-1.5 rounded-lg border border-neutral-200 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Editor Action Bar */}
      <div className="p-4 rounded-2xl bg-white border border-[#E8E4DC] shadow-sm flex items-center justify-between gap-3 sticky bottom-2">
        <button
          onClick={handleDiscardAll}
          disabled={!hasModifications}
          className="flex items-center gap-1.5 py-2.5 px-3 rounded-xl border border-neutral-200 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Discard</span>
        </button>

        <button
          onClick={handleOpenPreview}
          disabled={!hasModifications || isLoadingPreview}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-[#1E3A5F] hover:bg-[#152943] text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>
            {isLoadingPreview
              ? "Evaluating Feasibility..."
              : `Preview Changes (${stagedOperations.length})`}
          </span>
        </button>
      </div>

      {/* Concurrency Simulator Testing Pill */}
      <div className="p-3 rounded-xl bg-neutral-100/70 border border-neutral-200/60 flex items-center justify-between text-xs text-neutral-500">
        <span className="text-[10px]">
          Demo Test Tool: Test Revision-Locking (HTTP 409)
        </span>
        <button
          onClick={simulateRemoteRevisionIncrement}
          className="text-[10px] font-extrabold text-neutral-700 bg-white border border-neutral-200 px-2 py-0.5 rounded-md hover:bg-neutral-50 cursor-pointer"
        >
          Simulate Remote Edit (Rev {revision} ➔ {revision + 1})
        </button>
      </div>

      {/* Replan Preview Confirmation Modal */}
      <ReplanPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        proposal={proposal}
        workingStops={workingStops}
        onCommitSuccess={handleCommitSuccess}
      />
    </div>
  );
}
