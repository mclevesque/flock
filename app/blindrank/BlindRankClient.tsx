"use client";
import { useState, useCallback } from "react";

export default function BlindRankClient({ username }: { username: string | null }) {
  const [topic, setTopic] = useState("");
  const [itemsText, setItemsText] = useState("");
  const [useImages, setUseImages] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const items = itemsText.split("\n").map(s => s.trim()).filter(Boolean);
  const canGenerate = topic.trim().length > 0 && items.length >= 2;

  const generateLink = useCallback(() => {
    if (!canGenerate) return;
    const shuffled = [...items].sort(() => Math.random() - 0.5);
    const data = {
      topic: topic.trim(),
      items: shuffled,
      useImages,
      createdBy: username || "anonymous",
    };
    const encoded = btoa(encodeURIComponent(JSON.stringify(data)));
    setGeneratedLink(`${window.location.origin}/blindrank/play?d=${encoded}`);
  }, [topic, items, useImages, username, canGenerate]);

  const copyLink = async () => {
    if (!generatedLink) return;
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const inputStyle = {
    width: "100%",
    background: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: 10,
    padding: "12px 16px",
    color: "#e8dcc8",
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box" as const,
    fontFamily: "inherit",
    transition: "border-color 0.2s",
  };

  const labelStyle = {
    display: "block",
    marginBottom: 7,
    color: "#d4a942",
    fontSize: 11,
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
    fontFamily: "'Cinzel', serif",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0d0d0d", color: "#e8dcc8", padding: "20px", fontFamily: "var(--font-geist-sans, sans-serif)" }}>
      <style>{`
        .br-input:focus { border-color: #d4a942 !important; }
        .br-toggle:hover { border-color: #d4a942 !important; opacity: 0.9; }
        .br-gen-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(212,169,66,0.35) !important; }
        .br-copy-btn:hover { opacity: 0.85; }
      `}</style>

      <div style={{ maxWidth: 580, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", paddingTop: 28, marginBottom: 44 }}>
          <h1 style={{
            fontFamily: "'Cinzel', serif",
            fontSize: "clamp(36px, 10vw, 60px)",
            fontWeight: 900,
            letterSpacing: "0.08em",
            background: "linear-gradient(135deg, #d4a942 0%, #ffffff 50%, #d4a942 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            margin: 0,
            lineHeight: 1,
          }}>
            BL!NDR4NK
          </h1>
          <p style={{ color: "#a89878", marginTop: 10, fontSize: 14, letterSpacing: "0.04em" }}>
            Build a list. Send a link. They rank it blind.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {/* Topic */}
          <div>
            <label style={labelStyle}>The Topic</label>
            <input
              className="br-input"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Rank these horror movies"
              style={inputStyle}
            />
          </div>

          {/* Items */}
          <div>
            <label style={labelStyle}>Items to Rank — one per line</label>
            <textarea
              className="br-input"
              value={itemsText}
              onChange={e => setItemsText(e.target.value)}
              placeholder={"The Shining\nHereditary\nGet Out\nMidsommar\nA Quiet Place"}
              rows={7}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.7 }}
            />
            {items.length > 0 && (
              <p style={{ color: "#555", fontSize: 12, marginTop: 5, marginBottom: 0 }}>
                {items.length} item{items.length !== 1 ? "s" : ""}
                {items.length < 2 && " — add at least 2"}
              </p>
            )}
          </div>

          {/* AI images toggle */}
          <button
            className="br-toggle"
            onClick={() => setUseImages(v => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: useImages ? "rgba(212,169,66,0.08)" : "transparent",
              border: `1px solid ${useImages ? "#d4a942" : "#333"}`,
              borderRadius: 10,
              padding: "10px 16px",
              color: useImages ? "#d4a942" : "#666",
              cursor: "pointer",
              fontSize: 13,
              transition: "all 0.2s",
              textAlign: "left",
            }}
          >
            <span style={{
              width: 18, height: 18, borderRadius: 4,
              border: `1.5px solid ${useImages ? "#d4a942" : "#444"}`,
              background: useImages ? "#d4a942" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, color: "#000", flexShrink: 0,
              transition: "all 0.2s",
            }}>
              {useImages ? "✓" : ""}
            </span>
            Generate AI images via Pollinations (free, no key needed)
          </button>

          {/* Generate button */}
          <button
            className="br-gen-btn"
            onClick={generateLink}
            disabled={!canGenerate}
            style={{
              background: canGenerate
                ? "linear-gradient(135deg, #d4a942 0%, #c4531a 100%)"
                : "#1e1e1e",
              color: canGenerate ? "#000" : "#444",
              border: canGenerate ? "none" : "1px solid #2a2a2a",
              borderRadius: 10,
              padding: "15px 24px",
              fontSize: 15,
              fontWeight: 800,
              fontFamily: "'Cinzel', serif",
              letterSpacing: "0.08em",
              cursor: canGenerate ? "pointer" : "not-allowed",
              transition: "all 0.2s",
              boxShadow: canGenerate ? "0 4px 16px rgba(212,169,66,0.2)" : "none",
            }}
          >
            GENERATE LINK →
          </button>

          {/* Link output */}
          {generatedLink && (
            <div style={{
              background: "#111",
              border: "1px solid #d4a942",
              borderRadius: 12,
              padding: 18,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}>
              <p style={{ margin: 0, color: "#a89878", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Ready — send this to your friend
              </p>
              <div style={{
                background: "#0a0a0a",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 11,
                color: "#d4a942",
                wordBreak: "break-all",
                lineHeight: 1.5,
              }}>
                {generatedLink}
              </div>
              <button
                className="br-copy-btn"
                onClick={copyLink}
                style={{
                  background: copied ? "rgba(90,154,84,0.15)" : "rgba(212,169,66,0.1)",
                  border: `1px solid ${copied ? "#5a9a54" : "#d4a942"}`,
                  borderRadius: 8,
                  padding: "11px",
                  color: copied ? "#5a9a54" : "#d4a942",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 14,
                  fontFamily: "'Cinzel', serif",
                  letterSpacing: "0.06em",
                  transition: "all 0.2s",
                }}
              >
                {copied ? "✓  COPIED!" : "COPY LINK"}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p style={{ textAlign: "center", color: "#2a2a2a", fontSize: 12, marginTop: 48 }}>
          {username
            ? <>Creating as <span style={{ color: "#555" }}>{username}</span></>
            : <>Playing as guest · <a href="/signin" style={{ color: "#555" }}>Sign in</a></>}
        </p>
      </div>
    </div>
  );
}
