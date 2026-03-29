"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/lib/use-session";
import { useRouter } from "next/navigation";

type Tab = "overview" | "chess" | "outbreak" | "quiz";

const DIFFICULTIES = [
  { id: 1, label: "CASUAL" },
  { id: 2, label: "NORMAL" },
  { id: 3, label: "HARD" },
  { id: 4, label: "NIGHTMARE" },
];

interface Player {
  username: string;
  display_name?: string;
  chess_rating: number;
  chess_wins: number;
  chess_losses: number;
  quiz_rating: number;
  quiz_wins: number;
  quiz_losses: number;
}

interface OutbreakEntry {
  username: string;
  kills: string | number;
  difficulty: string | number;
  upgrade_count?: string | number;
  items_used?: string | number;
  damage_dealt?: string | number;
  survived?: boolean;
}

function RankNum({ rank }: { rank: number }) {
  const color = rank === 1 ? "var(--accent-purple-bright)" : rank === 2 ? "#9ca3af" : rank === 3 ? "#e8764a" : "var(--text-muted)";
  return (
    <span style={{ width: 22, flexShrink: 0, fontWeight: 700, fontSize: 13, color, textAlign: "center" }}>
      {rank}
    </span>
  );
}

function LeaderRow({ rank, name, value }: { rank: number; name: string; value: string | number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <RankNum rank={rank} />
      <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
      <span style={{ color: "var(--accent-purple-bright)", fontWeight: 600, fontSize: 13, minWidth: 60, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function LeaderRowFull({ rank, name, col1, col2, value }: { rank: number; name: string; col1?: string | number; col2?: string | number; value: string | number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <RankNum rank={rank} />
      <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
      {col1 !== undefined && <span style={{ color: "var(--text-muted)", fontSize: 11, width: 28, textAlign: "center" }}>{col1}</span>}
      {col2 !== undefined && <span style={{ color: "var(--text-muted)", fontSize: 11, width: 28, textAlign: "center" }}>{col2}</span>}
      <span style={{ color: "var(--accent-purple-bright)", fontWeight: 600, fontSize: 13, minWidth: 60, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--bg-surface)", border: "1px solid var(--border)",
      borderRadius: 14, padding: "20px 20px 14px",
    }}>
      {children}
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-purple-bright)", letterSpacing: "0.15em", marginBottom: 14 }}>
      {children}
    </div>
  );
}

function ViewAll({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      marginTop: 12, fontSize: 11, color: "var(--text-muted)", background: "none",
      border: "none", cursor: "pointer", letterSpacing: "0.1em", padding: 0,
      fontWeight: 700,
    }}>
      VIEW ALL →
    </button>
  );
}

