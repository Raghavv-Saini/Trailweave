"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { MockPlace } from "@/lib/mockData";

export interface BasketItem {
  place: MockPlace;
  sourceTrailId?: string;
  sourceTrailTitle?: string;
  addedAt: number;
}

interface BasketContextType {
  items: BasketItem[];
  addItem: (place: MockPlace, sourceTrailId?: string, sourceTrailTitle?: string) => void;
  removeItem: (placeId: string) => void;
  clearBasket: () => void;
  isInBasket: (placeId: string) => boolean;
  totalCount: number;
}

const BasketContext = createContext<BasketContextType | undefined>(undefined);

export function BasketProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<BasketItem[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("trailweave_basket");
      if (saved) {
        setItems(JSON.parse(saved));
      }
    } catch {}
  }, []);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("trailweave_basket", JSON.stringify(items));
    } catch {}
  }, [items]);

  const addItem = (place: MockPlace, sourceTrailId?: string, sourceTrailTitle?: string) => {
    setItems((prev) => {
      // Deduplicate by place.id
      if (prev.some((item) => item.place.id === place.id)) {
        return prev;
      }
      return [...prev, { place, sourceTrailId, sourceTrailTitle, addedAt: Date.now() }];
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

  return (
    <BasketContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        clearBasket,
        isInBasket,
        totalCount: items.length,
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
