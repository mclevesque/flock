import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Navbar from "./components/Navbar";
import SessionWrapper from "./components/SessionWrapper";
import ChallengePopup from "./components/ChallengePopup";
import { VoiceProvider } from "./components/VoiceWidget";
import { VibeProvider } from "./components/VibePlayer";
import GlobalNotifications from "./components/GlobalNotifications";
import GlobalPartyWidget from "./components/GlobalPartyWidget";
import { ClerkProvider } from "@clerk/nextjs";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "RYFT — Your space. No ads. Ever.",
  description: "A platform for creators. Messenger + video hosting + profiles. Powered by members, not ads.",
  manifest: "/manifest.json",
  icons: {
    icon: "/RYFTLOGO.png",
    apple: "/RYFTLOGO.png",
    shortcut: "/RYFTLOGO.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "RYFT",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!}>
    <html lang="en">
      <body className={`${geist.variable} antialiased`}>
        <SessionWrapper>
          <VoiceProvider>
            <VibeProvider>
              <Navbar />
              <main className="min-h-screen">{children}</main>
              <ChallengePopup />
              <GlobalNotifications />
              <GlobalPartyWidget />
            </VibeProvider>
          </VoiceProvider>
        </SessionWrapper>
      </body>
    </html>
    </ClerkProvider>
  );
}
