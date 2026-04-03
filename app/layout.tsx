import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
              <Navbar />
              <main className="min-h-screen">{children}</main>
              <ChallengePopup />
              <GlobalNotifications />
            </VibeProvider>
          </VoiceProvider>
          </PortalProvider>
        </SessionWrapper>
      </body>
    </html>
  );
}
