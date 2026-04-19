import { NextRequest, NextResponse } from "next/server";
import { ensureDebateTables, closeExpiredDebateVoting, sql } from "@/lib/db";
import { judgeDebate } from "@/lib/debate-ai";

export const runtime = "nodejs";
export const maxDuration = 60;

interface DebateRow {
  id: string;
  user_a: string;
  user_b: string | null;
  status: string;
  category: string | null;
  custom_title: string | null;
  side_a_label: string;
  side_b_label: string;
  winner_side: string | null;
}

interface ClipRow {
  side: string;
  round_no: number;
  transcript: string;
}

// POST /api/debate/[id]/verdict — run AI judge + finalize community winner.
// Idempotent: if a verdict row exists we return it; we refuse before voting starts.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await ensureDebateTables();
  await closeExpiredDebateVoting();
  const { id } = await ctx.params;

  const rows = await sql`SELECT * FROM debates WHERE id = ${id} LIMIT 1`;
  if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const d = rows[0] as unknown as DebateRow;

  if (d.status !== "voting" && d.status !== "closed") {
    return NextResponse.json({ error: "Verdict not ready yet" }, { status: 400 });
  }

  const existing = await sql`SELECT * FROM debate_verdicts WHERE debate_id = ${id} LIMIT 1`;
  if (existing.length > 0) {
    return NextResponse.json({ verdict: existing[0] });
  }

  // Gather transcripts + usernames for judge prompt
  const [clips, userRows] = await Promise.all([
    sql`SELECT side, round_no, transcript FROM debate_clips WHERE debate_id = ${id} ORDER BY round_no ASC` as unknown as Promise<ClipRow[]>,
    sql`
      SELECT id, username FROM users WHERE id IN (${d.user_a}, ${d.user_b ?? ""})
    ` as unknown as Promise<Array<{ id: string; username: string }>>,
  ]);
  const usernameById = new Map(userRows.map(u => [u.id, u.username]));

  const verdict = await judgeDebate({
    topic: d.custom_title ?? "Debate",
    sideALabel: d.side_a_label,
    sideBLabel: d.side_b_label,
    sideAUser: usernameById.get(d.user_a) ?? "Side A",
    sideBUser: d.user_b ? (usernameById.get(d.user_b) ?? "Side B") : "Side B",
    clips: clips.map(c => ({ side: c.side as "a" | "b", round: c.round_no, transcript: c.transcript ?? "" })),
  });

  if (verdict) {
    await sql`
      INSERT INTO debate_verdicts (debate_id, ai_winner, score_a, score_b, roast_line, reasoning)
      VALUES (${id}, ${verdict.ai_winner}, ${verdict.score_a}, ${verdict.score_b}, ${verdict.roast_line}, ${verdict.reasoning})
      ON CONFLICT (debate_id) DO NOTHING
    `;
  }

  // If voting window has already ended, make sure winner_side is finalized + stats updated.
  if (d.status === "closed" && d.winner_side === null) {
    const votesRows = await sql`
      SELECT vote_side, COUNT(*)::int AS n FROM debate_votes WHERE debate_id = ${id} GROUP BY vote_side
    ` as Array<{ vote_side: string; n: number }>;
    let a = 0, b = 0;
    for (const v of votesRows) {
      if (v.vote_side === "a") a = v.n;
      if (v.vote_side === "b") b = v.n;
    }
    const winner = a > b ? "a" : b > a ? "b" : "tie";
    await sql`UPDATE debates SET winner_side = ${winner} WHERE id = ${id}`;

    if (winner !== "tie" && d.user_b && d.category) {
      const winnerId = winner === "a" ? d.user_a : d.user_b;
      const loserId = winner === "a" ? d.user_b : d.user_a;
      await sql`
        INSERT INTO debate_stats (user_id, category, wins, losses, streak, best_streak)
        VALUES (${winnerId}, ${d.category}, 1, 0, 1, 1)
        ON CONFLICT (user_id, category) DO UPDATE
          SET wins = debate_stats.wins + 1,
              streak = debate_stats.streak + 1,
              best_streak = GREATEST(debate_stats.best_streak, debate_stats.streak + 1),
              updated_at = NOW()
      `;
      await sql`
        INSERT INTO debate_stats (user_id, category, wins, losses, streak, best_streak)
        VALUES (${loserId}, ${d.category}, 0, 1, 0, 0)
        ON CONFLICT (user_id, category) DO UPDATE
          SET losses = debate_stats.losses + 1,
              streak = 0,
              updated_at = NOW()
      `;
    }
  }

  const final = await sql`SELECT * FROM debate_verdicts WHERE debate_id = ${id} LIMIT 1`;
  return NextResponse.json({ verdict: final[0] ?? null });
}
