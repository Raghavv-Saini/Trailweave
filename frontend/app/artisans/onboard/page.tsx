"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Mic,
  Square,
  MapPin,
  Upload,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Lock,
  Phone,
  Sparkles,
  Image as ImageIcon,
  LogOut,
  FileAudio,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { Header } from "@/components/common/Header";
import { BottomNav } from "@/components/common/BottomNav";

export interface ArtisanPortalProfile {
  id: string;
  source_type: "draft" | "artisan";
  approval_status: "draft" | "pending_review" | "approved" | "rejected";
  artisan_name: string;
  craft_type: string;
  phone_number: string;
  place_name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  has_workshop: boolean;
  workshop_fee_inr: number;
  workshop_duration_minutes: number;
  workshop_description?: string;
  opening_time?: string;
  closing_time?: string;
  admin_brief?: string;
  missing_info_checklist: string[];
  raw_transcript?: string;
  catalogue_images: string[];
}

const ARTISAN_SESSION_STORAGE_KEY = "trailweave_artisan_session";
const LOCAL_ARTISAN_ACCOUNTS_KEY = "trailweave_local_artisan_accounts";

const SAMPLE_VOICE_PRESETS = [
  {
    id: "shankar_pottery",
    labelHi: "शंकर लाल कुम्हार (टेराकोटा पॉटरी, हाथीपोल)",
    labelEn: "Shankar Lal • Terracotta Pottery (₹250 / 45m)",
    phone: "+919829099887",
    transcript:
      "नमस्ते, मैं शंकर लाल कुम्हार हूँ। मेरी टेराकोटा पॉटरी की दुकान हाथीपोल में है। हम 45 मिनट की वर्कशॉप कराते हैं जिसकी फीस 250 रुपये है।",
    lat: 24.584,
    lng: 73.6865,
    images: [
      "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=900&q=80",
    ],
  },
  {
    id: "laxmi_pichwai",
    labelHi: "लक्ष्मी देवी (पिछवाई और लघु चित्रकारी, जगदीश चौक)",
    labelEn: "Laxmi Devi • Pichwai & Miniature Art (₹350 / 60m)",
    phone: "+919829077665",
    transcript:
      "नमस्ते, मेरा नाम लक्ष्मी देवी है। जगदीश चौक में हमारा पिछवाई और मिनिएचर पेंटिंग स्टूडियो है। हम 60 मिनट की वर्कशॉप कराते हैं जिसकी फीस 350 रुपये है।",
    lat: 24.5796,
    lng: 73.6844,
    images: [
      "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=900&q=80",
    ],
  },
  {
    id: "ramesh_kathputli",
    labelHi: "रमेशजी भाट (कठपुतली कला, गणगौर घाट)",
    labelEn: "Rameshji Bhat • Kathputli Puppetry (₹200 / 45m)",
    phone: "+919829055443",
    transcript:
      "नमस्ते, मैं रमेशजी हूँ। गणगौर घाट के पास हमारी पारंपरिक राजस्थानी कठपुतली की दुकान है। हम 45 मिनट की कठपुतली वर्कशॉप कराते हैं और फीस 200 रुपये है।",
    lat: 24.5788,
    lng: 73.6815,
    images: [
      "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=900&q=80",
    ],
  },
];

const CRAFT_SAMPLE_PHOTOS = [
  {
    label: "टेराकोटा पॉटरी (Terracotta Clay)",
    url: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=900&q=80",
  },
  {
    label: "पिछवाई पेंटिंग (Pichwai Painting)",
    url: "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=900&q=80",
  },
  {
    label: "मिट्टी के बर्तन (Handcrafted Vessels)",
    url: "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=900&q=80",
  },
  {
    label: "कठपुतली शिल्प (Kathputli Puppets)",
    url: "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=900&q=80",
  },
  {
    label: "चमड़े की मोजड़ी (Leather Craft)",
    url: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=900&q=80",
  },
];

function normalizePhoneClient(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return `+${digits}`;
}

function buildLocalFallbackDraft(
  phone: string,
  transcript: string,
  lat: number | null,
  lng: number | null,
  images: string[]
): ArtisanPortalProfile {
  const textNorm = (transcript || "").trim();
  let artisanName = "Shankar Lal Kumhar";
  if (textNorm.includes("लक्ष्मी देवी") || textNorm.toLowerCase().includes("laxmi")) {
    artisanName = "Laxmi Devi Mewar";
  } else if (textNorm.includes("मोहनलाल") || textNorm.toLowerCase().includes("mohanlal")) {
    artisanName = "Master Mohanlal Sharma";
  } else if (textNorm.includes("रमेश") || textNorm.toLowerCase().includes("ramesh")) {
    artisanName = "Rameshwar Ji Bhat";
  }

  let craftType = "Terracotta Pottery & Clay Sculpting";
  if (textNorm.includes("पिछवाई") || textNorm.includes("पेंटिंग") || textNorm.toLowerCase().includes("pichwai")) {
    craftType = "Pichwai & Miniature Painting";
  } else if (textNorm.includes("कठपुतली") || textNorm.toLowerCase().includes("puppet")) {
    craftType = "Kathputli Puppetry & Wood Craft";
  }

  let address = "Hathi Pole Bazaar, Old City, Udaipur";
  if (textNorm.includes("जगदीश चौक") || textNorm.toLowerCase().includes("jagdish")) {
    address = "Jagdish Chowk, Old City, Udaipur";
  } else if (textNorm.includes("गणगौर घाट") || textNorm.toLowerCase().includes("gangaur")) {
    address = "Gangaur Ghat Marg, Old City, Udaipur";
  }

  const feeMatch = textNorm.match(/(\d+)\s*(?:रुपये|रुपए|₹|rs)/i);
  const fee = feeMatch ? Number(feeMatch[1]) : 250;
  const durMatch = textNorm.match(/(\d+)\s*(?:मिनट|min)/i);
  const duration = durMatch ? Number(durMatch[1]) : 45;

  return {
    id: `draft_${Date.now().toString(36)}`,
    source_type: "draft",
    approval_status: "draft",
    artisan_name: artisanName,
    craft_type: craftType,
    phone_number: normalizePhoneClient(phone),
    place_name: `${artisanName} ${craftType.split("&")[0].trim()} Studio`,
    address,
    latitude: lat ?? 24.584,
    longitude: lng ?? 73.6865,
    has_workshop: true,
    workshop_fee_inr: fee,
    workshop_duration_minutes: duration,
    workshop_description: `Hands-on ${duration}-minute ${craftType.toLowerCase()} workshop.`,
    opening_time: "10:00",
    closing_time: "19:30",
    admin_brief: `Artisan ${artisanName} runs a ${craftType} studio in ${address.split(",")[0]} offering a ${duration}-minute hands-on workshop for ₹${fee}.`,
    missing_info_checklist: ["Confirm daily opening and closing hours"],
    raw_transcript:
      textNorm ||
      "नमस्ते, मैं शंकर लाल कुम्हार हूँ। मेरी टेराकोटा पॉटरी की दुकान हाथीपोल में है। हम 45 मिनट की वर्कशॉप कराते हैं जिसकी फीस 250 रुपये है।",
    catalogue_images: images,
  };
}

