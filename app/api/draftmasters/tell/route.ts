import { NextResponse } from "next/server";
import { callModelJson, hasAnyProvider } from "@/lib/draftmasters/model";

/**
 * The fight, written.
 *
 * This route decides the battle. That is a deliberate reversal: the game used
 * to resolve combat locally and hand the model a settled list of deaths to
 * narrate, which made replays identical and made fights dull to watch. Two
 * people sitting together want to be on the edge of their seats, and a
 * simulation that has already decided cannot do that to them.
 *
 * WHAT KEEPS IT HONEST is not arithmetic, it is the brief. The model is given
 * every card's ATK/DEF -- the numbers the rest of the game computes, which are
 * where the powerscaling actually lives -- and told those are binding. Aragorn
 * does not beat Goku, because Aragorn is an 8 and Goku is a 15 and the brief
 * says a gap that size does not go the other way. Within that it has real
 * licence: who dies in what order, who takes somebody with them, which
 * mismatch is tragic and which is funny.
 *
 * The output is STRUCTURED. Prose alone would mean parsing names out of
 * sentences to know who died, which is exactly the guessing that used to
 * cross out the killer instead of the corpse. Each beat carries its own
 * casualties as data, so the crossings-out cannot drift from the story.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

interface CardIn {
  name: string;
  /** The condition this copy was drafted in, if it rolled one. */
  variant?: string | null;
  /** How good or bad that condition is — our roll, not canon. */
  grade?: string | null;
  abilities?: string[];
}

/**
 * A grade, in words the model can use.
 *
 * This is the only influence we exert on the fight, and it is deliberately
 * qualitative. The model already knows what these characters can do; what it
 * cannot know is which VERSION of them turned up today, because that is our
 * dice roll and not canon.
 */
const CONDITION: Record<string, string> = {
  uber: "a version so far beyond their usual self it barely makes sense",
  mythic: "a MYTHIC version — far stronger than they normally are",
  exalted: "at the absolute peak of their power",
  legendary: "at the height of their powers",
  major: "notably stronger than usual",
  boon: "in good form",
  neutral: "",
  weakening: "diminished — noticeably worse than they should be",
  crippling: "in a terrible state, barely able to fight at all",
};

interface Body {
  arena?: string | null;
  scenario?: string | null;
  sides?: {
    id: string;
    name: string;
    cards: CardIn[];
    /** The player's own case for why they win, in their words. */
    argument?: string | null;
  }[];
}

export interface TellBeat {
  /** One paragraph of the fight. */
  text: string;
  /** Exact card names that die in this beat. Usually none or one. */
  kills?: string[];
}

/** The one card the battle turned on, and what they did. */
export interface TellMvp {
  name: string;
  note: string;
}

interface Told {
  beats: TellBeat[];
  winner: string;
  /** Named by whoever wrote the fight, since only they know how it went. */
  mvp?: TellMvp | null;
  /** Why that side won, in plain words. Written in the same call as the
   *  story so the explanation cannot disagree with what was narrated -- and
   *  so one battle costs one request. */
  verdict: string;
}

