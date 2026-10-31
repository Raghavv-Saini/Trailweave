"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/common/Header";
import { BottomNav } from "@/components/common/BottomNav";
import { useAuth } from "@/context/AuthContext";
import {
  Mic,
  Phone,
  Check,
  X,
  Sparkles,
  ChevronDown,
  ChevronUp,
  MapPin,
  Clock,
  Sparkle,
  Star,
  Plus,
  Eye,
  Edit3,
  Search,
  ExternalLink,
  Shield,
  Layers,
  Users,
  Compass,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
} from "lucide-react";
import { MOCK_ARTISANS, MOCK_TRAILS, MOCK_PLACES, MockArtisan } from "@/lib/mockData";

interface ArtisanDraft {
  id: string;
  sender_phone: string;
  raw_transcript: string;
  approval_status: "draft" | "approved" | "rejected";
  created_at?: string;
  extracted_data: {
    artisan_name: string;
    craft_type: string;
    place_name: string;
    address: string;
    latitude: number;
    longitude: number;
    has_workshop: boolean;
    workshop_fee_inr: number;
    workshop_duration_minutes: number;
    workshop_description: string;
    opening_time: string;
    closing_time: string;
    admin_brief: string;
    missing_info_checklist: string[];
    catalogue_images: string[];
  };
}

const INITIAL_DRAFTS: ArtisanDraft[] = [
  {
    id: "draft_shankar_demo",
    sender_phone: "+919829099887",
    raw_transcript:
      "नमस्ते, मैं शंकर लाल कुम्हार हूँ। मेरी टेराकोटा पॉटरी की दुकान हाथीपोल में है। हम 45 मिनट की वर्कशॉप कराते हैं जिसकी फीस 250 रुपये है।",
    approval_status: "draft",
    created_at: "Just now",
    extracted_data: {
      artisan_name: "Shankar Lal Kumhar",
      craft_type: "Terracotta Pottery & Clay Sculpting",
      place_name: "Shankar Lal Terracotta Pottery Studio",
      address: "Hathi Pole Bazaar, Old City, Udaipur, Rajasthan 313001",
      latitude: 24.584,
      longitude: 73.6865,
      has_workshop: true,
      workshop_fee_inr: 250,
      workshop_duration_minutes: 45,
      workshop_description:
        "Hands-on 45-minute terracotta pottery workshop with Shankar Lal Kumhar in Hathi Pole Bazaar.",
      opening_time: "10:00",
      closing_time: "19:30",
      admin_brief:
        "Artisan Shankar Lal Kumhar runs a Terracotta Pottery & Clay Sculpting studio in Hathi Pole Bazaar offering a 45-minute hands-on workshop for ₹250.",
      missing_info_checklist: [
        "Confirm daily opening and closing hours",
        "Verify max workshop batch capacity (e.g. 4-6 tourists)",
      ],
      catalogue_images: [
        "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=900&q=80",
      ],
    },
  },
  {
    id: "draft_geeta_bandhani",
    sender_phone: "+919829077665",
    raw_transcript:
      "खम्मा घणी! मैं गीता बाई हूँ। हम जगदीश मंदिर के पास पारंपारिक राजस्थानी बंधेज और टाई-डाई दुपट्टे बनाते हैं। पर्यटक आकर 30 मिनट में रंगाई सीख सकते हैं, ₹200 फीस है।",
    approval_status: "draft",
    created_at: "2 hours ago",
    extracted_data: {
      artisan_name: "Geeta Bai Chhipa",
      craft_type: "Traditional Mewar Bandhani & Tie-Dye",
      place_name: "Geeta Bai Heritage Bandhani Kendra",
      address: "Near Jagdish Temple, Bhatiyani Chohatta, Udaipur",
      latitude: 24.579,
      longitude: 73.684,
      has_workshop: true,
      workshop_fee_inr: 200,
      workshop_duration_minutes: 30,
      workshop_description:
        "Learn natural indigo and vegetable tie-dye tying and dipping on pure cotton scarves.",
      opening_time: "10:30",
      closing_time: "20:00",
      admin_brief:
        "Master artisan Geeta Bai runs an authentic Mewar Bandhani tie-dye studio near Jagdish Temple offering hands-on 30-minute natural dye sessions for ₹200.",
      missing_info_checklist: [
        "Confirm exact shop street number",
        "Confirm whether participants take scarf home immediately",
      ],
      catalogue_images: [
        "https://images.unsplash.com/photo-1606744888344-493238955de9?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=900&q=80",
      ],
    },
  },
];

interface DraftEditForm {
  artisan_name?: string;
  craft_type?: string;
  place_name?: string;
  address?: string;
  latitude?: number | string;
  longitude?: number | string;
  has_workshop?: boolean;
  workshop_fee_inr?: number | string;
  workshop_duration_minutes?: number | string;
  workshop_description?: string;
  opening_time?: string;
  closing_time?: string;
  bio?: string;
}

