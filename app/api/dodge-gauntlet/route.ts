import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

let _tableReady = false;
async function ensureTable() {
  if (_tableReady) return; _tableReady = true;
  await sql`
    CREATE TABLE IF NOT EXISTS dodge_gauntlet_runs (
      id SERIAL PRIMARY KEY,
      user_id TEXT,
      username TEXT,
      survival_time INTEGER,
      wave_reached INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

// POST /api/dodge-gauntlet — save a completed run
export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const body = await req.json();
    const { userId, username, survivalTime, waveReached } = body;

    await sql`
      INSERT INTO dodge_gauntlet_runs (user_id, username, survival_time, wave_reached)
      VALUES (${userId || null}, ${username || "guest"}, ${survivalTime || 0}, ${waveReached || 1})
    `;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[dodge-gauntlet POST]", String(e));
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// GET /api/dodge-gauntlet — fetch leaderboard
export async function GET() {
  try {
    await ensureTable();
    const leaderboard = await sql`
      SELECT DISTINCT ON (username)
        username, survival_time, wave_reached, created_at
      FROM dodge_gauntlet_runs
      ORDER BY username, survival_time DESC
    `;

    const top20 = [...leaderboard]
      .sort((a: any, b: any) => b.survival_time - a.survival_time)
      .slice(0, 20);

    return NextResponse.json({ leaderboard: top20 });
  } catch (e) {
    console.error("[dodge-gauntlet GET]", String(e));
    return NextResponse.json({ leaderboard: [] });
  }
}
