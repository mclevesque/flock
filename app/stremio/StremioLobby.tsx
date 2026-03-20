"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import PartySocket from "partysocket";
import TheaterRoom from "@/app/town/TheaterRoom";

interface Room {
  id: string;
  name: string;
  host_id: string;
  host_username: string;
  host_avatar: string | null;
  member_count: number;
  is_screen_sharing?: boolean;
  created_at: string;
}

interface TheaterState {
  videoUrl: string | null; startedAt: number | null; hostId?: string | null;
  seats: Record<string, { userId: string; username: string }>;
  isPaused?: boolean; pausedAt?: number | null;
  screenshareOffer?: unknown;
  jukeboxUrl?: string | null; jukeboxStartedAt?: number | null; jukeboxBy?: string | null;
}

interface ChatMessage {
  userId: string; username: string; avatarUrl: string; message: string; createdAt: number;
}

interface Props {
  rooms: Room[];
  sessionUserId: string | null;
  sessionUsername: string | null;
  sessionAvatar: string | null;
  initialTheaterState?: TheaterState | null;
  initialTheaterChat?: ChatMessage[];
}

const purple = "#7c3aed";
const bg = "var(--bg-page, #0d0f14)";
const card = "var(--bg-elevated, #1a1d26)";
const border = "var(--border, #2a2d3a)";
const text = "var(--text-primary, #e8eaf6)";
const muted = "var(--text-muted, #8890a4)";

function theaterPost(action: string, extra?: Record<string, unknown>) {
  return fetch("/api/theater", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...extra }),
  });
}

