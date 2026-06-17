"use client";
import { useState, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";

interface Item { id: string; text: string; }
interface Props {
  sessionId: string;
  topic: string;
  items: string[];
  useImages: boolean;
  createdBy: string | null;
  username: string | null;
}

// ─── Sound Engine ─────────────────────────────────────────────────────────────
function makeSounds() {
  let ctx: AudioContext | null = null;
  const get = () => {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  };
  const note = (freq: number, t: number, dur: number, vol = 0.2, type: OscillatorType = "sine") => {
    const c = get(); const osc = c.createOscillator(); const g = c.createGain();
    osc.connect(g); g.connect(c.destination); osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t); osc.stop(t + dur);
  };
  return {
    reveal() { try { const c = get(); const t = c.currentTime; [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => note(f, t + i * 0.075, 0.4, 0.18)); } catch {} },
    drop()   { try { const c = get(); const t = c.currentTime; note(320, t, 0.06, 0.28); note(160, t + 0.04, 0.18, 0.2); note(880, t, 0.07, 0.09, "triangle"); } catch {} },
    tick()   { try { const c = get(); note(800, c.currentTime, 0.04, 0.06, "triangle"); } catch {} },
    complete() { try { const c = get(); const t = c.currentTime; [261.63, 329.63, 392, 523.25, 659.25, 783.99, 1046.50].forEach((f, i) => note(f, t + i * 0.11, 0.7, 0.17, "triangle")); } catch {} },
  };
}

