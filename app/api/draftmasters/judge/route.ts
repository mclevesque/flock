import { NextResponse } from "next/server";
import { getPack, type VariantGrade } from "@/lib/draftmasters/packs";
import { offlineVerdict, type Side } from "@/lib/draftmasters/engine";
import { callModelJson, hasAnyProvider } from "@/lib/draftmasters/model";
import { formatMenu, getFormat, sanitizePlan, type ContestPlan } from "@/lib/draftmasters/contest";
import { argumentBriefing, type ArgumentRuling } from "@/lib/draftmasters/arguments";
import { scoutRoster, scoutingReport } from "@/lib/draftmasters/lore";
import { counterBriefing, counterHits } from "@/lib/draftmasters/traits";
import { IMMEASURABLE, isBeyondMeasure, uberBriefing } from "@/lib/draftmasters/ubers";

/**
 * POST /api/draftmasters/judge
 *
 * The "Calculate Winner" button — and the brain the whole endgame runs on.
 *
 * It does three things in one call, in this order:
 *   1. LOOKS IT UP. Every drafted pick gets a short factual brief pulled live
 *      from its wiki, so the verdict argues from feats and rules rather than
 *      from a vague memory of the character.
 *   2. WORKS OUT WHAT KIND OF CONTEST THIS IS. A Pokémon board is a turn-based
 *      type-matchup duel; a beauty pageant is scored by a panel and nobody
 *      throws a punch. That decision is returned as a `plan`, which the battle
 *      screen then stages from — so the fight is dramatised the same way it
 *      was judged.
 *   3. DECIDES, and has to justify it.
 *
 * Groq per house rules — free tier, no paid providers. Falls back to the
 * deterministic tier scorer if Groq is unset or misbehaves, so the button
 * always resolves the game.
 */

export const maxDuration = 60;

interface JudgeRequest {
  /** Preset pack id — or send `pack` directly for an AI-generated board */
  packId?: string;
  pack?: { name: string; scenario: string; criteria: string; wiki?: string; format?: string };
  sides: Side[];
  /**
   * The panel's ruling on the pre-battle arguments, when that mode is on.
   * Only the ACCEPTED points reach the prompt — see argumentBriefing.
   */
  rulings?: ArgumentRuling[];
}

/**
 * The band a pick's contribution has to land in, given the grade printed on
 * its card.
 *
 * The colour on a card is a promise. A legendary is three steps up the ladder
 * from plain, so a legendary reading 4/10 next to a plain pick reading 6/10
 * tells the player the grade meant nothing — and they are right, because
 * before this the only grades with a band were mythic and uber and everything
 * else was free to land anywhere in 0-10.
 *
 * The floors climb with the ladder (7, 8, 10, 15) and the negative grades get
 * ceilings for the same reason in reverse: "crippling" cannot read 9/10.
 * These are wide bands, not fixed values — what actually happened in the
 * contest still decides where inside the band a pick lands.
 */
const CONTRIBUTION_BAND: Partial<Record<VariantGrade, [number, number]>> = {
  crippling: [0, 4],
  weakening: [0, 7],
  neutral: [0, 10],
  boon: [2, 10],
  major: [4, 10],
  legendary: [7, 11],
  exalted: [8, 12],
  // A mythic or an uber is defined by being off the scale, so squeezing it
  // back under 10 alongside a $1 filler makes the scorecard contradict the
  // card. This is why "Sauron with the One Ring" can read 14/10.
  mythic: [10, 14],
  uber: [15, 20],
};

/**
 * Find the drafted pick a returned row is talking about.
 *
 * Exact name matching looked correct and was not. Asked for "Thanos" the model
 * answers "Thanos (gauntlet missing one stone)" — it echoes the card as the
 * player sees it — and the lookup then found nothing, so the pick fell through
 * to the default band with no grade, no tier floor and no uber detection. That
 * is how a one-in-five-hundred card came back 10/10 instead of beyond measure,
 * silently, on the one row where it mattered most.
 *
 * Matched on the bare name with any trailing parenthetical removed, then by
 * containment either way, which covers the model shortening a name as well as
 * lengthening it.
 */
