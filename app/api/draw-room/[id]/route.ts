import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getDrawRoom, updateDrawSnapshot, closeDrawRoom, setDrawRoomViewers,
  heartbeatDrawViewer, getDrawRoomViewers, bootDrawViewer,
  addDrawMessage, getDrawMessages,
  grantDrawCollaboration, revokeDrawCollaboration, cleanupIdleDrawRooms,
} from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  cleanupIdleDrawRooms().catch(() => {});
  const session = await auth();
  const { id } = await params;
  const room = await getDrawRoom(id);
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [viewers, messages] = await Promise.all([
    getDrawRoomViewers(id),
    getDrawMessages(id),
  ]);

  // Heartbeat viewer if logged in and not host
  if (session?.user?.id && session.user.id !== room.host_id) {
    const u = session.user as { id: string; name?: string | null; image?: string | null };
    heartbeatDrawViewer(id, u.id, u.name ?? "artist", u.image ?? "").catch(() => {});
  }

  return NextResponse.json({
    ...room,
    viewers,
    messages: messages.slice(-80),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const { action } = body;
  const u = session.user as { id: string; name?: string | null; image?: string | null };

  if (action === "snapshot") {
    if (!body.snapshot) return NextResponse.json({ error: "No snapshot" }, { status: 400 });
    await updateDrawSnapshot(id, u.id, body.snapshot);
    return NextResponse.json({ ok: true });
  }

  if (action === "close") {
    await closeDrawRoom(id, u.id);
    return NextResponse.json({ ok: true });
  }

  if (action === "set-viewers") {
    await setDrawRoomViewers(id, u.id, !!body.allow);
    return NextResponse.json({ ok: true });
  }

  if (action === "boot") {
    const ok = await bootDrawViewer(id, u.id, body.userId);
    return NextResponse.json({ ok });
  }

  if (action === "message") {
    if (!body.content?.trim()) return NextResponse.json({ error: "Empty" }, { status: 400 });
    const msg = await addDrawMessage(id, u.id, u.name ?? "artist", u.image ?? null, body.content.trim().slice(0, 500));
    return NextResponse.json(msg);
  }

  if (action === "heartbeat") {
    await heartbeatDrawViewer(id, u.id, u.name ?? "artist", u.image ?? "");
    return NextResponse.json({ ok: true });
  }

  if (action === "grant-collab") {
    const ok = await grantDrawCollaboration(id, u.id, body.userId);
    return NextResponse.json({ ok });
  }

  if (action === "revoke-collab") {
    const ok = await revokeDrawCollaboration(id, u.id, body.userId);
    return NextResponse.json({ ok });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const u = session.user as { id: string };
  await closeDrawRoom(id, u.id);
  return NextResponse.json({ ok: true });
}
