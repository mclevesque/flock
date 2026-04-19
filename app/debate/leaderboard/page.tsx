export const dynamic = "force-dynamic";

import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ensureDebateTables, sql } from "@/lib/db";
import { CATEGORY_LABELS } from "@/lib/debate-topics";

interface Row {
  id: string;
  username: string;
  avatar_url: string | null;
  wins: number;
  losses: number;
  best_streak: number;
}

export default async function DebateLeaderboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  await ensureDebateTables();

  const overall = await sql`
    SELECT u.id, u.username, u.avatar_url,
      SUM(s.wins)::int AS wins,
      SUM(s.losses)::int AS losses,
      MAX(s.best_streak)::int AS best_streak
    FROM debate_stats s
    JOIN users u ON u.id = s.user_id
    GROUP BY u.id, u.username, u.avatar_url
    ORDER BY wins DESC, losses ASC
    LIMIT 25
  ` as unknown as Row[];

  const myStats = await sql`
    SELECT category, wins, losses, streak, best_streak
    FROM debate_stats WHERE user_id = ${session.user.id}
    ORDER BY wins DESC
  ` as Array<{ category: string; wins: number; losses: number; streak: number; best_streak: number }>;

  return (
    <div style={{
      minHeight: "100vh",
      padding: "max(16px, env(safe-area-inset-top)) 16px 80px",
      background: "var(--bg, #0f0d0a)",
      color: "var(--text-primary, #e8dcc8)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Link href="/debate" style={{ color: "inherit", textDecoration: "none", fontSize: 22 }}>←</Link>
        <h1 style={{ fontFamily: "Cinzel, serif", fontSize: 22, margin: 0 }}>Leaderboard</h1>
      </div>

      {myStats.length > 0 && (
        <section style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1.5, opacity: 0.65, marginBottom: 8 }}>Your record</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {myStats.map(s => (
              <div key={s.category} style={{
                padding: "10px 12px", borderRadius: 10,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                display: "flex", justifyContent: "space-between", fontSize: 13,
              }}>
                <span>{CATEGORY_LABELS[s.category as keyof typeof CATEGORY_LABELS] ?? s.category}</span>
                <span style={{ opacity: 0.85 }}>
                  <b style={{ color: "var(--accent-purple-bright, #e8c05a)" }}>{s.wins}W</b> · {s.losses}L · streak {s.streak} · best {s.best_streak}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1.5, opacity: 0.65, marginBottom: 8 }}>Top debaters</h2>
        {overall.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", opacity: 0.6, fontSize: 13 }}>
            No closed debates yet. Someone's gotta argue first.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {overall.map((r, i) => (
              <div key={r.id} style={{
                padding: "10px 12px", borderRadius: 10,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <div style={{ width: 24, textAlign: "center", fontWeight: 800, opacity: i < 3 ? 1 : 0.5, color: i === 0 ? "var(--accent-purple-bright, #e8c05a)" : "inherit" }}>
                  {i + 1}
                </div>
                {r.avatar_url
                  ? <img src={r.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: 14, objectFit: "cover" }} />
                  : <div style={{ width: 28, height: 28, borderRadius: 14, background: "rgba(255,255,255,0.1)" }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>@{r.username}</div>
                </div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  <b style={{ color: "var(--accent-purple-bright, #e8c05a)" }}>{r.wins}W</b> · {r.losses}L
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
