import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUserByUsername, sql } from "@/lib/db";

const BOOTSTRAP_SECRET = "ryft-bootstrap-2026";

export async function GET(req: NextRequest) {
  try {
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
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`.catch(() => {});
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token TEXT`.catch(() => {});
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP`.catch(() => {});

    const user = await getUserByUsername("mclevesque");
    if (!user) {
      return NextResponse.json({ error: "User mclevesque not found" }, { status: 404 });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    // Simple update that only touches password_hash
    await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${user.id}`;

    return NextResponse.json({ ok: true, message: "Password set for mclevesque." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
