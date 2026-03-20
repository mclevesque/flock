import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getActiveRpsGame, challengeRps, acceptRps, declineRps, chooseRps, cleanupExpiredRps } from "@/lib/db";

// GET — poll active RPS game for current user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(null);
  try {
    await cleanupExpiredRps();
    const game = await getActiveRpsGame(session.user.id);
    return NextResponse.json(game ?? null);
  } catch {
    return NextResponse.json(null);
  }
}

// POST — challenge / accept / decline / choose
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as { id: string; name?: string | null };

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "challenge") {
      const gameId = await challengeRps(u.id, u.name ?? "player", body.targetId, body.targetName);
      return NextResponse.json({ ok: true, gameId });
    }
    if (action === "accept") {
      await acceptRps(body.gameId, u.id);
      return NextResponse.json({ ok: true });
    }
    if (action === "decline") {
      await declineRps(body.gameId);
      return NextResponse.json({ ok: true });
    }
    if (action === "choose") {
      const game = await chooseRps(body.gameId, u.id, body.choice);
      return NextResponse.json({ ok: true, game });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
