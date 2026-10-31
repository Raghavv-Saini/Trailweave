"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Compass,
  ArrowRight,
  Calendar,
  Mic,
  Clock,
  MapPin,
  Check,
  ChevronRight,
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

interface CuratorPreset {
  id: string;
  name: string;
  headline: string;
  durationText: string;
  stopsSummary: string;
  estimatedCost: string;
  matchedTrailId: string;
  highlights: string[];
}

const CURATOR_PRESETS: CuratorPreset[] = [
  {
    id: "sunrise-craft",
    name: "Lake Dawn & Miniature Art",
    headline: "Gangaur Ghat morning aarti, stepwell shadows, and live stone pigment grinding.",
    durationText: "4.5 hours active • 12 mins walking",
    stopsSummary: "3 curated stops",
    estimatedCost: "₹850",
    matchedTrailId: "trail_udaipur_1",
    highlights: ["Gangaur Ghat", "Jagdish Stepwell", "Shankar Lal Atelier"],
  },
  {
    id: "haveli-heritage",
    name: "Old City Haveli Courtyards",
    headline: "Walking the narrow stone streets too compact for autorickshaws, ending at Ambrai.",
    durationText: "6.0 hours active • Old City pedestrian zone",
    stopsSummary: "4 curated stops",
    estimatedCost: "₹1,400",
    matchedTrailId: "trail_udaipur_2",
    highlights: ["Bagore ki Haveli", "Chandpole Alleys", "Block Print Vat", "Ambrai Ghat"],
  },
  {
    id: "clay-shilpgram",
    name: "Terracotta & Village Crafts",
    headline: "Suburban pottery kiln trails, hollow terracotta plaques, and rustic courtyard studios.",
    durationText: "5.0 hours active • Suburban ride",
    stopsSummary: "3 curated stops",
    estimatedCost: "₹650",
    matchedTrailId: "trail_udaipur_3",
    highlights: ["Fateh Sagar Rim", "Shilpgram Guild", "Molela Clay Studio"],
  },
];

