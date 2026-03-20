"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Lobby {
  id: string;
  name: string;
  host_id: string;
  host_name?: string;
  host_avatar?: string;
  status: string;
  player_count: number;
  max_players: number;
}

interface Props {
  lobbies: Lobby[];
  sessionUserId: string | null;
  sessionUsername: string | null;
  sessionImage: string | null;
}

export default function WaddabiLobby({ lobbies: initialLobbies, sessionUserId, sessionUsername, sessionImage }: Props) {
  const router = useRouter();
  const [lobbies, setLobbies] = useState<Lobby[]>(initialLobbies);
  const [showModal, setShowModal] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [creating, setCreating] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/waddabi");
        if (res.ok) {
          const data = await res.json();
          setLobbies(data.lobbies ?? []);
        }
      } catch {
        // ignore
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (showModal && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [showModal]);

  async function handleCreate() {
    if (!sessionUserId) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/waddabi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: roomName.trim() || `${sessionUsername ?? "Player"}'s Wadabbi?!` }),
      });
      if (!res.ok) throw new Error("Failed to create room");
      const data = await res.json();
      // Join own room
      await fetch(`/api/waddabi/${data.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join" }),
      });
      router.push(`/waddabi/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error creating room");
      setCreating(false);
    }
  }

  async function handleJoin(id: string) {
    if (!sessionUserId) return;
    setJoiningId(id);
    setError(null);
    try {
      const res = await fetch(`/api/waddabi/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to join");
      }
      router.push(`/waddabi/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error joining room");
      setJoiningId(null);
    }
  }

  const waitingLobbies = lobbies.filter(l => l.status === "waiting");
  const playingLobbies = lobbies.filter(l => l.status === "playing");

  const containerStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: "#0f0f1a",
    color: "#e8e8f0",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    padding: "0 0 60px",
  };

  const headerStyle: React.CSSProperties = {
    background: "linear-gradient(180deg, #1a0a2e 0%, #0f0f1a 100%)",
    borderBottom: "1px solid #2a1a4e",
    padding: "48px 24px 36px",
    textAlign: "center",
  };

  const titleStyle: React.CSSProperties = {
    fontSize: "clamp(2.5rem, 6vw, 4rem)",
    fontWeight: 900,
    background: "linear-gradient(135deg, #a855f7, #ec4899, #f97316)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    margin: 0,
    letterSpacing: "-1px",
  };

  const subtitleStyle: React.CSSProperties = {
    color: "#9b8bc4",
    fontSize: "1.1rem",
    marginTop: "8px",
    letterSpacing: "0.05em",
  };

  const mainStyle: React.CSSProperties = {
    maxWidth: "900px",
    margin: "0 auto",
    padding: "32px 16px",
  };

  const sectionHeaderStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "16px",
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: "1rem",
    fontWeight: 600,
    color: "#9b8bc4",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
  };

  const createBtnStyle: React.CSSProperties = {
    background: "linear-gradient(135deg, #7c3aed, #a855f7)",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "12px 28px",
    fontSize: "1rem",
    fontWeight: 700,
    cursor: sessionUserId ? "pointer" : "not-allowed",
    opacity: sessionUserId ? 1 : 0.5,
    transition: "transform 0.15s, box-shadow 0.15s",
    boxShadow: "0 4px 20px rgba(124, 58, 237, 0.4)",
  };

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "16px",
  };

  const emptyStyle: React.CSSProperties = {
    textAlign: "center",
    color: "#4a3a6a",
    padding: "40px 20px",
    background: "#13102a",
    borderRadius: "14px",
    border: "1px dashed #2a1a4e",
    fontSize: "1rem",
  };

  const modalOverlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "16px",
  };

  const modalStyle: React.CSSProperties = {
    background: "#1a1230",
    border: "1px solid #3d2a6e",
    borderRadius: "18px",
    padding: "32px",
    width: "100%",
    maxWidth: "420px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
  };

  const signInBannerStyle: React.CSSProperties = {
    background: "linear-gradient(135deg, #1a1230, #1e1040)",
    border: "1px solid #3d2a6e",
    borderRadius: "14px",
    padding: "24px",
    textAlign: "center",
    marginBottom: "32px",
  };

  function RoomCard({ lobby }: { lobby: Lobby }) {
    const isHovered = hoveredRoom === lobby.id;
    const isJoining = joiningId === lobby.id;
    const isFull = lobby.player_count >= lobby.max_players;
    const isPlaying = lobby.status === "playing";

    const cardStyle: React.CSSProperties = {
      background: isHovered ? "#1e1640" : "#16122e",
      border: `1px solid ${isHovered ? "#6d3fba" : "#2a1a4e"}`,
      borderRadius: "14px",
      padding: "20px",
      transition: "all 0.18s ease",
      cursor: "pointer",
      transform: isHovered ? "translateY(-2px)" : "none",
      boxShadow: isHovered ? "0 8px 30px rgba(109,63,186,0.25)" : "none",
    };

    const statusBadgeStyle: React.CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
      padding: "3px 10px",
      borderRadius: "20px",
      fontSize: "0.75rem",
      fontWeight: 700,
      background: isPlaying ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.2)",
      color: isPlaying ? "#f87171" : "#4ade80",
      border: `1px solid ${isPlaying ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)"}`,
    };

    const joinBtnStyle: React.CSSProperties = {
      background: isFull || isPlaying
        ? "#2a1a4e"
        : "linear-gradient(135deg, #7c3aed, #a855f7)",
      color: isFull || isPlaying ? "#5a4a7e" : "#fff",
      border: "none",
      borderRadius: "8px",
      padding: "8px 18px",
      fontSize: "0.875rem",
      fontWeight: 600,
      cursor: isFull || isPlaying || !sessionUserId ? "not-allowed" : "pointer",
      opacity: isJoining ? 0.7 : 1,
      transition: "opacity 0.15s",
    };

    return (
      <div
        style={cardStyle}
        onMouseEnter={() => setHoveredRoom(lobby.id)}
        onMouseLeave={() => setHoveredRoom(null)}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "14px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "#e8e8f0", marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {lobby.name}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#7a6a9e", fontSize: "0.8rem" }}>
              {lobby.host_avatar ? (
                <img src={lobby.host_avatar} alt="" style={{ width: "18px", height: "18px", borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: "14px" }}>🎮</span>
              )}
              <span>{lobby.host_name ?? "Host"}</span>
            </div>
          </div>
          <span style={statusBadgeStyle}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: isPlaying ? "#f87171" : "#4ade80", display: "inline-block" }} />
            {isPlaying ? "Playing" : "Waiting"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#9b8bc4", fontSize: "0.85rem" }}>
            <span>👥</span>
            <span>{lobby.player_count} / {lobby.max_players}</span>
            <div style={{ display: "flex", gap: "3px", marginLeft: "4px" }}>
              {Array.from({ length: lobby.max_players }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: i < lobby.player_count ? "#a855f7" : "#2a1a4e",
                  }}
                />
              ))}
            </div>
          </div>
          <button
            style={joinBtnStyle}
            disabled={isFull || isPlaying || !sessionUserId || isJoining}
            onClick={(e) => { e.stopPropagation(); if (!isFull && !isPlaying && sessionUserId) handleJoin(lobby.id); }}
          >
            {isJoining ? "Joining..." : isFull ? "Full" : isPlaying ? "In Progress" : "Join →"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>Wadabbi?!</h1>
        <p style={subtitleStyle}>Draw it. Guess it. Win it.</p>
        <div style={{ marginTop: "8px", display: "flex", justifyContent: "center", gap: "16px", color: "#5a4a7e", fontSize: "0.8rem" }}>
          <span>✏️ Draw a word</span>
          <span>•</span>
          <span>💬 Guess first</span>
          <span>•</span>
          <span>🏆 Reach {5} points</span>
        </div>
      </div>

      <div style={mainStyle}>
        {error && (
          <div style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", color: "#f87171", fontSize: "0.9rem" }}>
            ⚠️ {error}
          </div>
        )}

        {!sessionUserId && (
          <div style={signInBannerStyle}>
            <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>🎮</div>
            <div style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: "6px" }}>Sign in to play!</div>
            <div style={{ color: "#7a6a9e", fontSize: "0.9rem", marginBottom: "16px" }}>You need an account to create or join rooms.</div>
            <a href="/signin" style={{ display: "inline-block", background: "linear-gradient(135deg, #7c3aed, #a855f7)", color: "#fff", borderRadius: "10px", padding: "10px 24px", textDecoration: "none", fontWeight: 700, fontSize: "0.95rem" }}>
              Sign In
            </a>
          </div>
        )}

        <div style={sectionHeaderStyle}>
          <span style={sectionTitleStyle}>🟢 Open Rooms ({waitingLobbies.length})</span>
          {sessionUserId && (
            <button
              style={createBtnStyle}
              onClick={() => setShowModal(true)}
              onMouseOver={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 25px rgba(124,58,237,0.5)"; }}
              onMouseOut={e => { (e.currentTarget as HTMLElement).style.transform = "none"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(124,58,237,0.4)"; }}
            >
              + Create Room
            </button>
          )}
        </div>

        {waitingLobbies.length === 0 ? (
          <div style={emptyStyle}>
            <div style={{ fontSize: "2.5rem", marginBottom: "10px" }}>🎨</div>
            <div>No open rooms yet.</div>
            <div style={{ fontSize: "0.85rem", marginTop: "6px", color: "#3a2a5e" }}>Be the first to create one!</div>
          </div>
        ) : (
          <div style={gridStyle}>
            {waitingLobbies.map(lobby => <RoomCard key={lobby.id} lobby={lobby} />)}
          </div>
        )}

        {playingLobbies.length > 0 && (
          <>
            <div style={{ ...sectionHeaderStyle, marginTop: "36px" }}>
              <span style={sectionTitleStyle}>🔴 In Progress ({playingLobbies.length})</span>
            </div>
            <div style={gridStyle}>
              {playingLobbies.map(lobby => <RoomCard key={lobby.id} lobby={lobby} />)}
            </div>
          </>
        )}

        <div style={{ marginTop: "48px", background: "#13102a", borderRadius: "14px", border: "1px solid #1e1640", padding: "24px" }}>
          <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "16px", color: "#9b8bc4" }}>How to play</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
            {[
              { icon: "🎲", title: "Take turns", desc: "Players rotate as the drawer each round" },
              { icon: "✏️", title: "Draw the word", desc: "Drawer picks a secret word and draws it" },
              { icon: "💬", title: "Guess fast", desc: "Type your guess — first gets the most points!" },
              { icon: "🏆", title: "Reach 5 pts", desc: "First player to 5 points wins the game" },
            ].map(item => (
              <div key={item.title} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.8rem", marginBottom: "8px" }}>{item.icon}</div>
                <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "4px" }}>{item.title}</div>
                <div style={{ color: "#6a5a8e", fontSize: "0.8rem" }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showModal && (
        <div style={modalOverlayStyle} onClick={() => setShowModal(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: "1.4rem", marginBottom: "6px" }}>🎨 Create Room</div>
            <div style={{ color: "#7a6a9e", fontSize: "0.9rem", marginBottom: "24px" }}>Give your Wadabbi?! room a name</div>
            <input
              ref={inputRef}
              type="text"
              placeholder={`${sessionUsername ?? "Player"}'s Wadabbi?!`}
              value={roomName}
              onChange={e => setRoomName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowModal(false); }}
              maxLength={40}
              style={{
                width: "100%",
                background: "#0f0f1a",
                border: "2px solid #3d2a6e",
                borderRadius: "10px",
                padding: "12px 14px",
                color: "#e8e8f0",
                fontSize: "1rem",
                outline: "none",
                boxSizing: "border-box",
                marginBottom: "20px",
              }}
            />
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => { setShowModal(false); setRoomName(""); }}
                style={{ flex: 1, background: "#1e1640", color: "#9b8bc4", border: "1px solid #3d2a6e", borderRadius: "10px", padding: "12px", fontSize: "0.95rem", fontWeight: 600, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                style={{ flex: 2, background: creating ? "#4a2a8e" : "linear-gradient(135deg, #7c3aed, #a855f7)", color: "#fff", border: "none", borderRadius: "10px", padding: "12px", fontSize: "0.95rem", fontWeight: 700, cursor: creating ? "wait" : "pointer", opacity: creating ? 0.8 : 1 }}
              >
                {creating ? "Creating..." : "Create & Enter 🚀"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