function findPick(sides: Side[], sideId: string, pickName: string) {
  const roster = sides.find((s) => s.id === sideId)?.roster ?? [];
  const norm = (n: string) =>
    n.toLowerCase().replace(/\s*\([^)]*\)\s*$/, "").replace(/[^a-z0-9 ]/g, "").trim();
  const want = norm(pickName);
  if (!want) return undefined;
  return (
    roster.find((p) => norm(p.name) === want) ??
    roster.find((p) => {
      const have = norm(p.name);
      return have.includes(want) || want.includes(have);
    })
  );
}

/** How much one pick mattered, 0-10 — except when its grade says otherwise. */
function contributionFor(
  sides: Side[],
  sideId: string,
  pickName: string,
  raw: number
): number {
  const pick = findPick(sides, sideId, pickName);

  // Off the scale entirely — the verdict screen prints an infinity for this.
  if (isUberPick(pick)) return IMMEASURABLE;

  const [lo, hi] = CONTRIBUTION_BAND[pick?.variantGrade ?? "neutral"] ?? [0, 10];

  /**
   * The floor the pick's own strength sets, on top of the one its grade sets.
   *
   * A handicap reduces a character; it does not delete them. Thanos with a
   * stone missing came back 0/10 — and five infinity stones is still stronger
   * than almost anything else that could have been drafted. `tier` here is
   * already the EFFECTIVE tier, so the variant has been paid for once; this
   * only stops it being paid for twice by a model that writes the whole card
   * off.
   *
   * Deliberately gentle — tier 5 floors at 4, not at 8 — because "strong pick,
   * badly countered" has to stay sayable. It rules out zero, not disappointment.
   */
  const tierFloor = Math.max(0, (pick?.tier ?? 3) - 1);

  const floor = Math.min(hi, Math.max(lo, tierFloor));
  return Math.min(hi, Math.max(floor, raw));
}

/**
 * Is this pick an uber?
 *
 * One test, used everywhere. There used to be two — the briefing that tells the
 * judge an uber decides the contest keyed off `variantGrade === "uber"`, while
 * the scorecard's infinity keyed off the variant TEXT — and a card that
 * satisfied one but not the other got the worst of both: the verdict screen
 * printed ∞/10 beside it while the judge, never briefed, wrote "The One Above
 * All is flavor-only and provides no mechanical advantage."
 */
function isUberPick(pick?: { variantGrade?: VariantGrade | null; variant?: string | null }) {
  return Boolean(pick && (pick.variantGrade === "uber" || isBeyondMeasure(pick.variant)));
}

/**
 * Name the MVP and the bust from the numbers actually on the scorecard.
 *
 * The model returns these as free text alongside the per-pick contributions,
 * and nothing reconciled the two — so a roster could show "Sheik · BUST ·
 * 8/10" while a 4/10 pick beside her went unmarked. The tags are commentary
 * on the same fight the numbers describe, so they are derived from them
 * rather than asked for separately.
 *
 * Price is deliberately not consulted. scoreSide has always judged a roster on
 * what it IS and never on what it cost — a $1 steal and a $12 splurge of the
 * same character are the same fighter — and a price-aware "bust" would quietly
 * reintroduce the bidding into the scoring.
 *
 * Nothing is tagged when there is nothing to say: a roster where everyone
 * turned up (nobody below 7) has no bust, and one where every pick landed on
 * the same number has no MVP either.
 */
function tagsFor(picks: { name: string; contribution: number }[]) {
  if (picks.length < 2) return { mvp: "", bust: "" };
  const ranked = [...picks].sort((a, b) => b.contribution - a.contribution);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  if (best.contribution === worst.contribution) return { mvp: "", bust: "" };
  return {
    mvp: best.name,
    // An 8/10 is not a bust just because someone else got a 9.
    bust: worst.contribution <= 6 ? worst.name : "",
  };
}