export default function BlindRankGameClient({ sessionId, topic, items, useImages, createdBy, username }: Props) {
  const router = useRouter();
  const sound = useMemo(() => typeof window !== "undefined" ? makeSounds() : null, []);

  // Shuffle client-side so each player gets a different reveal order
  const shuffled = useMemo<Item[]>(() =>
    [...items].sort(() => Math.random() - 0.5).map((text, i) => ({ id: `i${i}`, text }))
  , [items]);

  const total = shuffled.length;
  const [slots, setSlots]             = useState<(Item | null)[]>(() => new Array(total).fill(null));
  const [staged, setStaged]           = useState<Item | null>(null);
  const [revealIndex, setRevealIndex] = useState(0);
  const [justPlaced, setJustPlaced]   = useState<number | null>(null);

  // Submit modal state
  const [showModal, setShowModal]     = useState(false);
  const [rankerName, setRankerName]   = useState(username ?? "");
  const [submitting, setSubmitting]   = useState(false);

  // Drag state
  const [isDragging, setIsDragging]   = useState(false);
  const [dragPos, setDragPos]         = useState<{x: number; y: number} | null>(null);
  const [hoverSlot, setHoverSlot]     = useState<number | null>(null);
  const slotRefs  = useRef<(HTMLDivElement | null)[]>([]);
  const lastHover = useRef<number | null>(null);

  const placedCount = slots.filter(Boolean).length;
  const isComplete  = placedCount === total && total > 0;
  const canReveal   = !staged && revealIndex < total;

  const handleReveal = useCallback(() => {
    if (!canReveal) return;
    sound?.reveal();
    setStaged(shuffled[revealIndex]);
    setRevealIndex(p => p + 1);
  }, [canReveal, shuffled, revealIndex, sound]);

  const handleDragStart = useCallback((e: React.PointerEvent) => {
    if (!staged) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
    setDragPos({ x: e.clientX, y: e.clientY });
  }, [staged]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    setDragPos({ x: e.clientX, y: e.clientY });
    let best: number | null = null; let bestDist = Infinity;
    slotRefs.current.forEach((ref, i) => {
      if (!ref || slots[i] !== null) return;
      const r = ref.getBoundingClientRect();
      const inBounds = e.clientX > r.left - 20 && e.clientX < r.right + 20 && e.clientY > r.top - 20 && e.clientY < r.bottom + 20;
      if (inBounds) { const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)); if (d < bestDist) { bestDist = d; best = i; } }
    });
    if (best !== lastHover.current) { lastHover.current = best; setHoverSlot(best); if (best !== null) sound?.tick(); }
  }, [isDragging, slots, sound]);

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
    setHoverSlot(null); lastHover.current = null;
  }, [isDragging, staged, hoverSlot, slots, sound]);

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    sound?.complete();
    try {
      await fetch("/api/blindrank/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          ranking: slots.map(s => s?.text ?? ""),
          rankerName: rankerName.trim() || null,
        }),
      });
      router.push(`/blindrank/results/${sessionId}`);
    } catch {
      setSubmitting(false);
    }
  };

  const SLOT_H = Math.max(50, Math.min(68, Math.floor(360 / Math.max(total, 1))));

  return (
    <div
      style={{ minHeight: "100vh", background: "#0d0d0d", color: "#e8dcc8", padding: "16px 20px", userSelect: "none", fontFamily: "var(--font-geist-sans, sans-serif)", touchAction: isDragging ? "none" : "auto" }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <style>{`
        @keyframes br-lock-in { 0% { transform:scale(1.04); box-shadow:0 0 20px rgba(212,169,66,0.5); } 100% { transform:scale(1); box-shadow:none; } }
        @keyframes br-pulse { 0%,100% { box-shadow:0 0 14px rgba(212,169,66,0.2); } 50% { box-shadow:0 0 28px rgba(212,169,66,0.5); } }
        @keyframes br-card-in { from { opacity:0; transform:translateY(-12px) scale(0.95); } to { opacity:1; transform:none; } }
        .br-btn:hover { transform:scale(1.04) !important; } .br-btn:active { transform:scale(0.97) !important; }
      `}</style>

      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <a href="/blindrank" style={{ textDecoration: "none" }}>
            <h1 style={{ fontFamily: "'Cinzel', serif", fontSize: "clamp(18px,5vw,26px)", fontWeight: 900, letterSpacing: "0.1em", background: "linear-gradient(135deg,#d4a942,#fff,#d4a942)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0 }}>
              BL!NDR4NK
            </h1>
          </a>
          <div style={{ textAlign: "right" }}>
            <p style={{ color: "#a89878", margin: 0, fontSize: 13 }}>{topic}</p>
            <p style={{ color: "#444", margin: "2px 0 0", fontSize: 11 }}>
              {createdBy && createdBy !== "anonymous" ? `by ${createdBy} · ` : ""}{placedCount}/{total} placed
            </p>
          </div>
        </div>
        {/* Progress */}
        <div style={{ height: 3, background: "#1a1a1a", borderRadius: 2, marginBottom: 20, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(placedCount / total) * 100}%`, background: "linear-gradient(90deg,#d4a942,#c4531a)", borderRadius: 2, transition: "width 0.5s cubic-bezier(0.34,1.56,0.64,1)" }} />
        </div>

        {/* Two-column layout */}
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>

          {/* LEFT: Rank slots */}
          <div style={{ flex: "1 1 200px", minWidth: 180 }}>
            <p style={{ color: "#333", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", margin: "0 0 8px" }}>Ranking</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {slots.map((item, i) => {
                const empty   = item === null;
                const isHover = hoverSlot === i && isDragging && empty;
                const isLocked = justPlaced === i;
                return (
                  <div key={i} ref={el => { slotRefs.current[i] = el; }} style={{
                    display: "flex", alignItems: "center", gap: 10, height: SLOT_H,
                    background: isHover ? "rgba(212,169,66,0.1)" : empty ? "#0f0f0f" : "#161616",
                    border: `1.5px solid ${isHover ? "#d4a942" : empty ? "#1a1a1a" : isLocked ? "#d4a942" : "#242424"}`,
                    borderRadius: 10, padding: "0 14px",
                    transition: "border-color 0.15s, background 0.15s",
                    animation: isLocked ? "br-lock-in 0.4s ease" : undefined,
                    boxShadow: isHover ? "0 0 12px rgba(212,169,66,0.15)" : "none",
                  }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                      background: !empty && i === 0 ? "linear-gradient(135deg,#d4a942,#c4531a)" : empty ? "#141414" : "#1e1e1e",
                      border: empty ? "1px dashed #252525" : "none",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 700, color: !empty && i === 0 ? "#000" : "#444",
                      fontFamily: "'Cinzel', serif",
                    }}>{i + 1}</div>

                    {gameData_useImages(useImages, item) && (
                      <img src={`https://image.pollinations.ai/prompt/${encodeURIComponent(item!.text + " vibrant digital art")}?width=80&height=80&nologo=true&seed=1`}
                        alt={item!.text} style={{ width: 34, height: 34, borderRadius: 5, objectFit: "cover", flexShrink: 0 }} loading="lazy" />
                    )}

                    {empty ? (
                      <span style={{ flex: 1, fontSize: 12, color: isHover ? "rgba(212,169,66,0.6)" : "#222", fontStyle: "italic" }}>
                        {isHover ? "drop here" : "—"}
                      </span>
                    ) : (
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: i === 0 ? "#d4a942" : "#ccc", lineHeight: 1.2 }}>{item!.text}</span>
                    )}
                    {!empty && <span style={{ fontSize: 10, color: "#2a2a2a", flexShrink: 0 }}>🔒</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: Staged item + controls */}
          <div style={{ flex: "0 0 190px", minWidth: 170, display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
            <p style={{ color: "#333", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", margin: 0, alignSelf: "flex-start" }}>Current item</p>

            {staged ? (
              <div onPointerDown={handleDragStart} style={{
                width: "100%", minHeight: 100,
                background: isDragging ? "rgba(212,169,66,0.06)" : "#181818",
                border: `2px solid ${isDragging ? "rgba(212,169,66,0.3)" : "#d4a942"}`,
                borderRadius: 12, padding: "16px 14px",
                cursor: isDragging ? "grabbing" : "grab",
                opacity: isDragging ? 0.35 : 1,
                display: "flex", flexDirection: "column", justifyContent: "center", gap: 8,
                touchAction: "none",
                animation: "br-card-in 0.3s cubic-bezier(0.34,1.56,0.64,1)",
                boxShadow: isDragging ? "none" : "0 0 18px rgba(212,169,66,0.1)",
                transition: "opacity 0.15s",
              }}>
                {useImages && (
                  <img src={`https://image.pollinations.ai/prompt/${encodeURIComponent(staged.text + " vibrant digital art")}?width=200&height=100&nologo=true&seed=1`}
                    alt={staged.text} style={{ width: "100%", height: 70, borderRadius: 7, objectFit: "cover" }} loading="lazy" />
                )}
                <span style={{ fontSize: 15, fontWeight: 700, color: "#e8dcc8", lineHeight: 1.3 }}>{staged.text}</span>
                <span style={{ fontSize: 11, color: "#444", letterSpacing: "0.05em" }}>drag to a slot →</span>
              </div>
            ) : (
              <div style={{ width: "100%", minHeight: 100, background: "#0e0e0e", border: "2px dashed #1a1a1a", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 26, filter: "grayscale(1) opacity(0.25)" }}>🃏</span>
                <span style={{ fontSize: 11, color: "#252525" }}>{isComplete ? "all placed" : "reveal next"}</span>
              </div>
            )}

            {canReveal && (
              <button className="br-btn" onClick={handleReveal} style={{
                width: "100%", background: "linear-gradient(135deg,#d4a942,#c4531a)", color: "#000",
                border: "none", borderRadius: 10, padding: "13px 0", fontSize: 13, fontWeight: 900,
                fontFamily: "'Cinzel', serif", letterSpacing: "0.08em", cursor: "pointer",
                animation: !staged ? "br-pulse 2s ease-in-out infinite" : "none", transition: "transform 0.12s",
              }}>
                {revealIndex === 0 ? "▶  START" : "▶  REVEAL NEXT"}
              </button>
            )}

            {staged && <p style={{ color: "#3a3a3a", fontSize: 11, textAlign: "center", margin: 0 }}>Place this before revealing next</p>}

            {isComplete && !staged && (
              <button onClick={() => setShowModal(true)} style={{
                width: "100%", background: "linear-gradient(135deg,#2d5a27,#3a8a34)", color: "#a8e4a0",
                border: "1px solid #4a8a44", borderRadius: 10, padding: "13px 0", fontSize: 13,
                fontWeight: 800, fontFamily: "'Cinzel', serif", letterSpacing: "0.06em", cursor: "pointer",
                boxShadow: "0 0 16px rgba(90,154,84,0.2)",
              }}>
                ✓  LOCK IN
              </button>
            )}

            <a href={`/blindrank/results/${sessionId}`} style={{ color: "#2a2a2a", fontSize: 11, textAlign: "center", textDecoration: "none" }}>
              View results feed →
            </a>
          </div>
        </div>
      </div>

      {/* Ghost */}
      {isDragging && dragPos && staged && (
        <div style={{
          position: "fixed", left: dragPos.x - 105, top: dragPos.y - 36,
          zIndex: 9999, pointerEvents: "none", width: 210,
          background: "#1c1c1c", border: "2px solid #d4a942", borderRadius: 10, padding: "11px 14px",
          opacity: 0.93, transform: "rotate(2deg) scale(1.04)",
          boxShadow: "0 14px 44px rgba(0,0,0,0.6), 0 0 18px rgba(212,169,66,0.18)",
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#e8dcc8" }}>{staged.text}</span>
        </div>
      )}

      {/* Submit modal */}
      {showModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div style={{
            background: "#141414", border: "1px solid #d4a942", borderRadius: 16,
            padding: 28, maxWidth: 380, width: "100%",
            boxShadow: "0 0 60px rgba(212,169,66,0.12)",
          }}>
            <h2 style={{ fontFamily: "'Cinzel', serif", color: "#d4a942", fontSize: 18, margin: "0 0 6px", fontWeight: 700 }}>
              Lock it in?
            </h2>
            <p style={{ color: "#a89878", fontSize: 13, margin: "0 0 20px" }}>
              Once submitted your ranking goes to the results feed. You can't change it.
            </p>
            <label style={{ display: "block", color: "#555", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
              Your name (optional)
            </label>
            <input
              value={rankerName}
              onChange={e => setRankerName(e.target.value)}
              placeholder="Anonymous"
              maxLength={40}
              style={{
                width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8,
                padding: "10px 14px", color: "#e8dcc8", fontSize: 15, outline: "none", boxSizing: "border-box",
                marginBottom: 16, fontFamily: "inherit",
              }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowModal(false)} style={{
                flex: 1, background: "transparent", border: "1px solid #333", borderRadius: 8,
                padding: "11px", color: "#666", cursor: "pointer", fontSize: 13,
              }}>
                Go back
              </button>
              <button onClick={handleSubmit} disabled={submitting} style={{
                flex: 2, background: "linear-gradient(135deg,#d4a942,#c4531a)", color: "#000",
                border: "none", borderRadius: 8, padding: "11px", fontSize: 14, fontWeight: 800,
                fontFamily: "'Cinzel', serif", cursor: submitting ? "wait" : "pointer", letterSpacing: "0.06em",
              }}>
                {submitting ? "Submitting…" : "SUBMIT →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function gameData_useImages(useImages: boolean, item: Item | null): item is Item {
  return useImages && item !== null;
}
