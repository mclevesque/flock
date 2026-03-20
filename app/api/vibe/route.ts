import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getVibeInterests, setVibeInterests, getVibeInterestsByUsername } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username");

  // Public: fetch another user's vibe tags by username
  if (username) {
    const interests = await getVibeInterestsByUsername(username).catch(() => []);
    return NextResponse.json({ interests });
  }

  // Private: fetch own vibe tags
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ interests: [] });
  const interests = await getVibeInterests(session.user.id).catch(() => []);
  return NextResponse.json({ interests });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { interests } = await req.json();
  if (!Array.isArray(interests)) return NextResponse.json({ error: "interests must be array" }, { status: 400 });
  await setVibeInterests(session.user.id, interests.slice(0, 8));
  return NextResponse.json({ ok: true });
}
