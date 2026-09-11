-- DraftMasters friends, invites and rejoin.
--
-- NOT run automatically against production by anyone working on this branch.
-- Both tables are also created lazily by ensureSocialTables() in
-- lib/draftmasters/social.ts (the repo's usual CREATE TABLE IF NOT EXISTS
-- pattern), so the feature works without this file being run by hand. Run it
-- ahead of the deploy if you would rather the first request not pay for the
-- DDL, and to get the index, which the lazy path deliberately does not create.
--
-- Safe to run more than once. Nothing here alters or drops an existing table.

-- The room each player is in right now, so "Back to your game" works across
-- devices and friends can see who is mid-draft. One row per user; a player is
-- only ever in one room.
CREATE TABLE IF NOT EXISTS draftmasters_active_rooms (
  user_id     TEXT PRIMARY KEY,
  room_code   TEXT NOT NULL,
  is_host     BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- When each player last read their chat with each friend. Unread counts are
-- direct_messages newer than this; messages are not copied anywhere.
CREATE TABLE IF NOT EXISTS draftmasters_chat_reads (
  user_id     TEXT NOT NULL,
  friend_id   TEXT NOT NULL,
  read_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id)
);

-- Optional, recommended: makes the per-friend unread count and the latest-60
-- conversation read index lookups instead of scans once direct_messages grows.
-- Creating an index takes a brief write lock on direct_messages (shared with
-- the Great Souls hub), so run it at a quiet moment. CONCURRENTLY avoids the
-- lock but cannot run inside a transaction block.
CREATE INDEX CONCURRENTLY IF NOT EXISTS direct_messages_receiver_sender_created_idx
  ON direct_messages (receiver_id, sender_id, created_at DESC);
