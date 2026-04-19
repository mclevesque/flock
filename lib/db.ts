import postgres from "postgres";

// Lazy init — create client at runtime, not build time
let _sql: ReturnType<typeof postgres> | null = null;
function getDb() {
  if (!_sql) _sql = postgres(process.env.DATABASE_URL!, {
    ssl: "require",
    max: 3,           // small pool for serverless
    idle_timeout: 10, // release idle connections
    connect_timeout: 10, // fail fast instead of hanging for minutes
    prepare: false,   // transaction pooler (port 6543) doesn't support PREPARE
        connection: { statement_timeout: 8000 }, // kill any query hanging >8s (prevents 60s Netlify timeout / 502)
  });
  return _sql;
}

export function sql(strings: TemplateStringsArray, ...values: postgres.ParameterOrFragment<any>[]): Promise<Record<string, unknown>[]> {
  return getDb()(strings, ...values) as Promise<Record<string, unknown>[]>;
}
(sql as unknown as Record<string, unknown>).query = (text: string, params?: unknown[]) =>
  getDb().unsafe(text, params as any[] | undefined) as Promise<Record<string, unknown>[]>;

let _initDbReady = false;
export async function initDb() {
  if (_initDbReady) return; _initDbReady = true;
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT,
      bio TEXT DEFAULT '',
      location TEXT DEFAULT '',
      website TEXT DEFAULT '',
      banner_url TEXT,
      avatar_url TEXT,
      profile_song_title TEXT DEFAULT 'Ginseng Strip 2002',
      profile_song_artist TEXT DEFAULT 'Bladee',
      profile_song_url TEXT DEFAULT 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      password_hash TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS discord_handle TEXT DEFAULT ''`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS steam_handle TEXT DEFAULT ''`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS chess_rating INTEGER DEFAULT 1200`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS chess_wins INTEGER DEFAULT 0`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS chess_losses INTEGER DEFAULT 0`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS chess_draws INTEGER DEFAULT 0`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS reply_privacy TEXT DEFAULT 'anyone'`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS gs_portal BOOLEAN DEFAULT FALSE`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_config JSONB`;
  await sql`
    CREATE TABLE IF NOT EXISTS friendships (
      id SERIAL PRIMARY KEY,
      requester_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      addressee_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(requester_id, addressee_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS wall_posts (
      id SERIAL PRIMARY KEY,
      author_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      profile_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS wall_replies (
      id SERIAL PRIMARY KEY,
      post_id INTEGER REFERENCES wall_posts(id) ON DELETE CASCADE,
      author_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS direct_messages (
      id SERIAL PRIMARY KEY,
      sender_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      receiver_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS videos (
      id SERIAL PRIMARY KEY,
      uploader_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      views INTEGER DEFAULT 0,
      size_bytes BIGINT DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE videos ADD COLUMN IF NOT EXISTS size_bytes BIGINT DEFAULT 0`;
  await sql`
    CREATE TABLE IF NOT EXISTS video_comments (
      id SERIAL PRIMARY KEY,
      video_id INTEGER REFERENCES videos(id) ON DELETE CASCADE,
      author_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS video_likes (
      id SERIAL PRIMARY KEY,
      video_id INTEGER REFERENCES videos(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(video_id, user_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS group_chats (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS group_chat_members (
      group_id INTEGER REFERENCES group_chats(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      joined_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (group_id, user_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS group_chat_messages (
      id SERIAL PRIMARY KEY,
      group_id INTEGER REFERENCES group_chats(id) ON DELETE CASCADE,
      sender_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS chess_games (
      id TEXT PRIMARY KEY,
      white_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      black_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'active',
      fen TEXT NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      moves TEXT[] NOT NULL DEFAULT '{}',
      winner_id TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
  // Emulator VS rooms
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS snes_rating INTEGER DEFAULT 1200`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS snes_wins INTEGER DEFAULT 0`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS snes_losses INTEGER DEFAULT 0`;
  // Per-franchise ELO — Street Fighter and Mortal Kombat have their own ladders
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS sf_rating INTEGER DEFAULT 1200`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS sf_wins INTEGER DEFAULT 0`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS sf_losses INTEGER DEFAULT 0`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS mk_rating INTEGER DEFAULT 1200`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS mk_wins INTEGER DEFAULT 0`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS mk_losses INTEGER DEFAULT 0`;
  await sql`
    CREATE TABLE IF NOT EXISTS emulator_rooms (
      id TEXT PRIMARY KEY,
      host_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      guest_id TEXT,
      game_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      winner_id TEXT,
      host_reported TEXT,
      guest_reported TEXT,
      ranked BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE emulator_rooms ADD COLUMN IF NOT EXISTS ranked BOOLEAN DEFAULT true`;
  await sql`ALTER TABLE emulator_rooms ADD COLUMN IF NOT EXISTS game_started BOOLEAN DEFAULT false`;
  await sql`
    CREATE TABLE IF NOT EXISTS emulator_room_messages (
      id SERIAL PRIMARY KEY,
      room_id TEXT REFERENCES emulator_rooms(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      avatar_url TEXT,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  // FLOCK FIGHTERS
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS fighter_rating INTEGER DEFAULT 1200`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS fighter_wins INTEGER DEFAULT 0`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS fighter_losses INTEGER DEFAULT 0`;
  await sql`
    CREATE TABLE IF NOT EXISTS fighters (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      style TEXT NOT NULL,
      special_move TEXT NOT NULL,
      catchphrase TEXT NOT NULL,
      avatar_prompt TEXT NOT NULL,
      avatar_url TEXT,
      hp INTEGER NOT NULL DEFAULT 100,
      strength INTEGER NOT NULL DEFAULT 50,
      speed INTEGER NOT NULL DEFAULT 50,
      defense INTEGER NOT NULL DEFAULT 50,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS fighter_battles (
      id TEXT PRIMARY KEY,
      challenger_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      defender_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      challenger_fighter_id TEXT REFERENCES fighters(id) ON DELETE CASCADE,
      defender_fighter_id TEXT REFERENCES fighters(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      battle_log JSONB NOT NULL DEFAULT '[]',
      winner_id TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
  // RPS Arena
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS rps_rating INTEGER DEFAULT 1200`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS rps_wins INTEGER DEFAULT 0`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS rps_losses INTEGER DEFAULT 0`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS rps_draws INTEGER DEFAULT 0`;
  await sql`
    CREATE TABLE IF NOT EXISTS rps_matches (
      id TEXT PRIMARY KEY,
      p1_id TEXT NOT NULL,
      p2_id TEXT NOT NULL,
      p1_choice TEXT,
      p2_choice TEXT,
      winner_id TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  // Quiz system
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS quiz_rating INTEGER DEFAULT 1200`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS quiz_wins INTEGER DEFAULT 0`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS quiz_losses INTEGER DEFAULT 0`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS quiz_draws INTEGER DEFAULT 0`;
  await sql`
    CREATE TABLE IF NOT EXISTS quiz_challenges (
      id TEXT PRIMARY KEY,
      challenger_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      challenged_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      topic TEXT NOT NULL DEFAULT 'General Knowledge',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE quiz_challenges ADD COLUMN IF NOT EXISTS questions JSONB DEFAULT '[]'`;
  await sql`ALTER TABLE quiz_challenges ADD COLUMN IF NOT EXISTS dm_game BOOLEAN DEFAULT false`.catch(() => {});
  // Ensure bot user exists for practice games
  await sql`
    INSERT INTO users (id, username, display_name, avatar_url, quiz_rating)
    VALUES ('bot', 'QuizBot', 'Quiz Bot', 'https://api.dicebear.com/9.x/bottts/svg?seed=quizbot', 1200)
    ON CONFLICT (id) DO NOTHING
  `.catch(() => {});
  await sql`ALTER TABLE quiz_games ADD COLUMN IF NOT EXISTS is_bot_game BOOLEAN DEFAULT false`.catch(() => {});
  await sql`ALTER TABLE quiz_games ADD COLUMN IF NOT EXISTS dm_game BOOLEAN DEFAULT false`.catch(() => {});
  await sql`
    CREATE TABLE IF NOT EXISTS quiz_games (
      id TEXT PRIMARY KEY,
      challenge_id TEXT REFERENCES quiz_challenges(id) ON DELETE CASCADE,
      player1_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      player2_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      topic TEXT NOT NULL,
      questions JSONB NOT NULL DEFAULT '[]',
      current_question INTEGER NOT NULL DEFAULT 0,
      player1_score INTEGER NOT NULL DEFAULT 0,
      player2_score INTEGER NOT NULL DEFAULT 0,
      player1_answered INTEGER NOT NULL DEFAULT -1,
      player2_answered INTEGER NOT NULL DEFAULT -1,
      status TEXT NOT NULL DEFAULT 'active',
      winner_id TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS quiz_answers (
      id SERIAL PRIMARY KEY,
      game_id TEXT REFERENCES quiz_games(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      question_index INTEGER NOT NULL,
      answer_index INTEGER NOT NULL,
      is_correct BOOLEAN NOT NULL,
      time_ms INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  // Profile Vibes — floating emoji reactions on profiles
  await sql`
    CREATE TABLE IF NOT EXISTS profile_vibes (
      id SERIAL PRIMARY KEY,
      from_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      to_user_id TEXT NOT NULL,
      emoji TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  // Uniqueness enforced at app level (delete today's entry before inserting)

  // Game Challenges — cross-game challenge system (chess / quiz / emulator)
  await sql`
    CREATE TABLE IF NOT EXISTS game_challenges (
      id TEXT PRIMARY KEY,
      from_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      to_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      game_type TEXT NOT NULL,
      game_name TEXT,
      status TEXT DEFAULT 'pending',
      result_game_id TEXT,
      netplay_room_id TEXT,
      ranked BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '30 seconds')
    )
  `;
  await sql`ALTER TABLE game_challenges ADD COLUMN IF NOT EXISTS netplay_room_id TEXT`;
  await sql`ALTER TABLE game_challenges ADD COLUMN IF NOT EXISTS ranked BOOLEAN DEFAULT true`;

  // Stories — ephemeral 24h video clips, NEVER counted against user storage quota
  // R2 objects under stories/ prefix should have a Cloudflare lifecycle rule set to
  // delete objects older than 25 hours (set in Cloudflare R2 dashboard, not in code).
  await sql`
    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      username TEXT NOT NULL,
      avatar_url TEXT,
      video_url TEXT NOT NULL,
      thumbnail_url TEXT,
      duration_seconds REAL NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
      views INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `.catch(() => {});
}

// ── GAME CHALLENGES ─────────────────────────────────────────────────────────

export async function createGameChallenge(fromUserId: string, toUserId: string, gameType: string, gameName?: string, ranked = true) {
  const id = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
  // netplay_room_id: short 6-char code used as the EmulatorJS netplay room name
  const netplayRoomId = Math.random().toString(36).slice(2, 8).toUpperCase();
  // Ensure new columns exist (migration-safe for live DB)
  await sql`ALTER TABLE game_challenges ADD COLUMN IF NOT EXISTS netplay_room_id TEXT`.catch(() => {});
  await sql`ALTER TABLE game_challenges ADD COLUMN IF NOT EXISTS ranked BOOLEAN DEFAULT true`.catch(() => {});
  await sql`
    INSERT INTO game_challenges (id, from_user_id, to_user_id, game_type, game_name, netplay_room_id, ranked)
    VALUES (${id}, ${fromUserId}, ${toUserId}, ${gameType}, ${gameName ?? null}, ${netplayRoomId}, ${ranked})
  `;
  return { id, netplayRoomId };
}

export async function getPendingChallengesForUser(userId: string) {
  return await sql`
    SELECT gc.*,
      u_from.username AS from_username,
      u_from.avatar_url AS from_avatar
    FROM game_challenges gc
    JOIN users u_from ON gc.from_user_id = u_from.id
    WHERE gc.to_user_id = ${userId}
      AND gc.status = 'pending'
      AND gc.expires_at > NOW()
    ORDER BY gc.created_at DESC
  `;
}

export async function getOutgoingChallenge(challengeId: string, userId: string) {
  const rows = await sql`
    SELECT gc.*, u_to.username AS to_username
    FROM game_challenges gc
    JOIN users u_to ON gc.to_user_id = u_to.id
    WHERE gc.id = ${challengeId} AND gc.from_user_id = ${userId}
  `;
  return rows[0] ?? null;
}

export async function respondToGameChallenge(challengeId: string, userId: string, action: 'accept' | 'decline', resultGameId?: string) {
  const newStatus = action === 'accept' ? 'accepted' : 'declined';
  await sql`
    UPDATE game_challenges
    SET status = ${newStatus}, result_game_id = ${resultGameId ?? null}
    WHERE id = ${challengeId} AND to_user_id = ${userId} AND status = 'pending'
  `;
}

export async function getAcceptedChallengeForChallenger(fromUserId: string) {
  const rows = await sql`
    SELECT gc.*, u_to.username AS to_username
    FROM game_challenges gc
    JOIN users u_to ON gc.to_user_id = u_to.id
    WHERE gc.from_user_id = ${fromUserId}
      AND gc.status = 'accepted'
      AND gc.created_at > NOW() - INTERVAL '2 minutes'
    ORDER BY gc.created_at DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function expireOldChallenges() {
  await sql`
    UPDATE game_challenges SET status = 'expired'
    WHERE status = 'pending' AND expires_at < NOW()
  `;
}

// ── PROFILE VIBES ──────────────────────────────────────────────────────────

export async function getProfileVibes(toUserId: string) {
  try {
    const rows = await sql`
      SELECT emoji, COUNT(*) AS count
      FROM profile_vibes
      WHERE to_user_id = ${toUserId}
        AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY emoji
      ORDER BY count DESC
    `;
    return rows as { emoji: string; count: number }[];
  } catch { return []; }
}

export async function sendProfileVibe(fromUserId: string, toUserId: string, emoji: string) {
  try {
    // Delete existing vibe from today first, then insert fresh
    await sql`
      DELETE FROM profile_vibes
      WHERE from_user_id = ${fromUserId}
        AND to_user_id = ${toUserId}
        AND created_at > NOW() - INTERVAL '24 hours'
    `;
    await sql`
      INSERT INTO profile_vibes (from_user_id, to_user_id, emoji)
      VALUES (${fromUserId}, ${toUserId}, ${emoji})
    `;
    return { ok: true };
  } catch { return { ok: false, error: "Failed to send vibe" }; }
}

export async function getUserVibeToday(fromUserId: string, toUserId: string): Promise<string | null> {
  try {
    const rows = await sql`
      SELECT emoji FROM profile_vibes
      WHERE from_user_id = ${fromUserId}
        AND to_user_id = ${toUserId}
        AND created_at > NOW() - INTERVAL '24 hours'
      LIMIT 1
    `;
    return (rows[0]?.emoji as string) ?? null;
  } catch { return null; }
}

export async function createChessGame(id: string, whiteId: string, blackId: string) {
  const rows = await sql`
    INSERT INTO chess_games (id, white_id, black_id)
    VALUES (${id}, ${whiteId}, ${blackId})
    RETURNING *
  `;
  return rows[0];
}

export async function getChessGame(id: string) {
  const rows = await sql`
    SELECT g.*,
      w.username AS white_username, w.display_name AS white_display, w.avatar_url AS white_avatar,
      w.chess_rating AS white_rating, w.chess_wins AS white_wins, w.chess_losses AS white_losses, w.chess_draws AS white_draws,
      b.username AS black_username, b.display_name AS black_display, b.avatar_url AS black_avatar,
      b.chess_rating AS black_rating, b.chess_wins AS black_wins, b.chess_losses AS black_losses, b.chess_draws AS black_draws
    FROM chess_games g
    LEFT JOIN users w ON g.white_id = w.id
    LEFT JOIN users b ON g.black_id = b.id
    WHERE g.id = ${id}
  `;
  return rows[0] ?? null;
}

export async function applyChessResult(whiteId: string, blackId: string, result: "white" | "black" | "draw") {
  // Ensure columns exist
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS chess_rating INTEGER DEFAULT 1200`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS chess_wins INTEGER DEFAULT 0`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS chess_losses INTEGER DEFAULT 0`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS chess_draws INTEGER DEFAULT 0`;

  const rows = await sql`SELECT id, chess_rating FROM users WHERE id IN (${whiteId}, ${blackId})`;
  const white = rows.find(r => r.id === whiteId);
  const black = rows.find(r => r.id === blackId);

  const rw = Number(white?.chess_rating ?? 1200);
  const rb = Number(black?.chess_rating ?? 1200);

  const K = 32;
  const ew = 1 / (1 + Math.pow(10, (rb - rw) / 400));
  const sw = result === "white" ? 1 : result === "draw" ? 0.5 : 0;
  const sb = 1 - sw;

  const newRw = Math.max(100, Math.round(rw + K * (sw - ew)));
  const newRb = Math.max(100, Math.round(rb + K * (sb - (1 - ew))));

  if (result === "white") {
    await sql`UPDATE users SET chess_rating = ${newRw}, chess_wins = chess_wins + 1 WHERE id = ${whiteId}`;
    await sql`UPDATE users SET chess_rating = ${newRb}, chess_losses = chess_losses + 1 WHERE id = ${blackId}`;
  } else if (result === "black") {
    await sql`UPDATE users SET chess_rating = ${newRw}, chess_losses = chess_losses + 1 WHERE id = ${whiteId}`;
    await sql`UPDATE users SET chess_rating = ${newRb}, chess_wins = chess_wins + 1 WHERE id = ${blackId}`;
  } else {
    await sql`UPDATE users SET chess_rating = ${newRw}, chess_draws = chess_draws + 1 WHERE id = ${whiteId}`;
    await sql`UPDATE users SET chess_rating = ${newRb}, chess_draws = chess_draws + 1 WHERE id = ${blackId}`;
  }

  return { whiteRating: newRw, blackRating: newRb, whiteDelta: newRw - rw, blackDelta: newRb - rb };
}

export async function getLastChessGame(userId: string) {
  const rows = await sql`
    SELECT g.*,
      w.username AS white_username, w.avatar_url AS white_avatar,
      b.username AS black_username, b.avatar_url AS black_avatar
    FROM chess_games g
    LEFT JOIN users w ON g.white_id = w.id
    LEFT JOIN users b ON g.black_id = b.id
    WHERE (g.white_id = ${userId} OR g.black_id = ${userId})
      AND g.status != 'active'
    ORDER BY g.updated_at DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getLastSnesGame(userId: string) {
  const rows = await sql`
    SELECT er.*,
      u1.username AS host_username, u1.avatar_url AS host_avatar,
      u2.username AS guest_username, u2.avatar_url AS guest_avatar
    FROM emulator_rooms er
    LEFT JOIN users u1 ON er.host_id = u1.id
    LEFT JOIN users u2 ON er.guest_id = u2.id
    WHERE (er.host_id = ${userId} OR er.guest_id = ${userId})
      AND er.status = 'completed'
    ORDER BY er.updated_at DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function setFavoriteGame(userId: string, gameName: string | null) {
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS favorite_game TEXT`.catch(() => {});
  await sql`UPDATE users SET favorite_game = ${gameName} WHERE id = ${userId}`;
}

export async function updateChessGame(id: string, fen: string, moves: string[], status: string, winnerId: string | null) {
  await sql`
    UPDATE chess_games
    SET fen = ${fen}, moves = ${moves as unknown as string}, status = ${status},
        winner_id = ${winnerId}, updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function getVideoComments(videoId: number) {
  return sql`
    SELECT vc.*, u.username, u.display_name, u.avatar_url
    FROM video_comments vc JOIN users u ON vc.author_id = u.id
    WHERE vc.video_id = ${videoId}
    ORDER BY vc.created_at ASC
    LIMIT 100
  `;
}

export async function addVideoComment(videoId: number, authorId: string, content: string) {
  const rows = await sql`
    INSERT INTO video_comments (video_id, author_id, content)
    VALUES (${videoId}, ${authorId}, ${content})
    RETURNING *
  `;
  return rows[0];
}

export async function getVideoLikes(videoId: number, userId?: string) {
  const [countRow] = await sql`SELECT COUNT(*) as count FROM video_likes WHERE video_id = ${videoId}`;
  const count = Number(countRow?.count ?? 0);
  if (!userId) return { count, liked: false };
  const [likedRow] = await sql`SELECT id FROM video_likes WHERE video_id = ${videoId} AND user_id = ${userId}`;
  return { count, liked: !!likedRow };
}

export async function toggleVideoLike(videoId: number, userId: string) {
  const [existing] = await sql`SELECT id FROM video_likes WHERE video_id = ${videoId} AND user_id = ${userId}`;
  if (existing) {
    await sql`DELETE FROM video_likes WHERE video_id = ${videoId} AND user_id = ${userId}`;
    return false;
  } else {
    await sql`INSERT INTO video_likes (video_id, user_id) VALUES (${videoId}, ${userId})`;
    return true;
  }
}

export async function getUserById(id: string) {
  const rows = await sql`SELECT * FROM users WHERE id = ${id}`;
  return rows[0] ?? null;
}

export async function getUserByUsername(username: string) {
  const rows = await sql`SELECT * FROM users WHERE username = ${username}`;
  return rows[0] ?? null;
}

export async function createUserWithPassword(id: string, username: string, displayName: string, passwordHash: string, email?: string) {
  const rows = await sql`
    INSERT INTO users (id, username, display_name, password_hash, email)
    VALUES (${id}, ${username}, ${displayName}, ${passwordHash}, ${email ?? null})
    ON CONFLICT (id) DO NOTHING
    RETURNING *
  `;
  return rows[0] ?? null;
}

export async function getUserByEmail(email: string) {
  const rows = await sql`SELECT * FROM users WHERE email = ${email}`;
  return rows[0] ?? null;
}

export async function setPasswordResetToken(userId: string, token: string, expires: Date) {
  await sql`UPDATE users SET password_reset_token = ${token}, password_reset_expires = ${expires.toISOString()} WHERE id = ${userId}`;
}

export async function getUserByResetToken(token: string) {
  const rows = await sql`SELECT * FROM users WHERE password_reset_token = ${token} AND password_reset_expires > NOW()`;
  return rows[0] ?? null;
}

export async function updatePasswordHash(userId: string, passwordHash: string) {
  await sql`UPDATE users SET password_hash = ${passwordHash}, password_reset_token = NULL, password_reset_expires = NULL WHERE id = ${userId}`;
}

export async function createUser(id: string, username: string, displayName: string, avatarUrl: string) {
  const rows = await sql`
    INSERT INTO users (id, username, display_name, avatar_url)
    VALUES (${id}, ${username}, ${displayName}, ${avatarUrl})
    ON CONFLICT (id) DO NOTHING
    RETURNING *
  `;
  return rows[0] ?? null;
}

export async function updateUser(id: string, fields: {
  username?: string;
  display_name?: string;
  bio?: string;
  location?: string;
  website?: string;
  avatar_url?: string;
  banner_url?: string;
  profile_song_title?: string;
  profile_song_artist?: string;
  profile_song_url?: string;
  discord_handle?: string;
  steam_handle?: string;
}) {
  // Ensure newer columns exist before trying to write them
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS discord_handle TEXT DEFAULT ''`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS steam_handle TEXT DEFAULT ''`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_song_title TEXT DEFAULT 'Ginseng Strip 2002'`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_song_artist TEXT DEFAULT 'Bladee'`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_song_url TEXT DEFAULT 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'`;
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (key === "username") {
      await sql`UPDATE users SET username = ${value} WHERE id = ${id}`;
    } else if (key === "display_name") {
      await sql`UPDATE users SET display_name = ${value} WHERE id = ${id}`;
    } else if (key === "bio") {
      await sql`UPDATE users SET bio = ${value} WHERE id = ${id}`;
    } else if (key === "location") {
      await sql`UPDATE users SET location = ${value} WHERE id = ${id}`;
    } else if (key === "website") {
      await sql`UPDATE users SET website = ${value} WHERE id = ${id}`;
    } else if (key === "avatar_url") {
      await sql`UPDATE users SET avatar_url = ${value} WHERE id = ${id}`;
    } else if (key === "banner_url") {
      await sql`UPDATE users SET banner_url = ${value} WHERE id = ${id}`;
    } else if (key === "profile_song_title") {
      await sql`UPDATE users SET profile_song_title = ${value} WHERE id = ${id}`;
    } else if (key === "profile_song_artist") {
      await sql`UPDATE users SET profile_song_artist = ${value} WHERE id = ${id}`;
    } else if (key === "profile_song_url") {
      await sql`UPDATE users SET profile_song_url = ${value} WHERE id = ${id}`;
    } else if (key === "discord_handle") {
      await sql`UPDATE users SET discord_handle = ${value} WHERE id = ${id}`;
    } else if (key === "steam_handle") {
      await sql`UPDATE users SET steam_handle = ${value} WHERE id = ${id}`;
    }
  }
}

export async function getVideosByUser(userId: string) {
  return sql`
    SELECT v.*, u.username, u.display_name, u.avatar_url
    FROM videos v JOIN users u ON v.uploader_id = u.id
    WHERE v.uploader_id = ${userId}
    ORDER BY v.created_at DESC
  `;
}

export async function getAllVideos() {
  return sql`
    SELECT v.*, u.username, u.display_name, u.avatar_url
    FROM videos v JOIN users u ON v.uploader_id = u.id
    ORDER BY v.created_at DESC
    LIMIT 50
  `;
}

export async function addVideo(uploaderId: string, title: string, url: string, sizeBytes = 0) {
  const rows = await sql`
    INSERT INTO videos (uploader_id, title, url, size_bytes)
    VALUES (${uploaderId}, ${title}, ${url}, ${sizeBytes})
    RETURNING *
  `;
  return rows[0];
}

export async function incrementVideoViews(videoId: number) {
  await sql`UPDATE videos SET views = views + 1 WHERE id = ${videoId}`;
}

// Admin (mclevesque) or the uploader can delete any video
export async function deleteVideo(videoId: number, requesterId: string) {
  const isAdmin = await sql`SELECT 1 FROM users WHERE id = ${requesterId} AND username = 'mclevesque' LIMIT 1`;
  const result = isAdmin.length > 0
    ? await sql`DELETE FROM videos WHERE id = ${videoId} RETURNING id`
    : await sql`DELETE FROM videos WHERE id = ${videoId} AND uploader_id = ${requesterId} RETURNING id`;
  return (result as { id: number }[]).length > 0;
}

// Returns total bytes uploaded by this user across all videos
export async function getUserStorageBytes(userId: string): Promise<number> {
  const rows = await sql`SELECT COALESCE(SUM(size_bytes), 0) AS total FROM videos WHERE uploader_id = ${userId}`;
  return Number(rows[0]?.total ?? 0);
}

export async function getWallPosts(profileId: string) {
  return sql`
    SELECT wp.*, u.username, u.display_name, u.avatar_url
    FROM wall_posts wp JOIN users u ON wp.author_id = u.id
    WHERE wp.profile_id = ${profileId}
    ORDER BY wp.created_at DESC
    LIMIT 20
  `;
}

export async function addWallPost(authorId: string, profileId: string, content: string) {
  // Rate limit: max 3 wall posts per hour per author
  const rows = await sql`
    SELECT COUNT(*) AS cnt FROM wall_posts
    WHERE author_id = ${authorId} AND created_at > NOW() - INTERVAL '1 hour'
  `;
  if (Number(rows[0]?.cnt ?? 0) >= 3) {
    throw new Error("Rate limit: max 3 wall posts per hour");
  }
  await sql`
    INSERT INTO wall_posts (author_id, profile_id, content)
    VALUES (${authorId}, ${profileId}, ${content})
  `;
}

export async function ensureWallReplyColumns() {
  await sql`ALTER TABLE wall_replies ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES wall_replies(id) ON DELETE CASCADE`.catch(() => {});
  await sql`ALTER TABLE wall_replies ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP`.catch(() => {});
}

export async function addWallReply(postId: number, authorId: string, content: string, parentId?: number | null) {
  await ensureWallReplyColumns();
  await sql`
    INSERT INTO wall_replies (post_id, author_id, content, parent_id)
    VALUES (${postId}, ${authorId}, ${content}, ${parentId ?? null})
  `;
}

export async function editWallReply(replyId: number, authorId: string, content: string): Promise<boolean> {
  const result = await sql`
    UPDATE wall_replies SET content = ${content}, edited_at = NOW()
    WHERE id = ${replyId} AND author_id = ${authorId}
    RETURNING id
  `;
  return (result as unknown[]).length > 0;
}

export async function deleteWallPost(postId: number, requesterId: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM wall_posts
    WHERE id = ${postId} AND (author_id = ${requesterId} OR profile_id = ${requesterId})
    RETURNING id
  `;
  return result.length > 0;
}

export async function deleteWallReply(replyId: number, requesterId: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM wall_replies wr
    USING wall_posts wp
    WHERE wr.id = ${replyId} AND wr.post_id = wp.id
      AND (wr.author_id = ${requesterId} OR wp.profile_id = ${requesterId})
    RETURNING wr.id
  `;
  return result.length > 0;
}

export async function deleteVideoComment(commentId: number, requesterId: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM video_comments vc
    USING videos v
    WHERE vc.id = ${commentId} AND vc.video_id = v.id
      AND (vc.author_id = ${requesterId} OR v.uploader_id = ${requesterId})
    RETURNING vc.id
  `;
  return result.length > 0;
}

export async function getWallReplies(postId: number) {
  await ensureWallReplyColumns();
  return sql`
    SELECT wr.*, u.username, u.avatar_url
    FROM wall_replies wr JOIN users u ON wr.author_id = u.id
    WHERE wr.post_id = ${postId}
    ORDER BY wr.created_at ASC
    LIMIT 100
  `;
}

export async function getWallRepliesBatch(postIds: number[]) {
  await ensureWallReplyColumns();
  if (!postIds.length) return [];
  const safeIds = postIds.map(n => Math.floor(Number(n))).filter(n => n > 0);
  if (!safeIds.length) return [];
  // Use = ANY() — Neon HTTP driver handles JS arrays as Postgres arrays reliably
  return sql`
    SELECT wr.id, wr.post_id, wr.author_id, wr.content, wr.created_at, wr.parent_id, wr.edited_at,
           u.username, u.avatar_url
    FROM wall_replies wr JOIN users u ON wr.author_id = u.id
    WHERE wr.post_id = ANY(${safeIds})
    ORDER BY wr.post_id, wr.created_at ASC
  `;
}

export async function getWallPostOwner(postId: number): Promise<string | null> {
  try {
    const rows = await sql`SELECT profile_id FROM wall_posts WHERE id = ${postId}`;
    return (rows[0]?.profile_id as string) ?? null;
  } catch { return null; }
}

export async function getVideoUploaderId(videoId: number): Promise<string | null> {
  try {
    const rows = await sql`SELECT uploader_id FROM videos WHERE id = ${videoId}`;
    return (rows[0]?.uploader_id as string) ?? null;
  } catch { return null; }
}

export async function areFriends(userId1: string, userId2: string): Promise<boolean> {
  if (userId1 === userId2) return true;
  try {
    const rows = await sql`
      SELECT id FROM friendships
      WHERE status = 'accepted'
        AND ((requester_id = ${userId1} AND addressee_id = ${userId2})
          OR (requester_id = ${userId2} AND addressee_id = ${userId1}))
    `;
    return rows.length > 0;
  } catch { return false; }
}

export async function getUserReplyPrivacy(userId: string): Promise<string> {
  try {
    const rows = await sql`SELECT reply_privacy FROM users WHERE id = ${userId}`;
    return (rows[0]?.reply_privacy as string) ?? 'anyone';
  } catch {
    return 'anyone';
  }
}

export async function updateUserReplyPrivacy(userId: string, setting: string) {
  try {
    await sql`UPDATE users SET reply_privacy = ${setting} WHERE id = ${userId}`;
  } catch {
    // Column may not exist yet — run init-db to migrate
  }
}

export async function getMessages(userId: string, otherId: string) {
  return sql`
    SELECT dm.*, u.username, u.avatar_url
    FROM direct_messages dm JOIN users u ON dm.sender_id = u.id
    WHERE (dm.sender_id = ${userId} AND dm.receiver_id = ${otherId})
       OR (dm.sender_id = ${otherId} AND dm.receiver_id = ${userId})
    ORDER BY dm.created_at ASC
    LIMIT 100
  `;
}

export async function sendMessage(senderId: string, receiverId: string, content: string) {
  const rows = await sql`
    INSERT INTO direct_messages (sender_id, receiver_id, content)
    VALUES (${senderId}, ${receiverId}, ${content})
    RETURNING id, created_at
  `;
  return rows[0] as { id: number; created_at: string };
}

export async function getRecentGameInvites(userId: string) {
  // Returns recent snes/game invite DMs received by userId (last 24h), with sender info
  return sql`
    SELECT dm.id, dm.content, dm.created_at, dm.sender_id,
           u.username AS sender_username, u.avatar_url AS sender_avatar
    FROM direct_messages dm
    JOIN users u ON u.id = dm.sender_id
    WHERE dm.receiver_id = ${userId}
      AND dm.sender_id != ${userId}
      AND (dm.content LIKE '[snes:%' OR dm.content LIKE '[chess:%' OR dm.content LIKE '[poker:%' OR dm.content LIKE '[quiz:%')
      AND dm.created_at > NOW() - INTERVAL '24 hours'
    ORDER BY dm.created_at DESC
    LIMIT 10
  `;
}

export async function getConversations(userId: string) {
  return sql`
    SELECT DISTINCT ON (other_user)
      CASE WHEN dm.sender_id = ${userId} THEN dm.receiver_id ELSE dm.sender_id END AS other_user,
      dm.content AS last_message,
      dm.sender_id AS last_sender_id,
      dm.created_at,
      u.username, u.display_name, u.avatar_url
    FROM direct_messages dm
    JOIN users u ON u.id = CASE WHEN dm.sender_id = ${userId} THEN dm.receiver_id ELSE dm.sender_id END
    WHERE dm.sender_id = ${userId} OR dm.receiver_id = ${userId}
    ORDER BY other_user, dm.created_at DESC
  `;
}

export async function getFriends(userId: string) {
  return sql`
    SELECT DISTINCT ON (u.id) u.*
    FROM friendships f
    JOIN users u ON u.id = CASE WHEN f.requester_id = ${userId} THEN f.addressee_id ELSE f.requester_id END
    WHERE (f.requester_id = ${userId} OR f.addressee_id = ${userId})
      AND f.status = 'accepted'
    ORDER BY u.id
  `;
}

export async function getFriendsWithOnline(userId: string) {
  try {
    return await sql`
      SELECT DISTINCT ON (u.id) u.id, u.username, u.display_name, u.avatar_url,
             (u.last_seen IS NOT NULL AND u.last_seen > NOW() - INTERVAL '5 minutes') AS is_online,
             u.last_seen
      FROM friendships f
      JOIN users u ON u.id = CASE WHEN f.requester_id = ${userId} THEN f.addressee_id ELSE f.requester_id END
      WHERE (f.requester_id = ${userId} OR f.addressee_id = ${userId})
        AND f.status = 'accepted'
      ORDER BY u.id, u.last_seen DESC NULLS LAST
    `;
  } catch {
    return await sql`
      SELECT DISTINCT ON (u.id) u.id, u.username, u.display_name, u.avatar_url,
             false AS is_online, NULL AS last_seen
      FROM friendships f
      JOIN users u ON u.id = CASE WHEN f.requester_id = ${userId} THEN f.addressee_id ELSE f.requester_id END
      WHERE (f.requester_id = ${userId} OR f.addressee_id = ${userId})
        AND f.status = 'accepted'
      ORDER BY u.id, u.username ASC
    `;
  }
}

export async function updateLastSeen(userId: string) {
  try {
    await sql`UPDATE users SET last_seen = NOW() WHERE id = ${userId}`;
  } catch { /* column may not exist */ }
}

export async function sendFriendRequest(requesterId: string, addresseeId: string) {
  await sql`
    INSERT INTO friendships (requester_id, addressee_id, status)
    VALUES (${requesterId}, ${addresseeId}, 'pending')
    ON CONFLICT DO NOTHING
  `;
}

export async function acceptFriendRequest(requesterId: string, addresseeId: string) {
  await sql`
    UPDATE friendships SET status = 'accepted'
    WHERE requester_id = ${requesterId} AND addressee_id = ${addresseeId}
  `;
}

export async function getFriendshipStatus(userId: string, otherId: string) {
  const rows = await sql`
    SELECT * FROM friendships
    WHERE (requester_id = ${userId} AND addressee_id = ${otherId})
       OR (requester_id = ${otherId} AND addressee_id = ${userId})
  `;
  return rows[0] ?? null;
}

export async function getAllUsers() {
  return sql`SELECT id, username, display_name, avatar_url FROM users LIMIT 50`;
}

export async function getPendingIncoming(userId: string) {
  return sql`
    SELECT f.requester_id as id, u.username, u.display_name, u.avatar_url, f.created_at
    FROM friendships f
    JOIN users u ON u.id = f.requester_id
    WHERE f.addressee_id = ${userId} AND f.status = 'pending'
    ORDER BY f.created_at DESC
  `;
}

export async function getPendingOutgoing(userId: string) {
  return sql`
    SELECT f.addressee_id as id, u.username, u.display_name, u.avatar_url, f.created_at
    FROM friendships f
    JOIN users u ON u.id = f.addressee_id
    WHERE f.requester_id = ${userId} AND f.status = 'pending'
    ORDER BY f.created_at DESC
  `;
}

export async function declineFriendRequest(requesterId: string, addresseeId: string) {
  await sql`
    DELETE FROM friendships
    WHERE requester_id = ${requesterId} AND addressee_id = ${addresseeId}
  `;
}

export async function getSuggestedUsers(userId: string) {
  return sql`
    SELECT u.id, u.username, u.display_name, u.avatar_url
    FROM users u
    WHERE u.id != ${userId}
      AND u.id NOT IN (
        SELECT CASE WHEN requester_id = ${userId} THEN addressee_id ELSE requester_id END
        FROM friendships
        WHERE requester_id = ${userId} OR addressee_id = ${userId}
      )
    ORDER BY u.created_at DESC
    LIMIT 20
  `;
}

export async function createGroupChat(name: string, creatorId: string, memberIds: string[]) {
  const rows = await sql`
    INSERT INTO group_chats (name, created_by) VALUES (${name}, ${creatorId}) RETURNING id
  `;
  const groupId = (rows[0] as { id: number }).id;
  const allMembers = [...new Set([creatorId, ...memberIds])];
  for (const uid of allMembers) {
    await sql`INSERT INTO group_chat_members (group_id, user_id) VALUES (${groupId}, ${uid}) ON CONFLICT DO NOTHING`;
  }
  return groupId;
}

export async function getGroupChats(userId: string) {
  return sql`
    SELECT gc.*, COUNT(gcm2.user_id)::int AS member_count
    FROM group_chats gc
    JOIN group_chat_members gcm ON gcm.group_id = gc.id AND gcm.user_id = ${userId}
    JOIN group_chat_members gcm2 ON gcm2.group_id = gc.id
    GROUP BY gc.id
    ORDER BY gc.created_at DESC
  `;
}

export async function getGroupMessages(groupId: number) {
  return sql`
    SELECT gcm.*, u.username, u.display_name, u.avatar_url
    FROM group_chat_messages gcm JOIN users u ON gcm.sender_id = u.id
    WHERE gcm.group_id = ${groupId}
    ORDER BY gcm.created_at ASC
    LIMIT 200
  `;
}

export async function sendGroupMessage(groupId: number, senderId: string, content: string) {
  await sql`
    INSERT INTO group_chat_messages (group_id, sender_id, content) VALUES (${groupId}, ${senderId}, ${content})
  `;
}

export async function getGroupMembers(groupId: number) {
  return sql`
    SELECT u.id, u.username, u.display_name, u.avatar_url
    FROM group_chat_members gcm JOIN users u ON gcm.user_id = u.id
    WHERE gcm.group_id = ${groupId}
  `;
}

// ─── Quiz ────────────────────────────────────────────────────────────────────

export async function createQuizChallenge(id: string, challengerId: string, challengedId: string, topic: string, questions: unknown[] = [], dmGame = false) {
  const rows = await sql`
    INSERT INTO quiz_challenges (id, challenger_id, challenged_id, topic, status, questions, dm_game)
    VALUES (${id}, ${challengerId}, ${challengedId}, ${topic}, 'pending', ${JSON.stringify(questions)}, ${dmGame})
    RETURNING *
  `;
  return rows[0];
}

export async function getQuizChallenge(id: string) {
  const rows = await sql`
    SELECT qc.*,
      u1.username AS challenger_username, u1.avatar_url AS challenger_avatar, u1.quiz_rating AS challenger_rating,
      u2.username AS challenged_username, u2.avatar_url AS challenged_avatar, u2.quiz_rating AS challenged_rating
    FROM quiz_challenges qc
    JOIN users u1 ON qc.challenger_id = u1.id
    JOIN users u2 ON qc.challenged_id = u2.id
    WHERE qc.id = ${id}
  `;
  return rows[0] ?? null;
}

export async function getPendingQuizChallenges(userId: string) {
  return sql`
    SELECT qc.*,
      u1.username AS challenger_username, u1.avatar_url AS challenger_avatar, u1.quiz_rating AS challenger_rating,
      u2.username AS challenged_username, u2.avatar_url AS challenged_avatar, u2.quiz_rating AS challenged_rating,
      qg.id AS game_id
    FROM quiz_challenges qc
    JOIN users u1 ON qc.challenger_id = u1.id
    JOIN users u2 ON qc.challenged_id = u2.id
    LEFT JOIN quiz_games qg ON qg.challenge_id = qc.id
    WHERE (qc.challenger_id = ${userId} OR qc.challenged_id = ${userId})
      AND (qc.dm_game IS NULL OR qc.dm_game = false)
      AND (
        qc.status = 'pending'
        OR (qc.status = 'accepted' AND qc.created_at > NOW() - INTERVAL '5 minutes')
      )
    ORDER BY qc.created_at DESC
    LIMIT 20
  `;
}

export async function updateQuizChallengeStatus(id: string, status: string) {
  await sql`UPDATE quiz_challenges SET status = ${status} WHERE id = ${id}`;
}

export async function createQuizGame(id: string, challengeId: string, player1Id: string, player2Id: string, topic: string, questions: unknown[], dmGame = false) {
  const rows = await sql`
    INSERT INTO quiz_games (id, challenge_id, player1_id, player2_id, topic, questions, dm_game)
    VALUES (${id}, ${challengeId}, ${player1Id}, ${player2Id}, ${topic}, ${JSON.stringify(questions)}, ${dmGame})
    RETURNING *
  `;
  return rows[0];
}

export async function getQuizGame(id: string) {
  const rows = await sql`
    SELECT qg.*,
      u1.username AS player1_username, u1.avatar_url AS player1_avatar, u1.quiz_rating AS player1_rating,
      u2.username AS player2_username, u2.avatar_url AS player2_avatar, u2.quiz_rating AS player2_rating
    FROM quiz_games qg
    JOIN users u1 ON qg.player1_id = u1.id
    JOIN users u2 ON qg.player2_id = u2.id
    WHERE qg.id = ${id}
  `;
  return rows[0] ?? null;
}

export async function getQuizGameByChallengeId(challengeId: string) {
  const rows = await sql`
    SELECT qg.*,
      u1.username AS player1_username, u1.avatar_url AS player1_avatar, u1.quiz_rating AS player1_rating,
      u2.username AS player2_username, u2.avatar_url AS player2_avatar, u2.quiz_rating AS player2_rating
    FROM quiz_games qg
    JOIN users u1 ON qg.player1_id = u1.id
    JOIN users u2 ON qg.player2_id = u2.id
    WHERE qg.challenge_id = ${challengeId}
  `;
  return rows[0] ?? null;
}

export async function createBotQuizGame(id: string, playerId: string, topic: string, questions: unknown[]) {
  const rows = await sql`
    INSERT INTO quiz_games (id, challenge_id, player1_id, player2_id, topic, questions, is_bot_game)
    VALUES (${id}, NULL, ${playerId}, 'bot', ${topic}, ${JSON.stringify(questions)}, true)
    RETURNING *
  `;
  return rows[0];
}

export async function submitQuizAnswer(gameId: string, userId: string, questionIndex: number, answerIndex: number, isCorrect: boolean, timeMs: number) {
  // Insert answer record
  await sql`
    INSERT INTO quiz_answers (game_id, user_id, question_index, answer_index, is_correct, time_ms)
    VALUES (${gameId}, ${userId}, ${questionIndex}, ${answerIndex}, ${isCorrect}, ${timeMs})
    ON CONFLICT DO NOTHING
  `;

  // Get game
  const rows = await sql`SELECT * FROM quiz_games WHERE id = ${gameId}`;
  const game = rows[0] as Record<string, unknown>;
  if (!game) return null;

  const isPlayer1 = game.player1_id === userId;

  if (isPlayer1) {
    if (isCorrect) await sql`UPDATE quiz_games SET player1_score = player1_score + 1 WHERE id = ${gameId}`;
    await sql`UPDATE quiz_games SET player1_answered = ${questionIndex}, updated_at = NOW() WHERE id = ${gameId}`;
  } else {
    if (isCorrect) await sql`UPDATE quiz_games SET player2_score = player2_score + 1 WHERE id = ${gameId}`;
    await sql`UPDATE quiz_games SET player2_answered = ${questionIndex}, updated_at = NOW() WHERE id = ${gameId}`;
  }

  // Re-fetch to check if both answered
  const [updated] = await sql`SELECT * FROM quiz_games WHERE id = ${gameId}`;
  const questions = (updated?.questions as unknown[]) ?? [];
  const totalQ = questions.length;

  const p1ans = Number(updated?.player1_answered ?? -1);
  const p2ans = Number(updated?.player2_answered ?? -1);
  const bothAnswered = p1ans >= questionIndex && p2ans >= questionIndex;

  if (bothAnswered) {
    const nextQ = questionIndex + 1;
    if (nextQ >= totalQ) {
      // Game over — re-read final scores
      const [final] = await sql`SELECT * FROM quiz_games WHERE id = ${gameId}`;
      const fs1 = Number(final?.player1_score ?? 0);
      const fs2 = Number(final?.player2_score ?? 0);
      const winnerId = fs1 > fs2 ? String(final?.player1_id) : fs2 > fs1 ? String(final?.player2_id) : null;
      await sql`UPDATE quiz_games SET status = 'completed', winner_id = ${winnerId}, updated_at = NOW() WHERE id = ${gameId}`;
      // Skip rating changes for bot practice games and friendly DM games
      if (!final?.is_bot_game && !final?.dm_game) {
        await applyQuizResult(String(final?.player1_id), String(final?.player2_id), fs1 > fs2 ? "player1" : fs2 > fs1 ? "player2" : "draw");
      }
    } else {
      await sql`UPDATE quiz_games SET current_question = ${nextQ}, updated_at = NOW() WHERE id = ${gameId}`;
    }
  }

  const [result] = await sql`SELECT * FROM quiz_games WHERE id = ${gameId}`;
  return result;
}

export async function applyQuizResult(player1Id: string, player2Id: string, result: "player1" | "player2" | "draw") {
  const rows = await sql`SELECT id, quiz_rating FROM users WHERE id IN (${player1Id}, ${player2Id})`;
  const p1 = rows.find(r => r.id === player1Id);
  const p2 = rows.find(r => r.id === player2Id);

  const r1 = Number(p1?.quiz_rating ?? 1200);
  const r2 = Number(p2?.quiz_rating ?? 1200);
  const K = 32;
  const e1 = 1 / (1 + Math.pow(10, (r2 - r1) / 400));
  const s1 = result === "player1" ? 1 : result === "draw" ? 0.5 : 0;
  const s2 = 1 - s1;

  const new1 = Math.max(100, Math.round(r1 + K * (s1 - e1)));
  const new2 = Math.max(100, Math.round(r2 + K * (s2 - (1 - e1))));

  if (result === "player1") {
    await sql`UPDATE users SET quiz_rating = ${new1}, quiz_wins = quiz_wins + 1 WHERE id = ${player1Id}`;
    await sql`UPDATE users SET quiz_rating = ${new2}, quiz_losses = quiz_losses + 1 WHERE id = ${player2Id}`;
  } else if (result === "player2") {
    await sql`UPDATE users SET quiz_rating = ${new1}, quiz_losses = quiz_losses + 1 WHERE id = ${player1Id}`;
    await sql`UPDATE users SET quiz_rating = ${new2}, quiz_wins = quiz_wins + 1 WHERE id = ${player2Id}`;
  } else {
    await sql`UPDATE users SET quiz_rating = ${new1}, quiz_draws = quiz_draws + 1 WHERE id = ${player1Id}`;
    await sql`UPDATE users SET quiz_rating = ${new2}, quiz_draws = quiz_draws + 1 WHERE id = ${player2Id}`;
  }
}

export async function getQuizLeaderboard() {
  return sql`
    SELECT id, username, display_name, avatar_url, quiz_rating, quiz_wins, quiz_losses, quiz_draws
    FROM users
    WHERE quiz_rating IS NOT NULL
    ORDER BY quiz_rating DESC
    LIMIT 20
  `;
}

export async function getRecentQuizGames(userId: string) {
  return sql`
    SELECT qg.*,
      u1.username AS player1_username, u1.avatar_url AS player1_avatar,
      u2.username AS player2_username, u2.avatar_url AS player2_avatar
    FROM quiz_games qg
    LEFT JOIN users u1 ON qg.player1_id = u1.id
    LEFT JOIN users u2 ON qg.player2_id = u2.id
    WHERE (qg.player1_id = ${userId} OR qg.player2_id = ${userId})
      AND qg.status = 'completed'
    ORDER BY qg.updated_at DESC
    LIMIT 5
  `;
}

// ─── Emulator VS ─────────────────────────────────────────────────────────────

export async function createEmulatorRoom(id: string, hostId: string, gameName: string, guestId?: string, ranked = true) {
  const initialStatus = guestId ? 'active' : 'waiting';
  // Ensure ranked column exists (migration-safe for live DB)
  await sql`ALTER TABLE emulator_rooms ADD COLUMN IF NOT EXISTS ranked BOOLEAN DEFAULT true`.catch(() => {});
  const rows = await sql`
    INSERT INTO emulator_rooms (id, host_id, guest_id, game_name, status, ranked)
    VALUES (${id}, ${hostId}, ${guestId ?? null}, ${gameName}, ${initialStatus}, ${ranked})
    RETURNING *
  `;
  return rows[0];
}

export async function getEmulatorRoom(id: string) {
  const rows = await sql`
    SELECT er.*,
      u1.username AS host_username, u1.avatar_url AS host_avatar, u1.snes_rating AS host_rating,
      u2.username AS guest_username, u2.avatar_url AS guest_avatar, u2.snes_rating AS guest_rating
    FROM emulator_rooms er
    LEFT JOIN users u1 ON er.host_id = u1.id
    LEFT JOIN users u2 ON er.guest_id = u2.id
    WHERE er.id = ${id}
  `;
  return rows[0] ?? null;
}

export async function joinEmulatorRoom(id: string, guestId: string) {
  await sql`
    UPDATE emulator_rooms SET guest_id = ${guestId}, updated_at = NOW()
    WHERE id = ${id} AND guest_id IS NULL
  `;
}

export async function bootGuestFromRoom(roomId: string, hostId: string) {
  await sql`
    UPDATE emulator_rooms SET guest_id = NULL, updated_at = NOW()
    WHERE id = ${roomId} AND host_id = ${hostId} AND game_started IS NOT TRUE
  `;
}

export async function reportEmulatorResult(roomId: string, userId: string, winnerId: string | null) {
  const rows = await sql`SELECT * FROM emulator_rooms WHERE id = ${roomId}`;
  const room = rows[0] as Record<string, unknown>;
  if (!room) return null;

  const isHost = room.host_id === userId;
  if (isHost) {
    await sql`UPDATE emulator_rooms SET host_reported = ${winnerId ?? 'draw'}, updated_at = NOW() WHERE id = ${roomId}`;
  } else {
    await sql`UPDATE emulator_rooms SET guest_reported = ${winnerId ?? 'draw'}, updated_at = NOW() WHERE id = ${roomId}`;
  }

  // Re-read
  const [updated] = await sql`SELECT * FROM emulator_rooms WHERE id = ${roomId}`;
  const hr = updated?.host_reported as string | null;
  const gr = updated?.guest_reported as string | null;

  if (hr && gr && hr === gr) {
    // Both agreed on same outcome
    const winner = hr === 'draw' ? null : hr;
    await sql`UPDATE emulator_rooms SET status = 'completed', winner_id = ${winner}, updated_at = NOW() WHERE id = ${roomId}`;
    // Apply per-franchise ELO (only if ranked)
    const isRanked = updated?.ranked !== false;
    await applySnesResult(
      String(updated?.host_id),
      String(updated?.guest_id),
      winner === updated?.host_id ? 'host' : winner === null ? 'draw' : 'guest',
      String(updated?.game_name ?? ''),
      isRanked,
    );
  }

  const [final] = await sql`SELECT * FROM emulator_rooms WHERE id = ${roomId}`;
  return final;
}

// Map game names to their ELO franchise
const SF_GAMES = ["Street Fighter II Turbo", "Street Fighter Alpha 2"];
const MK_GAMES = ["Mortal Kombat II"];

export function getGameFranchise(gameName: string): 'sf' | 'mk' | 'general' {
  if (SF_GAMES.some(g => gameName.includes(g) || g.includes(gameName))) return 'sf';
  if (MK_GAMES.some(g => gameName.includes(g) || g.includes(gameName))) return 'mk';
  return 'general';
}

function eloCalc(rA: number, rB: number, scoreA: number, K = 32) {
  const expected = 1 / (1 + Math.pow(10, (rB - rA) / 400));
  return Math.max(100, Math.round(rA + K * (scoreA - expected)));
}

export async function applySnesResult(hostId: string, guestId: string, result: 'host' | 'guest' | 'draw', gameName = '', ranked = true) {
  if (!ranked) return; // unranked match — no ELO changes

  const franchise = getGameFranchise(gameName);

  if (franchise === 'sf') {
    const rows = await sql`SELECT id, sf_rating FROM users WHERE id IN (${hostId}, ${guestId})`;
    const h = rows.find(r => r.id === hostId);
    const g = rows.find(r => r.id === guestId);
    const rh = Number(h?.sf_rating ?? 1200);
    const rg = Number(g?.sf_rating ?? 1200);
    const sh = result === 'host' ? 1 : result === 'draw' ? 0.5 : 0;
    const newH = eloCalc(rh, rg, sh);
    const newG = eloCalc(rg, rh, 1 - sh);
    if (result === 'host') {
      await sql`UPDATE users SET sf_rating = ${newH}, sf_wins = sf_wins + 1 WHERE id = ${hostId}`;
      await sql`UPDATE users SET sf_rating = ${newG}, sf_losses = sf_losses + 1 WHERE id = ${guestId}`;
    } else if (result === 'guest') {
      await sql`UPDATE users SET sf_rating = ${newH}, sf_losses = sf_losses + 1 WHERE id = ${hostId}`;
      await sql`UPDATE users SET sf_rating = ${newG}, sf_wins = sf_wins + 1 WHERE id = ${guestId}`;
    } else {
      await sql`UPDATE users SET sf_rating = ${newH} WHERE id = ${hostId}`;
      await sql`UPDATE users SET sf_rating = ${newG} WHERE id = ${guestId}`;
    }
    return;
  }

  if (franchise === 'mk') {
    const rows = await sql`SELECT id, mk_rating FROM users WHERE id IN (${hostId}, ${guestId})`;
    const h = rows.find(r => r.id === hostId);
    const g = rows.find(r => r.id === guestId);
    const rh = Number(h?.mk_rating ?? 1200);
    const rg = Number(g?.mk_rating ?? 1200);
    const sh = result === 'host' ? 1 : result === 'draw' ? 0.5 : 0;
    const newH = eloCalc(rh, rg, sh);
    const newG = eloCalc(rg, rh, 1 - sh);
    if (result === 'host') {
      await sql`UPDATE users SET mk_rating = ${newH}, mk_wins = mk_wins + 1 WHERE id = ${hostId}`;
      await sql`UPDATE users SET mk_rating = ${newG}, mk_losses = mk_losses + 1 WHERE id = ${guestId}`;
    } else if (result === 'guest') {
      await sql`UPDATE users SET mk_rating = ${newH}, mk_losses = mk_losses + 1 WHERE id = ${hostId}`;
      await sql`UPDATE users SET mk_rating = ${newG}, mk_wins = mk_wins + 1 WHERE id = ${guestId}`;
    } else {
      await sql`UPDATE users SET mk_rating = ${newH} WHERE id = ${hostId}`;
      await sql`UPDATE users SET mk_rating = ${newG} WHERE id = ${guestId}`;
    }
    return;
  }

  // General snes ELO for all other 2P games
  const rows = await sql`SELECT id, snes_rating FROM users WHERE id IN (${hostId}, ${guestId})`;
  const h = rows.find(r => r.id === hostId);
  const g = rows.find(r => r.id === guestId);
  const rh = Number(h?.snes_rating ?? 1200);
  const rg = Number(g?.snes_rating ?? 1200);
  const sh = result === 'host' ? 1 : result === 'draw' ? 0.5 : 0;
  const newH = eloCalc(rh, rg, sh);
  const newG = eloCalc(rg, rh, 1 - sh);
  if (result === 'host') {
    await sql`UPDATE users SET snes_rating = ${newH}, snes_wins = snes_wins + 1 WHERE id = ${hostId}`;
    await sql`UPDATE users SET snes_rating = ${newG}, snes_losses = snes_losses + 1 WHERE id = ${guestId}`;
  } else if (result === 'guest') {
    await sql`UPDATE users SET snes_rating = ${newH}, snes_losses = snes_losses + 1 WHERE id = ${hostId}`;
    await sql`UPDATE users SET snes_rating = ${newG}, snes_wins = snes_wins + 1 WHERE id = ${guestId}`;
  } else {
    await sql`UPDATE users SET snes_rating = ${newH} WHERE id = ${hostId}`;
    await sql`UPDATE users SET snes_rating = ${newG} WHERE id = ${guestId}`;
  }
}

export async function getSnesLeaderboard() {
  return sql`
    SELECT id, username, display_name, avatar_url, snes_rating, snes_wins, snes_losses
    FROM users
    WHERE snes_rating != 1200 OR snes_wins > 0
    ORDER BY snes_rating DESC
    LIMIT 20
  `;
}

export async function getSfLeaderboard() {
  return sql`
    SELECT id, username, display_name, avatar_url, sf_rating, sf_wins, sf_losses
    FROM users
    WHERE sf_rating != 1200 OR sf_wins > 0
    ORDER BY sf_rating DESC
    LIMIT 20
  `;
}

export async function getMkLeaderboard() {
  return sql`
    SELECT id, username, display_name, avatar_url, mk_rating, mk_wins, mk_losses
    FROM users
    WHERE mk_rating != 1200 OR mk_wins > 0
    ORDER BY mk_rating DESC
    LIMIT 20
  `;
}

/** Close arena rooms that have been vacant for 20+ minutes with no activity */
export async function closeVacantArenas() {
  await sql`
    UPDATE emulator_rooms
    SET status = 'completed', updated_at = NOW()
    WHERE status IN ('waiting', 'active')
      AND game_started = false
      AND updated_at < NOW() - INTERVAL '20 minutes'
  `.catch(() => {});
}

/** Heartbeat host presence — call whenever the host polls/interacts */
export async function heartbeatArenaHost(roomId: string) {
  await sql`UPDATE emulator_rooms SET updated_at = NOW() WHERE id = ${roomId}`.catch(() => {});
}

export async function getActiveEmulatorRooms() {
  // Auto-close rooms that have been vacant for 20 minutes
  await closeVacantArenas();
  return sql`
    SELECT er.*,
      u1.username AS host_username, u1.avatar_url AS host_avatar,
      u2.username AS guest_username, u2.avatar_url AS guest_avatar
    FROM emulator_rooms er
    JOIN users u1 ON er.host_id = u1.id
    LEFT JOIN users u2 ON er.guest_id = u2.id
    WHERE er.status IN ('waiting', 'active')
      AND er.game_started = false
      AND er.created_at > NOW() - INTERVAL '24 hours'
    ORDER BY er.created_at DESC
    LIMIT 20
  `;
}

export async function startEmulatorRoom(roomId: string, hostId: string) {
  return sql`
    UPDATE emulator_rooms SET game_started = true, status = 'active', updated_at = NOW()
    WHERE id = ${roomId} AND host_id = ${hostId}
  `;
}

export async function selectEmulatorGame(roomId: string, hostId: string, gameName: string) {
  return sql`
    UPDATE emulator_rooms SET game_name = ${gameName}, updated_at = NOW()
    WHERE id = ${roomId} AND host_id = ${hostId}
  `;
}

export async function addRoomMessage(roomId: string, userId: string, username: string, avatarUrl: string | null, content: string) {
  return sql`
    INSERT INTO emulator_room_messages (room_id, user_id, username, avatar_url, content)
    VALUES (${roomId}, ${userId}, ${username}, ${avatarUrl}, ${content})
    RETURNING *
  `;
}

export async function getRoomMessages(roomId: string) {
  return sql`
    SELECT * FROM emulator_room_messages WHERE room_id = ${roomId}
    ORDER BY created_at ASC LIMIT 100
  `;
}

export async function closeEmulatorRoom(roomId: string, userId: string) {
  return sql`
    UPDATE emulator_rooms SET status = 'completed', updated_at = NOW()
    WHERE id = ${roomId} AND (host_id = ${userId} OR guest_id = ${userId})
  `;
}

export async function closeAllRoomsForUser(userId: string) {
  return sql`
    UPDATE emulator_rooms SET status = 'completed', updated_at = NOW()
    WHERE (host_id = ${userId} OR guest_id = ${userId}) AND status != 'completed'
  `;
}

// ─── VOICE CHAT ───────────────────────────────────────────────────────────────

let _voiceTablesReady = false;
async function ensureVoiceTables() {
  if (_voiceTablesReady) return; _voiceTablesReady = true;
  await sql`
    CREATE TABLE IF NOT EXISTS voice_rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      creator_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      type TEXT DEFAULT 'open',
      dm_pair TEXT,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `.catch(() => {});
  await sql`
    CREATE TABLE IF NOT EXISTS voice_participants (
      room_id TEXT REFERENCES voice_rooms(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      username TEXT NOT NULL,
      avatar_url TEXT,
      is_muted BOOLEAN DEFAULT false,
      last_heartbeat BIGINT DEFAULT 0,
      PRIMARY KEY (room_id, user_id)
    )
  `.catch(() => {});
  await sql`
    CREATE TABLE IF NOT EXISTS voice_signals (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      from_user_id TEXT NOT NULL,
      to_user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `.catch(() => {});
  await sql`
    CREATE TABLE IF NOT EXISTS voice_room_messages (
      id BIGSERIAL PRIMARY KEY,
      room_id TEXT NOT NULL,
      user_id TEXT,
      username TEXT NOT NULL,
      avatar_url TEXT,
      content TEXT NOT NULL,
      is_ai BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `.catch(() => {});
}

export async function addVoiceRoomMessage(
  roomId: string, userId: string | null, username: string,
  avatarUrl: string | null, content: string, isAi = false
) {
  await ensureVoiceTables();
  const rows = await sql`
    INSERT INTO voice_room_messages (room_id, user_id, username, avatar_url, content, is_ai)
    VALUES (${roomId}, ${userId}, ${username}, ${avatarUrl}, ${content.slice(0, 500)}, ${isAi})
    RETURNING *
  `;
  return rows[0];
}

export async function getVoiceRoomMessages(roomId: string) {
  await ensureVoiceTables();
  return sql`
    SELECT * FROM voice_room_messages
    WHERE room_id = ${roomId}
    ORDER BY created_at ASC
    LIMIT 100
  `;
}

export async function createVoiceRoom(id: string, creatorId: string, name: string, type = 'open', dmPair?: string) {
  await ensureVoiceTables();
  await sql`
    INSERT INTO voice_rooms (id, name, creator_id, type, dm_pair)
    VALUES (${id}, ${name}, ${creatorId}, ${type}, ${dmPair ?? null})
    ON CONFLICT (id) DO NOTHING
  `;
  return id;
}

export async function getVoiceRoom(id: string) {
  await ensureVoiceTables();
  const rows = await sql`SELECT * FROM voice_rooms WHERE id = ${id} AND status = 'active'`;
  return rows[0] ?? null;
}

export async function getActiveVoiceRooms() {
  await ensureVoiceTables();
  const stale = Date.now() - 60000; // 60s — matches getVoiceParticipants window
  return sql`
    SELECT vr.*, u.username AS creator_username, u.avatar_url AS creator_avatar,
           COUNT(vp.user_id)::int AS participant_count
    FROM voice_rooms vr
    LEFT JOIN users u ON vr.creator_id = u.id
    LEFT JOIN voice_participants vp ON vr.id = vp.room_id AND vp.last_heartbeat > ${stale}
    WHERE vr.status = 'active' AND vr.type = 'open'
    GROUP BY vr.id, u.username, u.avatar_url
    ORDER BY vr.created_at DESC
    LIMIT 20
  `;
}

export async function joinVoiceRoom(roomId: string, userId: string, username: string, avatarUrl: string | null) {
  await ensureVoiceTables();
  await sql`
    INSERT INTO voice_participants (room_id, user_id, username, avatar_url, last_heartbeat)
    VALUES (${roomId}, ${userId}, ${username}, ${avatarUrl}, ${Date.now()})
    ON CONFLICT (room_id, user_id) DO UPDATE SET last_heartbeat = ${Date.now()}, username = ${username}
  `;
}

export async function leaveVoiceRoom(roomId: string, userId: string) {
  await sql`DELETE FROM voice_participants WHERE room_id = ${roomId} AND user_id = ${userId}`;
}

export async function heartbeatVoice(roomId: string, userId: string) {
  await sql`UPDATE voice_participants SET last_heartbeat = ${Date.now()} WHERE room_id = ${roomId} AND user_id = ${userId}`;
}

export async function getVoiceParticipants(roomId: string) {
  const stale = Date.now() - 60000; // 60s — generous window so participants don't flicker between polls
  return sql`
    SELECT vp.*, u.avatar_url
    FROM voice_participants vp
    JOIN users u ON vp.user_id = u.id
    WHERE vp.room_id = ${roomId} AND vp.last_heartbeat > ${stale}
    ORDER BY vp.last_heartbeat ASC
  `;
}

export async function setVoiceMuted(roomId: string, userId: string, muted: boolean) {
  await sql`UPDATE voice_participants SET is_muted = ${muted} WHERE room_id = ${roomId} AND user_id = ${userId}`;
}

export async function storeVoiceSignal(id: string, roomId: string, fromUserId: string, toUserId: string, type: string, payload: string) {
  await ensureVoiceTables();
  await sql`
    INSERT INTO voice_signals (id, room_id, from_user_id, to_user_id, type, payload)
    VALUES (${id}, ${roomId}, ${fromUserId}, ${toUserId}, ${type}, ${payload})
  `;
}

export async function getVoiceSignals(roomId: string, toUserId: string, after: number) {
  sql`DELETE FROM voice_signals WHERE created_at < NOW() - INTERVAL '2 minutes'`.catch(() => {});
  return sql`
    SELECT * FROM voice_signals
    WHERE room_id = ${roomId} AND to_user_id = ${toUserId}
      AND created_at > to_timestamp(${after / 1000.0})
    ORDER BY created_at ASC
    LIMIT 200
  `;
}

export async function getVoiceRoomByDmPair(dmPair: string) {
  await ensureVoiceTables();
  const rows = await sql`
    SELECT * FROM voice_rooms
    WHERE dm_pair = ${dmPair} AND status = 'active'
    ORDER BY created_at DESC LIMIT 1
  `;
  return rows[0] ?? null;
}

// ─── WATCH TOGETHER ───────────────────────────────────────────────────────────

let _watchTablesReady = false;
async function ensureWatchTables() {
  if (_watchTablesReady) return; _watchTablesReady = true;
  await sql`
    CREATE TABLE IF NOT EXISTS watch_rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      host_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      stream_url TEXT DEFAULT '',
      is_playing BOOLEAN DEFAULT false,
      position DOUBLE PRECISION DEFAULT 0,
      last_sync BIGINT DEFAULT 0,
      synced_by TEXT,
      status TEXT DEFAULT 'open',
      invite_only BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `.catch(() => {});
  // Migration: add invite_only to existing tables
  await sql`ALTER TABLE watch_rooms ADD COLUMN IF NOT EXISTS invite_only BOOLEAN DEFAULT false`.catch(() => {});
  await sql`
    CREATE TABLE IF NOT EXISTS watch_room_members (
      room_id TEXT REFERENCES watch_rooms(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      username TEXT NOT NULL,
      avatar_url TEXT,
      last_seen BIGINT DEFAULT 0,
      PRIMARY KEY (room_id, user_id)
    )
  `.catch(() => {});
}

export async function createWatchRoom(id: string, hostId: string, name: string, hostUsername: string, hostAvatar: string | null, inviteOnly = false) {
  await ensureWatchTables();
  await sql`
    INSERT INTO watch_rooms (id, name, host_id, last_sync, invite_only)
    VALUES (${id}, ${name}, ${hostId}, ${Date.now()}, ${inviteOnly})
  `;
  await sql`
    INSERT INTO watch_room_members (room_id, user_id, username, avatar_url, last_seen)
    VALUES (${id}, ${hostId}, ${hostUsername}, ${hostAvatar}, ${Date.now()})
  `;
  return id;
}

export async function setWatchRoomInviteOnly(roomId: string, hostId: string, inviteOnly: boolean) {
  await sql`
    UPDATE watch_rooms SET invite_only = ${inviteOnly}, updated_at = NOW()
    WHERE id = ${roomId} AND host_id = ${hostId}
  `;
}

export async function getWatchRoom(id: string) {
  await ensureWatchTables();
  const rows = await sql`SELECT * FROM watch_rooms WHERE id = ${id}`;
  return rows[0] ?? null;
}

export async function getWatchRoomMembers(roomId: string) {
  await ensureWatchTables();
  const staleThreshold = Date.now() - 30000; // 30s inactive = gone
  return sql`
    SELECT * FROM watch_room_members
    WHERE room_id = ${roomId} AND last_seen > ${staleThreshold}
    ORDER BY last_seen DESC
  `;
}

export async function joinWatchRoom(roomId: string, userId: string, username: string, avatarUrl: string | null) {
  await ensureWatchTables();
  await sql`
    INSERT INTO watch_room_members (room_id, user_id, username, avatar_url, last_seen)
    VALUES (${roomId}, ${userId}, ${username}, ${avatarUrl}, ${Date.now()})
    ON CONFLICT (room_id, user_id) DO UPDATE SET last_seen = ${Date.now()}, username = ${username}
  `;
}

export async function heartbeatWatchRoom(roomId: string, userId: string) {
  await sql`UPDATE watch_room_members SET last_seen = ${Date.now()} WHERE room_id = ${roomId} AND user_id = ${userId}`;
}

export async function syncWatchRoom(roomId: string, userId: string, payload: {
  streamUrl?: string; isPlaying?: boolean; position?: number;
}) {
  const updates: string[] = [`updated_at = NOW()`, `last_sync = ${Date.now()}`, `synced_by = '${userId}'`];
  if (payload.streamUrl !== undefined) updates.push(`stream_url = '${payload.streamUrl.replace(/'/g, "''")}'`);
  if (payload.isPlaying !== undefined) updates.push(`is_playing = ${payload.isPlaying}`);
  if (payload.position !== undefined) updates.push(`position = ${payload.position}`);
  // Use parameterized query
  await sql`
    UPDATE watch_rooms SET
      stream_url = COALESCE(${payload.streamUrl ?? null}, stream_url),
      is_playing = COALESCE(${payload.isPlaying ?? null}, is_playing),
      position = COALESCE(${payload.position ?? null}, position),
      last_sync = ${Date.now()},
      synced_by = ${userId},
      updated_at = NOW()
    WHERE id = ${roomId}
  `;
}

export async function getOpenWatchRooms() {
  await ensureWatchTables();
  const staleThreshold = Date.now() - 60000;
  const idleThreshold = Date.now() - 30 * 60 * 1000; // 30 min idle

  // Auto-close rooms with no active members for 30+ minutes
  await sql`
    UPDATE watch_rooms SET status = 'closed'
    WHERE status = 'open'
      AND updated_at < NOW() - INTERVAL '30 minutes'
      AND id NOT IN (
        SELECT DISTINCT room_id FROM watch_room_members
        WHERE last_seen > ${idleThreshold}
      )
  `.catch(() => {});

  return sql`
    SELECT wr.*, u.username AS host_username, u.avatar_url AS host_avatar,
           COUNT(wrm.user_id)::int AS member_count
    FROM watch_rooms wr
    LEFT JOIN users u ON wr.host_id = u.id
    LEFT JOIN watch_room_members wrm ON wr.id = wrm.room_id AND wrm.last_seen > ${staleThreshold}
    WHERE wr.status = 'open' AND (wr.invite_only IS NULL OR wr.invite_only = false)
    GROUP BY wr.id, u.username, u.avatar_url
    ORDER BY wr.created_at DESC
    LIMIT 20
  `;
}

/** Returns all open watch rooms that any of the user's friends are currently in.
 *  Includes invite-only rooms (friends can always join each other). */
export async function getFriendsInWatchRooms(userId: string) {
  try {
    await ensureWatchTables();
    const staleThreshold = Date.now() - 60000; // 60s — same as room listing
    return await sql`
      SELECT
        wr.id AS room_id,
        wr.name AS room_name,
        wr.host_id,
        wr.is_screen_sharing,
        wr.invite_only,
        wrm.user_id AS friend_user_id,
        u.username AS friend_username,
        u.display_name AS friend_display_name,
        u.avatar_url AS friend_avatar
      FROM watch_room_members wrm
      JOIN watch_rooms wr ON wr.id = wrm.room_id
      JOIN users u ON u.id = wrm.user_id
      WHERE wr.status = 'open'
        AND wrm.last_seen > ${staleThreshold}
        AND wrm.user_id != ${userId}
        AND wrm.user_id IN (
          SELECT CASE WHEN f.requester_id = ${userId} THEN f.addressee_id ELSE f.requester_id END
          FROM friendships f
          WHERE (f.requester_id = ${userId} OR f.addressee_id = ${userId})
            AND f.status = 'accepted'
        )
      ORDER BY wrm.last_seen DESC
      LIMIT 20
    `;
  } catch { return []; }
}

export async function closeWatchRoom(roomId: string, userId: string) {
  await sql`
    UPDATE watch_rooms SET status = 'closed', updated_at = NOW()
    WHERE id = ${roomId} AND host_id = ${userId}
  `;
}

export async function closeVoiceRoom(roomId: string, userId: string) {
  await ensureVoiceTables();
  await sql`
    UPDATE voice_rooms SET status = 'closed'
    WHERE id = ${roomId} AND creator_id = ${userId}
  `;
  // Remove all participants from the closed room
  await sql`DELETE FROM voice_participants WHERE room_id = ${roomId}`.catch(() => {});
}

export async function getIncomingDmCallsForUser(userId: string) {
  await ensureVoiceTables();
  const stale = Date.now() - 60000; // 60s — matches voice participant window
  return sql`
    SELECT vr.id, vr.name, vr.dm_pair,
           vp.user_id AS caller_id,
           u.username AS caller_username,
           u.avatar_url AS caller_avatar
    FROM voice_rooms vr
    JOIN voice_participants vp ON vr.id = vp.room_id
      AND vp.user_id != ${userId}
      AND vp.last_heartbeat > ${stale}
    JOIN users u ON vp.user_id = u.id
    WHERE vr.status = 'active'
      AND vr.type = 'dm'
      AND (vr.dm_pair LIKE ${userId + ':%'} OR vr.dm_pair LIKE ${'%:' + userId})
    LIMIT 3
  `;
}

// ─── POKER ────────────────────────────────────────────────────────────────────

let _pokerTablesReady = false;
async function ensurePokerTables() {
  if (_pokerTablesReady) return; _pokerTablesReady = true;
  await sql`
    CREATE TABLE IF NOT EXISTS poker_rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      host_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      max_players INTEGER NOT NULL DEFAULT 9,
      buy_in INTEGER NOT NULL DEFAULT 1000,
      game_state JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `.catch(() => {});
  await sql`
    CREATE TABLE IF NOT EXISTS poker_players (
      id SERIAL PRIMARY KEY,
      room_id TEXT REFERENCES poker_rooms(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      seat INTEGER NOT NULL,
      chips INTEGER NOT NULL DEFAULT 1000,
      status TEXT NOT NULL DEFAULT 'active',
      is_bot BOOLEAN DEFAULT FALSE,
      bot_username TEXT,
      bot_avatar TEXT,
      joined_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(room_id, user_id),
      UNIQUE(room_id, seat)
    )
  `.catch(() => {});
  // Migration: add bot columns if table already exists
  await sql`ALTER TABLE poker_players ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT FALSE`.catch(() => {});
  await sql`ALTER TABLE poker_players ADD COLUMN IF NOT EXISTS bot_username TEXT`.catch(() => {});
  await sql`ALTER TABLE poker_players ADD COLUMN IF NOT EXISTS bot_avatar TEXT`.catch(() => {});
  // Drop FK on user_id to allow bot user IDs
  await sql`ALTER TABLE poker_players DROP CONSTRAINT IF EXISTS poker_players_user_id_fkey`.catch(() => {});
}

export async function createPokerRoom(id: string, hostId: string, name: string, buyIn = 1000, maxPlayers = 9) {
  await ensurePokerTables();
  const { emptyState } = await import('./poker-engine');
  const state = emptyState();
  await sql`
    INSERT INTO poker_rooms (id, name, host_id, status, max_players, buy_in, game_state)
    VALUES (${id}, ${name}, ${hostId}, 'waiting', ${maxPlayers}, ${buyIn}, ${JSON.stringify(state)})
  `;
  // Host joins as seat 0
  await sql`
    INSERT INTO poker_players (room_id, user_id, seat, chips)
    VALUES (${id}, ${hostId}, 0, ${buyIn})
  `;
  return id;
}

export async function getPokerRoom(id: string) {
  await ensurePokerTables();
  const rows = await sql`SELECT * FROM poker_rooms WHERE id = ${id}`;
  return rows[0] ?? null;
}

export async function getPokerPlayers(roomId: string) {
  await ensurePokerTables();
  return sql`
    SELECT pp.*,
           COALESCE(pp.bot_username, u.username) AS username,
           COALESCE(pp.bot_avatar, u.avatar_url) AS avatar_url,
           COALESCE(u.display_name, pp.bot_username) AS display_name
    FROM poker_players pp
    LEFT JOIN users u ON pp.user_id = u.id AND pp.is_bot = FALSE
    WHERE pp.room_id = ${roomId}
    ORDER BY pp.seat ASC
  `;
}

export async function addPokerPlayer(roomId: string, userId: string, buyIn: number) {
  await ensurePokerTables();
  // Find next available seat
  const players = await sql`SELECT seat FROM poker_players WHERE room_id = ${roomId} ORDER BY seat`;
  const taken = new Set(players.map(p => Number(p.seat)));
  let seat = 0;
  while (taken.has(seat)) seat++;
  await sql`
    INSERT INTO poker_players (room_id, user_id, seat, chips)
    VALUES (${roomId}, ${userId}, ${seat}, ${buyIn})
    ON CONFLICT (room_id, user_id) DO NOTHING
  `;
}

export async function addBotToPokerRoom(roomId: string, botId: string, botName: string, botAvatar: string, chips: number) {
  await ensurePokerTables();
  const players = await sql`SELECT seat FROM poker_players WHERE room_id = ${roomId} ORDER BY seat`;
  const taken = new Set(players.map(p => Number(p.seat)));
  let seat = 0;
  while (taken.has(seat)) seat++;
  await sql`
    INSERT INTO poker_players (room_id, user_id, seat, chips, is_bot, bot_username, bot_avatar)
    VALUES (${roomId}, ${botId}, ${seat}, ${chips}, TRUE, ${botName}, ${botAvatar})
    ON CONFLICT (room_id, user_id) DO NOTHING
  `;
}

export async function removePokerPlayer(roomId: string, userId: string) {
  await sql`DELETE FROM poker_players WHERE room_id = ${roomId} AND user_id = ${userId}`;
}

export async function updatePokerState(roomId: string, state: Record<string, unknown>) {
  await sql`
    UPDATE poker_rooms SET game_state = ${JSON.stringify(state)}, updated_at = NOW()
    WHERE id = ${roomId}
  `;
}

export async function updatePokerPlayerChips(roomId: string, userId: string, chips: number) {
  await sql`UPDATE poker_players SET chips = ${chips} WHERE room_id = ${roomId} AND user_id = ${userId}`;
}

export async function updatePokerPlayerChipsAndStatus(roomId: string, userId: string, chips: number, status: string) {
  await sql`UPDATE poker_players SET chips = ${chips}, status = ${status} WHERE room_id = ${roomId} AND user_id = ${userId}`;
}

export async function setPokerRoomStatus(roomId: string, status: string) {
  await sql`UPDATE poker_rooms SET status = ${status}, updated_at = NOW() WHERE id = ${roomId}`;
}

export async function getPokerLobbies() {
  await ensurePokerTables();
  return sql`
    SELECT pr.*, u.username AS host_username, u.avatar_url AS host_avatar,
           COUNT(pp.id)::int AS player_count
    FROM poker_rooms pr
    LEFT JOIN users u ON pr.host_id = u.id
    LEFT JOIN poker_players pp ON pr.id = pp.room_id
    WHERE pr.status IN ('waiting', 'playing')
    GROUP BY pr.id, u.username, u.avatar_url
    ORDER BY pr.created_at DESC
    LIMIT 20
  `;
}

// ── Screen Share Signals ──────────────────────────────────────────────────

let _screenShareReady = false;
async function ensureScreenShareSignals() {
  if (_screenShareReady) return; _screenShareReady = true;
  await sql`
    CREATE TABLE IF NOT EXISTS screen_share_signals (
      id SERIAL PRIMARY KEY,
      room_id TEXT NOT NULL,
      from_user TEXT NOT NULL,
      to_user TEXT NOT NULL,
      type TEXT NOT NULL,
      payload JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `.catch(() => {});
  await sql`
    CREATE INDEX IF NOT EXISTS idx_sss_room_to
    ON screen_share_signals(room_id, to_user, id)
  `.catch(() => {});
  await sql`
    ALTER TABLE watch_rooms ADD COLUMN IF NOT EXISTS is_screen_sharing BOOLEAN DEFAULT FALSE
  `.catch(() => {});
}

export async function storeScreenShareSignal(
  roomId: string, fromUser: string, toUser: string, type: string, payload: unknown
) {
  await ensureScreenShareSignals();
  // Clean up old signals
  await sql`
    DELETE FROM screen_share_signals
    WHERE room_id = ${roomId} AND created_at < NOW() - INTERVAL '45 seconds'
  `.catch(() => {});
  const rows = await sql`
    INSERT INTO screen_share_signals (room_id, from_user, to_user, type, payload)
    VALUES (${roomId}, ${fromUser}, ${toUser}, ${type}, ${JSON.stringify(payload)})
    RETURNING id
  `;
  return rows[0]?.id as number;
}

export async function getScreenShareSignals(roomId: string, forUser: string, afterId: number) {
  await ensureScreenShareSignals();
  return sql`
    SELECT * FROM screen_share_signals
    WHERE room_id = ${roomId} AND to_user = ${forUser} AND id > ${afterId}
    ORDER BY id ASC
    LIMIT 50
  `;
}

export async function setWatchRoomScreenSharing(roomId: string, active: boolean) {
  await ensureScreenShareSignals();
  await sql`
    UPDATE watch_rooms SET is_screen_sharing = ${active}, updated_at = NOW() WHERE id = ${roomId}
  `;
}

// ─── Draw Rooms ───────────────────────────────────────────────────────────────

let _drawTablesReady = false;
async function ensureDrawTables() {
  if (_drawTablesReady) return; _drawTablesReady = true;
  await sql`
    CREATE TABLE IF NOT EXISTS draw_rooms (
      id TEXT PRIMARY KEY,
      host_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'Untitled Drawing',
      is_public BOOLEAN DEFAULT true,
      canvas_snapshot TEXT DEFAULT NULL,
      snapshot_at TIMESTAMP DEFAULT NOW(),
      allow_viewers BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `.catch(() => {});
  await sql`
    CREATE TABLE IF NOT EXISTS draw_room_viewers (
      room_id TEXT REFERENCES draw_rooms(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      username TEXT NOT NULL,
      avatar_url TEXT,
      last_seen TIMESTAMP DEFAULT NOW(),
      is_collaborator BOOLEAN DEFAULT false,
      PRIMARY KEY (room_id, user_id)
    )
  `.catch(() => {});
  await sql`ALTER TABLE draw_room_viewers ADD COLUMN IF NOT EXISTS is_collaborator BOOLEAN DEFAULT false`.catch(() => {});
  await sql`
    CREATE TABLE IF NOT EXISTS draw_room_messages (
      id SERIAL PRIMARY KEY,
      room_id TEXT REFERENCES draw_rooms(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      username TEXT NOT NULL,
      avatar_url TEXT,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `.catch(() => {});
}

export async function createDrawRoom(id: string, hostId: string, title: string, isPublic: boolean) {
  await ensureDrawTables();
  const rows = await sql`
    INSERT INTO draw_rooms (id, host_id, title, is_public)
    VALUES (${id}, ${hostId}, ${title}, ${isPublic})
    RETURNING *
  `;
  return rows[0];
}

export async function getDrawRoom(id: string) {
  await ensureDrawTables();
  const rows = await sql`
    SELECT dr.*, u.username AS host_username, u.avatar_url AS host_avatar
    FROM draw_rooms dr JOIN users u ON dr.host_id = u.id
    WHERE dr.id = ${id}
  `;
  return rows[0] ?? null;
}

export async function getPublicDrawRooms() {
  await ensureDrawTables();
  await sql`DELETE FROM draw_room_viewers WHERE last_seen < NOW() - INTERVAL '30 seconds'`.catch(() => {});
  return sql`
    SELECT dr.id, dr.title, dr.host_id, dr.canvas_snapshot, dr.created_at, dr.updated_at,
           u.username AS host_username, u.avatar_url AS host_avatar,
           COUNT(drv.user_id)::int AS viewer_count
    FROM draw_rooms dr
    JOIN users u ON dr.host_id = u.id
    LEFT JOIN draw_room_viewers drv ON dr.id = drv.room_id
    WHERE dr.is_public = true AND dr.updated_at > NOW() - INTERVAL '3 hours'
    GROUP BY dr.id, dr.title, dr.host_id, dr.canvas_snapshot, dr.created_at, dr.updated_at, u.username, u.avatar_url
    ORDER BY dr.updated_at DESC LIMIT 20
  `;
}

export async function updateDrawSnapshot(id: string, userId: string, snapshot: string) {
  // Allow host OR active collaborator to save the canvas snapshot
  await sql`
    UPDATE draw_rooms SET canvas_snapshot = ${snapshot}, snapshot_at = NOW(), updated_at = NOW()
    WHERE id = ${id} AND (
      host_id = ${userId}
      OR EXISTS (
        SELECT 1 FROM draw_room_viewers
        WHERE room_id = ${id} AND user_id = ${userId} AND is_collaborator = true
      )
    )
  `;
}

export async function grantDrawCollaboration(roomId: string, hostId: string, userId: string) {
  const room = await sql`SELECT host_id FROM draw_rooms WHERE id = ${roomId}`;
  if (!room[0] || room[0].host_id !== hostId) return false;
  await sql`UPDATE draw_room_viewers SET is_collaborator = true WHERE room_id = ${roomId} AND user_id = ${userId}`;
  return true;
}

export async function revokeDrawCollaboration(roomId: string, hostId: string, userId: string) {
  const room = await sql`SELECT host_id FROM draw_rooms WHERE id = ${roomId}`;
  if (!room[0] || room[0].host_id !== hostId) return false;
  await sql`UPDATE draw_room_viewers SET is_collaborator = false WHERE room_id = ${roomId} AND user_id = ${userId}`;
  return true;
}

export async function setDrawRoomViewers(id: string, hostId: string, allowViewers: boolean) {
  await sql`UPDATE draw_rooms SET allow_viewers = ${allowViewers} WHERE id = ${id} AND host_id = ${hostId}`;
}

export async function closeDrawRoom(id: string, hostId: string) {
  await sql`DELETE FROM draw_rooms WHERE id = ${id} AND host_id = ${hostId}`;
}

export async function heartbeatDrawViewer(roomId: string, userId: string, username: string, avatarUrl: string) {
  await ensureDrawTables();
  await sql`
    INSERT INTO draw_room_viewers (room_id, user_id, username, avatar_url, last_seen)
    VALUES (${roomId}, ${userId}, ${username}, ${avatarUrl}, NOW())
    ON CONFLICT (room_id, user_id) DO UPDATE SET last_seen = NOW(), username = ${username}, avatar_url = ${avatarUrl}
  `;
}

export async function getDrawRoomViewers(roomId: string) {
  await sql`DELETE FROM draw_room_viewers WHERE last_seen < NOW() - INTERVAL '30 seconds'`.catch(() => {});
  return sql`SELECT * FROM draw_room_viewers WHERE room_id = ${roomId} ORDER BY last_seen DESC`;
}

export async function bootDrawViewer(roomId: string, hostId: string, userId: string) {
  const room = await sql`SELECT host_id FROM draw_rooms WHERE id = ${roomId}`;
  if (!room[0] || room[0].host_id !== hostId) return false;
  await sql`DELETE FROM draw_room_viewers WHERE room_id = ${roomId} AND user_id = ${userId}`;
  return true;
}

export async function addDrawMessage(roomId: string, userId: string, username: string, avatarUrl: string | null, content: string) {
  await ensureDrawTables();
  const rows = await sql`
    INSERT INTO draw_room_messages (room_id, user_id, username, avatar_url, content)
    VALUES (${roomId}, ${userId}, ${username}, ${avatarUrl}, ${content})
    RETURNING *
  `;
  return rows[0];
}

export async function getDrawMessages(roomId: string) {
  return sql`SELECT * FROM draw_room_messages WHERE room_id = ${roomId} ORDER BY created_at ASC`;
}

// ─── Share Feed ───────────────────────────────────────────────────────────────

let _shareTablesReady = false;
async function ensureShareTables() {
  if (_shareTablesReady) return; _shareTablesReady = true;
  await sql`
    CREATE TABLE IF NOT EXISTS shares (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      username TEXT NOT NULL,
      avatar_url TEXT,
      type TEXT NOT NULL DEFAULT 'art',
      title TEXT,
      caption TEXT,
      image_data TEXT,
      image_url TEXT,
      video_url TEXT,
      game_data JSONB,
      likes_count INTEGER DEFAULT 0,
      flag_count INTEGER DEFAULT 0,
      is_hidden BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `.catch(() => {});
  await sql`ALTER TABLE shares ADD COLUMN IF NOT EXISTS image_url TEXT`.catch(() => {});
  await sql`ALTER TABLE shares ADD COLUMN IF NOT EXISTS flag_count INTEGER DEFAULT 0`.catch(() => {});
  await sql`ALTER TABLE shares ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE`.catch(() => {});
  await sql`
    CREATE TABLE IF NOT EXISTS share_likes (
      share_id TEXT REFERENCES shares(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (share_id, user_id)
    )
  `.catch(() => {});
  await sql`
    CREATE TABLE IF NOT EXISTS share_flags (
      share_id TEXT REFERENCES shares(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (share_id, user_id)
    )
  `.catch(() => {});
}

export async function createShare(id: string, userId: string, username: string, avatarUrl: string | null, type: string, title: string | null, caption: string | null, imageData: string | null, videoUrl: string | null, gameData: unknown | null, imageUrl?: string | null) {
  await ensureShareTables();
  const rows = await sql`
    INSERT INTO shares (id, user_id, username, avatar_url, type, title, caption, image_data, image_url, video_url, game_data)
    VALUES (${id}, ${userId}, ${username}, ${avatarUrl}, ${type}, ${title}, ${caption}, ${imageData}, ${imageUrl ?? null}, ${videoUrl}, ${JSON.stringify(gameData)})
    RETURNING *
  `;
  return rows[0];
}

export async function getShareById(shareId: string, viewerId?: string) {
  await ensureShareTables();
  const rows = await sql`
    SELECT s.id, s.user_id, COALESCE(u.username, s.username) AS username,
           COALESCE(u.avatar_url, s.avatar_url) AS avatar_url,
           s.type, s.title, s.caption, s.image_data, s.image_url,
           s.video_url, s.game_data, s.likes_count, s.flag_count, s.is_hidden, s.created_at,
           ${viewerId ? sql`EXISTS(SELECT 1 FROM share_likes WHERE share_id = s.id AND user_id = ${viewerId})` : sql`false`} AS user_liked
    FROM shares s LEFT JOIN users u ON s.user_id = u.id
    WHERE s.id = ${shareId}
    LIMIT 1
  `.catch(() => []);
  return rows[0] ?? null;
}

export async function flagShare(shareId: string, userId: string): Promise<{ flagged: boolean; hidden: boolean }> {
  await ensureShareTables();
  const existing = await sql`SELECT 1 FROM share_flags WHERE share_id = ${shareId} AND user_id = ${userId}`.catch(() => []);
  if (existing.length > 0) return { flagged: false, hidden: false }; // already flagged
  await sql`INSERT INTO share_flags (share_id, user_id) VALUES (${shareId}, ${userId}) ON CONFLICT DO NOTHING`.catch(() => {});
  await sql`UPDATE shares SET flag_count = flag_count + 1 WHERE id = ${shareId}`.catch(() => {});
  // Auto-hide if flag_count reaches 2
  const rows = await sql`UPDATE shares SET is_hidden = TRUE WHERE id = ${shareId} AND flag_count >= 2 RETURNING id`.catch(() => []);
  return { flagged: true, hidden: rows.length > 0 };
}

export async function getShareFeed(limit = 30, offset = 0) {
  await ensureShareTables();
  return sql`
    SELECT id, user_id, username, avatar_url, type, title, caption,
           image_data, image_url, video_url, game_data, likes_count, created_at,
           false AS user_liked, view_count
    FROM (
      SELECT s.id, s.user_id, COALESCE(u.username, s.username) AS username,
             COALESCE(u.avatar_url, s.avatar_url) AS avatar_url,
             s.type, s.title, s.caption,
             s.image_data, s.image_url, s.video_url, s.game_data, s.likes_count, s.created_at,
             false AS user_liked, 0 AS view_count
      FROM shares s LEFT JOIN users u ON s.user_id = u.id
      WHERE s.is_hidden = FALSE
      UNION ALL
      SELECT v.id::text, v.uploader_id, u.username, u.avatar_url,
             'video' AS type, v.title, NULL AS caption,
             NULL AS image_data, NULL AS image_url, v.url AS video_url, NULL AS game_data,
             0 AS likes_count, v.created_at,
             false AS user_liked, v.views AS view_count
      FROM videos v JOIN users u ON v.uploader_id = u.id
    ) combined
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

export async function getShareFeedForUser(viewerId: string, limit = 30, offset = 0) {
  await ensureShareTables();
  // Friends-only: show own posts + posts from mutual friends
  return sql`
    SELECT id, user_id, username, avatar_url, type, title, caption,
           image_data, image_url, video_url, game_data, likes_count, created_at,
           user_liked, view_count
    FROM (
      SELECT s.id, s.user_id, COALESCE(u.username, s.username) AS username,
             COALESCE(u.avatar_url, s.avatar_url) AS avatar_url,
             s.type, s.title, s.caption,
             s.image_data, s.image_url, s.video_url, s.game_data, s.likes_count, s.created_at,
             EXISTS(SELECT 1 FROM share_likes WHERE share_id = s.id AND user_id = ${viewerId}) AS user_liked,
             0 AS view_count
      FROM shares s LEFT JOIN users u ON s.user_id = u.id
      WHERE s.is_hidden = FALSE
        AND (
          s.user_id = ${viewerId}
          OR s.user_id IN (
            SELECT CASE WHEN requester_id = ${viewerId} THEN addressee_id ELSE requester_id END
            FROM friendships
            WHERE (requester_id = ${viewerId} OR addressee_id = ${viewerId}) AND status = 'accepted'
          )
        )
      UNION ALL
      SELECT v.id::text, v.uploader_id, u.username, u.avatar_url,
             'video' AS type, v.title, NULL AS caption,
             NULL AS image_data, NULL AS image_url, v.url AS video_url, NULL AS game_data,
             0 AS likes_count, v.created_at,
             false AS user_liked, v.views AS view_count
      FROM videos v JOIN users u ON v.uploader_id = u.id
      WHERE v.uploader_id = ${viewerId}
        OR v.uploader_id IN (
          SELECT CASE WHEN requester_id = ${viewerId} THEN addressee_id ELSE requester_id END
          FROM friendships
          WHERE (requester_id = ${viewerId} OR addressee_id = ${viewerId}) AND status = 'accepted'
        )
    ) combined
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

export async function getFriendCount(userId: string): Promise<number> {
  const rows = await sql`
    SELECT COUNT(*)::int AS cnt FROM friendships
    WHERE (requester_id = ${userId} OR addressee_id = ${userId}) AND status = 'accepted'
  `.catch(() => [{ cnt: 0 }]);
  return Number(rows[0]?.cnt ?? 0);
}

export async function toggleShareLike(shareId: string, userId: string) {
  await ensureShareTables();
  const existing = await sql`SELECT 1 FROM share_likes WHERE share_id = ${shareId} AND user_id = ${userId}`;
  if (existing.length > 0) {
    await sql`DELETE FROM share_likes WHERE share_id = ${shareId} AND user_id = ${userId}`;
    await sql`UPDATE shares SET likes_count = GREATEST(0, likes_count - 1) WHERE id = ${shareId}`;
    return false;
  } else {
    await sql`INSERT INTO share_likes (share_id, user_id) VALUES (${shareId}, ${userId}) ON CONFLICT DO NOTHING`;
    await sql`UPDATE shares SET likes_count = likes_count + 1 WHERE id = ${shareId}`;
    return true;
  }
}

export async function deleteShare(shareId: string, userId: string) {
  const isAdmin = await sql`SELECT 1 FROM users WHERE id = ${userId} AND username = 'mclevesque' LIMIT 1`;
  if ((isAdmin as unknown[]).length > 0) {
    await sql`DELETE FROM shares WHERE id = ${shareId}`;
  } else {
    await sql`DELETE FROM shares WHERE id = ${shareId} AND user_id = ${userId}`;
  }
}

// ─── Town Square ──────────────────────────────────────────────────────────────

let _townTableReady = false;
async function ensureTownTable() {
  if (_townTableReady) return; _townTableReady = true;
  await sql`
    CREATE TABLE IF NOT EXISTS town_players (
      user_id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      avatar_url TEXT DEFAULT '',
      x FLOAT DEFAULT 800,
      y FLOAT DEFAULT 600,
      direction TEXT DEFAULT 'down',
      chat_msg TEXT DEFAULT NULL,
      chat_at TIMESTAMPTZ DEFAULT NULL,
      last_seen TIMESTAMPTZ DEFAULT NOW(),
      is_it BOOLEAN DEFAULT false,
      tag_started_at TIMESTAMPTZ DEFAULT NULL
    )
  `;
  // Safe migrations for existing tables
  await sql`ALTER TABLE town_players ADD COLUMN IF NOT EXISTS is_it BOOLEAN DEFAULT false`.catch(() => {});
  await sql`ALTER TABLE town_players ADD COLUMN IF NOT EXISTS tag_started_at TIMESTAMPTZ DEFAULT NULL`.catch(() => {});
  await sql`ALTER TABLE town_players ADD COLUMN IF NOT EXISTS coins INTEGER DEFAULT 100`.catch(() => {});
  await sql`ALTER TABLE town_players ADD COLUMN IF NOT EXISTS equipped_item TEXT DEFAULT NULL`.catch(() => {});
  await sql`ALTER TABLE town_players ADD COLUMN IF NOT EXISTS party_id TEXT DEFAULT NULL`.catch(() => {});
}

export async function upsertTownPlayer(userId: string, username: string, avatarUrl: string, x: number, y: number, direction: string, chatMsg?: string | null, partyId?: string | null) {
  await ensureTownTable();
  await sql`
    INSERT INTO town_players (user_id, username, avatar_url, x, y, direction, chat_msg, chat_at, last_seen, party_id)
    VALUES (${userId}, ${username}, ${avatarUrl}, ${x}, ${y}, ${direction}, ${chatMsg ?? null}, ${chatMsg ? sql`NOW()` : null}, NOW(), ${partyId ?? null})
    ON CONFLICT (user_id) DO UPDATE SET
      username = EXCLUDED.username,
      avatar_url = EXCLUDED.avatar_url,
      x = EXCLUDED.x,
      y = EXCLUDED.y,
      direction = EXCLUDED.direction,
      chat_msg = EXCLUDED.chat_msg,
      chat_at = CASE WHEN EXCLUDED.chat_msg IS NOT NULL THEN NOW() ELSE town_players.chat_at END,
      last_seen = NOW(),
      party_id = EXCLUDED.party_id
  `;
}

export async function setTownPlayerIt(itUserId: string | null) {
  await ensureTownTable();
  // Clear all IT flags, then set the new IT player (or just clear if null)
  await sql`UPDATE town_players SET is_it = false, tag_started_at = NULL`;
  if (itUserId) {
    await sql`UPDATE town_players SET is_it = true, tag_started_at = NOW() WHERE user_id = ${itUserId}`;
  }
}

export async function getActiveTownPlayers(partyId?: string | null) {
  await ensureTownTable();
  const rows = partyId
    ? await sql`
        SELECT t.user_id, t.username,
          COALESCE(NULLIF(u.avatar_url, ''), NULLIF(t.avatar_url, ''), '') AS avatar_url,
          t.x, t.y, t.direction, t.chat_msg, t.chat_at,
          t.is_it, t.tag_started_at, t.coins, t.equipped_item, t.frog_until, t.last_effect,
          COALESCE(a.equipped_slots, '{}'::jsonb) AS equipped_slots
        FROM town_players t
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN player_adventure_stats a ON a.user_id = t.user_id
        WHERE t.party_id = ${partyId} AND t.last_seen > NOW() - INTERVAL '3 minutes'
        ORDER BY t.username
      `
    : await sql`
        SELECT t.user_id, t.username,
          COALESCE(NULLIF(u.avatar_url, ''), NULLIF(t.avatar_url, ''), '') AS avatar_url,
          t.x, t.y, t.direction, t.chat_msg, t.chat_at,
          t.is_it, t.tag_started_at, t.coins, t.equipped_item, t.frog_until, t.last_effect,
          COALESCE(a.equipped_slots, '{}'::jsonb) AS equipped_slots
        FROM town_players t
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN player_adventure_stats a ON a.user_id = t.user_id
        WHERE t.last_seen > NOW() - INTERVAL '3 minutes'
        ORDER BY t.username
      `;
  return rows;
}

export async function leaveTown(userId: string) {
  // Expire the player from the active list without deleting the row.
  // Deleting would wipe coins (DEFAULT 100 on next INSERT). Setting last_seen
  // to a past timestamp removes them from the 12-second active window while
  // preserving their coin balance and equipped item for the next session.
  await sql`
    UPDATE town_players
    SET last_seen = NOW() - INTERVAL '1 hour'
    WHERE user_id = ${userId}
  `.catch(() => {});
}

export async function buyTownItem(userId: string, emoji: string, price: number) {
  await ensureTownTable();
  const result = await sql`
    UPDATE town_players
    SET coins = coins - ${price}, equipped_item = ${emoji}
    WHERE user_id = ${userId} AND coins >= ${price}
    RETURNING coins
  `;
  if (result.length === 0) return { ok: false, error: "Not enough coins" };
  return { ok: true, coins: Number(result[0].coins), equipped: emoji };
}

export async function giveTownItem(fromId: string, toId: string) {
  await ensureTownTable();
  const rows = await sql`SELECT equipped_item FROM town_players WHERE user_id = ${fromId}`;
  const item = rows[0]?.equipped_item;
  if (!item) return { ok: false, error: "Nothing equipped to give" };
  await sql`UPDATE town_players SET equipped_item = NULL WHERE user_id = ${fromId}`;
  await sql`UPDATE town_players SET equipped_item = ${item} WHERE user_id = ${toId}`;
  return { ok: true, item };
}

export async function unequipTownItem(userId: string) {
  await ensureTownTable();
  await sql`UPDATE town_players SET equipped_item = NULL WHERE user_id = ${userId}`;
}

export async function earnTownCoins(userId: string, amount: number) {
  await ensureTownTable();
  const result = await sql`
    UPDATE town_players SET coins = coins + ${Math.max(0, amount)}
    WHERE user_id = ${userId}
    RETURNING coins
  `;
  if (result.length === 0) return { ok: false };
  return { ok: true, coins: Number(result[0].coins) };
}

export async function spendTownCoins(userId: string, amount: number) {
  await ensureTownTable();
  const result = await sql`
    UPDATE town_players SET coins = coins - ${Math.max(0, amount)}
    WHERE user_id = ${userId} AND coins >= ${Math.max(0, amount)}
    RETURNING coins
  `;
  if (result.length === 0) return { ok: false, error: "Not enough coins" };
  return { ok: true, coins: Number(result[0].coins) };
}

export async function getTownPlayerCoins(userId: string): Promise<number> {
  await ensureTownTable();
  const rows = await sql`SELECT coins FROM town_players WHERE user_id = ${userId}`;
  return Number(rows[0]?.coins ?? 0);
}

export async function setTownEquippedDisplay(userId: string, emoji: string | null) {
  await ensureTownTable();
  await sql`UPDATE town_players SET equipped_item = ${emoji} WHERE user_id = ${userId}`.catch(() => {});
}

// ── RPS (Rock Paper Scissors) ─────────────────────────────────────────────────

let _rpsTableReady = false;
async function ensureRpsTable() {
  if (_rpsTableReady) return; _rpsTableReady = true;
  await sql`
    CREATE TABLE IF NOT EXISTS rps_games (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      challenger_id TEXT NOT NULL,
      challenger_name TEXT NOT NULL,
      opponent_id TEXT NOT NULL,
      opponent_name TEXT NOT NULL,
      challenger_choice TEXT DEFAULT NULL,
      opponent_choice TEXT DEFAULT NULL,
      status TEXT DEFAULT 'pending',
      winner_id TEXT DEFAULT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

function resolveRps(c: string, o: string, cId: string, oId: string): string | null {
  if (c === o) return null;
  if ((c === "rock" && o === "scissors") || (c === "scissors" && o === "paper") || (c === "paper" && o === "rock")) return cId;
  return oId;
}

export async function challengeRps(challengerId: string, challengerName: string, opponentId: string, opponentName: string) {
  await ensureRpsTable();
  await sql`DELETE FROM rps_games WHERE (challenger_id = ${challengerId} OR opponent_id = ${challengerId}) AND status != 'done'`;
  const rows = await sql`
    INSERT INTO rps_games (challenger_id, challenger_name, opponent_id, opponent_name)
    VALUES (${challengerId}, ${challengerName}, ${opponentId}, ${opponentName})
    RETURNING id
  `;
  return rows[0].id as string;
}

export async function acceptRps(gameId: string, opponentId: string) {
  await ensureRpsTable();
  await sql`UPDATE rps_games SET status = 'choosing' WHERE id = ${gameId} AND opponent_id = ${opponentId} AND status = 'pending'`;
}

export async function declineRps(gameId: string) {
  await ensureRpsTable();
  await sql`DELETE FROM rps_games WHERE id = ${gameId}`;
}

export async function chooseRps(gameId: string, userId: string, choice: string) {
  await ensureRpsTable();
  const games = await sql`SELECT * FROM rps_games WHERE id = ${gameId} AND status = 'choosing'`;
  if (!games.length) return null;
  const game = games[0];
  if (game.challenger_id === userId) {
    await sql`UPDATE rps_games SET challenger_choice = ${choice} WHERE id = ${gameId}`;
  } else if (game.opponent_id === userId) {
    await sql`UPDATE rps_games SET opponent_choice = ${choice} WHERE id = ${gameId}`;
  } else return null;

  const updated = await sql`SELECT * FROM rps_games WHERE id = ${gameId}`;
  const g = updated[0];
  if (g.challenger_choice && g.opponent_choice) {
    const winnerId = resolveRps(String(g.challenger_choice), String(g.opponent_choice), String(g.challenger_id), String(g.opponent_id));
    await sql`UPDATE rps_games SET status = 'done', winner_id = ${winnerId ?? ""} WHERE id = ${gameId}`;
    return { ...g, status: "done", winner_id: winnerId ?? "" };
  }
  return g;
}

export async function getActiveRpsGame(userId: string) {
  await ensureRpsTable();
  const rows = await sql`
    SELECT * FROM rps_games
    WHERE (challenger_id = ${userId} OR opponent_id = ${userId})
      AND created_at > NOW() - INTERVAL '90 seconds'
    ORDER BY created_at DESC LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function cleanupExpiredRps() {
  await sql`DELETE FROM rps_games WHERE created_at < NOW() - INTERVAL '3 minutes'`;
}

// ─── Adventure System ─────────────────────────────────────────────────────────

let _adventureTablesReady = false;
async function ensureAdventureTables() {
  if (_adventureTablesReady) return; _adventureTablesReady = true;
  await sql`
    CREATE TABLE IF NOT EXISTS player_adventure_stats (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      class TEXT DEFAULT NULL,
      level INTEGER DEFAULT 1,
      xp INTEGER DEFAULT 0,
      hp INTEGER DEFAULT 100,
      max_hp INTEGER DEFAULT 100,
      base_attack INTEGER DEFAULT 10,
      inventory JSONB DEFAULT '[]',
      equipped_item_id TEXT DEFAULT NULL,
      wins INTEGER DEFAULT 0,
      quests_completed INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `.catch(() => {});
  await sql`
    CREATE TABLE IF NOT EXISTS adventure_sessions (
      id TEXT PRIMARY KEY,
      host_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      mission_key TEXT NOT NULL,
      mission_data JSONB NOT NULL,
      state JSONB DEFAULT '{}',
      team_user_ids TEXT[] DEFAULT '{}',
      team_stats JSONB DEFAULT '{}',
      status TEXT DEFAULT 'recruiting',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `.catch(() => {});
}

export async function getOrCreateAdventureStats(userId: string) {
  await ensureAdventureTables();
  const rows = await sql`
    INSERT INTO player_adventure_stats (user_id)
    VALUES (${userId})
    ON CONFLICT (user_id) DO UPDATE SET updated_at = updated_at
    RETURNING *
  `.catch(async () => {
    // Fallback: just select if insert/upsert fails
    return sql`SELECT * FROM player_adventure_stats WHERE user_id = ${userId}`.catch(() => []);
  });
  return rows[0];
}

export async function updateAdventureStats(userId: string, patch: Record<string, unknown>) {
  await ensureAdventureTables();
  const allowed = ['class','level','xp','hp','max_hp','base_attack','inventory','equipped_item_id','wins','quests_completed'];
  const keys = Object.keys(patch).filter(k => allowed.includes(k));
  if (!keys.length) return;
  // Build dynamic update via individual columns
  let q = sql`UPDATE player_adventure_stats SET updated_at = NOW()`;
  if (patch.class !== undefined) await sql`UPDATE player_adventure_stats SET class = ${patch.class as string}, updated_at = NOW() WHERE user_id = ${userId}`;
  if (patch.level !== undefined) await sql`UPDATE player_adventure_stats SET level = ${patch.level as number}, updated_at = NOW() WHERE user_id = ${userId}`;
  if (patch.xp !== undefined) await sql`UPDATE player_adventure_stats SET xp = ${patch.xp as number}, updated_at = NOW() WHERE user_id = ${userId}`;
  if (patch.hp !== undefined) await sql`UPDATE player_adventure_stats SET hp = ${patch.hp as number}, updated_at = NOW() WHERE user_id = ${userId}`;
  if (patch.max_hp !== undefined) await sql`UPDATE player_adventure_stats SET max_hp = ${patch.max_hp as number}, updated_at = NOW() WHERE user_id = ${userId}`;
  if (patch.base_attack !== undefined) await sql`UPDATE player_adventure_stats SET base_attack = ${patch.base_attack as number}, updated_at = NOW() WHERE user_id = ${userId}`;
  if (patch.inventory !== undefined) await sql`UPDATE player_adventure_stats SET inventory = ${JSON.stringify(patch.inventory)}::jsonb, updated_at = NOW() WHERE user_id = ${userId}`;
  if (patch.equipped_item_id !== undefined) await sql`UPDATE player_adventure_stats SET equipped_item_id = ${patch.equipped_item_id as string | null}, updated_at = NOW() WHERE user_id = ${userId}`;
  if (patch.wins !== undefined) await sql`UPDATE player_adventure_stats SET wins = wins + ${patch.wins as number}, updated_at = NOW() WHERE user_id = ${userId}`;
  if (patch.quests_completed !== undefined) await sql`UPDATE player_adventure_stats SET quests_completed = quests_completed + 1, updated_at = NOW() WHERE user_id = ${userId}`;
  void q; void keys;
}

export async function createAdventureSession(hostId: string, id: string, missionKey: string, missionData: unknown) {
  await ensureAdventureTables();
  const rows = await sql`
    INSERT INTO adventure_sessions (id, host_user_id, mission_key, mission_data, team_user_ids, status)
    VALUES (${id}, ${hostId}, ${missionKey}, ${JSON.stringify(missionData)}::jsonb, ARRAY[${hostId}], 'recruiting')
    RETURNING *
  `;
  return rows[0];
}

export async function getAdventureSession(id: string) {
  await ensureAdventureTables();
  const rows = await sql`SELECT * FROM adventure_sessions WHERE id = ${id}`;
  return rows[0] ?? null;
}

export async function joinAdventureSession(sessionId: string, userId: string) {
  await ensureAdventureTables();
  await sql`
    UPDATE adventure_sessions
    SET team_user_ids = array_append(team_user_ids, ${userId}),
        updated_at = NOW()
    WHERE id = ${sessionId} AND NOT (${userId} = ANY(team_user_ids))
  `;
}

export async function updateAdventureState(sessionId: string, state: unknown, teamStats?: unknown, status?: string) {
  await ensureAdventureTables();
  if (status) {
    await sql`
      UPDATE adventure_sessions
      SET state = ${JSON.stringify(state)}::jsonb,
          team_stats = ${JSON.stringify(teamStats ?? {})}::jsonb,
          status = ${status},
          updated_at = NOW()
      WHERE id = ${sessionId}
    `;
  } else {
    await sql`
      UPDATE adventure_sessions
      SET state = ${JSON.stringify(state)}::jsonb,
          team_stats = ${JSON.stringify(teamStats ?? {})}::jsonb,
          updated_at = NOW()
      WHERE id = ${sessionId}
    `;
  }
}

export async function getActiveSessionForUser(userId: string) {
  await ensureAdventureTables();
  const rows = await sql`
    SELECT * FROM adventure_sessions
    WHERE ${userId} = ANY(team_user_ids)
      AND status IN ('recruiting','active')
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

// ── Party Invite System ────────────────────────────────────────────────────────

let _partyTableReady = false;
async function ensurePartyTable() {
  if (_partyTableReady) return;
  _partyTableReady = true;
  await sql`
    CREATE TABLE IF NOT EXISTS party_invites (
      id TEXT PRIMARY KEY,
      from_user_id TEXT NOT NULL,
      from_username TEXT NOT NULL,
      to_user_id TEXT NOT NULL,
      session_id TEXT,
      mission_key TEXT,
      mission_data JSONB,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `.catch(() => {});
  // Clean up old invites
  await sql`DELETE FROM party_invites WHERE created_at < NOW() - INTERVAL '5 minutes'`.catch(() => {});
}

export async function createPartyInvite(
  fromUserId: string, fromUsername: string, toUserId: string,
  sessionId: string, missionKey: string, missionData: unknown
) {
  await ensurePartyTable();
  const id = `party_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  await sql`
    INSERT INTO party_invites (id, from_user_id, from_username, to_user_id, session_id, mission_key, mission_data, status)
    VALUES (${id}, ${fromUserId}, ${fromUsername}, ${toUserId}, ${sessionId}, ${missionKey}, ${JSON.stringify(missionData)}::jsonb, 'pending')
  `.catch(() => {});
  return id;
}

export async function getPendingPartyInvite(toUserId: string) {
  await ensurePartyTable();
  const rows = await sql`
    SELECT * FROM party_invites
    WHERE to_user_id = ${toUserId} AND status = 'pending'
      AND created_at > NOW() - INTERVAL '2 minutes'
    ORDER BY created_at DESC LIMIT 1
  `.catch(() => []);
  return rows[0] ?? null;
}

export async function updatePartyInviteStatus(id: string, status: "accepted" | "declined") {
  await ensurePartyTable();
  await sql`UPDATE party_invites SET status = ${status} WHERE id = ${id}`.catch(() => {});
}

/** Get or create the shared daily cave session (up to 8 players). */
export async function getOrCreateCaveSession(): Promise<{ id: string; team_user_ids: string[] }> {
  await ensureAdventureTables();
  // Daily cave session key — resets at midnight UTC
  const dayKey = Math.floor(Date.now() / 86400000);
  const sessionId = `cave_${dayKey}`;
  const rows = await sql`SELECT id, team_user_ids FROM adventure_sessions WHERE id = ${sessionId}`;
  if (rows[0]) return rows[0] as { id: string; team_user_ids: string[] };
  // Create the daily cave session
  await sql`
    INSERT INTO adventure_sessions (id, host_user_id, mission_key, mission_data, team_user_ids, status)
    VALUES (
      ${sessionId},
      'system',
      'cave',
      ${{ name: "South Cave", description: "Wild monsters lurk in the depths.", theme: "cave", emoji: "🕳️", palette: { bg: "#0a0d1a", accent: "#44aaff", floor: "#12162e" }, rooms: [] }}::jsonb,
      '{}',
      'active'
    )
    ON CONFLICT (id) DO NOTHING
  `.catch(() => {});
  const r2 = await sql`SELECT id, team_user_ids FROM adventure_sessions WHERE id = ${sessionId}`;
  return (r2[0] ?? { id: sessionId, team_user_ids: [] }) as { id: string; team_user_ids: string[] };
}

export async function joinCaveSession(sessionId: string, userId: string) {
  await ensureAdventureTables();
  await sql`
    UPDATE adventure_sessions
    SET team_user_ids = CASE
      WHEN array_length(team_user_ids, 1) < 8 AND NOT (${userId} = ANY(team_user_ids))
        THEN array_append(team_user_ids, ${userId})
      ELSE team_user_ids
    END,
    updated_at = NOW()
    WHERE id = ${sessionId}
  `.catch(() => {});
}

export async function leaveCaveSession(sessionId: string, userId: string) {
  await ensureAdventureTables();
  await sql`
    UPDATE adventure_sessions
    SET team_user_ids = array_remove(team_user_ids, ${userId}), updated_at = NOW()
    WHERE id = ${sessionId}
  `.catch(() => {});
}

/** Get team members of a session with their town player data for display */
export async function getSessionTeamData(sessionId: string) {
  await ensureAdventureTables();
  const rows = await sql`
    SELECT a.team_user_ids,
      COALESCE(json_agg(json_build_object(
        'user_id', u.id, 'username', u.username, 'avatar_url', u.avatar_url,
        'level', s.level, 'hp', s.hp, 'max_hp', s.max_hp, 'class', s.class
      ) ORDER BY u.username) FILTER (WHERE u.id IS NOT NULL), '[]') AS members
    FROM adventure_sessions a
    LEFT JOIN unnest(a.team_user_ids) AS uid ON TRUE
    LEFT JOIN users u ON u.id = uid
    LEFT JOIN player_adventure_stats s ON s.user_id = u.id
    WHERE a.id = ${sessionId}
    GROUP BY a.team_user_ids
  `.catch(() => []);
  return rows[0] ?? { team_user_ids: [], members: [] };
}

// ── USER PRIVILEGES ──────────────────────────────────────────────────────────

let _privilegesTableReady = false;
async function ensurePrivilegesTable() {
  if (_privilegesTableReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS user_privileges (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      snes_access BOOLEAN DEFAULT FALSE,
      can_post BOOLEAN DEFAULT TRUE,
      can_comment BOOLEAN DEFAULT TRUE,
      can_voice BOOLEAN DEFAULT TRUE,
      site_ban_until TIMESTAMP DEFAULT NULL,
      updated_by TEXT DEFAULT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `.catch(() => {});
  // Backfill all existing users with snes_access=TRUE (they had it before this system)
  await sql`
    INSERT INTO user_privileges (user_id, snes_access)
    SELECT id, TRUE FROM users
    WHERE id NOT IN (SELECT user_id FROM user_privileges)
  `.catch(() => {});
  _privilegesTableReady = true;
}

export async function getPrivileges(userId: string) {
  await ensurePrivilegesTable();
  const rows = await sql`SELECT * FROM user_privileges WHERE user_id = ${userId}`;
  if (rows[0]) return rows[0] as { user_id: string; snes_access: boolean; can_post: boolean; can_comment: boolean; can_voice: boolean; site_ban_until: string | null; updated_by: string | null; updated_at: string };
  // No row = return safe defaults (existing user who missed backfill)
  return { user_id: userId, snes_access: true, can_post: true, can_comment: true, can_voice: true, site_ban_until: null, updated_by: null, updated_at: new Date().toISOString() };
}

export async function upsertPrivileges(userId: string, patch: {
  snes_access?: boolean;
  can_post?: boolean;
  can_comment?: boolean;
  can_voice?: boolean;
  site_ban_until?: string | null;
}, updatedBy: string) {
  await ensurePrivilegesTable();
  const current = await getPrivileges(userId);
  const snes_access = patch.snes_access !== undefined ? patch.snes_access : current.snes_access;
  const can_post = patch.can_post !== undefined ? patch.can_post : current.can_post;
  const can_comment = patch.can_comment !== undefined ? patch.can_comment : current.can_comment;
  const can_voice = patch.can_voice !== undefined ? patch.can_voice : current.can_voice;
  const site_ban_until = 'site_ban_until' in patch ? (patch.site_ban_until ?? null) : (current.site_ban_until ?? null);
  await sql`
    INSERT INTO user_privileges (user_id, snes_access, can_post, can_comment, can_voice, site_ban_until, updated_by, updated_at)
    VALUES (${userId}, ${snes_access}, ${can_post}, ${can_comment}, ${can_voice}, ${site_ban_until}, ${updatedBy}, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      snes_access = ${snes_access},
      can_post = ${can_post},
      can_comment = ${can_comment},
      can_voice = ${can_voice},
      site_ban_until = ${site_ban_until},
      updated_by = ${updatedBy},
      updated_at = NOW()
  `;
}

// ── NPC Memory ────────────────────────────────────────────────────────────────
let _npcMemoryTableReady = false;
async function ensureNpcMemoryTable() {
  if (_npcMemoryTableReady) return; _npcMemoryTableReady = true;
  await sql`
    CREATE TABLE IF NOT EXISTS npc_memory (
      user_id TEXT NOT NULL,
      npc_id TEXT NOT NULL,
      summary TEXT DEFAULT '',
      updated_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (user_id, npc_id)
    )
  `.catch(() => {});
}

export async function getNpcMemory(userId: string, npcId: string) {
  await ensureNpcMemoryTable();
  const rows = await sql`SELECT * FROM npc_memory WHERE user_id = ${userId} AND npc_id = ${npcId}`;
  return rows[0] ?? null;
}

export async function upsertNpcMemory(userId: string, npcId: string, summary: string) {
  await ensureNpcMemoryTable();
  await sql`
    INSERT INTO npc_memory (user_id, npc_id, summary, updated_at)
    VALUES (${userId}, ${npcId}, ${summary}, NOW())
    ON CONFLICT (user_id, npc_id) DO UPDATE SET summary = ${summary}, updated_at = NOW()
  `;
}

// ── AI Usage Rate Limiting ────────────────────────────────────────────────────

const MODERATORS_LIST = ["mclevesque"];

// Per-day limits: [regular, moderator]
const AI_LIMITS: Record<string, [number, number]> = {
  npc:     [20, 60],
  fortune: [5,  20],
  music:   [3,  10],
  banner:  [3,  10],
};

let _aiUsageTableReady = false;
async function ensureAiUsageTable() {
  if (_aiUsageTableReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS user_ai_usage (
      user_id   TEXT NOT NULL,
      date      DATE NOT NULL DEFAULT CURRENT_DATE,
      npc       INTEGER DEFAULT 0,
      fortune   INTEGER DEFAULT 0,
      music     INTEGER DEFAULT 0,
      banner    INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, date)
    )
  `.catch(() => {});
  _aiUsageTableReady = true;
}

/**
 * Check if user is within daily AI limit for a given type, and increment if so.
 * Returns { allowed: true } or { allowed: false, limit: N }.
 */
export async function checkAndIncrementAiUsage(
  userId: string,
  username: string,
  type: "npc" | "fortune" | "music" | "banner"
): Promise<{ allowed: boolean; limit: number; used: number }> {
  await ensureAiUsageTable();
  const isMod = MODERATORS_LIST.includes(username.toLowerCase());
  const [regularLimit, modLimit] = AI_LIMITS[type];
  const limit = isMod ? modLimit : regularLimit;

  // Ensure row exists for today
  await sql`
    INSERT INTO user_ai_usage (user_id, date)
    VALUES (${userId}, CURRENT_DATE)
    ON CONFLICT (user_id, date) DO NOTHING
  `.catch(() => {});

  // Read current count using per-type query (avoids dynamic column names)
  let rows: Record<string, unknown>[] = [];
  if (type === "npc")     rows = await sql`SELECT npc     AS count FROM user_ai_usage WHERE user_id = ${userId} AND date = CURRENT_DATE`;
  if (type === "fortune") rows = await sql`SELECT fortune AS count FROM user_ai_usage WHERE user_id = ${userId} AND date = CURRENT_DATE`;
  if (type === "music")   rows = await sql`SELECT music   AS count FROM user_ai_usage WHERE user_id = ${userId} AND date = CURRENT_DATE`;
  if (type === "banner")  rows = await sql`SELECT banner  AS count FROM user_ai_usage WHERE user_id = ${userId} AND date = CURRENT_DATE`;

  const used = Number(rows[0]?.count ?? 0);
  if (used >= limit) return { allowed: false, limit, used };

  // Increment the correct column
  if (type === "npc")     await sql`UPDATE user_ai_usage SET npc     = npc     + 1 WHERE user_id = ${userId} AND date = CURRENT_DATE`.catch(() => {});
  if (type === "fortune") await sql`UPDATE user_ai_usage SET fortune = fortune + 1 WHERE user_id = ${userId} AND date = CURRENT_DATE`.catch(() => {});
  if (type === "music")   await sql`UPDATE user_ai_usage SET music   = music   + 1 WHERE user_id = ${userId} AND date = CURRENT_DATE`.catch(() => {});
  if (type === "banner")  await sql`UPDATE user_ai_usage SET banner  = banner  + 1 WHERE user_id = ${userId} AND date = CURRENT_DATE`.catch(() => {});

  return { allowed: true, limit, used: used + 1 };
}

// ── Idle Room Cleanup ─────────────────────────────────────────────────────────

/** Close poker rooms idle for more than 20 minutes */
export async function cleanupIdlePokerRooms() {
  await sql`
    UPDATE poker_rooms SET status = 'closed', updated_at = NOW()
    WHERE status NOT IN ('closed','completed')
      AND updated_at < NOW() - INTERVAL '20 minutes'
  `.catch(() => {});
}

/** Close watch rooms with no heartbeat for more than 30 minutes */
export async function cleanupIdleWatchRooms() {
  await sql`
    UPDATE watch_rooms SET status = 'closed', updated_at = NOW()
    WHERE status != 'closed'
      AND updated_at < NOW() - INTERVAL '30 minutes'
  `.catch(() => {});
}

/** Close voice rooms with no heartbeat for more than 15 minutes */
export async function cleanupIdleVoiceRooms() {
  await sql`
    UPDATE voice_rooms SET status = 'closed', updated_at = NOW()
    WHERE status != 'closed'
      AND updated_at < NOW() - INTERVAL '15 minutes'
  `.catch(() => {});
}

/** Close draw rooms with no activity for more than 2 hours */
export async function cleanupIdleDrawRooms() {
  await sql`
    DELETE FROM draw_rooms
    WHERE updated_at < NOW() - INTERVAL '2 hours'
  `.catch(() => {});
}

// ── Town Expansion: Stash, Equipment, Ground Items, Events, Storyline ─────────

let _expansionTablesReady = false;

export async function ensureExpansionTables() {
  if (_expansionTablesReady) return;

  // Extend player_adventure_stats with new columns
  await sql`ALTER TABLE player_adventure_stats ADD COLUMN IF NOT EXISTS equipped_slots JSONB DEFAULT '{}'`.catch(() => {});
  await sql`ALTER TABLE player_adventure_stats ADD COLUMN IF NOT EXISTS stash_items JSONB DEFAULT '[]'`.catch(() => {});

  // Add frog_until to town_players
  await sql`ALTER TABLE town_players ADD COLUMN IF NOT EXISTS frog_until TIMESTAMPTZ DEFAULT NULL`.catch(() => {});
  // last_effect — short-lived visual event broadcast to all players via poll
  await sql`ALTER TABLE town_players ADD COLUMN IF NOT EXISTS last_effect JSONB DEFAULT NULL`.catch(() => {});

  // Ground items — auto-expire after 10 minutes
  await sql`
    CREATE TABLE IF NOT EXISTS town_ground_items (
      id TEXT PRIMARY KEY,
      item JSONB NOT NULL,
      x INTEGER NOT NULL,
      y INTEGER NOT NULL,
      dropped_by TEXT,
      dropped_at TIMESTAMPTZ DEFAULT NOW()
    )
  `.catch(() => {});

  // Town events
  await sql`
    CREATE TABLE IF NOT EXISTS town_events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      state JSONB DEFAULT '{}',
      status TEXT DEFAULT 'active',
      started_at TIMESTAMPTZ DEFAULT NOW(),
      ended_at TIMESTAMPTZ,
      outcome TEXT
    )
  `.catch(() => {});

  // Town storyline
  await sql`
    CREATE TABLE IF NOT EXISTS town_storyline (
      id SERIAL PRIMARY KEY,
      chapter INTEGER NOT NULL,
      content TEXT NOT NULL,
      share_id TEXT,
      posted_at TIMESTAMPTZ DEFAULT NOW()
    )
  `.catch(() => {});

  // Town theater
  await sql`
    CREATE TABLE IF NOT EXISTS town_theater (
      id TEXT PRIMARY KEY DEFAULT 'main',
      video_url TEXT,
      started_at BIGINT,
      host_id TEXT,
      seats JSONB DEFAULT '{}',
      is_paused BOOLEAN DEFAULT false,
      paused_at BIGINT,
      screenshare_offer JSONB
    )
  `.catch(() => {});
  await sql`INSERT INTO town_theater (id) VALUES ('main') ON CONFLICT DO NOTHING`.catch(() => {});
  await sql`ALTER TABLE town_theater ADD COLUMN IF NOT EXISTS host_id TEXT`.catch(() => {});
  await sql`ALTER TABLE town_theater ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT false`.catch(() => {});
  await sql`ALTER TABLE town_theater ADD COLUMN IF NOT EXISTS paused_at BIGINT`.catch(() => {});
  await sql`ALTER TABLE town_theater ADD COLUMN IF NOT EXISTS screenshare_offer JSONB`.catch(() => {});
  await sql`ALTER TABLE town_theater ADD COLUMN IF NOT EXISTS jukebox_url TEXT`.catch(() => {});
  await sql`ALTER TABLE town_theater ADD COLUMN IF NOT EXISTS jukebox_started_at BIGINT`.catch(() => {});
  await sql`ALTER TABLE town_theater ADD COLUMN IF NOT EXISTS jukebox_by TEXT`.catch(() => {});

  // Theater chat
  await sql`
    CREATE TABLE IF NOT EXISTS town_theater_chat (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      avatar_url TEXT,
      message TEXT NOT NULL,
      created_at BIGINT NOT NULL
    )
  `.catch(() => {});
  await sql`
    CREATE INDEX IF NOT EXISTS idx_theater_chat_created ON town_theater_chat (created_at DESC)
  `.catch(() => {});

  // Theater screenshare signaling — host answers per viewer
  await sql`
    CREATE TABLE IF NOT EXISTS town_theater_screenshare (
      viewer_id TEXT PRIMARY KEY,
      answer JSONB,
      updated_at BIGINT
    )
  `.catch(() => {});
  // Viewer offers (viewer-initiated WebRTC)
  await sql`
    CREATE TABLE IF NOT EXISTS town_theater_viewer_offers (
      viewer_id TEXT PRIMARY KEY,
      offer JSONB,
      updated_at BIGINT
    )
  `.catch(() => {});

  // Town parties (friend squads)
  await sql`
    CREATE TABLE IF NOT EXISTS town_parties (
      id TEXT PRIMARY KEY,
      leader_id TEXT NOT NULL,
      leader_name TEXT NOT NULL,
      leader_avatar TEXT DEFAULT '',
      members JSONB DEFAULT '[]',
      max_size INT DEFAULT 10,
      created_at BIGINT NOT NULL
    )
  `.catch(() => {});
  // Clean stale parties (older than 3 hours with no activity) on each cold start
  await sql`DELETE FROM town_parties WHERE created_at < ${Date.now() - 3 * 60 * 60 * 1000}`.catch(() => {});

  _expansionTablesReady = true;

  // Grant legendary items (once per cold start)
  await grantLegendaryItems().catch(() => {});
  // Seed initial storyline if empty
  await ensureInitialStoryline().catch(() => {});
}

const FROG_WAND = {
  id: "legendary_frog_wand",
  name: "Cursed Frog Wand",
  emoji: "🐸",
  rarity: "legendary",
  slot: "weapon",
  effects: [{ type: "special_power", value: 99 }],
  ability: "frog_hex",
  obtained: "Gift of the Kingdom",
  no_drop: true,
  no_sell: true,
};

const TELEPORT_BOOTS = {
  id: "legendary_teleport_boots",
  name: "Enchanted Teleport Boots",
  emoji: "👢✨",
  rarity: "legendary",
  slot: "boots",
  effects: [{ type: "hp_boost", value: 20 }],
  ability: "teleport",
  obtained: "Gift of the Kingdom",
  no_drop: true,
  no_sell: true,
  charges: 2,
};

async function grantLegendaryItems() {
  // Idempotent — JSONB check prevents duplicates, no in-memory flag needed

  // Grant frog wand to mclevesque
  const mclRows = await sql`SELECT id FROM users WHERE LOWER(username) = 'mclevesque' LIMIT 1`.catch(() => []);
  if (mclRows[0]) {
    const userId = mclRows[0].id as string;
    const statsRows = await sql`SELECT stash_items FROM player_adventure_stats WHERE user_id = ${userId}`.catch(() => []);
    if (statsRows[0]) {
      const stash = (statsRows[0].stash_items as unknown[]) ?? [];
      const alreadyHas = stash.some((i: unknown) => (i as { id: string }).id === FROG_WAND.id);
      if (!alreadyHas) {
        const newStash = [...stash, FROG_WAND];
        await sql`UPDATE player_adventure_stats SET stash_items = ${JSON.stringify(newStash)}::jsonb WHERE user_id = ${userId}`.catch(() => {});
      }
      // Also ensure it's equipped in the secondary slot
      await sql`
        UPDATE player_adventure_stats
        SET equipped_slots = jsonb_set(COALESCE(equipped_slots, '{}'), '{secondary}', ${JSON.stringify(FROG_WAND)}::jsonb)
        WHERE user_id = ${userId}
        AND (equipped_slots->>'secondary' IS NULL OR equipped_slots->'secondary'->>'id' != 'legendary_frog_wand')
      `.catch(() => {});
    } else {
      // Create stats row first
      await sql`INSERT INTO player_adventure_stats (user_id, stash_items) VALUES (${userId}, ${JSON.stringify([FROG_WAND])}::jsonb) ON CONFLICT (user_id) DO UPDATE SET stash_items = CASE WHEN NOT (player_adventure_stats.stash_items @> '[{"id":"legendary_frog_wand"}]'::jsonb) THEN player_adventure_stats.stash_items || ${JSON.stringify([FROG_WAND])}::jsonb ELSE player_adventure_stats.stash_items END`.catch(() => {});
      // Equip frog wand to secondary slot
      await sql`
        UPDATE player_adventure_stats
        SET equipped_slots = jsonb_set(COALESCE(equipped_slots, '{}'), '{secondary}', ${JSON.stringify(FROG_WAND)}::jsonb)
        WHERE user_id = ${userId}
        AND (equipped_slots->>'secondary' IS NULL OR equipped_slots->'secondary'->>'id' != 'legendary_frog_wand')
      `.catch(() => {});
    }
  }

  // Grant teleport boots to tinybeat (search by username pattern)
  const beataRows = await sql`SELECT id FROM users WHERE LOWER(username) LIKE '%tinybeat%' ORDER BY created_at ASC LIMIT 1`.catch(() => []);
  if (beataRows[0]) {
    const userId = beataRows[0].id as string;
    const statsRows = await sql`SELECT stash_items FROM player_adventure_stats WHERE user_id = ${userId}`.catch(() => []);
    if (statsRows[0]) {
      const stash = (statsRows[0].stash_items as unknown[]) ?? [];
      const alreadyHas = stash.some((i: unknown) => (i as { id: string }).id === TELEPORT_BOOTS.id);
      if (!alreadyHas) {
        const newStash = [...stash, TELEPORT_BOOTS];
        await sql`UPDATE player_adventure_stats SET stash_items = ${JSON.stringify(newStash)}::jsonb WHERE user_id = ${userId}`.catch(() => {});
      }
    } else {
      await sql`INSERT INTO player_adventure_stats (user_id, stash_items) VALUES (${userId}, ${JSON.stringify([TELEPORT_BOOTS])}::jsonb) ON CONFLICT (user_id) DO UPDATE SET stash_items = CASE WHEN NOT (player_adventure_stats.stash_items @> '[{"id":"legendary_teleport_boots"}]'::jsonb) THEN player_adventure_stats.stash_items || ${JSON.stringify([TELEPORT_BOOTS])}::jsonb ELSE player_adventure_stats.stash_items END`.catch(() => {});
    }
  }
}

// ── Stash & Equipment ─────────────────────────────────────────────────────────

export async function getPlayerStashAndSlots(userId: string) {
  // IMPORTANT: create the base table + row FIRST so the ALTER TABLE in
  // ensureExpansionTables() has an existing table to modify.
  await getOrCreateAdventureStats(userId);
  await ensureExpansionTables();
  const rows = await sql`
    SELECT stash_items, equipped_slots, inventory, level
    FROM player_adventure_stats WHERE user_id = ${userId}
  `.catch(() => [] as Record<string, unknown>[]);
  if (!rows[0]) return { stash_items: [], equipped_slots: {}, inventory: [], level: 1 };
  return {
    stash_items: (rows[0].stash_items as unknown[]) ?? [],
    equipped_slots: (rows[0].equipped_slots as Record<string, unknown>) ?? {},
    inventory: (rows[0].inventory as unknown[]) ?? [],
    level: Number(rows[0].level ?? 1),
  };
}

export async function updatePlayerStashAndSlots(
  userId: string,
  patch: { stash_items?: unknown[]; equipped_slots?: Record<string, unknown>; inventory?: unknown[] }
) {
  await ensureExpansionTables();
  if (patch.stash_items !== undefined) {
    await sql`UPDATE player_adventure_stats SET stash_items = ${JSON.stringify(patch.stash_items)}::jsonb, updated_at = NOW() WHERE user_id = ${userId}`.catch(() => {});
  }
  if (patch.equipped_slots !== undefined) {
    await sql`UPDATE player_adventure_stats SET equipped_slots = ${JSON.stringify(patch.equipped_slots)}::jsonb, updated_at = NOW() WHERE user_id = ${userId}`.catch(() => {});
  }
  if (patch.inventory !== undefined) {
    await sql`UPDATE player_adventure_stats SET inventory = ${JSON.stringify(patch.inventory)}::jsonb, updated_at = NOW() WHERE user_id = ${userId}`.catch(() => {});
  }
}

// ── Frog Hex ──────────────────────────────────────────────────────────────────

export async function setFrogHex(userIds: string[], durationSeconds = 12) {
  await ensureExpansionTables();
  for (const uid of userIds) {
    await sql`
      UPDATE town_players SET frog_until = NOW() + (${durationSeconds} || ' seconds')::INTERVAL
      WHERE user_id = ${uid}
    `.catch(() => {});
  }
}

// ── Last Effect — short-lived visual broadcast via poll ───────────────────────
// Stores a transient effect (gift, etc.) on a player row so all pollers see it.
// Clients only show effects < 8s old and track shown ones by "userId_at" key.
export async function setPlayerLastEffect(userId: string, effect: { type: string; emoji: string; from: string; fromId: string; at: number }) {
  await sql`
    UPDATE town_players SET last_effect = ${JSON.stringify(effect)}::jsonb WHERE user_id = ${userId}
  `.catch(() => {});
}

// ── Town Events ───────────────────────────────────────────────────────────────

const EVENT_TYPES = ["dragon_attack", "bandit_raid", "merchant_visit", "festival"] as const;
type EventType = typeof EVENT_TYPES[number];

const EVENT_DURATIONS: Record<EventType, number> = {
  dragon_attack: 8 * 60 * 1000,
  bandit_raid: 4 * 60 * 1000,
  merchant_visit: 8 * 60 * 1000,
  festival: 10 * 60 * 1000,
};

const EVENT_INITIAL_STATE: Record<EventType, Record<string, unknown>> = {
  dragon_attack: { bossHp: 1500, bossMaxHp: 1500, participants: {}, npcLastAttacks: {}, phase: "awakening" },
  bandit_raid: { bossHp: 600, bossMaxHp: 600, coins_stolen: 0, defenders: [], location: "the Village" },
  merchant_visit: { stock_sold: [] },
  festival: { xp_multiplier: 1.5 },
};

export async function getActiveEvent() {
  await ensureExpansionTables();
  const rows = await sql`
    SELECT * FROM town_events
    WHERE status = 'active' AND started_at > NOW() - INTERVAL '15 minutes'
    ORDER BY started_at DESC LIMIT 1
  `;
  return (rows[0] ?? null) as Record<string, unknown> | null;
}

export async function createTownEvent(type: string, state: unknown) {
  await ensureExpansionTables();
  const id = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const rows = await sql`
    INSERT INTO town_events (id, type, state)
    VALUES (${id}, ${type}, ${JSON.stringify(state)}::jsonb)
    RETURNING *
  `;
  return rows[0];
}

export async function updateEventState(eventId: string, state: unknown) {
  await ensureExpansionTables();
  await sql`UPDATE town_events SET state = ${JSON.stringify(state)}::jsonb WHERE id = ${eventId}`;
}

export async function completeEvent(eventId: string, outcome: string) {
  await ensureExpansionTables();
  await sql`
    UPDATE town_events
    SET status = 'completed', ended_at = NOW(), outcome = ${outcome}
    WHERE id = ${eventId}
  `;
}

// ── Event Loot (boosted rarity: ~20% more epics/legendaries) ────────────────

const EVENT_RARITY_WEIGHTS = [20, 25, 27, 18, 10]; // com/unc/rare/epic/leg
const EVENT_RARITY_NAMES = ["common", "uncommon", "rare", "epic", "legendary"] as const;

function generateEventItem(playerLevel: number, seed: number, index: number): Record<string, unknown> {
  const rng = seededRng(seed * (index + 1) * 31337 % 2147483647);
  const rarityIdx = pickWeighted([...EVENT_RARITY_WEIGHTS], rng);
  const rarity = EVENT_RARITY_NAMES[rarityIdx];
  const slots = ["weapon", "helm", "secondary", "boots"] as const;
  const slot = slots[Math.floor(rng() * slots.length)];
  const pool = ITEM_POOLS[slot];
  const name = pool[Math.floor(rng() * pool.length)];
  const eventPrefixes = ["Dragon-Slayer", "Inferno", "Ashen", "Ember", "Scorched", "Brave", "Dragonbane"];
  const prefix = eventPrefixes[Math.floor(rng() * eventPrefixes.length)];
  const [minVal, maxVal] = (RARITY_RANGES as Record<string, [number, number]>)[rarity] ?? [1, 5];
  const levelBonus = Math.floor((Math.max(1, playerLevel) - 1) * 1.5); // 3× more growth than before
  const val = Math.floor(rng() * (maxVal - minVal + 1)) + minVal + levelBonus;
  return {
    id: `evtloot_${Date.now()}_${seed}_${index}_${Math.random().toString(36).slice(2, 6)}`,
    name: `${prefix} ${name}`,
    emoji: ITEM_EMOJIS[slot],
    rarity,
    slot,
    effects: [{ type: slot === "weapon" ? "attack_boost" : "hp_boost", value: val }],
    obtained: "Dragon Defeated",
  };
}

export async function awardEventLootToAll(
  participants: Record<string, { damage: number; name: string }>,
  playerLevel = 5
): Promise<Record<string, unknown[]>> {
  const seed = Math.floor(Date.now() / 1000);
  const lootMap: Record<string, unknown[]> = {};
  for (const [uid, info] of Object.entries(participants)) {
    const count = info.damage >= 300 ? 3 : info.damage >= 100 ? 2 : 1;
    const items = Array.from({ length: count }, (_, i) =>
      generateEventItem(playerLevel, seed + uid.charCodeAt(0) * 13 + i * 77, i)
    );
    lootMap[uid] = items;
    try {
      const current = await getPlayerStashAndSlots(uid);
      const newStash = [...(current.stash_items ?? []), ...items].slice(0, 20);
      await updatePlayerStashAndSlots(uid, { stash_items: newStash });
    } catch { /* non-critical */ }
  }
  return lootMap;
}

export async function getRecentlyCompletedEvent(): Promise<Record<string, unknown> | null> {
  await ensureExpansionTables();
  const rows = await sql`
    SELECT * FROM town_events
    WHERE status = 'completed' AND ended_at > NOW() - INTERVAL '90 seconds'
    ORDER BY ended_at DESC LIMIT 1
  `;
  return (rows[0] ?? null) as Record<string, unknown> | null;
}

/** Deterministic event trigger based on 30-minute epoch slots. Safe for serverless. */
export async function checkAndTriggerTownEvent(): Promise<Record<string, unknown> | null> {
  await ensureExpansionTables();

  // Check for existing active event
  const active = await getActiveEvent();
  if (active) {
    // Check if event has expired by duration
    const startedAt = new Date(active.started_at as string).getTime();
    const eventType = active.type as EventType;
    const duration = EVENT_DURATIONS[eventType] ?? 5 * 60 * 1000;
    if (Date.now() - startedAt > duration) {
      // Auto-complete expired event
      const outcomes: Record<EventType, string> = {
        dragon_attack: "⚔️ The dragon was defeated! The Kingdom of Ryft is safe... for now.",
        bandit_raid: "🗡️ The bandits have been driven off! Town guards restore order.",
        merchant_visit: "🛒 The wandering merchant packed up and departed. Until next time!",
        festival: "🎉 The festival comes to a close. Joy and laughter echo through the streets.",
      };
      await completeEvent(active.id as string, outcomes[eventType] ?? "The event has ended.");
      // Post to SHARE
      await postHeraldShare(
        outcomes[eventType] ?? "A town event has concluded.",
        "⚔️ Town Events"
      ).catch(() => {});
      return null;
    }
    return active;
  }

  // Check last event time
  const lastRows = await sql`SELECT MAX(started_at) AS last FROM town_events`;
  const lastEventTime = lastRows[0]?.last ? new Date(lastRows[0].last as string).getTime() : 0;
  const thirtyMin = 30 * 60 * 1000;
  if (Date.now() - lastEventTime < thirtyMin) return null;

  // Epoch-slot hash for determinism across serverless instances
  const epochSlot = Math.floor(Date.now() / thirtyMin);
  const pseudoRandom = ((epochSlot * 2654435761) % 2147483648) / 2147483648;
  if (pseudoRandom >= 0.25) return null; // ~25% of windows have an event

  // Use a secondary hash so event types aren't strictly sequential (more variety)
  const typeRng = ((epochSlot * 1664525 + 1013904223) % 2147483648) / 2147483648;
  const typeIndex = Math.floor(typeRng * EVENT_TYPES.length);
  const eventType = EVENT_TYPES[typeIndex];
  const initialState = EVENT_INITIAL_STATE[eventType];

  // Try to create (unique constraint on epoch slot prevents duplicates)
  const newEvent = await createTownEvent(eventType, initialState).catch(() => null);
  return newEvent;
}

// ── Storyline ─────────────────────────────────────────────────────────────────

const STORY_TEMPLATES = [
  "The elders of Millhaven whisper that strange lights were seen near the old ruins last night. Elder Mira believes it is a sign that Malachar stirs once more in the Void.",
  "Queen Aelindra has issued a royal decree: adventurers who aid the kingdom shall be rewarded handsomely. Captain Aldric has posted notices at the castle gates.",
  "Court Wizard Lysara detected unusual arcane fluctuations near the eastern forest. She suspects an ancient ward-stone has been disturbed — or destroyed.",
  "Pip the village boy swears he saw a glowing portal near the well in Millhaven. Nobody believes him, but Bessie the innkeeper says her pies keep going missing.",
  "A messenger arrived at Castle Aurvale bearing a sealed letter. The queen's expression darkened as she read it. She has summoned her war council.",
  "Theron the blacksmith has been forging weapons day and night without rest. He says 'something big is coming' but won't say what. His forge light burned all night.",
  "Reports trickle in from travelers: the forest road to the east is no longer safe. Bandits have grown bolder, as if emboldened by some unseen force.",
  "The fountain in the town square ran red for exactly one hour at dawn. Lysara says it was simply iron ore from upstream. Nobody fully believes her.",
  "A wandering bard arrived in town, singing songs of a great hero who would 'rise from the crowd to face the Void.' He left before anyone could ask his name.",
  "Elder Mira had a vision: three keys, three locks, and a door that should never be opened. She has been muttering coordinates in her sleep.",
  "The flowers in the market district bloomed out of season overnight — luminescent and cold to the touch. Botanists are baffled. Lysara is not.",
  "Strange tracks were found near the cave entrance south of town — no animal the hunters recognize. The cave has been sealed by royal order pending investigation.",
  "An old knight arrived at The Crooked Kettle, claiming to have fought alongside Queen Aelindra's father. He ordered pie, stared at nothing for an hour, then left coin and a cryptic warning.",
  "The stars aligned in a formation not seen in three centuries — the same night Malachar was last defeated. The court astrologer locked herself in her tower.",
  "A tremor shook the town square at midnight. No earthquake was felt elsewhere. The cobblestones cracked in the shape of a rune none of the scholars can identify.",
  "Queen Aelindra made a rare public appearance in the town square today. She thanked the adventurers personally, her composure unbroken — but her eyes carried a weight few have seen before.",
  "The village well has begun glowing faintly blue at night. Children dare each other to touch it. Adults pretend not to notice. Pip has touched it three times.",
  "Lysara's monitoring crystals all shattered simultaneously at exactly noon. She reported this to the queen calmly, then went home and baked seven cakes.",
  "A raven with a red ribbon arrived at the castle carrying no message — only a single black feather from a species thought extinct for two hundred years.",
  "The adventurers of Ryft have grown in number and in legend. Even in distant villages, people speak of the brave souls who guard the kingdom's roads and halls.",
];

export async function getLatestStorylines(limit = 3) {
  await ensureExpansionTables();
  const rows = await sql`
    SELECT * FROM town_storyline ORDER BY chapter DESC LIMIT ${limit}
  `;
  return rows;
}

export async function createStorylineChapter(content: string, shareId?: string) {
  await ensureExpansionTables();
  const chapterRows = await sql`SELECT COALESCE(MAX(chapter), 0) AS max_ch FROM town_storyline`;
  const nextChapter = Number(chapterRows[0]?.max_ch ?? 0) + 1;
  const rows = await sql`
    INSERT INTO town_storyline (chapter, content, share_id)
    VALUES (${nextChapter}, ${content}, ${shareId ?? null})
    RETURNING *
  `;
  return rows[0];
}

async function ensureInitialStoryline() {
  await ensureExpansionTables();
  const rows = await sql`SELECT COUNT(*) AS cnt FROM town_storyline`.catch(() => [{ cnt: 1 }]);
  if (Number(rows[0]?.cnt ?? 0) > 0) return;
  // Seed chapter 1
  const content = STORY_TEMPLATES[0];
  await createStorylineChapter(content).catch(() => {});
  await postHeraldShare(content, "📖 The Ryft Gazette — Chapter 1").catch(() => {});
}

/** Force-post the initial Herald storyline chapter (bypasses count check) */
export async function forceInitialHeraldPost(): Promise<string | undefined> {
  await ensureExpansionTables();
  const content = STORY_TEMPLATES[0];
  await createStorylineChapter(content).catch(() => {});
  return postHeraldShare(content, "📖 The Ryft Gazette — Chapter 1").catch(() => undefined);
}

/** Generate next storyline chapter (called by daily cron) */
export async function advanceStoryline(): Promise<string> {
  await ensureExpansionTables();

  // Get last 3 events for context
  const recentEvents = await sql`
    SELECT outcome, type FROM town_events
    WHERE status = 'completed' AND ended_at > NOW() - INTERVAL '7 days'
    ORDER BY ended_at DESC LIMIT 3
  `.catch(() => []);

  const eventContext = recentEvents.length > 0
    ? recentEvents.map((e: Record<string, unknown>) => e.outcome ?? e.type).join(". ")
    : "The kingdom has been peaceful.";

  const lastChapterRows = await sql`SELECT content, chapter FROM town_storyline ORDER BY chapter DESC LIMIT 1`.catch(() => []);
  const lastChapter = lastChapterRows[0];
  const prevContent = lastChapter?.content as string ?? "";
  const chapterNum = Number(lastChapter?.chapter ?? 0) + 1;

  let content = "";

  // Try Groq
  const apiKey = process.env.GROQ_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          max_tokens: 120,
          temperature: 0.85,
          messages: [
            {
              role: "system",
              content: `You are the narrator of the Kingdom of Ryft. Write daily 2-3 sentence story updates posted by the town herald. The story involves ongoing threats from the ancient sorcerer Malachar who was banished (not destroyed) 300 years ago, player adventures, and town happenings at Castle Aurvale and Millhaven village. Keep it serialized, intriguing, and slightly ominous. PG-13.`,
            },
            {
              role: "user",
              content: `Chapter ${chapterNum}. Recent events: ${eventContext}. Previous chapter: "${prevContent.slice(0, 200)}". Continue the story in 2-3 sentences.`,
            },
          ],
        }),
      });
      const data = await res.json() as { choices?: { message?: { content?: string } }[] };
      content = data?.choices?.[0]?.message?.content?.trim() ?? "";
    } catch { /* fall through */ }
  }

  // Fallback: cycle through templates
  if (!content) {
    const idx = (chapterNum - 1) % STORY_TEMPLATES.length;
    content = STORY_TEMPLATES[idx];
  }

  // Post to SHARE and save chapter
  const shareId = await postHeraldShare(content, `📖 The Ryft Gazette — Chapter ${chapterNum}`).catch(() => undefined);
  await createStorylineChapter(content, shareId).catch(() => {});
  return content;
}

const HERALD_USER_ID = "system-herald-reginald";

/**
 * Returns the user_id of the Herald NPC system user.
 * - If `town_herald` username already exists (any id), use that id.
 * - Otherwise INSERT a new row with HERALD_USER_ID.
 * Never tries to update the primary key (which would violate FK constraints).
 */
async function getOrCreateHeraldUserId(): Promise<string | null> {
  // Always look up by username first — avoids PK conflicts on username UNIQUE constraint
  const existing = await sql`SELECT id FROM users WHERE username = 'town_herald' LIMIT 1`.catch(() => []);
  if (existing[0]) return existing[0].id as string;

  // Try to insert; ignore conflict if another concurrent call beat us
  await sql`
    INSERT INTO users (id, username, display_name, avatar_url)
    VALUES (${HERALD_USER_ID}, 'town_herald', '📯 Reginald the Herald', null)
    ON CONFLICT DO NOTHING
  `.catch(() => {});

  // Re-fetch to get whichever id was committed
  const row = await sql`SELECT id FROM users WHERE username = 'town_herald' LIMIT 1`.catch(() => []);
  return row[0] ? (row[0].id as string) : null;
}

/** Post a share as the Herald — attributed to the dedicated system user, NOT any real account */
async function postHeraldShare(content: string, title: string): Promise<string | undefined> {
  const heraldId = await getOrCreateHeraldUserId();
  if (!heraldId) return undefined; // can't post without a valid user
  const shareId = `herald_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  await createShare(shareId, heraldId, "📯 Reginald the Herald", null, "story", title, content, null, null, null).catch(() => {});
  return shareId;
}

// ── Vendor Stock (pure, no DB write) ─────────────────────────────────────────

const ITEM_POOLS = {
  weapon: [
    "Iron Sword", "Steel Dagger", "Oak Staff", "Hunting Bow", "Battle Axe", "Silver Rapier", "Thunder Hammer", "Shadow Blade",
    "Moonblade", "Flame Sword", "Frost Blade", "Thunder Staff", "Trident", "Vine Whip", "Boomerang", "Bone Scythe",
    "Solar Lance", "Tidal Hammer", "Cyclone Spear", "Fungal Club", "Obsidian Cleaver", "Runic Halberd", "Venom Fang",
    "Crystal Staff", "Phantom Blade", "Storm Javelin", "Ember Scythe", "Glacial Mace",
  ],
  helm: [
    "Leather Cap", "Iron Helm", "Wizard Hat", "Scout Hood", "Crown of Thorns", "Feathered Beret", "Iron Coif", "Arcane Circlet",
    "Battle Helm", "Jester Cap", "Star Crown", "Mystic Turban", "Dragon Helm", "Shadow Cowl", "Runic Diadem",
    "Stormcaller Hood", "Ember Crown", "Frost Veil", "Thornwood Wreath", "Obsidian Visor",
  ],
  secondary: [
    "Wooden Shield", "Buckler", "Tome of Arcana", "Quiver of Plenty", "Iron Targe", "Crystal Orb", "Shadow Cloak", "Blessed Charm",
    "Tower Shield", "Lucky Beads", "Star of Power", "Moon Charm", "Lodestone", "Spellbook", "Warding Amulet",
    "Storm Codex", "Blood Phylactery", "Ember Talisman", "Frost Rune", "Voidstone",
  ],
  boots: [
    "Leather Boots", "Iron Greaves", "Silk Slippers", "Scout Sandals", "Storm Treads", "Velvet Shoes", "Chain Boots", "Rune Sandals",
    "Iron Boots", "Starlight Sandals", "Wave Walkers", "Ember Treads", "Shadow Soles", "Thornwood Walkers",
    "Gale Sprinters", "Obsidian Stompers", "Frost Walkers", "Zephyr Kicks",
  ],
};

// Per-slot emoji variety for more visual interest
const WEAPON_EMOJIS = ["⚔️", "🌙", "🔥", "❄️", "⚡", "🔱", "🌿", "🪃", "💀", "☀️", "🌊", "🌪️", "🍄"];
const HELM_EMOJIS = ["🎓", "⛑️", "👑", "🪖", "🎭", "🌟", "🔮", "🐉"];
const SECONDARY_EMOJIS = ["🛡️", "📿", "🔯", "🌙", "💎", "🧲", "📜", "🪬"];
const BOOTS_EMOJIS = ["👢", "🌟", "🌊", "🔥", "✨", "🪄"];

const ITEM_EMOJIS: Record<string, string> = {
  weapon: "⚔️", helm: "🎩", secondary: "🛡️", boots: "👟",
};
const SLOT_EMOJI_POOLS: Record<string, string[]> = {
  weapon: WEAPON_EMOJIS, helm: HELM_EMOJIS, secondary: SECONDARY_EMOJIS, boots: BOOTS_EMOJIS,
};

const RARITIES = ["common", "uncommon", "rare", "epic"] as const;
const RARITY_WEIGHTS = [50, 28, 15, 7]; // probabilities (no legendaries in shop)
const RARITY_COLORS: Record<string, string> = {
  common: "#aaa", uncommon: "#4caf50", rare: "#2196f3", epic: "#9c27b0",
};
const RARITY_PRICES: Record<string, number> = {
  common: 50, uncommon: 120, rare: 280, epic: 600,
};
const RARITY_RANGES: Record<string, [number, number]> = {
  common: [1, 3], uncommon: [4, 6], rare: [7, 9], epic: [10, 14],
};

function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function pickWeighted(weights: number[], rng: () => number) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

function assignItemAbility(itemName: string, rarity: string, rng: () => number): string | null {
  const thresholds: Record<string, number> = { common: 0, uncommon: 0.15, rare: 0.40, epic: 0.85, legendary: 1.0 };
  const threshold = thresholds[rarity] ?? 0;
  if (rng() > threshold) return null;

  const n = itemName.toLowerCase();
  // Name-influenced picks
  if (n.includes("frost") || n.includes("ice") || n.includes("glacial")) return "frost_bolt";
  if (n.includes("storm") || n.includes("thunder") || n.includes("lightning")) return "chain_lightning";
  if (n.includes("shadow") || n.includes("dark") || n.includes("phantom") || n.includes("void")) return "smoke_bomb";
  if (n.includes("blessed") || n.includes("divine") || n.includes("solar") || n.includes("radiant")) return "divine_judgment";
  if (n.includes("rage") || n.includes("berserker") || n.includes("ember") || n.includes("flame") || n.includes("fire")) return "berserker_rage";
  if (n.includes("meteor") || n.includes("moon") || n.includes("star")) return "meteor_strike";
  if (n.includes("poison") || n.includes("venom") || n.includes("fungal")) return "poison_blade";
  if (n.includes("earth") || n.includes("tidal") || n.includes("wave") || n.includes("obsidian")) return "earth_spike";
  if (n.includes("war") || n.includes("banner") || n.includes("runic") || n.includes("rune")) return "war_banner";

  const pools: Record<string, string[]> = {
    uncommon: ["swift_step", "iron_skin", "coin_magnet", "lucky_roll"],
    rare: ["poison_blade", "frost_bolt", "smoke_bomb", "war_banner", "earth_spike", "second_wind"],
    epic: ["meteor_strike", "berserker_rage", "chain_lightning", "vortex", "dark_ritual", "phantasm", "time_warp", "divine_judgment"],
  };
  const pool = pools[rarity] ?? [];
  if (!pool.length) return null;
  return pool[Math.floor(rng() * pool.length)];
}

export function getVendorStock(playerLevel: number, seed: number): unknown[] {
  const rng = seededRng(seed);
  const slots = ["weapon", "helm", "secondary", "boots"];
  return slots.map((slot, i) => {
    const rarityIdx = pickWeighted([...RARITY_WEIGHTS], rng);
    const rarity = RARITIES[rarityIdx];
    const [minVal, maxVal] = RARITY_RANGES[rarity];
    const levelBonus = Math.floor((playerLevel - 1) * 1.5); // 3× more growth than before
    const baseVal = Math.floor(rng() * (maxVal - minVal + 1)) + minVal + levelBonus;
    const pool = ITEM_POOLS[slot as keyof typeof ITEM_POOLS];
    const nameIdx = Math.floor(rng() * pool.length);
    const name = pool[nameIdx];
    const prefixes = ["Ancient", "Cursed", "Radiant", "Shadow", "Storm", "Blessed", "Infernal", "Celestial", "Frostborn", "Molten"];
    const prefix = rarity === "common" ? "" : prefixes[Math.floor(rng() * prefixes.length)] + " ";
    const fullName = prefix + name;
    const emojiPool = SLOT_EMOJI_POOLS[slot] ?? [ITEM_EMOJIS[slot]];
    const emoji = emojiPool[Math.floor(rng() * emojiPool.length)];
    const ability = assignItemAbility(fullName, rarity, rng);
    return {
      id: `vendor_${slot}_${seed}_${i}`,
      name: fullName,
      emoji,
      rarity,
      slot,
      effects: [{ type: slot === "boots" ? "hp_boost" : "attack_boost", value: baseVal }],
      ...(ability ? { ability } : {}),
      obtained: "Town Vendor",
      color: RARITY_COLORS[rarity],
      price: RARITY_PRICES[rarity],
    };
  });
}

// ── Theater ───────────────────────────────────────────────────────────────────

export type TheaterState = {
  videoUrl: string | null;
  startedAt: number | null;
  hostId: string | null;
  seats: Record<string, unknown>;
  isPaused: boolean;
  pausedAt: number | null;
  screenshareOffer: unknown | null;
  jukeboxUrl: string | null;
  jukeboxStartedAt: number | null;
  jukeboxBy: string | null;
};

export async function getTheaterState(partyId?: string | null): Promise<TheaterState | null> {
  await ensureExpansionTables();
  const tid = partyId || 'main';
  // Ensure row exists for this party
  await sql`INSERT INTO town_theater (id) VALUES (${tid}) ON CONFLICT DO NOTHING`.catch(() => {});
  const rows = await sql`SELECT video_url, started_at, host_id, seats, is_paused, paused_at, screenshare_offer, jukebox_url, jukebox_started_at, jukebox_by FROM town_theater WHERE id = ${tid}`.catch(() => []);
  if (!rows[0]) return null;
  return {
    videoUrl: rows[0].video_url as string | null,
    startedAt: rows[0].started_at ? Number(rows[0].started_at) : null,
    hostId: rows[0].host_id as string | null,
    seats: (rows[0].seats as Record<string, unknown>) ?? {},
    isPaused: !!(rows[0].is_paused),
    pausedAt: rows[0].paused_at ? Number(rows[0].paused_at) : null,
    screenshareOffer: rows[0].screenshare_offer ?? null,
    jukeboxUrl: rows[0].jukebox_url as string | null,
    jukeboxStartedAt: rows[0].jukebox_started_at ? Number(rows[0].jukebox_started_at) : null,
    jukeboxBy: rows[0].jukebox_by as string | null,
  };
}

export async function setTheaterVideo(videoUrl: string, startedAt: number, hostId: string, partyId?: string | null) {
  await ensureExpansionTables();
  const tid = partyId || 'main';
  const url = videoUrl || null;
  const ts = startedAt || null;
  const hid = hostId || null;
  await sql`INSERT INTO town_theater (id) VALUES (${tid}) ON CONFLICT DO NOTHING`.catch(() => {});
  await sql`UPDATE town_theater SET video_url = ${url}, started_at = ${ts}, host_id = ${hid}, is_paused = false, paused_at = NULL WHERE id = ${tid}`;
}

export async function pauseTheater(now: number, partyId?: string | null) {
  await ensureExpansionTables();
  const tid = partyId || 'main';
  await sql`UPDATE town_theater SET is_paused = true, paused_at = ${now} WHERE id = ${tid} AND is_paused = false`.catch(() => {});
}

export async function unpauseTheater(now: number, partyId?: string | null) {
  await ensureExpansionTables();
  const tid = partyId || 'main';
  // Adjust started_at by how long it was paused, so elapsed stays accurate
  await sql`
    UPDATE town_theater
    SET is_paused = false,
        started_at = started_at + (${now} - paused_at),
        paused_at = NULL
    WHERE id = ${tid} AND is_paused = true
  `.catch(() => {});
}

export async function seekTheater(newStartedAt: number, partyId?: string | null) {
  await ensureExpansionTables();
  const tid = partyId || 'main';
  await sql`UPDATE town_theater SET started_at = ${newStartedAt}, is_paused = false, paused_at = NULL WHERE id = ${tid}`.catch(() => {});
}

export async function setScreenshareOffer(offer: unknown, partyId?: string | null) {
  await ensureExpansionTables();
  const tid = partyId || 'main';
  const val = offer ? JSON.stringify(offer) : null;
  await sql`UPDATE town_theater SET screenshare_offer = ${val}::jsonb WHERE id = ${tid}`.catch(() => {});
}

export async function setTheaterJukebox(url: string | null, startedAt: number | null, byUsername: string | null, partyId?: string | null) {
  await ensureExpansionTables();
  const tid = partyId || 'main';
  await sql`UPDATE town_theater SET jukebox_url = ${url}, jukebox_started_at = ${startedAt}, jukebox_by = ${byUsername} WHERE id = ${tid}`.catch(() => {});
}

export async function setScreenshareAnswer(viewerId: string, answer: unknown) {
  await ensureExpansionTables();
  const val = JSON.stringify(answer);
  const now = Date.now();
  await sql`
    INSERT INTO town_theater_screenshare (viewer_id, answer, updated_at)
    VALUES (${viewerId}, ${val}::jsonb, ${now})
    ON CONFLICT (viewer_id) DO UPDATE SET answer = ${val}::jsonb, updated_at = ${now}
  `.catch(() => {});
}

export async function getScreenshareAnswer(viewerId: string) {
  await ensureExpansionTables();
  const rows = await sql`SELECT answer FROM town_theater_screenshare WHERE viewer_id = ${viewerId}`.catch(() => []);
  return rows[0]?.answer ?? null;
}

export async function clearScreenshareAnswer(viewerId: string) {
  await ensureExpansionTables();
  await sql`DELETE FROM town_theater_screenshare WHERE viewer_id = ${viewerId}`.catch(() => {});
}

export async function clearAllScreenshareAnswers() {
  await ensureExpansionTables();
  await sql`DELETE FROM town_theater_screenshare`.catch(() => {});
}

// Viewer-initiated WebRTC: viewers post their offers, host answers each one
export async function setViewerOffer(viewerId: string, offer: unknown) {
  await ensureExpansionTables();
  const val = JSON.stringify(offer);
  const now = Date.now();
  await sql`
    INSERT INTO town_theater_viewer_offers (viewer_id, offer, updated_at)
    VALUES (${viewerId}, ${val}::jsonb, ${now})
    ON CONFLICT (viewer_id) DO UPDATE SET offer = ${val}::jsonb, updated_at = ${now}
  `.catch(() => {});
}

export async function getAllViewerOffers(): Promise<Array<{ viewerId: string; offer: unknown }>> {
  await ensureExpansionTables();
  const rows = await sql`SELECT viewer_id, offer FROM town_theater_viewer_offers ORDER BY updated_at ASC`.catch(() => []);
  return rows.map(r => ({ viewerId: r.viewer_id as string, offer: r.offer }));
}

export async function clearViewerOffer(viewerId: string) {
  await ensureExpansionTables();
  await sql`DELETE FROM town_theater_viewer_offers WHERE viewer_id = ${viewerId}`.catch(() => {});
}

export async function clearAllViewerOffers() {
  await ensureExpansionTables();
  await sql`DELETE FROM town_theater_viewer_offers`.catch(() => {});
  await sql`DELETE FROM town_theater_screenshare`.catch(() => {});
}

export async function addTheaterChat(userId: string, username: string, avatarUrl: string, message: string, partyId?: string | null) {
  await ensureExpansionTables();
  // Ensure party_id column exists
  await sql`ALTER TABLE town_theater_chat ADD COLUMN IF NOT EXISTS party_id TEXT DEFAULT NULL`.catch(() => {});
  const trimmed = message.slice(0, 300);
  const now = Date.now();
  const pid = partyId || null;
  await sql`INSERT INTO town_theater_chat (user_id, username, avatar_url, message, created_at, party_id) VALUES (${userId}, ${username}, ${avatarUrl}, ${trimmed}, ${now}, ${pid})`.catch(() => {});
  // Keep only last 200 messages per party
  await sql`DELETE FROM town_theater_chat WHERE party_id IS NOT DISTINCT FROM ${pid} AND id NOT IN (SELECT id FROM town_theater_chat WHERE party_id IS NOT DISTINCT FROM ${pid} ORDER BY created_at DESC LIMIT 200)`.catch(() => {});
}

export async function getTheaterChat(partyId?: string | null, since?: number): Promise<Array<{ userId: string; username: string; avatarUrl: string; message: string; createdAt: number }>> {
  await ensureExpansionTables();
  await sql`ALTER TABLE town_theater_chat ADD COLUMN IF NOT EXISTS party_id TEXT DEFAULT NULL`.catch(() => {});
  const pid = partyId || null;
  // Only return messages from the last 3 hours (no stale chat from previous sessions)
  const cutoff = Date.now() - 3 * 60 * 60 * 1000;
  const effectiveSince = Math.max(since ?? 0, cutoff);
  const rows = await sql`
    SELECT user_id, username, avatar_url, message, created_at
    FROM town_theater_chat
    WHERE party_id IS NOT DISTINCT FROM ${pid}
      AND created_at > ${effectiveSince}
    ORDER BY created_at ASC
    LIMIT 80
  `.catch(() => []);
  return rows.map((r) => ({
    userId: r.user_id as string,
    username: r.username as string,
    avatarUrl: r.avatar_url as string,
    message: r.message as string,
    createdAt: Number(r.created_at),
  }));
}

export async function setTheaterSeat(seatIdx: number, userId: string, username: string, partyId?: string | null) {
  await ensureExpansionTables();
  const tid = partyId || 'main';
  await sql`
    UPDATE town_theater
    SET seats = jsonb_set(COALESCE(seats, '{}'), ${`{${seatIdx}}`}, ${JSON.stringify({ userId, username })}::jsonb)
    WHERE id = ${tid}
  `.catch(() => {});
}

export async function clearTheaterSeat(userId: string, partyId?: string | null) {
  await ensureExpansionTables();
  const tid = partyId || 'main';
  // Remove all seats belonging to this user
  const rows = await sql`SELECT seats FROM town_theater WHERE id = ${tid}`.catch(() => []);
  if (!rows[0]) return;
  const seats = (rows[0].seats as Record<string, { userId: string }>) ?? {};
  const newSeats: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(seats)) {
    if (v?.userId !== userId) newSeats[k] = v;
  }
  await sql`UPDATE town_theater SET seats = ${JSON.stringify(newSeats)}::jsonb WHERE id = ${tid}`.catch(() => {});
}

/** Hard-reset the theater: clear video, seats, screenshare state. Called when closing/resetting theater. */
export async function clearTheaterAll(partyId?: string | null): Promise<void> {
  await ensureExpansionTables();
  const tid = partyId || 'main';
  await sql`
    UPDATE town_theater
    SET video_url = '', started_at = 0, host_id = '',
        seats = '{}'::jsonb, is_paused = false, paused_at = 0,
        screenshare_offer = NULL
    WHERE id = ${tid}
  `.catch(() => {});
  await sql`DELETE FROM town_theater_viewer_offers WHERE true`.catch(() => {});
}


// ─── Party System ────────────────────────────────────────────────────────────

export interface PartyMember {
  userId: string;
  username: string;
  avatarUrl: string;
  isLeader: boolean;
}

export interface Party {
  id: string;
  leaderId: string;
  leaderName: string;
  leaderAvatar: string;
  members: PartyMember[];
  maxSize: number;
  createdAt: number;
}

export async function createParty(leaderId: string, leaderName: string, leaderAvatar: string): Promise<Party> {
  await ensureExpansionTables();
  // Enforce one-party-at-a-time: remove user from any existing party (as leader or member) first
  await leaveParty(leaderId).catch(() => {});
  const id = `party_${leaderId}_${Date.now()}`;
  const members: PartyMember[] = [{ userId: leaderId, username: leaderName, avatarUrl: leaderAvatar, isLeader: true }];
  await sql`
    INSERT INTO town_parties (id, leader_id, leader_name, leader_avatar, members, max_size, created_at)
    VALUES (${id}, ${leaderId}, ${leaderName}, ${leaderAvatar}, ${JSON.stringify(members)}::jsonb, 10, ${Date.now()})
  `;
  return { id, leaderId, leaderName, leaderAvatar, members, maxSize: 10, createdAt: Date.now() };
}

export async function joinParty(partyId: string, userId: string, username: string, avatarUrl: string): Promise<{ ok: boolean; error?: string }> {
  await ensureExpansionTables();
  // Retry SELECT — Neon free tier can silently timeout on first call
  let rows = await sql`SELECT * FROM town_parties WHERE id = ${partyId}`.catch(() => []);
  if (!rows[0]) rows = await sql`SELECT * FROM town_parties WHERE id = ${partyId}`.catch(() => []);
  if (!rows[0]) return { ok: false, error: "Party not found" };
  const party = rows[0];
  let members: PartyMember[] = (party.members as PartyMember[]) ?? [];
  // Deduplicate members by userId (fixes ghost accumulation from browser crashes / reconnects)
  const seen = new Set<string>();
  members = members.filter(m => { if (seen.has(m.userId)) return false; seen.add(m.userId); return true; });
  if (members.find((m) => m.userId === userId)) {
    // Already in party — just update the deduped list and return
    await sql`UPDATE town_parties SET members = ${JSON.stringify(members)}::jsonb WHERE id = ${partyId}`;
    return { ok: true };
  }
  if (members.length >= Number(party.max_size)) return { ok: false, error: "Party is full" };
  await leaveParty(userId);
  const newMembers = [...members, { userId, username, avatarUrl, isLeader: false }];
  await sql`UPDATE town_parties SET members = ${JSON.stringify(newMembers)}::jsonb WHERE id = ${partyId}`.catch(() => {});
  return { ok: true };
}

export async function leaveParty(userId: string): Promise<void> {
  await ensureExpansionTables();
  const leaderRow = await sql`SELECT * FROM town_parties WHERE leader_id = ${userId}`.catch(() => []);
  if (leaderRow[0]) {
    const members: PartyMember[] = (leaderRow[0].members as PartyMember[]) ?? [];
    const others = members.filter((m) => m.userId !== userId);
    if (others.length === 0) {
      await sql`DELETE FROM town_parties WHERE id = ${leaderRow[0].id as string}`.catch(() => {});
    } else {
      const next = others[0];
      const newMembers = [{ ...next, isLeader: true }, ...others.slice(1)];
      await sql`
        UPDATE town_parties
        SET leader_id = ${next.userId}, leader_name = ${next.username}, leader_avatar = ${next.avatarUrl},
            members = ${JSON.stringify(newMembers)}::jsonb
        WHERE id = ${leaderRow[0].id as string}
      `.catch(() => {});
    }
    return;
  }
  await sql`
    UPDATE town_parties
    SET members = (
      SELECT COALESCE(jsonb_agg(m), '[]'::jsonb) FROM jsonb_array_elements(members) m
      WHERE m->>'userId' != ${userId}
    )
    WHERE members @> ${JSON.stringify([{ userId }])}::jsonb
  `.catch(() => {});
}

export async function getPartyForUser(userId: string): Promise<Party | null> {
  await ensureExpansionTables();
  const rows = await sql`
    SELECT * FROM town_parties
    WHERE leader_id = ${userId}
       OR members @> ${JSON.stringify([{ userId }])}::jsonb
    LIMIT 1
  `.catch(() => []);
  if (!rows[0]) return null;
  // Deduplicate members — fixes ghost accumulation from browser crashes / reconnects
  let members: PartyMember[] = (rows[0].members as PartyMember[]) ?? [];
  const seen = new Set<string>();
  const deduped = members.filter(m => { if (seen.has(m.userId)) return false; seen.add(m.userId); return true; });
  // Auto-repair if ghosts were found
  if (deduped.length !== members.length) {
    await sql`UPDATE town_parties SET members = ${JSON.stringify(deduped)}::jsonb WHERE id = ${rows[0].id as string}`.catch(() => {});
    members = deduped;
  }
  // Refresh avatars from users table so they're always current
  if (members.length > 0) {
    const memberIds = members.map(m => m.userId);
    const userRows = await sql`SELECT id, username, avatar_url FROM users WHERE id = ANY(${memberIds}::text[])`.catch(() => []);
    const userMap = new Map(userRows.map((u) => [u.id as string, { id: u.id as string, username: u.username as string, avatar_url: u.avatar_url as string | null }]));
    let changed = false;
    members = members.map(m => {
      const fresh = userMap.get(m.userId);
      if (fresh && (fresh.avatar_url !== m.avatarUrl || fresh.username !== m.username)) {
        changed = true;
        return { ...m, username: fresh.username, avatarUrl: fresh.avatar_url ?? m.avatarUrl };
      }
      return m;
    });
    if (changed) {
      await sql`UPDATE town_parties SET members = ${JSON.stringify(members)}::jsonb WHERE id = ${rows[0].id as string}`.catch(() => {});
    }
  }
  return {
    id: rows[0].id as string,
    leaderId: rows[0].leader_id as string,
    leaderName: rows[0].leader_name as string,
    leaderAvatar: rows[0].leader_avatar as string,
    members,
    maxSize: Number(rows[0].max_size),
    createdAt: Number(rows[0].created_at),
  };
}

/**
 * Lightweight party lookup — skips avatar refresh and ensureExpansionTables.
 * Tries leader_id first (fast primary key), then member JSONB scan as fallback.
 * Use instead of getPartyForUser when Neon is timing out.
 */
export async function getPartyQuick(userId: string): Promise<Party | null> {
  // 1. Try leader lookup first (cheapest — index on leader_id)
  let rows = await sql`
    SELECT id, leader_id, leader_name, leader_avatar, members, max_size, created_at
    FROM town_parties WHERE leader_id = ${userId} LIMIT 1
  `.catch(() => []);
  // 2. Fall back to member JSONB scan (covers non-leaders)
  if (!rows[0]) {
    rows = await sql`
      SELECT id, leader_id, leader_name, leader_avatar, members, max_size, created_at
      FROM town_parties WHERE members @> ${JSON.stringify([{ userId }])}::jsonb LIMIT 1
    `.catch(() => []);
  }
  if (!rows[0]) return null;
  const members: PartyMember[] = Array.isArray(rows[0].members) ? (rows[0].members as PartyMember[]) : [];
  return {
    id: rows[0].id as string,
    leaderId: rows[0].leader_id as string,
    leaderName: rows[0].leader_name as string,
    leaderAvatar: rows[0].leader_avatar as string,
    members,
    maxSize: Number(rows[0].max_size),
    createdAt: Number(rows[0].created_at),
  };
}
/** @deprecated use getPartyQuick */
export const getPartyByLeader = getPartyQuick;

export async function getFriendParties(userId: string): Promise<Party[]> {
  await ensureExpansionTables();
  const friendRows = await sql`
    SELECT CASE WHEN requester_id = ${userId} THEN addressee_id ELSE requester_id END AS friend_id
    FROM friendships
    WHERE (requester_id = ${userId} OR addressee_id = ${userId}) AND status = 'accepted'
  `.catch(() => []);
  const friendIds = friendRows.map((r) => r.friend_id as string);
  if (friendIds.length === 0) return [];
  const rows = await sql`
    SELECT * FROM town_parties
    WHERE leader_id = ANY(${friendIds}::text[])
    ORDER BY created_at DESC
    LIMIT 20
  `.catch(() => []);
  return rows.map((r) => ({
    id: r.id as string,
    leaderId: r.leader_id as string,
    leaderName: r.leader_name as string,
    leaderAvatar: r.leader_avatar as string,
    members: (r.members as PartyMember[]) ?? [],
    maxSize: Number(r.max_size),
    createdAt: Number(r.created_at),
  }));
}

export async function disbandParty(partyId: string): Promise<void> {
  await ensureExpansionTables();
  await sql`DELETE FROM town_parties WHERE id = ${partyId}`.catch(() => {});
}

export async function transferLead(partyId: string, newLeaderId: string, newLeaderName: string, newLeaderAvatar: string): Promise<void> {
  await ensureExpansionTables();
  const rows = await sql`SELECT members FROM town_parties WHERE id = ${partyId}`.catch(() => []);
  if (!rows[0]) return;
  const members: PartyMember[] = (rows[0].members as PartyMember[]) ?? [];
  const newMembers = members.map((m) => ({ ...m, isLeader: m.userId === newLeaderId }));
  await sql`
    UPDATE town_parties
    SET leader_id = ${newLeaderId}, leader_name = ${newLeaderName}, leader_avatar = ${newLeaderAvatar},
        members = ${JSON.stringify(newMembers)}::jsonb
    WHERE id = ${partyId}
  `.catch(() => {});
}

// ── Pong Multiplayer ───────────────────────────────────────────────────────────

let _pongTablesReady = false;
async function ensurePongTables() {
  if (_pongTablesReady) return; _pongTablesReady = true;
  await sql`
    CREATE TABLE IF NOT EXISTS pong_rooms (
      id TEXT PRIMARY KEY,
      host_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      opponent_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      host_username TEXT NOT NULL,
      opponent_username TEXT,
      status TEXT DEFAULT 'waiting',
      countdown_at BIGINT,
      ball_x REAL DEFAULT 400,
      ball_y REAL DEFAULT 250,
      ball_vx REAL DEFAULT 4,
      ball_vy REAL DEFAULT 3,
      host_paddle REAL DEFAULT 205,
      opp_paddle REAL DEFAULT 205,
      host_score INTEGER DEFAULT 0,
      opp_score INTEGER DEFAULT 0,
      winner_id TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `.catch(() => {});
  await sql`
    CREATE TABLE IF NOT EXISTS pong_elo (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      username TEXT NOT NULL,
      avatar_url TEXT,
      elo INTEGER DEFAULT 1200,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `.catch(() => {});
}

export async function createPongRoom(id: string, hostId: string, hostUsername: string) {
  await ensurePongTables();
  const rows = await sql`
    INSERT INTO pong_rooms (id, host_id, host_username)
    VALUES (${id}, ${hostId}, ${hostUsername})
    RETURNING *
  `;
  return rows[0];
}

export async function getPongRoom(id: string) {
  await ensurePongTables();
  const rows = await sql`SELECT * FROM pong_rooms WHERE id = ${id}`;
  return rows[0] ?? null;
}

export async function joinPongRoom(id: string, opponentId: string, opponentUsername: string) {
  await ensurePongTables();
  const now = Date.now();
  const rows = await sql`
    UPDATE pong_rooms
    SET opponent_id = ${opponentId}, opponent_username = ${opponentUsername},
        status = 'countdown', countdown_at = ${now}, updated_at = NOW()
    WHERE id = ${id} AND status = 'waiting' AND host_id != ${opponentId}
    RETURNING *
  `;
  return rows[0] ?? null;
}

export async function updatePongRoom(id: string, patch: {
  status?: string;
  ballX?: number; ballY?: number; ballVX?: number; ballVY?: number;
  hostPaddle?: number; oppPaddle?: number;
  hostScore?: number; oppScore?: number;
  winnerId?: string;
}) {
  await ensurePongTables();
  const sets: string[] = ["updated_at = NOW()"];
  if (patch.status !== undefined) sets.push(`status = '${patch.status.replace(/'/g, "")}'`);
  if (patch.ballX !== undefined) sets.push(`ball_x = ${patch.ballX}`);
  if (patch.ballY !== undefined) sets.push(`ball_y = ${patch.ballY}`);
  if (patch.ballVX !== undefined) sets.push(`ball_vx = ${patch.ballVX}`);
  if (patch.ballVY !== undefined) sets.push(`ball_vy = ${patch.ballVY}`);
  if (patch.hostPaddle !== undefined) sets.push(`host_paddle = ${patch.hostPaddle}`);
  if (patch.oppPaddle !== undefined) sets.push(`opp_paddle = ${patch.oppPaddle}`);
  if (patch.hostScore !== undefined) sets.push(`host_score = ${patch.hostScore}`);
  if (patch.oppScore !== undefined) sets.push(`opp_score = ${patch.oppScore}`);
  if (patch.winnerId !== undefined) sets.push(`winner_id = '${patch.winnerId.replace(/'/g, "")}'`);
  const idsStr = id.replace(/'/g, "");
  await sql`UPDATE pong_rooms SET updated_at = NOW() WHERE id = ${id}`.catch(() => {});
  // Use parameterized updates for safety
  if (patch.status !== undefined) await sql`UPDATE pong_rooms SET status = ${patch.status} WHERE id = ${id}`.catch(() => {});
  if (patch.ballX !== undefined) await sql`UPDATE pong_rooms SET ball_x = ${patch.ballX}, ball_y = ${patch.ballY ?? 250}, ball_vx = ${patch.ballVX ?? 4}, ball_vy = ${patch.ballVY ?? 3} WHERE id = ${id}`.catch(() => {});
  if (patch.hostPaddle !== undefined) await sql`UPDATE pong_rooms SET host_paddle = ${patch.hostPaddle} WHERE id = ${id}`.catch(() => {});
  if (patch.oppPaddle !== undefined) await sql`UPDATE pong_rooms SET opp_paddle = ${patch.oppPaddle} WHERE id = ${id}`.catch(() => {});
  if (patch.hostScore !== undefined) await sql`UPDATE pong_rooms SET host_score = ${patch.hostScore}, opp_score = ${patch.oppScore ?? 0} WHERE id = ${id}`.catch(() => {});
  if (patch.winnerId !== undefined) await sql`UPDATE pong_rooms SET winner_id = ${patch.winnerId}, status = 'finished' WHERE id = ${id}`.catch(() => {});
  void sets; void idsStr; // silence unused warnings
}

export async function getPongElo(userId: string): Promise<{ elo: number; wins: number; losses: number }> {
  await ensurePongTables();
  const rows = await sql`SELECT elo, wins, losses FROM pong_elo WHERE user_id = ${userId}`;
  return (rows[0] as { elo: number; wins: number; losses: number }) ?? { elo: 1200, wins: 0, losses: 0 };
}

export async function updatePongElo(winnerId: string, winnerUsername: string, loserId: string, loserUsername: string) {
  await ensurePongTables();
  const [wRow, lRow] = await Promise.all([
    sql`SELECT elo, wins FROM pong_elo WHERE user_id = ${winnerId}`,
    sql`SELECT elo, losses FROM pong_elo WHERE user_id = ${loserId}`,
  ]);
  const wElo = (wRow[0]?.elo as number) ?? 1200;
  const wWins = ((wRow[0]?.wins as number) ?? 0) + 1;
  const lElo = (lRow[0]?.elo as number) ?? 1200;
  const lLosses = ((lRow[0]?.losses as number) ?? 0) + 1;
  const K = 32;
  const expW = 1 / (1 + Math.pow(10, (lElo - wElo) / 400));
  const expL = 1 - expW;
  const newWElo = Math.max(100, Math.round(wElo + K * (1 - expW)));
  const newLElo = Math.max(100, Math.round(lElo + K * (0 - expL)));
  await sql`
    INSERT INTO pong_elo (user_id, username, elo, wins, losses)
    VALUES (${winnerId}, ${winnerUsername}, ${newWElo}, ${wWins}, 0)
    ON CONFLICT (user_id) DO UPDATE SET elo = ${newWElo}, wins = ${wWins}, username = ${winnerUsername}, updated_at = NOW()
  `.catch(() => {});
  await sql`
    INSERT INTO pong_elo (user_id, username, elo, wins, losses)
    VALUES (${loserId}, ${loserUsername}, ${newLElo}, 0, ${lLosses})
    ON CONFLICT (user_id) DO UPDATE SET elo = ${newLElo}, losses = ${lLosses}, username = ${loserUsername}, updated_at = NOW()
  `.catch(() => {});
  return { winnerNewElo: newWElo, loserNewElo: newLElo, eloGain: newWElo - wElo };
}

export async function getPongLeaderboard() {
  await ensurePongTables();
  return sql`SELECT user_id, username, avatar_url, elo, wins, losses FROM pong_elo ORDER BY elo DESC LIMIT 20`;
}

export async function cleanupStalePongRooms() {
  await sql`
    DELETE FROM pong_rooms
    WHERE updated_at < NOW() - INTERVAL '30 minutes' AND status != 'playing'
  `.catch(() => {});
  await sql`
    DELETE FROM pong_rooms
    WHERE updated_at < NOW() - INTERVAL '2 hours'
  `.catch(() => {});
}

// ── Chronicle ──────────────────────────────────────────────────────────────────

export async function ensureChronicleTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS chronicle_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      username TEXT NOT NULL,
      avatar_url TEXT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      mood TEXT,
      visibility TEXT DEFAULT 'friends',
      likes_count INTEGER DEFAULT 0,
      comments_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `.catch(() => {});
  await sql`
    CREATE TABLE IF NOT EXISTS chronicle_likes (
      entry_id TEXT REFERENCES chronicle_entries(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (entry_id, user_id)
    )
  `.catch(() => {});
  await sql`
    CREATE TABLE IF NOT EXISTS chronicle_comments (
      id SERIAL PRIMARY KEY,
      entry_id TEXT REFERENCES chronicle_entries(id) ON DELETE CASCADE,
      author_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      username TEXT NOT NULL,
      avatar_url TEXT,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `.catch(() => {});
}

export async function createChronicleEntry(
  id: string, userId: string, username: string, avatarUrl: string | null,
  title: string, body: string, mood: string | null, visibility: string
) {
  await ensureChronicleTable();
  const rows = await sql`
    INSERT INTO chronicle_entries (id, user_id, username, avatar_url, title, body, mood, visibility)
    VALUES (${id}, ${userId}, ${username}, ${avatarUrl}, ${title}, ${body}, ${mood}, ${visibility})
    RETURNING *
  `;
  return rows[0];
}

export async function getChronicleEntry(id: string, viewerId?: string | null) {
  await ensureChronicleTable();
  const rows = await sql`SELECT * FROM chronicle_entries WHERE id = ${id}`;
  if (!rows[0]) return null;
  if (!viewerId) return { ...rows[0], user_liked: false };
  const liked = await sql`SELECT 1 FROM chronicle_likes WHERE entry_id = ${id} AND user_id = ${viewerId}`;
  return { ...rows[0], user_liked: (liked as unknown[]).length > 0 };
}

export async function getChronicleEntries(
  viewerId: string | null,
  opts: { userId?: string; limit?: number; offset?: number } = {}
) {
  await ensureChronicleTable();
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;
  if (opts.userId) {
    // Profile view — show own entries, or public/friends for others
    if (opts.userId === viewerId) {
      return sql`
        SELECT ce.*, CASE WHEN EXISTS(
          SELECT 1 FROM chronicle_likes WHERE entry_id = ce.id AND user_id = ${viewerId}
        ) THEN true ELSE false END AS user_liked
        FROM chronicle_entries ce
        WHERE ce.user_id = ${opts.userId}
        ORDER BY ce.created_at DESC LIMIT ${limit} OFFSET ${offset}
      `;
    }
    return sql`
      SELECT ce.*, false AS user_liked
      FROM chronicle_entries ce
      WHERE ce.user_id = ${opts.userId}
        AND ce.visibility = 'public'
      ORDER BY ce.created_at DESC LIMIT ${limit} OFFSET ${offset}
    `;
  }
  // Main feed — own entries + friends' non-private entries
  if (viewerId) {
    return sql`
      SELECT ce.*, CASE WHEN EXISTS(
        SELECT 1 FROM chronicle_likes WHERE entry_id = ce.id AND user_id = ${viewerId}
      ) THEN true ELSE false END AS user_liked
      FROM chronicle_entries ce
      WHERE ce.user_id = ${viewerId}
         OR (
           ce.visibility != 'private'
           AND (
             ce.visibility = 'public'
             OR EXISTS (
               SELECT 1 FROM friendships
               WHERE status = 'accepted'
                 AND ((requester_id = ${viewerId} AND addressee_id = ce.user_id)
                   OR (addressee_id = ${viewerId} AND requester_id = ce.user_id))
             )
           )
         )
      ORDER BY ce.created_at DESC LIMIT ${limit} OFFSET ${offset}
    `;
  }
  return sql`
    SELECT ce.*, false AS user_liked FROM chronicle_entries ce
    WHERE ce.visibility = 'public'
    ORDER BY ce.created_at DESC LIMIT ${limit} OFFSET ${offset}
  `;
}

export async function updateChronicleEntry(
  id: string, userId: string,
  patch: { title?: string; body?: string; mood?: string | null; visibility?: string }
) {
  await ensureChronicleTable();
  await sql`
    UPDATE chronicle_entries
    SET title = COALESCE(${patch.title ?? null}, title),
        body = COALESCE(${patch.body ?? null}, body),
        mood = ${patch.mood !== undefined ? patch.mood : null},
        visibility = COALESCE(${patch.visibility ?? null}, visibility),
        updated_at = NOW()
    WHERE id = ${id} AND user_id = ${userId}
  `;
}

export async function deleteChronicleEntry(id: string, userId: string) {
  await ensureChronicleTable();
  await sql`DELETE FROM chronicle_entries WHERE id = ${id} AND user_id = ${userId}`;
}

export async function toggleChronicleLike(entryId: string, userId: string) {
  await ensureChronicleTable();
  const existing = await sql`SELECT 1 FROM chronicle_likes WHERE entry_id = ${entryId} AND user_id = ${userId}`;
  if (existing.length > 0) {
    await sql`DELETE FROM chronicle_likes WHERE entry_id = ${entryId} AND user_id = ${userId}`;
    await sql`UPDATE chronicle_entries SET likes_count = GREATEST(0, likes_count - 1) WHERE id = ${entryId}`;
    return false;
  } else {
    await sql`INSERT INTO chronicle_likes (entry_id, user_id) VALUES (${entryId}, ${userId}) ON CONFLICT DO NOTHING`;
    await sql`UPDATE chronicle_entries SET likes_count = likes_count + 1 WHERE id = ${entryId}`;
    return true;
  }
}

export async function addChronicleComment(entryId: string, authorId: string, username: string, avatarUrl: string | null, content: string) {
  await ensureChronicleTable();
  const rows = await sql`
    INSERT INTO chronicle_comments (entry_id, author_id, username, avatar_url, content)
    VALUES (${entryId}, ${authorId}, ${username}, ${avatarUrl}, ${content})
    RETURNING *
  `;
  await sql`UPDATE chronicle_entries SET comments_count = comments_count + 1 WHERE id = ${entryId}`;
  return rows[0];
}

export async function getChronicleComments(entryId: string) {
  await ensureChronicleTable();
  return sql`
    SELECT * FROM chronicle_comments
    WHERE entry_id = ${entryId}
    ORDER BY created_at ASC
  `;
}

export async function deleteChronicleComment(commentId: number, userId: string) {
  await ensureChronicleTable();
  const rows = await sql`DELETE FROM chronicle_comments WHERE id = ${commentId} AND author_id = ${userId} RETURNING entry_id`;
  if (rows[0]?.entry_id) {
    await sql`UPDATE chronicle_entries SET comments_count = GREATEST(0, comments_count - 1) WHERE id = ${rows[0].entry_id as string}`;
  }
}

// ── WADDABI (Draw & Guess) ─────────────────────────────────────────────────

let _waddabiTablesReady = false;
async function ensureWaddabiTables() {
  if (_waddabiTablesReady) return; _waddabiTablesReady = true;
  await sql`
    CREATE TABLE IF NOT EXISTS waddabi_rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      host_id TEXT,
      status TEXT NOT NULL DEFAULT 'waiting',
      max_players INTEGER NOT NULL DEFAULT 8,
      game_state JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `.catch(() => {});
  await sql`
    CREATE TABLE IF NOT EXISTS waddabi_players (
      id SERIAL PRIMARY KEY,
      room_id TEXT REFERENCES waddabi_rooms(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      avatar TEXT,
      is_bot BOOLEAN DEFAULT FALSE,
      bot_type TEXT,
      joined_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(room_id, user_id)
    )
  `.catch(() => {});
}

export async function createWaddabiRoom(id: string, hostId: string, name: string) {
  await ensureWaddabiTables();
  await sql`
    INSERT INTO waddabi_rooms (id, name, host_id, status, game_state)
    VALUES (${id}, ${name}, ${hostId}, 'waiting', ${'{"phase":"lobby","scores":{},"chatHistory":[],"strokes":[],"turnOrder":[],"currentTurnIdx":0,"roundCount":0,"targetScore":5,"winner":null,"winnerName":null,"currentWord":null,"wordChoices":null,"guessedThisRound":[],"roundStartTime":0,"phaseStartTime":0,"roundDuration":80000,"choosingDuration":15000}'})
  `;
}

export async function getWaddabiRoom(id: string) {
  await ensureWaddabiTables();
  const rows = await sql`SELECT * FROM waddabi_rooms WHERE id = ${id}`;
  return rows[0] ?? null;
}

export async function getWaddabiPlayers(roomId: string) {
  await ensureWaddabiTables();
  return sql`SELECT * FROM waddabi_players WHERE room_id = ${roomId} ORDER BY joined_at ASC`;
}

export async function addWaddabiPlayer(roomId: string, userId: string, username: string, avatar: string | null) {
  await ensureWaddabiTables();
  await sql`
    INSERT INTO waddabi_players (room_id, user_id, username, avatar, is_bot)
    VALUES (${roomId}, ${userId}, ${username}, ${avatar ?? null}, FALSE)
    ON CONFLICT (room_id, user_id) DO NOTHING
  `;
}

export async function addWaddabiBot(roomId: string, botId: string, botName: string, botAvatar: string, botType: string) {
  await ensureWaddabiTables();
  await sql`
    INSERT INTO waddabi_players (room_id, user_id, username, avatar, is_bot, bot_type)
    VALUES (${roomId}, ${botId}, ${botName}, ${botAvatar}, TRUE, ${botType})
    ON CONFLICT (room_id, user_id) DO NOTHING
  `;
}

export async function removeWaddabiPlayer(roomId: string, userId: string) {
  await sql`DELETE FROM waddabi_players WHERE room_id = ${roomId} AND user_id = ${userId}`;
}

export async function updateWaddabiState(roomId: string, state: Record<string, unknown>) {
  await sql`
    UPDATE waddabi_rooms SET game_state = ${JSON.stringify(state)}, updated_at = NOW()
    WHERE id = ${roomId}
  `;
}

export async function setWaddabiRoomStatus(roomId: string, status: string) {
  await sql`UPDATE waddabi_rooms SET status = ${status}, updated_at = NOW() WHERE id = ${roomId}`;
}

export async function getWaddabiLobbies() {
  await ensureWaddabiTables();
  return sql`
    SELECT wr.*, u.username AS host_username, u.avatar_url AS host_avatar,
           COUNT(wp.id)::int AS player_count
    FROM waddabi_rooms wr
    LEFT JOIN users u ON wr.host_id = u.id
    LEFT JOIN waddabi_players wp ON wr.id = wp.room_id
    WHERE wr.status IN ('waiting', 'playing')
    GROUP BY wr.id, u.username, u.avatar_url
    ORDER BY wr.created_at DESC
    LIMIT 20
  `;
}

export async function cleanupIdleWaddabiRooms() {
  await sql`
    UPDATE waddabi_rooms SET status = 'closed', updated_at = NOW()
    WHERE status NOT IN ('closed','finished')
      AND updated_at < NOW() - INTERVAL '30 minutes'
  `.catch(() => {});
}

// ── Vibe ─────────────────────────────────────────────────────────────────────

export async function ensureVibeColumn() {
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS vibe_interests JSONB DEFAULT '[]'`.catch(() => {});
}

export async function getVibeInterests(userId: string): Promise<string[]> {
  await ensureVibeColumn();
  const rows = await sql`SELECT vibe_interests FROM users WHERE id = ${userId}`;
  const raw = rows[0]?.vibe_interests;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as string[];
  try { return JSON.parse(raw as string) as string[]; } catch { return []; }
}

export async function setVibeInterests(userId: string, interests: string[]): Promise<void> {
  await ensureVibeColumn();
  await sql`UPDATE users SET vibe_interests = ${JSON.stringify(interests)}::jsonb WHERE id = ${userId}`;
}

export async function getVibeInterestsByUsername(username: string): Promise<string[]> {
  await ensureVibeColumn();
  const rows = await sql`SELECT vibe_interests FROM users WHERE username = ${username}`;
  const raw = rows[0]?.vibe_interests;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as string[];
  try { return JSON.parse(raw as string) as string[]; } catch { return []; }
}

// ── House System ──────────────────────────────────────────────────────────────

export async function ensureHouseTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS house_configs (
      user_id TEXT PRIMARY KEY,
      exterior_style TEXT NOT NULL DEFAULT 'cottage',
      wallpaper TEXT NOT NULL DEFAULT 'cream',
      floor_type TEXT NOT NULL DEFAULT 'hardwood',
      furniture JSONB NOT NULL DEFAULT '[]',
      pets JSONB NOT NULL DEFAULT '[]',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.catch(() => {});
}

export async function getHouseConfig(userId: string): Promise<Record<string, unknown> | null> {
  await ensureHouseTable();
  const rows = await sql`SELECT * FROM house_configs WHERE user_id = ${userId}`;
  return rows[0] ?? null;
}

export async function saveHouseConfig(
  userId: string,
  config: { exteriorStyle?: string; wallpaper?: string; floorType?: string; furniture?: unknown[]; pets?: unknown[] }
): Promise<void> {
  await ensureHouseTable();
  await sql`
    INSERT INTO house_configs (user_id, exterior_style, wallpaper, floor_type, furniture, pets, updated_at)
    VALUES (
      ${userId},
      ${config.exteriorStyle ?? 'cottage'},
      ${config.wallpaper ?? 'cream'},
      ${config.floorType ?? 'hardwood'},
      ${JSON.stringify(config.furniture ?? [])}::jsonb,
      ${JSON.stringify(config.pets ?? [])}::jsonb,
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      exterior_style = COALESCE(EXCLUDED.exterior_style, house_configs.exterior_style),
      wallpaper      = COALESCE(EXCLUDED.wallpaper, house_configs.wallpaper),
      floor_type     = COALESCE(EXCLUDED.floor_type, house_configs.floor_type),
      furniture      = COALESCE(EXCLUDED.furniture, house_configs.furniture),
      pets           = COALESCE(EXCLUDED.pets, house_configs.pets),
      updated_at     = NOW()
  `;
}

export async function getDistrictHouses(userId: string, partyId: string | null): Promise<Record<string, unknown>[]> {
  await ensureHouseTable();
  // Get own house
  const own = await sql`
    SELECT u.id, u.username, u.avatar_url, hc.exterior_style, hc.wallpaper, hc.floor_type, hc.furniture, hc.pets
    FROM users u LEFT JOIN house_configs hc ON hc.user_id = u.id
    WHERE u.id = ${userId}
  `;
  // party_members table not yet implemented — just return own house
  return own;
}

// ── STORIES ──────────────────────────────────────────────────────────────────
// Ephemeral 24-hour video clips. NEVER counted against user storage quota.

export async function createStory(
  id: string, userId: string, username: string, avatarUrl: string | null,
  videoUrl: string, thumbnailUrl: string | null, durationSeconds: number
) {
  await sql`
    INSERT INTO stories (id, user_id, username, avatar_url, video_url, thumbnail_url, duration_seconds)
    VALUES (${id}, ${userId}, ${username}, ${avatarUrl}, ${videoUrl}, ${thumbnailUrl}, ${durationSeconds})
  `;
}

export async function getActiveStories(viewerUserId: string) {
  // Returns own story + one story per accepted friend (latest), non-expired
  const rows = await sql`
    SELECT DISTINCT ON (s.user_id)
      s.id, s.user_id, s.username, s.avatar_url, s.video_url, s.thumbnail_url,
      s.duration_seconds, s.expires_at, s.views, s.created_at
    FROM stories s
    WHERE s.expires_at > NOW()
      AND (
        s.user_id = ${viewerUserId}
        OR EXISTS (
          SELECT 1 FROM friendships f
          WHERE f.status = 'accepted'
            AND ((f.requester_id = ${viewerUserId} AND f.addressee_id = s.user_id)
              OR (f.addressee_id = ${viewerUserId} AND f.requester_id = s.user_id))
        )
      )
    ORDER BY s.user_id, s.created_at DESC
  `;
  return rows;
}

export async function getStoriesForUser(userId: string) {
  const rows = await sql`
    SELECT id, user_id, username, avatar_url, video_url, thumbnail_url,
           duration_seconds, expires_at, views, created_at
    FROM stories
    WHERE user_id = ${userId} AND expires_at > NOW()
    ORDER BY created_at DESC
  `;
  return rows;
}

export async function deleteStory(storyId: string, requesterId: string) {
  await sql`DELETE FROM stories WHERE id = ${storyId} AND user_id = ${requesterId}`;
}

export async function incrementStoryViews(storyId: string) {
  await sql`UPDATE stories SET views = views + 1 WHERE id = ${storyId}`.catch(() => {});
}

export async function getUserActiveStoryCount(userId: string): Promise<number> {
  const row = await sql`SELECT COUNT(*) as c FROM stories WHERE user_id = ${userId} AND expires_at > NOW()`;
  return parseInt((row[0] as Record<string, string> | undefined)?.c ?? "0", 10);
}

// Clean up expired story records (call lazily)
export async function purgeExpiredStories() {
  await sql`DELETE FROM stories WHERE expires_at <= NOW()`.catch(() => {});
}

// Clean up ground items older than 10 minutes
export async function cleanupExpiredGroundItems() {
  await sql`DELETE FROM town_ground_items WHERE dropped_at < NOW() - INTERVAL '10 minutes'`.catch(() => {});
}

// ── Flock Debate: media debate app (audio clips, voting, AI judge) ────────────
let _debateTablesReady = false;
export async function ensureDebateTables() {
  if (_debateTablesReady) return; _debateTablesReady = true;
  await sql`
    CREATE TABLE IF NOT EXISTS debate_topics (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      side_a_label TEXT,
      side_b_label TEXT,
      preset BOOLEAN DEFAULT false,
      creator_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS debate_topics_category_idx ON debate_topics(category)`;
  await sql`
    CREATE TABLE IF NOT EXISTS debates (
      id TEXT PRIMARY KEY,
      topic_id TEXT REFERENCES debate_topics(id) ON DELETE SET NULL,
      custom_title TEXT,
      category TEXT,
      side_a_label TEXT NOT NULL,
      side_b_label TEXT NOT NULL,
      user_a TEXT REFERENCES users(id) ON DELETE CASCADE,
      user_b TEXT REFERENCES users(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'open',
      round_limit INTEGER DEFAULT 3,
      clip_len_s INTEGER DEFAULT 60,
      current_round INTEGER DEFAULT 1,
      current_turn TEXT DEFAULT 'a',
      visibility TEXT DEFAULT 'public',
      voting_ends_at TIMESTAMP,
      winner_side TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS debates_status_idx ON debates(status)`;
  await sql`CREATE INDEX IF NOT EXISTS debates_user_a_idx ON debates(user_a)`;
  await sql`CREATE INDEX IF NOT EXISTS debates_user_b_idx ON debates(user_b)`;
  await sql`
    CREATE TABLE IF NOT EXISTS debate_clips (
      id TEXT PRIMARY KEY,
      debate_id TEXT REFERENCES debates(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      side TEXT NOT NULL,
      round_no INTEGER NOT NULL,
      r2_key TEXT NOT NULL,
      url TEXT NOT NULL,
      duration_ms INTEGER DEFAULT 0,
      transcript TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS debate_clips_debate_idx ON debate_clips(debate_id, round_no, side)`;
  await sql`
    CREATE TABLE IF NOT EXISTS debate_votes (
      debate_id TEXT REFERENCES debates(id) ON DELETE CASCADE,
      voter_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      vote_side TEXT NOT NULL,
      reaction TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (debate_id, voter_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS debate_verdicts (
      debate_id TEXT PRIMARY KEY REFERENCES debates(id) ON DELETE CASCADE,
      ai_winner TEXT,
      score_a INTEGER DEFAULT 0,
      score_b INTEGER DEFAULT 0,
      roast_line TEXT DEFAULT '',
      reasoning TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS debate_stats (
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      streak INTEGER DEFAULT 0,
      best_streak INTEGER DEFAULT 0,
      updated_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (user_id, category)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS debate_highlights (
      id TEXT PRIMARY KEY,
      clip_id TEXT REFERENCES debate_clips(id) ON DELETE CASCADE,
      sharer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      share_key TEXT UNIQUE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
}

// Close debates whose voting window has expired (no winner set yet).
// Intended to be called before any lobby/detail read so we don't rely on a cron.
export async function closeExpiredDebateVoting() {
  await sql`
    UPDATE debates d
    SET status = 'closed',
        winner_side = COALESCE((
          SELECT CASE
            WHEN SUM(CASE WHEN vote_side='a' THEN 1 ELSE 0 END) >
                 SUM(CASE WHEN vote_side='b' THEN 1 ELSE 0 END) THEN 'a'
            WHEN SUM(CASE WHEN vote_side='b' THEN 1 ELSE 0 END) >
                 SUM(CASE WHEN vote_side='a' THEN 1 ELSE 0 END) THEN 'b'
            ELSE 'tie'
          END
          FROM debate_votes v WHERE v.debate_id = d.id
        ), 'tie'),
        updated_at = NOW()
    WHERE status = 'voting' AND voting_ends_at IS NOT NULL AND voting_ends_at < NOW()
  `.catch(() => {});
}

// TEMP: Call all ensure functions for fresh DB setup
export async function ensureAllTables() {
  await ensureVoiceTables().catch(()=>{});
  await ensureWatchTables().catch(()=>{});
  await ensurePokerTables().catch(()=>{});
  await ensureScreenShareSignals().catch(()=>{});
  await ensureDrawTables().catch(()=>{});
  await ensureShareTables().catch(()=>{});
  await ensureTownTable().catch(()=>{});
  await ensureRpsTable().catch(()=>{});
  await ensureAdventureTables().catch(()=>{});
  await ensurePartyTable().catch(()=>{});
  await ensurePrivilegesTable().catch(()=>{});
  await ensureNpcMemoryTable().catch(()=>{});
  await ensureAiUsageTable().catch(()=>{});
  await ensurePongTables().catch(()=>{});
  await ensureWaddabiTables().catch(()=>{});
  await ensureDebateTables().catch(()=>{});
}
