"use client";
import { useState, useCallback } from "react";

const MAX_ITEMS = 12;

// FNV-1a hash — same formula used in BlindRankPlayClient to derive sessionId from `d`
function computeSessionId(d: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < d.length; i++) {
    h ^= d.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export default function BlindRankClient({ username }: { username: string | null }) {
  const [topic, setTopic]         = useState("");
  const [itemsText, setItemsText] = useState("");
  const [useImages, setUseImages] = useState(false);
  const [playLink, setPlayLink]   = useState<string | null>(null);
  const [resultsLink, setResultsLink] = useState<string | null>(null);
  const [copied, setCopied]       = useState<"play" | "results" | null>(null);

  const items = itemsText.split("\n").map(s => s.trim()).filter(Boolean);
  const overLimit = items.length > MAX_ITEMS;
  const canGenerate = topic.trim().length > 0 && items.length >= 2;

  const generateLink = useCallback(() => {
    if (!canGenerate) return;
    // Shuffle so each link reveals in a random order
    const shuffled = [...items.slice(0, MAX_ITEMS)].sort(() => Math.random() - 0.5);
    const data = { topic: topic.trim(), items: shuffled, useImages, createdBy: username ?? "anonymous" };
    const d = btoa(encodeURIComponent(JSON.stringify(data)));
    const sid = computeSessionId(d);
    setPlayLink(`${window.location.origin}/blindrank/play?d=${d}`);
    setResultsLink(`${window.location.origin}/blindrank/results/${sid}`);
    setCopied(null);
  }, [topic, items, useImages, username, canGenerate]);

  const copy = async (which: "play" | "results") => {
    const link = which === "play" ? playLink : resultsLink;
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(which);
    setTimeout(() => setCopied(null), 2500);
  };

  const inputStyle = {
    width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a",
    borderRadius: 10, padding: "12px 16px", color: "#e8dcc8", fontSize: 15,
    outline: "none", boxSizing: "border-box" as const, fontFamily: "inherit", transition: "border-color 0.2s",
  };
  const labelStyle = {
    display: "block", marginBottom: 7, color: "#d4a942", fontSize: 11,
    letterSpacing: "0.12em", textTransform: "uppercase" as const, fontFamily: "'Cinzel', serif",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0d0d0d", color: "#e8dcc8", padding: "20px", fontFamily: "var(--font-geist-sans, sans-serif)" }}>
      <style>{`
        .br-input:focus { border-color: #d4a942 !important; }
        .br-toggle:hover { border-color: #d4a942 !important; }
        .br-gen-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(212,169,66,0.35) !important; }
      `}</style>

      <div style={{ maxWidth: 580, margin: "0 auto" }}>
        <div style={{ textAlign: "center", paddingTop: 28, marginBottom: 44 }}>
          <h1 style={{ fontFamily: "'Cinzel', serif", fontSize: "clamp(36px,10vw,60px)", fontWeight: 900, letterSpacing: "0.08em", background: "linear-gradient(135deg,#d4a942 0%,#ffffff 50%,#d4a942 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0, lineHeight: 1 }}>
            BL!NDR4NK
          </h1>
          <p style={{ color: "#a89878", marginTop: 10, fontSize: 14, letterSpacing: "0.04em" }}>
            Build a list. Share a link. Everyone ranks it blind.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div>
            <label style={labelStyle}>The Topic</label>
            <input className="br-input" value={topic} onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Rank these horror movies" style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>
              Items to Rank — one per line
              <span style={{ color: overLimit ? "#c4531a" : "#555", marginLeft: 8, fontFamily: "sans-serif", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                ({Math.min(items.length, MAX_ITEMS)}/{MAX_ITEMS})
              </span>
            </label>
            <textarea className="br-input" value={itemsText} onChange={e => setItemsText(e.target.value)}
              placeholder={"The Shining\nHereditary\nGet Out\nMidsommar\nA Quiet Place"}
              rows={8} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.7 }} />
            {overLimit && <p style={{ color: "#c4531a", fontSize: 12, marginTop: 4 }}>Only the first 12 will be used.</p>}
          </div>

          <button className="br-toggle" onClick={() => setUseImages(v => !v)} style={{
            display: "flex", alignItems: "center", gap: 10,
            background: useImages ? "rgba(212,169,66,0.08)" : "transparent",
            border: `1px solid ${useImages ? "#d4a942" : "#333"}`, borderRadius: 10,
            padding: "10px 16px", color: useImages ? "#d4a942" : "#666",
            cursor: "pointer", fontSize: 13, transition: "all 0.2s", textAlign: "left",
          }}>
            <span style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${useImages ? "#d4a942" : "#444"}`, background: useImages ? "#d4a942" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#000", flexShrink: 0, transition: "all 0.2s" }}>
              {useImages ? "✓" : ""}
            </span>
            Generate AI images via Pollinations (free, no key)
          </button>

          <button className="br-gen-btn" onClick={generateLink} disabled={!canGenerate} style={{
            background: canGenerate ? "linear-gradient(135deg,#d4a942,#c4531a)" : "#1e1e1e",
            color: canGenerate ? "#000" : "#444",
            border: canGenerate ? "none" : "1px solid #2a2a2a",
            borderRadius: 10, padding: "15px 24px", fontSize: 15, fontWeight: 800,
            fontFamily: "'Cinzel', serif", letterSpacing: "0.08em",
            cursor: canGenerate ? "pointer" : "not-allowed", transition: "all 0.2s",
            boxShadow: canGenerate ? "0 4px 16px rgba(212,169,66,0.2)" : "none",
          }}>
            GENERATE LINK →
          </button>

          {playLink && resultsLink && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Play link */}
              <div style={{ background: "#111", border: "1px solid #d4a942", borderRadius: 12, padding: 16 }}>
                <p style={{ margin: "0 0 8px", color: "#a89878", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  🃏 Share this to rank
                </p>
                <div style={{ background: "#0a0a0a", borderRadius: 7, padding: "8px 12px", fontSize: 11, color: "#d4a942", wordBreak: "break-all", lineHeight: 1.5, marginBottom: 10 }}>
                  {playLink}
                </div>
                <button onClick={() => copy("play")} style={{
                  width: "100%", background: copied === "play" ? "rgba(90,154,84,0.12)" : "rgba(212,169,66,0.08)",
                  border: `1px solid ${copied === "play" ? "#5a9a54" : "#d4a942"}`,
                  borderRadius: 8, padding: "10px", color: copied === "play" ? "#5a9a54" : "#d4a942",
                  cursor: "pointer", fontWeight: 700, fontSize: 13,
                  fontFamily: "'Cinzel', serif", letterSpacing: "0.06em", transition: "all 0.2s",
                }}>
                  {copied === "play" ? "✓  COPIED!" : "COPY PLAY LINK"}
                </button>
              </div>

              {/* Results link */}
              <div style={{ background: "#0e0e0e", border: "1px solid #2a2a2a", borderRadius: 12, padding: 16 }}>
                <p style={{ margin: "0 0 8px", color: "#555", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  📊 Results feed (bookmark this)
                </p>
                <div style={{ background: "#0a0a0a", borderRadius: 7, padding: "8px 12px", fontSize: 11, color: "#555", wordBreak: "break-all", lineHeight: 1.5, marginBottom: 10 }}>
                  {resultsLink}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => copy("results")} style={{
                    flex: 1, background: copied === "results" ? "rgba(90,154,84,0.1)" : "transparent",
                    border: `1px solid ${copied === "results" ? "#5a9a54" : "#2a2a2a"}`,
                    borderRadius: 8, padding: "9px", color: copied === "results" ? "#5a9a54" : "#555",
                    cursor: "pointer", fontWeight: 700, fontSize: 12,
                    fontFamily: "'Cinzel', serif", transition: "all 0.2s",
                  }}>
                    {copied === "results" ? "✓ COPIED" : "COPY"}
                  </button>
                  <a href={resultsLink} style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                    background: "transparent", border: "1px solid #2a2a2a",
                    borderRadius: 8, padding: "9px", color: "#555",
                    textDecoration: "none", fontSize: 12, fontFamily: "'Cinzel', serif",
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
