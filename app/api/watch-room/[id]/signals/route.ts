import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { storeScreenShareSignal, getScreenShareSignals } from "@/lib/db";
import { pushNotification } from "@/lib/pushNotification";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const afterId = parseInt(req.nextUrl.searchParams.get("after") ?? "0");
  try {
    const signals = await getScreenShareSignals(id, session.user.id, afterId);
    return NextResponse.json({ signals });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ signals: [] });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { toUser, type, payload } = await req.json().catch(() => ({}));
  if (!toUser || !type) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  try {
    const sigId = await storeScreenShareSignal(id, session.user.id, toUser, type, payload ?? {});
    // Push signal to recipient via PartyKit for instant delivery
    pushNotification(toUser, {
      type: "screen-signal",
      signalId: sigId,
      roomId: id,
      fromUserId: session.user.id,
      signalType: type,
      payload: payload ?? {},
    });
    return NextResponse.json({ ok: true, id: sigId });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
