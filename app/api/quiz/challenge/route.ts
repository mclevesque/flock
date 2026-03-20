import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getQuizChallenge, updateQuizChallengeStatus, createQuizGame, getQuizGameByChallengeId } from "@/lib/db";

export const maxDuration = 60;

// GET — check challenge status & game ID (used by inline quiz polling)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const challenge = await getQuizChallenge(id);
  if (!challenge) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isPlayer = challenge.challenger_id === session.user.id || challenge.challenged_id === session.user.id;
  if (!isPlayer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const game = await getQuizGameByChallengeId(id);
  // DM challenges auto-expired by the hub are still shown as "pending" to players
  const isDm = !!(challenge as Record<string, unknown>).dm_game;
  const effectiveStatus = (isDm && challenge.status === "declined" && !game) ? "pending" : challenge.status;
  return NextResponse.json({ status: effectiveStatus, gameId: game?.id ?? null, challengerId: challenge.challenger_id, challengedId: challenge.challenged_id, topic: challenge.topic ?? "General Knowledge" });
}

// POST — respond to a challenge (accept/decline)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { challengeId, action, dmGame } = await req.json();
  if (!challengeId || !action) return NextResponse.json({ error: "challengeId and action required" }, { status: 400 });

  const challenge = await getQuizChallenge(challengeId);
  if (!challenge) return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  const isDmChallenge = !!(challenge as Record<string, unknown>).dm_game;
  const isPlayer = challenge.challenged_id === session.user.id || challenge.challenger_id === session.user.id;
  // DM quiz: either player can trigger accept (auto-start for both sides)
  // Non-DM quiz: only the challenged player can respond
  if (!isDmChallenge && !dmGame && challenge.challenged_id !== session.user.id) {
    return NextResponse.json({ error: "Not your challenge" }, { status: 403 });
  }
  if (!isPlayer) return NextResponse.json({ error: "Not your challenge" }, { status: 403 });
  // DM challenges can be accepted even if auto-expired (status = 'declined'), as long as no game exists yet
  if (challenge.status !== "pending" && !isDmChallenge && !dmGame) return NextResponse.json({ error: "Challenge already responded" }, { status: 400 });
  // For DM challenges that were auto-expired, check if a game already started — if so, return it
  if (challenge.status === "declined" && isDmChallenge) {
    const existingGame = await getQuizGameByChallengeId(challengeId);
    if (existingGame) return NextResponse.json({ gameId: existingGame.id });
    // No game yet — allow accepting (re-open the challenge)
  }

  if (action === "decline") {
    await updateQuizChallengeStatus(challengeId, "declined");
    return NextResponse.json({ status: "declined" });
  }

  if (action === "accept") {
    await updateQuizChallengeStatus(challengeId, "accepted");
    // Check if game already exists
    const existing = await getQuizGameByChallengeId(challengeId);
    if (existing) return NextResponse.json({ gameId: existing.id });

    // Use pre-generated questions stored when challenge was sent
    const questions = Array.isArray(challenge.questions) && (challenge.questions as unknown[]).length >= 6
      ? challenge.questions as unknown[]
      : [];

    if (questions.length < 6) {
      return NextResponse.json({ error: "Questions not ready — please try again in a moment" }, { status: 503 });
    }

    const gameId = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
    await createQuizGame(
      gameId,
      challengeId,
      challenge.challenger_id as string,
      challenge.challenged_id as string,
      challenge.topic as string,
      questions,
      isDmChallenge || !!dmGame
    );
    return NextResponse.json({ gameId });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
