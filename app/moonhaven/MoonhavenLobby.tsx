"use client";
import { useState, useEffect } from "react";

interface Room { id: string; playerCount: number; isPublic: boolean; }

interface Props {
  onEnter: (roomId: string) => void;
  initialCode?: string;
}

function generateCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export default function MoonhavenLobby({ onEnter, initialCode }: Props) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [canCreatePrivate, setCanCreatePrivate] = useState(true);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [joinCode, setJoinCode] = useState(initialCode ?? "");

  const fetchRooms = async () => {
    try {
      const res = await fetch("/api/moonhaven-rooms");
      const data = await res.json();
      setRooms(data.rooms ?? []);
      setCanCreatePrivate(data.canCreatePrivate ?? true);
    } catch {
      // ignore
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    fetchRooms(); // fetch once on mount — no polling, users don't linger here
  }, []);

  const handleJoin = () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) return;
    onEnter(code);
  };

  const handleCreatePrivate = () => {
    if (!canCreatePrivate) return;
    onEnter(generateCode());
  };

  // Find public and private rooms from live data
  const publicRoom = rooms.find((r) => r.isPublic);
  const privateRooms = rooms.filter((r) => !r.isPublic);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      background: "radial-gradient(ellipse at 50% 60%, #0d1f3c 0%, #050c1a 70%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "monospace",
    }}>
      {/* Background stars */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {Array.from({ length: 60 }, (_, i) => (
          <div key={i} style={{
            position: "absolute",
            left: `${Math.sin(i * 7.3) * 50 + 50}%`,
            top: `${Math.cos(i * 4.1) * 50 + 50}%`,
            width: i % 5 === 0 ? 3 : 1.5,
            height: i % 5 === 0 ? 3 : 1.5,
            borderRadius: "50%",
            background: `rgba(180,160,255,${0.2 + (i % 3) * 0.15})`,
          }} />
        ))}
      </div>

      <div style={{ position: "relative", zIndex: 1, textAlign: "center", width: "100%", maxWidth: 420, padding: "0 20px" }}>
        {/* Header */}
        <div style={{ fontSize: 52, marginBottom: 6, filter: "drop-shadow(0 0 20px rgba(180,140,255,0.6))" }}>🌙</div>
        <h1 style={{ color: "#c4b5ff", fontSize: 30, fontWeight: 900, letterSpacing: 5, margin: "0 0 4px", textTransform: "uppercase" }}>
          MOONHAVEN
        </h1>
        <p style={{ color: "rgba(180,160,255,0.4)", fontSize: 12, marginBottom: 36, letterSpacing: 3 }}>
          A MOONLIT REALM
        </p>

        {/* Card */}
        <div style={{
          background: "rgba(10,20,40,0.85)", backdropFilter: "blur(12px)",
          border: "1px solid rgba(180,140,255,0.2)", borderRadius: 18,
          padding: 24, boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
        }}>

          {/* Active Rooms Section */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: "rgba(180,160,255,0.4)", letterSpacing: 2, marginBottom: 12, textTransform: "uppercase" }}>
              Active Realms
            </div>

            {loadingRooms ? (
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, padding: "12px 0" }}>
                <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span> Loading realms…
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* Public room row — always shown */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "rgba(100,140,255,0.08)", border: "1px solid rgba(100,140,255,0.2)",
                  borderRadius: 10, padding: "10px 14px",
                }}>
                  <span style={{ color: "rgba(200,220,255,0.8)", fontSize: 13 }}>
                    🌍 Public World · <span style={{ color: "#a0c4ff" }}>
                      {publicRoom ? publicRoom.playerCount : 0} online
                    </span>
                  </span>
                  <button
                    onClick={() => onEnter("main")}
                    style={{
                      padding: "6px 14px", fontFamily: "monospace", fontWeight: 700, fontSize: 12,
                      background: "rgba(100,140,255,0.2)", border: "1px solid rgba(100,140,255,0.4)",
                      borderRadius: 7, color: "#a0c4ff", cursor: "pointer", letterSpacing: 1,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(100,140,255,0.35)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(100,140,255,0.2)")}
                  >
                    Enter →
                  </button>
                </div>

                {/* Private rooms */}
                {privateRooms.map((room) => (
                  <div key={room.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: "rgba(140,100,255,0.08)", border: "1px solid rgba(140,100,255,0.2)",
                    borderRadius: 10, padding: "10px 14px",
                  }}>
                    <span style={{ color: "rgba(200,180,255,0.8)", fontSize: 13 }}>
                      🔐 Room {room.id} · <span style={{ color: "#c4b5ff" }}>{room.playerCount} online</span>
                    </span>
                    <button
                      onClick={() => onEnter(room.id)}
                      style={{
                        padding: "6px 14px", fontFamily: "monospace", fontWeight: 700, fontSize: 12,
                        background: "rgba(140,100,255,0.2)", border: "1px solid rgba(140,100,255,0.4)",
                        borderRadius: 7, color: "#c4b5ff", cursor: "pointer", letterSpacing: 1,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(140,100,255,0.35)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "rgba(140,100,255,0.2)")}
                    >
                      Enter →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: 1, whiteSpace: "nowrap" }}>
              — CREATE OR JOIN PRIVATE ROOM —
            </span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
          </div>

          {/* Create Private Room */}
          <div style={{ position: "relative" }}>
            <button
              onClick={handleCreatePrivate}
              disabled={!canCreatePrivate}
              title={!canCreatePrivate ? "A private realm is already active" : undefined}
              style={{
                width: "100%", padding: "12px 0", fontSize: 13, fontWeight: 700,
                background: canCreatePrivate ? "rgba(100,200,100,0.1)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${canCreatePrivate ? "rgba(100,200,100,0.3)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 10,
                color: canCreatePrivate ? "#66dd88" : "rgba(255,255,255,0.2)",
                cursor: canCreatePrivate ? "pointer" : "not-allowed",
                fontFamily: "monospace", letterSpacing: 1, marginBottom: 16,
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { if (canCreatePrivate) e.currentTarget.style.background = "rgba(100,200,100,0.2)"; }}
              onMouseLeave={e => { if (canCreatePrivate) e.currentTarget.style.background = "rgba(100,200,100,0.1)"; }}
            >
              ✨ Create Private Room
            </button>
            {!canCreatePrivate && (
              <div style={{ fontSize: 10, color: "rgba(255,180,100,0.6)", marginTop: -12, marginBottom: 14, letterSpacing: 0.5 }}>
                A private realm is already active
              </div>
            )}
          </div>

          {/* Join by code */}
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
              onKeyDown={e => { if (e.key === "Enter") handleJoin(); }}
              placeholder="ROOM CODE"
              maxLength={8}
              style={{
                flex: 1, padding: "10px 12px", fontFamily: "monospace", fontWeight: 700, fontSize: 16,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8, color: "#fff", outline: "none", letterSpacing: 4,
                textAlign: "center",
              }}
            />
            <button
              onClick={handleJoin}
              disabled={joinCode.trim().length < 4}
              style={{
                padding: "10px 16px", fontFamily: "monospace", fontWeight: 700, fontSize: 13,
                background: joinCode.trim().length >= 4 ? "rgba(160,120,255,0.2)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${joinCode.trim().length >= 4 ? "rgba(180,140,255,0.4)" : "rgba(255,255,255,0.06)"}`,
                borderRadius: 8,
                color: joinCode.trim().length >= 4 ? "#c4b5ff" : "rgba(255,255,255,0.2)",
                cursor: joinCode.trim().length >= 4 ? "pointer" : "default",
              }}
            >
              Join →
            </button>
          </div>
        </div>

        <p style={{ color: "rgba(255,255,255,0.12)", fontSize: 10, marginTop: 20, letterSpacing: 1 }}>
          Share your room code so friends can join your private realm
        </p>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
