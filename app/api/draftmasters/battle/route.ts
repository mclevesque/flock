import { NextResponse } from "next/server";
import { getPack } from "@/lib/draftmasters/packs";
import { DRAFT_MODEL } from "@/lib/draftmasters/model";
import type { Side } from "@/lib/draftmasters/engine";

/**
 * POST /api/draftmasters/battle
 *
 * Turns a decided draft into a beat-by-beat fight to watch. The winner is
 * handed IN and is not up for debate — this dramatises the judge's verdict,
 * it doesn't re-decide it, so "Battle!" and "Calculate Winner" can never
 * disagree.
 *
 * Falls back to a scripted fight built from tiers when Groq is unreachable,
 * so the button always does something.
 */

export const maxDuration = 45;

export type BeatKind = "entrance" | "clash" | "kill" | "standoff" | "heroic" | "comic" | "turn" | "final";

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
  pack?: { name: string; scenario: string; criteria: string };
  sides: Side[];
  winnerId: string;
  reasoning?: string;
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
  const apiKey = process.env.GROQ_API_KEY;

  if (apiKey && pack) {
    try {
      const roster = (s: Side) =>
        s.roster.length
          ? s.roster.map((p) => `  - ${p.name}${p.variant ? ` (${p.variant})` : ""}`).join("\n")
          : "  - (nobody)";

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: DRAFT_MODEL,
          max_tokens: 8000,
          reasoning_effort: "low",
          temperature: 1.0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content:
                `SCENARIO: ${pack.scenario}\n\n` +
                `TEAM "${winner.name}" [id: ${winner.id}] — THIS TEAM WINS:\n${roster(winner)}\n\n` +
                `TEAM "${loser.name}" [id: ${loser.id}] — this team loses:\n${roster(loser)}\n\n` +
                (body.reasoning ? `The judge's reasoning, which your fight must agree with: ${body.reasoning}\n\n` : "") +
                `Write the fight. ${winner.name} must win at the end. Use the exact drafted names and the exact side ids above.`,
            },
          ],
        }),
        signal: AbortSignal.timeout(40000),
      });

      if (res.ok) {
        const data = await res.json();
        const raw = data?.choices?.[0]?.message?.content;
        if (raw) {
          const beats = sanitize(JSON.parse(raw), sides, winner.id);
          if (beats.length >= 3) return NextResponse.json({ beats, winnerId: winner.id, scripted: "ai" });
        }
      }
    } catch {
      /* fall through to the offline script */
    }
  }

  return NextResponse.json({ beats: offlineBeats(winner, loser), winnerId: winner.id, scripted: "offline" });
}

const SYSTEM_PROMPT = `You are the ringside commentator for DraftMasters, narrating a fight between two drafted teams.

VOICE: breathless, funny, a little unhinged — like a wrestling commentator who genuinely cares. Vary the rhythm. Some beats are short and punchy ("Gollum bites his ankle. It does nothing."). Others run long and build. Use CAPS for genuine shock, not constantly. Example of the register:
"Samwise Gamgee steps up with his frying pan, brave and true, but OH GOD NO, The Hound just cut him down! BRUTALLY!"

RULES:
- The winning team is given to you. Your fight MUST end with them standing. Do not change the outcome.
- Use ONLY the drafted names given, spelled exactly. Never invent a character.
- A parenthetical after a name is that character's state and it is binding — "Jaime Lannister (one hand)" fights one-handed. Mine those for drama and comedy.
- The losing team must land real moments first — a kill, a near-miss, a heroic stand. A one-sided walkover is boring.
- Weak or joke picks deserve comic beats. Powerful picks deserve awe.
- Characters can gang up; "actors" may hold 2 or 3 names when they interact in one beat.
- Track eliminations honestly: once a name is in "eliminated", it cannot act again.

STRUCTURE: 8-14 beats.
- Open with 1-2 "entrance" beats setting the scene.
- Middle: "clash", "kill", "standoff", "heroic", "comic", "turn" beats. At least one "turn" where the losing team looks like it might actually win.
- End with exactly one "final" beat where the winning team takes it.

OUTPUT — JSON only:
{
  "beats": [
    { "actors": [string] (1-3 exact drafted names),
      "sideId": string (exact id of the acting team),
      "targetSideId": string (OPTIONAL, exact id of the team on the receiving end),
      "text": string (the commentary, max 220 chars),
      "kind": "entrance" | "clash" | "kill" | "standoff" | "heroic" | "comic" | "turn" | "final",
      "intensity": number 0-3 (0 calm, 3 the biggest moment of the fight),
      "eliminated": [string] (OPTIONAL, exact names knocked out by this beat) }
  ]
}`;

// ── Sanitising ───────────────────────────────────────────────────────────────

const KINDS: BeatKind[] = ["entrance", "clash", "kill", "standoff", "heroic", "comic", "turn", "final"];

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
  (a: string) => `${a} steps onto the field first. No hesitation.`,
  (a: string) => `Here comes ${a}, and the crowd knows exactly what that means.`,
  (a: string) => `${a} walks out slowly. Deliberately. This is going to hurt someone.`,
];
const CLASHES = [
  (a: string, b: string) => `${a} and ${b} collide in the middle — neither one giving an inch!`,
  (a: string, b: string) => `${b} swings at ${a}. Blocked! They're trading blows now!`,
  (a: string, b: string) => `${a} tests ${b}, and ${b} answers. This is a proper fight.`,
];
const KILLS = [
  (a: string, b: string) => `${a} goes straight through ${b}. BRUTALLY. That's one down.`,
  (a: string, b: string) => `OH NO — ${b} never saw ${a} coming. It's over for them.`,
  (a: string, b: string) => `${b} steps up brave and true, and ${a} CUTS THEM DOWN.`,
];
const COMIC = [
  (a: string) => `${a} tries something. It does not work. It was never going to work.`,
  (a: string) => `${a} is out here doing their absolute best, bless them.`,
];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

/** A fight built from tiers when Groq is unreachable. Still ends with the winner. */
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
