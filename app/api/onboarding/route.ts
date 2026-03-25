import { NextRequest, NextResponse } from "next/server";
import { auth as clerkAuth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { getUserByUsername, createUser, updateUser, sql } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { userId } = await clerkAuth();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json();
  const raw = (body.username as string ?? "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  const avatarUrl: string | null = body.avatarUrl ?? null;

  if (!raw || raw.length < 2 || raw.length > 20) {
    return NextResponse.json({ error: "Username must be 2–20 characters (letters, numbers, underscores)." }, { status: 400 });
  }

  // Username taken?
  const existing = await getUserByUsername(raw).catch(() => null);
  if (existing) {
    return NextResponse.json({ error: "That username is already taken." }, { status: 400 });
  }

  // Create user in DB — if record already exists (e.g. Clerk auto-created with generic ID),
  // force-update username/display_name/avatar so onboarding always wins
  await createUser(userId, raw, raw, avatarUrl ?? "");
  await updateUser(userId, { username: raw, display_name: raw, ...(avatarUrl ? { avatar_url: avatarUrl } : {}) });

  // Create privileges row
  await sql`
    INSERT INTO user_privileges (user_id, snes_access)
    VALUES (${userId}, FALSE)
    ON CONFLICT (user_id) DO NOTHING
  `.catch(() => {});

  // Store username + avatar in Clerk publicMetadata so auth() can read it without DB
  const clerk = await clerkClient();
  await clerk.users.updateUserMetadata(userId, {
    publicMetadata: {
      username: raw,
      avatar_url: avatarUrl ?? "",
    },
  });

  // Set a short-lived bypass cookie so middleware lets the user through
  // while Clerk propagates the new publicMetadata to the JWT
  const res = NextResponse.json({ ok: true });
  res.cookies.set("clerk_onboarded", "1", { maxAge: 60 * 60 * 24 * 30, path: "/", httpOnly: true, sameSite: "lax" });
  return res;
}
