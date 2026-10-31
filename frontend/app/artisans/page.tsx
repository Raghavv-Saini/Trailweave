"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  Filter,
  Search,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { Header } from "@/components/common/Header";
import { BottomNav } from "@/components/common/BottomNav";
import { ArtisanCard } from "@/components/artisans/ArtisanCard";
import { FloatingBasketButton } from "@/components/basket/FloatingBasketButton";
import { BasketDrawer } from "@/components/basket/BasketDrawer";
import { MOCK_ARTISANS, MockArtisan } from "@/lib/mockData";

const CRAFT_CATEGORIES = [
  { id: "all", label: "All Crafts" },
  { id: "painting", label: "Pichwai & Miniature Painting", match: "Miniature" },
  { id: "pottery", label: "Pottery", match: "Pottery" },
  { id: "puppetry", label: "Puppetry", match: "Puppetry" },
  { id: "leather", label: "Leather & Textiles", match: "Leather" },
];

export default function ArtisansDirectoryPage() {
  const [artisans, setArtisans] = useState<MockArtisan[]>(MOCK_ARTISANS);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [workshopOnly, setWorkshopOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isBasketOpen, setIsBasketOpen] = useState<boolean>(false);

  // Fetch artisans from backend with fallback to mock data
  useEffect(() => {
    let isMounted = true;
    async function fetchArtisans() {
      try {
        const res = await fetch("/api/artisans");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data) && data.length > 0) {
            setArtisans(data);
            return;
          }
        }
      } catch {
        // Fall back to client-side MOCK_ARTISANS
      }
    }
    fetchArtisans();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filter logic
  const filteredArtisans = useMemo(() => {
    return artisans.filter((artisan) => {
      // Workshop filter
      if (workshopOnly && !artisan.has_workshop) {
        return false;
      }

      // Category filter
      if (selectedCategory !== "all") {
        const catObj = CRAFT_CATEGORIES.find((c) => c.id === selectedCategory);
        if (catObj?.match) {
          const matchTerm = catObj.match.toLowerCase();
          const craftMatches = artisan.craft_type.toLowerCase().includes(matchTerm);
          if (!craftMatches) return false;
        }
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = artisan.artisan_name.toLowerCase().includes(q);
        const matchesCraft = artisan.craft_type.toLowerCase().includes(q);
        const matchesAddress = artisan.address?.toLowerCase().includes(q) ?? false;
        if (!matchesName && !matchesCraft && !matchesAddress) return false;
      }

      return true;
    });
  }, [artisans, workshopOnly, selectedCategory, searchQuery]);

  return (
    <div className="flex-1 flex flex-col justify-between min-h-screen bg-[#FDFBF7]">
      <Header title="Udaipur Artisans" subtitle="Living Heritage & Masterclasses" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6">
        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search master artists, crafts, or Old City chowks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 bg-white text-xs placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#E05A2B]/20 focus:border-[#E05A2B]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 text-xs font-bold"
            >
              ×
            </button>
          )}
        </div>

        {/* Category filter chips */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1">
              <Filter className="w-3 h-3 text-[#E05A2B]" /> Craft Traditions
            </span>

            {/* Workshop filter toggle switch */}
            <button
              onClick={() => setWorkshopOnly(!workshopOnly)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                workshopOnly
                  ? "bg-amber-100 text-amber-900 border border-amber-300 ring-2 ring-amber-400/20"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              <Sparkles className="w-3 h-3 text-amber-600" />
              <span>Hands-on Only</span>
              <span
                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                  workshopOnly ? "bg-amber-600 text-white" : "bg-neutral-300 text-neutral-700"
                }`}
              >
                {workshopOnly ? "✓" : ""}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {CRAFT_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? "bg-[#E05A2B] text-white shadow-xs"
                      : "bg-white text-neutral-600 border border-neutral-200/80 hover:bg-neutral-50"
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results summary counter */}
        <div className="flex items-center justify-between text-xs text-neutral-500 px-1 pt-1">
          <span>
            Showing <strong className="text-neutral-800">{filteredArtisans.length}</strong> verified studios
          </span>
          {(workshopOnly || selectedCategory !== "all" || searchQuery) && (
            <button
              onClick={() => {
                setSelectedCategory("all");
                setWorkshopOnly(false);
                setSearchQuery("");
              }}
              className="text-[#E05A2B] font-semibold hover:underline flex items-center gap-1 text-[11px] cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" /> Reset Filters
            </button>
          )}
        </div>

        {/* Directory cards (Responsive 3-Column Grid) */}
        {filteredArtisans.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredArtisans.map((artisan) => (
              <ArtisanCard key={artisan.id} artisan={artisan} />
            ))}
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-white border border-neutral-200 text-center space-y-3 my-6">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <SlidersHorizontal className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-neutral-800 text-sm">No artisan studios match your criteria</h3>
            <p className="text-xs text-neutral-500 max-w-xs mx-auto">
              Try resetting your category or workshop filter to explore all verified Udaipur masters.
            </p>
            <button
              onClick={() => {
                setSelectedCategory("all");
                setWorkshopOnly(false);
                setSearchQuery("");
              }}
              className="px-4 py-2 rounded-xl bg-[#E05A2B] text-white font-bold text-xs shadow-xs hover:bg-[#c94d23] cursor-pointer"
            >
              Show All Studios
            </button>
          </div>
        )}
      </main>

      {/* Floating basket button & basket review drawer */}
      <FloatingBasketButton onClick={() => setIsBasketOpen(true)} />
      <BasketDrawer isOpen={isBasketOpen} onClose={() => setIsBasketOpen(false)} />

      <BottomNav />
    </div>
  );
}
