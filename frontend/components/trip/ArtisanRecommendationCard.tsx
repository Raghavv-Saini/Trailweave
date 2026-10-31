"use client";

import React from "react";
import {
  Sparkles,
  Clock,
  Navigation,
  IndianRupee,
  Plus,
  Check,
  Palette,
} from "lucide-react";

export interface ArtisanRecommendation {
  artisan_id: string;
  place_id: string;
  artisan_name: string;
  craft_type: string;
  offering_type: "workshop" | "store";
  fee_inr: number;
  duration_minutes: number;
  detour_minutes: number;
  optimal_insert_order: number;
  rationale: string;
  latitude: number;
  longitude: number;
  address?: string;
  image_url?: string;
  opening_time?: string;
  closing_time?: string;
  has_workshop?: boolean;
  workshop_description?: string;
}

interface ArtisanRecommendationCardProps {
  recommendation: ArtisanRecommendation;
  onAccept: (rec: ArtisanRecommendation) => void;
  isStaged?: boolean;
  isLoading?: boolean;
}

export function ArtisanRecommendationCard({
  recommendation,
  onAccept,
  isStaged = false,
  isLoading = false,
}: ArtisanRecommendationCardProps) {
  const {
    artisan_name,
    craft_type,
    offering_type,
    fee_inr,
    duration_minutes,
    detour_minutes,
    rationale,
    image_url,
    address,
  } = recommendation;

  return (
    <div
      className={`p-3.5 rounded-2xl border transition-all shadow-2xs ${
        isStaged
          ? "bg-emerald-50/80 border-emerald-300 ring-1 ring-emerald-400"
          : "bg-white border-[#E8E4DC] hover:border-[#1E3A5F]/40 hover:shadow-xs"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Thumbnail */}
        <div className="w-16 h-16 rounded-xl overflow-hidden bg-neutral-100 shrink-0 relative border border-[#E8E4DC]">
          {image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image_url}
              alt={artisan_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#1E3A5F] bg-[#1E3A5F]/10">
              <Palette className="w-6 h-6" />
            </div>
          )}
          <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded text-[9px] font-extrabold bg-neutral-900/80 text-white backdrop-blur-xs">
            +{detour_minutes}m
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#1E3A5F]/10 text-[#1E3A5F] border border-[#1E3A5F]/20 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-[#1E3A5F]" />
              {craft_type}
            </span>
            <span className="text-[10px] font-semibold text-neutral-500">
              {offering_type === "workshop" ? "Masterclass" : "Studio Visit"}
            </span>
          </div>

          <h4 className="font-serif text-sm font-medium text-[#191C1E] truncate">
            {artisan_name}
          </h4>

          {address && (
            <p className="text-[11px] text-[#7A746B] truncate">{address}</p>
          )}

          {/* Timing & Cost badges */}
          <div className="flex items-center gap-3 pt-0.5 text-[11px] font-medium text-neutral-600">
            <span className="flex items-center gap-1">
              <Navigation className="w-3 h-3 text-[#1E3A5F]" />
              <span className="font-bold text-[#191C1E]">
                {detour_minutes} min
              </span>{" "}
              detour
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#7A746B]" />
              <span>{duration_minutes}m</span>
            </span>
            <span className="flex items-center gap-0.5 text-emerald-800 font-bold">
              <IndianRupee className="w-3 h-3" />
              {fee_inr === 0 ? "Free entry" : `₹${fee_inr}`}
            </span>
          </div>
        </div>
      </div>

      {/* Transparent Rationale Box */}
      <div className="mt-2.5 p-2 rounded-xl bg-[#FBF9F5] border border-[#E8E4DC] text-[11px] text-[#3F464C] flex items-start gap-1.5 leading-snug">
        <Sparkles className="w-3.5 h-3.5 text-[#1E3A5F] shrink-0 mt-0.5" />
        <p className="font-medium">{rationale}</p>
      </div>

      {/* 1-Tap Action Button */}
      <div className="mt-2.5 flex items-center justify-end">
        {isStaged ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100/70 px-3 py-1.5 rounded-xl">
            <Check className="w-3.5 h-3.5" /> Added to Itinerary
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onAccept(recommendation)}
            disabled={isLoading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#1E3A5F] hover:bg-[#152943] active:scale-95 text-white text-xs font-bold shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Accept &amp; Add to Route</span>
          </button>
        )}
      </div>
    </div>
  );
}
