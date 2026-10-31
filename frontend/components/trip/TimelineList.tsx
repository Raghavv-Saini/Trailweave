"use client";

import React from "react";
import {
  CheckCircle2,
  Clock,
  Pin,
  MapPin,
  Navigation,
  LogOut,
  SkipForward,
  Timer,
} from "lucide-react";
import { TripStop } from "@/context/TripContext";

interface TimelineListProps {
  stops: TripStop[];
  activeStopId?: string;
  onSelectStop?: (stop: TripStop) => void;
  onManualCheckin?: (stopId: string) => void;
  onCheckout?: (stopId: string) => void;
}

function formatTime(isoString?: string): string {
  if (!isoString) return "--:--";
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "UTC",
    });
  } catch {
    return "--:--";
  }
}

export function TimelineList({
  stops,
  activeStopId,
  onSelectStop,
  onManualCheckin,
  onCheckout,
}: TimelineListProps) {
  return (
    <div className="space-y-3">
      {stops.map((stop, idx) => {
        const isVisited = stop.visit_status === "visited";
        const isSkipped = stop.visit_status === "skipped";
        const isPending = stop.visit_status === "pending";
        const isCheckedOut = Boolean(stop.is_checked_out);
        const isActive = stop.id === activeStopId;

        const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
          `${stop.latitude},${stop.longitude}`
        )}&travelmode=walking`;

        return (
          <div
            key={stop.id}
            onClick={() => onSelectStop && onSelectStop(stop)}
            className={`p-3.5 rounded-2xl border transition-all space-y-2.5 ${
              isActive
                ? "bg-[#1E3A5F]/5 border-[#1E3A5F] ring-1 ring-[#1E3A5F]/20"
                : isVisited
                ? "bg-emerald-50/30 border-emerald-200/80"
                : isSkipped
                ? "bg-[#FBF9F5] border-[#E8E4DC] opacity-75"
                : "bg-white border-[#E8E4DC] hover:border-[#1E3A5F]/40 cursor-pointer"
            }`}
          >
            {/* Top Row: Sequence + Name + Status Badge + Pinned Indicator */}
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-start gap-2.5 min-w-0">
                <span
                  className={`shrink-0 w-6 h-6 rounded-full font-bold text-[11px] flex items-center justify-center mt-0.5 ${
                    isVisited
                      ? "bg-emerald-700 text-white"
                      : isActive
                      ? "bg-[#1E3A5F] text-white"
                      : "bg-[#F4EFEA] text-[#191C1E]"
                  }`}
                >
                  {idx + 1}
                </span>

                <div className="min-w-0">
                  <div className="flex items-center flex-wrap gap-1.5">
                    <h4 className="font-serif text-sm font-medium text-[#191C1E] truncate">
                      {stop.name}
                    </h4>
                    {stop.is_pinned && (
                      <span
                        title="Pinned Stop"
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[#1E3A5F]/10 text-[#1E3A5F] border border-[#1E3A5F]/20 text-[10px] font-bold"
                      >
                        <Pin className="w-2.5 h-2.5 text-[#1E3A5F]" />
                        Pinned
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-[#7A746B] flex items-center gap-1 mt-0.5 truncate">
                    <MapPin className="w-3 h-3 text-[#7A746B] shrink-0" />
                    <span className="truncate">{stop.address}</span>
                  </p>

                  <p className="text-[10px] text-[#7A746B] font-medium flex items-center gap-1.5 mt-1">
                    <Clock className="w-3 h-3 text-[#1E3A5F]" />
                    <span>
                      {formatTime(stop.planned_arrival)} –{" "}
                      {formatTime(stop.planned_departure)}
                    </span>
                    <span>•</span>
                    <span>{stop.suggested_duration_minutes}m planned</span>
                  </p>
                </div>
              </div>

              {/* Status Badge (`pending`, `visited`, `skipped`) + Maps Deep Link */}
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    isVisited
                      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                      : isSkipped
                      ? "bg-neutral-200 text-neutral-700 border-neutral-300"
                      : "bg-[#1E3A5F]/10 text-[#1E3A5F] border-[#1E3A5F]/20"
                  }`}
                >
                  {stop.visit_status}
                </span>

                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 rounded-lg border border-[#E8E4DC] bg-white text-neutral-600 hover:text-[#1E3A5F] hover:border-[#1E3A5F]/30"
                  title={`Directions to ${stop.name}`}
                >
                  <Navigation className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Audit Metadata Pills (Check-in / Check-out Method Audit) */}
            {(stop.checkin_method || stop.checkout_method) && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {stop.checkin_method && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/70">
                    In: <code>{stop.checkin_method}</code>
                  </span>
                )}
                {stop.checkout_method && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700 border border-neutral-200">
                    Out: <code>{stop.checkout_method}</code>
                    {stop.actual_duration_minutes
                      ? ` (${stop.actual_duration_minutes}m)`
                      : ""}
                  </span>
                )}
              </div>
            )}

            {/* Action Bar on Every Card */}
            {isPending && onManualCheckin && (
              <div className="pt-1 flex items-center justify-between gap-2 border-t border-neutral-100">
                <span className="text-[10px] text-neutral-400 font-medium">
                  No GPS lock needed in Old City alleys
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onManualCheckin(stop.id);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#1E3A5F] text-white font-bold text-[11px] flex items-center gap-1.5 shadow-2xs hover:bg-[#152943] transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>1-Tap Manual Check-in Fallback</span>
                </button>
              </div>
            )}

            {isVisited && !isCheckedOut && onCheckout && (
              <div className="pt-1.5 flex items-center justify-between gap-2 border-t border-emerald-200/60">
                <span className="text-[10px] text-[#1E3A5F] font-semibold flex items-center gap-1">
                  <Timer className="w-3 h-3 text-[#1E3A5F]" />
                  Touring • +20m grace buffer active
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCheckout(stop.id);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-neutral-900 text-white font-bold text-[11px] flex items-center gap-1.5 shadow-2xs hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Depart & Check Out</span>
                </button>
              </div>
            )}

            {isSkipped && (
              <div className="pt-1 flex items-center gap-1 text-[10px] text-neutral-500">
                <SkipForward className="w-3 h-3" />
                <span>Skipped in itinerary history</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
