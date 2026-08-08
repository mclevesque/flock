"use client";

/**
 * The opening cinematic: a cold egg in the ash → three stokes, with the fire
 * growing louder and brighter each time → the keeper speaks to it → it hatches.
 *
 * Deliberately almost wordless. One line of prompt, one button. Everything else
 * is the fire.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useFireSound } from "./useFireSound";

const GOLD = "#d4a942";
const DIM = "#8a6d2b";
const INK = "#0d0d0d";
const TEXT = "#e8dcc8";

type Phase = "egg" | "speak" | "hatching" | "reveal";

export interface HatchedCreature {
  id: string; name: string; species: string; description: string;
  sprite: string; rarity: string; rarityColor: string;
  element: string; temperament: string; appearance: string;
  imageUrl: string | null;
}

export default function HatchScene({
  initialStokes,
  hasEgg,
  onDone,
}: {
  initialStokes: number;
  hasEgg: boolean;
  onDone: () => void;
}) {
  const fire = useFireSound();

  const [phase, setPhase] = useState<Phase>("egg");
  const [stokes, setStokes] = useState(initialStokes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [whisper, setWhisper] = useState("");
  const [creature, setCreature] = useState<HatchedCreature | null>(null);
  const [portrait, setPortrait] = useState<string | null>(null);
  const [portraitPending, setPortraitPending] = useState(false);
  const [name, setName] = useState("");
  const [beat, setBeat] = useState(0);          // hatching cinematic step
  const [flash, setFlash] = useState(false);
  const eggReady = stokes >= 3;
  const laidRef = useRef(hasEgg);

  const intensity = Math.min(1, stokes / 3);

  // Drive the audio bed from the visual intensity.
  useEffect(() => { fire.setIntensity(intensity); }, [intensity, fire]);

  // If they already stoked in a previous session, skip ahead.
  useEffect(() => {
    if (initialStokes >= 3) setPhase("speak");
  }, [initialStokes]);

  const post = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch("/api/emberkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  }, []);

  // ── Stoke ────────────────────────────────────────────────────────────────
  const stoke = useCallback(async () => {
    if (busy || eggReady) return;
    setBusy(true);
    setError("");

    fire.start();          // first click is the gesture that unlocks audio
    fire.roar(0.6 + stokes * 0.25);

    try {
      if (!laidRef.current) {
        const laid = await post({ action: "lay" });
        // A pre-existing egg is fine — just carry on and stoke it.
        if (!laid.ok && !String(laid.data?.error ?? "").includes("already")) {
          setError(laid.data?.error ?? "The ash won't take."); return;
        }
        laidRef.current = true;
      }

      const { ok, data } = await post({ action: "stoke" });
      if (!ok) { setError(data?.error ?? "That didn't work."); return; }

      setStokes(data.stokes ?? stokes + 1);
      if (data.canHatch) setTimeout(() => setPhase("speak"), 900);
    } finally {
      setBusy(false);
    }
  }, [busy, eggReady, stokes, post, fire]);

  // ── Speak + hatch ────────────────────────────────────────────────────────
  const hatch = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError("");

    setPhase("hatching");
    setBeat(0);
    fire.roar(1.6);

    // Beat 1 immediately, beat 2 at 2.6s. The request runs underneath.
    const t = setTimeout(() => { setBeat(1); fire.roar(1.2); }, 2600);

    const { ok, data } = await post({ action: "hatch", whisper: whisper.trim() });
    clearTimeout(t);

    if (!ok) {
      setError(data?.error ?? "It won't open.");
      setPhase("speak");
      setBusy(false);
      return;
    }

    // Let the cinematic finish even if the API came back fast.
    setBeat(1);
    setTimeout(() => {
      setFlash(true);
      fire.roar(2);
      setTimeout(() => {
        const c = data.creature as HatchedCreature;
        setCreature(c);
        setName(c.name);
        setPortrait(c.imageUrl ?? null);
        setPhase("reveal");
        setFlash(false);
        setBusy(false);
        fire.setIntensity(0.45);

        // Portrait generation takes 10–40s, so it arrives after the reveal.
        if (!c.imageUrl) {
          setPortraitPending(true);
          fetch("/api/emberkin/portrait", { method: "POST" })
            .then(r => r.json())
            .then(d => { if (d?.imageUrl) setPortrait(d.imageUrl); })
            .catch(() => {})
            .finally(() => setPortraitPending(false));
        }
      }, 700);
    }, 900);
  }, [busy, whisper, post, fire]);

  const finish = useCallback(async () => {
    const trimmed = name.trim();
    if (trimmed && creature && trimmed !== creature.name) {
      await post({ action: "rename", name: trimmed }).catch(() => {});
    }
    fire.stop();
    onDone();
  }, [name, creature, post, onDone, fire]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{
      position: "fixed", inset: 0, background: INK, overflow: "hidden",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <SceneStyles />

      {/* Heat glow behind everything, grows with the fire */}
      <div style={{
        position: "absolute", left: "50%", top: "58%", transform: "translate(-50%,-50%)",
        width: `${60 + intensity * 70}vmin`, height: `${60 + intensity * 70}vmin`,
        background: `radial-gradient(circle, rgba(212,120,26,${0.10 + intensity * 0.30}) 0%, rgba(196,83,26,${0.05 + intensity * 0.14}) 38%, transparent 68%)`,
        transition: "all 1.1s ease", pointerEvents: "none",
        animation: "ekGlowPulse 3.6s ease-in-out infinite",
      }} />

      {/* Mute toggle */}
      <button
        onClick={fire.toggleMute}
        aria-label={fire.muted ? "Unmute" : "Mute"}
        style={{
          position: "absolute", top: 14, right: 14, zIndex: 12,
          background: "rgba(0,0,0,0.4)", border: `1px solid ${DIM}`, borderRadius: 8,
          color: DIM, fontSize: 15, padding: "6px 10px", cursor: "pointer", lineHeight: 1,
        }}
      >
        {fire.muted ? "🔇" : "🔊"}
      </button>

      {/* Rising embers */}
      {Array.from({ length: 22 }).map((_, i) => (
        <span key={i} className="ek-spark" style={{
          left: `${8 + (i * 4.1) % 84}%`,
          animationDelay: `${(i % 11) * 0.55}s`,
          animationDuration: `${3.4 + (i % 5) * 0.75}s`,
          opacity: 0.15 + intensity * 0.7,
          background: i % 4 === 0 ? "#ffd27a" : GOLD,
        }} />
      ))}

      {/* White flash at the moment of breaking */}
      {flash && <div className="ek-flash" />}

      {/* ── Stage ── */}
      <div style={{
        position: "relative", zIndex: 5, width: "100%", maxWidth: 620,
        padding: "0 22px", textAlign: "center",
      }}>

        {/* EGG + SPEAK share the egg visual */}
        {(phase === "egg" || phase === "speak" || phase === "hatching") && (
          <div style={{
            position: "relative", height: "46vh", minHeight: 260,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Flames intensity={phase === "hatching" ? 1 : intensity} />
            <div
              className={phase === "hatching" ? "ek-egg-break" : eggReady ? "ek-egg-ready" : "ek-egg-idle"}
              style={{
                position: "relative", zIndex: 3,
                fontSize: "clamp(120px, 34vmin, 260px)", lineHeight: 1,
                filter: `drop-shadow(0 0 ${12 + intensity * 46}px rgba(212,140,40,${0.35 + intensity * 0.6}))`,
                transition: "filter 1s ease",
              }}
            >
              🥚
            </div>
          </div>
        )}

        {/* ── Phase: egg ── */}
        {phase === "egg" && (
          <div style={{ marginTop: 10 }}>
            <button
              onClick={stoke}
              disabled={busy}
              className="ek-stoke"
              style={{
                background: "rgba(212,169,66,0.13)",
                border: `1px solid ${GOLD}`, borderRadius: 10,
                color: GOLD, fontFamily: "serif", fontSize: 17,
                letterSpacing: "0.2em", padding: "15px 34px",
                cursor: busy ? "wait" : "pointer", textTransform: "uppercase",
              }}
            >
              Stoke the flames
            </button>
            <div style={{ marginTop: 18, display: "flex", gap: 8, justifyContent: "center" }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{
                  width: 26, height: 3, borderRadius: 2,
                  background: i < stokes ? GOLD : "#2a2a2a",
                  boxShadow: i < stokes ? `0 0 8px ${GOLD}` : "none",
                  transition: "all 0.5s ease",
                }} />
              ))}
            </div>
            {error && <ErrorLine>{error}</ErrorLine>}
          </div>
        )}

        {/* ── Phase: speak ── */}
        {phase === "speak" && (
          <div className="ek-fade-in" style={{ marginTop: 6 }}>
            <div style={{
              fontFamily: "serif", color: GOLD, fontSize: 19,
              letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 14,
            }}>
              Speak to it
            </div>
            <textarea
              value={whisper}
              onChange={e => setWhisper(e.target.value.slice(0, 200))}
              placeholder="be fast, and a coward about it…"
              rows={2}
              autoFocus
              style={{
                width: "100%", background: "rgba(0,0,0,0.55)",
                border: `1px solid ${DIM}`, borderRadius: 10,
                padding: "14px 16px", color: TEXT, fontSize: 16,
                fontFamily: "inherit", textAlign: "center", resize: "none",
                lineHeight: 1.5,
              }}
            />
            {error && <ErrorLine>{error}</ErrorLine>}
            <button
              onClick={hatch}
              disabled={busy}
              className="ek-stoke"
              style={{
                marginTop: 16, background: "rgba(212,169,66,0.13)",
                border: `1px solid ${GOLD}`, borderRadius: 10, color: GOLD,
                fontFamily: "serif", fontSize: 16, letterSpacing: "0.2em",
                padding: "14px 32px", cursor: busy ? "wait" : "pointer",
                textTransform: "uppercase",
              }}
            >
              {busy ? "…" : "Say it"}
            </button>
          </div>
        )}

        {/* ── Phase: hatching ── */}
        {phase === "hatching" && (
          <div style={{ marginTop: 16, minHeight: 74 }}>
            <div key={beat} className="ek-proclaim" style={{
              fontFamily: "serif", color: GOLD,
              fontSize: beat === 0 ? "clamp(19px, 4.4vw, 27px)" : "clamp(21px, 5vw, 31px)",
              letterSpacing: "0.1em", lineHeight: 1.35,
              textShadow: `0 0 30px rgba(212,169,66,0.6)`,
            }}>
              {beat === 0 ? "Your great soul is hatching!" : "Behold, your Emberkin emerges!"}
            </div>
          </div>
        )}

        {/* ── Phase: reveal ── */}
        {phase === "reveal" && creature && (
          <div className="ek-reveal">
            <div style={{
              position: "relative", margin: "0 auto 20px",
              width: "min(70vmin, 300px)", height: "min(70vmin, 300px)",
            }}>
              <Flames intensity={0.5} />
              {portrait ? (
                <img
                  src={portrait}
                  alt={creature.species}
                  style={{
                    position: "relative", zIndex: 3, width: "100%", height: "100%",
                    objectFit: "cover", borderRadius: "50%",
                    border: `2px solid ${creature.rarityColor}`,
                    boxShadow: `0 0 60px ${creature.rarityColor}55`,
                  }}
                />
              ) : (
                <div style={{
                  position: "relative", zIndex: 3, width: "100%", height: "100%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "clamp(90px, 26vmin, 170px)",
                  filter: `drop-shadow(0 0 40px ${creature.rarityColor}88)`,
                }}>
                  {creature.sprite}
                </div>
              )}
            </div>

            <div style={{
              color: creature.rarityColor, fontSize: 10.5, fontWeight: 700,
              letterSpacing: "0.28em", textTransform: "uppercase", marginBottom: 7,
            }}>
              {creature.rarity}
            </div>
            <h1 style={{
              fontFamily: "serif", color: GOLD, fontSize: "clamp(24px, 6vw, 34px)",
              margin: "0 0 12px", letterSpacing: "0.05em",
            }}>
              {creature.species}
            </h1>
            <p style={{
              color: TEXT, fontSize: 14.5, lineHeight: 1.75, maxWidth: 440,
              margin: "0 auto 8px", fontStyle: "italic",
            }}>
              {creature.description}
            </p>

            {portraitPending && (
              <div className="ek-shimmer" style={{ color: DIM, fontSize: 11.5, margin: "12px 0" }}>
                the fire is still deciding what it looks like…
              </div>
            )}

            <div style={{ marginTop: 22 }}>
              <div style={{
                color: DIM, fontSize: 10.5, letterSpacing: "0.18em",
                textTransform: "uppercase", marginBottom: 8,
              }}>
                Name it
              </div>
              <input
                value={name}
                onChange={e => setName(e.target.value.slice(0, 24))}
                style={{
                  width: "min(100%, 260px)", background: "rgba(0,0,0,0.55)",
                  border: `1px solid ${DIM}`, borderRadius: 10, padding: "12px 14px",
                  color: TEXT, fontSize: 17, fontFamily: "serif", textAlign: "center",
                }}
              />
            </div>

            <button
              onClick={finish}
              className="ek-stoke"
              style={{
                marginTop: 20, marginBottom: 40, background: "rgba(212,169,66,0.13)",
                border: `1px solid ${GOLD}`, borderRadius: 10, color: GOLD,
                fontFamily: "serif", fontSize: 15, letterSpacing: "0.2em",
                padding: "13px 32px", cursor: "pointer", textTransform: "uppercase",
              }}
            >
              Take it with you
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Flames ───────────────────────────────────────────────────────────────────

/** Layered blurred teardrops. Height/opacity scale with intensity. */
function Flames({ intensity }: { intensity: number }) {
  const layers = [
    { w: 46, h: 74, blur: 26, color: "rgba(196,83,26,0.55)", dur: "2.3s", delay: "0s" },
    { w: 34, h: 60, blur: 18, color: "rgba(226,124,29,0.62)", dur: "1.85s", delay: "0.25s" },
    { w: 23, h: 45, blur: 11, color: "rgba(240,176,58,0.68)", dur: "1.5s", delay: "0.5s" },
    { w: 13, h: 29, blur: 7, color: "rgba(255,226,150,0.62)", dur: "1.2s", delay: "0.15s" },
  ];
  return (
    <div aria-hidden style={{
      position: "absolute", inset: 0, display: "flex",
      alignItems: "flex-end", justifyContent: "center",
      pointerEvents: "none", opacity: 0.25 + intensity * 0.75,
      transition: "opacity 1.1s ease",
    }}>
      {layers.map((l, i) => (
        <div key={i} className="ek-flame" style={{
          position: "absolute", bottom: "6%",
          width: `${l.w * (0.55 + intensity * 0.65)}%`,
          height: `${l.h * (0.4 + intensity * 0.8)}%`,
          background: l.color,
          filter: `blur(${l.blur}px)`,
          borderRadius: "50% 50% 44% 44% / 68% 68% 32% 32%",
          animationDuration: l.dur,
          animationDelay: l.delay,
        }} />
      ))}
    </div>
  );
}

function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      color: "#e07a4a", fontSize: 12.5, marginTop: 14,
      padding: "8px 12px", background: "rgba(196,83,26,0.12)",
      border: "1px solid rgba(196,83,26,0.35)", borderRadius: 8,
    }}>
      {children}
    </div>
  );
}

