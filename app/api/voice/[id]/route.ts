import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getVoiceRoom, getVoiceParticipants, joinVoiceRoom,
  leaveVoiceRoom, heartbeatVoice, setVoiceMuted, closeVoiceRoom,
  addVoiceRoomMessage, getVoiceRoomMessages, cleanupIdleVoiceRooms,
} from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await auth();
  const { searchParams } = new URL(req.url);

  if (searchParams.get("messages") === "1") {
    const msgs = await getVoiceRoomMessages(id);
    return NextResponse.json(msgs);
  }

  cleanupIdleVoiceRooms().catch(() => {});

  try {
    const [room, participants] = await Promise.all([
      getVoiceRoom(id),
      getVoiceParticipants(id),
    ]);
    if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (session?.user?.id) {
      heartbeatVoice(id, session.user.id).catch(() => {});
    }
    return NextResponse.json({ room, participants });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const body = await req.json().catch(() => ({}));
  const { action, muted, content } = body;

  try {
    if (action === "join") {
      await joinVoiceRoom(id, userId, session.user.name ?? "User", session.user.image ?? null);
      return NextResponse.json({ ok: true });
    }
    if (action === "leave") {
      await leaveVoiceRoom(id, userId);
      return NextResponse.json({ ok: true });
    }
    if (action === "mute") {
      await setVoiceMuted(id, userId, muted === true);
      await heartbeatVoice(id, userId);
      return NextResponse.json({ ok: true });
    }
    if (action === "heartbeat") {
      await heartbeatVoice(id, userId);
      return NextResponse.json({ ok: true });
    }
    if (action === "close") {
      await closeVoiceRoom(id, userId);
      return NextResponse.json({ ok: true });
    }
    if (action === "sendMessage") {
      if (!content) return NextResponse.json({ error: "content required" }, { status: 400 });
      const msg = await addVoiceRoomMessage(
        id, userId, session.user.name ?? "User", session.user.image ?? null, String(content)
      );
      return NextResponse.json(msg);
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
