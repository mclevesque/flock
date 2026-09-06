import { NextResponse } from "next/server";
import { getPack } from "@/lib/draftmasters/packs";
import { DRAFT_MODEL } from "@/lib/draftmasters/model";
import { getFormat, planBriefing, sanitizePlan, type ContestPlan } from "@/lib/draftmasters/contest";
import type { Side } from "@/lib/draftmasters/engine";

/**
 * POST /api/draftmasters/battle
 *
 * Turns a decided draft into a beat-by-beat show to watch. The winner is
 * handed IN and is not up for debate — this dramatises the judge's verdict,
 * it doesn't re-decide it, so "Battle!" and "Calculate Winner" can never
 * disagree.
 *
 * It also inherits the judge's `plan`: what kind of contest this is, who the
 * judges are and what they want, the matchups already called, and the twists
 * that decided it. That's what stops every board being staged as the same
 * melee — a Pokémon board comes back as turns and type matchups, a pageant
 * comes back as rounds and scorecards with nobody throwing a punch.
 *
 * Falls back to a scripted fight built from tiers when Groq is unreachable,
 * so the button always does something.
 */

export const maxDuration = 60;

export type BeatKind =
  | "entrance"
  | "clash"
  | "kill"
  | "standoff"
  | "heroic"
  | "comic"
  | "turn"
  | "judgment"
  | "final";

export interface BattleBeat {
  /** Drafted names involved, in the order they act */
  actors: string[];
  /** Side that's acting */
  sideId: string;
  /** Side on the receiving end, when there is one */
  targetSideId?: string;
  text: string;
  kind: BeatKind;
  /** 0–3; drives screen shake, slash effects and musical accents */
  intensity: number;
  /** Names knocked out by this beat */
  eliminated?: string[];
}

interface BattleRequest {
  packId?: string;
  pack?: { name: string; scenario: string; criteria: string; format?: string };
  sides: Side[];
  winnerId: string;
  reasoning?: string;
  /** The judge's read on the contest — see /api/draftmasters/judge */
  plan?: ContestPlan;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as BattleRequest | null;
  if (!body?.sides || body.sides.length !== 2 || !body.winnerId) {
    return NextResponse.json({ error: "two sides and a winner required" }, { status: 400 });
  }

  const sides = body.sides;
  const winner = sides.find((s) => s.id === body.winnerId);
  const loser = sides.find((s) => s.id !== body.winnerId);
  if (!winner || !loser) return NextResponse.json({ error: "bad winner" }, { status: 400 });

  const preset = body.packId ? getPack(body.packId) : undefined;
  const pack = body.pack ?? preset;

  // No plan means an old client or an offline verdict — fall back to the
  // board's declared format, then to a melee.
  const plan = body.plan ? sanitizePlan(body.plan) : null;
  const format = getFormat(plan?.format ?? body.pack?.format ?? preset?.format);

  const apiKey = process.env.GROQ_API_KEY;

