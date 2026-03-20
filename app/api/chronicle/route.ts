import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getChronicleEntries, createChronicleEntry, getUserById } from "@/lib/db";
import { moderateFields } from "@/lib/moderation";

export async function GET(req: NextRequest) {
  const session = await auth();
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") ?? undefined;
  const offset = parseInt(searchParams.get("offset") ?? "0");
  const limit = 20;

  const entries = await getChronicleEntries(session?.user?.id ?? null, { userId, limit, offset }).catch(() => []);
  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as { id: string; name?: string | null; image?: string | null };

  const { title, body, mood, visibility } = await req.json();
  if (!title?.trim() || !body?.trim()) return NextResponse.json({ error: "Title and body required" }, { status: 400 });

  const mod = moderateFields(title, body);
  if (!mod.ok) return NextResponse.json({ error: mod.reason }, { status: 400 });

  const dbUser = await getUserById(u.id).catch(() => null);
  const avatarUrl = (dbUser as Record<string, unknown> | null)?.avatar_url as string | null ?? u.image ?? null;

  const id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const entry = await createChronicleEntry(
    id, u.id, u.name ?? "user", avatarUrl,
    title.trim().slice(0, 200),
    body.trim().slice(0, 50000),
    mood ?? null,
    ["public", "friends", "private"].includes(visibility) ? visibility : "friends"
  );
  return NextResponse.json(entry);
}
