"use client";

import React from "react";
import { Clock, IndianRupee, Tag } from "lucide-react";

export type DurationFilter = "all" | "single_day" | "multi_day";
export type BudgetFilter = "all" | "under_500" | "under_1500";

interface TrailFilterBarProps {
  duration: DurationFilter;
  budget: BudgetFilter;
  selectedTag: string;
  tags: string[];
  onDurationChange: (d: DurationFilter) => void;
  onBudgetChange: (b: BudgetFilter) => void;
  onTagChange: (t: string) => void;
}

export function TrailFilterBar({
  duration,
  budget,
  selectedTag,
  tags,
  onDurationChange,
  onBudgetChange,
  onTagChange,
}: TrailFilterBarProps) {
  return (
    <div className="space-y-3.5 bg-neutral-50/80 p-3.5 rounded-2xl border border-neutral-100">
      {/* 1. Duration Filter */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1">
          <Clock className="w-3 h-3 text-neutral-400" />
          <span>Duration</span>
        </label>
        <div className="grid grid-cols-3 gap-1.5 bg-white p-1 rounded-xl border border-neutral-200/80">
          <button
            type="button"
            onClick={() => onDurationChange("all")}
            className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
              duration === "all"
                ? "bg-[#E05A2B] text-white shadow-xs"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => onDurationChange("single_day")}
            className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
              duration === "single_day"
                ? "bg-[#E05A2B] text-white shadow-xs"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            1-Day
          </button>
          <button
            type="button"
            onClick={() => onDurationChange("multi_day")}
            className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
              duration === "multi_day"
                ? "bg-[#E05A2B] text-white shadow-xs"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            Multi-Day
          </button>
        </div>
      </div>

      {/* 2. Budget Cap (3 Quick Chips - Q2 Option A) */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1">
          <IndianRupee className="w-3 h-3 text-neutral-400" />
          <span>Budget Cap</span>
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => onBudgetChange("all")}
            className={`py-1.5 px-2 text-xs font-semibold rounded-xl border transition-all text-center ${
              budget === "all"
                ? "border-neutral-900 bg-neutral-900 text-white shadow-xs"
                : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
            }`}
          >
            Any Budget
          </button>
          <button
            type="button"
            onClick={() => onBudgetChange("under_500")}
            className={`py-1.5 px-2 text-xs font-semibold rounded-xl border transition-all text-center ${
              budget === "under_500"
                ? "border-[#E05A2B] bg-amber-50 text-[#E05A2B] font-bold shadow-xs"
                : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
            }`}
          >
            &lt; ₹500
          </button>
          <button
            type="button"
            onClick={() => onBudgetChange("under_1500")}
            className={`py-1.5 px-2 text-xs font-semibold rounded-xl border transition-all text-center ${
              budget === "under_1500"
                ? "border-[#E05A2B] bg-amber-50 text-[#E05A2B] font-bold shadow-xs"
                : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
            }`}
          >
            &lt; ₹1,500
          </button>
        </div>
      </div>

      {/* 3. Interest Tag Chips */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1">
          <Tag className="w-3 h-3 text-neutral-400" />
          <span>Interests</span>
        </label>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {tags.map((tag) => {
            const isSelected = selectedTag === tag;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => onTagChange(tag)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors capitalize ${
                  isSelected
                    ? "bg-[#E05A2B] text-white shadow-xs font-semibold"
                    : "bg-white text-neutral-600 border border-neutral-200 hover:border-neutral-300"
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

