export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ensureDebateTables, closeExpiredDebateVoting, sql } from "@/lib/db";
import { CATEGORY_LABELS } from "@/lib/debate-topics";
import DebateLobbyClient from "./DebateLobbyClient";

interface DebateRowShape {
  id: string;
  custom_title: string | null;
  category: string | null;
  side_a_label: string;
  side_b_label: string;
  user_a: string;
  user_b: string | null;
  status: string;
  round_limit: number;
  clip_len_s: number;
  current_round: number;
  current_turn: string;
  voting_ends_at: string | null;
  winner_side: string | null;
  created_at: string;
  updated_at: string;
  a_username: string;
  a_avatar: string | null;
  b_username?: string | null;
  b_avatar?: string | null;
  votes_a?: number;
  votes_b?: number;
}

export default async function DebatePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  await ensureDebateTables();
  await closeExpiredDebateVoting();

  const open = await sql`
    SELECT d.*, ua.username AS a_username, ua.avatar_url AS a_avatar
    FROM debates d
    JOIN users ua ON ua.id = d.user_a
    WHERE d.status = 'open' AND d.visibility = 'public'
    ORDER BY d.created_at DESC
    LIMIT 30
  ` as unknown as DebateRowShape[];

  const active = await sql`
    SELECT d.*,
      ua.username AS a_username, ua.avatar_url AS a_avatar,
      ub.username AS b_username, ub.avatar_url AS b_avatar
    FROM debates d
    JOIN users ua ON ua.id = d.user_a
    LEFT JOIN users ub ON ub.id = d.user_b
    WHERE d.status IN ('active', 'voting')
    ORDER BY d.updated_at DESC
    LIMIT 30
  ` as unknown as DebateRowShape[];

  const closed = await sql`
    SELECT d.*,
      ua.username AS a_username, ua.avatar_url AS a_avatar,
      ub.username AS b_username, ub.avatar_url AS b_avatar,
      (SELECT COUNT(*) FROM debate_votes v WHERE v.debate_id = d.id AND v.vote_side = 'a')::int AS votes_a,
      (SELECT COUNT(*) FROM debate_votes v WHERE v.debate_id = d.id AND v.vote_side = 'b')::int AS votes_b
    FROM debates d
    JOIN users ua ON ua.id = d.user_a
    LEFT JOIN users ub ON ub.id = d.user_b
    WHERE d.status = 'closed'
    ORDER BY d.updated_at DESC
    LIMIT 15
  ` as unknown as DebateRowShape[];

  return (
    <DebateLobbyClient
      open={open}
      active={active}
      closed={closed}
      categories={CATEGORY_LABELS}
      sessionUserId={session.user.id}
    />
  );
}
