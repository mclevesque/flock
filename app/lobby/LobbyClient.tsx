"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────
interface SnesRoom {
  id: string;
  host_id: string;
  host_username: string;
  host_avatar: string;
  game_name: string;
  status: string;
  ranked: boolean;
  guest_id?: string;
  guest_username?: string;
  guest_avatar?: string;
  game_started?: boolean;
  created_at: string;
}

interface MoonhavenRoom {
  id: string;
  playerCount: number;
  isPublic: boolean;
}

const SNES_ALL = [
  // Multiplayer
  { name: "Street Fighter II Turbo",  genre: "Fighting",    players: 2, emoji: "🥊" },
  { name: "Mortal Kombat II",          genre: "Fighting",    players: 2, emoji: "🩸" },
  { name: "Street Fighter Alpha 2",   genre: "Fighting",    players: 2, emoji: "🥊" },
  { name: "Killer Instinct",          genre: "Fighting",    players: 2, emoji: "⚔️" },
  { name: "Super Mario Kart",         genre: "Racing",      players: 2, emoji: "🏎️" },
  { name: "NBA Jam",                  genre: "Sports",      players: 2, emoji: "🏀" },
  { name: "Super Bomberman",          genre: "Party",       players: 2, emoji: "💣" },
  { name: "Turtles in Time",          genre: "Beat em up",  players: 2, emoji: "🐢" },
  { name: "Donkey Kong Country",      genre: "Platformer",  players: 2, emoji: "🦍" },
  { name: "Donkey Kong Country 2",    genre: "Platformer",  players: 2, emoji: "🦍" },
  { name: "Kirby Super Star",         genre: "Platformer",  players: 2, emoji: "⭐" },
  { name: "Super Mario World",        genre: "Platformer",  players: 2, emoji: "🍄" },
  { name: "Secret of Mana",           genre: "RPG",         players: 2, emoji: "🌿" },
  { name: "Contra III",               genre: "Action",      players: 2, emoji: "💥" },
  { name: "Sunset Riders",            genre: "Action",      players: 2, emoji: "🤠" },
  // Single Player (broadcast / watch mode)
  { name: "Super Mario RPG",          genre: "RPG",         players: 1, emoji: "🍄" },
  { name: "Chrono Trigger",           genre: "RPG",         players: 1, emoji: "⏳" },
  { name: "Zelda: A Link to the Past", genre: "Adventure",  players: 1, emoji: "🗡️" },
  { name: "Earthbound",               genre: "RPG",         players: 1, emoji: "🌏" },
  { name: "Mega Man X",               genre: "Action",      players: 1, emoji: "🤖" },
  { name: "Mega Man X3",              genre: "Action",      players: 1, emoji: "🤖" },
  { name: "Final Fantasy VI",         genre: "RPG",         players: 1, emoji: "⚔️" },
  { name: "F-Zero",                   genre: "Racing",      players: 1, emoji: "🏎️" },
  { name: "Star Fox",                 genre: "Action",      players: 1, emoji: "🦊" },
  { name: "Yoshi's Island",           genre: "Platformer",  players: 1, emoji: "🦕" },
];

