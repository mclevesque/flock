"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  PETS, WALLPAPERS, FLOORS, FURNITURE, EXTERIOR_STYLES,
  PlacedFurniture, OwnedPet, HouseConfig, DEFAULT_HOUSE_CONFIG,
  type Pet, type FurnitureItem,
} from "./houseData";

// ─── Types ────────────────────────────────────────────────────────────────────
interface LivePet extends OwnedPet {
  x: number; y: number; // percentage 0-100 within floor area
  targetX: number; targetY: number;
  facingLeft: boolean;
}

interface Props {
  userId: string;        // whose house
  viewerId: string;      // current logged-in user
  username: string;      // house owner username
  onClose: () => void;
}

type Tab = "style" | "furniture" | "pets";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function rand(min: number, max: number) { return Math.random() * (max - min) + min; }
function uuid() { return Math.random().toString(36).slice(2); }

function getCss(arr: { id: string; css: string }[], id: string): string {
  return arr.find(x => x.id === id)?.css ?? arr[0].css;
}

const SPEED_MS: Record<number, number> = { 1: 4000, 2: 2500, 3: 1400 };
const FLOAT_PETS = new Set(["float"]);
const SWIM_PETS  = new Set(["swim"]);

// ─── Component ────────────────────────────────────────────────────────────────
export default function HouseInterior({ userId, viewerId, username, onClose }: Props) {
  const isOwner = userId === viewerId;

  const [config, setConfig] = useState<HouseConfig>({ ...DEFAULT_HOUSE_CONFIG, userId });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("style");

  // furniture placement
  const [placingFurniture, setPlacingFurniture] = useState<FurnitureItem | null>(null);
  const [hoveredInstance, setHoveredInstance] = useState<string | null>(null);
  const roomRef = useRef<HTMLDivElement>(null);

  // pets
  const [livePets, setLivePets] = useState<LivePet[]>([]);
  const petIntervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  // pet editing
  const [addingPet, setAddingPet] = useState(false);
  const [petSearch, setPetSearch] = useState("");
  const [namingPet, setNamingPet] = useState<Pet | null>(null);
  const [petName, setPetName] = useState("");

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/house?userId=${userId}`)
      .then(r => r.json())
      .then(({ config: c }) => {
        if (c) {
          setConfig({
            userId: c.user_id,
            exteriorStyle: c.exterior_style ?? "cottage",
            wallpaper: c.wallpaper ?? "cream",
            floorType: c.floor_type ?? "hardwood",
            furniture: (c.furniture as PlacedFurniture[]) ?? [],
            pets: (c.pets as OwnedPet[]) ?? [],
          });
        }
      })
      .finally(() => setLoading(false));
  }, [userId]);

  // ── Spawn live pets ─────────────────────────────────────────────────────────
  useEffect(() => {
    const newLive: LivePet[] = config.pets.map(op => {
      const pet = PETS.find(p => p.id === op.petId);
      const isFloat = pet?.movementStyle === "float";
      const x = rand(5, 85), y = isFloat ? rand(10, 90) : rand(5, 80);
      return { ...op, x, y, targetX: rand(5, 85), targetY: isFloat ? rand(10, 90) : rand(5, 80), facingLeft: false };
    });
    setLivePets(newLive);
  }, [config.pets]);

  // ── Pet movement intervals ───────────────────────────────────────────────────
  useEffect(() => {
    // Clear old intervals
    petIntervalsRef.current.forEach(clearInterval);
    petIntervalsRef.current.clear();

    livePets.forEach(lp => {
      const petDef = PETS.find(p => p.id === lp.petId);
      const speed = petDef?.speed ?? 2;
      const ms = SPEED_MS[speed] ?? 2500;
      const isFloat = petDef?.movementStyle === "float";
      const isSwim  = petDef?.movementStyle === "swim";

      const interval = setInterval(() => {
        setLivePets(prev => prev.map(p => {
          if (p.instanceId !== lp.instanceId) return p;
          const nx = isSwim
            ? Math.min(90, Math.max(5, p.x + rand(-30, 30)))
            : rand(5, 85);
          const ny = isFloat
            ? rand(5, 90)
            : isSwim
              ? Math.min(70, Math.max(20, p.y + rand(-15, 15)))
              : rand(30, 85);
          return { ...p, targetX: nx, targetY: ny, facingLeft: nx < p.x };
        }));
      }, ms + rand(-400, 400));

      petIntervalsRef.current.set(lp.instanceId, interval);
    });

    return () => {
      petIntervalsRef.current.forEach(clearInterval);
      petIntervalsRef.current.clear();
    };
  }, [livePets.map(p => p.instanceId).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save (debounced) ────────────────────────────────────────────────────────
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveConfig = useCallback((next: HouseConfig) => {
    if (!isOwner) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await fetch("/api/house", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exteriorStyle: next.exteriorStyle,
          wallpaper: next.wallpaper,
          floorType: next.floorType,
          furniture: next.furniture,
          pets: next.pets,
        }),
      }).finally(() => setSaving(false));
    }, 1200);
  }, [isOwner]);

  function updateConfig(partial: Partial<HouseConfig>) {
    setConfig(prev => {
      const next = { ...prev, ...partial };
      saveConfig(next);
      return next;
    });
  }

  // ── Furniture placement ──────────────────────────────────────────────────────
  function handleRoomClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!placingFurniture || !roomRef.current) return;
    const rect = roomRef.current.getBoundingClientRect();
    const floorTop = rect.height * 0.45; // floor starts at 45% down
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = Math.max(0, ((e.clientY - rect.top - floorTop) / (rect.height - floorTop))) * 100;
    if (y < 0) return; // clicked in wall area, not floor
    const placed: PlacedFurniture = { instanceId: uuid(), furnitureId: placingFurniture.id, x, y };
    updateConfig({ furniture: [...config.furniture, placed] });
    setPlacingFurniture(null);
  }

  function removeFurniture(instanceId: string) {
    updateConfig({ furniture: config.furniture.filter(f => f.instanceId !== instanceId) });
    setHoveredInstance(null);
  }

  // ── Pet management ───────────────────────────────────────────────────────────
  function startAddPet(pet: Pet) {
    if (config.pets.length >= 3) return;
    setNamingPet(pet);
    setPetName(pet.name);
    setAddingPet(false);
  }

  function confirmAddPet() {
    if (!namingPet) return;
    const owned: OwnedPet = { instanceId: uuid(), petId: namingPet.id, name: petName || namingPet.name };
    updateConfig({ pets: [...config.pets, owned] });
    setNamingPet(null);
    setPetName("");
  }

  function removePet(instanceId: string) {
    updateConfig({ pets: config.pets.filter(p => p.instanceId !== instanceId) });
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  const wallCss = getCss(WALLPAPERS, config.wallpaper);
  const floorCss = getCss(FLOORS, config.floorType);
  const wallIsGradient = wallCss.includes("gradient") || wallCss.includes("radial");
  const floorIsGradient = floorCss.includes("gradient") || floorCss.includes("radial");

  const filteredPets = PETS.filter(p =>
    petSearch === "" ||
    p.name.toLowerCase().includes(petSearch.toLowerCase()) ||
    p.category.includes(petSearch.toLowerCase())
  );

  const furnitureCategories = [...new Set(FURNITURE.map(f => f.category))];

  if (loading) return (
    <div style={overlay}>
      <div style={{ color: "#fff", fontSize: 28, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏠</div>
        Loading house...
      </div>
    </div>
  );

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={container}>

        {/* ── Header ── */}
        <div style={header}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>
              {EXTERIOR_STYLES.find(e => e.id === config.exteriorStyle)?.emoji ?? "🏠"}
            </span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#fff" }}>
                {username}&apos;s House
              </div>
              {saving && <div style={{ fontSize: 11, color: "#aaa" }}>Saving…</div>}
            </div>
          </div>
          <button onClick={onClose} style={closeBtn} title="Exit house">
            🚪 Leave
          </button>
        </div>

        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* ── Room View ── */}
          <div
            ref={roomRef}
            style={{
              ...roomStyle,
              cursor: placingFurniture ? "crosshair" : "default",
            }}
            onClick={handleRoomClick}
          >
            {/* Wall */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: "45%",
              ...(wallIsGradient ? { backgroundImage: wallCss, background: "#888" } : { background: wallCss }),
              transition: "background 0.4s",
            }} />

            {/* Baseboard */}
            <div style={{
              position: "absolute", top: "45%", left: 0, right: 0, height: 8,
              background: "rgba(0,0,0,0.25)", zIndex: 2,
            }} />

            {/* Floor */}
            <div style={{
              position: "absolute", top: "calc(45% + 8px)", left: 0, right: 0, bottom: 0,
              ...(floorIsGradient ? { backgroundImage: floorCss, background: "#666" } : { background: floorCss }),
              transition: "background 0.4s",
            }} />

            {/* Room lighting vignette */}
            <div style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              background: "radial-gradient(ellipse at 50% 30%, transparent 40%, rgba(0,0,0,0.35) 100%)",
              zIndex: 3,
            }} />

            {/* Placing hint */}
            {placingFurniture && (
              <div style={{
                position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", justifyContent: "center",
                paddingBottom: 20, pointerEvents: "none", zIndex: 10,
              }}>
                <div style={{
                  background: "rgba(0,0,0,0.7)", color: "#fff", padding: "8px 18px",
                  borderRadius: 20, fontSize: 14, backdropFilter: "blur(4px)",
                }}>
                  Click the floor to place {placingFurniture.emoji} {placingFurniture.name} · ESC to cancel
                </div>
              </div>
            )}

            {/* Furniture */}
            {config.furniture.map(pf => {
              const def = FURNITURE.find(f => f.id === pf.furnitureId);
              if (!def) return null;
              const isHovered = hoveredInstance === pf.instanceId;
              return (
                <div
                  key={pf.instanceId}
                  onMouseEnter={() => isOwner && setHoveredInstance(pf.instanceId)}
                  onMouseLeave={() => setHoveredInstance(null)}
                  style={{
                    position: "absolute",
                    left: `${pf.x}%`,
                    top: `calc(45% + 8px + ${pf.y}% * 0.55)`,
                    transform: "translate(-50%, -50%)",
                    zIndex: 4 + Math.floor(pf.y / 10),
                    fontSize: `${36 + def.w * 6}px`,
                    userSelect: "none",
                    cursor: isOwner ? "pointer" : "default",
                    filter: isHovered ? "brightness(1.3) drop-shadow(0 0 8px rgba(255,200,100,0.8))" : "drop-shadow(0 4px 6px rgba(0,0,0,0.5))",
                    transition: "filter 0.2s",
                  }}
                >
                  {def.emoji}
                  {isHovered && isOwner && (
                    <button
                      onClick={e => { e.stopPropagation(); removeFurniture(pf.instanceId); }}
                      style={{
                        position: "absolute", top: -10, right: -10,
                        background: "#cc2200", color: "#fff", border: "none",
                        borderRadius: "50%", width: 22, height: 22, fontSize: 12,
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        zIndex: 20,
                      }}
                    >×</button>
                  )}
                </div>
              );
            })}

            {/* Pets */}
            {livePets.map(lp => {
              const petDef = PETS.find(p => p.id === lp.petId);
              if (!petDef) return null;
              const isFloat = FLOAT_PETS.has(petDef.movementStyle);
              const isSwim  = SWIM_PETS.has(petDef.movementStyle);
              const topBase = isFloat || isSwim ? 0 : 45;
              const topRange = isFloat ? 90 : isSwim ? 55 : 50;
              const speed = SPEED_MS[petDef.speed] ?? 2500;

              return (
                <div
                  key={lp.instanceId}
                  title={`${lp.name} (${petDef.name})`}
                  style={{
                    position: "absolute",
                    left: `${lp.targetX}%`,
                    top: `calc(${topBase}% + ${lp.targetY / 100 * topRange}%)`,
                    fontSize: 28,
                    transform: `translate(-50%, -50%) scaleX(${lp.facingLeft ? -1 : 1})`,
                    transition: `left ${speed}ms ease-in-out, top ${speed}ms ease-in-out`,
                    zIndex: 6,
                    userSelect: "none",
                    pointerEvents: "none",
                    filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.4))",
                    animation: isFloat ? "petBob 3s ease-in-out infinite" : isSwim ? "petBob 2s ease-in-out infinite" : undefined,
                  }}
                >
                  {petDef.emoji}
                  <div style={{
                    position: "absolute", bottom: -18, left: "50%", transform: "translateX(-50%) scaleX(1)",
                    fontSize: 10, color: "#fff", whiteSpace: "nowrap",
                    textShadow: "0 1px 3px rgba(0,0,0,0.9)",
                  }}>
                    {lp.name}
                  </div>
                </div>
              );
            })}

            {/* Empty room hint */}
            {config.furniture.length === 0 && config.pets.length === 0 && isOwner && (
              <div style={{
                position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 5,
              }}>
                <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>🏠</div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
                  Use the panel to decorate your house
                </div>
              </div>
            )}
          </div>

          {/* ── Sidebar ── */}
          <div style={sidebar}>
            {isOwner ? (
              <>
                {/* Tab bar */}
                <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: 12 }}>
                  {([
                    { id: "style", label: "🎨 Style" },
                    { id: "furniture", label: "🪑 Furniture" },
                    { id: "pets", label: "🐾 Pets" },
                  ] as { id: Tab; label: string }[]).map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                      flex: 1, padding: "8px 4px", background: "none", border: "none",
                      borderBottom: activeTab === t.id ? "2px solid #7c5cbf" : "2px solid transparent",
                      color: activeTab === t.id ? "#c084fc" : "rgba(255,255,255,0.5)",
                      fontSize: 11, cursor: "pointer", fontWeight: activeTab === t.id ? 700 : 400,
                      transition: "all 0.2s",
                    }}>{t.label}</button>
                  ))}
                </div>

                {/* ── Style Tab ── */}
                {activeTab === "style" && (
                  <div style={tabContent}>
                    <SectionLabel>Exterior Style</SectionLabel>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 16 }}>
                      {EXTERIOR_STYLES.map(es => (
                        <button key={es.id} onClick={() => updateConfig({ exteriorStyle: es.id })} style={{
                          padding: "8px 6px", borderRadius: 8, cursor: "pointer", textAlign: "left",
                          background: config.exteriorStyle === es.id ? "rgba(124,92,191,0.35)" : "rgba(255,255,255,0.05)",
                          border: config.exteriorStyle === es.id ? "1px solid #7c5cbf" : "1px solid rgba(255,255,255,0.08)",
                          color: "#fff", fontSize: 11, display: "flex", alignItems: "center", gap: 6,
                          transition: "all 0.15s",
                        }}>
                          <span style={{ fontSize: 18 }}>{es.emoji}</span>
                          <span>{es.name}</span>
                        </button>
                      ))}
                    </div>

                    <SectionLabel>Wallpaper</SectionLabel>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4, marginBottom: 16 }}>
                      {WALLPAPERS.map(w => (
                        <button key={w.id} onClick={() => updateConfig({ wallpaper: w.id })} title={w.name} style={{
                          width: "100%", aspectRatio: "1", borderRadius: 6, cursor: "pointer",
                          backgroundImage: w.css.includes("gradient") ? w.css : undefined,
                          background: w.css.includes("gradient") ? undefined : w.css,
                          border: config.wallpaper === w.id ? "2px solid #c084fc" : "2px solid transparent",
                          outline: config.wallpaper === w.id ? "1px solid rgba(192,132,252,0.5)" : "none",
                          transition: "border 0.15s",
                        }} />
                      ))}
                    </div>

                    <SectionLabel>Floor</SectionLabel>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
                      {FLOORS.map(f => (
                        <button key={f.id} onClick={() => updateConfig({ floorType: f.id })} title={f.name} style={{
                          width: "100%", aspectRatio: "1", borderRadius: 6, cursor: "pointer",
                          backgroundImage: f.css.includes("gradient") || f.css.includes("repeating") ? f.css : undefined,
                          background: f.css.includes("gradient") || f.css.includes("repeating") ? undefined : f.css,
                          border: config.floorType === f.id ? "2px solid #c084fc" : "2px solid transparent",
                          outline: config.floorType === f.id ? "1px solid rgba(192,132,252,0.5)" : "none",
                          transition: "border 0.15s",
                        }} />
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Furniture Tab ── */}
                {activeTab === "furniture" && (
                  <div style={tabContent}>
                    <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginBottom: 12, lineHeight: 1.4 }}>
                      Select an item then click the floor to place it. Hover placed items to remove.
                    </div>
                    {placingFurniture && (
                      <div style={{ background: "rgba(124,92,191,0.2)", border: "1px solid #7c5cbf", borderRadius: 8, padding: "8px 12px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ color: "#c084fc", fontSize: 13 }}>Placing: {placingFurniture.emoji} {placingFurniture.name}</span>
                        <button onClick={() => setPlacingFurniture(null)} style={{ background: "none", border: "none", color: "#ff6b6b", cursor: "pointer", fontSize: 18 }}>×</button>
                      </div>
                    )}
                    {furnitureCategories.map(cat => (
                      <div key={cat} style={{ marginBottom: 14 }}>
                        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{cat}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5 }}>
                          {FURNITURE.filter(f => f.category === cat).map(f => (
                            <button key={f.id} onClick={() => setPlacingFurniture(f)} style={{
                              padding: "8px 4px", borderRadius: 8, cursor: "pointer", textAlign: "center",
                              background: placingFurniture?.id === f.id ? "rgba(124,92,191,0.4)" : "rgba(255,255,255,0.05)",
                              border: placingFurniture?.id === f.id ? "1px solid #7c5cbf" : "1px solid rgba(255,255,255,0.08)",
                              color: "#fff", fontSize: 11, display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                              transition: "all 0.15s",
                            }}>
                              <span style={{ fontSize: 22 }}>{f.emoji}</span>
                              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", lineHeight: 1.2 }}>{f.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Pets Tab ── */}
                {activeTab === "pets" && (
                  <div style={tabContent}>
                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginBottom: 12 }}>
                      Up to 3 pets · They roam your house
                    </div>

                    {/* Owned pets */}
                    {config.pets.map(op => {
                      const petDef = PETS.find(p => p.id === op.petId);
                      if (!petDef) return null;
                      return (
                        <div key={op.instanceId} style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                          background: "rgba(255,255,255,0.06)", borderRadius: 10, marginBottom: 8,
                        }}>
                          <span style={{ fontSize: 28 }}>{petDef.emoji}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{op.name}</div>
                            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{petDef.name}</div>
                          </div>
                          <button onClick={() => removePet(op.instanceId)} style={{
                            background: "rgba(200,50,50,0.2)", border: "1px solid rgba(200,50,50,0.3)",
                            color: "#ff6b6b", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 12,
                          }}>Release</button>
                        </div>
                      );
                    })}

                    {config.pets.length < 3 && !addingPet && !namingPet && (
                      <button onClick={() => setAddingPet(true)} style={{
                        width: "100%", padding: "10px", borderRadius: 10, cursor: "pointer",
                        background: "rgba(124,92,191,0.15)", border: "1px dashed rgba(124,92,191,0.5)",
                        color: "#c084fc", fontSize: 13, marginTop: 8, transition: "all 0.2s",
                      }}>+ Adopt a Pet</button>
                    )}

                    {/* Pet picker */}
                    {addingPet && (
                      <div style={{ marginTop: 10 }}>
                        <input
                          placeholder="Search pets..."
                          value={petSearch}
                          onChange={e => setPetSearch(e.target.value)}
                          style={{
                            width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
                            background: "rgba(255,255,255,0.06)", color: "#fff", fontSize: 13, marginBottom: 8, boxSizing: "border-box",
                          }}
                          autoFocus
                        />
                        <div style={{ maxHeight: 260, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
                          {filteredPets.map(pet => (
                            <button key={pet.id} onClick={() => startAddPet(pet)} title={`${pet.name} (${pet.category})`} style={{
                              padding: "8px 4px", borderRadius: 8, cursor: "pointer", textAlign: "center",
                              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                              color: "#fff", fontSize: 11, display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                              transition: "background 0.15s",
                            }}>
                              <span style={{ fontSize: 24 }}>{pet.emoji}</span>
                              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", lineHeight: 1.2 }}>{pet.name}</span>
                            </button>
                          ))}
                        </div>
                        <button onClick={() => setAddingPet(false)} style={{
                          marginTop: 8, width: "100%", padding: "8px", borderRadius: 8,
                          background: "rgba(255,255,255,0.05)", border: "none", color: "rgba(255,255,255,0.4)",
                          cursor: "pointer", fontSize: 12,
                        }}>Cancel</button>
                      </div>
                    )}

                    {/* Naming modal */}
                    {namingPet && (
                      <div style={{
                        position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex",
                        alignItems: "center", justifyContent: "center", zIndex: 50, borderRadius: 16,
                      }}>
                        <div style={{
                          background: "#1a1025", border: "1px solid rgba(124,92,191,0.4)", borderRadius: 16,
                          padding: 28, width: 280, textAlign: "center",
                        }}>
                          <div style={{ fontSize: 56, marginBottom: 8 }}>{namingPet.emoji}</div>
                          <div style={{ color: "#fff", fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Name your {namingPet.name}</div>
                          <input
                            value={petName}
                            onChange={e => setPetName(e.target.value)}
                            maxLength={20}
                            placeholder={namingPet.name}
                            style={{
                              width: "100%", padding: "10px 14px", borderRadius: 10,
                              border: "1px solid rgba(124,92,191,0.4)", background: "rgba(255,255,255,0.07)",
                              color: "#fff", fontSize: 15, textAlign: "center", boxSizing: "border-box", marginBottom: 14,
                            }}
                            onKeyDown={e => e.key === "Enter" && confirmAddPet()}
                            autoFocus
                          />
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => { setNamingPet(null); setPetName(""); }} style={{
                              flex: 1, padding: "10px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)",
                              background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)", cursor: "pointer",
                            }}>Cancel</button>
                            <button onClick={confirmAddPet} style={{
                              flex: 1, padding: "10px", borderRadius: 10, border: "none",
                              background: "linear-gradient(135deg,#7c5cbf,#9d4edd)", color: "#fff",
                              fontWeight: 700, cursor: "pointer",
                            }}>Adopt!</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              // ── Visitor sidebar ──
              <div style={tabContent}>
                <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 16 }}>
                  Visiting <strong style={{ color: "#fff" }}>{username}</strong>&apos;s house
                </div>
                {config.pets.length > 0 && (
                  <>
                    <SectionLabel>Pets</SectionLabel>
                    {config.pets.map(op => {
                      const petDef = PETS.find(p => p.id === op.petId);
                      if (!petDef) return null;
                      return (
                        <div key={op.instanceId} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                          <span style={{ fontSize: 28 }}>{petDef.emoji}</span>
                          <div>
                            <div style={{ color: "#fff", fontSize: 13 }}>{op.name}</div>
                            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{petDef.name}</div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pet float animation */}
      <style>{`
        @keyframes petBob {
          0%, 100% { transform: translate(-50%, -50%) translateY(0); }
          50% { transform: translate(-50%, -50%) translateY(-8px); }
        }
      `}</style>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginTop: 4 }}>
      {children}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 2000,
  display: "flex", alignItems: "center", justifyContent: "center",
  backdropFilter: "blur(6px)",
};
const container: React.CSSProperties = {
  width: "min(1100px, 96vw)", height: "min(700px, 92vh)",
  background: "linear-gradient(160deg, #120d1e 0%, #1a1025 100%)",
  borderRadius: 20, border: "1px solid rgba(124,92,191,0.3)",
  boxShadow: "0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)",
  display: "flex", flexDirection: "column", overflow: "hidden", position: "relative",
};
const header: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)",
  background: "rgba(0,0,0,0.2)", flexShrink: 0,
};
const closeBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)",
  color: "#fff", padding: "8px 16px", borderRadius: 10, cursor: "pointer",
  fontSize: 13, fontWeight: 600, transition: "all 0.2s",
};
const roomStyle: React.CSSProperties = {
  flex: 1, position: "relative", overflow: "hidden",
  borderRight: "1px solid rgba(255,255,255,0.06)",
};
const sidebar: React.CSSProperties = {
  width: 280, flexShrink: 0, display: "flex", flexDirection: "column",
  background: "rgba(0,0,0,0.2)", position: "relative",
};
const tabContent: React.CSSProperties = {
  flex: 1, overflowY: "auto", padding: "0 14px 14px",
  scrollbarWidth: "thin", scrollbarColor: "rgba(124,92,191,0.3) transparent",
};
