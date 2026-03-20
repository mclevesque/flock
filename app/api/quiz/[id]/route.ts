import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getQuizGame, submitQuizAnswer, sql } from "@/lib/db";

// Bot difficulty: 65% correct answers, deterministic per question
function botIsCorrect(gameId: string, questionIndex: number): boolean {
  // Simple hash for determinism
  let h = 0;
  for (let i = 0; i < gameId.length; i++) h = (h * 31 + gameId.charCodeAt(i)) & 0xffffffff;
  h = (h + questionIndex * 1337) & 0xffffffff;
  return (Math.abs(h) % 100) < 65;
}

// GET — poll game state
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const game = await getQuizGame(id);
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  // Only players can see full questions (bot games: player1 is human)
  const isPlayer = game.player1_id === session.user.id || game.player2_id === session.user.id;
  if (!isPlayer) return NextResponse.json({ error: "Not your game" }, { status: 403 });

  return NextResponse.json(game);
}

// POST — submit an answer OR forfeit
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const game = await getQuizGame(id);
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const isPlayer = game.player1_id === session.user.id || game.player2_id === session.user.id;
  if (!isPlayer) return NextResponse.json({ error: "Not your game" }, { status: 403 });

  const isBotGame = game.player2_id === "bot";

  // Forfeit
  if (body.action === "forfeit") {
    if (game.status !== "active") return NextResponse.json({ ok: true });
    if (isBotGame) {
      // Just end the practice game, no rating changes
      await sql`UPDATE quiz_games SET status = 'completed', winner_id = NULL, updated_at = NOW() WHERE id = ${id}`;
      return NextResponse.json({ ok: true });
    }
    const winnerId = game.player1_id === session.user.id ? game.player2_id : game.player1_id;
    await sql`UPDATE quiz_games SET status = 'completed', winner_id = ${winnerId}, updated_at = NOW() WHERE id = ${id}`;
    const { applyQuizResult } = await import("@/lib/db");
    const isPlayer1Winner = winnerId === game.player1_id;
    await applyQuizResult(String(game.player1_id), String(game.player2_id), isPlayer1Winner ? "player1" : "player2");
    return NextResponse.json({ ok: true });
  }

  if (game.status === "completed") return NextResponse.json({ error: "Game already over" }, { status: 400 });

  const { questionIndex, answerIndex, isCorrect, timeMs } = body;

  // Submit human answer
  let updated = await submitQuizAnswer(id, session.user.id, questionIndex, answerIndex, isCorrect, timeMs ?? 0);

  // Auto-answer for bot
  if (isBotGame && Number(game.player2_answered) < questionIndex) {
    const botCorrect = botIsCorrect(id, questionIndex);
    updated = await submitQuizAnswer(id, "bot", questionIndex, botCorrect ? 0 : 1, botCorrect, 3000) ?? updated;
  }

  return NextResponse.json(updated);
}
