import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createVoiceRoom, getActiveVoiceRooms, getVoiceRoomByDmPair, getIncomingDmCallsForUser } from "@/lib/db";

function genId() {
  return Math.random().toString(36).slice(2, 9).toUpperCase();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dmPair = searchParams.get("dm_pair");
  const incoming = searchParams.get("incoming");

  // Return a specific DM room by dm_pair
  if (dmPair) {
    try {
      const room = await getVoiceRoomByDmPair(dmPair);
      return NextResponse.json(room ? [room] : []);
    } catch {
      return NextResponse.json([]);
    }
  }

  // Return incoming DM calls for current user
  if (incoming) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json([]);
    try {
      const calls = await getIncomingDmCallsForUser(session.user.id);
      return NextResponse.json(calls);
    } catch {
      return NextResponse.json([]);
    }
  }

  try {
    const rooms = await getActiveVoiceRooms();
    return NextResponse.json(rooms);
  } catch (e) {
    console.error(e);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, type, dmPair } = await req.json().catch(() => ({}));
  const id = genId();
  const roomName = name?.trim() || `${session.user.name ?? "User"}'s Room`;

  try {
    await createVoiceRoom(id, session.user.id, roomName, type ?? "open", dmPair);
    return NextResponse.json({ id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
