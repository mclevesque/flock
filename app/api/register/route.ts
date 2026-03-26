import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUserByUsername, createUserWithPassword, sql } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { username, password, email } = await req.json();

  const clean = (username ?? "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (!clean || clean.length < 2) return NextResponse.json({ error: "Username must be at least 2 characters." }, { status: 400 });
  if (!password || password.length < 3) return NextResponse.json({ error: "Password must be at least 3 characters." }, { status: 400 });
  const cleanEmail = (email ?? "").trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) return NextResponse.json({ error: "A valid email is required for password resets." }, { status: 400 });

  try {
    // Ensure password_hash column exists
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`;

    const existing = await getUserByUsername(clean);
    if (existing) return NextResponse.json({ error: "Username already taken. Pick another." }, { status: 409 });

    const hash = await bcrypt.hash(password, 10);
    const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await createUserWithPassword(id, clean, clean, hash, cleanEmail);
    // New users don't get SNES access by default — a moderator must grant it
    await sql`
      CREATE TABLE IF NOT EXISTS user_privileges (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        snes_access BOOLEAN DEFAULT FALSE,
        can_post BOOLEAN DEFAULT TRUE,
        can_comment BOOLEAN DEFAULT TRUE,
        can_voice BOOLEAN DEFAULT TRUE,
        site_ban_until TIMESTAMP DEFAULT NULL,
        updated_by TEXT DEFAULT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `.catch(() => {});
    await sql`
      INSERT INTO user_privileges (user_id, snes_access)
      VALUES (${id}, FALSE)
      ON CONFLICT (user_id) DO NOTHING
    `.catch(() => {});
    return NextResponse.json({ ok: true, username: clean });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error. Try visiting /api/init-db first." }, { status: 500 });
  }
}
