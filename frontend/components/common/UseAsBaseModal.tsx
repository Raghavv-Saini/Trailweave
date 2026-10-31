"use client";

import React from "react";
import { Copy, PlusCircle, X, Sparkles } from "lucide-react";
import { MockTrail } from "@/lib/mockData";

interface UseAsBaseModalProps {
  isOpen: boolean;
  trail: MockTrail | null;
  currentBasketCount: number;
  onClose: () => void;
  onConfirm: (mode: "replace" | "merge") => void;
}

export function UseAsBaseModal({
  isOpen,
  trail,
  currentBasketCount,
  onClose,
  onConfirm,
}: UseAsBaseModalProps) {
  if (!isOpen || !trail) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl space-y-4">
        <div className="flex items-start justify-between">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-[#E05A2B] flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-1.5">
          <h3 className="text-base font-bold text-neutral-900 leading-snug">
            Use &quot;{trail.title}&quot; as Base?
          </h3>
          <p className="text-xs text-neutral-600 leading-relaxed">
            Your basket already contains{" "}
            <span className="font-bold text-neutral-900">{currentBasketCount}</span> places.
            Would you like to replace your current basket or merge this trail&apos;s stops?
          </p>
        </div>

        <div className="space-y-2 pt-2">
          <button
            onClick={() => onConfirm("merge")}
            className="w-full py-3 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <PlusCircle className="w-4 h-4 text-[#F59E0B]" />
            <span>Merge stops ({trail.stops_count} new stops)</span>
          </button>

          <button
            onClick={() => onConfirm("replace")}
            className="w-full py-3 px-4 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-neutral-700 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <Copy className="w-4 h-4 text-neutral-400" />
            <span>Replace basket with this trail</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-2 text-center text-xs text-neutral-400 font-medium hover:text-neutral-600"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

