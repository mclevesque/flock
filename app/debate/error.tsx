"use client";
import Link from "next/link";
import { useEffect } from "react";

export default function DebateErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[debate] error boundary:", error);
  }, [error]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, textAlign: "center",
      background: "var(--bg, #0f0d0a)", color: "var(--text-primary, #e8dcc8)",
    }}>
      <div style={{ maxWidth: 340 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🎙</div>
        <h1 style={{ fontFamily: "Cinzel, serif", fontSize: 22, margin: "0 0 8px" }}>Debate crashed</h1>
        <p style={{ opacity: 0.75, fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>
          Something went wrong loading this debate. Try again, or head back to the lobby.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button onClick={reset} style={{
            padding: "10px 18px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)",
            background: "transparent", color: "inherit", cursor: "pointer",
          }}>Retry</button>
          <Link href="/debate" style={{
            padding: "10px 18px", borderRadius: 10, background: "var(--accent-purple, #d4a942)",
            color: "#1a1408", fontWeight: 700, textDecoration: "none",
          }}>Lobby</Link>
        </div>
      </div>
    </div>
  );
}
