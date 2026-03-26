import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getUserByUsername, getUserByEmail, setPasswordResetToken } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const { identifier } = await req.json(); // username or email
  if (!identifier || identifier.trim().length < 2) {
    return NextResponse.json({ error: "Enter your username or email." }, { status: 400 });
  }

  const clean = identifier.trim().toLowerCase();

  // Look up by email first, then username
  let user = clean.includes("@") ? await getUserByEmail(clean) : null;
  if (!user) user = await getUserByUsername(clean);

  // Always return success to prevent user enumeration
  if (!user || !user.email) {
    return NextResponse.json({ ok: true, message: "If an account with that username/email exists, a reset link has been sent." });
  }

  // Generate token + 1 hour expiry
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await setPasswordResetToken(user.id as string, token, expires);

  const origin = req.headers.get("origin") ?? req.nextUrl.origin;
  const resetUrl = `${origin}/reset-password?token=${token}`;

  await sendPasswordResetEmail(user.email as string, (user.username ?? user.display_name ?? "user") as string, resetUrl);

  return NextResponse.json({ ok: true, message: "If an account with that username/email exists, a reset link has been sent." });
}
