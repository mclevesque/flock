"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdventureOverlay, { generateMission } from "./AdventureOverlay";
import StashPanel from "@/app/components/StashPanel";
import VendorPanel from "@/app/components/VendorPanel";
import HeraldPanel from "@/app/components/HeraldPanel";
import CharacterPanel from "@/app/components/CharacterPanel";
import TheaterRoom from "./TheaterRoom";
import HouseInterior from "@/app/components/HouseInterior";
import { EXTERIOR_STYLES, NPC_HOUSE_NAMES, NPC_EXTERIORS } from "@/app/components/houseData";

interface TownPlayer {
  user_id: string;
  username: string;
  avatar_url: string;
  x: number;
  y: number;
  direction: string;
  chat_msg: string | null;
  chat_at: string | null;
  is_it?: boolean;
  tag_started_at?: string | null;
  equipped_item?: string | null;
  coins?: number;
  frog_until?: string | null;
  equipped_slots?: Record<string, { emoji: string; name: string; rarity: string } | null>;
  last_effect?: { type: string; emoji: string; from: string; fromId: string; at: number } | null;
}

interface GroundItem {
  id: string;
  item: { id: string; name: string; emoji: string; rarity: string; no_drop?: boolean };
  x: number;
  y: number;
  dropped_by: string;
}

interface TownEvent {
  id: string;
  type: string;
  state: Record<string, unknown>;
  status: string;
  started_at: string;
}

// ── Shop catalog ──────────────────────────────────────────────────────────────
const SHOP_CATALOG: Record<string, { emoji: string; name: string; price: number }[]> = {
  Flowers: [
    { emoji: "🌸", name: "Cherry Blossom", price: 40 },
    { emoji: "🌹", name: "Red Rose", price: 60 },
    { emoji: "💐", name: "Bouquet", price: 100 },
    { emoji: "🌷", name: "Tulip", price: 50 },
  ],
  "Ice Cream": [
    { emoji: "🍦", name: "Soft Serve", price: 25 },
    { emoji: "🍧", name: "Shaved Ice", price: 20 },
    { emoji: "🍨", name: "Ice Cream Bowl", price: 30 },
  ],
  Market: [
    { emoji: "🎁", name: "Gift Box", price: 75 },
    { emoji: "🧺", name: "Wicker Basket", price: 50 },
    { emoji: "🍎", name: "Apple", price: 15 },
  ],
  Carnival: [
    { emoji: "🎈", name: "Balloon", price: 30 },
    { emoji: "🎡", name: "Pinwheel", price: 40 },
    { emoji: "🎟️", name: "Ticket", price: 20 },
  ],
  Bakery: [
    { emoji: "🥐", name: "Croissant", price: 20 },
    { emoji: "🎂", name: "Cake", price: 55 },
    { emoji: "🍪", name: "Cookie", price: 12 },
  ],
  Fortune: [
    { emoji: "🔮", name: "Crystal Ball", price: 150 },
    { emoji: "⭐", name: "Lucky Star", price: 80 },
    { emoji: "🃏", name: "Tarot Card", price: 60 },
  ],
};

interface Props {
  userId: string;
  username: string;
  avatarUrl: string;
  partyId?: string | null;
}

// ── Arcade Modal Component ────────────────────────────────────────────────────
function ArcadeModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [pokerRooms, setPokerRooms] = useState<Array<{ id: string; name: string; host_username: string; host_avatar: string; player_count: number; max_players: number; status: string }>>([]);
  const [activeChess, setActiveChess] = useState<{ id: string; white_username: string; black_username: string; status: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/poker").then(r => r.json()).catch(() => []),
      fetch("/api/chess?active=1").then(r => r.json()).catch(() => ({ game: null })),
    ]).then(([pr, cr]) => {
      setPokerRooms(Array.isArray(pr) ? pr : []);
      setActiveChess(cr.game ?? null);
      setLoading(false);
    });
  }, []);

  const cardStyle: React.CSSProperties = {
    background: "rgba(10,16,26,0.95)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 14, padding: "16px 18px", cursor: "pointer",
    transition: "border-color 0.15s, background 0.15s",
    textDecoration: "none", display: "block",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10000,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16, fontFamily: "monospace",
    }} onClick={onClose}>
      <div style={{
        background: "linear-gradient(160deg, #080e18 0%, #0a0614 100%)",
        border: "1px solid rgba(100,200,100,0.25)", borderRadius: 18,
        padding: "24px 20px", width: "100%", maxWidth: 400,
        boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#88ff99", letterSpacing: 2 }}>🎮 ARCADE</div>
            <div style={{ fontSize: 10, color: "rgba(130,200,130,0.5)", marginTop: 2 }}>Town games — open to all</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 18, cursor: "pointer", padding: 4 }}>✕</button>
        </div>

        {/* Poker */}
        <Link href="/poker" style={{ ...cardStyle, borderColor: pokerRooms.length > 0 ? "rgba(255,180,50,0.4)" : "rgba(255,255,255,0.1)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,180,50,0.6)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,140,0,0.08)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = pokerRooms.length > 0 ? "rgba(255,180,50,0.4)" : "rgba(255,255,255,0.1)"; (e.currentTarget as HTMLElement).style.background = "rgba(10,16,26,0.95)"; }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 28 }}>🃏</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#ffd700" }}>Poker</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>Up to 8 players per table</div>
            </div>
            {!loading && pokerRooms.length > 0 && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#ffd700" }}>🟢 {pokerRooms.length} open</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{pokerRooms[0].player_count}/{pokerRooms[0].max_players} at table</div>
              </div>
            )}
            {!loading && pokerRooms.length === 0 && (
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>No tables open</div>
            )}
          </div>
        </Link>

        <div style={{ height: 10 }} />

        {/* Chess */}
        <div>
          <Link href="/chess" style={{ ...cardStyle, borderColor: activeChess ? "rgba(100,180,255,0.4)" : "rgba(255,255,255,0.1)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(100,180,255,0.6)"; (e.currentTarget as HTMLElement).style.background = "rgba(60,120,220,0.08)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = activeChess ? "rgba(100,180,255,0.4)" : "rgba(255,255,255,0.1)"; (e.currentTarget as HTMLElement).style.background = "rgba(10,16,26,0.95)"; }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 28 }}>♟️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#a0d8ff" }}>Chess</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>Challenge · Spectate · Ranked</div>
              </div>
              {!loading && activeChess && (
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#88ccff" }}>🔵 Match Live</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", maxWidth: 90, textAlign: "right" }}>{activeChess.white_username} v {activeChess.black_username}</div>
                </div>
              )}
            </div>
          </Link>
          {activeChess && !loading && (
            <Link href={`/chess/${activeChess.id}`} style={{
              display: "block", marginTop: 6, padding: "7px 14px",
              background: "rgba(60,120,220,0.1)", border: "1px solid rgba(100,180,255,0.25)",
              borderRadius: 8, color: "#88ccff", fontSize: 11, textDecoration: "none", textAlign: "center",
            }}>
              👁 Watch match in progress →
            </Link>
          )}
        </div>

        <div style={{ height: 10 }} />

        {/* Quiz */}
        <Link href="/quiz" style={{ ...cardStyle }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(180,100,255,0.5)"; (e.currentTarget as HTMLElement).style.background = "rgba(120,60,200,0.08)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)"; (e.currentTarget as HTMLElement).style.background = "rgba(10,16,26,0.95)"; }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 28 }}>🧠</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#cc99ff" }}>Quiz</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>Head-to-head trivia battles</div>
            </div>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 1 }}>1v1</span>
          </div>
        </Link>

        {loading && (
          <div style={{ textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 12 }}>
            Loading game rooms…
          </div>
        )}
      </div>
    </div>
  );
}

const W = 6400, H = 1120, TILE = 32;
// Housing district starts right of market
const HOUSE_DISTRICT_X = 4500;
const HOUSE_COLS = 4, HOUSE_ROWS = 2, HOUSE_W = 200, HOUSE_H = 160, HOUSE_GAP = 60;
const HOUSE_SLOTS = Array.from({ length: HOUSE_COLS * HOUSE_ROWS }, (_, i) => ({
  col: i % HOUSE_COLS, row: Math.floor(i / HOUSE_COLS),
  x: HOUSE_DISTRICT_X + 80 + (i % HOUSE_COLS) * (HOUSE_W + HOUSE_GAP),
  y: Math.floor(i / HOUSE_COLS) === 0 ? 180 : 620,
}));
const PLAYER_SPEED = 228;
const TAG_SPEED = 336; // faster during tag game
const NEARBY_DIST = 220;
const TAG_DIST = 90; // world-px radius for tagging
const TAG_GAME_DURATION = 30; // seconds

const BUILDINGS = [
  { x: 1680, y: 80, w: 220, h: 160, label: "📬 Messages", color: 0x4a2080, roof: 0x7c3cbf, link: "/messages" },
  { x: 2900, y: 80, w: 220, h: 160, label: "🎮 Arcade", color: 0x1a4a20, roof: 0x3abf5c, link: "" },
  { x: 1680, y: 880, w: 220, h: 160, label: "🎨 Art Studio", color: 0x4a1a10, roof: 0xbf4a3c, link: "/draw" },
  { x: 2900, y: 880, w: 220, h: 160, label: "🎬 Cinema", color: 0x10204a, roof: 0x3c6abf, link: "/stremio" },
  { x: 2290, y: 60, w: 220, h: 140, label: "✨ Share", color: 0x3a1050, roof: 0xaa40cc, link: "/feed" },
];

// Market district buildings (right of main town, x > 3272)
const MARKET_STALLS = [
  { x: 3320, y: 120, w: 200, h: 140, label: "🍦 Ice Cream", color: 0x7a2060, roof: 0xf08090, awning: 0xff9ab0 },
  { x: 3560, y: 120, w: 200, h: 140, label: "🥕 Market", color: 0x3a5a10, roof: 0x6abf30, awning: 0xaaee55 },
  { x: 3800, y: 120, w: 160, h: 140, label: "🔮 Fortune", color: 0x2a0a50, roof: 0x7030b0, awning: 0xcc80ff },
  { x: 3320, y: 860, w: 200, h: 140, label: "🎪 Carnival", color: 0x5a1a10, roof: 0xee4422, awning: 0xff8855 },
  { x: 3560, y: 860, w: 200, h: 140, label: "🍞 Bakery", color: 0x5a3a10, roof: 0xcc8830, awning: 0xffcc66 },
  { x: 3800, y: 860, w: 160, h: 140, label: "🌸 Flowers", color: 0x502040, roof: 0xc060a0, awning: 0xff99cc },
];

const TREES = [
  [2000,120],[2100,140],[2060,180],[2700,120],[2740,170],[2650,140],
  [1720,420],[1730,540],[1710,660],[3070,420],[3060,540],[3080,660],
  [1900,900],[1980,930],[1940,970],[2800,900],[2860,940],[2830,980],
  [2200,400],[2240,460],[2160,450],[2550,400],[2600,450],[2580,390],
];

// Draw original square avatar sprite — returns the image so caller can flip it
function drawAvatarSprite(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  texKey: string,
  isMe = false,
): Phaser.GameObjects.Image {
  // Ground shadow
  const shadow = scene.add.graphics();
  shadow.fillStyle(0x000000, 0.28);
  shadow.fillEllipse(2, 28, 44, 12);
  container.add(shadow);

  // Outer glow ring (makes sprite pop on any background)
  const glow = scene.add.graphics();
  glow.fillStyle(isMe ? 0x9966ff : 0x445566, 0.55);
  glow.fillRoundedRect(-24, -24, 48, 48, 4);
  container.add(glow);

  // White/light inner border
  const border = scene.add.graphics();
  border.fillStyle(isMe ? 0xffffff : 0xccddee, 1);
  border.fillRoundedRect(-21, -21, 42, 42, 3);
  container.add(border);

  // Avatar image
  const img = scene.add.image(0, 0, texKey).setDisplaySize(38, 38);
  container.add(img);
  return img;
}

// Generate a colored letter avatar on a canvas as a last-resort fallback
function makeLetterAvatarTexture(scene: Phaser.Scene, texKey: string, name: string) {
  try {
    const dpr = window.devicePixelRatio || 1;
    const size = 64 * dpr;
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const hue = Array.from(name).reduce((h, c) => (h * 31 + c.charCodeAt(0)) & 0xffff, 0) % 360;
    ctx.fillStyle = `hsl(${hue}, 55%, 42%)`;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(0, 0, size, size / 2);
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${30 * dpr}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((name[0] ?? "?").toUpperCase(), size / 2, size / 2 + dpr);
    if (!scene.textures.exists(texKey)) scene.textures.addCanvas(texKey, canvas);
  } catch { /* ignore */ }
}

// Load avatar via HTMLImageElement → Phaser texture, avoids Phaser loader race conditions.
// Falls back to a letter avatar if all network attempts fail.
function loadAvatarIntoScene(scene: Phaser.Scene, texKey: string, src: string, fallbackName: string, cb: () => void) {
  if (scene.textures.exists(texKey)) { cb(); return; }
  // Preemptively build the letter avatar — overwrite with real image if it loads
  makeLetterAvatarTexture(scene, texKey, fallbackName);
  const attempt = (useCors: boolean) => {
    const el = new Image();
    if (useCors) el.crossOrigin = "anonymous";
    el.onload = () => {
      try {
        // Replace the letter-avatar placeholder with the real image
        if (scene.textures.exists(texKey)) scene.textures.remove(texKey);
        scene.textures.addImage(texKey, el);
      } catch { /* keep letter avatar if replacement fails */ }
      cb();
    };
    el.onerror = () => {
      if (useCors) { attempt(false); return; }
      // Both failed — letter avatar already installed, just proceed
      cb();
    };
    el.src = src;
  };
  attempt(true);
}

const MODERATORS = ["mclevesque"];
const TOWN_SESSION_START = Date.now();
let _lastActivityTime = Date.now();
function _recordActivity() { _lastActivityTime = Date.now(); }

// ── Ribbit sound via Web Audio API ─────────────────────────────────────────
function playRibbit() {
  try {
    type WinWithWebkit = Window & { webkitAudioContext?: typeof AudioContext };
    const AC = window.AudioContext || (window as WinWithWebkit).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sine";
    // Ribbit: two-chirp descending glide
    osc.frequency.setValueAtTime(320, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.12);
    osc.frequency.setValueAtTime(360, ctx.currentTime + 0.18);
    osc.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + 0.32);
    gain.gain.setValueAtTime(0.28, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => { ctx.close().catch(() => {}); };
  } catch { /* no audio context */ }
}

// ── Dragon boss path (circles fountain at TCX=2800, H/2=560) ──────────────
type PhaserScene = import("phaser").Scene;
type PhaserContainer = import("phaser").GameObjects.Container;
type PhaserGraphics = import("phaser").GameObjects.Graphics;

const DRAGON_PATH = [
  { x: 2620, y: 370 }, { x: 2800, y: 280 }, { x: 2990, y: 370 },
  { x: 3070, y: 560 }, { x: 2990, y: 750 }, { x: 2800, y: 840 },
  { x: 2620, y: 750 }, { x: 2540, y: 560 },
];
const DRAGON_TICK_MS = 2400; // ms per waypoint
const GRAVEYARD_X = 4180, GRAVEYARD_Y = 980; // respawn point — bottom-right corner

// Bandit raid — 3 bandits patrol separate parts of town
const BANDIT_PATROLS: { x: number; y: number }[][] = [
  [{ x: 900, y: 450 }, { x: 1120, y: 485 }, { x: 1060, y: 590 }, { x: 830, y: 558 }],
  [{ x: 1380, y: 380 }, { x: 1620, y: 415 }, { x: 1700, y: 520 }, { x: 1480, y: 560 }],
  [{ x: 2080, y: 592 }, { x: 2300, y: 548 }, { x: 2260, y: 688 }, { x: 2060, y: 650 }],
];
const BANDIT_TICK_MS = 2600;
// Wandering merchant path during merchant_visit event
const MERCHANT_WANDER_PATH: { x: number; y: number }[] = [
  { x: 2550, y: 460 }, { x: 2750, y: 500 }, { x: 2920, y: 478 },
  { x: 2900, y: 620 }, { x: 2750, y: 640 }, { x: 2560, y: 598 },
];
const MERCHANT_TICK_MS = 4200;

// ── InvitePanel: search all Flock users ────────────────────────────────────
function InvitePanel({ myParty, myUserId, partyInviteSent, onSend, onClose }: {
  myParty: { id: string; members: { userId: string }[] };
  myUserId: string;
  partyInviteSent: string | null;
  onSend: (userId: string, username: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [allUsers, setAllUsers] = useState<{ id: string; username: string; avatar_url: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/users").then(r => r.json()).then(d => {
      setAllUsers(Array.isArray(d) ? d : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = allUsers.filter(u =>
    u.id !== myUserId &&
    !myParty.members.find(m => m.userId === u.id) &&
    (search === "" || u.username.toLowerCase().includes(search.toLowerCase()))
  ).slice(0, 12);

  return (
    <div style={{
      position: "absolute", bottom: "100%", left: 0, marginBottom: 6,
      background: "rgba(6,10,18,0.98)", border: "1px solid rgba(100,200,100,0.35)",
      borderRadius: 12, padding: "12px 13px", minWidth: 230, maxWidth: 260,
      maxHeight: 300, display: "flex", flexDirection: "column",
      boxShadow: "0 8px 32px rgba(0,0,0,0.7)", pointerEvents: "all",
    }}>
      <div style={{ fontSize: 12, color: "#88dd99", fontWeight: 700, marginBottom: 8 }}>➕ Invite to Party</div>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search players…"
        style={{
          background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 7, padding: "6px 9px", fontSize: 11, color: "#fff",
          outline: "none", marginBottom: 8, width: "100%", boxSizing: "border-box",
        }}
        autoFocus
      />
      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading ? (
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", padding: "6px 0" }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", padding: "6px 0" }}>
            {search ? "No match found" : "No other players yet"}
          </div>
        ) : filtered.map(u => (
          <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5, padding: "4px 6px", background: "rgba(255,255,255,0.03)", borderRadius: 7 }}>
            <img
              src={u.avatar_url || `https://api.dicebear.com/9.x/adventurer/svg?seed=${u.username}`}
              style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover" }} alt=""
            />
            <span style={{ flex: 1, fontSize: 11, color: "rgba(255,255,255,0.85)" }}>@{u.username}</span>
            <button
              onClick={() => onSend(u.id, u.username)}
              style={{
                padding: "2px 8px", fontSize: 10, fontWeight: 700,
                background: partyInviteSent === u.id ? "rgba(74,222,128,0.2)" : "rgba(100,200,100,0.15)",
                border: `1px solid ${partyInviteSent === u.id ? "rgba(74,222,128,0.5)" : "rgba(100,200,100,0.35)"}`,
                borderRadius: 5, color: partyInviteSent === u.id ? "#4ade80" : "#88dd99", cursor: "pointer",
              }}
            >
              {partyInviteSent === u.id ? "✓ Sent!" : "Invite"}
            </button>
          </div>
        ))}
      </div>
      <button onClick={onClose} style={{ marginTop: 6, fontSize: 10, color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer" }}>close</button>
    </div>
  );
}

export default function TownClient({ userId, username, avatarUrl, partyId }: Props) {
  const router = useRouter();
  // ── Town loading screen ────────────────────────────────────────────────────
  const [townLoading, setTownLoading] = useState(true);
  const [loadPercent, setLoadPercent] = useState(0);
  const gameDirtyRef = useRef(false);
  const SAVE_KEY = `flock_gs_${userId}`;
  // partyId ref — always current even inside Phaser callbacks
  const partyIdRef = useRef<string | null>(partyId ?? null);

  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<unknown>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [nearbyPlayers, setNearbyPlayers] = useState<TownPlayer[]>([]);
  const [playerCount, setPlayerCount] = useState(1);
  const [showInvite, setShowInvite] = useState(false);
  const [friends, setFriends] = useState<{ id: string; username: string; avatar_url: string | null }[]>([]);
  // Tag game
  const [tagItId, setTagItId] = useState<string | null>(null);
  const [tagItUsername, setTagItUsername] = useState<string>("");
  const [tagMsg, setTagMsg] = useState<string | null>(null);
  const [tagShareCaption, setTagShareCaption] = useState<string | null>(null); // non-null only for winner
  const [tagGameActive, setTagGameActive] = useState(false);
  const [tagTimeLeft, setTagTimeLeft] = useState(TAG_GAME_DURATION);
  const tagItIdRef = useRef<string | null>(null);
  const tagItUsernameRef = useRef<string>("");
  const tagGameActiveRef = useRef(false);
  const tagSpeedActiveRef = useRef(false); // controls speed boost in Phaser
  const tagTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tagGameEndedAtRef = useRef<number>(0); // timestamp of last endTagGame() call — prevents DB poll race restart

  // ── Arcade modal ─────────────────────────────────────────────────────────────
  const [arcadeOpen, setArcadeOpen] = useState(false);
  const arcadeOpenRef = useRef(false);

  // ── Market rooms ────────────────────────────────────────────────────────────
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [fortune, setFortune] = useState<string | null>(null);
  const [fortuneLoading, setFortuneLoading] = useState(false);
  const activeRoomRef = useRef<string | null>(null); // stable ref so Phaser closure can open rooms

  // ── Town economy ─────────────────────────────────────────────────────────────
  const [myCoins, setMyCoins] = useState(0); // loaded from server on mount
  const myCoinsRef = useRef(0);
  useEffect(() => { myCoinsRef.current = myCoins; }, [myCoins]);
  const [myEquippedItem, setMyEquippedItem] = useState<string | null>(null);
  const [buyingItem, setBuyingItem] = useState<string | null>(null); // emoji being purchased
  const [givingTo, setGivingTo] = useState<string | null>(null); // userId being given to
  const myEquippedItemRef = useRef<string | null>(null); // ref for Phaser access
  const equippedItemsRef = useRef<Map<string, string | null>>(new Map()); // userId → equipped emoji

  // ── Fun item slot ─────────────────────────────────────────────────────────
  interface FunItem { id: string; emoji: string; name: string; funType: string; }
  const [funItem, setFunItem] = useState<FunItem | null>(null);
  const funItemRef = useRef<FunItem | null>(null);

  // ── Stash / Vendor / Herald ───────────────────────────────────────────────
  const [showStash, setShowStash] = useState(false);
  const showStashRef = useRef(false);
  const [stashData, setStashData] = useState<{ stash_items: unknown[]; inventory: unknown[]; equipped_slots: Record<string, unknown>; level: number } | null>(null);
  const stashDataRef = useRef<{ stash_items: unknown[]; inventory: unknown[]; equipped_slots: Record<string, unknown>; level: number } | null>(null);
  const openStashRef = useRef<(() => void) | null>(null);
  const [showVendor, setShowVendor] = useState(false);
  const showVendorRef = useRef(false);
  const [vendorStock, setVendorStock] = useState<unknown[]>([]);
  const [merchantDiscount, setMerchantDiscount] = useState(false);
  const [vendorCoins, setVendorCoins] = useState(0);
  const [showHerald, setShowHerald] = useState(false);
  const showHeraldRef = useRef(false);
  const [heraldChapters, setHeraldChapters] = useState<unknown[]>([]);
  // Town events
  const [activeEvent, setActiveEvent] = useState<TownEvent | null>(null);
  const [dismissedEventId, setDismissedEventId] = useState<string | null>(null);
  const [eventCooldown, setEventCooldown] = useState(false);
  const eventCooldownRef = useRef(false);

  // ── Leave-kingdom confirmation dialog ───────────────────────────────────
  const [confirmLeave, setConfirmLeave] = useState<{ label: string; href: string } | null>(null);

  // ── Theater ─────────────────────────────────────────────────────────────
  // ── Housing district ──────────────────────────────────────────────────────
  interface DistrictSlot { userId: string | null; username: string; exteriorStyle: string; isNpc: boolean; }
  const [districtSlots, setDistrictSlots] = useState<DistrictSlot[]>([]);
  const [openHouse, setOpenHouse] = useState<{ userId: string; username: string } | null>(null);

  useEffect(() => {
    fetch(`/api/house?district=1&partyId=${partyId ?? ""}`)
      .then(r => r.json())
      .then(({ houses }) => {
        const real: DistrictSlot[] = (houses ?? []).map((h: Record<string, unknown>) => ({
          userId: h.id as string,
          username: h.username as string,
          exteriorStyle: (h.exterior_style as string) ?? "cottage",
          isNpc: false,
        }));
        const npcCount = Math.max(0, 8 - real.length);
        const npcs: DistrictSlot[] = Array.from({ length: npcCount }, (_, i) => ({
          userId: null,
          username: NPC_HOUSE_NAMES[i % NPC_HOUSE_NAMES.length],
          exteriorStyle: NPC_EXTERIORS[i % NPC_EXTERIORS.length],
          isNpc: true,
        }));
        setDistrictSlots([...real, ...npcs]);
      })
      .catch(() => {});
  }, [partyId]);

  const [theaterOpen, setTheaterOpen] = useState(false);
  const theaterOpenRef = useRef(false);
  const openTheaterRef = useRef<(() => void) | null>(null);
  const [theaterState, setTheaterState] = useState<{ videoUrl: string | null; startedAt: number | null; hostId: string | null; seats: Record<string, { userId: string; username: string }>; isPaused?: boolean; pausedAt?: number | null; jukeboxUrl?: string | null; jukeboxStartedAt?: number | null; jukeboxBy?: string | null } | null>(null);
  const theaterStateRef = useRef<typeof theaterState>(null);
  const [theaterChat, setTheaterChat] = useState<Array<{ userId: string; username: string; avatarUrl: string; message: string; createdAt: number }>>([]);

  // ── Jukebox NPC (Seraphina by fountain) ─────────────────────────────────
  const [showJukeboxDialog, setShowJukeboxDialog] = useState(false);
  const [jukeboxInput, setJukeboxInput] = useState("");
  const [jukeboxDialogLoading, setJukeboxDialogLoading] = useState(false);
  const openJukeboxDialogRef = useRef<(() => void) | null>(null);

  // ── Party system ────────────────────────────────────────────────────────
  interface PartyMember { userId: string; username: string; avatarUrl: string; isLeader: boolean; }
  interface Party { id: string; leaderId: string; leaderName: string; leaderAvatar: string; members: PartyMember[]; maxSize: number; createdAt: number; }
  const [myParty, setMyParty] = useState<Party | null>(null);
  const [friendParties, setFriendParties] = useState<Party[]>([]);
  const [showPartyPanel, setShowPartyPanel] = useState(false);
  const [showPartyInvite, setShowPartyInvite] = useState(false);
  const [partyInviteSent, setPartyInviteSent] = useState<string | null>(null);
  const partyPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Boss fight (town events) ────────────────────────────────────────────
  const [townHp, setTownHp] = useState(100);
  const townHpRef = useRef(100);
  const [isDead, setIsDead] = useState(false);
  const isDeadRef = useRef(false);
  const [eventSpecialCooldown, setEventSpecialCooldown] = useState(0);
  const eventSpecialCooldownRef = useRef(0);
  const [eventPotions, setEventPotions] = useState(3);
  const eventPotionsRef = useRef(3);
  const [eventActionPending, setEventActionPending] = useState(false);
  const [victoryData, setVictoryData] = useState<{ loot: unknown[]; participants: number; eventType: string } | null>(null);
  const [seenVictoryEventId, setSeenVictoryEventId] = useState<string | null>(null);
  const seenVictoryEventIdRef = useRef<string | null>(null);
  const respawnToGraveyardRef = useRef<(() => void) | null>(null);
  const activeEventRef = useRef<TownEvent | null>(null);
  const dragonContainerRef = useRef<import("phaser").GameObjects.Container | null>(null);
  const dragonHpFillRef = useRef<import("phaser").GameObjects.Graphics | null>(null);
  const dragonLabelRef = useRef<import("phaser").GameObjects.Text | null>(null);
  const spawnDragonRef = useRef<(() => void) | null>(null);
  const despawnDragonRef = useRef<(() => void) | null>(null);
  const victoryCelebrationRef = useRef<(() => void) | null>(null);
  // NPC attack flash callbacks keyed by npc id
  const npcFlashRef = useRef<Map<string, (emoji: string, dmg: number) => void>>(new Map());
  const npcAutoChargeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Bandit raid entities
  const banditContainersRef = useRef<(import("phaser").GameObjects.Container | null)[]>([null, null, null]);
  const banditHpFillsRef = useRef<(import("phaser").GameObjects.Graphics | null)[]>([null, null, null]);
  const banditLabelsRef = useRef<(import("phaser").GameObjects.Text | null)[]>([null, null, null]);
  const spawnBanditsRef = useRef<(() => void) | null>(null);
  const despawnBanditsRef = useRef<(() => void) | null>(null);
  // Merchant visit entity
  const merchantContainerRef = useRef<import("phaser").GameObjects.Container | null>(null);
  const spawnMerchantRef = useRef<(() => void) | null>(null);
  const despawnMerchantRef = useRef<(() => void) | null>(null);
  // Festival entities
  const festivalContainersRef = useRef<(import("phaser").GameObjects.Container | null)[]>([]);
  const spawnFestivalRef = useRef<(() => void) | null>(null);
  const despawnFestivalRef = useRef<(() => void) | null>(null);

  // Ground items
  const groundItemsRef = useRef<GroundItem[]>([]);
  const [nearGroundItem, setNearGroundItem] = useState<GroundItem | null>(null);
  const nearGroundItemRef = useRef<GroundItem | null>(null);
  // Frog hex
  const froggifiedRef = useRef<Map<string, number>>(new Map()); // userId → expiry timestamp
  // Gift/effect broadcast dedup: track which effect timestamps we've already animated
  const shownEffectsRef = useRef<Map<string, number>>(new Map()); // userId → last_effect.at
  const [frogCooldownExpiry, setFrogCooldownExpiry] = useState(0);
  const frogCooldownRef = useRef(0);

  // Ability targeting mode — two-step: click item emoji → click target
  type AbilityTargetMode = { ability: string | null; itemEmoji: string; itemName: string; consumable: boolean };
  const [abilityTargetMode, setAbilityTargetMode] = useState<AbilityTargetMode | null>(null);
  const abilityTargetModeRef = useRef<AbilityTargetMode | null>(null);

  // ── Cave System ───────────────────────────────────────────────────────────
  const [caveOpen, setCaveOpen] = useState(false);
  const caveHintRef = useRef(false);
  const [caveSessionId, setCaveSessionId] = useState<string | null>(null);
  const [caveTeam, setCaveTeam] = useState<{ user_id: string; username: string; avatar_url: string; hp: number; max_hp: number; class: string | null }[]>([]);
  // Stable ref so Phaser closures can call openCave without stale state
  const openCaveRef = useRef<(() => void) | null>(null);

  // ── Party Invite System ────────────────────────────────────────────────────
  interface PartyInvite {
    id: string;
    from_user_id: string;
    from_username: string;
    session_id: string;
    mission_key: string;
    mission_data: unknown;
  }
  const [partyInvite, setPartyInvite] = useState<PartyInvite | null>(null);
  const [sendingInviteTo, setSendingInviteTo] = useState<string | null>(null); // userId currently being invited

  // ── NPC Dialogue ─────────────────────────────────────────────────────────
  const [npcDialogue, setNpcDialogue] = useState<{
    npcId: string; npcName: string; npcEmoji: string; npcTitle: string;
    reply: string; loading: boolean; npcChatInput: string;
  } | null>(null);
  const npcDialogueRef = useRef(false); // true while dialogue is open
  const nearNpcRef = useRef<string | null>(null); // nearest NPC id

  // ── Inventory / Character Panel ───────────────────────────────────────────
  const [showInventory, setShowInventory] = useState(false);
  const showInventoryRef = useRef(false);
  type InvItem = { id: string; name: string; emoji: string; rarity: string; effects: { type: string; value: number }[]; obtained?: string };
  // inspectingItem removed — CharacterPanel handles its own hover/selection state

  // ── Adventure System ─────────────────────────────────────────────────────
  interface AdventureStats {
    user_id: string; class: string | null; level: number; xp: number;
    hp: number; max_hp: number; base_attack: number;
    inventory: unknown[]; equipped_item_id: string | null;
    wins: number; quests_completed: number;
  }
  interface MissionData {
    name: string; description: string; theme: string;
    emoji: string; palette: { bg: string; accent: string; floor: string };
    rooms: unknown[];
  }
  const [adventureStats, setAdventureStats] = useState<AdventureStats | null>(null);
  const [showCaptainDialog, setShowCaptainDialog] = useState(false);
  const [captainDialogTab, setCaptainDialogTab] = useState<"class" | "mission">("class");
  const [captainHintVisible, setCaptainHintVisible] = useState(false);
  const [adventureOverlayOpen, setAdventureOverlayOpen] = useState(false);
  const [adventureMission, setAdventureMission] = useState<MissionData | null>(null);
  const [adventureSessionId, setAdventureSessionId] = useState<string | null>(null);
  const [adventureMinimized, setAdventureMinimized] = useState<{ name: string; room: number } | null>(null);
  const [customMissionInput, setCustomMissionInput] = useState("");
  const captainHintRef = useRef(false);
  const adventureStatsRef = useRef<AdventureStats | null>(null);

  // ── Ice cream brain freeze ───────────────────────────────────────────────
  const iceCreamTimestampsRef = useRef<number[]>([]);
  const [brainFreezeActive, setBrainFreezeActive] = useState(false);
  const brainFreezeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Tap-to-move (mobile / iOS touch) ──────────────────────────────────────
  const tapTargetRef = useRef<{ x: number; y: number } | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    setIsTouchDevice("ontouchstart" in window || navigator.maxTouchPoints > 0);
  }, []);

  // ── Passive HP regen: +1 HP every 3 seconds anywhere in town ─────────────
  useEffect(() => {
    const iv = setInterval(() => {
      const stats = adventureStatsRef.current;
      if (!stats || stats.hp >= stats.max_hp) return;
      const newHp = Math.min(stats.max_hp, stats.hp + 1);
      const updated = { ...stats, hp: newHp };
      adventureStatsRef.current = updated;
      setAdventureStats(updated);
      fetch("/api/adventure", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-stats", patch: { hp: newHp } }) }).catch(() => {});
    }, 3000);
    return () => clearInterval(iv);
  }, []);

  // Keep openStashRef updated so Phaser closure always has latest function
  useEffect(() => { openStashRef.current = openStash; });

  // ── Earn coins from adventure (called by onCoinsEarned callback) ───────────
  async function handleCoinsEarned(amount: number) {
    if (!amount || amount <= 0) return;
    try {
      const r = await fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "earn", amount }) });
      const d = await r.json();
      if (d.ok && d.coins !== undefined) { setMyCoins(d.coins); myCoinsRef.current = d.coins; }
      else { setMyCoins(c => { myCoinsRef.current = c + amount; return c + amount; }); }
    } catch { setMyCoins(c => { myCoinsRef.current = c + amount; return c + amount; }); }
    markDirty();
  }

  function buildSave() {
    return {
      coins: myCoinsRef.current,
      class: adventureStatsRef.current?.class ?? null,
      level: adventureStatsRef.current?.level ?? 1,
      xp: adventureStatsRef.current?.xp ?? 0,
      hp: adventureStatsRef.current?.hp ?? 100,
      max_hp: adventureStatsRef.current?.max_hp ?? 100,
      base_attack: adventureStatsRef.current?.base_attack ?? 10,
      inventory: stashDataRef.current?.inventory ?? adventureStatsRef.current?.inventory ?? [],
      stash_items: stashDataRef.current?.stash_items ?? [],
      equipped_slots: stashDataRef.current?.equipped_slots ?? {},
      savedAt: Date.now(),
    };
  }

  function saveToLS() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(buildSave())); } catch {}
  }

  function markDirty() {
    gameDirtyRef.current = true;
    saveToLS();
  }

  async function loadStashData(): Promise<boolean> {
    try {
      const r = await fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get-stash" }) });
      const d = await r.json();
      if (Array.isArray(d.stash_items)) {
        // If the API returned an empty inventory array, preserve whatever items we already
        // know about from adventureStatsRef (e.g. loot collected during an adventure).
        const inv = (Array.isArray(d.inventory) && d.inventory.length > 0)
          ? d.inventory
          : (adventureStatsRef.current?.inventory ?? []);
        const merged = { ...d, inventory: inv };
        setStashData(merged);
        stashDataRef.current = merged;
        return true;
      }
      // Return defaults if API failed — preserve equipped_slots from current ref so they aren't wiped
      const defaults = {
        stash_items: stashDataRef.current?.stash_items ?? [],
        inventory: adventureStatsRef.current?.inventory ?? [],
        equipped_slots: stashDataRef.current?.equipped_slots ?? {},
        level: stashDataRef.current?.level ?? 1,
      };
      setStashData(defaults);
      stashDataRef.current = defaults;
      return true;
    } catch {
      const defaults = {
        stash_items: stashDataRef.current?.stash_items ?? [],
        inventory: adventureStatsRef.current?.inventory ?? [],
        equipped_slots: stashDataRef.current?.equipped_slots ?? {},
        level: stashDataRef.current?.level ?? 1,
      };
      setStashData(defaults);
      stashDataRef.current = defaults;
      return true;
    }
  }

  async function openStash() {
    await loadStashData(); // always succeeds now (returns defaults on error)
    showStashRef.current = true;
    setShowStash(true);
  }

  async function openVendor() {
    try {
      const r = await fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get-vendor-stock" }) });
      const d = await r.json();
      setVendorStock(d.stock ?? []);
      setVendorCoins(d.coins ?? myCoins);
      setMerchantDiscount(!!d.merchantDiscount);
    } catch { /* ignore */ }
    showVendorRef.current = true;
    setShowVendor(true);
  }

  async function openHerald() {
    try {
      const r = await fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get-storyline" }) });
      const d = await r.json();
      setHeraldChapters(d.chapters ?? []);
    } catch { /* ignore */ }
    showHeraldRef.current = true;
    setShowHerald(true);
  }

  async function stashAction(action: string, body: Record<string, unknown>) {
    try {
      const r = await fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }) });
      const d = await r.json();
      if (d.ok || d.coins_earned !== undefined) {
        // Refresh stash
        const r2 = await fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get-stash" }) });
        const d2 = await r2.json();
        setStashData(d2);
        if (d2 && Array.isArray(d2.stash_items)) {
          stashDataRef.current = d2;
          // Keep adventureStatsRef.inventory in sync so auto-save / keepalive saves latest
          if (Array.isArray(d2.inventory) && adventureStatsRef.current) {
            adventureStatsRef.current = { ...adventureStatsRef.current, inventory: d2.inventory };
          }
          markDirty();
        }
        if (d.coins_earned !== undefined) {
          const earned = typeof d.coins_earned === "string" ? 1000000000 : Number(d.coins_earned);
          setMyCoins(c => c + earned);
        }
      }
    } catch { /* ignore */ }
  }

  async function handleEventAction(action: "fight" | "special" | "potion" | "defend" | "flee") {
    if (!activeEvent || isDeadRef.current || eventActionPending) return;

    // Potion: heal locally, no server call
    if (action === "potion") {
      if (eventPotionsRef.current <= 0) return;
      const newPotions = eventPotionsRef.current - 1;
      eventPotionsRef.current = newPotions;
      setEventPotions(newPotions);
      const healAmt = Math.floor(Math.random() * 20) + 25; // 25-44
      const newHp = Math.min(100, townHpRef.current + healAmt);
      townHpRef.current = newHp;
      setTownHp(newHp);
      return;
    }

    // Special: check cooldown
    if (action === "special" && eventSpecialCooldownRef.current > 0) return;

    setEventActionPending(true);
    try {
      const r = await fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "event-action", eventId: activeEvent.id, eventAction: action }) });
      const d = await r.json();
      if (d.ok) {
        // Update special cooldown
        if (action === "special") {
          eventSpecialCooldownRef.current = 3;
          setEventSpecialCooldown(3);
        } else if (eventSpecialCooldownRef.current > 0) {
          eventSpecialCooldownRef.current--;
          setEventSpecialCooldown(eventSpecialCooldownRef.current);
        }

        if (d.bossHp !== undefined) {
          setActiveEvent(prev => prev ? { ...prev, state: { ...prev.state, bossHp: d.bossHp, bossMaxHp: d.bossMaxHp ?? prev.state.bossMaxHp ?? 1500 } } : prev);
          activeEventRef.current = activeEvent ? { ...activeEvent, state: { ...activeEvent.state, bossHp: d.bossHp } } : null;
        }
        // Enemy counter-attacks player (dragon or bandit)
        const counterDmg = (d.dragonDmg ?? 0) + (d.banditDmg ?? 0);
        if (counterDmg > 0) {
          const newHp = Math.max(0, townHpRef.current - counterDmg);
          townHpRef.current = newHp;
          setTownHp(newHp);
          if (newHp <= 0 && !isDeadRef.current) {
            isDeadRef.current = true;
            setIsDead(true);
            setTimeout(() => {
              respawnToGraveyardRef.current?.();
              townHpRef.current = 100;
              setTownHp(100);
              isDeadRef.current = false;
              setIsDead(false);
            }, 2500);
          }
        }
        // NPC attacks — flash their positions
        if (Array.isArray(d.npcAttacks)) {
          for (const atk of d.npcAttacks as { name: string; emoji: string; damage: number }[]) {
            const flashFn = npcFlashRef.current.get(atk.emoji + atk.name);
            flashFn?.(atk.emoji, atk.damage);
          }
        }
        // Victory!
        if (d.victory) {
          const eType = activeEvent?.type ?? "dragon_attack";
          setActiveEvent(null);
          activeEventRef.current = null;
          if (eType === "dragon_attack") despawnDragonRef.current?.();
          else if (eType === "bandit_raid") despawnBanditsRef.current?.();
          else if (eType === "merchant_visit") despawnMerchantRef.current?.();
          else if (eType === "festival") despawnFestivalRef.current?.();
          setVictoryData({ loot: d.yourLoot ?? [], participants: d.participantCount ?? 1, eventType: eType });
          if (eType === "dragon_attack" || eType === "bandit_raid") victoryCelebrationRef.current?.();
          if (adventureStatsRef.current) {
            const newXp = (adventureStatsRef.current.xp ?? 0) + 250;
            adventureStatsRef.current = { ...adventureStatsRef.current, xp: newXp };
            setAdventureStats({ ...adventureStatsRef.current });
            markDirty();
          }
          // Reset event combat state for next event
          eventSpecialCooldownRef.current = 0; setEventSpecialCooldown(0);
          eventPotionsRef.current = 3; setEventPotions(3);
        }
      }
    } catch { /* ignore */ }
    setEventActionPending(false);
  }

  async function handleFrogHex(targetIds: string[]) {
    if (targetIds.length === 0) return;
    const expiry = Date.now() + 12000;
    frogCooldownRef.current = expiry;
    setFrogCooldownExpiry(expiry);
    await fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "frog-hex", targets: targetIds }) }).catch(() => {});
    targetIds.forEach(id => froggifiedRef.current.set(id, expiry));
  }

  // Generic ability dispatcher — used by the HUD ability pills
  function handleUseAbility(ability: string) {
    if (ability === "frog_hex") {
      if (frogCooldownRef.current > Date.now()) return;
      const targets = nearbyPlayers.map(p => p.user_id);
      if (targets.length > 0) handleFrogHex(targets);
    }
    // Future abilities: add more cases here
  }

  // Open captain dialog and auto-switch to mission tab if class is already set
  function openCaptainDialog() {
    setCaptainDialogTab(adventureStatsRef.current?.class ? "mission" : "class");
    setShowCaptainDialog(true);
    if (!stashDataRef.current) loadStashData().catch(() => {});
  }

  // Prevent accidental refresh/navigate when theater is open
  useEffect(() => {
    if (!theaterOpen) return;
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "You'll leave the theater if you refresh. Continue?";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [theaterOpen]);

  // Open theater
  openTheaterRef.current = () => {
    stopAmbientMusic();
    stopChaseMusic();
    theaterOpenRef.current = true;
    setTheaterOpen(true);
  };

  function closeTheater() {
    fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "theater-stand", partyId: partyIdRef.current }) }).catch(() => {});
    theaterOpenRef.current = false;
    setTheaterOpen(false);
    setTimeout(() => startAmbientMusic(), 300);
  }

  // Stop ambient music when jukebox is playing; resume when it stops
  const prevJukeboxUrlRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const jUrl = theaterState?.jukeboxUrl ?? null;
    if (prevJukeboxUrlRef.current === jUrl) return;
    prevJukeboxUrlRef.current = jUrl;
    if (jUrl) {
      stopAmbientMusic();
    } else if (!theaterOpen) {
      startAmbientMusic();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theaterState?.jukeboxUrl, theaterOpen]);

  // ── Party polling ─────────────────────────────────────────────────────────
  useEffect(() => {
    const pollParty = async () => {
      try {
        const [myRes, friendRes] = await Promise.all([
          fetch("/api/party?action=my-party"),
          fetch("/api/party?action=friend-parties"),
        ]);
        if (myRes.ok) { const d = await myRes.json(); setMyParty(d.party ?? null); }
        if (friendRes.ok) { const d = await friendRes.json(); setFriendParties(d.parties ?? []); }
      } catch {}
    };
    pollParty();
    partyPollRef.current = setInterval(pollParty, 8000);
    return () => { if (partyPollRef.current) clearInterval(partyPollRef.current); };
  }, []);

  // Auto-join party from URL param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinPartyId = params.get("joinParty");
    if (joinPartyId && userId) {
      fetch("/api/party", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "join", partyId: joinPartyId }) })
        .then(r => r.json()).then(d => {
          if (d.ok || d.party) {
            fetch("/api/party?action=my-party").then(r => r.json()).then(d2 => { if (d2.party) setMyParty(d2.party); });
            window.history.replaceState({}, "", "/town");
          }
        }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createPartyAction() {
    const r = await fetch("/api/party", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create" }) });
    const d = await r.json();
    if (d.ok) setMyParty(d.party);
  }

  async function joinPartyAction(partyId: string) {
    const r = await fetch("/api/party", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "join", partyId }) });
    const d = await r.json();
    if (d.ok) { const res = await fetch("/api/party?action=my-party"); const md = await res.json(); setMyParty(md.party ?? null); }
    else alert(d.error ?? "Could not join party");
  }

  async function leavePartyAction() {
    await fetch("/api/party", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "leave" }) });
    setMyParty(null);
  }

  async function disbandPartyAction() {
    await fetch("/api/party", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "disband" }) });
    setMyParty(null);
  }

  // Talk to a village/castle NPC via the AI route
  async function talkToNpc(npcId: string, message?: string) {
    npcDialogueRef.current = true;
    setNpcDialogue(d => ({
      npcId,
      npcName: d?.npcId === npcId ? d.npcName : "…",
      npcEmoji: d?.npcId === npcId ? d.npcEmoji : "🧙",
      npcTitle: d?.npcId === npcId ? d.npcTitle : "",
      reply: "", loading: true,
      npcChatInput: d?.npcId === npcId ? d.npcChatInput : "",
    }));
    try {
      const r = await fetch("/api/npc", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ npcId, playerMessage: message ?? "", playerUsername: username }) });
      const d = await r.json();
      setNpcDialogue(prev => prev?.npcId === npcId
        ? { ...prev, npcName: d.npcName ?? prev.npcName, npcEmoji: d.npcEmoji ?? prev.npcEmoji,
            npcTitle: d.npcTitle ?? prev.npcTitle, reply: d.reply ?? "…", loading: false }
        : prev);
    } catch {
      setNpcDialogue(prev => prev ? { ...prev, reply: "…", loading: false } : null);
    }
  }

  // Global keyboard shortcuts — work even when Phaser canvas doesn't have focus
  useEffect(() => {
    const onGlobalKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.contentEditable === "true") return;
      if ((e.key === "c" || e.key === "C") && !chatOpenRef.current) {
        if (showStashRef.current) return;
        const next = !showInventoryRef.current;
        showInventoryRef.current = next;
        setShowInventory(next);
        if (next) loadStashData();
      }
    };
    window.addEventListener("keydown", onGlobalKey);
    return () => window.removeEventListener("keydown", onGlobalKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Block movement and Phaser input while any overlay is open.
  // Also saves/restores player position so they return to the same spot.
  useEffect(() => {
    const blocked = showCaptainDialog || caveOpen || adventureOverlayOpen || showInventory || !!npcDialogue || showStash || showVendor || showHerald || theaterOpen || showJukeboxDialog;
    npcDialogueRef.current = !!npcDialogue;
    overlayOpenRef.current = blocked;

    const game = gameRef.current as import("phaser").Game | null;
    if (game) {
      try { game.scene.scenes.forEach(s => { s.input.enabled = !blocked; }); } catch { /* ignore */ }
    }

    if (blocked && !savedPlayerPosRef.current) {
      // Save current position when overlay opens
      savedPlayerPosRef.current = { ...myPosRef.current };
    } else if (!blocked && savedPlayerPosRef.current) {
      // Restore position when overlay closes
      const pos = savedPlayerPosRef.current;
      savedPlayerPosRef.current = null;
      setTimeout(() => { teleportPlayerRef.current?.(pos.x, pos.y); }, 50);
      // Re-focus canvas so WASD + hotkeys work immediately after closing any overlay
      setTimeout(() => { const c = containerRef.current?.querySelector("canvas"); if (c) (c as HTMLElement).focus(); }, 80);
    }
  }, [showCaptainDialog, caveOpen, adventureOverlayOpen, showInventory, npcDialogue, showStash, showVendor, showHerald]);

  const CLASS_OPTIONS = [
    { key: "warrior", emoji: "⚔️", name: "Warrior", hp: 120, atk: "12–18", special: "Cleave: hit all enemies ×1.5" },
    { key: "mage", emoji: "🪄", name: "Mage", hp: 70, atk: "22–30", special: "Fireball: AoE all enemies ×2" },
    { key: "archer", emoji: "🏹", name: "Archer", hp: 90, atk: "16–24", special: "Piercing: hit 2 enemies ×1.8" },
    { key: "rogue", emoji: "🗡️", name: "Rogue", hp: 80, atk: "20–28", special: "Backstab: single target ×2.5" },
  ];

  // Auto-save every 60s if dirty (minimizes API calls / Vercel usage)
  useEffect(() => {
    const iv = setInterval(() => {
      if (!gameDirtyRef.current) return;
      gameDirtyRef.current = false;
      const save = buildSave();
      fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save-all", gameState: save }) }).catch(() => {});
    }, 60000);
    return () => clearInterval(iv);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Save on unmount (Next.js navigation) and beforeunload (tab close)
  useEffect(() => {
    const doSave = () => {
      saveToLS();
      const save = buildSave();
      fetch("/api/town", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save-all", gameState: save }) }).catch(() => {});
    };
    const handleUnload = () => {
      saveToLS();
      const save = buildSave();
      try {
        navigator.sendBeacon("/api/town", new Blob([JSON.stringify({ action: "save-all", gameState: save })], { type: "application/json" }));
      } catch { /* ignore */ }
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      doSave();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load game state: localStorage first (instant), then DB verification ──
  useEffect(() => {
    // Step 1: Instant load from localStorage
    const SAVE_KEY_LOCAL = `flock_gs_${userId}`;
    let lsLoaded = false;
    try {
      const saved = localStorage.getItem(SAVE_KEY_LOCAL);
      if (saved) {
        const s = JSON.parse(saved);
        setMyCoins(s.coins ?? 0);
        myCoinsRef.current = s.coins ?? 0;
        const stats: AdventureStats = {
          user_id: userId, class: s.class ?? null, level: s.level ?? 1,
          xp: s.xp ?? 0, hp: s.hp ?? 100, max_hp: s.max_hp ?? 100,
          base_attack: s.base_attack ?? 10, inventory: s.inventory ?? [],
          equipped_item_id: null, wins: 0, quests_completed: 0,
        };
        setAdventureStats(stats);
        adventureStatsRef.current = stats;
        const sd = { stash_items: s.stash_items ?? [], inventory: s.inventory ?? [], equipped_slots: s.equipped_slots ?? {}, level: s.level ?? 1 };
        setStashData(sd);
        stashDataRef.current = sd;
        lsLoaded = true;
        setLoadPercent(55); // jump to 55% since we have local data
      }
    } catch { /* ignore */ }

    // Step 2: Verify/update from DB in background
    let pct = lsLoaded ? 55 : 0;
    let done = false;
    const tick = setInterval(() => {
      if (done) return;
      pct = Math.min(pct + 7, 82);
      setLoadPercent(pct);
    }, 120);

    Promise.all([
      fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "load-all" }) }).then(r => r.json()).catch(() => ({})),
      fetch("/api/adventure").then(r => r.json()).catch(() => ({})),
    ]).then(([allData, advData]) => {
      done = true;
      clearInterval(tick);
      setLoadPercent(100);

      // Use DB data if it has meaningful progress (level ≥ localStorage level)
      const lsLevel = adventureStatsRef.current?.level ?? 1;
      const dbLevel = allData.level ?? 1;
      if (dbLevel >= lsLevel || !lsLoaded) {
        if (typeof allData.coins === "number") { setMyCoins(allData.coins); myCoinsRef.current = allData.coins; }
        const stats: AdventureStats = {
          user_id: userId, class: allData.class ?? null, level: allData.level ?? 1,
          xp: allData.xp ?? 0, hp: allData.hp ?? 100, max_hp: allData.max_hp ?? 100,
          base_attack: allData.base_attack ?? 10, inventory: allData.inventory ?? [],
          equipped_item_id: null, wins: 0, quests_completed: 0,
        };
        setAdventureStats(stats);
        adventureStatsRef.current = stats;
        const sd = { stash_items: allData.stash_items ?? [], inventory: allData.inventory ?? [], equipped_slots: allData.equipped_slots ?? {}, level: allData.level ?? 1 };
        setStashData(sd);
        stashDataRef.current = sd;
        // Update localStorage with fresh DB data
        try { localStorage.setItem(SAVE_KEY_LOCAL, JSON.stringify({ ...allData, savedAt: Date.now() })); } catch {}
      }

      if (advData?.activeSession) setAdventureSessionId(advData.activeSession.id);
      setTimeout(() => setTownLoading(false), 350);
    }).catch(() => {
      done = true;
      clearInterval(tick);
      setTownLoading(false);
    });
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function pickClass(cls: string) {
    // Stats (level, xp, hp, attack) carry over — only the class changes.
    // Level/XP/items are preserved; class-restricted weapons are auto-unequipped.
    const optimistic = { ...(adventureStatsRef.current ?? { level: 1, xp: 0, hp: 100, max_hp: 100, base_attack: 10, inventory: [], equipped_item_id: null, wins: 0, quests_completed: 0 }), class: cls } as AdventureStats;
    setAdventureStats(optimistic);
    adventureStatsRef.current = optimistic;
    markDirty();
    setCaptainDialogTab("mission");

    // Auto-unequip class-restricted weapons that don't match the new class
    if (stashData?.equipped_slots?.weapon) {
      const wep = stashData.equipped_slots.weapon as { name?: string };
      const isClassSpecific = isWeaponClassRestricted(wep?.name ?? "", cls);
      if (!isClassSpecific) {
        // weapon is incompatible — unequip it silently
        stashAction("equip-slot", { slot: "weapon", itemId: null });
      }
    }

    // Then persist to DB in the background — update state again with server response
    try {
      const r = await fetch("/api/adventure", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-stats", patch: { class: cls } }) });
      const d = await r.json();
      // update-stats returns the stats row directly (not nested in { stats: ... })
      if (d && !d.error && d.user_id) {
        setAdventureStats(d as AdventureStats);
        adventureStatsRef.current = d as AdventureStats;
      }
    } catch { /* state already updated optimistically above */ }
  }

  /** Returns true if the weapon name is COMPATIBLE with playerClass (or universal) */
  function isWeaponClassRestricted(weaponName: string, playerClass: string): boolean {
    const name = weaponName.toLowerCase();
    const CLASS_WEAPON_KEYWORDS: Record<string, string[]> = {
      warrior: ["sword", "axe", "blade", "greatsword", "hammer", "mace", "club", "longsword", "broadsword", "cleaver", "warhammer"],
      archer:  ["bow", "shortbow", "crossbow", "recurve", "longbow", "arrow"],
      mage:    ["staff", "wand", "tome", "orb", "grimoire", "scepter", "rod"],
      rogue:   ["dagger", "stiletto", "knife", "shiv", "dirk", "rapier", "shank"],
    };
    const restrictedTo = Object.entries(CLASS_WEAPON_KEYWORDS).find(([, kws]) => kws.some(kw => name.includes(kw)));
    if (!restrictedTo) return true; // universal weapon — always compatible
    return restrictedTo[0] === playerClass;
  }

  async function startMission(missionKey: string, customText?: string) {
    const mission = generateMission(customText ?? missionKey, Date.now(), missionKey);
    // Ensure stash/equippedSlots are loaded so ability items appear in adventure
    if (!stashDataRef.current) await loadStashData();
    try {
      const r = await fetch("/api/adventure", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create-session", missionKey, missionData: mission }) });
      const d = await r.json();
      if (d.id) setAdventureSessionId(d.id);
    } catch { /* ignore */ }
    setAdventureMission(mission as MissionData);
    setShowCaptainDialog(false);
    setAdventureOverlayOpen(true);
  }

  /** Send a party adventure invite to a nearby player */
  async function sendPartyInvite(toUserId: string, toUsername: string) {
    setSendingInviteTo(toUserId);
    try {
      const mission = generateMission("party quest", Date.now(), "party");
      const r = await fetch("/api/town/party", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "invite", toUserId, missionKey: "party", missionData: mission }) });
      const d = await r.json();
      if (d.ok && d.sessionId) {
        // Host opens the adventure overlay now, waiting for the other player
        setAdventureSessionId(d.sessionId);
        setAdventureMission(mission as MissionData);
        setShowCaptainDialog(false);
        setAdventureOverlayOpen(true);
        setTagMsg(`⚔️ Party invite sent to @${toUsername}! Waiting for them…`);
        setTimeout(() => setTagMsg(null), 4000);
      }
    } catch { /* ignore */ }
    setSendingInviteTo(null);
  }

  /** Accept a pending party invite */
  async function acceptPartyInvite(invite: PartyInvite) {
    try {
      const r = await fetch("/api/town/party", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept", inviteId: invite.id, sessionId: invite.session_id }) });
      const d = await r.json();
      if (d.ok) {
        setPartyInvite(null);
        setAdventureSessionId(invite.session_id);
        setAdventureMission(invite.mission_data as MissionData);
        setAdventureOverlayOpen(true);
      }
    } catch { /* ignore */ }
  }

  /** Open the shared cave — joins the daily session, loads teammates */
  async function openCave() {
    // Load stash in background so ability items appear — don't block cave entry
    if (!stashDataRef.current) loadStashData().catch(() => {});
    try {
      const r = await fetch("/api/town/party", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join-cave" }) });
      const d = await r.json();
      if (d.ok && d.sessionId) {
        setCaveSessionId(d.sessionId);
        setCaveTeam(Array.isArray(d.team) ? d.team : []);
      }
    } catch { /* ignore */ }
    setCaveOpen(true);
  }
  // Keep stable ref in sync (updated every render so Phaser always gets latest version)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { openCaveRef.current = openCave; });

  /** Poll for pending party invites — auto-accepts immediately (party join is mandatory) */
  useEffect(() => {
    const iv = setInterval(async () => {
      if (adventureOverlayOpen || caveOpen) return;
      try {
        const r = await fetch("/api/town/party?action=pending-invite");
        const invite = await r.json();
        if (invite?.id && invite.id !== partyInvite?.id) {
          // Party joins are mandatory — auto-accept without showing a dialog
          setPartyInvite(null);
          acceptPartyInvite(invite as PartyInvite);
        } else if (!invite) {
          setPartyInvite(null);
        }
      } catch { /* ignore */ }
    }, 2500);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adventureOverlayOpen, caveOpen, partyInvite?.id]);

  /**
   * Synchronized adventure exit — poll session status every 3s while in a
   * party adventure. When the host marks the session "completed" or "abandoned",
   * guests are also returned to town at their saved position.
   */
  useEffect(() => {
    if (!adventureOverlayOpen || !adventureSessionId) return;
    const iv = setInterval(async () => {
      try {
        const r = await fetch(`/api/adventure?sessionId=${adventureSessionId}`);
        const sess = await r.json();
        if (sess?.status === "completed" || sess?.status === "abandoned") {
          // Host ended the quest — return all players to town
          clearInterval(iv);
          setAdventureOverlayOpen(false);
          setAdventureMission(null);
          setAdventureSessionId(null);
          setAdventureMinimized(null);
          if (savedPlayerPosRef.current) {
            const pos = savedPlayerPosRef.current;
            setTimeout(() => { teleportPlayerRef.current?.(pos.x, pos.y); }, 100);
          }
          setTagMsg("⚔️ Quest complete! Returned to town.");
          setTimeout(() => setTagMsg(null), 4000);
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adventureOverlayOpen, adventureSessionId]);

  // ── RPS game ───────────────────────────────────────────────────────────────
  interface RpsGame {
    id: string;
    challenger_id: string; challenger_name: string;
    opponent_id: string;   opponent_name: string;
    challenger_choice: string | null;
    opponent_choice:   string | null;
    status: "pending" | "choosing" | "done";
    winner_id: string | null;
  }
  const [rpsGame, setRpsGame] = useState<RpsGame | null>(null);
  const [rpsMyChoice, setRpsMyChoice] = useState<string | null>(null);
  const [rpsCountdown, setRpsCountdown] = useState(3);
  const rpsCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rpsSeenDoneId = useRef<string | null>(null); // prevent re-announcing same result

  const RPS_EMOJI: Record<string, string> = { rock: "🪨", paper: "📄", scissors: "✂️" };
  const RPS_BEATS: Record<string, string> = { rock: "scissors", scissors: "paper", paper: "rock" };

  // Poll for RPS game state every 1.2s
  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const r = await fetch("/api/town/rps");
        const game: RpsGame | null = await r.json();
        setRpsGame(prev => {
          // When a done game arrives that we haven't announced yet, post chat msg
          if (game?.status === "done" && game.id !== rpsSeenDoneId.current) {
            rpsSeenDoneId.current = game.id;
            const myId = userId;
            const iWon = game.winner_id === myId;
            const isTie = !game.winner_id;
            const myChoice = game.challenger_id === myId ? game.challenger_choice : game.opponent_choice;
            const theirChoice = game.challenger_id === myId ? game.opponent_choice : game.challenger_choice;
            const resultText = isTie
              ? `🤝 RPS Tie! We both threw ${RPS_EMOJI[myChoice ?? ""]}!`
              : iWon
              ? `🏆 I won RPS! ${RPS_EMOJI[myChoice ?? ""]} beats ${RPS_EMOJI[theirChoice ?? ""]}!`
              : `😅 Lost RPS! ${RPS_EMOJI[theirChoice ?? ""]} beats ${RPS_EMOJI[myChoice ?? ""]}…`;
            pendingChatRef.current = resultText;
            // Post share result
            const oppName = game.challenger_id === myId ? game.opponent_name : game.challenger_name;
            // No auto-dismiss — player can manually close or optionally share via the result overlay buttons
          }
          // If this done game was already seen and the user dismissed it (prev=null), keep it gone
          if (game?.status === "done" && game.id === rpsSeenDoneId.current && prev === null) {
            return null;
          }

          // When we transition to choosing phase, start countdown
          if (game?.status === "choosing" && prev?.status !== "choosing") {
            let t = 3; setRpsCountdown(t);
            if (rpsCountdownRef.current) clearInterval(rpsCountdownRef.current);
            rpsCountdownRef.current = setInterval(() => {
              t--; setRpsCountdown(t);
              if (t <= 0) { clearInterval(rpsCountdownRef.current!); rpsCountdownRef.current = null; }
            }, 1000);
          }
          return game;
        });
      } catch { /* ignore */ }
    }, 1200);
    return () => { clearInterval(iv); if (rpsCountdownRef.current) clearInterval(rpsCountdownRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, username]);

  async function sendRpsChallenge(targetId: string, targetName: string) {
    const r = await fetch("/api/town/rps", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "challenge", targetId, targetName }) });
    const d = await r.json();
    if (d.gameId) setRpsGame({ id: d.gameId, challenger_id: userId, challenger_name: username, opponent_id: targetId, opponent_name: targetName, challenger_choice: null, opponent_choice: null, status: "pending", winner_id: null });
  }

  async function acceptRpsChallenge() {
    if (!rpsGame) return;
    await fetch("/api/town/rps", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept", gameId: rpsGame.id }) });
    setRpsCountdown(3);
  }

  async function declineRpsChallenge() {
    if (!rpsGame) return;
    await fetch("/api/town/rps", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "decline", gameId: rpsGame.id }) });
    setRpsGame(null); setRpsMyChoice(null);
  }

  async function makeRpsChoice(choice: string) {
    if (!rpsGame || rpsMyChoice) return;
    setRpsMyChoice(choice);
    await fetch("/api/town/rps", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "choose", gameId: rpsGame.id, choice }) });
  }

  // Chase music (Web Audio)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const chaseMusicActiveRef = useRef(false);
  const chaseNoteIdxRef = useRef(0);
  const chaseMusicTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chatRef = useRef<HTMLInputElement>(null);
  const chatOpenRef = useRef(false); // ref so Phaser update() always reads current value
  const pendingChatRef = useRef<string | null>(null);
  // Tracks real-time positions of other players for tag distance check (avoids stale closure)
  const otherPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Keep ref in sync whenever chatOpen state changes
  function openChat(val: boolean) { chatOpenRef.current = val; setChatOpen(val); }
  const myPosRef = useRef({ x: 800, y: 600 });

  // Overlay open ref — blocks WASD movement in Phaser update() while cave/adventure is open
  const overlayOpenRef = useRef(false);
  // Save player position when overlay opens so we can restore it on close
  const savedPlayerPosRef = useRef<{ x: number; y: number } | null>(null);
  // Teleport ref — set by Phaser scene create(), called to restore player position
  const teleportPlayerRef = useRef<((x: number, y: number) => void) | null>(null);

  // ── Town ambient background music ──────────────────────────────────────────────
  const ambientMusicActiveRef = useRef(false);
  const ambientNoteIdxRef = useRef(0);
  const ambientMusicTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Village-y pentatonic arpeggio: C D E G A at low volume
  const AMBIENT_MELODY = [261.63, 293.66, 329.63, 392, 440, 392, 329.63, 293.66, 261.63, 392, 440, 523.25];
  const AMBIENT_DURATIONS = [480, 360, 360, 480, 720, 360, 360, 360, 480, 360, 480, 960];

  function startAmbientMusic() {
    if (ambientMusicActiveRef.current) return;
    ambientMusicActiveRef.current = true;
    ambientNoteIdxRef.current = 0;
    if (!audioCtxRef.current) {
      try { audioCtxRef.current = new AudioContext(); } catch { return; }
    }
    playAmbientNote();
  }

  function playAmbientNote() {
    if (!ambientMusicActiveRef.current) return;
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const idx = ambientNoteIdxRef.current % AMBIENT_MELODY.length;
    const freq = AMBIENT_MELODY[idx];
    const dur = AMBIENT_DURATIONS[idx] / 1000;
    ambientNoteIdxRef.current++;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur * 0.85);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur);
    } catch { /* ignore */ }
    ambientMusicTimeoutRef.current = setTimeout(playAmbientNote, AMBIENT_DURATIONS[idx] * 0.92);
  }

  function stopAmbientMusic() {
    ambientMusicActiveRef.current = false;
    if (ambientMusicTimeoutRef.current) { clearTimeout(ambientMusicTimeoutRef.current); ambientMusicTimeoutRef.current = null; }
  }

  // ── Town SFX helpers ───────────────────────────────────────────────────────
  function ensureAudioCtx() {
    if (!audioCtxRef.current) {
      try { audioCtxRef.current = new AudioContext(); } catch { return null; }
    }
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume().catch(() => {});
    return audioCtxRef.current;
  }

  function playSlurpSound() {
    const ctx = ensureAudioCtx(); if (!ctx) return;
    // Slurp: quick frequency sweep with wobble
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(500 + i * 80, ctx.currentTime + i * 0.07);
      osc.frequency.exponentialRampToValueAtTime(200 + i * 30, ctx.currentTime + i * 0.07 + 0.1);
      gain.gain.setValueAtTime(0.07, ctx.currentTime + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.07 + 0.12);
      osc.start(ctx.currentTime + i * 0.07);
      osc.stop(ctx.currentTime + i * 0.07 + 0.12);
    }
  }

  function playActionSlotSound(active = false) {
    const ctx = ensureAudioCtx(); if (!ctx) return;
    // Satisfying "bloop" click — higher pitch when activating targeting mode
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(active ? 880 : 660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(active ? 440 : 220, ctx.currentTime + 0.09);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.13);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.14);
    osc.onended = () => { try { ctx.close(); } catch { /* ignore */ } };
  }

  function playAwwwSound() {
    const ctx = ensureAudioCtx(); if (!ctx) return;
    // "Awwww" — gentle descending warmth
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(330, ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.08);
    gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.65);
    // Second voice for warmth
    const osc2 = ctx.createOscillator(); const gain2 = ctx.createGain();
    osc2.type = "sine"; osc2.frequency.setValueAtTime(550, ctx.currentTime);
    osc2.frequency.linearRampToValueAtTime(420, ctx.currentTime + 0.4);
    gain2.gain.setValueAtTime(0, ctx.currentTime);
    gain2.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc2.connect(gain2); gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime); osc2.stop(ctx.currentTime + 0.55);
  }

  function playBrainFreezeSound() {
    const ctx = ensureAudioCtx(); if (!ctx) return;
    // Brain freeze: disorienting descending chord + wobble
    [440, 311, 261].forEach((freq, i) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.6, ctx.currentTime + i * 0.12 + 1.2);
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.09, ctx.currentTime + i * 0.12 + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 1.3);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.12); osc.stop(ctx.currentTime + i * 0.12 + 1.4);
    });
  }

  function triggerBrainFreeze() {
    setBrainFreezeActive(true);
    playBrainFreezeSound();
    if (brainFreezeTimerRef.current) clearTimeout(brainFreezeTimerRef.current);
    brainFreezeTimerRef.current = setTimeout(() => {
      setBrainFreezeActive(false);
    }, 4000);
  }

  // ── Chase music ────────────────────────────────────────────────────────────────
  const CHASE_NOTES = [220, 233, 261, 246, 220, 196, 207, 233];

  function startChaseMusic() {
    if (chaseMusicActiveRef.current) return;
    chaseMusicActiveRef.current = true;
    chaseNoteIdxRef.current = 0;
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    } catch { return; }
    playChaseNote();
  }

  function playChaseNote() {
    if (!chaseMusicActiveRef.current) return;
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const freq = CHASE_NOTES[chaseNoteIdxRef.current % CHASE_NOTES.length];
    chaseNoteIdxRef.current++;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.055, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.13);
    } catch { /* ignore */ }
    chaseMusicTimeoutRef.current = setTimeout(playChaseNote, 145);
  }

  function stopChaseMusic() {
    chaseMusicActiveRef.current = false;
    if (chaseMusicTimeoutRef.current) {
      clearTimeout(chaseMusicTimeoutRef.current);
      chaseMusicTimeoutRef.current = null;
    }
  }

  // ── Tag game lifecycle ─────────────────────────────────────────────────────────
  function beginTagGame(itId: string, itUname: string, startingTime = TAG_GAME_DURATION) {
    if (tagGameActiveRef.current) return; // already running
    tagGameActiveRef.current = true;
    tagSpeedActiveRef.current = true;
    tagItIdRef.current = itId;
    tagItUsernameRef.current = itUname;
    setTagGameActive(true);
    setTagTimeLeft(Math.round(startingTime));
    if (itId === userId) startChaseMusic();

    let timeLeft = Math.round(startingTime);
    tagTimerRef.current = setInterval(() => {
      timeLeft--;
      setTagTimeLeft(timeLeft);
      if (timeLeft <= 0) {
        endTagGame();
      }
    }, 1000);
  }

  function endTagGame() {
    if (!tagGameActiveRef.current) return;
    tagGameActiveRef.current = false;
    tagGameEndedAtRef.current = Date.now(); // debounce — prevent DB poll from restarting game
    tagSpeedActiveRef.current = false;
    if (tagTimerRef.current) { clearInterval(tagTimerRef.current); tagTimerRef.current = null; }
    stopChaseMusic();

    const loserUsername = tagItUsernameRef.current || "someone";
    const isLoser = tagItIdRef.current === userId;
    const resultMsg = isLoser
      ? `😬 You were IT when time ran out — you lost!`
      : `🎉 Time's up! @${loserUsername} was IT — you survive!`;

    setTagMsg(resultMsg);
    // Show result with optional share button for 12s
    setTagShareCaption(isLoser ? null : `🏃 I survived Town Tag! @${loserUsername} was stuck as IT when the timer ran out! 🏷️`);
    setTimeout(() => { setTagMsg(null); setTagShareCaption(null); }, 12000);

    // Clear IT from DB so other clients know the game ended
    fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "tag", tagItId: null }) }).catch(() => {});

    setTagGameActive(false);
    setTagItId(null);
    setTagItUsername("");
    setTagTimeLeft(TAG_GAME_DURATION);
    tagItIdRef.current = null;
    tagItUsernameRef.current = "";
  }


  // ── Tag actions ────────────────────────────────────────────────────────────────
  async function startTag() {
    await fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...myPosRef.current, direction: "down", action: "tag", tagItId: userId }) }).catch(() => {});
    setTagItId(userId);
    setTagItUsername(username);
    tagItIdRef.current = userId;
    tagItUsernameRef.current = username;
    setTagMsg("🏃 You're IT! Chase someone!");
    setTimeout(() => setTagMsg(null), 3000);
    beginTagGame(userId, username);
  }

  async function tryTag(targetId: string, targetUsername: string) {
    if (tagItIdRef.current !== userId) return;
    const pos = myPosRef.current;
    // Use ref (always current) instead of stale nearbyPlayers state closure
    const targetPos = otherPositionsRef.current.get(targetId);
    if (!targetPos) { setTagMsg("Can't find that player!"); setTimeout(() => setTagMsg(null), 2000); return; }
    const dist = Math.hypot(targetPos.x - pos.x, targetPos.y - pos.y);
    if (dist > TAG_DIST) { setTagMsg("Too far away! Get closer to tag! 🏃"); setTimeout(() => setTagMsg(null), 2000); return; }
    await fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...pos, direction: "down", action: "tag", tagItId: targetId }) }).catch(() => {});
    setTagItId(targetId);
    setTagItUsername(targetUsername);
    tagItIdRef.current = targetId;
    tagItUsernameRef.current = targetUsername;
    // I tagged someone — I'm no longer IT, stop my chase music
    stopChaseMusic();
    setTagMsg(`🎯 You tagged @${targetUsername}! They're IT now!`);
    setTimeout(() => setTagMsg(null), 3000);
    if (!tagGameActiveRef.current) beginTagGame(targetId, targetUsername);
  }

  // ── Friend invite ──────────────────────────────────────────────────────────────
  async function loadFriends() {
    try {
      const r = await fetch("/api/friends");
      const d = await r.json();
      setFriends(Array.isArray(d) ? d.map((f: Record<string, unknown>) => ({
        id: f.id as string, username: f.username as string, avatar_url: f.avatar_url as string | null,
      })) : []);
    } catch { /* ignore */ }
  }

  async function inviteFriend(friendId: string, friendUsername: string) {
    await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiverId: friendId, content: `🏘️ Come hang out with me in Town Square! ${process.env.NEXT_PUBLIC_SITE_URL ?? "https://flocksocial.netlify.app"}/town` }) }).catch(() => {});
    setTagMsg(`✅ Invite sent to @${friendUsername}!`);
    setTimeout(() => setTagMsg(null), 3000);
    setShowInvite(false);
  }

  async function sendPartyDmInvite(toUserId: string, toUsername: string) {
    if (!myParty) return;
    setPartyInviteSent(toUserId);
    await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        receiverId: toUserId,
        content: `[party:${myParty.id}]`,
      }),
    }).catch(() => {});
    setTimeout(() => setPartyInviteSent(null), 3000);
  }

  // ── Init Phaser ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let game: import("phaser").Game | null = null;

    async function initPhaser() {
      const Phaser = (await import("phaser")).default;
      if (!containerRef.current) return;

      class TownScene extends Phaser.Scene {
        player!: Phaser.GameObjects.Container;
        playerImg!: Phaser.GameObjects.Image;
        playerLabel!: Phaser.GameObjects.Text;
        playerBubble!: Phaser.GameObjects.Container;
        playerItBadge!: Phaser.GameObjects.Text;
        playerItemText!: Phaser.GameObjects.Text;
        playerWeaponText!: Phaser.GameObjects.Text;
        others: Map<string, {
          container: Phaser.GameObjects.Container;
          img: Phaser.GameObjects.Image;
          label: Phaser.GameObjects.Text;
          bubble: Phaser.GameObjects.Container;
          itBadge: Phaser.GameObjects.Text;
          itemText: Phaser.GameObjects.Text;
          weaponText: Phaser.GameObjects.Text;
          targetX: number; targetY: number;
          // Velocity extrapolation for smooth movement
          vx: number; vy: number;
          lastUpdateTime: number;
        }> = new Map();
        loadingTextures: Set<string> = new Set(); // prevent duplicate loads
        cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
        wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
        posTimer = 0; pollTimer = 0;
        direction = "down";
        chatBubbleTimer = 0;

        constructor() { super({ key: "TownScene" }); }

        preload() {
          // Use resilient loader with letter-avatar fallback
          makeLetterAvatarTexture(this, "avatar_me", username);
          const applyTexture = (img: HTMLImageElement) => {
            try {
              if (this.textures.exists("avatar_me")) this.textures.remove("avatar_me");
              this.textures.addImage("avatar_me", img);
              // Refresh the sprite and restore display size (setTexture resets scale)
              this.playerImg?.setTexture("avatar_me").setDisplaySize(38, 38);
            } catch { /* keep letter avatar */ }
          };
          const el = new Image();
          el.crossOrigin = "anonymous";
          el.onload = () => applyTexture(el);
          el.onerror = () => {
            // try without CORS
            const el2 = new Image();
            el2.onload = () => applyTexture(el2);
            el2.src = avatarUrl;
          };
          el.src = avatarUrl;
        }

        create() {
          // Town center shifted right to make room for village+castle on the left
          const TCX = 2800;

          // ── Tileable grass floor (town area: x=1600–3280) ────────────────────
          const bg = this.add.graphics();
          for (let tx = 1600; tx < 3280; tx += TILE) {
            for (let ty = 0; ty < H; ty += TILE) {
              const shade = ((tx / TILE + ty / TILE) % 2 === 0) ? 0x3a7a3a : 0x347034;
              bg.fillStyle(shade, 1);
              bg.fillRect(tx, ty, TILE, TILE);
            }
          }
          // Decorative colored tiles (original town style)
          const tileColors = [0x2a5ca8, 0x1e8a4a, 0x8a3a2a, 0x6a4a8a, 0x1a6a6a, 0x4a6a1a];
          const rng = (seed: number) => { let s = seed; s = ((s >> 16) ^ s) * 0x45d9f3b; return ((s >> 16) ^ s) & 0xffff; };
          for (let i = 0; i < 180; i++) {
            const cx = (rng(i * 7 + 1) % (W - 80)) + 40;
            const cy = (rng(i * 7 + 3) % (H - 80)) + 40;
            if (cx < 1600 || cx > 3280) continue; // only decorate town tiles
            if (Math.abs(cx - TCX) < 70 || Math.abs(cy - H/2) < 70) continue;
            const col = tileColors[i % tileColors.length];
            bg.fillStyle(col, 0.45);
            const ts = 16 + (rng(i * 7 + 5) % 24);
            bg.fillRect(cx, cy, ts, ts);
          }

          // ── Stone paths ──────────────────────────────────────────────────────
          const path = this.add.graphics();
          path.fillStyle(0xc8b878, 0.9);
          path.fillRect(TCX - 52, 0, 104, H); // vertical path through town center
          path.fillRect(0, H/2 - 52, W, 104); // horizontal road extends full map width
          // Path texture lines
          path.lineStyle(1, 0xb0a060, 0.3);
          for (let tx = TCX-52; tx < TCX+52; tx += TILE) { path.moveTo(tx, 0); path.lineTo(tx, H); }
          for (let ty = H/2-52; ty < H/2+52; ty += TILE) { path.moveTo(0, ty); path.lineTo(W, ty); }
          path.strokePath();

          // ── Center fountain ──────────────────────────────────────────────────
          const cx = TCX, cy = H/2;
          const fountain = this.add.graphics();
          fountain.fillStyle(0x1a5080, 1); fountain.fillCircle(cx, cy, 72);
          fountain.fillStyle(0x2a6fa0, 1); fountain.fillCircle(cx, cy, 55);
          fountain.fillStyle(0x4a9ac8, 0.8); fountain.fillCircle(cx, cy, 28);
          fountain.fillStyle(0x88ccee, 0.5); fountain.fillCircle(cx, cy, 14);
          [[-96,0],[96,0],[0,-96],[0,96]].forEach(([bx,by]) => {
            fountain.fillStyle(0x6b4f1a, 1);
            fountain.fillRoundedRect(cx+bx-22, cy+by-9, 44, 18, 5);
          });
          this.add.text(cx, cy+90, "✨ Town Square", {
            fontSize: "13px", color: "#aad8f8", fontFamily: "monospace", fontStyle: "bold",
          }).setOrigin(0.5).setAlpha(0.85);

          // ── Buildings ────────────────────────────────────────────────────────
          BUILDINGS.forEach(b => {
            const g = this.add.graphics();
            g.fillStyle(0x000000, 0.25); g.fillRoundedRect(b.x+8, b.y+8, b.w, b.h, 6);
            g.fillStyle(b.color, 1); g.fillRoundedRect(b.x, b.y, b.w, b.h, 6);
            g.fillStyle(b.roof, 1); g.fillRoundedRect(b.x, b.y, b.w, 30, { tl: 6, tr: 6, bl: 0, br: 0 });
            g.fillStyle(0xffd880, 0.9);
            g.fillRoundedRect(b.x+18, b.y+42, 30, 30, 3);
            g.fillRoundedRect(b.x+b.w-48, b.y+42, 30, 30, 3);
            if (b.w > 160) g.fillRoundedRect(b.x+b.w/2-15, b.y+42, 30, 30, 3);
            g.fillStyle(0x3a2010, 1);
            g.fillRoundedRect(b.x+b.w/2-18, b.y+b.h-46, 36, 46, { tl: 4, tr: 4, bl: 0, br: 0 });
            g.fillStyle(0xffd060, 1); g.fillCircle(b.x+b.w/2+10, b.y+b.h-26, 3);
            this.add.text(b.x+b.w/2, b.y+15, b.label, {
              fontSize: "11px", color: "#ffffff", fontFamily: "monospace", fontStyle: "bold",
            }).setOrigin(0.5, 0.5);
            const zone = this.add.zone(b.x+b.w/2, b.y+b.h/2, b.w, b.h).setInteractive({ cursor: "pointer" });
            if (b.label === "🎬 Cinema") {
              zone.on("pointerdown", () => { openTheaterRef.current?.(); });
            } else if (b.label === "🎮 Arcade") {
              zone.on("pointerdown", () => { arcadeOpenRef.current = true; setArcadeOpen(true); });
            } else {
              zone.on("pointerdown", () => { setConfirmLeave({ label: b.label, href: b.link }); });
            }
          });

          // ── Market District (right side, x > 3272) ───────────────────────────
          {
            const mg = this.add.graphics();
            // Cobblestone ground for market area
            mg.fillStyle(0xb8a878, 0.9);
            mg.fillRect(3272, 0, 1128, H); // market district: x=3272–4400
            // Cobblestone texture lines (horizontal + vertical)
            mg.lineStyle(1, 0xa09060, 0.35);
            for (let ty2 = 0; ty2 < H; ty2 += 24) { mg.moveTo(3272, ty2); mg.lineTo(4400, ty2); }
            for (let tx2 = 3272; tx2 < 4400; tx2 += 36) { mg.moveTo(tx2, 0); mg.lineTo(tx2, H); }
            mg.strokePath();
            // Dividing border between town and market (stone wall)
            const border = this.add.graphics();
            border.fillStyle(0x7a6a40, 1); border.fillRect(3264, 0, 16, H);
            border.fillStyle(0x9a8a60, 1); border.fillRect(3264, 0, 8, H);
            // Arch / gate at the horizontal path
            border.fillStyle(0xc8a840, 1); border.fillRoundedRect(3252, H/2-60, 40, 120, 10);
            border.fillStyle(0x0d1117, 0.9); border.fillRoundedRect(3260, H/2-48, 24, 96, 6);
            this.add.text(3272, H/2-70, "🛒 Market", {
              fontSize: "12px", color: "#ffd060", fontFamily: "monospace", fontStyle: "bold",
            }).setOrigin(0.5, 1);

            // Market stalls
            MARKET_STALLS.forEach(s => {
              const sg = this.add.graphics();
              // Shadow
              sg.fillStyle(0x000000, 0.2); sg.fillRoundedRect(s.x+6, s.y+6, s.w, s.h, 5);
              // Body
              sg.fillStyle(s.color, 1); sg.fillRoundedRect(s.x, s.y, s.w, s.h, 5);
              // Roof / awning
              sg.fillStyle(s.roof, 1); sg.fillRoundedRect(s.x, s.y, s.w, 26, { tl: 5, tr: 5, bl: 0, br: 0 });
              // Awning stripes
              sg.fillStyle(s.awning, 1);
              for (let ai = 0; ai < 5; ai++) {
                sg.fillRect(s.x + ai * (s.w / 5), s.y + 26, s.w / 10, 18);
              }
              // Window
              sg.fillStyle(0xffd880, 0.85); sg.fillRoundedRect(s.x + 14, s.y + 50, s.w - 28, 38, 3);
              // Door
              sg.fillStyle(0x3a2010, 1); sg.fillRoundedRect(s.x + s.w/2 - 14, s.y + s.h - 42, 28, 42, { tl: 4, tr: 4, bl: 0, br: 0 });
              // Label
              this.add.text(s.x + s.w/2, s.y + 12, s.label, {
                fontSize: "11px", color: "#fff", fontFamily: "monospace", fontStyle: "bold",
              }).setOrigin(0.5, 0.5);
              // Shopkeeper NPC at the door
              const sk = this.add.graphics();
              const skx = s.x + s.w / 2, sky = s.y + s.h - 16;
              sk.fillStyle(0xc8a070, 1); sk.fillCircle(skx, sky - 22, 8); // head
              sk.fillStyle(s.color, 1); sk.fillRect(skx - 7, sky - 14, 14, 16); // body
              sk.fillStyle(0xffffff, 0.8); sk.fillRect(skx - 5, sky - 12, 10, 12); // apron
              sk.fillStyle(0x6a4a10, 1); sk.fillRect(skx - 9, sky - 27, 18, 6); // hat brim
              sk.fillStyle(0x8a6a20, 1); sk.fillRect(skx - 6, sky - 36, 12, 12); // hat top
              sk.setDepth(7);

              // "Press E to shop" hint (appears when near)
              const shopHint = this.add.text(skx, sky - 50, "Press E to shop", {
                fontSize: "10px", color: "#ffd060", fontFamily: "monospace",
                backgroundColor: "rgba(0,0,0,0.75)", padding: { x: 5, y: 2 },
              }).setOrigin(0.5, 1).setAlpha(0).setDepth(20);

              // Store hint + position for proximity check in update()
              const shopEntry = { label: s.label, x: skx, y: sky, hint: shopHint };
              const rec = this as unknown as Record<string, unknown>;
              if (!Array.isArray(rec._shopNpcs)) rec._shopNpcs = [];
              (rec._shopNpcs as typeof shopEntry[]).push(shopEntry);

              // Click zone still works (for mouse/tap users)
              const zone = this.add.zone(skx, sky - 10, 36, 52).setInteractive({ cursor: "pointer" });
              zone.on("pointerdown", () => { setActiveRoom(s.label); activeRoomRef.current = s.label; });
            });

            // Market trees (between stalls)
            [[3460, 300],[3720, 300],[3970, 300],[3460, 820],[3720, 820],[3970, 820],
             [3380, 560],[3650, 560],[3880, 560]].forEach(([tx2, ty2]) => {
              const tg = this.add.graphics();
              tg.fillStyle(0x6a3a12, 1); tg.fillRect(tx2-4, ty2+8, 8, 22);
              tg.fillStyle(0x0e5520, 1); tg.fillTriangle(tx2, ty2-30, tx2-24, ty2+10, tx2+24, ty2+10);
              tg.fillStyle(0x1a8030, 1); tg.fillCircle(tx2, ty2-12, 15);
              tg.fillStyle(0x40bb50, 0.35); tg.fillCircle(tx2-4, ty2-18, 8);
            });

            // Decorative barrels + crates
            [[3360, H/2-90],[3360, H/2+70],[3950, H/2-90],[3950, H/2+70]].forEach(([bx, by]) => {
              const bg2 = this.add.graphics();
              bg2.fillStyle(0x6a3a18, 1); bg2.fillEllipse(bx, by, 28, 22);
              bg2.fillStyle(0x8a5a30, 1); bg2.fillRect(bx-12, by-20, 24, 40);
              bg2.fillStyle(0x6a3a18, 1); bg2.fillEllipse(bx, by-20, 28, 10);
              bg2.lineStyle(2, 0x404040, 1);
              bg2.strokeRect(bx-12, by-5, 24, 4);
              bg2.strokeRect(bx-12, by+5, 24, 4);
            });

            // Old-timey lampposts for market street
            [3350, 3500, 3700, 3900].forEach(lpx => {
              [200, H-200].forEach(lpy => {
                const lp = this.add.graphics();
                lp.fillStyle(0x786040, 1); lp.fillRect(lpx-4, lpy-50, 8, 60);
                lp.fillStyle(0x786040, 1); lp.fillRect(lpx-4, lpy-50, 14, 5);
                lp.fillStyle(0xffee88, 1); lp.fillEllipse(lpx+6, lpy-52, 16, 20);
                lp.fillStyle(0xffee88, 0.2); lp.fillEllipse(lpx+6, lpy-52, 36, 36);
              });
            });

            // ── Horse & Carriage ─────────────────────────────────────────────
            // A container that bounces back and forth along the horizontal path
            const carriage = this.add.container(3360, H/2);

            // Horse body
            const horse = this.add.graphics();
            horse.fillStyle(0x7a4020, 1);
            horse.fillEllipse(-48, -8, 56, 28); // body
            horse.fillStyle(0x6a3010, 1);
            horse.fillEllipse(-22, -20, 18, 22); // neck
            horse.fillStyle(0x7a4020, 1);
            horse.fillEllipse(-12, -28, 16, 18); // head
            // Legs
            horse.fillStyle(0x6a3010, 1);
            horse.fillRect(-60, 4, 8, 20);
            horse.fillRect(-50, 4, 8, 20);
            horse.fillRect(-36, 4, 8, 20);
            horse.fillRect(-26, 4, 8, 20);
            // Mane
            horse.fillStyle(0x3a1a05, 1);
            horse.fillRect(-18, -36, 4, 18);
            horse.fillRect(-22, -34, 4, 14);
            horse.fillRect(-26, -32, 4, 10);
            // Tail
            horse.fillStyle(0x3a1a05, 1);
            horse.fillRect(-74, -14, 4, 24);
            horse.fillRect(-78, -10, 4, 20);
            carriage.add(horse);

            // Carriage body
            const car = this.add.graphics();
            car.fillStyle(0x000000, 0.18); car.fillRoundedRect(8, -2, 72, 52, 5); // shadow
            car.fillStyle(0x8a3010, 1);   car.fillRoundedRect(4, -6, 72, 50, 6); // body
            car.fillStyle(0x6a2008, 1);   car.fillRoundedRect(4, -6, 72, 14, { tl: 6, tr: 6, bl: 0, br: 0 }); // roof
            car.fillStyle(0xffd060, 0.8); car.fillRoundedRect(10, 6, 26, 22, 3); // window L
            car.fillStyle(0xffd060, 0.8); car.fillRoundedRect(42, 6, 26, 22, 3); // window R
            // Wheels
            car.fillStyle(0x2a1a05, 1); car.fillCircle(18, 44, 14);
            car.fillStyle(0x2a1a05, 1); car.fillCircle(60, 44, 14);
            car.fillStyle(0x5a3a10, 1); car.fillCircle(18, 44, 10);
            car.fillStyle(0x5a3a10, 1); car.fillCircle(60, 44, 10);
            car.fillStyle(0xaa8040, 1); car.fillCircle(18, 44, 4);
            car.fillStyle(0xaa8040, 1); car.fillCircle(60, 44, 4);
            // Hitch connecting horse to carriage
            car.lineStyle(2, 0x3a2010, 1); car.moveTo(4, 30); car.lineTo(-12, 0); car.strokePath();
            carriage.add(car);

            // Driver on top
            const driver = this.add.graphics();
            driver.fillStyle(0x2a1a08, 1); driver.fillRect(22, -22, 18, 16); // body
            driver.fillStyle(0xc8a070, 1); driver.fillCircle(31, -28, 8); // head
            driver.fillStyle(0x1a1a1a, 1); driver.fillRect(22, -30, 18, 6); // hat brim
            driver.fillStyle(0x1a1a1a, 1); driver.fillRect(26, -38, 10, 12); // hat top
            carriage.add(driver);

            carriage.setDepth(8);

            // Animate carriage back and forth along the horizontal path
            let carriageDir = 1;
            let carriageX = 3360;
            const carriageMinX = 3320;
            const carriageMaxX = 3920;
            const carriageSpeed = 60; // px/sec

            // Store update function on scene for access in update()
            (this as unknown as Record<string, unknown>)._updateCarriage = (dt: number) => {
              carriageX += carriageDir * carriageSpeed * (dt / 1000);
              if (carriageX > carriageMaxX) { carriageX = carriageMaxX; carriageDir = -1; }
              if (carriageX < carriageMinX) { carriageX = carriageMinX; carriageDir = 1; }
              carriage.x = carriageX;
              // Flip based on direction
              carriage.setScale(carriageDir < 0 ? -1 : 1, 1);
            };
          }

          // ── Trees ────────────────────────────────────────────────────────────
          TREES.forEach(([tx, ty]) => {
            const g = this.add.graphics();
            g.fillStyle(0x000000, 0.15); g.fillEllipse(tx, ty+24, 48, 14);
            g.fillStyle(0x6a3a12, 1); g.fillRect(tx-5, ty+10, 10, 26);
            g.fillStyle(0x145520, 1); g.fillTriangle(tx, ty-38, tx-28, ty+12, tx+28, ty+12);
            g.fillStyle(0x1a7a2a, 1); g.fillTriangle(tx, ty-30, tx-22, ty+16, tx+22, ty+16);
            g.fillStyle(0x22aa38, 1); g.fillCircle(tx, ty-18, 17);
            g.fillStyle(0x44cc55, 0.4); g.fillCircle(tx-5, ty-24, 9);
          });

          // ── Lampposts ────────────────────────────────────────────────────────
          [[TCX-88,H/2-88],[TCX+88,H/2-88],[TCX-88,H/2+88],[TCX+88,H/2+88],
           [1800,H/2],[3200,H/2],[TCX,200],[TCX,H-200]].forEach(([lx,ly]) => {
            const lg = this.add.graphics();
            lg.fillStyle(0x909090, 1); lg.fillRect(lx-3, ly-44, 6, 54);
            lg.fillStyle(0x707070, 1); lg.fillRect(lx-8, ly-44, 16, 4);
            lg.fillStyle(0xfffaaa, 1); lg.fillCircle(lx, ly-46, 9);
            lg.fillStyle(0xfffaaa, 0.15); lg.fillCircle(lx, ly-46, 28);
          });

          // ── North Gate ───────────────────────────────────────────────────────
          {
            const gx = TCX, gy = 80;
            const gate = this.add.graphics();
            // Stone arch
            gate.fillStyle(0x7a7060, 1);
            gate.fillRect(gx - 70, gy - 20, 140, 60);
            gate.fillStyle(0x9a9080, 1);
            gate.fillRect(gx - 60, gy - 20, 120, 10);
            // Gate arch top
            gate.fillStyle(0x888070, 1);
            gate.fillRoundedRect(gx - 55, gy - 40, 110, 28, { tl: 20, tr: 20, bl: 0, br: 0 });
            gate.fillStyle(0xccbc80, 1);
            gate.fillRect(gx - 28, gy, 56, 40);
            gate.fillStyle(0x3a2a10, 0.8);
            gate.fillRoundedRect(gx - 22, gy + 2, 44, 38, { tl: 4, tr: 4, bl: 0, br: 0 });
            // Portcullis bars
            gate.lineStyle(2, 0x6a5a30, 1);
            for (let bar = -18; bar <= 18; bar += 9) {
              gate.moveTo(gx + bar, gy + 2); gate.lineTo(gx + bar, gy + 38);
            }
            gate.strokePath();
            this.add.text(gx, gy - 48, "🏰 North Gate", {
              fontSize: "11px", color: "#ffd060", fontFamily: "monospace", fontStyle: "bold",
            }).setOrigin(0.5, 1);

            // Guard 1
            const g1 = this.add.graphics();
            g1.fillStyle(0x4466aa, 1); g1.fillRect(gx - 85, gy + 8, 16, 20);
            g1.fillStyle(0xc8a070, 1); g1.fillCircle(gx - 77, gy + 4, 8);
            g1.fillStyle(0x334488, 1); g1.fillRect(gx - 82, gy - 4, 10, 6);
            this.add.text(gx - 77, gy + 32, "Guard", {
              fontSize: "8px", color: "#aabbff", fontFamily: "monospace",
            }).setOrigin(0.5, 0);

            // Guard 2
            const g2 = this.add.graphics();
            g2.fillStyle(0x4466aa, 1); g2.fillRect(gx + 69, gy + 8, 16, 20);
            g2.fillStyle(0xc8a070, 1); g2.fillCircle(gx + 77, gy + 4, 8);
            g2.fillStyle(0x334488, 1); g2.fillRect(gx + 72, gy - 4, 10, 6);
            this.add.text(gx + 77, gy + 32, "Guard", {
              fontSize: "8px", color: "#aabbff", fontFamily: "monospace",
            }).setOrigin(0.5, 0);

            // Captain NPC
            const cap = this.add.graphics();
            // Gold glow
            cap.fillStyle(0xffd700, 0.25); cap.fillCircle(gx, gy + 165, 26);
            cap.fillStyle(0xaa6600, 1); cap.fillRect(gx - 10, gy + 148, 20, 22);
            cap.fillStyle(0xc8a070, 1); cap.fillCircle(gx, gy + 144, 10);
            cap.fillStyle(0x884400, 1); cap.fillRect(gx - 12, gy + 132, 24, 8);
            cap.fillRect(gx - 8, gy + 128, 16, 10);
            // Captain badge
            cap.fillStyle(0xffd700, 1); cap.fillCircle(gx + 7, gy + 152, 4);
            const captainLabel = this.add.text(gx, gy + 174, "⚔️ Captain", {
              fontSize: "10px", color: "#ffd700", fontFamily: "monospace", fontStyle: "bold",
              backgroundColor: "rgba(0,0,0,0.6)", padding: { x: 4, y: 2 },
            }).setOrigin(0.5, 0);

            const eKeyHint = this.add.text(gx, gy + 110, "", {
              fontSize: "11px", color: "#ffffaa", fontFamily: "monospace",
              backgroundColor: "rgba(0,0,0,0.7)", padding: { x: 6, y: 3 },
            }).setOrigin(0.5, 0.5).setAlpha(0);

            // Click zone on captain
            const capZone = this.add.zone(gx, gy + 155, 40, 50).setInteractive({ cursor: "pointer" });
            capZone.on("pointerdown", () => { if (abilityTargetModeRef.current) { abilityTargetModeRef.current = null; setAbilityTargetMode(null); return; } openCaptainDialog(); });

            // E key interaction
            this.input.keyboard!.on("keydown-E", () => {
              if (!chatOpenRef.current && captainHintRef.current) openCaptainDialog();
            });

            // Store eKeyHint ref so update() can toggle it
            (this as unknown as Record<string, unknown>)._eKeyHint = eKeyHint;
            (this as unknown as Record<string, unknown>)._captainY = gy + 155;
          }

          // ── South Cave ───────────────────────────────────────────────────────
          {
            const cvx = TCX, cvy = H - 80;
            const cave = this.add.graphics();
            // Cave mouth arch (dark opening)
            cave.fillStyle(0x2a1a0a, 1); cave.fillEllipse(cvx, cvy + 10, 120, 80);
            cave.fillStyle(0x0a0808, 0.95); cave.fillEllipse(cvx, cvy + 14, 100, 62);
            // Rocky frame around cave
            cave.fillStyle(0x5a4a30, 1);
            cave.fillTriangle(cvx - 55, cvy + 40, cvx - 70, cvy - 20, cvx - 38, cvy - 10);
            cave.fillTriangle(cvx + 55, cvy + 40, cvx + 70, cvy - 20, cvx + 38, cvy - 10);
            cave.fillStyle(0x7a6040, 1);
            cave.fillTriangle(cvx - 30, cvy - 18, cvx - 48, cvy - 50, cvx - 10, cvy - 14);
            cave.fillTriangle(cvx + 30, cvy - 18, cvx + 48, cvy - 50, cvx + 10, cvy - 14);
            // Stalactites
            cave.fillStyle(0x1a1208, 1);
            [[-24, -4], [0, -8], [20, -2]].forEach(([ox, oy]) => {
              cave.fillTriangle(cvx+ox-5, cvy+oy+12, cvx+ox+5, cvy+oy+12, cvx+ox, cvy+oy+28);
            });
            // Glow from inside
            cave.fillStyle(0x550000, 0.25); cave.fillEllipse(cvx, cvy + 18, 80, 48);
            cave.setDepth(3);
            this.add.text(cvx, cvy - 56, "🕳️ South Cave", {
              fontSize: "11px", color: "#ff9944", fontFamily: "monospace", fontStyle: "bold",
            }).setOrigin(0.5, 1).setDepth(4);
            // Skull decorations
            this.add.text(cvx - 52, cvy - 28, "💀", { fontSize: "13px" }).setOrigin(0.5).setDepth(4);
            this.add.text(cvx + 52, cvy - 28, "💀", { fontSize: "13px" }).setOrigin(0.5).setDepth(4);

            const caveHint = this.add.text(cvx, cvy - 68, "Press E to enter cave", {
              fontSize: "11px", color: "#ff9944", fontFamily: "monospace",
              backgroundColor: "rgba(0,0,0,0.75)", padding: { x: 6, y: 3 },
            }).setOrigin(0.5, 1).setAlpha(0).setDepth(20);

            const caveZone = this.add.zone(cvx, cvy, 110, 70).setInteractive({ cursor: "pointer" });
            caveZone.on("pointerdown", () => { if (abilityTargetModeRef.current) { abilityTargetModeRef.current = null; setAbilityTargetMode(null); return; } openCaveRef.current?.(); });

            (this as unknown as Record<string, unknown>)._caveHint = caveHint;
            (this as unknown as Record<string, unknown>)._cavePosX = cvx;
            (this as unknown as Record<string, unknown>)._cavePosY = cvy;

            // E key for cave (checked in update)
            this.input.keyboard!.on("keydown-E", () => {
              if (!chatOpenRef.current && caveHintRef.current) openCaveRef.current?.();
            });
          }

          // ── Village — Millhaven (x=700–1600, WEST of town) ───────────────────
          {
            // Village grass floor
            const vg = this.add.graphics();
            vg.fillStyle(0x4a7a2a, 1); vg.fillRect(700, 0, 900, H);
            for (let vi = 0; vi < 55; vi++) {
              const vx2 = 700 + (rng(vi * 13 + 5) % 860) + 20;
              const vy2 = (rng(vi * 13 + 7) % (H - 60)) + 30;
              vg.fillStyle(0x5a8a30, 0.32); vg.fillCircle(vx2, vy2, 9 + (rng(vi * 13 + 9) % 14));
            }
            // Stone divider wall — east side (between village and town at x=1600)
            const vwall = this.add.graphics();
            vwall.fillStyle(0x7a6a50, 1); vwall.fillRect(1594, 0, 14, H);
            vwall.fillStyle(0x9a8a70, 1); vwall.fillRect(1594, 0, 7, H);
            vwall.fillStyle(0xccaa60, 1); vwall.fillRoundedRect(1582, H/2-60, 38, 120, 8);
            vwall.fillStyle(0x0d1117, 0.87); vwall.fillRoundedRect(1590, H/2-48, 22, 96, 5);
            this.add.text(1600, H/2 - 72, "🌿 Millhaven", { fontSize: "11px", color: "#ccee88", fontFamily: "monospace", fontStyle: "bold" }).setOrigin(0.5, 1);
            // Dirt road through village
            vg.fillStyle(0xb89858, 0.62); vg.fillRect(700, H/2 - 42, 900, 84);
            vg.fillStyle(0xa88848, 0.28); vg.fillRect(700, H/2 - 36, 900, 72);

            // Village well — north of road
            const well = this.add.graphics();
            const wellx = 1000, welly = H/2 - 150;
            well.fillStyle(0x7a6a50, 1); well.fillCircle(wellx, welly, 22);
            well.fillStyle(0x3a2e28, 1); well.fillCircle(wellx, welly, 14);
            well.fillStyle(0x1a2810, 0.8); well.fillCircle(wellx, welly, 8);
            well.fillStyle(0x8a7050, 1); well.fillRect(wellx-26, welly-28, 7, 20); well.fillRect(wellx+19, welly-28, 7, 20); well.fillRect(wellx-26, welly-30, 52, 7);
            well.fillStyle(0x604020, 1); well.fillRect(wellx-4, welly-26, 8, 20);
            well.lineStyle(1, 0x604020, 1); well.moveTo(wellx-14, welly-22); well.lineTo(wellx, welly-10); well.lineTo(wellx+14, welly-22); well.strokePath();
            this.add.text(wellx, welly+26, "Village Well", { fontSize: "9px", color: "#ccaa88", fontFamily: "monospace" }).setOrigin(0.5, 0);

            // The Crooked Kettle Inn — south of road
            const inn = this.add.graphics();
            inn.fillStyle(0x000000, 0.2); inn.fillRoundedRect(746, 648, 200, 155, 6);
            inn.fillStyle(0x6a3a18, 1); inn.fillRoundedRect(740, 642, 200, 155, 6);
            inn.fillStyle(0xaa5528, 1); inn.fillRoundedRect(740, 642, 200, 28, { tl: 6, tr: 6, bl: 0, br: 0 });
            inn.lineStyle(2, 0x884418, 0.5);
            for (let ri = 0; ri < 5; ri++) { inn.moveTo(742+ri*36, 642); inn.lineTo(742+ri*36+36, 670); } inn.strokePath();
            inn.fillStyle(0xffd880, 0.8); inn.fillRoundedRect(756, 678, 42, 36, 3); inn.fillRoundedRect(856, 678, 42, 36, 3);
            inn.fillStyle(0x3a2010, 1); inn.fillRoundedRect(820, 750, 34, 47, { tl: 4, tr: 4, bl: 0, br: 0 });
            inn.fillStyle(0xffd060, 1); inn.fillCircle(832, 772, 3); inn.setDepth(2);
            this.add.text(840, 655, "🏠 The Crooked Kettle", { fontSize: "9px", color: "#fff", fontFamily: "monospace", fontStyle: "bold" }).setOrigin(0.5, 0.5).setDepth(2);

            // Ironfist Smithy — north of road
            const smithy = this.add.graphics();
            smithy.fillStyle(0x000000, 0.2); smithy.fillRoundedRect(1066, 258, 200, 155, 6);
            smithy.fillStyle(0x4a3a28, 1); smithy.fillRoundedRect(1060, 252, 200, 155, 6);
            smithy.fillStyle(0x3a2a18, 1); smithy.fillRoundedRect(1060, 252, 200, 26, { tl: 6, tr: 6, bl: 0, br: 0 });
            smithy.fillStyle(0x888888, 0.22); smithy.fillCircle(1128, 234, 16); smithy.fillStyle(0x666666, 0.15); smithy.fillCircle(1136, 218, 12);
            smithy.fillStyle(0xffd880, 0.8); smithy.fillRoundedRect(1076, 288, 42, 36, 3); smithy.fillRoundedRect(1176, 288, 42, 36, 3);
            smithy.fillStyle(0xff8800, 0.55); smithy.fillCircle(1128, 298, 10); smithy.fillStyle(0xff4400, 0.3); smithy.fillCircle(1128, 298, 6);
            smithy.fillStyle(0x3a2010, 1); smithy.fillRoundedRect(1138, 370, 34, 37, { tl: 4, tr: 4, bl: 0, br: 0 }); smithy.setDepth(2);
            this.add.text(1160, 264, "🔨 Ironfist Smithy", { fontSize: "9px", color: "#ffcc88", fontFamily: "monospace", fontStyle: "bold" }).setOrigin(0.5, 0.5).setDepth(2);

            // Elder Mira's Cottage — north of road, clear of road
            const cottage = this.add.graphics();
            cottage.fillStyle(0x000000, 0.2); cottage.fillRoundedRect(822, 282, 158, 135, 6);
            cottage.fillStyle(0x5a4a30, 1); cottage.fillRoundedRect(816, 276, 158, 135, 6);
            cottage.fillStyle(0x6a6a30, 1); cottage.fillRoundedRect(816, 276, 158, 24, { tl: 6, tr: 6, bl: 0, br: 0 });
            cottage.fillStyle(0xffd880, 0.75); cottage.fillRoundedRect(832, 308, 36, 30, 3); cottage.fillRoundedRect(922, 308, 36, 30, 3);
            cottage.fillStyle(0x3a2010, 1); cottage.fillRoundedRect(882, 376, 30, 35, { tl: 4, tr: 4, bl: 0, br: 0 }); cottage.setDepth(2);
            this.add.text(895, 287, "🌿 Elder's Cottage", { fontSize: "9px", color: "#dde890", fontFamily: "monospace", fontStyle: "bold" }).setOrigin(0.5, 0.5).setDepth(2);

            // Village trees
            [[720,180],[780,260],[730,820],[780,900],[1420,180],[1480,260],[1520,150],[1420,840],[1480,930]].forEach(([tx2,ty2]) => {
              const tg = this.add.graphics();
              tg.fillStyle(0x000000, 0.1); tg.fillEllipse(tx2, ty2+22, 42, 12);
              tg.fillStyle(0x7a4a18, 1); tg.fillRect(tx2-4, ty2+8, 8, 24);
              tg.fillStyle(0x1a6020, 1); tg.fillTriangle(tx2, ty2-34, tx2-24, ty2+10, tx2+24, ty2+10);
              tg.fillStyle(0x228030, 1); tg.fillCircle(tx2, ty2-14, 15);
              tg.fillStyle(0x44aa50, 0.28); tg.fillCircle(tx2-4, ty2-20, 8);
            });

            // Fences
            const fence = this.add.graphics();
            fence.fillStyle(0xc8a060, 1);
            [[710,190,220],[710,870,220],[950,190,200],[950,870,200]].forEach(([fx,fy,fw]) => {
              fence.fillRect(fx, fy, fw, 5);
              for (let fp = 0; fp < fw; fp += 20) fence.fillRect(fx+fp, fy-8, 5, 20);
            });
            fence.setDepth(2);

            // Village lampposts
            [760, 980, 1200, 1420].forEach(lpx => {
              [210, H-210].forEach(lpy => {
                const lp = this.add.graphics();
                lp.fillStyle(0x7a6a38, 1); lp.fillRect(lpx-3, lpy-50, 6, 56); lp.fillRect(lpx-3, lpy-50, 12, 4);
                lp.fillStyle(0xffee88, 1); lp.fillEllipse(lpx+5, lpy-52, 12, 16);
                lp.fillStyle(0xffee88, 0.14); lp.fillEllipse(lpx+5, lpy-52, 28, 28);
              });
            });
          }

          // ── Castle Aurvale (x=0–700, WEST of village) ────────────────────────
          {
            // Stone floor
            const cg = this.add.graphics();
            cg.fillStyle(0x6a6a72, 1); cg.fillRect(0, 0, 700, H);
            cg.lineStyle(1, 0x5a5a62, 0.38);
            for (let cy2 = 0; cy2 < H; cy2 += 28) { cg.moveTo(0, cy2); cg.lineTo(700, cy2); }
            for (let cx2 = 0; cx2 < 700; cx2 += 40) { cg.moveTo(cx2, 0); cg.lineTo(cx2, H); }
            cg.strokePath();
            cg.fillStyle(0x5a5a62, 0.25);
            for (let ci = 0; ci < 50; ci++) {
              const cx2 = (rng(ci*17+3) % 660) + 20;
              const cy2 = (rng(ci*17+7) % (H-40)) + 20;
              cg.fillRect(cx2, cy2, 20+rng(ci*17+11)%14, 14+rng(ci*17+13)%10);
            }

            // Divider wall — east side (between castle and village at x=700)
            const cwall = this.add.graphics();
            cwall.fillStyle(0x8a8a92, 1); cwall.fillRect(692, 0, 14, H);
            cwall.fillStyle(0xaaaaaa, 1); cwall.fillRect(692, 0, 7, H);
            cwall.fillStyle(0x0d1117, 0.9); cwall.fillRect(692, H/2-48, 14, 96);
            this.add.text(350, H/2-72, "🏰 Castle Aurvale", { fontSize: "12px", color: "#ffd060", fontFamily: "monospace", fontStyle: "bold" }).setOrigin(0.5, 1);

            // Outer walls top + bottom with battlements
            const outerWall = this.add.graphics();
            outerWall.fillStyle(0x7a7a82, 1); outerWall.fillRect(0, 0, 700, 62); outerWall.fillRect(0, H-62, 700, 62);
            outerWall.fillStyle(0x9a9aaa, 1); outerWall.fillRect(0, 0, 700, 20); outerWall.fillRect(0, H-20, 700, 20);
            for (let bx2 = 0; bx2 < 700; bx2 += 36) {
              outerWall.fillStyle(0x7a7a82, 1); outerWall.fillRect(bx2, 0, 22, 36); outerWall.fillRect(bx2, H-36, 22, 36);
            }

            // Hanging banners between columns (royal purple + gold trim)
            [560, 400, 240].forEach(banx => {
              const ban = this.add.graphics();
              ban.fillStyle(0x5a1080, 0.85); ban.fillRect(banx-12, 62, 24, 70); ban.fillRect(banx-12, H-132, 24, 70);
              ban.fillStyle(0xffd700, 0.7); ban.fillRect(banx-12, 62, 24, 5); ban.fillRect(banx-12, H-132, 24, 5);
              ban.fillStyle(0xffd700, 0.5); ban.fillRect(banx-12, 128, 24, 5); ban.fillRect(banx-12, H-66, 24, 5);
              ban.fillStyle(0xffd700, 0.4); ban.fillCircle(banx, 100, 7); ban.fillCircle(banx, H-100, 7);
              ban.setDepth(3);
              this.add.text(banx, 96, "⚜", { fontSize: "8px" }).setOrigin(0.5).setDepth(4);
              this.add.text(banx, H-104, "⚜", { fontSize: "8px" }).setOrigin(0.5).setDepth(4);
            });

            // Interior columns with gold caps
            [560, 420, 280, 140].forEach(colx => {
              [160, H-160].forEach(coly => {
                const col = this.add.graphics();
                col.fillStyle(0x9a9aaa, 1); col.fillRect(colx-13, coly-50, 26, 100);
                col.fillStyle(0xbbbbcc, 1); col.fillRect(colx-17, coly-54, 34, 11); col.fillRect(colx-17, coly+43, 34, 11);
                col.fillStyle(0xffd060, 0.22); col.fillEllipse(colx, coly-50, 44, 20);
                col.setDepth(4);
              });
            });

            // Wall torches (top + bottom walls)
            [580, 440, 300, 160].forEach(torchx => {
              const tg2 = this.add.graphics();
              tg2.fillStyle(0x604020, 1); tg2.fillRect(torchx-3, 60, 6, 14); tg2.fillStyle(0xff8800, 0.7); tg2.fillEllipse(torchx, 56, 9, 13);
              tg2.fillStyle(0xffcc00, 0.45); tg2.fillEllipse(torchx, 54, 5, 8);
              tg2.fillStyle(0xff8800, 0.15); tg2.fillEllipse(torchx, 56, 22, 22);
              tg2.fillStyle(0x604020, 1); tg2.fillRect(torchx-3, H-74, 6, 14); tg2.fillStyle(0xff8800, 0.7); tg2.fillEllipse(torchx, H-78, 9, 13);
              tg2.fillStyle(0xffcc00, 0.45); tg2.fillEllipse(torchx, H-80, 5, 8);
              tg2.fillStyle(0xff8800, 0.15); tg2.fillEllipse(torchx, H-78, 22, 22);
              tg2.setDepth(4);
            });

            // Weapon racks on north wall
            const weapons = this.add.graphics();
            weapons.fillStyle(0x7a6040, 1); weapons.fillRect(420, 70, 120, 8); // rack bar
            weapons.fillStyle(0xaaaaaa, 1);
            [430, 450, 470, 490, 510, 530].forEach(wx => {
              weapons.fillRect(wx-2, 70, 4, 30); // sword blades
              weapons.fillStyle(0x884422, 1); weapons.fillRect(wx-4, 100, 8, 8); // hilts
              weapons.fillStyle(0xaaaaaa, 1);
            });
            weapons.fillStyle(0xcc9922, 1); weapons.fillRect(420, 68, 120, 4); // rack highlight
            weapons.setDepth(3);
            this.add.text(480, 66, "⚔️ Armory", { fontSize: "8px", color: "#cccccc", fontFamily: "monospace" }).setOrigin(0.5, 1).setDepth(4);

            // Shield display on south wall
            const shields = this.add.graphics();
            [440, 480, 520].forEach(sx => {
              shields.fillStyle(0x334488, 1); shields.fillEllipse(sx, H-88, 22, 28);
              shields.fillStyle(0x5566cc, 0.5); shields.fillEllipse(sx, H-92, 10, 14);
              shields.fillStyle(0xffd700, 0.7); shields.fillRect(sx-1, H-100, 2, 24);
            });
            shields.setDepth(3);

            // Red carpet from entrance to throne
            const carpet = this.add.graphics();
            carpet.fillStyle(0x8a1010, 0.6); carpet.fillRect(0, H/2-38, 695, 76);
            carpet.fillStyle(0xaa2020, 0.4); carpet.fillRect(0, H/2-26, 695, 52);
            carpet.fillStyle(0xcc3030, 0.25); carpet.fillRect(0, H/2-12, 695, 24);
            // Gold border trim on carpet
            carpet.fillStyle(0xffd700, 0.3); carpet.fillRect(0, H/2-38, 695, 4); carpet.fillRect(0, H/2+34, 695, 4);
            carpet.setDepth(1);

            // Throne (at far west end, x=80)
            const throne = this.add.graphics();
            const thrx = 80, thry = H/2;
            throne.fillStyle(0x8a6010, 1); throne.fillRoundedRect(thrx-42, thry-82, 84, 82, 4);
            throne.fillStyle(0xaa8020, 1); throne.fillRoundedRect(thrx-32, thry-102, 64, 30, 4);
            throne.fillStyle(0xcc9a30, 1); throne.fillRoundedRect(thrx-22, thry-112, 44, 22, 4);
            throne.fillStyle(0xdd1010, 0.8); throne.fillRoundedRect(thrx-30, thry-80, 60, 72, 3);
            // Gold armrests
            throne.fillStyle(0xffd700, 0.6); throne.fillRect(thrx-42, thry-42, 84, 8);
            throne.setDepth(3);
            this.add.text(thrx, thry-118, "👑", { fontSize: "22px" }).setOrigin(0.5).setDepth(4);

            // Wizard's Library Tower (upper area, near x=300)
            const wizTower = this.add.graphics();
            wizTower.fillStyle(0x3a2060, 1); wizTower.fillRect(240, 62, 120, 100);
            wizTower.fillStyle(0x5a30a0, 1); wizTower.fillRect(240, 62, 120, 18);
            wizTower.fillStyle(0xaa88ff, 0.25); wizTower.fillCircle(300, 112, 28);
            wizTower.fillStyle(0xffd880, 0.65); wizTower.fillRoundedRect(260, 88, 28, 26, 3); wizTower.fillRoundedRect(312, 88, 28, 26, 3);
            // Glowing orb
            wizTower.fillStyle(0x8844ff, 0.5); wizTower.fillCircle(300, 115, 10);
            wizTower.fillStyle(0xbbaaff, 0.6); wizTower.fillCircle(300, 115, 5);
            wizTower.setDepth(3);
            this.add.text(300, 71, "🪄 Library Tower", { fontSize: "8px", color: "#bb88ff", fontFamily: "monospace", fontStyle: "bold" }).setOrigin(0.5, 0.5).setDepth(4);

            // Decorative guards (static, visual only — 3 pairs flanking key positions)
            [
              { x: 648, y: H/2-110 }, { x: 648, y: H/2+110 }, // entrance flanks
              { x: 420, y: H/2-110 }, { x: 420, y: H/2+110 }, // mid-castle flanks
              { x: 180, y: H/2-90 },  { x: 180, y: H/2+90 },  // throne room flanks
            ].forEach(gd => {
              const gg = this.add.graphics();
              // Armor glow
              gg.fillStyle(0x4466aa, 0.2); gg.fillCircle(gd.x, gd.y-4, 20);
              // Body + head
              gg.fillStyle(0x3355aa, 1); gg.fillRect(gd.x-7, gd.y-8, 14, 18);
              gg.fillStyle(0xc8a070, 1); gg.fillCircle(gd.x, gd.y-16, 9);
              // Helmet
              gg.fillStyle(0x3355aa, 1); gg.fillRect(gd.x-9, gd.y-24, 18, 8);
              gg.fillStyle(0x5577cc, 1); gg.fillRect(gd.x-7, gd.y-22, 14, 5);
              // Plume
              gg.fillStyle(0xdd2222, 0.8); gg.fillRect(gd.x-1, gd.y-32, 3, 10);
              // Spear
              gg.fillStyle(0x888888, 1); gg.fillRect(gd.x+8, gd.y-40, 3, 50);
              gg.fillStyle(0xdddddd, 1); gg.fillTriangle(gd.x+8, gd.y-40, gd.x+12, gd.y-40, gd.x+9, gd.y-52);
              gg.setDepth(5);
            });
          }

          // ── Village & Castle NPCs ─────────────────────────────────────────────
          {
            const NPC_LIST_DEF = [
              { id: "innkeeper_bessie",     emoji: "🍺", name: "Bessie Rosethorn", x: 840, y: 735, color: 0x7a3060, glow: 0xee7aaa },
              { id: "blacksmith_theron",    emoji: "🔨", name: "Theron Ironfist",  x: 1160, y: 340, color: 0x6a5030, glow: 0xcc9060 },
              { id: "elder_mira",           emoji: "👵", name: "Elder Mira",       x: 895, y: 355, color: 0x6a8a30, glow: 0xaad060 },
              { id: "village_kid_pip",      emoji: "👦", name: "Pip",              x: 1100, y: 700, color: 0x3a6a90, glow: 0x88ccee },
              { id: "guard_captain_aldric", emoji: "⚔️", name: "Captain Aldric",  x: 620, y: 560, color: 0x334488, glow: 0x8899ff },
              { id: "court_wizard_lysara",  emoji: "🪄", name: "Lysara Veyne",    x: 310, y: 115, color: 0x4a2080, glow: 0xaa66ff },
              { id: "queen_aelindra",       emoji: "👑", name: "Queen Aelindra",  x: 80,  y: 560, color: 0x804020, glow: 0xffd700 },
              { id: "town_herald",          emoji: "📯", name: "Reginald Herald",  x: 2070, y: 560, color: 0x5a4010, glow: 0xffc030 },
            ];

            // froggified NPC tracking: id → { emojiText, originalEmoji, expiry, overlay }
            const froggifiedNpcs = new Map<string, { emojiText: Phaser.GameObjects.Text; originalEmoji: string; expiry: number; overlay: Phaser.GameObjects.Container }>();

            NPC_LIST_DEF.forEach(npc => {
              const ng = this.add.graphics();
              ng.fillStyle(npc.glow, 0.22); ng.fillCircle(npc.x, npc.y-4, 28);
              ng.fillStyle(npc.color, 1); ng.fillCircle(npc.x, npc.y-18, 11);
              ng.fillRect(npc.x-8, npc.y-7, 16, 18);
              ng.setDepth(5);
              const npcEmojiText = this.add.text(npc.x, npc.y-24, npc.emoji, { fontSize: "18px" }).setOrigin(0.5).setDepth(6);
              this.add.text(npc.x, npc.y+14, npc.name, {
                fontSize: "8px", color: "#ddddff", fontFamily: "monospace",
                backgroundColor: "rgba(0,0,0,0.55)", padding: { x: 3, y: 1 },
              }).setOrigin(0.5, 0).setDepth(6);

              const npcHint = this.add.text(npc.x, npc.y-48, "", {
                fontSize: "10px", color: "#ffd060", fontFamily: "monospace",
                backgroundColor: "rgba(0,0,0,0.78)", padding: { x: 5, y: 2 },
              }).setOrigin(0.5, 1).setAlpha(0).setDepth(20);

              const zone = this.add.zone(npc.x, npc.y-10, 40, 50).setInteractive({ cursor: "pointer" });
              zone.on("pointerdown", () => {
                const mode = abilityTargetModeRef.current;
                if (mode?.ability === "frog_hex") {
                  abilityTargetModeRef.current = null;
                  setAbilityTargetMode(null);
                  const existing = froggifiedNpcs.get(npc.id);
                  if (existing && existing.expiry > Date.now()) return; // already frogged
                  const expiry = Date.now() + 12000;

                  // ── Smoke transformation effect ───────────────────────────
                  playRibbit();
                  for (let si = 0; si < 8; si++) {
                    const sx = npc.x + (Math.random() - 0.5) * 50;
                    const sy = (npc.y - 10) + (Math.random() - 0.5) * 30;
                    const smk = this.add.text(sx, sy, si % 2 === 0 ? "💨" : "🌫️", { fontSize: "18px" })
                      .setOrigin(0.5).setDepth(55).setAlpha(0.85);
                    this.tweens.add({
                      targets: smk,
                      x: sx + (Math.random() - 0.5) * 60,
                      y: sy - 35 - Math.random() * 20,
                      alpha: 0, duration: 550 + Math.random() * 250,
                      onComplete: () => smk.destroy(),
                    });
                  }

                  // ── Big frog overlay covering the NPC ─────────────────────
                  const frogOverlay = this.add.container(npc.x, npc.y - 10).setDepth(10).setAlpha(0);
                  const bgRect = this.add.graphics();
                  bgRect.fillStyle(0x1a7a28, 0.95);
                  bgRect.fillRoundedRect(-26, -32, 52, 58, 10);
                  bgRect.lineStyle(2, 0x00ff44, 0.7);
                  bgRect.strokeRoundedRect(-26, -32, 52, 58, 10);
                  const bigFrogText = this.add.text(0, -8, "🐸", { fontSize: "42px" }).setOrigin(0.5);
                  frogOverlay.add([bgRect, bigFrogText]);
                  this.tweens.add({ targets: frogOverlay, alpha: 1, duration: 200 });
                  // Gentle bob animation
                  this.tweens.add({ targets: bigFrogText, y: -12, duration: 700, ease: "Sine.easeInOut", yoyo: true, repeat: -1 });

                  npcEmojiText.setAlpha(0); // hide original emoji underneath
                  npcHint.setText("🐸 ribbit…");

                  froggifiedNpcs.set(npc.id, { emojiText: npcEmojiText, originalEmoji: npc.emoji, expiry, overlay: frogOverlay });
                  setTimeout(() => {
                    // Smoke puff on de-frog
                    for (let si = 0; si < 5; si++) {
                      const sx2 = npc.x + (Math.random() - 0.5) * 40;
                      const sy2 = (npc.y - 10) + (Math.random() - 0.5) * 25;
                      const smk2 = this.add.text(sx2, sy2, "💨", { fontSize: "16px" }).setOrigin(0.5).setDepth(55);
                      this.tweens.add({ targets: smk2, y: sy2 - 30, alpha: 0, duration: 400, onComplete: () => smk2.destroy() });
                    }
                    frogOverlay.destroy();
                    npcEmojiText.setAlpha(1);
                    npcHint.setText("");
                    froggifiedNpcs.delete(npc.id);
                  }, 12000);
                  return;
                } else if (mode) {
                  // Not a valid NPC target for this ability — cancel targeting
                  abilityTargetModeRef.current = null;
                  setAbilityTargetMode(null);
                  return;
                }
                // Check if frogged before letting player talk
                const frogged = froggifiedNpcs.get(npc.id);
                if (frogged && frogged.expiry > Date.now()) return;
                talkToNpc(npc.id);
              });

              const rec = this as unknown as Record<string, unknown>;
              if (!Array.isArray(rec._villageNpcs)) rec._villageNpcs = [];
              (rec._villageNpcs as { id: string; x: number; y: number; hint: Phaser.GameObjects.Text }[]).push({ id: npc.id, x: npc.x, y: npc.y, hint: npcHint });
            });

            // Single E-key listener for NPC dialogue (reads nearNpcRef)
            this.input.keyboard!.on("keydown-E", () => {
              if (!chatOpenRef.current && nearNpcRef.current && !captainHintRef.current && !caveHintRef.current && !npcDialogueRef.current)
                talkToNpc(nearNpcRef.current);
            });
          }

          // ── Graveyard (east edge, respawn point) ─────────────────────────
          {
            const GX = GRAVEYARD_X, GY = GRAVEYARD_Y;
            const gyard = this.add.graphics();
            // Dead grass
            gyard.fillStyle(0x2a2a1a, 0.7); gyard.fillEllipse(GX, GY, 320, 140);
            // Iron fence
            gyard.fillStyle(0x4a4a4a, 1);
            for (let fx = GX - 140; fx <= GX + 140; fx += 22) {
              gyard.fillRect(fx - 2, GY - 60, 4, 52);
              gyard.fillTriangle(fx - 5, GY - 64, fx + 5, GY - 64, fx, GY - 76);
              gyard.fillRect(fx - 2, GY + 28, 4, 32);
            }
            gyard.fillRect(GX - 144, GY - 62, 292, 5); // top bar
            gyard.fillRect(GX - 144, GY + 28, 292, 5); // bottom bar
            // Grave stones
            const graves = [[-60, 0], [0, -10], [60, 5], [-100, 10], [100, -5]];
            graves.forEach(([gox, goy]) => {
              gyard.fillStyle(0x7a7a7a, 1);
              gyard.fillRoundedRect(GX + gox - 12, GY + goy - 28, 24, 32, { tl: 4, tr: 4, bl: 0, br: 0 });
              gyard.fillStyle(0x9a9a9a, 0.5);
              gyard.fillRoundedRect(GX + gox - 12, GY + goy - 28, 24, 8, { tl: 4, tr: 4, bl: 0, br: 0 });
            });
            // Dead tree
            gyard.fillStyle(0x3a2a10, 1);
            gyard.fillRect(GX + 130, GY - 50, 8, 70);
            gyard.fillRect(GX + 110, GY - 30, 30, 5);
            gyard.fillRect(GX + 120, GY - 45, 20, 5);
            // Fog/glow
            gyard.fillStyle(0x8888aa, 0.12); gyard.fillEllipse(GX, GY, 280, 120);
            // Entry arch
            gyard.fillStyle(0x5a5a5a, 1);
            gyard.fillRect(GX - 30, GY - 62, 8, 50);
            gyard.fillRect(GX + 22, GY - 62, 8, 50);
            gyard.fillRoundedRect(GX - 34, GY - 80, 68, 22, { tl: 10, tr: 10, bl: 0, br: 0 });
            this.add.text(GX, GY + 60, "⚰️ Graveyard", { fontSize: "10px", color: "#aaaacc", fontFamily: "monospace", backgroundColor: "rgba(0,0,0,0.55)", padding: { x: 3, y: 1 } }).setOrigin(0.5);
            this.add.text(GX, GY + 74, "Respawn point", { fontSize: "8px", color: "#666688", fontFamily: "monospace" }).setOrigin(0.5);
            // Grass background for east area
            const eastBg = this.add.graphics();
            eastBg.fillStyle(0x2a3a1a, 0.4); eastBg.fillRect(3400, 600, 900, 440);
          }

          // ── Dragon Entity (spawned during dragon_attack events) ────────────
          {
            // Build dragon container at first waypoint (hidden until event)
            const dragonContainer = this.add.container(DRAGON_PATH[0].x, DRAGON_PATH[0].y).setDepth(55).setAlpha(0);

            // Glow circle under dragon
            const dragonGlow = this.add.graphics();
            dragonGlow.fillStyle(0xff3300, 0.3); dragonGlow.fillCircle(0, 0, 60);

            // Dragon emoji (large)
            const dragonText = this.add.text(0, 0, "🐉", {
              fontSize: "72px", fontFamily: "monospace",
            }).setOrigin(0.5, 0.5);

            // HP bar background
            const hpBg = this.add.graphics();
            hpBg.fillStyle(0x330000, 0.9); hpBg.fillRoundedRect(-60, -68, 120, 14, 4);
            hpBg.fillStyle(0x550000, 1); hpBg.fillRoundedRect(-60, -68, 120, 14, 4);

            // HP bar fill (updated in update loop)
            const hpFill = this.add.graphics();

            // Dragon name label
            const dragonLabel = this.add.text(0, -86, "🔥 DRAGON 🔥", {
              fontSize: "11px", color: "#ff6622", fontFamily: "monospace", fontStyle: "bold",
              backgroundColor: "rgba(0,0,0,0.7)", padding: { x: 4, y: 2 },
            }).setOrigin(0.5, 0.5);

            dragonContainer.add([dragonGlow, dragonText, hpBg, hpFill, dragonLabel]);
            dragonContainerRef.current = dragonContainer;
            dragonHpFillRef.current = hpFill;
            dragonLabelRef.current = dragonLabel;

            // Fire particles layer (separate from container for world-space effect)
            const fireLayer = this.add.graphics().setDepth(54);
            (this as unknown as Record<string, unknown>)._fireLayer = fireLayer;
            (this as unknown as Record<string, unknown>)._dragonContainer = dragonContainer;
            (this as unknown as Record<string, unknown>)._dragonHpFill = hpFill;

            // Spawn function — also kicks off NPC auto-charge loop
            spawnDragonRef.current = () => {
              const dc = dragonContainerRef.current;
              if (!dc) return;
              dc.setAlpha(0);
              dc.setPosition(DRAGON_PATH[0].x, DRAGON_PATH[0].y);
              this.tweens.add({ targets: dc, alpha: 1, duration: 1200, ease: "Cubic.Out" });

              // ── NPC auto-charge: 6 random NPCs attack every ~9s ─────────
              if (npcAutoChargeRef.current) clearInterval(npcAutoChargeRef.current);
              const fireNpcWave = () => {
                const keys = Array.from(npcFlashRef.current.keys());
                if (keys.length === 0) return;
                const shuffled = [...keys].sort(() => Math.random() - 0.5).slice(0, 6);
                shuffled.forEach((key, i) => {
                  const flashFn = npcFlashRef.current.get(key);
                  if (flashFn) setTimeout(() => flashFn(key, Math.floor(Math.random() * 22) + 8), i * 380);
                });
              };
              // First wave after 3s, then every 9–13s
              setTimeout(fireNpcWave, 3000);
              npcAutoChargeRef.current = setInterval(fireNpcWave, 9000 + Math.random() * 4000);
            };

            // Despawn function — stops NPC auto-charge
            despawnDragonRef.current = () => {
              const dc = dragonContainerRef.current;
              if (!dc) return;
              if (npcAutoChargeRef.current) { clearInterval(npcAutoChargeRef.current); npcAutoChargeRef.current = null; }
              this.tweens.add({ targets: dc, alpha: 0, scaleX: 2, scaleY: 2, duration: 1500, ease: "Cubic.Out",
                onComplete: () => { dc.setAlpha(0); dc.setScale(1); }
              });
            };

            // Teleport-to-graveyard function for player respawn
            respawnToGraveyardRef.current = () => {
              teleportPlayerRef.current?.(GRAVEYARD_X, GRAVEYARD_Y);
            };
          }

          // ── NPC Hero Charge System ─────────────────────────────────────────
          // When an NPC attacks, they dramatically charge toward the dragon,
          // scream a hilarious battle cry, deal damage, then return home.
          {
            type NpcHeroData = { x: number; y: number; emoji: string; color: string; cries: string[] };
            const NPC_HEROES: Record<string, NpcHeroData> = {
              "⚔️Capt. Aldric":     { x: 620,  y: 560, emoji: "⚔️", color: "#8899ff",
                cries: ["FOR THE REALM! 🗡️", "NONE SHALL PASS!", "THIS IS MY SWORD ARM DAY.", "I'VE BEEN WAITING FOR THIS."] },
              "🛡️Town Guard":      { x: 680,  y: 520, emoji: "🛡️", color: "#aabbdd",
                cries: ["I don't get paid enough.", "ON A MONDAY?!", "Shield... up... I think.", "AT LEAST IT'S NOT PAPERWORK."] },
              "🍺Bessie Rosethorn": { x: 840,  y: 735, emoji: "🍺", color: "#ee7aaa",
                cries: ["YE'RE SCARING ME CUSTOMERS!", "LAST ORDERS, LIZARD!", "THIS MUG IS SOLID OAK!", "30 YEARS OF ALE-POWERED FURY!"] },
              "🍦Marcus":           { x: 2000, y: 460, emoji: "🍦", color: "#ffccee",
                cries: ["NOBODY MESSES WITH SOFT SERVE!", "FREE SAMPLE: FACE EDITION!", "COLD AS MY DAILY SPECIAL!", "MINT CHIP OBLITERATION!"] },
              "🐴Old Pete":         { x: 2200, y: 560, emoji: "🐴", color: "#cc9060",
                cries: ["NEIGHHHHH!!! 🐴", "THE HORSE HAS HAD ENOUGH.", "OLD PETE TRAMPLES ALL EVIL.", "Pete didn't sign up for this."] },
              "👵Elder Mira":       { x: 895,  y: 355, emoji: "👵", color: "#aad060",
                cries: ["I'VE SEEN WORSE. ON TUESDAYS.", "STICK TO THE SNOUT!", "I AM 847 YEARS OLD AND FURIOUS.", "How disappointing."] },
              "🔨Theron Ironfist":  { x: 1160, y: 340, emoji: "🔨", color: "#ddaa60",
                cries: ["MY ANVIL IS HARDER THAN YOUR SCALES!", "HAMMER TIME. CLASSIC.", "I FORGE FOR THIS EXACT MOMENT.", "EVERY. SINGLE. DAY. I PREP."] },
              "👦Pip":              { x: 1100, y: 700, emoji: "👦", color: "#88ccee",
                cries: ["EAT ROCKS, LIZARD BREATH!", "MOM'S GONNA GROUND ME.", "I THREW MY SHOE AND I'M PROUD.", "DAD SAID NO. DAD IS WRONG."] },
              "🪄Lysara Veyne":     { x: 310,  y: 115, emoji: "🪄", color: "#cc88ff",
                cries: ["BY THE ARCANE MYSTERIES... BURN!", "40 YEARS OF STUDY FOR THIS!", "FIREBALL DELUXE EDITION™!", "YOU DARE DISTURB MY RESEARCH?!"] },
              "📯Reginald Herald":  { x: 2070, y: 560, emoji: "📯", color: "#ffc030",
                cries: ["HEAR YE: THOU ART BEING SMITED!", "I HEREBY ANNOUNCE YOUR DOOM!", "THIS HORN GOES TO 11!", "I MUST ANNOUNCE IT FIRST. LEGALLY."] },
            };

            const scene = this;

            // Victory celebration: NPCs run to battle site then wander back with cheer emojis
            victoryCelebrationRef.current = () => {
              const evType = activeEventRef.current?.type ?? "dragon_attack";
              const victoryLines = evType === "bandit_raid"
                ? ["BANDITS ROUTED! ⚔️", "FLOCK IS SAFE!", "JUSTICE!", "DRINKS ON BESSIE!", "MY SHOE HELPED."]
                : ["WE WON! 🎉", "THE DRAGON FLEES!", "GLORY TO FLOCK!", "DRINKS ON BESSIE!", "MY SHOE HELPED."];
              Object.values(NPC_HEROES).forEach((hero, i) => {
                const delay = i * 120;
                let dragonX: number, dragonY: number;
                if (evType === "bandit_raid") {
                  const alive = banditContainersRef.current.filter(bc => bc && bc.alpha > 0.1);
                  const t = alive[Math.floor(Math.random() * Math.max(1, alive.length))];
                  dragonX = t?.x ?? 1300; dragonY = (t?.y ?? 480) - 16;
                } else {
                  dragonX = dragonContainerRef.current?.x ?? 1600;
                  dragonY = (dragonContainerRef.current?.y ?? 380) - 20;
                }
                // Dash to battle site
                const cel = scene.add.text(hero.x, hero.y - 12, hero.emoji, { fontSize: "22px", fontFamily: "monospace" })
                  .setOrigin(0.5).setDepth(115);
                scene.tweens.add({
                  targets: cel, x: dragonX + (Math.random()-0.5)*120, y: dragonY + (Math.random()-0.5)*80,
                  duration: 500, delay, ease: "Cubic.Out",
                  onComplete: () => {
                    // Cheer bubble
                    const cheer = scene.add.text(cel.x, cel.y - 28,
                      victoryLines[Math.floor(Math.random() * victoryLines.length)], {
                        fontSize: "9px", color: "#ffd700", fontFamily: "monospace", fontStyle: "bold",
                        backgroundColor: "rgba(0,0,0,0.85)", padding: { x: 4, y: 2 },
                      }).setOrigin(0.5, 1).setDepth(122);
                    scene.tweens.add({ targets: cheer, y: cheer.y - 20, alpha: 0, delay: 1200, duration: 600, onComplete: () => cheer.destroy() });
                    // Walk back home
                    scene.tweens.add({
                      targets: cel, x: hero.x, y: hero.y - 12,
                      duration: 700, delay: 400, ease: "Cubic.InOut",
                      onComplete: () => cel.destroy(),
                    });
                  },
                });
              });
            };

            for (const [key, hero] of Object.entries(NPC_HEROES)) {
              npcFlashRef.current.set(key, (_emoji: string, dmg: number) => {
                // Target: dragon or a random visible bandit depending on active event
                let dragonX: number, dragonY: number;
                if (activeEventRef.current?.type === "bandit_raid") {
                  const alive = banditContainersRef.current.filter(bc => bc && bc.alpha > 0.1);
                  const t = alive[Math.floor(Math.random() * Math.max(1, alive.length))];
                  dragonX = t?.x ?? 1300; dragonY = (t?.y ?? 480) - 16;
                } else {
                  dragonX = dragonContainerRef.current?.x ?? 1600;
                  dragonY = (dragonContainerRef.current?.y ?? 380) - 20;
                }

                // Battle cry bubble near home
                const cry = hero.cries[Math.floor(Math.random() * hero.cries.length)];
                const bubble = scene.add.text(hero.x, hero.y - 48, cry, {
                  fontSize: "9px", color: hero.color, fontFamily: "monospace", fontStyle: "bold",
                  backgroundColor: "rgba(0,0,0,0.88)", padding: { x: 5, y: 3 },
                  wordWrap: { width: 170, useAdvancedWrap: true },
                }).setOrigin(0.5, 1).setDepth(120).setAlpha(0);
                scene.tweens.add({ targets: bubble, alpha: 1, duration: 100, onComplete: () => {
                  scene.tweens.add({ targets: bubble, y: bubble.y - 18, alpha: 0, delay: 1800, duration: 500, onComplete: () => bubble.destroy() });
                }});

                // Hero sprite charges toward dragon
                const randOx = (Math.random() - 0.5) * 80;
                const randOy = (Math.random() - 0.5) * 50;
                const sprite = scene.add.text(hero.x, hero.y - 12, hero.emoji, {
                  fontSize: "20px", fontFamily: "monospace",
                }).setOrigin(0.5).setDepth(115);

                scene.tweens.add({
                  targets: sprite,
                  x: dragonX + randOx, y: dragonY + randOy,
                  scaleX: 1.5, scaleY: 1.5,
                  duration: 380, ease: "Cubic.In",
                  onComplete: () => {
                    // Impact burst at dragon
                    const burst = scene.add.text(dragonX + randOx, dragonY + randOy - 8, `💥 ${dmg}`, {
                      fontSize: "15px", color: "#ffdd00", fontFamily: "monospace", fontStyle: "bold",
                      backgroundColor: "rgba(0,0,0,0.75)", padding: { x: 4, y: 2 },
                    }).setOrigin(0.5, 1).setDepth(121);
                    scene.tweens.add({ targets: burst, y: burst.y - 55, alpha: 0, duration: 1100,
                      ease: "Cubic.Out", onComplete: () => burst.destroy() });

                    // Flash the dragon red
                    const flash = scene.add.graphics().setDepth(116);
                    flash.fillStyle(0xff4400, 0.55); flash.fillCircle(dragonX, dragonY, 48);
                    scene.tweens.add({ targets: flash, alpha: 0, duration: 300, onComplete: () => flash.destroy() });

                    // Hero returns home
                    scene.tweens.add({
                      targets: sprite,
                      x: hero.x, y: hero.y - 12,
                      scaleX: 1, scaleY: 1,
                      duration: 300, ease: "Cubic.Out",
                      onComplete: () => sprite.destroy(),
                    });
                  },
                });
              });
            }
          }

          // ── Bandit Raid Entities ────────────────────────────────────────────
          {
            const BANDIT_DEFS = [
              { emoji: "🗡️", name: "CUTPURSE",   color: "#ff8844", size: "38px" },
              { emoji: "🥷",  name: "SHADOWBLADE", color: "#aa66ff", size: "38px" },
              { emoji: "🪓",  name: "IRONCLUB",   color: "#ffcc44", size: "38px" },
            ];
            const banditScene = this;
            const bContainers: import("phaser").GameObjects.Container[] = [];
            const bHpFills: import("phaser").GameObjects.Graphics[] = [];

            for (let i = 0; i < 3; i++) {
              const def = BANDIT_DEFS[i];
              const sp = BANDIT_PATROLS[i][0];
              const bc = banditScene.add.container(sp.x, sp.y).setDepth(55).setAlpha(0);
              const glow = banditScene.add.graphics();
              glow.fillStyle(0x440022, 0.35); glow.fillCircle(0, 0, 34);
              const body = banditScene.add.text(0, 0, def.emoji, { fontSize: def.size, fontFamily: "monospace" }).setOrigin(0.5, 0.5);
              const hpBg = banditScene.add.graphics();
              hpBg.fillStyle(0x330000, 0.9); hpBg.fillRoundedRect(-40, -50, 80, 9, 3);
              const hpFill = banditScene.add.graphics();
              const nameLabel = banditScene.add.text(0, -62, def.name, {
                fontSize: "8px", color: def.color, fontFamily: "monospace", fontStyle: "bold",
                backgroundColor: "rgba(0,0,0,0.7)", padding: { x: 3, y: 2 },
              }).setOrigin(0.5, 0.5);
              bc.add([glow, body, hpBg, hpFill, nameLabel]);
              bContainers.push(bc);
              bHpFills.push(hpFill);
              banditContainersRef.current[i] = bc;
              banditHpFillsRef.current[i] = hpFill;
              banditLabelsRef.current[i] = nameLabel;
            }

            spawnBanditsRef.current = () => {
              for (let i = 0; i < bContainers.length; i++) {
                const bc = bContainers[i];
                bc.setAlpha(0).setPosition(BANDIT_PATROLS[i][0].x, BANDIT_PATROLS[i][0].y);
                banditScene.tweens.add({ targets: bc, alpha: 1, duration: 800, delay: i * 250, ease: "Cubic.Out" });
              }
              if (npcAutoChargeRef.current) clearInterval(npcAutoChargeRef.current);
              const fireBanditWave = () => {
                const keys = Array.from(npcFlashRef.current.keys());
                if (keys.length === 0) return;
                [...keys].sort(() => Math.random() - 0.5).slice(0, 5).forEach((key, idx) => {
                  const fn = npcFlashRef.current.get(key);
                  if (fn) setTimeout(() => fn(key, Math.floor(Math.random() * 18) + 6), idx * 340);
                });
              };
              setTimeout(fireBanditWave, 2200);
              npcAutoChargeRef.current = setInterval(fireBanditWave, 8000 + Math.random() * 3000);
            };

            despawnBanditsRef.current = () => {
              if (npcAutoChargeRef.current) { clearInterval(npcAutoChargeRef.current); npcAutoChargeRef.current = null; }
              for (const bc of bContainers) {
                banditScene.tweens.add({ targets: bc, alpha: 0, duration: 700, ease: "Cubic.Out", onComplete: () => bc.setAlpha(0) });
              }
            };
          }

          // ── Merchant Visit Entity ───────────────────────────────────────────
          {
            const mScene = this;
            const mc = mScene.add.container(MERCHANT_WANDER_PATH[0].x, MERCHANT_WANDER_PATH[0].y).setDepth(55).setAlpha(0);
            const mGlow = mScene.add.graphics();
            mGlow.fillStyle(0x664400, 0.3); mGlow.fillCircle(0, 0, 36);
            const mBody = mScene.add.text(0, 0, "🛒", { fontSize: "40px", fontFamily: "monospace" }).setOrigin(0.5, 0.5);
            const mLabel = mScene.add.text(0, -52, "✨ WANDERING MERCHANT ✨", {
              fontSize: "8px", color: "#ffd700", fontFamily: "monospace", fontStyle: "bold",
              backgroundColor: "rgba(0,0,0,0.7)", padding: { x: 3, y: 2 },
            }).setOrigin(0.5, 0.5);
            mc.add([mGlow, mBody, mLabel]);
            merchantContainerRef.current = mc;

            const MERCHANT_LINES = [
              "RARE WARES! CHEAP TODAY!", "FINEST GOODS IN THE REALM!", "LIMITED STOCK! HURRY!",
              "DISCOUNTS! FOR BRAVE HEROES!", "COME ONE, COME ALL!", "YOU LOOK LIKE A BUYER!",
              "ENCHANTED ITEMS! CHEAP!", "STEP RIGHT UP! 🛒",
            ];
            let mDialogTimer: ReturnType<typeof setInterval> | null = null;

            spawnMerchantRef.current = () => {
              mc.setAlpha(0).setPosition(MERCHANT_WANDER_PATH[0].x, MERCHANT_WANDER_PATH[0].y);
              mScene.tweens.add({ targets: mc, alpha: 1, duration: 900, ease: "Cubic.Out" });
              if (mDialogTimer) clearInterval(mDialogTimer);
              mDialogTimer = setInterval(() => {
                if (mc.alpha < 0.5) return;
                const line = MERCHANT_LINES[Math.floor(Math.random() * MERCHANT_LINES.length)];
                const bubble = mScene.add.text(mc.x, mc.y - 60, line, {
                  fontSize: "9px", color: "#ffd700", fontFamily: "monospace", fontStyle: "bold",
                  backgroundColor: "rgba(0,0,0,0.85)", padding: { x: 5, y: 3 },
                }).setOrigin(0.5, 1).setDepth(122).setAlpha(0);
                mScene.tweens.add({ targets: bubble, alpha: 1, duration: 200, onComplete: () => {
                  mScene.tweens.add({ targets: bubble, y: bubble.y - 22, alpha: 0, delay: 2200, duration: 500, onComplete: () => bubble.destroy() });
                }});
              }, 3500 + Math.random() * 2000);
            };

            despawnMerchantRef.current = () => {
              if (mDialogTimer) { clearInterval(mDialogTimer); mDialogTimer = null; }
              mScene.tweens.add({ targets: mc, alpha: 0, duration: 700, ease: "Cubic.Out", onComplete: () => mc.setAlpha(0) });
            };
          }

          // ── Festival Performer Entities ─────────────────────────────────────
          {
            const fScene = this;
            const FEST_DEFS = [
              { x: 2150, y: 478, emoji: "🎭", name: "PERFORMER",  color: "#ff88ff",
                lines: ["TWIRL AND LEAP!", "DANCING FOR THE REALM! 🎶", "FEEL THE RHYTHM!"] },
              { x: 2500, y: 508, emoji: "🥁", name: "DRUMMER",    color: "#ffcc44",
                lines: ["BOOM BOOM BOOM! 🥁", "THE BEAT GOES ON!", "DRUMROLL FOR THE HEROES!"] },
              { x: 2360, y: 558, emoji: "🎶", name: "BARD",       color: "#ff6688",
                lines: ["♪ LA LA LAAA! ♪", "A SONG FOR THE BRAVE!", "SERENADE OF VICTORY!"] },
              { x: 2445, y: 448, emoji: "🎪", name: "JUGGLER",    color: "#44ccff",
                lines: ["ONE... TWO... THREE!", "LOOK NO HANDS!", "THE CROWD GOES WILD!"] },
            ];
            const fContainers: import("phaser").GameObjects.Container[] = [];
            let festDialogTimer: ReturnType<typeof setInterval> | null = null;

            for (const def of FEST_DEFS) {
              const fc = fScene.add.container(def.x, def.y).setDepth(54).setAlpha(0);
              const fGlow = fScene.add.graphics();
              fGlow.fillStyle(0x332200, 0.3); fGlow.fillCircle(0, 0, 32);
              const fBody = fScene.add.text(0, 0, def.emoji, { fontSize: "38px", fontFamily: "monospace" }).setOrigin(0.5, 0.5);
              const fName = fScene.add.text(0, -50, def.name, {
                fontSize: "8px", color: def.color, fontFamily: "monospace", fontStyle: "bold",
                backgroundColor: "rgba(0,0,0,0.7)", padding: { x: 3, y: 2 },
              }).setOrigin(0.5, 0.5);
              fc.add([fGlow, fBody, fName]);
              fContainers.push(fc);
            }
            festivalContainersRef.current = fContainers;

            spawnFestivalRef.current = () => {
              fContainers.forEach((fc, i) => {
                const def = FEST_DEFS[i];
                fc.setAlpha(0).setPosition(def.x, def.y);
                fScene.tweens.add({ targets: fc, alpha: 1, duration: 700, delay: i * 200, ease: "Cubic.Out", onComplete: () => {
                  // Bob up/down animation
                  fScene.tweens.add({ targets: fc, y: def.y - 8, duration: 700 + i * 80, yoyo: true, repeat: -1, ease: "Sine.InOut" });
                }});
              });
              if (festDialogTimer) clearInterval(festDialogTimer);
              festDialogTimer = setInterval(() => {
                const aliveF = fContainers.filter(fc => fc.alpha > 0.5);
                if (aliveF.length === 0) return;
                const pick = aliveF[Math.floor(Math.random() * aliveF.length)];
                const defIdx = fContainers.indexOf(pick);
                const lines = FEST_DEFS[defIdx]?.lines ?? ["🎉"];
                const line = lines[Math.floor(Math.random() * lines.length)];
                const bubble = fScene.add.text(pick.x, pick.y - 58, line, {
                  fontSize: "9px", color: FEST_DEFS[defIdx]?.color ?? "#fff", fontFamily: "monospace", fontStyle: "bold",
                  backgroundColor: "rgba(0,0,0,0.85)", padding: { x: 5, y: 3 },
                }).setOrigin(0.5, 1).setDepth(122).setAlpha(0);
                fScene.tweens.add({ targets: bubble, alpha: 1, duration: 150, onComplete: () => {
                  fScene.tweens.add({ targets: bubble, y: bubble.y - 20, alpha: 0, delay: 2000, duration: 500, onComplete: () => bubble.destroy() });
                }});
              }, 2800 + Math.random() * 1500);
            };

            despawnFestivalRef.current = () => {
              if (festDialogTimer) { clearInterval(festDialogTimer); festDialogTimer = null; }
              fContainers.forEach(fc => {
                fScene.tweens.killTweensOf(fc);
                fScene.tweens.add({ targets: fc, alpha: 0, duration: 700, ease: "Cubic.Out", onComplete: () => fc.setAlpha(0) });
              });
            };
          }

          // ── Stash Chest (near fountain, northwest) ─────────────────────────
          {
            const SX = 1930, SY = 500; // Town center area, west of fountain
            const stashG = this.add.graphics();
            // Amber glow beneath
            stashG.fillStyle(0xffa020, 0.3); stashG.fillCircle(SX, SY+4, 24);
            // Chest body
            stashG.fillStyle(0x7a4a10, 1); stashG.fillRoundedRect(SX-18, SY-10, 36, 26, 3);
            // Chest lid
            stashG.fillStyle(0x9a6620, 1); stashG.fillRoundedRect(SX-18, SY-17, 36, 12, 2);
            // Gold trim
            stashG.fillStyle(0xffd700, 1); stashG.fillRect(SX-18, SY-5, 36, 3);
            stashG.fillStyle(0xffd700, 1); stashG.fillCircle(SX, SY+2, 4);
            stashG.setDepth(5);
            this.add.text(SX, SY+22, "🗄️ Stash", { fontSize: "9px", color: "#ffd070", fontFamily: "monospace", backgroundColor: "rgba(0,0,0,0.6)", padding: { x: 2, y: 1 } }).setOrigin(0.5, 0).setDepth(6);
            const stashHint = this.add.text(SX, SY-30, "Click chest to open stash", { fontSize: "10px", color: "#ffd060", fontFamily: "monospace", backgroundColor: "rgba(0,0,0,0.78)", padding: { x: 5, y: 2 } }).setOrigin(0.5, 1).setAlpha(0).setDepth(20);
            const stashZone = this.add.zone(SX, SY, 60, 60).setInteractive({ cursor: "pointer" });
            stashZone.on("pointerdown", () => { if (abilityTargetModeRef.current) { abilityTargetModeRef.current = null; setAbilityTargetMode(null); return; } openStashRef.current?.(); });
            // Store for update loop proximity check
            (this as unknown as Record<string, unknown>)._stashPos = { x: SX, y: SY, hint: stashHint };
          }

          // ── Seraphina — Jukebox Lady (north of fountain) ───────────────────
          {
            const JX = 2800, JY = 430; // north of fountain
            const jScene = this;
            // Glowing music aura
            const jGlow = jScene.add.graphics();
            jGlow.fillStyle(0xff88cc, 0.22); jGlow.fillCircle(JX, JY, 32);
            jGlow.setDepth(5);
            // Lady emoji
            const jBody = jScene.add.text(JX, JY, "🎵", { fontSize: "30px", fontFamily: "monospace" }).setOrigin(0.5).setDepth(6);
            jScene.tweens.add({ targets: jBody, y: JY - 6, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.InOut" });
            jScene.add.text(JX, JY + 22, "Seraphina", { fontSize: "8px", color: "#ffaadd", fontFamily: "monospace", backgroundColor: "rgba(0,0,0,0.6)", padding: { x: 3, y: 1 } }).setOrigin(0.5, 0).setDepth(6);
            const jHint = jScene.add.text(JX, JY - 44, "Click to play music 🎶", { fontSize: "10px", color: "#ff88cc", fontFamily: "monospace", backgroundColor: "rgba(0,0,0,0.78)", padding: { x: 5, y: 2 } }).setOrigin(0.5, 1).setAlpha(0).setDepth(20);
            const jZone = jScene.add.zone(JX, JY, 58, 62).setInteractive({ cursor: "pointer" });
            openJukeboxDialogRef.current = () => { setShowJukeboxDialog(true); };
            jZone.on("pointerover", () => jHint.setAlpha(1));
            jZone.on("pointerout", () => jHint.setAlpha(0));
            jZone.on("pointerdown", () => { if (abilityTargetModeRef.current) { abilityTargetModeRef.current = null; setAbilityTargetMode(null); return; } openJukeboxDialogRef.current?.(); });
            (this as unknown as Record<string, unknown>)._jukeboxPos = { x: JX, y: JY, hint: jHint };
          }

          // ── Vendor NPC (west of stash) ─────────────────────────────────────
          {
            const VX = 1850, VY = 490;
            const vendorG = this.add.graphics();
            vendorG.fillStyle(0xffc030, 0.3); vendorG.fillCircle(VX, VY, 24);
            vendorG.fillStyle(0x8a6010, 1); vendorG.fillCircle(VX, VY-12, 11);
            vendorG.fillRect(VX-8, VY-1, 16, 18);
            vendorG.setDepth(5);
            this.add.text(VX, VY-24, "🛒", { fontSize: "18px" }).setOrigin(0.5).setDepth(6);
            this.add.text(VX, VY+14, "Vendor", { fontSize: "8px", color: "#ffe080", fontFamily: "monospace", backgroundColor: "rgba(0,0,0,0.55)", padding: { x: 3, y: 1 } }).setOrigin(0.5, 0).setDepth(6);
            const vendorHint = this.add.text(VX, VY-48, "Press G to shop", { fontSize: "10px", color: "#ffd060", fontFamily: "monospace", backgroundColor: "rgba(0,0,0,0.78)", padding: { x: 5, y: 2 } }).setOrigin(0.5, 1).setAlpha(0).setDepth(20);
            const vendorZone = this.add.zone(VX, VY-4, 40, 50).setInteractive({ cursor: "pointer" });
            vendorZone.on("pointerdown", () => { if (abilityTargetModeRef.current) { abilityTargetModeRef.current = null; setAbilityTargetMode(null); return; } openVendor(); });
            (this as unknown as Record<string, unknown>)._vendorPos = { x: VX, y: VY, hint: vendorHint };
          }

          // ── G key = vendor, H key = herald (F key removed — click chest to open stash) ──
          this.input.keyboard!.on("keydown-G", () => {
            if (!chatOpenRef.current && !showVendorRef.current) openVendor();
            else if (showVendorRef.current) { showVendorRef.current = false; setShowVendor(false); }
          });
          this.input.keyboard!.on("keydown-H", () => {
            if (!chatOpenRef.current && !showHeraldRef.current) openHerald();
            else if (showHeraldRef.current) { showHeraldRef.current = false; setShowHerald(false); }
          });
          // P key = pick up ground item
          this.input.keyboard!.on("keydown-P", () => {
            const nearby = nearGroundItemRef.current;
            if (!nearby || chatOpenRef.current) return;
            fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "pick-item", groundItemId: nearby.id }) })
              .then(r => r.json()).then(d => {
                if (d.ok) {
                  groundItemsRef.current = groundItemsRef.current.filter(g => g.id !== nearby.id);
                  nearGroundItemRef.current = null;
                  setNearGroundItem(null);
                }
              }).catch(() => {});
          });

          // ── My player ────────────────────────────────────────────────────────
          const startX = TCX, startY = H/2+130;
          this.player = this.add.container(startX, startY);
          this.playerImg = drawAvatarSprite(this, this.player, "avatar_me", true);

          this.playerLabel = this.add.text(0, 30, `@${username}`, {
            fontSize: "10px", color: "#ffffff", fontFamily: "monospace", fontStyle: "bold",
            backgroundColor: "rgba(0,0,0,0.65)", padding: { x: 4, y: 2 },
          }).setOrigin(0.5, 0);
          this.player.add(this.playerLabel);

          this.playerItBadge = this.add.text(0, -34, "🔴 IT", {
            fontSize: "11px", color: "#ff4444", fontFamily: "monospace", fontStyle: "bold",
            backgroundColor: "rgba(0,0,0,0.7)", padding: { x: 4, y: 2 },
          }).setOrigin(0.5, 0.5).setVisible(false);
          this.player.add(this.playerItBadge);

          this.playerItemText = this.add.text(0, -54, "", {
            fontSize: "20px", fontFamily: "serif",
          }).setOrigin(0.5, 0.5).setVisible(false);
          this.player.add(this.playerItemText);

          // ── Equipment slot overlay — weapon only on avatar ────────────────
          const slotStyle = { fontSize: "13px", fontFamily: "serif" };
          this.playerWeaponText = this.add.text(28, -2, "", slotStyle).setOrigin(0, 0.5).setDepth(8).setVisible(false);
          this.player.add([this.playerWeaponText]);

          // Click own equipped item to enter ability targeting mode
          this.playerItemText.setInteractive(
            new Phaser.Geom.Rectangle(-16, -16, 32, 32),
            Phaser.Geom.Rectangle.Contains
          );
          this.playerItemText.on("pointerdown", () => {
            const emoji = myEquippedItemRef.current;
            if (!emoji) return;
            // Check for RPG slot item with ability first
            const slots = stashDataRef.current?.equipped_slots ?? {};
            const abilityItem = Object.values(slots).find(
              (s) => (s as { ability?: string } | null)?.ability
            ) as { ability?: string; emoji?: string; name?: string; consumable?: boolean } | null;
            let mode: AbilityTargetMode;
            if (abilityItem?.ability) {
              mode = {
                ability: abilityItem.ability,
                itemEmoji: abilityItem.emoji ?? emoji,
                itemName: abilityItem.name ?? abilityItem.ability.replace(/_/g, " "),
                consumable: !!abilityItem.consumable,
              };
            } else {
              // Plain held item → give mode
              mode = { ability: null, itemEmoji: emoji, itemName: emoji, consumable: true };
            }
            abilityTargetModeRef.current = mode;
            setAbilityTargetMode(mode);
          });

          this.playerBubble = this.add.container(0, -60);
          this.playerBubble.setVisible(false);
          this.player.add(this.playerBubble);
          this.player.setDepth(10);

          // ── Housing District (x=4500–6200) ────────────────────────────────────
          {
            // Ground — warm cobblestone neighbourhood feel
            const hg = this.add.graphics();
            hg.fillStyle(0xc8a87a, 1);
            hg.fillRect(4400, 0, 1800, H);
            // cobblestone texture
            hg.lineStyle(1, 0xaa8855, 0.3);
            for (let hy = 0; hy < H; hy += 36) {
              for (let hx = 4400; hx < 6200; hx += 48) {
                hg.strokeRoundedRect(hx + (hy % 2 === 0 ? 0 : 24), hy, 46, 34, 4);
              }
            }
            // Border wall between market and housing
            const hw = this.add.graphics();
            hw.fillStyle(0x7a6040, 1); hw.fillRect(4400, 0, 14, H);
            hw.fillStyle(0x9a8060, 1);
            for (let hy = 0; hy < H; hy += 40) hw.fillRect(4400, hy, 14, 18);

            // District sign
            this.add.text(4800, H / 2, "🏘️  Neighbourhood", {
              fontSize: "20px", color: "#4a2800", fontFamily: "monospace", fontStyle: "bold",
              backgroundColor: "rgba(240,210,150,0.85)", padding: { x: 14, y: 7 },
            }).setOrigin(0.5).setDepth(5);
            this.add.text(4800, H / 2 + 36, "Your party's homes", {
              fontSize: "12px", color: "#7a5030", fontFamily: "monospace",
              backgroundColor: "rgba(240,210,150,0.7)", padding: { x: 10, y: 4 },
            }).setOrigin(0.5).setDepth(5);

            // Central path between rows
            const pathG = this.add.graphics();
            pathG.fillStyle(0xd4b07a, 1); pathG.fillRect(4420, 430, 1780, 160);
            pathG.lineStyle(2, 0xb89060, 0.5);
            for (let px = 4420; px < 6200; px += 40) pathG.strokeRect(px, 430, 38, 158);

            // Trees lining the path
            [[4470, 420],[4690, 420],[4910, 420],[5130, 420],[5350, 420],[5570, 420],
             [4470, 600],[4690, 600],[4910, 600],[5130, 600],[5350, 600],[5570, 600]].forEach(([tx, ty]) => {
              const tg = this.add.graphics();
              tg.fillStyle(0x6a3a12, 1); tg.fillRect(tx-3, ty+4, 6, 18);
              tg.fillStyle(0x0e6622, 1); tg.fillTriangle(tx, ty-22, tx-18, ty+6, tx+18, ty+6);
              tg.fillStyle(0x1a9030, 1); tg.fillCircle(tx, ty-8, 11);
            });

            // Draw houses from districtSlots state
            const slotsSnap = districtSlots;
            HOUSE_SLOTS.forEach((slot, i) => {
              const info = slotsSnap[i];
              if (!info) return;
              const ext = EXTERIOR_STYLES.find(e => e.id === info.exteriorStyle) ?? EXTERIOR_STYLES[0];
              const hx = slot.x, hy = slot.y;
              const hw2 = HOUSE_W, hh = HOUSE_H;

              const houseG = this.add.graphics();
              houseG.setDepth(4);

              // Shadow
              houseG.fillStyle(0x000000, 0.18);
              houseG.fillRoundedRect(hx + 8, hy + 8, hw2, hh, 6);

              // Foundation
              houseG.fillStyle(0x8a7a5a, 1);
              houseG.fillRect(hx - 4, hy + hh - 4, hw2 + 8, 10);

              // Walls
              const wc = parseInt(ext.wallColor.replace("#",""), 16);
              houseG.fillStyle(wc, 1);
              houseG.fillRoundedRect(hx, hy + 28, hw2, hh - 28, { tl: 0, tr: 0, bl: 6, br: 6 });

              // Roof
              const rc = parseInt(ext.roofColor.replace("#",""), 16);
              houseG.fillStyle(rc, 1);
              houseG.fillTriangle(hx - 8, hy + 32, hx + hw2/2, hy - 18, hx + hw2 + 8, hy + 32);
              // Chimney
              const tc = parseInt(ext.trimColor.replace("#",""), 16);
              houseG.fillStyle(wc, 1);
              houseG.fillRect(hx + hw2 * 0.7, hy - 28, 18, 38);
              houseG.fillStyle(0x333333, 0.6); houseG.fillRect(hx + hw2 * 0.7 - 2, hy - 32, 22, 6);

              // Windows (2)
              houseG.fillStyle(0xffd880, 0.9);
              houseG.fillRoundedRect(hx + 14, hy + 44, 38, 30, 3);
              houseG.fillRoundedRect(hx + hw2 - 52, hy + 44, 38, 30, 3);
              houseG.lineStyle(2, 0x8a6a30, 0.4);
              houseG.strokeRoundedRect(hx + 14, hy + 44, 38, 30, 3);
              houseG.strokeRoundedRect(hx + hw2 - 52, hy + 44, 38, 30, 3);
              // Window cross
              houseG.lineStyle(1, 0x8a6a30, 0.4);
              houseG.lineBetween(hx + 33, hy + 44, hx + 33, hy + 74);
              houseG.lineBetween(hx + 14, hy + 59, hx + 52, hy + 59);
              houseG.lineBetween(hx + hw2 - 33, hy + 44, hx + hw2 - 33, hy + 74);
              houseG.lineBetween(hx + hw2 - 52, hy + 59, hx + hw2 - 14, hy + 59);

              // Door
              const dc = parseInt(ext.doorColor.replace("#",""), 16);
              houseG.fillStyle(dc, 1);
              houseG.fillRoundedRect(hx + hw2/2 - 16, hy + hh - 52, 32, 52, { tl: 6, tr: 6, bl: 0, br: 0 });
              // Door knob
              houseG.fillStyle(0xffcc44, 1); houseG.fillCircle(hx + hw2/2 + 8, hy + hh - 28, 3);
              // Door step
              houseG.fillStyle(0x8a7a5a, 1); houseG.fillRect(hx + hw2/2 - 20, hy + hh - 4, 40, 8);

              // Trim accent
              houseG.fillStyle(tc, 0.8);
              houseG.fillRect(hx, hy + 26, hw2, 4);
              houseG.fillRoundedRect(hx, hy + hh - 4, hw2, 4, 2);

              // Nameplate
              const label = info.isNpc
                ? `${ext.emoji} ${info.username}`
                : `${ext.emoji} ${info.username}`;
              const nameText = this.add.text(hx + hw2/2, hy - 30, label, {
                fontSize: "10px", color: "#fff", fontFamily: "monospace", fontStyle: "bold",
                backgroundColor: "rgba(0,0,0,0.65)", padding: { x: 6, y: 3 },
              }).setOrigin(0.5, 1).setDepth(8);

              // "Your house" indicator
              if (!info.isNpc && info.userId === userId) {
                this.add.text(hx + hw2/2, hy - 46, "🏠 Your Home", {
                  fontSize: "9px", color: "#ffd700", fontFamily: "monospace",
                  backgroundColor: "rgba(0,0,0,0.5)", padding: { x: 5, y: 2 },
                }).setOrigin(0.5, 1).setDepth(8);
              }

              // Click zone (for all non-NPC houses, or own house)
              if (!info.isNpc && info.userId) {
                const clickZone = this.add.zone(hx + hw2/2, hy + hh/2, hw2, hh).setInteractive({ cursor: "pointer" }).setDepth(9);
                clickZone.on("pointerover", () => { nameText.setStyle({ color: "#ffd700" }); });
                clickZone.on("pointerout", () => { nameText.setStyle({ color: "#fff" }); });
                clickZone.on("pointerdown", () => {
                  setOpenHouse({ userId: info.userId!, username: info.username });
                });
              }
            });
          }

          // ── Camera ───────────────────────────────────────────────────────────
          this.cameras.main.setBounds(0, 0, W, H);
          this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
          // Zoom: landscape mobile gets slight boost to fill the wider view
          const getZoom = () => {
            const isMobile = window.innerWidth < 768 || ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
            if (!isMobile) return 1.4;
            return window.innerWidth > window.innerHeight ? 1.15 : 1.0; // landscape vs portrait
          };
          this.cameras.main.setZoom(getZoom());
          // Re-apply zoom on orientation/resize so landscape feels right
          const onResize = () => this.cameras.main?.setZoom(getZoom());
          window.addEventListener("resize", onResize);
          this.events.on("destroy", () => window.removeEventListener("resize", onResize));

          // ── Input ────────────────────────────────────────────────────────────
          // IMPORTANT: addKey(code, enableCapture=false, emitOnRepeat=false)
          // Setting enableCapture=false means Phaser will NEVER call
          // event.preventDefault() on these keys — so WASD/Space/Arrows can
          // still be typed normally in Chronicle, DMs, chat inputs, etc.
          // We still read .isDown for movement — that works without capture.
          const KB = Phaser.Input.Keyboard.KeyCodes;
          this.cursors = {
            left:  this.input.keyboard!.addKey(KB.LEFT,  false, false),
            right: this.input.keyboard!.addKey(KB.RIGHT, false, false),
            up:    this.input.keyboard!.addKey(KB.UP,    false, false),
            down:  this.input.keyboard!.addKey(KB.DOWN,  false, false),
            shift: this.input.keyboard!.addKey(KB.SHIFT, false, false),
            space: this.input.keyboard!.addKey(KB.SPACE, false, false),
          } as unknown as Phaser.Types.Input.Keyboard.CursorKeys;
          this.wasd = {
            W: this.input.keyboard!.addKey(KB.W, false, false),
            A: this.input.keyboard!.addKey(KB.A, false, false),
            S: this.input.keyboard!.addKey(KB.S, false, false),
            D: this.input.keyboard!.addKey(KB.D, false, false),
          };
          this.input.keyboard!.disableGlobalCapture(); // belt-and-suspenders
          this.input.keyboard!.on("keydown-T", () => { if (!chatOpenRef.current) openChat(true); });
          this.input.keyboard!.on("keydown-ENTER", () => { if (!chatOpenRef.current) openChat(true); });
          // C = character panel (also loads stash/backpack data for equipment display)
          this.input.keyboard!.on("keydown-C", () => {
            if (chatOpenRef.current) return;
            if (showStashRef.current) return; // stash already open — don't open both
            const next = !showInventoryRef.current;
            showInventoryRef.current = next;
            setShowInventory(next);
            if (next) loadStashData();
          });

          // Allow React to teleport the player back to a saved position (used when returning from cave/adventure)
          teleportPlayerRef.current = (x: number, y: number) => {
            if (this.player) { this.player.setPosition(x, y); myPosRef.current = { x, y }; }
          };

          // Tap-to-move: TOUCH ONLY — desktop keeps WASD/arrows
          this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
            if (chatOpenRef.current) return;
            // ── Teleport ability: click any spot to teleport ─────────────────
            const mode = abilityTargetModeRef.current;
            if (mode?.ability === "teleport") {
              abilityTargetModeRef.current = null;
              setAbilityTargetMode(null);
              const cam = this.cameras.main;
              const wx = Math.max(30, Math.min(W - 30, pointer.x + cam.scrollX));
              const wy = Math.max(30, Math.min(H - 30, pointer.y + cam.scrollY));
              // Sparkle trail: burst at origin, land at destination
              const originX = this.player.x, originY = this.player.y;
              [{ x: originX, y: originY }, { x: wx, y: wy }].forEach(({ x, y }) => {
                for (let i = 0; i < 6; i++) {
                  const spark = this.add.text(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 30, "✨", { fontSize: "14px" }).setDepth(30);
                  this.tweens.add({ targets: spark, alpha: 0, y: spark.y - 20, duration: 500 + Math.random() * 300, onComplete: () => spark.destroy() });
                }
              });
              teleportPlayerRef.current?.(wx, wy);
              return;
            }
              // Tap-to-move: touch devices only (mobile iOS/Android)
            if (!pointer.wasTouch) return;
            if (overlayOpenRef.current) return;
            // pointer.worldX/Y accounts for camera scroll, zoom, and device pixel ratio
            const wx = pointer.worldX;
            const wy = pointer.worldY;
            tapTargetRef.current = { x: wx, y: wy };
            // Visual ripple at click/tap point
            const ripple = this.add.graphics().setDepth(25);
            ripple.lineStyle(2, 0xffffff, 0.7);
            ripple.strokeCircle(wx, wy, 12);
            this.tweens.add({ targets: ripple, alpha: 0, scaleX: 2.5, scaleY: 2.5, duration: 400,
              onComplete: () => ripple.destroy() });
          });

          this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
            if (!pointer.isDown) return;
            if (!pointer.wasTouch) return;
            if (chatOpenRef.current || overlayOpenRef.current) return;
            tapTargetRef.current = { x: pointer.worldX, y: pointer.worldY };
          });

          myPosRef.current = { x: startX, y: startY };
          fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ x: startX, y: startY, direction: "down", partyId: partyIdRef.current }) }).catch(() => {});
        }

        createOrUpdateOther(p: TownPlayer) {
          const existing = this.others.get(p.user_id);
          const isIt = p.is_it || p.user_id === tagItIdRef.current;

          if (!existing) {
            // Guard: don't create a second container while the first is still loading
            if (this.loadingTextures.has(p.user_id)) return;

            const container = this.add.container(p.x, p.y);
            const texKey = `avatar_${p.user_id.replace(/[^a-zA-Z0-9]/g, "_")}`;

            const finalize = () => {
              this.loadingTextures.delete(p.user_id);
              // If another finalize already ran for this player, destroy duplicate
              if (this.others.has(p.user_id)) { container.destroy(); return; }
              const img = drawAvatarSprite(this, container, texKey, false);
              const label = this.add.text(0, 34, `@${p.username}`, {
                fontSize: "10px", color: "#e8e8ff", fontFamily: "monospace",
                backgroundColor: "rgba(0,0,0,0.6)", padding: { x: 4, y: 2 },
              }).setOrigin(0.5, 0);
              container.add(label);
              const itBadge = this.add.text(0, -36, "🔴 IT", {
                fontSize: "11px", color: "#ff4444", fontFamily: "monospace", fontStyle: "bold",
                backgroundColor: "rgba(0,0,0,0.7)", padding: { x: 4, y: 2 },
              }).setOrigin(0.5, 0.5).setVisible(isIt);
              container.add(itBadge);
              const equippedEmoji = equippedItemsRef.current.get(p.user_id) ?? null;
              const itemText = this.add.text(0, -56, equippedEmoji ?? "", {
                fontSize: "20px", fontFamily: "serif",
              }).setOrigin(0.5, 0.5).setVisible(!!equippedEmoji);
              container.add(itemText);
              const bubble = this.add.container(0, -62);
              bubble.setVisible(false);
              container.add(bubble);
              const slotSt = { fontSize: "13px", fontFamily: "serif" };
              const weaponText = this.add.text(28, -2, "", slotSt).setOrigin(0, 0.5).setDepth(8).setVisible(false);
              container.add([weaponText]);
              // Init weapon from initial poll data
              const initSlots = p.equipped_slots ?? {};
              weaponText.setText(initSlots.weapon?.emoji ?? "").setVisible(!!initSlots.weapon?.emoji);
              container.setDepth(9);
              // Interactive for click-to-tag (works on mobile tap too)
              container.setInteractive(new Phaser.Geom.Rectangle(-24, -24, 48, 48), Phaser.Geom.Rectangle.Contains);
              container.on("pointerdown", () => {
                const mode = abilityTargetModeRef.current;
                if (mode) {
                  abilityTargetModeRef.current = null;
                  setAbilityTargetMode(null);
                  if (mode.ability === "frog_hex") {
                    handleFrogHex([p.user_id]);
                  } else if (!mode.ability) {
                    giveItem(p.user_id, p.username);
                  }
                  // Future abilities: add cases here
                  return;
                }
                if (tagItIdRef.current === userId) tryTag(p.user_id, p.username);
              });
              this.others.set(p.user_id, { container, img, label, itBadge, itemText, bubble, weaponText, targetX: p.x, targetY: p.y, vx: 0, vy: 0, lastUpdateTime: Date.now() });
            };

            this.loadingTextures.add(p.user_id);
            // Always use the stable server-side proxy — it reads the Blob URL from DB
            // and handles all fallbacks, so expired OAuth URLs never reach Phaser.
            const src = `/api/avatar/${p.user_id}`;
            loadAvatarIntoScene(this, texKey, src, p.username, finalize);
          } else {
            // Compute velocity from position delta for extrapolation
            const now = Date.now();
            const dtSec = Math.max(0.05, (now - existing.lastUpdateTime) / 1000);
            const dx = p.x - existing.targetX;
            const dy = p.y - existing.targetY;
            // Only update velocity if there was actual movement
            if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
              existing.vx = dx / dtSec;
              existing.vy = dy / dtSec;
            } else {
              existing.vx = 0;
              existing.vy = 0;
            }
            existing.lastUpdateTime = now;
            // Flip sprite to match movement direction
            if (Math.abs(dx) > 2) existing.img.setFlipX(dx < 0);
            existing.targetX = p.x;
            existing.targetY = p.y;
            existing.itBadge.setVisible(isIt);
            // Item text hidden for other players (action bar is local-only)
            existing.itemText.setVisible(false);
            // Weapon only on other players' avatars
            const ps = p.equipped_slots ?? {};
            existing.weaponText.setText(ps.weapon?.emoji ?? "").setVisible(!!ps.weapon?.emoji);
            if (p.chat_msg && p.chat_at) {
              const age = Date.now() - new Date(p.chat_at).getTime();
              if (age < 6000) showBubble(existing.bubble, p.chat_msg, this);
              else existing.bubble.setVisible(false);
            }
          }
        }

        update(_time: number, delta: number) {
          // ── Guard: never capture keys while user is typing anywhere on the page ──
          const _activeEl = document.activeElement;
          const _isTyping = _activeEl instanceof HTMLInputElement ||
                            _activeEl instanceof HTMLTextAreaElement ||
                            (_activeEl as HTMLElement)?.contentEditable === "true";
          if (_isTyping) return;

          // Update horse & carriage animation
          const updateCarriage = (this as unknown as Record<string, unknown>)._updateCarriage as ((dt: number) => void) | undefined;
          if (updateCarriage) updateCarriage(delta);

          const dt = delta / 1000;
          let vx = 0, vy = 0;
          const speed = tagSpeedActiveRef.current ? TAG_SPEED : PLAYER_SPEED;
          if ((this.cursors.left?.isDown || this.wasd.A.isDown) && !chatOpenRef.current && !overlayOpenRef.current) { vx = -speed; this.direction = "left"; }
          if ((this.cursors.right?.isDown || this.wasd.D.isDown) && !chatOpenRef.current && !overlayOpenRef.current) { vx = speed; this.direction = "right"; }
          if ((this.cursors.up?.isDown || this.wasd.W.isDown) && !chatOpenRef.current && !overlayOpenRef.current) { vy = -speed; this.direction = "up"; }
          if ((this.cursors.down?.isDown || this.wasd.S.isDown) && !chatOpenRef.current && !overlayOpenRef.current) { vy = speed; this.direction = "down"; }
          // Tap-to-move input (mobile / touch)
          const tapTarget = tapTargetRef.current;
          if (tapTarget && !chatOpenRef.current && !overlayOpenRef.current) {
            const tdx = tapTarget.x - this.player.x;
            const tdy = tapTarget.y - this.player.y;
            const tdist = Math.sqrt(tdx * tdx + tdy * tdy);
            if (tdist < 10) {
              tapTargetRef.current = null;
            } else {
              vx += (tdx / tdist) * speed;
              vy += (tdy / tdist) * speed;
              if (Math.abs(tdx) > Math.abs(tdy)) { this.direction = tdx < 0 ? "left" : "right"; }
              else { this.direction = tdy < 0 ? "up" : "down"; }
            }
          }
          if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }

          // Flip sprite left/right based on movement direction
          if (vx < 0) this.playerImg.setFlipX(true);
          else if (vx > 0) this.playerImg.setFlipX(false);

          const nx = Phaser.Math.Clamp(this.player.x + vx * dt, 32, W - 32);
          const ny = Phaser.Math.Clamp(this.player.y + vy * dt, 32, H - 32);
          this.player.setPosition(nx, ny);
          myPosRef.current = { x: nx, y: ny };

          // Captain proximity hint
          const eKeyHint = (this as unknown as Record<string, unknown>)._eKeyHint as Phaser.GameObjects.Text | undefined;
          const captainY = (this as unknown as Record<string, unknown>)._captainY as number | undefined;
          if (eKeyHint && captainY !== undefined) {
            const nearCaptain = ny < 280 && Math.abs(nx - 2800) < 160;
            const targetAlpha = nearCaptain ? 1 : 0;
            eKeyHint.setAlpha(Phaser.Math.Linear(eKeyHint.alpha, targetAlpha, 0.12));
            captainHintRef.current = nearCaptain;
          }

          // Cave proximity hint
          const caveHintObj = (this as unknown as Record<string, unknown>)._caveHint as Phaser.GameObjects.Text | undefined;
          const cavePosX = (this as unknown as Record<string, unknown>)._cavePosX as number | undefined;
          const cavePosY = (this as unknown as Record<string, unknown>)._cavePosY as number | undefined;
          if (caveHintObj && cavePosX !== undefined && cavePosY !== undefined) {
            const nearCave = Math.hypot(nx - cavePosX, ny - cavePosY) < 100;
            caveHintObj.setAlpha(Phaser.Math.Linear(caveHintObj.alpha, nearCave ? 1 : 0, 0.12));
            caveHintRef.current = nearCave;
          }

          // Village / Castle NPC proximity hints + nearNpcRef update
          {
            type VillageNpc = { id: string; x: number; y: number; hint: Phaser.GameObjects.Text };
            const villageNpcs = (this as unknown as Record<string, unknown>)._villageNpcs as VillageNpc[] | undefined;
            if (villageNpcs) {
              let closestId: string | null = null;
              let closestDist = 92;
              for (const n of villageNpcs) {
                const d = Math.hypot(nx - n.x, ny - n.y);
                n.hint.setAlpha(Phaser.Math.Linear(n.hint.alpha, d < 90 ? 1 : 0, 0.12));
                if (d < closestDist) { closestDist = d; closestId = n.id; }
              }
              nearNpcRef.current = closestId;
            }
          }

          // Shop NPC proximity hints
          type ShopNpc = { label: string; x: number; y: number; hint: Phaser.GameObjects.Text };
          const shopNpcs = (this as unknown as Record<string, unknown>)._shopNpcs as ShopNpc[] | undefined;
          if (shopNpcs) {
            for (const npc of shopNpcs) {
              const nearShop = Math.hypot(nx - npc.x, ny - npc.y) < 80;
              npc.hint.setAlpha(Phaser.Math.Linear(npc.hint.alpha, nearShop ? 1 : 0, 0.12));
              // E key: near shop + not near captain
              if (nearShop && !captainHintRef.current && !caveHintRef.current) {
                this.input.keyboard!.once("keydown-E", () => {
                  if (!chatOpenRef.current && !captainHintRef.current) { setActiveRoom(npc.label); activeRoomRef.current = npc.label; }
                });
              }
            }
          }

          // (C key registered in create())

          // ── Stash / Vendor proximity hints ────────────────────────────────
          const stashPos = (this as unknown as Record<string, unknown>)._stashPos as { x: number; y: number; hint: Phaser.GameObjects.Text } | undefined;
          if (stashPos) {
            const nearStash = Math.hypot(nx - stashPos.x, ny - stashPos.y) < 80;
            stashPos.hint.setAlpha(Phaser.Math.Linear(stashPos.hint.alpha, nearStash ? 1 : 0, 0.12));
          }
          const vendorPos = (this as unknown as Record<string, unknown>)._vendorPos as { x: number; y: number; hint: Phaser.GameObjects.Text } | undefined;
          if (vendorPos) {
            const nearVendor = Math.hypot(nx - vendorPos.x, ny - vendorPos.y) < 80;
            vendorPos.hint.setAlpha(Phaser.Math.Linear(vendorPos.hint.alpha, nearVendor ? 1 : 0, 0.12));
          }

          // ── Ground item sprites (update each poll tick) ───────────────────
          {
            const rec = this as unknown as Record<string, unknown>;
            if (!rec._groundSprites) rec._groundSprites = new Map<string, Phaser.GameObjects.Container>();
            const gMap = rec._groundSprites as Map<string, Phaser.GameObjects.Container>;
            const currentIds = new Set(groundItemsRef.current.map((g: GroundItem) => g.id));
            // Remove sprites for picked-up items
            gMap.forEach((container, id) => { if (!currentIds.has(id)) { container.destroy(); gMap.delete(id); } });
            // Add sprites for new ground items
            groundItemsRef.current.forEach((g: GroundItem) => {
              if (!gMap.has(g.id)) {
                const gContainer = this.add.container(g.x, g.y);
                const glow = this.add.graphics();
                glow.fillStyle(0xffd700, 0.4); glow.fillCircle(0, 0, 18);
                gContainer.add(glow);
                const txt = this.add.text(0, 0, g.item.emoji, { fontSize: "20px" }).setOrigin(0.5);
                gContainer.add(txt);
                gContainer.setDepth(8);
                gMap.set(g.id, gContainer);
              }
            });
          }

          // ── Frog hex: overlay 🐸 on frogged players ───────────────────────
          {
            const now = Date.now();
            // Clean expired entries
            froggifiedRef.current.forEach((expiry, id) => { if (expiry < now) froggifiedRef.current.delete(id); });
            // Apply frog overlay to other players
            this.others.forEach((other, id) => {
              const rec = other as unknown as Record<string, unknown>;
              const frogExpiry = froggifiedRef.current.get(id);
              const isFrogged = frogExpiry !== undefined && frogExpiry > now;
              if (isFrogged && !(rec._frogOverlay)) {
                playRibbit();
                // Smoke burst on transformation
                const cx = other.container.x, cy = other.container.y;
                for (let fsi = 0; fsi < 6; fsi++) {
                  const smkF = this.add.text(cx+(Math.random()-0.5)*40, cy+(Math.random()-0.5)*30, "💨", { fontSize: "16px" }).setOrigin(0.5).setDepth(55);
                  this.tweens.add({ targets: smkF, y: smkF.y - 30, alpha: 0, duration: 450, onComplete: () => smkF.destroy() });
                }
                // Big frog container covering the player avatar
                const frogContainer = this.add.container(0, -4).setDepth(12);
                const frogBg = this.add.graphics();
                frogBg.fillStyle(0x1a7a28, 0.92);
                frogBg.fillRoundedRect(-26, -30, 52, 56, 10);
                frogBg.lineStyle(2, 0x00ff44, 0.6);
                frogBg.strokeRoundedRect(-26, -30, 52, 56, 10);
                const frogTxt = this.add.text(0, -6, "🐸", { fontSize: "40px" }).setOrigin(0.5);
                frogContainer.add([frogBg, frogTxt]);
                this.tweens.add({ targets: frogTxt, y: -10, duration: 700, ease: "Sine.easeInOut", yoyo: true, repeat: -1 });
                other.container.add(frogContainer);
                rec._frogOverlay = frogContainer;
              } else if (!isFrogged && rec._frogOverlay) {
                (rec._frogOverlay as Phaser.GameObjects.Container).destroy();
                delete rec._frogOverlay;
              }
            });

            // Apply frog overlay to the LOCAL player when they are hexed
            {
              const selfRec = this as unknown as Record<string, unknown>;
              const selfFrogExpiry = froggifiedRef.current.get(userId);
              const selfIsFrogged = selfFrogExpiry !== undefined && selfFrogExpiry > now;
              if (selfIsFrogged && !selfRec._selfFrogOverlay) {
                playRibbit();
                const cx = this.player.x, cy = this.player.y;
                for (let fsi = 0; fsi < 6; fsi++) {
                  const smkF = this.add.text(cx+(Math.random()-0.5)*40, cy+(Math.random()-0.5)*30, "💨", { fontSize: "16px" }).setOrigin(0.5).setDepth(55);
                  this.tweens.add({ targets: smkF, y: smkF.y - 30, alpha: 0, duration: 450, onComplete: () => smkF.destroy() });
                }
                const frogContainer = this.add.container(0, -4).setDepth(12);
                const frogBg = this.add.graphics();
                frogBg.fillStyle(0x1a7a28, 0.92);
                frogBg.fillRoundedRect(-26, -30, 52, 56, 10);
                frogBg.lineStyle(2, 0x00ff44, 0.6);
                frogBg.strokeRoundedRect(-26, -30, 52, 56, 10);
                const frogTxt = this.add.text(0, -6, "🐸", { fontSize: "40px" }).setOrigin(0.5);
                frogContainer.add([frogBg, frogTxt]);
                this.tweens.add({ targets: frogTxt, y: -10, duration: 700, ease: "Sine.easeInOut", yoyo: true, repeat: -1 });
                this.player.add(frogContainer);
                selfRec._selfFrogOverlay = frogContainer;
              } else if (!selfIsFrogged && selfRec._selfFrogOverlay) {
                (selfRec._selfFrogOverlay as Phaser.GameObjects.Container).destroy();
                delete selfRec._selfFrogOverlay;
              }
            }
          }

          // IT badge
          const iAmIt = tagItIdRef.current === userId;
          this.playerItBadge.setVisible(iAmIt);

          // Item text hidden — action bar handles all item display
          this.playerItemText.setVisible(false);
          // Weapon only on avatar
          const mySlots0 = (stashDataRef.current?.equipped_slots ?? {}) as Record<string, { emoji?: string } | null>;
          this.playerWeaponText.setText(mySlots0.weapon?.emoji ?? "").setVisible(!!mySlots0.weapon?.emoji);

          if (pendingChatRef.current) {
            const msg = pendingChatRef.current;
            pendingChatRef.current = null;
            showBubble(this.playerBubble, msg, this);
            this.chatBubbleTimer = 6000;
          }
          if (this.chatBubbleTimer > 0) {
            this.chatBubbleTimer -= delta;
            if (this.chatBubbleTimer <= 0) this.playerBubble.setVisible(false);
          }

          this.others.forEach((other) => {
            const { container, targetX, targetY, vx, vy, lastUpdateTime } = other;
            // Extrapolate position based on last known velocity, but cap extrapolation to 300ms
            const extraMs = Math.min(300, Date.now() - lastUpdateTime);
            const extraX = targetX + vx * (extraMs / 1000);
            const extraY = targetY + vy * (extraMs / 1000);
            // Clamp extrapolated position to world bounds
            const clampedX = Phaser.Math.Clamp(extraX, 32, W - 32);
            const clampedY = Phaser.Math.Clamp(extraY, 32, H - 32);
            // Smooth lerp toward extrapolated target — high factor = snappy
            container.x = Phaser.Math.Linear(container.x, clampedX, 0.28);
            container.y = Phaser.Math.Linear(container.y, clampedY, 0.28);
          });

          this.posTimer += delta;
          this.pollTimer += delta;

          // Idle throttle: stop sending after 1 min of no keyboard/mouse input
          const afkMs = Date.now() - _lastActivityTime;
          const isIdle = afkMs > 60 * 1000; // 1 min AFK
          const posThreshold  = isIdle ? 999999 : 1500; // stop position sends when idle
          const pollThreshold = isIdle ? 25000 : 3000;  // 25s poll when idle, 3s when active

          if (this.posTimer >= posThreshold) {
            this.posTimer = 0;
            const pos = myPosRef.current;
            fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ x: Math.round(pos.x), y: Math.round(pos.y), direction: this.direction, partyId: partyIdRef.current }) }).catch(() => {});
          }

          if (this.pollTimer >= pollThreshold) {
            this.pollTimer = 0;
            fetch(partyIdRef.current ? `/api/town?partyId=${encodeURIComponent(partyIdRef.current)}` : "/api/town").then(r => r.json()).then((resp: { players?: TownPlayer[]; ground_items?: GroundItem[]; active_event?: TownEvent | null; recent_victory?: Record<string, unknown> | null }) => {
              // Support both old (array) and new (object) response shapes
              const players: TownPlayer[] = Array.isArray(resp) ? resp : (resp.players ?? []);
              const groundItems = Array.isArray(resp) ? [] : (resp.ground_items ?? []);
              const townEvent = Array.isArray(resp) ? null : (resp.active_event ?? null);

              // Sync ground items and event
              groundItemsRef.current = groundItems;
              setActiveEvent(prev => {
                // Auto-undismiss when a new event starts
                if (townEvent && prev?.id !== townEvent.id) setDismissedEventId(null);
                return townEvent;
              });
              activeEventRef.current = townEvent;
              // Spawn/despawn event entities based on active event type
              const evType = townEvent?.type ?? null;
              const dragonAlive = (dragonContainerRef.current?.alpha ?? 0) > 0.1;
              const banditAlive = (banditContainersRef.current[0]?.alpha ?? 0) > 0.1;
              const merchantAlive = (merchantContainerRef.current?.alpha ?? 0) > 0.1;
              const festivalAlive = (festivalContainersRef.current[0]?.alpha ?? 0) > 0.1;
              if (evType === "dragon_attack") {
                if (!dragonAlive) spawnDragonRef.current?.();
                if (banditAlive) despawnBanditsRef.current?.();
                if (merchantAlive) despawnMerchantRef.current?.();
                if (festivalAlive) despawnFestivalRef.current?.();
              } else if (evType === "bandit_raid") {
                if (dragonAlive) despawnDragonRef.current?.();
                if (!banditAlive) spawnBanditsRef.current?.();
                if (merchantAlive) despawnMerchantRef.current?.();
                if (festivalAlive) despawnFestivalRef.current?.();
              } else if (evType === "merchant_visit") {
                if (dragonAlive) despawnDragonRef.current?.();
                if (banditAlive) despawnBanditsRef.current?.();
                if (!merchantAlive) spawnMerchantRef.current?.();
                if (festivalAlive) despawnFestivalRef.current?.();
              } else if (evType === "festival") {
                if (dragonAlive) despawnDragonRef.current?.();
                if (banditAlive) despawnBanditsRef.current?.();
                if (merchantAlive) despawnMerchantRef.current?.();
                if (!festivalAlive) spawnFestivalRef.current?.();
              } else {
                if (dragonAlive) despawnDragonRef.current?.();
                if (banditAlive) despawnBanditsRef.current?.();
                if (merchantAlive) despawnMerchantRef.current?.();
                if (festivalAlive) despawnFestivalRef.current?.();
              }
              // Victory popup from poll
              const recentVictory = (resp as Record<string, unknown>).recent_victory as (Record<string, unknown> | null);
              if (recentVictory && recentVictory.id !== seenVictoryEventIdRef.current) {
                // Only show if the event just completed
                const endedAt = recentVictory.ended_at ? new Date(recentVictory.ended_at as string).getTime() : 0;
                if (Date.now() - endedAt < 60000) {
                  seenVictoryEventIdRef.current = recentVictory.id as string;
                  setSeenVictoryEventId(recentVictory.id as string);
                  setVictoryData(prev => prev ? prev : { loot: [], participants: 0, eventType: recentVictory.type as string });
                }
              }

              // Sync theater state
              const ts = (resp as Record<string, unknown>).theater_state as (typeof theaterState) | null;
              if (ts) { setTheaterState(ts); theaterStateRef.current = ts; }
              // Sync theater chat
              const tc = (resp as Record<string, unknown>).theater_chat as typeof theaterChat | undefined;
              if (tc) setTheaterChat(tc);

              // Check proximity to ground items
              const myPosForGround = myPosRef.current;
              const nearItem = groundItems.find((g: GroundItem) => Math.hypot(g.x - myPosForGround.x, g.y - myPosForGround.y) < 60);
              nearGroundItemRef.current = nearItem ?? null;
              setNearGroundItem(nearItem ?? null);

              const myPos = myPosRef.current;
              const activeIds = new Set<string>();
              const nearby: TownPlayer[] = [];

              // ── Sync tag state from DB ──────────────────────────────────────
              // Find who is IT across ALL players (including self)
              const allPlayers = players as TownPlayer[];
              const itPlayer = allPlayers.find(p => p.is_it);
              // Also check own record (server returns all including self sometimes)
              const myRecord = allPlayers.find(p => p.user_id === userId);
              const serverItId = itPlayer?.user_id ?? (myRecord?.is_it ? userId : null);
              const serverTagStarted = itPlayer?.tag_started_at ?? myRecord?.tag_started_at ?? null;

              if (serverItId && serverItId !== tagItIdRef.current) {
                // New IT player detected — sync state on this client
                tagItIdRef.current = serverItId;
                tagItUsernameRef.current = itPlayer?.username ?? (serverItId === userId ? username : "someone");
                if (!tagGameActiveRef.current) {
                  // Don't restart if we just ended a game — gives DB time to clear (prevents race condition)
                  if (Date.now() - tagGameEndedAtRef.current < 6000) return;
                  // Compute remaining time from when tag started
                  let timeRemaining = TAG_GAME_DURATION;
                  if (serverTagStarted) {
                    const elapsed = (Date.now() - new Date(serverTagStarted).getTime()) / 1000;
                    // Stale game start — don't start something that should already be over
                    if (elapsed > TAG_GAME_DURATION + 3) return;
                    timeRemaining = Math.max(1, TAG_GAME_DURATION - elapsed);
                  }
                  beginTagGame(serverItId, tagItUsernameRef.current, timeRemaining);
                } else {
                  // Game already active — just update who is IT
                  setTagItId(serverItId);
                  setTagItUsername(tagItUsernameRef.current);
                  if (serverItId === userId) {
                    setTagMsg("🎯 You've been tagged — YOU'RE IT!");
                    setTimeout(() => setTagMsg(null), 3000);
                    startChaseMusic();
                  } else {
                    setTagMsg(`🎯 @${tagItUsernameRef.current} is IT now!`);
                    setTimeout(() => setTagMsg(null), 2000);
                    stopChaseMusic();
                  }
                }
              } else if (!serverItId && tagGameActiveRef.current) {
                // Server cleared IT — end game
                endTagGame();
              }

              // Sync frog hex status from server
              players.forEach((p: TownPlayer) => {
                if (p.frog_until) {
                  const expiry = new Date(p.frog_until).getTime();
                  if (expiry > Date.now()) froggifiedRef.current.set(p.user_id, expiry);
                  else froggifiedRef.current.delete(p.user_id);
                } else {
                  froggifiedRef.current.delete(p.user_id);
                }
              });

              // Broadcast gift/effect animations to ALL players in range
              players.forEach((p: TownPlayer) => {
                const eff = p.last_effect;
                if (!eff) return;
                const alreadySeen = shownEffectsRef.current.get(p.user_id);
                const isRecent = Date.now() - eff.at < 8000;
                if (!isRecent || alreadySeen === eff.at) return;
                shownEffectsRef.current.set(p.user_id, eff.at);
                // Find target position (self or other player)
                let tx: number, ty: number;
                if (p.user_id === userId) {
                  tx = myPos.x; ty = myPos.y;
                } else {
                  const other = this.others.get(p.user_id);
                  if (!other) return;
                  tx = other.container.x; ty = other.container.y;
                }
                // Floating emoji burst
                for (let i = 0; i < 5; i++) {
                  const angle = (i / 5) * Math.PI * 2;
                  const ex = tx + Math.cos(angle) * 20;
                  const ey = ty + Math.sin(angle) * 20 - 20;
                  const et = this.add.text(ex, ey, eff.emoji, { fontSize: "22px" })
                    .setOrigin(0.5).setDepth(60).setAlpha(1);
                  this.tweens.add({
                    targets: et,
                    x: ex + (Math.random() - 0.5) * 50,
                    y: ey - 55 - Math.random() * 30,
                    alpha: 0,
                    duration: 1200 + i * 100,
                    ease: "Cubic.easeOut",
                    onComplete: () => et.destroy(),
                  });
                }
                // Label: "from [name]!" above target
                const label = this.add.text(tx, ty - 60, `${eff.emoji} from ${eff.from}!`, {
                  fontSize: "11px", color: "#ffe082", fontFamily: "monospace",
                  backgroundColor: "rgba(0,0,0,0.65)", padding: { x: 5, y: 3 },
                  stroke: "#000", strokeThickness: 2,
                }).setOrigin(0.5).setDepth(61).setAlpha(0);
                this.tweens.add({
                  targets: label, alpha: 1, y: ty - 80, duration: 300,
                  onComplete: () => {
                    this.tweens.add({ targets: label, alpha: 0, y: ty - 100, duration: 600, delay: 1200, onComplete: () => label.destroy() });
                  },
                });
              });

              players.forEach((p: TownPlayer) => {
                // Update equipped items for all players (including self for Phaser badge)
                equippedItemsRef.current.set(p.user_id, p.equipped_item ?? null);
                if (p.user_id === userId) {
                  // Sync my own coins + equipped item
                  if (p.coins !== undefined) setMyCoins(p.coins);
                  if (p.equipped_item !== undefined) {
                    setMyEquippedItem(p.equipped_item ?? null);
                    myEquippedItemRef.current = p.equipped_item ?? null;
                  }
                  return;
                }
                activeIds.add(p.user_id);
                // Keep real-time positions in ref so tryTag() never reads stale state
                otherPositionsRef.current.set(p.user_id, { x: p.x, y: p.y });
                this.createOrUpdateOther(p);
                if (Math.hypot(p.x - myPos.x, p.y - myPos.y) < NEARBY_DIST) nearby.push(p);
              });
              this.others.forEach((obj, id) => {
                if (!activeIds.has(id)) {
                  obj.container.destroy();
                  this.others.delete(id);
                  otherPositionsRef.current.delete(id);
                  this.loadingTextures.delete(id);
                }
              });
              setNearbyPlayers(nearby);
              setPlayerCount(players.length + 1);
            }).catch(() => {});
          }

          // ── Dragon movement (deterministic path, all clients sync) ──────
          {
            const dc = dragonContainerRef.current;
            if (dc && activeEventRef.current?.type === "dragon_attack" && dc.alpha > 0.1) {
              const t = Date.now();
              const tick = Math.floor(t / DRAGON_TICK_MS);
              const wpIdx = tick % DRAGON_PATH.length;
              const nextIdx = (tick + 1) % DRAGON_PATH.length;
              const progress = (t % DRAGON_TICK_MS) / DRAGON_TICK_MS;
              const curr = DRAGON_PATH[wpIdx];
              const next = DRAGON_PATH[nextIdx];
              // Smooth ease in-out
              const ease = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
              const newX = curr.x + (next.x - curr.x) * ease;
              const newY = curr.y + (next.y - curr.y) * ease;
              dc.x = newX;
              // Flip dragon to face direction of travel
              const ddx = next.x - curr.x;
              dc.scaleX = ddx > 0 ? 1 : -1;
              // Counter-flip label so it always reads left-to-right
              if (dragonLabelRef.current) dragonLabelRef.current.scaleX = dc.scaleX;
              // Bob up/down slightly
              dc.y = newY + Math.sin(t * 0.002) * 4;

              // Update HP bar fill
              const hpFill = dragonHpFillRef.current;
              if (hpFill) {
                const bossHp = Number(activeEventRef.current?.state?.bossHp ?? 1500);
                const bossMax = Number(activeEventRef.current?.state?.bossMaxHp ?? 1500);
                const ratio = Math.max(0, Math.min(1, bossHp / bossMax));
                hpFill.clear();
                const hpColor = ratio > 0.5 ? 0xff4400 : ratio > 0.25 ? 0xff8800 : 0xff0000;
                hpFill.fillStyle(hpColor, 1);
                hpFill.fillRoundedRect(-60, -68, Math.max(2, 120 * ratio), 14, 4);
              }

              // Fire breath: small flame particles ahead of dragon
              const fireLayer = (this as unknown as Record<string, unknown>)._fireLayer as import("phaser").GameObjects.Graphics | null;
              if (fireLayer) {
                fireLayer.clear();
                const fireDir = { x: next.x - curr.x, y: next.y - curr.y };
                const fireLen = Math.hypot(fireDir.x, fireDir.y) || 1;
                const fn = { x: fireDir.x / fireLen, y: fireDir.y / fireLen };
                for (let fi = 0; fi < 6; fi++) {
                  const spread = (Math.random() - 0.5) * 24;
                  const dist = 30 + Math.random() * 40 + fi * 10;
                  const ffx = newX + fn.x * dist + fn.y * spread;
                  const ffy = newY + fn.y * dist - fn.x * spread + Math.sin(t * 0.003 + fi) * 5;
                  const falpha = 0.85 - fi * 0.12;
                  const color = fi < 2 ? 0xffdd00 : fi < 4 ? 0xff6600 : 0xff2200;
                  const size = 10 - fi * 1.2;
                  fireLayer.fillStyle(color, falpha);
                  fireLayer.fillCircle(ffx, ffy, size);
                }
              }
            } else if (dragonContainerRef.current && activeEventRef.current?.type !== "dragon_attack") {
              // No dragon event — hide fire
              const fireLayer = (this as unknown as Record<string, unknown>)._fireLayer as import("phaser").GameObjects.Graphics | null;
              if (fireLayer) fireLayer.clear();
            }
          }

          // ── Bandit patrol movement + HP bar ──────────────────────────────
          if (activeEventRef.current?.type === "bandit_raid") {
            const t = Date.now();
            for (let i = 0; i < banditContainersRef.current.length; i++) {
              const bc = banditContainersRef.current[i];
              if (!bc || bc.alpha < 0.05) continue;
              const patrol = BANDIT_PATROLS[i];
              const offset = i * (BANDIT_TICK_MS * 0.65);
              const tick = Math.floor((t + offset) / BANDIT_TICK_MS);
              const wpIdx = tick % patrol.length;
              const nextIdx = (tick + 1) % patrol.length;
              const prog = ((t + offset) % BANDIT_TICK_MS) / BANDIT_TICK_MS;
              const ease = prog < 0.5 ? 2 * prog * prog : -1 + (4 - 2 * prog) * prog;
              const curr = patrol[wpIdx], next = patrol[nextIdx];
              bc.x = curr.x + (next.x - curr.x) * ease;
              bc.y = curr.y + (next.y - curr.y) * ease + Math.sin(t * 0.003 + i * 1.2) * 3;
              bc.scaleX = next.x >= curr.x ? 1 : -1;
              const nl = banditLabelsRef.current[i]; if (nl) nl.scaleX = bc.scaleX;
              const hpFill = banditHpFillsRef.current[i];
              if (hpFill) {
                const bossHp = Number(activeEventRef.current?.state?.bossHp ?? 2000) / 3;
                const bossMax = Number(activeEventRef.current?.state?.bossMaxHp ?? 2000) / 3;
                const ratio = Math.max(0, Math.min(1, bossHp / bossMax));
                hpFill.clear();
                hpFill.fillStyle(ratio > 0.5 ? 0xcc33cc : ratio > 0.25 ? 0xff6633 : 0xff2200, 1);
                hpFill.fillRoundedRect(-40, -50, Math.max(2, 80 * ratio), 9, 3);
              }
            }
          }

          // ── Wandering merchant movement ───────────────────────────────────
          if (activeEventRef.current?.type === "merchant_visit" && merchantContainerRef.current && merchantContainerRef.current.alpha > 0.05) {
            const t = Date.now();
            const tick = Math.floor(t / MERCHANT_TICK_MS);
            const wpIdx = tick % MERCHANT_WANDER_PATH.length;
            const nextIdx = (tick + 1) % MERCHANT_WANDER_PATH.length;
            const prog = (t % MERCHANT_TICK_MS) / MERCHANT_TICK_MS;
            const ease = prog < 0.5 ? 2 * prog * prog : -1 + (4 - 2 * prog) * prog;
            const curr = MERCHANT_WANDER_PATH[wpIdx], next = MERCHANT_WANDER_PATH[nextIdx];
            merchantContainerRef.current.x = curr.x + (next.x - curr.x) * ease;
            merchantContainerRef.current.y = curr.y + (next.y - curr.y) * ease + Math.sin(t * 0.002) * 3;
            merchantContainerRef.current.scaleX = next.x >= curr.x ? 1 : -1;
          }
        }
      }
      function showBubble(bc: Phaser.GameObjects.Container, msg: string, scene: Phaser.Scene) {
        bc.removeAll(true);
        const maxW = Math.min(220, msg.length * 8 + 28);
        const bg = scene.add.graphics();
        bg.fillStyle(0xffffff, 0.93); bg.fillRoundedRect(-maxW/2, -30, maxW, 34, 8);
        bg.fillTriangle(-6, 4, 6, 4, 0, 12);
        bc.add(bg);
        const txt = scene.add.text(0, -14, msg, {
          fontSize: "11px", color: "#1a1a2e", fontFamily: "monospace",
          wordWrap: { width: maxW - 18 }, align: "center",
        }).setOrigin(0.5, 0.5);
        bc.add(txt);
        bc.setVisible(true);
      }

      const config: import("phaser").Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: containerRef.current?.clientWidth || 800,
        height: containerRef.current?.clientHeight || 600,
        parent: containerRef.current!,
        scene: [TownScene],
        scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
        input: { keyboard: { capture: [] }, mouse: true, touch: true },
        render: { antialias: true, pixelArt: false },
      };

      game = new Phaser.Game(config);
      gameRef.current = game;

      // Fix canvas resolution for high-DPI screens (retina/mobile).
      // Phaser's RESIZE mode sets canvas dimensions to CSS pixels; we upscale
      // to physical pixels then shrink back via CSS so it renders sharply.
      const dpr = window.devicePixelRatio || 1;
      if (dpr > 1) {
        const g = game;
        g.events.once("ready", () => {
          const canvas = g.canvas;
          if (!canvas) return;
          const w = canvas.clientWidth, h = canvas.clientHeight;
          canvas.width  = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
          canvas.style.width  = w + "px";
          canvas.style.height = h + "px";
          (g.renderer as unknown as { resize: (w: number, h: number) => void }).resize?.(canvas.width, canvas.height);
        });
      }

      // Auto-focus canvas so WASD works immediately on load/return
      setTimeout(() => { const c = containerRef.current?.querySelector("canvas"); if (c) (c as HTMLElement).focus(); }, 300);
    }

    initPhaser();

    // Start ambient music on first user interaction (AudioContext policy)
    const startMusicOnce = () => { startAmbientMusic(); document.removeEventListener("keydown", startMusicOnce); document.removeEventListener("click", startMusicOnce); };
    document.addEventListener("keydown", startMusicOnce);
    document.addEventListener("click", startMusicOnce);

    // AFK activity tracking — reset on any mouse/key event
    document.addEventListener("keydown", _recordActivity, { passive: true });
    document.addEventListener("mousemove", _recordActivity, { passive: true });
    document.addEventListener("click", _recordActivity, { passive: true });
    document.addEventListener("touchstart", _recordActivity, { passive: true });

    return () => {
      document.removeEventListener("keydown", startMusicOnce);
      document.removeEventListener("click", startMusicOnce);
      document.removeEventListener("keydown", _recordActivity);
      document.removeEventListener("mousemove", _recordActivity);
      document.removeEventListener("click", _recordActivity);
      document.removeEventListener("touchstart", _recordActivity);
      // keepalive: true ensures the request survives component unmount / page navigation
      fetch("/api/town", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "leave" }) }).catch(() => {});
      // Flush core stats on unmount — NOTE: inventory is managed by stash ops (saved immediately);
      // wins/quests_completed use incremental DB updates so we never flush those here.
      if (adventureStatsRef.current) {
        const { level, xp, hp, max_hp, base_attack } = adventureStatsRef.current;
        const cls = adventureStatsRef.current.class;
        fetch("/api/adventure", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "update-stats", patch: { level, xp, hp, max_hp, base_attack, class: cls } }) }).catch(() => {});
      }
      stopChaseMusic();
      stopAmbientMusic();
      if (tagTimerRef.current) clearInterval(tagTimerRef.current);
      if (gameRef.current) { (gameRef.current as import("phaser").Game).destroy(true); gameRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.body.style.overscrollBehavior = "none";
    return () => { document.body.style.overscrollBehavior = ""; };
  }, []);

  const sendChat = useCallback(() => {
    if (!chatInput.trim()) {
      openChat(false);
      // Return focus to game canvas so WASD works immediately
      setTimeout(() => { const c = containerRef.current?.querySelector("canvas"); if (c) (c as HTMLElement).focus(); }, 30);
      return;
    }
    const msg = chatInput.trim().slice(0, 60);
    pendingChatRef.current = msg;
    setChatInput(""); openChat(false);
    const pos = myPosRef.current;
    fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ x: Math.round(pos.x), y: Math.round(pos.y), direction: "down", chatMsg: msg }) }).catch(() => {});
    // Return focus to game canvas so WASD works immediately after chatting
    setTimeout(() => { const c = containerRef.current?.querySelector("canvas"); if (c) (c as HTMLElement).focus(); }, 30);
  }, [chatInput]);

  // ── Fortune fetch ────────────────────────────────────────────────────────────
  // ── Economy actions ───────────────────────────────────────────────────────────
  const ICE_CREAM_EMOJIS = new Set(["🍦", "🍧", "🍨"]);
  const FLOWER_EMOJIS = new Set(["🌸", "🌹", "💐", "🌷"]);

  async function buyItem(emoji: string, price: number) {
    if (buyingItem) return;
    setBuyingItem(emoji);
    try {
      const r = await fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "buy", emoji, price }) });
      const d = await r.json();
      if (d.ok) {
        setMyCoins(d.coins);
        setMyEquippedItem(emoji);
        myEquippedItemRef.current = emoji;
        equippedItemsRef.current.set(userId, emoji);
        // Sound effects
        if (ICE_CREAM_EMOJIS.has(emoji)) {
          playSlurpSound();
          // Track brain freeze
          const now = Date.now();
          iceCreamTimestampsRef.current = iceCreamTimestampsRef.current.filter(t => now - t < 10000);
          iceCreamTimestampsRef.current.push(now);
          if (iceCreamTimestampsRef.current.length >= 3) {
            iceCreamTimestampsRef.current = [];
            triggerBrainFreeze();
          }
        }
      } else {
        setTagMsg(`💸 Not enough coins! (${d.error})`);
        setTimeout(() => setTagMsg(null), 2500);
      }
    } catch { /* ignore */ }
    setBuyingItem(null);
  }

  async function handleBuyShopItem(emoji: string, name: string, price: number) {
    if (buyingItem) return;
    setBuyingItem(emoji);
    try {
      const r = await fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "buy-fun-item", emoji, name, price }) });
      const d = await r.json();
      if (d.ok || d.coins !== undefined) {
        const newCoins = d.coins ?? myCoins - price;
        setMyCoins(newCoins);
        myCoinsRef.current = newCoins;
        // Determine funType from name
        const n = name.toLowerCase();
        const funType = (n.includes("ice") || n.includes("cream") || n.includes("serve") || n.includes("shaved")) ? "ice_cream"
          : (n.includes("rose") || n.includes("flower") || n.includes("blossom") || n.includes("tulip") || n.includes("bouquet")) ? "rose"
          : "other";
        const funItm: FunItem = { id: `fun_${Date.now()}`, emoji, name, funType };
        const newInv = [...(stashDataRef.current?.inventory ?? []), { ...funItm, slot: "fun", effects: [], obtained: "Shop" }];
        const newSD = { ...(stashDataRef.current ?? { stash_items: [], equipped_slots: {}, level: 1 }), inventory: newInv };
        setStashData(newSD);
        stashDataRef.current = newSD;
        if (adventureStatsRef.current) adventureStatsRef.current = { ...adventureStatsRef.current, inventory: newInv };
        markDirty();
        // Sound effects
        if (ICE_CREAM_EMOJIS.has(emoji)) {
          playSlurpSound();
          const now = Date.now();
          iceCreamTimestampsRef.current = iceCreamTimestampsRef.current.filter(t => now - t < 10000);
          iceCreamTimestampsRef.current.push(now);
          if (iceCreamTimestampsRef.current.length >= 3) {
            iceCreamTimestampsRef.current = [];
            triggerBrainFreeze();
          }
        }
      } else {
        setTagMsg(`💸 Not enough coins! (${d.error})`);
        setTimeout(() => setTagMsg(null), 2500);
      }
    } catch { /* ignore */ }
    setBuyingItem(null);
  }

  function consumeFunItem(item: { id: string; emoji: string; name: string; funType?: string; slot?: string }) {
    const n = item.name.toLowerCase();
    const funType = item.funType ?? ((n.includes("ice") || n.includes("cream")) ? "ice_cream"
      : (n.includes("rose") || n.includes("flower")) ? "rose" : "other");

    // Remove from inventory
    const newInv = (stashDataRef.current?.inventory ?? []).filter((i: unknown) => (i as { id: string }).id !== item.id);
    const newSD = { ...(stashDataRef.current ?? { stash_items: [], equipped_slots: {}, level: 1 }), inventory: newInv };
    setStashData(newSD);
    stashDataRef.current = newSD;
    if (adventureStatsRef.current) adventureStatsRef.current = { ...adventureStatsRef.current, inventory: newInv };

    // Also clear fun slot if this was the fun item
    if (funItem?.id === item.id) { setFunItem(null); funItemRef.current = null; }

    // Effects
    const pos = myPosRef.current;
    if (funType === "ice_cream") {
      const brainFreeze = Math.random() < 0.5;
      if (brainFreeze) {
        setBrainFreezeActive(true);
        if (brainFreezeTimerRef.current) clearTimeout(brainFreezeTimerRef.current);
        brainFreezeTimerRef.current = setTimeout(() => setBrainFreezeActive(false), 8000);
        pendingChatRef.current = "🧊 Brain freeze!!";
        fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ x: Math.round(pos.x), y: Math.round(pos.y), direction: "down", chatMsg: "🧊 Brain freeze!!" }) }).catch(() => {});
      } else {
        pendingChatRef.current = "🍦 Mmm, yummy!";
        fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ x: Math.round(pos.x), y: Math.round(pos.y), direction: "down", chatMsg: "🍦 Mmm, yummy!" }) }).catch(() => {});
      }
    } else if (funType === "rose") {
      pendingChatRef.current = "🌹 Put it in a vase!";
      fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x: Math.round(pos.x), y: Math.round(pos.y), direction: "down", chatMsg: "🌹 Put it in a vase!" }) }).catch(() => {});
    } else {
      pendingChatRef.current = `✨ Used ${item.name}!`;
      fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x: Math.round(pos.x), y: Math.round(pos.y), direction: "down", chatMsg: `✨ Used ${item.name}!` }) }).catch(() => {});
    }
    markDirty();
  }

  async function unequipItem() {
    await fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unequip" }) }).catch(() => {});
    setMyEquippedItem(null);
    myEquippedItemRef.current = null;
    equippedItemsRef.current.set(userId, null);
  }

  async function giveItem(toId: string, toUsername: string) {
    if (givingTo) return;
    setGivingTo(toId);
    try {
      const r = await fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "give", toId }) });
      const d = await r.json();
      if (d.ok) {
        if (myEquippedItem && FLOWER_EMOJIS.has(myEquippedItem)) playAwwwSound();
        setMyEquippedItem(null);
        myEquippedItemRef.current = null;
        equippedItemsRef.current.set(userId, null);
        setTagMsg(`🎁 You gave ${d.item} to @${toUsername}! How sweet! 💕`);
        setTimeout(() => setTagMsg(null), 3500);
      } else {
        setTagMsg(`❌ ${d.error}`);
        setTimeout(() => setTagMsg(null), 2000);
      }
    } catch { /* ignore */ }
    setGivingTo(null);
  }

  async function fetchFortune() {
    if (fortuneLoading) return;
    setFortuneLoading(true); setFortune(null);
    try {
      const r = await fetch("/api/fortune", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }) });
      const d = await r.json();
      setFortune(d.fortune || "The spirits are silent today… try again.");
    } catch { setFortune("The crystal ball has gone dark. The spirits are unavailable — try again, mortal."); }
    setFortuneLoading(false);
  }

  const isIt = tagItId === userId;

  const loadMsg = loadPercent < 20 ? "Loading your stats…"
    : loadPercent < 40 ? "Restoring inventory…"
    : loadPercent < 60 ? "Fetching stash…"
    : loadPercent < 78 ? "Restoring equipped items…"
    : "Connecting to town…";

  return (
    <div style={{
      position: isTouchDevice ? "fixed" : "relative",
      inset: isTouchDevice ? 0 : undefined,
      zIndex: isTouchDevice ? 9999 : undefined,
      width: "100%",
      height: isTouchDevice ? "100dvh" : "calc(100vh - 52px)",
      background: "#0d1117", overflow: "hidden",
    }}>

      {/* ── Town Loading Screen ─────────────────────────────────────────────── */}
      {townLoading && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 99999,
          background: "linear-gradient(160deg, #060a0e 0%, #08060f 100%)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 0,
        }}>
          {/* Kingdom crest */}
          <div style={{ fontSize: 52, marginBottom: 16, filter: "drop-shadow(0 0 24px rgba(80,220,80,0.4))" }}>⚔️</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#88ff99", fontFamily: "monospace", letterSpacing: 3, marginBottom: 4 }}>
            KINGDOM OF FLOCK
          </div>
          <div style={{ fontSize: 11, color: "rgba(100,200,100,0.4)", fontFamily: "monospace", marginBottom: 36 }}>
            Preparing your adventure…
          </div>

          {/* Green progress bar */}
          <div style={{ width: 280, height: 6, background: "rgba(255,255,255,0.07)", borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
            <div style={{
              height: "100%",
              width: `${loadPercent}%`,
              background: "linear-gradient(90deg, #1a8a30, #44ff77)",
              borderRadius: 3,
              transition: "width 0.15s ease-out",
              boxShadow: "0 0 10px rgba(60,255,100,0.5)",
            }} />
          </div>

          {/* Loading message */}
          <div style={{ fontSize: 10, color: "rgba(100,200,100,0.55)", fontFamily: "monospace", height: 14 }}>
            {loadMsg}
          </div>

          {/* Subtle dots */}
          <div style={{ marginTop: 40, display: "flex", gap: 6 }}>
            {[0, 1, 2].map(n => (
              <div key={n} style={{
                width: 5, height: 5, borderRadius: "50%",
                background: `rgba(60,255,100,${loadPercent > n * 30 ? "0.7" : "0.15"})`,
                transition: "background 0.3s",
              }} />
            ))}
          </div>
        </div>
      )}

      <div ref={containerRef} style={{ width: "100%", height: "100%", cursor: abilityTargetMode ? "crosshair" : undefined, overscrollBehavior: "none", touchAction: "none" }}
        onClick={() => { const c = containerRef.current?.querySelector("canvas"); if (c) (c as HTMLElement).focus(); }} />

      {/* ── Left Action Bar (hidden inside theater — theater has its own) ───── */}
      {!theaterOpen && (() => {
        type ActionSlot = { key: string; emoji: string; name: string; ability: string | null; rarity: string; consumable: boolean; cdExpiry: number };
        const slots: ActionSlot[] = [];
        const sd = stashData;

        // Secondary slot (frog wand, off-hand ability items)
        const sec = sd?.equipped_slots?.secondary as { emoji?: string; name?: string; ability?: string; rarity?: string; consumable?: boolean } | null;
        if (sec?.emoji) slots.push({ key: "secondary", emoji: sec.emoji, name: sec.name ?? "Item", ability: sec.ability ?? null, rarity: sec.rarity ?? "common", consumable: !!sec.consumable, cdExpiry: sec.ability === "frog_hex" ? frogCooldownExpiry : 0 });

        // Held shop item (flowers, ice cream, cupcakes, etc.) — skip if already shown as an equipped slot
        if (myEquippedItem && !slots.some(s => s.emoji === myEquippedItem)) slots.push({ key: "held", emoji: myEquippedItem, name: myEquippedItem, ability: null, rarity: "common", consumable: true, cdExpiry: 0 });

        // Helm if it has an ability
        const helm = sd?.equipped_slots?.helm as { emoji?: string; name?: string; ability?: string; rarity?: string } | null;
        if (helm?.ability && helm.emoji) slots.push({ key: "helm", emoji: helm.emoji, name: helm.name ?? "Helm", ability: helm.ability, rarity: helm.rarity ?? "common", consumable: false, cdExpiry: 0 });

        // Weapon if it has an ability
        const wpn = sd?.equipped_slots?.weapon as { emoji?: string; name?: string; ability?: string; rarity?: string } | null;
        if (wpn?.ability && wpn.emoji) slots.push({ key: "weapon-ability", emoji: wpn.emoji, name: wpn.name ?? "Weapon", ability: wpn.ability, rarity: wpn.rarity ?? "common", consumable: false, cdExpiry: 0 });

        if (slots.length === 0) return null;

        const RARITY_COLOR: Record<string, string> = { legendary: "#ffd700", epic: "#cc44ff", rare: "#4488ff", uncommon: "#44cc66", common: "#666" };

        return (
          <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 10, zIndex: 200, pointerEvents: "all" }}>
            {slots.slice(0, 4).map(slot => {
              const onCd = slot.cdExpiry > Date.now();
              const cdSec = onCd ? Math.ceil((slot.cdExpiry - Date.now()) / 1000) : 0;
              const isActive = abilityTargetMode?.itemEmoji === slot.emoji;
              const border = RARITY_COLOR[slot.rarity] ?? "#666";
              return (
                <button
                  key={slot.key}
                  onClick={() => {
                    playActionSlotSound(!isActive && !onCd);
                    if (onCd) return;
                    if (isActive) { setAbilityTargetMode(null); abilityTargetModeRef.current = null; return; }
                    const mode: AbilityTargetMode = { ability: slot.ability, itemEmoji: slot.emoji, itemName: slot.name, consumable: slot.consumable };
                    setAbilityTargetMode(mode); abilityTargetModeRef.current = mode;
                  }}
                  style={{
                    width: 68, height: 68,
                    background: isActive ? "rgba(0,255,140,0.18)" : onCd ? "rgba(30,30,30,0.85)" : "rgba(10,10,20,0.82)",
                    border: `2px solid ${isActive ? "#00ff88" : onCd ? "#333" : border}`,
                    borderRadius: 14,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    cursor: onCd ? "default" : "pointer",
                    fontSize: 30,
                    boxShadow: isActive ? `0 0 18px ${border}, 0 0 6px rgba(0,255,140,0.5)` : `0 2px 10px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)`,
                    backdropFilter: "blur(8px)",
                    outline: "none",
                    position: "relative",
                    transition: "transform 0.07s, box-shadow 0.1s",
                    userSelect: "none",
                  }}
                  onMouseDown={e => (e.currentTarget.style.transform = "scale(0.90)")}
                  onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")}
                  onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
                >
                  <span style={{ opacity: onCd ? 0.35 : 1 }}>{slot.emoji}</span>
                  {onCd && <span style={{ position: "absolute", bottom: 5, fontSize: 9, color: "#888", fontFamily: "monospace", fontWeight: 700 }}>⏳{cdSec}s</span>}
                  {isActive && <span style={{ position: "absolute", bottom: 5, fontSize: 8, color: "#00ff88", fontFamily: "monospace", fontWeight: 800 }}>AIM</span>}
                  {slot.key === "held" && (
                    <span
                      onClick={e => { e.stopPropagation(); unequipItem(); }}
                      style={{ position: "absolute", top: 3, right: 5, fontSize: 10, color: "rgba(255,255,255,0.3)", cursor: "pointer", lineHeight: 1, fontWeight: 700 }}
                    >✕</span>
                  )}
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* ── Brain Freeze Overlay ─────────────────────────────────────────────── */}
      {brainFreezeActive && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 9000, pointerEvents: "none",
          background: "radial-gradient(ellipse at center, rgba(100,180,255,0.35) 0%, rgba(0,80,200,0.2) 60%, transparent 100%)",
          animation: "brainFreezeIn 0.4s ease-out",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ fontSize: 52, marginBottom: 8, filter: "drop-shadow(0 0 12px #88ccff)" }}>🧊</div>
          <div style={{ fontSize: 18, color: "#c8eeff", fontWeight: 900, textShadow: "0 0 12px #4499ff", fontFamily: "monospace", letterSpacing: 2 }}>BRAIN FREEZE!!</div>
          <div style={{ fontSize: 11, color: "rgba(180,220,255,0.7)", marginTop: 6, fontFamily: "monospace" }}>3 ice creams… really?</div>
        </div>
      )}
      <style>{`@keyframes brainFreezeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>

      {/* Mobile exit button — always visible on touch devices */}
      {isTouchDevice && (
        <a href="/feed" style={{
          position: "absolute", top: "max(env(safe-area-inset-top, 0px), 12px)", left: 12,
          background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.18)", borderRadius: 20,
          padding: "6px 14px", color: "#fff", fontSize: 13, fontWeight: 700,
          textDecoration: "none", zIndex: 200, display: "flex", alignItems: "center", gap: 6,
          boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
        }}>← Exit</a>
      )}

      {/* HUD top-left */}
      <div style={{ position: "absolute", top: 12, left: isTouchDevice ? 80 : 12, display: "flex", flexDirection: "column", gap: 6, pointerEvents: "none", zIndex: 150 }}>
        <div style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8, pointerEvents: "all", flexWrap: isTouchDevice ? "nowrap" : "wrap" }}>
          <span style={{ fontSize: 17 }}>🏘️</span>
          <span style={{ fontSize: 13, color: "#fff", fontWeight: 700 }}>Town Square</span>
          <span style={{ fontSize: isTouchDevice ? 10 : 11, color: "rgba(255,255,255,0.45)", marginLeft: 2 }}>👥 {playerCount}</span>
          <span style={{ fontSize: isTouchDevice ? 10 : 11, color: "#ffd700", fontWeight: 800, marginLeft: 4 }}>🪙 {myCoins}</span>

          {/* Adventure stats */}
          {adventureStats && (
            <span
              onClick={() => openCaptainDialog()}
              style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,200,50,0.12)", border: "1px solid rgba(255,200,50,0.3)", borderRadius: 8, padding: "2px 8px", cursor: "pointer" }}
              title="Open adventure"
            >
              <span style={{ fontSize: 12 }}>{adventureStats.class ? (adventureStats.class === "warrior" ? "⚔️" : adventureStats.class === "mage" ? "🪄" : adventureStats.class === "archer" ? "🏹" : "🗡️") : "⚔️"}</span>
              <span style={{ fontSize: 11, color: "#ffd700", fontWeight: 700 }}>Lv {adventureStats.level}</span>
              <span style={{ fontSize: 11, color: "#ff8888" }}>❤️ {adventureStats.hp}/{adventureStats.max_hp}</span>
            </span>
          )}
          {adventureMinimized && (
            <span
              onClick={() => { setAdventureOverlayOpen(true); setAdventureMinimized(null); }}
              style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,150,50,0.15)", border: "1px solid rgba(255,150,50,0.4)", borderRadius: 8, padding: "2px 8px", cursor: "pointer", animation: "pulse 1.5s infinite" }}
            >
              <span style={{ fontSize: 11, color: "#ffaa44", fontWeight: 700 }}>⚔️ Resume Adventure</span>
            </span>
          )}

          {/* Inventory / Character Panel button */}
          <button
            onClick={() => { if (showStashRef.current) return; showInventoryRef.current = !showInventory; setShowInventory(!showInventory); if (!showInventory) loadStashData(); }}
            title="Character / Inventory (C)"
            style={{ background: showInventory ? "rgba(120,90,255,0.3)" : "rgba(120,90,255,0.12)", border: `1px solid rgba(120,90,255,${showInventory ? "0.6" : "0.3"})`, borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#aa88ff", cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}
          >🎒</button>

          {/* Start Tag (only if not active and others nearby) */}
          {nearbyPlayers.length > 0 && !tagGameActive && !tagItId && (
            <button onClick={startTag} style={{ background: "rgba(255,80,80,0.2)", border: "1px solid rgba(255,80,80,0.4)", borderRadius: 8, padding: "4px 11px", fontSize: 11, color: "#ff8080", cursor: "pointer", fontWeight: 700 }}>
              🏃 Tag
            </button>
          )}

          {/* Tag timer */}
          {tagGameActive && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: tagTimeLeft <= 10 ? "#ff4444" : "#ffcc44", fontWeight: 800, fontFamily: "monospace" }}>
                ⏱ {tagTimeLeft}s
              </span>
              {isIt && <span style={{ fontSize: 11, color: "#ff4444", fontWeight: 800, animation: "pulse 0.8s infinite" }}>🔴 IT!</span>}
            </div>
          )}
        </div>

        {!isTouchDevice && (
          <div style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "5px 10px", fontSize: 11, color: "rgba(255,255,255,0.4)", pointerEvents: "none" }}>
            WASD/↑↓←→ move · T chat · Click buildings{isIt ? " · Click player to TAG!" : ""}
            {tagGameActive ? " · 🏃 SPEED BOOST ACTIVE" : ""}
          </div>
        )}
      </div>

      {/* ── Active Town Event Banner / Boss Fight HUD ─────────────────────── */}
      {activeEvent && !isDead && dismissedEventId !== activeEvent.id && (
        <div style={{
          position: "absolute", top: 60, left: "50%", transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.92)",
          border: `2px solid ${activeEvent.type === "dragon_attack" ? "#ff4444" : activeEvent.type === "bandit_raid" ? "#ff8800" : activeEvent.type === "festival" ? "#ffd700" : "#44aaff"}`,
          borderRadius: 14, padding: "10px 20px",
          display: "flex", flexDirection: "column", gap: 8, alignItems: "stretch",
          zIndex: 80, pointerEvents: "all",
          boxShadow: "0 0 30px rgba(255,68,68,0.4)",
          animation: "pulse 1.5s infinite",
          fontFamily: "monospace", minWidth: 340,
        }}>
          {/* Close button */}
          <button onClick={() => setDismissedEventId(activeEvent.id as string)}
            style={{ position: "absolute", top: 6, right: 8, background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 16, cursor: "pointer", lineHeight: 1, padding: 0 }}>✕</button>
          {/* Title row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
            <span style={{ fontSize: 22 }}>
              {activeEvent.type === "dragon_attack" ? "🐉" : activeEvent.type === "bandit_raid" ? "🗡️" : activeEvent.type === "festival" ? "🎉" : "🛒"}
            </span>
            <span style={{ fontSize: 14, color: "#ff6644", fontWeight: 700, letterSpacing: 1 }}>
              {activeEvent.type === "dragon_attack" ? "DRAGON ATTACK!" : activeEvent.type === "bandit_raid"
                ? `BANDITS ATTACKING ${((activeEvent.state?.location as string) ?? "the Village").toUpperCase()}!`
                : activeEvent.type === "festival" ? "FESTIVAL!" : "MERCHANT VISIT"}
            </span>
          </div>

          {/* Enemy HP bar — dragon or bandits */}
          {(activeEvent.type === "dragon_attack" || activeEvent.type === "bandit_raid") && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#aaa", marginBottom: 3 }}>
                <span>{activeEvent.type === "dragon_attack" ? "🐉 Dragon HP" : "⚔️ Bandit HP"}</span>
                <span style={{ color: "#ff6644" }}>{(activeEvent.state?.bossHp as number) ?? (activeEvent.type === "bandit_raid" ? 600 : 1500)} / {(activeEvent.state?.bossMaxHp as number) ?? (activeEvent.type === "bandit_raid" ? 600 : 1500)}</span>
              </div>
              <div style={{ height: 10, background: "#330000", borderRadius: 5, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 5, transition: "width 0.4s",
                  width: `${Math.max(0, Math.min(100, (((activeEvent.state?.bossHp as number) ?? (activeEvent.type === "bandit_raid" ? 600 : 1500)) / ((activeEvent.state?.bossMaxHp as number) || (activeEvent.type === "bandit_raid" ? 600 : 1500))) * 100))}%`,
                  background: activeEvent.type === "bandit_raid" ? "linear-gradient(90deg, #cc33cc, #ff6633)" : "linear-gradient(90deg, #ff2200, #ff6600)",
                }} />
              </div>
            </div>
          )}

          {/* Player HP bar — combat events */}
          {(activeEvent.type === "dragon_attack" || activeEvent.type === "bandit_raid") && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#aaa", marginBottom: 3 }}>
                <span>❤️ Your HP</span>
                <span style={{ color: townHp <= 30 ? "#ff4444" : "#88ff88" }}>{townHp} / 100</span>
              </div>
              <div style={{ height: 8, background: "#003300", borderRadius: 4, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 4, transition: "width 0.3s",
                  width: `${townHp}%`,
                  background: townHp <= 30 ? "linear-gradient(90deg, #ff2200, #ff4400)" : "linear-gradient(90deg, #22aa22, #44dd44)",
                }} />
              </div>
            </div>
          )}

          {/* NPC defenders / performers row */}
          {activeEvent.type === "dragon_attack" && (
            <div style={{ display: "flex", gap: 6, fontSize: 11, color: "#aaa", justifyContent: "center" }}>
              <span title="Capt. Aldric — Sword">⚔️</span>
              <span title="Town Guards — Shield">🛡️🛡️</span>
              <span title="Marcus — Ice Cream">🍦</span>
              <span title="Old Pete — Horse Charge">🐴</span>
              <span style={{ fontSize: 9, color: "#666" }}>NPCs defending!</span>
            </div>
          )}
          {activeEvent.type === "bandit_raid" && (
            <div style={{ display: "flex", gap: 6, fontSize: 11, color: "#aaa", justifyContent: "center" }}>
              <span title="Cutpurse">🗡️</span>
              <span title="Shadowblade">🥷</span>
              <span title="Ironclub">🪓</span>
              <span style={{ fontSize: 9, color: "#ff9966" }}>3 bandits attacking!</span>
            </div>
          )}
          {activeEvent.type === "festival" && (
            <div style={{ display: "flex", gap: 6, fontSize: 11, color: "#ffd700", justifyContent: "center" }}>
              <span>🎭</span><span>🥁</span><span>🎶</span><span>🎪</span>
              <span style={{ fontSize: 9, color: "#ffcc44" }}>+50% XP active!</span>
            </div>
          )}
          {activeEvent.type === "merchant_visit" && (
            <div style={{ fontSize: 10, color: "#ffd700", textAlign: "center" }}>
              🛒 Wares at 50% discount! Find the merchant on the map!
            </div>
          )}

          {/* Action buttons — full combat bar for battle events */}
          {(activeEvent.type === "dragon_attack" || activeEvent.type === "bandit_raid") ? (
            <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                onClick={() => handleEventAction("fight")}
                disabled={eventActionPending}
                style={{ flex: 1, minWidth: 72, background: "rgba(255,80,80,0.2)", border: "1px solid rgba(255,80,80,0.5)", borderRadius: 10, padding: "8px 6px", fontSize: 13, color: "#ff8888", cursor: eventActionPending ? "not-allowed" : "pointer", fontWeight: 700, opacity: eventActionPending ? 0.5 : 1 }}
              >⚔️ Attack</button>
              <button
                onClick={() => handleEventAction("special")}
                disabled={eventActionPending || eventSpecialCooldown > 0}
                style={{ flex: 1, minWidth: 72, background: eventSpecialCooldown > 0 ? "rgba(100,100,100,0.1)" : "rgba(168,85,247,0.2)", border: `1px solid ${eventSpecialCooldown > 0 ? "rgba(100,100,100,0.3)" : "rgba(168,85,247,0.5)"}`, borderRadius: 10, padding: "8px 6px", fontSize: 13, color: eventSpecialCooldown > 0 ? "rgba(255,255,255,0.3)" : "#c084fc", cursor: (eventActionPending || eventSpecialCooldown > 0) ? "not-allowed" : "pointer", fontWeight: 700 }}
              >✨ {eventSpecialCooldown > 0 ? `(${eventSpecialCooldown})` : "Special"}</button>
              <button
                onClick={() => handleEventAction("potion")}
                disabled={eventActionPending || eventPotions <= 0}
                style={{ flex: 1, minWidth: 72, background: eventPotions <= 0 ? "rgba(100,100,100,0.1)" : "rgba(80,255,120,0.15)", border: `1px solid ${eventPotions <= 0 ? "rgba(100,100,100,0.3)" : "rgba(80,255,120,0.4)"}`, borderRadius: 10, padding: "8px 6px", fontSize: 13, color: eventPotions <= 0 ? "rgba(255,255,255,0.3)" : "#80ff99", cursor: (eventActionPending || eventPotions <= 0) ? "not-allowed" : "pointer", fontWeight: 700 }}
              >🧪 Potion ({eventPotions})</button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              {activeEvent.type === "festival" && (
                <button onClick={() => handleEventAction("flee")} style={{ background: "rgba(255,215,0,0.2)", border: "1px solid rgba(255,215,0,0.5)", color: "#ffd700", padding: "5px 16px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>🎊 Join Festival!</button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Death Screen ──────────────────────────────────────────────────── */}
      {isDead && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 9000,
          background: "rgba(0,0,0,0.85)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          fontFamily: "monospace", color: "#ff4444",
          animation: "fadeIn 0.3s ease",
        }}>
          <div style={{ fontSize: 64 }}>💀</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 12 }}>YOU WERE SLAIN!</div>
          <div style={{ fontSize: 14, color: "#888", marginTop: 8 }}>Respawning at graveyard…</div>
          <div style={{ marginTop: 20, fontSize: 12, color: "#555" }}>⚰️ Graveyard awaits…</div>
        </div>
      )}

      {/* ── Victory Popup ─────────────────────────────────────────────────── */}
      {victoryData && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 9001,
          background: "rgba(0,0,0,0.8)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setVictoryData(null)}>
          <div style={{
            background: "linear-gradient(135deg, #1a1200, #2a1800, #1a0800)",
            border: "2px solid #ffd700",
            borderRadius: 16,
            padding: "28px 36px",
            textAlign: "center",
            fontFamily: "monospace",
            boxShadow: "0 0 60px rgba(255,215,0,0.5), 0 0 120px rgba(255,100,0,0.3)",
            maxWidth: 480, width: "90%",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 52, marginBottom: 8 }}>🏆</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#ffd700", letterSpacing: 2, marginBottom: 4 }}>
              VICTORY!
            </div>
            <div style={{ fontSize: 14, color: "#ff9944", marginBottom: 16 }}>
              {victoryData.eventType === "dragon_attack" ? "The Dragon has been defeated!" : "Event Complete!"}
              {victoryData.participants > 0 && ` — ${victoryData.participants} hero${victoryData.participants !== 1 ? "es" : ""} fought`}
            </div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>+250 XP awarded</div>

            {victoryData.loot.length > 0 && (
              <>
                <div style={{ fontSize: 13, color: "#aaa", marginBottom: 10 }}>✨ Your Loot (added to stash):</div>
                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 16 }}>
                  {(victoryData.loot as { emoji: string; name: string; rarity: string }[]).map((item, i) => {
                    const colors: Record<string, string> = { common: "#aaa", uncommon: "#4caf50", rare: "#2196f3", epic: "#9c27b0", legendary: "#ffd700" };
                    return (
                      <div key={i} style={{
                        border: `2px solid ${colors[item.rarity] ?? "#888"}`,
                        borderRadius: 8, padding: "8px 12px",
                        background: "rgba(0,0,0,0.5)",
                        boxShadow: item.rarity === "legendary" ? `0 0 12px ${colors[item.rarity]}` : undefined,
                      }}>
                        <div style={{ fontSize: 28 }}>{item.emoji}</div>
                        <div style={{ fontSize: 10, color: colors[item.rarity], fontWeight: 700, marginTop: 4 }}>{item.name}</div>
                        <div style={{ fontSize: 9, color: "#666", textTransform: "uppercase" }}>{item.rarity}</div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {victoryData.loot.length === 0 && (
              <div style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>🗄️ Check your stash for loot!</div>
            )}

            <button
              onClick={() => {
                setVictoryData(null);
                // Refresh stash so loot appears (loadStashData preserves equipped_slots)
                loadStashData();
              }}
              style={{
                background: "rgba(255,215,0,0.25)", border: "2px solid #ffd700",
                color: "#ffd700", padding: "8px 28px", borderRadius: 10,
                cursor: "pointer", fontSize: 13, fontWeight: 700,
                boxShadow: "0 0 12px rgba(255,215,0,0.3)",
              }}
            >🎉 Claim Loot!</button>
          </div>
        </div>
      )}

      {/* ── Ground item pickup hint ─────────────────────────────────────────── */}
      {nearGroundItem && (
        <div style={{
          position: "absolute", bottom: 100, left: "50%", transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.85)", border: "1px solid rgba(255,215,0,0.5)",
          borderRadius: 10, padding: "7px 16px",
          fontSize: 12, color: "#ffd070", fontFamily: "monospace",
          pointerEvents: "none", zIndex: 80,
        }}>
          {nearGroundItem.item.emoji} Press P to pick up <strong>{nearGroundItem.item.name}</strong>
        </div>
      )}


      {/* ── Ability targeting mode overlay ───────────────────────────────────── */}
      {abilityTargetMode && (
        <div
          style={{ position: "absolute", top: 60, left: "50%", transform: "translateX(-50%)", zIndex: 200, pointerEvents: "all" }}
          onKeyDown={e => { if (e.key === "Escape") { setAbilityTargetMode(null); abilityTargetModeRef.current = null; } }}
        >
          <div style={{ background: "rgba(0,0,0,0.85)", border: "2px solid rgba(0,255,120,0.6)", borderRadius: 12, padding: "10px 20px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 0 20px rgba(0,255,100,0.3)" }}>
            <span style={{ fontSize: 28 }}>{abilityTargetMode.itemEmoji}</span>
            <span style={{ fontSize: 13, color: "#88ffbb", fontWeight: 700 }}>
              🎯 Click any target to use {abilityTargetMode.itemName}
            </span>
            <button
              onClick={() => { setAbilityTargetMode(null); abilityTargetModeRef.current = null; }}
              style={{ background: "rgba(255,80,80,0.2)", border: "1px solid rgba(255,80,80,0.4)", borderRadius: 6, padding: "3px 10px", color: "#ff8888", cursor: "pointer", fontSize: 12, fontWeight: 700 }}
            >✕ Cancel</button>
          </div>
        </div>
      )}

      {/* Tag / notification overlay */}
      {tagMsg && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "rgba(0,0,0,0.88)", border: `2px solid ${tagShareCaption ? "#4ad94a" : "#ff4444"}`, borderRadius: 16, padding: "16px 28px", fontSize: 16, fontWeight: 800, color: "#fff", textAlign: "center", pointerEvents: tagShareCaption ? "all" : "none", zIndex: 50, maxWidth: "80vw", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
          <span>{tagMsg}</span>
          {tagShareCaption && (
            <button onClick={() => {
              fetch("/api/shares", { method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "tag", title: "🏃 Town Tag Win!", caption: tagShareCaption }) }).catch(() => {});
              setTagMsg(null); setTagShareCaption(null);
            }} style={{ background: "rgba(74,217,120,0.2)", border: "1px solid rgba(74,217,120,0.5)", borderRadius: 10, padding: "7px 18px", fontSize: 13, color: "#4ad978", cursor: "pointer", fontWeight: 700 }}>
              📢 Share Victory
            </button>
          )}
          {tagShareCaption && (
            <button onClick={() => { setTagMsg(null); setTagShareCaption(null); }} style={{ background: "transparent", border: "none", fontSize: 11, color: "rgba(255,255,255,0.35)", cursor: "pointer" }}>dismiss</button>
          )}
        </div>
      )}

      {/* Nearby players */}
      {nearbyPlayers.length > 0 && (
        <div style={{ position: "absolute", bottom: chatOpen ? 80 : 20, right: 16, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(10px)", border: "1px solid rgba(124,92,191,0.3)", borderRadius: 14, padding: "10px 14px", minWidth: 190, maxWidth: 230 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Nearby · {nearbyPlayers.length}</div>
          {nearbyPlayers.map(p => (
            <div key={p.user_id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <img src={p.avatar_url || `https://api.dicebear.com/9.x/adventurer/svg?seed=${p.username}`} style={{ width: 28, height: 28, borderRadius: 4, border: "1px solid rgba(255,255,255,0.2)" }} alt={p.username} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link href={`/profile/${p.username}`} style={{ fontSize: 12, fontWeight: 700, color: "#c8aaff", textDecoration: "none" }}>@{p.username}</Link>
                {p.user_id === tagItId && <span style={{ fontSize: 10, color: "#ff4444", marginLeft: 4 }}>IT</span>}
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {isIt && (
                  <button onClick={() => tryTag(p.user_id, p.username)} style={{ background: "rgba(255,60,60,0.25)", border: "1px solid rgba(255,60,60,0.5)", borderRadius: 6, padding: "2px 6px", fontSize: 10, color: "#ff8080", cursor: "pointer", fontWeight: 700 }}>Tag!</button>
                )}
                {myEquippedItem && (
                  <button onClick={() => giveItem(p.user_id, p.username)} disabled={!!givingTo} style={{ background: "rgba(255,215,0,0.18)", border: "1px solid rgba(255,215,0,0.4)", borderRadius: 6, padding: "2px 6px", fontSize: 12, cursor: "pointer", fontWeight: 700, opacity: givingTo === p.user_id ? 0.6 : 1 }} title={`Give ${myEquippedItem} to @${p.username}`}>
                    {givingTo === p.user_id ? "…" : myEquippedItem}
                  </button>
                )}
                {funItem && p.user_id !== userId && (
                  <button
                    key={`give-fun-${p.user_id}`}
                    onClick={async () => {
                      const r = await fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "give-fun-item", toUserId: p.user_id, item: funItem }) });
                      const d = await r.json();
                      if (d.ok) {
                        setFunItem(null); funItemRef.current = null;
                        setMyEquippedItem(null); myEquippedItemRef.current = null;
                        markDirty();
                      }
                    }}
                    style={{ background: "rgba(255,200,50,0.15)", border: "1px solid rgba(255,200,50,0.4)", color: "#ffd700", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 11 }}
                    title={`Give ${funItem.emoji} to @${p.username}`}
                  >🎁 {funItem.emoji}</button>
                )}
                {!rpsGame && (
                  <button onClick={() => sendRpsChallenge(p.user_id, p.username)} style={{ background: "rgba(80,200,255,0.18)", border: "1px solid rgba(80,200,255,0.4)", borderRadius: 6, padding: "2px 6px", fontSize: 10, color: "#7de8ff", cursor: "pointer", fontWeight: 700 }}>✂️</button>
                )}
                {/* Party adventure invite */}
                {!adventureOverlayOpen && !caveOpen && (
                  <button
                    onClick={() => sendPartyInvite(p.user_id, p.username)}
                    disabled={sendingInviteTo === p.user_id}
                    title={`Invite @${p.username} on a party adventure`}
                    style={{ background: "rgba(255,180,40,0.18)", border: "1px solid rgba(255,180,40,0.45)", borderRadius: 6, padding: "2px 6px", fontSize: 10, color: "#ffd070", cursor: "pointer", fontWeight: 700, opacity: sendingInviteTo === p.user_id ? 0.5 : 1 }}
                  >{sendingInviteTo === p.user_id ? "…" : "⚔️"}</button>
                )}
                <Link href={`/messages?with=${p.user_id}`} style={{ fontSize: 14, textDecoration: "none" }}>💬</Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── RPS Overlay ─────────────────────────────────────────────── */}
      {rpsGame && rpsGame.status !== "done" && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)", zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "linear-gradient(145deg, #1a1030, #0d1a2e)", border: "2px solid rgba(120,200,255,0.35)", borderRadius: 24, padding: "32px 40px", minWidth: 320, maxWidth: 420, textAlign: "center", boxShadow: "0 0 60px rgba(80,180,255,0.2)" }}>

            {/* PENDING — challenger waiting */}
            {rpsGame.status === "pending" && rpsGame.challenger_id === userId && (
              <>
                <div style={{ fontSize: 44, marginBottom: 12 }}>✂️🪨📄</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Challenge sent!</div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 24 }}>Waiting for <b style={{ color: "#7de8ff" }}>@{rpsGame.opponent_name}</b> to accept…</div>
                <button onClick={declineRpsChallenge} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, padding: "9px 24px", fontSize: 13, color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>Cancel</button>
              </>
            )}

            {/* PENDING — opponent sees challenge */}
            {rpsGame.status === "pending" && rpsGame.opponent_id === userId && (
              <>
                <div style={{ fontSize: 44, marginBottom: 12 }}>⚔️</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Rock Paper Scissors!</div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 24 }}><b style={{ color: "#ffcc55" }}>@{rpsGame.challenger_name}</b> challenged you!</div>
                <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                  <button onClick={acceptRpsChallenge} style={{ background: "linear-gradient(135deg, #2d9aff, #7b4fff)", border: "none", borderRadius: 12, padding: "11px 28px", fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer" }}>Accept ✊</button>
                  <button onClick={declineRpsChallenge} style={{ background: "rgba(255,80,80,0.15)", border: "1px solid rgba(255,80,80,0.35)", borderRadius: 12, padding: "11px 20px", fontSize: 14, color: "#ff8080", cursor: "pointer" }}>Decline</button>
                </div>
              </>
            )}

            {/* CHOOSING */}
            {rpsGame.status === "choosing" && (
              <>
                <div style={{ fontSize: 36, fontWeight: 900, color: rpsCountdown <= 1 ? "#ff6644" : "#7de8ff", marginBottom: 8, fontFamily: "monospace", transition: "color 0.3s" }}>{rpsCountdown > 0 ? rpsCountdown : "GO!"}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 6 }}>vs <span style={{ color: "#ffcc55" }}>@{rpsGame.challenger_id === userId ? rpsGame.opponent_name : rpsGame.challenger_name}</span></div>
                {!rpsMyChoice ? (
                  <>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 20 }}>Choose your throw!</div>
                    <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
                      {(["rock", "paper", "scissors"] as const).map(c => (
                        <button key={c} onClick={() => makeRpsChoice(c)} style={{ background: "rgba(255,255,255,0.07)", border: "2px solid rgba(255,255,255,0.15)", borderRadius: 16, padding: "16px 18px", fontSize: 36, cursor: "pointer", transition: "all 0.15s", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(120,200,255,0.18)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(120,200,255,0.6)"; (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.12)"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.15)"; (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}>
                          {RPS_EMOJI[c]}
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "capitalize", marginTop: 2 }}>{c}</span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 52 }}>{RPS_EMOJI[rpsMyChoice]}</div>
                    <div style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginTop: 8 }}>Waiting for opponent… 🤫</div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* RPS Result overlay */}
      {rpsGame?.status === "done" && (() => {
        const myChoice = rpsGame.challenger_id === userId ? rpsGame.challenger_choice : rpsGame.opponent_choice;
        const theirChoice = rpsGame.challenger_id === userId ? rpsGame.opponent_choice : rpsGame.challenger_choice;
        const oppName = rpsGame.challenger_id === userId ? rpsGame.opponent_name : rpsGame.challenger_name;
        const isTie = !rpsGame.winner_id;
        const iWon = rpsGame.winner_id === userId;
        return (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: iWon ? "linear-gradient(145deg,#1a2a10,#0a2010)" : isTie ? "linear-gradient(145deg,#1a1a30,#0d1020)" : "linear-gradient(145deg,#2a1010,#1a0808)", border: `2px solid ${iWon ? "rgba(100,255,120,0.45)" : isTie ? "rgba(120,200,255,0.35)" : "rgba(255,100,80,0.4)"}`, borderRadius: 24, padding: "36px 48px", textAlign: "center", boxShadow: `0 0 80px ${iWon ? "rgba(100,255,120,0.15)" : isTie ? "rgba(80,180,255,0.12)" : "rgba(255,80,60,0.15)"}` }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: iWon ? "#6aff88" : isTie ? "#7de8ff" : "#ff7055", marginBottom: 10, letterSpacing: 1 }}>
                {isTie ? "🤝 TIE!" : iWon ? "🏆 YOU WIN!" : "😅 YOU LOSE"}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, margin: "18px 0" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 52 }}>{RPS_EMOJI[myChoice ?? ""] ?? "❓"}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>You</div>
                </div>
                <div style={{ fontSize: 22, color: "rgba(255,255,255,0.3)", fontWeight: 900 }}>vs</div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 52 }}>{RPS_EMOJI[theirChoice ?? ""] ?? "❓"}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>@{oppName}</div>
                </div>
              </div>
              {!isTie && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 14 }}>{iWon ? `${RPS_EMOJI[myChoice ?? ""]} beats ${RPS_EMOJI[theirChoice ?? ""]}` : `${RPS_EMOJI[theirChoice ?? ""]} beats ${RPS_EMOJI[myChoice ?? ""]}`}</div>}
              <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 4 }}>
                <button onClick={() => { setRpsGame(null); setRpsMyChoice(null); }} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 12, padding: "9px 24px", fontSize: 13, color: "#fff", cursor: "pointer" }}>Close</button>
                {(iWon || isTie) && (
                  <button onClick={() => {
                    const caption = isTie
                      ? `🤝 @${username} and @${oppName} tied at Rock Paper Scissors in Town Square!`
                      : `🏆 @${username} beat @${oppName} at Rock Paper Scissors! ${RPS_EMOJI[myChoice ?? ""]} beats ${RPS_EMOJI[theirChoice ?? ""]}`;
                    fetch("/api/shares", { method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ type: "game_win", title: "✂️ Rock Paper Scissors", caption,
                        game_data: { game: "rps", result: isTie ? "Tie!" : "Victory!", opponent: oppName } }) }).catch(() => {});
                    setRpsGame(null); setRpsMyChoice(null);
                  }} style={{ background: "rgba(100,200,100,0.15)", border: "1px solid rgba(100,200,100,0.35)", borderRadius: 12, padding: "9px 20px", fontSize: 13, color: "#80ff88", cursor: "pointer", fontWeight: 700 }}>
                    📢 Share Victory
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Party Invite Notification ──────────────────────────────────────── */}
      {partyInvite && !adventureOverlayOpen && !caveOpen && (
        <div style={{
          position: "absolute", top: 80, left: "50%", transform: "translateX(-50%)",
          background: "linear-gradient(135deg, #1a0830, #0d0420)",
          border: "2px solid rgba(200,100,255,0.55)",
          borderRadius: 18, padding: "18px 24px", zIndex: 200,
          boxShadow: "0 0 48px rgba(180,80,255,0.3)",
          minWidth: 280, maxWidth: 360, textAlign: "center",
        }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⚔️</div>
          <div style={{ fontSize: 15, fontWeight: 900, color: "#cc88ff", marginBottom: 6 }}>Party Invite!</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 16 }}>
            <strong style={{ color: "#ffd070" }}>@{partyInvite.from_username}</strong> wants to adventure with you!
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button onClick={() => acceptPartyInvite(partyInvite)} style={{
              background: "linear-gradient(135deg, #4a2090, #6a30c0)", border: "none",
              borderRadius: 12, padding: "10px 24px", fontSize: 14, fontWeight: 700,
              color: "#fff", cursor: "pointer",
            }}>⚔️ Let&apos;s go!</button>
            <button onClick={async () => {
              await fetch("/api/town/party", { method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "decline", inviteId: partyInvite.id }) }).catch(() => {});
              setPartyInvite(null);
            }} style={{
              background: "rgba(255,80,80,0.12)", border: "1px solid rgba(255,80,80,0.35)",
              borderRadius: 12, padding: "10px 18px", fontSize: 14, color: "#ff8080", cursor: "pointer",
            }}>Not now</button>
          </div>
        </div>
      )}

      {/* ── Mobile tap-to-move hint + action buttons ───────────────────────── */}
      {isTouchDevice && !activeRoom && !showCaptainDialog && (
        <>
          {/* Hint: tap to move */}
          <div style={{ position: "absolute", bottom: 90, left: "50%", transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.5)", borderRadius: 20, padding: "4px 14px",
            fontSize: 11, color: "rgba(255,255,255,0.45)", pointerEvents: "none", zIndex: 40,
            whiteSpace: "nowrap" }}>
            Tap anywhere to move
          </div>
          {/* Mobile chat button */}
          {!chatOpen && (
            <button
              onTouchStart={e => { e.preventDefault(); openChat(true); }}
              style={{
                position: "absolute", bottom: 28, right: 24,
                width: 56, height: 56, borderRadius: "50%",
                background: "rgba(124,92,191,0.35)",
                border: "2px solid rgba(124,92,191,0.6)",
                color: "#fff", fontSize: 22, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                zIndex: 50, touchAction: "manipulation",
                boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
              }}
            >💬</button>
          )}
          {/* Character button for mobile */}
          <button
            onTouchStart={e => { e.preventDefault(); if (showStashRef.current) return; setShowInventory(v => { showInventoryRef.current = !v; if (!v) loadStashData(); return !v; }); }}
            style={{
              position: "absolute", bottom: 28, left: 24,
              width: 56, height: 56, borderRadius: "50%",
              background: "rgba(120,90,255,0.3)", border: "2px solid rgba(120,90,255,0.6)",
              color: "#fff", fontSize: 22, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 50, touchAction: "manipulation",
              boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            }}
          >🎒</button>
        </>
      )}

      {/* Chat input */}
      {chatOpen && (
        <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", width: "min(420px, 90vw)", display: "flex", gap: 8, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(12px)", border: "1px solid rgba(124,92,191,0.4)", borderRadius: 14, padding: 10 }}>
          <input ref={chatRef} value={chatInput} onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") sendChat(); if (e.key === "Escape") { openChat(false); setChatInput(""); setTimeout(() => { const c = containerRef.current?.querySelector("canvas"); if (c) (c as HTMLElement).focus(); }, 30); } }}
            placeholder="Say something… Enter to send · Esc cancel"
            maxLength={60} autoFocus
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: 13, fontFamily: "monospace" }}
          />
          <button onClick={sendChat} style={{ background: "var(--accent-purple)", border: "none", color: "#fff", borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Send</button>
        </div>
      )}

      {/* ── Market Room Overlays ─────────────────────────────────────────── */}
      {activeRoom && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column",
          background: activeRoom.includes("Fortune") ? "radial-gradient(ellipse at center, #1a0535 0%, #060010 100%)"
            : activeRoom.includes("Ice Cream") ? "radial-gradient(ellipse at center, #2a0830 0%, #0d0515 100%)"
            : activeRoom.includes("Market") ? "radial-gradient(ellipse at center, #0a1f06 0%, #060d03 100%)"
            : activeRoom.includes("Carnival") ? "radial-gradient(ellipse at center, #2a0808 0%, #0d0404 100%)"
            : activeRoom.includes("Bakery") ? "radial-gradient(ellipse at center, #1a1206 0%, #0d0903 100%)"
            : "radial-gradient(ellipse at center, #1a0818 0%, #0d0410 100%)",
        }}>
          {/* Exit button */}
          <button onClick={() => { setActiveRoom(null); activeRoomRef.current = null; setFortune(null); }}
            style={{ position: "absolute", top: 20, right: 24, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: "8px 16px", color: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 700, zIndex: 10 }}>
            ← Exit Room
          </button>

          {/* ── Room content (scrollable center area) ──────────── */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflowY: "auto", width: "100%", paddingTop: 60, paddingBottom: 16 }}>

          {/* ── FORTUNE TELLER ────────────────────────────────── */}
          {activeRoom.includes("Fortune") && (
            <div style={{ textAlign: "center", maxWidth: 500, padding: "0 20px" }}>
              {/* Decorative stars */}
              {["★","✦","✧","✦","★"].map((s, i) => (
                <span key={i} style={{ position: "absolute", color: "#cc80ff", opacity: 0.4, fontSize: 12 + i * 3,
                  top: `${10 + i * 8}%`, left: `${8 + i * 4}%` }}>{s}</span>
              ))}
              <div style={{ fontSize: 14, color: "#cc80ff", letterSpacing: 3, marginBottom: 8, fontFamily: "monospace" }}>✦ ENTER THE CHAMBER ✦</div>
              <h2 style={{ fontSize: 28, fontWeight: 900, color: "#e8c0ff", margin: "0 0 4px", fontFamily: "serif" }}>Madame Zara</h2>
              <div style={{ fontSize: 12, color: "rgba(200,160,255,0.5)", marginBottom: 24, fontFamily: "monospace" }}>Seer of Fates · Reader of Stars</div>

              {/* Fortune teller character (CSS art) */}
              <div style={{ position: "relative", margin: "0 auto 24px", width: 120, height: 160 }}>
                {/* Cloak */}
                <div style={{ position: "absolute", bottom: 0, left: 10, right: 10, height: 100, background: "linear-gradient(180deg, #4a1080, #2a0840)", borderRadius: "50% 50% 0 0", border: "2px solid rgba(200,120,255,0.4)" }}/>
                {/* Head */}
                <div style={{ position: "absolute", top: 10, left: 35, width: 50, height: 55, background: "#c8a070", borderRadius: "50% 50% 40% 40%", border: "2px solid #a07840" }}/>
                {/* Hat */}
                <div style={{ position: "absolute", top: -10, left: 25, right: 25, height: 0, borderLeft: "35px solid transparent", borderRight: "35px solid transparent", borderBottom: "50px solid #2a0a50" }}/>
                <div style={{ position: "absolute", top: 36, left: 18, right: 18, height: 6, background: "#4a1080", borderRadius: 3 }}/>
                {/* Eyes */}
                <div style={{ position: "absolute", top: 32, left: 44, width: 8, height: 8, background: "#5500cc", borderRadius: "50%", boxShadow: "0 0 6px #aa44ff" }}/>
                <div style={{ position: "absolute", top: 32, right: 44, width: 8, height: 8, background: "#5500cc", borderRadius: "50%", boxShadow: "0 0 6px #aa44ff" }}/>
                {/* Crystal ball in hands */}
                <div style={{ position: "absolute", bottom: 18, left: "50%", transform: "translateX(-50%)", width: 40, height: 40, background: "radial-gradient(circle at 35% 35%, #ffffff, #cc80ff 40%, #6600aa)", borderRadius: "50%", boxShadow: "0 0 20px #aa44ff, inset 0 0 10px rgba(255,255,255,0.3)" }}/>
              </div>

              {/* Orb button */}
              <button onClick={fetchFortune} disabled={fortuneLoading}
                style={{ background: fortuneLoading ? "rgba(100,0,150,0.3)" : "radial-gradient(circle at 40% 40%, #9933cc, #4400aa)", border: "2px solid rgba(200,120,255,0.6)", borderRadius: "50%", width: 90, height: 90, cursor: fortuneLoading ? "wait" : "pointer", fontSize: 28, boxShadow: fortuneLoading ? "0 0 30px rgba(150,50,255,0.4)" : "0 0 40px rgba(180,80,255,0.7), inset 0 0 20px rgba(255,255,255,0.15)", transition: "all 0.3s", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                {fortuneLoading ? <span style={{ fontSize: 20, animation: "spin 1.2s linear infinite" }}>✦</span> : "🔮"}
              </button>

              {!fortune && !fortuneLoading && (
                <div style={{ fontSize: 12, color: "rgba(200,160,255,0.5)", fontFamily: "monospace" }}>Touch the orb to reveal your fate…</div>
              )}
              {fortuneLoading && (
                <div style={{ fontSize: 13, color: "#cc80ff", fontFamily: "monospace", fontStyle: "italic" }}>The spirits gather… Madame Zara sees all…</div>
              )}
              {fortune && (
                <div style={{ background: "rgba(80,0,120,0.4)", border: "1px solid rgba(200,120,255,0.3)", borderRadius: 16, padding: "18px 24px", maxWidth: 420, margin: "0 auto", boxShadow: "0 0 30px rgba(150,50,255,0.2)" }}>
                  <div style={{ fontSize: 11, color: "rgba(200,160,255,0.6)", marginBottom: 10, letterSpacing: 2, fontFamily: "monospace" }}>✦ YOUR FORTUNE ✦</div>
                  <p style={{ fontSize: 15, color: "#e8d0ff", lineHeight: 1.7, fontFamily: "serif", fontStyle: "italic", margin: 0 }}>{fortune}</p>
                  <button onClick={fetchFortune} style={{ marginTop: 14, background: "transparent", border: "none", color: "rgba(200,160,255,0.5)", fontSize: 11, cursor: "pointer", fontFamily: "monospace" }}>✦ Ask again…</button>
                </div>
              )}
            </div>
          )}

          {/* ── ICE CREAM ─────────────────────────────────────── */}
          {activeRoom.includes("Ice Cream") && (() => {
            const flavors = ["🍓 Strawberry Dream","🫐 Blueberry Swirl","🍵 Matcha Cloud","🍫 Midnight Chocolate","🍑 Peach Sunrise","🦄 Unicorn Glitter"];
            return (
              <div style={{ textAlign: "center", maxWidth: 420, padding: "0 20px" }}>
                <div style={{ fontSize: 60, marginBottom: 8 }}>🍦</div>
                <h2 style={{ fontSize: 24, color: "#ffccdd", margin: "0 0 4px", fontFamily: "serif" }}>Scoops & Dreams</h2>
                <div style={{ fontSize: 12, color: "rgba(255,180,200,0.6)", marginBottom: 28, fontFamily: "monospace" }}>Est. 1887 · Old Town Square</div>
                <div style={{ fontSize: 14, color: "#ffccdd", marginBottom: 14, fontFamily: "monospace" }}>Today&apos;s Flavors:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
                  {flavors.map(f => (
                    <button key={f} onClick={() => setFortune(`🍦 One scoop of ${f.replace(/^\S+\s/, "")} coming right up! That&apos;ll be 3 gold coins. Enjoy! 😊`)}
                      style={{ background: "rgba(255,150,180,0.15)", border: "1px solid rgba(255,150,180,0.35)", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "#ffccdd", cursor: "pointer", fontFamily: "monospace", transition: "all 0.2s" }}>
                      {f}
                    </button>
                  ))}
                </div>
                {fortune && (
                  <div style={{ marginTop: 24, background: "rgba(255,120,160,0.12)", border: "1px solid rgba(255,150,180,0.25)", borderRadius: 14, padding: "14px 20px", fontSize: 14, color: "#ffccdd", fontFamily: "monospace" }}>
                    {fortune}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── MARKET ────────────────────────────────────────── */}
          {activeRoom.includes("Market") && (() => {
            const deals = ["🥕 Fresh carrots — just picked this morning! 5 for a copper!","🍎 Crisp apples from the valley orchards! Sweet as can be!","🧅 Onions that won&apos;t make ye cry… well, maybe a little.","🫙 Preserved jams, 12 flavors! Gran&apos;s secret recipe!","🌽 Golden corn, still in husk — finest in the land!","🧄 Garlic to ward off vampires AND bad dates!"];
            return (
              <div style={{ textAlign: "center", maxWidth: 420, padding: "0 20px" }}>
                <div style={{ fontSize: 60, marginBottom: 8 }}>🥕</div>
                <h2 style={{ fontSize: 24, color: "#ccee88", margin: "0 0 4px", fontFamily: "serif" }}>Ye Olde Market</h2>
                <div style={{ fontSize: 12, color: "rgba(180,220,100,0.5)", marginBottom: 24, fontFamily: "monospace" }}>Fresh · Local · Probably Not Cursed</div>
                <div style={{ background: "rgba(60,120,20,0.2)", border: "1px solid rgba(100,200,50,0.2)", borderRadius: 14, padding: 16, marginBottom: 16 }}>
                  {deals.map((d, i) => (
                    <div key={i} style={{ fontSize: 13, color: "#ccee88", padding: "6px 0", borderBottom: i < deals.length-1 ? "1px solid rgba(100,200,50,0.1)" : "none", fontFamily: "monospace", textAlign: "left" }}>{d}</div>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: "rgba(180,220,100,0.4)", fontFamily: "monospace" }}>🛒 No haggling. The merchant knows what he&apos;s got.</div>
              </div>
            );
          })()}

          {/* ── CARNIVAL ──────────────────────────────────────── */}
          {activeRoom.includes("Carnival") && (() => {
            const prizes = ["🧸 A stuffed bear","🎩 A tiny top hat","🪀 A spinning yo-yo","🎪 A certificate of carnival bravery","🔮 A fake crystal ball (wink)"];
            return (
              <div style={{ textAlign: "center", maxWidth: 420, padding: "0 20px" }}>
                <div style={{ fontSize: 60, marginBottom: 8 }}>🎪</div>
                <h2 style={{ fontSize: 24, color: "#ffaa66", margin: "0 0 4px", fontFamily: "serif" }}>Madcap Carnival!</h2>
                <div style={{ fontSize: 12, color: "rgba(255,160,80,0.5)", marginBottom: 24, fontFamily: "monospace" }}>Step right up, step right up!!</div>
                <div style={{ fontSize: 14, color: "#ffaa66", marginBottom: 16, fontFamily: "monospace" }}>Pick a number, win a prize:</div>
                <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 20 }}>
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => setFortune(`🎉 You picked ${n}! You win… ${prizes[Math.floor(Math.random() * prizes.length)]}! The barker tips his hat to you.`)}
                      style={{ background: "rgba(255,100,50,0.15)", border: "2px solid rgba(255,120,60,0.4)", borderRadius: "50%", width: 52, height: 52, fontSize: 18, fontWeight: 900, color: "#ffaa66", cursor: "pointer", transition: "all 0.2s" }}>
                      {n}
                    </button>
                  ))}
                </div>
                {fortune && (
                  <div style={{ background: "rgba(255,100,50,0.12)", border: "1px solid rgba(255,120,60,0.25)", borderRadius: 14, padding: "14px 20px", fontSize: 14, color: "#ffaa66", fontFamily: "monospace" }}>
                    {fortune}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── BAKERY ────────────────────────────────────────── */}
          {activeRoom.includes("Bakery") && (
            <div style={{ textAlign: "center", maxWidth: 420, padding: "0 20px" }}>
              <div style={{ fontSize: 60, marginBottom: 8 }}>🍞</div>
              <h2 style={{ fontSize: 24, color: "#ffdd99", margin: "0 0 4px", fontFamily: "serif" }}>The Warm Hearth Bakery</h2>
              <div style={{ fontSize: 12, color: "rgba(255,200,100,0.5)", marginBottom: 28, fontFamily: "monospace" }}>Baked fresh since the crack of dawn</div>
              <div style={{ background: "rgba(120,80,20,0.25)", border: "1px solid rgba(200,140,60,0.25)", borderRadius: 14, padding: 20, textAlign: "left" }}>
                <div style={{ fontSize: 13, color: "#ffdd99", fontFamily: "monospace", fontWeight: 700, marginBottom: 12 }}>📋 Today&apos;s Specials:</div>
                {["🥐 Buttery croissants — still warm!","🍰 Lavender honey cake — only 3 left!","🥖 Sourdough loaf — starter is 47 years old!","🧁 Blueberry muffins — made with morning dew","🍪 Giant snickerdoodles — the baker&apos;s pride"].map((item, i) => (
                  <div key={i} style={{ fontSize: 13, color: "#ffe0aa", padding: "5px 0", borderBottom: i < 4 ? "1px solid rgba(200,140,60,0.12)" : "none", fontFamily: "monospace" }}>{item}</div>
                ))}
              </div>
              <div style={{ marginTop: 16, fontSize: 12, color: "rgba(255,200,100,0.4)", fontFamily: "monospace" }}>The baker hums softly. It smells amazing in here.</div>
            </div>
          )}

          {/* ── FLOWERS ───────────────────────────────────────── */}
          {activeRoom.includes("Flowers") && (() => {
            const msgs: Record<string, string> = {
              "🌹": "A red rose — for the bold of heart. Romance, passion, and a touch of drama. Classic.",
              "🌻": "A sunflower — for the optimist! Face the sun and your shadow falls behind. Cheesy but true.",
              "💐": "A mixed bouquet — for the indecisive and the generous. You want it all, and honestly? Respect.",
              "🌷": "A tulip — for the secretly fancy person. You have taste. The flower lady nods approvingly.",
              "🌸": "A cherry blossom — beautiful, fleeting, a little dramatic. Like your best stories.",
            };
            return (
              <div style={{ textAlign: "center", maxWidth: 420, padding: "0 20px" }}>
                <div style={{ fontSize: 60, marginBottom: 8 }}>🌸</div>
                <h2 style={{ fontSize: 24, color: "#ffccee", margin: "0 0 4px", fontFamily: "serif" }}>Petal & Thorn</h2>
                <div style={{ fontSize: 12, color: "rgba(255,180,220,0.5)", marginBottom: 24, fontFamily: "monospace" }}>Fine florals · Est. when flowers existed</div>
                <div style={{ fontSize: 14, color: "#ffccee", marginBottom: 16, fontFamily: "monospace" }}>Pick a flower:</div>
                <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 20 }}>
                  {Object.keys(msgs).map(f => (
                    <button key={f} onClick={() => setFortune(msgs[f])}
                      style={{ background: "transparent", border: "2px solid rgba(255,150,200,0.3)", borderRadius: "50%", width: 56, height: 56, fontSize: 26, cursor: "pointer", transition: "all 0.2s" }}>
                      {f}
                    </button>
                  ))}
                </div>
                {fortune && (
                  <div style={{ background: "rgba(200,80,140,0.1)", border: "1px solid rgba(255,150,200,0.2)", borderRadius: 14, padding: "14px 20px", fontSize: 14, color: "#ffccee", fontFamily: "monospace", lineHeight: 1.6 }}>
                    {fortune}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Unified Shop Section (inside scrollable content) ─── */}
          {(() => {
            const roomKey = Object.keys(SHOP_CATALOG).find(k => activeRoom?.includes(k));
            const items = roomKey ? SHOP_CATALOG[roomKey] : null;
            if (!items) return null;
            return (
              <div style={{ width: "100%", maxWidth: 480, margin: "28px auto 0", padding: "0 20px 32px" }}>
                <div style={{ borderTop: "1px solid rgba(255,215,0,0.18)", paddingTop: 18 }}>
                  {/* Coin balance + equipped */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                    <span style={{ fontSize: 14, color: "#ffd700", fontWeight: 800 }}>🪙 {myCoins} coins</span>
                    {myEquippedItem ? (
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", gap: 4 }}>
                        Holding {myEquippedItem}
                        <button onClick={unequipItem} style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", background: "transparent", border: "none", cursor: "pointer", padding: "0 2px" }}>✕</button>
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>Nothing equipped</span>
                    )}
                  </div>
                  {/* Buy buttons */}
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                    {items.map(item => (
                      <button key={item.emoji}
                        onClick={() => handleBuyShopItem(item.emoji, item.name, item.price)}
                        disabled={myCoins < item.price || !!buyingItem}
                        title={`Buy ${item.name} for ${item.price} coins`}
                        style={{
                          background: myCoins >= item.price ? "rgba(255,215,0,0.14)" : "rgba(255,255,255,0.04)",
                          border: `1px solid ${myCoins >= item.price ? "rgba(255,215,0,0.45)" : "rgba(255,255,255,0.1)"}`,
                          borderRadius: 14, padding: "12px 16px",
                          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                          cursor: myCoins >= item.price ? "pointer" : "not-allowed",
                          opacity: myCoins < item.price ? 0.4 : buyingItem === item.emoji ? 0.6 : 1,
                          transition: "all 0.15s", minWidth: 80,
                        }}>
                        <span style={{ fontSize: 28 }}>{buyingItem === item.emoji ? "⏳" : item.emoji}</span>
                        <span style={{ fontSize: 12, color: myCoins >= item.price ? "#ffe866" : "rgba(255,255,255,0.3)", fontWeight: 700 }}>{item.name}</span>
                        <span style={{ fontSize: 11, color: myCoins >= item.price ? "rgba(255,215,0,0.7)" : "rgba(255,255,255,0.2)" }}>🪙 {item.price}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          </div>{/* end room content wrapper */}
        </div>
      )}

      {/* ── Captain Dialog ───────────────────────────────────────────────── */}
      {showCaptainDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", zIndex: 350, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowCaptainDialog(false)}>
          <div style={{ background: "linear-gradient(145deg, #1a1208, #0d0d00)", border: "2px solid rgba(255,200,50,0.4)", borderRadius: 22, padding: 28, width: "min(480px, 94vw)", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 0 60px rgba(255,200,50,0.15)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <span style={{ fontSize: 28 }}>🗡️</span>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#ffd700" }}>Captain Aldric</div>
                <div style={{ fontSize: 11, color: "rgba(255,200,80,0.5)", fontFamily: "monospace" }}>Knight Commander · North Gate</div>
              </div>
              <button onClick={() => setShowCaptainDialog(false)} style={{ marginLeft: "auto", background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {(["class", "mission"] as const).map(t => (
                <button key={t} onClick={() => setCaptainDialogTab(t)} style={{
                  flex: 1, background: captainDialogTab === t ? "rgba(255,200,50,0.2)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${captainDialogTab === t ? "rgba(255,200,50,0.5)" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: 10, padding: "7px 0", fontSize: 12, color: captainDialogTab === t ? "#ffd700" : "rgba(255,255,255,0.4)",
                  cursor: "pointer", fontWeight: 700, textTransform: "capitalize",
                }}>
                  {t === "class" ? "⚔️ Class" : "🗺️ Mission"}
                </button>
              ))}
            </div>

            {/* Class tab */}
            {captainDialogTab === "class" && (
              <div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 14 }}>
                  {adventureStats?.class
                    ? `Current class: ${adventureStats.class[0].toUpperCase() + adventureStats.class.slice(1)}. Switch anytime.`
                    : "Choose your class to begin your adventure."}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {CLASS_OPTIONS.map(cls => (
                    <button key={cls.key} onClick={() => pickClass(cls.key)} style={{
                      background: adventureStats?.class === cls.key ? "rgba(255,200,50,0.15)" : "rgba(255,255,255,0.05)",
                      border: `1px solid ${adventureStats?.class === cls.key ? "rgba(255,200,50,0.5)" : "rgba(255,255,255,0.1)"}`,
                      borderRadius: 12, padding: "12px 14px", textAlign: "left", cursor: "pointer",
                      display: "flex", gap: 12, alignItems: "center",
                    }}>
                      <span style={{ fontSize: 26 }}>{cls.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: adventureStats?.class === cls.key ? "#ffd700" : "#fff" }}>{cls.name}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>HP: {cls.hp} · ATK: {cls.atk}</div>
                        <div style={{ fontSize: 10, color: "rgba(255,200,50,0.6)", marginTop: 2 }}>✨ {cls.special}</div>
                      </div>
                      {adventureStats?.class === cls.key && <span style={{ fontSize: 14, color: "#ffd700" }}>✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Mission tab */}
            {captainDialogTab === "mission" && (
              <div>
                {/* Use ref as fallback — handles race where state hasn't synced yet */}
                {(adventureStats?.class ?? adventureStatsRef.current?.class) ? null : (
                  <div style={{ fontSize: 13, color: "#ff8888", marginBottom: 12, padding: "8px 12px", background: "rgba(255,80,80,0.1)", borderRadius: 8 }}>
                    Pick a class first! <button onClick={() => setCaptainDialogTab("class")} style={{ marginLeft: 8, fontSize: 12, color: "#ffd700", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline" }}>Choose now →</button>
                  </div>
                )}
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 14 }}>Choose your mission:</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { key: "forest", emoji: "🌲", name: "Forest Bandits", desc: "Clear bandits from the forest road", diff: "⭐⭐" },
                    { key: "princess", emoji: "👸", name: "Rescue Princess Pip!", desc: "Save the kidnapped princess from bandit poets", diff: "⭐⭐" },
                    { key: "cave", emoji: "💎", name: "Crystal Cave", desc: "Explore the haunted crystal caverns", diff: "⭐⭐⭐" },
                    { key: "pirates", emoji: "🏴‍☠️", name: "Plunder of the Deep Caves", desc: "Stop the pirates running the underground shanty concert", diff: "⭐⭐⭐" },
                    { key: "ruins", emoji: "💀", name: "Haunted Ruins", desc: "Face the undead in ancient ruins", diff: "⭐⭐⭐" },
                    { key: "haunted_manor", emoji: "👻", name: "Haunted Manor of Dreadmoor", desc: "Stop the ghost's dramatic third act monologue", diff: "⭐⭐⭐" },
                    { key: "pizza", emoji: "🐉", name: "The Dragon Stole My Pizza 🍕", desc: "Get your supreme pizza back from an emotionally complex dragon", diff: "⭐⭐⭐⭐" },
                    { key: "dragon", emoji: "🐉", name: "Dragon's Peak", desc: "Slay the dragon at the mountain's peak", diff: "⭐⭐⭐⭐⭐" },
                  ].map(m => {
                    const hasClass = !!(adventureStats?.class ?? adventureStatsRef.current?.class);
                    return (
                      <button key={m.key} onClick={() => hasClass && startMission(m.key)} style={{
                        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 12, padding: "12px 14px", textAlign: "left", cursor: hasClass ? "pointer" : "not-allowed",
                        display: "flex", gap: 10, alignItems: "center", opacity: hasClass ? 1 : 0.5,
                      }}>
                        <span style={{ fontSize: 26 }}>{m.emoji}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{m.name}</div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{m.desc}</div>
                        </div>
                        <span style={{ fontSize: 10, color: "rgba(255,200,50,0.7)" }}>{m.diff}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom mission */}
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>✍️ Write your own adventure:</div>
                  <textarea
                    value={customMissionInput}
                    onChange={e => setCustomMissionInput(e.target.value)}
                    onKeyDown={e => e.stopPropagation()}
                    placeholder="Describe your mission... e.g. 'A dungeon full of fire giants under a volcano'"
                    maxLength={120}
                    rows={2}
                    style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "8px 12px", fontSize: 12, color: "#fff", resize: "none", outline: "none", boxSizing: "border-box", fontFamily: "monospace" }}
                  />
                  {(() => {
                    const hasClass = !!(adventureStats?.class ?? adventureStatsRef.current?.class);
                    const canStart = !!(customMissionInput.trim() && hasClass);
                    return (
                  <button
                    onClick={() => canStart && startMission("custom", customMissionInput.trim())}
                    disabled={!canStart}
                    style={{ marginTop: 8, width: "100%", background: canStart ? "rgba(255,200,50,0.18)" : "rgba(255,255,255,0.04)", border: `1px solid ${canStart ? "rgba(255,200,50,0.5)" : "rgba(255,255,255,0.1)"}`, borderRadius: 10, padding: "9px 0", fontSize: 13, color: canStart ? "#ffd700" : "rgba(255,255,255,0.3)", cursor: canStart ? "pointer" : "not-allowed", fontWeight: 700 }}
                  >
                    🚀 Begin Adventure!
                  </button>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Cave Overlay (South Cave) — shared daily session, up to 8 players ── */}
      {caveOpen && (() => {
        const caveStats = adventureStats ?? { class: null, level: 1, xp: 0, hp: 100, max_hp: 100, base_attack: 10, inventory: [], equipped_item_id: null, wins: 0, quests_completed: 0 };
        // Build team members: always include self + any other players in the cave session
        const selfMember = { userId, username, avatarUrl, hp: caveStats.hp, maxHp: caveStats.max_hp, playerClass: caveStats.class, isDowned: false };
        const otherMembers = caveTeam
          .filter(m => m.user_id !== userId)
          .slice(0, 7) // max 8 total including self
          .map(m => ({ userId: m.user_id, username: m.username, avatarUrl: m.avatar_url, hp: m.hp ?? 100, maxHp: m.max_hp ?? 100, playerClass: m.class, isDowned: false }));
        const allMembers = [selfMember, ...otherMembers];
        return (
          <AdventureOverlay
            userId={userId}
            username={username}
            avatarUrl={avatarUrl}
            myStats={caveStats as Parameters<typeof AdventureOverlay>[0]["myStats"]}
            sessionId={caveSessionId}
            missionData={{ name: "South Cave", description: "Wild monsters lurk in the depths.", theme: "cave", emoji: "🕳️", palette: { bg: "#0a0d1a", accent: "#44aaff", floor: "#12162e" }, rooms: [] }}
            teamMembers={allMembers}
            caveMode={true}
            caveLevel={caveStats.level}
            equippedSlots={(stashData?.equipped_slots ?? {}) as Parameters<typeof AdventureOverlay>[0]["equippedSlots"]}
            onClose={() => {
              // Leave the cave session on exit so slot opens for another player
              if (caveSessionId) {
                fetch("/api/town/party", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "leave-cave", sessionId: caveSessionId }) }).catch(() => {});
              }
              setCaveOpen(false);
              setCaveSessionId(null);
              setCaveTeam([]);
              // Restore position to where player was before entering cave
              if (savedPlayerPosRef.current) {
                const pos = savedPlayerPosRef.current;
                setTimeout(() => { teleportPlayerRef.current?.(pos.x, pos.y); }, 100);
              }
            }}
            onStatsUpdate={(patch) => {
              const updated = adventureStatsRef.current ? { ...adventureStatsRef.current, ...patch } as AdventureStats : null;
              if (updated) { adventureStatsRef.current = updated; setAdventureStats(updated); }
              fetch("/api/adventure", { method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "update-stats", patch }) }).catch(() => {});
            }}
            onMinimize={() => setCaveOpen(false)}
            onCoinsEarned={handleCoinsEarned}
            onOpenInventory={() => { if (!showStashRef.current) { showInventoryRef.current = true; setShowInventory(true); loadStashData(); } }}
          />
        );
      })()}

      {/* ── NPC Dialogue ──────────────────────────────────────────────────── */}
      {npcDialogue && (
        <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "min(680px, 96vw)", zIndex: 300, padding: "0 0 20px" }}>
          <div style={{ background: "linear-gradient(135deg, #0d0d1f, #060614)", border: "2px solid rgba(180,140,255,0.35)", borderRadius: 20, padding: "18px 22px", margin: "0 8px", position: "relative", boxShadow: "0 -8px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(180,140,255,0.08)" }}>
            {/* Close */}
            <button onClick={() => { setNpcDialogue(null); npcDialogueRef.current = false; }}
              style={{ position: "absolute", top: 10, right: 12, background: "transparent", border: "none", color: "rgba(255,255,255,0.35)", fontSize: 18, cursor: "pointer", lineHeight: 1 }}>✕</button>
            {/* NPC header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 34, lineHeight: 1, filter: "drop-shadow(0 0 10px rgba(180,140,255,0.55))" }}>{npcDialogue.npcEmoji}</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 900, color: "#d4aaff" }}>{npcDialogue.npcName}</div>
                <div style={{ fontSize: 10, color: "rgba(180,140,255,0.5)", fontFamily: "monospace" }}>{npcDialogue.npcTitle}</div>
              </div>
            </div>
            {/* Reply bubble */}
            <div style={{ minHeight: 48, fontSize: 13, color: "#e8e0ff", lineHeight: 1.65, marginBottom: 14, background: "rgba(180,140,255,0.07)", border: "1px solid rgba(180,140,255,0.15)", borderRadius: 12, padding: "10px 14px" }}>
              {npcDialogue.loading
                ? <span style={{ color: "rgba(180,140,255,0.4)", fontStyle: "italic" }}>…</span>
                : npcDialogue.reply || <span style={{ color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>Waiting for response…</span>}
            </div>
            {/* Player input */}
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={npcDialogue.npcChatInput}
                onChange={e => setNpcDialogue(d => d ? { ...d, npcChatInput: e.target.value } : null)}
                onKeyDown={e => {
                  e.stopPropagation();
                  if (e.key === "Enter" && npcDialogue.npcChatInput.trim() && !npcDialogue.loading) {
                    const msg = npcDialogue.npcChatInput.trim();
                    const id = npcDialogue.npcId;
                    setNpcDialogue(d => d ? { ...d, npcChatInput: "" } : null);
                    talkToNpc(id, msg);
                  }
                  if (e.key === "Escape") { setNpcDialogue(null); npcDialogueRef.current = false; }
                }}
                placeholder={`Say something to ${npcDialogue.npcName}…`}
                disabled={npcDialogue.loading}
                autoFocus
                style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(180,140,255,0.28)", borderRadius: 10, padding: "9px 12px", color: "#fff", fontSize: 12, outline: "none", fontFamily: "monospace" }}
              />
              <button
                onClick={() => {
                  if (npcDialogue.npcChatInput.trim() && !npcDialogue.loading) {
                    const msg = npcDialogue.npcChatInput.trim();
                    const id = npcDialogue.npcId;
                    setNpcDialogue(d => d ? { ...d, npcChatInput: "" } : null);
                    talkToNpc(id, msg);
                  }
                }}
                disabled={!npcDialogue.npcChatInput.trim() || npcDialogue.loading}
                style={{ background: "rgba(180,140,255,0.22)", border: "1px solid rgba(180,140,255,0.45)", borderRadius: 10, padding: "9px 18px", fontSize: 12, color: "#c8aaff", cursor: "pointer", fontWeight: 700, opacity: (!npcDialogue.npcChatInput.trim() || npcDialogue.loading) ? 0.45 : 1 }}
              >Talk</button>
            </div>
            <div style={{ fontSize: 10, color: "rgba(180,140,255,0.3)", marginTop: 8, fontFamily: "monospace" }}>Esc to close · NPCs remember your conversations</div>
          </div>
        </div>
      )}

      {/* ── Seraphina Jukebox Dialog ────────────────────────────────────────── */}
      {showJukeboxDialog && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9500, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowJukeboxDialog(false); }}>
          <div style={{ background: "linear-gradient(135deg, #1a0a28, #0d0620)", border: "2px solid rgba(255,136,204,0.45)", borderRadius: 20, padding: "22px 26px", width: "min(440px, 92vw)", boxShadow: "0 0 40px rgba(255,100,200,0.2)" }}>
            <button onClick={() => setShowJukeboxDialog(false)} style={{ position: "absolute", right: 16, top: 14, background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 18, cursor: "pointer" }}>✕</button>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <span style={{ fontSize: 36 }}>🎵</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#ffaadd" }}>Seraphina</div>
                <div style={{ fontSize: 10, color: "rgba(255,136,204,0.55)", fontFamily: "monospace" }}>Town Minstrel · 🪙 Free</div>
              </div>
            </div>

            {/* Now playing */}
            {theaterState?.jukeboxUrl && (
              <div style={{ background: "rgba(255,136,204,0.08)", border: "1px solid rgba(255,136,204,0.25)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>🎶</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: "#ffaadd", fontWeight: 700 }}>Now Playing</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{theaterState.jukeboxUrl}</div>
                  {theaterState.jukeboxBy && <div style={{ fontSize: 9, color: "rgba(255,136,204,0.5)", fontFamily: "monospace" }}>by {theaterState.jukeboxBy}</div>}
                </div>
                <button
                  onClick={async () => {
                    await fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "theater-jukebox-stop", partyId: partyIdRef.current }) });
                  }}
                  style={{ background: "rgba(255,60,80,0.2)", border: "1px solid rgba(255,60,80,0.4)", borderRadius: 6, padding: "4px 10px", color: "#ff6080", fontSize: 11, cursor: "pointer", flexShrink: 0 }}>
                  ⏹ Stop
                </button>
              </div>
            )}

            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 10 }}>
              {theaterState?.jukeboxUrl ? "Change the song for everyone in town:" : "Play a YouTube video for everyone in town:"}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={jukeboxInput}
                onChange={e => setJukeboxInput(e.target.value)}
                onKeyDown={e => { e.stopPropagation(); if (e.key === "Escape") setShowJukeboxDialog(false); }}
                placeholder="youtube.com/watch?v=... or youtu.be/..."
                autoFocus
                style={{ flex: 1, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,136,204,0.3)", borderRadius: 10, padding: "9px 12px", color: "#fff", fontSize: 12, outline: "none", fontFamily: "monospace" }}
              />
              <button
                onClick={async () => {
                  const url = jukeboxInput.trim();
                  if (!url) return;
                  setJukeboxDialogLoading(true);
                  try {
                    await fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "theater-jukebox-play", jukeboxUrl: url, partyId: partyIdRef.current }) });
                    setJukeboxInput("");
                    setShowJukeboxDialog(false);
                  } finally { setJukeboxDialogLoading(false); }
                }}
                disabled={!jukeboxInput.trim() || jukeboxDialogLoading}
                style={{ background: "rgba(255,136,204,0.25)", border: "1px solid rgba(255,136,204,0.5)", borderRadius: 10, padding: "9px 18px", color: "#ffaadd", fontSize: 12, cursor: "pointer", fontWeight: 700, opacity: (!jukeboxInput.trim() || jukeboxDialogLoading) ? 0.45 : 1 }}>
                {jukeboxDialogLoading ? "…" : "▶ Play"}
              </button>
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,136,204,0.3)", marginTop: 10, fontFamily: "monospace" }}>Music plays for all players in town · Esc to close</div>
          </div>
        </div>
      )}

      {/* ── Jukebox hidden audio iframe ──────────────────────────────────────── */}
      {(() => {
        const jUrl = theaterState?.jukeboxUrl ?? null;
        const jStartedAt = theaterState?.jukeboxStartedAt ?? null;
        if (!jUrl) return null;
        const ytId = jUrl.match(/[?&]v=([a-zA-Z0-9_-]{11})/)
          ?? jUrl.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)
          ?? jUrl.match(/embed\/([a-zA-Z0-9_-]{11})/);
        const videoId = ytId?.[1] ?? jUrl;
        const elapsed = jStartedAt ? Math.max(0, Math.floor((Date.now() - jStartedAt) / 1000)) : 0;
        return (
          <div key={`jukebox-${jUrl}-${jStartedAt}`} style={{ position: "fixed", left: -9999, top: -9999, width: 480, height: 270, pointerEvents: "none", opacity: 0 }} aria-hidden="true">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&start=${elapsed}&rel=0&enablejsapi=1`}
              allow="autoplay; fullscreen"
              style={{ width: "100%", height: "100%", border: "none" }}
            />
          </div>
        );
      })()}

      {/* ── Character Panel (C key) — Diablo-style: equipment slots left, backpack right ── */}
      {showInventory && (
        <CharacterPanel
          adventureStats={adventureStats}
          backpack={(stashData?.inventory ?? (adventureStats?.inventory as InvItem[] ?? [])) as InvItem[]}
          equippedSlots={(stashData?.equipped_slots ?? {}) as Record<string, InvItem | null>}
          username={username}
          myCoins={myCoins}
          onClose={() => {
            setShowInventory(false);
            showInventoryRef.current = false;
            // Persist equipped state immediately when panel closes
            markDirty();
            // Also fire a background save-all so DB is synced right away
            fetch("/api/town", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "save-all", gameState: buildSave() }) }).catch(() => {});
          }}
          onEquipSlot={(slot, itemId) => {
            if (slot === "fun" && itemId) {
              const item = (stashDataRef.current?.inventory ?? []).find((i: unknown) => (i as { id: string }).id === itemId) as FunItem | undefined;
              if (item) {
                setFunItem(item as FunItem);
                funItemRef.current = item as FunItem;
                setMyEquippedItem(item.emoji);
                myEquippedItemRef.current = item.emoji;
                markDirty();
              }
            } else {
              // Optimistically update equipped_slots in ref immediately so that if the
              // user closes the panel before the server responds, buildSave() uses the
              // correct (new) equipped state instead of the stale pre-equip snapshot.
              if (stashDataRef.current) {
                const allItems = [
                  ...(stashDataRef.current.inventory ?? []),
                  ...(stashDataRef.current.stash_items ?? []),
                ];
                const equippedItem = itemId
                  ? (allItems.find((i: unknown) => (i as { id: string }).id === itemId) ?? null)
                  : null;
                const newSlots = { ...stashDataRef.current.equipped_slots, [slot]: equippedItem };
                const updated = { ...stashDataRef.current, equipped_slots: newSlots };
                stashDataRef.current = updated;
                setStashData(updated);
                markDirty();
              }
              stashAction("equip-slot", { slot, itemId });
            }
          }}
          onConsumeFunItem={(item) => consumeFunItem(item as { id: string; emoji: string; name: string; funType?: string; slot?: string })}
        />
      )}

      {/* ── Adventure Overlay ─────────────────────────────────────────────── */}
      {adventureOverlayOpen && adventureMission && (() => {
        const advStats = adventureStats ?? { class: null, level: 1, xp: 0, hp: 100, max_hp: 100, base_attack: 10, inventory: [], equipped_item_id: null, wins: 0, quests_completed: 0 };
        return (
        <AdventureOverlay
          userId={userId}
          username={username}
          avatarUrl={avatarUrl}
          myStats={advStats as Parameters<typeof AdventureOverlay>[0]["myStats"]}
          sessionId={adventureSessionId}
          missionData={adventureMission as Parameters<typeof AdventureOverlay>[0]["missionData"]}
          teamMembers={[{
            userId, username, avatarUrl,
            hp: advStats.hp, maxHp: advStats.max_hp,
            playerClass: advStats.class,
            isDowned: false,
          }]}
          onClose={() => {
            setAdventureOverlayOpen(false);
            setAdventureMission(null);
            setAdventureSessionId(null);
            setAdventureMinimized(null);
            // Return to saved position
            if (savedPlayerPosRef.current) {
              const pos = savedPlayerPosRef.current;
              setTimeout(() => { teleportPlayerRef.current?.(pos.x, pos.y); }, 100);
            }
          }}
          onStatsUpdate={(patch) => {
            const updated = adventureStatsRef.current ? { ...adventureStatsRef.current, ...patch } as AdventureStats : null;
            if (updated) { adventureStatsRef.current = updated; setAdventureStats(updated); markDirty(); }
            fetch("/api/adventure", { method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "update-stats", patch }) }).catch(() => {});
          }}
          onMinimize={(info) => {
            if (info) { setAdventureMinimized(info); setAdventureOverlayOpen(false); }
            else { setAdventureMinimized(null); }
          }}
          onCoinsEarned={handleCoinsEarned}
          onOpenInventory={() => { if (!showStashRef.current) { showInventoryRef.current = true; setShowInventory(true); loadStashData(); } }}
          equippedSlots={(stashData?.equipped_slots ?? {}) as Parameters<typeof AdventureOverlay>[0]["equippedSlots"]}
        />
        );
      })()}

      {/* ── Stash Panel ─────────────────────────────────────────────────────── */}
      {showStash && (
        <StashPanel
          stashItems={(stashData?.stash_items ?? []) as Parameters<typeof StashPanel>[0]["stashItems"]}
          inventoryItems={(stashData?.inventory ?? []) as Parameters<typeof StashPanel>[0]["inventoryItems"]}
          equippedSlots={(stashData?.equipped_slots ?? {}) as Parameters<typeof StashPanel>[0]["equippedSlots"]}
          coins={myCoins}
          onClose={() => { setShowStash(false); showStashRef.current = false; }}
          onEquip={(slot, itemId) => stashAction("equip-slot", { slot, itemId })}
          onDeposit={(itemId) => stashAction("stash-deposit", { itemId })}
          onWithdraw={(itemId) => stashAction("stash-withdraw", { itemId })}
          onDrop={(itemId) => {
            const pos = myPosRef.current ?? { x: 2800, y: 560 };
            stashAction("drop-item", { itemId, x: pos.x, y: pos.y });
          }}
          onSell={(itemId) => stashAction("vendor-sell", { itemId })}
          onUseAbility={(ability) => {
            if (ability === "frog_hex") {
              const targets = nearbyPlayers.map(p => p.user_id);
              if (targets.length === 0) return;
              handleFrogHex(targets);
            }
          }}
        />
      )}

      {/* ── Vendor Panel ─────────────────────────────────────────────────────── */}
      {showVendor && (
        <VendorPanel
          stock={vendorStock as Parameters<typeof VendorPanel>[0]["stock"]}
          inventoryItems={(stashData?.inventory ?? []) as Parameters<typeof VendorPanel>[0]["inventoryItems"]}
          stashItems={(stashData?.stash_items ?? []) as Parameters<typeof VendorPanel>[0]["stashItems"]}
          coins={vendorCoins}
          onClose={() => { setShowVendor(false); showVendorRef.current = false; }}
          onBuy={async (index) => {
            const r = await fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "vendor-buy", itemIndex: index }) });
            const d = await r.json();
            if (d.ok) {
              setMyCoins(c => c - (vendorStock[index] as { price: number }).price);
              setVendorCoins(c => c - (vendorStock[index] as { price: number }).price);
              await loadStashData(); // refresh inventory after purchase
            }
          }}
          onSellItem={async (itemId) => {
            const r = await fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "vendor-sell", itemId }) });
            const d = await r.json();
            if (d.ok || d.coins_earned !== undefined) {
              const earned = typeof d.coins_earned === "string" ? 1000000000 : Number(d.coins_earned ?? 0);
              setMyCoins(c => c + earned);
              setVendorCoins(c => c + earned);
              await loadStashData();
            }
          }}
        />
      )}

      {/* ── Herald Panel ─────────────────────────────────────────────────────── */}
      {showHerald && (
        <HeraldPanel
          chapters={heraldChapters as Parameters<typeof HeraldPanel>[0]["chapters"]}
          onClose={() => { setShowHerald(false); showHeraldRef.current = false; }}
        />
      )}

      {/* ── Leave-kingdom confirmation ──────────────────────────────────────── */}
      {confirmLeave && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setConfirmLeave(null)}
        >
          <div
            style={{ background: "var(--bg-elevated)", border: "2px solid var(--border-bright)", borderRadius: 20, padding: "28px 32px", width: "min(340px, 90vw)", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.7)" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 40, marginBottom: 10 }}>🏰</div>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>
              Leave the Kingdom?
            </h3>
            <p style={{ margin: "0 0 22px", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Enter <strong>{confirmLeave.label}</strong> and leave the kingdom?
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setConfirmLeave(null)}
                style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 0", fontSize: 14, fontWeight: 700, color: "var(--text-secondary)", cursor: "pointer" }}
              >
                ✖ Stay
              </button>
              <button
                onClick={() => { router.push(confirmLeave.href); }}
                style={{ flex: 1, background: "linear-gradient(135deg, #7c5cbf, #4477cc)", border: "none", borderRadius: 10, padding: "10px 0", fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: "0 4px 14px rgba(100,60,200,0.4)" }}
              >
                ✔ Enter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Friend invite modal */}
      {showInvite && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowInvite(false)}>
          <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-bright)", borderRadius: 18, padding: 24, width: "min(360px, 92vw)", maxHeight: "70vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>🏘️ Invite Friends</h3>
            {friends.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>No friends yet — add some!</div>
            ) : friends.map(f => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <img src={f.avatar_url ?? `https://api.dicebear.com/9.x/adventurer/svg?seed=${f.username}`} style={{ width: 32, height: 32, borderRadius: 4 }} alt={f.username} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>@{f.username}</span>
                <button onClick={() => inviteFriend(f.id, f.username)} style={{ background: "rgba(124,92,191,0.25)", border: "1px solid rgba(124,92,191,0.4)", borderRadius: 8, padding: "5px 12px", fontSize: 12, color: "#c8aaff", cursor: "pointer", fontWeight: 700 }}>Invite</button>
              </div>
            ))}
            <button onClick={() => setShowInvite(false)} style={{ width: "100%", marginTop: 16, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 10, padding: 10, fontSize: 14, color: "var(--text-secondary)", cursor: "pointer" }}>Close</button>
          </div>
        </div>
      )}

      {/* ── Arcade Modal ────────────────────────────────────────────────────────── */}
      {arcadeOpen && <ArcadeModal userId={userId} onClose={() => { setArcadeOpen(false); arcadeOpenRef.current = false; }} />}

      {/* ── Party HUD ───────────────────────────────────────────────────────────── */}
      {!theaterOpen && (
        <div style={{ position: "fixed", bottom: 80, left: 12, zIndex: 9000, pointerEvents: "none" }}>
          {/* My party panel */}
          {myParty && (
            <div style={{
              background: "rgba(8,14,24,0.93)", border: "1px solid rgba(100,200,100,0.3)",
              borderRadius: 10, padding: "8px 10px", marginBottom: 6, minWidth: 170, pointerEvents: "all",
              boxShadow: "0 4px 18px rgba(0,0,0,0.5)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: "#66dd88", fontWeight: 700 }}>⚔️ Party</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginLeft: "auto" }}>{myParty.members.length}/{myParty.maxSize}</span>
              </div>
              {myParty.members.map(m => (
                <div key={m.userId} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                  {m.avatarUrl ? (
                    <img src={m.avatarUrl} alt="" style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover", border: m.isLeader ? "1px solid #ffd700" : "1px solid rgba(255,255,255,0.15)" }} />
                  ) : (
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>👤</div>
                  )}
                  <span style={{ fontSize: 11, color: m.isLeader ? "#ffd700" : "rgba(255,255,255,0.7)", fontWeight: m.isLeader ? 700 : 400 }}>
                    {m.username}{m.isLeader ? " 👑" : ""}
                    {m.userId === userId && " (you)"}
                  </span>
                </div>
              ))}
              <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                {myParty.leaderId === userId ? (
                  <button onClick={disbandPartyAction} style={{ flex: 1, padding: "3px 0", background: "rgba(200,50,50,0.2)", border: "1px solid rgba(200,50,50,0.4)", borderRadius: 5, color: "#ff8888", fontSize: 10, cursor: "pointer" }}>Disband</button>
                ) : (
                  <button onClick={leavePartyAction} style={{ flex: 1, padding: "3px 0", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 5, color: "rgba(255,255,255,0.6)", fontSize: 10, cursor: "pointer" }}>Leave</button>
                )}
                <button onClick={() => { setShowPartyInvite(p => !p); setShowPartyPanel(false); }} style={{ padding: "3px 7px", background: "rgba(100,200,100,0.1)", border: "1px solid rgba(100,200,100,0.3)", borderRadius: 5, color: "#88dd99", fontSize: 10, cursor: "pointer" }}>+</button>
              </div>
            </div>
          )}

          {/* Party invite panel — search all Flock users */}
          {showPartyInvite && myParty && (
            <InvitePanel
              myParty={myParty}
              myUserId={userId}
              partyInviteSent={partyInviteSent}
              onSend={sendPartyDmInvite}
              onClose={() => setShowPartyInvite(false)}
            />
          )}

          {/* No party — create or join */}
          {!myParty && (
            <div style={{ pointerEvents: "all" }}>
              <button
                onClick={() => setShowPartyPanel(p => !p)}
                style={{
                  background: "rgba(8,14,24,0.9)", border: "1px solid rgba(100,200,100,0.25)",
                  borderRadius: 8, padding: "6px 10px", color: "#66dd88", fontSize: 11,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
                  boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
                }}
              >
                ⚔️ Party
              </button>
            </div>
          )}

          {/* Friend parties / create panel */}
          {showPartyPanel && (
            <div style={{
              position: "absolute", bottom: "100%", left: 0, marginBottom: 6,
              background: "rgba(6,10,18,0.97)", border: "1px solid rgba(100,200,100,0.3)",
              borderRadius: 10, padding: "10px 12px", minWidth: 200,
              boxShadow: "0 4px 24px rgba(0,0,0,0.6)", pointerEvents: "all",
            }}>
              <div style={{ fontSize: 12, color: "#88dd99", fontWeight: 700, marginBottom: 8 }}>⚔️ Town Parties</div>
              {!myParty && (
                <button onClick={() => { createPartyAction(); setShowPartyPanel(false); }} style={{
                  width: "100%", padding: "6px 0", marginBottom: 8,
                  background: "linear-gradient(90deg, rgba(50,180,80,0.3), rgba(30,120,60,0.3))",
                  border: "1px solid rgba(80,200,100,0.4)", borderRadius: 7,
                  color: "#88ff99", fontSize: 11, cursor: "pointer", fontWeight: 700,
                }}>
                  ✨ Create New Party
                </button>
              )}
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>
                {friendParties.length > 0 ? "Friend Parties:" : "No friend parties open"}
              </div>
              {friendParties.filter(p => p.id !== myParty?.id).map(p => (
                <div key={p.id} style={{
                  display: "flex", alignItems: "center", gap: 6, marginBottom: 5,
                  padding: "5px 7px", background: "rgba(255,255,255,0.04)", borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.07)",
                }}>
                  {p.leaderAvatar ? (
                    <img src={p.leaderAvatar} alt="" style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover" }} />
                  ) : <span style={{ fontSize: 14 }}>👑</span>}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}>{p.leaderName}&apos;s Party</div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{p.members.length}/{p.maxSize} members</div>
                  </div>
                  {!myParty && p.members.length < p.maxSize && (
                    <button onClick={() => { joinPartyAction(p.id); setShowPartyPanel(false); }} style={{
                      padding: "2px 7px", background: "rgba(100,200,100,0.15)",
                      border: "1px solid rgba(100,200,100,0.35)", borderRadius: 5,
                      color: "#88dd99", fontSize: 10, cursor: "pointer",
                    }}>Join</button>
                  )}
                </div>
              ))}
              <button onClick={() => setShowPartyPanel(false)} style={{ marginTop: 4, fontSize: 10, color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer", width: "100%" }}>close</button>
            </div>
          )}
        </div>
      )}

      {/* ── House Interior Overlay ── */}
      {openHouse && (
        <HouseInterior
          userId={openHouse.userId}
          viewerId={userId}
          username={openHouse.username}
          onClose={() => setOpenHouse(null)}
        />
      )}

      {/* ── Theater Room ────────────────────────────────────────────────────────── */}
      {theaterOpen && (
        <TheaterRoom
          theaterState={theaterState}
          userId={userId}
          username={username}
          avatarUrl={avatarUrl}
          myCoins={myCoinsRef.current}
          hostId={theaterState?.hostId ?? null}
          partyId={partyIdRef.current ?? null}
          theaterChat={theaterChat}
          onClose={closeTheater}
          onSetVideo={async (videoUrl: string) => {
            const r = await fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "theater-set-video", videoUrl, partyId: partyIdRef.current }) });
            const d = await r.json();
            if (!d.ok) throw new Error(d.error ?? "Failed");
            setMyCoins(c => c - 50);
            myCoinsRef.current -= 50;
            const now = Date.now();
            const updated = { videoUrl, startedAt: now, hostId: userId, seats: theaterStateRef.current?.seats ?? {}, isPaused: false, pausedAt: null };
            setTheaterState(updated);
            theaterStateRef.current = updated;
          }}
          onClearVideo={async () => {
            await fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "theater-clear-video", partyId: partyIdRef.current }) });
            const cleared = { videoUrl: null, startedAt: null, hostId: null, seats: theaterStateRef.current?.seats ?? {}, isPaused: false, pausedAt: null };
            setTheaterState(cleared);
            theaterStateRef.current = cleared;
          }}
          onPause={async () => {
            await fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "theater-pause", partyId: partyIdRef.current }) });
            const cur = theaterStateRef.current;
            if (cur) {
              const updated = { ...cur, isPaused: true, pausedAt: Date.now() };
              setTheaterState(updated); theaterStateRef.current = updated;
            }
          }}
          onUnpause={async () => {
            await fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "theater-unpause", partyId: partyIdRef.current }) });
            const cur = theaterStateRef.current;
            if (cur) {
              const pausedDuration = cur.pausedAt ? Date.now() - cur.pausedAt : 0;
              const updated = { ...cur, isPaused: false, pausedAt: null, startedAt: cur.startedAt ? cur.startedAt + pausedDuration : cur.startedAt };
              setTheaterState(updated); theaterStateRef.current = updated;
            }
          }}
          onSeek={async (newStartedAt: number) => {
            await fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "theater-seek", newStartedAt, partyId: partyIdRef.current }) });
            const cur = theaterStateRef.current;
            if (cur) {
              const updated = { ...cur, startedAt: newStartedAt, isPaused: false, pausedAt: null };
              setTheaterState(updated); theaterStateRef.current = updated;
            }
          }}
          onSit={(seatIdx: number) => {
            fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "theater-sit", seatIdx, partyId: partyIdRef.current }) }).catch(() => {});
          }}
          onStand={() => {
            fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "theater-stand", partyId: partyIdRef.current }) }).catch(() => {});
          }}
          onChat={async (message: string) => {
            await fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "theater-chat", message, partyId: partyIdRef.current }) });
            // Optimistic update
            const newMsg = { userId, username, avatarUrl: avatarUrl ?? "", message, createdAt: Date.now() };
            setTheaterChat(prev => [...prev, newMsg]);
          }}
        />
      )}
    </div>
  );
}
