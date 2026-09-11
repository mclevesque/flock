import { sql } from "@/lib/db";

/**
 * The DraftMasters side of friends: who is mid-draft, what you have not read,
 * and the conversation itself.
 *
 * Messages are NOT stored here. They are the hub's direct_messages rows, so a
 * chat started in the game is the same conversation on greatsouls.net/messages
 * and nothing has to be kept in sync. What this adds is only what the hub never
 * needed: a read marker per friend, and the room each player is in right now.
 *
 * Tables self-create like every other game's here. The same DDL is in
 * scripts/draftmasters-social-migration.sql for anyone who would rather run it
 * ahead of a deploy.
 */

let ready = false;

export async function ensureSocialTables() {
  if (ready) return;
  await sql`
    CREATE TABLE IF NOT EXISTS draftmasters_active_rooms (
      user_id     TEXT PRIMARY KEY,
      room_code   TEXT NOT NULL,
      is_host     BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS draftmasters_chat_reads (
      user_id     TEXT NOT NULL,
      friend_id   TEXT NOT NULL,
      read_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, friend_id)
    )
  `;
  // Set only once both statements have landed, so a cold start that failed
  // halfway tries again instead of believing the tables exist.
  ready = true;
}

export interface ChatMessage {
  id: number;
  from: string;
  to: string;
  text: string;
  at: string;
}

/** The latest messages between two people, oldest first. */
export async function getChat(me: string, friend: string, limit = 60): Promise<ChatMessage[]> {
  const rows = await sql`
    SELECT id, sender_id, receiver_id, content, created_at FROM (
      SELECT id, sender_id, receiver_id, content, created_at
      FROM direct_messages
      WHERE (sender_id = ${me} AND receiver_id = ${friend})
         OR (sender_id = ${friend} AND receiver_id = ${me})
      ORDER BY created_at DESC
      LIMIT ${limit}
    ) recent
    ORDER BY created_at ASC
  `;
  return rows.map((r) => ({
    id: Number(r.id),
    from: String(r.sender_id),
    to: String(r.receiver_id),
    text: String(r.content),
    at: new Date(r.created_at as string).toISOString(),
  }));
}

export async function markChatRead(me: string, friend: string) {
  await ensureSocialTables();
  await sql`
    INSERT INTO draftmasters_chat_reads (user_id, friend_id, read_at)
    VALUES (${me}, ${friend}, NOW())
    ON CONFLICT (user_id, friend_id) DO UPDATE SET read_at = NOW()
  `;
}

/**
 * Unread messages per friend.
 *
 * Someone who has never opened a chat here has no read marker, and counting
 * their entire hub history as unread would put "214" on a friend they spoke to
 * last spring. Without a marker only the last three days count.
 */
export async function unreadByFriend(me: string): Promise<Map<string, number>> {
  await ensureSocialTables();
  const rows = await sql`
    SELECT dm.sender_id AS friend_id, COUNT(*)::int AS unread
    FROM direct_messages dm
    LEFT JOIN draftmasters_chat_reads r
      ON r.user_id = ${me} AND r.friend_id = dm.sender_id
    WHERE dm.receiver_id = ${me}
      AND dm.created_at > COALESCE(r.read_at, NOW() - INTERVAL '3 days')
    GROUP BY dm.sender_id
  `;
  return new Map(rows.map((r) => [String(r.friend_id), Number(r.unread)]));
}

/** Remember (or forget, with null) the room a player is in. */
export async function setActiveRoom(me: string, code: string | null, isHost = false) {
  await ensureSocialTables();
  if (!code) {
    await sql`DELETE FROM draftmasters_active_rooms WHERE user_id = ${me}`;
    return;
  }
  await sql`
    INSERT INTO draftmasters_active_rooms (user_id, room_code, is_host, updated_at)
    VALUES (${me}, ${code}, ${isHost}, NOW())
    ON CONFLICT (user_id) DO UPDATE
      SET room_code = ${code},
          -- A reconnect to your own room must not demote you to guest.
          is_host = CASE WHEN draftmasters_active_rooms.room_code = ${code}
                         THEN draftmasters_active_rooms.is_host OR ${isHost}
                         ELSE ${isHost} END,
          updated_at = NOW()
  `;
}

export interface ActiveRoom {
  code: string;
  isHost: boolean;
  at: string;
}

/**
 * The room to offer "Back to your game" for.
 *
 * Six hours is generous on purpose: the room itself is the authority on
 * whether it still exists, and the client asks it before rejoining. This only
 * decides whether the button is worth showing.
 */
export async function getActiveRoom(me: string): Promise<ActiveRoom | null> {
  await ensureSocialTables();
  const rows = await sql`
    SELECT room_code, is_host, updated_at FROM draftmasters_active_rooms
    WHERE user_id = ${me} AND updated_at > NOW() - INTERVAL '6 hours'
  `;
  const r = rows[0];
  return r
    ? { code: String(r.room_code), isHost: Boolean(r.is_host), at: new Date(r.updated_at as string).toISOString() }
    : null;
}

/**
 * Which of these people are in a draft right now.
 *
 * A room in play refreshes its row every few minutes, so anything quieter than
 * twenty is somebody who closed the tab without leaving.
 */
export async function inDraftAmong(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  await ensureSocialTables();
  const rows = await sql`
    SELECT user_id FROM draftmasters_active_rooms
    WHERE user_id = ANY(${ids}::text[]) AND updated_at > NOW() - INTERVAL '20 minutes'
  `;
  return new Set(rows.map((r) => String(r.user_id)));
}
