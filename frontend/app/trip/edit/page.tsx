"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUp, ArrowDown, SkipForward, Save } from "lucide-react";
import { Header } from "@/components/common/Header";
import { BottomNav } from "@/components/common/BottomNav";
import { useTrip } from "@/context/TripContext";

export default function TripEditPage() {
  const { stops, revision, markSkipped } = useTrip();

  return (
    <div className="flex-1 flex flex-col justify-between">
      <Header title="Edit Upcoming Stops" subtitle={`Base Revision ${revision}`} />

      <main className="flex-1 px-5 py-4 space-y-4 overflow-y-auto">
        <Link
          href="/trip"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Live Trip
        </Link>

        <p className="text-xs text-neutral-500">
          Reorder, skip, or pin upcoming stops. Submits to Replan Engine with optimistic concurrency locking.
        </p>

        <div className="space-y-2.5">
          {stops.map((stop, idx) => (
            <div
              key={stop.id}
              className="p-3.5 rounded-xl border border-neutral-200 bg-white flex items-center justify-between"
            >
              <div>
                <span className="text-[10px] font-bold text-neutral-400">Stop #{idx + 1}</span>
                <h4 className="text-xs font-bold text-neutral-900">{stop.name}</h4>
                <span className="text-[10px] text-neutral-500">{stop.suggested_duration_minutes}m</span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => markSkipped(stop.id)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-600 hover:bg-amber-50"
                  title="Skip Stop"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
                <button
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
                  title="Move Up"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
                  title="Move Down"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => alert("Replan preview submitted (Ticket 05)")}
          className="w-full py-3 rounded-xl bg-[#E05A2B] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm hover:bg-[#c94d23]"
        >
          <Save className="w-4 h-4" />
          <span>Save &amp; Preview Replan</span>
        </button>
      </main>

      <BottomNav />
    </div>
  );
}