const SYSTEM = `You are calling the story of a battle in DraftMasters, where two
players draft characters out of any fiction and set them against each other.
Two people are watching this together and neither one knows how it ends.

WHAT YOU ARE WRITING IS ONE STORY, START TO FINISH. Not a list of exchanges,
not a highlight reel. It has a shape and you have to give it one:
  1. THE WALK-OUT. Name the players. Their teams come onto the field and the
     crowd gets its first look at what got drafted. Let the big reveals land
     one at a time -- the thing everyone can see, then the thing nobody
     noticed until it moved.
  2. FIRST CONTACT. Somebody moves first, and it tells you something about how
     this is going to go.
  3. THE MIDDLE. The fight turns over: a plan that works, a plan that does not
     survive contact, a mismatch nobody saw coming, somebody spending their
     life to buy one moment for their side.
  4. THE TURN. The point where it stops being close, and you can feel it stop.
  5. THE LAST ONE STANDING -- and then the field afterwards. Who is still
     breathing, what state they are in, the crowd, the walk off.

CONTINUITY IS THE WHOLE JOB. Every beat continues the one before it. A name
introduced once is never introduced again. A blow struck at the end of one beat
lands at the start of the next. Nothing is restated, nobody appears from
nowhere, and nobody who has already gone down does anything ever again. Someone
reading it straight through must never once feel the story jump.

VOICE. You are calling it live, present tense, to a room that is watching it
happen. Excited, propulsive, plain. Like this:

  Mclevesque's team walks out first, and the crowd gasps -- there is a dragon
  on that line, wings wide enough to put half the field in shadow. Then pnut
  comes through the far gate and the noise dies in everyone's throat, because
  pnut brought a bigger one.

  Something on Mclevesque's side starts to glow. Gold light, hair standing
  straight up, the ground going quiet underneath him. It's Goku. He has gone
  Super Saiyan, and he is already moving -- he rushes Vermithor down before the
  dragon can get its wings under it, and they hit the far wall together.

That is the register. Short sentences. Concrete pictures over adjectives. React
to what is happening. Use the crowd, sparingly, and never let it narrate for
you. Use the PLAYERS' names -- they drafted these teams and the fight is really
between them. Exclamations only when something earns one. Be funny when a
matchup is absurd and cold when it is not. People die mid-sentence and the
prose does not stop for them. NEVER numbers, statistics or dice: you are
describing what it looked like.

POWER IS YOUR JOB AND YOU MUST GET IT RIGHT. There are no stat lines, because
you already know what these characters are:
- Across universes the gaps are enormous and they hold. A Saiyan, a kaiju or a
  god does not lose to a swordsman, a ninja, or a superhero who is merely very
  good. Aragorn does not beat Goku. A knight does not beat a dragon by trying
  harder.
- An upset must be EARNED: numbers, terrain, a hard counter that genuinely
  exists in the fiction, an ability that answers the problem, or somebody
  spending their life to buy it.
- Fan knowledge outranks your taste. Characters with history in their own
  fiction should fight like they have it.

CONDITIONS ARE OURS AND THEY DO NOT CROSS UNIVERSES. Some cards were drafted in
a particular state -- mythic, at their peak, diminished, barely standing.
Honour it: a mythic card really is the best version of that character there has
ever been, and a crippled one really is a liability. But a condition only moves
somebody within their OWN scale. Mythic Naruto is the finest Naruto that has
ever existed and still loses to Goku.

THE PLAYERS MAY ARGUE. Each side can submit a case for why they win. Read it
and JUDGE it -- you are not obliged to agree and you must not be bullied:
- A good case is a real read on the matchup: a counter that exists in fiction,
  a tactic the ground allows, a reason one of their cards is worse than it
  looks. Take it. Let it visibly change what happens.
- A partly good case gets partly taken. Give them the half that holds and let
  the rest fail on contact.
- A bad case is wishful, ignores what the other side drafted, invents powers
  nobody has, or simply asserts winning. REFUSE IT, and enjoy refusing it --
  have the thing they were counting on fail in exactly the way they did not
  consider.
- A case NEVER beats a power gap. No paragraph makes a swordsman beat a god.

SURPRISES -- RARELY, AND ONLY IF THEY ARE TRUE. Roughly one fight in three
earns one moment where something goes sideways for a reason a fan would
immediately recognise. Master Roshi loses a fight because there is an
attractive woman on the field. Someone's own recklessness gets them killed. A
character refuses to strike somebody they love. These land ONLY when they come
out of who the character actually is -- never as a random accident, never as a
way to dodge a matchup you did not want to write, and never more than once in a
battle. Most fights have none.

TWO SIDES, AND THEY FIGHT EACH OTHER. Every card belongs to exactly one side and
you must keep track of whose is whose. A card is normally taken out by the OTHER
side. Hurting your own team is allowed ONLY when the character would genuinely
do it: a Hulk far enough gone to swing at whoever is nearest, a berserker who
has stopped checking, somebody whose power is indiscriminate. What is never
allowed is an ally destroyed for no reason rooted in who they are -- a
competent, sane character does not calmly wreck their own side's equipment.

YOU DECIDE THE FIGHT. Who dies, in what order, who is left. Take real liberty:
somebody can survive on one lung, two can go down together, a winner can be
ruined doing it. Not every beat kills. Let it swing. Keep going until one side
has NOBODY left.

OUTPUT -- JSON only:
{
  "beats": [ { "text": "one paragraph, 40-75 words", "kills": ["Exact Card Name"] }, ... ],
  "winner": "<side id of the team with survivors>",
  "verdict": "Why that side won, in 2-3 plain sentences.",
  "mvp": { "name": "Exact Card Name", "note": "One sentence on what they did." }
}
16-22 beats. The first two or three are the walk-out and kill nobody; the last
one is the aftermath and kills nobody either. "kills" lists ONLY cards dying in
that beat, spelled exactly as given, each card at most once in the whole battle.

THE VERDICT is not part of the story and drops the voice entirely. It is the
plain answer to "so why did they win?", for somebody who just watched it. Name
the ONE OR TWO cards that actually decided the thing and say what it was about
them that decided it -- the mismatch nobody on the other side could answer, the
pick that was never going to work here, the moment it stopped being close.
NEVER list the casualties: "the decisive kills were A, B, C and D" is a roll of
the dead, not a reason, and anybody who just watched already knows who died. No
flourish, no crowd, no numbers, and it must match the battle you just wrote.
Call the players by the names given. "Side A" and "Side B" are labels for you,
not words either of them has ever seen.

THE MVP is the single card the battle turned on, spelled exactly as given. It
is USUALLY on the winning side but does not have to be -- somebody can lose and
still be the reason it was close. Do not pick the flashiest name on the board;
pick the one whose absence would have changed the result. The note is one plain
sentence saying what they actually did, in the same voice as the verdict.`;


