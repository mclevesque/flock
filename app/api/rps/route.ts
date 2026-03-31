import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql, initDb } from "@/lib/db";

// GET — RPS leaderboard (on-demand only, never polled)
export async function GET() {
  await initDb();
  try {
    const rows = await sql`
      SELECT username, display_name, rps_rating, rps_wins, rps_losses, rps_draws
      FROM users
      WHERE rps_wins > 0 OR rps_losses > 0 OR rps_draws > 0
      ORDER BY rps_rating DESC
      LIMIT 50
    `;
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json([]);
  }
}

// POST — record a completed match result (called once by each client, idempotent via match_id)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { matchId, p1Id, p2Id, p1Choice, p2Choice, winnerId } = body;
  if (!matchId || !p1Id || !p2Id) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  // Security: caller must be one of the two players
  if (session.user.id !== p1Id && session.user.id !== p2Id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await initDb();

  // Idempotent — if match already recorded, return early (both clients may POST)
  const existing = await sql`SELECT id FROM rps_matches WHERE id = ${matchId}`;
  if ((existing as unknown as unknown[]).length > 0) {
    return NextResponse.json({ ok: true, already: true });
  }

  // Fetch current ratings
  const userRows = await sql`
    SELECT id, rps_rating FROM users WHERE id = ANY(ARRAY[${p1Id}, ${p2Id}]::text[])
  `;
  const rows = userRows as unknown as { id: string; rps_rating: number }[];
  const p1Row = rows.find(r => r.id === p1Id);
  const p2Row = rows.find(r => r.id === p2Id);
  const r1 = p1Row?.rps_rating ?? 1200;
  const r2 = p2Row?.rps_rating ?? 1200;

  // ELO (K=32)
  const e1 = 1 / (1 + Math.pow(10, (r2 - r1) / 400));
  const e2 = 1 - e1;
  const s1 = winnerId === p1Id ? 1 : winnerId === null ? 0.5 : 0;
  const s2 = 1 - s1;
  const nr1 = Math.max(100, Math.round(r1 + 32 * (s1 - e1)));
  const nr2 = Math.max(100, Math.round(r2 + 32 * (s2 - e2)));

  // Save match (ON CONFLICT DO NOTHING handles race between two clients POSTing)
  await sql`
    INSERT INTO rps_matches (id, p1_id, p2_id, p1_choice, p2_choice, winner_id)
    VALUES (${matchId}, ${p1Id}, ${p2Id}, ${p1Choice ?? null}, ${p2Choice ?? null}, ${winnerId ?? null})
    ON CONFLICT (id) DO NOTHING
  `;

  // Update ELO + win/loss/draw
  if (winnerId === p1Id) {
    await sql`UPDATE users SET rps_rating = ${nr1}, rps_wins = rps_wins + 1 WHERE id = ${p1Id}`;
    await sql`UPDATE users SET rps_rating = ${nr2}, rps_losses = rps_losses + 1 WHERE id = ${p2Id}`;
  } else if (winnerId === p2Id) {
    await sql`UPDATE users SET rps_rating = ${nr1}, rps_losses = rps_losses + 1 WHERE id = ${p1Id}`;
    await sql`UPDATE users SET rps_rating = ${nr2}, rps_wins = rps_wins + 1 WHERE id = ${p2Id}`;
  } else {
    // Draw
    await sql`UPDATE users SET rps_rating = ${nr1}, rps_draws = rps_draws + 1 WHERE id = ${p1Id}`;
    await sql`UPDATE users SET rps_rating = ${nr2}, rps_draws = rps_draws + 1 WHERE id = ${p2Id}`;
  }

  return NextResponse.json({ ok: true, nr1, nr2 });
}
