"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Header } from "@/components/common/Header";
import { BottomNav } from "@/components/common/BottomNav";
import { useTrip } from "@/context/TripContext";
import { UpcomingStopEditor } from "@/components/trip/UpcomingStopEditor";

export default function TripEditPage() {
  const router = useRouter();
  const { revision, tripTitle } = useTrip();

  return (
    <div className="flex-1 flex flex-col justify-between bg-[#FDFBF7]">
      <Header title="Edit Upcoming Stops" subtitle={`${tripTitle} • Rev ${revision}`} />

      <main className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">
        <Link
          href="/trip"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Operational View
        </Link>

        <UpcomingStopEditor onClose={() => router.push("/trip")} />
      </main>

      <BottomNav />
    </div>
  );
}