function brief(b: Body): string {
  const sides = (b.sides ?? [])
    .map((s) => {
      const cards = s.cards
        .map((c) => {
          const cond = c.grade ? CONDITION[c.grade] ?? "" : "";
          const bits = [
            c.variant ? `drafted as "${c.variant}"` : "",
            cond,
            c.abilities?.length ? c.abilities.join("; ") : "",
          ].filter(Boolean);
          return `  - ${c.name}${bits.length ? ` — ${bits.join(" — ")}` : ""}`;
        })
        .join("\n");
      // Quoted and labelled a CLAIM, never a fact, so a confident lie reads to
      // the model as somebody being confident rather than as input.
      const arg = s.argument?.trim()
        ? `\n  THEIR CASE (a claim by the player — judge it):\n    "${s.argument.trim().slice(0, 1200)}"`
        : "";
      return `SIDE "${s.id}" (${s.name}):\n${cards}${arg}`;
    })
    .join("\n\n");

  return `${b.scenario ? `${b.scenario}\n\n` : ""}${b.arena ? `THE GROUND: ${b.arena}\n\n` : ""}${sides}

Write the battle. One side ends with nobody standing.`;
}

/** Names as given, so a hallucinated casualty cannot cross anybody out. */
function sanitise(told: Told, b: Body): Told {
  const real = new Map<string, string>();
  for (const s of b.sides ?? []) {
    for (const c of s.cards) real.set(c.name.toLowerCase(), c.name);
  }
  const usedUp = new Set<string>();
  const beats: TellBeat[] = [];

  for (const raw of told.beats ?? []) {
    const text = String(raw?.text ?? "").trim();
    if (!text) continue;
    const kills: string[] = [];
    for (const k of raw?.kills ?? []) {
      const hit = real.get(String(k).toLowerCase().trim());
      // Unknown name, or somebody who already died: dropped rather than
      // trusted. The story survives a missing crossing-out; it does not
      // survive a card dying twice or a card that was never drafted dying.
      if (!hit || usedUp.has(hit)) continue;
      usedUp.add(hit);
      kills.push(hit);
    }
    beats.push(kills.length ? { text, kills } : { text });
  }

  // Whoever still has somebody standing won, whatever the model wrote in the
  // field -- this is the one fact the prose is not allowed to contradict.
  const alive = (b.sides ?? []).map((s) => ({
    id: s.id,
    left: s.cards.filter((c) => !usedUp.has(c.name)).length,
  }));
  const best = alive.slice().sort((x, y) => y.left - x.left)[0];

  // Checked against the real roster like the casualties are. A made-up name
  // here would put a card on the payoff screen that nobody drafted.
  const rawMvp = told.mvp;
  const mvpName = rawMvp?.name ? real.get(String(rawMvp.name).toLowerCase().trim()) : undefined;
  const mvp = mvpName
    ? { name: mvpName, note: String(rawMvp?.note ?? "").trim() }
    : null;

  /**
   * "Side B" is a label for the model, not a word either player has seen.
   *
   * The brief says so and it mostly holds, but the verdict is the one
   * paragraph everybody reads twice, so it gets a deterministic backstop
   * rather than another line of prompt asking nicely.
   */
  let verdict = String(told.verdict ?? "").trim();
  for (const side of b.sides ?? []) {
    const id = side.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    verdict = verdict.replace(new RegExp(`\\bside\\s+${id}\\b`, "gi"), side.name);
  }

  return {
    beats,
    winner: best?.id ?? told.winner,
    verdict,
    mvp,
  };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.sides?.length) {
    return NextResponse.json({ error: "Nobody to fight." }, { status: 400 });
  }
  if (!hasAnyProvider()) {
    return NextResponse.json({ beats: [], winner: "", verdict: "", mvp: null, provider: "none" });
  }

  try {
    const { data, provider } = await callModelJson<Told>({
      system: SYSTEM,
      user: brief(body),
      maxTokens: 4200,
      temperature: 0.95,
      json: true,
      // Same shape as every other model route here: the chain gets the
      // function's life minus a margin to answer in. Hardcoding a number
      // that no longer matched maxDuration was leaving time on the table
      // while a slow provider quietly ran the whole battle out.
      deadlineMs: (maxDuration - 8) * 1000,
    });
    const clean = sanitise(data, body);
    if (clean.beats.length < 3) {
      console.error("[tell] too few beats from", provider, "-", clean.beats.length);
      return NextResponse.json({ beats: [], winner: "", verdict: "", mvp: null, provider: "none" });
    }
    return NextResponse.json({ ...clean, provider });
  } catch (err) {
    // Say WHY. A silent fallback here is indistinguishable from a broken
    // game: the player watches the offline narrator's one-liners and there
    // is nothing anywhere to say the model was never reached.
    console.error("[tell] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ beats: [], winner: "", verdict: "", mvp: null, provider: "none" });
  }
}
