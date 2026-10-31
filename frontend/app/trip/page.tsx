"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Header } from "@/components/common/Header";
import { BottomNav } from "@/components/common/BottomNav";
import { ActiveStopCard } from "@/components/trip/ActiveStopCard";
import { TimelineList } from "@/components/trip/TimelineList";
import { ManualCheckinModal } from "@/components/trip/ManualCheckinModal";
import { AIChatDrawer } from "@/components/trip/AIChatDrawer";
import { useTrip, TripStop } from "@/context/TripContext";
import { Sparkles, Edit3 } from "lucide-react";

export default function ActiveTripPage() {
  const { stops, revision, markVisited } = useTrip();
  const [selectedStop, setSelectedStop] = useState<TripStop | null>(null);
  const [isCheckinOpen, setIsCheckinOpen] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);

  const activeStop = stops.find((s) => s.visit_status === "pending") || stops[0];

  const handleTriggerCheckin = (stopId: string) => {
    const s = stops.find((item) => item.id === stopId);
    if (s) {
      setSelectedStop(s);
      setIsCheckinOpen(true);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between">
      <Header title="Active Trip Companion" subtitle={`Revision ${revision} • Live Udaipur`} />

      <main className="flex-1 px-5 py-4 space-y-5 overflow-y-auto">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsAIChatOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-[#E05A2B] border border-amber-200 text-xs font-bold shadow-xs hover:bg-amber-100/70"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ask Gemini Companion</span>
          </button>

          <Link
            href="/trip/edit"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 text-neutral-700 hover:bg-neutral-200 text-xs font-semibold"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Stops</span>
          </Link>
        </div>

        {activeStop && (
          <ActiveStopCard
            stop={activeStop}
            onManualCheckin={handleTriggerCheckin}
          />
        )}

        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Today&apos;s Itinerary Timeline
          </h3>
          <TimelineList stops={stops} />
        </div>
      </main>

      <ManualCheckinModal
        stop={selectedStop}
        isOpen={isCheckinOpen}
        onClose={() => setIsCheckinOpen(false)}
        onConfirm={(id) => markVisited(id, "manual_fallback")}
      />

      <AIChatDrawer isOpen={isAIChatOpen} onClose={() => setIsAIChatOpen(false)} />
      <BottomNav />
    </div>
  );
}
