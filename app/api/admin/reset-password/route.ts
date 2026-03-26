import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { getUserByUsername, updatePasswordHash } from "@/lib/db";

// Admin-only endpoint: reset any user's password
// Only mclevesque can use this
const ADMIN_USERNAME = "mclevesque";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.name || session.user.name !== ADMIN_USERNAME) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { username, newPassword } = await req.json();
  if (!username || !newPassword || newPassword.length < 3) {
    return NextResponse.json({ error: "Username and newPassword (3+ chars) required." }, { status: 400 });
  }

  const user = await getUserByUsername(username.trim().toLowerCase());
  if (!user) {
    return NextResponse.json({ error: `User "${username}" not found.` }, { status: 404 });
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await updatePasswordHash(user.id as string, hash);

  return NextResponse.json({ ok: true, message: `Password reset for "${username}".` });
}
