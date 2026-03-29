import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

// Ensure table exists
async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS outbreak_runs (
      id SERIAL PRIMARY KEY,
      user_id TEXT,
      username TEXT,
      kills INTEGER,
      level INTEGER,
      streak_tier INTEGER,
      time_survived INTEGER,
      gold INTEGER,
      damage_dealt INTEGER,
      survived BOOLEAN,
      weapons JSONB,
      passives JSONB,
      death_cause TEXT,
      dmg_log JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE outbreak_runs ADD COLUMN IF NOT EXISTS passives JSONB`;
  await sql`ALTER TABLE outbreak_runs ADD COLUMN IF NOT EXISTS death_cause TEXT`;
  await sql`ALTER TABLE outbreak_runs ADD COLUMN IF NOT EXISTS dmg_log JSONB`;
  await sql`ALTER TABLE outbreak_runs ADD COLUMN IF NOT EXISTS difficulty INTEGER DEFAULT 2`;
  await sql`ALTER TABLE outbreak_runs ADD COLUMN IF NOT EXISTS upgrade_count INTEGER DEFAULT 0`;
}

// POST /api/outbreak — save a completed run
export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const body = await req.json();
    const { userId, username, difficulty, kills, level, streakTier, timeSurvived, gold, damageDealt, survived, weapons, passives, deathCause, dmgLog, upgradeCount } = body;

    await sql`
      INSERT INTO outbreak_runs (user_id, username, kills, level, streak_tier, time_survived, gold, damage_dealt, survived, weapons, passives, death_cause, dmg_log, difficulty, upgrade_count)
      VALUES (${userId || null}, ${username || "guest"}, ${kills || 0}, ${level || 1}, ${streakTier || 0}, ${timeSurvived || 0}, ${gold || 0}, ${damageDealt || 0}, ${survived || false}, ${JSON.stringify(weapons || [])}, ${JSON.stringify(passives || [])}, ${deathCause || null}, ${JSON.stringify(dmgLog || [])}, ${difficulty || 2}, ${upgradeCount || 0})
    `;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// GET /api/outbreak?dev=1 — dev stats viewer
export async function GET(req: NextRequest) {
  const dev = req.nextUrl.searchParams.get("dev");
  if (dev !== "1") return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  try {
    await ensureTable();

    const [runs, totals, perUser, best, leaderboard] = await Promise.all([
      // Last 50 runs
      sql`SELECT * FROM outbreak_runs ORDER BY created_at DESC LIMIT 50`,
      // Overall totals
      sql`SELECT COUNT(*) as total_runs, SUM(kills) as total_kills, AVG(kills)::int as avg_kills, AVG(time_survived)::int as avg_time, SUM(CASE WHEN survived THEN 1 ELSE 0 END) as wins FROM outbreak_runs`,
      // Per-user breakdown
      sql`SELECT username, COUNT(*) as runs, MAX(kills) as best_kills, MAX(level) as best_level, AVG(kills)::int as avg_kills, SUM(CASE WHEN survived THEN 1 ELSE 0 END) as wins FROM outbreak_runs GROUP BY username ORDER BY best_kills DESC`,
      // All-time best run
      sql`SELECT * FROM outbreak_runs ORDER BY kills DESC LIMIT 1`,
      // Leaderboard: best run per user per difficulty (ranked by kills), with items used count
      sql`SELECT DISTINCT ON (username, difficulty) username, difficulty, kills, damage_dealt, upgrade_count, survived, time_survived, created_at,
          (COALESCE(jsonb_array_length(weapons), 0) + COALESCE(jsonb_array_length(passives), 0)) AS items_used
          FROM outbreak_runs ORDER BY username, difficulty, kills DESC`,
    ]);

    return NextResponse.json({ runs, totals: totals[0], perUser, best: best[0], leaderboard });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