export default function Home() {
  const { totalCount, addAllStops } = useBasket();
  const [isBasketOpen, setIsBasketOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [activeCuratorId, setActiveCuratorId] = useState<string>("sunrise-craft");

  // Modals state
  const [isPlanScratchOpen, setIsPlanScratchOpen] = useState(false);
  const [baseTrailCandidate, setBaseTrailCandidate] = useState<MockTrail | null>(null);

  const categories = ["all", "heritage", "crafts", "food", "walking"];

  // Filter featured community trails
  const featuredTrails = MOCK_TRAILS.filter((t) => {
    if (selectedCategory === "all") return true;
    return t.tags.includes(selectedCategory);
  });

  const activePreset =
    CURATOR_PRESETS.find((p) => p.id === activeCuratorId) || CURATOR_PRESETS[0];

  const handleUseAsBaseClick = (trail: MockTrail) => {
    if (totalCount > 0) {
      setBaseTrailCandidate(trail);
    } else {
      addAllStops(trail, "replace");
      setIsBasketOpen(true);
    }
  };

  const handleAdoptCuratorPreset = () => {
    const targetTrail =
      MOCK_TRAILS.find((t) => t.id === activePreset.matchedTrailId) || MOCK_TRAILS[0];
    handleUseAsBaseClick(targetTrail);
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
      {/* Top Header */}
      <Header onBasketClick={() => setIsBasketOpen(true)} />

      {/* Main Responsive Canvas */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-10 sm:space-y-14">
        {/* Editorial Hero & The Living Curator */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Authoritative Editorial Statement & Living Curator */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-3">
              <span className="text-[11px] font-bold tracking-widest uppercase text-[#9E7432] block">
                Udaipur Pilot • Living Travel Dossier
              </span>
              <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal text-[#191C1E] leading-[1.12] tracking-tight">
                The Pichola Shore at Dawn. The Alleys of Mewar by Noon.
              </h1>
              <p className="text-sm sm:text-base text-[#5A544B] leading-relaxed max-w-xl font-normal">
                Authentic, completed journeys by real travelers and master craftsmen.
                No sponsored tourist traps. Hand-pick stops into your basket or navigate live with quiet,
                constraint-aware AI guidance.
              </p>
            </div>

            {/* The Living Curator (Interactive Tactile Widget) */}
            <div className="rounded-2xl border border-[#E8E4DC] bg-white p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#7A746B]">
                    Living Curator • Choose Your Day&apos;s Tempo
                  </h3>
                  <p className="text-xs text-[#191C1E] font-medium mt-0.5">
                    Select a cadence to immediately inspect verified transit timings and artisan studios.
                  </p>
                </div>
              </div>

              {/* Tempo Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {CURATOR_PRESETS.map((preset) => {
                  const isSelected = preset.id === activeCuratorId;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setActiveCuratorId(preset.id)}
                      className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                        isSelected
                          ? "border-[#1E3A5F] bg-[#1E3A5F]/5 shadow-2xs"
                          : "border-[#E8E4DC] hover:border-[#C5BFB5] bg-[#FDFBF7]/60"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-bold ${isSelected ? "text-[#1E3A5F]" : "text-[#191C1E]"}`}>
                          {preset.name}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#1E3A5F]" />}
                      </div>
                      <span className="text-[10px] text-[#7A746B] block">
                        {preset.durationText.split("•")[0]}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Active Preset Inspection Panel */}
              <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#ECE7DE] space-y-3">
                <p className="text-xs text-[#3D3830] leading-relaxed font-serif italic">
                  &ldquo;{activePreset.headline}&rdquo;
                </p>

                <div className="flex flex-wrap items-center gap-3 text-xs text-[#5A544B]">
                  <span className="flex items-center gap-1 font-medium">
                    <Clock className="w-3.5 h-3.5 text-[#9A948B]" />
                    {activePreset.durationText}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-[#9A948B]" />
                    {activePreset.stopsSummary}
                  </span>
                  <span>•</span>
                  <span className="font-bold text-[#1E3A5F]">
                    Est. {activePreset.estimatedCost}
                  </span>
                </div>

                {/* Stop Highlights Bar */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {activePreset.highlights.map((stop, idx) => (
                    <span
                      key={stop}
                      className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-white border border-[#E8E4DC] text-[#3D3830]"
                    >
                      {idx + 1}. {stop}
                    </span>
                  ))}
                </div>

                <div className="pt-2 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleAdoptCuratorPreset}
                    className="text-xs font-bold px-4 py-2 rounded-xl bg-[#1E3A5F] text-white hover:bg-[#152842] active:scale-98 transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <span>Adopt This Day as Base</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <Link
                    href={`/trails/${activePreset.matchedTrailId}`}
                    className="text-xs font-semibold text-[#5A544B] hover:text-[#1E3A5F] transition-colors"
                  >
                    Examine full itinerary &rarr;
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Evocative Visual & Cultural Context */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl border border-[#E8E4DC] overflow-hidden bg-white shadow-sm">
              <div className="relative aspect-4/3 sm:aspect-16/10 lg:aspect-4/3 bg-[#E8E4DC] overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=1200&q=80"
                  alt="Udaipur Lake Pichola Ghat and City Palace at Sunrise"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-5">
                  <div className="text-white space-y-0.5">
                    <p className="text-[10px] tracking-wider uppercase font-semibold text-white/80">
                      Field Note • Pichola Waterfront
                    </p>
                    <h2 className="font-serif text-lg font-normal text-white">
                      Gangaur Ghat Steps
                    </h2>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-white border-t border-[#F0ECE1] flex items-center justify-between text-xs text-[#7A746B]">
                <span>Old City Heritage Corridor</span>
                <span className="font-mono text-[11px]">24.579° N, 73.683° E</span>
              </div>
            </div>

            {/* Discreet Live Companion Status Callout */}
            <div className="p-4 rounded-xl border border-[#E8E4DC] bg-[#FAF8F5] flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-[#191C1E]">
                  In-Trip Companion Active Engine
                </p>
                <p className="text-[11px] text-[#7A746B]">
                  Deterministic recalculations under real Udaipur gate hours and Old City road rules.
                </p>
              </div>
              <Link
                href="/trip"
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white border border-[#E2DDD3] text-[#1E3A5F] hover:bg-[#F0ECE1] transition-colors shrink-0"
              >
                Launch Companion
              </Link>
            </div>
          </div>
        </section>

        {/* 3 Entry Pillars (Responsive 3-Column Grid) */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
          {/* Pillar 1: Explore Community Trails */}
          <Link
            href="/trails"
            className="p-5 rounded-2xl bg-white border border-[#E8E4DC] hover:border-[#1E3A5F] hover:shadow-md transition-all group flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-xl bg-[#1E3A5F]/10 text-[#1E3A5F] flex items-center justify-center">
                <Compass className="w-5 h-5 stroke-[1.8]" />
              </div>
              <h3 className="font-serif text-lg font-bold text-[#191C1E] group-hover:text-[#1E3A5F] transition-colors">
                Community Trails
              </h3>
              <p className="text-xs text-[#5A544B] leading-relaxed">
                Browse tested itineraries authored by experienced travelers, inspect verified stops, and adopt them into your personal basket.
              </p>
            </div>
            <div className="flex items-center text-xs font-bold text-[#1E3A5F] gap-1 pt-1">
              <span>View collection</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Pillar 2: Plan from Scratch */}
          <button
            type="button"
            onClick={() => setIsPlanScratchOpen(true)}
            className="p-5 rounded-2xl bg-white border border-[#E8E4DC] hover:border-[#1E3A5F] hover:shadow-md transition-all group flex flex-col justify-between space-y-3 text-left cursor-pointer"
          >
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-xl bg-[#9E7432]/10 text-[#9E7432] flex items-center justify-center">
                <Calendar className="w-5 h-5 stroke-[1.8]" />
              </div>
              <h3 className="font-serif text-lg font-bold text-[#191C1E] group-hover:text-[#1E3A5F] transition-colors">
                Plan From Scratch
              </h3>
              <p className="text-xs text-[#5A544B] leading-relaxed">
                Define your dates, pace, and spending limit. The deterministic engine calculates an optimal day itinerary with zero fluff.
              </p>
            </div>
            <div className="flex items-center text-xs font-bold text-[#9E7432] gap-1 pt-1">
              <span>Configure trip constraints</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Pillar 3: Artisan Self-Service Voice Portal */}
          <Link
            href="/artisans/onboard"
            className="p-5 rounded-2xl bg-white border border-[#E8E4DC] hover:border-[#1E3A5F] hover:shadow-md transition-all group flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-800 flex items-center justify-center">
                <Mic className="w-5 h-5 stroke-[1.8]" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 uppercase">
                  कारीगर पोर्टल
                </span>
              </div>
              <h3 className="font-serif text-lg font-bold text-[#191C1E] group-hover:text-[#1E3A5F] transition-colors">
                उदयपुर कारीगर ऑनबोर्डिंग
              </h3>
              <p className="text-xs text-[#5A544B] leading-relaxed">
                4-अंकों के पिन और 1-टैप हिंदी वॉइस नोट से अपनी दुकान व वर्कशॉप सीधे पर्यटकों के लाइव साथी से जोड़ें।
              </p>
            </div>
            <div className="flex items-center text-xs font-bold text-amber-900 gap-1 pt-1">
              <span>आवाज़ से जुड़ें</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </section>

        {/* Featured Community Trails Gallery (Responsive Grid) */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b border-[#E8E4DC]">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#9E7432]">
                Tested Field Routes
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-normal text-[#191C1E]">
                Featured Traveler Trails
              </h2>
              <p className="text-xs sm:text-sm text-[#7A746B]">
                Completed itineraries with verified timing, authentic walking paths, and artisan studio access.
              </p>
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar shrink-0">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors capitalize cursor-pointer ${
                    selectedCategory === cat
                      ? "bg-[#1E3A5F] text-white shadow-xs"
                      : "bg-white text-[#5A544B] border border-[#E8E4DC] hover:border-[#C5BFB5]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* 3-Column Responsive Grid on Desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredTrails.map((trail) => (
              <TrailCard
                key={trail.id}
                trail={trail}
                onUseAsBase={handleUseAsBaseClick}
              />
            ))}
          </div>
        </section>
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

      {/* Bottom Navigation Bar (Visible on mobile, hidden on desktop md:hidden) */}
      <BottomNav />
    </div>
  );
}
