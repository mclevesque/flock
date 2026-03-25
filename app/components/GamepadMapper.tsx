"use client";
import { useState, useEffect, useRef, useCallback } from "react";

// SNES button layout — index matches EmulatorJS defaultControls player 0
const SNES_BUTTONS = [
  { id: 0,  label: "B",       color: "#e05555", group: "face" },
  { id: 1,  label: "Y",       color: "#4caf7d", group: "face" },
  { id: 2,  label: "Select",  color: "#9494b8", group: "center" },
  { id: 3,  label: "Start",   color: "#9494b8", group: "center" },
  { id: 4,  label: "↑",       color: "#4a90d9", group: "dpad" },
  { id: 5,  label: "↓",       color: "#4a90d9", group: "dpad" },
  { id: 6,  label: "←",       color: "#4a90d9", group: "dpad" },
  { id: 7,  label: "→",       color: "#4a90d9", group: "dpad" },
  { id: 8,  label: "A",       color: "#e8764a", group: "face" },
  { id: 9,  label: "X",       color: "#7c5cbf", group: "face" },
  { id: 10, label: "L",       color: "#f0b429", group: "shoulder" },
  { id: 11, label: "R",       color: "#f0b429", group: "shoulder" },
];

// Xbox default mapping (standard gamepad button indices → SNES buttons)
const XBOX_DEFAULTS: Record<number, number> = {
  0: 8,   // A → SNES A
  1: 0,   // B → SNES B
  2: 9,   // X → SNES X
  3: 1,   // Y → SNES Y
  4: 10,  // LB → SNES L
  5: 11,  // RB → SNES R
  8: 2,   // Back/Select → SNES Select
  9: 3,   // Start → SNES Start
  12: 4,  // D-up → SNES ↑
  13: 5,  // D-down → SNES ↓
  14: 6,  // D-left → SNES ←
  15: 7,  // D-right → SNES →
};

const LS_KEY = "ryft_gamepad_map";

export type GamepadMap = Record<number, number>; // snesButtonId → gamepadButtonIndex

function loadSavedMap(): GamepadMap | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function buildDefaultMap(): GamepadMap {
  // Invert XBOX_DEFAULTS: snesId → gpIdx
  const map: GamepadMap = {};
  for (const [gpIdx, snesId] of Object.entries(XBOX_DEFAULTS)) {
    map[snesId] = Number(gpIdx);
  }
  return map;
}

interface Props {
  onMapChange?: (map: GamepadMap) => void;
}

