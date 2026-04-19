import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureDebateTables, sql } from "@/lib/db";
import { PRESET_TOPICS, CATEGORY_LABELS, DebateCategory } from "@/lib/debate-topics";
import { moderateTopic } from "@/lib/debate-ai";

export const runtime = "nodejs";

// GET — return preset topics (grouped by category) plus recent user-created topics
export async function GET(req: NextRequest) {
  await ensureDebateTables();
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") as DebateCategory | null;

  const presets = category ? PRESET_TOPICS.filter(t => t.category === category) : PRESET_TOPICS;

  const customRows = await sql`
    SELECT id, title, category, side_a_label, side_b_label, creator_id, created_at
    FROM debate_topics
    WHERE preset = false ${category ? sql`AND category = ${category}` : sql``}
    ORDER BY created_at DESC
    LIMIT 40
  `.catch(() => [] as Record<string, unknown>[]);

  return NextResponse.json({
    categories: CATEGORY_LABELS,
    presets,
    custom: customRows,
  });
}

// POST — create a user-authored topic (runs moderation first)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureDebateTables();

  const body = await req.json().catch(() => null) as {
    title?: string;
    category?: DebateCategory;
    sideA?: string;
    sideB?: string;
  } | null;
  const title = (body?.title ?? "").trim();
  const category = body?.category as DebateCategory | undefined;
  const sideA = (body?.sideA ?? "").trim() || null;
  const sideB = (body?.sideB ?? "").trim() || null;

  if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });
  if (!category || !(category in CATEGORY_LABELS)) return NextResponse.json({ error: "Invalid category" }, { status: 400 });

  const mod = await moderateTopic(title);
  if (!mod.ok) return NextResponse.json({ error: mod.reason }, { status: 400 });

  const id = `t_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;
  await sql`
    INSERT INTO debate_topics (id, title, category, side_a_label, side_b_label, preset, creator_id)
    VALUES (${id}, ${title}, ${category}, ${sideA}, ${sideB}, false, ${session.user.id})
  `;
  return NextResponse.json({ id, title, category, sideA, sideB });
}
