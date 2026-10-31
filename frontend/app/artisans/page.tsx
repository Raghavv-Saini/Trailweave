"use client";

import React from "react";
import { Header } from "@/components/common/Header";
import { BottomNav } from "@/components/common/BottomNav";
import { ArtisanCard } from "@/components/artisans/ArtisanCard";
import { MOCK_ARTISANS } from "@/lib/mockData";

export default function ArtisansDirectoryPage() {
  return (
    <div className="flex-1 flex flex-col justify-between">
      <Header title="Udaipur Artisans" subtitle="Living Heritage & Masterclasses" />

      <main className="flex-1 px-5 py-4 space-y-4 overflow-y-auto">
        <p className="text-xs text-neutral-500">
          Discover verified Udaipur craftsmen onboarding via WhatsApp voice notes. Book retail visits or hands-on workshops.
        </p>

        <div className="space-y-3">
          {MOCK_ARTISANS.map((artisan) => (
            <ArtisanCard key={artisan.id} artisan={artisan} />
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
