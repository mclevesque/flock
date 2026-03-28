"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { cardLabel, GameState, BIG_BLIND, SMALL_BLIND } from "@/lib/poker-engine";

interface Player {
  user_id: string;
  username: string;
  avatar_url: string | null;
  seat: number;
  chips: number;
  status: string;
  is_bot?: boolean;
}

interface RoomInfo {
  id: string;
  name: string;
  status: string;
  max_players: number;
  buy_in: number;
  host_id: string;
}

interface TableState {
  room: RoomInfo;
  players: Player[];
  state: GameState;
}

interface Props {
  roomId: string;
  sessionUserId: string | null;
  sessionUsername: string | null;
  sessionAvatar: string | null;
}

// ── Web Audio Sounds ─────────────────────────────────────────────────────────

function getAudioCtx(): AudioContext | null {
  try {
    return new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  } catch { return null; }
}

function playDealSound() {
  const ctx = getAudioCtx(); if (!ctx) return;
  const n = 3;
  for (let i = 0; i < n; i++) {
    setTimeout(() => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "triangle";
      osc.frequency.setValueAtTime(600 + i * 120, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start(); osc.stop(ctx.currentTime + 0.09);
    }, i * 80);
  }
}

function playChipSound() {
  const ctx = getAudioCtx(); if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(1200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.06);
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
  osc.start(); osc.stop(ctx.currentTime + 0.08);
}

function playWinSound() {
  const ctx = getAudioCtx(); if (!ctx) return;
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    setTimeout(() => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(); osc.stop(ctx.currentTime + 0.35);
    }, i * 120);
  });
}

function playYourTurnSound() {
  const ctx = getAudioCtx(); if (!ctx) return;
  [880, 1100].forEach((freq, i) => {
    setTimeout(() => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.start(); osc.stop(ctx.currentTime + 0.2);
    }, i * 120);
  });
}

function sfxShuffle() {
  const ctx = getAudioCtx(); if (!ctx) return;
  // White noise burst (riffle shuffle)
  const sampleRate = ctx.sampleRate;
  const bufLen = Math.floor(sampleRate * 0.55);
  const buf = ctx.createBuffer(1, bufLen, sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * 0.12;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.35, ctx.currentTime);
  g.gain.linearRampToValueAtTime(0.0, ctx.currentTime + 0.55);
  src.connect(g); g.connect(ctx.destination);
  src.start(); src.stop(ctx.currentTime + 0.55);
  // Card click taps
  [0, 55, 115, 180, 250, 310].forEach((ms, i) => {
    setTimeout(() => {
      const o = ctx.createOscillator(), gn = ctx.createGain();
      o.connect(gn); gn.connect(ctx.destination);
      o.type = "triangle";
      o.frequency.setValueAtTime(700 + i * 50, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.045);
      gn.gain.setValueAtTime(0.14, ctx.currentTime);
      gn.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      o.start(); o.stop(ctx.currentTime + 0.06);
    }, ms);
  });
}

function sfxAllIn() {
  const ctx = getAudioCtx(); if (!ctx) return;
  [180, 240, 320, 426, 568, 756, 1008].forEach((freq, i) => {
    setTimeout(() => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = "sawtooth";
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      g.gain.setValueAtTime(0.08, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      o.start(); o.stop(ctx.currentTime + 0.28);
    }, i * 65);
  });
}

function sfxEpicHand() {
  const ctx = getAudioCtx(); if (!ctx) return;
  // Triumphant fanfare
  const melody = [523, 659, 784, 1047, 1319, 1568, 2093];
  melody.forEach((freq, i) => {
    [0, 1].forEach(voice => {
      setTimeout(() => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = voice === 0 ? "sine" : "triangle";
        o.frequency.setValueAtTime(freq * (voice === 1 ? 0.5 : 1), ctx.currentTime);
        g.gain.setValueAtTime(0.1, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        o.start(); o.stop(ctx.currentTime + 0.45);
      }, i * 100 + voice * 20);
    });
  });
}

// ── Curated GIPHY reaction GIFs for epic hands ─────────────────────────────
const HAND_GIFS: Record<string, string[]> = {
  "Royal Flush": [
    "https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif",
    "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",
  ],
  "Straight Flush": [
    "https://media.giphy.com/media/3o7TKsQ8MQ4GlMbMas/giphy.gif",
    "https://media.giphy.com/media/l0HlNaQ6gWfllcjDO/giphy.gif",
  ],
  "Four of a Kind": [
    "https://media.giphy.com/media/3otPoS81loriI9sO8o/giphy.gif",
    "https://media.giphy.com/media/l46Cgctby6KLiGAze/giphy.gif",
  ],
  "Full House": [
    "https://media.giphy.com/media/26tOZ42Mg6pbTUPHW/giphy.gif",
    "https://media.giphy.com/media/LOsf4QEWWkTKM/giphy.gif",
  ],
};
const EPIC_HAND_NAMES = new Set(["Royal Flush", "Straight Flush", "Four of a Kind", "Full House"]);

