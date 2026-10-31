"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { X, Trash2, ArrowRight, Clock, IndianRupee, Sparkles, Layers, Plus } from "lucide-react";
import { useBasket } from "@/context/BasketContext";
import { useTrip } from "@/context/TripContext";
import { MOCK_PLACES, MOCK_ARTISANS } from "@/lib/mockData";

interface BasketDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BasketDrawer({ isOpen, onClose }: BasketDrawerProps) {
  const router = useRouter();
  const { createTripFromBuilder } = useTrip();
  const {
    items,
    addItem,
    removeItem,
    clearBasket,
    totalCount,
    totalEstimatedCostInr,
    totalEstimatedDurationMinutes,
  } = useBasket();

  // Find candidate artisan recommendation that is not yet in the basket
  const recommendedArtisan = useMemo(() => {
    if (items.length === 0) return null;
    const basketPlaceIds = new Set(items.map((i) => i.place.id));
    const artisanPlaces = MOCK_PLACES.filter(
      (p) => p.category === "artisan_studio" && !basketPlaceIds.has(p.id)
    );
    if (artisanPlaces.length === 0) return null;
    const place = artisanPlaces[0];
    const artisan = MOCK_ARTISANS.find((a) => a.place_id === place.id);
    return {
      place,
      artisan,
      detourMinutes: 5,
      rationale: artisan?.has_workshop
        ? `${artisan.artisan_name}: 5 min detour, ₹${artisan.workshop_fee_inr} workshop fee, fits under route budget`
        : `${artisan?.artisan_name || place.name}: 5 min detour, free studio visit`,
    };
  }, [items]);

  if (!isOpen) return null;

  const handleProceedToBuilder = async () => {
    await createTripFromBuilder({
      title: `My Curated Udaipur Itinerary (${items.length} Stops)`,
      days: Math.max(1, Math.ceil(totalEstimatedDurationMinutes / 360)),
      budgetInr: Math.max(1500, totalEstimatedCostInr + 500),
      travelMode: "auto_rickshaw",
      places: items.map((i) => i.place),
    });
    onClose();
    router.push("/trip");
  };

  const hours = Math.floor(totalEstimatedDurationMinutes / 60);
  const minutes = totalEstimatedDurationMinutes % 60;
  const formattedDuration = hours > 0 ? `${hours}h ${minutes > 0 ? `${minutes}m` : ""}` : `${minutes}m`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-end bg-black/50 backdrop-blur-xs transition-opacity">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-none sm:h-full flex flex-col shadow-2xl max-h-[90vh] sm:max-h-full animate-in slide-in-from-bottom sm:slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="px-5 pt-5 pb-4 border-b border-[#E8E4DC] flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1E3A5F]" />
              <h2 className="font-serif font-medium text-[#191C1E] text-lg">Trip Basket</h2>
            </div>
            <p className="text-xs text-[#7A746B] font-medium mt-0.5">
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
          <div className="px-5 py-2.5 bg-[#FBF9F5] border-b border-[#E8E4DC] flex items-center justify-between text-xs font-semibold text-[#191C1E]">
            <span className="flex items-center gap-1 text-[#7A746B]">
              <Clock className="w-3.5 h-3.5 text-[#7A746B]" />
              <span>Est. {formattedDuration} visit time</span>
            </span>
            <span className="flex items-center gap-1 text-[#191C1E]">
              <IndianRupee className="w-3.5 h-3.5 stroke-[2.2]" />
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
                      <Sparkles className="w-3 h-3 text-[#1E3A5F] shrink-0" />
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

          {/* Smart Detour Artisan Recommendation */}
          {recommendedArtisan && (
            <div className="p-3.5 rounded-2xl border border-[#E8E4DC] bg-[#FBF9F5] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#1E3A5F] bg-[#1E3A5F]/10 border border-[#1E3A5F]/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  Nearby Artisan Detour (+5m)
                </span>
                <span className="text-[10px] font-bold text-emerald-800">
                  {recommendedArtisan.artisan?.has_workshop
                    ? `₹${recommendedArtisan.artisan.workshop_fee_inr} workshop`
                    : "Free entry"}
                </span>
              </div>

              <div>
                <h4 className="text-xs font-bold text-neutral-900">
                  {recommendedArtisan.artisan?.artisan_name || recommendedArtisan.place.name}
                </h4>
                <p className="text-[11px] text-neutral-600 mt-0.5">
                  {recommendedArtisan.rationale}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  addItem(recommendedArtisan.place, {
                    trailId: "artisan_detour_rec",
                    trailTitle: "TrailWeave Artisan Detour Recommendation",
                  })
                }
                className="w-full py-2 px-3 rounded-xl bg-white border border-[#1E3A5F]/40 hover:bg-[#1E3A5F]/10 text-[#1E3A5F] font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Add Workshop to Basket</span>
              </button>
            </div>
          )}
        </div>

        {/* Drawer Actions */}
        {items.length > 0 && (
          <div className="p-5 border-t border-[#E8E4DC] space-y-2.5 bg-[#FBF9F5]">
            <button
              onClick={handleProceedToBuilder}
              className="w-full py-3.5 px-4 rounded-xl bg-[#1E3A5F] hover:bg-[#152943] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs active:scale-[0.99] cursor-pointer"
            >
              <span>Proceed to Trip Builder ({totalCount} stops)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={clearBasket}
              className="w-full py-2 text-center text-xs text-neutral-400 font-medium hover:text-neutral-700 transition-colors cursor-pointer"
            >
              Clear Basket
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
