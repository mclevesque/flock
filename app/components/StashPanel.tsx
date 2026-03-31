"use client";
import { useState, useRef, useEffect, useCallback } from "react";

interface AdventureItem {
  id: string;
  name: string;
  emoji: string;
  rarity: string;
  slot?: string;
  effects: { type: string; value: number }[];
  obtained: string;
  no_drop?: boolean;
  no_sell?: boolean;
  ability?: string;
}

interface EquippedSlots {
  weapon?: AdventureItem | null;
  helm?: AdventureItem | null;
  secondary?: AdventureItem | null;
  boots?: AdventureItem | null;
}

interface StashPanelProps {
  stashItems: AdventureItem[];
  inventoryItems: AdventureItem[];
  equippedSlots: EquippedSlots;
  coins: number;
  onClose: () => void;
  onEquip: (slot: string, itemId: string | null) => void;
  onDeposit: (itemId: string) => void;
  onWithdraw: (itemId: string) => void;
  onDrop: (itemId: string) => void; // kept for API compat, no ground-drop UI
  onSell: (itemId: string) => void;
  onUseAbility?: (ability: string, itemId: string) => void;
}

const RARITY_COLORS: Record<string, string> = {
  common: "#888",
  uncommon: "#4caf50",
  rare: "#2196f3",
  epic: "#9c27b0",
  legendary: "#ffd700",
};

const SLOT_LABELS: Record<string, string> = {
  weapon: "⚔️ Weapon",
  helm: "🎩 Helm",
  secondary: "🛡️ Secondary",
  boots: "👟 Boots",
};

const ANIM_STYLE = `
@keyframes schwoopIn {
  0%   { transform: scale(0.35) rotate(-8deg); opacity: 0; }
  60%  { transform: scale(1.18) rotate(2deg);  opacity: 1; }
  80%  { transform: scale(0.94) rotate(-1deg); }
  100% { transform: scale(1)    rotate(0deg);  opacity: 1; }
}
@keyframes schwoopOut {
  0%   { transform: scale(1);    opacity: 1; }
  100% { transform: scale(0.1);  opacity: 0; }
}
`;

