"use client";

import React from "react";
import Link from "next/link";
import { MapPin, IndianRupee, Clock } from "lucide-react";
import { MockArtisan } from "@/lib/mockData";

interface ArtisanCardProps {
  artisan: MockArtisan;
}

export function ArtisanCard({ artisan }: ArtisanCardProps) {
  return (
    <div className="p-4 rounded-2xl border border-neutral-200/80 bg-white hover:border-amber-300 transition-all shadow-xs space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-[10px] font-bold text-[#E05A2B] uppercase tracking-wider">
            {artisan.craft_type}
          </span>
          <h3 className="font-bold text-neutral-900 text-sm mt-0.5">
            {artisan.artisan_name}
          </h3>
          <p className="text-[11px] text-neutral-500 flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3 text-neutral-400" />
            {artisan.address}
          </p>
        </div>

        {artisan.has_workshop && (
          <span className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-0.5">
            <IndianRupee className="w-3 h-3 stroke-[2.5]" />
            {artisan.workshop_fee_inr}
          </span>
        )}
      </div>

      <p className="text-xs text-neutral-600 line-clamp-2 leading-relaxed">
        {artisan.workshop_description}
      </p>

      <div className="flex items-center justify-between pt-1 border-t border-neutral-100 text-[11px] font-medium text-neutral-500">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-neutral-400" />
          {artisan.workshop_duration_minutes}m workshop
        </span>

        <Link
          href={`/artisans/${artisan.id}`}
          className="text-xs font-bold text-[#E05A2B] hover:underline"
        >
          View Profile &rarr;
        </Link>
      </div>
    </div>
  );
}
