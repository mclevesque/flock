import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getWatchRoom, getWatchRoomMembers, joinWatchRoom,
  heartbeatWatchRoom, syncWatchRoom,
  setWatchRoomScreenSharing, storeScreenShareSignal, closeWatchRoom,
  setWatchRoomInviteOnly, cleanupIdleWatchRooms,
} from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id;

  cleanupIdleWatchRooms().catch(() => {});

  try {
    const [room, members] = await Promise.all([getWatchRoom(id), getWatchRoomMembers(id)]);
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    if (userId) {
      await heartbeatWatchRoom(id, userId).catch(() => {});
    }

    return NextResponse.json({ room, members });
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
  const { action, streamUrl, isPlaying, position } = body as {
    action: string;
    streamUrl?: string;
    isPlaying?: boolean;
    position?: number;
  };

  try {
    if (action === "join") {
      await joinWatchRoom(id, userId, session.user.name ?? "user", session.user.image ?? null);
      return NextResponse.json({ ok: true });
    }

    if (action === "sync") {
      await syncWatchRoom(id, userId, { streamUrl, isPlaying, position });
      return NextResponse.json({ ok: true });
    }

    if (action === "screen-share-start") {
      await setWatchRoomScreenSharing(id, true);
      return NextResponse.json({ ok: true });
    }

    if (action === "screen-share-stop") {
      await setWatchRoomScreenSharing(id, false);
      // Broadcast stop to all active members
      const members = await getWatchRoomMembers(id).catch(() => []);
      for (const m of members as { user_id: string }[]) {
        if (m.user_id !== userId) {
          await storeScreenShareSignal(id, userId, m.user_id, "screen-stop", {}).catch(() => {});
        }
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "set-invite-only") {
      const { inviteOnly } = body as { inviteOnly: boolean };
      await setWatchRoomInviteOnly(id, userId, !!inviteOnly);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await closeWatchRoom(id, session.user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
