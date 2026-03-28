import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserByUsername, sql } from "@/lib/db";

const ADMIN_USERNAME = "mclevesque";

// GET: list all gs_portal users
export async function GET() {
  const session = await auth();
  if (!session?.user?.name || session.user.name !== ADMIN_USERNAME) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const users = await sql`SELECT username, gs_portal, avatar_url, email, password_hash IS NOT NULL as has_password FROM users WHERE gs_portal = TRUE`;
  return NextResponse.json({ users });
}

// POST: toggle gs_portal flag for a user
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.name || session.user.name !== ADMIN_USERNAME) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { username, enabled } = await req.json();
  if (!username) return NextResponse.json({ error: "username required" }, { status: 400 });

  const user = await getUserByUsername(username.trim().toLowerCase());
  if (!user) return NextResponse.json({ error: `User "${username}" not found.` }, { status: 404 });

  const flag = enabled !== false; // default to true
  await sql`UPDATE users SET gs_portal = ${flag} WHERE id = ${user.id as string}`;

  return NextResponse.json({ ok: true, message: `gs_portal ${flag ? "enabled" : "disabled"} for "${username}".` });
}
