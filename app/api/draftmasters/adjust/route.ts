import { NextResponse } from "next/server";
import { callModelJson } from "@/lib/draftmasters/model";
import { ADJUST_LIMITS, sanitiseAdjustments, type Card } from "@/lib/draftmasters/battle";

/**
 * POST /api/draftmasters/adjust
 *
 * Ask a model what the rules cannot know.
 *
 * The engine already knows a dragon beats infantry, that a plane-2 man cannot
 * touch a plane-6 god, and what the ground does to both. What it cannot know
 * is that THIS knight carries a spear built for THAT dragon, or that these two
 * have history, or that one of them has fought the other before and lost.
 *
 * A model is excellent at exactly that and poor at arithmetic, so it is asked
 * for small, reasoned nudges and never for an outcome. It does not see who is
 * winning, it is not told the health totals, and it cannot return a result:
 * the only shape it can answer in is a list of bounded adjustments, every one
 * of which is clamped again on the way back.
 *
 * Those nudges CAN change who wins, and are meant to — in about a third of
 * close fights, and almost never in a lopsided one. See ADJUST_LIMITS for the
 * measurements behind that. The model influences the game; it does not decide
 * it, and it cannot save a side that is being taken apart.
 *
 * If this fails, times out, or returns nonsense, the caller simply fights
 * without it. Offline is not a degraded mode — it is the game.
 */

export const runtime = "nodejs";
export const maxDuration = 30;

const SYSTEM = `You are advising a tabletop battle engine that has already been written. It settles the fight; your job is to tell it about the matchups it cannot see.

THE RULES, so your advice fits them:
- Every card has ATK, DEF and a PLANE (1 Mortal, 2 Exceptional, 3 Enhanced, 4 Superhuman, 5 Titan, 6 Cosmic, 7 Absolute).
- Fighting one plane above you means two thirds of your hit lands; two planes, one third; three or more and NOTHING lands.
- The engine already applies: dragons vs infantry, size in narrow ground, first strike, regeneration, captains, and the arena.

YOUR JOB: name at most ${ADJUST_LIMITS.count} specific matchups the raw numbers get wrong, and nudge them.

HARD LIMITS — anything outside these is clamped, so asking for more just wastes the slot:
- atk: -${ADJUST_LIMITS.atk} to +${ADJUST_LIMITS.atk}
- def: -${ADJUST_LIMITS.def} to +${ADJUST_LIMITS.def}
- plane: -${ADJUST_LIMITS.plane} to +${ADJUST_LIMITS.plane}

Use "vs" when the point is about ONE specific opponent, which is usually the interesting case. Omit it when the card is simply better or worse than its stat line in this whole fight.

Every entry needs a "why" in one short sentence, written for the player to read. No entry without a reason.

Judge the matchups honestly and do not think about the result. A fair read is allowed to decide a fight that was already close — that is the point of asking you — but never reverse-engineer your answer from who you would like to win, and never comment on who should.

If the numbers already look right, return fewer entries or none at all. An empty list is a good answer.

Reply as JSON only: {"adjustments":[{"card":"","vs":"","atk":0,"def":0,"plane":0,"why":""}]}`;

interface Body {
  arena?: string;
  sides?: { name: string; cards: Card[] }[];
}

const line = (c: Card) =>
  `${c.name}${c.variant ? ` (${c.variant})` : ""} — ${c.atk}/${c.def}, ${c.planeLabel} plane` +
  (c.fx.length ? `, ${c.fx.map((f) => f.label).join(", ")}` : "");

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ adjustments: [] });
  }

  const sides = (body.sides ?? []).slice(0, 2);
  if (sides.length !== 2) return NextResponse.json({ adjustments: [] });

  const user =
    (body.arena ? `The ground: ${body.arena}\n\n` : "") +
    sides
      .map((s) => `${s.name}:\n${(s.cards ?? []).map((c) => `  - ${line(c)}`).join("\n")}`)
      .join("\n\n");

  try {
    const { data } = await callModelJson<{ adjustments?: unknown }>({
      system: SYSTEM,
      user,
      maxTokens: 700,
      temperature: 0.7,
      json: true,
      // Short on purpose. This is a garnish, and a player who turned it on did
      // not agree to wait half a minute for it — if the budget runs out the
      // fight happens without advice and nobody is told off about it.
      deadlineMs: 14000,
    });
    return NextResponse.json({ adjustments: sanitiseAdjustments(data?.adjustments) });
  } catch (err) {
    console.error("[draftmasters/adjust] no advice this time", err);
    return NextResponse.json({ adjustments: [] });
  }
}
