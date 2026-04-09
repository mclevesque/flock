import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

let _tableReady = false;
async function ensureTable() {
  if (_tableReady) return; _tableReady = true;
  await sql`
    CREATE TABLE IF NOT EXISTS winterfells_runs (
      id SERIAL PRIMARY KEY,
      user_id TEXT,
      username TEXT,
      score INTEGER,
      height INTEGER,
      combo INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

// POST /api/winterfells — save a completed run
export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const body = await req.json();
    const { userId, username, score, height, combo } = body;

    await sql`
      INSERT INTO winterfells_runs (user_id, username, score, height, combo)
      VALUES (${userId || null}, ${username || "guest"}, ${score || 0}, ${height || 0}, ${combo || 0})
    `;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[winterfells POST]", String(e));
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// GET /api/winterfells — fetch leaderboard
export async function GET() {
  try {
    await ensureTable();
    const leaderboard = await sql`
      SELECT DISTINCT ON (username)
        username, score, height, combo, created_at
      FROM winterfells_runs
      ORDER BY username, score DESC
    `;

    const top20 = [...leaderboard]
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 20);

    return NextResponse.json({ leaderboard: top20 });
  } catch (e) {
    console.error("[winterfells GET]", String(e));
    return NextResponse.json({ leaderboard: [] });
  }
}
