"use client";

import React from "react";
import { Compass, ShoppingBag } from "lucide-react";
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

  return (
    <header className="px-5 pt-6 pb-4 border-b border-neutral-100 bg-white sticky top-0 z-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#E05A2B] to-[#F59E0B] flex items-center justify-center text-white shadow-sm">
            <Compass className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-neutral-900 leading-none">
              {title}
            </h1>
            <p className="text-[11px] text-neutral-500 font-medium mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>

        {showBasket && (
          <button
            onClick={onBasketClick}
            className="relative p-2 rounded-xl bg-neutral-50 border border-neutral-200 text-neutral-700 hover:bg-neutral-100 transition-colors"
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
    </header>
  );
}
