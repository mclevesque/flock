import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getWaddabiLobbies, createWaddabiRoom, cleanupIdleWaddabiRooms } from "@/lib/db";

function genId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function GET() {
  cleanupIdleWaddabiRooms().catch(() => {});
  const lobbies = await getWaddabiLobbies().catch(() => []);
  return NextResponse.json({ lobbies });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = (body.name as string)?.slice(0, 40) || `${session.user.name ?? "Player"}'s WADDABI`;

  const id = genId();
  await createWaddabiRoom(id, session.user.id, name);
  return NextResponse.json({ id });
}
