"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Compass, Mic, Shield, User, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

type SelectedRoleTab = "tourist" | "artisan" | "admin";

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isAdmin, login, signup } = useAuth();

  const initialRole = (searchParams.get("role") as SelectedRoleTab) || "tourist";
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const redirectTarget = searchParams.get("redirect") || "/";

  const [roleTab, setRoleTab] = useState<SelectedRoleTab>(
    initialRole === "admin" || initialRole === "artisan" ? initialRole : "tourist"
  );
  const [authMode, setAuthMode] = useState<"login" | "signup">(initialMode);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      if (isAdmin) {
        router.replace("/admin");
      } else {
        router.replace(redirectTarget === "/login" ? "/" : redirectTarget);
      }
    }
  }, [isAuthenticated, isAdmin, user, router, redirectTarget]);

  const handleRoleSwitch = (newRole: SelectedRoleTab) => {
    setRoleTab(newRole);
    setError(null);
    if (newRole === "admin") {
      setAuthMode("login");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (roleTab === "tourist" && authMode === "signup") {
        const res = await signup(email, password, fullName);
        if (!res.success) {
          setError(res.error || "Could not create account.");
        } else {
          router.push(redirectTarget === "/login" ? "/" : redirectTarget);
        }
      } else {
        const res = await login(email, password);
        if (!res.success) {
          setError(res.error || "Invalid email or password.");
        } else if (roleTab === "admin" && res.user?.role === "tourist") {
          setError("This account does not have Admin privileges.");
        } else if (res.user?.role === "admin" || res.user?.role === "superuser") {
          router.push("/admin");
        } else {
          router.push(redirectTarget === "/login" ? "/" : redirectTarget);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col justify-center items-center px-4 py-10">
      <div className="w-full max-w-md bg-white border border-[#E8E4DC] rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">
        {/* Brand Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1E3A5F] flex items-center justify-center text-white">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-serif text-2xl text-[#191C1E] leading-none">
              TrailWeave
            </h1>
            <p className="text-xs text-[#7A746B] mt-1">
              Select your role to continue
            </p>
          </div>
        </div>

        {/* Simple Role Selection Tabs */}
        <div className="grid grid-cols-3 gap-2 p-1 bg-[#F0ECE1] rounded-xl border border-[#E2DDD3]">
          <button
            type="button"
            onClick={() => handleRoleSwitch("tourist")}
            className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              roleTab === "tourist"
                ? "bg-white text-[#191C1E] shadow-2xs"
                : "text-[#6E675C] hover:text-[#191C1E]"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Tourist</span>
          </button>

          <button
            type="button"
            onClick={() => handleRoleSwitch("artisan")}
            className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              roleTab === "artisan"
                ? "bg-white text-[#191C1E] shadow-2xs"
                : "text-[#6E675C] hover:text-[#191C1E]"
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Artisan</span>
          </button>

          <button
            type="button"
            onClick={() => handleRoleSwitch("admin")}
            className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              roleTab === "admin"
                ? "bg-white text-[#191C1E] shadow-2xs"
                : "text-[#6E675C] hover:text-[#191C1E]"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Admin</span>
          </button>
        </div>

        {/* Artisan Branch */}
        {roleTab === "artisan" ? (
          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E8E4DC] space-y-2">
              <h2 className="text-sm font-bold text-[#191C1E]">
                Master Artisan Portal (कारीगर पोर्टल)
              </h2>
              <p className="text-xs text-[#5A544B] leading-relaxed">
                Artisans onboard using a 1-tap Hindi voice note or log in with their phone number and 4-digit PIN to manage their craft studio and catalogue photos.
              </p>
            </div>

            <Link
              href="/artisans/onboard"
              className="w-full py-3 px-4 rounded-xl bg-[#1E3A5F] text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-[#152842] transition-colors"
            >
              <span>Continue to Artisan Onboarding & Login</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          /* Tourist or Admin Email + Password Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            {roleTab === "tourist" && (
              <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-2">
                <span className="text-xs font-bold text-[#191C1E]">
                  {authMode === "login" ? "Tourist Sign In" : "Create Tourist Account"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode(authMode === "login" ? "signup" : "login");
                    setError(null);
                  }}
                  className="text-xs font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                >
                  {authMode === "login" ? "Need an account? Sign Up" : "Already have an account? Log In"}
                </button>
              </div>
            )}

            {roleTab === "admin" && (
              <div className="border-b border-[#E8E4DC] pb-2">
                <span className="text-xs font-bold text-[#191C1E]">
                  Admin & Superuser Sign In
                </span>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                {error}
              </div>
            )}

            {roleTab === "tourist" && authMode === "signup" && (
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#3D3830]">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Aarav Sharma"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2DDD3] text-sm focus:outline-none focus:border-[#1E3A5F]"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#3D3830]">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={
                  roleTab === "admin" ? "admin@trailweave.org" : "you@example.com"
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2DDD3] text-sm focus:outline-none focus:border-[#1E3A5F]"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#3D3830]">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2DDD3] text-sm focus:outline-none focus:border-[#1E3A5F]"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-xl bg-[#1E3A5F] text-white text-xs font-bold hover:bg-[#152842] transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting
                ? "Please wait..."
                : roleTab === "admin"
                ? "Sign In as Admin"
                : authMode === "signup"
                ? "Sign Up & Start Planning"
                : "Log In"}
            </button>

            {/* Quick Demo Credentials helper */}
            <div className="pt-2 border-t border-[#F0ECE1] flex items-center justify-between text-[11px] text-[#7A746B]">
              {roleTab === "admin" ? (
                <button
                  type="button"
                  onClick={() => {
                    setEmail("admin@trailweave.org");
                    setPassword("admin123");
                  }}
                  className="hover:text-[#1E3A5F] underline cursor-pointer"
                >
                  Fill default superuser (admin@trailweave.org / admin123)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setEmail("tourist@trailweave.org");
                    setPassword("tourist123");
                  }}
                  className="hover:text-[#1E3A5F] underline cursor-pointer"
                >
                  Fill demo tourist (tourist@trailweave.org / tourist123)
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FDFBF7]" />}>
      <LoginFormContent />
    </Suspense>
  );
}