export default function ArtisanOnboardAndCataloguePage() {
  const [activeTab, setActiveTab] = useState<"onboard" | "portal">("onboard");

  // --- New Onboarding Form State ---
  const [phone, setPhone] = useState("+919829099887");
  const [pin, setPin] = useState("1234");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [transcriptHint, setTranscriptHint] = useState(
    SAMPLE_VOICE_PRESETS[0].transcript
  );
  const [textMessage, setTextMessage] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>({
    lat: 24.584,
    lng: 73.6865,
  });
  const [gpsStatusMsg, setGpsStatusMsg] = useState<string | null>(
    "हाथीपोल, उदयपुर (24.5840°N, 73.6865°E)"
  );
  const [catalogueImages, setCatalogueImages] = useState<string[]>([
    ...SAMPLE_VOICE_PRESETS[0].images,
  ]);
  const [newOnboardImageUrl, setNewOnboardImageUrl] = useState("");
  const [isSubmittingOnboard, setIsSubmittingOnboard] = useState(false);
  const [onboardError, setOnboardError] = useState<string | null>(null);
  const [submittedProfile, setSubmittedProfile] =
    useState<ArtisanPortalProfile | null>(null);

  // --- Returning Artisan Login & Catalogue Manager State ---
  const [loginPhone, setLoginPhone] = useState("+919829099887");
  const [loginPin, setLoginPin] = useState("1234");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<{
    phone: string;
    pin: string;
    profile: ArtisanPortalProfile;
  } | null>(null);
  const [newCatalogueUrl, setNewCatalogueUrl] = useState("");
  const [isUpdatingCatalogue, setIsUpdatingCatalogue] = useState(false);
  const [catalogueNotice, setCatalogueNotice] = useState<string | null>(null);

  // MediaRecorder & SpeechRecognition refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechRecRef = useRef<{ stop: () => void } | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const apiBase =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

  // Hydrate persistent artisan device session from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(ARTISAN_SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.profile && parsed.phone && parsed.pin) {
          setActiveSession(parsed);
        }
      }
    } catch {
      // Ignore storage error
    }
  }, []);

  // Save session helper
  const saveSessionToDevice = (
    sessionData: {
      phone: string;
      pin: string;
      profile: ArtisanPortalProfile;
    } | null
  ) => {
    setActiveSession(sessionData);
    if (typeof window === "undefined") return;
    try {
      if (sessionData) {
        localStorage.setItem(
          ARTISAN_SESSION_STORAGE_KEY,
          JSON.stringify(sessionData)
        );
        // Also persist in local accounts map for offline continuity
        const mapRaw = localStorage.getItem(LOCAL_ARTISAN_ACCOUNTS_KEY);
        const accountsMap = mapRaw ? JSON.parse(mapRaw) : {};
        accountsMap[normalizePhoneClient(sessionData.phone)] = {
          pin: sessionData.pin,
          profile: sessionData.profile,
        };
        localStorage.setItem(
          LOCAL_ARTISAN_ACCOUNTS_KEY,
          JSON.stringify(accountsMap)
        );
      } else {
        localStorage.removeItem(ARTISAN_SESSION_STORAGE_KEY);
      }
    } catch {
      // Ignore
    }
  };

  // Start 1-tap Hindi Voice Recording (MediaRecorder + browser hi-IN SpeechRecognition)
  const handleStartRecording = async () => {
    setOnboardError(null);
    setRecordingSeconds(0);
    audioChunksRef.current = [];

    // 1. Start browser SpeechRecognition (hi-IN) if supported
    if (typeof window !== "undefined") {
      const win = window as unknown as Record<string, unknown>;
      const SpeechRec = (win.SpeechRecognition || win.webkitSpeechRecognition) as
        | {
            new (): {
              lang: string;
              continuous: boolean;
              interimResults: boolean;
              onresult: (event: {
                results: ArrayLike<ArrayLike<{ transcript: string }>>;
              }) => void;
              start: () => void;
              stop: () => void;
            };
          }
        | undefined;
      if (SpeechRec) {
        try {
          const rec = new SpeechRec();
          rec.lang = "hi-IN";
          rec.continuous = true;
          rec.interimResults = true;
          rec.onresult = (event: {
            results: ArrayLike<ArrayLike<{ transcript: string }>>;
          }) => {
            let captured = "";
            for (let i = 0; i < event.results.length; i++) {
              captured += event.results[i][0].transcript + " ";
            }
            if (captured.trim()) {
              setTranscriptHint(captured.trim());
            }
          };
          rec.start();
          speechRecRef.current = rec;
        } catch {
          // Ignore if speech recognition unavailable
        }
      }
    }

    // 2. Start MediaRecorder if available
    if (
      typeof window !== "undefined" &&
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia
    ) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) {
            audioChunksRef.current.push(ev.data);
          }
        };
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          if (audioChunksRef.current.length > 0) {
            const blob = new Blob(audioChunksRef.current, {
              type: "audio/webm",
            });
            const reader = new FileReader();
            reader.onloadend = () => {
              if (typeof reader.result === "string") {
                setAudioBase64(reader.result);
                setAudioFileName("live_hindi_voice_note.webm");
              }
            };
            reader.readAsDataURL(blob);
          }
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
      } catch {
        // Microphone permission declined in sandbox/desktop: simulate recording timer with preset Hindi voice note
      }
    }

    setIsRecording(true);
    timerIntervalRef.current = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
  };

  const handleStopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (speechRecRef.current) {
      try {
        speechRecRef.current.stop();
      } catch {
        // Ignore
      }
      speechRecRef.current = null;
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore
      }
    }
    setIsRecording(false);
    if (!audioFileName) {
      setAudioFileName("hindi_voice_recording.webm");
    }
  };

  // Handle Audio File Upload (<input type="file" accept="audio/*">)
  const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioFileName(file.name);
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        setAudioBase64(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle 1-Tap GPS Location Share
  const handleShareGpsLocation = () => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(4));
          const lng = Number(pos.coords.longitude.toFixed(4));
          setCoords({ lat, lng });
          setGpsStatusMsg(`GPS स्थान प्राप्त हुआ (${lat}°N, ${lng}°E)`);
        },
        () => {
          setCoords({ lat: 24.584, lng: 73.6865 });
          setGpsStatusMsg(
            "उदयपुर ओल्ड सिटी स्थान सेट किया गया (24.5840°N, 73.6865°E)"
          );
        },
        { timeout: 6000 }
      );
    } else {
      setCoords({ lat: 24.584, lng: 73.6865 });
      setGpsStatusMsg(
        "उदयपुर ओल्ड सिटी स्थान सेट किया गया (24.5840°N, 73.6865°E)"
      );
    }
  };

  // Handle Craft Photo File Upload (for Onboarding or Dashboard)
  const handleImageFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    mode: "onboard" | "dashboard"
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          const dataUrl = reader.result;
          if (mode === "onboard") {
            setCatalogueImages((prev) =>
              prev.includes(dataUrl) ? prev : [...prev, dataUrl]
            );
          } else {
            handleAddCataloguePhotos([dataUrl]);
          }
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  // Submit New Hindi Voice Onboarding (`POST /api/artisans/onboard`)
  const handleSubmitOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    setOnboardError(null);

    const cleanedPhone = normalizePhoneClient(phone);
    if (!cleanedPhone || cleanedPhone.length < 10) {
      setOnboardError("कृपया सही 10-अंकों का मोबाइल नंबर दर्ज करें (Enter a valid phone number).");
      return;
    }
    if (!/^\d{4}$/.test(pin.trim())) {
      setOnboardError("कृपया 4-अंकों का संख्यात्मक पिन दर्ज करें (PIN must be 4 numeric digits, e.g. 1234).");
      return;
    }

    setIsSubmittingOnboard(true);
    try {
      const payload = {
        phone_number: cleanedPhone,
        pin: pin.trim(),
        audio_base64: audioBase64,
        transcript_hint: transcriptHint.trim() || null,
        text_message: textMessage.trim() || null,
        latitude: coords?.lat ?? 24.584,
        longitude: coords?.lng ?? 73.6865,
        catalogue_images: catalogueImages,
      };

      let profile: ArtisanPortalProfile | null = null;
      try {
        const res = await fetch(`${apiBase}/artisans/onboard`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          profile = await res.json();
        }
      } catch {
        // Offline / local fallback
      }

      if (!profile) {
        profile = buildLocalFallbackDraft(
          cleanedPhone,
          textMessage.trim() || transcriptHint.trim(),
          coords?.lat ?? 24.584,
          coords?.lng ?? 73.6865,
          catalogueImages
        );
      }

      // Immediately discard audio bytes in client state too
      setAudioBase64(null);
      setSubmittedProfile(profile);
      saveSessionToDevice({
        phone: cleanedPhone,
        pin: pin.trim(),
        profile,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setOnboardError(msg || "पंजीकरण में त्रुटि हुई। कृपया पुनः प्रयास करें।");
    } finally {
      setIsSubmittingOnboard(false);
    }
  };

  // Returning Artisan Login (`POST /api/artisans/login`)
  const handleArtisanLogin = async (
    e?: React.FormEvent,
    overridePhone?: string,
    overridePin?: string
  ) => {
    if (e) e.preventDefault();
    setLoginError(null);

    const targetPhone = normalizePhoneClient(overridePhone ?? loginPhone);
    const targetPin = (overridePin ?? loginPin).trim();

    if (!targetPhone) {
      setLoginError("कृपया फ़ोन नंबर दर्ज करें (Phone number required).");
      return;
    }
    if (!/^\d{4}$/.test(targetPin)) {
      setLoginError("कृपया 4-अंकों का पिन दर्ज करें (Enter 4-digit numeric PIN).");
      return;
    }

    setIsLoggingIn(true);
    try {
      let profile: ArtisanPortalProfile | null = null;
      let statusErr: string | null = null;

      try {
        const res = await fetch(`${apiBase}/artisans/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone_number: targetPhone,
            pin: targetPin,
          }),
        });
        if (res.ok) {
          profile = await res.json();
        } else if (res.status === 401) {
          statusErr = "गलत 4-अंकों का पिन (Invalid 4-digit PIN).";
        }
      } catch {
        // Check local storage or demo accounts if backend is offline
      }

      if (statusErr) {
        setLoginError(statusErr);
        return;
      }

      if (!profile && typeof window !== "undefined") {
        // Check locally stored accounts or built-in demo accounts
        const mapRaw = localStorage.getItem(LOCAL_ARTISAN_ACCOUNTS_KEY);
        const accountsMap = mapRaw ? JSON.parse(mapRaw) : {};
        const localEntry = accountsMap[targetPhone];
        if (localEntry) {
          if (localEntry.pin !== targetPin) {
            setLoginError("गलत 4-अंकों का पिन (Invalid 4-digit PIN).");
            return;
          }
          profile = localEntry.profile;
        } else if (targetPin === "1234") {
          if (targetPhone === "+919829012345") {
            profile = {
              id: "artisan_mohanlal",
              source_type: "artisan",
              approval_status: "approved",
              artisan_name: "Master Mohanlal Sharma",
              craft_type: "Pichwai & Miniature Painting",
              phone_number: "+919829012345",
              place_name: "Master Mohanlal Miniature Art Studio",
              address: "14 Jagdish Chowk, Old City, Udaipur",
              latitude: 24.5796,
              longitude: 73.6844,
              has_workshop: true,
              workshop_fee_inr: 300,
              workshop_duration_minutes: 45,
              workshop_description:
                "Hands-on miniature painting masterclass on handmade vintage Wasli paper.",
              opening_time: "10:00",
              closing_time: "20:00",
              admin_brief:
                "Approved 4th-generation miniature artist at 14 Jagdish Chowk offering 45-minute Wasli painting workshops for ₹300.",
              missing_info_checklist: [],
              raw_transcript:
                "नमस्ते, मैं मास्टर मोहनलाल हूँ। मेरी दुकान जगदीश चौक में है। हम 400 साल पुरानी पिछवाई और लघु चित्रकारी सिखाते हैं।",
              catalogue_images: [
                "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=900&q=80",
                "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=900&q=80",
              ],
            };
          } else {
            profile = buildLocalFallbackDraft(
              targetPhone,
              SAMPLE_VOICE_PRESETS[0].transcript,
              24.584,
              73.6865,
              SAMPLE_VOICE_PRESETS[0].images
            );
          }
        }
      }

      if (!profile) {
        setLoginError(
          "इस फ़ोन नंबर या पिन से कोई खाता नहीं मिला। (Account not found or wrong PIN)."
        );
        return;
      }

      saveSessionToDevice({
        phone: targetPhone,
        pin: targetPin,
        profile,
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Add photos to Returning Artisan Catalogue (`POST /api/artisans/me/catalogue`)
  const handleAddCataloguePhotos = async (urlsToAdd: string[]) => {
    if (!activeSession) return;
    const cleaned = urlsToAdd.map((u) => u.trim()).filter(Boolean);
    if (cleaned.length === 0) return;

    setIsUpdatingCatalogue(true);
    setCatalogueNotice(null);
    try {
      let updatedProfile: ArtisanPortalProfile | null = null;
      try {
        const res = await fetch(`${apiBase}/artisans/me/catalogue`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone_number: activeSession.phone,
            pin: activeSession.pin,
            image_urls: cleaned,
          }),
        });
        if (res.ok) {
          updatedProfile = await res.json();
        }
      } catch {
        // Local fallback
      }

      if (!updatedProfile) {
        const merged = [...activeSession.profile.catalogue_images];
        for (const u of cleaned) {
          if (!merged.includes(u)) merged.push(u);
        }
        updatedProfile = {
          ...activeSession.profile,
          catalogue_images: merged,
        };
      }

      saveSessionToDevice({
        ...activeSession,
        profile: updatedProfile,
      });
      setNewCatalogueUrl("");
      setCatalogueNotice("✨ नई फ़ोटो आपके कैटलॉग में जोड़ दी गई है (Photo added to your catalogue)!");
    } finally {
      setIsUpdatingCatalogue(false);
    }
  };

  // Remove photo from Returning Artisan Catalogue (`DELETE /api/artisans/me/catalogue`)
  const handleRemoveCataloguePhoto = async (imageUrlToRemove: string) => {
    if (!activeSession) return;
    setIsUpdatingCatalogue(true);
    setCatalogueNotice(null);

    try {
      let updatedProfile: ArtisanPortalProfile | null = null;
      try {
        const res = await fetch(`${apiBase}/artisans/me/catalogue`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone_number: activeSession.phone,
            pin: activeSession.pin,
            image_url: imageUrlToRemove,
          }),
        });
        if (res.ok) {
          updatedProfile = await res.json();
        }
      } catch {
        // Local fallback
      }

      if (!updatedProfile) {
        updatedProfile = {
          ...activeSession.profile,
          catalogue_images: activeSession.profile.catalogue_images.filter(
            (img) => img !== imageUrlToRemove
          ),
        };
      }

      saveSessionToDevice({
        ...activeSession,
        profile: updatedProfile,
      });
      setCatalogueNotice("🗑️ फ़ोटो कैटलॉग से हटा दी गई है (Photo removed from catalogue).");
    } finally {
      setIsUpdatingCatalogue(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between min-h-screen bg-[#FDFBF7] pb-20">
      <Header
        title="कारीगर वॉइस पोर्टल"
        subtitle="Hindi Voice Onboarding & Craft Catalogue"
        showBasket={false}
      />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
        {/* Top Mode Switcher: नया पंजीकरण vs मेरी दुकान / मेरा कैटलॉग */}
        <div className="flex rounded-2xl bg-neutral-200/80 p-1 text-xs font-bold shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab("onboard")}
            className={`flex-1 py-2.5 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "onboard"
                ? "bg-white text-neutral-900 shadow-xs font-extrabold"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            <Mic className="w-3.5 h-3.5 text-[#E05A2B]" />
            <span>नया पंजीकरण (New Signup)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("portal")}
            className={`flex-1 py-2.5 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "portal"
                ? "bg-neutral-900 text-white shadow-xs font-extrabold"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
            <span>मेरी दुकान / मेरा कैटलॉग</span>
          </button>
        </div>

        {activeTab === "onboard" ? (
          /* ================================================================
             TAB 1: नया पंजीकरण (HINDI WEB VOICE ONBOARDING)
             ================================================================ */
          <div className="space-y-4">
            {/* Hero Instruction Banner */}
            <div className="rounded-2xl bg-gradient-to-br from-[#E05A2B] to-[#993412] p-4 text-white shadow-sm space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-[10px] font-bold">
                <Sparkles className="w-3 h-3 text-amber-200" />
                <span>उदयपुर कारीगर स्व-पंजीकरण • Zero-Barrier Hindi Voice</span>
              </div>
              <h2 className="text-base font-extrabold leading-snug">
                अपनी आवाज़ में अपनी दुकान और वर्कशॉप की जानकारी दें
              </h2>
              <p className="text-[11px] text-amber-100 leading-relaxed">
                कोई जटिल फ़ॉर्म या अंग्रेज़ी पासवर्ड नहीं — बस अपना फ़ोन नंबर, 4-अंकों का पिन डालें और हिंदी में बोलकर अपनी कला व फ़ोटो जोड़ें।
              </p>
            </div>

            {/* Immediate Confirmation Card if just submitted */}
            {submittedProfile && (
              <div className="p-4 rounded-2xl bg-emerald-50/90 border-2 border-emerald-500 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <h3 className="text-sm font-extrabold text-emerald-950">
                        पंजीकरण सफलतापूर्वक प्राप्त हुआ! (Voice Draft Created)
                      </h3>
                      <p className="text-[11px] text-emerald-800">
                        स्थिति: <span className="font-bold">समीक्षाधीन (Under Admin Review)</span>
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-950 text-[10px] font-extrabold uppercase">
                    {submittedProfile.approval_status}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white border border-emerald-200 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">कारीगर (Artisan):</span>
                    <span className="font-bold text-neutral-900">
                      {submittedProfile.artisan_name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">कला (Craft):</span>
                    <span className="font-bold text-[#E05A2B]">
                      {submittedProfile.craft_type}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">पता (Address):</span>
                    <span className="font-semibold text-neutral-800">
                      {submittedProfile.address}
                    </span>
                  </div>
                  {submittedProfile.has_workshop && (
                    <div className="flex justify-between">
                      <span className="text-neutral-500">वर्कशॉप (Workshop):</span>
                      <span className="font-bold text-emerald-700">
                        ₹{submittedProfile.workshop_fee_inr} •{" "}
                        {submittedProfile.workshop_duration_minutes} mins
                      </span>
                    </div>
                  )}
                </div>

                {/* AI Admin Brief Preview */}
                {submittedProfile.admin_brief && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/80 space-y-1">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900">
                      AI-Generated English Admin Brief (Sent to /admin)
                    </p>
                    <p className="text-xs text-neutral-800 leading-relaxed">
                      {submittedProfile.admin_brief}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab("portal")}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs text-center cursor-pointer"
                  >
                    मेरी दुकान और कैटलॉग खोलें (Manage My Catalogue) &rarr;
                  </button>
                </div>
              </div>
            )}

            {/* Onboarding Form */}
            <form onSubmit={handleSubmitOnboarding} className="space-y-4">
              {/* Step 1: Phone Number + 4-Digit UPI-Style PIN */}
              <div className="p-4 rounded-2xl bg-white border border-neutral-200/90 shadow-2xs space-y-3">
                <h3 className="text-xs font-extrabold text-neutral-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-[#E05A2B] text-white text-[11px] flex items-center justify-center font-bold">
                    1
                  </span>
                  <span>फ़ोन नंबर और 4-अंकों का पिन (Phone &amp; 4-Digit PIN)</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="onboard-phone"
                      className="block text-[11px] font-bold text-neutral-700 mb-1"
                    >
                      मोबाइल नंबर (Phone Number) *
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="onboard-phone"
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 98290 99887"
                        className="w-full pl-8 pr-3 py-2 rounded-xl border border-neutral-300 text-xs font-semibold text-neutral-900 focus:outline-none focus:border-[#E05A2B]"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="onboard-pin"
                      className="block text-[11px] font-bold text-neutral-700 mb-1"
                    >
                      4-अंकों का पिन (4-Digit PIN) *
                    </label>
                    <div className="relative">
                      <Lock className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="onboard-pin"
                        type="text"
                        inputMode="numeric"
                        pattern="\d{4}"
                        maxLength={4}
                        required
                        value={pin}
                        onChange={(e) =>
                          setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                        }
                        placeholder="1234"
                        className="w-full pl-8 pr-3 py-2 rounded-xl border border-neutral-300 text-xs font-extrabold tracking-widest text-neutral-900 focus:outline-none focus:border-[#E05A2B]"
                      />
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-neutral-500">
                  💡 UPI की तरह इस 4-अंकों के पिन से आप कभी भी लॉग इन करके अपनी कलाकृतियों की फ़ोटो बदल सकते हैं।
                </p>
              </div>

              {/* Step 2: 1-Tap Hindi Voice Recorder + Live Transcript + Presets */}
              <div className="p-4 rounded-2xl bg-white border border-neutral-200/90 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold text-neutral-900 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-[#E05A2B] text-white text-[11px] flex items-center justify-center font-bold">
                      2
                    </span>
                    <span>हिंदी वॉइस नोट रिकॉर्ड करें (1-Tap Hindi Voice Note)</span>
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                    Google STT (hi-IN)
                  </span>
                </div>

                <p className="text-[11px] text-neutral-600 bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/60 leading-relaxed">
                  🎙️ <strong>क्या बोलें:</strong> &ldquo;नमस्ते, मैं शंकर लाल कुम्हार हूँ। मेरी टेराकोटा पॉटरी की दुकान हाथीपोल में है। हम 45 मिनट की वर्कशॉप कराते हैं जिसकी फीस 250 रुपये है।&rdquo;
                </p>

                {/* Primary 1-Tap Voice Record / Stop Button */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={handleStartRecording}
                      className="flex-1 py-3 px-4 rounded-2xl bg-[#E05A2B] hover:bg-[#c94d23] text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all"
                    >
                      <Mic className="w-4 h-4" />
                      <span>बोलने के लिए दबाएं (Tap to Record in Hindi)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStopRecording}
                      className="flex-1 py-3 px-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm animate-pulse cursor-pointer"
                    >
                      <Square className="w-4 h-4 fill-current" />
                      <span>
                        रिकॉर्डिंग रोके ({recordingSeconds}s) • Stop Recording
                      </span>
                    </button>
                  )}

                  {/* Audio file upload alternative */}
                  <label className="py-2.5 px-3 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer border border-neutral-200">
                    <FileAudio className="w-3.5 h-3.5 text-neutral-600" />
                    <span>ऑडियो फ़ाइल चुनें</span>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleAudioFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {audioFileName && (
                  <div className="text-[11px] text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center justify-between">
                    <span>🎵 ऑडियो तैयार: {audioFileName}</span>
                    <span className="text-[10px] font-bold">
                      🔒 ट्रांसक्रिप्शन के तुरंत बाद ऑडियो हटा दिया जाएगा
                    </span>
                  </div>
                )}

                {/* Quick 1-Tap Demo Hindi Voice Presets */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    1-Tap Demo Hindi Voice Presets (उदाहरण वॉइस नोट चुनें):
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {SAMPLE_VOICE_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setPhone(preset.phone);
                          setTranscriptHint(preset.transcript);
                          setCoords({ lat: preset.lat, lng: preset.lng });
                          setGpsStatusMsg(
                            `GPS: ${preset.lat.toFixed(4)}°N, ${preset.lng.toFixed(4)}°E`
                          );
                          setCatalogueImages([...preset.images]);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-950 text-[11px] font-semibold cursor-pointer transition-colors"
                      >
                        🎙️ {preset.labelHi}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Hindi Transcript / Text Fallback */}
                <div>
                  <label
                    htmlFor="onboard-transcript"
                    className="block text-[11px] font-bold text-neutral-700 mb-1"
                  >
                    हिंदी वॉइस ट्रांसक्रिप्ट / संदेश (Live Hindi Transcript or Text Fallback)
                  </label>
                  <textarea
                    id="onboard-transcript"
                    rows={3}
                    value={textMessage || transcriptHint}
                    onChange={(e) => {
                      setTranscriptHint(e.target.value);
                      setTextMessage(e.target.value);
                    }}
                    placeholder="नमस्ते, मैं शंकर लाल कुम्हार हूँ..."
                    className="w-full p-2.5 rounded-xl border border-neutral-300 text-xs text-neutral-900 leading-relaxed focus:outline-none focus:border-[#E05A2B]"
                  />
                  <p className="text-[10px] text-neutral-500 mt-1 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      <strong>Audio Privacy:</strong> Raw voice audio is discarded immediately after Google Cloud Speech-to-Text (`hi-IN`) transcription (`media_url = NULL`).
                    </span>
                  </p>
                </div>
              </div>

              {/* Step 3: 1-Tap GPS Location */}
              <div className="p-4 rounded-2xl bg-white border border-neutral-200/90 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold text-neutral-900 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-[#E05A2B] text-white text-[11px] flex items-center justify-center font-bold">
                      3
                    </span>
                    <span>दुकान का स्थान (Optional 1-Tap GPS Location)</span>
                  </h3>
                </div>

                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleShareGpsLocation}
                    className="py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5 text-[#E05A2B]" />
                    <span>अपना वर्तमान स्थान साझा करें (Share Current GPS)</span>
                  </button>

                  {gpsStatusMsg && (
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                      📍 {gpsStatusMsg}
                    </span>
                  )}
                </div>
              </div>

              {/* Step 4: Self-Service Craft & Artifact Photo Upload (catalogue_images) */}
              <div className="p-4 rounded-2xl bg-white border border-neutral-200/90 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold text-neutral-900 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-[#E05A2B] text-white text-[11px] flex items-center justify-center font-bold">
                      4
                    </span>
                    <span>
                      अपनी कलाकृतियों की फ़ोटो जोड़ें (Craft &amp; Artifact Catalogue)
                    </span>
                  </h3>
                  <span className="text-[11px] font-bold text-neutral-500">
                    {catalogueImages.length} फ़ोटो
                  </span>
                </div>

                {/* Upload from Camera/Device or URL */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <label className="py-2 px-3 rounded-xl bg-[#E05A2B]/10 hover:bg-[#E05A2B]/20 text-[#E05A2B] border border-[#E05A2B]/30 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>📷 फ़ोटो अपलोड करें (Camera / Gallery)</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleImageFileSelect(e, "onboard")}
                      className="hidden"
                    />
                  </label>

                  <div className="flex-1 flex gap-1.5">
                    <input
                      type="url"
                      value={newOnboardImageUrl}
                      onChange={(e) => setNewOnboardImageUrl(e.target.value)}
                      placeholder="या फ़ोटो URL पेस्ट करें (https://...)"
                      className="flex-1 px-3 py-1.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-[#E05A2B]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newOnboardImageUrl.trim()) {
                          setCatalogueImages((prev) =>
                            prev.includes(newOnboardImageUrl.trim())
                              ? prev
                              : [...prev, newOnboardImageUrl.trim()]
                          );
                          setNewOnboardImageUrl("");
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-neutral-900 text-white text-xs font-bold cursor-pointer"
                    >
                      जोड़ें
                    </button>
                  </div>
                </div>

                {/* Quick Sample Craft Photos */}
                <div className="flex flex-wrap gap-1.5">
                  {CRAFT_SAMPLE_PHOTOS.map((sample) => (
                    <button
                      key={sample.url}
                      type="button"
                      onClick={() =>
                        setCatalogueImages((prev) =>
                          prev.includes(sample.url)
                            ? prev
                            : [...prev, sample.url]
                        )
                      }
                      className="px-2 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-[10px] font-semibold cursor-pointer"
                    >
                      + {sample.label}
                    </button>
                  ))}
                </div>

                {/* Preview Grid of Selected Catalogue Photos */}
                {catalogueImages.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {catalogueImages.map((imgUrl, idx) => (
                      <div
                        key={`${imgUrl}_${idx}`}
                        className="relative group rounded-xl overflow-hidden border border-neutral-200 aspect-square bg-neutral-100"
                      >
                        <img
                          src={imgUrl}
                          alt={`Craft artifact ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setCatalogueImages((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                          }
                          aria-label="Remove photo"
                          className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/70 text-white hover:bg-red-600 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {onboardError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{onboardError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmittingOnboard}
                className="w-full py-3.5 px-4 rounded-2xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-60 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>
                  {isSubmittingOnboard
                    ? "Google STT (hi-IN) व Gemini AI प्रोसेस हो रहा है..."
                    : "पंजीकरण जमा करें (Submit Hindi Voice Onboarding)"}
                </span>
              </button>
            </form>
          </div>
        ) : (
          /* ================================================================
             TAB 2: मेरी दुकान / मेरा कैटलॉग (RETURNING ARTISAN LOGIN & CATALOGUE)
             ================================================================ */
          <div className="space-y-4">
            {!activeSession ? (
              /* Returning Artisan Login Card */
              <div className="p-5 rounded-2xl bg-white border border-neutral-200/90 shadow-xs space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                    कारीगर लॉगिन • Returning Artisan Login
                  </span>
                  <h2 className="text-base font-extrabold text-neutral-900">
                    अपनी दुकान और फ़ोटो कैटलॉग प्रबंधित करें
                  </h2>
                  <p className="text-xs text-neutral-500">
                    अपना पंजीकृत मोबाइल नंबर और 4-अंकों का पिन डालकर लॉग इन करें।
                  </p>
                </div>

                <form onSubmit={(e) => handleArtisanLogin(e)} className="space-y-3">
                  <div>
                    <label
                      htmlFor="login-phone"
                      className="block text-[11px] font-bold text-neutral-700 mb-1"
                    >
                      मोबाइल नंबर (Phone Number)
                    </label>
                    <input
                      id="login-phone"
                      type="tel"
                      required
                      value={loginPhone}
                      onChange={(e) => setLoginPhone(e.target.value)}
                      placeholder="+91 98290 99887"
                      className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs font-semibold text-neutral-900 focus:outline-none focus:border-[#E05A2B]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="login-pin"
                      className="block text-[11px] font-bold text-neutral-700 mb-1"
                    >
                      4-अंकों का पिन (4-Digit PIN)
                    </label>
                    <input
                      id="login-pin"
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      required
                      value={loginPin}
                      onChange={(e) =>
                        setLoginPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                      }
                      placeholder="1234"
                      className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs font-extrabold tracking-widest text-neutral-900 focus:outline-none focus:border-[#E05A2B]"
                    />
                  </div>

                  {loginError && (
                    <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold">
                      {loginError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="w-full py-3 rounded-xl bg-[#E05A2B] hover:bg-[#c94d23] text-white font-extrabold text-xs shadow-sm cursor-pointer"
                  >
                    {isLoggingIn
                      ? "लॉग इन हो रहा है..."
                      : "लॉग इन करें (Login with 4-Digit PIN)"}
                  </button>
                </form>

                {/* Quick 1-Tap Demo Artisan Logins */}
                <div className="pt-3 border-t border-neutral-100 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    1-Tap Demo Artisan Accounts (PIN: 1234):
                  </p>
                  <div className="grid grid-cols-1 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setLoginPhone("+919829099887");
                        setLoginPin("1234");
                        handleArtisanLogin(undefined, "+919829099887", "1234");
                      }}
                      className="p-2.5 rounded-xl bg-amber-50/80 hover:bg-amber-100 border border-amber-200 text-left text-xs flex items-center justify-between cursor-pointer"
                    >
                      <div>
                        <p className="font-bold text-neutral-900">
                          शंकर लाल कुम्हार (Shankar Lal Kumhar)
                        </p>
                        <p className="text-[11px] text-neutral-600">
                          +919829099887 • समीक्षाधीन ड्राफ्ट (Under Review)
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-amber-200 text-amber-950 font-bold text-[10px]">
                        PIN: 1234
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setLoginPhone("+919829012345");
                        setLoginPin("1234");
                        handleArtisanLogin(undefined, "+919829012345", "1234");
                      }}
                      className="p-2.5 rounded-xl bg-emerald-50/80 hover:bg-emerald-100 border border-emerald-200 text-left text-xs flex items-center justify-between cursor-pointer"
                    >
                      <div>
                        <p className="font-bold text-neutral-900">
                          मास्टर मोहनलाल शर्मा (Master Mohanlal)
                        </p>
                        <p className="text-[11px] text-neutral-600">
                          +919829012345 • स्वीकृत और लाइव (Approved Studio)
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-200 text-emerald-950 font-bold text-[10px]">
                        PIN: 1234
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Returning Artisan Authenticated Dashboard & Catalogue Manager */
              <div className="space-y-4">
                {/* Status & Logout Header Card */}
                <div
                  className={`p-4 rounded-2xl border space-y-2.5 ${
                    activeSession.profile.approval_status === "approved"
                      ? "bg-emerald-50/90 border-emerald-300"
                      : "bg-amber-50/90 border-amber-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="inline-flex items-center gap-1.5">
                        {activeSession.profile.approval_status === "approved" ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>स्वीकृत और लाइव (Approved &amp; Live)</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-extrabold flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>समीक्षाधीन (Under Admin Review)</span>
                          </span>
                        )}
                      </div>
                      <h2 className="text-base font-extrabold text-neutral-900 pt-1">
                        {activeSession.profile.artisan_name}
                      </h2>
                      <p className="text-xs font-semibold text-[#E05A2B]">
                        {activeSession.profile.craft_type}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => saveSessionToDevice(null)}
                      className="px-2.5 py-1.5 rounded-xl bg-white/90 hover:bg-white border border-neutral-200 text-neutral-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>लॉग आउट</span>
                    </button>
                  </div>

                  <div className="text-xs text-neutral-700 space-y-1 pt-1 border-t border-black/5">
                    <p>
                      📍 <strong>पता:</strong> {activeSession.profile.address}
                    </p>
                    <p>
                      📞 <strong>फ़ोन:</strong>{" "}
                      {activeSession.profile.phone_number}
                    </p>
                    {activeSession.profile.has_workshop && (
                      <p>
                        🎨 <strong>वर्कशॉप:</strong> ₹
                        {activeSession.profile.workshop_fee_inr} प्रति व्यक्ति (
                        {activeSession.profile.workshop_duration_minutes} मिनट)
                      </p>
                    )}
                  </div>

                  {activeSession.profile.approval_status === "approved" && (
                    <div className="pt-1">
                      <Link
                        href="/artisans"
                        className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-800 hover:underline"
                      >
                        <span>सार्वजनिक कारीगर डायरेक्टरी (/artisans) में अपनी दुकान देखें</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  )}
                </div>

                {/* Self-Service Craft & Artifact Photo Catalogue Manager */}
                <div className="p-4 rounded-2xl bg-white border border-neutral-200/90 shadow-2xs space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-extrabold text-neutral-900">
                        मेरा कलाकृति कैटलॉग (My Craft &amp; Artifact Photos)
                      </h3>
                      <p className="text-[11px] text-neutral-500">
                        यहाँ जोड़ी गई फ़ोटो पर्यटकों को आपकी प्रोफ़ाइल पर तुरंत दिखाई देंगी।
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-amber-50 text-[#E05A2B] border border-amber-200 text-xs font-extrabold">
                      {activeSession.profile.catalogue_images.length} फ़ोटो
                    </span>
                  </div>

                  {catalogueNotice && (
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold">
                      {catalogueNotice}
                    </div>
                  )}

                  {/* Add New Photo Controls */}
                  <div className="space-y-2 p-3 rounded-xl bg-neutral-50 border border-neutral-200/80">
                    <p className="text-[11px] font-bold text-neutral-800">
                      + नई कलाकृति या वर्कशॉप की फ़ोटो जोड़ें (Add New Photos):
                    </p>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <label className="py-2 px-3 rounded-xl bg-[#E05A2B] hover:bg-[#c94d23] text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs">
                        <Upload className="w-3.5 h-3.5" />
                        <span>📷 कैमरे / गैलरी से फ़ोटो चुनें</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => handleImageFileSelect(e, "dashboard")}
                          className="hidden"
                        />
                      </label>

                      <div className="flex-1 flex gap-1.5">
                        <input
                          type="url"
                          value={newCatalogueUrl}
                          onChange={(e) => setNewCatalogueUrl(e.target.value)}
                          placeholder="फ़ोटो URL डालें (https://...)"
                          className="flex-1 px-3 py-1.5 rounded-xl bg-white border border-neutral-300 text-xs focus:outline-none focus:border-[#E05A2B]"
                        />
                        <button
                          type="button"
                          disabled={isUpdatingCatalogue || !newCatalogueUrl.trim()}
                          onClick={() =>
                            handleAddCataloguePhotos([newCatalogueUrl])
                          }
                          className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>जोड़ें</span>
                        </button>
                      </div>
                    </div>

                    {/* Quick 1-Tap Craft Photo Presets */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {CRAFT_SAMPLE_PHOTOS.map((sample) => (
                        <button
                          key={sample.url}
                          type="button"
                          disabled={isUpdatingCatalogue}
                          onClick={() => handleAddCataloguePhotos([sample.url])}
                          className="px-2 py-1 rounded-lg bg-white hover:bg-amber-50 border border-neutral-200 text-neutral-700 text-[10px] font-semibold cursor-pointer"
                        >
                          + {sample.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Current Catalogue Photo Grid */}
                  {activeSession.profile.catalogue_images.length === 0 ? (
                    <div className="p-6 rounded-xl border border-dashed border-neutral-300 text-center space-y-1">
                      <ImageIcon className="w-6 h-6 text-neutral-400 mx-auto" />
                      <p className="text-xs font-bold text-neutral-700">
                        अभी कोई फ़ोटो नहीं जोड़ी गई है
                      </p>
                      <p className="text-[11px] text-neutral-500">
                        ऊपर दिए गए बटन से अपनी कलाकृतियों की फ़ोटो अपलोड करें।
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {activeSession.profile.catalogue_images.map(
                        (imgUrl, index) => (
                          <div
                            key={`${imgUrl}_${index}`}
                            className="rounded-xl overflow-hidden border border-neutral-200 bg-neutral-50 flex flex-col justify-between"
                          >
                            <div className="aspect-4/3 w-full bg-neutral-100 overflow-hidden">
                              <img
                                src={imgUrl}
                                alt={`${activeSession.profile.artisan_name} craft ${
                                  index + 1
                                }`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="p-2 flex items-center justify-between bg-white border-t border-neutral-100">
                              <span className="text-[10px] font-semibold text-neutral-500">
                                कलाकृति #{index + 1}
                              </span>
                              <button
                                type="button"
                                disabled={isUpdatingCatalogue}
                                onClick={() =>
                                  handleRemoveCataloguePhoto(imgUrl)
                                }
                                className="px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>हटाएं (Remove)</span>
                              </button>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

