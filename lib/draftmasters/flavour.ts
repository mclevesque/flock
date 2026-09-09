/**
 * DraftMasters — telling the offline fight properly.
 *
 * The resolver produces true sentences and dull ones: "Drogon hits Bronn for
 * 13." That is fine as a rules log and useless as the thing a player actually
 * came for, which is the story of their team.
 *
 * So the log gets narrated. Every line here is written from facts the resolver
 * already decided — who swung, how hard relative to what they were hitting,
 * what they are, and what the ground is doing — and the narration never
 * changes an outcome. It is a renderer.
 *
 * Two rules it follows strictly:
 *
 *   DETERMINISTIC. Seeded from the fight itself, so replaying a battle gives
 *   the same prose. A player who screenshots a line and comes back to it later
 *   finds the same line.
 *
 *   NEVER LOUDER THAN THE FACTS. A glancing 1 does not get a sentence about
 *   the earth shaking. The pools are keyed to the fraction of the defender's
 *   remaining health that the blow actually took, so the writing rises and
 *   falls with the fight instead of shouting all the way through.
 *
 * When the AI is available it rewrites all of this, better, with the actual
 * characters in mind. When it is not — offline, rate-limited, or the player
 * simply does not want to wait — this is what they get, and it is not an
 * apology.
 */

import type { BattleEvent, BattleResult } from "./battle";
import type { Trait } from "./traits";
import type { Terrain } from "./terrain";

/** The word stamped on whoever goes out. A pageant is not a knife fight. */
export interface Vocabulary {
  /** "is down" / "faints" / "is eliminated" / "is voted out" */
  out: string;
  /** "hits" / "scores on" / "outclasses" */
  hit: string;
}

export const MELEE: Vocabulary = { out: "is down", hit: "hits" };
export const POKEMON: Vocabulary = { out: "faints", hit: "connects on" };
export const JUDGED: Vocabulary = { out: "is eliminated", hit: "scores on" };

function makeDie(seed: number) {
  let a = seed || 1;
  return (sides: number): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) % sides;
  };
}

function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ── Pools ────────────────────────────────────────────────────────────────────
//
// {A} is the attacker, {D} the defender. Kept deliberately plain: these have to
// read correctly with "Drogon" in them and with "a stormtrooper" in them, and
// anything too writerly falls apart on one of the two.

const GLANCING = [
  "{A} clips {D}. Barely a scratch!",
  "{A} gets a piece of {D} — the wrong piece.",
  "{D} wears it and keeps walking. Rude.",
  "{A} lands it. {D} does not care even slightly.",
  "That did almost nothing! {D} has had worse mornings.",
];

const SOLID = [
  "{A} lands CLEAN on {D}!",
  "{A} finds the gap and drives it home!",
  "Oh, {D} felt that one.",
  "{A} gets in behind the guard. That is going to bruise.",
  "Right through the middle! {D} is not enjoying this.",
];

const HEAVY = [
  "{A} nearly ends it right there!",
  "{D} is still up and has absolutely no business being up.",
  "{A} takes {D} apart and stops one blow short. Cruel.",
  "{D} is running on fumes and spite.",
  "One more of those and {D} is finished!",
];

const KILL = [
  "{A} finishes {D}. Done. Gone.",
  "{D} does not get up. {D} does not get anything.",
  "{A} takes {D} off the board!",
  "And that is the end of {D}!",
  "{A} ends it. {D} is DEAD.",
  "{D} is dead! Nothing left to discuss!",
];

/**
 * Somebody died before they got to move.
 *
 * The single moment rushdown exists for, so it gets its own pool and its own
 * volume. Being fast is not a modifier here, it is the entire story of the
 * exchange.
 */
const RUSHDOWN_KILL = [
  "{A} is just too fast! {D} is dead before the swing lands!",
  "{D} never even sees it! {A} was there and gone!",
  "Too quick! {D} dies mid-thought!",
  "{A} moves first and {D} does not get a turn. Ever again.",
  "{D} came to fight. {A} came to be somewhere else already. {D} is dead!",
  "Blink and {D} is gone. {A} did not even slow down.",
];