  if (apiKey && pack) {
    try {
      const roster = (s: Side) =>
        s.roster.length
          ? s.roster.map(pickLine).join("\n")
          : "  - (nobody)";

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: DRAFT_MODEL,
          max_tokens: 9000,
          // Low was fine when every board was a melee. Staging an unfamiliar
          // format correctly — turn order, a scorecard, a heist going wrong —
          // needs a little actual thought, and it happens once behind a bar.
          reasoning_effort: "medium",
          temperature: 0.95,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt(format.id) },
            {
              role: "user",
              content:
                `SCENARIO: ${pack.scenario}\n\n` +
                `${plan ? `${planBriefing(plan)}\n\n` : `FORMAT: ${format.id} — ${format.label}\n\n`}` +
                `HOW TO STAGE A "${format.id}" CONTEST:\n${format.staging}\n` +
                `When someone goes out, they are ${format.outLabel.toLowerCase()} — never describe it as anything else.\n\n` +
                `TEAM "${winner.name}" [id: ${winner.id}] — THIS TEAM WINS:\n${roster(winner)}\n\n` +
                `TEAM "${loser.name}" [id: ${loser.id}] — this team loses:\n${roster(loser)}\n\n` +
                (body.reasoning ? `The judge's reasoning, which your show must agree with: ${body.reasoning}\n\n` : "") +
                `Write it. ${winner.name} must win at the end. Use the exact drafted names and the exact side ids above.`,
            },
          ],
        }),
        signal: AbortSignal.timeout(50000),
      });

      if (!res.ok) console.error("[draftmasters/battle] Groq said", res.status);
      if (res.ok) {
        const data = await res.json();
        const raw = data?.choices?.[0]?.message?.content;
        if (raw) {
          const beats = sanitize(JSON.parse(raw), sides, winner.id);
          if (beats.length >= 3) {
            return NextResponse.json({
              beats,
              winnerId: winner.id,
              scripted: "ai",
              format: format.id,
              formatLabel: plan?.formatLabel || format.label,
              outLabel: format.outLabel,
            });
          }
        }
      }
    } catch (err) {
      console.error("[draftmasters/battle] falling back to the offline script", err);
    }
  }

  return NextResponse.json({
    beats: offlineBeats(winner, loser),
    winnerId: winner.id,
    scripted: "offline",
    format: format.id,
    formatLabel: format.label,
    outLabel: format.outLabel,
  });
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
 * The commentator's brief.
 *
 * The voice and the JSON contract are constant; the staging rules are swapped
 * per format by the caller. The one line that changes here is the melee
 * warning — it's the right note for a brawl and actively wrong for a pageant,
 * where "everyone fights at once" is the bug we're fixing.
 */
function systemPrompt(formatId: string): string {
  const isFight = formatId === "melee" || formatId === "duel-series";

  return `You are the ringside commentator for DraftMasters, calling a contest between two drafted teams as it happens.

VOICE: breathless, funny, a little unhinged — like a wrestling commentator who genuinely cares, whatever they've been asked to commentate. Vary the rhythm. Some beats are short and punchy ("Gollum bites his ankle. It does nothing."). Others run long and build. Use CAPS for genuine shock, not constantly. Register:
"Samwise Gamgee steps up with his frying pan, brave and true, but OH GOD NO, The Hound just cut him down! BRUTALLY!"

STAGE THE CONTEST YOU WERE GIVEN, NOT A FIGHT. The user message names the format and how to stage it, and those rules OVERRIDE every instinct you have. If it says nobody fights, then nobody fights — no punches, no weapons, no deaths, and a beat where someone gets stabbed at a bake-off is a failure. If it says turn-based, write turns. Use that format's real vocabulary: moves and type effectiveness in a creature battle, scorecards and rounds in a judged contest, plays and a running score in a sport.

${
    isFight
      ? `THE FIGHT ITSELF:
- A competitor who wins an exchange STAYS IN and goes after the next one. The same name should appear across several beats — only those who are out stop appearing.
- Mix the shapes: an isolated duel, two ganging up on one, someone jumping in to save a teammate, an ambush from behind.
- Someone who has done a lot of work can flag late — a step slower, a guard dropping — and that can be what finally gets them. Once at most, and never as the reason the contest is decided.`
      : `KEEPING IT HONEST TO THE FORMAT:
- Competitors are not retired after one beat. Someone who does well early comes back and does more.
- The tension comes from the format's own stakes — a scorecard, a clock, a rising alarm, a lead changing hands — not from violence.
- Show the moment a competitor realises they are out of their depth. Show the moment one of them nearly steals it.`
  }

WHAT MUST BE ON SCREEN:
- USE THE SETTING. It is named in the scenario and it is doing real work: deep water, killing cold, a sealed room, no sunlight, a hostile crowd. At least two beats should turn on the setting rather than on a straight swing.
- If a PANEL, judges or a crowd were given to you, they are characters: show their faces, their bias, who they are clearly rooting for and why. A biased judge deciding it is a great beat, not a cheat.
- If TWISTS were given to you, each one MUST happen on screen. They are the best moments you have — build to them and let them land.
- Your beats must agree with the KEY MATCHUPS you were given. If the judge said one pick handles another, that is what happens.
- If the contest rewards brains, show the clever pick outmanoeuvring the stronger one and say exactly how.

HARD RULES:
- The winning team is given to you. Your show MUST end with them on top. Do not change the outcome.
- Use ONLY the drafted names given, spelled exactly. Never invent a competitor. Judges and officials named in the briefing may be spoken about but must NOT appear in "actors".
- A parenthetical after a name is that competitor's state and it is binding — "Jaime Lannister (one hand)" really does only have one hand. Mine those for drama and comedy.
- The losing team must land real moments first — a lead, a near-miss, a moment where they look like they have it. A one-sided walkover is boring.
- Weak or joke picks deserve comic beats. Great picks deserve awe.
- "actors" may hold 2 or 3 names when they interact in one beat.
- Track eliminations honestly: once a name is in "eliminated", it cannot act again. Only put someone in "eliminated" if they are genuinely finished — in a creature battle that means fainted, in a judged contest it means cut, and someone merely hurt or marked down is STILL IN.

STRUCTURE: 8-14 beats.
- Open with 1-2 "entrance" beats setting the scene and the stakes. Cover several competitors in ONE beat — do not give every name its own entrance, that burns the whole show on introductions.
- Middle: "clash", "kill", "standoff", "heroic", "comic", "turn", "judgment" beats. Use "judgment" for a scorecard, a ruling, an official's call or the panel reacting. At least one "turn" where the losing team looks like it might actually take it.
- End with exactly one "final" beat where the winning team seals it.

OUTPUT — JSON only:
{
  "beats": [
    { "actors": [string] (1-3 exact drafted names),
      "sideId": string (exact id of the acting team),
      "targetSideId": string (OPTIONAL, exact id of the team on the receiving end),
      "text": string (the commentary, max 220 chars),
      "kind": "entrance" | "clash" | "kill" | "standoff" | "heroic" | "comic" | "turn" | "judgment" | "final",
      "intensity": number 0-3 (0 calm, 3 the biggest moment of the contest),
      "eliminated": [string] (OPTIONAL, exact names knocked out for good by this beat) }
  ]
}`;
}

