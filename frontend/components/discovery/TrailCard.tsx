"use client";

import React from "react";
import Link from "next/link";
import { Clock, MapPin, IndianRupee, Award, ArrowRight } from "lucide-react";
import { MockTrail } from "@/lib/mockData";

interface TrailCardProps {
  trail: MockTrail;
  onUseAsBase?: (trail: MockTrail) => void;
}

export function TrailCard({ trail, onUseAsBase }: TrailCardProps) {
  return (
    <div className="p-4 rounded-2xl border border-neutral-200/80 bg-white hover:border-amber-300 transition-all shadow-xs space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-neutral-900 text-sm leading-snug">
            {trail.title}
          </h3>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            By <span className="font-medium text-neutral-700">{trail.author_name}</span>
          </p>
        </div>

        <span className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-50 text-[#E05A2B] border border-amber-100 flex items-center">
          <IndianRupee className="w-3 h-3 stroke-[2.5]" />
          {trail.estimated_cost_inr.toLocaleString()}
        </span>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-neutral-500 font-medium">
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-neutral-400" />
          {trail.total_duration_hours}h
        </span>
        <span>•</span>
        <span className="flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-neutral-400" />
          {trail.stops_count} stops
        </span>
        {trail.is_experienced && (
          <>
            <span>•</span>
            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
              <Award className="w-3.5 h-3.5 text-emerald-600" />
              Experienced
            </span>
          </>
        )}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-neutral-100">
        <Link
          href={`/trails/${trail.id}`}
          className="text-xs font-semibold text-neutral-700 hover:text-[#E05A2B] inline-flex items-center gap-1"
        >
          View stops <ArrowRight className="w-3 h-3" />
        </Link>

        {onUseAsBase && (
          <button
            onClick={() => onUseAsBase(trail)}
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-neutral-900 text-white hover:bg-[#E05A2B] transition-colors"
          >
            Use as Base
          </button>
        )}
      </div>
    </div>
  );
}
