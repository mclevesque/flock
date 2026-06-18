"use client";
import { useState, useEffect, useCallback } from "react";

interface Result {
  id: number;
  rankerName: string | null;
  ranking: string[];
  submittedAt: string;
}

interface Props {
  sessionId: string;
  topic: string;
  items: string[];
  useImages: boolean;
  createdBy: string | null;
  initialResults: Result[];
}

export default function BlindRankResultsClient({ sessionId, topic, items, useImages, createdBy, initialResults }: Props) {
  const [results, setResults] = useState<Result[]>(initialResults);
  const [linkCopied, setLinkCopied] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`/api/blindrank/results/${sessionId}`);
      if (r.ok) setResults(await r.json());
    } catch {}
  }, [sessionId]);

  // Poll for new submissions every 8 seconds
  useEffect(() => {
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, [refresh]);

  const copyPlayLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2500);
  };

  // Build consensus ranking: score each item by average position
  const consensus = (() => {
    if (!results.length) return [];
    const scores: Record<string, number[]> = {};
    items.forEach(item => { scores[item] = []; });
    results.forEach(r => {
      r.ranking.forEach((item, i) => {
        if (scores[item]) scores[item].push(i + 1);
      });
    });
    return items
      .map(item => ({ item, avg: scores[item].length ? scores[item].reduce((a, b) => a + b, 0) / scores[item].length : Infinity }))
      .sort((a, b) => a.avg - b.avg);
  })();

  return (
    <div style={{ minHeight: "100vh", background: "#0d0d0d", color: "#e8dcc8", padding: "16px 20px", fontFamily: "var(--font-geist-sans, sans-serif)" }}>
      <style>{`
        @keyframes br-pop { from { opacity:0; transform:scale(0.94) translateY(8px); } to { opacity:1; transform:none; } }
        @keyframes br-fade-in { from { opacity:0; } to { opacity:1; } }
        /* Mobile: stack consensus above individual, full width */
        @media (max-width: 540px) {
          .br-results-layout { flex-direction: column !important; }
          .br-consensus-col { flex: unset !important; width: 100% !important; min-width: unset !important; }
          .br-individual-col { flex: unset !important; width: 100% !important; }
        }
      `}</style>

      <div style={{ maxWidth: 860, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24, paddingTop: 8 }}>
          <div>
            <a href="/blindrank" style={{ textDecoration: "none" }}>
              <h1 style={{ fontFamily: "'Cinzel', serif", fontSize: "clamp(20px,5vw,30px)", fontWeight: 900, letterSpacing: "0.1em", background: "linear-gradient(135deg,#d4a942,#fff,#d4a942)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0 }}>
                BL!NDR4NK
              </h1>
            </a>
            <p style={{ color: "#a89878", margin: "4px 0 0", fontSize: 14 }}>
              {topic}
              {createdBy && createdBy !== "anonymous" ? <span style={{ color: "#555" }}> · by {createdBy}</span> : null}
            </p>
            <p style={{ color: "#555", margin: "2px 0 0", fontSize: 12 }}>
              {results.length} ranking{results.length !== 1 ? "s" : ""} submitted · auto-refreshes
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={copyPlayLink} style={{
              background: linkCopied ? "rgba(90,154,84,0.12)" : "rgba(212,169,66,0.08)",
              border: `1px solid ${linkCopied ? "#5a9a54" : "#d4a942"}`,
              borderRadius: 8, padding: "9px 14px",
              color: linkCopied ? "#5a9a54" : "#d4a942",
              cursor: "pointer", fontWeight: 700, fontSize: 13, minHeight: 44,
              fontFamily: "'Cinzel', serif", letterSpacing: "0.05em", transition: "all 0.2s", whiteSpace: "nowrap",
            }}>
              {linkCopied ? "✓ COPIED!" : "📋 SHARE LINK"}
            </button>
            <a href="/blindrank" style={{
              display: "flex", alignItems: "center",
              background: "rgba(212,169,66,0.06)", border: "1px solid #333",
              borderRadius: 8, padding: "9px 14px", color: "#888",
              textDecoration: "none", fontSize: 12, fontFamily: "'Cinzel', serif",
              letterSpacing: "0.05em", whiteSpace: "nowrap",
            }}>
              + NEW RANK
            </a>
          </div>
        </div>

        {/* No results yet */}
        {results.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", animation: "br-fade-in 0.4s ease" }}>
            <div style={{ fontSize: 40, marginBottom: 12, filter: "grayscale(1) opacity(0.3)" }}>📭</div>
            <p style={{ color: "#333", fontSize: 14 }}>No rankings yet — be the first!</p>
            <a href="/blindrank" style={{
              display: "inline-block", marginTop: 12,
              color: "#d4a942", fontSize: 14, textDecoration: "none",
              border: "1px solid #d4a942", borderRadius: 8, padding: "10px 20px",
              fontFamily: "'Cinzel', serif", letterSpacing: "0.06em",
            }}>+ CREATE ONE</a>
          </div>
        )}

        {/* Results feed: consensus + individual side-by-side */}
        {results.length > 0 && (
          <div className="br-results-layout" style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>

            {/* Consensus column */}
            <div className="br-consensus-col" style={{ flex: "0 0 200px", minWidth: 180 }}>
              <p style={{ color: "#555", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 8px" }}>
                Consensus ({results.length} voters)
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {consensus.map(({ item, avg }, i) => (
                  <div key={item} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    background: i === 0 ? "rgba(212,169,66,0.08)" : "#111",
                    border: `1px solid ${i === 0 ? "#d4a942" : "#1e1e1e"}`,
                    borderRadius: 9, padding: "9px 12px",
                    animation: `br-pop 0.3s ease ${i * 0.05}s both`,
                  }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                      background: i === 0 ? "linear-gradient(135deg,#d4a942,#c4531a)" : "#1e1e1e",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: i === 0 ? 11 : 10, fontWeight: 700, color: i === 0 ? "#000" : "#555",
                      fontFamily: "'Cinzel', serif",
                    }}>
                      {i === 0 ? "👑" : i + 1}
                    </div>
                    {useImages && (
                      <img src={`https://image.pollinations.ai/prompt/${encodeURIComponent(item + " vibrant digital art")}?width=60&height=60&nologo=true&seed=1`}
                        alt={item} style={{ width: 30, height: 30, borderRadius: 4, objectFit: "cover", flexShrink: 0 }} loading="lazy" />
                    )}
                    <span style={{ flex: 1, fontSize: 13, fontWeight: i < 3 ? 600 : 400, color: i === 0 ? "#d4a942" : "#ccc", lineHeight: 1.2 }}>
                      {item}
                    </span>
                    <span style={{ color: "#444", fontSize: 10, flexShrink: 0 }}>
                      {avg === Infinity ? "—" : avg.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
              <p style={{ color: "#2a2a2a", fontSize: 10, marginTop: 8 }}>avg position shown</p>
            </div>

            {/* Individual rankings */}
            <div className="br-individual-col" style={{ flex: "1 1 400px" }}>
              <p style={{ color: "#555", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 8px" }}>
                Individual Rankings
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {results.map((result, ri) => (
                  <div key={result.id} style={{
                    background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, overflow: "hidden",
                    animation: `br-pop 0.3s ease ${ri * 0.07}s both`,
                  }}>
                    <div style={{ padding: "10px 14px", background: "#161616", borderBottom: "1px solid #1e1e1e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#d4a942", fontFamily: "'Cinzel', serif" }}>
                        {result.rankerName || "Anonymous"}
                      </span>
                      <span style={{ fontSize: 10, color: "#333" }}>
                        {new Date(result.submittedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
                      {result.ranking.map((item, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 18, textAlign: "right", fontSize: 11, color: i === 0 ? "#d4a942" : "#3a3a3a", fontFamily: "'Cinzel', serif", fontWeight: 700, flexShrink: 0 }}>
                            {i + 1}
                          </span>
                          <span style={{ fontSize: 13, color: i === 0 ? "#e8dcc8" : "#888", lineHeight: 1.3 }}>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
