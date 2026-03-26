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
  await sendMessage(session.user.id, receiverId, content);
  // Push notification to recipient
  import("@/lib/pushNotification").then(({ pushNotification }) =>
    pushNotification(receiverId, {
      type: "new-message",
      from: { userId: session.user!.id, username: session.user!.name || "Someone" },
      preview: typeof content === "string" ? content.slice(0, 60) : "New message",
    })
  ).catch(() => {});
  return NextResponse.json({ ok: true });
}
