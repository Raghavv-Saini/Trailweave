import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BasketProvider } from "@/context/BasketContext";
import { TripProvider } from "@/context/TripContext";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#E05A2B",
};

export const metadata: Metadata = {
  title: "TrailWeave | Explore Like a Local",
  description:
    "Community-Powered Travel Discovery & Active In-Trip Companion pilot for Udaipur, Rajasthan.",
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
    <html lang="en">
      <body
        className="font-sans antialiased bg-[#FDFBF7] text-neutral-900 min-h-screen selection:bg-amber-100 selection:text-amber-900"
      >
        <BasketProvider>
          <TripProvider>
            <div className="max-w-md mx-auto min-h-screen flex flex-col shadow-xl bg-white border-x border-neutral-100">
              {children}
            </div>
          </TripProvider>
        </BasketProvider>
      </body>
    </html>
  );
}