function SceneStyles() {
  return (
    <style>{`
      @keyframes ekFlameDance {
        0%,100% { transform: scaleY(1) scaleX(1) translateX(0); }
        25%     { transform: scaleY(1.13) scaleX(0.93) translateX(-2%); }
        50%     { transform: scaleY(0.92) scaleX(1.07) translateX(2%); }
        75%     { transform: scaleY(1.09) scaleX(0.96) translateX(-1%); }
      }
      .ek-flame { animation-name: ekFlameDance; animation-iteration-count: infinite; animation-timing-function: ease-in-out; transform-origin: 50% 100%; }

      @keyframes ekGlowPulse { 0%,100% { opacity: 0.85; } 50% { opacity: 1; } }

      @keyframes ekEggIdle { 0%,100% { transform: translateY(0) rotate(-1deg); } 50% { transform: translateY(-8px) rotate(1deg); } }
      .ek-egg-idle { animation: ekEggIdle 4s ease-in-out infinite; }

      @keyframes ekEggReady {
        0%,100% { transform: rotate(-5deg) scale(1); }
        20%     { transform: rotate(6deg) scale(1.04); }
        40%     { transform: rotate(-6deg) scale(0.98); }
        60%     { transform: rotate(5deg) scale(1.03); }
      }
      .ek-egg-ready { animation: ekEggReady 0.75s ease-in-out infinite; }

      @keyframes ekEggBreak {
        0%   { transform: rotate(-8deg) scale(1); }
        30%  { transform: rotate(9deg) scale(1.09); }
        60%  { transform: rotate(-10deg) scale(1.15); }
        85%  { transform: rotate(7deg) scale(1.3); opacity: 0.85; }
        100% { transform: scale(1.75); opacity: 0; }
      }
      .ek-egg-break { animation: ekEggBreak 4.2s cubic-bezier(0.5,0,0.75,0) forwards; }

      @keyframes ekSpark {
        0%   { transform: translateY(0) scale(1); opacity: 0; }
        12%  { opacity: 1; }
        100% { transform: translateY(-78vh) scale(0.25); opacity: 0; }
      }
      .ek-spark {
        position: absolute; bottom: 6%; width: 4px; height: 4px; border-radius: 50%;
        pointer-events: none; animation-name: ekSpark;
        animation-iteration-count: infinite; animation-timing-function: ease-out;
      }

      @keyframes ekFlash { 0% { opacity: 0; } 35% { opacity: 0.92; } 100% { opacity: 0; } }
      .ek-flash {
        position: fixed; inset: 0; z-index: 20; pointer-events: none;
        background: radial-gradient(circle at 50% 55%, #fff6dd 0%, #ffcf7a 30%, transparent 72%);
        animation: ekFlash 0.75s ease-out forwards;
      }

      @keyframes ekProclaim {
        0%   { opacity: 0; transform: translateY(14px) scale(0.94); letter-spacing: 0.35em; }
        100% { opacity: 1; transform: translateY(0) scale(1); letter-spacing: 0.1em; }
      }
      .ek-proclaim { animation: ekProclaim 1.1s cubic-bezier(0.2,0.8,0.2,1) forwards; }

      @keyframes ekFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
      .ek-fade-in { animation: ekFadeIn 0.8s ease forwards; }

      @keyframes ekReveal {
        0%   { opacity: 0; transform: scale(0.86); filter: blur(9px); }
        100% { opacity: 1; transform: scale(1); filter: blur(0); }
      }
      .ek-reveal { animation: ekReveal 1.3s cubic-bezier(0.2,0.8,0.2,1) forwards; }

      @keyframes ekShimmer { 0%,100% { opacity: 0.35; } 50% { opacity: 0.95; } }
      .ek-shimmer { animation: ekShimmer 1.9s ease-in-out infinite; }

      .ek-stoke:hover:not(:disabled) {
        background: rgba(212,169,66,0.24) !important;
        box-shadow: 0 0 34px rgba(212,169,66,0.4);
      }
      .ek-stoke:active:not(:disabled) { transform: scale(0.97); }
      .ek-stoke { transition: all 0.18s ease; }

      textarea:focus, input:focus { outline: none; border-color: ${GOLD} !important; }

      @media (prefers-reduced-motion: reduce) {
        .ek-flame, .ek-spark, .ek-egg-idle, .ek-egg-ready { animation: none !important; }
      }
    `}</style>
  );
}
