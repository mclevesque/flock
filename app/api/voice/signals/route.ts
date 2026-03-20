import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { storeVoiceSignal, getVoiceSignals } from "@/lib/db";

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// GET /api/voice/signals?roomId=X&after=TIMESTAMP
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json([], { status: 200 });

  const { searchParams } = new URL(req.url);
  const roomId = searchParams.get("roomId") ?? "";
  const after = parseInt(searchParams.get("after") ?? "0");

  try {
    const signals = await getVoiceSignals(roomId, session.user.id, after);
    return NextResponse.json(signals);
  } catch (e) {
    console.error(e);
    return NextResponse.json([]);
  }
}

// POST /api/voice/signals — store a WebRTC signal
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { roomId, toUserId, type, payload } = await req.json().catch(() => ({}));
  if (!roomId || !toUserId || !type || !payload) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  try {
    const id = genId();
    await storeVoiceSignal(id, roomId, session.user.id, toUserId, type, JSON.stringify(payload));
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
