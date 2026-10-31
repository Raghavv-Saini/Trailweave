"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Compass, Calendar, ArrowRight, X, Plus, Minus } from "lucide-react";

interface PlanFromScratchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PlanFromScratchModal({ isOpen, onClose }: PlanFromScratchModalProps) {
  const router = useRouter();
  const [selectedDays, setSelectedDays] = useState<number>(3);

  if (!isOpen) return null;

  const handleStart = () => {
    onClose();
    try {
      localStorage.setItem("trailweave_plan_scratch_days", selectedDays.toString());
    } catch {}
    router.push(`/trip?days=${selectedDays}`);
  };

  const getTripLabel = (days: number) => {
    if (days === 1) return "Express City Tour";
    if (days === 2) return "Heritage Immersion";
    if (days === 3) return "Royal Palaces & Crafts";
    if (days <= 5) return "Lakes, Forts & Countryside";
    return "Grand Mewar Expedition";
  };

  const quickPresets = [1, 2, 3, 4, 5, 7];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-[#E05A2B] flex items-center justify-center">
            <Compass className="w-5 h-5 stroke-[2.2]" />
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-1">
          <h3 className="text-base font-bold text-neutral-900 leading-snug">
            Plan Udaipur Journey from Scratch
          </h3>
          <p className="text-xs text-neutral-600 leading-relaxed">
            How many days will you be exploring Udaipur? Pick a quick preset or adjust to any custom duration:
          </p>
        </div>

        {/* Interactive Stepper Control */}
        <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSelectedDays((prev) => Math.max(1, prev - 1))}
            disabled={selectedDays <= 1}
            className="w-10 h-10 rounded-xl bg-white border border-amber-200 text-neutral-700 hover:bg-amber-100 flex items-center justify-center disabled:opacity-40 disabled:hover:bg-white transition-all shadow-2xs"
            aria-label="Decrease days"
          >
            <Minus className="w-4 h-4" />
          </button>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#E05A2B]" />
              <span className="text-lg font-extrabold text-neutral-900">
                {selectedDays} {selectedDays === 1 ? "Day" : "Days"}
              </span>
            </div>
            <span className="text-[11px] font-semibold text-[#E05A2B] block mt-0.5">
              {getTripLabel(selectedDays)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setSelectedDays((prev) => Math.min(14, prev + 1))}
            disabled={selectedDays >= 14}
            className="w-10 h-10 rounded-xl bg-white border border-amber-200 text-neutral-700 hover:bg-amber-100 flex items-center justify-center disabled:opacity-40 disabled:hover:bg-white transition-all shadow-2xs"
            aria-label="Increase days"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Presets Chips */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            Quick Options
          </label>
          <div className="grid grid-cols-6 gap-1.5">
            {quickPresets.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setSelectedDays(days)}
                className={`py-2 rounded-xl text-xs font-bold transition-all border text-center ${
                  selectedDays === days
                    ? "border-[#E05A2B] bg-[#E05A2B] text-white shadow-2xs"
                    : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
                }`}
              >
                {days}d
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="space-y-2 pt-2">
          <button
            onClick={handleStart}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#E05A2B] to-[#F59E0B] text-white font-bold text-xs flex items-center justify-center gap-2 hover:opacity-95 transition-all shadow-md active:scale-[0.99]"
          >
            <span>Start {selectedDays}-Day Plan</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 text-center text-xs text-neutral-400 font-medium hover:text-neutral-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
