"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  IndianRupee,
  Clock,
  Sparkles,
  Phone,
  Navigation,
  Check,
  Plus,
  Camera,
  Award,
  Store,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
  Share2,
} from "lucide-react";
import { Header } from "@/components/common/Header";
import { BottomNav } from "@/components/common/BottomNav";
import { FloatingBasketButton } from "@/components/basket/FloatingBasketButton";
import { BasketDrawer } from "@/components/basket/BasketDrawer";
import { MOCK_ARTISANS, MockArtisan } from "@/lib/mockData";
import { useBasket } from "@/context/BasketContext";

export default function ArtisanDetailPage() {
  const params = useParams();
  const artisanId = (params?.id as string) || "artisan_mohanlal";

  const { addItem, removeItem, isInBasket } = useBasket();
  const [artisan, setArtisan] = useState<MockArtisan>(() => {
    return MOCK_ARTISANS.find((a) => a.id === artisanId) || MOCK_ARTISANS[0];
  });
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);
  const [isBasketOpen, setIsBasketOpen] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Fetch updated artisan data from backend
  useEffect(() => {
    let isMounted = true;
    async function loadArtisan() {
      try {
        const res = await fetch(`/api/artisans/${artisanId}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data?.id) {
            setArtisan(data);
          }
        }
      } catch {
        // Fall back to local mock
      }
    }
    loadArtisan();
    return () => {
      isMounted = false;
    };
  }, [artisanId]);

  const placeId = artisan.place_id || artisan.id;
  const inBasket = isInBasket(placeId);

  const images = useMemo(() => {
    if (artisan.catalogue_images && artisan.catalogue_images.length > 0) {
      return artisan.catalogue_images;
    }
    return [
      "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=900&q=80",
    ];
  }, [artisan.catalogue_images]);

  const handleBasketToggle = () => {
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

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard?.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${artisan.artisan_name}, ${artisan.address}`
  )}`;

  return (
    <div className="flex-1 flex flex-col justify-between min-h-screen bg-[#FDFBF7]">
      <Header />

      <main className="flex-1 px-4 py-3 space-y-4 overflow-y-auto pb-28">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <Link
            href="/artisans"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-600 hover:text-neutral-900 bg-white px-3 py-1.5 rounded-full border border-neutral-200/80 shadow-2xs transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#E05A2B]" /> All Artisans
          </Link>

          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-500 hover:text-neutral-900 bg-white px-3 py-1.5 rounded-full border border-neutral-200/80 shadow-2xs transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            {copiedLink ? "Link Copied!" : "Share"}
          </button>
        </div>

        {/* Master Photo / Catalogue Gallery */}
        <div className="rounded-2xl overflow-hidden border border-neutral-200 bg-white shadow-xs space-y-2">
          <div className="relative h-60 w-full bg-neutral-900 group">
            <img
              src={images[selectedPhotoIndex] || images[0]}
              alt={`${artisan.artisan_name} masterwork`}
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => setIsLightboxOpen(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />

            {/* Lightbox zoom button */}
            <button
              onClick={() => setIsLightboxOpen(true)}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 backdrop-blur-xs transition-colors"
              title="Full screen gallery"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>

            {/* Badges on primary image */}
            <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-extrabold uppercase tracking-wider bg-white/95 text-[#E05A2B] px-2.5 py-1 rounded-full shadow-xs">
                {artisan.craft_type}
              </span>
              <span className="text-[10px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                <Award className="w-3 h-3" /> Master Craftsman
              </span>
            </div>

            {/* Photo Counter Pill */}
            <div className="absolute bottom-3 right-3 bg-black/70 text-white text-[11px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-xs">
              <Camera className="w-3.5 h-3.5" />
              {selectedPhotoIndex + 1} of {images.length}
            </div>

            {/* Arrow Nav for Carousel if multiple */}
            {images.length > 1 && (
              <>
                <button
                  onClick={() =>
                    setSelectedPhotoIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))
                  }
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-xs"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() =>
                    setSelectedPhotoIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-xs"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div className="px-3 pb-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedPhotoIndex(idx)}
                  className={`relative w-14 h-14 rounded-lg overflow-hidden shrink-0 border-2 transition-all ${
                    idx === selectedPhotoIndex
                      ? "border-[#E05A2B] ring-2 ring-[#E05A2B]/20 scale-105"
                      : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                >
                  <img src={img} alt="Thumbnail" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Artisan Heritage & Studio Bio */}
        <div className="p-4 rounded-2xl bg-white border border-neutral-200/90 shadow-xs space-y-3">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 uppercase tracking-wider">
              <span>Mewar Cultural Heritage</span>
            </div>
            <h1 className="text-xl font-extrabold text-neutral-900 mt-0.5">
              {artisan.artisan_name}
            </h1>
            <p className="text-xs text-neutral-500 flex items-center gap-1 mt-1">
              <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <span>{artisan.address}</span>
            </p>
          </div>

          {/* Quick info badges */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-100">
            <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/60">
              <span className="text-[10px] uppercase font-bold text-neutral-500 block">
                Studio Hours
              </span>
              <span className="text-xs font-bold text-neutral-800 flex items-center gap-1 mt-0.5">
                <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                {artisan.opening_time || "10:00"} - {artisan.closing_time || "20:00"}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/60">
              <span className="text-[10px] uppercase font-bold text-neutral-500 block">
                Studio Experience
              </span>
              <span className="text-xs font-bold text-emerald-800 flex items-center gap-1 mt-0.5">
                {artisan.has_workshop ? (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    Hands-on Workshop
                  </>
                ) : (
                  <>
                    <Store className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
                    Retail & Gallery
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Master story / bio */}
          <div className="space-y-1 pt-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Heritage & Master Craftsmanship
            </h3>
            <p className="text-xs text-neutral-700 leading-relaxed">
              {artisan.bio ||
                `${artisan.artisan_name} has practiced traditional ${artisan.craft_type} across Udaipur's Old City quarter for generations, preserving heritage art forms using natural minerals and authentic Mewari techniques.`}
            </p>
          </div>

          {/* Direct contact and directions */}
          <div className="flex items-center gap-2 pt-2 border-t border-neutral-100">
            {artisan.phone_number && (
              <a
                href={`tel:${artisan.phone_number}`}
                className="flex-1 py-2 px-3 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-neutral-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-[#E05A2B]" /> Call Studio
              </a>
            )}
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2 px-3 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-neutral-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Navigation className="w-3.5 h-3.5 text-amber-600" /> Get Directions
            </a>
          </div>
        </div>

        {/* Hands-on Workshop Masterclass Section */}
        {artisan.has_workshop && (
          <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#E05A2B] flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Hands-On Masterclass Offering
              </span>
              <span className="text-xs font-extrabold text-emerald-800 bg-white px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs flex items-center gap-0.5">
                <IndianRupee className="w-3 h-3 stroke-[2.5]" />
                {artisan.workshop_fee_inr}
                <span className="text-[10px] font-normal text-neutral-500 ml-0.5">/ person</span>
              </span>
            </div>

            <p className="text-xs text-neutral-700 leading-relaxed font-medium">
              {artisan.workshop_description}
            </p>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-amber-200/50 text-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-neutral-500">Duration</span>
                <p className="font-bold text-neutral-800 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-neutral-400" />
                  {artisan.workshop_duration_minutes} minutes
                </p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-neutral-500">Materials</span>
                <p className="font-bold text-neutral-800 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  All included + take-home
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Bottom CTA: Add to Basket / Route */}
        <div className="pt-2">
          <button
            onClick={handleBasketToggle}
            data-testid="artisan-detail-basket-btn"
            className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
              inBasket
                ? "bg-emerald-600 text-white hover:bg-emerald-700 ring-2 ring-emerald-500/20"
                : "bg-[#E05A2B] text-white hover:bg-[#c94d23] active:scale-[0.99]"
            }`}
          >
            {inBasket ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                Artisan in Your Itinerary Basket (Tap to Remove)
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 stroke-[3]" />
                Add Studio / Workshop to Itinerary
              </>
            )}
          </button>
        </div>
      </main>

      {/* Lightbox Modal for Full Screen Image Inspection */}
      {isLightboxOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between p-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-white pb-2">
            <span className="text-xs font-bold">
              {artisan.artisan_name} — Artifact Photo {selectedPhotoIndex + 1} of {images.length}
            </span>
            <button
              onClick={() => setIsLightboxOpen(false)}
              className="p-2 rounded-full bg-neutral-800 text-white hover:bg-neutral-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="relative flex-1 flex items-center justify-center">
            <img
              src={images[selectedPhotoIndex]}
              alt="Full size artifact"
              className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-2xl"
            />

            {images.length > 1 && (
              <>
                <button
                  onClick={() =>
                    setSelectedPhotoIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))
                  }
                  className="absolute left-2 p-2 rounded-full bg-neutral-800/80 hover:bg-neutral-700 text-white"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={() =>
                    setSelectedPhotoIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))
                  }
                  className="absolute right-2 p-2 rounded-full bg-neutral-800/80 hover:bg-neutral-700 text-white"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          <div className="pt-2 text-center text-xs text-neutral-400">
            Uploaded by {artisan.artisan_name} via Udaipur Artisan Living Heritage Portal
          </div>
        </div>
      )}

      {/* Floating basket button & basket review drawer */}
      <FloatingBasketButton onClick={() => setIsBasketOpen(true)} />
      <BasketDrawer isOpen={isBasketOpen} onClose={() => setIsBasketOpen(false)} />

      <BottomNav />
    </div>
  );
}
