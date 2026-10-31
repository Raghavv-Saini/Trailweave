"use client";

import React, { useState } from "react";
import { Header } from "@/components/common/Header";
import { BottomNav } from "@/components/common/BottomNav";
import { Check, Mic, Phone } from "lucide-react";

export default function AdminPortalPage() {
  const [drafts, setDrafts] = useState([
    {
      id: "draft_01",
      sender_phone: "+919829012345",
      raw_transcript:
        "नमस्ते, मैं मास्टर मोहनलाल हूँ। मेरी दुकान जगदीश चौक में है। हम 400 साल पुरानी पिछवाई और लघु चित्रकारी सिखाते हैं। कार्यशाला 45 मिनट की है और ₹300 शुल्क है।",
      craft_type: "Miniature Painting",
      artisan_name: "Master Mohanlal Sharma",
      status: "pending",
    },
  ]);

  const handleApprove = (id: string) => {
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: "approved" } : d))
    );
  };

  return (
    <div className="flex-1 flex flex-col justify-between">
      <Header title="Admin Curation Portal" subtitle="Artisan Voice Note Ingestion" />

      <main className="flex-1 px-5 py-4 space-y-4 overflow-y-auto">
        <div className="p-3.5 rounded-xl bg-neutral-900 text-white space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
            <Mic className="w-3.5 h-3.5" /> WhatsApp Voice Pipeline
          </div>
          <p className="text-[11px] text-neutral-300">
            Review transcribed Hindi voice messages and 1-tap promote to verified directory.
          </p>
        </div>

        <div className="space-y-3">
          {drafts.map((d) => (
            <div
              key={d.id}
              className="p-4 rounded-xl border border-neutral-200 bg-white space-y-3 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#E05A2B]">{d.artisan_name}</span>
                <span className="text-[10px] font-semibold text-neutral-500 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-neutral-400" /> {d.sender_phone}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-100 text-xs text-neutral-700 italic">
                &quot;{d.raw_transcript}&quot;
              </div>

              <div className="flex items-center gap-2 pt-1">
                {d.status === "approved" ? (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg w-full text-center">
                    ✓ Approved &amp; Published to Places
                  </span>
                ) : (
                  <>
                    <button
                      onClick={() => handleApprove(d.id)}
                      className="flex-1 py-2 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1 hover:bg-emerald-700"
                    >
                      <Check className="w-3.5 h-3.5" /> 1-Tap Approve
                    </button>
                    <button className="px-3 py-2 rounded-lg border border-neutral-200 text-xs font-semibold text-neutral-600 hover:bg-neutral-50">
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
