import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { sql } from "@/lib/db";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET!;

async function r2Get<T>(key: string): Promise<T | null> {
  try {
    const res = await r2.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const body = await res.Body?.transformToString();
    return body ? JSON.parse(body) : null;
  } catch {
    return null;
  }
}

// GET /api/migrate-outbreak?secret=migrate2024
// Dry-run by default. Add &run=1 to actually insert.
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== "migrate2024") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dryRun = req.nextUrl.searchParams.get("run") !== "1";

  // ── 1. Pull runs + leaderboard from R2 ──────────────────────────────
  const outbreakData = await r2Get<{
    runs: Array<{
      username: string; difficulty: number; kills: number; level: number;
      streakTier: number; timeSurvived: number; gold: number;
      survived: boolean; upgradeCount: number; created_at: string;
    }>;
    leaderboard: Array<{
      username: string; kills: number; gold: number;
      difficulty: number; upgradeCount: number;
    }>;
  }>("games/outbreak/runs.json");

  const runs = outbreakData?.runs ?? [];
  const leaderboard = outbreakData?.leaderboard ?? [];

  // ── 2. Pull user progression from R2 ────────────────────────────────
  const userIndex = await r2Get<string[]>("users/_index.json") ?? [];
  const progressionResults: Record<string, { goldBank: number; powerups: Record<string, number> }> = {};

  for (const username of userIndex) {
    const profile = await r2Get<{
      stats?: {
        outbreak_meta?: { powerups?: Record<string, number>; goldBank?: number };
        outbreak_gold?: number;
        outbreak_total_kills?: number;
        outbreak_total_runs?: number;
      };
    }>(`users/${username.toLowerCase()}.json`);

    if (profile?.stats?.outbreak_meta) {
      progressionResults[username] = {
        goldBank: profile.stats.outbreak_meta.goldBank ?? 0,
        powerups: profile.stats.outbreak_meta.powerups ?? {},
      };
    }
  }

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      runsFound: runs.length,
      leaderboardEntries: leaderboard.length,
      usersWithProgression: Object.keys(progressionResults).length,
      progressionPreview: progressionResults,
      leaderboardPreview: leaderboard,
      message: "Add &run=1 to actually import",
    });
  }

  // ── 3. Ensure tables exist ───────────────────────────────────────────
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
      created_at TIMESTAMPTZ DEFAULT NOW(),
      difficulty INTEGER DEFAULT 2,
      upgrade_count INTEGER DEFAULT 0
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS outbreak_progression (
      username TEXT PRIMARY KEY,
      gold_bank INTEGER DEFAULT 0,
      powerups JSONB DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // ── 4. Import runs ───────────────────────────────────────────────────
  let runsInserted = 0;
  for (const run of runs) {
    try {
      await sql`
        INSERT INTO outbreak_runs
          (username, kills, level, streak_tier, time_survived, gold, survived, difficulty, upgrade_count, created_at)
        VALUES
          (${run.username}, ${run.kills || 0}, ${run.level || 1}, ${run.streakTier || 0},
           ${run.timeSurvived || 0}, ${run.gold || 0}, ${run.survived || false},
           ${run.difficulty || 2}, ${run.upgradeCount || 0},
           ${run.created_at || new Date().toISOString()})
        ON CONFLICT DO NOTHING
      `;
      runsInserted++;
    } catch { /* skip dupes */ }
  }

  // ── 5. Import progression ────────────────────────────────────────────
  let progressionInserted = 0;
  for (const [username, prog] of Object.entries(progressionResults)) {
    await sql`
      INSERT INTO outbreak_progression (username, gold_bank, powerups)
      VALUES (${username}, ${prog.goldBank}, ${JSON.stringify(prog.powerups)})
      ON CONFLICT (username) DO UPDATE SET
        gold_bank = EXCLUDED.gold_bank,
        powerups = EXCLUDED.powerups,
        updated_at = NOW()
    `;
    progressionInserted++;
  }

  return NextResponse.json({
    ok: true,
    runsInserted,
    progressionInserted,
    leaderboardEntries: leaderboard.length,
    message: "Migration complete. Refresh /leaderboards to see Outbreak data.",
  });
}