export default function StashPanel({
  stashItems,
  inventoryItems,
  equippedSlots,
  coins,
  onClose,
  onEquip,
  onDeposit,
  onWithdraw,
  onSell,
  onUseAbility,
}: StashPanelProps) {
  const [activeTab, setActiveTab] = useState<0 | 1>(0);
  const [dragOverZone, setDragOverZone] = useState<"stash" | "backpack" | string | null>(null);
  const [abilityCooldowns, setAbilityCooldowns] = useState<Record<string, number>>({});

  const [localStash, setLocalStash] = useState<AdventureItem[]>(Array.isArray(stashItems) ? stashItems : []);
  const [localInventory, setLocalInventory] = useState<AdventureItem[]>(Array.isArray(inventoryItems) ? inventoryItems : []);

  const [arrivedIds, setArrivedIds] = useState<Set<string>>(new Set());
  const [leavingIds, setLeavingIds] = useState<Set<string>>(new Set());

  // Sell confirmation state
  const [sellConfirm, setSellConfirm] = useState<{ item: AdventureItem; confirmText: string } | null>(null);
  const [sellInput, setSellInput] = useState("");

  const pendingMoves = useRef<Set<string>>(new Set());
  const draggingId = useRef<string | null>(null);
  const draggingSource = useRef<"stash" | "inventory" | "slot" | null>(null);

  useEffect(() => {
    setLocalStash(prev => pendingMoves.current.size > 0 ? prev : stashItems);
    setLocalInventory(prev => pendingMoves.current.size > 0 ? prev : inventoryItems);
  }, [stashItems, inventoryItems]);

  const [hovered, setHovered] = useState<AdventureItem | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });

  const markArrived = (id: string) => {
    setArrivedIds(s => new Set([...s, id]));
    setTimeout(() => setArrivedIds(s => { const n = new Set(s); n.delete(id); return n; }), 500);
  };

  const markLeaving = (id: string, then: () => void) => {
    setLeavingIds(s => new Set([...s, id]));
    setTimeout(() => {
      setLeavingIds(s => { const n = new Set(s); n.delete(id); return n; });
      then();
    }, 180);
  };

  const depositItem = useCallback((itemId: string) => {
    const item = localInventory.find(i => i.id === itemId);
    if (!item) return;
    pendingMoves.current.add(itemId);
    markLeaving(itemId, () => {
      setLocalInventory(prev => prev.filter(i => i.id !== itemId));
      setLocalStash(prev => prev.length < 50 ? [...prev, item] : prev);
      markArrived(itemId);
      setTimeout(() => pendingMoves.current.delete(itemId), 1500);
    });
    onDeposit(itemId);
  }, [localInventory, onDeposit]);

  const withdrawItem = useCallback((itemId: string) => {
    const item = localStash.find(i => i.id === itemId);
    if (!item) return;
    pendingMoves.current.add(itemId);
    markLeaving(itemId, () => {
      setLocalStash(prev => prev.filter(i => i.id !== itemId));
      setLocalInventory(prev => prev.length < 8 ? [...prev, item] : prev);
      markArrived(itemId);
      setTimeout(() => pendingMoves.current.delete(itemId), 1500);
    });
    onWithdraw(itemId);
  }, [localStash, onWithdraw]);

  const handleSellClick = (item: AdventureItem) => {
    if (item.no_sell) return;
    if (item.rarity === "epic" || item.rarity === "legendary") {
      const expected = item.rarity === "legendary" ? "LEGENDARY" : "EPIC";
      setSellConfirm({ item, confirmText: expected });
      setSellInput("");
    } else {
      // Direct sell
      setLocalStash(prev => prev.filter(i => i.id !== item.id));
      setLocalInventory(prev => prev.filter(i => i.id !== item.id));
      onSell(item.id);
    }
  };

  const confirmSell = () => {
    if (!sellConfirm) return;
    setLocalStash(prev => prev.filter(i => i.id !== sellConfirm.item.id));
    setLocalInventory(prev => prev.filter(i => i.id !== sellConfirm.item.id));
    onSell(sellConfirm.item.id);
    setSellConfirm(null);
    setSellInput("");
  };

  const formatEffect = (e: { type: string; value: number }) => {
    const labels: Record<string, string> = {
      attack_boost: "⚔️ Attack", hp_boost: "❤️ HP",
      defense: "🛡️ Defense", crit_chance: "🎯 Crit", special_power: "✨ Power",
    };
    return `+${e.value} ${labels[e.type] ?? e.type}`;
  };

  const SELL_PRICES: Record<string, number> = { common: 50, uncommon: 100, rare: 500, epic: 10000, legendary: 1000000000 };

  const renderItem = (item: AdventureItem, source: "stash" | "inventory") => {
    const color = RARITY_COLORS[item.rarity ?? ""] ?? "#888";
    const isLeaving = leavingIds.has(item.id);
    const isArriving = arrivedIds.has(item.id);
    const handleClick = () => source === "stash" ? withdrawItem(item.id) : depositItem(item.id);
    const hasAbility = !!(item.ability && onUseAbility);
    const cdExpiry = abilityCooldowns[item.id] ?? 0;
    const onCd = Date.now() < cdExpiry;
    const cdSec = onCd ? Math.ceil((cdExpiry - Date.now()) / 1000) : 0;
    const sellPrice = SELL_PRICES[item.rarity] ?? 50;
    const canSell = !item.no_sell;

    return (
      <div
        key={item.id}
        draggable={!isLeaving}
        onDragStart={e => {
          const ghost = document.createElement("div");
          ghost.style.cssText = "width:52px;height:52px;background:#1a1a2e;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:24px;position:fixed;top:-100px;";
          ghost.textContent = item.emoji;
          document.body.appendChild(ghost);
          e.dataTransfer.setDragImage(ghost, 26, 26);
          setTimeout(() => ghost.remove(), 0);
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("itemId", item.id);
          e.dataTransfer.setData("source", source);
          draggingId.current = item.id;
          draggingSource.current = source;
        }}
        onDragEnd={() => { draggingId.current = null; draggingSource.current = null; }}
        style={{
          width: 52, height: hasAbility ? 72 : 52,
          border: `2px solid ${color}`,
          borderRadius: 6,
          background: "#1a1a2e",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24,
          cursor: isLeaving ? "default" : "grab",
          position: "relative",
          flexDirection: "column",
          boxShadow: item.rarity === "legendary" ? `0 0 10px ${color}` : undefined,
          animation: isArriving ? "schwoopIn 0.42s cubic-bezier(.22,1.2,.36,1) forwards"
                   : isLeaving  ? "schwoopOut 0.18s ease-in forwards"
                   : undefined,
          opacity: isLeaving ? 0.5 : 1,
          transition: isArriving || isLeaving ? undefined : "transform 0.1s",
        }}
        onMouseEnter={e => {
          setHovered(item);
          setHoverPos({ x: e.clientX + 12, y: e.clientY - 12 });
          if (!isLeaving) (e.currentTarget as HTMLDivElement).style.transform = "scale(1.08)";
        }}
        onMouseLeave={e => {
          setHovered(null);
          (e.currentTarget as HTMLDivElement).style.transform = "scale(1)";
        }}
        onClick={handleClick}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, position: "relative", width: "100%" }}>
          {item.emoji}
          <div style={{ position: "absolute", bottom: 1, right: 3, fontSize: 8, color, fontWeight: "bold", textTransform: "uppercase" }}>
            {item.rarity === "legendary" ? "LEG" : (item.rarity ?? "itm").slice(0, 3)}
          </div>
          {canSell && (
            <div
              onClick={e => { e.stopPropagation(); handleSellClick(item); }}
              title={`Sell for ${sellPrice.toLocaleString()} 🪙`}
              style={{
                position: "absolute", top: 1, right: 1,
                fontSize: 7, background: "rgba(0,0,0,0.6)", color: "#ffd700",
                borderRadius: 3, padding: "1px 3px", cursor: "pointer",
                lineHeight: 1.2,
              }}
            >💰</div>
          )}
        </div>
        {hasAbility && (
          <div
            onClick={e => {
              e.stopPropagation();
              if (onCd) return;
              onUseAbility!(item.ability!, item.id);
              const expiry = Date.now() + 12000;
              setAbilityCooldowns(prev => ({ ...prev, [item.id]: expiry }));
              setTimeout(() => setAbilityCooldowns(prev => { const n = { ...prev }; delete n[item.id]; return n; }), 12000);
            }}
            style={{
              width: "100%", height: 20,
              background: onCd ? "rgba(60,60,60,0.7)" : "rgba(0,200,80,0.25)",
              borderTop: `1px solid ${onCd ? "#444" : "#00cc55"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 8, fontWeight: 700,
              color: onCd ? "#666" : "#00ff88",
              cursor: onCd ? "not-allowed" : "pointer",
              letterSpacing: 0.3,
              borderRadius: "0 0 4px 4px",
              boxShadow: onCd ? "none" : "0 0 6px rgba(0,255,100,0.4) inset",
            }}
          >
            {onCd ? `⏳${cdSec}s` : "✨ USE"}
          </div>
        )}
      </div>
    );
  };

  const renderEmptySlot = (key: number, isDropTarget: boolean) => (
    <div key={key} style={{
      width: 52, height: 52,
      border: isDropTarget ? "2px dashed #ffd700" : "2px solid #333",
      borderRadius: 6,
      background: isDropTarget ? "rgba(255,215,0,0.05)" : "#0d0d1a",
      transition: "border-color 0.12s, background 0.12s",
    }} />
  );

  const makeGridProps = (zone: "stash" | "backpack") => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverZone(zone); },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverZone(null);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverZone(null);
      const itemId = e.dataTransfer.getData("itemId");
      const source = e.dataTransfer.getData("source") as "stash" | "inventory";
      if (!itemId) return;
      if (zone === "stash" && source === "inventory") depositItem(itemId);
      else if (zone === "backpack" && source === "stash") withdrawItem(itemId);
    },
  });

  const tab0Items = localStash.slice(0, 25);
  const tab1Items = localStash.slice(25, 50);
  const activeTabItems = activeTab === 0 ? tab0Items : tab1Items;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <style>{ANIM_STYLE}</style>

      {/* Sell confirmation modal */}
      {sellConfirm && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10001,
          background: "rgba(0,0,0,0.85)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setSellConfirm(null)}>
          <div style={{
            background: "#1a0a2e",
            border: `2px solid ${RARITY_COLORS[sellConfirm.item.rarity]}`,
            borderRadius: 12,
            padding: 28, maxWidth: 340, textAlign: "center",
            color: "#eee", fontFamily: "monospace",
            boxShadow: `0 0 30px ${RARITY_COLORS[sellConfirm.item.rarity]}66`,
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{sellConfirm.item.emoji}</div>
            <div style={{ color: RARITY_COLORS[sellConfirm.item.rarity], fontWeight: "bold", fontSize: 16, marginBottom: 4 }}>
              Selling {sellConfirm.item.name}
            </div>
            <div style={{ color: "#aaa", fontSize: 12, marginBottom: 16 }}>
              Type <strong style={{ color: "#fff" }}>{sellConfirm.confirmText}</strong> to confirm selling for{" "}
              <span style={{ color: "#ffd700" }}>
                {(SELL_PRICES[sellConfirm.item.rarity] ?? 50).toLocaleString()} 🪙
              </span>
            </div>
            <input
              autoFocus
              value={sellInput}
              onChange={e => setSellInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && sellInput === sellConfirm.confirmText) confirmSell(); }}
              placeholder={`Type ${sellConfirm.confirmText}`}
              style={{
                background: "#0d0d1a", border: "1px solid #555",
                color: sellInput === sellConfirm.confirmText ? "#00ff88" : "#eee",
                borderRadius: 6, padding: "8px 12px", fontSize: 14,
                width: "100%", boxSizing: "border-box", marginBottom: 12,
                fontFamily: "monospace", textAlign: "center",
                outline: sellInput === sellConfirm.confirmText ? "1px solid #00ff88" : undefined,
              }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button onClick={() => setSellConfirm(null)} style={{
                background: "#1a1a2e", border: "1px solid #555", color: "#aaa",
                padding: "7px 18px", borderRadius: 6, cursor: "pointer", fontFamily: "monospace",
              }}>Cancel</button>
              <button
                disabled={sellInput !== sellConfirm.confirmText}
                onClick={confirmSell}
                style={{
                  background: sellInput === sellConfirm.confirmText ? "#00aa44" : "#1a1a2e",
                  border: `1px solid ${sellInput === sellConfirm.confirmText ? "#00ff88" : "#333"}`,
                  color: sellInput === sellConfirm.confirmText ? "#fff" : "#444",
                  padding: "7px 18px", borderRadius: 6,
                  cursor: sellInput === sellConfirm.confirmText ? "pointer" : "not-allowed",
                  fontFamily: "monospace", fontWeight: "bold",
                }}
              >💰 Sell</button>
            </div>
          </div>
        </div>
      )}

      <div style={{
        background: "#12121f",
        border: "2px solid #ffd700",
        borderRadius: 12,
        padding: 20,
        width: 780,
        maxHeight: "90vh",
        overflowY: "auto",
        color: "#eee",
        fontFamily: "monospace",
        boxShadow: "0 0 30px rgba(255,215,0,0.3)",
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <span style={{ fontSize: 18, fontWeight: "bold" }}>🗄️ Stash &amp; 🎒 Backpack</span>
            <span style={{ marginLeft: 14, color: "#ffd700", fontSize: 13 }}>🪙 {coins.toLocaleString()}</span>
            <span style={{ marginLeft: 10, color: "#555", fontSize: 10 }}>Click or drag to move · 💰 icon to sell at vendor</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #555", color: "#aaa", padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}>✕ Close</button>
        </div>

        <div style={{ display: "flex", gap: 12 }}>

          {/* Stash grid with 2 tabs */}
          <div style={{ flex: "0 0 auto" }}>
            {/* Tab buttons */}
            <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
              {([0, 1] as const).map(tab => {
                const tabItems = tab === 0 ? tab0Items : tab1Items;
                return (
                  <button key={tab} onClick={() => setActiveTab(tab)} style={{
                    background: activeTab === tab ? "#ffd700" : "#1a1a2e",
                    color: activeTab === tab ? "#000" : "#888",
                    border: "1px solid #ffd700",
                    borderRadius: "6px 6px 0 0",
                    padding: "4px 10px", fontSize: 10, cursor: "pointer",
                    fontFamily: "monospace", fontWeight: "bold",
                  }}>
                    📦 Stash {tab + 1} ({tabItems.length}/25)
                  </button>
                );
              })}
            </div>
            <div
              {...makeGridProps("stash")}
              style={{
                display: "grid", gridTemplateColumns: "repeat(5, 52px)", gap: 6,
                padding: 8, borderRadius: "0 8px 8px 8px",
                border: dragOverZone === "stash" ? "2px dashed #ffd700" : "2px solid rgba(255,215,0,0.15)",
                background: dragOverZone === "stash" ? "rgba(255,215,0,0.06)" : "rgba(255,255,255,0.01)",
                transition: "border-color 0.12s, background 0.12s",
              }}
            >
              {activeTabItems.map(item => renderItem(item, "stash"))}
              {Array.from({ length: Math.max(0, 25 - activeTabItems.length) }).map((_, i) =>
                renderEmptySlot(i, dragOverZone === "stash")
              )}
            </div>
            <div style={{ fontSize: 9, color: "#444", marginTop: 4 }}>Click item → moves to Backpack</div>
          </div>

          {/* Backpack grid (8 slots, 2 cols) */}
          <div style={{ flex: "0 0 auto" }}>
            <div style={{ fontSize: 11, color: "#aa88ff", fontWeight: 700, marginBottom: 6 }}>
              🎒 Backpack ({localInventory.length}/8)
            </div>
            <div
              {...makeGridProps("backpack")}
              style={{
                display: "grid", gridTemplateColumns: "repeat(2, 52px)", gap: 6,
                padding: 8, borderRadius: 8,
                border: dragOverZone === "backpack" ? "2px dashed #aa88ff" : "2px solid rgba(170,136,255,0.15)",
                background: dragOverZone === "backpack" ? "rgba(170,136,255,0.06)" : "rgba(255,255,255,0.01)",
                transition: "border-color 0.12s, background 0.12s",
              }}
            >
              {localInventory.map(item => renderItem(item, "inventory"))}
              {Array.from({ length: Math.max(0, 8 - localInventory.length) }).map((_, i) =>
                renderEmptySlot(i, dragOverZone === "backpack")
              )}
            </div>
            <div style={{ fontSize: 9, color: "#444", marginTop: 4 }}>Click item → moves to Stash</div>
          </div>

          {/* Equipment Slots */}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: "bold", marginBottom: 8, color: "#ffd700", fontSize: 12 }}>⚔️ Equipment</div>
            {(["weapon", "helm", "secondary", "boots"] as const).map(slot => {
              const equipped = equippedSlots[slot];
              const isOver = dragOverZone === slot;
              const color = equipped ? (RARITY_COLORS[equipped.rarity] ?? "#888") : (isOver ? "#ffd700" : "#333");
              return (
                <div
                  key={slot}
                  draggable={!!equipped}
                  onDragStart={equipped ? e => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("itemId", equipped.id);
                    e.dataTransfer.setData("source", "slot");
                    e.dataTransfer.setData("fromSlot", slot);
                    draggingSource.current = "slot";
                  } : undefined}
                  onDragEnd={() => { draggingId.current = null; draggingSource.current = null; }}
                  onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverZone(slot); }}
                  onDragLeave={() => setDragOverZone(null)}
                  onDrop={e => {
                    e.preventDefault();
                    setDragOverZone(null);
                    const itemId = e.dataTransfer.getData("itemId");
                    const source = e.dataTransfer.getData("source");
                    if (!itemId) return;
                    if (source === "slot") {
                      const fromSlot = e.dataTransfer.getData("fromSlot");
                      if (fromSlot && fromSlot !== slot) onEquip(fromSlot, null);
                      return;
                    }
                    onEquip(slot, itemId);
                  }}
                  style={{
                    border: `${isOver ? "2px dashed" : "1px solid"} ${color}`,
                    borderRadius: 8,
                    padding: "7px 10px",
                    marginBottom: 7,
                    background: isOver ? "rgba(255,215,0,0.1)" : "#0d0d1a",
                    display: "flex", alignItems: "center", gap: 8,
                    fontSize: 12,
                    cursor: equipped ? "grab" : "default",
                    transition: "border-color 0.12s, background 0.12s, transform 0.1s",
                    transform: isOver ? "scale(1.03)" : "scale(1)",
                  }}>
                  <span style={{ fontSize: 20, minWidth: 26 }}>{equipped ? equipped.emoji : "—"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#555", fontSize: 9 }}>{SLOT_LABELS[slot]}</div>
                    {equipped
                      ? <div style={{ color, fontSize: 10, fontWeight: 600 }}>{equipped.name}</div>
                      : <div style={{ color: isOver ? "#ffd700" : "#333", fontSize: 10 }}>{isOver ? "✨ Drop!" : "Empty"}</div>}
                  </div>
                  {equipped && (
                    <button onClick={() => onEquip(slot, null)} style={{
                      background: "none", border: "1px solid #444", color: "#666",
                      fontSize: 9, padding: "1px 5px", borderRadius: 4, cursor: "pointer",
                    }}>✕</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {hovered && (
        <div style={{
          position: "fixed",
          left: Math.min(hoverPos.x, window.innerWidth - 220),
          top: Math.max(8, hoverPos.y - 10),
          background: "#1a1a2e",
          border: `1px solid ${RARITY_COLORS[hovered.rarity] ?? "#444"}`,
          borderRadius: 10,
          padding: "10px 14px",
          zIndex: 10000,
          pointerEvents: "none",
          maxWidth: 210,
          fontSize: 12, color: "#eee",
          boxShadow: `0 4px 24px rgba(0,0,0,0.7), 0 0 8px ${RARITY_COLORS[hovered.rarity] ?? "transparent"}33`,
        }}>
          <div style={{ fontWeight: "bold", color: RARITY_COLORS[hovered.rarity], marginBottom: 4, fontSize: 13 }}>
            {hovered.emoji} {hovered.name}
          </div>
          <div style={{ color: "#666", fontSize: 9, textTransform: "uppercase", marginBottom: 8, letterSpacing: 1 }}>
            {hovered.rarity} {hovered.slot ?? "item"}
          </div>
          {(hovered.effects ?? []).map((e, i) => (
            <div key={i} style={{ color: "#7fc", fontSize: 11, marginBottom: 2 }}>{formatEffect(e)}</div>
          ))}
          {hovered.ability && <div style={{ color: "#00ff88", fontSize: 10, marginTop: 6 }}>✨ {hovered.ability.replace(/_/g, " ")} — click USE on item</div>}
          {!hovered.no_sell && <div style={{ color: "#ffd700", fontSize: 10, marginTop: 4 }}>💰 Sell: {(SELL_PRICES[hovered.rarity] ?? 50).toLocaleString()} gold</div>}
          {hovered.no_sell && <div style={{ color: "#555", fontSize: 10, marginTop: 4 }}>Cannot sell</div>}
          {hovered.obtained && <div style={{ color: "#555", fontSize: 9, marginTop: 6 }}>From: {hovered.obtained}</div>}
        </div>
      )}
    </div>
  );
}
