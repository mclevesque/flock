"use client";
import { useState, useEffect, useRef, useCallback } from "react";

interface LobbyPlayer {
  userId: string;
  username: string;
  avatarUrl: string;
  isHost: boolean;
}

interface LobbySettings {
  difficulty: number;       // 1-4
  upgradesEnabled: boolean; // true = meta upgrades active
}

interface LobbyStateMsg {
  type: "lobby_state" | "lobby_update";
  players: LobbyPlayer[];
  started?: boolean;
  settings?: LobbySettings;
}

interface LobbyJoinMsg {
  type: "lobby_join";
  userId: string;
  username: string;
  avatarUrl: string;
  isHost: boolean;
}

interface LobbyLeaveMsg {
  type: "lobby_leave";
  userId: string;
}

interface GameStartMsg {
  type: "game_start";
  roomCode: string;
  difficulty: number;
  upgradesEnabled: boolean;
  playerCount: number;
}

interface HostTransferMsg {
  type: "host_transfer";
  newHostId: string;
}

interface SettingsUpdateMsg {
  type: "settings_update";
  difficulty: number;
  upgradesEnabled: boolean;
}

type LobbyMsg =
  | LobbyStateMsg
  | LobbyJoinMsg
  | LobbyLeaveMsg
  | GameStartMsg
  | HostTransferMsg
  | SettingsUpdateMsg;

interface Props {
  userId: string;
  username: string;
  avatarUrl: string;
  onPlay: (roomCode: string, settings: LobbySettings & { playerCount: number }) => void;
  onSolo: () => void;
  initialRoom?: string;
}

const MAX_PLAYERS = 4;

const DIFF_OPTIONS = [
  { id: 1, name: "CASUAL",    color: "#aaddff" },
  { id: 2, name: "NORMAL",    color: "#44ffaa" },
  { id: 3, name: "HARD",      color: "#ffaa44" },
  { id: 4, name: "NIGHTMARE", color: "#ff4444" },
];

