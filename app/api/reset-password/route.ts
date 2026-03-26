import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUserByResetToken, updatePasswordHash } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { token, newPassword } = await req.json();

  if (!token) return NextResponse.json({ error: "Missing reset token." }, { status: 400 });
  if (!newPassword || newPassword.length < 3) return NextResponse.json({ error: "Password must be at least 3 characters." }, { status: 400 });

  const user = await getUserByResetToken(token);
  if (!user) {
    return NextResponse.json({ error: "Invalid or expired reset link. Request a new one." }, { status: 400 });
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await updatePasswordHash(user.id as string, hash);

  return NextResponse.json({ ok: true, message: "Password updated! You can now sign in." });
}