// ── Shared styles (outside component to avoid re-creation) ────────────────────
const S = {
  card: {
    background: "rgba(26,20,8,0.95)",
    border: "1px solid rgba(212,169,66,0.15)",
    borderRadius: 12,
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    gap: 12,
    transition: "border-color 0.15s",
  } as React.CSSProperties,

  sectionHead: {
    fontFamily: "'Cinzel', serif",
    fontSize: 11,
    fontWeight: 700,
    color: "#8a6d2b",
    letterSpacing: "0.15em",
    textTransform: "uppercase" as const,
    marginBottom: 10,
    marginTop: 28,
  } as React.CSSProperties,

  joinBtn: {
    marginLeft: "auto",
    flexShrink: 0,
    background: "linear-gradient(135deg, #8a6d2b, #d4a942)",
    color: "#0d0d0d",
    border: "none",
    borderRadius: 8,
    padding: "8px 18px",
    fontSize: 12,
    fontWeight: 800,
    fontFamily: "'Cinzel', serif",
    cursor: "pointer",
    letterSpacing: "0.06em",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,

  ghostBtn: {
    flexShrink: 0,
    background: "rgba(212,169,66,0.1)",
    color: "#d4a942",
    border: "1px solid rgba(212,169,66,0.3)",
    borderRadius: 8,
    padding: "8px 18px",
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "'Cinzel', serif",
    cursor: "pointer",
    letterSpacing: "0.04em",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,

  empty: {
    textAlign: "center" as const,
    padding: "28px 20px",
    background: "rgba(255,255,255,0.02)",
    borderRadius: 12,
    border: "1px dashed rgba(212,169,66,0.12)",
    color: "#444",
    fontSize: 13,
  } as React.CSSProperties,
};

interface Props {
  userId: string;
  username: string;
  avatarUrl: string;
}

export default function LobbyClient({ userId }: Props) {
  const router = useRouter();

  const [snesRooms, setSnesRooms] = useState<SnesRoom[]>([]);
  const [moonhavenRooms, setMoonhavenRooms] = useState<MoonhavenRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningRoom, setJoiningRoom] = useState<string | null>(null);
  const [voiceCount, setVoiceCount] = useState(0);

  // Create SNES room
  const [showGamePicker, setShowGamePicker] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  // ── Fetch all rooms ───────────────────────────────────────────────────────
  const fetchRooms = useCallback(async () => {
    try {
      const [snesRes, moonRes] = await Promise.all([
        fetch("/api/emulator-room"),
        fetch("/api/moonhaven-rooms"),
      ]);
      if (snesRes.ok) {
        const data = await snesRes.json();
        if (Array.isArray(data)) setSnesRooms(data);
      }
      if (moonRes.ok) {
        const data = await moonRes.json();
        if (Array.isArray(data.rooms)) setMoonhavenRooms(data.rooms);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRooms();
    const iv = setInterval(fetchRooms, 5000);
    return () => clearInterval(iv);
  }, [fetchRooms]);

  // ── Voice count ───────────────────────────────────────────────────────────
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/voice");
        if (!res.ok) return;
        const data = await res.json();
        const rooms = Array.isArray(data) ? data : (data.rooms ?? []);
        const total = rooms.reduce((s: number, r: { memberCount?: number }) => s + (r.memberCount ?? 0), 0);
        setVoiceCount(total);
      } catch { /* ignore */ }
    };
    poll();
    const iv = setInterval(poll, 8000);
    return () => clearInterval(iv);
  }, []);

  // ── Create a new SNES room then go to emulator ────────────────────────────
  async function createSnesRoom(gameName: string) {
    setCreatingRoom(true);
    try {
      const res = await fetch("/api/emulator-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", gameName, ranked: true }),
      });
      const room = await res.json();
      if (room?.id) {
        router.push(`/emulator?joinRoom=${room.id}`);
      }
    } catch { /* ignore */ } finally {
      setCreatingRoom(false);
      setShowGamePicker(false);
    }
  }

  // ── Join SNES room as P2 ──────────────────────────────────────────────────
  function joinSnesRoom(roomId: string) {
    setJoiningRoom(roomId);
    router.push(`/emulator?joinRoom=${roomId}`);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function timeAgo(iso: string) {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    return `${Math.floor(s / 3600)}h ago`;
  }

  // Rooms open for a 2nd player
  const waitingRooms  = snesRooms.filter(r => r.status === "waiting" && !r.guest_id && !r.game_started);
  // Both players in lobby but game hasn't started
  const lobbyFull     = snesRooms.filter(r => r.status === "waiting" && !!r.guest_id && !r.game_started);
  // Active / live games (game_started = true)
  const liveSessions  = snesRooms.filter(r => r.game_started);

  const pickerMatches = SNES_ALL.filter(g =>
    !pickerSearch ||
    g.name.toLowerCase().includes(pickerSearch.toLowerCase()) ||
    g.genre.toLowerCase().includes(pickerSearch.toLowerCase())
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100dvh", background: "#0d0d0d", color: "#e8dcc8" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px 80px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <div style={{ fontFamily: "'Cinzel', serif", fontWeight: 900, fontSize: 26, color: "#d4a942", letterSpacing: "0.12em" }}>
            ⚔️ GAME LOBBY
          </div>
          <div style={{ color: "#555", fontSize: 12, marginTop: 6 }}>
            Live rooms · No codes · Just click Join
          </div>
        </div>

        {/* Voice banner */}
        {voiceCount > 0 && (
          <div style={{ background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 10, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, marginTop: 16 }}>
            <span style={{ fontSize: 18 }}>🎙</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#4ade80", fontSize: 13, fontWeight: 700 }}>{voiceCount} in voice right now</div>
              <div style={{ color: "#3a9e60", fontSize: 11 }}>Tap the mic icon (top-right) to join a channel</div>
            </div>
          </div>
        )}

        {/* ── SNES ─────────────────────────────────────────────────────────── */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", ...S.sectionHead }}>
            <span>🕹️ SNES — Open Rooms</span>
            <button
              onClick={() => setShowGamePicker(true)}
              disabled={creatingRoom}
              style={S.ghostBtn}
            >
              {creatingRoom ? "Creating…" : "+ Create Room"}
            </button>
          </div>

          {loading ? (
            <div style={S.empty}>Loading rooms…</div>
          ) : waitingRooms.length === 0 ? (
            <div style={S.empty}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🕹️</div>
              No open rooms right now.
              <br />
              <span style={{ color: "#555" }}>Create one — friends see it instantly and join with one click!</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {waitingRooms.map(room => (
                <SnesRoomCard
                  key={room.id}
                  room={room}
                  userId={userId}
                  joining={joiningRoom === room.id}
                  onJoin={() => joinSnesRoom(room.id)}
                  onMyRoom={() => router.push(`/emulator?joinRoom=${room.id}`)}
                  timeAgo={timeAgo(room.created_at)}
                />
              ))}
            </div>
          )}

          {/* Lobby full — 2 players waiting to start */}
          {lobbyFull.length > 0 && (
            <>
              <div style={{ ...S.sectionHead, marginTop: 20, fontSize: 10 }}>LOBBY FULL — STARTING SOON</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {lobbyFull.map(room => (
                  <div key={room.id} style={{ ...S.card, background: "rgba(212,169,66,0.06)" }}>
                    <AvatarPair host={room.host_avatar || `/api/avatar/${room.host_id}?v=2`} guest={room.guest_avatar || `/api/avatar/${room.guest_id ?? ""}?v=2`} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🎮 {room.game_name}</div>
                      <div style={{ fontSize: 11, color: "#8a6d2b" }}>@{room.host_username} <span style={{ color: "#d4a942" }}>P1</span> vs @{room.guest_username} <span style={{ color: "#4ade80" }}>P2</span></div>
                    </div>
                    <div style={{ fontSize: 11, color: "#d4a942", flexShrink: 0, textAlign: "right" }}>
                      <div>2 / 2</div>
                      <div style={{ color: "#555", fontSize: 10 }}>starting soon</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Live sessions — watch button */}
          {liveSessions.length > 0 && (
            <>
              <div style={{ ...S.sectionHead, marginTop: 20, fontSize: 10 }}>🔴 LIVE NOW</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {liveSessions.map(room => {
                  const isSolo = !room.guest_id;
                  return (
                    <div key={room.id} style={{ ...S.card }}>
                      {isSolo ? (
                        <div style={{ fontSize: 30, flexShrink: 0 }}>🎮</div>
                      ) : (
                        <AvatarPair host={room.host_avatar || `/api/avatar/${room.host_id}?v=2`} guest={room.guest_avatar || `/api/avatar/${room.guest_id ?? ""}?v=2`} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ef4444", display: "inline-block", flexShrink: 0 }} />
                          <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{room.game_name}</div>
                        </div>
                        <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                          {isSolo
                            ? `@${room.host_username} playing solo`
                            : `@${room.host_username} vs @${room.guest_username}`}
                        </div>
                      </div>
                      <button
                        style={{ ...S.ghostBtn, marginLeft: "auto" }}
                        onClick={() => router.push(`/emulator`)}
                        title="Go to SNES page to spectate"
                      >
                        👁 Watch
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* ── Moonhaven ─────────────────────────────────────────────────────── */}
        <div>
          <div style={S.sectionHead}>🌙 Moonhaven — Active Realms</div>
          {moonhavenRooms.length === 0 ? (
            <div style={S.empty}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🌙</div>
              No one is in Moonhaven right now.
              <br />
              <button onClick={() => router.push("/moonhaven")} style={{ ...S.joinBtn, marginTop: 12, display: "inline-block", marginLeft: 0 }}>
                Enter Moonhaven
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {moonhavenRooms.map(room => (
                <div
                  key={room.id}
                  style={{ ...S.card }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(100,180,255,0.35)")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(212,169,66,0.15)")}
                >
                  <div style={{ fontSize: 32, flexShrink: 0 }}>{room.isPublic ? "🌕" : "🌑"}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{room.isPublic ? "Main Realm" : `Private Realm`}</div>
                    <div style={{ fontSize: 11, color: "#8a6d2b", marginTop: 2 }}>
                      <span style={{ color: "#a0d8ff" }}>{room.playerCount}</span> explorer{room.playerCount !== 1 ? "s" : ""} inside
                    </div>
                  </div>
                  <button
                    style={{ ...S.joinBtn, background: "linear-gradient(135deg, #1a4060, #2a70a0)", marginLeft: "auto" }}
                    onClick={() => router.push(`/moonhaven?room=${room.id}`)}
                  >
                    Enter
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Other Multiplayer Games ───────────────────────────────────────── */}
        <div>
          <div style={S.sectionHead}>🎮 Other Multiplayer</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
            {[
              { emoji: "🧟", label: "Outbreak", desc: "Co-op zombie survival", href: "/outbreak", accent: "#2a4a1a" },
              { emoji: "♟️", label: "Chess", desc: "1v1 with ELO rating", href: "/chess", accent: "#1a2a4a" },
              { emoji: "🏓", label: "Paddle", desc: "Classic pong", href: "/pong", accent: "#2a1a4a" },
            ].map(g => (
              <div
                key={g.href}
                onClick={() => router.push(g.href)}
                style={{
                  ...S.card,
                  flexDirection: "column",
                  alignItems: "flex-start",
                  background: `linear-gradient(135deg, ${g.accent}66, rgba(26,20,8,0.9))`,
                  cursor: "pointer",
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(212,169,66,0.45)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(212,169,66,0.15)")}
              >
                <div style={{ fontSize: 28 }}>{g.emoji}</div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{g.label}</div>
                <div style={{ fontSize: 11, color: "#666" }}>{g.desc}</div>
                <div style={{ fontSize: 11, color: "#d4a942", marginTop: 4 }}>Play now →</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", padding: "32px 0 16px", marginTop: 20, borderTop: "1px solid #1a1a1a" }}>
          <div style={{ fontSize: 11, color: "#333" }}>🔥 GREAT SOULS · Rooms refresh every 5 seconds</div>
        </div>
      </div>

      {/* ── Game Picker Modal ───────────────────────────────────────────────── */}
      {showGamePicker && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setShowGamePicker(false); }}
        >
          <div style={{ background: "#141008", border: "1px solid rgba(212,169,66,0.3)", borderRadius: 16, padding: 20, width: "100%", maxWidth: 480, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: 16, color: "#d4a942" }}>
                🕹️ Pick a Game
              </div>
              <button onClick={() => setShowGamePicker(false)} style={{ background: "transparent", border: "none", color: "#666", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: "#555", marginBottom: 10 }}>
              <strong style={{ color: "#d4a942" }}>Multiplayer:</strong> You&apos;re P1, friend joins as P2. Hit Start. &nbsp;
              <strong style={{ color: "#a0d8ff" }}>Solo:</strong> Friends can watch you from the lobby.
            </div>
            <input
              type="text"
              placeholder="Search games…"
              value={pickerSearch}
              onChange={e => setPickerSearch(e.target.value)}
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #2a2a2a", borderRadius: 8, padding: "8px 12px", color: "#e8dcc8", fontSize: 13, marginBottom: 12, outline: "none" }}
              autoFocus
            />
            <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              {pickerMatches.map(game => (
                <button
                  key={game.name}
                  onClick={() => createSnesRoom(game.name)}
                  disabled={creatingRoom}
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,169,66,0.12)", borderRadius: 8, padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left", transition: "all 0.1s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(212,169,66,0.08)"; e.currentTarget.style.borderColor = "rgba(212,169,66,0.35)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(212,169,66,0.12)"; }}
                >
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{game.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#e8dcc8" }}>{game.name}</div>
                    <div style={{ fontSize: 11, color: "#666" }}>{game.genre} · {game.players === 1 ? "Solo / Watch" : "2 players"}</div>
                  </div>
                  <div style={{ fontSize: 11, color: game.players === 1 ? "#a0d8ff" : "#d4a942", flexShrink: 0 }}>
                    {game.players === 1 ? "Solo →" : "VS →"}
                  </div>
                </button>
              ))}
              {pickerMatches.length === 0 && (
                <div style={{ textAlign: "center", color: "#444", padding: 20 }}>No games found</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Avatar pair (stacked) ─────────────────────────────────────────────────────
function AvatarPair({ host, guest }: { host: string; guest: string }) {
  return (
    <div style={{ position: "relative", width: 44, height: 38, flexShrink: 0 }}>
      <img src={host} alt="P1" style={{ width: 30, height: 30, borderRadius: "50%", border: "2px solid rgba(212,169,66,0.4)", position: "absolute", top: 0, left: 0, objectFit: "cover" }}
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
      <img src={guest} alt="P2" style={{ width: 26, height: 26, borderRadius: "50%", border: "2px solid rgba(74,222,128,0.4)", position: "absolute", bottom: 0, right: 0, objectFit: "cover" }}
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
    </div>
  );
}

// ── Room card sub-component ───────────────────────────────────────────────────
function SnesRoomCard({
  room, userId, joining, onJoin, onMyRoom, timeAgo,
}: {
  room: SnesRoom;
  userId: string;
  joining: boolean;
  onJoin: () => void;
  onMyRoom: () => void;
  timeAgo: string;
}) {
  const isOwner = room.host_id === userId;

  return (
    <div
      style={{ ...S.card }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(212,169,66,0.45)")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(212,169,66,0.15)")}
    >
      <img
        src={room.host_avatar || `/api/avatar/${room.host_id}?v=2`}
        alt={room.host_username}
        style={{ width: 38, height: 38, borderRadius: "50%", border: "2px solid rgba(212,169,66,0.3)", flexShrink: 0, objectFit: "cover" }}
        onError={e => { (e.currentTarget as HTMLImageElement).src = `/api/avatar/${room.host_id}?v=2`; }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#e8dcc8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          🎮 {room.game_name}
        </div>
        <div style={{ fontSize: 11, color: "#8a6d2b", marginTop: 2, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span>@{room.host_username}</span>
          <span style={{ color: "#d4a942", fontWeight: 700 }}>P1</span>
          <span>·</span>
          <span style={{ color: "#d4a942" }}>1 / 2 players</span>
          {room.ranked && <span style={{ background: "rgba(212,169,66,0.12)", color: "#d4a942", borderRadius: 4, padding: "1px 5px", fontSize: 9, fontWeight: 800 }}>RANKED</span>}
        </div>
        <div style={{ fontSize: 10, color: "#444", marginTop: 2 }}>
          {timeAgo} · Waiting for Player 2 · 🎙 Voice ready
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
        {isOwner ? (
          <button style={S.ghostBtn} onClick={onMyRoom}>My Room ↗</button>
        ) : (
          <button style={S.joinBtn} disabled={joining} onClick={onJoin}>
            {joining ? "Joining…" : "Join as P2"}
          </button>
        )}
      </div>
    </div>
  );
}
