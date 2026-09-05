import { sql } from "@/lib/db";
import { STARTING_RATING, eloUpdate } from "./engine";

/**
 * DraftMasters records — ratings and win/loss, kept in their own tables so
 * this never touches the shared lib/db.ts schema.
 *
 * Rating is Elo (K=32) and only moves on PvP. Solo games against the house
 * count toward a separate W/L so a long solo grind can't inflate the ladder.
 */

let ready = false;

export async function ensureDraftMastersTables() {
  if (ready) return;
  ready = true;
  await sql`
    CREATE TABLE IF NOT EXISTS draftmasters_players (
      user_id      TEXT PRIMARY KEY,
      name         TEXT NOT NULL DEFAULT 'Drafter',
      rating       INTEGER NOT NULL DEFAULT 1000,  -- STARTING_RATING; DDL can't take a bound parameter
      pvp_wins     INTEGER NOT NULL DEFAULT 0,
      pvp_losses   INTEGER NOT NULL DEFAULT 0,
      solo_wins    INTEGER NOT NULL DEFAULT 0,
      solo_losses  INTEGER NOT NULL DEFAULT 0,
      streak       INTEGER NOT NULL DEFAULT 0,
      best_streak  INTEGER NOT NULL DEFAULT 0,
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS draftmasters_matches (
      id           TEXT PRIMARY KEY,
      mode         TEXT NOT NULL,                -- 'pvp' | 'solo'
      room_code    TEXT,
      topic        TEXT NOT NULL,
      winner_id    TEXT NOT NULL,
      loser_id     TEXT NOT NULL,
      winner_name  TEXT NOT NULL,
      loser_name   TEXT NOT NULL,
      winner_roster JSONB NOT NULL,
      loser_roster  JSONB NOT NULL,
      verdict      JSONB,
      rating_delta INTEGER NOT NULL DEFAULT 0,
      reported_by  TEXT,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS dm_players_rating_idx ON draftmasters_players (rating DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS dm_matches_created_idx ON draftmasters_matches (created_at DESC)`;
}

export interface RecordRow {
  userId: string;
  name: string;
  rating: number;
  pvpWins: number;
  pvpLosses: number;
  soloWins: number;
  soloLosses: number;
  streak: number;
  bestStreak: number;
}

function toRecord(r: Record<string, unknown>): RecordRow {
  return {
    userId: String(r.user_id),
    name: String(r.name),
    rating: Number(r.rating),
    pvpWins: Number(r.pvp_wins),
    pvpLosses: Number(r.pvp_losses),
    soloWins: Number(r.solo_wins),
    soloLosses: Number(r.solo_losses),
    streak: Number(r.streak),
    bestStreak: Number(r.best_streak),
  };
}

export async function getRecord(userId: string): Promise<RecordRow | null> {
  await ensureDraftMastersTables();
  const rows = await sql`SELECT * FROM draftmasters_players WHERE user_id = ${userId}`;
  return rows[0] ? toRecord(rows[0]) : null;
}

export async function getLeaderboard(limit = 25): Promise<RecordRow[]> {
  await ensureDraftMastersTables();
  const rows = await sql`
    SELECT * FROM draftmasters_players
    WHERE pvp_wins + pvp_losses > 0
    ORDER BY rating DESC, pvp_wins DESC
    LIMIT ${limit}
  `;
  return rows.map(toRecord);
}

interface MatchInput {
  id: string;
  mode: "pvp" | "solo";
  roomCode: string | null;
  topic: string;
  winner: { id: string; name: string; roster: unknown; isNpc: boolean };
  loser: { id: string; name: string; roster: unknown; isNpc: boolean };
  verdict: unknown;
  reportedBy: string;
}

/**
 * Record a finished match. Idempotent on match id, so both clients in a room
 * can report the same game and it only counts once.
 */
export async function recordMatch(m: MatchInput): Promise<{ delta: number; duplicate: boolean }> {
  await ensureDraftMastersTables();

  const existing = await sql`SELECT id FROM draftmasters_matches WHERE id = ${m.id}`;
  if (existing.length) return { delta: 0, duplicate: true };

  const ensurePlayer = async (id: string, name: string) => {
    await sql`
      INSERT INTO draftmasters_players (user_id, name)
      VALUES (${id}, ${name})
      ON CONFLICT (user_id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
    `;
  };

  // The house never gets a row — it isn't on the ladder and never will be.
  if (!m.winner.isNpc) await ensurePlayer(m.winner.id, m.winner.name);
  if (!m.loser.isNpc) await ensurePlayer(m.loser.id, m.loser.name);

  let delta = 0;

  if (m.mode === "pvp" && !m.loser.isNpc && !m.winner.isNpc) {
    const [w, l] = await Promise.all([getRecord(m.winner.id), getRecord(m.loser.id)]);
    const [newW, newL] = eloUpdate(w?.rating ?? STARTING_RATING, l?.rating ?? STARTING_RATING);
    delta = newW - (w?.rating ?? STARTING_RATING);

    await sql`
      UPDATE draftmasters_players SET
        rating = ${newW},
        pvp_wins = pvp_wins + 1,
        streak = GREATEST(streak, 0) + 1,
        best_streak = GREATEST(best_streak, GREATEST(streak, 0) + 1),
        updated_at = NOW()
      WHERE user_id = ${m.winner.id}
    `;
    await sql`
      UPDATE draftmasters_players SET
        rating = ${newL},
        pvp_losses = pvp_losses + 1,
        streak = LEAST(streak, 0) - 1,
        updated_at = NOW()
      WHERE user_id = ${m.loser.id}
    `;
  } else {
    // Solo: the human is whichever side isn't the NPC.
    const humanWon = m.loser.isNpc;
    const humanId = humanWon ? m.winner.id : m.loser.id;
    if (humanWon) {
      await sql`
        UPDATE draftmasters_players SET solo_wins = solo_wins + 1, updated_at = NOW()
        WHERE user_id = ${humanId}
      `;
    } else {
      await sql`
        UPDATE draftmasters_players SET solo_losses = solo_losses + 1, updated_at = NOW()
        WHERE user_id = ${humanId}
      `;
    }
  }

  await sql`
    INSERT INTO draftmasters_matches
      (id, mode, room_code, topic, winner_id, loser_id, winner_name, loser_name,
       winner_roster, loser_roster, verdict, rating_delta, reported_by)
    VALUES
      (${m.id}, ${m.mode}, ${m.roomCode}, ${m.topic}, ${m.winner.id}, ${m.loser.id},
       ${m.winner.name}, ${m.loser.name},
       ${JSON.stringify(m.winner.roster)}::jsonb, ${JSON.stringify(m.loser.roster)}::jsonb,
       ${JSON.stringify(m.verdict ?? null)}::jsonb, ${delta}, ${m.reportedBy})
  `;

  return { delta, duplicate: false };
}