/**
 * Read the verdict back before anyone sees it, and repair what contradicts the
 * cards it was written about.
 *
 * Everything here is a contradiction the model produced in practice, not a
 * hypothetical. It runs deterministically rather than as a second model call,
 * because the failures are exactly the kind a model talks itself back into:
 * asked "are you sure The One Above All does nothing?", a model that just said
 * so will often say so again.
 *
 * The judge keeps every decision this does NOT touch. A close contest that the
 * model called the other way stays called the other way — only outright
 * contradictions are overturned.
 */
function doubleCheck(verdict: Verdict, sides: Side[]): Verdict {
  const holders = sides.filter((s) => s.roster.some((p) => isUberPick(p)));

  /**
   * 1. AN UBER DECIDES IT.
   *
   * About one lot in five hundred, and the side holding it lost — with the
   * reasoning "The One Above All is flavor-only and provides no mechanical
   * advantage" printed underneath. Whatever else is true of a contest, the
   * omnipotent entity on the board is not a decoration. When exactly one side
   * has one, that side wins; when both do, the model's call stands.
   */
  if (holders.length === 1 && verdict.winnerId !== holders[0].id) {
    const winner = holders[0];
    const uber = winner.roster.find((p) => isUberPick(p));
    console.warn(
      `[draftmasters/judge] overturned: ${winner.name} held ${uber?.name} and lost`
    );
    verdict.winnerId = winner.id;
    verdict.headline = `${uber?.name ?? "The impossible"} settles it`;
    verdict.reasoning =
      `${uber?.name} was on the board. ${verdict.reasoning} ` +
      `Everything else here was an argument about the other picks — and none of ` +
      `it survives contact with ${uber?.name}, who does not lose this contest to ` +
      `anything ${sides.find((s) => s.id !== winner.id)?.name ?? "the other side"} drafted.`;
    // The scores have to follow the result or the card and the number disagree.
    for (const n of verdict.sideNotes) {
      const isWinner = n.sideId === winner.id;
      const swung = isWinner ? Math.max(n.score, 90) : Math.min(n.score, 40);
      n.score = swung;
    }
  }

  /**
   * 2. NOBODY CALLS AN UBER FLAVOUR.
   *
   * The phrasing survived even when the result was right, and a player reading
   * "provides no mechanical advantage" beside a ∞/10 has been told the game is
   * broken. Strip the sentence rather than the whole line.
   */
  if (holders.length) {
    const DISMISSIVE =
      "flavou?r[- ]only|flavou?r text|no mechanical (?:advantage|effect|benefit)" +
      "|purely cosmetic|no real (?:impact|effect)";
    /* Two regexes from one pattern. A /g regex carries lastIndex between
       calls, so .test() over a list returns true, false, true for identical
       strings — the strip needs /g and the test must not have it. */
    const strip = new RegExp(`[^.!?]*(?:${DISMISSIVE})[^.!?]*[.!?]`, "gi");
    const says = new RegExp(DISMISSIVE, "i");
    const clean = (t: string) => t.replace(strip, "").replace(/\s{2,}/g, " ").trim();

    verdict.reasoning = clean(verdict.reasoning);
    if (verdict.plan?.twists) {
      verdict.plan.twists = verdict.plan.twists.filter((t) => !says.test(t));
    }
    for (const n of verdict.sideNotes) n.note = clean(n.note);
  }

  /**
   * 3. THE WINNER SCORES HIGHER.
   *
   * Stated in the prompt and still occasionally inverted, which makes the
   * scorecard read as a typo.
   */
  const notes = verdict.sideNotes;
  if (notes.length === 2) {
    const win = notes.find((n) => n.sideId === verdict.winnerId);
    const lose = notes.find((n) => n.sideId !== verdict.winnerId);
    if (win && lose && win.score <= lose.score) {
      console.warn("[draftmasters/judge] winner scored below the loser; corrected");
      const gap = Math.max(6, Math.abs(win.score - lose.score));
      win.score = Math.min(100, lose.score + gap);
    }
  }

  return verdict;
}

interface SideNote {
  sideId: string;
  score: number;
  mvp: string;
  bust: string;
  note: string;
  picks: { name: string; contribution: number }[];
}

