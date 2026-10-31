"use client";

import React, { useState } from "react";
import { Header } from "@/components/common/Header";
import { BottomNav } from "@/components/common/BottomNav";
import { TrailCard } from "@/components/discovery/TrailCard";
import {
  TrailFilterBar,
  DurationFilter,
  BudgetFilter,
} from "@/components/discovery/TrailFilterBar";
import { BasketDrawer } from "@/components/basket/BasketDrawer";
import { FloatingBasketButton } from "@/components/basket/FloatingBasketButton";
import { UseAsBaseModal } from "@/components/common/UseAsBaseModal";
import { MOCK_TRAILS, MockTrail } from "@/lib/mockData";
import { useBasket } from "@/context/BasketContext";

export default function TrailsExplorerPage() {
  const { totalCount, addAllStops } = useBasket();
  const [isBasketOpen, setIsBasketOpen] = useState(false);

  // Filters state
  const [duration, setDuration] = useState<DurationFilter>("all");
  const [budget, setBudget] = useState<BudgetFilter>("all");
  const [selectedTag, setSelectedTag] = useState<string>("all");

  // Modal state for Use As Base
  const [baseTrailCandidate, setBaseTrailCandidate] = useState<MockTrail | null>(null);

  const tags = ["all", "heritage", "artisan", "walking", "food"];

  // Filter evaluation logic
  const filteredTrails = MOCK_TRAILS.filter((trail) => {
    // 1. Duration filter
    if (duration !== "all" && trail.duration_type !== duration) {
      return false;
    }

    // 2. Budget filter
    if (budget === "under_500" && trail.estimated_cost_inr >= 500) {
      return false;
    }
    if (budget === "under_1500" && trail.estimated_cost_inr >= 1500) {
      return false;
    }

    // 3. Tag filter
    if (selectedTag !== "all" && !trail.tags.includes(selectedTag)) {
      return false;
    }

    return true;
  });

  const handleUseAsBaseClick = (trail: MockTrail) => {
    if (totalCount > 0) {
      // Q1 Option B: Prompt to replace or merge
      setBaseTrailCandidate(trail);
    } else {
      addAllStops(trail, "replace");
      setIsBasketOpen(true);
    }
  };

  const handleConfirmUseAsBase = (mode: "replace" | "merge") => {
    if (baseTrailCandidate) {
      addAllStops(baseTrailCandidate, mode);
      setBaseTrailCandidate(null);
      setIsBasketOpen(true);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between min-h-screen bg-neutral-50/50 pb-20">
      <Header
        title="Community Trails"
        subtitle="Real itineraries by fellow travelers"
        onBasketClick={() => setIsBasketOpen(true)}
      />

      <main className="flex-1 px-5 py-4 space-y-4 overflow-y-auto">
        {/* Comprehensive Filter Bar */}
        <TrailFilterBar
          duration={duration}
          budget={budget}
          selectedTag={selectedTag}
          tags={tags}
          onDurationChange={setDuration}
          onBudgetChange={setBudget}
          onTagChange={setSelectedTag}
        />

        {/* Results Counter */}
        <div className="flex items-center justify-between text-xs font-semibold text-neutral-500 pt-1">
          <span>{filteredTrails.length} trails available</span>
          {(duration !== "all" || budget !== "all" || selectedTag !== "all") && (
            <button
              onClick={() => {
                setDuration("all");
                setBudget("all");
                setSelectedTag("all");
              }}
              className="text-[#E05A2B] hover:underline"
            >
              Reset filters
            </button>
          )}
        </div>

        {/* Trail Cards List */}
        <div className="space-y-3">
          {filteredTrails.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-neutral-200/80 p-6 space-y-2">
              <p className="text-sm font-bold text-neutral-800">No matching trails found</p>
              <p className="text-xs text-neutral-500">
                Try widening your budget cap or clearing duration filters.
              </p>
              <button
                onClick={() => {
                  setDuration("all");
                  setBudget("all");
                  setSelectedTag("all");
                }}
                className="mt-2 text-xs font-bold px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            filteredTrails.map((trail) => (
              <TrailCard
                key={trail.id}
                trail={trail}
                onUseAsBase={handleUseAsBaseClick}
              />
            ))
          )}
        </div>
      </main>

      {/* Floating Basket Counter & Open Button */}
      <FloatingBasketButton onClick={() => setIsBasketOpen(true)} />

      {/* Slide-Up Basket Drawer */}
      <BasketDrawer isOpen={isBasketOpen} onClose={() => setIsBasketOpen(false)} />

      {/* Use As Base Replace/Merge Modal */}
      <UseAsBaseModal
        isOpen={Boolean(baseTrailCandidate)}
        trail={baseTrailCandidate}
        currentBasketCount={totalCount}
        onClose={() => setBaseTrailCandidate(null)}
        onConfirm={handleConfirmUseAsBase}
      />

      <BottomNav />
    </div>
  );
}
