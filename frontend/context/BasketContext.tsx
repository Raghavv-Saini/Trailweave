"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { MockPlace, MockTrail } from "@/lib/mockData";

export interface CuratorProvenance {
  trailId: string;
  trailTitle: string;
  authorName?: string;
}

export interface BasketItem {
  place: MockPlace;
  sources: CuratorProvenance[];
  addedAt: number;
}

interface BasketContextType {
  items: BasketItem[];
  addItem: (place: MockPlace, source?: CuratorProvenance) => void;
  addAllStops: (trail: MockTrail, mode: "merge" | "replace") => void;
  removeItem: (placeId: string) => void;
  clearBasket: () => void;
  isInBasket: (placeId: string) => boolean;
  totalCount: number;
  totalEstimatedCostInr: number;
  totalEstimatedDurationMinutes: number;
}

const BasketContext = createContext<BasketContextType | undefined>(undefined);

export function BasketProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<BasketItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("trailweave_basket");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Normalize legacy items if needed
          const normalized: BasketItem[] = parsed.map((item: Record<string, unknown>) => {
            if (item.sources) return item as unknown as BasketItem;
            const legacyPlace = item.place as MockPlace;
            const legacyTitle = item.sourceTrailTitle as string | undefined;
            const legacyId = item.sourceTrailId as string | undefined;
            return {
              place: legacyPlace,
              sources: legacyTitle
                ? [{ trailId: legacyId || "trail", trailTitle: legacyTitle }]
                : [],
              addedAt: (item.addedAt as number) || Date.now(),
            };
          });
          setItems(normalized);
        }
      }
    } catch {
      // LocalStorage error or SSR fallback
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Sync to localStorage
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem("trailweave_basket", JSON.stringify(items));
    } catch {
      // Ignore quota errors
    }
  }, [items, isLoaded]);

  const addItem = (place: MockPlace, source?: CuratorProvenance) => {
    setItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.place.id === place.id);

      if (existingIndex >= 0) {
        // Place already in basket: Deduplicate canonical place, but append new curator provenance if not already listed
        const existing = prev[existingIndex];
        const hasSource = source && existing.sources.some((s) => s.trailId === source.trailId);
        if (!source || hasSource) {
          return prev;
        }

        const updated = [...prev];
        updated[existingIndex] = {
          ...existing,
          sources: [...existing.sources, source],
        };
        return updated;
      }

      // New place
      return [
        ...prev,
        {
          place,
          sources: source ? [source] : [],
          addedAt: Date.now(),
        },
      ];
    });
  };

  const addAllStops = (trail: MockTrail, mode: "merge" | "replace") => {
    const source: CuratorProvenance = {
      trailId: trail.id,
      trailTitle: trail.title,
      authorName: trail.author_name,
    };

    setItems((prev) => {
      const baseItems = mode === "replace" ? [] : [...prev];

      for (const stop of trail.stops) {
        const existingIdx = baseItems.findIndex((it) => it.place.id === stop.place_id);
        const placeData: MockPlace = {
          id: stop.place_id,
          name: stop.place_name,
          category: (stop.category as MockPlace["category"]) || "heritage",
          latitude: 24.5764,
          longitude: 73.6835,
          address: "Old City, Udaipur",
          entry_fee_inr: stop.entry_fee_inr ?? 0,
          typical_duration_minutes: stop.suggested_duration_minutes,
        };

        if (existingIdx >= 0) {
          const item = baseItems[existingIdx];
          if (!item.sources.some((s) => s.trailId === trail.id)) {
            baseItems[existingIdx] = {
              ...item,
              sources: [...item.sources, source],
            };
          }
        } else {
          baseItems.push({
            place: placeData,
            sources: [source],
            addedAt: Date.now(),
          });
        }
      }

      return baseItems;
    });
  };

  const removeItem = (placeId: string) => {
    setItems((prev) => prev.filter((item) => item.place.id !== placeId));
  };

  const clearBasket = () => {
    setItems([]);
  };

  const isInBasket = (placeId: string) => {
    return items.some((item) => item.place.id === placeId);
  };

  const totalEstimatedCostInr = items.reduce(
    (sum, item) => sum + (item.place.entry_fee_inr || 0),
    0
  );

  const totalEstimatedDurationMinutes = items.reduce(
    (sum, item) => sum + (item.place.typical_duration_minutes || 0),
    0
  );

  return (
    <BasketContext.Provider
      value={{
        items,
        addItem,
        addAllStops,
        removeItem,
        clearBasket,
        isInBasket,
        totalCount: items.length,
        totalEstimatedCostInr,
        totalEstimatedDurationMinutes,
      }}
    >
      {children}
    </BasketContext.Provider>
  );
}

export function useBasket() {
  const context = useContext(BasketContext);
  if (!context) {
    throw new Error("useBasket must be used within a BasketProvider");
  }
  return context;
}
