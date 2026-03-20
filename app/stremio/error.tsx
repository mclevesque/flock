"use client";
import { useEffect } from "react";

export default function StremioError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error("Stremio page error:", error);
  }, [error]);

  return (
    <div style={{
      minHeight: "100vh", background: "#0d0f14",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "inherit", padding: 24,
    }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>📺</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: "#e8eaf6", marginBottom: 8 }}>
        Something went wrong
      </div>
      <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 24, textAlign: "center", maxWidth: 400 }}>
        {error?.message || "An unexpected error occurred loading the stream page."}
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={reset}
          style={{
            background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
            border: "none", borderRadius: 10, padding: "10px 24px",
            color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
          }}
        >
          Try Again
        </button>
        <a
          href="/stremio"
          style={{
            background: "transparent", border: "1px solid #2a2d3a",
            borderRadius: 10, padding: "10px 24px",
            color: "#8890a4", fontSize: 14, cursor: "pointer",
            textDecoration: "none", display: "inline-flex", alignItems: "center",
          }}
        >
          Back to Rooms
        </a>
      </div>
    </div>
  );
}
