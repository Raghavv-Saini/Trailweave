"use client";

import React from "react";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { useBasket } from "@/context/BasketContext";

interface FloatingBasketButtonProps {
  onClick: () => void;
}

export function FloatingBasketButton({ onClick }: FloatingBasketButtonProps) {
  const { totalCount, totalEstimatedCostInr } = useBasket();

  if (totalCount === 0) return null;

  return (
    <div className="fixed bottom-20 right-5 z-40 animate-in fade-in slide-in-from-bottom-4 duration-200">
      <button
        onClick={onClick}
        className="flex items-center gap-2.5 px-4 py-3 rounded-full bg-neutral-900 text-white shadow-xl hover:bg-neutral-800 active:scale-95 transition-all border border-neutral-700/50"
        aria-label="View Trip Basket"
      >
        <div className="relative">
          <ShoppingBag className="w-4 h-4 text-[#E05A2B]" />
          <span className="absolute -top-1.5 -right-2 w-4 h-4 rounded-full bg-[#E05A2B] text-white text-[10px] font-bold flex items-center justify-center">
            {totalCount}
          </span>
        </div>
        <div className="text-left text-xs">
          <span className="font-bold leading-none block">Basket</span>
          <span className="text-[10px] text-neutral-400 font-medium leading-none block mt-0.5">
            ₹{totalEstimatedCostInr.toLocaleString()}
          </span>
        </div>
        <ArrowRight className="w-3.5 h-3.5 text-neutral-400 ml-0.5" />
      </button>
    </div>
  );
}

