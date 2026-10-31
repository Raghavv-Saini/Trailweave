"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Compass, ShoppingBag, Mic, LogOut, Shield, User } from "lucide-react";
import { useBasket } from "@/context/BasketContext";
import { useAuth } from "@/context/AuthContext";

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBasket?: boolean;
  onBasketClick?: () => void;
}

export function Header({
  title = "TrailWeave",
  subtitle = "Udaipur • The Mewar Edition",
  showBasket = true,
  onBasketClick,
}: HeaderProps) {
  const { totalCount } = useBasket();
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isArtisanPortal = pathname?.startsWith("/artisans/onboard");

  // Strictly separated role navigation: Tourist vs. कारीगर / Artisan vs. Admin
  // Role Switcher: Tourist vs. कारीगर / Artisan (/artisans/onboard)
  const touristNavItems: Array<{ label: string; href: string; isLive?: boolean }> = [
    { label: "Home", href: "/" },
    { label: "Community Trails", href: "/trails" },
    { label: "Artisan Studios", href: "/artisans" },
    { label: "My Trip", href: "/trip", isLive: true },
  ];

  const adminNavItems: Array<{ label: string; href: string; isLive?: boolean }> = [
    { label: "Curation & Admin", href: "/admin" },
    { label: "Community Trails", href: "/trails" },
    { label: "Artisan Studios", href: "/artisans" },
  ];

  const navItems = isArtisanPortal
    ? []
    : isAdmin
    ? adminNavItems
    : touristNavItems;

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <header className="border-b border-[#EAE6DF] bg-[#FDFBF7]/95 backdrop-blur-md sticky top-0 z-30 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
        {/* Brand identity */}
        <div className="flex items-center space-x-8 min-w-0">
          <Link
            href={isArtisanPortal ? "/artisans/onboard" : isAdmin ? "/admin" : "/"}
            className="flex items-center space-x-3 group min-w-0"
          >
            <div className="w-9 h-9 rounded-xl bg-[#1E3A5F] flex items-center justify-center text-[#FBF9F5] shadow-xs shrink-0 group-hover:bg-[#152842] transition-colors">
              <Compass className="w-5 h-5 stroke-[1.8]" />
            </div>
            <div className="min-w-0">
              <h1 className="font-serif text-xl sm:text-2xl font-normal tracking-tight text-[#191C1E] leading-none">
                {title}
              </h1>
              <p className="text-[10px] sm:text-[11px] text-[#7A746B] font-medium tracking-wide uppercase mt-1 truncate">
                {subtitle}
              </p>
            </div>
          </Link>

          {/* Desktop Navigation Links (>= md) */}
          {navItems.length > 0 && (
            <nav
              className="hidden md:flex items-center space-x-1 lg:space-x-2 text-sm font-medium"
              aria-label="Main Navigation"
            >
              {navItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href ||
                      (item.href !== "/" && pathname?.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-1.5 rounded-lg transition-all text-xs lg:text-sm font-medium flex items-center gap-1.5 ${
                      isActive
                        ? "bg-[#1E3A5F]/8 text-[#1E3A5F] font-semibold"
                        : "text-[#5A544B] hover:text-[#191C1E] hover:bg-[#F0ECE1]/50"
                    }`}
                  >
                    {item.label}
                    {item.isLive && (
                      <span
                        className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-[#FDFBF7]"
                        title="Live trip active"
                      />
                    )}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        {/* Right Actions: Role Context, Basket & Auth */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {isArtisanPortal ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1E3A5F] text-white text-xs font-bold">
                <Mic className="w-3 h-3" />
                <span>कारीगर पोर्टल</span>
              </span>
              <Link
                href="/login"
                className="px-2.5 py-1 rounded-lg border border-[#E2DDD3] bg-white text-xs font-semibold text-[#5A544B] hover:text-[#191C1E]"
              >
                Switch Role
              </Link>
            </div>
          ) : (
            <>
              {showBasket && !isAdmin && (
                <button
                  type="button"
                  onClick={onBasketClick}
                  className="relative p-2 rounded-xl bg-white border border-[#E2DDD3] text-[#191C1E] hover:border-[#1E3A5F]/40 hover:bg-[#FAF8F5] transition-all cursor-pointer shadow-2xs"
                  aria-label="Trip Basket"
                >
                  <ShoppingBag className="w-4 h-4 stroke-[1.8]" />
                  {totalCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#1E3A5F] text-white text-[10px] font-bold flex items-center justify-center">
                      {totalCount}
                    </span>
                  )}
                </button>
              )}

              {isAuthenticated && user ? (
                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F0ECE1] border border-[#E2DDD3] text-xs font-semibold text-[#191C1E]">
                    {isAdmin ? (
                      <Shield className="w-3.5 h-3.5 text-[#1E3A5F]" />
                    ) : (
                      <User className="w-3.5 h-3.5 text-[#1E3A5F]" />
                    )}
                    <span className="max-w-[120px] truncate">{user.full_name}</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="px-2.5 py-1.5 rounded-xl bg-white border border-[#E2DDD3] text-xs font-semibold text-[#5A544B] hover:text-rose-600 hover:border-rose-200 flex items-center gap-1 transition-colors cursor-pointer"
                    title="Log Out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Log Out</span>
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="px-3 py-1.5 rounded-xl bg-[#1E3A5F] text-white text-xs font-bold hover:bg-[#152842] transition-colors"
                >
                  Log In
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
