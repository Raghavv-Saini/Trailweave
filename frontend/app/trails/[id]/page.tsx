"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, Plus, Check } from "lucide-react";
import { Header } from "@/components/common/Header";
import { BottomNav } from "@/components/common/BottomNav";
import { BasketDrawer } from "@/components/basket/BasketDrawer";
import { MOCK_TRAILS } from "@/lib/mockData";
import { useBasket } from "@/context/BasketContext";

export default function TrailDetailPage() {
  const [isBasketOpen, setIsBasketOpen] = useState(false);
  const { addItem, isInBasket } = useBasket();
  const trail = MOCK_TRAILS[0];

  return (
    <div className="flex-1 flex flex-col justify-between">
      <Header onBasketClick={() => setIsBasketOpen(true)} />

      <main className="flex-1 px-5 py-4 space-y-4 overflow-y-auto">
        <Link
          href="/trails"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Trails
        </Link>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-neutral-900 leading-snug">{trail.title}</h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-50 text-[#E05A2B]">
              ₹{trail.estimated_cost_inr}
            </span>
          </div>
          <p className="text-xs text-neutral-600">
            Author: <span className="font-semibold">{trail.author_name}</span> • {trail.total_duration_hours} hrs
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Relative Stop Timeline
          </h3>

          <div className="space-y-3">
            {trail.stops?.map((stop) => {
              const inBasket = isInBasket(stop.place_id);
              return (
                <div
                  key={stop.id}
                  className="p-4 rounded-xl border border-neutral-200/80 bg-white space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                        {stop.time_slot.replace("_", " ")}
                      </span>
                      <h4 className="text-xs font-bold text-neutral-900 mt-1">{stop.place_name}</h4>
                      <p className="text-[11px] text-neutral-400 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {stop.suggested_duration_minutes}m duration
                      </p>
                    </div>

                    <button
                      onClick={() =>
                        addItem(
                          {
                            id: stop.place_id,
                            name: stop.place_name,
                            category: "heritage",
                            latitude: 24.5764,
                            longitude: 73.6835,
                            address: "Old City, Udaipur",
                            entry_fee_inr: 0,
                            typical_duration_minutes: stop.suggested_duration_minutes,
                          },
                          trail.id,
                          trail.title
                        )
                      }
                      className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${
                        inBasket
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-neutral-100 text-neutral-800 hover:bg-[#E05A2B] hover:text-white"
                      }`}
                    >
                      {inBasket ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <p className="text-[11px] text-neutral-600 bg-neutral-50 p-2.5 rounded-lg border border-neutral-100 italic">
                    💡 &quot;{stop.traveler_tip}&quot;
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <BasketDrawer isOpen={isBasketOpen} onClose={() => setIsBasketOpen(false)} />
      <BottomNav />
    </div>
  );
}
