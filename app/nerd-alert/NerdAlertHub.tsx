"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

function randomCode(): string {
  let s = "";
  for (let i = 0; i < 4; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

export default function NerdAlertHub({ userId, username }: { userId: string; username: string }) {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);

  function create() {
    setCreating(true);
    const code = randomCode();
    router.push(`/nerd-alert/${code}`);
  }

  function join(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 4) return;
    router.push(`/nerd-alert/${code}`);
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#0d0d0d", color: "#e8dcc8", padding: "32px 16px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#888", fontSize: 13, textDecoration: "none", marginBottom: 24 }}>
          ← Back to games
        </Link>

        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1 style={{
            margin: 0, fontFamily: "'Cinzel', serif", fontSize: 48, fontWeight: 800,
            letterSpacing: "0.06em",
            background: "linear-gradient(135deg, #d4a942 0%, #f4d061 50%, #c4531a 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            textShadow: "0 0 40px rgba(212,169,66,0.25)",
          }}>
            NERD ALERT!
          </h1>
          <p style={{ margin: "8px 0 0", color: "#a08040", fontFamily: "'Cinzel', serif", fontSize: 14, letterSpacing: "0.18em" }}>
            JEOPARDY · BUT NERDIER
          </p>
        </div>

        {/* Create */}
        <div style={{
          background: "linear-gradient(180deg, #1a1410 0%, #0f0c08 100%)",
          border: "1px solid #d4a942",
          borderRadius: 16,
          padding: 24,
          marginBottom: 20,
          boxShadow: "0 0 40px rgba(212,169,66,0.08)",
        }}>
          <h2 style={{ margin: "0 0 6px", fontFamily: "'Cinzel', serif", fontSize: 20, color: "#d4a942", letterSpacing: "0.06em" }}>
            🎯 START A ROOM
          </h2>
          <p style={{ margin: "0 0 16px", color: "#a08040", fontSize: 13 }}>
            Spawn a fresh 4-letter room code. Share it with your friends to have them join.
          </p>
          <button
            onClick={create}
            disabled={creating}
            style={{
              width: "100%", padding: "14px", borderRadius: 10,
              background: "linear-gradient(135deg, #d4a942, #c4531a)",
              color: "#0d0d0d", fontFamily: "'Cinzel', serif", fontWeight: 800, fontSize: 16,
              letterSpacing: "0.1em", border: "none", cursor: creating ? "default" : "pointer",
              opacity: creating ? 0.6 : 1,
            }}
          >
            {creating ? "SPAWNING…" : "CREATE ROOM"}
          </button>
        </div>

        {/* Join */}
        <form onSubmit={join} style={{
          background: "rgba(20,18,14,0.6)",
          border: "1px solid #3a2a1a",
          borderRadius: 16,
          padding: 24,
          marginBottom: 24,
        }}>
          <h2 style={{ margin: "0 0 6px", fontFamily: "'Cinzel', serif", fontSize: 20, color: "#c4531a", letterSpacing: "0.06em" }}>
            🚪 JOIN A ROOM
          </h2>
          <p style={{ margin: "0 0 16px", color: "#a08040", fontSize: 13 }}>
            Got a code from a friend? Drop it in.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
              placeholder="ABCD"
              maxLength={4}
              autoCapitalize="characters"
              spellCheck={false}
              style={{
                flex: 1, padding: "14px 16px", borderRadius: 10,
                background: "#0d0d0d", border: "1px solid #3a2a1a",
                color: "#d4a942", fontFamily: "'Cinzel', serif", fontWeight: 700,
                fontSize: 24, letterSpacing: "0.4em", textAlign: "center", outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={joinCode.trim().length !== 4}
              style={{
                padding: "0 24px", borderRadius: 10,
                background: joinCode.trim().length === 4 ? "#c4531a" : "#2a1a10",
                color: "#fff", fontFamily: "'Cinzel', serif", fontWeight: 700,
                fontSize: 14, letterSpacing: "0.08em",
                border: "none", cursor: joinCode.trim().length === 4 ? "pointer" : "not-allowed",
              }}
            >
              JOIN →
            </button>
          </div>
        </form>

        {/* Rules */}
        <div style={{
          background: "rgba(20,18,14,0.4)",
          border: "1px solid #2a2018",
          borderRadius: 12,
          padding: 20,
          fontSize: 13,
          color: "#a08040",
          lineHeight: 1.7,
        }}>
          <div style={{ color: "#d4a942", fontFamily: "'Cinzel', serif", letterSpacing: "0.08em", fontSize: 13, marginBottom: 8 }}>HOW IT WORKS</div>
          <div>• Picker chooses a tile. The clue shows for everyone.</div>
          <div>• <b style={{ color: "#f4d061" }}>BUZZ</b> as fast as you can. First buzz gets to type the answer (12s).</div>
          <div>• Right = +$ &amp; you pick next. Wrong = -$ &amp; buzzer reopens to the rest.</div>
          <div>• Watch for <b style={{ color: "#c4531a" }}>DAILY DOUBLES</b> — wager up to your whole score.</div>
          <div>• Last clue is <b style={{ color: "#c4531a" }}>FINAL NERD ALERT</b> — secret wagers, secret answers, dramatic reveal.</div>
        </div>

        <div style={{ textAlign: "center", marginTop: 24, color: "#444", fontSize: 11 }}>
          Logged in as <span style={{ color: "#a08040" }}>{username}</span>
        </div>
      </div>
    </div>
  );
}
