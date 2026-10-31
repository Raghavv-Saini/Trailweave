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
          <div className="w-10 h-10 rounded-2xl bg-[#1E3A5F]/10 text-[#1E3A5F] flex items-center justify-center">
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
          <h3 className="font-serif text-lg font-medium text-[#191C1E] leading-snug">
            Use &quot;{trail.title}&quot; as Base?
          </h3>
          <p className="text-xs text-[#3F464C] leading-relaxed">
            Your basket already contains{" "}
            <span className="font-bold text-[#191C1E]">{currentBasketCount}</span> places.
            Would you like to replace your current basket or merge this trail&apos;s stops?
          </p>
        </div>

        <div className="space-y-2 pt-2">
          <button
            onClick={() => onConfirm("merge")}
            className="w-full py-3 px-4 rounded-xl bg-[#1E3A5F] hover:bg-[#152943] text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-white/80" />
            <span>Merge stops ({trail.stops_count} new stops)</span>
          </button>

          <button
            onClick={() => onConfirm("replace")}
            className="w-full py-3 px-4 rounded-xl border border-[#E8E4DC] hover:bg-[#F4EFEA] text-[#191C1E] font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
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

