import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createShare, getShareFeedForUser, getShareFeed, getFriendCount, getUserById } from "@/lib/db";
import { moderateFields } from "@/lib/moderation";

export async function GET(req: NextRequest) {
  const session = await auth();
  const url = new URL(req.url);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");
  const limit = 24;

  if (session?.user?.id) {
    const [shares, friendCount] = await Promise.all([
      getShareFeedForUser(session.user.id, limit, offset),
      getFriendCount(session.user.id).catch(() => 0),
    ]);
    return NextResponse.json({ shares, friendCount });
  }

  const shares = await getShareFeed(limit, offset);
  return NextResponse.json({ shares, friendCount: 0 });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as { id: string; name?: string | null; image?: string | null };
  const body = await req.json();
  const { type, title, caption, imageData, imageUrl, videoUrl, gameData } = body;
  if (!type) return NextResponse.json({ error: "type required" }, { status: 400 });

  // Text moderation
  const mod = moderateFields(title, caption);
  if (!mod.ok) return NextResponse.json({ error: mod.reason }, { status: 400 });

  const dbUser = await getUserById(u.id).catch(() => null);
  const avatarUrl = (dbUser as Record<string, unknown> | null)?.avatar_url as string | null ?? u.image ?? null;
  const id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const share = await createShare(id, u.id, u.name ?? "user", avatarUrl, type, title ?? null, caption ?? null, imageData ?? null, videoUrl ?? null, gameData ?? null, imageUrl ?? null);
  return NextResponse.json(share);
}
