import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { isStandaloneSite } from "@/lib/draftmasters/site";
import Navbar from "./components/Navbar";
import SessionWrapper from "./components/SessionWrapper";
import ChallengePopup from "./components/ChallengePopup";
import { VoiceProvider } from "./components/VoiceWidget";
import { VibeProvider } from "./components/VibePlayer";
import GlobalNotifications from "./components/GlobalNotifications";
import { PortalProvider } from "./components/PortalContext";
import PWAInstall from "./components/PWAInstall";
import IdleLogout from "./components/IdleLogout";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "GREAT SOULS — A gathering of legends",
  description: "Friends-only gaming hub. No ads. No tracking. Just legends.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Great Souls",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  /* On draftmasters.net the game is the whole site. A nav bar offering
     Moonhaven, Debate and Leaderboards is a different product's furniture
     and the first thing a new player would see. */
  const standalone = await isStandaloneSite();
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&display=swap" rel="stylesheet" />
      </head>
      <body className={`${geist.variable} antialiased gs-theme`}>
        <PWAInstall />
        <SessionWrapper>
          <IdleLogout />
          <PortalProvider>
          <VoiceProvider>
            <VibeProvider>
              {!standalone && <Navbar />}
              <main className="min-h-screen">{children}</main>
              {/* The hub's floating furniture — a challenge popup and a
                  notifications tray for games DraftMasters players have never
                  heard of. Same reasoning as the nav bar: on the game's own
                  domain it is another product's chrome. */}
              {!standalone && (
                <>
                  <ChallengePopup />
                  <GlobalNotifications />
                </>
              )}
            </VibeProvider>
          </VoiceProvider>
          </PortalProvider>
        </SessionWrapper>
      </body>
    </html>
  );
}
