import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@/lib/db";

export interface AvatarConfig {
  class: string;
  emoji: string;
  bodyColor: string;
  hairColor: string;
  accentColor: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config: AvatarConfig = await req.json();
  if (!config.class || !config.emoji) {
    return NextResponse.json({ error: "Invalid config" }, { status: 400 });
  }

  await sql`UPDATE users SET avatar_config = ${JSON.stringify(config)} WHERE id = ${session.user.id}`;
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await sql`SELECT avatar_config FROM users WHERE id = ${session.user.id}`;
  return NextResponse.json({ config: rows[0]?.avatar_config ?? null });
}
