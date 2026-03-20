"use client";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ChallengeButton from "@/app/components/ChallengeButton";
import Link from "next/link";

interface ChessGame {
  id: string;
  white_id: string;
  black_id: string;
  white_username: string;
  black_username: string;
  status: string;
  winner_id: string | null;
  created_at: string;
}

export default function ChessHubClient() {
  const { data: session } = useSession();
  const router = useRouter();
  const [games, setGames] = useState<ChessGame[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) return;
    fetch("/api/chess/games")
      .then(r => r.json())
      .then(d => setGames(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [session?.user?.id]);

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "32px 20px" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: "var(--text-primary)", marginBottom: 6 }}>
          ♟️ Chess
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
          Challenge a friend to a rated game of chess. 1v1 only.
        </p>
      </div>

      {/* Challenge button */}
      {session?.user?.id ? (
        <div style={{ marginBottom: 32 }}>
          <ChallengeButton gameType="chess" label="⚔️ Challenge a Friend to Chess" />
        </div>
      ) : (
        <div style={{ marginBottom: 32, color: "var(--text-muted)", fontSize: 14 }}>
          Sign in to challenge friends.
        </div>
      )}

      {/* Active / recent games */}
      {games.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--accent-purple-bright)", marginBottom: 12 }}>
            Your Games
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {games.map(g => {
              const myColor = g.white_id === session?.user?.id ? "White" : "Black";
              const opponent = g.white_id === session?.user?.id ? g.black_username : g.white_username;
              const isActive = g.status === "active";
              return (
                <Link key={g.id} href={`/chess/${g.id}`} style={{ textDecoration: "none" }}>
                  <div style={{
                    background: "var(--bg-surface)", border: "1px solid var(--border)",
                    borderRadius: 12, padding: "14px 16px", display: "flex",
                    justifyContent: "space-between", alignItems: "center",
                    transition: "border-color 0.15s ease",
                  }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent-purple)")}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>
                        vs @{opponent}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                        Playing as {myColor}
                      </div>
                    </div>
                    <div>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20,
                        background: isActive ? "rgba(76,175,125,0.2)" : "rgba(90,90,128,0.2)",
                        color: isActive ? "var(--accent-green)" : "var(--text-muted)",
                        border: `1px solid ${isActive ? "var(--accent-green)" : "var(--border)"}`,
                      }}>
                        {isActive ? "Active" : g.winner_id === session?.user?.id ? "Won" : g.winner_id ? "Lost" : "Draw"}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {!session?.user?.id && (
        <div style={{ color: "var(--text-muted)", fontSize: 14, textAlign: "center", marginTop: 40 }}>
          <Link href="/signin" style={{ color: "var(--accent-purple-bright)" }}>Sign in</Link> to play chess.
        </div>
      )}
    </div>
  );
}
