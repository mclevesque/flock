import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getGroupMessages, sendGroupMessage, sql } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });
  const { id } = await params;
  try {
    const messages = await getGroupMessages(parseInt(id));
    return NextResponse.json(messages);
  } catch {
    return NextResponse.json([]);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: groupId } = await params;
  const { id: msgId } = await req.json();
  if (!msgId) return NextResponse.json({ error: "id required" }, { status: 400 });
  await sql`DELETE FROM group_chat_messages WHERE id = ${msgId} AND user_id = ${session.user.id} AND group_id = ${parseInt(groupId)}`;
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { content } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: "Empty message" }, { status: 400 });
  try {
    await sendGroupMessage(parseInt(id), session.user.id, content.trim());
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
