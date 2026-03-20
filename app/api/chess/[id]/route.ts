import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getChessGame, updateChessGame, applyChessResult } from "@/lib/db";
import { Chess } from "chess.js";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = await getChessGame(id);
  if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(game);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const game = await getChessGame(id);
  if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (game.status !== "active") return NextResponse.json({ error: "Game is over" }, { status: 400 });

  const body = await req.json();

  if (body.action === "resign") {
    const winnerId = game.white_id === session.user.id ? game.black_id : game.white_id;
    await updateChessGame(id, game.fen as string, game.moves as string[], "resigned", winnerId as string);
    if (game.white_id && game.black_id) {
      const result = winnerId === game.white_id ? "white" : "black";
      await applyChessResult(game.white_id as string, game.black_id as string, result);
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "draw") {
    await updateChessGame(id, game.fen as string, game.moves as string[], "draw", null);
    if (game.white_id && game.black_id) {
      await applyChessResult(game.white_id as string, game.black_id as string, "draw");
    }
    return NextResponse.json({ ok: true });
  }

  // Make a move
  const { move } = body;
  if (!move) return NextResponse.json({ error: "move required" }, { status: 400 });

  const chess = new Chess(game.fen as string);
  const turn = chess.turn(); // 'w' or 'b'
  const isWhite = game.white_id === session.user.id;
  const isBlack = game.black_id === session.user.id;

  if (!isWhite && !isBlack) return NextResponse.json({ error: "Not a player" }, { status: 403 });
  if (turn === "w" && !isWhite) return NextResponse.json({ error: "Not your turn" }, { status: 400 });
  if (turn === "b" && !isBlack) return NextResponse.json({ error: "Not your turn" }, { status: 400 });

  let result;
  try {
    result = chess.move(move);
  } catch {
    return NextResponse.json({ error: "Illegal move" }, { status: 400 });
  }
  if (!result) return NextResponse.json({ error: "Illegal move" }, { status: 400 });

  let status = "active";
  let winnerId: string | null = null;

  if (chess.isCheckmate()) {
    status = "finished";
    winnerId = session.user.id;
  } else if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()) {
    status = "draw";
  }

  const newMoves = [...(game.moves as string[]), result.san];
  await updateChessGame(id, chess.fen(), newMoves, status, winnerId);

  if (status !== "active" && game.white_id && game.black_id) {
    const eloResult = status === "draw" ? "draw" : winnerId === game.white_id ? "white" : "black";
    await applyChessResult(game.white_id as string, game.black_id as string, eloResult);
  }

  return NextResponse.json({ ok: true, fen: chess.fen(), san: result.san, status });
}
