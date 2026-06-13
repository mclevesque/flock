import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureDebateTables, closeExpiredDebateVoting, sql } from "@/lib/db";
import { findPreset, CATEGORY_LABELS, DebateCategory } from "@/lib/debate-topics";
import { moderateTopic } from "@/lib/debate-ai";

export const runtime = "nodejs";

// GET /api/debate — lobby feed: open challenges awaiting an opponent + active + recently closed
export async function GET() {
  await ensureDebateTables();
  await closeExpiredDebateVoting();

  const open = await sql`
    SELECT d.*, ua.username AS a_username, ua.avatar_url AS a_avatar
    FROM debates d
    JOIN users ua ON ua.id = d.user_a
    WHERE d.status = 'open' AND d.visibility = 'public'
    ORDER BY d.created_at DESC
    LIMIT 30
  `.catch(() => [] as Record<string, unknown>[]);

  const active = await sql`
    SELECT d.*,
      ua.username AS a_username, ua.avatar_url AS a_avatar,
      ub.username AS b_username, ub.avatar_url AS b_avatar
    FROM debates d
    JOIN users ua ON ua.id = d.user_a
    LEFT JOIN users ub ON ub.id = d.user_b
    WHERE d.status IN ('active', 'voting')
    ORDER BY d.updated_at DESC
    LIMIT 30
  `.catch(() => [] as Record<string, unknown>[]);

  const closed = await sql`
    SELECT d.*,
      ua.username AS a_username, ua.avatar_url AS a_avatar,
      ub.username AS b_username, ub.avatar_url AS b_avatar,
      (SELECT COUNT(*) FROM debate_votes v WHERE v.debate_id = d.id AND v.vote_side = 'a') AS votes_a,
      (SELECT COUNT(*) FROM debate_votes v WHERE v.debate_id = d.id AND v.vote_side = 'b') AS votes_b
    FROM debates d
    JOIN users ua ON ua.id = d.user_a
    LEFT JOIN users ub ON ub.id = d.user_b
    WHERE d.status = 'closed'
    ORDER BY d.updated_at DESC
    LIMIT 20
  `.catch(() => [] as Record<string, unknown>[]);

  return NextResponse.json({ open, active, closed, categories: CATEGORY_LABELS });
}

// POST /api/debate — create a new debate (open or direct-invite)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureDebateTables();

  const body = await req.json().catch(() => null) as {
    presetTopicId?: string;
    customTopicId?: string;
    customTitle?: string;
    category?: DebateCategory;
    sideALabel?: string;
    sideBLabel?: string;
    rounds?: number;
    clipLenS?: number;
    inviteeId?: string;       // if set, direct challenge
    visibility?: "public" | "private";
  } | null;
  if (!body) return NextResponse.json({ error: "Missing body" }, { status: 400 });

  // Resolve topic: preset > custom row > ad-hoc title
  let topicId: string | null = null;
  let category: DebateCategory | null = null;
  let title = "";
  let sideA = (body.sideALabel ?? "").trim();
  let sideB = (body.sideBLabel ?? "").trim();

  if (body.presetTopicId) {
    const preset = findPreset(body.presetTopicId);
    if (!preset) return NextResponse.json({ error: "Unknown preset" }, { status: 400 });
    title = preset.title;
    category = preset.category;
    sideA = sideA || preset.sideA || "Side A";
    sideB = sideB || preset.sideB || "Side B";
    // Presets are not stored in debate_topics — link by custom_title only
  } else if (body.customTopicId) {
    const rows = await sql`SELECT * FROM debate_topics WHERE id = ${body.customTopicId} LIMIT 1`;
    if (rows.length === 0) return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    const row = rows[0] as Record<string, unknown>;
    topicId = row.id as string;
    title = row.title as string;
    category = row.category as DebateCategory;
    sideA = sideA || (row.side_a_label as string | null) || "Side A";
    sideB = sideB || (row.side_b_label as string | null) || "Side B";
  } else if (body.customTitle && body.category) {
    const mod = await moderateTopic(body.customTitle);
    if (!mod.ok) return NextResponse.json({ error: mod.reason }, { status: 400 });
    title = body.customTitle.trim();
    category = body.category;
    sideA = sideA || "Side A";
    sideB = sideB || "Side B";
  } else {
    return NextResponse.json({ error: "Need a topic" }, { status: 400 });
  }

  const rounds = Math.max(1, Math.min(5, Number(body.rounds) || 3));
  const clipLen = Math.max(30, Math.min(90, Number(body.clipLenS) || 60));
  const visibility = body.visibility === "private" ? "private" : "public";

  const inviteeId = body.inviteeId && body.inviteeId !== session.user.id ? body.inviteeId : null;
  const id = `d_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;

  await sql`
    INSERT INTO debates (
      id, topic_id, custom_title, category, side_a_label, side_b_label,
      user_a, user_b, status, round_limit, clip_len_s, visibility
    ) VALUES (
      ${id}, ${topicId}, ${title}, ${category}, ${sideA}, ${sideB},
      ${session.user.id}, ${inviteeId}, ${inviteeId ? "active" : "open"}, ${rounds}, ${clipLen}, ${visibility}
    )
  `;

  return NextResponse.json({ id });
}
