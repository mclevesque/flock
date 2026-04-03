/**
 * Party DB layer — lean, reliable, WS-first.
 *
 * Rules:
 * - Never call ensureExpansionTables() on reads (cold-start killer)
 * - No avatar refresh on read — update avatars on write
 * - Return fresh party inline from every mutation (no round-trips)
 * - DB is source of truth for membership only; activity state lives in WS
 */
import { sql } from "./db";

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

// Migration runs once per cold start, only on first write — never on reads
let _ensured = false;
async function ensureTable() {
  if (_ensured) return;
  await sql`
    CREATE TABLE IF NOT EXISTS town_parties (
      id            TEXT    PRIMARY KEY,
      leader_id     TEXT    NOT NULL,
      leader_name   TEXT    DEFAULT '',
      leader_avatar TEXT    DEFAULT '',
      members       JSONB   NOT NULL DEFAULT '[]',
      max_size      INTEGER NOT NULL DEFAULT 8,
      created_at    BIGINT  NOT NULL DEFAULT 0
    )
  `.catch(() => {});
  _ensured = true;
}

function toParty(row: Record<string, unknown>): Party {
  let members: PartyMember[] = [];
  if (Array.isArray(row.members)) {
    members = row.members as PartyMember[];
  } else if (typeof row.members === "string") {
    try { members = JSON.parse(row.members); } catch { members = []; }
  }

  const leaderId = row.leader_id as string;
  const leaderName = (row.leader_name as string) || "";
  const leaderAvatar = (row.leader_avatar as string) || "";

  // Self-heal: leader must always appear in the members list.
  // Old DB rows (created before the rewrite) stored members separately and can be empty.
  if (leaderId && !members.some(m => m.userId === leaderId)) {
    members = [
      { userId: leaderId, username: leaderName || "Leader", avatarUrl: leaderAvatar, isLeader: true },
      ...members.map(m => ({ ...m, isLeader: false })),
    ];
  }

  // Ensure exactly one isLeader flag
  members = members.map(m => ({ ...m, isLeader: m.userId === leaderId }));

  return {
    id: row.id as string,
    leaderId,
    leaderName: leaderName || members[0]?.username || "",
    leaderAvatar: leaderAvatar || members[0]?.avatarUrl || "",
    members,
    maxSize: Number(row.max_size ?? 8),
    createdAt: Number(row.created_at ?? 0),
  };
}

// ── Reads ─────────────────────────────────────────────────────────────────────

/** Fast lookup by party ID — used for crash recovery */
export async function getPartyById(partyId: string): Promise<Party | null> {
  const rows = await sql`
    SELECT * FROM town_parties WHERE id = ${partyId} LIMIT 1
  `.catch(() => []);
  return rows[0] ? toParty(rows[0]) : null;
}

/** Find current party for a user — leader index first, JSONB scan fallback */
export async function getMyParty(userId: string): Promise<Party | null> {
  let rows = await sql`
    SELECT * FROM town_parties WHERE leader_id = ${userId} LIMIT 1
  `.catch(() => []);
  if (!rows[0]) {
    rows = await sql`
      SELECT * FROM town_parties
      WHERE members @> ${JSON.stringify([{ userId }])}::jsonb LIMIT 1
    `.catch(() => []);
  }
  return rows[0] ? toParty(rows[0]) : null;
}

export async function getFriendParties(userId: string): Promise<Party[]> {
  const friendRows = await sql`
    SELECT CASE WHEN requester_id = ${userId} THEN addressee_id ELSE requester_id END AS fid
    FROM friendships
    WHERE (requester_id = ${userId} OR addressee_id = ${userId}) AND status = 'accepted'
  `.catch(() => []);
  if (!friendRows.length) return [];
  const ids = friendRows.map(r => r.fid as string);
  const rows = await sql`
    SELECT * FROM town_parties WHERE leader_id = ANY(${ids}::text[])
  `.catch(() => []);
  return rows.map(toParty);
}

// ── Writes ────────────────────────────────────────────────────────────────────

export async function createParty(
  leaderId: string, leaderName: string, leaderAvatar: string
): Promise<Party> {
  await ensureTable();
  await leaveParty(leaderId).catch(() => {});
  const id = `party_${leaderId}_${Date.now()}`;
  const members: PartyMember[] = [{ userId: leaderId, username: leaderName, avatarUrl: leaderAvatar, isLeader: true }];
  await sql`
    INSERT INTO town_parties (id, leader_id, leader_name, leader_avatar, members, max_size, created_at)
    VALUES (${id}, ${leaderId}, ${leaderName}, ${leaderAvatar}, ${JSON.stringify(members)}::jsonb, 8, ${Date.now()})
  `;
  return { id, leaderId, leaderName, leaderAvatar, members, maxSize: 8, createdAt: Date.now() };
}

