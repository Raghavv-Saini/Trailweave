"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Compass,
  Sparkles,
  ArrowRight,
  Calendar,
  Award,
} from "lucide-react";
import { Header } from "@/components/common/Header";
import { BottomNav } from "@/components/common/BottomNav";
import { TrailCard } from "@/components/discovery/TrailCard";
import { BasketDrawer } from "@/components/basket/BasketDrawer";
import { FloatingBasketButton } from "@/components/basket/FloatingBasketButton";
import { UseAsBaseModal } from "@/components/common/UseAsBaseModal";
import { PlanFromScratchModal } from "@/components/common/PlanFromScratchModal";
import { MOCK_TRAILS, MockTrail } from "@/lib/mockData";
import { useBasket } from "@/context/BasketContext";

export default function Home() {
  const { totalCount, addAllStops } = useBasket();
  const [isBasketOpen, setIsBasketOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Modals state
  const [isPlanScratchOpen, setIsPlanScratchOpen] = useState(false);
  const [baseTrailCandidate, setBaseTrailCandidate] = useState<MockTrail | null>(null);

  const categories = ["all", "heritage", "crafts", "food", "walking"];

  // Filter featured community trails
  const featuredTrails = MOCK_TRAILS.filter((t) => {
    if (selectedCategory === "all") return true;
    return t.tags.includes(selectedCategory);
  });

  const handleUseAsBaseClick = (trail: MockTrail) => {
    if (totalCount > 0) {
      // User decision Q1 Option B: Prompt to replace or merge
      setBaseTrailCandidate(trail);
    } else {
      // Basket is empty: directly add all stops as base
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
      {/* Top Header */}
      <Header onBasketClick={() => setIsBasketOpen(true)} />

      {/* Main Content Area */}
      <main className="flex-1 px-5 py-4 space-y-6 overflow-y-auto">
        {/* Hero Banner */}
        <div className="rounded-3xl bg-gradient-to-br from-amber-500 via-[#E05A2B] to-[#993412] p-5 text-white shadow-md relative overflow-hidden">
          <div className="relative z-10 space-y-2">
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-xs text-white text-[11px] font-semibold">
              <Sparkles className="w-3 h-3 text-amber-200" />
              <span>Udaipur Community Knowledge Loop</span>
            </div>
            <h2 className="text-xl font-extrabold leading-tight tracking-tight">
              Explore like a local. Travel your way.
            </h2>
            <p className="text-xs text-amber-100/90 leading-relaxed max-w-sm">
              Discover authentic journeys completed by real travelers, mix stops into your personal basket, and unlock direct artisan workshops.
            </p>
          </div>
        </div>

        {/* Clear Entry Points: Option A (Explore Trails) vs Option B (Plan from Scratch) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Option A: Explore Community Trails (Primary) */}
          <Link
            href="/trails"
            className="p-4 rounded-2xl bg-white border-2 border-[#E05A2B] hover:bg-amber-50/30 transition-all shadow-xs flex items-start justify-between group"
          >
            <div className="space-y-1">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-[#E05A2B] flex items-center justify-center">
                <Compass className="w-4 h-4 stroke-[2.2]" />
              </div>
              <h3 className="font-bold text-sm text-neutral-900 group-hover:text-[#E05A2B] transition-colors">
                Explore Community Trails
              </h3>
              <p className="text-[11px] text-neutral-500 leading-snug">
                Browse verified traveler routes, pick stops, and adopt base itineraries.
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-[#E05A2B] shrink-0 mt-2 group-hover:translate-x-1 transition-transform" />
          </Link>

          {/* Option B: Plan from Scratch (Secondary) */}
          <button
            type="button"
            onClick={() => setIsPlanScratchOpen(true)}
            className="p-4 rounded-2xl bg-white border border-neutral-200/90 hover:border-neutral-300 hover:bg-neutral-50/70 transition-all shadow-xs flex items-start justify-between text-left group"
          >
            <div className="space-y-1">
              <div className="w-8 h-8 rounded-xl bg-neutral-100 text-neutral-700 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-neutral-900 group-hover:text-neutral-700 transition-colors">
                Plan from Scratch
              </h3>
              <p className="text-[11px] text-neutral-500 leading-snug">
                Choose duration, set budget, and let the deterministic engine optimize.
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-neutral-400 shrink-0 mt-2 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Quick Category Chips */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Browse by Vibe
            </h3>
            <Link
              href="/trails"
              className="text-xs font-semibold text-[#E05A2B] hover:underline"
            >
              View all &rarr;
            </Link>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors capitalize ${
                  selectedCategory === cat
                    ? "bg-neutral-900 text-white shadow-xs"
                    : "bg-white text-neutral-600 border border-neutral-200 hover:border-neutral-300"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Featured Community Trails Feed */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-neutral-900">
                Featured Traveler Trails
              </h3>
              <p className="text-[11px] text-neutral-500">
                Completed in Udaipur with authentic timing &amp; tips
              </p>
            </div>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Award className="w-3 h-3" />
              Verified
            </span>
          </div>

          <div className="space-y-3">
            {featuredTrails.map((trail) => (
              <TrailCard
                key={trail.id}
                trail={trail}
                onUseAsBase={handleUseAsBaseClick}
              />
            ))}
          </div>
        </div>
      </main>

      {/* Floating Basket Counter & Open Button */}
      <FloatingBasketButton onClick={() => setIsBasketOpen(true)} />

      {/* Slide-Up Basket Drawer */}
      <BasketDrawer isOpen={isBasketOpen} onClose={() => setIsBasketOpen(false)} />

      {/* Modals */}
      <UseAsBaseModal
        isOpen={Boolean(baseTrailCandidate)}
        trail={baseTrailCandidate}
        currentBasketCount={totalCount}
        onClose={() => setBaseTrailCandidate(null)}
        onConfirm={handleConfirmUseAsBase}
      />

      <PlanFromScratchModal
        isOpen={isPlanScratchOpen}
        onClose={() => setIsPlanScratchOpen(false)}
      />

      {/* Bottom Navigation Bar */}
      <BottomNav />
    </div>
  );
}