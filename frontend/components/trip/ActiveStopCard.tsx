"use client";

import React from "react";
import { Navigation, CheckCircle2, Clock, Pin } from "lucide-react";
import { TripStop } from "@/context/TripContext";

interface ActiveStopCardProps {
  stop: TripStop;
  onManualCheckin: (stopId: string) => void;
  onCheckout?: (stopId: string) => void;
}

export function ActiveStopCard({
  stop,
  onManualCheckin,
  onCheckout,
}: ActiveStopCardProps) {
  const isVisited = stop.visit_status === "visited";

  return (
    <div className="p-5 rounded-2xl border-2 border-[#E05A2B]/20 bg-gradient-to-br from-white to-amber-50/40 shadow-sm space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#E05A2B] bg-amber-100/70 px-2 py-0.5 rounded-md">
            {isVisited ? "Visited Stop" : "Current Active Stop"}
          </span>
          <h2 className="text-base font-bold text-neutral-900 mt-1.5 flex items-center gap-1.5">
            {stop.name}
            {stop.is_pinned && <Pin className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
          </h2>
          <p className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3 text-neutral-400" />
            Suggested: {stop.suggested_duration_minutes} mins
          </p>
        </div>

        <span
          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${
            isVisited
              ? "bg-emerald-100 text-emerald-800"
              : "bg-amber-100 text-amber-800"
          }`}
        >
          {stop.visit_status}
        </span>
      </div>

      <div className="flex items-center gap-2 pt-2">
        {!isVisited ? (
          <button
            onClick={() => onManualCheckin(stop.id)}
            className="flex-1 py-2.5 px-3 rounded-xl bg-[#E05A2B] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm hover:bg-[#c94d23] transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>1-Tap Check-In</span>
          </button>
        ) : (
          <button
            onClick={() => onCheckout && onCheckout(stop.id)}
            className="flex-1 py-2.5 px-3 rounded-xl bg-neutral-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm hover:bg-neutral-800 transition-colors"
          >
            <span>Depart & Check Out</span>
          </button>
        )}

        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
            stop.name + " Udaipur"
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2.5 rounded-xl border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
          aria-label="Google Maps directions"
        >
          <Navigation className="w-4 h-4 text-[#E05A2B]" />
        </a>
      </div>
    </div>
  );
}
