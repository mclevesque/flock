"use client";
import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

const AREA_PATHS: Record<string, string> = {
  town:       "/town",
  moonhaven:  "/moonhaven",
  outbreak:   "/games/outbreak/index.html",
  whodoneit:  "/games/whodoneit/index.html",
  chess:      "/chess",
  pong:       "/pong",
  poker:      "/poker",
  waddabi:    "/waddabi",
  quiz:       "/quiz",
};

const GUEST_TOKEN = "ryft_warrior_guest";

export default function GuestEntry({ area }: { area: string }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const dest = AREA_PATHS[area] ?? "/town";
  const areaLabel = area.charAt(0).toUpperCase() + area.slice(1);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "authenticated") {
      router.replace(dest);
      return;
    }
    if (!signingIn) {
      setSigningIn(true);
      signIn("credentials", { guestToken: GUEST_TOKEN, callbackUrl: dest });
    }
  }, [status, dest, router, signingIn]);

  return (
    <div style={{
      minHeight: "100dvh",
      background: "radial-gradient(ellipse at 50% 40%, #1e0845 0%, #0a0218 70%, #000010 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "'Courier New', monospace", gap: 28, padding: 24,
    }}>
      {/* Warrior avatar */}
      <div style={{ position: "relative" }}>
        <div style={{
          width: 120, height: 120, borderRadius: "50%",
          background: "radial-gradient(circle at 42% 38%, #3a1a6e, #0d0520)",
          border: "3px solid #c8a600",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 40px #c8a60055, 0 0 80px #c8a60022",
          overflow: "hidden",
        }}>
          <img src="/warrior-avatar.svg" alt="Warrior" style={{ width: 120, height: 120 }} />
        </div>
        {/* Pulsing glow ring */}
        <div style={{
          position: "absolute", inset: -8, borderRadius: "50%",
          border: "1px solid #c8a60044",
          animation: "warrior-pulse 2s ease-in-out infinite",
        }} />
      </div>

      {/* Name + title */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: "#c8a600", letterSpacing: 6, marginBottom: 6 }}>
          ⚔️ WARRIOR
        </div>
        <div style={{ fontSize: 12, color: "rgba(200,166,0,0.5)", letterSpacing: 2 }}>
          GUEST ACCOUNT
        </div>
      </div>

      {/* Status */}
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 14, color: "rgba(180,160,255,0.8)" }}>
          Entering <span style={{ color: "#c8a600", fontWeight: 700 }}>{areaLabel}</span>…
        </div>
        {/* Loading dots */}
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: "50%", background: "#c8a600",
              animation: `warrior-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
            }} />
          ))}
        </div>
      </div>

      {/* Footer note */}
      <div style={{ position: "absolute", bottom: 20, fontSize: 11, color: "rgba(150,130,200,0.35)", textAlign: "center" }}>
        Playing as guest · Read-only access
      </div>

      <style>{`
        @keyframes warrior-pulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.08); opacity: 0.8; }
        }
        @keyframes warrior-dot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-8px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
