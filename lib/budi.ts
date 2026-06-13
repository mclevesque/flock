// Budi Phase 2 — clip helpers. Kept in a separate module from the giant db.ts.
import { sql, ensureBudiTables } from "@/lib/db";

function clipId(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 8);
}

const DAY = "((NOW() - INTERVAL '4 hours')::date)"; // the Budi 4am→4am "day"

// Upload one media file, fan it out to N logs (one row each, sharing video_key).
// Updates each membership's streak. Returns how many clip rows were created.
export async function createBudiClips(opts: {
  userId: string;
  username: string;
  avatarUrl: string | null;
  logIds: string[];
  videoKey: string;
  thumbKey: string | null;
  durationSeconds: number;
  caption: string;
  mediaType: string;      // 'video' | 'audio'
  ttlHours?: number;
}): Promise<number> {
  await ensureBudiTables();
  const ttl = opts.ttlHours ?? 24;
  let count = 0;
  for (const logId of opts.logIds) {
    const member = await sql`SELECT 1 FROM budi_members WHERE log_id = ${logId} AND user_id = ${opts.userId} LIMIT 1`;
    if (!member.length) continue; // silently skip logs the user isn't in
    const id = clipId();
    await sql`
      INSERT INTO budi_clips
        (id, log_id, user_id, username, avatar_url, video_key, thumb_key, duration_seconds, caption, media_type, local_day, expires_at)
      VALUES
        (${id}, ${logId}, ${opts.userId}, ${opts.username}, ${opts.avatarUrl}, ${opts.videoKey}, ${opts.thumbKey},
         ${opts.durationSeconds}, ${opts.caption}, ${opts.mediaType},
         (NOW() - INTERVAL '4 hours')::date, NOW() + (${ttl} * INTERVAL '1 hour'))
    `;
    // Streak: same day = unchanged, yesterday = +1, otherwise reset to 1
    await sql`
      UPDATE budi_members m SET
        streak_count = CASE
          WHEN m.last_post_date = (NOW() - INTERVAL '4 hours')::date THEN m.streak_count
          WHEN m.last_post_date = (NOW() - INTERVAL '4 hours')::date - 1 THEN COALESCE(m.streak_count, 0) + 1
          ELSE 1 END,
        last_post_date = (NOW() - INTERVAL '4 hours')::date
      WHERE m.log_id = ${logId} AND m.user_id = ${opts.userId}
    `;
    count++;
  }
  return count;
}

// Clips for a log, chronological. Returns null if the user isn't a member.
export async function getBudiClips(logId: string, userId: string) {
  await ensureBudiTables();
  const member = await sql`SELECT 1 FROM budi_members WHERE log_id = ${logId} AND user_id = ${userId} LIMIT 1`;
  if (!member.length) return null;
  return sql`
    SELECT c.id, c.log_id, c.user_id, c.username, c.avatar_url, c.video_key, c.thumb_key,
           c.duration_seconds, c.caption, c.media_type, c.highlight, c.recorded_at, c.created_at,
           (SELECT COUNT(*)::int FROM budi_clip_likes l WHERE l.clip_id = c.id) AS like_count,
           EXISTS(SELECT 1 FROM budi_clip_likes l WHERE l.clip_id = c.id AND l.user_id = ${userId}) AS liked,
           (SELECT COUNT(*)::int FROM budi_comments cm WHERE cm.clip_id = c.id) AS comment_count
    FROM budi_clips c
    WHERE c.log_id = ${logId}
      AND (c.highlight = TRUE OR c.expires_at IS NULL OR c.expires_at > NOW())
    ORDER BY c.recorded_at ASC, c.created_at ASC
  `;
}

export async function toggleBudiClipLike(clipId: string, userId: string): Promise<boolean> {
  await ensureBudiTables();
  const [ex] = await sql`SELECT 1 FROM budi_clip_likes WHERE clip_id = ${clipId} AND user_id = ${userId}`;
  if (ex) {
    await sql`DELETE FROM budi_clip_likes WHERE clip_id = ${clipId} AND user_id = ${userId}`;
    return false;
  }
  await sql`INSERT INTO budi_clip_likes (clip_id, user_id) VALUES (${clipId}, ${userId}) ON CONFLICT DO NOTHING`;
  return true;
}

// Save (or unsave) a clip as a highlight — only the author can. Highlights never expire.
export async function setBudiHighlight(clipId: string, userId: string, highlight: boolean): Promise<boolean> {
  await ensureBudiTables();
  const res = await sql`
    UPDATE budi_clips SET highlight = ${highlight}
    WHERE id = ${clipId} AND user_id = ${userId}
    RETURNING id
  `;
  return res.length > 0;
}

// A user's personal (solo) vlog — visible to themselves, or to anyone who shares a
// group party with them. Returns null if the viewer isn't allowed (or user missing).
export async function getBudiUserVlog(viewerId: string, targetUserId: string) {
  await ensureBudiTables();
  if (viewerId !== targetUserId) {
    const shared = await sql`
      SELECT 1 FROM budi_members a
      JOIN budi_members b ON a.log_id = b.log_id
      JOIN budi_logs l ON l.id = a.log_id AND l.kind = 'group'
      WHERE a.user_id = ${viewerId} AND b.user_id = ${targetUserId}
      LIMIT 1
    `;
    if (!shared.length) return null;
  }
  const userRows = await sql`SELECT id, username, display_name, avatar_url FROM users WHERE id = ${targetUserId} LIMIT 1`;
  const user = userRows[0];
  if (!user) return null;
  const soloRows = await sql`SELECT id FROM budi_logs WHERE owner_id = ${targetUserId} AND kind = 'solo' LIMIT 1`;
  const solo = soloRows[0];
  if (!solo) return { user, clips: [] as Record<string, unknown>[] };
  const clips = await sql`
    SELECT c.id, c.user_id, c.username, c.avatar_url, c.video_key, c.thumb_key,
           c.duration_seconds, c.caption, c.media_type, c.highlight, c.recorded_at, c.created_at,
           (SELECT COUNT(*)::int FROM budi_clip_likes l WHERE l.clip_id = c.id) AS like_count,
           EXISTS(SELECT 1 FROM budi_clip_likes l WHERE l.clip_id = c.id AND l.user_id = ${viewerId}) AS liked,
           (SELECT COUNT(*)::int FROM budi_comments cm WHERE cm.clip_id = c.id) AS comment_count
    FROM budi_clips c
    WHERE c.log_id = ${solo.id}
      AND (c.highlight = TRUE OR c.expires_at IS NULL OR c.expires_at > NOW())
    ORDER BY c.recorded_at DESC, c.created_at DESC
  `;
  return { user, clips };
}
