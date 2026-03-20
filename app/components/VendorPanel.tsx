"use client";
import { useState } from "react";

interface VendorItem {
  id: string;
  name: string;
  emoji: string;
  rarity: string;
  slot: string;
  effects: { type: string; value: number }[];
  price: number;
}

interface InvItem {
  id: string;
  name: string;
  emoji: string;
  rarity: string;
  slot?: string;
  effects: { type: string; value: number }[];
  no_sell?: boolean;
}

interface VendorPanelProps {
  stock: VendorItem[];
  inventoryItems: InvItem[];
  stashItems: InvItem[];
  coins: number;
  onClose: () => void;
  onBuy: (index: number) => void;
  onSellItem: (itemId: string) => void;
}

const RARITY_COLORS: Record<string, string> = {
  common: "#888", uncommon: "#4caf50", rare: "#2196f3", epic: "#9c27b0", legendary: "#ffd700",
};

const SELL_PRICES: Record<string, number> = {
  common: 50, uncommon: 100, rare: 500, epic: 10000, legendary: 1000000000,
};

const SLOT_LABELS: Record<string, string> = {
  weapon: "⚔️ Weapon", helm: "🎩 Helm", secondary: "🛡️ Secondary", boots: "👟 Boots",
};

function formatSellPrice(rarity: string): string {
  const p = SELL_PRICES[rarity];
  if (!p) return "?";
  if (p >= 1_000_000_000) return "1b";
  if (p >= 1_000) return `${(p / 1000).toFixed(0)}k`;
  return String(p);
}

