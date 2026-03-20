import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  createEmulatorRoom, getEmulatorRoom, joinEmulatorRoom, reportEmulatorResult,
  getActiveEmulatorRooms, closeEmulatorRoom, closeAllRoomsForUser,
  startEmulatorRoom, selectEmulatorGame, addRoomMessage, getRoomMessages,
  bootGuestFromRoom, heartbeatArenaHost,
} from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const roomId = searchParams.get("id");
  const messages = searchParams.get("messages");

  if (messages) {
    const msgs = await getRoomMessages(messages);
    return NextResponse.json(msgs);
  }

  if (roomId) {
    const room = await getEmulatorRoom(roomId);
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
    return NextResponse.json(room);
  }

  const rooms = await getActiveEmulatorRooms();
  return NextResponse.json(rooms);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action, roomId, gameName, winnerId, ranked, content } = body;

  if (action === "create") {
    if (!gameName) return NextResponse.json({ error: "gameName required" }, { status: 400 });
    const id = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
    const room = await createEmulatorRoom(id, session.user.id, gameName, undefined, ranked !== false);
    return NextResponse.json(room);
  }

  if (action === "join") {
    if (!roomId) return NextResponse.json({ error: "roomId required" }, { status: 400 });
    await joinEmulatorRoom(roomId, session.user.id);
    const room = await getEmulatorRoom(roomId);
    return NextResponse.json(room);
  }

  if (action === "selectGame") {
    if (!roomId || !gameName) return NextResponse.json({ error: "roomId and gameName required" }, { status: 400 });
    await selectEmulatorGame(roomId, session.user.id, gameName);
    const room = await getEmulatorRoom(roomId);
    return NextResponse.json(room);
  }

  if (action === "startGame") {
    if (!roomId) return NextResponse.json({ error: "roomId required" }, { status: 400 });
    await startEmulatorRoom(roomId, session.user.id);
    const room = await getEmulatorRoom(roomId);
    return NextResponse.json(room);
  }

  if (action === "sendMessage") {
    if (!roomId || !content) return NextResponse.json({ error: "roomId and content required" }, { status: 400 });
    const msg = await addRoomMessage(
      roomId, session.user.id,
      session.user.name ?? "User",
      session.user.image ?? null,
      String(content).slice(0, 300),
    );
    return NextResponse.json(msg);
  }

  if (action === "report") {
    if (!roomId) return NextResponse.json({ error: "roomId required" }, { status: 400 });
    const result = await reportEmulatorResult(roomId, session.user.id, winnerId ?? null);
    return NextResponse.json(result);
  }

  if (action === "close") {
    if (!roomId) return NextResponse.json({ error: "roomId required" }, { status: 400 });
    await closeEmulatorRoom(roomId, session.user.id);
    return NextResponse.json({ ok: true });
  }

  if (action === "closeAll") {
    await closeAllRoomsForUser(session.user.id);
    return NextResponse.json({ ok: true });
  }

  if (action === "bootGuest") {
    if (!roomId) return NextResponse.json({ error: "roomId required" }, { status: 400 });
    await bootGuestFromRoom(roomId, session.user.id);
    const room = await getEmulatorRoom(roomId);
    return NextResponse.json(room);
  }

  if (action === "heartbeat") {
    if (!roomId) return NextResponse.json({ error: "roomId required" }, { status: 400 });
    await heartbeatArenaHost(roomId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
