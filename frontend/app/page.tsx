"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Compass,
  ArrowRight,
  Navigation,
  Palette,
  Sparkles,
  MessageSquare,
  Landmark,
} from "lucide-react";
import { Header } from "@/components/common/Header";
import { BottomNav } from "@/components/common/BottomNav";
import { BasketDrawer } from "@/components/basket/BasketDrawer";
import { FloatingBasketButton } from "@/components/basket/FloatingBasketButton";
import { AIChatDrawer } from "@/components/trip/AIChatDrawer";
import { useTrip } from "@/context/TripContext";
import { useAuth } from "@/context/AuthContext";

export default function TouristHomePage() {
  const router = useRouter();
  const { user, isAuthenticated, isAdmin, isLoading } = useAuth();
  const { tripTitle, stops, revision } = useTrip();

  const [isBasketOpen, setIsBasketOpen] = useState(false);
  const [isGeminiCompanionOpen, setIsGeminiCompanionOpen] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.replace("/login");
      } else if (isAdmin) {
        router.replace("/admin");
      }
    }
  }, [isLoading, isAuthenticated, isAdmin, router]);

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

        {/* 2. TOP HERO: Cultured Local Companion & Udaipur Heritage District Explorer */}
        <section className="rounded-2xl border border-[#E8E4DC] bg-white p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E4DC] pb-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#9E7432] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#9E7432]" />
                <span>Ask Your Cultured Local Friend • Gemini Companion</span>
              </span>
              <h2 className="font-serif text-2xl text-[#191C1E] mt-0.5">
                Explore Udaipur by Heritage District & Living Craft
              </h2>
              <p className="text-xs text-[#7A746B] mt-0.5">
                Intelligent, context-aware suggestions tailored to Udaipur&apos;s narrow alleys, temple customs, afternoon heat, and living artisan traditions.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsGeminiCompanionOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-[#1E3A5F] text-white text-xs font-bold flex items-center gap-2 hover:bg-[#152842] transition-colors cursor-pointer shrink-0 shadow-2xs"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Open Gemini Companion</span>
            </button>
          </div>

          {/* District Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                title: "Jagdish Chowk & Gangaur Ghat",
                tag: "Miniature Art & Temples",
                description:
                  "Centuries of royal Mewar miniature painting, morning temple bells, and sunset puppet dances at Bagore Ki Haveli.",
                stops: "City Palace • Jagdish Temple • Master Mohanlal",
                href: "/trails",
                icon: Landmark,
              },
              {
                title: "Chandpole & Lake Pichola",
                tag: "Lakeside Ghats & Silvercraft",
                description:
                  "Pedestrian stone footbridges, serene lakefront ghats, authentic silver filigree workshops, and quiet rooftop Mewari tea.",
                stops: "Gangaur Ghat • Ambrai Ghat • Rooftop Cafes",
                href: "/trails",
                icon: Navigation,
              },
              {
                title: "Hathi Pol & Clock Tower",
                tag: "Bazaars & Leathercraft",
                description:
                  "Vibrant historic bazaars filled with camel-leather Mojaris, Pichwai fabric paintings, and fragrant Mewari spices.",
                stops: "Clock Tower Bazaars • Mojari Alleys",
                href: "/artisans",
                icon: Palette,
              },
              {
                title: "Molela & Shilpgram",
                tag: "Terracotta & Folk Traditions",
                description:
                  "Generational terracotta votive plaques made by master potters, and traditional rural artisan craft colonies.",
                stops: "Molela Terracotta • Folk Art Studios",
                href: "/artisans",
                icon: Compass,
              },
            ].map((district) => {
              const IconComponent = district.icon;
              return (
                <Link
                  key={district.title}
                  href={district.href}
                  className="p-4 rounded-xl border border-[#E8E4DC] bg-[#FAF8F5] hover:border-[#1E3A5F] hover:bg-white hover:shadow-xs transition-all flex flex-col justify-between space-y-3 group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#9E7432] bg-[#9E7432]/10 px-2 py-0.5 rounded-full">
                        {district.tag}
                      </span>
                      <IconComponent className="w-4 h-4 text-[#7A746B] group-hover:text-[#1E3A5F] transition-colors" />
                    </div>
                    <h3 className="font-serif text-sm font-bold text-[#191C1E] group-hover:text-[#1E3A5F] transition-colors">
                      {district.title}
                    </h3>
                    <p className="text-[11px] text-[#5A544B] leading-relaxed line-clamp-3">
                      {district.description}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-[#E8E4DC]/60 flex items-center justify-between text-[10px] text-[#7A746B] font-medium">
                    <span className="truncate">{district.stops}</span>
                    <ArrowRight className="w-3 h-3 text-[#1E3A5F] shrink-0 ml-1 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* 3. Quick Navigation Flow Cards (3 Pillars for Tourists) */}
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
      </main>

      <FloatingBasketButton onClick={() => setIsBasketOpen(true)} />
      <BasketDrawer isOpen={isBasketOpen} onClose={() => setIsBasketOpen(false)} />
      <AIChatDrawer
        isOpen={isGeminiCompanionOpen}
        onClose={() => setIsGeminiCompanionOpen(false)}
      />
      <BottomNav />
    </div>
  );
}
