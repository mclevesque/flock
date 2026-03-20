import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createWatchRoom, getOpenWatchRooms } from "@/lib/db";

function genId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function GET() {
  try {
    const rooms = await getOpenWatchRooms();
    return NextResponse.json(rooms);
  } catch (e) {
    console.error(e);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, inviteOnly } = await req.json().catch(() => ({}));
  const id = genId();
  const roomName = name?.trim() || `${session.user.name ?? "Someone"}'s Room`;

  try {
    await createWatchRoom(id, session.user.id, roomName, session.user.name ?? "user", session.user.image ?? null, !!inviteOnly);
    return NextResponse.json({ id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create room" }, { status: 500 });
  }
}