export default function AdminPortalPage() {
  const router = useRouter();
  const { isAuthenticated, isAdmin, isLoading, adminTeam, fetchAdminTeam, addAdminMember } = useAuth();
  const [activeTab, setActiveTab] = useState<"drafts" | "artisans" | "curation" | "team">("drafts");

  // New Admin Form state
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newAdminRole, setNewAdminRole] = useState<"admin" | "superuser">("admin");
  const [adminFormError, setAdminFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !isAdmin)) {
      router.replace("/login?role=admin");
    }
  }, [isLoading, isAuthenticated, isAdmin, router]);

  useEffect(() => {
    if (isAdmin) {
      fetchAdminTeam();
    }
  }, [isAdmin, fetchAdminTeam]);

  // Drafts state
  const [drafts, setDrafts] = useState<ArtisanDraft[]>(INITIAL_DRAFTS);
  const [draftFilter, setDraftFilter] = useState<"all" | "draft" | "approved" | "rejected">("all");
  const [expandedDraftId, setExpandedDraftId] = useState<string | null>("draft_shankar_demo");
  const [checkedChecklist, setCheckedChecklist] = useState<Record<string, boolean>>({});
  const [editFormData, setEditFormData] = useState<Record<string, DraftEditForm>>({});
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // All Artisans state
  const [artisans, setArtisans] = useState<MockArtisan[]>(MOCK_ARTISANS);
  const [artisanSearch, setArtisanSearch] = useState("");
  const [editingArtisanId, setEditingArtisanId] = useState<string | null>(null);
  const [editArtisanForm, setEditArtisanForm] = useState<Partial<MockArtisan>>({});

  // Curation state
  const [trails, setTrails] = useState(MOCK_TRAILS);
  const [places, setPlaces] = useState(MOCK_PLACES);
  const [newPlace, setNewPlace] = useState<{
    name: string;
    category: "attraction" | "heritage" | "dining" | "artisan_studio";
    address: string;
    latitude: number;
    longitude: number;
    opening_time: string;
    closing_time: string;
    entry_fee_inr: number;
    typical_duration_minutes: number;
  }>({
    name: "",
    category: "heritage",
    address: "",
    latitude: 24.58,
    longitude: 73.68,
    opening_time: "09:00",
    closing_time: "18:00",
    entry_fee_inr: 0,
    typical_duration_minutes: 60,
  });

  // Notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch drafts from backend on mount if available
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/admin/artisan-drafts");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setDrafts(data);
          }
        }
      } catch {
        // Fallback to initial mock drafts
      }

      try {
        const resArt = await fetch("/api/admin/artisans");
        if (resArt.ok) {
          const dataArt = await resArt.json();
          if (Array.isArray(dataArt) && dataArt.length > 0) {
            setArtisans(dataArt);
          }
        }
      } catch {
        // Fallback
      }

      try {
        const resTr = await fetch("/api/admin/trails");
        if (resTr.ok) {
          const dataTr = await resTr.json();
          if (Array.isArray(dataTr) && dataTr.length > 0) {
            setTrails(dataTr);
          }
        }
      } catch {
        // Fallback
      }
    }
    loadData();
  }, []);

  // Filtered drafts
  const filteredDrafts = useMemo(() => {
    if (draftFilter === "all") return drafts;
    return drafts.filter((d) => d.approval_status === draftFilter);
  }, [drafts, draftFilter]);

  // Draft approval handler
  const handleApproveDraft = async (draft: ArtisanDraft) => {
    const edits = editFormData[draft.id] || {};
    const payload = {
      artisan_name: String(edits.artisan_name || draft.extracted_data.artisan_name || ""),
      craft_type: String(edits.craft_type || draft.extracted_data.craft_type || ""),
      place_name: String(edits.place_name || draft.extracted_data.place_name || ""),
      address: String(edits.address || draft.extracted_data.address || ""),
      latitude: edits.latitude ? parseFloat(String(edits.latitude)) : draft.extracted_data.latitude,
      longitude: edits.longitude ? parseFloat(String(edits.longitude)) : draft.extracted_data.longitude,
      has_workshop:
        edits.has_workshop !== undefined
          ? Boolean(edits.has_workshop)
          : Boolean(draft.extracted_data.has_workshop),
      workshop_fee_inr:
        edits.workshop_fee_inr !== undefined
          ? parseFloat(String(edits.workshop_fee_inr))
          : draft.extracted_data.workshop_fee_inr,
      workshop_duration_minutes:
        edits.workshop_duration_minutes !== undefined
          ? parseInt(String(edits.workshop_duration_minutes))
          : draft.extracted_data.workshop_duration_minutes,
      workshop_description: String(
        edits.workshop_description || draft.extracted_data.workshop_description || ""
      ),
      opening_time: String(edits.opening_time || draft.extracted_data.opening_time || ""),
      closing_time: String(edits.closing_time || draft.extracted_data.closing_time || ""),
      bio: String(edits.bio || draft.extracted_data.admin_brief || ""),
    };

    try {
      await fetch(`/api/admin/artisan-drafts/${draft.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // Local state fallback
    }

    // Update local state
    setDrafts((prev) =>
      prev.map((d) => (d.id === draft.id ? { ...d, approval_status: "approved" } : d))
    );

    // Also add to artisans list
    const newArtisan: MockArtisan = {
      id: `artisan_${draft.id.replace("draft_", "")}`,
      place_id: `place_${draft.id.replace("draft_", "")}_studio`,
      artisan_name: payload.artisan_name,
      craft_type: payload.craft_type,
      address: payload.address,
      latitude: payload.latitude,
      longitude: payload.longitude,
      phone_number: draft.sender_phone,
      bio: payload.bio,
      has_workshop: payload.has_workshop,
      workshop_fee_inr: payload.workshop_fee_inr,
      workshop_duration_minutes: payload.workshop_duration_minutes,
      workshop_description: payload.workshop_description,
      opening_time: payload.opening_time,
      closing_time: payload.closing_time,
      catalogue_images: draft.extracted_data.catalogue_images || [],
    };

    setArtisans((prev) => [newArtisan, ...prev.filter((a) => a.id !== newArtisan.id)]);

    // Persist to local approved artisans storage for seamless demo & offline continuity
    if (typeof window !== "undefined") {
      try {
        const rawSaved = localStorage.getItem("trailweave_approved_artisans");
        const list: MockArtisan[] = rawSaved ? JSON.parse(rawSaved) : [];
        const updatedList = [newArtisan, ...list.filter((a) => a.id !== newArtisan.id)];
        localStorage.setItem("trailweave_approved_artisans", JSON.stringify(updatedList));
      } catch {
        // Storage fallback
      }
    }

    showToast(`✓ Master artisan "${payload.artisan_name}" approved & published to canonical directory!`);
  };

  // Draft rejection handler
  const handleRejectDraft = async (draftId: string) => {
    try {
      await fetch(`/api/admin/artisan-drafts/${draftId}/reject`, {
        method: "POST",
      });
    } catch {
      // Local state fallback
    }

    setDrafts((prev) =>
      prev.map((d) => (d.id === draftId ? { ...d, approval_status: "rejected" } : d))
    );
    showToast(`Draft marked as rejected.`);
  };

  // Edit Artisan handler
  const handleSaveArtisanEdit = async (artisanId: string) => {
    try {
      await fetch(`/api/admin/artisans/${artisanId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editArtisanForm),
      });
    } catch {
      // Fallback
    }

    setArtisans((prev) =>
      prev.map((a) => (a.id === artisanId ? { ...a, ...editArtisanForm } : a))
    );
    setEditingArtisanId(null);
    setEditArtisanForm({});
    showToast("✓ Artisan profile & contact details updated successfully.");
  };

  // Trail feature toggle handler
  const handleToggleTrailFeature = async (trailId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    try {
      await fetch(`/api/admin/trails/${trailId}/feature`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_featured: newStatus }),
      });
    } catch {
      // Fallback
    }

    setTrails((prev) =>
      prev.map((t) => (t.id === trailId ? { ...t, is_featured: newStatus } : t))
    );
    showToast(`Trail ${newStatus ? "featured on homepage" : "unfeatured"}.`);
  };

  // Add Place handler
  const handleCreatePlace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlace.name || !newPlace.address) return;

    try {
      await fetch("/api/admin/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPlace),
      });
    } catch {
      // Fallback
    }

    const created = {
      id: `place_${newPlace.name.toLowerCase().replace(/\s+/g, "_")}`,
      ...newPlace,
    };
    setPlaces((prev) => [created, ...prev]);
    setNewPlace({
      name: "",
      category: "heritage",
      address: "",
      latitude: 24.58,
      longitude: 73.68,
      opening_time: "09:00",
      closing_time: "18:00",
      entry_fee_inr: 0,
      typical_duration_minutes: 60,
    });
    showToast(`✓ Place "${created.name}" verified and added to places catalogue!`);
  };

  // Filtered artisans
  const filteredArtisans = useMemo(() => {
    if (!artisanSearch) return artisans;
    const q = artisanSearch.toLowerCase();
    return artisans.filter(
      (a) =>
        a.artisan_name.toLowerCase().includes(q) ||
        a.craft_type.toLowerCase().includes(q) ||
        a.address.toLowerCase().includes(q)
    );
  }, [artisans, artisanSearch]);

  const pendingDraftsCount = useMemo(
    () => drafts.filter((d) => d.approval_status === "draft").length,
    [drafts]
  );

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 text-neutral-900 pb-16">
      <Header
        title="Admin Curation Portal"
        subtitle="Artisan Voice Ingestion & Verification"
        showBasket={false}
      />

      {/* Toast notification banner */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-neutral-900 text-white text-xs font-semibold shadow-lg flex items-center gap-2 border border-neutral-700 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Operational Tabs Header */}
      <div className="bg-white border-b border-neutral-200 sticky top-[69px] z-10 px-5 pt-2">
        <div className="flex gap-2 max-w-4xl mx-auto overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("drafts")}
            className={`flex items-center gap-1.5 py-3 px-3.5 border-b-2 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "drafts"
                ? "border-[#1E3A5F] text-[#1E3A5F]"
                : "border-transparent text-neutral-500 hover:text-neutral-900"
            }`}
          >
            <Mic className="w-4 h-4" />
            <span>Voice Onboarding Drafts</span>
            {pendingDraftsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#1E3A5F] text-white">
                {pendingDraftsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("artisans")}
            className={`flex items-center gap-1.5 py-3 px-3.5 border-b-2 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "artisans"
                ? "border-[#1E3A5F] text-[#1E3A5F]"
                : "border-transparent text-neutral-500 hover:text-neutral-900"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>All Artisans &amp; Contact Info</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 text-neutral-600">
              {artisans.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("curation")}
            className={`flex items-center gap-1.5 py-3 px-3.5 border-b-2 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "curation"
                ? "border-[#1E3A5F] text-[#1E3A5F]"
                : "border-transparent text-neutral-500 hover:text-neutral-900"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Trails &amp; Places Curation</span>
          </button>

          <button
            onClick={() => setActiveTab("team")}
            className={`flex items-center gap-1.5 py-3 px-3.5 border-b-2 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "team"
                ? "border-[#1E3A5F] text-[#1E3A5F]"
                : "border-transparent text-neutral-500 hover:text-neutral-900"
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Admin Team &amp; Superusers</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 text-neutral-600">
              {adminTeam.length}
            </span>
          </button>
        </div>
      </div>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ========================================================================= */}
        {/* TAB 1: VOICE ONBOARDING DRAFTS QUEUE */}
        {/* ========================================================================= */}
        {activeTab === "drafts" && (
          <div className="space-y-4">
            {/* Header info banner */}
            <div className="p-4 rounded-2xl bg-neutral-900 text-white shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                  <Sparkles className="w-4 h-4" />
                  <span>Hindi Web Voice Onboarding Pipeline</span>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-300 font-medium">
                  {pendingDraftsCount} Pending Approval
                </span>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                Review incoming voice drafts submitted via{" "}
                <Link
                  href="/artisans/onboard"
                  className="text-amber-400 underline underline-offset-2 hover:text-amber-300"
                >
                  /artisans/onboard
                </Link>
                . Inspect the AI-generated English Admin Brief &amp; Missing Info Checklist, 1-tap call
                the artisan to clarify details, edit pre-filled data, and promote to the public directory.
              </p>
            </div>

            {/* Status Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {(
                [
                  { id: "all", label: "All Submissions" },
                  { id: "draft", label: "Pending Review" },
                  { id: "approved", label: "Approved & Published" },
                  { id: "rejected", label: "Rejected" },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setDraftFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    draftFilter === f.id
                      ? "bg-neutral-900 text-white shadow-xs"
                      : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Drafts List */}
            {filteredDrafts.length === 0 ? (
              <div className="p-10 text-center rounded-2xl bg-white border border-neutral-200 space-y-2">
                <Mic className="w-8 h-8 mx-auto text-neutral-300" />
                <h4 className="text-sm font-bold text-neutral-800">No voice drafts found</h4>
                <p className="text-xs text-neutral-500">
                  Try selecting another filter or wait for new artisan voice submissions.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredDrafts.map((draft) => {
                  const ext = draft.extracted_data || {};
                  const isExpanded = expandedDraftId === draft.id;
                  const currentForm = editFormData[draft.id] || {
                    artisan_name: ext.artisan_name,
                    craft_type: ext.craft_type,
                    place_name: ext.place_name,
                    address: ext.address,
                    latitude: ext.latitude,
                    longitude: ext.longitude,
                    opening_time: ext.opening_time,
                    closing_time: ext.closing_time,
                    has_workshop: ext.has_workshop,
                    workshop_fee_inr: ext.workshop_fee_inr,
                    workshop_duration_minutes: ext.workshop_duration_minutes,
                    workshop_description: ext.workshop_description,
                    bio: ext.admin_brief,
                  };

                  return (
                    <div
                      key={draft.id}
                      className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-xs hover:border-neutral-300 transition-all"
                    >
                      {/* Top Bar with Artisan Name, Phone & Status */}
                      <div className="p-4 border-b border-neutral-100 flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-extrabold text-neutral-900">
                              {ext.artisan_name || "Unknown Artisan"}
                            </h3>
                            <span
                              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                draft.approval_status === "approved"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : draft.approval_status === "rejected"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-amber-100 text-amber-900"
                              }`}
                            >
                              {draft.approval_status === "draft"
                                ? "Pending Review"
                                : draft.approval_status}
                            </span>
                          </div>
                          <p className="text-xs text-[#1E3A5F] font-bold">
                            {ext.craft_type || "Traditional Craft"}
                          </p>
                        </div>

                        {/* 1-Tap Call Phone Action */}
                        <div className="flex items-center gap-2">
                          <a
                            href={`tel:${draft.sender_phone}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 text-xs font-bold transition-colors cursor-pointer"
                            title="Call artisan directly to clarify missing info"
                          >
                            <Phone className="w-3.5 h-3.5 text-emerald-700" />
                            <span>{draft.sender_phone}</span>
                          </a>
                        </div>
                      </div>

                      {/* Content Body */}
                      <div className="p-4 space-y-4">
                        {/* 1. English Admin Brief (Gemini Generated) */}
                        <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-900">
                            <Sparkle className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                            <span>English Admin Brief (AI-Generated)</span>
                          </div>
                          <p className="text-xs text-neutral-700 leading-relaxed">
                            {ext.admin_brief || "No brief generated."}
                          </p>
                        </div>

                        {/* 2. Missing Info to Ask Checklist */}
                        {Array.isArray(ext.missing_info_checklist) &&
                          ext.missing_info_checklist.length > 0 && (
                            <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200/80 space-y-2">
                              <div className="flex items-center gap-1.5 text-xs font-extrabold text-rose-900">
                                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                                <span>Missing Info to Clarify On Call</span>
                              </div>
                              <div className="space-y-1.5">
                                {ext.missing_info_checklist.map((item, idx) => {
                                  const key = `${draft.id}_${idx}`;
                                  const isChecked = !!checkedChecklist[key];
                                  return (
                                    <label
                                      key={key}
                                      className="flex items-start gap-2 text-xs text-neutral-700 cursor-pointer select-none"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() =>
                                          setCheckedChecklist((prev) => ({
                                            ...prev,
                                            [key]: !prev[key],
                                          }))
                                        }
                                        className="mt-0.5 rounded border-neutral-300 text-[#E05A2B] focus:ring-[#E05A2B]"
                                      />
                                      <span
                                        className={
                                          isChecked ? "line-through text-neutral-400" : ""
                                        }
                                      >
                                        {item}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                        {/* 3. Raw Hindi Transcript */}
                        <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100 space-y-1">
                          <div className="flex items-center gap-1 text-[11px] font-bold text-neutral-500 uppercase tracking-wide">
                            <Mic className="w-3 h-3 text-neutral-400" />
                            <span>Raw Hindi Voice Transcript</span>
                          </div>
                          <p className="text-xs text-neutral-800 italic font-serif leading-relaxed">
                            &quot;{draft.raw_transcript}&quot;
                          </p>
                        </div>

                        {/* 4. Uploaded Craft Photos (catalogue_images preview) */}
                        {Array.isArray(ext.catalogue_images) && ext.catalogue_images.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] font-bold text-neutral-600">
                              <span>Uploaded Craft &amp; Artifact Photos</span>
                              <span className="text-[10px] text-neutral-400">
                                {ext.catalogue_images.length} photos
                              </span>
                            </div>
                            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                              {ext.catalogue_images.map((imgUrl, i) => (
                                <button
                                  type="button"
                                  key={i}
                                  onClick={() => setSelectedImage(imgUrl)}
                                  className="relative w-20 h-20 rounded-xl overflow-hidden border border-neutral-200 shrink-0 group cursor-pointer focus:outline-hidden"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={imgUrl}
                                    alt={`Artifact ${i + 1}`}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                  />
                                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <Eye className="w-4 h-4 text-white" />
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 5. Collapsible Verification & Refinement Form */}
                        <div className="border border-neutral-100 rounded-xl overflow-hidden">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedDraftId(isExpanded ? null : draft.id)
                            }
                            className="w-full px-3.5 py-2.5 bg-neutral-50/80 hover:bg-neutral-100/80 flex items-center justify-between text-xs font-bold text-neutral-700 transition-colors cursor-pointer"
                          >
                            <span className="flex items-center gap-1.5">
                              <Edit3 className="w-3.5 h-3.5 text-[#E05A2B]" />
                              <span>Review &amp; Refine Studio Details</span>
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-neutral-500" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-neutral-500" />
                            )}
                          </button>

                          {isExpanded && (
                            <div className="p-3.5 bg-white border-t border-neutral-100 space-y-3 text-xs">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                                    Artisan Name
                                  </label>
                                  <input
                                    type="text"
                                    value={currentForm.artisan_name || ""}
                                    onChange={(e) =>
                                      setEditFormData((prev) => ({
                                        ...prev,
                                        [draft.id]: {
                                          ...currentForm,
                                          artisan_name: e.target.value,
                                        },
                                      }))
                                    }
                                    className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-xs focus:ring-1 focus:ring-[#E05A2B]"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                                    Craft Category
                                  </label>
                                  <input
                                    type="text"
                                    value={currentForm.craft_type || ""}
                                    onChange={(e) =>
                                      setEditFormData((prev) => ({
                                        ...prev,
                                        [draft.id]: {
                                          ...currentForm,
                                          craft_type: e.target.value,
                                        },
                                      }))
                                    }
                                    className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-xs focus:ring-1 focus:ring-[#E05A2B]"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                                  Studio Place Name
                                </label>
                                <input
                                  type="text"
                                  value={currentForm.place_name || ""}
                                  onChange={(e) =>
                                    setEditFormData((prev) => ({
                                      ...prev,
                                      [draft.id]: {
                                        ...currentForm,
                                        place_name: e.target.value,
                                      },
                                    }))
                                  }
                                  className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-xs focus:ring-1 focus:ring-[#E05A2B]"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                                  Physical Address
                                </label>
                                <input
                                  type="text"
                                  value={currentForm.address || ""}
                                  onChange={(e) =>
                                    setEditFormData((prev) => ({
                                      ...prev,
                                      [draft.id]: {
                                        ...currentForm,
                                        address: e.target.value,
                                      },
                                    }))
                                  }
                                  className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-xs focus:ring-1 focus:ring-[#E05A2B]"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                                    Opening Time
                                  </label>
                                  <input
                                    type="text"
                                    value={currentForm.opening_time || "10:00"}
                                    onChange={(e) =>
                                      setEditFormData((prev) => ({
                                        ...prev,
                                        [draft.id]: {
                                          ...currentForm,
                                          opening_time: e.target.value,
                                        },
                                      }))
                                    }
                                    className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                                    Closing Time
                                  </label>
                                  <input
                                    type="text"
                                    value={currentForm.closing_time || "19:30"}
                                    onChange={(e) =>
                                      setEditFormData((prev) => ({
                                        ...prev,
                                        [draft.id]: {
                                          ...currentForm,
                                          closing_time: e.target.value,
                                        },
                                      }))
                                    }
                                    className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-xs"
                                  />
                                </div>
                              </div>

                              {/* Workshop specifics */}
                              <div className="p-3 rounded-lg bg-neutral-50 space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-neutral-800 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(currentForm.has_workshop)}
                                    onChange={(e) =>
                                      setEditFormData((prev) => ({
                                        ...prev,
                                        [draft.id]: {
                                          ...currentForm,
                                          has_workshop: e.target.checked,
                                        },
                                      }))
                                    }
                                    className="rounded border-neutral-300 text-[#E05A2B]"
                                  />
                                  <span>Offers Hands-On Tourist Workshops</span>
                                </label>

                                {currentForm.has_workshop && (
                                  <div className="grid grid-cols-2 gap-3 pt-1">
                                    <div>
                                      <label className="block text-[10px] font-bold text-neutral-500 mb-1">
                                        Fee per Person (₹)
                                      </label>
                                      <input
                                        type="number"
                                        value={currentForm.workshop_fee_inr || 0}
                                        onChange={(e) =>
                                          setEditFormData((prev) => ({
                                            ...prev,
                                            [draft.id]: {
                                              ...currentForm,
                                              workshop_fee_inr: e.target.value,
                                            },
                                          }))
                                        }
                                        className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-xs bg-white"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold text-neutral-500 mb-1">
                                        Duration (Mins)
                                      </label>
                                      <input
                                        type="number"
                                        value={currentForm.workshop_duration_minutes || 45}
                                        onChange={(e) =>
                                          setEditFormData((prev) => ({
                                            ...prev,
                                            [draft.id]: {
                                              ...currentForm,
                                              workshop_duration_minutes: e.target.value,
                                            },
                                          }))
                                        }
                                        className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-xs bg-white"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 6. Action Buttons */}
                        <div className="flex items-center gap-2 pt-1">
                          {draft.approval_status === "approved" ? (
                            <div className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-center gap-1.5">
                              <Check className="w-4 h-4 text-emerald-600" />
                              <span>Approved &amp; Published to Places &amp; Artisans</span>
                            </div>
                          ) : draft.approval_status === "rejected" ? (
                            <div className="w-full py-2.5 px-4 rounded-xl bg-neutral-100 text-neutral-500 text-xs font-bold text-center">
                              Marked as Rejected
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleApproveDraft(draft)}
                                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                              >
                                <Check className="w-4 h-4" />
                                <span>1-Tap Approve &amp; Publish</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectDraft(draft.id)}
                                className="px-4 py-2.5 rounded-xl border border-neutral-200 hover:bg-neutral-100 text-neutral-700 font-bold text-xs transition-colors cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: ALL ARTISANS & CONTACT INFO DIRECTORY */}
        {/* ========================================================================= */}
        {activeTab === "artisans" && (
          <div className="space-y-4">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-neutral-900">
                  Master Artisans &amp; Studio Directory
                </h2>
                <p className="text-xs text-neutral-500">
                  Manage contact details, operational hours, workshop pricing, and photos for all
                  verified craftsmen.
                </p>
              </div>

              {/* Search input */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search artisan or craft..."
                  value={artisanSearch}
                  onChange={(e) => setArtisanSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-neutral-200 bg-white text-xs focus:ring-1 focus:ring-[#E05A2B]"
                />
              </div>
            </div>

            {/* Artisans List */}
            <div className="grid grid-cols-1 gap-4">
              {filteredArtisans.map((artisan) => {
                const isEditing = editingArtisanId === artisan.id;

                return (
                  <div
                    key={artisan.id}
                    className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-xs space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-extrabold text-neutral-900">
                            {artisan.artisan_name}
                          </h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Verified
                          </span>
                        </div>
                        <p className="text-xs text-[#E05A2B] font-bold">{artisan.craft_type}</p>
                      </div>

                      {/* Contact & Edit actions */}
                      <div className="flex items-center gap-2">
                        {artisan.phone_number && (
                          <a
                            href={`tel:${artisan.phone_number}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold hover:bg-emerald-100 transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{artisan.phone_number}</span>
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            if (isEditing) {
                              setEditingArtisanId(null);
                            } else {
                              setEditingArtisanId(artisan.id);
                              setEditArtisanForm(artisan);
                            }
                          }}
                          className="p-1.5 rounded-xl border border-neutral-200 hover:bg-neutral-100 text-neutral-600 transition-colors cursor-pointer"
                          title="Edit artisan profile"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Studio details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-neutral-600">
                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
                        <span>{artisan.address}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span>
                          Hours: {artisan.opening_time || "10:00"} - {artisan.closing_time || "19:30"}
                        </span>
                      </div>
                    </div>

                    {/* Workshop status */}
                    <div className="p-2.5 rounded-xl bg-neutral-50 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-neutral-700">
                          {artisan.has_workshop ? "✓ Hands-on Workshop Available" : "Retail Only"}
                        </span>
                        {artisan.has_workshop && (
                          <span className="font-extrabold text-[#E05A2B]">
                            ₹{artisan.workshop_fee_inr} • {artisan.workshop_duration_minutes} mins
                          </span>
                        )}
                      </div>
                      {artisan.has_workshop && artisan.workshop_description && (
                        <p className="text-neutral-500 text-[11px]">
                          {artisan.workshop_description}
                        </p>
                      )}
                    </div>

                    {/* Catalogue photos strip */}
                    {Array.isArray(artisan.catalogue_images) &&
                      artisan.catalogue_images.length > 0 && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                          {artisan.catalogue_images.map((img, i) => (
                            <button
                              type="button"
                              key={i}
                              onClick={() => setSelectedImage(img)}
                              className="relative w-16 h-16 rounded-lg overflow-hidden border border-neutral-200 shrink-0 cursor-pointer focus:outline-hidden"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={img}
                                alt={`Artifact ${i}`}
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      )}

                    {/* Inline Edit Form */}
                    {isEditing && (
                      <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50 space-y-3 pt-3">
                        <h4 className="text-xs font-bold text-neutral-800">
                          Edit Profile &amp; Contact Info
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="block text-[10px] font-bold text-neutral-500 mb-1">
                              Phone Number
                            </label>
                            <input
                              type="text"
                              value={editArtisanForm.phone_number || ""}
                              onChange={(e) =>
                                setEditArtisanForm((prev) => ({
                                  ...prev,
                                  phone_number: e.target.value,
                                }))
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-neutral-500 mb-1">
                              Workshop Fee (₹)
                            </label>
                            <input
                              type="number"
                              value={editArtisanForm.workshop_fee_inr || 0}
                              onChange={(e) =>
                                setEditArtisanForm((prev) => ({
                                  ...prev,
                                  workshop_fee_inr: parseFloat(e.target.value),
                                }))
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-neutral-500 mb-1">
                            Heritage Bio
                          </label>
                          <textarea
                            rows={2}
                            value={editArtisanForm.bio || ""}
                            onChange={(e) =>
                              setEditArtisanForm((prev) => ({
                                ...prev,
                                bio: e.target.value,
                              }))
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs"
                          />
                        </div>

                        <div className="flex items-center gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => setEditingArtisanId(null)}
                            className="px-3 py-1.5 rounded-lg border border-neutral-200 text-xs text-neutral-600 font-bold hover:bg-neutral-100"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveArtisanEdit(artisan.id)}
                            className="px-4 py-1.5 rounded-lg bg-neutral-900 text-white text-xs font-bold hover:bg-neutral-800"
                          >
                            Save Changes
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: TRAILS & PLACES CURATION */}
        {/* ========================================================================= */}
        {activeTab === "curation" && (
          <div className="space-y-6">
            {/* Section 1: Community Trails Moderation */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-neutral-900">
                    Community Trails Moderation
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Feature authentic itineraries on the discovery homepage.
                  </p>
                </div>
                <span className="text-xs font-bold text-neutral-500">
                  {trails.length} Trails
                </span>
              </div>

              <div className="space-y-2.5">
                {trails.map((t) => (
                  <div
                    key={t.id}
                    className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-xs flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-extrabold text-neutral-900">{t.title}</h4>
                        {t.is_featured && (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 flex items-center gap-1">
                            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                            <span>Featured</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-500">
                        By {t.author_name} • {t.total_duration_hours} hrs • ₹{t.estimated_cost_inr}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleTrailFeature(t.id, t.is_featured)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        t.is_featured
                          ? "bg-amber-50 border border-amber-200 text-amber-900 hover:bg-amber-100"
                          : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                      }`}
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${
                          t.is_featured ? "fill-amber-500 text-amber-500" : "text-neutral-400"
                        }`}
                      />
                      <span>{t.is_featured ? "Unfeature" : "Feature on Home"}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 2: Add / Import Verified Udaipur Place */}
            <div className="p-5 rounded-2xl bg-white border border-neutral-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-sm font-extrabold text-neutral-900">
                <Plus className="w-4 h-4 text-[#E05A2B]" />
                <span>Add / Import Verified Udaipur Place</span>
              </div>

              <form onSubmit={handleCreatePlace} className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                      Place Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ambrai Ghat Promenade"
                      value={newPlace.name}
                      onChange={(e) => setNewPlace({ ...newPlace, name: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                      Category
                    </label>
                    <select
                      value={newPlace.category}
                      onChange={(e) =>
                        setNewPlace({
                          ...newPlace,
                          category: e.target.value as "attraction" | "heritage" | "dining" | "artisan_studio",
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white"
                    >
                      <option value="heritage">Heritage</option>
                      <option value="attraction">Attraction</option>
                      <option value="scenic">Scenic / Lake View</option>
                      <option value="artisan_studio">Artisan Studio</option>
                      <option value="dining">Dining / Food</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                    Address *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Chandpole, Old City, Udaipur, Rajasthan 313001"
                    value={newPlace.address}
                    onChange={(e) => setNewPlace({ ...newPlace, address: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-500 mb-1">
                      Opening Time
                    </label>
                    <input
                      type="text"
                      value={newPlace.opening_time}
                      onChange={(e) => setNewPlace({ ...newPlace, opening_time: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-neutral-500 mb-1">
                      Closing Time
                    </label>
                    <input
                      type="text"
                      value={newPlace.closing_time}
                      onChange={(e) => setNewPlace({ ...newPlace, closing_time: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-neutral-500 mb-1">
                      Entry Fee (₹)
                    </label>
                    <input
                      type="number"
                      value={newPlace.entry_fee_inr}
                      onChange={(e) =>
                        setNewPlace({ ...newPlace, entry_fee_inr: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-neutral-500 mb-1">
                      Duration (Mins)
                    </label>
                    <input
                      type="number"
                      value={newPlace.typical_duration_minutes}
                      onChange={(e) =>
                        setNewPlace({
                          ...newPlace,
                          typical_duration_minutes: parseInt(e.target.value) || 60,
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Verify &amp; Add Place to Canonical Catalogue</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: ADMIN TEAM & SUPERUSERS MANAGEMENT */}
        {/* ========================================================================= */}
        {activeTab === "team" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Active Admin Team List */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-neutral-200 p-5 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#1E3A5F]" />
                    <span>Active Administrators &amp; Superusers</span>
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Admins have superuser access to verify artisans, curate trails, and add new administrators.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-neutral-100 text-xs font-bold text-neutral-700">
                  {adminTeam.length} Admins
                </span>
              </div>

              <div className="divide-y divide-neutral-100">
                {adminTeam.map((member) => (
                  <div
                    key={member.id || member.email}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-neutral-900">
                        {member.full_name}
                      </p>
                      <p className="text-xs text-neutral-500">{member.email}</p>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        member.role === "superuser"
                          ? "bg-amber-100 text-amber-900"
                          : "bg-blue-50 text-[#1E3A5F]"
                      }`}
                    >
                      {member.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Add New Admin Form */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-neutral-200 p-5 space-y-4 shadow-2xs">
              <div className="border-b border-neutral-100 pb-3">
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-[#E05A2B]" />
                  <span>Add New Administrator</span>
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Create a new admin account with email and password credentials.
                </p>
              </div>

              {adminFormError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                  {adminFormError}
                </div>
              )}

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setAdminFormError(null);
                  const res = await addAdminMember(
                    newAdminEmail,
                    newAdminPassword,
                    newAdminName,
                    newAdminRole
                  );
                  if (!res.success) {
                    setAdminFormError(res.error || "Failed to add administrator.");
                  } else {
                    showToast(`✓ Added ${newAdminName} (${newAdminEmail}) as ${newAdminRole}!`);
                    setNewAdminName("");
                    setNewAdminEmail("");
                    setNewAdminPassword("");
                  }
                }}
                className="space-y-3 text-xs"
              >
                <div className="space-y-1">
                  <label className="font-semibold text-neutral-700 block">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newAdminName}
                    onChange={(e) => setNewAdminName(e.target.value)}
                    placeholder="e.g. Meera Sisodia"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-neutral-700 block">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    placeholder="meera.admin@trailweave.org"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-neutral-700 block">
                    Temporary Password
                  </label>
                  <input
                    type="password"
                    required
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    placeholder="Minimum 4 characters"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-neutral-700 block">
                    Privilege Level
                  </label>
                  <select
                    value={newAdminRole}
                    onChange={(e) =>
                      setNewAdminRole(e.target.value as "admin" | "superuser")
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white"
                  >
                    <option value="admin">Admin</option>
                    <option value="superuser">Superuser</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-[#1E3A5F] hover:bg-[#152842] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Admin Account</span>
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Lightbox Photo Modal */}
      {selectedImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative max-w-xl w-full max-h-[85vh] rounded-2xl overflow-hidden bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors z-10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedImage}
              alt="Artifact enlarged preview"
              className="w-full h-auto max-h-[80vh] object-contain mx-auto"
            />
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
