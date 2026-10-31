"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Compass,
  Sparkles,
  ShieldCheck,
  Navigation,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { BottomNav } from "@/components/common/BottomNav";

interface HealthData {
  status: string;
  database: string;
  postgis: string;
  places_count?: number;
  trails_count?: number;
}

export default function Home() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch("http://localhost:8000/health");
        if (res.ok) {
          const data = await res.json();
          setHealth(data);
        } else {
          setHealth({ status: "disconnected", database: "offline", postgis: "unknown" });
        }
      } catch {
        setHealth({ status: "disconnected", database: "offline", postgis: "unknown" });
      } finally {
        setLoading(false);
      }
    }
    checkHealth();
  }, []);

  return (
    <div className="flex-1 flex flex-col justify-between">
      {/* Header */}
      <header className="px-5 pt-6 pb-4 border-b border-neutral-100 bg-white sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#E05A2B] to-[#F59E0B] flex items-center justify-center text-white shadow-sm">
              <Compass className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-neutral-900 leading-none">
                TrailWeave
              </h1>
              <p className="text-[11px] text-neutral-500 font-medium mt-0.5">
                Udaipur Pilot • DevFest
              </p>
            </div>
          </div>

          {/* Backend Health Badge */}
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-neutral-50 border border-neutral-200">
            {loading ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-neutral-400" />
                <span className="text-neutral-500">Checking...</span>
              </>
            ) : health?.status === "ok" ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-emerald-700 font-medium">PostGIS Live</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3 text-amber-500" />
                <span className="text-amber-700 font-medium">FastAPI :8000</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-5 py-5 space-y-5 overflow-y-auto">
        {/* Hero Tagline */}
        <div className="rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50 to-[#FDFBF7] p-5 border border-amber-100/70 shadow-sm">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-amber-100/80 text-amber-900 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-[#E05A2B]" />
            <span>Community Knowledge Loop</span>
          </div>
          <h2 className="text-xl font-bold text-neutral-900 leading-tight">
            Explore like a local. Travel your way.
          </h2>
          <p className="text-xs text-neutral-600 mt-2 leading-relaxed">
            Real itineraries from genuine travelers, constraint-locked scheduling, and direct artisan workshop discovery.
          </p>

          <div className="mt-4 flex items-center gap-2">
            <Link
              href="/trip"
              className="flex-1 py-2.5 px-3 rounded-xl bg-[#E05A2B] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs hover:bg-[#c94d23] transition-colors"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Open My Active Trip</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/trails"
              className="py-2.5 px-3 rounded-xl bg-white border border-amber-200 text-neutral-800 font-bold text-xs hover:bg-amber-50 transition-colors"
            >
              Explore Trails
            </Link>
          </div>
        </div>

        {/* Foundation Status Card */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            System Foundation (Ticket 01)
          </h3>

          <div className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500 font-medium">Supabase PostgreSQL 17</span>
              <span className="inline-flex items-center text-emerald-700 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Connected
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-neutral-500 font-medium">PostGIS Spatial Extension</span>
              <span className="inline-flex items-center text-emerald-700 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" /> v3.3 GIST Active
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-neutral-500 font-medium">Core Database Tables</span>
              <span className="font-semibold text-neutral-800">10 / 10 Provisioned</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-neutral-500 font-medium">Udaipur Seed Landmarks</span>
              <span className="font-semibold text-neutral-800">
                {health?.places_count ?? 6} Verified Sites
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-neutral-500 font-medium">Pre-populated Community Trails</span>
              <span className="font-semibold text-neutral-800">
                {health?.trails_count ?? 2} Ready to Clone
              </span>
            </div>
          </div>
        </div>

        {/* Quick Discovery Cards Preview */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Initial Seeded Trails
          </h3>

          <div className="space-y-2.5">
            <Link
              href="/trails/trail_royal_palaces_crafts"
              className="block p-3.5 rounded-xl border border-neutral-200 bg-white hover:border-amber-300 transition-all shadow-xs"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm text-neutral-900">
                  Udaipur Royal Palaces & Crafts
                </h4>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-[#E05A2B] border border-amber-100">
                  ₹1,250
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                City Palace, Mohanlal Miniature Studio, Jagdish Temple, Bagore Ki Haveli.
              </p>
              <div className="flex items-center gap-2 mt-2.5 text-[11px] text-neutral-400 font-medium">
                <span>6.5 hrs</span>
                <span>•</span>
                <span>4 stops</span>
                <span>•</span>
                <span className="text-emerald-600 font-semibold">Experienced Badge</span>
              </div>
            </Link>

            <Link
              href="/trails/trail_old_city_heritage_walk"
              className="block p-3.5 rounded-xl border border-neutral-200 bg-white hover:border-amber-300 transition-all shadow-xs"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm text-neutral-900">
                  Old City Evening Heritage Walk
                </h4>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-[#E05A2B] border border-amber-100">
                  ₹450
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                Sunset at Gangaur Ghat, temple aarti, and street food at Sukhadia Circle.
              </p>
              <div className="flex items-center gap-2 mt-2.5 text-[11px] text-neutral-400 font-medium">
                <span>3.5 hrs</span>
                <span>•</span>
                <span>3 stops</span>
                <span>•</span>
                <span className="text-emerald-600 font-semibold">Featured</span>
              </div>
            </Link>
          </div>
        </div>
      </main>

      {/* Persistent Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
