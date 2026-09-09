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
 *   0      almost everyone, and it is meant to be almost everyone
 *   1-2    quick — Arya, Bronn, the Green Ranger, most trained fighters
 *   3      genuinely superhuman — Naruto, Itachi, Spider-Man
 *   5      Goku, Vegeta, the ones who blitz
 *   7-8    the handful whose ENTIRE character is speed — Flash, Sonic, Whis
 *
 * The scale used to run to twelve and had most of the mid-table on four to
 * six, which meant "good at fighting" and "fast" had quietly become the same
 * stat. They are not.
 */
const RUSH: [string, number][] = [
  // ── Speed as a whole personality ──────────────────────────────────────
  ["the flash", 10], ["barry allen", 10], ["wally west", 10], ["godspeed", 10],
  ["quicksilver", 9], ["sonic", 9], ["zoom", 9], ["reverse-flash", 9],
  ["hermes", 8], ["northstar", 8], ["nightcrawler", 7], ["silver surfer", 7],

  // ── Dragon Ball ───────────────────────────────────────────────────────
  // The board where getting there first IS the franchise. These are the
  // numbers everything else on the scale is measured against.
  ["whis", 10], ["vados", 10], ["beerus", 9], ["ultra instinct", 9],
  ["super saiyan 4", 9], ["ssj4", 9], ["super saiyan blue", 9],
  ["super saiyan 3", 8], ["super saiyan 2", 8], ["super saiyan", 7],
  ["goku", 7], ["vegeta", 7], ["gohan", 6], ["frieza", 7], ["cell", 6],
  ["trunks", 6], ["piccolo", 5], ["majin buu", 5], ["jiren", 8], ["hit", 8],
  ["krillin", 3], ["tien shinhan", 3], ["yamcha", 2], ["master roshi", 2],
  ["hercule", 0], ["mr. satan", 0], ["bulma", 0], ["chiaotzu", 2],

  // ── Shinobi: between Westeros and the Saiyans, which is the point ─────
  ["minato", 5], ["itachi", 4], ["madara", 4], ["kakashi", 4],
  ["sasuke", 4], ["rock lee", 4], ["naruto", 3], ["jiraiya", 3],
  ["orochimaru", 3], ["pain", 3], ["nagato", 3], ["hinata", 2],
  ["gaara", 1], ["shikamaru", 1],

  // ── Superheroes who move, on a human scale ────────────────────────────
  ["superman", 8], ["captain marvel", 6], ["wonder woman", 5], ["thor", 4],
  ["spider-man", 4], ["spider man", 4], ["deathstroke", 3], ["shang-chi", 3],
  ["catwoman", 2], ["nightwing", 2], ["daredevil", 2], ["captain america", 2],
  ["black widow", 2], ["batman", 2], ["wolverine", 2], ["deadpool", 2],
  ["iron fist", 2],

  // ── Fantasy and swords. Most of Westeros is a zero, and it matters. ───
  ["arya", 2], ["oberyn", 2], ["syrio forel", 2], ["arthur dayne", 2],
  ["legolas", 3], ["glorfindel", 2], ["bronn", 1], ["jaime", 1],
  ["aragorn", 1], ["griffith", 2], ["guts", 1],

  // ── Fighters, rangers, monsters ───────────────────────────────────────
  ["akuma", 3], ["cammy", 2], ["chun-li", 2], ["scorpion", 2], ["sub-zero", 2],
  ["raiden", 3], ["green ranger", 2], ["tommy oliver", 2], ["white ranger", 2],
  ["michael myers", 0], ["pennywise", 2], ["freddy", 1],
  ["deoxys", 5], ["ninjask", 5], ["jolteon", 4], ["pikachu", 3],
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
