"use client";
import Link from "next/link";
import { useMemo, useState } from "react";

interface DebateRow {
  id: string;
  custom_title: string | null;
  category: string | null;
  side_a_label: string;
  side_b_label: string;
  user_a: string;
  user_b: string | null;
  status: string;
  current_round: number;
  round_limit: number;
  voting_ends_at: string | null;
  winner_side: string | null;
  a_username: string;
  a_avatar: string | null;
  b_username?: string | null;
  b_avatar?: string | null;
  votes_a?: number;
  votes_b?: number;
  updated_at: string;
}

interface Props {
  open: DebateRow[];
  active: DebateRow[];
  closed: DebateRow[];
  categories: Record<string, string>;
  sessionUserId: string;
}

export default function DebateLobbyClient({ open, active, closed, categories, sessionUserId }: Props) {
  const [tab, setTab] = useState<"open" | "active" | "closed">("open");
  const rows = tab === "open" ? open : tab === "active" ? active : closed;

  const byCat = useMemo(() => {
    const m: Record<string, DebateRow[]> = {};
    for (const r of rows) {
      const c = r.category ?? "wild";
      if (!m[c]) m[c] = [];
      m[c].push(r);
    }
    return m;
  }, [rows]);

  return (
    <div style={{
      minHeight: "100vh",
      padding: "max(16px, env(safe-area-inset-top)) 16px 96px",
      background: "var(--bg, #0f0d0a)",
      color: "var(--text-primary, #e8dcc8)",
    }}>
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
        <h1 style={{ fontFamily: "Cinzel, serif", fontSize: "clamp(22px, 5.5vw, 32px)", margin: 0, color: "var(--accent-purple, #d4a942)", letterSpacing: "0.04em" }}>
          The Great Debate
        </h1>
        <Link href="/debate/leaderboard" aria-label="Leaderboard" style={{
          fontSize: 16, padding: "8px 12px", borderRadius: 10,
          border: "1px solid rgba(212,169,66,0.35)", color: "inherit", textDecoration: "none",
          flexShrink: 0,
        }}>🏆</Link>
      </header>
      <p style={{ margin: "0 0 14px", opacity: 0.6, fontSize: 12, color: "#b9a98a" }}>
        Pop-culture arguments, settled by audio. No politics. Just vibes.
      </p>

      <Link href="/debate/new" style={{
        display: "block", textAlign: "center",
        background: "var(--accent-purple, #d4a942)", color: "#1a1408",
        fontWeight: 800, padding: "14px 16px", borderRadius: 14,
        textDecoration: "none", marginBottom: 16, fontSize: 16,
        boxShadow: "0 4px 18px rgba(212,169,66,0.22)",
      }}>
        + New Debate
      </Link>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
        {([
          ["open", `Open (${open.length})`],
          ["active", `Live (${active.length})`],
          ["closed", `Verdicts (${closed.length})`],
        ] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            flex: "0 0 auto",
            padding: "8px 14px",
            borderRadius: 999,
            border: "1px solid " + (tab === k ? "var(--accent-purple, #d4a942)" : "rgba(255,255,255,0.12)"),
            background: tab === k ? "rgba(212,169,66,0.15)" : "transparent",
            color: "inherit",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}>{label}</button>
        ))}
      </div>

      {rows.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, opacity: 0.6, fontSize: 14 }}>
          {tab === "open" && "No open challenges. Start one — the lobby's waiting."}
          {tab === "active" && "No debates in progress right now."}
          {tab === "closed" && "No verdicts yet. Someone's gotta argue first."}
        </div>
      )}

      {Object.entries(byCat).map(([cat, list]) => (
        <section key={cat} style={{ marginBottom: 20 }}>
          <h2 style={{
            fontSize: 12, textTransform: "uppercase", letterSpacing: 1.5,
            opacity: 0.65, margin: "6px 0 8px", fontWeight: 700,
          }}>{categories[cat] ?? cat}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {list.map(d => <DebateCard key={d.id} d={d} tab={tab} mine={d.user_a === sessionUserId || d.user_b === sessionUserId} />)}
          </div>
        </section>
      ))}
    </div>
    </div>
  );
}

function DebateCard({ d, tab, mine }: { d: DebateRow; tab: string; mine: boolean }) {
  const totalVotes = (d.votes_a ?? 0) + (d.votes_b ?? 0);
  const aPct = totalVotes > 0 ? Math.round(((d.votes_a ?? 0) / totalVotes) * 100) : 50;

  return (
    <Link href={`/debate/${d.id}`} style={{
      display: "block",
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 14,
      padding: 14,
      textDecoration: "none",
      color: "inherit",
    }}>
      <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3, marginBottom: 10 }}>
        {d.custom_title ?? "Untitled debate"}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
        <SideChip label={d.side_a_label} user={d.a_username} avatar={d.a_avatar} />
        <span style={{ opacity: 0.4, fontSize: 11 }}>vs</span>
        {d.b_username ? (
          <SideChip label={d.side_b_label} user={d.b_username} avatar={d.b_avatar ?? null} />
        ) : (
          <div style={{
            padding: "6px 10px", borderRadius: 8,
            border: "1px dashed rgba(212,169,66,0.5)", color: "var(--accent-purple, #d4a942)",
            fontSize: 12, fontWeight: 700,
          }}>{d.side_b_label} — open slot</div>
        )}
      </div>

      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginTop: 10, fontSize: 11, opacity: 0.7,
      }}>
        <span>
          {tab === "open" && "Waiting for challenger"}
          {tab === "active" && d.status === "active" && `Round ${d.current_round}/${d.round_limit}`}
          {tab === "active" && d.status === "voting" && "Voting open"}
          {tab === "closed" && d.winner_side && `Winner: ${d.winner_side === "a" ? d.side_a_label : d.winner_side === "b" ? d.side_b_label : "Tie"}`}
        </span>
        {mine && <span style={{ color: "var(--accent-purple-bright, #e8c05a)", fontWeight: 700 }}>You're in</span>}
      </div>

      {tab === "closed" && totalVotes > 0 && (
        <div style={{ marginTop: 10, height: 6, borderRadius: 3, overflow: "hidden", background: "rgba(255,255,255,0.08)" }}>
          <div style={{ width: `${aPct}%`, height: "100%", background: "var(--accent-purple, #d4a942)" }} />
        </div>
      )}
    </Link>
  );
}

function SideChip({ label, user, avatar }: { label: string; user: string; avatar: string | null }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
      {avatar
        ? <img src={avatar} alt="" style={{ width: 22, height: 22, borderRadius: 11, objectFit: "cover", flexShrink: 0 }} />
        : <div style={{ width: 22, height: 22, borderRadius: 11, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
        <div style={{ fontSize: 10, opacity: 0.65 }}>@{user}</div>
      </div>
    </div>
  );
}