/** What a particular kind of thing looks like when it kills something. */
const KILL_BY_TRAIT: Partial<Record<Trait, string[]>> = {
  dragon: [
    "{A} comes out of the smoke and there is nothing left of {D} to bury!",
    "Fire. Then quiet. {D} is a smear.",
    "{D} is on fire. {D} is going to stay on fire.",
  ],
  giant: [
    "{A} brings it down on {D} like a falling wall!",
    "{D} is somewhere underneath {A} and is not coming back out.",
    "{A} steps on {D}. That is the whole fight.",
  ],
  large: [
    "{A} simply goes THROUGH {D}!",
    "{D} was in the way. That was {D}'s entire mistake.",
  ],
  infantry: [
    "{A} gets inside and works, and {D} folds like laundry.",
    "Close, quick and deeply unpleasant. {D} is finished.",
    "{A} puts it somewhere that matters. {D} drops.",
  ],
  flying: [
    "{A} takes {D} from an angle nobody was watching!",
    "{D} never looks up. {D} should have looked up.",
  ],
  sluggish: [
    "{A} takes its time about {D} and gets there eventually.",
    "Slow. Certain. Over. {D} is done.",
  ],
};

/** A blow so far past lethal that the excess is the joke. */
const BREAKTHROUGH = [
  "That was VASTLY more than necessary.",
  "{D} is dead several times over. Once would have done.",
  "Overkill. Genuine, measurable overkill.",
  "{A} did not need to do that much. {A} did it anyway.",
];

const EXPOSED = [
  "{P} has nobody left to send out.",
  "The line is gone. That is the whole roster.",
  "{P} is out of people.",
];

/**
 * Somebody stepping onto the field.
 *
 * The clearest beat a team fight has, and the one the old log buried under a
 * round marker that looked the same whether anybody had moved or not.
 */
const SEND = [
  "Get out there, {D}!",
  "{D}, you are up!",
  "{P} sends in {D}!",
  "Next up: {D}!",
  "{D} steps out.",
  "That is {D}'s cue.",
];

/** The captain, finally, because there is nobody left to send. */
const SEND_CAPTAIN = [
  "There is nobody left. {D} goes out themselves!",
  "{D} has run out of people to send. {D} is going.",
  "Last one standing — {D} takes the field!",
  "{D} was never supposed to have to do this.",
];

const HOLD = [
  "{A} holds!",
  "{A} is still standing. Somehow.",
  "Nothing moves. {A} has not given an inch.",
];

// ── Rendering ────────────────────────────────────────────────────────────────

export interface FlavourContext {
  terrain?: Terrain | null;
  vocabulary?: Vocabulary;
  /** Traits per card name, so a dragon dies like a dragon. */
  traits?: Record<string, Trait[]>;
  seed?: number;
}

/** A narrated event: the rules line, and the line a player actually reads. */
export interface NarratedEvent extends BattleEvent {
  /** Prose. Absent for events that are already prose, or already terse enough. */
  said?: string;
  /**
   * Say nothing at all for this one.
   *
   * Set on the killing blow, because the death line immediately after it is the
   * same moment told better. A renderer that ignores this flag still reads
   * correctly — it just says it twice.
   */
  hidden?: boolean;
}

/**
 * Fill a line's placeholders.
 *
 * All of them: `String.replace` with a string pattern substitutes only the
 * first match, which printed a literal "{D}" at the player the first time a
 * pool line named the same card twice.
 */
function fill(line: string, parts: { A?: string; D?: string; P?: string }): string {
  return line
    .replaceAll("{A}", parts.A ?? "")
    .replaceAll("{D}", parts.D ?? "")
    .replaceAll("{P}", parts.P ?? "");
}

const NAME_IN = (text: string) => text.replace(/\s*\(.*?\)\s*$/, "");

/**
 * Narrate a resolved battle.
 *
 * Takes the result rather than hooking into the resolver, so the rules can
 * never depend on the writing — and so a caller who wants the bare log can
 * simply not call this.
 */