function GiphyOverlay({ handName, winner }: { handName: string; winner: string }) {
  const gifs = HAND_GIFS[handName] ?? HAND_GIFS["Full House"]!;
  const gif = gifs[Math.floor(Math.random() * gifs.length)];
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.82)", backdropFilter: "blur(8px)",
      animation: "fadeInOut 4s ease forwards",
      pointerEvents: "none",
    }}>
      <style>{`
        @keyframes fadeInOut {
          0%   { opacity: 0; transform: scale(0.85); }
          12%  { opacity: 1; transform: scale(1.05); }
          20%  { transform: scale(1); }
          75%  { opacity: 1; }
          100% { opacity: 0; transform: scale(1.1); }
        }
        @keyframes dealSlide {
          from { opacity: 0; transform: translateY(-30px) scale(0.7); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div style={{
        fontSize: 13, color: "#fbbf24", fontWeight: 900, letterSpacing: 3,
        textTransform: "uppercase", marginBottom: 12, textShadow: "0 0 20px gold",
      }}>
        🔥 {handName}! 🔥
      </div>
      <img src={gif} alt={handName}
        style={{ maxWidth: 380, maxHeight: 280, borderRadius: 16, border: "3px solid gold", boxShadow: "0 0 40px rgba(255,215,0,0.5)" }}
        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
      <div style={{ marginTop: 14, fontSize: 18, fontWeight: 800, color: "#fff", textShadow: "0 0 12px rgba(255,255,255,0.6)" }}>
        {winner}
      </div>
    </div>
  );
}

// ── Card rendering ────────────────────────────────────────────────────────────

function CardFace({ card, small = false }: { card: string; small?: boolean }) {
  const hidden = card === "??" || !card;
  const sz = small ? 36 : 54;
  const fsz = small ? 12 : 18;
  if (hidden) {
    return (
      <div style={{
        width: sz, height: sz * 1.4, borderRadius: 6,
        background: "linear-gradient(135deg, #1e3a5f, #0f1e33)",
        border: "2px solid #2d5a8e", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: fsz, color: "#2d5a8e",
      }}>🂠</div>
    );
  }
  const { rank, suit, color } = cardLabel(card);
  return (
    <div style={{
      width: sz, height: sz * 1.4, borderRadius: 6,
      background: "#fff", border: "1px solid #ddd",
      display: "flex", flexDirection: "column",
      alignItems: "flex-start", justifyContent: "flex-start",
      padding: "2px 4px", flexShrink: 0, boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
    }}>
      <span style={{ fontSize: fsz, fontWeight: 900, color, lineHeight: 1 }}>{rank}</span>
      <span style={{ fontSize: fsz, color, lineHeight: 1 }}>{suit}</span>
    </div>
  );
}

const SEAT_POSITIONS: { top: string; left: string; transform: string }[] = [
  { top: "85%", left: "50%",  transform: "translate(-50%, -50%)" },
  { top: "85%", left: "25%",  transform: "translate(-50%, -50%)" },
  { top: "65%", left: "8%",   transform: "translate(-50%, -50%)" },
  { top: "35%", left: "8%",   transform: "translate(-50%, -50%)" },
  { top: "15%", left: "25%",  transform: "translate(-50%, -50%)" },
  { top: "15%", left: "50%",  transform: "translate(-50%, -50%)" },
  { top: "15%", left: "75%",  transform: "translate(-50%, -50%)" },
  { top: "35%", left: "92%",  transform: "translate(-50%, -50%)" },
  { top: "65%", left: "92%",  transform: "translate(-50%, -50%)" },
];

function SeatBox({
  player, state, isMe, betAmount, isBestCards, isHost, onRemoveBot, isSpeaking,
}: {
  player: Player; state: GameState; isMe: boolean;
  betAmount: number; isBestCards: boolean;
  isHost?: boolean; onRemoveBot?: (botId: string) => void;
  isSpeaking?: boolean;
}) {
  const isActive = state.actionOn === player.user_id;
  const isFolded = state.folded.includes(player.user_id);
  const isAllIn = state.allIn.includes(player.user_id);
  const isDealer = state.dealerUserId === player.user_id;
  const isSB = state.sbUserId === player.user_id;
  const isBB = state.bbUserId === player.user_id;
  const cards = state.hands?.[player.user_id] ?? [];
  const handRank = state.handRanks?.[player.user_id];
  const isWinner = state.winners?.includes(player.user_id);
  const isChampion = (state as unknown as { championId?: string }).championId === player.user_id;
  const isGameWinner = (state as unknown as { gameWinnerId?: string }).gameWinnerId === player.user_id;

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      opacity: isFolded ? 0.4 : 1,
      filter: isFolded ? "grayscale(80%)" : "none",
      transition: "all 0.3s",
    }}>
      {cards.length > 0 && (
        <div style={{ display: "flex", gap: 3, marginBottom: 2 }}>
          {cards.map((c, i) => <CardFace key={i} card={c} small />)}
        </div>
      )}
      {handRank && (
        <div style={{ fontSize: 9, color: isWinner ? "#fbbf24" : "#94a3b8", fontWeight: 700, textAlign: "center", maxWidth: 90, lineHeight: 1.2 }}>
          {isWinner ? "🏆 " : ""}{handRank.name}
        </div>
      )}
      <div style={{
        position: "relative", borderRadius: "50%", padding: 2,
        background: isActive ? "linear-gradient(135deg, #d97706, #f59e0b)" : isWinner ? "linear-gradient(135deg, #16a34a, #4ade80)" : "transparent",
        boxShadow: isActive ? "0 0 16px rgba(245,158,11,0.8)" : "none",
        transition: "all 0.3s",
      }}>
        <img
          src={player.avatar_url ?? `https://api.dicebear.com/9.x/pixel-art/svg?seed=${player.username}`}
          alt={player.username}
          style={{ width: 46, height: 46, borderRadius: "50%", display: "block" }}
        />
        {isDealer && (
          <div style={{ position: "absolute", top: -6, right: -6, background: "#fff", color: "#000", borderRadius: "50%", width: 18, height: 18, fontSize: 9, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #000" }}>D</div>
        )}
        {!isDealer && isSB && (
          <div style={{ position: "absolute", top: -6, right: -6, background: "#3b82f6", color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 8, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>SB</div>
        )}
        {!isDealer && !isSB && isBB && (
          <div style={{ position: "absolute", top: -6, right: -6, background: "#8b5cf6", color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 8, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>BB</div>
        )}
        {isAllIn && (
          <div style={{ position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)", background: "#ef4444", color: "#fff", borderRadius: 6, padding: "1px 5px", fontSize: 8, fontWeight: 900, whiteSpace: "nowrap" }}>ALL IN</div>
        )}
        {/* Bot badge */}
        {player.is_bot && (
          <div style={{ position: "absolute", bottom: -4, right: -4, background: "#7c3aed", color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>🤖</div>
        )}
        {/* Champion crown */}
        {isChampion && (
          <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", fontSize: 16, lineHeight: 1, filter: "drop-shadow(0 0 4px gold)" }}>👑</div>
        )}
        {/* Game winner glow */}
        {isGameWinner && (
          <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", fontSize: 16, lineHeight: 1 }}>🏆</div>
        )}
        {/* Mic indicator */}
        {isSpeaking && (
          <div style={{
            position: "absolute", bottom: -6, left: -6,
            width: 18, height: 18, borderRadius: "50%",
            background: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, boxShadow: "0 0 8px #4ade80",
            animation: "micPulse 0.6s ease-in-out infinite alternate",
          }}>🎤</div>
        )}
      </div>
      <div style={{
        background: isMe ? "rgba(139,92,246,0.25)" : "rgba(0,0,0,0.6)",
        border: `1px solid ${isMe ? "#7c3aed" : "#2a2d3a"}`,
        borderRadius: 8, padding: "4px 10px", textAlign: "center",
        minWidth: 80, backdropFilter: "blur(4px)", position: "relative",
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#e8eaf6", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 90 }}>
          {isMe ? "You" : player.is_bot ? `🤖 ${player.username}` : `@${player.username}`}
        </div>
        <div style={{ fontSize: 13, fontWeight: 800, color: isBestCards ? "#fbbf24" : "#4ade80" }}>
          {Number(player.chips).toLocaleString()}
        </div>
        {/* Remove bot button for host */}
        {isHost && player.is_bot && onRemoveBot && (
          <button
            onClick={e => { e.stopPropagation(); onRemoveBot(player.user_id); }}
            title="Remove bot"
            style={{
              position: "absolute", top: -8, right: -8,
              background: "rgba(239,68,68,0.9)", border: "none", borderRadius: "50%",
              width: 16, height: 16, fontSize: 9, fontWeight: 900, color: "#fff",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              lineHeight: 1, padding: 0,
            }}
          >✕</button>
        )}
      </div>
      {betAmount > 0 && (
        <div style={{
          background: "radial-gradient(circle, #d97706, #92400e)", borderRadius: "50%", width: 34, height: 34,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 9, fontWeight: 900, color: "#fff", border: "2px solid #fbbf24",
          boxShadow: "0 2px 8px rgba(217,119,6,0.5)",
        }}>
          {betAmount >= 1000 ? `${(betAmount/1000).toFixed(1)}k` : betAmount}
        </div>
      )}
    </div>
  );
}

// Mobile player card (horizontal row)
function MobilePlayerRow({ player, state, isMe }: { player: Player; state: GameState; isMe: boolean }) {
  const isActive = state.actionOn === player.user_id;
  const isFolded = state.folded.includes(player.user_id);
  const isAllIn = state.allIn.includes(player.user_id);
  const isDealer = state.dealerUserId === player.user_id;
  const isSB = state.sbUserId === player.user_id;
  const isBB = state.bbUserId === player.user_id;
  const cards = state.hands?.[player.user_id] ?? [];
  const handRank = state.handRanks?.[player.user_id];
  const isWinner = state.winners?.includes(player.user_id);
  const bet = state.roundBets?.[player.user_id] ?? 0;
  const isChampion = (state as unknown as { championId?: string }).championId === player.user_id;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 14px",
      background: isActive ? "rgba(245,158,11,0.1)" : isWinner ? "rgba(22,163,74,0.1)" : "rgba(255,255,255,0.03)",
      borderRadius: 12,
      border: `1px solid ${isActive ? "#d97706" : isWinner ? "#16a34a" : "#1e2130"}`,
      opacity: isFolded ? 0.4 : 1,
      transition: "all 0.2s",
      marginBottom: 6,
    }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <img src={player.avatar_url ?? `https://api.dicebear.com/9.x/pixel-art/svg?seed=${player.username}`}
          alt={player.username}
          style={{ width: 36, height: 36, borderRadius: "50%", border: `2px solid ${isActive ? "#d97706" : "#2a2d3a"}` }}
        />
        {isDealer && <div style={{ position: "absolute", top: -4, right: -4, background: "#fff", color: "#000", borderRadius: "50%", width: 14, height: 14, fontSize: 7, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #000" }}>D</div>}
        {!isDealer && isSB && <div style={{ position: "absolute", top: -4, right: -4, background: "#3b82f6", color: "#fff", borderRadius: "50%", width: 14, height: 14, fontSize: 7, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>SB</div>}
        {!isDealer && !isSB && isBB && <div style={{ position: "absolute", top: -4, right: -4, background: "#8b5cf6", color: "#fff", borderRadius: "50%", width: 14, height: 14, fontSize: 7, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>BB</div>}
        {player.is_bot && <div style={{ position: "absolute", bottom: -4, right: -4, fontSize: 10 }}>🤖</div>}
        {isChampion && <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", fontSize: 12, lineHeight: 1 }}>👑</div>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: isMe ? "#a78bfa" : "#e8eaf6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {isMe ? "You" : player.is_bot ? `🤖 ${player.username}` : `@${player.username}`}
          {isAllIn && <span style={{ color: "#ef4444", fontSize: 10, marginLeft: 6 }}>ALL IN</span>}
        </div>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#4ade80" }}>{Number(player.chips).toLocaleString()}</div>
        {handRank && <div style={{ fontSize: 10, color: isWinner ? "#fbbf24" : "#6b7280" }}>{isWinner ? "🏆 " : ""}{handRank.name}</div>}
      </div>
      <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
        {cards.map((c, i) => <CardFace key={i} card={c} small />)}
      </div>
      {bet > 0 && (
        <div style={{
          background: "radial-gradient(circle, #d97706, #92400e)", borderRadius: "50%",
          width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 9, fontWeight: 900, color: "#fff", border: "2px solid #fbbf24", flexShrink: 0,
        }}>
          {bet >= 1000 ? `${(bet/1000).toFixed(1)}k` : bet}
        </div>
      )}
    </div>
  );
}

export default function PokerTable({ roomId, sessionUserId, sessionUsername, sessionAvatar }: Props) {
  const [data, setData] = useState<TableState | null>(null);
  const [raiseVal, setRaiseVal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [botLoading, setBotLoading] = useState(false);
  const [chatMsg, setChatMsg] = useState("");
  const [chatLog, setChatLog] = useState<{ user: string; msg: string; id?: string }[]>([]);
  const lastBotTrashRef = useRef<number>(0);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileTab, setMobileTab] = useState<"table" | "log" | "chat">("table");
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // ── New feature state ─────────────────────────────────────────────────────
  const [giphyOverlay, setGiphyOverlay] = useState<{ handName: string; winner: string } | null>(null);
  const [showShuffleAnim, setShowShuffleAnim] = useState(false);
  const [speakingPlayers, setSpeakingPlayers] = useState<Set<string>>(new Set());
  const [micEnabled, setMicEnabled] = useState(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const speakingRef = useRef(false);
  const speakCheckRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const prevPhaseRef = useRef<string>("");

  // For sound tracking
  const prevHandNumber = useRef<number>(-1);
  const prevMyTurn = useRef<boolean>(false);
  const prevLogLen = useRef<number>(0);
  const prevWinners = useRef<string[]>([]);
  const prevAllInCount = useRef<number>(0);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`/api/poker/${roomId}`, { cache: "no-store" });
      if (!res.ok) { setLoading(false); return; }
      const d: TableState = await res.json();
      setData(d);
      setLoading(false);

      const st = d.state;
      const extSt = st as unknown as {
        chatHistory?: { user: string; msg: string; id: string }[];
        speakingPlayers?: Record<string, number>;
        gameWinnerId?: string | null;
      };

      // ── Chat sync ──
      if (extSt.chatHistory && extSt.chatHistory.length > 0) {
        setChatLog(extSt.chatHistory.slice(-50));
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
      }

      // ── Speaking players ──
      if (extSt.speakingPlayers) {
        const now = Date.now();
        const active = new Set(
          Object.entries(extSt.speakingPlayers)
            .filter(([, ts]) => now - Number(ts) < 3500)
            .map(([id]) => id)
        );
        setSpeakingPlayers(active);
      }

      // ── Sound triggers ──
      const isMyTurn = st.actionOn === sessionUserId;
      const logLen = st.actionLog?.length ?? 0;
      const winners = st.winners ?? [];
      const allInCount = (st.allIn ?? []).length;

      // New hand → shuffle animation + sound
      if (prevHandNumber.current !== -1 && st.handNumber > prevHandNumber.current) {
        sfxShuffle();
        setShowShuffleAnim(true);
        setTimeout(() => setShowShuffleAnim(false), 900);
        setTimeout(() => playDealSound(), 600);
      }
      // My turn
      if (!prevMyTurn.current && isMyTurn) playYourTurnSound();

      // Chip sound on new bet/raise/call
      if (logLen > prevLogLen.current) {
        const lastActions = st.actionLog?.slice(prevLogLen.current) ?? [];
        const hasBet = lastActions.some(a => ["bet", "raise", "call", "allin"].includes(a.action));
        if (hasBet) playChipSound();
      }

      // All-in sound (new all-in this update)
      if (allInCount > prevAllInCount.current) sfxAllIn();

      // Win/showdown — check for epic hands
      if (winners.length > 0 && prevWinners.current.length === 0) {
        playWinSound();
        // Check if any winner has an epic hand
        const epicWinner = winners.find(uid => {
          const rank = st.handRanks?.[uid];
          return rank && EPIC_HAND_NAMES.has(rank.name);
        });
        if (epicWinner) {
          const handName = st.handRanks![epicWinner].name;
          const winnerPlayer = d.players.find(p => p.user_id === epicWinner);
          const winnerLabel = epicWinner === sessionUserId ? "🎉 YOU!" : winnerPlayer?.is_bot ? `🤖 ${winnerPlayer.username}` : `@${winnerPlayer?.username ?? epicWinner}`;
          sfxEpicHand();
          setGiphyOverlay({ handName, winner: winnerLabel });
          setTimeout(() => setGiphyOverlay(null), 4200);
        }
      }

      // Trigger bot trash talk on showdown win
      if (winners.length > 0 && prevWinners.current.length === 0) {
        const allPlayers: Player[] = Array.isArray(d?.players) ? d.players : [];
        const winnerBot = allPlayers.find((p: Player) => p.user_id === winners[0] && p.is_bot);
        if (winnerBot && st.phase !== prevPhaseRef.current) {
          triggerBotTrash(winnerBot.username, "win");
        }
      }
      prevPhaseRef.current = st.phase;

      prevHandNumber.current = st.handNumber;
      prevMyTurn.current = isMyTurn;
      prevLogLen.current = logLen;
      prevWinners.current = winners;
      prevAllInCount.current = allInCount;
    } catch { /* ignore */ }
  }, [roomId, sessionUserId]);

  useEffect(() => {
    fetchState();
    pollRef.current = setInterval(fetchState, 4000);
    return () => {
      clearInterval(pollRef.current);
      stopMic();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchState]);

  // ── Mic management ────────────────────────────────────────────────────────
  function stopMic() {
    clearInterval(speakCheckRef.current);
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current = null;
    analyserRef.current = null;
    micCtxRef.current?.close().catch(() => {});
    micCtxRef.current = null;
    setMicEnabled(false);
    if (speakingRef.current) {
      speakingRef.current = false;
      fetch(`/api/poker/${roomId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "speaking", isSpeaking: false }) }).catch(() => {});
    }
  }

  async function toggleMic() {
    if (micEnabled) { stopMic(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const src = ctx.createMediaStreamSource(stream);
      src.connect(analyser);
      micStreamRef.current = stream;
      analyserRef.current = analyser;
      micCtxRef.current = ctx;
      setMicEnabled(true);

      // Check speaking every 200ms — only send API update on state CHANGE
      speakCheckRef.current = setInterval(() => {
        if (!analyserRef.current) return;
        const bins = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(bins);
        const avg = bins.reduce((s, v) => s + v, 0) / bins.length;
        const nowSpeaking = avg > 18;
        if (nowSpeaking !== speakingRef.current) {
          speakingRef.current = nowSpeaking;
          fetch(`/api/poker/${roomId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "speaking", isSpeaking: nowSpeaking }),
          }).catch(() => {});
        }
      }, 200);
    } catch { /* mic permission denied */ }
  }

  useEffect(() => {
    if (data?.state) {
      const min = Math.min((data.state.minRaise ?? BIG_BLIND) + (data.state.currentBet ?? 0), 99999);
      setRaiseVal(min);
    }
  }, [data?.state?.phase, data?.state?.handNumber]);

  async function doAction(action: string, amount?: number) {
    setActionLoading(true);
    try {
      await fetch(`/api/poker/${roomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, amount }),
      });
      await fetchState();
    } catch { /* ignore */ }
    setActionLoading(false);
  }

  async function addBot() {
    setBotLoading(true);
    try {
      await fetch(`/api/poker/${roomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add-bot" }),
      });
      await fetchState();
    } catch { /* ignore */ }
    setBotLoading(false);
  }

  async function removeBot(botId: string) {
    try {
      await fetch(`/api/poker/${roomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove-bot", botId }),
      });
      await fetchState();
    } catch { /* ignore */ }
  }

  function sendChat(e: React.FormEvent) {
    e.preventDefault();
    const msg = chatMsg.trim();
    if (!msg || !sessionUsername) return;
    setChatMsg("");
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    // Optimistic update
    setChatLog(l => [...l.slice(-49), { user: sessionUsername, msg, id }]);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    // Persist to server
    fetch(`/api/poker/${roomId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "chat", message: msg }),
    }).catch(() => {});
  }

  // Bot trash talk — fires at key moments, each bot has its own personality
  const BOT_PERSONALITIES: Record<string, { win: string[]; allin: string[]; bust: string[]; bad: string[] }> = {
    "Chip Ace": {
      win:   ["Read you like an open book 📖", "Aces always win, baby 🃏", "Was that your best? Cute.", "I was born for this 💎", "Chip Ace delivers again, baby!"],
      allin: ["All in? Already sweating? 👀", "Bold move. Foolish, but bold.", "That desperation smell... love it 😂"],
      bust:  ["Pack it up, rookie 💼", "Thanks for the chips! 😇", "See you in the next life 👋"],
      bad:   ["Lucky. Don't get comfortable.", "Cards betrayed me — it happens. Once."],
    },
    "Lucky Lady": {
      win:   ["Luck + skill = me 💅", "You never had a chance, honey", "The goddess of cards strikes again ✨", "Kiss your chips goodbye 😘"],
      allin: ["Going all in? I respect the chaos 🎭", "Ooh, risky! I love it 💋"],
      bust:  ["Don't cry, sweetie 🫶", "Your chips look better in my stack", "Buh-bye! 👋💅"],
      bad:   ["Hmph. Fine. Next hand is mine.", "Even queens have off days 🙄"],
    },
    "Iron Mike": {
      win:   ["IRON FIST 🥊", "You got knocked out!", "Mike always wins. Always.", "Nobody beats Iron Mike at cards"],
      allin: ["ALL IN?! Let's GO!! 💪", "Now we're talking! FIGHT!"],
      bust:  ["KNOCKOUT 🥊", "Down goes Frazier!!", "You got TKO'd bro"],
      bad:   ["damn it", "ugghh that hand cost me", "rematch. NOW."],
    },
    "The Shark": {
      win:   ["🦈 *circling*", "Blood in the water...", "The shark always feeds.", "I smelled weakness 3 hands ago"],
      allin: ["*fins appeared* 🦈", "Ohhh... fresh meat"],
      bust:  ["Swallowed whole 🦈", "*shark noises*", "Another one bites the felt"],
      bad:   ["...", "hmm.", "that was... unexpected"],
    },
    "Cowboy Carl": {
      win:   ["Yeehaw! 🤠", "This ain't my first rodeo, partner!", "You got lassoed good, partner", "High noon, and I'm still standing 🌅"],
      allin: ["Well shoot, all in already? 🤠", "Saddle up, this is gettin' good!"],
      bust:  ["Ride off into the sunset, pardner 🌄", "Git along little doggie 🤠", "Round 'em up and move 'em out"],
      bad:   ["Dang it all to heck", "Well I'll be a son of a gun"],
    },
    "Bluffmaster": {
      win:   ["Was I bluffing? Were you? 🎭", "You'll never know what I had 😏", "The art of deception 🃏", "Every. Single. Time. 😈"],
      allin: ["Is this a bluff? I genuinely don't know 🤔", "Maybe I have it. Maybe I don't. 😏"],
      bust:  ["The master finishes you 🎭", "Bluffed you right into oblivion"],
      bad:   ["damn it — I was bluffing!", "okay that hand actually hurt ngl"],
    },
    "Poker Pete": {
      win:   ["Pete's law: Pete wins 📜", "Calculated. Surgical. Pete.", "Numbers don't lie, and neither do I 🔢", "Math is on my side always"],
      allin: ["All in? I've already calculated your odds... they're bad 📊"],
      bust:  ["GG, statistically speaking 📈", "Expected value delivered"],
      bad:   ["Statistically improbable. I'm annoyed.", "damn it — that shouldn't have happened"],
    },
    "Lady Luck": {
      win:   ["Lady Luck smiles on the bold 🍀", "Lucky? Sure. But also good.", "Fortune favors the fabulous 🌟"],
      allin: ["All in? The stars align... for me ⭐", "Ooh, fate is about to speak 🔮"],
      bust:  ["The universe had other plans for you 🌙", "Some souls just aren't destined to win 🍀"],
      bad:   ["Even luck takes a day off sometimes 😤", "The cosmos owe me one"],
    },
  };

  const DEFAULT_TRASH = {
    win:   ["Nice hand, mine was better 😏", "You never had a chance 💀", "GG already 🃏", "Too easy ngl"],
    allin: ["All in? Bold strategy 👀", "You seem nervous. Good.", "Classic rookie move lmao"],
    bust:  ["Thanks for the chips! 😇", "See you next time 👋", "Pack it up 💼"],
    bad:   ["damn it", "that was unlucky", "uggh"],
  };

  async function triggerBotTrash(botName: string, trigger: "win" | "allin" | "bust") {
    const now = Date.now();
    if (now - lastBotTrashRef.current < 8000) return; // max 1 trash per 8s
    lastBotTrashRef.current = now;

    // Pick personality-specific line first
    const personality = BOT_PERSONALITIES[botName] ?? DEFAULT_TRASH;
    const lines = personality[trigger] ?? personality.win;
    let msg = lines[Math.floor(Math.random() * lines.length)];

    // Try Groq occasionally (1 in 3 chance) for more variety
    if (Math.random() < 0.33) {
      try {
        const context = trigger === "win" ? "You just won a poker hand"
          : trigger === "allin" ? "Someone just went all-in"
          : "You just busted a player";
        const r = await fetch("/api/voice/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: `You are ${botName}, a poker bot with a strong personality. Say one short in-character line (max 12 words) reacting to: ${context}. Stay in character. No quotes, just the line.`,
            bot: "default",
            roomId: "",
          }),
        });
        if (r.ok) {
          const d = await r.json();
          if (d.answer && d.answer.length < 80) msg = d.answer;
        }
      } catch { /* fall back to pre-recorded */ }
    }

    const id = `bot_${Date.now()}_${Math.random().toString(36).slice(2,5)}`;
    setChatLog(l => [...l.slice(-49), { user: botName, msg, id }]);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    // Also save to server
    fetch(`/api/poker/${roomId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "chat", message: msg, isBot: true, botName }),
    }).catch(() => {});
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0d0f14", color: "#e8eaf6", fontSize: 18 }}>
        Loading table…
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0d0f14", color: "#e8eaf6" }}>
        Table not found.
      </div>
    );
  }

  const { room, players, state } = data;
  const extState = state as unknown as { gameWinnerId?: string | null; championId?: string | null; gameWins?: Record<string, number> };
  const me = players.find(p => p.user_id === sessionUserId);
  const isMyTurn = state.actionOn === sessionUserId;
  const myCards = state.hands?.[sessionUserId ?? ""] ?? [];
  const myBet = state.roundBets?.[sessionUserId ?? ""] ?? 0;
  const toCall = Math.max(0, (state.currentBet ?? 0) - myBet);
  const canCheck = toCall === 0;
  const isHost = room.host_id === sessionUserId;
  const isWaiting = state.phase === "waiting";
  const isShowdown = state.phase === "showdown";
  const minRaise = (state.minRaise ?? BIG_BLIND) + (state.currentBet ?? 0);
  const pot = state.pot + Object.values(state.roundBets ?? {}).reduce((s, v) => s + v, 0);
  const canStart = isHost && isWaiting && players.length >= 2 && !extState.gameWinnerId;
  const canAddBot = isHost && isWaiting && players.length < room.max_players;
  const gameWinner = extState.gameWinnerId ? players.find(p => p.user_id === extState.gameWinnerId) : null;
  const champion = extState.championId ? players.find(p => p.user_id === extState.championId) : null;
  const isBusted = me && me.chips === 0 && isWaiting;
  const canSitDown = isBusted;

  const myPlayer = me;
  const seatOrder: (Player | null)[] = Array(9).fill(null);
  if (myPlayer) {
    const myDbSeat = myPlayer.seat;
    for (const p of players) {
      const visualSeat = ((p.seat - myDbSeat) + 9) % 9;
      seatOrder[visualSeat] = p;
    }
  } else {
    for (const p of players) {
      if (p.seat < 9) seatOrder[p.seat] = p;
    }
  }

  // ── Action panel (shared between mobile + desktop) ─────────────────────
  const actionPanel = me && isMyTurn && !isWaiting ? (
    <div style={{ padding: isMobile ? "12px 16px" : 16, borderBottom: "1px solid #1e2130", background: isMobile ? "rgba(0,0,0,0.9)" : "transparent" }}>
      <div style={{ fontSize: 11, color: "#fbbf24", fontWeight: 700, marginBottom: 10, textTransform: "uppercase" as const, letterSpacing: 1 }}>
        ⚡ Your Turn
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button onClick={() => doAction("fold")} disabled={actionLoading}
          style={{ flex: 1, padding: "12px 0", borderRadius: 8, border: "none", background: "#1f2937", color: "#f87171", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
          Fold
        </button>
        {canCheck ? (
          <button onClick={() => doAction("check")} disabled={actionLoading}
            style={{ flex: 1, padding: "12px 0", borderRadius: 8, border: "none", background: "#1e3a5f", color: "#60a5fa", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
            Check
          </button>
        ) : (
          <button onClick={() => doAction("call")} disabled={actionLoading}
            style={{ flex: 1, padding: "12px 0", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #1d4ed8, #1e40af)", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
            Call {toCall.toLocaleString()}
          </button>
        )}
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: "#8890a4", fontWeight: 600 }}>RAISE TO</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: "#fbbf24" }}>{raiseVal.toLocaleString()}</span>
        </div>
        <input type="range" min={minRaise} max={me.chips} value={raiseVal}
          onChange={e => setRaiseVal(Number(e.target.value))}
          style={{ width: "100%", accentColor: "#d97706" }}
        />
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          {[0.33, 0.5, 0.75, 1].map(frac => {
            const v = Math.max(minRaise, Math.min(me.chips, Math.round(pot * frac)));
            const label = frac === 1 ? "Pot" : `${Math.round(frac * 100)}%`;
            return (
              <button key={frac} onClick={() => setRaiseVal(v)}
                style={{ flex: 1, padding: "5px 0", borderRadius: 6, background: "#1f2937", border: "1px solid #374151", color: "#9ca3af", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                {label}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => doAction("raise", raiseVal)} disabled={actionLoading || raiseVal > me.chips}
          style={{ flex: 1, padding: "12px 0", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #d97706, #b45309)", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", opacity: raiseVal > me.chips ? 0.5 : 1 }}>
          Raise {raiseVal.toLocaleString()}
        </button>
        <button onClick={() => doAction("allin")} disabled={actionLoading}
          style={{ padding: "12px 14px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #dc2626, #991b1b)", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
          All In
        </button>
      </div>
    </div>
  ) : null;

  // ── MOBILE LAYOUT ────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ minHeight: "100vh", background: "#0d0f14", display: "flex", flexDirection: "column", fontFamily: "'Segoe UI', sans-serif" }}>
        <style>{`
          @keyframes micPulse { from { box-shadow: 0 0 6px #4ade80; } to { box-shadow: 0 0 14px #4ade80, 0 0 24px rgba(74,222,128,0.4); } }
          @keyframes shuffleIn { 0% { opacity:0; transform:translate(-50%,-50%) scale(0.4) rotate(-8deg); } 60% { opacity:1; transform:translate(-50%,-50%) scale(1.08) rotate(1deg); } 100% { opacity:1; transform:translate(-50%,-50%) scale(1) rotate(0deg); } }
        `}</style>
        {giphyOverlay && <GiphyOverlay handName={giphyOverlay.handName} winner={giphyOverlay.winner} />}
        {showShuffleAnim && (
          <div style={{ position: "fixed", inset: 0, zIndex: 8000, pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 64, animation: "shuffleIn 0.9s cubic-bezier(0.175,0.885,0.32,1.275) forwards", position: "absolute", top: "50%", left: "50%" }}>🃏</div>
          </div>
        )}
        {/* Header */}
        <div style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", borderBottom: "1px solid #1e2130", padding: "10px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>🃏</span>
              <span style={{ color: "#e8eaf6", fontWeight: 800, fontSize: 14 }}>{room.name}</span>
              <span style={{ background: "rgba(22,163,74,0.2)", color: "#4ade80", padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700 }}>
                {room.status.toUpperCase()}
              </span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {!me && sessionUserId && room.status === "waiting" && (
                <button onClick={() => doAction("join")}
                  style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", border: "none", borderRadius: 8, padding: "6px 14px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  🪑 Sit
                </button>
              )}
              {canAddBot && (
                <button onClick={addBot} disabled={botLoading}
                  style={{ background: "linear-gradient(135deg, #7c3aed, #5b21b6)", border: "none", borderRadius: 8, padding: "6px 14px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: botLoading ? 0.6 : 1 }}>
                  🤖 Bot
                </button>
              )}
              {canStart && (
                <button onClick={() => doAction("start")} disabled={actionLoading}
                  style={{ background: "linear-gradient(135deg, #d97706, #b45309)", border: "none", borderRadius: 8, padding: "6px 14px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  ▶ Start
                </button>
              )}
              {isHost && extState.gameWinnerId && (
                <button onClick={() => doAction("new-game")} disabled={actionLoading}
                  style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", border: "none", borderRadius: 8, padding: "6px 14px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  🔄 New Game
                </button>
              )}
              {isBusted && (
                <button onClick={() => doAction("sit-down")} disabled={actionLoading}
                  style={{ background: "linear-gradient(135deg, #2563eb, #1d4ed8)", border: "none", borderRadius: 8, padding: "8px 16px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  💰 Buy Back In
                </button>
              )}
              {sessionUserId && (
                <button onClick={toggleMic} title={micEnabled ? "Mute" : "Enable mic"}
                  style={{ background: micEnabled ? "rgba(22,163,74,0.15)" : "rgba(255,255,255,0.06)", border: `1px solid ${micEnabled ? "#16a34a" : "#374151"}`, borderRadius: 8, padding: "5px 10px", color: micEnabled ? "#4ade80" : "#6b7280", fontSize: 14, cursor: "pointer" }}>
                  {micEnabled ? "🎤" : "🔇"}
                </button>
              )}
              {me && (
                <button onClick={() => doAction("leave")}
                  style={{ background: "transparent", border: "1px solid #4b5563", borderRadius: 8, padding: "6px 12px", color: "#6b7280", fontSize: 12, cursor: "pointer" }}>
                  Leave
                </button>
              )}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "#6b7280" }}>
            <span>Blinds: {SMALL_BLIND}/{BIG_BLIND}</span>
            <span>Hand #{state.handNumber}</span>
            {pot > 0 && <span style={{ color: "#fbbf24", fontWeight: 700 }}>🟡 Pot: {pot.toLocaleString()}</span>}
          </div>
        </div>

        {/* Community cards + winner */}
        <div style={{ background: "rgba(0,0,0,0.4)", borderBottom: "1px solid #1e2130", padding: "10px 14px" }}>
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: isShowdown ? 8 : 0 }}>
            {(state.communityCards ?? []).map((c, i) => <CardFace key={i} card={c} small />)}
            {Array.from({ length: Math.max(0, 5 - (state.communityCards?.length ?? 0)) }).map((_, i) => (
              <div key={i} style={{ width: 36, height: 50, borderRadius: 5, border: "2px dashed rgba(255,255,255,0.1)" }} />
            ))}
          </div>
          {isShowdown && state.winners && state.winners.length > 0 && (
            <div style={{ textAlign: "center", background: "rgba(22,163,74,0.2)", borderRadius: 8, padding: "6px 14px", marginTop: 6 }}>
              <div style={{ color: "#4ade80", fontSize: 13, fontWeight: 800 }}>
                🏆 {state.winners.map(uid => {
                  const p = players.find(pl => pl.user_id === uid);
                  return uid === sessionUserId ? "You win!" : p?.is_bot ? `🤖 ${p?.username} wins!` : `@${p?.username ?? uid} wins!`;
                }).join(" & ")}
              </div>
            </div>
          )}
          {!isWaiting && !isShowdown && (
            <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 10, textTransform: "uppercase" as const, letterSpacing: 2, marginTop: 4 }}>
              {state.phase}
            </div>
          )}
          {gameWinner && (
            <div style={{ textAlign: "center", background: "linear-gradient(135deg, rgba(22,163,74,0.3), rgba(16,122,55,0.2))", border: "1px solid #16a34a", borderRadius: 10, padding: "10px 14px", marginTop: 6 }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>🏆</div>
              <div style={{ color: "#4ade80", fontSize: 14, fontWeight: 800 }}>
                {gameWinner.user_id === sessionUserId ? "You win the game!" : gameWinner.is_bot ? `🤖 ${gameWinner.username} wins!` : `@${gameWinner.username} wins!`}
              </div>
              {champion && champion.user_id !== gameWinner.user_id && (
                <div style={{ color: "#fbbf24", fontSize: 11, marginTop: 4 }}>👑 Champion: {champion.user_id === sessionUserId ? "You" : champion.is_bot ? champion.username : `@${champion.username}`}</div>
              )}
            </div>
          )}
          {isWaiting && !gameWinner && (
            <div style={{ textAlign: "center", color: "#6b7280", fontSize: 12, marginTop: 4 }}>
              {players.length < 2 ? (isHost ? "Add a bot or wait for players…" : "Waiting for players…") : isHost ? "Press Start to begin" : "Waiting for host…"}
            </div>
          )}
        </div>

        {/* My hand */}
        {me && (
          <div style={{ padding: "10px 14px", background: "rgba(124,58,237,0.06)", borderBottom: "1px solid #1e2130" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ display: "flex", gap: 6 }}>
                {myCards.length > 0
                  ? myCards.map((c, i) => <CardFace key={i} card={c} small />)
                  : <span style={{ color: "#4b5563", fontSize: 13 }}>{isWaiting ? "Waiting for hand…" : "No cards"}</span>
                }
              </div>
              {state.handRanks?.[sessionUserId ?? ""] && (
                <div>
                  <div style={{ fontSize: 10, color: "#8890a4" }}>Best hand</div>
                  <div style={{ fontSize: 12, color: "#fbbf24", fontWeight: 800 }}>{state.handRanks[sessionUserId ?? ""].name}</div>
                </div>
              )}
              <div style={{ marginLeft: "auto", display: "flex", gap: 14 }}>
                <div style={{ textAlign: "center" as const }}>
                  <div style={{ fontSize: 9, color: "#8890a4" }}>CHIPS</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#4ade80" }}>{Number(me.chips).toLocaleString()}</div>
                </div>
                {toCall > 0 && (
                  <div style={{ textAlign: "center" as const }}>
                    <div style={{ fontSize: 9, color: "#8890a4" }}>TO CALL</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#f87171" }}>{toCall.toLocaleString()}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Action panel */}
        {actionPanel}

        {/* Tab nav */}
        <div style={{ display: "flex", borderBottom: "1px solid #1e2130", background: "rgba(0,0,0,0.4)" }}>
          {(["table", "log", "chat"] as const).map(tab => (
            <button key={tab} onClick={() => setMobileTab(tab)}
              style={{
                flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
                background: mobileTab === tab ? "rgba(124,58,237,0.15)" : "transparent",
                color: mobileTab === tab ? "#a78bfa" : "#6b7280",
                fontSize: 12, fontWeight: 700,
                borderBottom: mobileTab === tab ? "2px solid #7c3aed" : "2px solid transparent",
              }}>
              {tab === "table" ? "🃏 Players" : tab === "log" ? "📋 Log" : "💬 Chat"}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
          {mobileTab === "table" && (
            <div>
              {players.length === 0 ? (
                <div style={{ textAlign: "center" as const, color: "#4b5563", padding: 40, fontSize: 14 }}>No players yet</div>
              ) : (
                players.map(p => (
                  <MobilePlayerRow key={p.user_id} player={p} state={state} isMe={p.user_id === sessionUserId} />
                ))
              )}
              {!me && sessionUserId && room.status === "waiting" && (
                <button onClick={() => doAction("join")}
                  style={{ width: "100%", padding: "14px 0", borderRadius: 10, border: "2px dashed rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 6 }}>
                  + Take a Seat
                </button>
              )}
            </div>
          )}
          {mobileTab === "log" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {[...(state.actionLog ?? [])].reverse().slice(0, 30).map((entry, i) => (
                <div key={i} style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5, padding: "4px 0", borderBottom: "1px solid #1a1e2a" }}>
                  <span style={{ color: "#e8eaf6", fontWeight: 700 }}>@{entry.username}</span>{" "}
                  {entry.action}
                  {entry.amount > 0 && <span style={{ color: "#fbbf24" }}> {entry.amount.toLocaleString()}</span>}
                </div>
              ))}
              {(state.actionLog ?? []).length === 0 && (
                <div style={{ color: "#4b5563", textAlign: "center" as const, padding: 30 }}>No actions yet</div>
              )}
            </div>
          )}
          {mobileTab === "chat" && (
            <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 300 }}>
              <div style={{ flex: 1 }}>
                {chatLog.length === 0
                  ? <div style={{ color: "#4b5563", textAlign: "center" as const, padding: 30 }}>No messages yet</div>
                  : chatLog.slice(-30).map((c, i) => (
                    <div key={i} style={{ marginBottom: 6 }}>
                      <span style={{ color: "#c084fc", fontWeight: 700, fontSize: 12 }}>@{c.user}:</span>
                      <span style={{ color: "#94a3b8", fontSize: 13 }}> {c.msg}</span>
                    </div>
                  ))
                }
              </div>
              {sessionUserId && (
                <form onSubmit={sendChat} style={{ display: "flex", marginTop: 12, background: "rgba(255,255,255,0.05)", borderRadius: 10, overflow: "hidden" }}>
                  <input value={chatMsg} onChange={e => setChatMsg(e.target.value)} placeholder="Say something…" maxLength={120}
                    style={{ flex: 1, background: "transparent", border: "none", padding: "12px 14px", color: "#e8eaf6", fontSize: 13, outline: "none" }} />
                  <button type="submit" style={{ background: "none", border: "none", padding: "0 14px", color: "#a78bfa", cursor: "pointer", fontSize: 18 }}>→</button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── DESKTOP LAYOUT ───────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#0d0f14", display: "flex", flexDirection: "column", fontFamily: "'Segoe UI', sans-serif" }}>
      <style>{`
        @keyframes micPulse { from { box-shadow: 0 0 6px #4ade80; } to { box-shadow: 0 0 14px #4ade80, 0 0 24px rgba(74,222,128,0.4); } }
        @keyframes shuffleIn { 0% { opacity:0; transform:translate(-50%,-50%) scale(0.4) rotate(-8deg); } 60% { opacity:1; transform:translate(-50%,-50%) scale(1.08) rotate(1deg); } 100% { opacity:1; transform:translate(-50%,-50%) scale(1) rotate(0deg); } }
        @keyframes dealCard { from { opacity:0; transform:translateY(-40px) scale(0.6); } to { opacity:1; transform:translateY(0) scale(1); } }
      `}</style>
      {/* GIPHY Overlay */}
      {giphyOverlay && <GiphyOverlay handName={giphyOverlay.handName} winner={giphyOverlay.winner} />}
      {/* Shuffle animation */}
      {showShuffleAnim && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 8000, pointerEvents: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            fontSize: 64, animation: "shuffleIn 0.9s cubic-bezier(0.175,0.885,0.32,1.275) forwards",
            position: "absolute", top: "50%", left: "50%",
          }}>🃏</div>
        </div>
      )}
      {/* Header */}
      <div style={{
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
        borderBottom: "1px solid #1e2130",
        padding: "10px 20px", display: "flex", alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href="/poker" style={{ color: "#6b7280", fontSize: 18, textDecoration: "none", lineHeight: 1 }}>←</a>
          <span style={{ fontSize: 20 }}>🃏</span>
          <span style={{ color: "#e8eaf6", fontWeight: 800, fontSize: 16 }}>{room.name}</span>
          <span style={{ background: "rgba(22,163,74,0.2)", color: "#4ade80", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
            {room.status.toUpperCase()}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ color: "#8890a4", fontSize: 12 }}>Blinds: {SMALL_BLIND}/{BIG_BLIND}</span>
          <span style={{ color: "#8890a4", fontSize: 12 }}>•</span>
          <span style={{ color: "#8890a4", fontSize: 12 }}>Hand #{state.handNumber}</span>
          {!me && sessionUserId && room.status === "waiting" && (
            <button onClick={() => doAction("join")}
              style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", border: "none", borderRadius: 8, padding: "6px 18px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              🪑 Take a Seat
            </button>
          )}
          {canAddBot && (
            <button onClick={addBot} disabled={botLoading}
              style={{ background: "linear-gradient(135deg, #7c3aed, #5b21b6)", border: "none", borderRadius: 8, padding: "6px 18px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: botLoading ? 0.6 : 1 }}>
              🤖 Add Bot
            </button>
          )}
          {canStart && (
            <button onClick={() => doAction("start")} disabled={actionLoading}
              style={{ background: "linear-gradient(135deg, #d97706, #b45309)", border: "none", borderRadius: 8, padding: "6px 18px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              ▶ Start Game
            </button>
          )}
          {isHost && extState.gameWinnerId && (
            <button onClick={() => doAction("new-game")} disabled={actionLoading}
              style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", border: "none", borderRadius: 8, padding: "6px 18px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              🔄 New Game
            </button>
          )}
          {isBusted && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "stretch" }}>
              {extState.gameWinnerId && (
                <div style={{ fontSize: 11, color: "#fbbf24", textAlign: "center", marginBottom: 2 }}>Game over — buy back in?</div>
              )}
              <button onClick={() => doAction("sit-down")} disabled={actionLoading}
                style={{ background: "linear-gradient(135deg, #2563eb, #1d4ed8)", border: "none", borderRadius: 8, padding: "8px 18px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                💰 Buy Back In ({room?.buy_in?.toLocaleString() ?? "1,000"} chips)
              </button>
            </div>
          )}
          {/* Mic toggle */}
          {sessionUserId && (
            <button onClick={toggleMic} title={micEnabled ? "Mute mic" : "Enable mic"}
              style={{
                background: micEnabled ? "rgba(22,163,74,0.2)" : "rgba(255,255,255,0.06)",
                border: `1px solid ${micEnabled ? "#16a34a" : "#374151"}`,
                borderRadius: 8, padding: "6px 12px", color: micEnabled ? "#4ade80" : "#6b7280",
                fontSize: 16, cursor: "pointer",
                boxShadow: micEnabled && speakingRef.current ? "0 0 10px #4ade80" : "none",
              }}>
              {micEnabled ? "🎤" : "🔇"}
            </button>
          )}
          {me && (
            <button onClick={() => doAction("leave")}
              style={{ background: "transparent", border: "1px solid #4b5563", borderRadius: 8, padding: "6px 18px", color: "#8890a4", fontSize: 13, cursor: "pointer" }}>
              Leave
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", gap: 0 }}>
        {/* Main table area */}
        <div style={{ flex: 1, position: "relative", minHeight: 600 }}>
          {/* Felt oval */}
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: "70%", height: "60%",
            background: "radial-gradient(ellipse at center, #16552e 0%, #0d3d1e 60%, #0a2e15 100%)",
            border: "8px solid #5a3a1a", borderRadius: "50%",
            boxShadow: "0 0 60px rgba(0,0,0,0.8), inset 0 0 30px rgba(0,0,0,0.4)",
          }} />

          {/* Center info */}
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center", zIndex: 10 }}>
            <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 12 }}>
              {(state.communityCards ?? []).map((c, i) => <CardFace key={i} card={c} />)}
              {Array.from({ length: Math.max(0, 5 - (state.communityCards?.length ?? 0)) }).map((_, i) => (
                <div key={i} style={{ width: 54, height: 75, borderRadius: 6, border: "2px dashed rgba(255,255,255,0.15)" }} />
              ))}
            </div>
            {(state.pot > 0 || Object.values(state.roundBets ?? {}).some(v => v > 0)) && (
              <div style={{ background: "rgba(0,0,0,0.5)", borderRadius: 20, padding: "6px 18px", display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>🟡</span>
                <span style={{ color: "#fbbf24", fontWeight: 900, fontSize: 18 }}>{pot.toLocaleString()}</span>
              </div>
            )}
            {!isWaiting && (
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 4, textTransform: "uppercase" as const, letterSpacing: 2 }}>
                {state.phase}
              </div>
            )}
            {isShowdown && state.winners && state.winners.length > 0 && (
              <div style={{ marginTop: 8, background: "rgba(22,163,74,0.25)", border: "1px solid #16a34a", borderRadius: 10, padding: "6px 14px" }}>
                <div style={{ color: "#4ade80", fontSize: 13, fontWeight: 800 }}>
                  🏆 {state.winners.map(uid => {
                    const p = players.find(pl => pl.user_id === uid);
                    return uid === sessionUserId ? "You win!" : p?.is_bot ? `🤖 ${p?.username} wins!` : `@${p?.username ?? uid} wins!`;
                  }).join(" & ")}
                </div>
                {state.winners[0] && state.handRanks?.[state.winners[0]] && (
                  <div style={{ color: "#86efac", fontSize: 11 }}>{state.handRanks[state.winners[0]].name}</div>
                )}
              </div>
            )}
            {gameWinner && (
              <div style={{ marginTop: 10, background: "linear-gradient(135deg, rgba(22,163,74,0.3), rgba(16,122,55,0.2))", border: "1px solid #16a34a", borderRadius: 14, padding: "12px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>🏆</div>
                <div style={{ color: "#4ade80", fontSize: 16, fontWeight: 900 }}>
                  {gameWinner.user_id === sessionUserId ? "You win the game!" : gameWinner.is_bot ? `🤖 ${gameWinner.username} wins!` : `@${gameWinner.username} wins!`}
                </div>
                {champion && (
                  <div style={{ color: "#fbbf24", fontSize: 12, marginTop: 4 }}>👑 Champion: {champion.user_id === sessionUserId ? "You" : champion.is_bot ? champion.username : `@${champion.username}`}</div>
                )}
              </div>
            )}
            {isWaiting && !gameWinner && (
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 8 }}>
                {players.length < 2
                  ? (isHost ? "Add a bot or wait for players…" : "Waiting for players…")
                  : isHost ? "Press Start to begin" : "Waiting for host…"
                }
              </div>
            )}
          </div>

          {/* Player seats */}
          {SEAT_POSITIONS.map((pos, visualSeat) => {
            const player = seatOrder[visualSeat];
            if (!player) return null;
            const betAmount = state.roundBets?.[player.user_id] ?? 0;
            const isMe = player.user_id === sessionUserId;
            const isBestCards = !!(state.handRanks?.[player.user_id]) && !!(state.winners?.includes(player.user_id));
            return (
              <div key={player.user_id} style={{ position: "absolute", top: pos.top, left: pos.left, transform: pos.transform, zIndex: 20 }}>
                <SeatBox
                  player={player} state={state} isMe={isMe}
                  betAmount={betAmount} isBestCards={isBestCards}
                  isHost={isHost} onRemoveBot={isWaiting ? removeBot : undefined}
                  isSpeaking={speakingPlayers.has(player.user_id)}
                />
              </div>
            );
          })}

          {/* Empty seats */}
          {SEAT_POSITIONS.map((pos, visualSeat) => {
            if (seatOrder[visualSeat]) return null;
            if (visualSeat >= room.max_players) return null;
            return (
              <div key={`empty-${visualSeat}`} style={{ position: "absolute", top: pos.top, left: pos.left, transform: pos.transform, zIndex: 15 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                  {/* Ghost avatar ring */}
                  <div style={{
                    width: 50, height: 50, borderRadius: "50%",
                    border: "2px dashed rgba(255,255,255,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "rgba(255,255,255,0.2)", fontSize: 18,
                  }}>
                    {isHost && isWaiting ? "🤖" : "👤"}
                  </div>
                  {/* Action button */}
                  {isHost && isWaiting && canAddBot ? (
                    <button onClick={addBot} disabled={botLoading}
                      style={{
                        background: "rgba(124,58,237,0.15)", border: "1px dashed rgba(124,58,237,0.4)",
                        borderRadius: 8, padding: "4px 10px", color: "#a78bfa",
                        fontSize: 10, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                        opacity: botLoading ? 0.5 : 1,
                      }}>
                      + Add Bot
                    </button>
                  ) : !me && sessionUserId && room.status === "waiting" ? (
                    <button onClick={() => doAction("join")}
                      style={{
                        background: "rgba(22,163,74,0.1)", border: "1px dashed rgba(22,163,74,0.4)",
                        borderRadius: 8, padding: "4px 10px", color: "#4ade80",
                        fontSize: 10, fontWeight: 700, cursor: "pointer",
                      }}>
                      + Sit Here
                    </button>
                  ) : (
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontWeight: 600 }}>Empty</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right panel */}
        <div style={{ width: 300, background: "rgba(0,0,0,0.5)", borderLeft: "1px solid #1e2130", display: "flex", flexDirection: "column" }}>
          {/* My hand */}
          {me && (
            <div style={{ padding: 16, borderBottom: "1px solid #1e2130" }}>
              <div style={{ fontSize: 11, color: "#8890a4", fontWeight: 700, marginBottom: 10, textTransform: "uppercase" as const, letterSpacing: 1 }}>Your Hand</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {myCards.length > 0 ? (
                  <>
                    {myCards.map((c, i) => <CardFace key={i} card={c} />)}
                    {state.handRanks?.[sessionUserId ?? ""] && (
                      <div style={{ marginLeft: 8 }}>
                        <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>Best hand</div>
                        <div style={{ fontSize: 13, color: "#fbbf24", fontWeight: 800 }}>{state.handRanks[sessionUserId ?? ""].name}</div>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ color: "#4b5563", fontSize: 13 }}>{isWaiting ? "Waiting for hand to start…" : "No cards dealt"}</div>
                )}
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 12 }}>
                <div style={{ textAlign: "center" as const }}>
                  <div style={{ fontSize: 10, color: "#8890a4", fontWeight: 600 }}>CHIPS</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#4ade80" }}>{Number(me.chips).toLocaleString()}</div>
                </div>
                {myBet > 0 && <div style={{ textAlign: "center" as const }}>
                  <div style={{ fontSize: 10, color: "#8890a4", fontWeight: 600 }}>BET</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#fbbf24" }}>{myBet.toLocaleString()}</div>
                </div>}
                {toCall > 0 && <div style={{ textAlign: "center" as const }}>
                  <div style={{ fontSize: 10, color: "#8890a4", fontWeight: 600 }}>TO CALL</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#f87171" }}>{toCall.toLocaleString()}</div>
                </div>}
              </div>
            </div>
          )}

          {/* Action panel */}
          {actionPanel}

          {/* Action log */}
          <div style={{ flex: 1, padding: 12, overflowY: "auto", minHeight: 0 }}>
            <div style={{ fontSize: 11, color: "#8890a4", fontWeight: 700, marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: 1 }}>Action Log</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {[...(state.actionLog ?? [])].reverse().slice(0, 20).map((entry, i) => (
                <div key={i} style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.4 }}>
                  <span style={{ color: "#e8eaf6", fontWeight: 600 }}>{entry.username}</span>{" "}
                  {entry.action}
                  {entry.amount > 0 && <span style={{ color: "#fbbf24" }}> {entry.amount.toLocaleString()}</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Chat */}
          <div style={{ borderTop: "1px solid #1e2130", display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, padding: "6px 12px 2px", textTransform: "uppercase", letterSpacing: 1 }}>💬 Table Chat</div>
            <div style={{ maxHeight: 180, overflowY: "auto", padding: "4px 12px 8px" }}>
              {chatLog.length === 0 && (
                <div style={{ fontSize: 11, color: "#4b5563", fontStyle: "italic" }}>No messages yet — say hi!</div>
              )}
              {chatLog.map((c, i) => (
                <div key={c.id ?? i} style={{ fontSize: 11, color: "#94a3b8", marginBottom: 3, lineHeight: 1.4 }}>
                  <span style={{ color: c.user === sessionUsername ? "#a78bfa" : "#c084fc", fontWeight: 700 }}>@{c.user}:</span>{" "}
                  <span>{c.msg}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            {sessionUserId && (
              <form onSubmit={sendChat} style={{ display: "flex", borderTop: "1px solid #1e2130" }}>
                <input value={chatMsg} onChange={e => setChatMsg(e.target.value)} placeholder="Say something at the table…" maxLength={120}
                  style={{ flex: 1, background: "transparent", border: "none", padding: "10px 12px", color: "#e8eaf6", fontSize: 12, outline: "none" }} />
                <button type="submit" style={{ background: "none", border: "none", padding: "0 12px", color: "#a78bfa", cursor: "pointer", fontSize: 16 }}>→</button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
