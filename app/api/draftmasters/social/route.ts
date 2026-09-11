import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getFriendsWithOnline,
  getPendingIncoming,
  getFriendshipStatus,
  getConversations,
  getUserById,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  getUserByUsername,
  sendMessage,
  updateLastSeen,
} from "@/lib/db";
import { getRecord } from "@/lib/draftmasters/db";
import { chatGif, isHubOnly } from "@/lib/draftmasters/chat-text";
import {
  getActiveRoom,
  getChat,
  inDraftAmong,
  markChatRead,
  setActiveRoom,
  unreadByFriend,
} from "@/lib/draftmasters/social";
import { inviteToken, normaliseRoomCode, parseInvite } from "@/lib/draftmasters/invite";
import { pushNotification } from "@/lib/pushNotification";
import { avatarSrc } from "@/lib/avatars";

/**
 * Everything the DraftMasters social layer needs, in one route.
 *
 * The hub has friends, requests, presence, messages and records spread across
 * five endpoints because five different screens wanted five different shapes.
 * This game has one drawer and it wants the same thing every time it opens:
 * who do I know, who is around, what have they said, and how good are they.
 *
 *   GET                 friends + requests + my active room
 *   GET ?with=<id>      the conversation with one friend (and marks it read)
 *   POST { action }     add / accept / decline / say / invite / read / room
 *
 * Records travel WITH the friends rather than after them. A friends list on a
 * game site that does not say how good anybody is at the game is an address
 * book.
 */

const EMPTY = { me: null, friends: [], pending: [], activeRoom: null };

export async function GET(req: Request) {
  const session = await auth();
  const me = session?.user?.id;
  if (!me) return NextResponse.json(EMPTY);

  const withId = new URL(req.url).searchParams.get("with");

  try {
    if (withId) {
      if ((await getFriendshipStatus(me, withId))?.status !== "accepted") {
        return NextResponse.json({ messages: [] }, { status: 403 });
      }
      const [messages] = await Promise.all([getChat(me, withId), markChatRead(me, withId).catch(() => {})]);
      return NextResponse.json({ messages });
    }

    // Opening the drawer is being here. The hub's heartbeat does not run on
    // the game's own domain, so without this nobody on draftmasters.net would
    // ever show as online.
    void updateLastSeen(me);

    const [meRow, friends, pending, unread, conversations, activeRoom] = await Promise.all([
      getUserById(me).catch(() => null),
      getFriendsWithOnline(me),
      getPendingIncoming(me).catch(() => []),
      unreadByFriend(me).catch(() => new Map<string, number>()),
      getConversations(me).catch(() => []),
      getActiveRoom(me).catch(() => null),
    ]);

    const ids = (friends as Record<string, unknown>[]).map((f) => String(f.id));
    const drafting = await inDraftAmong(ids).catch(() => new Set<string>());
    const lastBy = new Map(
      (conversations as Record<string, unknown>[]).map((c) => [String(c.other_user), c])
    );

    const withRecords = await Promise.all(
      (friends as Record<string, unknown>[]).map(async (f) => {
        const id = String(f.id);
        const last = lastBy.get(id);
        const lastText = last ? String(last.last_message ?? "") : "";
        return {
          id,
          username: String(f.username),
          displayName: String(f.display_name ?? f.username),
          avatar: avatarSrc(f.avatar_url as string | null, id),
          online: !!f.is_online,
          inDraft: drafting.has(id),
          unread: unread.get(id) ?? 0,
          // A quiz or party invite is the hub's business; it is not a last
          // message worth previewing here.
          last: last && !isHubOnly(lastText)
            ? {
                text: parseInvite(lastText) ? "Draft invite" : chatGif(lastText) ? "GIF" : lastText.slice(0, 80),
                fromMe: String(last.last_sender_id) === me,
                at: new Date(last.created_at as string).toISOString(),
              }
            : null,
          record: await getRecord(id).catch(() => null),
        };
      })
    );

    // Unread first, then whoever is around, then the most recent conversation.
    withRecords.sort(
      (a, b) =>
        Number(b.unread > 0) - Number(a.unread > 0) ||
        Number(b.inDraft || b.online) - Number(a.inDraft || a.online) ||
        (b.last?.at ?? "").localeCompare(a.last?.at ?? "") ||
        a.displayName.localeCompare(b.displayName)
    );

    return NextResponse.json({
      me: meRow
        ? {
            id: me,
            username: String(meRow.username),
            displayName: String(meRow.display_name ?? meRow.username),
            avatar: avatarSrc(meRow.avatar_url as string | null, me),
          }
        : null,
      friends: withRecords,
      pending: (pending as Record<string, unknown>[]).map((p) => ({
        id: String(p.id),
        username: String(p.username),
        displayName: String(p.display_name ?? p.username),
        avatar: avatarSrc(p.avatar_url as string | null, String(p.id)),
      })),
      activeRoom,
    });
  } catch {
    return NextResponse.json(EMPTY);
  }
}

type Body = {
  action?: "add" | "accept" | "decline" | "say" | "invite" | "ring" | "read" | "room";
  username?: string;
  userId?: string;
  userIds?: string[];
  text?: string;
  code?: string | null;
  host?: boolean;
};