export function narrate(result: BattleResult, ctx: FlavourContext = {}): NarratedEvent[] {
  const die = makeDie(ctx.seed ?? seedFrom(result.headline + result.rounds));
  const pick = (pool: string[]) => pool[die(pool.length)];
  const vocab = ctx.vocabulary ?? MELEE;

  /**
   * The narrator has to know three things the rules log states only once each:
   * who is currently facing whom, how much health each of them has left, and
   * who threw the blow that just killed somebody.
   *
   * Tracking those honestly matters more than the prose does. The first draft
   * of this file guessed — it assumed the second name in "X faces Y" was always
   * the defender — and produced sentences crediting a dragon with dying and a
   * corpse with the killing blow. A narrator that gets the facts wrong is worse
   * than no narrator, because the rules log underneath it is right and the
   * player can see both.
   */
  const hp: Record<string, number> = {};
  let killer = "";
  let fallen = "";
  /** Who won the rushdown roll this round, and whether anyone has swung since. */
  let firstMover = "";
  let struckBack = false;

  const out: NarratedEvent[] = [];
  const already = result.log.some((e) => e.kind === "terrain");
  if (!already && ctx.terrain && ctx.terrain.rules.length) {
    out.push({
      round: 0,
      kind: "terrain",
      text: ctx.terrain.name,
      said: `${ctx.terrain.name}. ${ctx.terrain.rules[0].note}`,
    });
  }

  for (const e of result.log) {
    const ev: NarratedEvent = { ...e };

    switch (e.kind) {
      case "captain": {
        // Two shapes share this kind: an arrival, and a captain's aura note.
        // Only the arrival has a name to put on screen.
        const send = e.text.match(/^(.+?) sends out (.+?)[.!]$/);
        if (send) { ev.said = fill(pick(SEND), { P: send[1], D: NAME_IN(send[2]) }); break; }
        const last = e.text.match(/^(.+?) has nobody left to send\. (.+?) takes the field\.$/);
        if (last) ev.said = fill(pick(SEND_CAPTAIN), { P: last[1], D: NAME_IN(last[2]) });
        break;
      }

      case "round": {
        const m = e.text.match(/^(.+?) \((\d+)\) faces (.+?) \((\d+)\)\.$/);
        if (m) {
          hp[m[1]] = +m[2];
          hp[m[3]] = +m[4];
          // A fresh pairing: nobody has swung yet and nobody has won a roll.
          firstMover = "";
          struckBack = false;
          break;
        }
        // The other kind of round event is the rushdown roll itself.
        const r = e.text.match(/\. (.+?) is first\.$/);
        if (r) firstMover = r[1];
        break;
      }

      case "strike": {
        const m = e.text.match(/^(.+?) hits (.+?) for (\d+)\.$/);
        if (!m) break;
        const [, att, def, nRaw] = m;
        // Somebody who is not the first mover has landed a blow, so whatever
        // happens next was not "died before they got to move".
        if (firstMover && att !== firstMover) struckBack = true;
        const n = +nRaw;
        const had = hp[def] ?? Math.max(n, 1);
        hp[def] = Math.max(0, had - n);
        killer = att;

        // A lethal blow gets no sentence here — the death event that follows is
        // where that line belongs, and saying it twice halves the weight of it.
        if (n >= had) {
          ev.hidden = true;
          break;
        }
        const share = n / Math.max(had, 1);
        const pool = share >= 0.6 ? HEAVY : share >= 0.3 ? SOLID : GLANCING;
        ev.said = fill(pick(pool), { A: NAME_IN(att), D: NAME_IN(def) }) + ` (${n})`;
        break;
      }

      case "death": {
        const m = e.text.match(/^(.+?) is down\.$/);
        if (!m) break;
        fallen = m[1];
        const d = NAME_IN(m[1]);
        const a2 = NAME_IN(killer) || "It";

        // Died without ever getting to answer: the other card was simply
        // faster. This is the moment rushdown is drafted for.
        if (firstMover && killer === firstMover && !struckBack) {
          ev.said = fill(pick(RUSHDOWN_KILL), { A: a2, D: d });
          break;
        }

        // Flavoured by what the KILLER is, not what died — a dragon burning
        // somebody and somebody knifing a dragon are different sentences.
        const traits = ctx.traits?.[killer] ?? [];
        const special = traits.map((t) => KILL_BY_TRAIT[t]).find(Boolean);
        ev.said = special
          ? fill(pick(special), { A: a2, D: d })
          : killer
            ? fill(pick(KILL), { A: a2, D: d })
            : `${d} ${vocab.out}.`;
        break;
      }

      case "breakthrough": {
        const m = e.text.match(/^(\d+) gets past and hits (.+?) — (\d+) health left\.$/);
        if (!m) break;
        ev.said =
          fill(pick(BREAKTHROUGH), { P: m[2], D: NAME_IN(fallen) || "the line" }) + ` (${m[1]}, ${m[3]} left)`;
        break;
      }

      case "exposed": {
        const m = e.text.match(/^(.+?) has nobody left to send out\.$/);
        if (m) ev.said = fill(pick(EXPOSED), { P: m[1] });
        break;
      }

      case "blocked": {
        // The planar notes are the best writing in the log already — they say
        // exactly why nothing happened, which is the interesting part. Only the
        // bare "lands nothing" line needs help.
        const m = e.text.match(/^(.+?) lands nothing on (.+?)\.$/);
        if (m) ev.said = fill(pick(HOLD), { A: NAME_IN(m[2]) });
        break;
      }
    }

    out.push(ev);
  }

  return out;
}

/** The whole fight as plain prose, for a share card or a text-only client. */
export function retell(result: BattleResult, ctx: FlavourContext = {}): string {
  return narrate(result, ctx)
    .filter((e) => !e.hidden)
    .map((e) => e.said ?? e.text)
    .join(" ");
}