export default function StremioLobby({
  rooms, sessionUserId, sessionUsername, sessionAvatar,
  initialTheaterState = null, initialTheaterChat = [],
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"stream" | "theater">("stream");

  // ── Stream tab state ─────────────────────────────────────────────────────────
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [inviteOnly, setInviteOnly] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);
  const [closing, setClosing] = useState<string | null>(null);
  const [closingAll, setClosingAll] = useState(false);
  const [closedIds, setClosedIds] = useState<Set<string>>(new Set());

  // ── Theater tab state ────────────────────────────────────────────────────────
  const [theaterState, setTheaterState] = useState<TheaterState | null>(initialTheaterState);
  const [theaterChat, setTheaterChat] = useState<ChatMessage[]>(initialTheaterChat);
  const socketRef = useRef<PartySocket | null>(null);
  const theaterStateRef = useRef<TheaterState | null>(initialTheaterState);
  theaterStateRef.current = theaterState;

  // Connect PartySocket once; receive state updates in real-time
  useEffect(() => {
    if (!sessionUserId) return;
    const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST;
    if (!host) return;

    const socket = new PartySocket({ host, room: "stremio-main", party: "theater" });
    socketRef.current = socket;

    socket.addEventListener("message", (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data as string) as Record<string, unknown>;
        if (msg.type === "state") {
          setTheaterState(msg.state as TheaterState);
          if (Array.isArray(msg.chat)) setTheaterChat(msg.chat as ChatMessage[]);
        } else if (msg.type === "state-patch") {
          setTheaterState(prev => prev ? { ...prev, ...(msg.patch as Partial<TheaterState>) } : msg.patch as TheaterState);
        } else if (msg.type === "chat") {
          setTheaterChat(msg.messages as ChatMessage[]);
        }
      } catch { /* ignore */ }
    });

    return () => { socket.close(); socketRef.current = null; };
  }, [sessionUserId]);

  function socketSend(msg: Record<string, unknown>) {
    socketRef.current?.send(JSON.stringify(msg));
  }

  // ── Stream actions ───────────────────────────────────────────────────────────
  async function createRoom() {
    if (!sessionUserId) return;
    setCreating(true);
    try {
      const res = await fetch("/api/watch-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: roomName || "Watch Party", inviteOnly }),
      });
      const { id } = await res.json();
      if (id) router.push(`/stremio/${id}`);
    } catch { /* ignore */ }
    setCreating(false);
  }

  async function joinRoom(roomId: string) {
    setJoining(roomId);
    if (sessionUserId) {
      await fetch(`/api/watch-room/${roomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join" }),
      }).catch(() => {});
    }
    router.push(`/stremio/${roomId}`);
    setJoining(null);
  }

  async function closeRoom(roomId: string) {
    setClosing(roomId);
    try {
      await fetch(`/api/watch-room/${roomId}`, { method: "DELETE" });
      setClosedIds(prev => new Set([...prev, roomId]));
    } catch { /* ignore */ }
    setClosing(null);
  }

  async function closeAllMyRooms() {
    if (!sessionUserId) return;
    setClosingAll(true);
    const mine = rooms.filter(r => String(r.host_id) === String(sessionUserId) && !closedIds.has(r.id));
    await Promise.all(mine.map(r =>
      fetch(`/api/watch-room/${r.id}`, { method: "DELETE" }).catch(() => {})
    ));
    setClosedIds(prev => new Set([...prev, ...mine.map(r => r.id)]));
    setClosingAll(false);
  }

  // ── Theater callbacks — send via PartySocket (instant broadcast) + API (persistence) ──
  const onSetVideo = async (videoUrl: string) => {
    const startedAt = Date.now();
    socketSend({ type: "state-update", state: { videoUrl, startedAt } });
    theaterPost("theater-set-video", { videoUrl }).catch(() => {});
  };
  const onClearVideo = async () => {
    socketSend({ type: "state-update", state: { videoUrl: null, startedAt: null } });
    theaterPost("theater-clear-video").catch(() => {});
  };
  const onPause = async () => {
    const pausedAt = Date.now();
    socketSend({ type: "state-patch", patch: { isPaused: true, pausedAt } });
    theaterPost("theater-pause").catch(() => {});
  };
  const onUnpause = async () => {
    socketSend({ type: "state-patch", patch: { isPaused: false, pausedAt: null } });
    theaterPost("theater-unpause").catch(() => {});
  };
  const onSeek = async (newStartedAt: number) => {
    socketSend({ type: "state-patch", patch: { startedAt: newStartedAt } });
    theaterPost("theater-seek", { newStartedAt }).catch(() => {});
  };
  const onSit = (seatIdx: number) => {
    if (!sessionUserId || !sessionUsername) return;
    socketSend({ type: "seat-update", seatKey: String(seatIdx), seatData: { userId: sessionUserId, username: sessionUsername } });
    theaterPost("theater-sit", { seatIdx }).catch(() => {});
  };
  const onStand = () => {
    // Find this user's current seat key and clear it
    const seats = theaterStateRef.current?.seats ?? {};
    const myKey = Object.entries(seats).find(([, v]) => v.userId === sessionUserId)?.[0];
    if (myKey) socketSend({ type: "seat-update", seatKey: myKey, seatData: null });
    theaterPost("theater-stand").catch(() => {});
  };
  const onChat = async (message: string) => {
    if (!sessionUserId || !sessionUsername) return;
    const chatMsg: ChatMessage = {
      userId: sessionUserId, username: sessionUsername,
      avatarUrl: sessionAvatar ?? "", message, createdAt: Date.now(),
    };
    socketSend({ type: "chat", message: chatMsg });
    theaterPost("theater-chat", { message }).catch(() => {});
  };

  return (
    <div style={{ minHeight: "100vh", background: bg, fontFamily: "inherit" }}>

      {/* Tab bar */}
      <div style={{
        display: "flex", gap: 0, borderBottom: `1px solid ${border}`,
        background: card, paddingTop: 0,
      }}>
        {([["stream", "📺 Stream"], ["theater", "🎬 Theater"]] as const).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "16px 32px", background: "transparent", border: "none",
              borderBottom: activeTab === tab ? `2px solid ${purple}` : "2px solid transparent",
              color: activeTab === tab ? text : muted,
              fontSize: 15, fontWeight: activeTab === tab ? 800 : 500, cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Stream tab ── */}
      {activeTab === "stream" && (
        <div style={{ padding: "32px 16px" }}>
          <div style={{ maxWidth: 960, margin: "0 auto" }}>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
              <div>
                <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, color: text, letterSpacing: "-0.5px" }}>
                  📺 Stream
                </h1>
                <p style={{ margin: "6px 0 0", color: muted, fontSize: 14, maxWidth: 520, lineHeight: 1.6 }}>
                  Share anything on your screen — games at full FPS, movies, apps — directly to your friends.
                  WebRTC P2P · up to 16 Mbps · 60fps · crisp audio. No middleman.
                </p>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {sessionUserId && rooms.some(r => String(r.host_id) === String(sessionUserId) && !closedIds.has(r.id)) && (
                  <button
                    onClick={closeAllMyRooms}
                    disabled={closingAll}
                    style={{
                      background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)",
                      borderRadius: 10, padding: "12px 20px",
                      color: "#f87171", fontSize: 14, fontWeight: 700, cursor: "pointer",
                      flexShrink: 0, opacity: closingAll ? 0.6 : 1,
                    }}
                  >
                    {closingAll ? "Closing…" : "✕ Close All My Rooms"}
                  </button>
                )}
                {sessionUserId && (
                  <button
                    onClick={() => setShowCreate(v => !v)}
                    style={{
                      background: `linear-gradient(135deg, ${purple}, #6d28d9)`,
                      border: "none", borderRadius: 10, padding: "12px 24px",
                      color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    + Create Room
                  </button>
                )}
              </div>
            </div>

            {/* Create form */}
            {showCreate && (
              <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 16, padding: 24, marginBottom: 28 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: text, marginBottom: 6 }}>📺 Create Stream Room</div>
                <div style={{ fontSize: 13, color: muted, marginBottom: 20 }}>
                  Give your room a name, then share the link — up to 60fps, 16 Mbps, crystal clear audio.
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12, color: muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1 }}>Room Name</label>
                  <input
                    value={roomName}
                    onChange={e => setRoomName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") createRoom(); }}
                    placeholder="Movie night, Game stream, Hang…"
                    autoFocus
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: "var(--bg-surface, #12141c)", border: `1px solid ${border}`,
                      borderRadius: 8, padding: "10px 14px", color: text, fontSize: 14,
                      outline: "none", fontFamily: "inherit",
                    }}
                  />
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, cursor: "pointer" }}>
                  <div
                    onClick={() => setInviteOnly(v => !v)}
                    style={{
                      width: 40, height: 22, borderRadius: 11, cursor: "pointer", flexShrink: 0,
                      background: inviteOnly ? purple : "#2a2d3a",
                      position: "relative", transition: "background 0.2s",
                      border: `1px solid ${inviteOnly ? purple : "#374151"}`,
                    }}
                  >
                    <div style={{
                      position: "absolute", top: 2, left: inviteOnly ? 19 : 2,
                      width: 16, height: 16, borderRadius: "50%",
                      background: "#fff", transition: "left 0.2s",
                    }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: text }}>🔒 Private Stream</div>
                    <div style={{ fontSize: 11, color: muted }}>Hidden from the lobby — only people with the direct link can join</div>
                  </div>
                </label>
                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    onClick={createRoom}
                    disabled={creating}
                    style={{
                      background: `linear-gradient(135deg, ${purple}, #6d28d9)`,
                      border: "none", borderRadius: 8, padding: "10px 24px",
                      color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
                      opacity: creating ? 0.7 : 1,
                    }}
                  >
                    {creating ? "Creating…" : "📺 Create Room"}
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

            {/* Room list */}
            {rooms.length === 0 ? (
              <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 16, padding: 60, textAlign: "center" as const }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📺</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: text, marginBottom: 8 }}>No rooms open</div>
                <div style={{ color: muted, fontSize: 14, marginBottom: 20 }}>
                  {sessionUserId ? "Create a room and share the link with friends!" : "Sign in to create a watch room"}
                </div>
                {sessionUserId && (
                  <button
                    onClick={() => setShowCreate(true)}
                    style={{
                      background: `linear-gradient(135deg, ${purple}, #6d28d9)`,
                      border: "none", borderRadius: 10, padding: "12px 28px",
                      color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer",
                    }}
                  >
                    + Create the first room
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                {rooms.filter(r => !closedIds.has(r.id)).map(room => {
                  const isMyRoom = sessionUserId && String(room.host_id) === String(sessionUserId);
                  return (
                    <div key={room.id} style={{
                      background: card,
                      border: `1px solid ${room.is_screen_sharing ? "rgba(239,68,68,0.4)" : isMyRoom ? "rgba(124,58,237,0.4)" : border}`,
                      borderRadius: 16, padding: 20,
                      boxShadow: room.is_screen_sharing ? "0 0 20px rgba(239,68,68,0.1)" : isMyRoom ? "0 0 12px rgba(124,58,237,0.08)" : "none",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color: text, marginBottom: 2 }}>{room.name}</div>
                          <div style={{ fontSize: 12, color: muted }}>
                            hosted by @{room.host_username}
                            {isMyRoom && <span style={{ marginLeft: 6, color: "#a78bfa", fontSize: 11, fontWeight: 700 }}>• your room</span>}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 4, flexShrink: 0, marginLeft: 8 }}>
                          {room.is_screen_sharing ? (
                            <span style={{
                              background: "rgba(239,68,68,0.2)", color: "#f87171",
                              padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 800,
                              display: "flex", alignItems: "center", gap: 4,
                            }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
                              LIVE
                            </span>
                          ) : null}
                          <span style={{ color: muted, fontSize: 11 }}>{room.member_count} watching</span>
                          {isMyRoom && (
                            <button
                              onClick={() => closeRoom(room.id)}
                              disabled={closing === room.id}
                              title="Close room"
                              style={{
                                background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)",
                                borderRadius: 6, padding: "2px 8px", color: "#f87171",
                                fontSize: 11, fontWeight: 700, cursor: "pointer",
                                opacity: closing === room.id ? 0.6 : 1,
                              }}
                            >
                              {closing === room.id ? "…" : "✕ Close"}
                            </button>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => joinRoom(room.id)}
                        disabled={joining === room.id}
                        style={{
                          width: "100%",
                          background: room.is_screen_sharing
                            ? "linear-gradient(135deg, #dc2626, #b91c1c)"
                            : `linear-gradient(135deg, ${purple}, #4f46e5)`,
                          border: "none", borderRadius: 8, padding: "10px 0",
                          color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
                          opacity: joining === room.id ? 0.7 : 1,
                        }}
                      >
                        {joining === room.id ? "Joining…" : room.is_screen_sharing ? "📺 Watch Live" : "🚪 Join Room"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Theater tab ── */}
      {activeTab === "theater" && sessionUserId && sessionUsername && (
        <TheaterRoom
          theaterState={theaterState}
          userId={sessionUserId}
          username={sessionUsername}
          avatarUrl={sessionAvatar}
          myCoins={0}
          theaterChat={theaterChat}
          onClose={() => setActiveTab("stream")}
          onSetVideo={onSetVideo}
          onClearVideo={onClearVideo}
          onPause={onPause}
          onUnpause={onUnpause}
          onSeek={onSeek}
          onSit={onSit}
          onStand={onStand}
          onChat={onChat}
        />
      )}

      {activeTab === "theater" && !sessionUserId && (
        <div style={{ padding: "80px 16px", textAlign: "center" as const }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎬</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: text, marginBottom: 8 }}>Sign in to enter the Theater</div>
          <div style={{ color: muted, fontSize: 14 }}>Watch YouTube together with your friends in sync.</div>
        </div>
      )}
    </div>
  );
}
