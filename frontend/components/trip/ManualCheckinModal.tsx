"use client";

import React from "react";
import { CheckCircle2, Radio, MapPin, X } from "lucide-react";
import { CheckinMethod, TripStop } from "@/context/TripContext";

interface ManualCheckinModalProps {
  stop: TripStop | null;
  isOpen: boolean;
  mode?: CheckinMethod;
  distanceMeters?: number | null;
  onClose: () => void;
  onConfirm: (stopId: string, method: CheckinMethod) => void;
}

export function ManualCheckinModal({
  stop,
  isOpen,
  mode = "geofence_proximity",
  distanceMeters,
  onClose,
  onConfirm,
}: ManualCheckinModalProps) {
  if (!isOpen || !stop) return null;

  const isGeofence = mode === "geofence_proximity";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between">
          <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
            {isGeofence ? (
              <Radio className="w-4 h-4 animate-pulse" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            {isGeofence
              ? `100m Geofence Triggered${
                  typeof distanceMeters === "number" ? ` (${distanceMeters}m)` : ""
                }`
              : "Manual Check-in Fallback"}
          </span>
          <h3 className="text-base font-bold text-neutral-900 mt-2">
            Welcome to {stop.name}!
          </h3>
          <p className="text-xs text-neutral-500 mt-1">
            {isGeofence
              ? "You have arrived within 100 meters of your scheduled stop. Tap below to check in."
              : "Manual check-in fallback for narrow alleys and GPS dead zones in Old City Udaipur."}
          </p>
        </div>

        <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 space-y-1">
          <p className="text-xs font-bold text-neutral-800">{stop.name}</p>
          <p className="text-[11px] text-neutral-500 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-[#1E3A5F]" />
            <span>{stop.address}</span>
          </p>
          <p className="text-[10px] text-neutral-400">
            Audit method: <code>{mode}</code>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
          >
            Not Yet
          </button>
          <button
            onClick={() => {
              onConfirm(stop.id, mode);
              onClose();
            }}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm"
          >
            Tap to Check In
          </button>
        </div>
      </div>
    </div>
  );
}
