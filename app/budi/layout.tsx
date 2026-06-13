import type { Metadata, Viewport } from "next";
import { Fredoka } from "next/font/google";

// Chunky rounded display font for the Budi wordmark + headings
const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-budi-display" });

export const metadata: Metadata = {
  title: "budi — record your day with friends",
  description: "Tiny daily video logs with your people. Keep the streak alive.",
  // Override the site-wide Great Souls manifest so installing from /budi says "Budi"
  manifest: "/budi.webmanifest",
  appleWebApp: { capable: true, title: "Budi", statusBarStyle: "black-translucent" },
  icons: { icon: "/budi-icon-512.png", apple: "/budi-icon-512.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function BudiLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${fredoka.variable} budi-app`} style={{ minHeight: "100dvh", background: "#000000" }}>
      {/* Standalone/touch polish so /budi feels native when installed on Android/iOS */}
      <style>{`
        .budi-app { overflow-x: hidden; overscroll-behavior-y: contain; -webkit-tap-highlight-color: transparent; -webkit-touch-callout: none; user-select: none; }
        .budi-app input, .budi-app textarea, .budi-app audio { user-select: auto; -webkit-touch-callout: default; }
        .budi-app video, .budi-app img { -webkit-touch-callout: none; }
      `}</style>
      {children}
    </div>
  );
}
