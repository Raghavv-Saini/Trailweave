"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, ShoppingBag, Mic } from "lucide-react";
import { useBasket } from "@/context/BasketContext";

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBasket?: boolean;
  onBasketClick?: () => void;
}

export function Header({
  title = "TrailWeave",
  subtitle = "Udaipur Pilot • DevFest",
  showBasket = true,
  onBasketClick,
}: HeaderProps) {
  const { totalCount } = useBasket();
  const pathname = usePathname();
  const isArtisanPortal = pathname?.startsWith("/artisans/onboard");

  return (
    <header className="px-5 pt-5 pb-3.5 border-b border-neutral-100 bg-white sticky top-0 z-20 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center space-x-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#E05A2B] to-[#F59E0B] flex items-center justify-center text-white shadow-sm shrink-0">
            <Compass className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight text-neutral-900 leading-none truncate">
              {title}
            </h1>
            <p className="text-[11px] text-neutral-500 font-medium mt-0.5 truncate">
              {subtitle}
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          {/* Role Switcher: Tourist vs. कारीगर / Artisan (ADR 0010 & Ticket 10) */}
          <div
            className="inline-flex items-center rounded-xl bg-neutral-100 p-0.5 border border-neutral-200/80 text-[11px] font-bold"
            role="navigation"
            aria-label="Role Switcher"
          >
            <Link
              href={isArtisanPortal ? "/" : pathname || "/"}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                !isArtisanPortal
                  ? "bg-white text-neutral-900 shadow-2xs"
                  : "text-neutral-500 hover:text-neutral-800"
              }`}
            >
              Tourist
            </Link>
            <Link
              href="/artisans/onboard"
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all ${
                isArtisanPortal
                  ? "bg-[#E05A2B] text-white shadow-2xs"
                  : "text-[#E05A2B] hover:bg-amber-50/80"
              }`}
            >
              <Mic className="w-3 h-3" />
              <span>कारीगर / Artisan</span>
            </Link>
          </div>

          {showBasket && (
            <button
              type="button"
              onClick={onBasketClick}
              className="relative p-2 rounded-xl bg-neutral-50 border border-neutral-200 text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
              aria-label="Trip Basket"
            >
              <ShoppingBag className="w-4 h-4" />
              {totalCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#E05A2B] text-white text-[10px] font-bold flex items-center justify-center">
                  {totalCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