export default function OutbreakLobby({ userId, username, avatarUrl, onPlay, onSolo, initialRoom }: Props) {
  const [mode, setMode]               = useState<"choose" | "lobby">(initialRoom ? "lobby" : "choose");
  const [roomCode, setRoomCode]       = useState(initialRoom ?? "");
  const [isHost, setIsHost]           = useState(false);
  const [players, setPlayers]         = useState<LobbyPlayer[]>([]);
  const [joinInput, setJoinInput]     = useState("");
  const [joining, setJoining]         = useState(false);
  const [error, setError]             = useState("");
  const [difficulty, setDifficulty]   = useState(2);
  const [upgradesEnabled, setUpgradesEnabled] = useState(true);
  const gameStartedRef                = useRef(false);
  const wsRef                         = useRef<{ send: (d: string) => void; close: () => void; onmessage: ((e: MessageEvent) => void) | null } | null>(null);

  useEffect(() => {
    if (initialRoom && mode === "lobby") {
      setRoomCode(initialRoom);
      setIsHost(false);
      setPlayers([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const broadcastState = useCallback((ws: typeof wsRef.current, playerList: LobbyPlayer[], started = false, diff = difficulty, upgrades = upgradesEnabled) => {
    if (!ws) return;
    ws.send(JSON.stringify({ type: "lobby_state", players: playerList, started, settings: { difficulty: diff, upgradesEnabled: upgrades } }));
  }, [difficulty, upgradesEnabled]);

  const broadcastSettings = useCallback((diff: number, upgrades: boolean) => {
    wsRef.current?.send(JSON.stringify({ type: "settings_update", difficulty: diff, upgradesEnabled: upgrades }));
  }, []);

  // ── WS connection ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "lobby" || !roomCode) return;
    let ws: typeof wsRef.current = null;

    const connect = async () => {
      const { PartySocket } = await import("partysocket");
      ws = new PartySocket({
        host: process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999",
        room: `outbreak-lobby-${roomCode}`,
      }) as unknown as typeof wsRef.current;
      wsRef.current = ws;

      (ws as unknown as { onopen: () => void }).onopen = () => {
        ws!.send(JSON.stringify({ type: "lobby_join", userId, username, avatarUrl, isHost }));
      };

      ws!.onmessage = (e: MessageEvent) => {
        try {
          const msg = JSON.parse(e.data) as LobbyMsg;

          if (msg.type === "lobby_join") {
            const incoming = msg as LobbyJoinMsg;
            if (incoming.userId === userId) return;
            setPlayers(prev => {
              if (prev.some(p => p.userId === incoming.userId)) return prev;
              const updated = [...prev, { userId: incoming.userId, username: incoming.username, avatarUrl: incoming.avatarUrl, isHost: incoming.isHost }];
              if (isHost) broadcastState(wsRef.current, updated, gameStartedRef.current);
              return updated;
            });
          }

          if (msg.type === "lobby_state" || msg.type === "lobby_update") {
            const stateMsg = msg as LobbyStateMsg;
            if (stateMsg.started) { gameStartedRef.current = true; setError("Game already in progress"); return; }
            setPlayers(stateMsg.players);
            if (stateMsg.settings) {
              setDifficulty(stateMsg.settings.difficulty);
              setUpgradesEnabled(stateMsg.settings.upgradesEnabled);
            }
          }

          if (msg.type === "settings_update") {
            const su = msg as SettingsUpdateMsg;
            setDifficulty(su.difficulty);
            setUpgradesEnabled(su.upgradesEnabled);
          }

          if (msg.type === "lobby_leave") {
            const leaveMsg = msg as LobbyLeaveMsg;
            setPlayers(prev => {
              const updated = prev.filter(p => p.userId !== leaveMsg.userId);
              const leavingWasHost = prev.find(p => p.userId === leaveMsg.userId)?.isHost;
              if (leavingWasHost && updated.length > 0) {
                const promoted = updated.map((p, i) => i === 0 ? { ...p, isHost: true } : p);
                if (updated[0].userId === userId) {
                  setIsHost(true);
                  wsRef.current?.send(JSON.stringify({ type: "host_transfer", newHostId: userId }));
                }
                return promoted;
              }
              return updated;
            });
          }

          if (msg.type === "host_transfer") {
            const transferMsg = msg as HostTransferMsg;
            setPlayers(prev => prev.map(p => ({ ...p, isHost: p.userId === transferMsg.newHostId })));
            if (transferMsg.newHostId === userId) setIsHost(true);
          }

          if (msg.type === "game_start") {
            gameStartedRef.current = true;
            const sm = msg as GameStartMsg;
            onPlay(roomCode, {
              difficulty: sm.difficulty,
              upgradesEnabled: sm.upgradesEnabled,
              playerCount: sm.playerCount,
            });
          }
        } catch { /* ignore parse errors */ }
      };
    };

    connect();
    return () => {
      if (ws) { ws.send(JSON.stringify({ type: "lobby_leave", userId })); ws.close(); }
      wsRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, roomCode]);

  // ── Host: change difficulty and broadcast ─────────────────────────────────
  function setDiffAndBroadcast(d: number) {
    if (!isHost) return;
    setDifficulty(d);
    broadcastSettings(d, upgradesEnabled);
  }

  function toggleUpgradesAndBroadcast() {
    if (!isHost) return;
    const next = !upgradesEnabled;
    setUpgradesEnabled(next);
    broadcastSettings(difficulty, next);
  }

  // ── Room actions ──────────────────────────────────────────────────────────
  const createRoom = () => {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    setRoomCode(code);
    setIsHost(true);
    setPlayers([{ userId, username, avatarUrl, isHost: true }]);
    setMode("lobby");
    setError("");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("room", code);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const joinRoom = () => {
    const code = joinInput.trim().toUpperCase();
    if (code.length < 4) { setError("Enter a valid room code"); return; }
    setJoining(true); setError("");
    setRoomCode(code); setIsHost(false); setPlayers([]); setMode("lobby");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("room", code);
      window.history.replaceState({}, "", url.toString());
    }
    setJoining(false);
  };

  const startGame = () => {
    const pc = displayPlayers.length;
    wsRef.current?.send(JSON.stringify({ type: "game_start", roomCode, difficulty, upgradesEnabled, playerCount: pc }));
    onPlay(roomCode, { difficulty, upgradesEnabled, playerCount: pc });
  };

  const leaveLobby = () => {
    wsRef.current?.send(JSON.stringify({ type: "lobby_leave", userId }));
    wsRef.current?.close();
    wsRef.current = null;
    setMode("choose"); setRoomCode(""); setPlayers([]); setError("");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("room");
      window.history.replaceState({}, "", url.toString());
    }
  };

  const copyLink = () => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("room", roomCode);
      navigator.clipboard.writeText(url.toString()).catch(() => {});
    }
  };

  const isFull = players.length >= MAX_PLAYERS;
  const selfInList = players.some(p => p.userId === userId);
  const displayPlayers = selfInList ? players : [{ userId, username, avatarUrl, isHost }, ...players.filter(p => p.userId !== userId)];
  const selectedDiff = DIFF_OPTIONS.find(d => d.id === difficulty) || DIFF_OPTIONS[1];

  // ── Shared bg style ───────────────────────────────────────────────────────
  const bg: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 50,
    background: "radial-gradient(ellipse at 50% 40%, #0a0018 0%, #050008 70%)",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    fontFamily: "monospace", overflowY: "auto",
  };

  const particles = (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {Array.from({ length: 50 }, (_, i) => (
        <div key={i} style={{
          position: "absolute",
          left: `${Math.sin(i * 5.7) * 50 + 50}%`,
          top: `${Math.cos(i * 3.9) * 50 + 50}%`,
          width: i % 4 === 0 ? 2 : 1, height: i % 4 === 0 ? 2 : 1,
          borderRadius: "50%",
          background: `rgba(200,100,255,${0.15 + (i % 3) * 0.15})`,
        }} />
      ))}
    </div>
  );

  // ── CHOOSE MODE ────────────────────────────────────────────────────────────
  if (mode === "choose") {
    return (
      <div style={bg}>
        {particles}
        <div style={{ position: "relative", zIndex: 1, textAlign: "center", width: "100%", maxWidth: 460, padding: "0 20px" }}>
          <div style={{ fontSize: 52, marginBottom: 6, filter: "drop-shadow(0 0 24px rgba(200,80,255,0.7))" }}>💀</div>
          <h1 style={{ color: "#c084fc", fontSize: 32, fontWeight: 900, letterSpacing: 6, margin: "0 0 8px", textTransform: "uppercase" }}>OUTBREAK</h1>
          <p style={{ color: "rgba(200,100,255,0.35)", fontSize: 11, marginBottom: 36, letterSpacing: 3 }}>SURVIVE THE HORDE</p>

          <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
            <button onClick={createRoom} style={{
              flex: 1, padding: "22px 12px", fontFamily: "monospace",
              background: "rgba(180,80,255,0.08)", border: "1px solid rgba(180,80,255,0.3)",
              borderRadius: 14, cursor: "pointer", transition: "all 0.15s",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(180,80,255,0.18)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(180,80,255,0.08)")}
            >
              <span style={{ fontSize: 28 }}>⚔️</span>
              <span style={{ color: "#c084fc", fontSize: 14, fontWeight: 700, letterSpacing: 1 }}>MULTIPLAYER</span>
              <span style={{ color: "rgba(200,150,255,0.45)", fontSize: 11 }}>Create a room · up to 4 players</span>
            </button>

            <button onClick={onSolo} style={{
              flex: 1, padding: "22px 12px", fontFamily: "monospace",
              background: "rgba(100,80,160,0.08)", border: "1px solid rgba(100,80,160,0.25)",
              borderRadius: 14, cursor: "pointer", transition: "all 0.15s",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(100,80,160,0.18)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(100,80,160,0.08)")}
            >
              <span style={{ fontSize: 28 }}>🎮</span>
              <span style={{ color: "#a78bfa", fontSize: 14, fontWeight: 700, letterSpacing: 1 }}>SOLO</span>
              <span style={{ color: "rgba(167,139,250,0.45)", fontSize: 11 }}>Play alone</span>
            </button>
          </div>

          <div style={{ background: "rgba(10,0,24,0.7)", border: "1px solid rgba(180,80,255,0.15)", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 11, color: "rgba(200,150,255,0.4)", letterSpacing: 1, marginBottom: 10 }}>HAVE A CODE? JOIN A ROOM:</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={joinInput}
                onChange={e => setJoinInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
                onKeyDown={e => { if (e.key === "Enter") joinRoom(); }}
                placeholder="ROOM CODE"
                maxLength={8}
                style={{ flex: 1, padding: "10px 12px", fontFamily: "monospace", fontWeight: 700, fontSize: 15, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(180,80,255,0.2)", borderRadius: 8, color: "#fff", outline: "none", letterSpacing: 4, textAlign: "center" }}
              />
              <button onClick={joinRoom} disabled={joinInput.trim().length < 4 || joining} style={{
                padding: "10px 16px", fontFamily: "monospace", fontWeight: 700, fontSize: 13,
                background: joinInput.trim().length >= 4 ? "rgba(180,80,255,0.2)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${joinInput.trim().length >= 4 ? "rgba(180,80,255,0.4)" : "rgba(255,255,255,0.06)"}`,
                borderRadius: 8,
                color: joinInput.trim().length >= 4 ? "#c084fc" : "rgba(255,255,255,0.2)",
                cursor: joinInput.trim().length >= 4 ? "pointer" : "default",
              }}>
                Join →
              </button>
            </div>
            {error && <div style={{ color: "#f87171", fontSize: 11, marginTop: 8 }}>{error}</div>}
          </div>
        </div>
      </div>
    );
  }

  // ── LOBBY MODE ────────────────────────────────────────────────────────────
  const emptySlots = Math.max(0, MAX_PLAYERS - displayPlayers.length);

  return (
    <div style={bg}>
      {particles}
      <div style={{ position: "relative", zIndex: 1, textAlign: "center", width: "100%", maxWidth: 440, padding: "20px 20px", overflowY: "auto", maxHeight: "100dvh" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 6 }}>
          <span style={{ fontSize: 28 }}>💀</span>
          <h1 style={{ color: "#c084fc", fontSize: 22, fontWeight: 900, letterSpacing: 4, margin: 0, textTransform: "uppercase" }}>OUTBREAK</h1>
          {isFull && <span style={{ background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 6, padding: "2px 8px", fontSize: 11, color: "#f87171", fontWeight: 700 }}>FULL</span>}
        </div>
        <div style={{ color: "rgba(200,150,255,0.45)", fontSize: 12, marginBottom: 18, letterSpacing: 2 }}>
          ROOM: {roomCode}
        </div>

        <div style={{ background: "rgba(10,0,24,0.85)", backdropFilter: "blur(12px)", border: "1px solid rgba(180,80,255,0.2)", borderRadius: 16, padding: 20, boxShadow: "0 8px 40px rgba(0,0,0,0.7)", marginBottom: 16, textAlign: "left" }}>

          {/* Players */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 11, color: "rgba(200,150,255,0.45)", letterSpacing: 1, textTransform: "uppercase" }}>
              Players ({displayPlayers.length}/{MAX_PLAYERS})
            </span>
            <button onClick={copyLink} style={{
              padding: "4px 10px", fontFamily: "monospace", fontSize: 10, fontWeight: 700,
              background: "rgba(180,80,255,0.1)", border: "1px solid rgba(180,80,255,0.25)",
              borderRadius: 6, color: "#c084fc", cursor: "pointer", letterSpacing: 0.5,
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(180,80,255,0.2)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(180,80,255,0.1)")}
            >
              Copy Link
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
            {displayPlayers.map((p) => (
              <div key={p.userId} style={{
                display: "flex", alignItems: "center", gap: 10,
                background: p.userId === userId ? "rgba(180,80,255,0.1)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${p.userId === userId ? "rgba(180,80,255,0.25)" : "rgba(255,255,255,0.07)"}`,
                borderRadius: 10, padding: "8px 12px",
              }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(180,80,255,0.15)", overflow: "hidden", flexShrink: 0, border: "1px solid rgba(180,80,255,0.3)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                </div>
                <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, flex: 1 }}>@{p.username}</span>
                {p.isHost && <span style={{ background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 5, padding: "2px 7px", fontSize: 10, color: "#fbbf24", fontWeight: 700 }}>HOST</span>}
              </div>
            ))}
            {Array.from({ length: emptySlots }, (_, i) => (
              <div key={`empty-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.07)", borderRadius: 10, padding: "8px 12px" }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.04)", flexShrink: 0 }} />
                <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>Waiting for player…</span>
              </div>
            ))}
          </div>

          {/* ── GAME SETTINGS ─────────────────────────────────────────────── */}
          <div style={{ borderTop: "1px solid rgba(180,80,255,0.12)", paddingTop: 14, marginTop: 4 }}>
            <div style={{ fontSize: 10, color: "rgba(200,150,255,0.4)", letterSpacing: 1, marginBottom: 10, display: "flex", justifyContent: "space-between" }}>
              <span>GAME SETTINGS</span>
              {!isHost && <span style={{ color: "rgba(200,150,255,0.25)" }}>host controls</span>}
            </div>

            {/* Difficulty selector */}
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 5, letterSpacing: 0.5 }}>DIFFICULTY</div>
            <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
              {DIFF_OPTIONS.map(d => (
                <button
                  key={d.id}
                  onClick={() => setDiffAndBroadcast(d.id)}
                  disabled={!isHost}
                  style={{
                    flex: 1, padding: "6px 2px", fontSize: 9, fontWeight: 800,
                    fontFamily: "monospace", letterSpacing: 0.3,
                    borderRadius: 6, cursor: isHost ? "pointer" : "default",
                    background: difficulty === d.id ? `${d.color}22` : "rgba(255,255,255,0.03)",
                    color: difficulty === d.id ? d.color : "rgba(255,255,255,0.25)",
                    border: `1px solid ${difficulty === d.id ? `${d.color}55` : "rgba(255,255,255,0.06)"}`,
                    transition: "all 0.12s",
                  }}
                >
                  {d.name}
                </button>
              ))}
            </div>

            {/* Selected difficulty description */}
            <div style={{ fontSize: 10, color: selectedDiff.color, opacity: 0.7, marginBottom: 10, textAlign: "center", minHeight: 14 }}>
              {difficulty === 1 && "Slower enemies · more hearts · relaxed"}
              {difficulty === 2 && "Balanced challenge · the intended experience"}
              {difficulty === 3 && "Enemies hit hard · upgrades recommended"}
              {difficulty === 4 && "MAX difficulty · relentless · brings the pain"}
            </div>

            {/* Upgrades toggle */}
            <button
              onClick={toggleUpgradesAndBroadcast}
              disabled={!isHost}
              style={{
                width: "100%", padding: "8px 0", fontFamily: "monospace", fontSize: 10, fontWeight: 700,
                borderRadius: 6, cursor: isHost ? "pointer" : "default", letterSpacing: 0.5,
                background: upgradesEnabled ? "rgba(74,222,128,0.08)" : "rgba(239,68,68,0.08)",
                border: `1px solid ${upgradesEnabled ? "rgba(74,222,128,0.2)" : "rgba(239,68,68,0.2)"}`,
                color: upgradesEnabled ? "rgba(150,255,150,0.8)" : "rgba(255,120,120,0.8)",
                transition: "all 0.12s",
              }}
            >
              {upgradesEnabled ? "✅ UPGRADES ON — your meta powers active" : "⛔ UPGRADES OFF — pure skill only"}
            </button>
          </div>

          {/* Share hint */}
          <div style={{ fontSize: 10, color: "rgba(200,150,255,0.3)", letterSpacing: 0.5, marginTop: 14, textAlign: "center" }}>
            Code: <strong style={{ color: "rgba(200,150,255,0.55)", letterSpacing: 3 }}>{roomCode}</strong>
          </div>

          <div style={{ height: 1, background: "rgba(180,80,255,0.1)", margin: "14px 0" }} />

          {/* Start / wait */}
          {isHost ? (
            <button
              onClick={startGame}
              style={{
                width: "100%", padding: "13px 0", fontFamily: "monospace", fontWeight: 900,
                fontSize: 15, letterSpacing: 2, textTransform: "uppercase",
                background: "linear-gradient(135deg, rgba(34,197,94,0.25), rgba(16,185,129,0.2))",
                border: "1px solid rgba(34,197,94,0.4)", borderRadius: 11, color: "#4ade80",
                cursor: "pointer", marginBottom: 10,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "linear-gradient(135deg, rgba(34,197,94,0.4), rgba(16,185,129,0.3))")}
              onMouseLeave={e => (e.currentTarget.style.background = "linear-gradient(135deg, rgba(34,197,94,0.25), rgba(16,185,129,0.2))")}
            >
              ▶ START WAVE
            </button>
          ) : (
            <div style={{ color: "rgba(200,150,255,0.4)", fontSize: 12, marginBottom: 10, padding: "10px 0", textAlign: "center" }}>
              Waiting for host to start…
            </div>
          )}

          {error && <div style={{ color: "#f87171", fontSize: 11, marginBottom: 10, textAlign: "center" }}>{error}</div>}

          <button
            onClick={leaveLobby}
            style={{
              width: "100%", padding: "9px 0", fontFamily: "monospace", fontWeight: 700,
              fontSize: 12, letterSpacing: 1,
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 9, color: "rgba(255,255,255,0.3)", cursor: "pointer",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
}
