import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  const users = await sql`
    SELECT username, display_name, avatar_url,
      chess_rating, chess_wins, chess_losses, chess_draws,
      quiz_rating, quiz_wins, quiz_losses,
      snes_rating, snes_wins, snes_losses
    FROM users
    WHERE username != 'warrior' AND username != 'QuizBot' AND username != 'town_herald'
    ORDER BY username
  `;
  return NextResponse.json(users);
}
