import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureDebateTables, closeExpiredDebateVoting, sql } from "@/lib/db";

export const runtime = "nodejs";

interface DebateRow {
  id: string;
  topic_id: string | null;
  custom_title: string | null;
  category: string | null;
  side_a_label: string;
  side_b_label: string;
  user_a: string;
  user_b: string | null;
  status: string;
  round_limit: number;
  clip_len_s: number;
  current_round: number;
  current_turn: string;
  visibility: string;
  voting_ends_at: string | null;
  winner_side: string | null;
  created_at: string;
  updated_at: string;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await ensureDebateTables();
  await closeExpiredDebateVoting();
  const { id } = await ctx.params;

  const rows = await sql`
    SELECT d.*,
      ua.username AS a_username, ua.avatar_url AS a_avatar,
      ub.username AS b_username, ub.avatar_url AS b_avatar
    FROM debates d
    JOIN users ua ON ua.id = d.user_a
    LEFT JOIN users ub ON ub.id = d.user_b
    WHERE d.id = ${id}
    LIMIT 1
  `;
  if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const debate = rows[0] as Record<string, unknown>;

  const clips = await sql`
    SELECT id, user_id, side, round_no, url, duration_ms, transcript, created_at
    FROM debate_clips
    WHERE debate_id = ${id}
    ORDER BY round_no ASC, CASE WHEN side = 'a' THEN 0 ELSE 1 END
  `;

  const voteRows = await sql`
    SELECT vote_side, COUNT(*)::int AS n FROM debate_votes
    WHERE debate_id = ${id} GROUP BY vote_side
  ` as Array<{ vote_side: string; n: number }>;
  const votes = { a: 0, b: 0 };
  for (const v of voteRows) {
    if (v.vote_side === "a") votes.a = v.n;
    else if (v.vote_side === "b") votes.b = v.n;
  }

  const verdictRows = await sql`SELECT * FROM debate_verdicts WHERE debate_id = ${id} LIMIT 1`;
  const verdict = verdictRows[0] ?? null;

  const session = await auth();
  let myVote: string | null = null;
  if (session?.user?.id) {
    const mv = await sql`SELECT vote_side FROM debate_votes WHERE debate_id = ${id} AND voter_id = ${session.user.id} LIMIT 1` as Array<{ vote_side: string }>;
    myVote = mv[0]?.vote_side ?? null;
  }

  return NextResponse.json({ debate, clips, votes, myVote, verdict, sessionUserId: session?.user?.id ?? null });
}

// POST /api/debate/[id] — body: { action: "accept" | "cancel" }
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureDebateTables();
  const { id } = await ctx.params;

  const { action } = await req.json().catch(() => ({ action: "" }));

  const rows = await sql`SELECT * FROM debates WHERE id = ${id} LIMIT 1`;
  if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const d = rows[0] as unknown as DebateRow;

  if (action === "accept") {
    if (d.status !== "open") return NextResponse.json({ error: "Debate is not open" }, { status: 400 });
    if (d.user_a === session.user.id) return NextResponse.json({ error: "Can't accept your own debate" }, { status: 400 });
    await sql`
      UPDATE debates SET user_b = ${session.user.id}, status = 'active', updated_at = NOW()
      WHERE id = ${id} AND status = 'open'
    `;
    return NextResponse.json({ ok: true });
  }

  if (action === "cancel") {
    if (d.user_a !== session.user.id) return NextResponse.json({ error: "Not your debate" }, { status: 403 });
    if (d.status !== "open") return NextResponse.json({ error: "Can't cancel once accepted" }, { status: 400 });
    await sql`DELETE FROM debates WHERE id = ${id} AND user_a = ${session.user.id} AND status = 'open'`;
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
