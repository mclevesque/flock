"use client";
import { useState } from "react";

interface InvItem {
  id: string;
  name: string;
  emoji: string;
  rarity: string;
  slot?: string;
  effects?: { type: string; value: number }[];
  no_drop?: boolean;
  no_sell?: boolean;
  ability?: string;
}

const RARITY_COLORS: Record<string, string> = {
  common:    "#aaaaaa",
  uncommon:  "#4aee4a",
  rare:      "#4488ff",
  epic:      "#cc44ff",
  legendary: "#ffaa00",
};

const CLASS_EMOJI: Record<string, string> = {
  warrior: "⚔️",
  mage:    "🪄",
  archer:  "🏹",
  rogue:   "🗡️",
};

const CLASS_WEAPON_KEYWORDS: Record<string, string[]> = {
  warrior: ["sword", "axe", "blade", "greatsword", "hammer", "mace", "club", "longsword", "broadsword", "cleaver", "warhammer", "halberd"],
  archer:  ["bow", "shortbow", "crossbow", "recurve", "longbow", "quiver"],
  mage:    ["staff", "wand", "tome", "orb", "grimoire", "scepter", "rod", "crystal"],
  rogue:   ["dagger", "stiletto", "knife", "shiv", "dirk", "rapier", "shank", "fang"],
};