// ── Sanitising ───────────────────────────────────────────────────────────────

const KINDS: BeatKind[] = [
  "entrance",
  "clash",
  "kill",
  "standoff",
  "heroic",
  "comic",
  "turn",
  "judgment",
  "final",
];

function sanitize(raw: Record<string, unknown>, sides: Side[], winnerId: string): BattleBeat[] {
  if (!raw || !Array.isArray(raw.beats)) return [];

  const names = new Map<string, string>(); // lowercase -> exact drafted name
  sides.forEach((s) => s.roster.forEach((p) => names.set(p.name.toLowerCase(), p.name)));
  const ids = new Set(sides.map((s) => s.id));

  const resolve = (n: unknown): string | null => {
    const raw = String(n ?? "").trim();
    if (!raw) return null;
    const exact = names.get(raw.toLowerCase());
    if (exact) return exact;
    // The model sometimes appends the variant; match on the leading name.
    for (const [lower, name] of names) if (raw.toLowerCase().startsWith(lower)) return name;
    return null;
  };

  const dead = new Set<string>();
  const beats: BattleBeat[] = [];

  for (const item of raw.beats as Record<string, unknown>[]) {
    const text = String(item?.text ?? "").trim().slice(0, 260);
    const sideId = String(item?.sideId ?? "");
    if (!text || !ids.has(sideId)) continue;

    // A character who's already out can't act again, whatever the model says.
    const actors = (Array.isArray(item.actors) ? item.actors : [])
      .map(resolve)
      .filter((n): n is string => Boolean(n) && !dead.has(n!))
      .slice(0, 3);

    const kind = KINDS.includes(item.kind as BeatKind) ? (item.kind as BeatKind) : "clash";
    const targetSideId = ids.has(String(item.targetSideId)) ? String(item.targetSideId) : undefined;

    const eliminated = (Array.isArray(item.eliminated) ? item.eliminated : [])
      .map(resolve)
      .filter((n): n is string => Boolean(n) && !dead.has(n!));
    eliminated.forEach((n) => dead.add(n));

    beats.push({
      actors,
      sideId,
      targetSideId,
      text,
      kind,
      intensity: Math.max(0, Math.min(3, Math.round(Number(item.intensity) || 1))),
      ...(eliminated.length ? { eliminated } : {}),
    });
    if (beats.length >= 16) break;
  }

  if (!beats.length) return [];

  // The last beat is the payoff and it belongs to the winner, whatever came back.
  const last = beats[beats.length - 1];
  last.kind = "final";
  last.sideId = winnerId;
  last.intensity = Math.max(last.intensity, 3);
  return beats;
}

