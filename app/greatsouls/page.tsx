"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useSession } from "@/lib/use-session";
import { useRouter } from "next/navigation";
import { usePortal } from "@/app/components/PortalContext";

export default function GreatSoulsLogin() {
  const { data: session, status } = useSession();
  const { setPortal } = usePortal();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // If already logged in, set GS theme and go to hub
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      setPortal("greatsouls");
      router.push("/greatsouls/hub");
    }
  }, [status, session, router, setPortal]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      username: username.trim().toLowerCase(),
      gsPortal: "true",
      redirect: false,
    });

    setLoading(false);
    if (result?.error) {
      setError("Name not recognized. Ask mclevesque to add you.");
      return;
    }

    setPortal("greatsouls");
    router.push("/greatsouls/hub");
  }

  if (status === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0d0d0d" }}>
        <div style={{ color: "#d4a942", fontFamily: "serif", fontSize: 20, animation: "pulse 2s infinite" }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: 24, background: "#0d0d0d",
    }}>
      {/* Ember particles */}
      {[18, 35, 52, 68, 24, 41, 59, 75].map((left, i) => (
        <div
          key={i}
          style={{
            position: "fixed", width: 4, height: 4, borderRadius: "50%",
            background: "#d4a942", opacity: 0.4,
            left: `${left}%`, bottom: `${12 + i * 3}%`,
            animation: `gsEmberFloat ${3 + (i % 3) * 0.7}s ease-in-out infinite`,
            animationDelay: `${i * 0.4}s`,
            pointerEvents: "none",
          }}
        />
      ))}

      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🔥</div>
        <h1 style={{
          fontFamily: "serif", color: "#d4a942", fontSize: 42, fontWeight: 700,
          letterSpacing: "0.15em", margin: "0 0 8px",
          textShadow: "0 0 30px rgba(212,169,66,0.3)",
        }}>
          GREAT SOULS
        </h1>
        <p style={{ color: "#6a5a4a", fontSize: 12, letterSpacing: "0.3em", textTransform: "uppercase", margin: 0 }}>
          A GATHERING OF LEGENDS
        </p>
      </div>

      {/* Login form */}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, width: "100%", maxWidth: 320 }}>
        <input
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20))}
          placeholder="Enter your name"
          autoFocus
          maxLength={20}
          disabled={loading}
          style={{
            width: "100%", padding: "14px 18px", fontSize: 16,
            background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8,
            color: "#e8dcc8", fontFamily: "inherit", outline: "none",
            textAlign: "center", letterSpacing: "0.05em",
          }}
        />

        <button
          type="submit"
          disabled={!username.trim() || loading}
          style={{
            width: "100%", padding: "14px 24px", fontSize: 15, fontWeight: 700,
            background: !username.trim() || loading ? "#2a2a2a" : "linear-gradient(135deg, #d4a942, #8a6d2b)",
            color: !username.trim() || loading ? "#6a5a4a" : "#0d0d0d",
            border: "1px solid #d4a942", borderRadius: 8,
            cursor: !username.trim() || loading ? "default" : "pointer",
            fontFamily: "serif", letterSpacing: "0.1em", textTransform: "uppercase",
            transition: "all 0.2s",
          }}
        >
          {loading ? "Entering..." : "Enter the Hall"}
        </button>

        {error && (
          <p style={{ color: "#c4531a", fontSize: 13, textAlign: "center", margin: 0, maxWidth: 280 }}>{error}</p>
        )}

        <p style={{ color: "#6a5a4a", fontSize: 11, textAlign: "center", margin: "16px 0 0", maxWidth: 280, lineHeight: 1.5 }}>
          No password needed. Just your name, warrior.
        </p>
      </form>

      <style>{`
        @keyframes gsEmberFloat {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.4; }
          50% { transform: translateY(-20px) scale(1.3); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
