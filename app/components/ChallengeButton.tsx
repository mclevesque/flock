"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface Friend {
  id: string;
  username: string;
  avatar_url: string | null;
}

interface Props {
  gameType: "chess" | "quiz" | "emulator";
  gameName?: string;
  label?: string;
  style?: React.CSSProperties;
}

export default function ChallengeButton({ gameType, gameName, label, style }: Props) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [ranked, setRanked] = useState(true);

  useEffect(() => {
    if (!open || !session?.user?.id) return;
    setLoading(true);
    fetch("/api/friends")
      .then(r => r.json())
      .then(d => setFriends(Array.isArray(d) ? d : (Array.isArray(d.friends) ? d.friends : [])))
      .catch(() => setFriends([]))
      .finally(() => setLoading(false));
  }, [open, session?.user?.id]);

  async function sendChallenge(toUserId: string) {
    setSending(toUserId);
    try {
      await fetch("/api/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId, gameType, gameName, ranked }),
      });
      setSent(toUserId);
      setTimeout(() => {
        setSent(null);
        setOpen(false);
      }, 1500);
    } catch { /* ignore */ }
    setSending(null);
  }

  if (!session?.user?.id) return null;

  const btnLabel = label ?? `⚔️ Challenge a Friend`;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))",
          border: "none", borderRadius: 8, padding: "8px 16px",
          color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
          ...style,
        }}
      >
        {btnLabel}
      </button>

      {open && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
            zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div style={{
            background: "var(--bg-elevated)", border: "1px solid var(--border)",
            borderRadius: 16, padding: 24, width: 340, maxWidth: "90vw",
            boxShadow: "0 16px 64px rgba(0,0,0,0.5)",
          }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>
                  Challenge a Friend
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  {gameType === "chess" ? "♟️ Chess" : gameType === "quiz" ? "🧠 Quiz" : `🎮 ${gameName ?? "SNES"}`}
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 22, cursor: "pointer", lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {/* Ranked / Unranked toggle — only for emulator (fighting games) */}
            {gameType === "emulator" && (
              <div style={{
                display: "flex", gap: 6, marginBottom: 16,
                background: "var(--bg-surface)", borderRadius: 10, padding: 4,
                border: "1px solid var(--border)",
              }}>
                <button
                  onClick={() => setRanked(true)}
                  style={{
                    flex: 1, padding: "6px 0", borderRadius: 7, border: "none",
                    fontWeight: 700, fontSize: 12, cursor: "pointer",
                    background: ranked ? "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))" : "transparent",
                    color: ranked ? "#fff" : "var(--text-muted)",
                    transition: "all 0.15s ease",
                  }}
                >
                  🏆 Ranked
                </button>
                <button
                  onClick={() => setRanked(false)}
                  style={{
                    flex: 1, padding: "6px 0", borderRadius: 7, border: "none",
                    fontWeight: 700, fontSize: 12, cursor: "pointer",
                    background: !ranked ? "rgba(90,90,128,0.3)" : "transparent",
                    color: !ranked ? "var(--text-primary)" : "var(--text-muted)",
                    transition: "all 0.15s ease",
                  }}
                >
                  🎮 Unranked
                </button>
              </div>
            )}

            {/* Friend list */}
            {loading ? (
              <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 24, fontSize: 13 }}>
                Loading friends…
              </div>
            ) : friends.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 24, fontSize: 13 }}>
                No friends yet — add some from your profile!
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflowY: "auto" }}>
                {friends.map(f => (
                  <div key={f.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    background: "var(--bg-surface)", borderRadius: 10,
                    padding: "10px 12px", border: "1px solid var(--border)",
                  }}>
                    <img
                      src={f.avatar_url ?? `https://api.dicebear.com/9.x/pixel-art/svg?seed=${f.username}`}
                      alt={f.username}
                      style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid var(--border-bright)", flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, fontWeight: 600, color: "var(--text-primary)", fontSize: 14 }}>
                      @{f.username}
                    </div>
                    <button
                      onClick={() => sendChallenge(f.id)}
                      disabled={sending === f.id || sent === f.id}
                      style={{
                        background: sent === f.id
                          ? "var(--accent-green)"
                          : "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))",
                        border: "none", borderRadius: 7, padding: "6px 14px",
                        color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
                        opacity: sending === f.id ? 0.6 : 1,
                        transition: "background 0.2s ease",
                      }}
                    >
                      {sent === f.id ? "Sent! ✓" : sending === f.id ? "…" : "Challenge"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
