"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Navigation, Palette, Shield } from "lucide-react";

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { label: "Explore", href: "/trails", icon: Compass },
    { label: "My Trip", href: "/trip", icon: Navigation },
    { label: "Artisans", href: "/artisans", icon: Palette },
    { label: "Admin", href: "/admin", icon: Shield },
  ];

  return (
    <nav className="border-t border-neutral-100 bg-white px-6 py-2.5 flex items-center justify-between sticky bottom-0 z-20">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center space-y-1 text-[11px] font-medium transition-colors ${
              isActive ? "text-[#E05A2B]" : "text-neutral-400 hover:text-neutral-600"
            }`}
          >
            <Icon className="w-5 h-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
