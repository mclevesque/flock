import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureDebateTables, sql } from "@/lib/db";

export const runtime = "nodejs";

interface DebateRow {
  id: string; user_a: string; user_b: string | null; status: string;
}

// POST /api/debate/[id]/vote — body: { side: "a" | "b", reaction?: string }
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureDebateTables();
  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({})) as { side?: string; reaction?: string };
  const side = body.side === "a" || body.side === "b" ? body.side : null;
  if (!side) return NextResponse.json({ error: "Invalid side" }, { status: 400 });

  const rows = await sql`SELECT * FROM debates WHERE id = ${id} LIMIT 1`;
  if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const d = rows[0] as unknown as DebateRow;
  if (d.status !== "voting" && d.status !== "closed") {
    return NextResponse.json({ error: "Voting isn't open" }, { status: 400 });
  }
  if (d.user_a === session.user.id || d.user_b === session.user.id) {
    return NextResponse.json({ error: "Debaters can't vote on their own debate" }, { status: 400 });
  }

  const reaction = String(body.reaction ?? "").slice(0, 140);

  await sql`
    INSERT INTO debate_votes (debate_id, voter_id, vote_side, reaction)
    VALUES (${id}, ${session.user.id}, ${side}, ${reaction})
    ON CONFLICT (debate_id, voter_id)
    DO UPDATE SET vote_side = EXCLUDED.vote_side, reaction = EXCLUDED.reaction, created_at = NOW()
  `;

  return NextResponse.json({ ok: true });
}
