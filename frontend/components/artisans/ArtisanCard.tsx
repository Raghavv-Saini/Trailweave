"use client";

import React from "react";
import Link from "next/link";
import {
  MapPin,
  IndianRupee,
  Clock,
  Sparkles,
  Check,
  Plus,
  Camera,
  Store,
} from "lucide-react";
import { MockArtisan } from "@/lib/mockData";
import { useBasket } from "@/context/BasketContext";

interface ArtisanCardProps {
  artisan: MockArtisan;
}

export function ArtisanCard({ artisan }: ArtisanCardProps) {
  const { addItem, removeItem, isInBasket } = useBasket();
  const placeId = artisan.place_id || artisan.id;
  const inBasket = isInBasket(placeId);

  const handleBasketToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (inBasket) {
      removeItem(placeId);
    } else {
      addItem(
        {
          id: placeId,
          name: artisan.artisan_name,
          category: "artisan_studio",
          latitude: artisan.latitude ?? 24.5796,
          longitude: artisan.longitude ?? 73.6844,
          address: artisan.address,
          entry_fee_inr: artisan.workshop_fee_inr ?? 0,
          typical_duration_minutes: artisan.workshop_duration_minutes ?? 45,
        },
        {
          trailId: "artisan_directory",
          trailTitle: "Udaipur Living Heritage Artisans",
          authorName: artisan.artisan_name,
        }
      );
    }
  };

  const images = artisan.catalogue_images || [];
  const primaryImage = images[0];

  return (
    <div className="group rounded-2xl border border-[#E8E4DC] bg-white hover:border-[#1E3A5F]/40 hover:shadow-xs transition-all duration-200 overflow-hidden flex flex-col justify-between">
      {/* Photo Preview Carousel / Banner */}
      {primaryImage ? (
        <div className="relative h-44 w-full bg-neutral-100 overflow-hidden">
          <img
            src={primaryImage}
            alt={`${artisan.artisan_name} mastercraft work`}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

          {/* Craft Badge on Photo */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-white/95 text-[#1E3A5F] px-2.5 py-1 rounded-full shadow-xs backdrop-blur-xs">
              {artisan.craft_type}
            </span>
            {artisan.has_workshop ? (
              <span className="text-[10px] font-semibold bg-[#1E3A5F]/90 text-white px-2 py-0.5 rounded-full backdrop-blur-xs flex items-center gap-1 shadow-xs">
                <Sparkles className="w-2.5 h-2.5" /> Hands-on Class
              </span>
            ) : (
              <span className="text-[10px] font-semibold bg-neutral-800/80 text-white px-2 py-0.5 rounded-full backdrop-blur-xs flex items-center gap-1 shadow-xs">
                <Store className="w-2.5 h-2.5" /> Retail Studio
              </span>
            )}
          </div>

          {/* Artifact Photo count pill */}
          {images.length > 1 && (
            <div className="absolute bottom-3 right-3 bg-black/70 text-white text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 backdrop-blur-xs">
              <Camera className="w-3 h-3" />
              {images.length} photos
            </div>
          )}

          {/* Price pill if workshop */}
          {artisan.has_workshop && (
            <div className="absolute bottom-3 left-3 bg-white/95 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-0.5 shadow-xs">
              <IndianRupee className="w-3 h-3 stroke-[2.2]" />
              {artisan.workshop_fee_inr}
              <span className="text-[10px] font-normal text-neutral-500 ml-0.5">/ person</span>
            </div>
          )}
        </div>
      ) : (
        <div className="px-4 pt-4 flex items-center justify-between">
          <span className="text-[10px] font-bold text-[#1E3A5F] uppercase tracking-wider bg-[#1E3A5F]/10 px-2 py-0.5 rounded-md border border-[#1E3A5F]/20">
            {artisan.craft_type}
          </span>
          {artisan.has_workshop && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-100 flex items-center gap-0.5">
              <IndianRupee className="w-3 h-3 stroke-[2.2]" />
              {artisan.workshop_fee_inr}
            </span>
          )}
        </div>
      )}

      {/* Card Content */}
      <div className="p-4 space-y-2.5 flex-1 flex flex-col justify-between">
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-serif font-medium text-lg text-[#191C1E] leading-tight group-hover:text-[#1E3A5F] transition-colors">
                <Link href={`/artisans/${artisan.id}`}>{artisan.artisan_name}</Link>
              </h3>
              <p className="text-xs text-[#7A746B] flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-[#7A746B] shrink-0" />
                <span className="line-clamp-1">{artisan.address}</span>
              </p>
            </div>
          </div>

          {/* Operating hours & duration */}
          <div className="flex items-center gap-3 text-[11px] text-[#7A746B] font-medium pt-1">
            {artisan.opening_time && artisan.closing_time && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#7A746B] shrink-0" />
                Open {artisan.opening_time} - {artisan.closing_time}
              </span>
            )}
            {artisan.has_workshop && (
              <span className="flex items-center gap-1 text-[#1E3A5F] font-semibold bg-[#1E3A5F]/10 px-2 py-0.5 rounded-md">
                <Sparkles className="w-3 h-3 shrink-0" />
                {artisan.workshop_duration_minutes}m hands-on
              </span>
            )}
          </div>

          <p className="text-xs text-[#3F464C] line-clamp-2 leading-relaxed pt-1">
            {artisan.workshop_description || artisan.bio}
          </p>
        </div>

        {/* Action Buttons: 1-Tap Add to Basket & View Studio */}
        <div className="pt-3 border-t border-[#E8E4DC] flex items-center gap-2">
          <button
            onClick={handleBasketToggle}
            data-testid={`add-basket-${artisan.id}`}
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer ${
              inBasket
                ? "bg-emerald-700 text-white hover:bg-emerald-800 ring-2 ring-emerald-500/20"
                : "bg-[#1E3A5F] text-white hover:bg-[#152943]"
            }`}
          >
            {inBasket ? (
              <>
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                In Basket
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                Add to Itinerary
              </>
            )}
          </button>

          <Link
            href={`/artisans/${artisan.id}`}
            className="py-2 px-3 rounded-xl border border-[#E8E4DC] bg-white text-[#191C1E] hover:bg-[#F4EFEA] font-semibold text-xs flex items-center justify-center gap-1 transition-colors"
          >
            Studio Details &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