interface Verdict {
  winnerId: string;
  headline: string;
  reasoning: string;
  sideNotes: SideNote[];
  judged: "ai" | "offline";
  plan?: ContestPlan;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as JudgeRequest | null;
  if (!body?.sides || body.sides.length < 2) {
    return NextResponse.json({ error: "two sides required" }, { status: 400 });
  }

  // Custom (AI-generated) boards carry their own scenario; presets look theirs up.
  const preset = body.packId ? getPack(body.packId) : undefined;
  const pack = body.pack ?? preset;
  const sides = body.sides;
  const wiki = body.pack?.wiki ?? preset?.wiki;

  if (hasAnyProvider() && pack) {
    try {
      // ── Look it up first ────────────────────────────────────────────────
      // Best-effort and time-boxed; an empty report just means we reason the
      // way we used to.
      const context = body.pack?.name ?? preset?.imgContext ?? "";
      const scouts = await scoutRoster(
        sides.flatMap((s) => s.roster.map((p) => ({ name: p.name, context, wiki }))),
        9000
      );
      const report = scoutingReport(scouts);

      // Prices are deliberately withheld. What a pick cost says nothing about
      // how it performs, and showing the judge a big number next to a name
      // made it reward the bidding instead of the roster.
      const rosterText = sides
        .map((s) => {
          const picks = s.roster.length
            ? s.roster.map(pickLine).join("\n")
            : "  - (drafted nobody)";
          return `TEAM "${s.name}" [id: ${s.id}] — ${s.roster.length} pick${s.roster.length === 1 ? "" : "s"}\n${picks}`;
        })
        .join("\n\n");

      const hint = body.pack?.format ?? preset?.format;
      const argued = argumentBriefing(
        body.rulings ?? [],
        (id) => sides.find((s) => s.id === id)?.name ?? id
      );

      // The same counter rules the offline scorer applies. Handed over as
      // rules rather than hints so the two paths cannot disagree about
      // whether the machine built to shoot dragons shoots the dragon.
      // An uber has to be stated as a rule. Shown "Hot Pie (with a lightsaber)"
      // and left to its own judgement, a model reasons about Hot Pie the baker
      // and hands the contest to the other side — the one outcome that makes
      // the rarest thing in the game feel broken rather than extraordinary.
      const ubers = sides
        .flatMap((s) =>
          s.roster
            .filter((p) => isUberPick(p) && p.variant)
            .map((p) => uberBriefing(p.name, p.variant!))
        )
        .join("");

      const counters = sides
        .map((s) =>
          counterBriefing(
            s.name,
            counterHits(
              s.roster,
              sides.filter((o) => o.id !== s.id).flatMap((o) => o.roster)
            )
          )
        )
        .filter(Boolean)
        .join("");

      const { data: parsed, provider } = await callModelJson<Record<string, unknown>>({
        system: systemPrompt(),
        user:
          `DRAFT TOPIC: ${pack.name}\n` +
          `SCENARIO: ${pack.scenario}\n` +
          `JUDGING CRITERIA: ${pack.criteria}\n` +
          (hint ? `The board was built as a "${hint}" contest — check that against the scenario before you commit.\n` : "") +
          `\n${rosterText}\n\n` +
          (report ? `${report}\n\n` : "") +
          (ubers ? `${ubers}\n` : "") +
          (counters ? `${counters}\n` : "") +
          (argued ? `${argued}\n` : "") +
          `Note: a name in parentheses is that character's condition and it is binding — "Jaime Lannister (one hand)" really does only have one hand. The bracket after it says how heavily that condition weighs, and you must respect it: a MYTHIC state should decide the contest almost on its own, a CRIPPLING one should visibly cost them, and a flavour-only one changes nothing but the jokes.\n\n` +
          `Work out the format first, then decide. Use the exact id string for winnerId and sideId.`,
        maxTokens: 9000,
        temperature: 0.6,
        // One provider's slice, and one budget for the whole chain.
        // timeoutMs used to apply per request, so three providers with two
        // attempts each could run far past maxDuration (60s) — and an
        // overrunning function is killed and answers with HTML, not JSON.
        timeoutMs: 26_000,
        deadlineMs: (maxDuration - 8) * 1000,
      });

      {
        console.log("[draftmasters/judge] judged by", provider);
        const validId = sides.some((s) => s.id === parsed.winnerId);
        if (validId && parsed.headline && parsed.reasoning) {
          const plan = sanitizePlan(parsed.plan);
          // When the AI omits howItWorks, fall back to the format's judging brief
          // so the breakdown panel always has something to show.
          if (!plan.howItWorks) {
            plan.howItWorks = getFormat(plan.format).judging.slice(0, 320);
          }
          const verdict: Verdict = {
            winnerId: String(parsed.winnerId),
            headline: String(parsed.headline).slice(0, 80),
            reasoning: String(parsed.reasoning).slice(0, 1200),
            sideNotes: Array.isArray(parsed.sideNotes)
              ? parsed.sideNotes
                  .filter((n: { sideId?: string }) => sides.some((s) => s.id === n.sideId))
                  .map((n: Record<string, unknown>) => {
                    const picks = Array.isArray(n.picks)
                      ? (n.picks as Record<string, unknown>[]).slice(0, 12).map((p) => ({
                          name: String(p.name ?? "").slice(0, 60),
                          // Held inside the band its grade promises — see
                          // CONTRIBUTION_BAND.
                          contribution: contributionFor(
                            sides, String(n.sideId), String(p.name),
                            Math.round(Number(p.contribution) || 0)
                          ),
                        }))
                      : [];
                    return {
                      sideId: String(n.sideId),
                      score: Math.max(0, Math.min(100, Number(n.score) || 50)),
                      // Derived from the contributions above, not taken from
                      // the model, so the tag can never contradict the number
                      // printed beside it.
                      ...tagsFor(picks),
                      note: String(n.note ?? "").slice(0, 200),
                      picks,
                    };
                  })
              : [],
            plan,
            judged: "ai",
          };
          return NextResponse.json(doubleCheck(verdict, sides));
        }
      }
    } catch (err) {
      console.error("[draftmasters/judge] falling back to the offline scorer", err);
    }
  }

