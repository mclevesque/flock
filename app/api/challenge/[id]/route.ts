import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { respondToGameChallenge, createChessGame, createEmulatorRoom, sql } from "@/lib/db";

// PATCH /api/challenge/[id] — accept or decline
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { action } = await req.json();
  if (action !== "accept" && action !== "decline") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  if (action === "decline") {
    await respondToGameChallenge(id, session.user.id, "decline");
    return NextResponse.json({ ok: true });
  }

  // Accept — get the challenge details first
  const rows = await sql`
    SELECT * FROM game_challenges
    WHERE id = ${id} AND to_user_id = ${session.user.id} AND status = 'pending' AND expires_at > NOW()
  `;
  const challenge = rows[0] as {
    id: string; from_user_id: string; game_type: string; game_name: string | null;
    netplay_room_id: string | null; ranked: boolean;
  } | undefined;
  if (!challenge) return NextResponse.json({ error: "Challenge not found or expired" }, { status: 404 });

  let resultGameId: string | undefined;
  let redirectUrl = "/";

  if (challenge.game_type === "chess") {
    const gameId = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
    await createChessGame(gameId, challenge.from_user_id, session.user.id);
    resultGameId = gameId;
    redirectUrl = `/chess/${gameId}`;
  } else if (challenge.game_type === "quiz") {
    redirectUrl = `/quiz?challengeUserId=${challenge.from_user_id}`;
  } else if (challenge.game_type === "emulator") {
    const gameName = challenge.game_name ?? "";
    const roomId = challenge.netplay_room_id ?? Math.random().toString(36).slice(2, 8).toUpperCase();
    const ranked = challenge.ranked !== false;
    // Pre-create emulator room so both players land in the same tracked match
    try {
      await createEmulatorRoom(roomId, challenge.from_user_id, gameName, session.user.id, ranked);
    } catch { /* room may already exist if retried */ }
    resultGameId = roomId;
    // Accepter = player 2 (joins)
    redirectUrl = `/emulator?game=${encodeURIComponent(gameName)}&room=${roomId}&role=join&ranked=${ranked ? "1" : "0"}`;
  }

  await respondToGameChallenge(id, session.user.id, "accept", resultGameId);
  return NextResponse.json({ ok: true, redirectUrl, resultGameId });
}