export default function GamepadMapper({ onMapChange }: Props) {
  const [open, setOpen] = useState(false);
  const [gamepads, setGamepads] = useState<Gamepad[]>([]);
  const [activeGpIdx, setActiveGpIdx] = useState(0);
  const [map, setMap] = useState<GamepadMap>(() => loadSavedMap() ?? buildDefaultMap());
  const [listening, setListening] = useState<number | null>(null); // which snesButton we're mapping
  const [lastPressed, setLastPressed] = useState<number | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [testActive, setTestActive] = useState<Set<number>>(new Set());
  const rafRef = useRef<number>(0);
  const prevButtons = useRef<boolean[]>([]);
  const prevGpCount = useRef<number>(0);
  const lastSlowPoll = useRef<number>(0);

  // Poll gamepads — fast only when modal open, slow (500ms) when closed
  const pollGamepads = useCallback(() => {
    const now = performance.now();
    const modalOpen = open;

    // When modal is closed, only check for connection changes every 500ms
    if (!modalOpen && now - lastSlowPoll.current < 500) {
      rafRef.current = requestAnimationFrame(pollGamepads);
      return;
    }
    lastSlowPoll.current = now;

    const pads = Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter((g): g is Gamepad => !!g);

    // Only call setGamepads if count changed (avoid re-renders every frame)
    if (pads.length !== prevGpCount.current) {
      prevGpCount.current = pads.length;
      setGamepads(pads);
    }

    if (!modalOpen) {
      rafRef.current = requestAnimationFrame(pollGamepads);
      return;
    }

    const gp = pads[activeGpIdx];
    if (!gp) { rafRef.current = requestAnimationFrame(pollGamepads); return; }

    const pressed = gp.buttons.map(b => b.pressed);

    if (listening !== null) {
      for (let i = 0; i < pressed.length; i++) {
        if (pressed[i] && !prevButtons.current[i]) {
          setMap(prev => ({ ...prev, [listening]: i }));
          setLastPressed(i);
          setListening(null);
          break;
        }
      }
    }

    if (testMode) {
      const active = new Set<number>();
      pressed.forEach((p, i) => { if (p) active.add(i); });
      setTestActive(active);
    }

    prevButtons.current = pressed;
    rafRef.current = requestAnimationFrame(pollGamepads);
  }, [open, listening, testMode, activeGpIdx]);

  // Always poll — throttled to 500ms when modal closed, full speed when open
  useEffect(() => {
    rafRef.current = requestAnimationFrame(pollGamepads);
    return () => cancelAnimationFrame(rafRef.current);
  }, [pollGamepads]);

  useEffect(() => {
    function onConnect() {
      const pads = Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter((g): g is Gamepad => !!g);
      setGamepads(pads);
    }
    window.addEventListener("gamepadconnected", onConnect);
    window.addEventListener("gamepaddisconnected", onConnect);
    // Also poll on visibility change — when tab regains focus, re-check
    function onVisible() {
      if (document.visibilityState === "visible") {
        const pads = Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter((g): g is Gamepad => !!g);
        setGamepads(pads);
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("gamepadconnected", onConnect);
      window.removeEventListener("gamepaddisconnected", onConnect);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  function saveMap(newMap: GamepadMap) {
    setMap(newMap);
    localStorage.setItem(LS_KEY, JSON.stringify(newMap));
    onMapChange?.(newMap);
  }

  function resetToDefaults() {
    const def = buildDefaultMap();
    saveMap(def);
  }

  function getGpButtonForSnes(snesId: number): number | undefined {
    return map[snesId];
  }

  const gp = gamepads[activeGpIdx];
  const gpName = gp ? gp.id.replace(/\s*\(.*\)/, "").slice(0, 40) : null;

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "rgba(124,92,191,0.12)", border: "1px solid rgba(124,92,191,0.3)",
          borderRadius: 8, padding: "7px 14px", color: "var(--text-primary)",
          fontSize: 12, fontWeight: 700, cursor: "pointer", width: "100%",
          justifyContent: "center",
        }}
      >
        🎮 Configure Controller
      </button>

      {/* Modal */}
      {open && (
        <div
          onClick={e => { if (e.target === e.currentTarget) { setListening(null); setOpen(false); } }}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
            zIndex: 10001, display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
        >
          <div style={{
            background: "var(--bg-elevated)", border: "1px solid var(--border)",
            borderRadius: 16, width: "100%", maxWidth: 520,
            boxShadow: "0 24px 80px rgba(0,0,0,0.6)", overflow: "hidden",
          }}>
            {/* Header */}
            <div style={{
              background: "linear-gradient(135deg, #1a1230, #0d1a30)",
              padding: "16px 20px", borderBottom: "1px solid var(--border)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>🎮 Controller Setup</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  Map your controller before launching a game
                </div>
              </div>
              <button onClick={() => { setListening(null); setOpen(false); }}
                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>

            <div style={{ padding: 20 }}>
              {/* Gamepad selector */}
              <div style={{ marginBottom: 16 }}>
                {gamepads.length === 0 ? (
                  <div style={{
                    background: "rgba(240,180,41,0.08)", border: "1px solid rgba(240,180,41,0.35)",
                    borderRadius: 10, padding: "14px 16px", textAlign: "center",
                  }}>
                    <div style={{ fontSize: 20, marginBottom: 6 }}>🎮</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#f0b429", marginBottom: 6 }}>
                      Controller not detected yet
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                      Xbox/PS controller connected to Windows but the browser needs activation.<br/>
                      <strong style={{ color: "#f0b429" }}>Press any button on your controller now.</strong>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
                      (Browser security — required once per page load)
                    </div>
                  </div>
                ) : (
                  <div style={{
                    background: "rgba(76,175,125,0.1)", border: "1px solid var(--accent-green)",
                    borderRadius: 10, padding: "10px 14px",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-green)" }}>✓ Controller detected</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 1 }}>{gpName}</div>
                    </div>
                    {gamepads.length > 1 && (
                      <select
                        value={activeGpIdx}
                        onChange={e => setActiveGpIdx(Number(e.target.value))}
                        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)", borderRadius: 6, padding: "4px 8px", fontSize: 12 }}
                      >
                        {gamepads.map((g, i) => <option key={i} value={i}>Controller {i + 1}</option>)}
                      </select>
                    )}
                  </div>
                )}
              </div>

              {/* Test mode toggle */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <button
                  onClick={() => { setTestMode(false); setListening(null); }}
                  style={{
                    flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                    background: !testMode ? "rgba(124,92,191,0.2)" : "transparent",
                    border: `1px solid ${!testMode ? "var(--accent-purple)" : "var(--border)"}`,
                    color: !testMode ? "var(--accent-purple-bright)" : "var(--text-muted)",
                  }}
                >⚙️ Remap Buttons</button>
                <button
                  onClick={() => { setTestMode(true); setListening(null); }}
                  style={{
                    flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                    background: testMode ? "rgba(76,175,125,0.2)" : "transparent",
                    border: `1px solid ${testMode ? "var(--accent-green)" : "var(--border)"}`,
                    color: testMode ? "var(--accent-green)" : "var(--text-muted)",
                  }}
                >🔬 Test Buttons</button>
              </div>

              {testMode ? (
                /* Test mode — shows which buttons are being pressed */
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, textAlign: "center" }}>
                    Press buttons on your controller — highlighted buttons are active
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                    {Array.from({ length: 20 }, (_, i) => {
                      const isActive = testActive.has(i);
                      // Find SNES button mapped to this gamepad button
                      const snesEntry = Object.entries(map).find(([, gpBtn]) => gpBtn === i);
                      const snesId = snesEntry ? Number(snesEntry[0]) : null;
                      const snesBtn = snesId !== null ? SNES_BUTTONS.find(b => b.id === snesId) : null;
                      return (
                        <div key={i} style={{
                          width: 52, height: 52, borderRadius: 10,
                          background: isActive ? "rgba(124,92,191,0.4)" : "var(--bg-surface)",
                          border: `2px solid ${isActive ? "var(--accent-purple)" : "var(--border)"}`,
                          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                          transition: "all 0.1s ease",
                          boxShadow: isActive ? "0 0 12px rgba(124,92,191,0.5)" : "none",
                        }}>
                          <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>Btn {i}</div>
                          {snesBtn && (
                            <div style={{ fontSize: 11, fontWeight: 700, color: snesBtn.color }}>{snesBtn.label}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Remap mode */
                <div>
                  {listening !== null && (
                    <div style={{
                      background: "rgba(124,92,191,0.15)", border: "1px solid var(--accent-purple)",
                      borderRadius: 10, padding: "10px 14px", marginBottom: 12,
                      fontSize: 13, color: "var(--accent-purple-bright)", fontWeight: 700,
                      textAlign: "center", animation: "pulse-glow 1s ease infinite",
                    }}>
                      Press a button on your controller for: SNES <strong>{SNES_BUTTONS.find(b => b.id === listening)?.label}</strong>
                    </div>
                  )}

                  {/* SNES button grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {/* Shoulders first */}
                    {SNES_BUTTONS.filter(b => b.group === "shoulder").map(btn => (
                      <MapRow key={btn.id} btn={btn} gpBtn={getGpButtonForSnes(btn.id)} listening={listening === btn.id} onClick={() => setListening(listening === btn.id ? null : btn.id)} />
                    ))}
                    {/* D-pad */}
                    {SNES_BUTTONS.filter(b => b.group === "dpad").map(btn => (
                      <MapRow key={btn.id} btn={btn} gpBtn={getGpButtonForSnes(btn.id)} listening={listening === btn.id} onClick={() => setListening(listening === btn.id ? null : btn.id)} />
                    ))}
                    {/* Center */}
                    {SNES_BUTTONS.filter(b => b.group === "center").map(btn => (
                      <MapRow key={btn.id} btn={btn} gpBtn={getGpButtonForSnes(btn.id)} listening={listening === btn.id} onClick={() => setListening(listening === btn.id ? null : btn.id)} />
                    ))}
                    {/* Face */}
                    {SNES_BUTTONS.filter(b => b.group === "face").map(btn => (
                      <MapRow key={btn.id} btn={btn} gpBtn={getGpButtonForSnes(btn.id)} listening={listening === btn.id} onClick={() => setListening(listening === btn.id ? null : btn.id)} />
                    ))}
                  </div>
                </div>
              )}

              {/* Footer buttons */}
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button
                  onClick={resetToDefaults}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                    background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)",
                  }}
                >Reset to Xbox Defaults</button>
                <button
                  onClick={() => { saveMap(map); setOpen(false); setListening(null); }}
                  style={{
                    flex: 2, padding: "8px 0", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer",
                    background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))",
                    border: "none", color: "#fff",
                  }}
                >Save & Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MapRow({
  btn,
  gpBtn,
  listening,
  onClick,
}: {
  btn: typeof SNES_BUTTONS[0];
  gpBtn: number | undefined;
  listening: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: listening ? "rgba(124,92,191,0.15)" : "var(--bg-surface)",
        border: `1px solid ${listening ? "var(--accent-purple)" : "var(--border)"}`,
        borderRadius: 8, padding: "8px 12px", cursor: "pointer",
        transition: "all 0.1s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          width: 26, height: 26, borderRadius: 6, background: btn.color + "33",
          border: `1px solid ${btn.color}66`, display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 12, fontWeight: 800, color: btn.color,
          flexShrink: 0,
        }}>
          {btn.label}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>SNES {btn.label}</span>
      </div>
      <div style={{ fontSize: 11, color: listening ? "var(--accent-purple-bright)" : "var(--text-muted)", fontFamily: "monospace" }}>
        {listening ? "⬤ Listening…" : gpBtn !== undefined ? `Btn ${gpBtn}` : "—"}
      </div>
    </button>
  );
}