  // ── Offline fallback ──────────────────────────────────────────────────────
  const off = offlineVerdict(sides);

  /**
   * Accepted argument weight, as a multiplier on raw power.
   *
   * The offline scorer only knows tiers, so without this an argument would
   * count for nothing exactly when the judge is unreachable — the player types
   * a case, watches the panel accept it, and sees it change nothing.
   *
   * How much it counts depends on WHO ruled, because the two are not remotely
   * equal evidence. An AI panel checked every claim against the actual roster
   * and priced it, and it is strict — a full 20 needs several claims that each
   * genuinely reframe the contest. That has earned real weight, so it swings
   * up to 60%: enough to take a clearly better roster down, which is the whole
   * promise of the mechanic. The offline stand-in can only measure how
   * specific the writing was, which is not evidence at all, so it barely
   * registers — otherwise typing a long paragraph would beat drafting well.
   */
  const swayFor = (sideId: string): number => {
    const r = (body.rulings ?? []).find((x) => x.sideId === sideId);
    if (!r) return 1;
    const perPoint = r.ruled === "offline" ? 0.008 : 0.03;
    return 1 + Math.min(20, Math.max(0, r.totalSway)) * perPoint;
  };

  const argued2 = off.scores.map((s) => ({ sideId: s.sideId, power: s.power * swayFor(s.sideId) }));
  const swayedWinner = [...argued2].sort((a, b) => b.power - a.power)[0]?.sideId ?? off.winnerId;
  if (swayedWinner !== off.winnerId) {
    off.winnerId = swayedWinner;
    // Replaced, not appended: the original line quotes the raw power totals
    // and names the other side, so keeping it would have the verdict arguing
    // against its own winner.
    off.reasoning =
      "On raw power this was the other way round — but the panel accepted the case that was made, " +
      "and the argument is what turned it.";
  }
  const winner = sides.find((s) => s.id === off.winnerId);

