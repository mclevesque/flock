export const dynamic = "force-dynamic";

interface Run {
  id: number;
  username: string;
  kills: number;
  level: number;
  streak_tier: number;
  time_survived: number;
  gold: number;
  damage_dealt: number;
  survived: boolean;
  weapons: { id: string; lvl: number }[];
  created_at: string;
}

interface Totals {
  total_runs: number;
  total_kills: number;
  avg_kills: number;
  avg_time: number;
  wins: number;
}

interface PerUser {
  username: string;
  runs: number;
  best_kills: number;
  best_level: number;
  avg_kills: number;
  wins: number;
}

const TIER_NAMES = ["ASLEEP", "AWAKE", "BASED!", "ASCENDED!", "GOD TIER"];

function fmt(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default async function OutbreakDevPage({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  const { key } = await searchParams;
  if (key !== "dev") {
    return <div style={{ fontFamily: "monospace", padding: 40, color: "#f55" }}>🔒 Add ?key=dev to access</div>;
  }

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/outbreak?dev=1`, { cache: "no-store" }).catch(() => null);
  const data = res?.ok ? await res.json() : null;

  const { runs = [], totals = {} as Totals, perUser = [], best } = data || {};

  return (
    <div style={{ fontFamily: "monospace", background: "#0a0010", color: "#c084fc", minHeight: "100vh", padding: 24 }}>
      <h1 style={{ color: "#ff4488", marginBottom: 4 }}>🧟 OUTBREAK DEV STATS</h1>
      <p style={{ color: "#666", marginBottom: 24, fontSize: 12 }}>Live data from all player runs</p>

      {/* Totals */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 32 }}>
        {[
          ["Total Runs", totals.total_runs],
          ["Total Kills", Number(totals.total_kills || 0).toLocaleString()],
          ["Avg Kills/Run", totals.avg_kills],
          ["Avg Survival", fmt(Number(totals.avg_time || 0))],
          ["Wins", totals.wins],
        ].map(([label, val]) => (
          <div key={String(label)} style={{ background: "#1a0030", border: "1px solid #4a0080", borderRadius: 8, padding: "12px 20px", minWidth: 120 }}>
            <div style={{ color: "#888", fontSize: 11, marginBottom: 4 }}>{label}</div>
            <div style={{ color: "#ffd700", fontSize: 22, fontWeight: "bold" }}>{val ?? "—"}</div>
          </div>
        ))}
      </div>

      {/* Best run */}
      {best && (
        <div style={{ background: "#1a0020", border: "1px solid #ff4488", borderRadius: 8, padding: 16, marginBottom: 32 }}>
          <div style={{ color: "#ff4488", fontWeight: "bold", marginBottom: 8 }}>🏆 ALL-TIME BEST RUN</div>
          <span style={{ color: "#ffd700" }}>{best.username}</span>
          {" — "}💀 {Number(best.kills).toLocaleString()} kills · LV {best.level} · {TIER_NAMES[best.streak_tier] || "?"} · {fmt(best.time_survived)} survived
        </div>
      )}

      {/* Per-user leaderboard */}
      <h2 style={{ color: "#c084fc", marginBottom: 12 }}>Players</h2>
      <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 32, fontSize: 13 }}>
        <thead>
          <tr style={{ color: "#888", borderBottom: "1px solid #333" }}>
            {["Username", "Runs", "Best Kills", "Best Level", "Avg Kills", "Wins"].map(h => (
              <th key={h} style={{ textAlign: "left", padding: "6px 12px" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {perUser.map((u: PerUser) => (
            <tr key={u.username} style={{ borderBottom: "1px solid #1a1a2e" }}>
              <td style={{ padding: "6px 12px", color: "#ffd700" }}>{u.username}</td>
              <td style={{ padding: "6px 12px" }}>{u.runs}</td>
              <td style={{ padding: "6px 12px", color: "#ff4488" }}>{Number(u.best_kills).toLocaleString()}</td>
              <td style={{ padding: "6px 12px" }}>LV {u.best_level}</td>
              <td style={{ padding: "6px 12px" }}>{u.avg_kills}</td>
              <td style={{ padding: "6px 12px", color: "#44ff88" }}>{u.wins}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Recent runs */}
      <h2 style={{ color: "#c084fc", marginBottom: 12 }}>Last 50 Runs</h2>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
        <thead>
          <tr style={{ color: "#888", borderBottom: "1px solid #333" }}>
            {["Player", "Kills", "LV", "Tier", "Time", "Dmg", "Result", "Weapons", "When"].map(h => (
              <th key={h} style={{ textAlign: "left", padding: "4px 10px" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {runs.map((r: Run) => (
            <tr key={r.id} style={{ borderBottom: "1px solid #111", opacity: r.survived ? 1 : 0.65 }}>
              <td style={{ padding: "4px 10px", color: "#ffd700" }}>{r.username}</td>
              <td style={{ padding: "4px 10px", color: "#ff4488" }}>{Number(r.kills).toLocaleString()}</td>
              <td style={{ padding: "4px 10px" }}>{r.level}</td>
              <td style={{ padding: "4px 10px", fontSize: 10 }}>{TIER_NAMES[r.streak_tier] || "?"}</td>
              <td style={{ padding: "4px 10px" }}>{fmt(r.time_survived)}</td>
              <td style={{ padding: "4px 10px", color: "#888" }}>{Number(r.damage_dealt).toLocaleString()}</td>
              <td style={{ padding: "4px 10px", color: r.survived ? "#44ff88" : "#ff4444" }}>{r.survived ? "WIN" : "DEAD"}</td>
              <td style={{ padding: "4px 10px", color: "#aaa", fontSize: 10 }}>
                {(r.weapons || []).map((w: { id: string; lvl: number }) => `${w.id}(${w.lvl})`).join(" ")}
                {(r.passives || []).length > 0 && <span style={{ color: "#7766aa" }}> | {(r.passives || []).map((p: { id: string; lvl: number }) => `${p.id}(${p.lvl})`).join(" ")}</span>}
              </td>
              <td style={{ padding: "4px 10px", color: "#555", fontSize: 10 }}>
                {new Date(r.created_at).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