export async function POST(req: Request) {
  const session = await auth();
  const me = session?.user?.id;
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const myName = session.user?.name ?? "Someone";

  try {
    switch (body.action) {
      case "add":
        return await addFriend(me, myName, body.username ?? "");

      case "accept":
      case "decline": {
        const other = String(body.userId ?? "");
        if (!other) return NextResponse.json({ error: "Who?" }, { status: 400 });
        if (body.action === "accept") {
          await acceptFriendRequest(other, me);
          pushNotification(other, { type: "friend-accepted", from: { userId: me, username: myName } });
        } else {
          await declineFriendRequest(other, me);
        }
        return NextResponse.json({ ok: true });
      }

      case "say": {
        const other = String(body.userId ?? "");
        let text = String(body.text ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
        if (!other || !text) return NextResponse.json({ error: "Say something." }, { status: 400 });
        if (!(await areFriends(me, other))) {
          return NextResponse.json({ error: "You can only message friends." }, { status: 403 });
        }
        // A typed "[draftmasters:ABCDE]" would render as a real invite card —
        // here and in the hub's messages page. Only the room sends those.
        // A zero-width space in front stops it matching; the text reads the same.
        if (/^\[[a-z]+:/i.test(text)) text = String.fromCharCode(0x200b) + text;
        const message = await deliver(me, myName, other, text, text.slice(0, 60));
        return NextResponse.json({ ok: true, message });
      }

      case "invite": {
        const code = normaliseRoomCode(body.code);
        if (!code) return NextResponse.json({ error: "That room code is not valid." }, { status: 400 });
        const targets = [...new Set((body.userIds ?? (body.userId ? [body.userId] : [])).map(String))].slice(0, 12);
        if (!targets.length) return NextResponse.json({ error: "Who?" }, { status: 400 });

        const sent: string[] = [];
        for (const other of targets) {
          if (other === me || !(await areFriends(me, other))) continue;
          await deliver(me, myName, other, inviteToken(code), `Draft invite · room ${code}`);
          sent.push(other);
        }
        if (!sent.length) return NextResponse.json({ error: "Nobody on that list is a friend." }, { status: 403 });
        return NextResponse.json({ ok: true, sent });
      }

      case "ring": {
        // "I'm in voice with you." Just a nudge: nothing is stored, and the
        // friend's drawer turns it into a one-tap Talk button.
        const other = String(body.userId ?? "");
        if (!other || !(await areFriends(me, other))) return NextResponse.json({ ok: false }, { status: 403 });
        const meRow = await getUserById(me).catch(() => null);
        pushNotification(other, {
          type: "dm-voice",
          from: { userId: me, username: myName, avatarUrl: avatarSrc(meRow?.avatar_url as string | null, me) },
          timestamp: Date.now(),
        });
        return NextResponse.json({ ok: true });
      }

      case "read": {
        const other = String(body.userId ?? "");
        if (other) await markChatRead(me, other);
        return NextResponse.json({ ok: true });
      }

      case "room": {
        const code = body.code === null ? null : normaliseRoomCode(body.code);
        if (body.code !== null && !code) return NextResponse.json({ error: "Bad room code." }, { status: 400 });
        await setActiveRoom(me, code, Boolean(body.host));
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (err) {
    console.error("[draftmasters/social]", err);
    return NextResponse.json({ error: "That did not work." }, { status: 500 });
  }
}

async function areFriends(a: string, b: string): Promise<boolean> {
  return (await getFriendshipStatus(a, b))?.status === "accepted";
}

/**
 * Store a message and tell both ends.
 *
 * The push has the same shape the hub's messages route sends, so the hub's
 * messages page and notification tray treat a message from the game exactly
 * like one of their own. The sender gets a copy too, for their other tabs.
 */
async function deliver(me: string, myName: string, to: string, content: string, preview: string) {
  const saved = await sendMessage(me, to, content);
  const meRow = await getUserById(me).catch(() => null);
  const payload = {
    type: "new-message",
    from: { userId: me, username: myName, avatarUrl: avatarSrc(meRow?.avatar_url as string | null, me) },
    preview,
    content,
    senderId: me,
    receiverId: to,
    timestamp: Date.now(),
    messageId: saved?.id,
    createdAt: saved?.created_at,
  };
  pushNotification(to, payload);
  pushNotification(me, payload);
  return {
    id: Number(saved?.id ?? Date.now()),
    from: me,
    to,
    text: content,
    at: saved?.created_at ? new Date(saved.created_at).toISOString() : new Date().toISOString(),
  };
}

/**
 * Add by username.
 *
 * If they already asked you, adding them back accepts it. The old version
 * sent a second request the other way, and two people who had each added the
 * other sat with two pending requests and no friendship until one of them
 * found the Accept button.
 */
async function addFriend(me: string, myName: string, raw: string) {
  const name = raw.trim().replace(/^@/, "").toLowerCase();
  if (!name) return NextResponse.json({ error: "Who?" }, { status: 400 });
  const them = await getUserByUsername(name);
  if (!them) return NextResponse.json({ error: `No player called ${name}.` }, { status: 404 });
  const themId = String(them.id);
  if (themId === me) return NextResponse.json({ error: "That is you." }, { status: 400 });

  const existing = await getFriendshipStatus(me, themId);
  if (existing?.status === "accepted") {
    return NextResponse.json({ ok: true, note: `You and ${name} are already friends.` });
  }
  if (existing && String(existing.requester_id) === themId) {
    await acceptFriendRequest(themId, me);
    pushNotification(themId, { type: "friend-accepted", from: { userId: me, username: myName } });
    return NextResponse.json({ ok: true, note: `You and ${name} are friends now.` });
  }

  await sendFriendRequest(me, themId);
  pushNotification(themId, { type: "friend-request", from: { userId: me, username: myName } });
  return NextResponse.json({ ok: true, note: `Asked ${name}. They show up here once they accept.` });
}