  // Score relative to each team's share of total power, so winner always
  // shows higher than loser and the display is never a misleading 100/100.
  // Scored on the swayed power, so the number shown agrees with the winner.
  const totalPower = argued2.reduce((s, r) => s + r.power, 0);
  const relScore = (power: number) => totalPower > 0 ? Math.round((power / totalPower) * 100) : 50;
  const winnerPower = argued2.find((s) => s.sideId === off.winnerId)?.power ?? 0;
  const loserPower = argued2.find((s) => s.sideId !== off.winnerId)?.power ?? 0;
  const winnerRel = relScore(winnerPower);
  const loserRel = relScore(loserPower);
  // Guarantee winner's displayed score strictly exceeds loser's.
  const winnerScore = Math.max(winnerRel, loserRel + 1);
  const loserScore = Math.min(loserRel, winnerRel - 1);

  // Build a plan from the tier data so the breakdown panel always has content.
  const winSide = sides.find((s) => s.id === off.winnerId)!;
  const losSide = sides.find((s) => s.id !== off.winnerId)!;
  const wTop = [...winSide.roster].sort((a, b) => b.tier - a.tier);
  const lTop = [...losSide.roster].sort((a, b) => b.tier - a.tier);
  const offMatchups: ContestPlan["matchups"] = [];
  for (let i = 0; i < Math.min(3, wTop.length, lTop.length); i++) {
    const w = wTop[i], l = lTop[i];
    const note =
      w.tier > l.tier
        ? `${w.name} has the edge — tier ${w.tier} vs tier ${l.tier}`
        : w.tier === l.tier
        ? `${w.name} and ${l.name} are evenly matched — a coin flip`
        : `${l.name} has the edge here (tier ${l.tier} vs ${w.tier}), but ${winSide.name} compensates elsewhere`;
    offMatchups.push({ a: w.name, b: l.name, note });
  }
  const margin = winnerPower - loserPower;
  const offPlan: ContestPlan = {
    format: "melee",
    formatLabel: "Power ranking",
    howItWorks: `Each pick is scored by tier raised to the 1.7 power — a single top-tier pick outweighs several mid-tiers. ${winSide.name} scored ${winnerPower} against ${losSide.name}'s ${loserPower}.`,
    decidedBy:
      margin < 3
        ? ["Fine margin at the top", "Depth across the board", "Tiebreaker on strongest pick"]
        : margin < 12
        ? ["Top pick advantage", "Tier-weighted roster depth"]
        : ["Dominant tier advantage", "Roster depth"],
    panel: [],
    matchups: offMatchups,
    twists: [],
  };

  const verdict: Verdict = {
    winnerId: off.winnerId,
    headline: `${winner?.name ?? "The winner"} takes it`,
    reasoning: off.reasoning,
    sideNotes: off.scores.map((sc) => {
      const side = sides.find((s) => s.id === sc.sideId)!;
      const isWinner = sc.sideId === off.winnerId;
      const picks = side.roster.map((p) => ({
        name: p.name,
        contribution: contributionFor(sides, side.id, p.name, p.tier * 2),
      }));
      return {
        sideId: sc.sideId,
        score: isWinner ? winnerScore : loserScore,
        // Same derivation as the AI path. It used to rank by bare tier, which
        // ignored the variant entirely — a crippled tier-5 was still called
        // the MVP over a legendary tier-3.
        ...tagsFor(picks),
        note: `${sc.power} roster power across ${side.roster.length} pick${side.roster.length === 1 ? "" : "s"}.`,
        picks,
      };
    }),
    plan: offPlan,
    judged: "offline",
  };
  return NextResponse.json(verdict);
}


/**
 * How a drafted pick reads to the model.
 *
 * The grade goes in because the colour on the player's card is a promise: a
 * mythic is supposed to be nearly unbeatable and a crippling is supposed to
 * gut them, and a model that treats every parenthetical as equally important
 * breaks that promise.
 */
