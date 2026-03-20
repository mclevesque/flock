import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createPokerRoom, getPokerLobbies } from "@/lib/db";

function genId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function GET() {
  try {
    const lobbies = await getPokerLobbies();
    return NextResponse.json(lobbies);
  } catch (e) {
    console.error(e);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, buyIn, maxPlayers } = await req.json().catch(() => ({}));
  const id = genId();
  const roomName = name?.trim() || `${session.user.name ?? "Player"}'s Table`;
  const bi = Number(buyIn) || 1000;
  const mp = Math.min(Math.max(Number(maxPlayers) || 9, 2), 9);

  try {
    await createPokerRoom(id, session.user.id, roomName, bi, mp);
    return NextResponse.json({ id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create room" }, { status: 500 });
  }
}
