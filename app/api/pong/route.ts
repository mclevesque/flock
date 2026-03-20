import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  createPongRoom, getPongRoom, joinPongRoom, updatePongRoom,
  getPongElo, updatePongElo, getPongLeaderboard, cleanupStalePongRooms,
} from "@/lib/db";

export async function GET(req: NextRequest) {
  cleanupStalePongRooms().catch(() => {});
  const { searchParams } = new URL(req.url);

  if (searchParams.get("leaderboard") === "1") {
    const rows = await getPongLeaderboard().catch(() => []);
    return NextResponse.json(rows);
  }

  const roomId = searchParams.get("roomId");
  if (roomId) {
    const room = await getPongRoom(roomId).catch(() => null);
    if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(room);
  }

  const userId = searchParams.get("userId");
  if (userId) {
    const elo = await getPongElo(userId).catch(() => ({ elo: 1200, wins: 0, losses: 0 }));
    return NextResponse.json(elo);
  }

  return NextResponse.json({ error: "Missing params" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as { id: string; name?: string | null };
  const body = await req.json();
  const { action } = body;

  if (action === "create") {
    const id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    const room = await createPongRoom(id, u.id, u.name ?? "Player");
    return NextResponse.json(room);
  }

  if (action === "join") {
    const { roomId } = body;
    if (!roomId) return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
    const room = await joinPongRoom(roomId, u.id, u.name ?? "Player");
    if (!room) return NextResponse.json({ error: "Room not available" }, { status: 400 });
    return NextResponse.json(room);
  }

  if (action === "update") {
    const { roomId, ...patch } = body;
    if (!roomId) return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
    const room = await getPongRoom(roomId).catch(() => null);
    if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // Only host or opponent can update
    if (room.host_id !== u.id && room.opponent_id !== u.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await updatePongRoom(roomId, {
      status: patch.status,
      ballX: patch.ballX, ballY: patch.ballY, ballVX: patch.ballVX, ballVY: patch.ballVY,
      hostPaddle: patch.hostPaddle, oppPaddle: patch.oppPaddle,
      hostScore: patch.hostScore, oppScore: patch.oppScore,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "finish") {
    const { roomId, winnerId } = body;
    if (!roomId || !winnerId) return NextResponse.json({ error: "Missing params" }, { status: 400 });
    const room = await getPongRoom(roomId).catch(() => null);
    if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (room.host_id !== u.id && room.opponent_id !== u.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (room.status === "finished") return NextResponse.json({ ok: true, alreadyDone: true });
    const loserId = String(winnerId === room.host_id ? room.opponent_id : room.host_id);
    const winnerUsername = String(winnerId === room.host_id ? room.host_username : room.opponent_username);
    const loserUsername = String(loserId === room.host_id ? room.host_username : room.opponent_username);
    await updatePongRoom(roomId, { winnerId });
    let eloResult = null;
    if (loserId && winnerUsername && loserUsername) {
      eloResult = await updatePongElo(winnerId, winnerUsername, loserId, loserUsername).catch(() => null);
    }
    return NextResponse.json({ ok: true, eloResult });
  }

  if (action === "abandon") {
    const { roomId } = body;
    if (!roomId) return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
    await updatePongRoom(roomId, { status: "abandoned" }).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
