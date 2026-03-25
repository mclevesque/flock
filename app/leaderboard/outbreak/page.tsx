export const dynamic = "force-dynamic";

interface LeaderboardEntry {
  username: string;
  difficulty: number;
  kills: number;
  damage_dealt: number;
  upgrade_count: number;
  survived: boolean;
  time_survived: number;
}

const DIFF_NAMES = ["", "CASUAL", "NORMAL", "HARD", "NIGHTMARE"];
const DIFF_COLORS = ["", "#44ffaa", "#aaddff", "#ffaa44", "#ff4444"];
const DIFF_DESC = ["", "Beginner friendly", "Balanced", "Requires upgrades", "Max upgrades required"];

function fmt(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default async function OutbreakLeaderboardPage({ searchParams }: { searchParams: Promise<{ diff?: string }> }) {
  const { diff } = await searchParams;
  const activeDiff = Math.max(1, Math.min(4, parseInt(diff || "2")));

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/outbreak?dev=1`, { cache: "no-store" }).catch(() => null);
  const data = res?.ok ? await res.json() : null;
  const leaderboard: LeaderboardEntry[] = (data?.leaderboard || [])
    .filter((e: LeaderboardEntry) => e.difficulty === activeDiff)
    .sort((a: LeaderboardEntry, b: LeaderboardEntry) => b.kills - a.kills);

  return (
    <div style={{ fontFamily: "monospace", background: "#0a0010", color: "#c084fc", minHeight: "100vh", padding: 24 }}>
      <h1 style={{ color: "#ff4488", marginBottom: 4 }}>🧟 OUTBREAK LEADERBOARD</h1>
      <p style={{ color: "#666", marginBottom: 20, fontSize: 12 }}>Best run per player • Ranked by kills</p>

      {/* Difficulty tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {[1,2,3,4].map(d => (
          <a key={d} href={`?diff=${d}`} style={{
            padding: "8px 20px", borderRadius: 6, textDecoration: "none", fontSize: 13, fontWeight: "bold",
            background: d === activeDiff ? DIFF_COLORS[d] + "22" : "rgba(0,0,0,0.4)",
            border: `1px solid ${d === activeDiff ? DIFF_COLORS[d] : "rgba(255,255,255,0.1)"}`,
            color: d === activeDiff ? DIFF_COLORS[d] : "rgba(255,255,255,0.4)",
          }}>{DIFF_NAMES[d]}</a>
        ))}
      </div>

      <p style={{ color: DIFF_COLORS[activeDiff], fontSize: 12, marginBottom: 20 }}>{DIFF_DESC[activeDiff]}</p>

      {leaderboard.length === 0 ? (
        <p style={{ color: "#444" }}>No runs recorded on this difficulty yet.</p>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: 700 }}>
          <thead>
            <tr style={{ color: "#888", borderBottom: "1px solid #333" }}>
              {["#", "Player", "Kills", "Damage", "Upgrades", "Result", "Time"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "8px 14px", fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((e: LeaderboardEntry, i: number) => (
              <tr key={e.username} style={{ borderBottom: "1px solid #1a1a2e" }}>
                <td style={{ padding: "8px 14px", color: i===0?"#ffd700":i===1?"#aaaaaa":i===2?"#cc8844":"#555", fontWeight: "bold", fontSize: 14 }}>
                  {i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}
                </td>
                <td style={{ padding: "8px 14px", color: "#ffd700", fontWeight: "bold" }}>{e.username}</td>
                <td style={{ padding: "8px 14px", color: "#ff4488", fontSize: 16, fontWeight: "bold" }}>{Number(e.kills).toLocaleString()}</td>
                <td style={{ padding: "8px 14px", color: "#888", fontSize: 12 }}>{Number(e.damage_dealt).toLocaleString()}</td>
                <td style={{ padding: "8px 14px", color: e.upgrade_count === 0 ? "#44ff88" : "#888", fontSize: 12 }}>
                  {e.upgrade_count === 0 ? "✨ none" : e.upgrade_count}
                </td>
                <td style={{ padding: "8px 14px", color: e.survived ? "#44ff88" : "#ff4444", fontSize: 12 }}>
                  {e.survived ? "WIN" : "DEAD"}
                </td>
                <td style={{ padding: "8px 14px", color: "#555", fontSize: 12 }}>{fmt(e.time_survived)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: 32, fontSize: 11, color: "#333" }}>
        ✨ = no upgrades used (fair play run)
      </div>
    </div>
  );
}