function ColHeader({ cols }: { cols: string[] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 0 8px", borderBottom: "1px solid var(--border)", marginBottom: 4 }}>
      <span style={{ width: 22 }} />
      <span style={{ flex: 1, fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.1em" }}>PLAYER</span>
      {cols.map((c, i) => (
        <span key={i} style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.1em", width: i < cols.length - 1 ? 28 : 60, textAlign: "center" }}>{c}</span>
      ))}
    </div>
  );
}

export default function LeaderboardsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [diffTab, setDiffTab] = useState(2);
  const [players, setPlayers] = useState<Player[]>([]);
  const [outbreakEntries, setOutbreakEntries] = useState<OutbreakEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/signin");
  }, [status, router]);

  useEffect(() => {
    Promise.all([
      fetch("/api/users/all").then(r => r.ok ? r.json() : []).catch(() => []),
      fetch("/api/outbreak?dev=1").then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([users, outbreak]) => {
      setPlayers(users || []);
      if (outbreak?.leaderboard) setOutbreakEntries(outbreak.leaderboard);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const byChess = [...players].sort((a, b) => b.chess_rating - a.chess_rating);
  const byQuiz  = [...players].filter(u => u.quiz_wins > 0 || u.quiz_losses > 0).sort((a, b) => b.quiz_rating - a.quiz_rating);

  // Best kills per user across all difficulties
  const bestKillsMap = new Map<string, number>();
  outbreakEntries.forEach(e => {
    const cur = bestKillsMap.get(e.username) || 0;
    if (Number(e.kills) > cur) bestKillsMap.set(e.username, Number(e.kills));
  });
  const overviewOutbreak = Array.from(bestKillsMap.entries())
    .map(([username, kills]) => ({ username, kills }))
    .sort((a, b) => b.kills - a.kills);

  const fmtDmg = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}m` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k` : String(n);

  const filteredOutbreak = outbreakEntries
    .filter(e => Number(e.difficulty) === diffTab)
    .sort((a, b) => Number(b.kills) - Number(a.kills))
    .slice(0, 15)
    .map(e => ({ ...e, username: e.username === "guest" ? "Mystery Knight" : e.username }));

  const TABS: { id: Tab; label: string; emoji: string }[] = [
    { id: "overview", label: "OVERVIEW", emoji: "🏆" },
    { id: "chess",    label: "CHESS",    emoji: "♟️" },
    { id: "outbreak", label: "OUTBREAK", emoji: "🧟" },
    { id: "quiz",     label: "QUIZ",     emoji: "🧠" },
  ];

  if (loading || status === "loading") {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 52px)", color: "var(--text-muted)" }}>Loading...</div>;
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px 80px" }}>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "0.12em", color: "var(--text-primary)", margin: "0 0 4px", textTransform: "uppercase" }}>
          🏆 Leaderboards
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>The eternal rankings of Great Souls</p>
      </div>

      {/* Tab bar */}
      <div style={{
        display: "flex", gap: 4,
        background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: 12, padding: 4, marginBottom: 24, overflowX: "auto",
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, minWidth: 60, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "8px 12px", borderRadius: 8, fontWeight: 700, fontSize: 11,
            letterSpacing: "0.1em", cursor: "pointer", minHeight: 40, border: "none",
            background: tab === t.id ? "var(--accent-purple)" : "transparent",
            color: tab === t.id ? "#fff" : "var(--text-muted)",
            transition: "all 0.15s",
          }}>
            <span>{t.emoji}</span>
            <span style={{ display: "inline" }}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          <Card>
            <CardTitle>♟️ CHESS ELO</CardTitle>
            {byChess.slice(0, 3).map((u, i) => (
              <LeaderRow key={u.username} rank={i + 1} name={u.username} value={u.chess_rating} />
            ))}
            {byChess.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "center", padding: "12px 0" }}>No games yet</p>}
            <ViewAll onClick={() => setTab("chess")} />
          </Card>

          <Card>
            <CardTitle>🧟 OUTBREAK KILLS</CardTitle>
            {overviewOutbreak.slice(0, 3).map((e, i) => (
              <LeaderRow key={e.username} rank={i + 1} name={e.username} value={`${e.kills.toLocaleString()} kills`} />
            ))}
            {overviewOutbreak.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "center", padding: "12px 0" }}>No runs yet</p>}
            <ViewAll onClick={() => setTab("outbreak")} />
          </Card>

          <Card>
            <CardTitle>🧠 QUIZ ELO</CardTitle>
            {byQuiz.slice(0, 3).map((u, i) => (
              <LeaderRow key={u.username} rank={i + 1} name={u.username} value={u.quiz_rating} />
            ))}
            {byQuiz.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "center", padding: "12px 0" }}>No games yet</p>}
            <ViewAll onClick={() => setTab("quiz")} />
          </Card>

        </div>
      )}

      {/* ── CHESS ── */}
      {tab === "chess" && (
        <Card>
          <CardTitle>♟️ CHESS — ELO RANKINGS</CardTitle>
          <ColHeader cols={["W", "L", "ELO"]} />
          {byChess.map((u, i) => (
            <LeaderRowFull key={u.username} rank={i + 1} name={u.username}
              col1={u.chess_wins} col2={u.chess_losses} value={u.chess_rating} />
          ))}
          {byChess.length === 0 && <p style={{ color: "var(--text-muted)", textAlign: "center", padding: 20 }}>No games played yet.</p>}
        </Card>
      )}

      {/* ── OUTBREAK ── */}
      {tab === "outbreak" && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
            {DIFFICULTIES.map(d => (
              <button key={d.id} onClick={() => setDiffTab(d.id)} style={{
                padding: "8px 20px", borderRadius: 8, fontSize: 11, fontWeight: 700,
                letterSpacing: "0.1em", cursor: "pointer", flexShrink: 0, minHeight: 40,
                background: d.id === diffTab ? "var(--accent-purple)" : "var(--bg-surface)",
                color: d.id === diffTab ? "#fff" : "var(--text-muted)",
                border: `1px solid ${d.id === diffTab ? "var(--accent-purple)" : "var(--border)"}`,
                transition: "all 0.15s",
              }}>
                {d.label}
              </button>
            ))}
          </div>
          <Card>
            <CardTitle>🧟 OUTBREAK — {DIFFICULTIES.find(d => d.id === diffTab)?.label}</CardTitle>
            <ColHeader cols={["DAMAGE", "KILLS"]} />
            {filteredOutbreak.map((e, i) => (
              <LeaderRowFull key={e.username + i} rank={i + 1} name={e.username}
                col1={e.damage_dealt != null ? fmtDmg(Number(e.damage_dealt)) : "—"} value={Number(e.kills).toLocaleString()} />
            ))}
            {filteredOutbreak.length === 0 && (
              <p style={{ color: "var(--text-muted)", textAlign: "center", padding: 20 }}>
                No runs on {DIFFICULTIES.find(d => d.id === diffTab)?.label} yet.
              </p>
            )}
          </Card>
        </>
      )}

      {/* ── QUIZ ── */}
      {tab === "quiz" && (
        <Card>
          <CardTitle>🧠 QUIZ — ELO RANKINGS</CardTitle>
          <ColHeader cols={["W", "L", "ELO"]} />
          {byQuiz.map((u, i) => (
            <LeaderRowFull key={u.username} rank={i + 1} name={u.username}
              col1={u.quiz_wins} col2={u.quiz_losses} value={u.quiz_rating} />
          ))}
          {byQuiz.length === 0 && <p style={{ color: "var(--text-muted)", textAlign: "center", padding: 20 }}>No quiz games played yet.</p>}
        </Card>
      )}

      <div style={{ marginTop: 32, textAlign: "center" }}>
        <a href="/games" style={{ color: "var(--text-muted)", fontSize: 12, letterSpacing: "0.1em", textDecoration: "none", fontWeight: 700 }}>
          ← BACK TO GAMES
        </a>
      </div>
    </div>
  );
}
