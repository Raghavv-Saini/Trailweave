"use client";

import React, { useState } from "react";
import {
  ReplanProposal,
  TripStop,
  useTrip,
} from "@/context/TripContext";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Coins,
  ArrowRight,
  ShieldAlert,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";

interface ReplanPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposal: ReplanProposal | null;
  workingStops: TripStop[];
  onCommitSuccess: () => void;
}

export function ReplanPreviewModal({
  isOpen,
  onClose,
  proposal,
  workingStops,
  onCommitSuccess,
}: ReplanPreviewModalProps) {
  const { commitReplan, refreshTrip } = useTrip();
  const [isCommitting, setIsCommitting] = useState(false);
  const [conflictError, setConflictError] = useState<{
    message: string;
    conflictRevision?: number;
  } | null>(null);

  if (!isOpen || !proposal) return null;

  const diff = proposal.validation_diff;
  const isCostReduced = diff.cost_delta_inr < 0;
  const isCostIncreased = diff.cost_delta_inr > 0;
  const isDurationReduced = diff.duration_delta_minutes < 0;
  const isDurationIncreased = diff.duration_delta_minutes > 0;

  const handleConfirmAndApply = async () => {
    setIsCommitting(true);
    setConflictError(null);

    const result = await commitReplan(
      proposal.proposal_id,
      proposal.base_revision,
      workingStops
    );

    setIsCommitting(false);

    if (result.isConflict) {
      setConflictError({
        message:
          result.message ||
          `Revision mismatch. Expected revision ${proposal.base_revision}, but the trip has progressed to a newer revision.`,
        conflictRevision: result.conflictRevision,
      });
      return;
    }

    if (result.success) {
      onCommitSuccess();
      onClose();
    }
  };

  const handleResolveConflict = async () => {
    await refreshTrip();
    setConflictError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-[#E8E4DC] flex items-center justify-between bg-[#FBF9F5]">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1E3A5F] bg-[#1E3A5F]/10 px-2.5 py-0.5 rounded-full border border-[#1E3A5F]/20">
              Replan Preview
            </span>
            <h3 className="font-serif text-lg font-medium text-[#191C1E] mt-1">
              Review Staged Changes
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isCommitting}
            className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Concurrency Conflict Alert (HTTP 409) */}
          {conflictError && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-2.5 animate-in slide-in-from-top-2">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-rose-800">
                    Revision Conflict (HTTP 409)
                  </h4>
                  <p className="text-[11px] text-rose-700 mt-1 leading-relaxed">
                    {conflictError.message}
                  </p>
                </div>
              </div>
              <button
                onClick={handleResolveConflict}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition-colors shadow-2xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh & Load Latest Plan</span>
              </button>
            </div>
          )}

          {/* Revision Target Card */}
          <div className="p-3.5 rounded-2xl bg-neutral-900 text-white flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold">
                Atomic Revision Update
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-extrabold text-neutral-300">
                  Rev {proposal.base_revision}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-white/70" />
                <span className="text-sm font-extrabold text-emerald-400">
                  Rev {proposal.base_revision + 1}
                </span>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-neutral-800 text-neutral-300 border border-neutral-700">
              Revision-Locked
            </span>
          </div>

          {/* Diff Impact Grid (Cost & Duration) */}
          <div className="grid grid-cols-2 gap-3">
            {/* Cost Delta */}
            <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-1">
              <span className="text-[10px] font-bold text-neutral-500 uppercase flex items-center gap-1">
                <Coins className="w-3 h-3 text-[#1E3A5F]" /> Budget Delta
              </span>
              <p
                className={`text-base font-extrabold ${
                  isCostReduced
                    ? "text-emerald-600"
                    : isCostIncreased
                    ? "text-[#1E3A5F]"
                    : "text-neutral-700"
                }`}
              >
                {diff.cost_delta_inr === 0
                  ? "₹0"
                  : `${diff.cost_delta_inr > 0 ? "+" : ""}₹${diff.cost_delta_inr}`}
              </p>
              <span className="text-[10px] text-neutral-400 block">
                {isCostReduced
                  ? "Savings achieved"
                  : isCostIncreased
                  ? "Additional fees"
                  : "No cost change"}
              </span>
            </div>

            {/* Duration Delta */}
            <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-1">
              <span className="text-[10px] font-bold text-neutral-500 uppercase flex items-center gap-1">
                <Clock className="w-3 h-3 text-sky-600" /> Time Delta
              </span>
              <p
                className={`text-base font-extrabold ${
                  isDurationReduced
                    ? "text-emerald-600"
                    : isDurationIncreased
                    ? "text-[#1E3A5F]"
                    : "text-neutral-700"
                }`}
              >
                {diff.duration_delta_minutes === 0
                  ? "0m"
                  : `${diff.duration_delta_minutes > 0 ? "+" : ""}${diff.duration_delta_minutes}m`}
              </p>
              <span className="text-[10px] text-neutral-400 block">
                {isDurationReduced
                  ? "Time saved"
                  : isDurationIncreased
                  ? "Extended duration"
                  : "Same duration"}
              </span>
            </div>
          </div>

          {/* Staged Modifications List */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-neutral-700 uppercase tracking-wider block">
              Operations Summary
            </span>

            <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/70 space-y-2 text-xs">
              {diff.stops_skipped.length > 0 && (
                <div className="flex items-center justify-between text-amber-700">
                  <span className="font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                    Stops marked skipped:
                  </span>
                  <span className="font-bold">{diff.stops_skipped.length}</span>
                </div>
              )}

              {diff.stops_removed.length > 0 && (
                <div className="flex items-center justify-between text-rose-700">
                  <span className="font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                    Stops removed:
                  </span>
                  <span className="font-bold">{diff.stops_removed.length}</span>
                </div>
              )}

              {diff.stops_added.length > 0 && (
                <div className="flex items-center justify-between text-emerald-700">
                  <span className="font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    Stops added:
                  </span>
                  <span className="font-bold">{diff.stops_added.length}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-neutral-600 pt-1 border-t border-neutral-200/60">
                <span className="font-semibold">Remaining stops in active itinerary:</span>
                <span className="font-extrabold text-neutral-900">
                  {workingStops.filter((s) => s.visit_status !== "skipped").length}
                </span>
              </div>
            </div>
          </div>

          {/* Operating Hours Conflicts / Warnings */}
          {diff.closing_hour_conflicts.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
              <span className="font-bold flex items-center gap-1 text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5" /> Operating Hours Warning:
              </span>
              <ul className="list-disc list-inside text-[11px] text-amber-700 space-y-0.5">
                {diff.closing_hour_conflicts.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-neutral-100 bg-neutral-50/50 flex items-center gap-2.5">
          <button
            onClick={onClose}
            disabled={isCommitting}
            className="flex-1 py-2.5 px-3 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
          >
            Keep Editing
          </button>

          <button
            onClick={handleConfirmAndApply}
            disabled={isCommitting || Boolean(conflictError)}
            className="flex-1 py-2.5 px-4 rounded-xl bg-[#1E3A5F] hover:bg-[#152943] text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            {isCommitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Committing Rev {proposal.base_revision + 1}...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Confirm & Apply (Rev {proposal.base_revision + 1})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
