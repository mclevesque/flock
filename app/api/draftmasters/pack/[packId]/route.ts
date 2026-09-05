import { NextResponse } from "next/server";
import { getPack } from "@/lib/draftmasters/packs";

/**
 * GET /api/draftmasters/pack/:packId
 *
 * Full board for a preset pack, addressed by PATH on purpose.
 *
 * This used to be `/topic?packId=…` with a long s-maxage. Netlify's CDN
 * builds its cache key from the path and ignores the query string unless
 * told otherwise — so the first pack anyone requested was cached and served
 * for every packId for a day. Every rematch, solo or PvP, came back as the
 * first board. Putting the id in the path makes the key unambiguous on any
 * CDN, and no-store means nothing sits between the player and the board.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ packId: string }> }) {
  const { packId } = await ctx.params;
  const pack = getPack(packId);
  if (!pack) return NextResponse.json({ error: "unknown pack" }, { status: 404 });
  return NextResponse.json({ pack }, { headers: { "Cache-Control": "no-store" } });
}
