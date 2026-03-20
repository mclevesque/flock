import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  createGameChallenge,
  getPendingChallengesForUser,
  getAcceptedChallengeForChallenger,
  expireOldChallenges,
} from "@/lib/db";

// GET /api/challenge — poll for pending incoming challenges + accepted outgoing
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ incoming: [], accepted: null });

  await expireOldChallenges();
  const incoming = await getPendingChallengesForUser(session.user.id);
  const accepted = await getAcceptedChallengeForChallenger(session.user.id);

  return NextResponse.json({ incoming, accepted });
}

// POST /api/challenge — create a new challenge
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in to challenge" }, { status: 401 });

  const { toUserId, gameType, gameName, ranked } = await req.json();
  if (!toUserId || !gameType) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  if (!["chess", "quiz", "emulator"].includes(gameType))
    return NextResponse.json({ error: "Invalid game type" }, { status: 400 });
  if (toUserId === session.user.id)
    return NextResponse.json({ error: "Can't challenge yourself" }, { status: 400 });

  const result = await createGameChallenge(session.user.id, toUserId, gameType, gameName, ranked !== false);
  return NextResponse.json(result);
}
