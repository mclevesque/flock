/**
 * DraftMasters — RUSHDOWN, and the mind.
 *
 * ── RUSHDOWN ───────────────────────────────────────────────────────────────
 *
 * Haste and first strike, in one number.
 *
 * A card with rushdown gets there first. If the card opposite has none, it
 * takes the blow before it throws one — and if that blow kills, nothing comes
 * back. Jon Snow is a competent swordsman with rushdown 0, and Goku kills him
 * before he has finished drawing.
 *
 * When BOTH have it, neither gets a free hit. They roll: d6 plus rushdown,
 * higher goes first. So a ninja with rushdown 3 is not simply beaten by Goku
 * at 8 — but they need a six against his one, and that is the right shape for
 * "the fast guy usually wins and occasionally does not".
 *
 * Most cards are ZERO. That is what makes the ones that are not worth
 * drafting. A world where everybody is fast is a world where nobody is.
 *
 * ── THE MIND ───────────────────────────────────────────────────────────────
 *
 * Genjutsu, Freddy, domain expansion, a Jedi mind trick. These break a game
 * if they simply win, and they are pointless if they do not do anything, so:
 *
 *   THEY HAVE TO GET THERE FIRST. A mind attack resolves on its user's
 *   action. Itachi is rushdown 6, Goku is 8 — Goku swings first, and a dead
 *   Itachi casts nothing. The counter to genjutsu is being faster than it,
 *   which is exactly how it goes in the story.
 *
 *   THEY ROLL AGAINST WILL. d6 + mind against d6 + will. Winning does not
 *   kill: the target is CAUGHT and does not strike back this exchange. A free
 *   round, not a free win.
 *
 *   SOME THINGS HAVE NO MIND TO ATTACK. The undead, machines, kaiju, a
 *   berserking animal. Freddy is unbeatable against teenagers and useless
 *   against Mechagodzilla, and that is the most interesting thing about him.
 */
import { hits, type Trait } from "./traits";
import { DBZ_RUSH } from "./boards/dbz";

/**
 * How fast, on a scale nobody needs a manual for.
 *
 *   0      ALMOST EVERYONE. Two zeroes trade blows, and trading is the
 *          default the whole game is built on -- it is what makes carried
 *          damage matter.
 *   2-3    quick enough to be worth saying so: Arya, Syrio, Legolas
 *   4-6    genuinely superhuman: Naruto, Itachi, Spider-Man
 *   7-10   speed as the entire character: Goku, the Flash, Whis
 *
 * This list was three times longer, with most of the mid-table on one or two,
 * and the result was that nearly every exchange came down to a roll instead of
 * the numbers on the cards. Being fast is only worth drafting for while most
 * cards are not.
 */
const RUSH: [string, number][] = [
  // ── Speed as an entire personality ────────────────────────────────────
  ["the flash", 10], ["barry allen", 10], ["wally west", 10], ["godspeed", 10],
  ["quicksilver", 9], ["sonic", 9], ["zoom", 9], ["reverse-flash", 9],
  ["hermes", 8], ["northstar", 8], ["nightcrawler", 7],

  // ── Dragon Ball, where arriving first IS the franchise ────────────────
  ["whis", 10], ["vados", 10], ["beerus", 9], ["ultra instinct", 9],
  ["super saiyan 4", 9], ["ssj4", 9], ["super saiyan blue", 9],
  ["super saiyan 3", 8], ["super saiyan 2", 8], ["super saiyan", 7],
  ["goku", 7], ["vegeta", 7], ["gohan", 6], ["frieza", 7], ["cell", 6],
  ["trunks", 6], ["jiren", 8], ["hit the assassin", 8], ["burter", 8],

  // ── Shinobi: between Westeros and the Saiyans, which is the point ─────
  ["minato", 6], ["itachi", 5], ["kakashi", 4], ["sasuke", 4],
  ["rock lee", 4], ["naruto", 3],

  // ── The few superheroes whose speed is the character ──────────────────
  ["superman", 8], ["captain marvel", 6], ["silver surfer", 7],
  ["spider-man", 4], ["spider man", 4], ["shang-chi", 3],

  // ── Everybody else on every other board is a ZERO. These are the
  //    exceptions, and they are exceptions because being quick is the first
  //    thing anybody says about them.
  ["arya", 3], ["syrio forel", 3], ["legolas", 3], ["oberyn", 2],
  ["akuma", 3], ["deoxys", 5], ["ninjask", 5], ["jolteon", 4], ["pikachu", 3],
];

