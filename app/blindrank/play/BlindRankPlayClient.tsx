"use client";
import { useState, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";

interface Item { id: string; text: string; }
interface GameData { topic: string; items: string[]; useImages: boolean; createdBy?: string; result?: string[]; }

// ─── Sound Engine ─────────────────────────────────────────────────────────────
function makeSounds() {
  let ctx: AudioContext | null = null;
  const get = () => {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  };
  const note = (freq: number, t: number, dur: number, vol = 0.2, type: OscillatorType = "sine") => {
    const c = get();
    const osc = c.createOscillator(); const g = c.createGain();
    osc.connect(g); g.connect(c.destination);
    osc.type = type; osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t); osc.stop(t + dur);
  };
  return {
    reveal() {
      try { const c = get(); const t = c.currentTime;
        [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => note(f, t + i * 0.075, 0.4, 0.18)); } catch {}
    },
    drop() {
      try { const c = get(); const t = c.currentTime;
        note(320, t, 0.06, 0.28); note(160, t + 0.04, 0.18, 0.2);
        note(880, t, 0.07, 0.09, "triangle"); } catch {}
    },
    tick() {
      try { const c = get(); note(800, c.currentTime, 0.04, 0.06, "triangle"); } catch {}
    },
    complete() {
      try { const c = get(); const t = c.currentTime;
        [261.63, 329.63, 392, 523.25, 659.25, 783.99, 1046.50].forEach((f, i) =>
          note(f, t + i * 0.11, 0.7, 0.17, "triangle")); } catch {}
    },
  };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function BlindRankPlayClient() {
  const params = useSearchParams();

  const gameData = useMemo<GameData | null>(() => {
    const d = params.get("d");
    if (!d) return null;
    try { return JSON.parse(decodeURIComponent(atob(d))); } catch { return null; }
  }, [params]);

  const allItems = useMemo<Item[]>(() =>
    gameData?.items.map((text, i) => ({ id: `item-${i}`, text })) ?? [], [gameData]);

  const savedResult = useMemo<Item[] | null>(() => {
    if (!gameData?.result) return null;
    return gameData.result.map((text, i) => ({ id: `r-${i}`, text }));
  }, [gameData]);

  const total = allItems.length;
  const sound = useMemo(() => typeof window !== "undefined" ? makeSounds() : null, []);

  // Slots: fixed positions 1–N on left column
  const [slots, setSlots]             = useState<(Item | null)[]>(() => savedResult ?? new Array(total).fill(null));
  const [staged, setStaged]           = useState<Item | null>(null);
  const [revealIndex, setRevealIndex] = useState(0);
  const [submitted, setSubmitted]     = useState(() => !!savedResult);
  const [justPlaced, setJustPlaced]   = useState<number | null>(null);
  const [resultCopied, setResultCopied] = useState(false);

  // Drag state
  const [isDragging, setIsDragging]   = useState(false);
  const [dragPos, setDragPos]         = useState<{x: number; y: number} | null>(null);
  const [hoverSlot, setHoverSlot]     = useState<number | null>(null);
  const slotRefs   = useRef<(HTMLDivElement | null)[]>([]);
  const lastHover  = useRef<number | null>(null);

  const placedCount = slots.filter(Boolean).length;
  const isComplete  = placedCount === total && total > 0;
  const canReveal   = !staged && revealIndex < total && !isComplete;

  // ── Reveal ──────────────────────────────────────────────────────────────────
  const handleReveal = useCallback(() => {
    if (!canReveal) return;
    sound?.reveal();
    setStaged(allItems[revealIndex]);
    setRevealIndex(p => p + 1);
  }, [canReveal, allItems, revealIndex, sound]);

  // ── Drag start (on the staged card) ─────────────────────────────────────────
  const handleDragStart = useCallback((e: React.PointerEvent) => {
    if (!staged) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
    setDragPos({ x: e.clientX, y: e.clientY });
  }, [staged]);

  // ── Pointer move (on the whole screen) ──────────────────────────────────────
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    setDragPos({ x: e.clientX, y: e.clientY });

    let best: number | null = null;
    let bestDist = Infinity;
    slotRefs.current.forEach((ref, i) => {
      if (!ref || slots[i] !== null) return;
      const r = ref.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const d = Math.hypot(e.clientX - cx, e.clientY - cy);
      // Only highlight if pointer is within the slot bounds (with 20px padding)
      const inBounds = e.clientX > r.left - 20 && e.clientX < r.right + 20 &&
                       e.clientY > r.top - 20  && e.clientY < r.bottom + 20;
      if (inBounds && d < bestDist) { bestDist = d; best = i; }
    });

    if (best !== lastHover.current) {
      lastHover.current = best;
      setHoverSlot(best);
      if (best !== null) sound?.tick();
    }
  }, [isDragging, slots, sound]);

  // ── Pointer up ──────────────────────────────────────────────────────────────
  const handlePointerUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false); setDragPos(null);

    if (staged && hoverSlot !== null && slots[hoverSlot] === null) {
      setSlots(prev => { const n = [...prev]; n[hoverSlot] = staged; return n; });
      setStaged(null);
      setJustPlaced(hoverSlot);
      setTimeout(() => setJustPlaced(null), 1800);
      sound?.drop();
    }

    setHoverSlot(null);
    lastHover.current = null;
  }, [isDragging, staged, hoverSlot, slots, sound]);

  // ── Submit / copy ────────────────────────────────────────────────────────────
  const handleSubmit = () => { sound?.complete(); setSubmitted(true); };

  const copyResult = async () => {
    if (!gameData) return;
    const ranking = slots.map(s => s?.text ?? "");
    const resultData: GameData = { ...gameData, result: ranking };
    const encoded = btoa(encodeURIComponent(JSON.stringify(resultData)));
    await navigator.clipboard.writeText(`${window.location.origin}/blindrank/play?d=${encoded}`);
    setResultCopied(true);
    setTimeout(() => setResultCopied(false), 2500);
  };

  // ─── Error ────────────────────────────────────────────────────────────────
  if (!gameData) return (
    <div style={{ minHeight: "100vh", background: "#0d0d0d", display: "flex", alignItems: "center", justifyContent: "center", color: "#e8dcc8" }}>
      <div style={{ textAlign: "center", padding: 24 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>💔</div>
        <h2 style={{ fontFamily: "'Cinzel', serif", color: "#d4a942", margin: "0 0 8px" }}>Bad Link</h2>
        <p style={{ color: "#a89878", margin: "0 0 20px" }}>This ranking link is broken or expired.</p>
        <a href="/blindrank" style={{ color: "#d4a942", fontSize: 14 }}>Create a new one →</a>
      </div>
    </div>
  );

  // ─── Results view ─────────────────────────────────────────────────────────
  if (submitted) return (
    <div style={{ minHeight: "100vh", background: "#0d0d0d", color: "#e8dcc8", padding: 20, fontFamily: "var(--font-geist-sans, sans-serif)" }}>
      <style>{`@keyframes br-pop { from { opacity:0; transform:scale(0.93) translateY(10px); } to { opacity:1; transform:none; } }`}</style>
      <div style={{ maxWidth: 540, margin: "0 auto" }}>
        <div style={{ textAlign: "center", paddingTop: 24, marginBottom: 28 }}>
          <a href="/blindrank" style={{ textDecoration: "none" }}>
            <h1 style={{ fontFamily: "'Cinzel', serif", fontSize: "clamp(22px,6vw,34px)", fontWeight: 900, background: "linear-gradient(135deg,#d4a942,#fff,#d4a942)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "0.1em", margin: 0 }}>
              BL!NDR4NK
            </h1>
          </a>
          <p style={{ color: "#a89878", marginTop: 6, fontSize: 14 }}>
            {gameData.topic}
            {gameData.createdBy && gameData.createdBy !== "anonymous" ? ` · by ${gameData.createdBy}` : ""}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 28 }}>
          {slots.map((item, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 14,
              background: i === 0 ? "rgba(212,169,66,0.1)" : "#141414",
              border: `1px solid ${i === 0 ? "#d4a942" : "#222"}`,
              borderRadius: 10, padding: "13px 16px",
              animation: `br-pop 0.3s ease ${i * 0.07}s both`,
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                background: i === 0 ? "linear-gradient(135deg,#d4a942,#c4531a)" : "#2a2a2a",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: i === 0 ? 14 : 12, fontWeight: 700, color: i === 0 ? "#000" : "#888",
                fontFamily: "'Cinzel', serif",
              }}>
                {i === 0 ? "👑" : i + 1}
              </div>
              {gameData.useImages && item && (
                <img src={`https://image.pollinations.ai/prompt/${encodeURIComponent(item.text + " vibrant digital art")}?width=80&height=80&nologo=true&seed=1`}
                  alt={item.text} style={{ width: 44, height: 44, borderRadius: 7, objectFit: "cover", flexShrink: 0 }} loading="lazy" />
              )}
              <span style={{ flex: 1, fontSize: 15, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? "#d4a942" : "#e8dcc8" }}>
                {item?.text ?? "—"}
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={copyResult} style={{
            background: resultCopied ? "rgba(90,154,84,0.12)" : "rgba(212,169,66,0.08)",
            border: `1px solid ${resultCopied ? "#5a9a54" : "#d4a942"}`,
            borderRadius: 10, padding: 14, color: resultCopied ? "#5a9a54" : "#d4a942",
            cursor: "pointer", fontWeight: 700, fontSize: 14,
            fontFamily: "'Cinzel', serif", letterSpacing: "0.06em", transition: "all 0.2s",
          }}>
            {resultCopied ? "✓  COPIED!" : "📋  SHARE MY RANKING"}
          </button>
          <a href="/blindrank" style={{ display: "block", textAlign: "center", color: "#444", fontSize: 13, textDecoration: "none", padding: 10 }}>
            ← Create a new ranking
          </a>
        </div>
      </div>
    </div>
  );

  // ─── Game view ────────────────────────────────────────────────────────────
  const pct = (placedCount / total) * 100;
  const SLOT_H = Math.max(52, Math.min(68, Math.floor(380 / Math.max(total, 1))));

  return (
    <div
      style={{ minHeight: "100vh", background: "#0d0d0d", color: "#e8dcc8", padding: "16px 20px", userSelect: "none", fontFamily: "var(--font-geist-sans, sans-serif)", touchAction: isDragging ? "none" : "auto" }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <style>{`
        @keyframes br-lock-in {
          0%   { transform: scale(1.04); box-shadow: 0 0 20px rgba(212,169,66,0.5); }
          100% { transform: scale(1);    box-shadow: none; }
        }
        @keyframes br-reveal-pulse {
          0%,100% { box-shadow: 0 0 16px rgba(212,169,66,0.2); }
          50%     { box-shadow: 0 0 32px rgba(212,169,66,0.5); }
        }
        @keyframes br-card-in {
          from { opacity: 0; transform: translateY(-12px) scale(0.95); }
          to   { opacity: 1; transform: none; }
        }
        .br-reveal-btn:hover { transform: scale(1.04) !important; }
        .br-reveal-btn:active { transform: scale(0.97) !important; }
        .br-slot-empty { transition: background 0.15s, border-color 0.15s; }
        .br-slot-empty:hover { border-color: #333 !important; }
      `}</style>

      <div style={{ maxWidth: 700, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <a href="/blindrank" style={{ textDecoration: "none" }}>
            <h1 style={{ fontFamily: "'Cinzel', serif", fontSize: "clamp(18px,5vw,26px)", fontWeight: 900, letterSpacing: "0.1em", background: "linear-gradient(135deg,#d4a942,#fff,#d4a942)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0 }}>
              BL!NDR4NK
            </h1>
          </a>
          <div style={{ textAlign: "right" }}>
            <p style={{ color: "#a89878", margin: 0, fontSize: 13 }}>{gameData.topic}</p>
            <p style={{ color: "#444", margin: "2px 0 0", fontSize: 11 }}>{placedCount} of {total} placed</p>
          </div>
        </div>

        {/* Progress */}
        <div style={{ height: 3, background: "#1a1a1a", borderRadius: 2, marginBottom: 22, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#d4a942,#c4531a)", borderRadius: 2, transition: "width 0.5s cubic-bezier(0.34,1.56,0.64,1)" }} />
        </div>

        {/* Two-column layout */}
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>

          {/* ── LEFT: Ranked slots ── */}
          <div style={{ flex: "1 1 200px", minWidth: 180, display: "flex", flexDirection: "column", gap: 6 }}>
            <p style={{ color: "#333", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", margin: "0 0 6px" }}>
              Ranking
            </p>
            {slots.map((item, i) => {
              const empty    = item === null;
              const isHover  = hoverSlot === i && isDragging && empty;
              const isLocked = justPlaced === i;
              return (
                <div
                  key={i}
                  ref={el => { slotRefs.current[i] = el; }}
                  className={empty ? "br-slot-empty" : ""}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    height: SLOT_H,
                    background: isHover
                      ? "rgba(212,169,66,0.12)"
                      : empty ? "#111" : "#161616",
                    border: `1.5px solid ${isHover ? "#d4a942" : empty ? "#1e1e1e" : isLocked ? "#d4a942" : "#262626"}`,
                    borderRadius: 10,
                    padding: "0 14px",
                    transition: "border-color 0.15s, background 0.15s",
                    animation: isLocked ? "br-lock-in 0.4s ease" : undefined,
                    boxShadow: isHover ? "0 0 14px rgba(212,169,66,0.2)" : "none",
                  }}
                >
                  {/* Rank badge */}
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                    background: !empty && i === 0 ? "linear-gradient(135deg,#d4a942,#c4531a)" : empty ? "#1a1a1a" : "#222",
                    border: empty ? "1px dashed #2a2a2a" : "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700,
                    color: !empty && i === 0 ? "#000" : "#555",
                    fontFamily: "'Cinzel', serif",
                    transition: "background 0.3s",
                  }}>
                    {i + 1}
                  </div>

                  {/* AI image */}
                  {gameData.useImages && item && (
                    <img src={`https://image.pollinations.ai/prompt/${encodeURIComponent(item.text + " vibrant digital art")}?width=80&height=80&nologo=true&seed=1`}
                      alt={item.text} style={{ width: 36, height: 36, borderRadius: 5, objectFit: "cover", flexShrink: 0 }} loading="lazy" />
                  )}

                  {/* Text or empty state */}
                  {empty ? (
                    <span style={{ flex: 1, fontSize: 12, color: isHover ? "rgba(212,169,66,0.6)" : "#2a2a2a", fontStyle: "italic" }}>
                      {isHover ? "drop here" : "—"}
                    </span>
                  ) : (
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: i === 0 ? "#d4a942" : "#ccc", lineHeight: 1.2 }}>
                      {item.text}
                    </span>
                  )}

                  {/* Lock icon on filled */}
                  {!empty && (
                    <span style={{ fontSize: 11, color: "#333", flexShrink: 0 }}>🔒</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── RIGHT: Staged item + reveal ── */}
          <div style={{ flex: "0 0 200px", minWidth: 180, display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
            <p style={{ color: "#333", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", margin: "0 0 0", alignSelf: "flex-start" }}>
              Current item
            </p>

            {/* Staged item card */}
            {staged ? (
              <div
                onPointerDown={handleDragStart}
                style={{
                  width: "100%",
                  minHeight: 110,
                  background: isDragging ? "rgba(212,169,66,0.07)" : "#181818",
                  border: `2px solid ${isDragging ? "rgba(212,169,66,0.4)" : "#d4a942"}`,
                  borderRadius: 12,
                  padding: "18px 16px",
                  cursor: isDragging ? "grabbing" : "grab",
                  opacity: isDragging ? 0.4 : 1,
                  display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start",
                  gap: 10,
                  touchAction: "none",
                  animation: "br-card-in 0.3s cubic-bezier(0.34,1.56,0.64,1)",
                  boxShadow: isDragging ? "none" : "0 0 20px rgba(212,169,66,0.12)",
                  transition: "opacity 0.15s, border-color 0.15s",
                  userSelect: "none",
                }}
              >
                {gameData.useImages && (
                  <img src={`https://image.pollinations.ai/prompt/${encodeURIComponent(staged.text + " vibrant digital art")}?width=200&height=120&nologo=true&seed=1`}
                    alt={staged.text} style={{ width: "100%", height: 80, borderRadius: 7, objectFit: "cover" }} loading="lazy" />
                )}
                <span style={{ fontSize: 16, fontWeight: 700, color: "#e8dcc8", lineHeight: 1.3 }}>{staged.text}</span>
                <span style={{ fontSize: 11, color: "#555", letterSpacing: "0.06em" }}>drag to a slot →</span>
              </div>
            ) : (
              <div style={{
                width: "100%", minHeight: 110,
                background: "#0f0f0f",
                border: "2px dashed #1e1e1e",
                borderRadius: 12,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexDirection: "column", gap: 8,
              }}>
                <span style={{ fontSize: 28, filter: "grayscale(1) opacity(0.3)" }}>🃏</span>
                <span style={{ fontSize: 11, color: "#2a2a2a" }}>
                  {isComplete ? "all placed" : "reveal next"}
                </span>
              </div>
            )}

            {/* Reveal button */}
            {canReveal && (
              <button
                className="br-reveal-btn"
                onClick={handleReveal}
                style={{
                  width: "100%",
                  background: "linear-gradient(135deg,#d4a942,#c4531a)",
                  color: "#000", border: "none", borderRadius: 10,
                  padding: "13px 0", fontSize: 14, fontWeight: 900,
                  fontFamily: "'Cinzel', serif", letterSpacing: "0.08em",
                  cursor: "pointer",
                  animation: !staged ? "br-reveal-pulse 2s ease-in-out infinite" : "none",
                  transition: "transform 0.12s",
                }}
              >
                {revealIndex === 0 ? "▶  START" : "▶  REVEAL NEXT"}
              </button>
            )}

            {/* Must-place hint */}
            {staged && (
              <p style={{ color: "#444", fontSize: 11, textAlign: "center", margin: 0 }}>
                Place this item before revealing the next
              </p>
            )}

            {/* Lock in button */}
            {isComplete && !staged && (
              <button onClick={handleSubmit} style={{
                width: "100%",
                background: "linear-gradient(135deg,#2d5a27,#3a8a34)",
                color: "#a8e4a0", border: "1px solid #4a8a44", borderRadius: 10,
                padding: "13px 0", fontSize: 14, fontWeight: 800,
                fontFamily: "'Cinzel', serif", letterSpacing: "0.06em", cursor: "pointer",
                boxShadow: "0 0 18px rgba(90,154,84,0.2)",
              }}>
                ✓  LOCK IN
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Ghost card following cursor */}
      {isDragging && dragPos && staged && (
        <div style={{
          position: "fixed",
          left: dragPos.x - 110, top: dragPos.y - 40,
          zIndex: 9999, pointerEvents: "none",
          width: 220,
          background: "#1c1c1c",
          border: "2px solid #d4a942",
          borderRadius: 10,
          padding: "12px 14px",
          opacity: 0.93,
          transform: "rotate(2deg) scale(1.04)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.6), 0 0 20px rgba(212,169,66,0.2)",
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#e8dcc8" }}>{staged.text}</span>
        </div>
      )}
    </div>
  );
}