export async function joinParty(
  partyId: string, userId: string, username: string, avatarUrl: string
): Promise<{ ok: boolean; party?: Party; error?: string }> {
  await ensureTable();
  // Retry once — Neon free tier can cold-timeout on first call
  let rows = await sql`SELECT * FROM town_parties WHERE id = ${partyId}`.catch(() => []);
  if (!rows[0]) rows = await sql`SELECT * FROM town_parties WHERE id = ${partyId}`.catch(() => []);
  if (!rows[0]) return { ok: false, error: "Party not found" };

  const party = toParty(rows[0]);
  // Deduplicate members (ghost cleanup)
  const seen = new Set<string>();
  const members = party.members.filter(m => {
    if (seen.has(m.userId)) return false;
    seen.add(m.userId);
    return true;
  });

  // Idempotent — already a member
  if (members.find(m => m.userId === userId)) {
    await sql`UPDATE town_parties SET members = ${JSON.stringify(members)}::jsonb WHERE id = ${partyId}`.catch(() => {});
    return { ok: true, party: { ...party, members } };
  }

  if (members.length >= party.maxSize) return { ok: false, error: "Party full" };

  await leaveParty(userId).catch(() => {});
  const newMembers = [...members, { userId, username, avatarUrl, isLeader: false }];
  await sql`UPDATE town_parties SET members = ${JSON.stringify(newMembers)}::jsonb WHERE id = ${partyId}`.catch(() => {});
  return { ok: true, party: { ...party, members: newMembers } };
}

export async function leaveParty(userId: string): Promise<void> {
  const leaderRows = await sql`
    SELECT * FROM town_parties WHERE leader_id = ${userId}
  `.catch(() => []);
  if (leaderRows[0]) {
    const party = toParty(leaderRows[0]);
    const others = party.members.filter(m => m.userId !== userId);
    if (others.length === 0) {
      await sql`DELETE FROM town_parties WHERE id = ${party.id}`.catch(() => {});
    } else {
      const next = { ...others[0], isLeader: true };
      const newMembers = [next, ...others.slice(1)];
      await sql`
        UPDATE town_parties
        SET leader_id = ${next.userId}, leader_name = ${next.username},
            leader_avatar = ${next.avatarUrl}, members = ${JSON.stringify(newMembers)}::jsonb
        WHERE id = ${party.id}
      `.catch(() => {});
    }
    return;
  }
  // Remove from member list if not leader
  await sql`
    UPDATE town_parties
    SET members = (
      SELECT COALESCE(jsonb_agg(m), '[]'::jsonb)
      FROM jsonb_array_elements(members) m
      WHERE m->>'userId' != ${userId}
    )
    WHERE members @> ${JSON.stringify([{ userId }])}::jsonb
  `.catch(() => {});
}

export async function disbandParty(partyId: string): Promise<void> {
  await sql`DELETE FROM town_parties WHERE id = ${partyId}`.catch(() => {});
}

export async function kickMember(partyId: string, targetId: string): Promise<Party | null> {
  const rows = await sql`SELECT * FROM town_parties WHERE id = ${partyId}`.catch(() => []);
  if (!rows[0]) return null;
  const party = toParty(rows[0]);
  const newMembers = party.members.filter(m => m.userId !== targetId);
  await sql`UPDATE town_parties SET members = ${JSON.stringify(newMembers)}::jsonb WHERE id = ${partyId}`.catch(() => {});
  return { ...party, members: newMembers };
}

export async function promoteMember(
  partyId: string, newLeaderId: string, newLeaderName: string, newLeaderAvatar: string
): Promise<Party | null> {
  const rows = await sql`SELECT * FROM town_parties WHERE id = ${partyId}`.catch(() => []);
  if (!rows[0]) return null;
  const party = toParty(rows[0]);
  const newMembers = party.members.map(m => ({ ...m, isLeader: m.userId === newLeaderId }));
  await sql`
    UPDATE town_parties
    SET leader_id = ${newLeaderId}, leader_name = ${newLeaderName},
        leader_avatar = ${newLeaderAvatar}, members = ${JSON.stringify(newMembers)}::jsonb
    WHERE id = ${partyId}
  `.catch(() => {});
  return { ...party, leaderId: newLeaderId, leaderName: newLeaderName, leaderAvatar: newLeaderAvatar, members: newMembers };
}
