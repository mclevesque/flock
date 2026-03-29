import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { getMessages, sendMessage, getConversations, sql } from "@/lib/db";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const otherId = searchParams.get("with");

  if (otherId) {
    const messages = await getMessages(session.user.id, otherId);
    return NextResponse.json(messages);
  }
  const conversations = await getConversations(session.user.id);
  return NextResponse.json(conversations);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  // Only delete your own messages — no trace left
  await sql`DELETE FROM direct_messages WHERE id = ${id} AND sender_id = ${session.user.id}`;
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { receiverId, content } = await req.json();
  if (!receiverId || !content) return NextResponse.json({ error: "receiverId and content required" }, { status: 400 });
  let savedRow: { id: number; created_at: string } | undefined;
  try {
    savedRow = await sendMessage(session.user.id, receiverId, content);
  } catch (e) {
    console.error("sendMessage DB error:", e);
    return NextResponse.json({ error: "DB write failed" }, { status: 500 });
  }
  // Push full message to both recipient and sender (for multi-tab sync) via PartyKit
  const msgPayload = {
    type: "new-message",
    from: { userId: session.user!.id, username: session.user!.name || "Someone", avatarUrl: session.user!.image || "" },
    preview: typeof content === "string" ? content.slice(0, 60) : "New message",
    content,
    senderId: session.user!.id,
    receiverId,
    timestamp: Date.now(),
    messageId: savedRow?.id,
    createdAt: savedRow?.created_at,
  };
  import("@/lib/pushNotification").then(({ pushNotification }) => {
    pushNotification(receiverId, msgPayload);
    pushNotification(session.user!.id!, msgPayload); // sender's other tabs
  }).catch(() => {});
  return NextResponse.json({ ok: true, message: { id: savedRow?.id, created_at: savedRow?.created_at } });
}