const GRADE_NOTE: Record<string, string> = {
  crippling: "CRIPPLING - this guts them",
  weakening: "weakened, but still themselves",
  // Never "flavour only". The model quoted that phrase straight back as
  // "Freddy Krueger is marked flavour-only, so his dream-world abilities do not
  // apply" — reading a note about MAGNITUDE as permission to ignore the state
  // itself. The bracket says how far it moves the needle; it never says the
  // words in the parenthesis are untrue.
  neutral: "true, but does not shift the power level much",
  boon: "a small edge",
  major: "MAJOR - a big upgrade",
  // These three were missing from the table entirely, so every legendary,
  // exalted and uber variant in the game fell through to the neutral line and
  // was described to the judge as flavour. That is how "Rhaenys, on Meleys" —
  // graded LEGENDARY on the board — reached the verdict as flavour, dragon and
  // all.
  legendary: "LEGENDARY - a huge upgrade, the state they are famous for",
  exalted: "EXALTED - beyond legendary, near the top of what this character can be",
  mythic: "MYTHIC - game changing, should only lose to another mythic or two majors stacked against it",
  uber: "UBER - the rarest card in the game, roughly one lot in five hundred; it decides the contest",
};

function pickLine(p: { name: string; variant: string | null; variantGrade: string | null }): string {
  if (!p.variant) return `  - ${p.name}`;
  const note = GRADE_NOTE[p.variantGrade ?? "neutral"] ?? GRADE_NOTE.neutral;
  return `  - ${p.name} (${p.variant})  [${note}]`;
}

/**
 * The judge's brief.
 *
 * Most of its length goes on one instruction: work out what the contest
 * actually is before deciding it. Everything that used to go wrong here —
 * pageants staged as knife fights, Pokémon judged on raw strength, a biased
 * judge on the panel treated as neutral — was the model defaulting to "who
 * would win a fight" no matter what the scenario said.
 */
