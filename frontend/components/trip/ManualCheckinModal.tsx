"use client";

import React from "react";
import { CheckCircle2, X } from "lucide-react";
import { TripStop } from "@/context/TripContext";

interface ManualCheckinModalProps {
  stop: TripStop | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (stopId: string) => void;
}

export function ManualCheckinModal({
  stop,
  isOpen,
  onClose,
  onConfirm,
}: ManualCheckinModalProps) {
  if (!isOpen || !stop) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-neutral-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <h3 className="text-base font-bold text-neutral-900">Confirm Arrival</h3>
          <p className="text-xs text-neutral-500 mt-1">
            Manual check-in fallback for narrow alleys and GPS dead zones in Old City Udaipur.
          </p>
        </div>

        <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
          <p className="text-xs font-semibold text-neutral-800">{stop.name}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm(stop.id);
              onClose();
            }}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm"
          >
            Check In Now
          </button>
        </div>
      </div>
    </div>
  );
}
