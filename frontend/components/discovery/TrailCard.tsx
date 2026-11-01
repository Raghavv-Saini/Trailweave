"use client";

import React from "react";
import Link from "next/link";
import { Clock, MapPin, IndianRupee, Award, ArrowRight, Layers } from "lucide-react";
import { MockTrail } from "@/lib/mockData";

interface TrailCardProps {
  trail: MockTrail;
  onUseAsBase?: (trail: MockTrail) => void;
}

function getTagStyle(tag: string): { label: string; className: string } {
  const normalized = tag.toLowerCase().trim();
  switch (normalized) {
    case "heritage":
      return {
        label: "Heritage",
        className: "bg-[#9E7432]/10 text-[#9E7432] border border-[#9E7432]/25",
      };
    case "artisan":
      return {
        label: "Artisan Craft",
        className: "bg-[#1E3A5F]/10 text-[#1E3A5F] border border-[#1E3A5F]/20",
      };
    case "walking":
      return {
        label: "Walking Route",
        className: "bg-emerald-50 text-emerald-800 border border-emerald-200/70",
      };
    case "food":
      return {
        label: "Local Food",
        className: "bg-[#FAF8F5] text-[#7A746B] border border-[#E8E4DC]",
      };
    case "evening":
      return {
        label: "Sunset / Evening",
        className: "bg-[#FAF8F5] text-[#7A746B] border border-[#E8E4DC]",
      };
    default:
      return {
        label:
          normalized.charAt(0).toUpperCase() +
          normalized.slice(1).replace("_", " "),
        className: "bg-[#FAF8F5] text-[#5A544B] border border-[#E8E4DC]",
      };
  }
}

export function TrailCard({ trail, onUseAsBase }: TrailCardProps) {
  return (
    <div className="p-5 rounded-2xl border border-[#E8E4DC] bg-white hover:border-[#1E3A5F]/40 hover:shadow-md transition-all shadow-2xs h-full flex flex-col justify-between space-y-4">
      <div className="space-y-3">
        {/* Top Header: Title, Author, Cost */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {trail.is_featured && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1E3A5F]/10 text-[#1E3A5F]">
                  Curated Edition
                </span>
              )}
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F4EFEB] text-[#5A544B]">
                {trail.duration_type === "multi_day" ? `${trail.total_days} Days` : "1 Day"}
              </span>
            </div>

            <h3 className="font-serif text-lg font-bold text-[#191C1E] leading-snug pt-0.5">
              {trail.title}
            </h3>
            <p className="text-xs text-[#7A746B]">
              Field notes by <span className="font-semibold text-[#191C1E]">{trail.author_name}</span>
            </p>
          </div>

          <span className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg bg-[#FAF8F5] text-[#1E3A5F] border border-[#E8E4DC] flex items-center shadow-2xs">
            <IndianRupee className="w-3 h-3 stroke-[2.2]" />
            {trail.estimated_cost_inr.toLocaleString()}
          </span>
        </div>

        {/* Description Snippet */}
        {trail.description && (
          <p className="text-xs text-[#5A544B] line-clamp-2 leading-relaxed">
            {trail.description}
          </p>
        )}

        {/* Key Metrics: Duration, Stops, Experienced Badge */}
        <div className="flex items-center gap-2.5 text-[11px] text-[#7A746B] font-medium flex-wrap pt-1">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-[#9A948B]" />
            {trail.total_duration_hours}h active
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-[#9A948B]" />
            {trail.stops_count} stops
          </span>
          {trail.is_experienced && (
            <>
              <span>•</span>
              <span className="inline-flex items-center gap-1 text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full text-[10px]">
                <Award className="w-3 h-3 text-emerald-600" />
                Verified Route
              </span>
            </>
          )}
        </div>

        {/* Tags */}
        {trail.tags && trail.tags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            {trail.tags.map((tag) => {
              const { label, className } = getTagStyle(tag);
              return (
                <span
                  key={tag}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${className}`}
                >
                  {label}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions: "Pick Individual Stops" vs "Use as Base" */}
      <div className="flex items-center justify-between pt-3 border-t border-[#F0ECE1] gap-2 mt-auto">
        <Link
          href={`/trails/${trail.id}`}
          className="text-xs font-semibold text-[#5A544B] hover:text-[#1E3A5F] inline-flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg hover:bg-[#F7F4EE] transition-colors"
        >
          <Layers className="w-3.5 h-3.5 text-[#9A948B]" />
          <span>Inspect Stops</span>
          <ArrowRight className="w-3 h-3 text-[#9A948B]" />
        </Link>

        {onUseAsBase && (
          <button
            type="button"
            onClick={() => onUseAsBase(trail)}
            className="text-xs font-bold px-3.5 py-1.5 rounded-xl bg-[#1E3A5F] text-white hover:bg-[#152842] active:scale-95 transition-all shadow-xs cursor-pointer"
          >
            Use as Base
          </button>
        )}
      </div>
    </div>
  );
}
