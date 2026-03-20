"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useVibe } from "@/app/components/VibePlayer";
import { VIBE_TAGS, buildPlaylist } from "./vibeData";

export default function VibePage() {
  const { data: session } = useSession();
  const {
    playlist, currentIndex, playing, muted,
    interests, setInterests, play, pause, next, prev, toggleMute, jumpTo, loadInterests,
  } = useVibe();

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [customInput, setCustomInput] = useState("");

  function addCustomInterest() {
    const val = customInput.trim();
    if (!val) return;
    const key = `custom:${val}`;
    if (!draft.includes(key) && draft.length < 10) {
      setDraft(d => [...d, key]);
    }
    setCustomInput("");
  }

  useEffect(() => {
    loadInterests().then(() => setLoaded(true));
  }, [loadInterests]);

  useEffect(() => {
    if (loaded && interests.length === 0 && session?.user) {
      setShowOnboarding(true);
      setDraft([]);
    } else if (loaded) {
      setDraft(interests);
    }
  }, [loaded, interests, session?.user]);

  async function saveInterests() {
    if (draft.length < 2) return;
    setSaving(true);
    await fetch("/api/vibe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interests: draft }),
    });
    setInterests(draft);
    setShowOnboarding(false);
    setSaving(false);
    play();
  }

  const currentVideo = playlist[currentIndex];

  // ── Onboarding ──────────────────────────────────────────────────────────────
  if (showOnboarding) {
    return (
      <div style={{
        minHeight: "calc(100vh - 52px)", background: "#09090f",
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: "32px 16px",
      }}>
        <div style={{ maxWidth: 640, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚡</div>
          <h1 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: "-0.5px" }}>
            Your Vibe Mix
          </h1>
          <p style={{ margin: "0 0 20px", color: "rgba(255,255,255,0.5)", fontSize: 15 }}>
            Pick categories or type anything — Taylor Swift, Breaking Bad, F1, your gym playlist. We'll find it.
          </p>

          {/* Custom text input */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomInterest(); } }}
              placeholder="Type anything: Taylor Swift, Breaking Bad, Formula 1…"
              style={{
                flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 14, outline: "none", fontFamily: "inherit",
              }}
            />
            <button
              onClick={addCustomInterest}
              disabled={!customInput.trim() || draft.length >= 10}
              style={{
                background: "linear-gradient(135deg, #7c3aed, #a855f7)", border: "none", borderRadius: 10,
                padding: "10px 18px", color: "#fff", fontSize: 14, fontWeight: 800, cursor: customInput.trim() ? "pointer" : "default",
                opacity: customInput.trim() ? 1 : 0.4,
              }}
            >+ Add</button>
          </div>

          {/* Custom interest chips */}
          {draft.filter(d => d.startsWith("custom:")).length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16, justifyContent: "center" }}>
              {draft.filter(d => d.startsWith("custom:")).map(key => {
                const label = key.slice("custom:".length);
                return (
                  <span key={key} style={{
                    background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.4)",
                    borderRadius: 20, padding: "4px 12px", fontSize: 13, color: "#c084fc",
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                    ✨ {label}
                    <button
                      onClick={() => setDraft(d => d.filter(x => x !== key))}
                      style={{ background: "none", border: "none", color: "rgba(168,85,247,0.7)", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 }}
                    >×</button>
                  </span>
                );
              })}
            </div>
          )}

          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 20, textAlign: "center" }}>
            Or pick from popular categories below
          </div>

          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginBottom: 24,
          }}>
            {VIBE_TAGS.map(tag => {
              const selected = draft.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => setDraft(d => selected ? d.filter(x => x !== tag.id) : d.length < 10 ? [...d, tag.id] : d)}
                  style={{
                    background: selected ? `${tag.color}22` : "rgba(255,255,255,0.04)",
                    border: `2px solid ${selected ? tag.color : "rgba(255,255,255,0.1)"}`,
                    borderRadius: 14, padding: "14px 10px", cursor: "pointer",
                    transition: "all 0.15s ease", textAlign: "center",
                    transform: selected ? "scale(1.04)" : "scale(1)",
                  }}
                >
                  <div style={{ fontSize: 28, marginBottom: 6 }}>{tag.emoji}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: selected ? "#fff" : "rgba(255,255,255,0.7)" }}>
                    {tag.label}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 3, lineHeight: 1.3 }}>
                    {tag.desc}
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 20 }}>
            {draft.length === 0 ? "Pick or type at least 2 to continue" :
             draft.length === 1 ? "Add one more…" :
             `${draft.length} selected — `}
            {draft.length >= 2 && (
              <span style={{ color: "#a855f7" }}>
                ~{buildPlaylist(draft).length} videos in your mix
              </span>
            )}
          </div>

          <button
            disabled={draft.length < 2 || saving}
            onClick={saveInterests}
            style={{
              background: draft.length < 2 ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #7c3aed, #a855f7)",
              border: "none", borderRadius: 12, padding: "14px 40px",
              color: draft.length < 2 ? "rgba(255,255,255,0.3)" : "#fff",
              fontSize: 16, fontWeight: 800, cursor: draft.length < 2 ? "default" : "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {saving ? "Building your mix…" : "⚡ Build My Vibe Mix"}
          </button>
        </div>
      </div>
    );
  }

  // ── Full Player ─────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "calc(100vh - 52px)", background: "#09090f", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>⚡</span>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#fff" }}>Vibe</h1>
          {interests.length > 0 && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {interests.map(id => {
                if (id.startsWith("custom:")) {
                  const label = id.slice("custom:".length);
                  return (
                    <span key={id} style={{
                      background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.4)",
                      borderRadius: 20, padding: "2px 8px", fontSize: 11, color: "#c084fc", fontWeight: 700,
                    }}>✨ {label}</span>
                  );
                }
                const tag = VIBE_TAGS.find(t => t.id === id);
                return tag ? (
                  <span key={id} style={{
                    background: `${tag.color}22`, border: `1px solid ${tag.color}55`,
                    borderRadius: 20, padding: "2px 8px", fontSize: 11, color: tag.color, fontWeight: 700,
                  }}>{tag.emoji} {tag.label}</span>
                ) : null;
              })}
            </div>
          )}
        </div>
        <button
          onClick={() => { setShowOnboarding(true); setDraft(interests); }}
          style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8, padding: "6px 14px", color: "rgba(255,255,255,0.6)",
            fontSize: 12, cursor: "pointer", fontWeight: 600,
          }}
        >
          🎛️ Edit Mix
        </button>
      </div>

      {playlist.length === 0 ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 48 }}>⚡</div>
          <div style={{ color: "rgba(255,255,255,0.5)" }}>
            {session?.user ? "No playlist yet." : "Sign in to build your Vibe mix."}
          </div>
          {session?.user && (
            <button onClick={() => { setShowOnboarding(true); setDraft([]); }}
              style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", border: "none", borderRadius: 10, padding: "10px 24px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              ⚡ Build My Mix
            </button>
          )}
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 0 80px" }}>
          {/* Main Video */}
          {currentVideo && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 20px 0" }}>
              {/* YouTube iframe — the REAL visible player on this page */}
              <div style={{
                width: "100%", maxWidth: 800,
                aspectRatio: "16/9",
                borderRadius: 16, overflow: "hidden",
                boxShadow: "0 8px 48px rgba(124,58,237,0.3)",
                background: "#000",
              }}>
                <iframe
                  key={`${currentIndex}-${playing}`}
                  src={currentVideo.searchQuery
                    ? `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(currentVideo.searchQuery)}&autoplay=${playing ? 1 : 0}&mute=${muted ? 1 : 0}&rel=0`
                    : `https://www.youtube.com/embed/${currentVideo.id}?autoplay=${playing ? 1 : 0}&mute=${muted ? 1 : 0}&rel=0&modestbranding=1&iv_load_policy=3`}
                  allow="autoplay; encrypted-media; fullscreen"
                  allowFullScreen
                  style={{ width: "100%", height: "100%", border: "none" }}
                  title={currentVideo.title}
                />
              </div>

              {/* Video info + controls */}
              <div style={{ width: "100%", maxWidth: 800, marginTop: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{currentVideo.title}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                      {VIBE_TAGS.filter(t => currentVideo.tags.includes(t.id)).map(t => `${t.emoji} ${t.label}`).join(" · ")}
                      <span style={{ marginLeft: 8, textTransform: "capitalize", color: "rgba(255,255,255,0.3)" }}>
                        {currentVideo.type}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
                    {currentIndex + 1} / {playlist.length}
                  </div>
                </div>

                {/* Controls bar */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={prev} style={ctrlBtn}>⏮</button>
                  <button onClick={playing ? pause : play} style={{ ...ctrlBtn, background: "rgba(124,58,237,0.3)", border: "1px solid rgba(124,58,237,0.5)", fontSize: 18, padding: "8px 16px" }}>
                    {playing ? "⏸" : "▶"}
                  </button>
                  <button onClick={next} style={ctrlBtn}>⏭</button>
                  <button onClick={toggleMute} style={ctrlBtn}>{muted ? "🔇" : "🔊"}</button>
                  <div style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                    Audio continues when you switch tabs ·
                    <span style={{ color: "#a855f7", marginLeft: 4 }}>mini player appears bottom-right</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Playlist */}
          <div style={{ padding: "20px 20px 0", maxWidth: 840, width: "100%", margin: "0 auto" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.4)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Up Next
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {playlist.map((v, i) => {
                const active = i === currentIndex;
                const tags = VIBE_TAGS.filter(t => v.tags.includes(t.id));
                return (
                  <button
                    key={`${v.id}-${i}`}
                    onClick={() => jumpTo(i)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                      background: active ? "rgba(124,58,237,0.2)" : "transparent",
                      border: `1px solid ${active ? "rgba(124,58,237,0.4)" : "transparent"}`,
                      borderRadius: 10, cursor: "pointer", textAlign: "left",
                      transition: "background 0.1s ease",
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                  >
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", width: 20, textAlign: "center", flexShrink: 0 }}>
                      {active && playing ? "▶" : i + 1}
                    </span>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>
                      {tags[0]?.emoji ?? "🎵"}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? "#fff" : "rgba(255,255,255,0.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {v.title}
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "capitalize" }}>
                        {v.type} · {tags.map(t => t.label).join(", ")}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ctrlBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8, padding: "7px 12px",
  color: "#fff", fontSize: 15, cursor: "pointer",
};
