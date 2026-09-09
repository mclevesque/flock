import { NextResponse } from "next/server";
import { mixPacks, searchPacks } from "@/lib/draftmasters/mix";

/**
 * Custom boards, without the model.
 *
 * Building a board used to mean sending the player's typed phrase to a
 * language model and waiting twenty-odd seconds for eighty characters at
 * plausible tiers in a shape that parses. It was the slowest thing in the
 * game, the most expensive, and by a distance the most likely to fail.
 *
 * It was also, looking at what people actually typed, mostly unnecessary:
 * "Marvel vs DC", "anime vs video games", "everything". They did not want a
 * new board. They wanted two at once — the crossover the game is secretly
 * about. So this deals one pool from boards that already exist. No call, no
 * wait, and every card arrives with tiers, variants, planes, traits, effects
 * and a portrait somebody already got right.
 *
 * Runs on the server because PACKS is two thousand entries and has no business
 * in a phone's JavaScript bundle.
 */

export const runtime = "nodejs";

/** GET /api/draftmasters/mix?q=klaus — find boards by name, or by who is on them. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const hits = searchPacks(q, 12).map((h) => ({
    id: h.pack.id,
    name: h.pack.name,
    count: h.pack.entries.length,
    /** "board", or the name of whoever on it matched. */
    because: h.because,
  }));
  return NextResponse.json({ hits });
}

/** POST /api/draftmasters/mix { ids: string[] } — deal one board from several. */
export async function POST(req: Request) {
  let body: { ids?: unknown; variantRate?: unknown; variantWild?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((x): x is string => typeof x === "string").slice(0, 8)
    : [];
  if (ids.length < 1) {
    return NextResponse.json({ error: "Pick at least one universe." }, { status: 400 });
  }

  try {
    const pack = mixPacks(ids);
    // The dials ride on the board so a PvP guest and a rematch inherit the
    // host's settings without a second channel to keep in sync.
    if (typeof body.variantRate === "number") pack.variantRate = body.variantRate;
    if (typeof body.variantWild === "number") pack.variantWild = body.variantWild;
    return NextResponse.json({ pack });
  } catch (err) {
    console.error("[draftmasters/mix]", err);
    return NextResponse.json({ error: "Could not mix those boards." }, { status: 400 });
  }
}
