"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Navigation, Palette, Shield } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export function BottomNav() {
  const pathname = usePathname();
  const { isAdmin } = useAuth();

  if (pathname?.startsWith("/artisans/onboard") || pathname?.startsWith("/login")) {
    return null;
  }

  const touristNavItems: Array<{ label: string; href: string; icon: typeof Home; isLive?: boolean }> = [
    { label: "Home", href: "/", icon: Home },
    { label: "Trails", href: "/trails", icon: Compass },
    { label: "Artisans", href: "/artisans", icon: Palette },
    { label: "My Trip", href: "/trip", icon: Navigation, isLive: true },
  ];

  const adminNavItems: Array<{ label: string; href: string; icon: typeof Home; isLive?: boolean }> = [
    { label: "Admin", href: "/admin", icon: Shield },
    { label: "Trails", href: "/trails", icon: Compass },
    { label: "Artisans", href: "/artisans", icon: Palette },
  ];

  const navItems = isAdmin ? adminNavItems : touristNavItems;

  return (
    <nav className="md:hidden border-t border-neutral-200/80 bg-white/95 backdrop-blur-md px-6 py-2.5 flex items-center justify-between sticky bottom-0 z-30">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href ||
              (item.href !== "/" && pathname?.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative flex flex-col items-center space-y-1 text-[11px] font-medium transition-colors ${
              isActive
                ? "text-[#1E3A5F] font-bold"
                : "text-neutral-400 hover:text-neutral-600"
            }`}
          >
            <div className="relative">
              <Icon className="w-5 h-5" />
              {item.isLive && (
                <span
                  className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white"
                  title="Active Trip in Progress"
                />
              )}
            </div>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