function systemPrompt(): string {
  return `You are the judge of a live auction draft show. You are decisive, funny, and you commit to a winner — never a tie.

STEP 1 — WHAT KIND OF CONTEST IS THIS? Read the scenario and pick the format that actually matches it:
${formatMenu()}
Do not default to a fight. If the scenario is a pageant, a cook-off, a vote, a heist or a survival ordeal, then nobody fights and judging it as a fight is simply wrong.

STEP 2 — JUDGE IT BY THAT FORMAT'S RULES.
- pokemon: use real video-game logic. Type matchups first (Ground beats Electric, Water beats Fire, Fighting loses to Psychic and Flying), then speed, stats, abilities, signature moves, status conditions and setup sweeps. One at a time, one active per side. A damaged Pokémon KEEPS FIGHTING — it only stops when it faints, and fainting is not death. A team with no answer to a type loses even if it looks stronger on paper.
- judged (pageant / talent / cook-off / fashion): NOBODY FIGHTS. The judges decide, and who the judges are is the whole game. Name them, name what each one privately wants, and let that decide votes. Presentation, poise, the talent round, reading the room, flattery, sabotage and cheap tricks are all legitimate and often decisive. Combat power is nearly worthless.
- sport: play it by the real rules, with roles and a scoreline. heist / auction-of-wits: brains, planning and deception beat strength outright. survival: the environment is the opponent. race: the course decides. vote / debate: persuasion decides.
- melee / duel-series: power, durability and coverage — and duel-series is fought one pair at a time, so depth beats a single monster.

STEP 3 — WHO IS BIASED, AND TOWARD WHOM? If the scenario has judges, officials, a crowd or a host, work out their history with the contestants and let it swing the result. PERSONAL HISTORY OUTRANKS GENERIC TASTE: a judge who loved, married, lost, fought or hates a contestant will act on that, and it is far more interesting than "prefers poise". Read the scouting report for exactly this — who is whose brother, widow, ex, killer or rival — and if you find one, it should be the story of your verdict. A judge with a known appetite favours the contestant who matches it; a judge with a grudge marks someone down; a contestant who is already loved starts ahead. Say this out loud in your reasoning — an unexplained result is a bad result.

STEP 4 — FIND THE RULES-LAWYER DETAIL. The best verdicts turn on a specific fact a fan would shout about. Hunt for it: a power with a written condition that isn't met, a weakness the setting exposes, a name or identity technicality, an item that needs something the owner doesn't have, an immunity nobody accounted for. Use the SCOUTING REPORT to get these exactly right. Put each one in "twists". If there genuinely isn't one, leave the array empty rather than inventing nonsense.

STEP 5 — CALL THE MATCHUPS. Pair the picks up as this format would actually pair them and say who wins each and why, naming the actual characters.

OTHER RULES:
- The setting is part of the scenario and it does real work: deep water, killing cold, a sealed room, no sunlight, powers suppressed. Say plainly which picks the setting ruins and which it hands the win to.
- You are not told what anything cost and it is irrelevant. Judge the roster you are shown.
- Be specific about the actual names drafted. Never be generic.
- A condition in parentheses is binding, and weigh it AGAINST THIS FORMAT: a bad leg decides a race and barely matters in a bake-off. A mild condition (a wound, fatigue, age) makes them only slightly worse; only a crippling one (missing sword hand, sealed away, dying) changes who they are.
- An empty roster slot is a real weakness — fewer picks should usually lose.

REPLY WITH ONLY JSON:
{
  "plan": {
    "format": string (exactly one of the ids listed above),
    "formatLabel": string (max 6 words, e.g. "Six-round Pokémon battle", "Judged beauty pageant"),
    "howItWorks": string (1-2 sentences: how this contest is actually resolved),
    "decidedBy": [string] (2-4 short phrases, most important first),
    "panel": [{"name": string, "bias": string (what they privately want and why)}] (the judges, officials or crowd — [] if the format has none),
    "matchups": [{"a": string (a drafted name), "b": string (a drafted name), "note": string (who wins this pairing and why)}] (2-5),
    "twists": [string] (0-3 rules-lawyer details or lore gotchas that change the result)
  },
  "winnerId": string,
  "headline": string (max 8 words, no period),
  "reasoning": string (3-5 sentences — name the format, the decisive matchup and the bias or twist that settled it),
  "sideNotes": [{
    "sideId": string,
    "score": number 0-100 (the two scores MUST differ — winner's score must be at least 5 higher than the loser's),
    "note": string (one sentence),
    "picks": [{"name": string (exact drafted name), "contribution": number (how much THIS pick mattered to the result IN THIS FORMAT — 10 carried it, 0 was dead weight)}] (one entry per drafted pick, in roster order.
      THE BRACKET AFTER A PICK IS ITS MAGNITUDE, NEVER A DENIAL. "[true, but does not shift the power level much]" means the state is real and simply is not a big swing — it does NOT mean the state can be ignored. Freddy Krueger in the dream world has his dream powers no matter what the bracket says; Rhaenys on Meleys is on a dragon. Judge the character as described, and let the bracket tell you how much to weight it.
      NEVER QUOTE THE BRACKET BACK. Words like "flavour", "flavour-only", "marked as", "no mechanical advantage" are internal scoring vocabulary — a player reading them has been shown the database instead of a fight. Say what happened between the characters.
      A HANDICAP REDUCES A PICK; IT DOES NOT DELETE THEM. Judge who is left, not what was taken away. "Thanos, gauntlet missing one stone" still has five Infinity Stones and is stronger than almost anything on a Marvel board — that is a 7 or 8, not a 0. Ask "what could this version still do to the other side?" before you write a low number. A 0-2 is for a pick who genuinely could not affect the outcome at all.
      A ZERO IS A STRONG CLAIM. If you give a drafted pick 0-2, the note must say what specifically neutralised them. "They were outclassed" is not a reason; "Strange's wards shut down every attack they have" is.
      The grade on a pick's card sets the band its contribution must land in — a grade is a promise to the player, so a legendary cannot come out below a plain pick:
        crippling 0-4 · weakening 0-7 · plain 0-10 · boon 2-10 · major 4-10 · LEGENDARY 7-11 · EXALTED 8-12 · MYTHIC 10-14 · UBER 15-20.
      Mythic and uber are deliberately off the 0-10 scale everything else is measured on, so do not squeeze them back under 10. Inside its band, what actually happened in the contest decides the number.)
  }]
}`;
}
