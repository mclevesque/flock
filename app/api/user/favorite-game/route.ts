import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { setFavoriteGame } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { gameName } = await req.json().catch(() => ({}));
  await setFavoriteGame(session.user.id, gameName ?? null);
  return NextResponse.json({ ok: true });
}
