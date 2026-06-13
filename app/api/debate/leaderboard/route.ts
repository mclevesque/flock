import { NextRequest, NextResponse } from "next/server";
import { ensureDebateTables, sql } from "@/lib/db";
import { CATEGORY_LABELS, DebateCategory } from "@/lib/debate-topics";

export const runtime = "nodejs";

// GET /api/debate/leaderboard?category=star_wars
// Returns top debaters overall + within a category, plus the current user's stats.
export async function GET(req: NextRequest) {
  await ensureDebateTables();
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") as DebateCategory | null;

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
  `.catch(() => [] as Record<string, unknown>[]);

  const byCategory = category && category in CATEGORY_LABELS
    ? await sql`
        SELECT u.id, u.username, u.avatar_url, s.wins, s.losses, s.streak, s.best_streak
        FROM debate_stats s
        JOIN users u ON u.id = s.user_id
        WHERE s.category = ${category}
        ORDER BY s.wins DESC, s.losses ASC
        LIMIT 25
      `.catch(() => [] as Record<string, unknown>[])
    : [];

  return NextResponse.json({ overall, byCategory, category, categories: CATEGORY_LABELS });
}
