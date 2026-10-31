"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  X,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Eye,
  EyeOff,
  Home,
  Clock,
  IndianRupee,
  MapPin,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Tag,
  Share2,
  Check,
} from "lucide-react";
import { TripStop } from "@/context/TripContext";
import { MockTrail, MockTrailStop, addPublishedTrail } from "@/lib/mockData";
import { TrailCard } from "@/components/discovery/TrailCard";

interface TripToTrailModalProps {
  isOpen: boolean;
  tripId: string;
  stops: TripStop[];
  onClose: () => void;
  onTripCompleted?: () => void;
  onConfirmVisited?: (stopIds: string[]) => Promise<void>;
}

type PublishStep = "checklist" | "ai_draft" | "privacy" | "success";

const AVAILABLE_TAGS = ["heritage", "artisan", "walking", "food", "lake", "photography", "temples"];
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function TripToTrailModal({
  isOpen,
  tripId,
  stops,
  onClose,
  onTripCompleted,
  onConfirmVisited,
}: TripToTrailModalProps) {
  const [step, setStep] = useState<PublishStep>("checklist");

  // Step 1: Checklist state
  const [selectedStopIds, setSelectedStopIds] = useState<Set<string>>(new Set());
  const [excludeStartAccommodation, setExcludeStartAccommodation] = useState(true);

  // Step 2: AI Draft state
  const [isDrafting, setIsDrafting] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>(["heritage", "walking"]);
  const [estimatedBudget, setEstimatedBudget] = useState(0);
  const [totalDurationHours, setTotalDurationHours] = useState(3.5);

  // Step 3: Privacy & Publishing state
  const [excludePrivateNotes, setExcludePrivateNotes] = useState(true);
  const [visibility, setVisibility] = useState<"public" | "unlisted">("public");
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedTrail, setPublishedTrail] = useState<MockTrail | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Detect potential start location or accommodation
  const firstStop = stops[0];
  const isFirstStopAccommodation = useMemo(() => {
    if (!firstStop) return false;
    const cat = firstStop.category?.toLowerCase() || "";
    const name = firstStop.name.toLowerCase();
    return (
      cat.includes("accommodation") ||
      cat.includes("hotel") ||
      cat.includes("lodging") ||
      name.includes("hotel") ||
      name.includes("haveli stay") ||
      name.includes("homestay")
    );
  }, [firstStop]);

  // Pre-populate confirmed visited stops on modal open
  useEffect(() => {
    if (isOpen) {
      setStep("checklist");
      setPublishError(null);

      // Pre-select stops marked as 'visited'
      const visited = new Set<string>();
      stops.forEach((s, idx) => {
        // If it's a private accommodation start location and toggle is on, skip it
        if (idx === 0 && isFirstStopAccommodation && excludeStartAccommodation) {
          return;
        }
        if (s.visit_status === "visited") {
          visited.add(s.id);
        }
      });

      // If no stops were marked visited yet, default to all non-accommodation stops
      if (visited.size === 0) {
        stops.forEach((s, idx) => {
          if (idx === 0 && isFirstStopAccommodation && excludeStartAccommodation) {
            return;
          }
          if (s.visit_status !== "skipped") {
            visited.add(s.id);
          }
        });
      }

      setSelectedStopIds(visited);
    }
  }, [isOpen, stops, isFirstStopAccommodation, excludeStartAccommodation]);

  if (!isOpen) return null;

  const toggleStopSelection = (stopId: string) => {
    setSelectedStopIds((prev) => {
      const next = new Set(prev);
      if (next.has(stopId)) {
        next.delete(stopId);
      } else {
        next.add(stopId);
      }
      return next;
    });
  };

  // Step 1 -> Step 2: Trigger AI Draft Generation
  const handleProceedToDraft = async () => {
    if (selectedStopIds.size === 0) return;

    setIsDrafting(true);
    setStep("ai_draft");

    const selectedStops = stops.filter((s) => selectedStopIds.has(s.id));
    const budgetSum = selectedStops.reduce((sum, s) => sum + (s.entry_fee_inr || 0), 0);
    const durationSum = selectedStops.reduce((sum, s) => sum + (s.suggested_duration_minutes || 45), 0);
    const hours = Math.round((durationSum / 60) * 10) / 10;

    setEstimatedBudget(budgetSum);
    setTotalDurationHours(Math.max(hours, 1.0));

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/trips/${tripId}/draft-trail-content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          include_stop_ids: Array.from(selectedStopIds),
          vibe_hint: "authentic heritage & local artisan walk",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setTitle(data.title);
        setDescription(data.description);
        if (data.tags && Array.isArray(data.tags)) {
          setTags(data.tags);
        }
        if (data.estimated_budget_inr) {
          setEstimatedBudget(data.estimated_budget_inr);
        }
        if (data.total_duration_hours) {
          setTotalDurationHours(data.total_duration_hours);
        }
      } else {
        throw new Error("Backend draft API unavailable");
      }
    } catch {
      // Deterministic offline fallback
      const names = selectedStops.map((s) => s.name);
      const hasArtisan = selectedStops.some((s) => s.category === "artisan_studio");
      const hasHeritage = selectedStops.some((s) => s.category === "heritage");
      const hasFood = selectedStops.some((s) => s.category === "dining");

      const derivedTags: string[] = [];
      if (hasHeritage) derivedTags.push("heritage");
      if (hasArtisan) derivedTags.push("artisan");
      if (hasFood) derivedTags.push("food");
      derivedTags.push("walking");

      let fallbackTitle = "Udaipur Heritage & Artisan Walk";
      if (names.length >= 2) {
        fallbackTitle = `${names[0]} to ${names[names.length - 1]} Discovery Walk`;
      } else if (names.length === 1) {
        fallbackTitle = `Exploring ${names[0]} & Old City`;
      }

      setTitle(fallbackTitle);
      setDescription(
        `An authentic traveler-completed journey through Udaipur's Old City. Highlights include exploring ${names.join(
          ", "
        )}. Recommended for travelers seeking genuine local experiences, rich cultural history, and direct artisan craft connections.`
      );
      setTags(derivedTags.slice(0, 4));
    } finally {
      setIsDrafting(false);
    }
  };

  const toggleTag = (t: string) => {
    setTags((prev) =>
      prev.includes(t) ? prev.filter((item) => item !== t) : [...prev, t]
    );
  };

  // Step 3 -> Step 4: Submit Publishing
  const handlePublishTrail = async () => {
    setIsPublishing(true);
    setPublishError(null);

    // If any unvisited stop was checked by tourist on checklist, confirm it visited
    if (onConfirmVisited) {
      const unvisitedSelected = stops
        .filter((s) => selectedStopIds.has(s.id) && s.visit_status !== "visited")
        .map((s) => s.id);
      if (unvisitedSelected.length > 0) {
        try {
          await onConfirmVisited(unvisitedSelected);
        } catch {
          // Continue publishing
        }
      }
    }

    const selectedStops = stops.filter((s) => selectedStopIds.has(s.id));
    const payload = {
      title,
      description,
      include_stop_ids: Array.from(selectedStopIds),
      exclude_private_notes: excludePrivateNotes,
      tags,
      visibility,
    };

    let newTrail: MockTrail;

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/trips/${tripId}/publish-trail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        newTrail = {
          id: data.id,
          title: data.title,
          author_name: data.author_name || "Fellow Traveler",
          description: data.description,
          duration_type: data.duration_type || "single_day",
          total_duration_hours: data.total_duration_hours || totalDurationHours,
          estimated_cost_inr: data.estimated_cost_inr || estimatedBudget,
          tags: data.tags || tags,
          is_experienced: true,
          is_featured: false,
          stops_count: data.stops_count || selectedStops.length,
          stops: (data.stops || []).map(
            (
              s: {
                id: string;
                place_id: string;
                place_name: string;
                day_number?: number;
                sequence_in_day?: number;
                suggested_duration_minutes: number;
                estimated_transit_minutes?: number;
                time_slot?: string;
                traveler_tip: string;
              },
              idx: number
            ) => ({
              id: s.id,
              place_id: s.place_id,
              place_name: s.place_name,
              day_number: s.day_number || 1,
              sequence_in_day: s.sequence_in_day || idx + 1,
              suggested_duration_minutes: s.suggested_duration_minutes,
              estimated_transit_minutes: s.estimated_transit_minutes || 15,
              time_slot: s.time_slot || "morning",
              traveler_tip: s.traveler_tip,
            })
          ),
        };
      } else {
        throw new Error("Backend publishing failed, falling back to client-side persistence");
      }
    } catch {
      // Local fallback representation conforming 100% to API_SPEC and MockTrail
      const clientStops: MockTrailStop[] = selectedStops.map((s, idx) => ({
        id: `cts_published_${Date.now()}_${idx + 1}`,
        place_id: s.place_id,
        place_name: s.name,
        day_number: s.day_number || 1,
        sequence_in_day: idx + 1,
        suggested_duration_minutes: s.suggested_duration_minutes || 45,
        estimated_transit_minutes: 15,
        time_slot: idx === 0 ? "morning" : idx === 1 ? "afternoon" : "sunset_evening",
        traveler_tip: `Verified stop: ${s.name}. Recommended duration ${s.suggested_duration_minutes}m.`,
      }));

      newTrail = {
        id: `trail_${Date.now()}`,
        title,
        author_name: "Fellow Traveler",
        description,
        duration_type: selectedStops.length > 5 ? "multi_day" : "single_day",
        total_duration_hours: totalDurationHours,
        estimated_cost_inr: estimatedBudget,
        tags,
        is_experienced: true,
        is_featured: false,
        stops_count: selectedStops.length,
        stops: clientStops,
      };
    }

    // Instantly inject into Community Trails dataset
    addPublishedTrail(newTrail);
    setPublishedTrail(newTrail);
    setIsPublishing(false);
    setStep("success");

    if (onTripCompleted) {
      onTripCompleted();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#E8E4DC] flex items-center justify-between bg-[#FBF9F5]">
          <div className="space-y-0.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#1E3A5F]/10 text-[#1E3A5F] border border-[#1E3A5F]/20 text-[10px] font-bold">
              <Sparkles className="w-3 h-3" />
              <span>Trip-to-Trail Contribution</span>
            </div>
            <h2 className="font-serif text-lg font-medium text-[#191C1E]">
              {step === "checklist" && "Confirm Visited Stops"}
              {step === "ai_draft" && "AI Storyteller Draft"}
              {step === "privacy" && "Privacy Review & Controls"}
              {step === "success" && "Trail Published to Community!"}
            </h2>
          </div>
          {step !== "success" && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-neutral-200 text-neutral-400 hover:text-neutral-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* STEP 1: CHECKLIST OF VISITED VS SKIPPED STOPS */}
          {step === "checklist" && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-[#FBF9F5] border border-[#E8E4DC] text-xs text-[#191C1E] space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#1E3A5F]" />
                  Select which places to include in your public trail
                </p>
                <p className="text-[11px] text-[#7A746B] leading-relaxed">
                  Stops you checked in to are pre-selected. Private hotels and unvisited places are excluded to keep the community itinerary clean.
                </p>
              </div>

              {/* Start Accommodation Exclusion Toggle */}
              {isFirstStopAccommodation && (
                <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Home className="w-4 h-4 text-neutral-500 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-neutral-800">
                        Exclude starting accommodation
                      </p>
                      <p className="text-[10px] text-neutral-500">
                        {firstStop.name} (keeps your private hotel/homestay address private)
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={excludeStartAccommodation}
                    onChange={(e) => {
                      setExcludeStartAccommodation(e.target.checked);
                      if (e.target.checked) {
                        setSelectedStopIds((prev) => {
                          const next = new Set(prev);
                          next.delete(firstStop.id);
                          return next;
                        });
                      }
                    }}
                    className="w-4 h-4 accent-[#1E3A5F] rounded cursor-pointer"
                  />
                </div>
              )}

              {/* Stops Checklist */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Planned Itinerary Stops ({selectedStopIds.size}/{stops.length} selected)
                </h4>
                <div className="space-y-2">
                  {stops.map((stop, index) => {
                    const isSelected = selectedStopIds.has(stop.id);
                    const isAccommodation =
                      index === 0 && isFirstStopAccommodation;

                    return (
                      <div
                        key={stop.id}
                        onClick={() => toggleStopSelection(stop.id)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? "bg-[#1E3A5F]/5 border-[#1E3A5F] shadow-2xs"
                            : "bg-white border-neutral-200 hover:border-neutral-300 opacity-75"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // handled by parent div
                            className="w-4 h-4 accent-[#1E3A5F] rounded shrink-0 cursor-pointer"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-neutral-900 truncate">
                                {stop.name}
                              </span>
                              {stop.visit_status === "visited" && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                                  Visited
                                </span>
                              )}
                              {stop.visit_status === "skipped" && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-600">
                                  Skipped
                                </span>
                              )}
                              {isAccommodation && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-800">
                                  Private Start
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-neutral-500 flex items-center gap-2 mt-0.5">
                              <span>{stop.suggested_duration_minutes}m duration</span>
                              <span>•</span>
                              <span>
                                {stop.entry_fee_inr === 0
                                  ? "Free entry"
                                  : `₹${stop.entry_fee_inr}`}
                              </span>
                            </p>
                          </div>
                        </div>

                        <span
                          className={`text-xs font-bold px-2 py-1 rounded-lg shrink-0 ${
                            isSelected
                              ? "bg-[#1E3A5F]/10 text-[#1E3A5F]"
                              : "bg-neutral-100 text-neutral-400"
                          }`}
                        >
                          {isSelected ? "Include" : "Omit"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: AI DRAFT GENERATION */}
          {step === "ai_draft" && (
            <div className="space-y-4">
              {isDrafting ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-3 text-center">
                  <Loader2 className="w-8 h-8 text-[#1E3A5F] animate-spin" />
                  <p className="text-sm font-bold text-neutral-800">
                    Gemini Flash is drafting your community trail...
                  </p>
                  <p className="text-xs text-neutral-500 max-w-xs">
                    Synthesizing visited heritage monuments, miniature art studios, and relative pacing into a shareable itinerary.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Trail Title */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#1E3A5F]" />
                      <span>Trail Title</span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm font-bold text-neutral-900 focus:outline-hidden focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F]"
                    />
                  </div>

                  {/* Narrative Description */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-neutral-700">
                      Community Overview &amp; Traveler Tips
                    </label>
                    <textarea
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs text-neutral-800 leading-relaxed focus:outline-hidden focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F]"
                    />
                  </div>

                  {/* Tags */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-700 flex items-center gap-1">
                      <Tag className="w-3 h-3 text-neutral-400" />
                      <span>Interest Tags</span>
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {AVAILABLE_TAGS.map((t) => {
                        const active = tags.includes(t);
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => toggleTag(t)}
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize transition-colors ${
                              active
                                ? "bg-neutral-900 text-white shadow-2xs"
                                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                            }`}
                          >
                            #{t}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Key Metrics Summary */}
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-center">
                      <Clock className="w-3.5 h-3.5 text-neutral-400 mx-auto mb-1" />
                      <p className="text-xs font-extrabold text-neutral-900">
                        {totalDurationHours}h
                      </p>
                      <p className="text-[10px] text-neutral-500">Duration</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-center">
                      <MapPin className="w-3.5 h-3.5 text-neutral-400 mx-auto mb-1" />
                      <p className="text-xs font-extrabold text-neutral-900">
                        {selectedStopIds.size} Stops
                      </p>
                      <p className="text-[10px] text-neutral-500">Verified</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-center">
                      <IndianRupee className="w-3.5 h-3.5 text-neutral-400 mx-auto mb-1" />
                      <p className="text-xs font-extrabold text-neutral-900">
                        ₹{estimatedBudget}
                      </p>
                      <p className="text-[10px] text-neutral-500">Est. Cost</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: PRIVACY REVIEW & CONTROLS */}
          {step === "privacy" && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  Privacy-First Publishing Guarantee
                </p>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  TrailWeave never publishes your continuous GPS tracks or live timestamps. Stops are published with relative visit pacing so any future traveler can experience Udaipur safely.
                </p>
              </div>

              {/* Privacy Toggles */}
              <div className="space-y-2.5">
                <label className="flex items-start gap-3 p-3 rounded-xl border border-neutral-200 hover:bg-neutral-50/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={excludePrivateNotes}
                    onChange={(e) => setExcludePrivateNotes(e.target.checked)}
                    className="w-4 h-4 accent-[#1E3A5F] rounded mt-0.5 cursor-pointer"
                  />
                  <div>
                    <p className="text-xs font-bold text-neutral-800">
                      Scrub private traveler notes &amp; personal memos
                    </p>
                    <p className="text-[10px] text-neutral-500 leading-relaxed">
                      Removes any private booking numbers, room details, or private comments from public trail stops (`exclude_private_notes: true`).
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-xl border border-neutral-200 hover:bg-neutral-50/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={excludeStartAccommodation}
                    onChange={(e) => setExcludeStartAccommodation(e.target.checked)}
                    className="w-4 h-4 accent-[#1E3A5F] rounded mt-0.5 cursor-pointer"
                  />
                  <div>
                    <p className="text-xs font-bold text-neutral-800">
                      Exclude private accommodation &amp; departure address
                    </p>
                    <p className="text-[10px] text-neutral-500 leading-relaxed">
                      Ensures your private hotel or homestay starting coordinate is omitted from the community route.
                    </p>
                  </div>
                </label>
              </div>

              {/* Visibility Choice */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-bold text-neutral-700">
                  Publication Visibility
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVisibility("public")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      visibility === "public"
                        ? "border-[#1E3A5F] bg-[#1E3A5F]/5"
                        : "border-neutral-200 hover:bg-neutral-50"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-neutral-900">
                      <Eye className="w-3.5 h-3.5 text-[#1E3A5F]" />
                      <span>Public</span>
                    </div>
                    <p className="text-[10px] text-neutral-500 mt-1">
                      Featured in Udaipur Community Explorer for all tourists.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVisibility("unlisted")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      visibility === "unlisted"
                        ? "border-[#1E3A5F] bg-[#1E3A5F]/5"
                        : "border-neutral-200 hover:bg-neutral-50"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-neutral-900">
                      <EyeOff className="w-3.5 h-3.5 text-neutral-600" />
                      <span>Unlisted</span>
                    </div>
                    <p className="text-[10px] text-neutral-500 mt-1">
                      Shareable via direct link only; not in public search.
                    </p>
                  </button>
                </div>
              </div>

              {publishError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                  {publishError}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: SUCCESS */}
          {step === "success" && publishedTrail && (
            <div className="space-y-4">
              <div className="text-center space-y-1 py-1">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <h3 className="text-base font-extrabold text-neutral-900">
                  Your Udaipur Journey is Live!
                </h3>
                <p className="text-xs text-neutral-600">
                  Fellow travelers can now explore your route, pick individual stops into their basket, or adopt it as a base itinerary.
                </p>
              </div>

              {/* Render live TrailCard component with "Experienced Trail" badge */}
              <div className="pt-1">
                <TrailCard trail={publishedTrail} />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-5 py-3.5 border-t border-neutral-100 flex items-center justify-between bg-neutral-50/70">
          {step === "checklist" && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 hover:bg-neutral-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={selectedStopIds.size === 0}
                onClick={handleProceedToDraft}
                className="px-4 py-2 rounded-xl bg-[#1E3A5F] hover:bg-[#152943] text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                <span>Continue to AI Storyteller</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {step === "ai_draft" && !isDrafting && (
            <>
              <button
                type="button"
                onClick={() => setStep("checklist")}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-neutral-600 hover:bg-neutral-200 flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={() => setStep("privacy")}
                className="px-4 py-2 rounded-xl bg-[#1E3A5F] hover:bg-[#152943] text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <span>Review Privacy &amp; Publish</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {step === "privacy" && (
            <>
              <button
                type="button"
                onClick={() => setStep("ai_draft")}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-neutral-600 hover:bg-neutral-200 flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <button
                type="button"
                disabled={isPublishing}
                onClick={handlePublishTrail}
                className="px-5 py-2 rounded-xl bg-[#1E3A5F] hover:bg-[#152943] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Publishing...</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Publish Community Trail</span>
                  </>
                )}
              </button>
            </>
          )}

          {step === "success" && (
            <div className="w-full flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-neutral-300 text-xs font-bold text-neutral-700 hover:bg-neutral-100 cursor-pointer"
              >
                Done
              </button>
              <Link
                href="/trails"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-[#1E3A5F] hover:bg-[#152943] text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs"
              >
                <span>View in Community Explorer</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
