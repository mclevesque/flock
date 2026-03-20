import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createChessGame, sql } from "@/lib/db";
import { neon } from "@neondatabase/serverless";

async function ensureTable() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`
    CREATE TABLE IF NOT EXISTS chess_games (
      id TEXT PRIMARY KEY,
      white_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      black_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'active',
      fen TEXT NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      moves TEXT[] NOT NULL DEFAULT '{}',
      winner_id TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json([]);

  // ?active=1 → return the most recent active chess game for the town arcade modal
  const { searchParams } = new URL(req.url);
  if (searchParams.get("active") === "1") {
    try {
      const rows = await sql`
        SELECT cg.id, cg.status,
          u_w.username AS white_username,
          u_b.username AS black_username
        FROM chess_games cg
        LEFT JOIN users u_w ON cg.white_id = u_w.id
        LEFT JOIN users u_b ON cg.black_id = u_b.id
        WHERE cg.status = 'active'
        ORDER BY cg.updated_at DESC
        LIMIT 1
      `;
      return NextResponse.json({ game: rows[0] ?? null });
    } catch { return NextResponse.json({ game: null }); }
  }

  try {
    const games = await sql`
      SELECT cg.*,
        u_w.username AS white_username,
        u_b.username AS black_username
      FROM chess_games cg
      LEFT JOIN users u_w ON cg.white_id = u_w.id
      LEFT JOIN users u_b ON cg.black_id = u_b.id
      WHERE cg.white_id = ${session.user.id} OR cg.black_id = ${session.user.id}
      ORDER BY cg.updated_at DESC
      LIMIT 20
    `;
    return NextResponse.json(games);
  } catch { return NextResponse.json([]); }
}

export async function POST(req: NextRequest) {
  await ensureTable();
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { opponentId } = await req.json();
  if (!opponentId) return NextResponse.json({ error: "opponentId required" }, { status: 400 });
  if (opponentId === session.user.id) return NextResponse.json({ error: "Can't play yourself" }, { status: 400 });

  // Challenger is white, opponent is black (challenger gets first move)
  const id = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
  const game = await createChessGame(id, session.user.id, opponentId);
  return NextResponse.json(game);
}
