"use client";

import React from "react";
import { X, Trash2, ArrowRight } from "lucide-react";
import { useBasket } from "@/context/BasketContext";

interface BasketDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BasketDrawer({ isOpen, onClose }: BasketDrawerProps) {
  const { items, removeItem, clearBasket, totalCount } = useBasket();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-neutral-900 text-base">Trip Basket</h2>
            <p className="text-xs text-neutral-500 font-medium">{totalCount} stops selected</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {items.length === 0 ? (
            <div className="text-center py-12 text-neutral-400 space-y-2">
              <p className="text-sm font-medium">Your basket is empty</p>
              <p className="text-xs">Select stops across community trails to customize your itinerary.</p>
            </div>
          ) : (
            items.map(({ place, sourceTrailTitle }) => (
              <div
                key={place.id}
                className="p-3.5 rounded-xl border border-neutral-200/80 bg-neutral-50/50 flex items-center justify-between gap-3"
              >
                <div>
                  <h4 className="text-xs font-bold text-neutral-900">{place.name}</h4>
                  {sourceTrailTitle && (
                    <p className="text-[10px] text-neutral-500 mt-0.5">From: {sourceTrailTitle}</p>
                  )}
                  <span className="text-[10px] font-semibold text-neutral-500">
                    {place.typical_duration_minutes}m • ₹{place.entry_fee_inr}
                  </span>
                </div>
                <button
                  onClick={() => removeItem(place.id)}
                  className="p-1.5 text-neutral-400 hover:text-rose-500"
                  aria-label="Remove stop"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="p-5 border-t border-neutral-100 space-y-2.5 bg-white">
            <button
              onClick={() => alert("Proceeding to Trip Engine Solver (Ticket 04)")}
              className="w-full py-3 rounded-xl bg-[#E05A2B] text-white font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-[#c94d23] transition-colors shadow-sm"
            >
              <span>Build Authoritative Trip</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={clearBasket}
              className="w-full py-2 text-center text-xs text-neutral-400 font-medium hover:text-neutral-600"
            >
              Clear Basket
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
