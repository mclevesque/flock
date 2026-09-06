import { NextResponse } from "next/server";
import { getPack } from "@/lib/draftmasters/packs";
import { offlineVerdict, type Side } from "@/lib/draftmasters/engine";
import { DRAFT_MODEL } from "@/lib/draftmasters/model";
import { formatMenu, sanitizePlan, type ContestPlan } from "@/lib/draftmasters/contest";
import { scoutRoster, scoutingReport } from "@/lib/draftmasters/lore";

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

  const apiKey = process.env.GROQ_API_KEY;
  if (apiKey && pack) {
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

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: DRAFT_MODEL,
          max_tokens: 9000,
          // Medium, not low: a verdict people argue about deserves an actual
          // war-game of the matchup, not a vibe. Costs a few seconds once.
          reasoning_effort: "medium",
          temperature: 0.6,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt() },
            {
              role: "user",
              content:
                `DRAFT TOPIC: ${pack.name}\n` +
                `SCENARIO: ${pack.scenario}\n` +
                `JUDGING CRITERIA: ${pack.criteria}\n` +
                (hint ? `The board was built as a "${hint}" contest — check that against the scenario before you commit.\n` : "") +
                `\n${rosterText}\n\n` +
                (report ? `${report}\n\n` : "") +
                `Note: a name in parentheses is that character's condition and it is binding — "Jaime Lannister (one hand)" really does only have one hand. The bracket after it says how heavily that condition weighs, and you must respect it: a MYTHIC state should decide the contest almost on its own, a CRIPPLING one should visibly cost them, and a flavour-only one changes nothing but the jokes.\n\n` +
                `Work out the format first, then decide. Use the exact id string for winnerId and sideId.`,
            },
          ],
        }),
        signal: AbortSignal.timeout(50000),
      });

      const data = await res.json();
      const raw = data?.choices?.[0]?.message?.content;
      // Silent fall-through used to make a rate-limited or retired model look
      // exactly like a working offline scorer. Say which it was.
      if (!raw) {
        console.error("[draftmasters/judge] no content from Groq", {
          status: res.status,
          error: data?.error?.message ?? data?.error ?? null,
        });
      }
      if (raw) {
        const parsed = JSON.parse(raw);
        const validId = sides.some((s) => s.id === parsed.winnerId);
        if (validId && parsed.headline && parsed.reasoning) {
          const verdict: Verdict = {
            winnerId: parsed.winnerId,
            headline: String(parsed.headline).slice(0, 80),
            reasoning: String(parsed.reasoning).slice(0, 1200),
            sideNotes: Array.isArray(parsed.sideNotes)
              ? parsed.sideNotes
                  .filter((n: { sideId?: string }) => sides.some((s) => s.id === n.sideId))
                  .map((n: Record<string, unknown>) => ({
                    sideId: String(n.sideId),
                    score: Math.max(0, Math.min(100, Number(n.score) || 50)),
                    mvp: String(n.mvp ?? "").slice(0, 60),
                    bust: String(n.bust ?? "").slice(0, 60),
                    note: String(n.note ?? "").slice(0, 200),
                    picks: Array.isArray(n.picks)
                      ? (n.picks as Record<string, unknown>[]).slice(0, 12).map((p) => ({
                          name: String(p.name ?? "").slice(0, 60),
                          contribution: Math.max(0, Math.min(10, Math.round(Number(p.contribution) || 0))),
                        }))
                      : [],
                  }))
              : [],
            plan: sanitizePlan(parsed.plan),
            judged: "ai",
          };
          return NextResponse.json(verdict);
        }
      }
    } catch (err) {
      console.error("[draftmasters/judge] falling back to the offline scorer", err);
    }
  }

  // ── Offline fallback ──────────────────────────────────────────────────────
  const off = offlineVerdict(sides);
  const winner = sides.find((s) => s.id === off.winnerId);
  const verdict: Verdict = {
    winnerId: off.winnerId,
    headline: `${winner?.name ?? "The winner"} takes it`,
    reasoning: off.reasoning,
    sideNotes: off.scores.map((sc) => {
      const side = sides.find((s) => s.id === sc.sideId)!;
      const sorted = [...side.roster].sort((a, b) => b.tier - a.tier);
      return {
        sideId: sc.sideId,
        score: Math.min(100, Math.round(sc.power * 2)),
        mvp: sorted[0]?.name ?? "—",
        bust: sorted[sorted.length - 1]?.name ?? "—",
        note: `${sc.power} roster power across ${side.roster.length} pick${side.roster.length === 1 ? "" : "s"}.`,
        // Offline: contribution tracks tier — a 5 carried, a 1 rode the bench.
        picks: side.roster.map((p) => ({ name: p.name, contribution: Math.max(0, Math.min(10, p.tier * 2)) })),
      };
    }),
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
  neutral: "flavour only, changes little",
  boon: "a small edge",
  major: "MAJOR - a big upgrade",
  mythic: "MYTHIC - game changing, should only lose to another mythic or two majors stacked against it",
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
    "score": number 0-100,
    "mvp": string (a drafted name),
    "bust": string (a drafted name),
    "note": string (one sentence),
    "picks": [{"name": string (exact drafted name), "contribution": number 0-10 (how much THIS pick mattered to the result IN THIS FORMAT — 10 carried it, 0 was dead weight)}] (one entry per drafted pick, in roster order)
  }]
}`;
}
