"use client";

import React from "react";
import { CheckCircle2, Circle, Clock, Pin } from "lucide-react";
import { TripStop } from "@/context/TripContext";

interface TimelineListProps {
  stops: TripStop[];
  onSelectStop?: (stop: TripStop) => void;
}

export function TimelineList({ stops, onSelectStop }: TimelineListProps) {
  return (
    <div className="space-y-3">
      {stops.map((stop, idx) => {
        const isVisited = stop.visit_status === "visited";
        const isSkipped = stop.visit_status === "skipped";

        return (
          <div
            key={stop.id}
            onClick={() => onSelectStop && onSelectStop(stop)}
            className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
              isVisited
                ? "bg-emerald-50/40 border-emerald-200/60"
                : isSkipped
                ? "bg-neutral-50 border-neutral-200 opacity-60"
                : "bg-white border-neutral-200/80 hover:border-amber-300 cursor-pointer"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-neutral-100 text-neutral-600 font-bold text-[11px] flex items-center justify-center">
                {idx + 1}
              </span>

              <div>
                <h4 className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                  {stop.name}
                  {stop.is_pinned && <Pin className="w-3 h-3 text-amber-500 fill-amber-500" />}
                </h4>
                <p className="text-[10px] text-neutral-400 font-medium flex items-center gap-1 mt-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {stop.suggested_duration_minutes}m suggested
                </p>
              </div>
            </div>

            <div className="shrink-0">
              {isVisited ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <Circle className="w-4 h-4 text-neutral-300" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
