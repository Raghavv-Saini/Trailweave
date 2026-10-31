"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { useAuth } from "@/context/AuthContext";

export default function TrailsExplorerPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { totalCount, addAllStops } = useBasket();
  const [isBasketOpen, setIsBasketOpen] = useState(false);
  const [allTrails, setAllTrails] = useState<MockTrail[]>(MOCK_TRAILS);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login?redirect=/trails");
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("trailweave_user_trails") || "[]");
      if (Array.isArray(stored) && stored.length > 0) {
        const merged = [...stored];
        for (const t of MOCK_TRAILS) {
          if (!merged.some((m: MockTrail) => m.id === t.id)) {
            merged.push(t);
          }
        }
        setAllTrails(merged);
      }
    } catch {}
  }, []);

  // Filters state
  const [duration, setDuration] = useState<DurationFilter>("all");
  const [budget, setBudget] = useState<BudgetFilter>("all");
  const [selectedTag, setSelectedTag] = useState<string>("all");

  // Modal state for Use As Base
  const [baseTrailCandidate, setBaseTrailCandidate] = useState<MockTrail | null>(null);

  const tags = ["all", "heritage", "artisan", "walking", "food"];

  // Filter evaluation logic
  const filteredTrails = allTrails.filter((trail) => {
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
    <div className="flex-1 flex flex-col justify-between min-h-screen bg-[#FDFBF7]">
      <Header
        title="Community Trails"
        subtitle="Verified Field Itineraries • Udaipur"
        onBasketClick={() => setIsBasketOpen(true)}
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6">
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
        <div className="flex items-center justify-between text-xs font-semibold text-[#7A746B] pt-1">
          <span>Showing <strong className="text-[#191C1E]">{filteredTrails.length}</strong> community routes</span>
          {(duration !== "all" || budget !== "all" || selectedTag !== "all") && (
            <button
              onClick={() => {
                setDuration("all");
                setBudget("all");
                setSelectedTag("all");
              }}
              className="text-[#1E3A5F] hover:underline cursor-pointer"
            >
              Reset filters
            </button>
          )}
        </div>

        {/* Trail Cards Grid (Responsive Multi-Column) */}
        <div>
          {filteredTrails.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-[#E8E4DC] p-6 space-y-2">
              <p className="text-sm font-bold text-[#191C1E]">No matching trails found</p>
              <p className="text-xs text-[#7A746B]">
                Try widening your budget cap or clearing duration filters.
              </p>
              <button
                onClick={() => {
                  setDuration("all");
                  setBudget("all");
                  setSelectedTag("all");
                }}
                className="mt-2 text-xs font-bold px-3 py-1.5 rounded-lg bg-[#F0ECE1] text-[#191C1E] hover:bg-[#E2DDD3] cursor-pointer"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTrails.map((trail) => (
                <TrailCard
                  key={trail.id}
                  trail={trail}
                  onUseAsBase={handleUseAsBaseClick}
                />
              ))}
            </div>
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
