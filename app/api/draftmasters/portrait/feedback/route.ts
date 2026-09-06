import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPortraitStats, recordPortraitFeedback } from "@/lib/draftmasters/db";
import { forget, nameKeys } from "@/lib/draftmasters/portrait-memo";

/**
 * POST /api/draftmasters/portrait/feedback  { imgQuery, url, source, verdict, userId }
 *   👍 "good" keeps this photo for that character from now on.
 *   👎 "bad"  blocks it and un-keeps it; the client then asks for another.
 *
 * GET  /api/draftmasters/portrait/feedback
 *   What worked and what didn't, by source, plus the recent rejects.
 */

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    imgQuery?: string;
    name?: string;
    url?: string;
    source?: string;
    verdict?: string;
    userId?: string;
  } | null;

  const imgQuery = String(body?.imgQuery ?? "").trim().slice(0, 200);
  const name = String(body?.name ?? "").trim().slice(0, 120);
  const url = String(body?.url ?? "").trim().slice(0, 2000);
  const verdict = body?.verdict === "good" ? "good" : body?.verdict === "bad" ? "bad" : null;
  if (!imgQuery || !url || !verdict || !/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: "bad feedback" }, { status: 400 });
  }

  const session = await auth().catch(() => null);
  const userId = session?.user?.id ?? String(body?.userId ?? "anon").slice(0, 64);

  try {
    await recordPortraitFeedback({
      imgQuery,
      url,
      source: String(body?.source ?? "unknown").slice(0, 32),
      verdict,
      userId,
      // A vote is about the character, not this board's phrasing of them.
      alsoKeys: name ? nameKeys(name) : [],
    });
    forget(imgQuery);
    return NextResponse.json({ ok: true, verdict });
  } catch (err) {
    console.error("[draftmasters/portrait/feedback]", err);
    return NextResponse.json({ error: "could not save" }, { status: 500 });
  }
}

export async function GET() {
  try {
    return NextResponse.json(await getPortraitStats(), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[draftmasters/portrait/feedback]", err);
    return NextResponse.json({ error: "could not load" }, { status: 500 });
  }
}
