import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getFriendsWithOnline,
  getPendingIncoming,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  getUserByUsername,
} from "@/lib/db";
import { getRecord } from "@/lib/draftmasters/db";

/**
 * Everything the DraftMasters social pages need, in one round trip.
 *
 * The hub has friends, requests, presence and records spread across four
 * endpoints because four different screens wanted four different shapes. This
 * game has three small pages and they all want the same thing: who do I know,
 * who is online, and how have they been doing. One call, one shape.
 *
 * Records travel WITH the friends rather than after them. A friends list on a
 * game site that does not say how good anybody is at the game is an address
 * book.
 */

export async function GET() {
  const session = await auth();
  const me = session?.user?.id;
  if (!me) return NextResponse.json({ friends: [], pending: [] });

  try {
    const [friends, pending] = await Promise.all([
      getFriendsWithOnline(me),
      getPendingIncoming(me).catch(() => []),
    ]);

    const withRecords = await Promise.all(
      (friends as Record<string, unknown>[]).map(async (f) => ({
        id: f.id,
        username: f.username,
        displayName: f.display_name ?? f.username,
        avatar: f.avatar_url ?? null,
        online: !!f.is_online,
        record: await getRecord(String(f.id)).catch(() => null),
      }))
    );

    return NextResponse.json({ friends: withRecords, pending });
  } catch {
    return NextResponse.json({ friends: [], pending: [] });
  }
}

/** add / accept / decline, by username so the UI never handles an id. */
export async function POST(req: Request) {
  const session = await auth();
  const me = session?.user?.id;
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    action?: "add" | "accept" | "decline";
    username?: string;
    userId?: string;
  };

  try {
    if (body.action === "add") {
      const name = (body.username ?? "").trim().toLowerCase();
      if (!name) return NextResponse.json({ error: "Who?" }, { status: 400 });
      const them = await getUserByUsername(name);
      if (!them) return NextResponse.json({ error: `No player called ${name}.` }, { status: 404 });
      if (String(them.id) === me) {
        return NextResponse.json({ error: "That is you." }, { status: 400 });
      }
      await sendFriendRequest(me, String(them.id));
      return NextResponse.json({ ok: true });
    }

    const other = String(body.userId ?? "");
    if (!other) return NextResponse.json({ error: "Who?" }, { status: 400 });
    if (body.action === "accept") await acceptFriendRequest(other, me);
    else if (body.action === "decline") await declineFriendRequest(other, me);
    else return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "That did not work." }, { status: 500 });
  }
}