// ── Offline script ───────────────────────────────────────────────────────────

const OPENERS = [
  (a: string) => `${a} steps out first. No hesitation.`,
  (a: string) => `Here comes ${a}, and the crowd knows exactly what that means.`,
  (a: string) => `${a} walks out slowly. Deliberately. Somebody is about to have a bad time.`,
];
const CLASHES = [
  (a: string, b: string) => `${a} and ${b} go at it — neither one giving an inch!`,
  (a: string, b: string) => `${b} comes at ${a}. Answered! They're trading now!`,
  (a: string, b: string) => `${a} tests ${b}, and ${b} answers. This is a proper contest.`,
];
const KILLS = [
  (a: string, b: string) => `${a} goes straight through ${b}. That's one gone.`,
  (a: string, b: string) => `OH NO — ${b} never saw ${a} coming. It's over for them.`,
  (a: string, b: string) => `${b} steps up brave and true, and ${a} PUTS THEM OUT.`,
];
const COMIC = [
  (a: string) => `${a} tries something. It does not work. It was never going to work.`,
  (a: string) => `${a} is out here doing their absolute best, bless them.`,
];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

/** A show built from tiers when Groq is unreachable. Still ends with the winner. */
function offlineBeats(winner: Side, loser: Side): BattleBeat[] {
  const w = [...winner.roster].sort((a, b) => b.tier - a.tier);
  const l = [...loser.roster].sort((a, b) => b.tier - a.tier);
  const beats: BattleBeat[] = [];
  let n = 0;

  if (w[0]) beats.push({ actors: [w[0].name], sideId: winner.id, text: pick(OPENERS, n++)(w[0].name), kind: "entrance", intensity: 1 });
  if (l[0]) beats.push({ actors: [l[0].name], sideId: loser.id, text: pick(OPENERS, n++)(l[0].name), kind: "entrance", intensity: 1 });

  // The loser lands the first real blow — a walkover is no fun to watch.
  const weakest = w[w.length - 1];
  if (l[0] && weakest && w.length > 1) {
    beats.push({
      actors: [l[0].name, weakest.name],
      sideId: loser.id,
      targetSideId: winner.id,
      text: pick(KILLS, n++)(l[0].name, weakest.name),
      kind: "kill",
      intensity: 2,
      eliminated: [weakest.name],
    });
    beats.push({
      actors: [l[0].name],
      sideId: loser.id,
      text: `${l[0].name} is turning this around. ${loser.name} might actually take it!`,
      kind: "turn",
      intensity: 2,
    });
  }

  const rounds = Math.min(w.length, l.length);
  for (let i = 0; i < rounds; i++) {
    const a = w[i];
    const b = l[i];
    if (!a || !b) continue;
    if (a.tier > b.tier) {
      beats.push({
        actors: [a.name, b.name],
        sideId: winner.id,
        targetSideId: loser.id,
        text: pick(KILLS, n++)(a.name, b.name),
        kind: "kill",
        intensity: a.tier >= 5 ? 3 : 2,
        eliminated: [b.name],
      });
    } else if (b.tier === 1) {
      beats.push({ actors: [b.name], sideId: loser.id, text: pick(COMIC, n++)(b.name), kind: "comic", intensity: 0 });
    } else {
      beats.push({
        actors: [a.name, b.name],
        sideId: winner.id,
        targetSideId: loser.id,
        text: pick(CLASHES, n++)(a.name, b.name),
        kind: "clash",
        intensity: 2,
      });
    }
  }

  const hero = w[0];
  beats.push({
    actors: hero ? [hero.name] : [],
    sideId: winner.id,
    targetSideId: loser.id,
    text: hero
      ? `${hero.name} stands over the wreckage. ${winner.name} takes it.`
      : `${winner.name} takes it.`,
    kind: "final",
    intensity: 3,
  });

  return beats;
}
