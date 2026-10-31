"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  Plus,
  Check,
  IndianRupee,
  MapPin,
  Sparkles,
  Award,
  Layers,
  Copy,
} from "lucide-react";
import { Header } from "@/components/common/Header";
import { BottomNav } from "@/components/common/BottomNav";
import { BasketDrawer } from "@/components/basket/BasketDrawer";
import { FloatingBasketButton } from "@/components/basket/FloatingBasketButton";
import { UseAsBaseModal } from "@/components/common/UseAsBaseModal";
import { MOCK_TRAILS, MockPlace, MockTrail, MockTrailStop } from "@/lib/mockData";
import { useBasket } from "@/context/BasketContext";

export default function TrailDetailPage() {
  const params = useParams();
  const trailId = params?.id as string;

  const [isBasketOpen, setIsBasketOpen] = useState(false);
  const [isBaseModalOpen, setIsBaseModalOpen] = useState(false);

  const { addItem, removeItem, addAllStops, isInBasket, totalCount } = useBasket();

  // Find trail by ID or fallback to first trail
  const trail: MockTrail =
    MOCK_TRAILS.find((t) => t.id === trailId) || MOCK_TRAILS[0];

  const handleToggleStop = (stop: MockTrailStop) => {
    if (isInBasket(stop.place_id)) {
      removeItem(stop.place_id);
    } else {
      const placeData: MockPlace = {
        id: stop.place_id,
        name: stop.place_name,
        category: (stop.category as MockPlace["category"]) || "heritage",
        latitude: 24.5764,
        longitude: 73.6835,
        address: "Old City, Udaipur",
        entry_fee_inr: stop.entry_fee_inr ?? 0,
        typical_duration_minutes: stop.suggested_duration_minutes,
      };

      addItem(placeData, {
        trailId: trail.id,
        trailTitle: trail.title,
        authorName: trail.author_name,
      });
    }
  };

  const handleUseAsBaseClick = () => {
    if (totalCount > 0) {
      setIsBaseModalOpen(true);
    } else {
      addAllStops(trail, "replace");
      setIsBasketOpen(true);
    }
  };

  const handleConfirmUseAsBase = (mode: "replace" | "merge") => {
    addAllStops(trail, mode);
    setIsBaseModalOpen(false);
    setIsBasketOpen(true);
  };

  const formatTimeSlot = (slot: string) => {
    switch (slot) {
      case "morning":
        return "Morning (09:00 - 12:00)";
      case "afternoon":
        return "Afternoon (12:00 - 16:30)";
      case "sunset_evening":
        return "Sunset / Evening (16:30 - 19:30)";
      case "night":
        return "Night (19:30 - 22:00)";
      default:
        return slot.replace("_", " ");
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between min-h-screen bg-neutral-50/50 pb-20">
      <Header
        title="Trail Details"
        subtitle="Authentic traveler itinerary"
        onBasketClick={() => setIsBasketOpen(true)}
      />

      <main className="flex-1 px-5 py-4 space-y-5 overflow-y-auto">
        {/* Back navigation */}
        <Link
          href="/trails"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to All Trails
        </Link>

        {/* Trail Overview Header Card */}
        <div className="p-5 rounded-3xl bg-white border border-neutral-200/90 shadow-xs space-y-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                {trail.is_featured && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 inline-flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-[#E05A2B]" />
                    Featured
                  </span>
                )}
                {trail.is_experienced && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-100 inline-flex items-center gap-1">
                    <Award className="w-3 h-3 text-emerald-600" />
                    Experienced Trail
                  </span>
                )}
              </div>

              <h1 className="text-lg font-extrabold text-neutral-900 leading-tight">
                {trail.title}
              </h1>
              <p className="text-xs text-neutral-500">
                Curated by <span className="font-semibold text-neutral-800">{trail.author_name}</span>
              </p>
            </div>

            <div className="shrink-0 text-right">
              <span className="inline-flex items-center text-sm font-extrabold text-[#E05A2B] bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-100">
                <IndianRupee className="w-3.5 h-3.5 stroke-[2.5]" />
                {trail.estimated_cost_inr.toLocaleString()}
              </span>
              <p className="text-[10px] text-neutral-400 font-medium mt-0.5">Est. Budget</p>
            </div>
          </div>

          <p className="text-xs text-neutral-600 leading-relaxed">
            {trail.description}
          </p>

          <div className="flex items-center gap-3 text-xs text-neutral-500 font-medium pt-1 border-t border-neutral-100">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-neutral-400" />
              {trail.total_duration_hours}h active
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-neutral-400" />
              {trail.stops_count} stops
            </span>
            <span>•</span>
            <span>{trail.duration_type === "multi_day" ? `${trail.total_days} Days` : "Single Day"}</span>
          </div>

          {/* Action: Use as Base */}
          <button
            type="button"
            onClick={handleUseAsBaseClick}
            className="w-full py-3 px-4 rounded-xl bg-neutral-900 text-white font-bold text-xs flex items-center justify-center gap-2 hover:bg-[#E05A2B] active:scale-[0.99] transition-all shadow-xs"
          >
            <Copy className="w-4 h-4 text-[#F59E0B]" />
            <span>Use Complete Trail as Base ({trail.stops_count} stops)</span>
          </button>
        </div>

        {/* Section Heading */}
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              <span>Relative Stop Timeline</span>
            </h2>
            <span className="text-[11px] text-neutral-400 font-medium">
              Tap &quot;+&quot; to pick stops into basket
            </span>
          </div>
        </div>

        {/* Stops List */}
        <div className="space-y-3 relative before:absolute before:left-4 before:top-4 before:bottom-4 before:w-0.5 before:bg-neutral-200">
          {(trail.stops || []).map((stop, index) => {
            const inBasket = isInBasket(stop.place_id);

            return (
              <div
                key={stop.id}
                className="relative pl-9 transition-all"
              >
                {/* Timeline Dot Number */}
                <div
                  className={`absolute left-1.5 top-3.5 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold z-10 transition-colors ${
                    inBasket
                      ? "bg-emerald-600 text-white ring-4 ring-emerald-100"
                      : "bg-white text-neutral-700 border-2 border-neutral-300"
                  }`}
                >
                  {index + 1}
                </div>

                {/* Stop Card */}
                <div className="p-4 rounded-2xl border border-neutral-200/90 bg-white hover:border-amber-300 transition-all shadow-xs space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md inline-block">
                        {formatTimeSlot(stop.time_slot)}
                      </span>
                      <h3 className="text-sm font-bold text-neutral-900 mt-1">
                        {stop.place_name}
                      </h3>
                      <div className="flex items-center gap-2 text-[11px] text-neutral-400 font-medium">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {stop.suggested_duration_minutes}m visit
                        </span>
                        {stop.estimated_transit_minutes > 0 && (
                          <>
                            <span>•</span>
                            <span>~{stop.estimated_transit_minutes}m transit next</span>
                          </>
                        )}
                        {stop.entry_fee_inr !== undefined && (
                          <>
                            <span>•</span>
                            <span className="text-neutral-700 font-semibold">
                              {stop.entry_fee_inr === 0 ? "Free" : `₹${stop.entry_fee_inr}`}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Pick Individual Stop Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleStop(stop)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                        inBasket
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-neutral-100 text-neutral-700 hover:bg-[#E05A2B] hover:text-white"
                      }`}
                    >
                      {inBasket ? (
                        <>
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>In Basket</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Add Stop</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Traveler Tip Quote */}
                  <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-100/70 text-[11px] text-amber-950/80 leading-relaxed italic">
                    💡 &quot;{stop.traveler_tip}&quot;
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Floating Basket Counter & Open Button */}
      <FloatingBasketButton onClick={() => setIsBasketOpen(true)} />

      {/* Slide-Up Basket Drawer */}
      <BasketDrawer isOpen={isBasketOpen} onClose={() => setIsBasketOpen(false)} />

      {/* Use As Base Confirmation Modal */}
      <UseAsBaseModal
        isOpen={isBaseModalOpen}
        trail={trail}
        currentBasketCount={totalCount}
        onClose={() => setIsBaseModalOpen(false)}
        onConfirm={handleConfirmUseAsBase}
      />

      <BottomNav />
    </div>
  );
}
