import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createDrawRoom, getPublicDrawRooms } from "@/lib/db";

export async function GET() {
  const rooms = await getPublicDrawRooms();
  return NextResponse.json(rooms);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { title, isPublic } = await req.json();
  const id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const room = await createDrawRoom(id, session.user.id, title || "Untitled Drawing", isPublic !== false);
  return NextResponse.json(room);
}
