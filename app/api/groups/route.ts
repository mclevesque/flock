import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getGroupChats, createGroupChat } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });
  try {
    const groups = await getGroupChats(session.user.id);
    return NextResponse.json(groups);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name, memberIds } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
  try {
    const groupId = await createGroupChat(name.trim(), session.user.id, memberIds ?? []);
    return NextResponse.json({ id: groupId });
  } catch {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
