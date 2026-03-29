import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

let _tableReady = false;
async function ensureTable() {
  if (_tableReady) return; _tableReady = true;
  // Single CREATE with full schema — covers fresh installs
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
      difficulty INTEGER DEFAULT 2,
      upgrade_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  // Migrations for existing tables that predate difficulty/upgrade_count columns
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
      VALUES (
        ${userId || null}, ${username || "guest"}, ${kills || 0}, ${level || 1},
        ${streakTier || 0}, ${timeSurvived || 0}, ${gold || 0}, ${damageDealt || 0},
        ${survived || false},
        ${JSON.stringify(weapons || [])}::jsonb,
        ${JSON.stringify(passives || [])}::jsonb,
        ${deathCause || null},
        ${JSON.stringify(dmgLog || [])}::jsonb,
        ${difficulty || 2}, ${upgradeCount || 0}
      )
    `;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[outbreak POST]", String(e));
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// GET /api/outbreak?dev=1 — stats + leaderboard
export async function GET(req: NextRequest) {
  const dev = req.nextUrl.searchParams.get("dev");
  if (dev !== "1") return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  try {
    await ensureTable();

    const [runs, totals, perUser, best, leaderboard] = await Promise.all([
      sql`SELECT * FROM outbreak_runs ORDER BY created_at DESC LIMIT 50`,
      sql`SELECT COUNT(*) as total_runs, SUM(kills::int) as total_kills, AVG(kills::int)::int as avg_kills, AVG(time_survived::int)::int as avg_time, SUM(CASE WHEN survived::text = 'true' THEN 1 ELSE 0 END) as wins FROM outbreak_runs`,
      sql`SELECT username, COUNT(*) as runs, MAX(kills::int) as best_kills, MAX(level::int) as best_level, AVG(kills::int)::int as avg_kills, SUM(CASE WHEN survived::text = 'true' THEN 1 ELSE 0 END) as wins FROM outbreak_runs GROUP BY username ORDER BY best_kills DESC`,
      sql`SELECT * FROM outbreak_runs ORDER BY kills DESC LIMIT 1`,
      sql`SELECT DISTINCT ON (username, difficulty) username, difficulty, kills::int as kills, damage_dealt::int as damage_dealt, upgrade_count::int as upgrade_count, survived, time_survived::int as time_survived, created_at, 0 AS items_used
          FROM outbreak_runs ORDER BY username, difficulty, kills::int DESC`,
    ]);

    return NextResponse.json({ runs, totals: totals[0], perUser, best: best[0], leaderboard });
  } catch (e) {
    console.error("[outbreak GET]", String(e));
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
