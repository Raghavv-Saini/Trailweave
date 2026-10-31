"use client";

import React from "react";
import {
  Navigation,
  CheckCircle2,
  Clock,
  Pin,
  MapPin,
  LogOut,
  Radio,
  ShieldCheck,
} from "lucide-react";
import { TripStop } from "@/context/TripContext";

interface ActiveStopCardProps {
  stop: TripStop;
  distanceMeters?: number | null;
  onManualCheckin: (stopId: string) => void;
  onGeofenceCheckin?: (stopId: string) => void;
  onCheckout?: (stopId: string) => void;
}

function formatTimeWindow(isoString?: string): string {
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

export function ActiveStopCard({
  stop,
  distanceMeters,
  onManualCheckin,
  onGeofenceCheckin,
  onCheckout,
}: ActiveStopCardProps) {
  const isVisited = stop.visit_status === "visited";
  const isSkipped = stop.visit_status === "skipped";
  const isCheckedOut = Boolean(stop.is_checked_out);
  const isWithin100m =
    typeof distanceMeters === "number" && distanceMeters <= 100;

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    `${stop.latitude},${stop.longitude}`
  )}&destination_place_id=${encodeURIComponent(stop.name + " Udaipur")}&travelmode=walking`;

  return (
    <div className="rounded-2xl border border-[#E8E4DC] bg-white shadow-xs overflow-hidden">
      {/* Place Image Banner */}
      <div className="relative h-44 w-full bg-neutral-200 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={stop.image_url}
          alt={stop.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white bg-[#1E3A5F] px-2.5 py-1 rounded-md shadow-xs">
            {isVisited
              ? isCheckedOut
                ? "Completed Stop"
                : "Checked In • Touring"
              : isSkipped
              ? "Skipped Stop"
              : `Active Stop #${stop.sequence_in_day}`}
          </span>

          <div className="flex items-center gap-1.5">
            {stop.is_pinned && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-[#191C1E] shadow-xs">
                <Pin className="w-3 h-3 text-[#1E3A5F]" />
                Pinned
              </span>
            )}
            <span
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full capitalize shadow-xs ${
                isVisited
                  ? "bg-emerald-700 text-white"
                  : isSkipped
                  ? "bg-neutral-600 text-white"
                  : "bg-white text-[#1E3A5F]"
              }`}
            >
              {stop.visit_status}
            </span>
          </div>
        </div>

        {/* Bottom Image Overlay Info */}
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between text-white">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-white/80 block">
              {stop.category.replace("_", " ")} •{" "}
              {stop.entry_fee_inr > 0 ? `₹${stop.entry_fee_inr} Entry` : "Free Entry"}
            </span>
            <h2 className="font-serif text-lg font-medium leading-snug">{stop.name}</h2>
          </div>

          {typeof distanceMeters === "number" && (
            <span
              className={`text-[10px] font-bold px-2 py-1 rounded-lg backdrop-blur-xs flex items-center gap-1 ${
                isWithin100m
                  ? "bg-emerald-600 text-white"
                  : "bg-black/60 text-neutral-100"
              }`}
            >
              <Radio className="w-3 h-3" />
              {distanceMeters}m away
            </span>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4 space-y-3.5">
        {/* Address & Planned Schedule */}
        <div className="space-y-1.5 text-xs">
          <p className="text-[#7A746B] flex items-start gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#1E3A5F] shrink-0 mt-0.5" />
            <span>{stop.address}</span>
          </p>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-[#3F464C] bg-[#FBF9F5] px-3 py-2 rounded-xl border border-[#E8E4DC]">
            <span className="flex items-center gap-1 font-medium">
              <Clock className="w-3.5 h-3.5 text-[#1E3A5F]" />
              Planned: {formatTimeWindow(stop.planned_arrival)} –{" "}
              <strong className="text-[#191C1E]">
                {formatTimeWindow(stop.planned_departure)}
              </strong>
            </span>
            <span className="font-semibold text-neutral-500">
              {stop.suggested_duration_minutes} mins
            </span>
          </div>
        </div>

        {/* 100m Geofence Proximity Prompt inside Card when within 100m */}
        {!isVisited && isWithin100m && onGeofenceCheckin && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2">
            <div className="text-xs text-emerald-900">
              <p className="font-bold flex items-center gap-1">
                <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                Within 100m Geofence ({distanceMeters}m)
              </p>
              <p className="text-[11px] text-emerald-700">
                Welcome to {stop.name}! Tap to check in via GPS.
              </p>
            </div>
            <button
              onClick={() => onGeofenceCheckin(stop.id)}
              className="shrink-0 px-3 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 shadow-xs"
            >
              GPS Check-In
            </button>
          </div>
        )}

        {/* Action Buttons: 1-Tap Manual Check-in Fallback / Checkout + Google Maps Deep Link */}
        <div className="flex items-center gap-2 pt-0.5">
          {!isVisited ? (
            <button
              onClick={() => onManualCheckin(stop.id)}
              className="flex-1 py-2.5 px-3 rounded-xl bg-[#1E3A5F] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs hover:bg-[#152943] transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>1-Tap Manual Check-in Fallback</span>
            </button>
          ) : !isCheckedOut ? (
            <button
              onClick={() => onCheckout && onCheckout(stop.id)}
              className="flex-1 py-2.5 px-3 rounded-xl bg-neutral-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Depart & Check Out</span>
            </button>
          ) : (
            <div className="flex-1 py-2 px-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold text-xs flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>
                Checked Out ({stop.checkout_method || "manual_tap"})
              </span>
            </div>
          )}

          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2.5 rounded-xl border border-[#E8E4DC] bg-white text-neutral-800 hover:bg-[#F4EFEA] text-xs font-semibold flex items-center gap-1.5 shadow-2xs shrink-0"
            aria-label={`Open Google Maps directions to ${stop.name}`}
          >
            <Navigation className="w-4 h-4 text-[#1E3A5F]" />
            <span>Directions</span>
          </a>
        </div>
      </div>
    </div>
  );
}
