"use client";
import { useState, useEffect } from "react";

interface Session {
  id: string;
  topic: string;
  createdAt: string;
  resultCount: number;
}

export default function BlindRankMyRankingsClient() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const r = await fetch("/api/blindrank/my-sessions");
        if (r.ok) setSessions((await r.json()).sessions);
      } catch {}
      setLoading(false);
    };
    fetchSessions();
  }, []);

  const copyShareLink = async (id: string) => {
    const link = `${window.location.origin}/blindrank/play/${id}`;
    await navigator.clipboard.writeText(link);
    setCopied(id);
    setTimeout(() => setCopied(null), 2500);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0d0d0d", display: "flex", alignItems: "center", justifyContent: "center", color: "#d4a942", fontFamily: "'Cinzel', serif" }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#0d0d0d", color: "#e8dcc8",
      padding: "20px 20px calc(env(safe-area-inset-bottom, 0px) + 20px)",
      fontFamily: "var(--font-geist-sans, sans-serif)",
    }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", paddingTop: 28, marginBottom: 40 }}>
          <a href="/blindrank" style={{ textDecoration: "none" }}>
            <h1 style={{
              fontFamily: "'Cinzel', serif", fontSize: "clamp(32px,8vw,52px)", fontWeight: 900,
              letterSpacing: "0.08em", background: "linear-gradient(135deg,#d4a942,#fff,#d4a942)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0, lineHeight: 1,
            }}>
              BL!NDR4NK
            </h1>
          </a>
          <p style={{ color: "#a89878", marginTop: 12, fontSize: 14, letterSpacing: "0.04em" }}>
            Your Rankings
          </p>
        </div>

        {/* Sessions list */}
        {sessions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 40, marginBottom: 12, filter: "grayscale(1) opacity(0.3)" }}>📋</div>
            <p style={{ color: "#555", fontSize: 14 }}>No rankings created yet</p>
            <a href="/blindrank" style={{
              display: "inline-block", marginTop: 20,
              background: "linear-gradient(135deg,#d4a942,#c4531a)", color: "#000",
              border: "none", borderRadius: 10, padding: "12px 24px",
              fontFamily: "'Cinzel', serif", letterSpacing: "0.06em", fontWeight: 700,
              textDecoration: "none", fontSize: 13,
            }}>
              + CREATE ONE
            </a>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {sessions.map(s => (
              <div key={s.id} style={{
                background: "#111", border: "1px solid #242424", borderRadius: 12,
                padding: 16, display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                gap: 12, flexWrap: "wrap",
              }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600, color: "#d4a942", fontFamily: "'Cinzel', serif" }}>
                    {s.topic}
                  </h3>
                  <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
                    {new Date(s.createdAt).toLocaleDateString()} · {s.resultCount} ranking{s.resultCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => copyShareLink(s.id)} style={{
                    background: copied === s.id ? "rgba(90,154,84,0.12)" : "rgba(212,169,66,0.08)",
                    border: `1px solid ${copied === s.id ? "#5a9a54" : "#d4a942"}`,
                    borderRadius: 8, padding: "8px 12px", minHeight: 40, minWidth: 80,
                    color: copied === s.id ? "#5a9a54" : "#d4a942",
                    cursor: "pointer", fontWeight: 700, fontSize: 12,
                    fontFamily: "'Cinzel', serif", transition: "all 0.2s", whiteSpace: "nowrap",
                  }}>
                    {copied === s.id ? "✓ COPIED" : "📋 SHARE"}
                  </button>
                  <a href={`/blindrank/results/${s.id}`} style={{
                    background: "rgba(212,169,66,0.06)", border: "1px solid #333",
                    borderRadius: 8, padding: "8px 12px", minHeight: 40,
                    color: "#888", textDecoration: "none", fontWeight: 600, fontSize: 12,
                    fontFamily: "'Cinzel', serif", display: "flex", alignItems: "center",
                    whiteSpace: "nowrap", transition: "all 0.2s",
                  }}>
                    📊 RESULTS
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        <p style={{ textAlign: "center", color: "#222", fontSize: 12, marginTop: 40 }}>
          <a href="/blindrank" style={{ color: "#333", textDecoration: "none" }}>+ Create New</a>
        </p>
      </div>
    </div>
  );
}
