import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getWallPosts, addWallPost, getUserById } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });
  const profileId = new URL(req.url).searchParams.get("profileId");
  if (!profileId) return NextResponse.json([], { status: 400 });
  const posts = await getWallPosts(profileId).catch(() => []);
  return NextResponse.json(posts);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { content, profileId } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: "Empty content" }, { status: 400 });

  // Default profileId to the current user's own profile (wall post on own page)
  const targetProfileId = profileId || session.user.id;

  // Verify target exists
  const target = await getUserById(targetProfileId).catch(() => null);
  if (!target) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  try {
    await addWallPost(session.user.id, targetProfileId, content.trim());
    // Return the new post with author info
    const posts = await getWallPosts(targetProfileId);
    return NextResponse.json(posts[0] ?? { ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 429 });
  }
}
