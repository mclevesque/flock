import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureDebateTables, sql } from "@/lib/db";
import { storagePut } from "@/lib/storage";
import { transcribeClip } from "@/lib/debate-ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_CLIP_BYTES = 8 * 1024 * 1024; // 8 MB — plenty for 90s Opus

interface DebateRow {
  id: string; user_a: string; user_b: string | null;
  status: string; round_limit: number; clip_len_s: number;
  current_round: number; current_turn: string;
}

// POST multipart/form-data with field "file" (audio blob)
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureDebateTables();
  const { id } = await ctx.params;

  const rows = await sql`SELECT * FROM debates WHERE id = ${id} LIMIT 1`;
  if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const d = rows[0] as unknown as DebateRow;

  if (d.status !== "active") return NextResponse.json({ error: "Debate is not active" }, { status: 400 });

  const mySide: "a" | "b" | null =
    d.user_a === session.user.id ? "a" :
    d.user_b === session.user.id ? "b" : null;
  if (!mySide) return NextResponse.json({ error: "You aren't in this debate" }, { status: 403 });
  if (d.current_turn !== mySide) return NextResponse.json({ error: "Not your turn" }, { status: 400 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const duration = Math.max(0, Math.min(120000, Number(form.get("durationMs")) || 0));
  if (!file) return NextResponse.json({ error: "No audio file" }, { status: 400 });
  if (file.size > MAX_CLIP_BYTES) return NextResponse.json({ error: "Clip too large (max 8 MB)" }, { status: 400 });
  if (!file.type.startsWith("audio/") && !/\.(webm|mp3|m4a|ogg|wav|opus|weba)$/i.test(file.name)) {
    return NextResponse.json({ error: "Audio only" }, { status: 400 });
  }

  // Pick extension from mime or filename
  let ext = "webm";
  if (file.type.includes("mp4")) ext = "m4a";
  else if (file.type.includes("mpeg")) ext = "mp3";
  else if (file.type.includes("ogg")) ext = "ogg";
  else if (file.type.includes("wav")) ext = "wav";
  else if (/\.([a-z0-9]+)$/i.test(file.name)) ext = file.name.split(".").pop()!.toLowerCase();

  const clipId = `c_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;
  const r2Key = `debates/${id}/round${d.current_round}_${mySide}_${clipId}.${ext}`;
  const { url } = await storagePut(r2Key, file, { contentType: file.type || "audio/webm" });

  // Kick off transcription but don't block the response for too long.
  // If whisper is slow we still save the clip and can transcribe on demand later.
  const transcript = await Promise.race([
    transcribeClip(file, `${clipId}.${ext}`),
    new Promise<string>(resolve => setTimeout(() => resolve(""), 25000)),
  ]);

  await sql`
    INSERT INTO debate_clips (id, debate_id, user_id, side, round_no, r2_key, url, duration_ms, transcript)
    VALUES (${clipId}, ${id}, ${session.user.id}, ${mySide}, ${d.current_round}, ${r2Key}, ${url}, ${duration}, ${transcript})
  `;

  // Advance turn/round. Order per round: A opens, B responds. After B responds, increment round.
  let nextTurn = d.current_turn === "a" ? "b" : "a";
  let nextRound = d.current_round;
  let nextStatus = d.status;
  let votingEndsAt: string | null = null;

  if (mySide === "b") {
    nextRound = d.current_round + 1;
    nextTurn = "a";
  }
  if (nextRound > d.round_limit) {
    nextStatus = "voting";
    nextRound = d.round_limit;
    // 24h voting window
    const ends = new Date(Date.now() + 24 * 60 * 60 * 1000);
    votingEndsAt = ends.toISOString();
  }

  await sql`
    UPDATE debates
    SET current_round = ${nextRound},
        current_turn = ${nextTurn},
        status = ${nextStatus},
        voting_ends_at = COALESCE(${votingEndsAt}, voting_ends_at),
        updated_at = NOW()
    WHERE id = ${id}
  `;

  return NextResponse.json({
    ok: true,
    clipId,
    url,
    transcript,
    status: nextStatus,
    currentRound: nextRound,
    currentTurn: nextTurn,
  });
}
