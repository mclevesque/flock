import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureDebateTables, sql } from "@/lib/db";

export const runtime = "nodejs";

// POST /api/debate/highlights — body: { clipId: string } — turn a clip into a shareable snippet.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureDebateTables();

  const { clipId } = await req.json().catch(() => ({})) as { clipId?: string };
  if (!clipId) return NextResponse.json({ error: "clipId required" }, { status: 400 });

  const clipRows = await sql`SELECT id, debate_id, url FROM debate_clips WHERE id = ${clipId} LIMIT 1`;
  if (clipRows.length === 0) return NextResponse.json({ error: "Clip not found" }, { status: 404 });

  // Only let the debater or the clip's own user share — keep the noise down
  const debateId = (clipRows[0] as Record<string, unknown>).debate_id as string;
  const dRows = await sql`SELECT user_a, user_b FROM debates WHERE id = ${debateId} LIMIT 1`;
  const d = dRows[0] as Record<string, unknown> | undefined;
  if (!d || (d.user_a !== session.user.id && d.user_b !== session.user.id)) {
    return NextResponse.json({ error: "Only debaters can create highlights" }, { status: 403 });
  }

  const shareKey = `${Math.random().toString(36).slice(2, 8)}${Math.random().toString(36).slice(2, 6)}`;
  const id = `h_${Math.random().toString(36).slice(2, 10)}`;
  await sql`
    INSERT INTO debate_highlights (id, clip_id, sharer_id, share_key)
    VALUES (${id}, ${clipId}, ${session.user.id}, ${shareKey})
  `;

  return NextResponse.json({ id, shareKey, url: (clipRows[0] as Record<string, unknown>).url });
}
