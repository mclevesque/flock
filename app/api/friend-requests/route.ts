import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getPendingIncoming, getPendingOutgoing, getSuggestedUsers,
  sendFriendRequest, acceptFriendRequest, declineFriendRequest,
  getUserByUsername, getFriendshipStatus
} from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({}, { status: 401 });
  const id = session.user.id;
  const [incoming, outgoing, suggested] = await Promise.all([
    getPendingIncoming(id),
    getPendingOutgoing(id),
    getSuggestedUsers(id),
  ]);
  return NextResponse.json({ incoming, outgoing, suggested });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({}, { status: 401 });
  const { action, targetId, targetUsername, requesterId } = await req.json();

  if (action === "send") {
    let toId = targetId;
    if (!toId && targetUsername) {
      const u = await getUserByUsername(targetUsername.toLowerCase().trim());
      if (!u) return NextResponse.json({ error: "User not found" }, { status: 404 });
      toId = u.id;
    }
    if (toId === session.user.id) return NextResponse.json({ error: "Can't add yourself" }, { status: 400 });
    const existing = await getFriendshipStatus(session.user.id, toId);
    if (existing) return NextResponse.json({ error: existing.status === "accepted" ? "Already friends" : "Request already sent" }, { status: 400 });
    await sendFriendRequest(session.user.id, toId);
    return NextResponse.json({ ok: true });
  }

  if (action === "accept") {
    await acceptFriendRequest(requesterId, session.user.id);
    return NextResponse.json({ ok: true });
  }

  if (action === "decline") {
    await declineFriendRequest(requesterId, session.user.id);
    return NextResponse.json({ ok: true });
  }

  if (action === "cancel") {
    await declineFriendRequest(session.user.id, targetId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
