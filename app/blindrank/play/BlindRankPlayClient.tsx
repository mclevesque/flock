"use client";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";

interface Item { id: string; text: string; }
interface GameData { topic: string; items: string[]; useImages: boolean; createdBy?: string; result?: string[]; }

// ─── Sound Engine (Web Audio API) ────────────────────────────────────────────
function makeSounds() {
  let ctx: AudioContext | null = null;
  const get = () => {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  };
  const note = (freq: number, t: number, dur: number, vol = 0.22, type: OscillatorType = "sine") => {
    const c = get();
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.connect(g); g.connect(c.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t); osc.stop(t + dur);
  };
  return {
    reveal() {
      try {
        const c = get();
        const t = c.currentTime;
        [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => note(f, t + i * 0.075, 0.4, 0.18));
      } catch {}
    },
    drop() {
      try {
        const c = get(); const t = c.currentTime;
        note(320, t, 0.06, 0.28, "sine");
        note(160, t + 0.04, 0.15, 0.22, "sine");
        note(880, t, 0.08, 0.1, "triangle");
      } catch {}
    },
    tick() {
      try {
        const c = get();
        note(900, c.currentTime, 0.04, 0.06, "triangle");
      } catch {}
    },
    complete() {
      try {
        const c = get(); const t = c.currentTime;
        [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50].forEach((f, i) =>
          note(f, t + i * 0.11, 0.7, 0.18, "triangle"));
      } catch {}
    },
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BlindRankPlayClient() {
  const params = useSearchParams();

  const gameData = useMemo<GameData | null>(() => {
    const d = params.get("d");
    if (!d) return null;
    try { return JSON.parse(decodeURIComponent(atob(d))); }
    catch { return null; }
  }, [params]);

  const allItems = useMemo<Item[]>(() =>
    gameData?.items.map((text, i) => ({ id: `item-${i}`, text })) ?? []
  , [gameData]);

  const sound = useMemo(() => typeof window !== "undefined" ? makeSounds() : null, []);

  // Pre-populate from result if the link is a shared result
  const savedResult = useMemo<Item[] | null>(() => {
    if (!gameData?.result) return null;
    return gameData.result.map((text, i) => ({ id: `item-${i}`, text }));
  }, [gameData]);

  // ── Game state ──
  const [ranked, setRanked]             = useState<Item[]>(() => savedResult ?? []);
  const [revealIndex, setRevealIndex]   = useState(() => savedResult ? (gameData?.items.length ?? 0) : 0);
  const [justRevealedId, setJustRevId]  = useState<string | null>(null);
  const [isRevealing, setIsRevealing]   = useState(false);
  const [submitted, setSubmitted]       = useState(() => !!savedResult);
  const [resultCopied, setResultCopied] = useState(false);

  // ── Drag state ──
  const [dragIdx, setDragIdx]     = useState<number | null>(null);
  const [dragPos, setDragPos]     = useState<{ x: number; y: number } | null>(null);
  const [dropZone, setDropZone]   = useState<number | null>(null);
  const itemRefs  = useRef<(HTMLDivElement | null)[]>([]);
  const lastZone  = useRef<number | null>(null);
  const capturedId = useRef<number | null>(null);

  const total      = allItems.length;
  const canReveal  = revealIndex < total && !isRevealing;
  const isComplete = ranked.length === total && total > 0;

  // ── Reveal ──
  const handleReveal = useCallback(() => {
    if (!canReveal) return;
    setIsRevealing(true);
    sound?.reveal();
    const item = allItems[revealIndex];
    setTimeout(() => {
      setRanked(p => [...p, item]);
      setRevealIndex(p => p + 1);
      setJustRevId(item.id);
      setIsRevealing(false);
      setTimeout(() => setJustRevId(null), 2800);
    }, 120);
  }, [canReveal, allItems, revealIndex, sound]);

  // ── Drag: start ──
  const handlePointerDown = useCallback((e: React.PointerEvent, idx: number) => {
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    capturedId.current = e.pointerId;
    setDragIdx(idx);
    setDragPos({ x: e.clientX, y: e.clientY });
    lastZone.current = null;
  }, []);

  // ── Drag: move (on the list wrapper) ──
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (dragIdx === null) return;
    setDragPos({ x: e.clientX, y: e.clientY });

    let zone = ranked.length;
    for (let i = 0; i < itemRefs.current.length; i++) {
      const ref = itemRefs.current[i];
      if (!ref) continue;
      const rect = ref.getBoundingClientRect();
      if (e.clientY < rect.top + rect.height * 0.5) { zone = i; break; }
    }
    if (zone !== lastZone.current) {
      lastZone.current = zone;
      setDropZone(zone);
      sound?.tick();
    }
  }, [dragIdx, ranked.length, sound]);

  // ── Drag: end ──
  const handlePointerUp = useCallback(() => {
    if (dragIdx === null) { setDragPos(null); setDropZone(null); return; }
    const target = dropZone ?? ranked.length;
    const isSameSlot = target === dragIdx || target === dragIdx + 1;
    if (!isSameSlot) {
      setRanked(prev => {
        const arr = [...prev];
        const [moved] = arr.splice(dragIdx, 1);
        const at = target > dragIdx ? target - 1 : target;
        arr.splice(at, 0, moved);
        return arr;
      });
      sound?.drop();
    }
    setDragIdx(null);
    setDragPos(null);
    setDropZone(null);
    lastZone.current = null;
    capturedId.current = null;
  }, [dragIdx, dropZone, ranked.length, sound]);

  const handleSubmit = () => { sound?.complete(); setSubmitted(true); };

  const copyResult = async () => {
    if (!gameData) return;
    const resultData: GameData = { ...gameData, result: ranked.map(i => i.text) };
    const encoded = btoa(encodeURIComponent(JSON.stringify(resultData)));
    await navigator.clipboard.writeText(`${window.location.origin}/blindrank/play?d=${encoded}`);
    setResultCopied(true);
    setTimeout(() => setResultCopied(false), 2500);
  };

  // ─── Error state ───
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

  // ─── Results view ───
  if (submitted) return (
    <div style={{ minHeight: "100vh", background: "#0d0d0d", color: "#e8dcc8", padding: 20, fontFamily: "var(--font-geist-sans, sans-serif)" }}>
      <style>{`@keyframes br-pop { from { opacity:0; transform:scale(0.92) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }`}</style>
      <div style={{ maxWidth: 540, margin: "0 auto" }}>
        <div style={{ textAlign: "center", paddingTop: 24, marginBottom: 32 }}>
          <h1 style={{ fontFamily: "'Cinzel', serif", fontSize: "clamp(22px,6vw,34px)", fontWeight: 900, background: "linear-gradient(135deg,#d4a942,#fff,#d4a942)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "0.1em", margin: 0 }}>
            YOUR RANKING
          </h1>
          <p style={{ color: "#a89878", marginTop: 6, fontSize: 14 }}>{gameData.topic}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 28 }}>
          {ranked.map((item, i) => (
            <div key={item.id} style={{
              display: "flex", alignItems: "center", gap: 14,
              background: i === 0 ? "rgba(212,169,66,0.1)" : "#141414",
              border: `1px solid ${i === 0 ? "#d4a942" : "#222"}`,
              borderRadius: 10, padding: "13px 16px",
              animation: `br-pop 0.3s ease ${i * 0.06}s both`,
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                background: i === 0 ? "linear-gradient(135deg,#d4a942,#c4531a)" : "#2a2a2a",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: i === 0 ? 13 : 12, fontWeight: 700,
                color: i === 0 ? "#000" : "#888", fontFamily: "'Cinzel', serif",
              }}>
                {i === 0 ? "👑" : i + 1}
              </div>
              {gameData.useImages && (
                <img
                  src={`https://image.pollinations.ai/prompt/${encodeURIComponent(item.text + " vibrant digital art")}?width=80&height=80&nologo=true&seed=1`}
                  alt={item.text}
                  style={{ width: 44, height: 44, borderRadius: 7, objectFit: "cover", flexShrink: 0 }}
                  loading="lazy"
                />
              )}
              <span style={{ flex: 1, fontSize: 15, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? "#d4a942" : "#e8dcc8" }}>
                {item.text}
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={copyResult} style={{
            background: resultCopied ? "rgba(90,154,84,0.12)" : "rgba(212,169,66,0.08)",
            border: `1px solid ${resultCopied ? "#5a9a54" : "#d4a942"}`,
            borderRadius: 10, padding: 14,
            color: resultCopied ? "#5a9a54" : "#d4a942",
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

  // ─── Game view ───
  const pct = (ranked.length / total) * 100;

  return (
    <div
      style={{ minHeight: "100vh", background: "#0d0d0d", color: "#e8dcc8", padding: 20, userSelect: "none", fontFamily: "var(--font-geist-sans, sans-serif)", touchAction: dragIdx !== null ? "none" : "auto" }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <style>{`
        @keyframes br-slide-in {
          from { opacity: 0; transform: translateY(-18px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)     scale(1); }
        }
        @keyframes br-glow-pulse {
          0%, 100% { box-shadow: 0 0 0 rgba(212,169,66,0); }
          50%       { box-shadow: 0 0 18px rgba(212,169,66,0.35); }
        }
        @keyframes br-reveal-btn {
          0%,100% { box-shadow: 0 0 18px rgba(212,169,66,0.2); }
          50%     { box-shadow: 0 0 36px rgba(212,169,66,0.5); }
        }
        .br-reveal:hover { transform: scale(1.03) !important; }
        .br-reveal:active { transform: scale(0.97) !important; }
      `}</style>

      <div style={{ maxWidth: 540, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", paddingTop: 12, marginBottom: 20 }}>
          <a href="/blindrank" style={{ textDecoration: "none" }}>
            <h1 style={{
              fontFamily: "'Cinzel', serif",
              fontSize: "clamp(22px, 7vw, 38px)",
              fontWeight: 900,
              letterSpacing: "0.1em",
              background: "linear-gradient(135deg, #d4a942 0%, #ffffff 55%, #d4a942 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              margin: 0,
            }}>BL!NDR4NK</h1>
          </a>
          <p style={{ color: "#a89878", margin: "5px 0 0", fontSize: 13 }}>
            {gameData.createdBy && gameData.createdBy !== "anonymous" ? `${gameData.createdBy} · ` : ""}
            {gameData.topic}
          </p>

          {/* Progress bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
            <div style={{ flex: 1, height: 4, background: "#1e1e1e", borderRadius: 2, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${pct}%`,
                background: "linear-gradient(90deg, #d4a942, #c4531a)",
                borderRadius: 2,
                transition: "width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }} />
            </div>
            <span style={{ color: "#555", fontSize: 12, whiteSpace: "nowrap" }}>
              {ranked.length} / {total}
            </span>
          </div>
        </div>

        {/* REVEAL button */}
        {canReveal && (
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <button
              className="br-reveal"
              onClick={handleReveal}
              style={{
                background: "linear-gradient(135deg, #d4a942 0%, #c4531a 100%)",
                color: "#000",
                border: "none",
                borderRadius: 14,
                padding: "17px 44px",
                fontSize: 17,
                fontWeight: 900,
                fontFamily: "'Cinzel', serif",
                letterSpacing: "0.1em",
                cursor: "pointer",
                animation: "br-reveal-btn 2s ease-in-out infinite",
                transition: "transform 0.12s",
              }}
            >
              {ranked.length === 0 ? "▶  START" : "▶  REVEAL NEXT"}
            </button>
            {ranked.length > 0 && (
              <p style={{ color: "#444", fontSize: 12, marginTop: 8 }}>
                {total - revealIndex} item{total - revealIndex !== 1 ? "s" : ""} remaining
              </p>
            )}
          </div>
        )}

        {/* Lock in button */}
        {isComplete && (
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <p style={{ color: "#666", fontSize: 12, marginBottom: 10 }}>
              All {total} items revealed — drag to finalize, then lock in
            </p>
            <button
              onClick={handleSubmit}
              style={{
                background: "linear-gradient(135deg, #2d5a27, #3a8a34)",
                color: "#a8e4a0",
                border: "1px solid #4a8a44",
                borderRadius: 12,
                padding: "14px 36px",
                fontSize: 15,
                fontWeight: 800,
                fontFamily: "'Cinzel', serif",
                letterSpacing: "0.08em",
                cursor: "pointer",
                boxShadow: "0 0 20px rgba(90,154,84,0.2)",
              }}
            >
              ✓  LOCK IN RANKING
            </button>
          </div>
        )}

        {/* Ranked list */}
        {ranked.length > 0 && (
          <div>
            <p style={{ color: "#333", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>
              Your ranking — drag to reorder
            </p>

            <div style={{ display: "flex", flexDirection: "column" }}>
              {/* Drop zone above first item */}
              {dragIdx !== null && (
                <div style={{ height: dropZone === 0 ? 4 : 3, background: dropZone === 0 ? "#d4a942" : "transparent", borderRadius: 2, margin: "1px 0", transition: "all 0.1s" }} />
              )}

              {ranked.map((item, i) => {
                const isDragging = dragIdx === i;
                const isNew      = justRevealedId === item.id;
                return (
                  <div key={item.id}>
                    <div
                      ref={el => { itemRefs.current[i] = el; }}
                      onPointerDown={e => handlePointerDown(e, i)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        background: isNew ? "rgba(212,169,66,0.1)" : isDragging ? "rgba(255,255,255,0.03)" : "#141414",
                        border: `1px solid ${isNew ? "#d4a942" : isDragging ? "rgba(212,169,66,0.15)" : "#1e1e1e"}`,
                        borderRadius: 10,
                        padding: "11px 14px",
                        cursor: dragIdx !== null ? "grabbing" : "grab",
                        opacity: isDragging ? 0.25 : 1,
                        marginBottom: 3,
                        transition: "background 0.35s, border 0.35s, opacity 0.12s",
                        animation: isNew ? "br-slide-in 0.35s cubic-bezier(0.34,1.56,0.64,1), br-glow-pulse 1.2s ease 0.3s 2" : undefined,
                        touchAction: "none",
                      }}
                    >
                      {/* Rank badge */}
                      <div style={{
                        width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                        background: i === 0 ? "linear-gradient(135deg,#d4a942,#c4531a)" : "#222",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700,
                        color: i === 0 ? "#000" : "#666",
                        fontFamily: "'Cinzel', serif",
                        transition: "background 0.3s",
                      }}>
                        {i + 1}
                      </div>

                      {/* AI image */}
                      {gameData.useImages && (
                        <img
                          src={`https://image.pollinations.ai/prompt/${encodeURIComponent(item.text + " vibrant digital art")}?width=80&height=80&nologo=true&seed=1`}
                          alt={item.text}
                          style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
                          loading="lazy"
                        />
                      )}

                      {/* Name */}
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: isNew ? "#d4a942" : "#d8cdb8", transition: "color 0.5s", lineHeight: 1.3 }}>
                        {item.text}
                      </span>

                      {/* NEW badge */}
                      {isNew && (
                        <span style={{ fontSize: 9, fontWeight: 800, color: "#d4a942", border: "1px solid #d4a942", borderRadius: 4, padding: "2px 5px", letterSpacing: "0.1em", flexShrink: 0 }}>
                          NEW
                        </span>
                      )}

                      {/* Drag grip */}
                      <div style={{ color: "#2e2e2e", fontSize: 16, flexShrink: 0, lineHeight: 1, letterSpacing: "-1px" }}>⠿</div>
                    </div>

                    {/* Drop zone below item */}
                    {dragIdx !== null && (
                      <div style={{ height: dropZone === i + 1 ? 4 : 3, background: dropZone === i + 1 ? "#d4a942" : "transparent", borderRadius: 2, margin: "1px 0", transition: "all 0.1s" }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {ranked.length === 0 && (
          <div style={{ textAlign: "center", padding: "52px 20px", color: "#2a2a2a" }}>
            <div style={{ fontSize: 44, marginBottom: 14, filter: "grayscale(1)" }}>🃏</div>
            <p style={{ margin: 0, fontSize: 14 }}>Hit START to reveal your first item</p>
          </div>
        )}
      </div>

      {/* Ghost card while dragging */}
      {dragIdx !== null && dragPos && ranked[dragIdx] && (
        <div style={{
          position: "fixed",
          left: dragPos.x - 170,
          top: dragPos.y - 26,
          zIndex: 9999,
          pointerEvents: "none",
          width: 340,
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "#1a1a1a",
          border: "1px solid #d4a942",
          borderRadius: 10,
          padding: "11px 14px",
          opacity: 0.92,
          transform: "rotate(1.8deg) scale(1.03)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.6), 0 0 24px rgba(212,169,66,0.18)",
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
            background: dragIdx === 0 ? "linear-gradient(135deg,#d4a942,#c4531a)" : "#222",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700,
            color: dragIdx === 0 ? "#000" : "#666",
            fontFamily: "'Cinzel', serif",
          }}>
            {dragIdx + 1}
          </div>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "#e8dcc8" }}>
            {ranked[dragIdx].text}
          </span>
        </div>
      )}
    </div>
  );
}
