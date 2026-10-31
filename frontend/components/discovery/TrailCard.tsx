"use client";

import React from "react";
import Link from "next/link";
import { Clock, MapPin, IndianRupee, Award, ArrowRight, Sparkles, Layers } from "lucide-react";
import { MockTrail } from "@/lib/mockData";

interface TrailCardProps {
  trail: MockTrail;
  onUseAsBase?: (trail: MockTrail) => void;
}

export function TrailCard({ trail, onUseAsBase }: TrailCardProps) {
  return (
    <div className="p-4 rounded-2xl border border-neutral-200/90 bg-white hover:border-amber-300 transition-all shadow-xs space-y-3">
      {/* Top Header: Title, Author, Cost */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {trail.is_featured && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 inline-flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5 text-[#E05A2B]" />
                Featured
              </span>
            )}
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600">
              {trail.duration_type === "multi_day" ? `${trail.total_days} Days` : "1 Day"}
            </span>
          </div>

          <h3 className="font-bold text-neutral-900 text-sm leading-snug pt-0.5">
            {trail.title}
          </h3>
          <p className="text-[11px] text-neutral-500">
            By <span className="font-semibold text-neutral-700">{trail.author_name}</span>
          </p>
        </div>

        <span className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-50 text-[#E05A2B] border border-amber-100/80 flex items-center shadow-2xs">
          <IndianRupee className="w-3 h-3 stroke-[2.5]" />
          {trail.estimated_cost_inr.toLocaleString()}
        </span>
      </div>

      {/* Description Snippet */}
      {trail.description && (
        <p className="text-xs text-neutral-600 line-clamp-2 leading-relaxed">
          {trail.description}
        </p>
      )}

      {/* Key Metrics: Duration, Stops, Experienced Badge */}
      <div className="flex items-center gap-2.5 text-[11px] text-neutral-500 font-medium flex-wrap">
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-neutral-400" />
          {trail.total_duration_hours}h active
        </span>
        <span>•</span>
        <span className="flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-neutral-400" />
          {trail.stops_count} stops
        </span>
        {trail.is_experienced && (
          <>
            <span>•</span>
            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
              <Award className="w-3 h-3 text-emerald-600" />
              Experienced Trail
            </span>
          </>
        )}
      </div>

      {/* Tags */}
      {trail.tags && trail.tags.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap pt-0.5">
          {trail.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] font-medium text-neutral-500 bg-neutral-100/80 px-2 py-0.5 rounded-full capitalize"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions: "Pick Individual Stops" vs "Use as Base" */}
      <div className="flex items-center justify-between pt-2 border-t border-neutral-100 gap-2">
        <Link
          href={`/trails/${trail.id}`}
          className="text-xs font-semibold text-neutral-700 hover:text-[#E05A2B] inline-flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg hover:bg-neutral-50 transition-colors"
        >
          <Layers className="w-3.5 h-3.5 text-neutral-400" />
          <span>Pick Individual Stops</span>
          <ArrowRight className="w-3 h-3 text-neutral-400" />
        </Link>

        {onUseAsBase && (
          <button
            type="button"
            onClick={() => onUseAsBase(trail)}
            className="text-xs font-bold px-3.5 py-1.5 rounded-xl bg-neutral-900 text-white hover:bg-[#E05A2B] active:scale-95 transition-all shadow-xs"
          >
            Use as Base
          </button>
        )}
      </div>
    </div>
  );
}
