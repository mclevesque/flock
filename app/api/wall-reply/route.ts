import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { addWallReply, editWallReply, getWallReplies, getWallRepliesBatch, getWallPostOwner, getUserReplyPrivacy, areFriends, deleteWallReply } from "@/lib/db";
import { moderateText } from "@/lib/moderation";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  // Batch fetch: ?postIds=1,2,3 → returns { [postId]: WallReply[] }
  const postIdsParam = url.searchParams.get("postIds");
  if (postIdsParam) {
    const ids = postIdsParam.split(",").map(Number).filter(n => n > 0);
    if (!ids.length) return NextResponse.json({});
    const allReplies = await getWallRepliesBatch(ids).catch(() => []);
    const grouped: Record<number, unknown[]> = {};
    for (const r of allReplies as { post_id: number }[]) {
      if (!grouped[r.post_id]) grouped[r.post_id] = [];
      grouped[r.post_id].push(r);
    }
    return NextResponse.json(grouped);
  }
  // Single fetch: ?postId=1
  const postId = Number(url.searchParams.get("postId"));
  if (!postId) return NextResponse.json([], { status: 400 });
  const replies = await getWallReplies(postId);
  return NextResponse.json(replies);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.id === "warrior_guest") return NextResponse.json({ error: "Guest accounts cannot reply." }, { status: 403 });
  const { postId, content, parentId } = await req.json().catch(() => ({}));
  if (!postId || !content?.trim()) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  // Text moderation
  const mod = moderateText(content);
  if (!mod.ok) return NextResponse.json({ error: mod.reason }, { status: 400 });

  // Check reply privacy
  const ownerId = await getWallPostOwner(Number(postId));
  if (ownerId && ownerId !== session.user.id) {
    const privacy = await getUserReplyPrivacy(ownerId);
    if (privacy === "friends_only") {
      const friends = await areFriends(session.user.id, ownerId);
      if (!friends) return NextResponse.json({ error: "Only friends can reply" }, { status: 403 });
    }
  }

  try {
    await addWallReply(Number(postId), session.user.id, content.trim().slice(0, 500), parentId ? Number(parentId) : null);
    const replies = await getWallReplies(Number(postId));
    return NextResponse.json(replies);
  } catch (e) {
    console.error("wall-reply POST error:", e);
    return NextResponse.json({ error: "Failed to save reply" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const ok = await deleteWallReply(id, session.user.id);
  if (!ok) return NextResponse.json({ error: "Not found or not authorized" }, { status: 403 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, content } = await req.json().catch(() => ({}));
  if (!id || !content?.trim()) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  const mod = moderateText(content);
  if (!mod.ok) return NextResponse.json({ error: mod.reason }, { status: 400 });
  const ok = await editWallReply(Number(id), session.user.id, content.trim().slice(0, 500));
  if (!ok) return NextResponse.json({ error: "Not found or not authorized" }, { status: 403 });
  return NextResponse.json({ ok: true });
}
