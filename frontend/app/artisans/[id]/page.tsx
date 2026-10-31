"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, IndianRupee, Clock } from "lucide-react";
import { Header } from "@/components/common/Header";
import { BottomNav } from "@/components/common/BottomNav";
import { MOCK_ARTISANS } from "@/lib/mockData";

export default function ArtisanDetailPage() {
  const artisan = MOCK_ARTISANS[0];

  return (
    <div className="flex-1 flex flex-col justify-between">
      <Header />

      <main className="flex-1 px-5 py-4 space-y-4 overflow-y-auto">
        <Link
          href="/artisans"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Artisans
        </Link>

        <div className="p-5 rounded-2xl bg-amber-50/60 border border-amber-200/60 space-y-2">
          <span className="text-[10px] font-bold text-[#E05A2B] uppercase tracking-wider">
            {artisan.craft_type}
          </span>
          <h2 className="text-lg font-bold text-neutral-900">{artisan.artisan_name}</h2>
          <p className="text-xs text-neutral-500 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-neutral-400" />
            {artisan.address}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-neutral-200 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Workshop Masterclass Details
          </h3>
          <p className="text-xs text-neutral-700 leading-relaxed">
            {artisan.workshop_description}
          </p>

          <div className="flex items-center justify-between pt-2 border-t border-neutral-100 text-xs font-semibold">
            <span className="flex items-center gap-1 text-neutral-600">
              <Clock className="w-3.5 h-3.5 text-neutral-400" />
              Duration: {artisan.workshop_duration_minutes} mins
            </span>
            <span className="flex items-center gap-0.5 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
              <IndianRupee className="w-3.5 h-3.5" />
              {artisan.workshop_fee_inr} fee
            </span>
          </div>
        </div>

        <button
          onClick={() => alert("Added artisan workshop to personal basket")}
          className="w-full py-3 rounded-xl bg-[#E05A2B] text-white font-bold text-xs shadow-sm hover:bg-[#c94d23]"
        >
          Add to Trip Route
        </button>
      </main>

      <BottomNav />
    </div>
  );
}
