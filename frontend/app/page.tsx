"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Compass,
  ArrowRight,
  Calendar,
  Clock,
  MapPin,
  Check,
  Navigation,
  Palette,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { Header } from "@/components/common/Header";
import { BottomNav } from "@/components/common/BottomNav";
import { BasketDrawer } from "@/components/basket/BasketDrawer";
import { FloatingBasketButton } from "@/components/basket/FloatingBasketButton";
import { PlanFromScratchModal } from "@/components/common/PlanFromScratchModal";
import { MOCK_PLACES, MockPlace } from "@/lib/mockData";
import { useBasket } from "@/context/BasketContext";
import { useTrip } from "@/context/TripContext";
import { useAuth } from "@/context/AuthContext";

export default function TouristHomePage() {
  const router = useRouter();
  const { user, isAuthenticated, isAdmin, isLoading } = useAuth();
  const { items: basketItems, totalCount } = useBasket();
  const { tripTitle, stops, revision, createTripFromBuilder } = useTrip();

  const [isBasketOpen, setIsBasketOpen] = useState(false);
  const [isPlanScratchOpen, setIsPlanScratchOpen] = useState(false);

  // Interactive Homepage Trip Builder State
  const [builderDays, setBuilderDays] = useState<number>(2);
  const [builderBudget, setBuilderBudget] = useState<number>(2500);
  const [builderTransport, setBuilderTransport] = useState<
    "walking" | "auto_rickshaw" | "cab"
  >("auto_rickshaw");
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<string[]>([
    "place_city_palace",
    "place_jagdish_temple",
    "place_mohanlal_studio",
    "place_bagore_haveli",
  ]);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.replace("/login");
      } else if (isAdmin) {
        router.replace("/admin");
      }
    }
  }, [isLoading, isAuthenticated, isAdmin, router]);

  const togglePlace = (placeId: string) => {
    setSelectedPlaceIds((prev) =>
      prev.includes(placeId)
        ? prev.filter((id) => id !== placeId)
        : [...prev, placeId]
    );
  };

  const handleGenerateTrip = async (useBasketStops: boolean) => {
    setIsGenerating(true);
    try {
      const placesToSchedule: MockPlace[] =
        useBasketStops && basketItems.length > 0
          ? basketItems.map((b) => b.place)
          : MOCK_PLACES.filter((p) => selectedPlaceIds.includes(p.id));

      await createTripFromBuilder({
        title: useBasketStops
          ? `My Curated Basket Journey (${placesToSchedule.length} Stops)`
          : `Udaipur ${builderDays}-Day Cultural Itinerary`,
        days: builderDays,
        budgetInr: builderBudget,
        travelMode: builderTransport,
        places: placesToSchedule.length > 0 ? placesToSchedule : MOCK_PLACES.slice(0, 4),
      });
      router.push("/trip");
    } finally {
      setIsGenerating(false);
    }
  };

  const visitedCount = stops.filter((s) => s.visit_status === "visited").length;

  // Unauthenticated / Redirecting state (includes /artisans/onboard reference for role portal discovery)
  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-10 h-10 rounded-xl bg-[#1E3A5F] text-white flex items-center justify-center">
          <Compass className="w-5 h-5" />
        </div>
        <p className="text-sm font-medium text-[#5A544B]">
          Redirecting to TrailWeave Role Selection & Login...
        </p>
        <div className="flex items-center gap-3 text-xs font-bold">
          <Link href="/login" className="px-4 py-2 rounded-xl bg-[#1E3A5F] text-white">
            Go to Login
          </Link>
          <Link
            href="/artisans/onboard"
            className="px-4 py-2 rounded-xl border border-[#E2DDD3] bg-white text-[#191C1E]"
          >
            Artisan Portal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col justify-between min-h-screen bg-[#FDFBF7]">
      <Header
        title="TrailWeave"
        subtitle="Tourist Homepage • Udaipur"
        onBasketClick={() => setIsBasketOpen(true)}
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8 sm:space-y-10">
        {/* 1. Personalized Welcome & Active Trip Banner */}
        <section className="rounded-2xl border border-[#E8E4DC] bg-white p-6 sm:p-8 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <span className="text-[11px] font-bold tracking-widest uppercase text-[#9E7432] block">
              Khamma Ghani, {user?.full_name || "Traveler"}
            </span>
            <h1 className="font-serif text-2xl sm:text-4xl font-normal text-[#191C1E] leading-tight">
              Plan Your Udaipur Journey Your Way
            </h1>
            <p className="text-xs sm:text-sm text-[#5A544B] leading-relaxed">
              Build a custom multi-day itinerary below, pick verified stops from Community Trails or Master Artisan Studios into your basket, and navigate live with your active companion.
            </p>
          </div>

          {/* Current Active Trip Summary Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF8F5] border border-[#E8E4DC] min-w-[280px] sm:min-w-[320px] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900">
                Active Trip • Rev {revision}
              </span>
              <span className="text-xs font-semibold text-[#7A746B]">
                {visitedCount}/{stops.length} visited
              </span>
            </div>
            <div>
              <h2 className="font-serif text-base font-bold text-[#191C1E] line-clamp-1">
                {tripTitle}
              </h2>
              <p className="text-xs text-[#5A544B] mt-0.5">
                {stops.length} scheduled stops across Udaipur
              </p>
            </div>
            <Link
              href="/trip"
              className="w-full py-2.5 px-4 rounded-xl bg-[#1E3A5F] text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-[#152842] transition-colors"
            >
              <span>Resume Active Trip</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </section>

        {/* 2. Quick Navigation Flow Cards (3 Pillars for Tourists) */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
          {/* Card 1: Community Trails */}
          <Link
            href="/trails"
            className="p-5 rounded-2xl bg-white border border-[#E8E4DC] hover:border-[#1E3A5F] hover:shadow-md transition-all group flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-xl bg-[#1E3A5F]/10 text-[#1E3A5F] flex items-center justify-center">
                <Compass className="w-5 h-5 stroke-[1.8]" />
              </div>
              <h3 className="font-serif text-lg font-bold text-[#191C1E] group-hover:text-[#1E3A5F] transition-colors">
                Browse Community Trails
              </h3>
              <p className="text-xs text-[#5A544B] leading-relaxed">
                Explore authentic, traveler-completed itineraries on the dedicated Community Trails page. Adopt a whole trail or cherry-pick stops into your basket.
              </p>
            </div>
            <div className="flex items-center text-xs font-bold text-[#1E3A5F] gap-1 pt-1">
              <span>Open Community Trails (/trails)</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 2: Verified Artisan Studios */}
          <Link
            href="/artisans"
            className="p-5 rounded-2xl bg-white border border-[#E8E4DC] hover:border-[#1E3A5F] hover:shadow-md transition-all group flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-xl bg-[#9E7432]/10 text-[#9E7432] flex items-center justify-center">
                <Palette className="w-5 h-5 stroke-[1.8]" />
              </div>
              <h3 className="font-serif text-lg font-bold text-[#191C1E] group-hover:text-[#1E3A5F] transition-colors">
                Master Artisan Studios
              </h3>
              <p className="text-xs text-[#5A544B] leading-relaxed">
                Discover verified Mewar miniature painters, terracotta potters, and block-printing workshops. Add hands-on craft sessions directly to your trip.
              </p>
            </div>
            <div className="flex items-center text-xs font-bold text-[#9E7432] gap-1 pt-1">
              <span>Explore Artisan Directory (/artisans)</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 3: Active Companion & Publishing */}
          <Link
            href="/trip"
            className="p-5 rounded-2xl bg-white border border-[#E8E4DC] hover:border-[#1E3A5F] hover:shadow-md transition-all group flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-800 flex items-center justify-center">
                <Navigation className="w-5 h-5 stroke-[1.8]" />
              </div>
              <h3 className="font-serif text-lg font-bold text-[#191C1E] group-hover:text-[#1E3A5F] transition-colors">
                Active Companion & Publish
              </h3>
              <p className="text-xs text-[#5A544B] leading-relaxed">
                Navigate your live itinerary, check in at stops, replan with the AI companion, and publish your completed journey back to Community Trails.
              </p>
            </div>
            <div className="flex items-center text-xs font-bold text-emerald-800 gap-1 pt-1">
              <span>Go to My Active Trip (/trip)</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </section>

        {/* 3. Interactive Trip Builder (Plan From Scratch or From Basket) */}
        <section className="rounded-2xl border border-[#E8E4DC] bg-white p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E4DC] pb-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#9E7432]">
                Deterministic Trip Builder
              </span>
              <h2 className="font-serif text-2xl text-[#191C1E] mt-0.5">
                Build a New Udaipur Itinerary
              </h2>
              <p className="text-xs text-[#7A746B] mt-0.5">
                Choose your trip duration, budget, transport mode, and places to generate a live scheduled itinerary on /trip.
              </p>
            </div>

            {totalCount > 0 && (
              <button
                type="button"
                onClick={() => handleGenerateTrip(true)}
                disabled={isGenerating}
                className="px-4 py-2.5 rounded-xl bg-[#9E7432] text-white text-xs font-bold flex items-center gap-2 hover:bg-[#845F26] transition-colors cursor-pointer shrink-0"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Generate Trip from Basket ({totalCount} stops)</span>
              </button>
            )}
          </div>

          {/* Step 1: Days, Budget & Transport */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E8E4DC] space-y-2">
              <label className="text-xs font-bold text-[#191C1E] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#1E3A5F]" />
                <span>Duration (Days)</span>
              </label>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setBuilderDays(d)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      builderDays === d
                        ? "bg-[#1E3A5F] text-white border-[#1E3A5F]"
                        : "bg-white text-[#5A544B] border-[#E2DDD3] hover:border-[#1E3A5F]"
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E8E4DC] space-y-2">
              <label className="text-xs font-bold text-[#191C1E] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#1E3A5F]" />
                <span>Total Budget (INR)</span>
              </label>
              <div className="flex items-center gap-1.5">
                {[1000, 2500, 5000].map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBuilderBudget(b)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      builderBudget === b
                        ? "bg-[#1E3A5F] text-white border-[#1E3A5F]"
                        : "bg-white text-[#5A544B] border-[#E2DDD3] hover:border-[#1E3A5F]"
                    }`}
                  >
                    ₹{b}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E8E4DC] space-y-2">
              <label className="text-xs font-bold text-[#191C1E] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#1E3A5F]" />
                <span>Preferred Transport</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: "walking", label: "Walk" },
                  { id: "auto_rickshaw", label: "Auto" },
                  { id: "cab", label: "Cab" },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() =>
                      setBuilderTransport(
                        mode.id as "walking" | "auto_rickshaw" | "cab"
                      )
                    }
                    className={`py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      builderTransport === mode.id
                        ? "bg-[#1E3A5F] text-white border-[#1E3A5F]"
                        : "bg-white text-[#5A544B] border-[#E2DDD3] hover:border-[#1E3A5F]"
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Step 2: Select Candidate Stops */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-[#7A746B]">
                Select Places & Artisan Studios to Include ({selectedPlaceIds.length} selected)
              </label>
              <button
                type="button"
                onClick={() => setIsPlanScratchOpen(true)}
                className="text-xs font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
              >
                Open Quick Duration Modal
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {MOCK_PLACES.map((place) => {
                const isSelected = selectedPlaceIds.includes(place.id);
                return (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => togglePlace(place.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-start justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? "border-[#1E3A5F] bg-[#1E3A5F]/5 shadow-2xs"
                        : "border-[#E8E4DC] bg-white hover:border-[#C5BFB5]"
                    }`}
                  >
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A746B] block">
                        {place.category.replace("_", " ")}
                      </span>
                      <h4 className="text-xs font-bold text-[#191C1E]">
                        {place.name}
                      </h4>
                      <div className="flex items-center gap-2 text-[11px] text-[#5A544B]">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {place.typical_duration_minutes}m
                        </span>
                        <span>•</span>
                        <span>
                          {place.entry_fee_inr === 0
                            ? "Free"
                            : `₹${place.entry_fee_inr}`}
                        </span>
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected
                          ? "bg-[#1E3A5F] text-white"
                          : "border border-[#C5BFB5] bg-white"
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 3: Generate Action */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[#F0ECE1]">
            <p className="text-xs text-[#5A544B]">
              Ready to schedule <strong>{selectedPlaceIds.length} stops</strong> across{" "}
              <strong>{builderDays} {builderDays === 1 ? "day" : "days"}</strong> (Budget: ₹{builderBudget}).
            </p>
            <button
              type="button"
              onClick={() => handleGenerateTrip(false)}
              disabled={isGenerating || selectedPlaceIds.length === 0}
              className="py-3 px-6 rounded-xl bg-[#1E3A5F] text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-[#152842] transition-colors cursor-pointer disabled:opacity-50"
            >
              <span>
                {isGenerating
                  ? "Generating Itinerary..."
                  : `Generate ${builderDays}-Day Itinerary & Launch Trip`}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      </main>

      <FloatingBasketButton onClick={() => setIsBasketOpen(true)} />
      <BasketDrawer isOpen={isBasketOpen} onClose={() => setIsBasketOpen(false)} />
      <PlanFromScratchModal
        isOpen={isPlanScratchOpen}
        onClose={() => setIsPlanScratchOpen(false)}
      />
      <BottomNav />
    </div>
  );
}
