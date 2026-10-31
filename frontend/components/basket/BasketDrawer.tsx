"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { X, Trash2, ArrowRight, Clock, IndianRupee, Sparkles, Layers } from "lucide-react";
import { useBasket } from "@/context/BasketContext";

interface BasketDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BasketDrawer({ isOpen, onClose }: BasketDrawerProps) {
  const router = useRouter();
  const {
    items,
    removeItem,
    clearBasket,
    totalCount,
    totalEstimatedCostInr,
    totalEstimatedDurationMinutes,
  } = useBasket();

  if (!isOpen) return null;

  const handleProceedToBuilder = () => {
    onClose();
    // Navigate to Trip Builder with the candidate stops
    router.push("/trip");
  };

  const hours = Math.floor(totalEstimatedDurationMinutes / 60);
  const minutes = totalEstimatedDurationMinutes % 60;
  const formattedDuration = hours > 0 ? `${hours}h ${minutes > 0 ? `${minutes}m` : ""}` : `${minutes}m`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-end bg-black/50 backdrop-blur-xs transition-opacity">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-none sm:h-full flex flex-col shadow-2xl max-h-[90vh] sm:max-h-full animate-in slide-in-from-bottom sm:slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="px-5 pt-5 pb-4 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#E05A2B]" />
              <h2 className="font-bold text-neutral-900 text-base">Trip Basket</h2>
            </div>
            <p className="text-xs text-neutral-500 font-medium mt-0.5">
              {totalCount} {totalCount === 1 ? "canonical place" : "places"} selected • deduplicated
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
            aria-label="Close basket"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Subtotal Strip */}
        {items.length > 0 && (
          <div className="px-5 py-2.5 bg-amber-50/70 border-b border-amber-100/60 flex items-center justify-between text-xs font-semibold text-neutral-700">
            <span className="flex items-center gap-1 text-neutral-600">
              <Clock className="w-3.5 h-3.5 text-amber-700" />
              <span>Est. {formattedDuration} visit time</span>
            </span>
            <span className="flex items-center gap-1 text-[#E05A2B]">
              <IndianRupee className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>₹{totalEstimatedCostInr.toLocaleString()} entry fees</span>
            </span>
          </div>
        )}

        {/* Selected Stops List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {items.length === 0 ? (
            <div className="text-center py-14 text-neutral-400 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto text-neutral-400">
                <Layers className="w-6 h-6 stroke-[1.8]" />
              </div>
              <div>
                <p className="text-sm font-bold text-neutral-700">Your basket is empty</p>
                <p className="text-xs text-neutral-400 mt-1 max-w-xs mx-auto">
                  Browse community trails and tap &quot;Use as Base&quot; or cherry-pick individual stops to build your personalized journey.
                </p>
              </div>
            </div>
          ) : (
            items.map(({ place, sources }) => (
              <div
                key={place.id}
                className="p-3.5 rounded-2xl border border-neutral-200/80 bg-white hover:border-amber-200 transition-all shadow-xs flex items-start justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                      {place.category.replace("_", " ")}
                    </span>
                    <h4 className="text-xs font-bold text-neutral-900 leading-tight">
                      {place.name}
                    </h4>
                  </div>

                  {/* Multi-Curator Provenance Attribution */}
                  {sources && sources.length > 0 && (
                    <div className="text-[10px] text-neutral-500 font-medium flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-[#E05A2B] shrink-0" />
                      <span className="line-clamp-1">
                        Curated in:{" "}
                        <span className="font-semibold text-neutral-700">
                          {sources.map((s) => s.trailTitle).join(" • ")}
                        </span>
                      </span>
                    </div>
                  )}

                  <div className="text-[11px] text-neutral-400 font-medium flex items-center gap-2 pt-0.5">
                    <span>{place.typical_duration_minutes}m duration</span>
                    <span>•</span>
                    <span className="text-neutral-600 font-semibold">
                      {place.entry_fee_inr === 0 ? "Free Entry" : `₹${place.entry_fee_inr}`}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => removeItem(place.id)}
                  className="p-1.5 text-neutral-300 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors shrink-0"
                  aria-label={`Remove ${place.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Drawer Actions */}
        {items.length > 0 && (
          <div className="p-5 border-t border-neutral-100 space-y-2.5 bg-neutral-50/70">
            <button
              onClick={handleProceedToBuilder}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#E05A2B] to-[#F59E0B] text-white font-bold text-xs flex items-center justify-center gap-2 hover:opacity-95 transition-all shadow-md active:scale-[0.99]"
            >
              <span>Proceed to Trip Builder ({totalCount} stops)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={clearBasket}
              className="w-full py-2 text-center text-xs text-neutral-400 font-medium hover:text-neutral-700 transition-colors"
            >
              Clear Basket
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
