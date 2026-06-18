"use client";
import { useState, useCallback } from "react";

const MAX_ITEMS = 12;

export default function BlindRankClient({ username }: { username: string | null }) {
  const [topic, setTopic]         = useState("");
  const [itemsText, setItemsText] = useState("");
  const [useImages, setUseImages] = useState(false);
  const [playLink, setPlayLink]   = useState<string | null>(null);
  const [resultsLink, setResultsLink] = useState<string | null>(null);
  const [copied, setCopied]       = useState<"play" | "results" | null>(null);
  const [generating, setGenerating] = useState(false);

  const items = itemsText.split("\n").map(s => s.trim()).filter(Boolean);
  const overLimit = items.length > MAX_ITEMS;
  const canGenerate = topic.trim().length > 0 && items.length >= 2;

  const generateLink = useCallback(async () => {
    if (!canGenerate || generating) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/blindrank/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          items: items.slice(0, MAX_ITEMS),
          useImages,
          createdBy: username ?? "anonymous",
        }),
      });
      if (!res.ok) throw new Error("Failed to create session");
      const { sessionId } = await res.json();
      setPlayLink(`${window.location.origin}/blindrank/play/${sessionId}`);
      setResultsLink(`${window.location.origin}/blindrank/results/${sessionId}`);
      setCopied(null);
    } catch (e) {
      console.error(e);
      alert("Failed to generate link");
    } finally {
      setGenerating(false);
    }
  }, [topic, items, useImages, username, canGenerate, generating]);

  const copy = async (which: "play" | "results") => {
    const link = which === "play" ? playLink : resultsLink;
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(which);
    setTimeout(() => setCopied(null), 2500);
  };

  // fontSize 16 on all inputs — prevents iOS from auto-zooming the page when focused
  const inputStyle = {
    width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a",
    borderRadius: 10, padding: "14px 16px", color: "#e8dcc8", fontSize: 16,
    outline: "none", boxSizing: "border-box" as const, fontFamily: "inherit",
    transition: "border-color 0.2s",
    WebkitAppearance: "none" as const, // remove iOS inner shadow
  };
  const labelStyle = {
    display: "block", marginBottom: 8, color: "#d4a942", fontSize: 12,
    letterSpacing: "0.12em", textTransform: "uppercase" as const, fontFamily: "'Cinzel', serif",
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#0d0d0d", color: "#e8dcc8",
      // Safe-area padding + generous bottom so content clears the mobile keyboard
      padding: "20px 20px calc(env(safe-area-inset-bottom, 0px) + 80px)",
      fontFamily: "var(--font-geist-sans, sans-serif)",
    }}>
      <style>{`
        .br-input:focus { border-color: #d4a942 !important; }
        .br-toggle:hover { border-color: #d4a942 !important; }
        .br-gen-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(212,169,66,0.35) !important; }
        /* Mobile: tighter top padding */
        @media (max-width: 480px) {
          .br-header { padding-top: 16px !important; margin-bottom: 28px !important; }
          .br-title  { font-size: 40px !important; }
        }
      `}</style>

      <div style={{ maxWidth: 580, margin: "0 auto" }}>
        <div className="br-header" style={{ textAlign: "center", paddingTop: 28, marginBottom: 40 }}>
          <h1 className="br-title" style={{ fontFamily: "'Cinzel', serif", fontSize: "clamp(36px,10vw,60px)", fontWeight: 900, letterSpacing: "0.08em", background: "linear-gradient(135deg,#d4a942 0%,#ffffff 50%,#d4a942 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0, lineHeight: 1 }}>
            BL!NDR4NK
          </h1>
          <p style={{ color: "#a89878", marginTop: 10, fontSize: 14, letterSpacing: "0.04em" }}>
            Build a list. Share a link. Everyone ranks it blind.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {/* Topic */}
          <div>
            <label style={labelStyle}>The Topic</label>
            <input className="br-input" value={topic} onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Rank these horror movies"
              style={inputStyle} />
          </div>

          {/* Items */}
          <div>
            <label style={labelStyle}>
              Items to Rank — one per line
              <span style={{ color: overLimit ? "#c4531a" : "#555", marginLeft: 8, fontFamily: "sans-serif", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                ({Math.min(items.length, MAX_ITEMS)}/{MAX_ITEMS})
              </span>
            </label>
            <textarea className="br-input" value={itemsText} onChange={e => setItemsText(e.target.value)}
              placeholder={"The Shining\nHereditary\nGet Out\nMidsommar\nA Quiet Place"}
              rows={8}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.8 }} />
            {overLimit && <p style={{ color: "#c4531a", fontSize: 13, marginTop: 5 }}>Only the first 12 will be used.</p>}
          </div>

          {/* AI images toggle */}
          <button className="br-toggle" onClick={() => setUseImages(v => !v)} style={{
            display: "flex", alignItems: "center", gap: 12,
            background: useImages ? "rgba(212,169,66,0.08)" : "transparent",
            border: `1px solid ${useImages ? "#d4a942" : "#333"}`, borderRadius: 10,
            padding: "14px 16px", color: useImages ? "#d4a942" : "#666",
            cursor: "pointer", fontSize: 14, transition: "all 0.2s", textAlign: "left",
            minHeight: 48,
          }}>
            <span style={{ width: 20, height: 20, borderRadius: 5, border: `1.5px solid ${useImages ? "#d4a942" : "#444"}`, background: useImages ? "#d4a942" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#000", flexShrink: 0, transition: "all 0.2s" }}>
              {useImages ? "✓" : ""}
            </span>
            Generate AI images via Pollinations (free, no key)
          </button>

          {/* Generate button */}
          <button className="br-gen-btn" onClick={generateLink} disabled={!canGenerate || generating} style={{
            background: (canGenerate && !generating) ? "linear-gradient(135deg,#d4a942,#c4531a)" : "#1e1e1e",
            color: (canGenerate && !generating) ? "#000" : "#444",
            border: (canGenerate && !generating) ? "none" : "1px solid #2a2a2a",
            borderRadius: 10, padding: "16px 24px", fontSize: 16, fontWeight: 800,
            fontFamily: "'Cinzel', serif", letterSpacing: "0.08em", minHeight: 54,
            cursor: (canGenerate && !generating) ? "pointer" : "not-allowed", transition: "all 0.2s",
            boxShadow: (canGenerate && !generating) ? "0 4px 16px rgba(212,169,66,0.2)" : "none",
          }}>
            {generating ? "GENERATING…" : "GENERATE LINK →"}
          </button>

          {/* Generated links */}
          {playLink && resultsLink && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Play link */}
              <div style={{ background: "#111", border: "1px solid #d4a942", borderRadius: 12, padding: 16 }}>
                <p style={{ margin: "0 0 8px", color: "#a89878", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  🃏 Share this to rank
                </p>
                <div style={{ background: "#0a0a0a", borderRadius: 7, padding: "10px 12px", fontSize: 12, color: "#d4a942", wordBreak: "break-all", lineHeight: 1.6, marginBottom: 10 }}>
                  {playLink}
                </div>
                <button onClick={() => copy("play")} style={{
                  width: "100%", minHeight: 48,
                  background: copied === "play" ? "rgba(90,154,84,0.12)" : "rgba(212,169,66,0.08)",
                  border: `1px solid ${copied === "play" ? "#5a9a54" : "#d4a942"}`,
                  borderRadius: 8, padding: "12px",
                  color: copied === "play" ? "#5a9a54" : "#d4a942",
                  cursor: "pointer", fontWeight: 700, fontSize: 14,
                  fontFamily: "'Cinzel', serif", letterSpacing: "0.06em", transition: "all 0.2s",
                }}>
                  {copied === "play" ? "✓  COPIED!" : "COPY PLAY LINK"}
                </button>
              </div>

              {/* Results link */}
              <div style={{ background: "#0e0e0e", border: "1px solid #2a2a2a", borderRadius: 12, padding: 16 }}>
                <p style={{ margin: "0 0 8px", color: "#555", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  📊 Results feed (bookmark this)
                </p>
                <div style={{ background: "#0a0a0a", borderRadius: 7, padding: "10px 12px", fontSize: 12, color: "#555", wordBreak: "break-all", lineHeight: 1.6, marginBottom: 10 }}>
                  {resultsLink}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => copy("results")} style={{
                    flex: 1, minHeight: 48,
                    background: copied === "results" ? "rgba(90,154,84,0.1)" : "transparent",
                    border: `1px solid ${copied === "results" ? "#5a9a54" : "#2a2a2a"}`,
                    borderRadius: 8, padding: "10px",
                    color: copied === "results" ? "#5a9a54" : "#555",
                    cursor: "pointer", fontWeight: 700, fontSize: 13,
                    fontFamily: "'Cinzel', serif", transition: "all 0.2s",
                  }}>
                    {copied === "results" ? "✓ COPIED" : "COPY"}
                  </button>
                  <a href={resultsLink} style={{
                    flex: 1, minHeight: 48, display: "flex", alignItems: "center", justifyContent: "center",
                    background: "transparent", border: "1px solid #2a2a2a",
                    borderRadius: 8, padding: "10px", color: "#555",
                    textDecoration: "none", fontSize: 13, fontFamily: "'Cinzel', serif",
                  }}>
                    OPEN →
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        <p style={{ textAlign: "center", color: "#222", fontSize: 12, marginTop: 48 }}>
          {username
            ? <>Creating as <span style={{ color: "#444" }}>{username}</span></>
            : <>Guest · <a href="/signin" style={{ color: "#333" }}>Sign in</a></>}
        </p>
      </div>
    </div>
  );
}
