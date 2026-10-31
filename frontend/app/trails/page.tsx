"use client";

import React, { useState } from "react";
import { Header } from "@/components/common/Header";
import { BottomNav } from "@/components/common/BottomNav";
import { TrailCard } from "@/components/discovery/TrailCard";
import { CategoryChips } from "@/components/discovery/CategoryChips";
import { BasketDrawer } from "@/components/basket/BasketDrawer";
import { MOCK_TRAILS, MockTrail } from "@/lib/mockData";
import { useBasket } from "@/context/BasketContext";

export default function TrailsExplorerPage() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isBasketOpen, setIsBasketOpen] = useState(false);
  const { addItem } = useBasket();

  const categories = ["all", "heritage", "artisan", "walking", "food"];

  const filteredTrails = selectedCategory === "all"
    ? MOCK_TRAILS
    : MOCK_TRAILS.filter((t) => t.tags.includes(selectedCategory));

  const handleUseAsBase = (trail: MockTrail) => {
    if (trail.stops) {
      trail.stops.forEach((s) => {
        addItem(
          {
            id: s.place_id,
            name: s.place_name,
            category: "heritage",
            latitude: 24.5764,
            longitude: 73.6835,
            address: "Old City, Udaipur",
            entry_fee_inr: 0,
            typical_duration_minutes: s.suggested_duration_minutes,
          },
          trail.id,
          trail.title
        );
      });
      setIsBasketOpen(true);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between">
      <Header
        title="Community Trails"
        subtitle="Curated by genuine travelers"
        onBasketClick={() => setIsBasketOpen(true)}
      />

      <main className="flex-1 px-5 py-4 space-y-4 overflow-y-auto">
        <CategoryChips
          categories={categories}
          selectedCategory={selectedCategory}
          onSelect={setSelectedCategory}
        />

        <div className="space-y-3">
          {filteredTrails.map((trail) => (
            <TrailCard
              key={trail.id}
              trail={trail}
              onUseAsBase={handleUseAsBase}
            />
          ))}
        </div>
      </main>

      <BasketDrawer isOpen={isBasketOpen} onClose={() => setIsBasketOpen(false)} />
      <BottomNav />
    </div>
  );
}
