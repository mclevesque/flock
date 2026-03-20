"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface LobbyRoom {
  id: string;
  name: string;
  status: string;
  max_players: number;
  buy_in: number;
  player_count: number;
  host_id: string;
  host_username: string;
  host_avatar: string | null;
  created_at: string;
}

interface Props {
  lobbies: LobbyRoom[];
  sessionUserId: string | null;
  sessionUsername: string | null;
}

export default function PokerLobby({ lobbies, sessionUserId }: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [buyIn, setBuyIn] = useState(1000);
  const [maxPlayers, setMaxPlayers] = useState(9);
  const [joining, setJoining] = useState<string | null>(null);
  const [closing, setClosing] = useState<string | null>(null);
  const [localLobbies, setLocalLobbies] = useState<LobbyRoom[]>(lobbies);

  async function createRoom() {
    if (!sessionUserId) return;
    setCreating(true);
    try {
      const res = await fetch("/api/poker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: roomName, buyIn, maxPlayers }),
      });
      const { id } = await res.json();
      if (id) router.push(`/poker/${id}`);
    } catch { /* ignore */ }
    setCreating(false);
  }

  async function closeRoom(roomId: string) {
    setClosing(roomId);
    try {
      await fetch(`/api/poker/${roomId}`, { method: "DELETE" });
      setLocalLobbies(prev => prev.filter(r => r.id !== roomId));
    } catch { /* ignore */ }
    setClosing(null);
  }

  async function joinRoom(roomId: string) {
    if (!sessionUserId) { router.push(`/poker/${roomId}`); return; }
    setJoining(roomId);
    try {
      await fetch(`/api/poker/${roomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join" }),
      });
    } catch { /* ignore */ }
    router.push(`/poker/${roomId}`);
    setJoining(null);
  }

  const bg = "var(--bg-page, #0d0f14)";
  const card = "var(--bg-elevated, #1a1d26)";
  const border = "var(--border, #2a2d3a)";
  const text = "var(--text-primary, #e8eaf6)";
  const muted = "var(--text-muted, #8890a4)";
  const green = "#16a34a";
  const gold = "#d97706";

  return (
    <div style={{ minHeight: "100vh", background: bg, padding: "32px 16px", fontFamily: "sans-serif" }}>
      {/* Header */}
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, color: text }}>
              🃏 Poker Lobby
            </h1>
            <p style={{ margin: "6px 0 0", color: muted, fontSize: 14 }}>
              Texas Hold&apos;em — No real money, just chips and glory
            </p>
          </div>
          {sessionUserId && (
            <button
              onClick={() => setShowCreate(v => !v)}
              style={{
                background: `linear-gradient(135deg, ${green}, #15803d)`,
                border: "none", borderRadius: 10, padding: "12px 24px",
                color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer",
              }}
            >
              + Create Table
            </button>
          )}
        </div>

        {/* Create form */}
        {showCreate && (
          <div style={{
            background: card, border: `1px solid ${border}`, borderRadius: 16,
            padding: 24, marginBottom: 28,
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: text, marginBottom: 20 }}>Create a Table</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: muted, marginBottom: 6, fontWeight: 600 }}>TABLE NAME</label>
                <input
                  value={roomName}
                  onChange={e => setRoomName(e.target.value)}
                  placeholder="My Poker Table"
                  style={{
                    width: "100%", boxSizing: "border-box",
                    background: "var(--bg-surface, #12141c)", border: `1px solid ${border}`,
                    borderRadius: 8, padding: "10px 14px", color: text, fontSize: 14,
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: muted, marginBottom: 6, fontWeight: 600 }}>BUY-IN (chips)</label>
                <select
                  value={buyIn}
                  onChange={e => setBuyIn(Number(e.target.value))}
                  style={{
                    width: "100%", background: "var(--bg-surface, #12141c)", border: `1px solid ${border}`,
                    borderRadius: 8, padding: "10px 14px", color: text, fontSize: 14,
                  }}
                >
                  {[500, 1000, 2000, 5000, 10000].map(v => (
                    <option key={v} value={v}>{v.toLocaleString()} chips</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: muted, marginBottom: 6, fontWeight: 600 }}>MAX PLAYERS</label>
                <select
                  value={maxPlayers}
                  onChange={e => setMaxPlayers(Number(e.target.value))}
                  style={{
                    width: "100%", background: "var(--bg-surface, #12141c)", border: `1px solid ${border}`,
                    borderRadius: 8, padding: "10px 14px", color: text, fontSize: 14,
                  }}
                >
                  {[2, 4, 6, 9].map(v => <option key={v} value={v}>{v} players</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={createRoom}
                disabled={creating}
                style={{
                  background: `linear-gradient(135deg, ${green}, #15803d)`,
                  border: "none", borderRadius: 8, padding: "10px 24px",
                  color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
                  opacity: creating ? 0.7 : 1,
                }}
              >
                {creating ? "Creating…" : "🃏 Create Table"}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                style={{
                  background: "transparent", border: `1px solid ${border}`,
                  borderRadius: 8, padding: "10px 24px",
                  color: muted, fontSize: 14, cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Lobby list */}
        {localLobbies.length === 0 ? (
          <div style={{
            background: card, border: `1px solid ${border}`, borderRadius: 16,
            padding: 60, textAlign: "center",
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🃏</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: text, marginBottom: 8 }}>No tables open</div>
            <div style={{ color: muted, fontSize: 14 }}>
              {sessionUserId ? "Be the first to create a table!" : "Sign in to create a table"}
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {localLobbies.map(room => (
              <div
                key={room.id}
                style={{
                  background: card, border: `1px solid ${border}`, borderRadius: 16,
                  padding: 20, transition: "border-color 0.2s",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: text, marginBottom: 2 }}>{room.name}</div>
                    <div style={{ fontSize: 12, color: muted }}>by @{room.host_username}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{
                      background: room.status === "waiting" ? "rgba(22,163,74,0.2)" : "rgba(217,119,6,0.2)",
                      color: room.status === "waiting" ? "#4ade80" : "#fbbf24",
                      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                    }}>
                      {room.status === "waiting" ? "OPEN" : "IN PROGRESS"}
                    </span>
                    {sessionUserId && String(room.host_id) === sessionUserId && (
                      <button
                        onClick={() => closeRoom(room.id)}
                        disabled={closing === room.id}
                        title="Close room"
                        style={{
                          width: 22, height: 22, borderRadius: "50%",
                          background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)",
                          color: "#ef4444", fontSize: 13, fontWeight: 900, lineHeight: 1,
                          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                          padding: 0, opacity: closing === room.id ? 0.5 : 1, flexShrink: 0,
                        }}
                      >
                        {closing === room.id ? "…" : "✕"}
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: muted, fontWeight: 600 }}>PLAYERS</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: text }}>
                      {room.player_count}/{room.max_players}
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: muted, fontWeight: 600 }}>BUY-IN</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: gold }}>
                      {Number(room.buy_in).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: muted, fontWeight: 600 }}>BLINDS</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: muted }}>10/20</div>
                  </div>
                </div>
                <button
                  onClick={() => joinRoom(room.id)}
                  disabled={joining === room.id}
                  style={{
                    width: "100%",
                    background: room.status === "waiting"
                      ? `linear-gradient(135deg, ${green}, #15803d)`
                      : `linear-gradient(135deg, #1d4ed8, #1e40af)`,
                    border: "none", borderRadius: 8, padding: "10px 0",
                    color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
                    opacity: joining === room.id ? 0.7 : 1,
                  }}
                >
                  {joining === room.id ? "Joining…" :
                    room.status === "waiting" ? "🃏 Join Table" : "👁️ Spectate"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
