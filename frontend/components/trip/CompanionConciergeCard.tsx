"use client";

import React, { useEffect, useState } from "react";
import { Sparkles, MessageSquare, Bell, Check, Compass } from "lucide-react";
import { useTrip } from "@/context/TripContext";
import { subscribeToTripPush } from "@/lib/pushNotifications";

interface CompanionConciergeCardProps {
  onOpenChat: () => void;
}

export function CompanionConciergeCard({ onOpenChat }: CompanionConciergeCardProps) {
  const { tripId, stops } = useTrip();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        setPushEnabled(true);
      }
    }
  }, []);

  const handleEnablePush = async () => {
    setIsSubscribing(true);
    const success = await subscribeToTripPush(tripId);
    if (success) {
      setPushEnabled(true);
    }
    setIsSubscribing(false);
  };

  // Find next pending stop
  const pendingStops = stops.filter((s) => s.visit_status === "pending");
  const nextStop = pendingStops[0];

  // Check recent audit events for acknowledged edits
  const recentSkip = stops.find((s) => s.visit_status === "skipped");

  return (
    <div className="relative overflow-hidden p-5 rounded-2xl bg-white border border-[#E8E4DC] shadow-xs space-y-3.5">
      {/* Top row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#1E3A5F] text-white flex items-center justify-center shadow-xs">
            <Compass className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-serif font-medium text-sm text-[#191C1E] tracking-tight">
                Cultured Local Companion
              </h3>
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            </div>
            <p className="text-[10px] text-[#7A746B] font-medium">Udaipur Live Concierge</p>
          </div>
        </div>

        {/* Web Push Status Pill */}
        <button
          onClick={handleEnablePush}
          disabled={pushEnabled || isSubscribing}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
            pushEnabled
              ? "bg-emerald-100 text-emerald-800"
              : "bg-[#FBF9F5] hover:bg-[#F4EFEA] text-neutral-700 border border-[#E8E4DC] cursor-pointer"
          }`}
          title={pushEnabled ? "Web Push Active" : "Enable Lockscreen Transition Tips"}
        >
          {pushEnabled ? (
            <>
              <Check className="w-3 h-3 text-emerald-600" />
              <span>Push Active</span>
            </>
          ) : (
            <>
              <Bell className="w-3 h-3 text-[#1E3A5F]" />
              <span>{isSubscribing ? "Enabling..." : "Enable Tips"}</span>
            </>
          )}
        </button>
      </div>

      {/* Acknowledgment of prior user manual actions if any */}
      {recentSkip && (
        <div className="px-3 py-2 rounded-xl bg-[#FBF9F5] border border-[#E8E4DC] text-[11px] text-[#3F464C] font-medium flex items-center gap-2">
          <Compass className="w-3.5 h-3.5 text-[#1E3A5F] shrink-0" />
          <span>
            Noted prior skip at <strong className="font-bold text-[#191C1E]">{recentSkip.name}</strong>. Remaining stops adapt automatically to your rhythm.
          </span>
        </div>
      )}

      {/* Dynamic guidance message */}
      <div className="text-xs text-[#3F464C] leading-relaxed bg-[#FBF9F5] p-3 rounded-xl border border-[#E8E4DC]">
        {nextStop ? (
          <p>
            <strong className="text-[#191C1E] font-semibold">Upcoming: {nextStop.name}.</strong>{" "}
            Take the pedestrian alley down Gangaur Ghat—it’s an easy stroll. Afternoon light is softening, perfect for haveli terrace photography.
          </p>
        ) : (
          <p>
            You have experienced all scheduled stops on your route! Head toward Lake Pichola ghats to watch the evening sunset lighting.
          </p>
        )}
      </div>

      {/* Quick Action button */}
      <div className="flex items-center gap-2 pt-0.5">
        <button
          onClick={onOpenChat}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-xl bg-[#1E3A5F] hover:bg-[#152943] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Ask Companion to Adapt Route</span>
        </button>
      </div>
    </div>
  );
}