function getWeaponClassRestriction(itemName: string): string | null {
  const lower = itemName.toLowerCase();
  for (const [cls, keywords] of Object.entries(CLASS_WEAPON_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return cls;
  }
  return null;
}

function canEquipItem(item: InvItem, playerClass: string | null): boolean {
  if (item.slot !== "weapon") return true;
  const restriction = getWeaponClassRestriction(item.name);
  if (!restriction) return true;
  if (!playerClass) return true;
  return restriction === playerClass;
}

const SLOT_LABEL: Record<string, string> = {
  weapon: "Weapon", helm: "Head", secondary: "Off-Hand", boots: "Feet",
};

interface CharacterPanelProps {
  adventureStats: {
    class?: string | null;
    level?: number;
    hp?: number;
    max_hp?: number;
    base_attack?: number;
    xp?: number;
  } | null;
  backpack: InvItem[];
  equippedSlots: Record<string, InvItem | null>;
  username: string;
  myCoins: number;
  onClose: () => void;
  onEquipSlot: (slot: string, itemId: string | null) => void;
  onConsumeFunItem?: (item: InvItem) => void;
}

export default function CharacterPanel({
  adventureStats, backpack, equippedSlots,
  username, myCoins, onClose, onEquipSlot, onConsumeFunItem,
}: CharacterPanelProps) {
  const [hoveredItem, setHoveredItem] = useState<InvItem | null>(null);
  // Optimistic equipped map: slot → itemId (instantly reflects clicks before API round-trip)
  const [optimistic, setOptimistic] = useState<Record<string, string | null>>({});
  const [rejectId, setRejectId] = useState<string | null>(null);

  const level    = adventureStats?.level    ?? 1;
  const cls      = adventureStats?.class    ?? null;
  const hp       = adventureStats?.hp       ?? 100;
  const maxHp    = adventureStats?.max_hp   ?? 100;
  const attack   = adventureStats?.base_attack ?? 10;
  const xp       = adventureStats?.xp       ?? 0;
  const xpNeeded = level === 1 ? 40 : Math.round(60 + (level - 2) * 75);
  const classLabel = cls ? cls.charAt(0).toUpperCase() + cls.slice(1) : "Adventurer";
  const classEmoji = cls ? (CLASS_EMOJI[cls] ?? "⚔️") : "⚔️";

  // Merge server equipped_slots with optimistic local changes
  const effectiveEquipped: Record<string, string | null> = {};
  for (const [slot, item] of Object.entries(equippedSlots)) {
    effectiveEquipped[slot] = (item as InvItem | null)?.id ?? null;
  }
  for (const [slot, id] of Object.entries(optimistic)) {
    effectiveEquipped[slot] = id;
  }

  function isEquipped(item: InvItem): boolean {
    if (!item.slot) return false;
    return effectiveEquipped[item.slot] === item.id;
  }

  // Stat bonuses from equipped items (use server equippedSlots for reliable values)
  const attackBonus = Object.entries(effectiveEquipped).reduce((sum, [slot, id]) => {
    const item = backpack.find(i => i.id === id && i.slot === slot);
    const ef = item?.effects?.find(e => e.type === "attack_boost");
    return sum + (ef?.value ?? 0);
  }, 0);
  const hpBonus = Object.entries(effectiveEquipped).reduce((sum, [slot, id]) => {
    const item = backpack.find(i => i.id === id && i.slot === slot);
    const ef = item?.effects?.find(e => e.type === "hp_boost");
    return sum + (ef?.value ?? 0);
  }, 0);

  function handleItemClick(item: InvItem) {
    if (!item.slot) return;
    // Fun items: first click = equip (show above head), second click = consume
    if (item.slot === "fun") {
      const equipped = isEquipped(item);
      if (equipped) {
        // Second click = consume
        if (onConsumeFunItem) onConsumeFunItem(item);
        setOptimistic(p => ({ ...p, fun: null }));
      } else {
        // First click = equip to fun slot
        setOptimistic(p => ({ ...p, fun: item.id }));
        onEquipSlot("fun", item.id);
      }
      return;
    }
    const equipped = isEquipped(item);
    if (equipped) {
      // Unequip
      setOptimistic(p => ({ ...p, [item.slot!]: null }));
      onEquipSlot(item.slot, null);
    } else {
      if (!canEquipItem(item, cls)) {
        setRejectId(item.id);
        setTimeout(() => setRejectId(null), 400);
        return;
      }
      // Equip (replaces any other item in same slot)
      setOptimistic(p => ({ ...p, [item.slot!]: item.id }));
      onEquipSlot(item.slot, item.id);
    }
  }

  // Tooltip component
  function Tooltip({ item }: { item: InvItem }) {
    const color = RARITY_COLORS[item.rarity] ?? "#aaa";
    const restriction = item.slot === "weapon" ? getWeaponClassRestriction(item.name) : null;
    const compatible = canEquipItem(item, cls);
    const equipped = isEquipped(item);
    return (
      <div style={{
        position: "absolute", zIndex: 10000, pointerEvents: "none",
        bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
        background: "#0c0018", border: `1px solid ${color}77`,
        borderRadius: 10, padding: "8px 12px", minWidth: 148,
        boxShadow: `0 4px 24px rgba(0,0,0,0.8), 0 0 8px ${color}33`,
        whiteSpace: "nowrap",
      }}>
        <div style={{ fontSize: 11, fontWeight: 900, color, marginBottom: 3 }}>{item.emoji} {item.name}</div>
        <div style={{ fontSize: 9, color, opacity: 0.65, textTransform: "uppercase", fontFamily: "monospace", marginBottom: 4 }}>
          {item.rarity}{item.slot ? ` · ${SLOT_LABEL[item.slot] ?? item.slot}` : ""}
        </div>
        {item.effects?.map((ef, i) => (
          <div key={i} style={{ fontSize: 10, color: "rgba(255,255,255,0.65)" }}>
            +{ef.value} {ef.type.replace(/_/g, " ")}
          </div>
        ))}
        {item.ability && (
          <div style={{ fontSize: 9, color: "#ffd700", marginTop: 3 }}>✨ {item.ability.replace(/_/g, " ")}</div>
        )}
        {restriction && (
          <div style={{ fontSize: 9, marginTop: 4, color: compatible ? "#4aee4a" : "#ff6666", fontFamily: "monospace" }}>
            {compatible ? `✓ ${restriction} weapon` : `✗ requires ${restriction}`}
          </div>
        )}
        {item.slot === "fun" ? (
          <div style={{ fontSize: 9, color: equipped ? "#ffd700" : "rgba(255,200,50,0.7)", marginTop: 4, fontFamily: "monospace" }}>
            {equipped ? "🎯 click to use/consume" : "click to hold above your head"}
          </div>
        ) : item.slot && (
          <div style={{ fontSize: 9, color: equipped ? "#44ff88" : "rgba(180,140,255,0.55)", marginTop: 4, fontFamily: "monospace" }}>
            {equipped ? "✓ equipped — click to unequip" : compatible ? "click to equip →" : "wrong class"}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%     { transform: translateX(-5px); }
          40%     { transform: translateX(5px); }
          60%     { transform: translateX(-4px); }
          80%     { transform: translateX(4px); }
        }
        @keyframes equip-pop {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.18); }
          100% { transform: scale(1); }
        }
      `}</style>

      <div
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 350,
          display: "flex", alignItems: "center", justifyContent: "center" }}
        onClick={onClose}
      >
        <div
          style={{
            background: "linear-gradient(160deg, #0b0015 0%, #07000f 100%)",
            border: "2px solid rgba(150,70,255,0.3)",
            borderRadius: 18,
            width: "min(460px, 97vw)",
            boxShadow: "0 0 100px rgba(120,50,255,0.18)",
            display: "flex", flexDirection: "column",
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div style={{
            background: "linear-gradient(90deg, rgba(110,40,220,0.25), transparent)",
            borderBottom: "1px solid rgba(150,70,255,0.18)",
            padding: "12px 20px",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 22 }}>{classEmoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#cc88ff", letterSpacing: 2, textTransform: "uppercase" }}>Character</div>
              <div style={{ fontSize: 10, color: "rgba(200,140,255,0.5)", fontFamily: "monospace" }}>
                @{username} · {classLabel} · Level {level}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 20, cursor: "pointer" }}
            >✕</button>
          </div>

          {/* ── Stats strip ── */}
          <div style={{
            padding: "10px 20px",
            borderBottom: "1px solid rgba(150,70,255,0.1)",
            display: "flex", flexWrap: "wrap", gap: "6px 18px",
          }}>
            {[
              { label: "HP",     val: `${hp}${hpBonus > 0 ? ` +${hpBonus}` : ""}/${maxHp}`, color: "#ff8888" },
              { label: "ATK",    val: `${attack}${attackBonus > 0 ? ` +${attackBonus}` : ""}`, color: "#ffcc44" },
              { label: "Level",  val: String(level), color: "#cc88ff" },
              { label: "Gold",   val: `🪙 ${myCoins.toLocaleString()}`, color: "#ffd700" },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", gap: 4, alignItems: "baseline" }}>
                <span style={{ fontSize: 8, color: "rgba(200,140,255,0.4)", fontFamily: "monospace", textTransform: "uppercase" }}>{s.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.val}</span>
              </div>
            ))}
            {/* XP bar */}
            <div style={{ width: "100%", display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 8, color: "rgba(200,140,255,0.4)", fontFamily: "monospace" }}>XP {xp}/{xpNeeded}</span>
              <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100, (xp / xpNeeded) * 100)}%`, background: "linear-gradient(90deg, #5522bb, #aa55ff)", transition: "width 0.4s" }} />
              </div>
            </div>
          </div>

          {/* ── Backpack ── */}
          <div style={{ padding: "14px 20px 18px" }}>
            <div style={{ fontSize: 9, color: "rgba(200,140,255,0.4)", fontFamily: "monospace", letterSpacing: 2, marginBottom: 10 }}>
              🎒 BACKPACK ({backpack.length}/8)
              <span style={{ marginLeft: 8, opacity: 0.7, color: "#44ff88" }}>click to equip · click again to unequip</span>
              <span style={{ marginLeft: 6, opacity: 0.7, color: "#ffaa33" }}>· 🎪 fun items: hold → use</span>
            </div>

            {/* 4×2 grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {Array.from({ length: 8 }).map((_, i) => {
                const item = backpack[i] as InvItem | undefined;
                const equipped = item ? isEquipped(item) : false;
                const compatible = item ? canEquipItem(item, cls) : true;
                const isHov = !!(item && hoveredItem?.id === item.id);
                const isRejecting = !!(item && rejectId === item.id);
                const isFunItem = item?.slot === "fun";
                const color = item ? (isFunItem ? "#ffaa33" : (RARITY_COLORS[item.rarity] ?? "#aaa")) : undefined;

                let borderColor = "rgba(255,255,255,0.07)";
                if (equipped && isFunItem) borderColor = "#ffd700";
                else if (equipped)       borderColor = "#44ff88";
                else if (isHov && item) borderColor = color ?? "#888";
                else if (item)      borderColor = `${color}50`;

                return (
                  <div
                    key={i}
                    onMouseEnter={() => item && setHoveredItem(item)}
                    onMouseLeave={() => setHoveredItem(null)}
                    onClick={() => item && handleItemClick(item)}
                    style={{
                      aspectRatio: "1",
                      background: equipped && isFunItem
                        ? "rgba(120,80,0,0.3)"
                        : equipped
                        ? "rgba(30,120,50,0.25)"
                        : item ? `${color}10` : "rgba(0,0,0,0.4)",
                      border: `2px solid ${borderColor}`,
                      borderRadius: 10,
                      display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center", gap: 3,
                      cursor: item?.slot === "fun" ? "pointer" : item?.slot ? (compatible ? "pointer" : "not-allowed") : "default",
                      transition: "border-color 0.12s, background 0.18s",
                      boxShadow: equipped
                        ? "0 0 12px rgba(40,220,80,0.35)"
                        : isHov && item ? `0 0 10px ${color}44` : "none",
                      position: "relative",
                      opacity: item && !compatible ? 0.45 : 1,
                      animation: isRejecting ? "shake 0.35s ease" : equipped ? "equip-pop 0.25s ease" : "none",
                      userSelect: "none",
                    }}
                  >
                    {item ? (
                      <>
                        <span style={{ fontSize: 26, lineHeight: 1 }}>{item.emoji}</span>
                        <span style={{ fontSize: 7, color: equipped && isFunItem ? "#ffd700" : equipped ? "#44ff88" : color, fontFamily: "monospace", textTransform: "uppercase" }}>
                          {isFunItem ? "fun" : item.rarity.slice(0, 3)}
                        </span>
                        <span style={{ fontSize: 7, color: "rgba(255,255,255,0.45)", textAlign: "center", lineHeight: 1.2, padding: "0 2px" }}>
                          {item.name.length > 10 ? item.name.slice(0, 10) + "…" : item.name}
                        </span>
                        {/* Equipped checkmark badge */}
                        {equipped && (
                          <div style={{
                            position: "absolute", top: 3, right: 4,
                            fontSize: 9, color: isFunItem ? "#ffd700" : "#44ff88", fontWeight: 900,
                          }}>{isFunItem ? "👆" : "✓"}</div>
                        )}
                        {/* Class-restricted badge */}
                        {item.slot === "weapon" && !compatible && (
                          <div style={{ position: "absolute", top: 3, right: 4, fontSize: 9, color: "#ff6666" }}>✗</div>
                        )}
                        {isHov && <Tooltip item={item} />}
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {/* Equipped summary */}
            {Object.values(effectiveEquipped).some(v => v) && (
              <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {Object.entries(effectiveEquipped).map(([slot, id]) => {
                  if (!id) return null;
                  const item = backpack.find(i => i.id === id);
                  if (!item) return null;
                  const isFun = slot === "fun";
                  return (
                    <div key={slot} style={{
                      background: isFun ? "rgba(120,80,0,0.2)" : "rgba(30,120,50,0.2)",
                      border: `1px solid ${isFun ? "rgba(255,200,50,0.4)" : "rgba(40,220,80,0.4)"}`,
                      borderRadius: 6, padding: "2px 8px", fontSize: 10, color: isFun ? "#ffd700" : "#44ff88",
                      fontFamily: "monospace", display: "flex", alignItems: "center", gap: 4,
                    }}>
                      <span>{item.emoji}</span>
                      <span style={{ opacity: 0.7, fontSize: 9 }}>{isFun ? "holding" : (SLOT_LABEL[slot] ?? slot)}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {backpack.length === 0 && (
              <div style={{ marginTop: 12, textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 12, fontStyle: "italic" }}>
                Backpack empty — go on an adventure to find items!
              </div>
            )}

            <div style={{ marginTop: 14, background: "rgba(255,200,50,0.06)", border: "1px solid rgba(255,200,50,0.15)", borderRadius: 8, padding: "8px 12px", fontSize: 10, color: "rgba(255,200,50,0.5)", fontFamily: "monospace" }}>
              🗄️ <strong style={{ color: "rgba(255,200,50,0.75)" }}>Stash</strong> — walk up to the golden chest and click it. Items in stash must be moved to backpack before equipping.
            </div>
          </div>

          <div style={{ padding: "6px 20px 12px", fontSize: 9, color: "rgba(255,255,255,0.1)", fontFamily: "monospace", textAlign: "center" }}>
            Press C to close · Green = equipped · Red ✗ = wrong class
          </div>
        </div>
      </div>
    </>
  );
}
