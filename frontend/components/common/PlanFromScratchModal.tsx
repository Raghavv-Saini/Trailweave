"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Compass, Calendar, ArrowRight, X, Plus, Minus } from "lucide-react";
import { useTrip } from "@/context/TripContext";
import { MOCK_PLACES } from "@/lib/mockData";

interface PlanFromScratchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PlanFromScratchModal({ isOpen, onClose }: PlanFromScratchModalProps) {
  const router = useRouter();
  const { createTripFromBuilder } = useTrip();
  const [selectedDays, setSelectedDays] = useState<number>(3);
  const [budgetInr, setBudgetInr] = useState<number>(2500);
  const [travelMode, setTravelMode] = useState<"walking" | "auto_rickshaw" | "cab">("auto_rickshaw");

  if (!isOpen) return null;

  const getTripLabel = (days: number) => {
    if (days === 1) return "Express City Tour";
    if (days === 2) return "Heritage Immersion";
    if (days === 3) return "Royal Palaces & Crafts";
    if (days <= 5) return "Lakes, Forts & Countryside";
    return "Grand Mewar Expedition";
  };

  const handleStart = async () => {
    try {
      localStorage.setItem("trailweave_plan_scratch_days", selectedDays.toString());
    } catch {}
    await createTripFromBuilder({
      title: `${selectedDays}-Day ${getTripLabel(selectedDays)}`,
      days: selectedDays,
      budgetInr,
      travelMode,
      places: MOCK_PLACES,
    });
    onClose();
    router.push(`/trip?days=${selectedDays}`);
  };

  const quickPresets = [1, 2, 3, 4, 5, 7];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="w-10 h-10 rounded-2xl bg-[#1E3A5F]/10 text-[#1E3A5F] flex items-center justify-center">
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
          <h3 className="font-serif text-lg font-medium text-[#191C1E] leading-snug">
            Plan Udaipur Journey from Scratch
          </h3>
          <p className="text-xs text-[#3F464C] leading-relaxed">
            How many days will you be exploring Udaipur? Pick a quick preset or adjust to any custom duration:
          </p>
        </div>

        {/* Interactive Stepper Control */}
        <div className="p-3.5 rounded-2xl bg-[#FBF9F5] border border-[#E8E4DC] flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSelectedDays((prev) => Math.max(1, prev - 1))}
            disabled={selectedDays <= 1}
            className="w-10 h-10 rounded-xl bg-white border border-[#E8E4DC] text-neutral-700 hover:bg-[#F4EFEA] flex items-center justify-center disabled:opacity-40 disabled:hover:bg-white transition-all shadow-2xs cursor-pointer"
            aria-label="Decrease days"
          >
            <Minus className="w-4 h-4" />
          </button>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#1E3A5F]" />
              <span className="text-lg font-bold text-[#191C1E]">
                {selectedDays} {selectedDays === 1 ? "Day" : "Days"}
              </span>
            </div>
            <span className="text-[11px] font-semibold text-[#1E3A5F] block mt-0.5">
              {getTripLabel(selectedDays)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setSelectedDays((prev) => Math.min(14, prev + 1))}
            disabled={selectedDays >= 14}
            className="w-10 h-10 rounded-xl bg-white border border-[#E8E4DC] text-neutral-700 hover:bg-[#F4EFEA] flex items-center justify-center disabled:opacity-40 disabled:hover:bg-white transition-all shadow-2xs cursor-pointer"
            aria-label="Increase days"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Presets Chips */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-[#7A746B]">
            Quick Options
          </label>
          <div className="grid grid-cols-6 gap-1.5">
            {quickPresets.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setSelectedDays(days)}
                className={`py-2 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer ${
                  selectedDays === days
                    ? "border-[#1E3A5F] bg-[#1E3A5F] text-white shadow-2xs"
                    : "border-[#E8E4DC] bg-white text-neutral-700 hover:border-neutral-300"
                }`}
              >
                {days}d
              </button>
            ))}
          </div>
        </div>

        {/* Budget & Transport Mode */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#7A746B]">
              Budget (₹)
            </label>
            <input
              type="number"
              min={500}
              step={250}
              value={budgetInr}
              onChange={(e) => setBudgetInr(Number(e.target.value) || 1500)}
              className="w-full px-3 py-2 rounded-xl border border-[#E8E4DC] text-xs font-bold text-[#191C1E]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#7A746B]">
              Transport
            </label>
            <select
              value={travelMode}
              onChange={(e) =>
                setTravelMode(e.target.value as "walking" | "auto_rickshaw" | "cab")
              }
              className="w-full px-3 py-2 rounded-xl border border-[#E8E4DC] text-xs font-bold text-[#191C1E] bg-white"
            >
              <option value="auto_rickshaw">Auto-Rickshaw</option>
              <option value="walking">Walking</option>
              <option value="cab">Private Cab</option>
            </select>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="space-y-2 pt-2">
          <button
            onClick={handleStart}
            className="w-full py-3.5 px-4 rounded-xl bg-[#1E3A5F] hover:bg-[#152943] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs active:scale-[0.99] cursor-pointer"
          >
            <span>Start {selectedDays}-Day Plan</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 text-center text-xs text-neutral-400 font-medium hover:text-neutral-600 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