const RUSH_SORTED = [...RUSH, ...DBZ_RUSH].sort((a, b) => b[0].length - a[0].length);

/**
 * Cards that are hard to get into.
 *
 * Will is only ever rolled against a mind attack, so most cards never need a
 * number. These are the ones whose refusal to break is a character trait.
 */
const WILL: [string, number][] = [
  ["guts", 6], ["professor x", 6], ["doctor strange", 6], ["yoda", 6],
  ["naruto", 5], ["batman", 5], ["jean grey", 5], ["gandalf", 5],
  ["sam gamgee", 5], ["bran stark", 5], ["itachi", 5], ["madara", 5],
  ["vegeta", 4], ["aragorn", 4], ["frodo", 4], ["captain america", 4],
  ["obi-wan", 4], ["obi wan", 4], ["luke skywalker", 4], ["nagato", 4],
  ["jon snow", 3], ["samwell tarly", 3], ["goku", 3], ["daredevil", 3],
  ["melisandre", 3],
];

const WILL_SORTED = [...WILL].sort((a, b) => b[0].length - a[0].length);

/** Nothing in here has a mind a genjutsu can reach. */
const MINDLESS: Trait[] = ["sluggish"];
const MINDLESS_WORDS = [
  "zombie", "wight", "undead", "skeleton", "mummy", "shambler", "golem",
  "robot", "android", "mecha", "terminator", "ultron", "sentinel", "at-at",
  "gundam", "dreadnought", "tank", "walker", "godzilla", "ghidorah", "kaiju",
  "mechagodzilla", "titanus", "dragonzord", "white walker", "the mountain",
  "frankenstein", "the hound's helmet", "drone", "clone trooper", "battle droid",
];

function lookup(table: [string, number][], hay: string): number | null {
  const hit = table.find(([k]) => hits(hay, k));
  return hit ? hit[1] : null;
}

/**
 * How fast this card is, 0 for almost everyone.
 *
 * Traits give a floor so the tables do not have to name every dragon: things
 * that fly arrive before things that walk.
 */
export function rushOf(name: string, variant: string | null | undefined, traits: Trait[]): number {
  const hay = `${name} ${variant ?? ""}`.toLowerCase();
  const named = lookup(RUSH_SORTED, hay);
  if (named !== null) return named;
  if (traits.includes("sluggish")) return 0;
  if (traits.includes("flying")) return 2;
  return 0;
}

/** How hard this card is to get inside. Two by default — a person. */
export function willOf(name: string, variant: string | null | undefined): number {
  const hay = `${name} ${variant ?? ""}`.toLowerCase();
  return lookup(WILL_SORTED, hay) ?? 2;
}

/** Whether a mind attack has anything to attack. */
export function hasMind(name: string, variant: string | null | undefined, traits: Trait[]): boolean {
  const hay = `${name} ${variant ?? ""}`.toLowerCase();
  if (MINDLESS_WORDS.some((w) => hits(hay, w))) return false;
  if (traits.some((t) => MINDLESS.includes(t))) return false;
  return true;
}

/** A rushdown roll, kept whole so the log can show its working. */
export interface RushRoll {
  /** 1 if A goes first alone, -1 if B does, 0 for a simultaneous exchange. */
  who: -1 | 0 | 1;
  /** The raw d6 each side threw, before the bonus. */
  dieA: number;
  dieB: number;
  /** The bonus each side added, after decay for rounds held and damage taken. */
  rushA: number;
  rushB: number;
}

/**
 * Who acts first in this exchange.
 *
 * Returns the whole roll rather than just the answer, because the player is
 * owed its working: "Goku 7+4=11, Arya 2+3=5" is the difference between a
 * game with dice in it and a game that just decides things.
 *
 * @param die a d6, already seeded by the caller so a replay is identical
 */
export function order(rushA: number, rushB: number, die: () => number): RushRoll {
  // Everybody rolls, including a card whose bonus is zero. A tie is a
  // simultaneous exchange, which is where two evenly matched cards take each
  // other off the board together -- still the best outcome the game produces.
  const dieA = die();
  const dieB = die();
  const a = dieA + rushA;
  const b = dieB + rushB;
  const who = a === b ? 0 : a > b ? 1 : -1;
  return { who, dieA, dieB, rushA, rushB };
}
