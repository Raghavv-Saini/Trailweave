import type { Metadata, Viewport } from "next";
import { Newsreader, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { BasketProvider } from "@/context/BasketContext";
import { TripProvider } from "@/context/TripContext";

const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#1E3A5F",
};

export const metadata: Metadata = {
  title: "TrailWeave | Authentic Udaipur Travel & Artisan Journeys",
  description:
    "Discreet, community-powered travel discovery and constraint-aware in-trip companion pilot for Udaipur, Rajasthan.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TrailWeave",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jakarta.variable} ${newsreader.variable}`}>
      <body
        className="font-sans antialiased bg-[#FDFBF7] text-[#1A1D20] min-h-screen selection:bg-amber-100 selection:text-amber-900 flex flex-col"
      >
        <BasketProvider>
          <TripProvider>
            <div className="w-full min-h-screen flex flex-col">
              {children}
            </div>
          </TripProvider>
        </BasketProvider>
      </body>
    </html>
  );
}
