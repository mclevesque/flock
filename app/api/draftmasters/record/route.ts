import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getLeaderboard, getRecord, recordMatch } from "@/lib/draftmasters/db";
import type { Side } from "@/lib/draftmasters/engine";

/**
 * GET  /api/draftmasters/record?userId=…   -> that player's record + the ladder
 * POST /api/draftmasters/record            -> report a finished match
 *
 * Reports are client-sent, which is fine for a friends' site — but they're
 * keyed by match id so a room reporting twice counts once, and a signed-in
 * reporter must be one of the two sides.
 */

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") ?? "";
  try {
    const [record, leaderboard] = await Promise.all([
      userId ? getRecord(userId) : Promise.resolve(null),
      getLeaderboard(20),
    ]);
    return NextResponse.json({ record, leaderboard });
  } catch {
    return NextResponse.json({ record: null, leaderboard: [] });
  }
}

interface ReportBody {
  matchId?: string;
  mode?: "pvp" | "solo";
  roomCode?: string | null;
  topic?: string;
  sides?: Side[];
  winnerId?: string;
  verdict?: unknown;
  reporterId?: string;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as ReportBody | null;
  if (!body?.matchId || !body.sides || body.sides.length !== 2 || !body.winnerId) {
    return NextResponse.json({ error: "bad report" }, { status: 400 });
  }

  const winner = body.sides.find((s) => s.id === body.winnerId);
  const loser = body.sides.find((s) => s.id !== body.winnerId);
  if (!winner || !loser) return NextResponse.json({ error: "bad sides" }, { status: 400 });

  // A signed-in reporter has to actually be in the match.
  const session = await auth().catch(() => null);
  const reporterId = session?.user?.id ?? body.reporterId ?? "anon";
  if (session?.user?.id && ![winner.id, loser.id].includes(session.user.id)) {
    return NextResponse.json({ error: "not your match" }, { status: 403 });
  }

  try {
    const result = await recordMatch({
      id: String(body.matchId).slice(0, 80),
      mode: body.mode === "pvp" ? "pvp" : "solo",
      roomCode: body.roomCode ?? null,
      topic: String(body.topic ?? "Draft").slice(0, 120),
      winner: { id: winner.id, name: winner.name, roster: winner.roster, isNpc: Boolean(winner.isNpc) },
      loser: { id: loser.id, name: loser.name, roster: loser.roster, isNpc: Boolean(loser.isNpc) },
      verdict: body.verdict,
      reportedBy: reporterId,
    });
    const record = await getRecord(session?.user?.id ?? body.reporterId ?? winner.id);
    return NextResponse.json({ ...result, record });
  } catch {
    return NextResponse.json({ error: "could not record" }, { status: 500 });
  }
}
