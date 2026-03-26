import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUserByUsername, updatePasswordHash, sql } from "@/lib/db";

// One-time bootstrap endpoint to set mclevesque's password
// Protected by a secret token in the URL — delete this file after use
const BOOTSTRAP_SECRET = "ryft-bootstrap-2026";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const newPassword = req.nextUrl.searchParams.get("pw");

  if (secret !== BOOTSTRAP_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  if (!newPassword || newPassword.length < 3) {
    return NextResponse.json({ error: "Add ?pw=yourpassword to the URL" }, { status: 400 });
  }

  // Ensure columns exist
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT`.catch(() => {});
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token TEXT`.catch(() => {});
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP`.catch(() => {});

  const user = await getUserByUsername("mclevesque");
  if (!user) {
    return NextResponse.json({ error: "User mclevesque not found" }, { status: 404 });
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await updatePasswordHash(user.id as string, hash);

  return NextResponse.json({ ok: true, message: "Password set for mclevesque. Delete this file now!" });
}
