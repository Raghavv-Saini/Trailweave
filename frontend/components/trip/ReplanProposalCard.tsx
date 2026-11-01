"use client";

import React, { useState } from "react";
import { CheckCircle2, Clock, AlertTriangle, ArrowRight, Sparkles, Check, RefreshCw } from "lucide-react";
import { useTrip, TripStop } from "@/context/TripContext";

export interface ReplanProposalData {
  proposal_id: string;
  base_revision: number;
  is_feasible: boolean;
  validation_diff: {
    cost_delta_inr: number;
    duration_delta_minutes: number;
    stops_added: string[];
    stops_skipped: string[];
    stops_removed?: string[];
    closing_hour_conflicts?: string[];
    travel_mode_changed?: string[];
    durations_updated?: string[];
    rescheduled_stops?: string[];
    budget_updated_inr?: number | null;
  };
  candidate_stops?: Array<Record<string, unknown>>;
  expires_at?: string;
  committed?: boolean;
  new_revision?: number;
}

interface ReplanProposalCardProps {
  proposal: ReplanProposalData;
  onAccepted?: (newRevision: number) => void;
}

export function ReplanProposalCard({ proposal, onAccepted }: ReplanProposalCardProps) {
  const { revision, commitReplan, refreshTrip, stops } = useTrip();
  const [isCommitting, setIsCommitting] = useState(false);
  const [isAccepted, setIsAccepted] = useState(Boolean(proposal.committed));
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  const diff = proposal.validation_diff;
  const costDelta = diff.cost_delta_inr || 0;
  const durationDelta = diff.duration_delta_minutes || 0;
  const stopsAdded = diff.stops_added || [];
  const stopsSkipped = diff.stops_skipped || [];
  const stopsRemoved = diff.stops_removed || [];
  const travelModeChanged = diff.travel_mode_changed || [];
  const durationsUpdated = diff.durations_updated || [];
  const rescheduledStops = diff.rescheduled_stops || [];
  const budgetUpdatedInr = diff.budget_updated_inr;

  const handleAccept = async () => {
    setIsCommitting(true);
    setConflictMessage(null);

    // Prepare candidate stops if available, or fall back to current stops
    const finalStops: TripStop[] = (proposal.candidate_stops?.length
      ? proposal.candidate_stops.map((s) => ({
          id: String(s.id || ""),
          place_id: String(s.place_id || ""),
          name: String(s.name || s.place_id || "Stop"),
          address: String(s.address || "Udaipur"),
          latitude: Number(s.latitude || 24.5854),
          longitude: Number(s.longitude || 73.6812),
          category: String(s.category || "heritage"),
          entry_fee_inr: Number(s.entry_fee_inr || 0),
          image_url: String(s.image_url || ""),
          day_number: Number(s.day_number || 1),
          sequence_in_day: Number(s.sequence_in_day || 1),
          planned_arrival: typeof s.planned_arrival === "string" ? s.planned_arrival : undefined,
          planned_departure: typeof s.planned_departure === "string" ? s.planned_departure : undefined,
          suggested_duration_minutes: Number(s.suggested_duration_minutes || 45),
          transit_minutes_from_prev:
            typeof s.transit_minutes_from_prev === "number"
              ? s.transit_minutes_from_prev
              : 15,
          actual_duration_minutes: typeof s.actual_duration_minutes === "number" ? s.actual_duration_minutes : null,
          visit_status: (s.visit_status as TripStop["visit_status"]) || "pending",
          is_pinned: Boolean(s.is_pinned),
        }))
      : stops) as TripStop[];

    try {
      const result = await commitReplan(
        proposal.proposal_id,
        proposal.base_revision,
        finalStops
      );

      if (result.success) {
        setIsAccepted(true);
        if (result.new_revision && onAccepted) {
          onAccepted(result.new_revision);
        }
      } else if (result.isConflict) {
        setConflictMessage(
          result.message ||
            `Revision mismatch: Proposed against Rev ${proposal.base_revision}, but current is Rev ${revision}.`
        );
      } else {
        setConflictMessage(result.error || "Failed to commit itinerary proposal.");
      }
    } catch {
      setConflictMessage("Network error accepting proposal.");
    } finally {
      setIsCommitting(false);
    }
  };

  const handleRefresh = async () => {
    setConflictMessage(null);
    await refreshTrip();
  };

  return (
    <div className="mt-2.5 p-3.5 rounded-2xl bg-[#FBF9F5] border border-[#E8E4DC] shadow-xs text-[#191C1E] space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#1E3A5F]" />
          <span className="text-xs font-bold text-[#191C1E]">
            Itinerary Proposal (Rev {proposal.base_revision} → {proposal.base_revision + 1})
          </span>
        </div>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            proposal.is_feasible
              ? "bg-emerald-100 text-emerald-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {proposal.is_feasible ? "Feasible Route" : "Review Warnings"}
        </span>
      </div>

      {/* Diff metrics */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5 p-2 rounded-xl bg-white border border-[#E8E4DC]">
          <Clock className="w-3.5 h-3.5 text-neutral-500" />
          <span className="text-neutral-600">Time:</span>
          <span
            className={`font-extrabold ${
              durationDelta < 0
                ? "text-emerald-700"
                : durationDelta > 0
                ? "text-[#1E3A5F]"
                : "text-neutral-700"
            }`}
          >
            {durationDelta > 0 ? `+${durationDelta}m` : `${durationDelta}m`}
          </span>
        </div>

        <div className="flex items-center gap-1.5 p-2 rounded-xl bg-white border border-[#E8E4DC]">
          <span className="text-neutral-500 text-xs font-bold">₹</span>
          <span className="text-neutral-600">Cost:</span>
          <span
            className={`font-extrabold ${
              costDelta < 0
                ? "text-emerald-700"
                : costDelta > 0
                ? "text-[#1E3A5F]"
                : "text-neutral-700"
            }`}
          >
            {costDelta > 0 ? `+₹${costDelta}` : costDelta < 0 ? `-₹${Math.abs(costDelta)}` : "₹0"}
          </span>
        </div>
      </div>

      {/* Changes list */}
      <div className="space-y-1 text-[11px]">
        {stopsSkipped.length > 0 && (
          <div className="flex items-center gap-1.5 text-neutral-600">
            <span className="px-1.5 py-0.5 rounded-md bg-neutral-200/80 text-neutral-700 font-semibold text-[10px]">
              Skip
            </span>
            <span>{stopsSkipped.length} stop(s) marked planned-but-skipped</span>
          </div>
        )}

        {stopsAdded.length > 0 && (
          <div className="flex items-center gap-1.5 text-emerald-800 font-medium">
            <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-semibold text-[10px]">
              Add
            </span>
            <span>Added {stopsAdded.length} new venue/studio</span>
          </div>
        )}

        {stopsRemoved.length > 0 && (
          <div className="flex items-center gap-1.5 text-neutral-500">
            <span className="px-1.5 py-0.5 rounded-md bg-red-100 text-red-700 font-semibold text-[10px]">
              Remove
            </span>
            <span>Removed {stopsRemoved.length} stop(s)</span>
          </div>
        )}

        {travelModeChanged.length > 0 && (
          <div className="flex items-center gap-1.5 text-[#1E3A5F] font-medium">
            <span className="px-1.5 py-0.5 rounded-md bg-[#1E3A5F]/10 text-[#1E3A5F] font-semibold text-[10px]">
              Transit
            </span>
            <span>{travelModeChanged.join(", ")}</span>
          </div>
        )}

        {durationsUpdated.length > 0 && (
          <div className="flex items-center gap-1.5 text-amber-800 font-medium">
            <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 font-semibold text-[10px]">
              Duration
            </span>
            <span>{durationsUpdated.join(", ")}</span>
          </div>
        )}

        {rescheduledStops.length > 0 && (
          <div className="flex items-center gap-1.5 text-indigo-800 font-medium">
            <span className="px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-semibold text-[10px]">
              Schedule
            </span>
            <span>{rescheduledStops.join(", ")}</span>
          </div>
        )}

        {budgetUpdatedInr !== undefined && budgetUpdatedInr !== null && (
          <div className="flex items-center gap-1.5 text-emerald-800 font-medium">
            <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-semibold text-[10px]">
              Budget
            </span>
            <span>Updated total budget to ₹{budgetUpdatedInr}</span>
          </div>
        )}
      </div>

      {/* Conflict error warning */}
      {conflictMessage && (
        <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-[11px] space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Revision Conflict (HTTP 409)</span>
          </div>
          <p>{conflictMessage}</p>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-800 text-white font-bold text-[10px] hover:bg-red-900 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Refresh Active Itinerary</span>
          </button>
        </div>
      )}

      {/* Action button */}
      {isAccepted ? (
        <div className="w-full py-2 px-3 rounded-xl bg-emerald-600 text-white flex items-center justify-center gap-1.5 text-xs font-bold shadow-xs">
          <Check className="w-4 h-4" />
          <span>✓ Revision {proposal.base_revision + 1} Applied!</span>
        </div>
      ) : (
        <button
          onClick={handleAccept}
          disabled={isCommitting}
          className="w-full py-2.5 px-3 rounded-xl bg-[#1E3A5F] hover:bg-[#152943] text-white flex items-center justify-center gap-1.5 text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
        >
          {isCommitting ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Committing Revision N+1...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>1-Tap Accept & Update Route</span>
              <ArrowRight className="w-3 h-3 ml-0.5" />
            </>
          )}
        </button>
      )}
    </div>
  );
}

