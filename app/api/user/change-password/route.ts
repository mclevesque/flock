import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import bcrypt from "bcryptjs";
import { getUserById, sql } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { currentPassword, newPassword } = await req.json();
  if (!currentPassword || !newPassword || newPassword.length < 3) {
    return NextResponse.json({ error: "New password must be at least 3 characters." }, { status: 400 });
  }

  const user = await getUserById(session.user.id);
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  // gs_portal users without a password can set one without providing current
  if (!user.password_hash && user.gs_portal) {
    const hash = await bcrypt.hash(newPassword, 10);
    await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${session.user.id}`;
    return NextResponse.json({ ok: true });
  }

  if (!user.password_hash) {
    return NextResponse.json({ error: "No password set. Contact admin." }, { status: 400 });
  }

  const valid = await bcrypt.compare(currentPassword, user.password_hash as string);
  if (!valid) return NextResponse.json({ error: "Current password is wrong." }, { status: 403 });

  const hash = await bcrypt.hash(newPassword, 10);
  await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${session.user.id}`;
  return NextResponse.json({ ok: true });
}
