import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

const TEN_MINUTES = 10 * 60 * 1000;

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS moonhaven_sessions (
      user_id    TEXT PRIMARY KEY,
      room_id    TEXT NOT NULL,
      username   TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      last_seen  BIGINT NOT NULL
    )
  `;
}

export async function GET() {
  try {
    await ensureTable();
    const cutoff = Date.now() - TEN_MINUTES;
    const rows = await sql`
      SELECT room_id, COUNT(*) AS player_count
      FROM moonhaven_sessions
      WHERE last_seen > ${cutoff}
      GROUP BY room_id
    `;

    const rooms = rows.map((r) => ({
      id: r.room_id as string,
      playerCount: Number(r.player_count),
      isPublic: r.room_id === "main",
    }));

    // Count private rooms (non-main)
    const privateCount = rooms.filter((r) => !r.isPublic).length;
    const canCreatePrivate = privateCount < 1;

    return NextResponse.json({ rooms, canCreatePrivate });
  } catch (err) {
    console.error("moonhaven-rooms GET error", err);
    return NextResponse.json({ rooms: [], canCreatePrivate: true });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (action === "enter") {
      const { roomId, userId, username = "", avatarUrl = "" } = body as {
        roomId: string; userId: string; username?: string; avatarUrl?: string;
      };
      if (!roomId || !userId) {
        return NextResponse.json({ ok: false, error: "Missing roomId or userId" }, { status: 400 });
      }

      // For private rooms, enforce max 1 private room at a time
      if (roomId !== "main") {
        const cutoff = Date.now() - TEN_MINUTES;
        const existingPrivate = await sql`
          SELECT DISTINCT room_id FROM moonhaven_sessions
          WHERE last_seen > ${cutoff}
            AND room_id != 'main'
            AND room_id != ${roomId}
        `;
        if (existingPrivate.length >= 1) {
          return NextResponse.json({ ok: false, error: "A private realm is already open" });
        }
      }

      const now = Date.now();
      await sql`
        INSERT INTO moonhaven_sessions (user_id, room_id, username, avatar_url, last_seen)
        VALUES (${userId}, ${roomId}, ${username}, ${avatarUrl}, ${now})
        ON CONFLICT (user_id) DO UPDATE
          SET room_id = EXCLUDED.room_id,
              username = EXCLUDED.username,
              avatar_url = EXCLUDED.avatar_url,
              last_seen = EXCLUDED.last_seen
      `;
      return NextResponse.json({ ok: true });
    }

    if (action === "heartbeat") {
      const { roomId, userId } = body as { roomId: string; userId: string };
      if (!userId) return NextResponse.json({ ok: false, error: "Missing userId" }, { status: 400 });
      const now = Date.now();
      await sql`
        UPDATE moonhaven_sessions SET last_seen = ${now}
        WHERE user_id = ${userId} AND room_id = ${roomId}
      `;
      return NextResponse.json({ ok: true });
    }

    if (action === "leave") {
      const { userId } = body as { userId: string };
      if (!userId) return NextResponse.json({ ok: false, error: "Missing userId" }, { status: 400 });
      await sql`DELETE FROM moonhaven_sessions WHERE user_id = ${userId}`;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("moonhaven-rooms POST error", err);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