export default function VendorPanel({ stock, inventoryItems, stashItems, coins, onClose, onBuy, onSellItem }: VendorPanelProps) {
  const [confirmSell, setConfirmSell] = useState<InvItem | null>(null);
  const [sellTab, setSellTab] = useState<"backpack" | "stash">("backpack");

  const formatEffect = (e: { type: string; value: number }) => {
    const labels: Record<string, string> = { attack_boost: "⚔️ Attack", hp_boost: "❤️ HP", defense: "🛡️ Defense" };
    return `+${e.value} ${labels[e.type] ?? e.type}`;
  };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
  const msUntil = tomorrow.getTime() - Date.now();
  const hoursLeft = Math.floor(msUntil / 3600000);
  const minsLeft  = Math.floor((msUntil % 3600000) / 60000);

  const sellItems = sellTab === "backpack" ? inventoryItems : stashItems;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.78)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={() => { onClose(); setConfirmSell(null); }}>
      <div style={{
        background: "#12121f",
        border: "2px solid #ffc107",
        borderRadius: 12, padding: 20,
        width: "min(720px, 97vw)", maxHeight: "92vh",
        overflowY: "auto",
        color: "#eee", fontFamily: "monospace",
        boxShadow: "0 0 30px rgba(255,193,7,0.2)",
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 20, fontWeight: "bold" }}>🛒 Wandering Vendor</span>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ color: "#ffd700", fontSize: 13 }}>🪙 {coins.toLocaleString()}</span>
            <button onClick={onClose} style={{ background: "none", border: "1px solid #555", color: "#aaa", padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}>✕</button>
          </div>
        </div>
        <div style={{ color: "#888", fontSize: 11, marginBottom: 16 }}>
          "Finest wares in the realm!" • Stock refreshes in {hoursLeft}h {minsLeft}m
        </div>

        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>

          {/* ── LEFT: Buy section ── */}
          <div style={{ flex: "1 1 280px" }}>
            <div style={{ fontSize: 11, fontWeight: "bold", color: "#ffc107", marginBottom: 10, letterSpacing: 1 }}>
              📦 BUY
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {stock.map((item, idx) => {
                const color = RARITY_COLORS[item.rarity] ?? "#888";
                const canAfford = coins >= item.price;
                return (
                  <div key={item.id} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    background: "#1a1a2e", border: `1px solid ${color}`,
                    borderRadius: 8, padding: "8px 12px",
                    opacity: canAfford ? 1 : 0.6,
                  }}>
                    <span style={{ fontSize: 26 }}>{item.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "bold", color, fontSize: 12 }}>{item.name}</div>
                      <div style={{ color: "#888", fontSize: 10 }}>
                        {SLOT_LABELS[item.slot] ?? item.slot} · <span style={{ color, textTransform: "capitalize" }}>{item.rarity}</span>
                      </div>
                      <div style={{ color: "#7fc", fontSize: 10, marginTop: 2 }}>
                        {item.effects.map(e => formatEffect(e)).join("  ")}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: "#ffd700", fontSize: 12, marginBottom: 4 }}>🪙 {item.price.toLocaleString()}</div>
                      <button
                        onClick={() => canAfford && onBuy(idx)}
                        disabled={!canAfford}
                        style={{
                          background: canAfford ? "#2a4a1a" : "#1a1a2e",
                          border: `1px solid ${canAfford ? "#4caf50" : "#444"}`,
                          color: canAfford ? "#4caf50" : "#555",
                          padding: "4px 12px", borderRadius: 6,
                          cursor: canAfford ? "pointer" : "not-allowed", fontSize: 11,
                        }}
                      >{canAfford ? "Buy" : "Too pricey"}</button>
                    </div>
                  </div>
                );
              })}
              {stock.length === 0 && <div style={{ color: "#555", fontSize: 12, textAlign: "center", padding: 12 }}>No stock available</div>}
            </div>
          </div>

          {/* ── RIGHT: Sell section ── */}
          <div style={{ flex: "1 1 280px" }}>
            <div style={{ fontSize: 11, fontWeight: "bold", color: "#ff6b6b", marginBottom: 10, letterSpacing: 1 }}>
              💰 SELL YOUR ITEMS
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {(["backpack", "stash"] as const).map(t => (
                <button key={t} onClick={() => setSellTab(t)} style={{
                  background: sellTab === t ? "#ff6b6b" : "#1a1a2e",
                  color: sellTab === t ? "#000" : "#aaa",
                  border: "1px solid #444", borderRadius: 6,
                  padding: "3px 12px", cursor: "pointer", fontSize: 11,
                }}>
                  {t === "backpack" ? `🎒 Backpack (${inventoryItems.length})` : `🗄️ Stash (${stashItems.length})`}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto" }}>
              {sellItems.map(item => {
                const color = RARITY_COLORS[item.rarity] ?? "#888";
                const price = formatSellPrice(item.rarity);
                const isConfirming = confirmSell?.id === item.id;
                return (
                  <div key={item.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    background: isConfirming ? "#2a1a0a" : "#1a1a2e",
                    border: `1px solid ${isConfirming ? "#ffc107" : color}`,
                    borderRadius: 8, padding: "7px 10px",
                    transition: "background 0.15s, border-color 0.15s",
                  }}>
                    <span style={{ fontSize: 22, minWidth: 28 }}>{item.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: "bold", color }}>{item.name}</div>
                      <div style={{ fontSize: 9, color: "#888", textTransform: "capitalize" }}>{item.rarity}</div>
                    </div>
                    <div style={{ textAlign: "right", minWidth: 90 }}>
                      {isConfirming ? (
                        <div style={{ display: "flex", gap: 4 }}>
                          <button
                            onClick={() => { onSellItem(item.id); setConfirmSell(null); }}
                            style={{ background: "#2a4a1a", border: "1px solid #4caf50", color: "#4caf50", padding: "3px 8px", borderRadius: 4, cursor: "pointer", fontSize: 10 }}
                          >✓ Sell</button>
                          <button
                            onClick={() => setConfirmSell(null)}
                            style={{ background: "none", border: "1px solid #555", color: "#888", padding: "3px 6px", borderRadius: 4, cursor: "pointer", fontSize: 10 }}
                          >✗</button>
                        </div>
                      ) : (
                        <>
                          <div style={{ color: "#ffd700", fontSize: 10, marginBottom: 3 }}>🪙 {price}</div>
                          <button
                            onClick={() => item.no_sell ? alert("This legendary cannot be sold unless you own 10+ legendaries!") : setConfirmSell(item)}
                            style={{
                              background: item.no_sell ? "#1a1a2e" : "#3a1a1a",
                              border: `1px solid ${item.no_sell ? "#444" : "#f44336"}`,
                              color: item.no_sell ? "#555" : "#f44336",
                              padding: "3px 10px", borderRadius: 4,
                              cursor: item.no_sell ? "not-allowed" : "pointer", fontSize: 10,
                            }}
                          >Sell</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              {sellItems.length === 0 && (
                <div style={{ color: "#555", fontSize: 12, textAlign: "center", padding: 16 }}>
                  {sellTab === "backpack" ? "Backpack is empty" : "Stash is empty"}
                </div>
              )}
            </div>

            <div style={{ marginTop: 8, fontSize: 9, color: "#555" }}>
              Sell prices: Common 50 · Uncommon 100 · Rare 500 · Epic 10k · Legendary 1b
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
