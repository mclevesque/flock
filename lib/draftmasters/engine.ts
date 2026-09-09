/**
 * DraftMasters — auction draft engine.
 *
 * A straight ascending-bid auction draft, played as alternating turns with
 * no clock. Every lot is resolved by a decision, never by a timer running
 * out — which is what makes it survive a flaky phone connection: there is
 * nothing to miss.
 *
 *   • Everyone starts with the same budget.
 *   • Lots are nominated one at a time from a shuffled pool.
 *   • Opening rights alternate lot by lot. The opener bids or passes.
 *   • After a bid, the other side may RAISE, PASS (high bidder wins), or —
 *     if they can match the price but not beat it — MATCH and roll dice for it.
 *   • Passing an unbid lot hands the opening to the other side if they have a
 *     slot to fill; if both decline, the lot goes unsold.
 *   • You can always bid your whole wallet. Blowing it on pick one is legal;
 *     the empty chairs you finish with are the judge's problem with you.
 *   • Once the other side is full you're drafting alone: you may pass ONE
 *     lot, then the next one fills your slot — no farming the board for the
 *     perfect leftover.
 *   • Every roster gets filled. A broke player claims unclaimed lots for $0;
 *     two broke players roll dice for one. If the pool runs dry with chairs
 *     still empty, the lots nobody took come back around.
 *
 * Pure and deterministic given a seed, so the solo game and the PartyKit
 * room run the same code and never disagree.
 */

import { MAX_TIER, effectiveTier, variantGrade, type Arena, type Entry, type Pack, type Variant, type VariantGrade } from "./packs";
import { counterHits } from "./traits";
import { UBER_CHANCE, rollUber, rollUberCard } from "./ubers";

/**
 * How often a lot on a shiny-enabled board comes up shiny — about one in
 * ninety, so roughly one draft in eight sees one. The games use 1/4096, which
 * across a twelve-lot board would mean nobody ever saw one.
 */
const SHINY_CHANCE = 1 / 90;

export interface Lot {
  /** Stable id — pack entry index plus variant index */
  id: string;
  name: string;
  /** Rolled condition, e.g. "two hands" — null when the entry has no variants */
  variant: string | null;
  /**
   * How hard that condition hits, which is also its colour on the card.
   * Null when no variant was rolled.
   */
  variantGrade: VariantGrade | null;
  /** Effective tier after the variant is applied */
  tier: number;
  /** Query used for the portrait lookup */
  imgQuery: string;
  /** Came up shiny. Cosmetic — the tier and grade are untouched. */
  shiny?: boolean;
}

export interface RosterPick extends Lot {
  price: number;
}

export interface Side {
  id: string;
  name: string;
  avatarUrl: string | null;
  budget: number;
  roster: RosterPick[];
  isNpc: boolean;
}

export interface Rules {
  budget: number;
  rosterSize: number;
}

export const DEFAULT_RULES: Rules = {
  budget: 20,
  rosterSize: 5,
};

export const BUDGET_PRESETS = [
  { budget: 20, rosterSize: 5, label: "$20 · 5 picks", note: "The classic" },
  { budget: 50, rosterSize: 6, label: "$50 · 6 picks", note: "Room to breathe" },
  { budget: 100, rosterSize: 8, label: "$100 · 8 picks", note: "Full auction" },
];

// ── Seeded RNG ───────────────────────────────────────────────────────────────
// mulberry32 — small, fast, and good enough that two clients with the same seed
// nominate the same lots in the same order.

export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

/** One six-sided die. */
export function rollDie(): number {
  return 1 + Math.floor(Math.random() * 6);
}

// ── Variant rarity ───────────────────────────────────────────────────────────

/**
 * How likely each grade is to be the one rolled, when an entry offers several.
 *
 * The rule of thumb is distance from neutral: the further a variant swings the
 * pick, the rarer it is. A middling condition is the everyday case, a
 * crippling one is a genuine event, and a mythic form is the thing people talk
 * about afterwards.
 *
 * Mythic's number here looks high because it isn't the gate — the per-game
 * slot below is. Most games never open the slot at all, so this weight only
 * decides whether a mythic that IS available actually lands when its character
 * comes up.
 */
const GRADE_WEIGHT: Record<VariantGrade, number> = {
  neutral: 26,
  weakening: 18,
  boon: 18,
  crippling: 7, // rare
  major: 6, // uncommon, but the only positive grade above boon that isn't rationed
  legendary: 5, // rationed per game
  exalted: 12, // rationed harder, so the weight can afford to be higher
  mythic: 20, // super rare — see mythicSlots()
  uber: 0, // never chosen from an entry's list; only the 1/500 roll grants one
};

/**
 * The wildness dial (0-10) doesn't just change what the board is written
 * with — it changes what actually gets rolled. Cranking it to 10 is a request
 * for the big swings to turn up, so the good ones get commoner and the
 * do-nothing ones get rarer. 5 is neutral and leaves every weight as written.
 */
function wildnessTilt(grade: VariantGrade, wild: number): number {
  switch (grade) {
    case "uber":
    case "mythic":
    case "exalted":
    case "legendary":
    case "major":
      return 0.35 + wild * 0.13; // 0 -> 0.35x, 5 -> 1x, 10 -> 1.65x
    case "crippling":
      return 0.6 + wild * 0.08; // big swing, but not one anybody is hoping for
    case "neutral":
      return 1.4 - wild * 0.08; // the "just funny" ones give way at high wildness
    default:
      return 1;
  }
}

/**
 * Mythic slots for one draft — roughly one every 1.5 games at the default
 * wildness, none at all at the bottom of the dial, and better than guaranteed
 * at the top.
 *
 * Rolled once when the game starts rather than per lot, which is what makes
 * the rate predictable: the slot can only be spent once, and a game that
 * didn't open one never shows a mythic however many legendary forms the board
 * happens to carry.
 */
function mythicSlots(rng: () => number, wild: number): number {
  const expected = 0.01 + wild * 0.13; // 0 -> ~0, 5 -> 0.66, 10 -> 1.31
  return Math.floor(expected) + (rng() < expected % 1 ? 1 : 0);
}

/**
 * Per-game allowance for the rarest grades. Created once per draft and passed
 * to every `buildLot` call, which spends it.
 */
export interface VariantBudget {
  mythicsLeft: number;
  exaltedLeft: number;
  legendariesLeft: number;
  /** The board's wildness dial, 0-10 — tilts every roll */
  wild: number;
  /**
   * The frequency dial, 0-10 — the chance a pick that HAS variants actually
   * shows one rather than turning up as its plain self.
   *
   * On a generated board this dial also decides how many entries get written
   * with variants at all; on a hand-authored board the variants already exist,
   * so this is the only thing it can act on. That's what makes the dial mean
   * the same thing on both: 0 is never, 10 is every time.
   */
  rate: number;
}

export const DEFAULT_WILDNESS = 5;
export const DEFAULT_RATE = 5;

export function newVariantBudget(
  rng: () => number = Math.random,
  wild = DEFAULT_WILDNESS,
  rate = DEFAULT_RATE
): VariantBudget {
  const w = Math.max(0, Math.min(10, Math.round(wild)));
  const r = Math.max(0, Math.min(10, Math.round(rate)));
  return {
    mythicsLeft: mythicSlots(rng, w),
    // Rarer than legendary, commoner than mythic: none at all at the bottom
    // of the dial, two at the top.
    exaltedLeft: Math.round(w * 0.2),
    // Very rare by default; the dial can open it up to four.
    legendariesLeft: Math.max(1, Math.round(w * 0.4)),
    wild: w,
    rate: r,
  };
}

function affordable(grade: VariantGrade, budget: VariantBudget | undefined): boolean {
  if (!budget) return true;
  if (grade === "mythic") return budget.mythicsLeft > 0;
  if (grade === "exalted") return budget.exaltedLeft > 0;
  if (grade === "legendary") return budget.legendariesLeft > 0;
  return true;
}

function spend(grade: VariantGrade, budget: VariantBudget | undefined) {
  if (!budget) return;
  if (grade === "mythic") budget.mythicsLeft -= 1;
  else if (grade === "exalted") budget.exaltedLeft -= 1;
  else if (grade === "legendary") budget.legendariesLeft -= 1;
}

/**
 * Whether this pick turns up with a condition on it at all, or as its plain
 * self. Rolled before the grade is chosen, so the frequency dial and the
 * wildness dial stay independent — how OFTEN vs how BIG.
 */
function showsVariant(rng: () => number, budget: VariantBudget | undefined): boolean {
  const rate = budget?.rate ?? DEFAULT_RATE;
  if (rate <= 0) return false;
  if (rate >= 10) return true;
  return rng() < rate / 10;
}

/**
 * Choose which of an entry's variants gets rolled. Weighted by grade and
 * filtered by what the draft can still afford; if the budget rules everything
 * out, the mildest option on offer is used rather than no variant at all.
 */
function rollVariant(
  variants: Variant[],
  baseTier: number,
  rng: () => number,
  budget: VariantBudget | undefined
): number {
  const graded = variants.map((v, i) => ({ i, grade: variantGrade(v, baseTier) }));
  const eligible = graded.filter((g) => affordable(g.grade, budget));
  const pool = eligible.length ? eligible : graded.filter((g) => g.grade === "neutral" || g.grade === "weakening");

  if (!pool.length) {
    // Everything this entry offers is priced out — take the least extreme.
    const order: VariantGrade[] = ["neutral", "weakening", "boon", "crippling", "major", "legendary", "exalted", "mythic"];
    return graded.sort((a, b) => order.indexOf(a.grade) - order.indexOf(b.grade))[0].i;
  }

  const wild = budget?.wild ?? DEFAULT_WILDNESS;
  const weight = (g: VariantGrade) => GRADE_WEIGHT[g] * wildnessTilt(g, wild);

  const total = pool.reduce((sum, g) => sum + weight(g.grade), 0);
  let roll = rng() * total;
  for (const g of pool) {
    roll -= weight(g.grade);
    if (roll <= 0) {
      spend(g.grade, budget);
      return g.i;
    }
  }
  const last = pool[pool.length - 1];
  spend(last.grade, budget);
  return last.i;
}

// ── Lot construction ─────────────────────────────────────────────────────────

/**
 * Roll one entry into a concrete lot, picking a variant if it has any.
 *
 * `budget` is the draft's allowance for the rarest grades. Pass the same
 * object for the whole game — without it every roll is independent and mythics
 * turn up far too often.
 */
export function buildLot(
  entry: Entry,
  entryIndex: number,
  pack: Pack,
  rng: () => number,
  budget?: VariantBudget
): Lot {
  let variant: Variant | null = null;
  let variantIndex = -1;

  /**
   * The uber roll comes FIRST and replaces the normal variant entirely.
   *
   * An uber is not a state of the character, so pairing it with one reads as
   * nonsense — "Jaime Lannister (one hand, with a lightsaber)" is a worse joke
   * than either half. At one in five hundred this branch is almost never
   * taken, which is the point.
   */
  // An uber-only card always arrives as itself — it is in the pool at all only
  // because its rare roll already succeeded, so it must not then be handed
  // some other uber, or a plain variant.
  const declaredUber = entry.uberOnly
    ? entry.variants?.find((v) => v.g === "uber") ?? null
    : null;

  const uber = declaredUber ? declaredUber.v : rollUber(rng);
  if (uber) {
    variant = { v: uber, g: "uber" };
    variantIndex = -2; // distinct from -1 (no variant) so the lot id stays unique
  } else if (entry.variants && entry.variants.length > 0 && showsVariant(rng, budget)) {
    variantIndex = rollVariant(entry.variants, entry.t, rng, budget);
    variant = entry.variants[variantIndex];
  }
  /**
   * Shiny rides on top, and changes nothing but the card.
   *
   * Unlike an uber it does not replace the variant, because in the franchise
   * it is a palette and not a power — a shiny Mega Charizard X is a shiny AND
   * a Mega. So the grade and the tier are left exactly as rolled and only the
   * text changes, which keeps "★ shiny, still a Charmeleon" as funny as it
   * ought to be. Never on an uber: that card is already the rarest thing that
   * can happen and stacking two jackpots reads as a bug.
   */
  let shiny = false;
  if (pack.shinies && !uber && rng() < SHINY_CHANCE) {
    shiny = true;
    variant = variant ? { ...variant, v: `★ shiny ${variant.v}` } : { v: "★ shiny", g: "boon" };
    // A distinct index so two lots of the same entry, one shiny, keep
    // different ids — the client keys the portrait cache off this.
    variantIndex = variantIndex === -1 ? -3 : variantIndex + 100;
  }

  const searchBase = entry.s ? `${entry.n} ${entry.s}` : entry.n;
  return {
    id: `${pack.id}:${entryIndex}:${variantIndex}`,
    name: entry.n,
    variant: variant ? variant.v : null,
    variantGrade: variant ? variantGrade(variant, entry.t) : null,
    tier: variant ? effectiveTier(variant, entry.t) : entry.t,
    // Deliberately the plain name: the portrait cascade has no shiny art for
    // most of the dex, and a failed shiny search would lose the picture
    // altogether. The star on the card carries it.
    imgQuery: `${searchBase} ${pack.imgContext}`.trim(),
    shiny: shiny || undefined,
  };
}

export interface PoolOptions {
  /**
   * Names drafted in recent games on this board. Their weight is cut so the
   * same faces don't headline every session — they can still appear, they
   * just have to get lucky for a while.
   */
  recent?: Set<string>;
}

/** Prominence -> draw weight. A 5 is roughly 8x as likely to lead as a 1. */
const FAME_WEIGHT = [0, 1, 2.2, 4, 6, 8.5];

/**
 * Order the pack into a draft queue. Returns entry indices, not lots.
 *
 * Weighted sampling without replacement (Efraimidis–Spirakis): each entry
 * draws a key of random^(1/weight) and the queue is that key, descending.
 * Heavier entries usually land early, lighter ones usually land late — but
 * every entry keeps a real chance at every position, which is the point.
 * Jon Snow headlines most drafts; Strong Belwas still turns up sometimes.
 *
 * Nothing is pinned. A draft only reaches ~12 of 50+ entries, so the pool
 * genuinely differs game to game.
 */
export function buildPool(pack: Pack, rng: () => number, opts: PoolOptions = {}): number[] {
  return pack.entries
    .map((e, i) => ({ e, i }))
    // Uber-only cards are not in the rotation. Each gets one chance per draft
    // at the same one-in-five-hundred odds an uber variant has, so a board can
    // carry a card almost nobody will ever be dealt.
    .filter(({ e }) => !e.uberOnly || rng() < UBER_CHANCE)
    .map(({ e, i }) => {
      const fame = FAME_WEIGHT[Math.max(1, Math.min(5, Math.round(e.f ?? 3)))];
      // Seen lately: heavily demoted, never excluded.
      const weight = opts.recent?.has(e.n.toLowerCase()) ? fame * 0.18 : fame;
      // rng() can return 0; nudge it so the log/pow stays finite.
      const u = Math.max(rng(), 1e-9);
      return { i, key: Math.pow(u, 1 / weight) };
    })
    .sort((a, b) => b.key - a.key)
    .map((x) => x.i);
}

/**
 * Give a board its one-in-five-hundred chance of carrying a cosmic card.
 *
 * Appended to the entries rather than handled specially, so everything
 * downstream — the pool, the lot, the portrait lookup — treats it as an
 * ordinary entry that happens to be flagged uberOnly. Called once when the
 * board is dealt, which means it also travels to a PvP guest with the pack.
 */
export function withUberCard(pack: Pack, rng: () => number): Pack {
  /**
   * Everything the board is made of, so a crossover qualifies through its
   * cast. "Thrones vs LOTR" never says Tolkien, but it says Aragorn — and a
   * board that has Aragorn on it is a board where Eru means something.
   */
  const boardText = [
    pack.name,
    pack.scenario,
    pack.criteria,
    pack.imgContext,
    pack.wiki ?? "",
    ...pack.entries.map((e) => `${e.n} ${e.s ?? ""}`),
  ].join(" ");

  const card = rollUberCard(rng, boardText);
  if (!card) return pack;
  if (pack.entries.some((e) => e.n === card.n)) return pack;
  return {
    ...pack,
    entries: [
      ...pack.entries,
      { n: card.n, t: 5, s: card.s, uberOnly: true, variants: [{ v: card.v, g: "uber" as const }] },
    ],
  };
}

/** Roll one of the pack's arenas, by weight. Returns null when it has none. */
export function pickArena(pack: Pack, rng: () => number): Arena | null {
  const arenas = pack.arenas;
  if (!arenas?.length) return null;
  const total = arenas.reduce((sum, a) => sum + Math.max(0, a.weight), 0);
  if (total <= 0) return null;
  let roll = rng() * total;
  for (const a of arenas) {
    roll -= Math.max(0, a.weight);
    if (roll <= 0) return a;
  }
  return arenas[arenas.length - 1];
}

/**
 * Bake a rolled arena into the board, so the judge, the battle and the ready
 * screen all describe the same fight without extra plumbing.
 */
export function applyArena(pack: Pack, rng: () => number): Pack {
  const arena = pickArena(pack, rng);
  if (!arena) return pack;
  return {
    ...pack,
    scenario: `${pack.scenario} ${arena.desc}`,
    arenaName: arena.name,
    arenaDesc: arena.desc,
  };
}

// ── Budget rules ─────────────────────────────────────────────────────────────

/**
 * Most a side can legally bid right now: their whole wallet.
 *
 * There is deliberately no reserve rule. You can put every dollar on one
 * pick; the cost is finishing with empty slots, which the judge holds
 * against you. Returns 0 when the side is full (out of the bidding).
 */
export function maxBid(side: Side, rules: Rules): number {
  if (isFull(side, rules)) return 0;
  return Math.max(0, side.budget);
}

export function isFull(side: Side, rules: Rules): boolean {
  return side.roster.length >= rules.rosterSize;
}

/** Has a slot and at least $1 — could actually contest a lot. */
export function canBidAtAll(side: Side, rules: Rules): boolean {
  return !isFull(side, rules) && maxBid(side, rules) >= 1;
}

/**
 * Can open the bidding on an unclaimed lot.
 *
 * With money, always. Broke, only when nobody could outbid a free claim —
 * the opponent is full or broke too. While the other side still has cash,
 * a broke player can't open at all; they scavenge once the money's gone.
 * That's what keeps "$0 claim" from being a hack against a live wallet.
 */
export function canOpen(side: Side, rules: Rules, opponent?: Side): boolean {
  if (isFull(side, rules)) return false;
  if (maxBid(side, rules) >= 1) return true;
  return !opponent || !canBidAtAll(opponent, rules);
}

/** The opening bid this side puts down: $1, or $0 if that's all they have. */
export function openingBid(side: Side, rules: Rules): number {
  return Math.min(1, maxBid(side, rules));
}

/** Can beat the standing bid. */
export function canRaise(side: Side, rules: Rules, currentBid: number): boolean {
  return !isFull(side, rules) && maxBid(side, rules) > currentBid;
}

/**
 * Can equal the standing bid but not beat it — the "even" case, including
 * two broke players both wanting a free lot. Rather than letting turn order
 * decide, the matching side may roll dice for it.
 */
export function canMatch(side: Side, rules: Rules, currentBid: number): boolean {
  return !isFull(side, rules) && maxBid(side, rules) === currentBid;
}

/** "$4", or "free" for a $0 claim — used in tickers and stamps. */
export function priceLabel(n: number): string {
  return n > 0 ? `$${n}` : "free";
}

export function otherSide(sides: Side[], id: string | null): Side | undefined {
  return sides.find((s) => s.id !== id);
}

export function draftComplete(sides: Side[], rules: Rules, lotsRemaining: number): boolean {
  return sides.every((s) => isFull(s, rules)) || lotsRemaining <= 0;
}

// ── NPC bidding brain ────────────────────────────────────────────────────────

export interface NpcPersonality {
  id: string;
  name: string;
  emoji: string;
  /** Multiplier on their valuation — >1 overpays, <1 hunts bargains */
  aggro: number;
  /** How much random noise they add to a valuation */
  chaos: number;
  tagline: string;
}

export const NPC_PERSONALITIES: NpcPersonality[] = [
  { id: "shark", name: "The Shark", emoji: "🦈", aggro: 1.18, chaos: 0.12, tagline: "Overpays for studs. Regrets nothing." },
  { id: "scrooge", name: "Old Scrooge", emoji: "🪙", aggro: 0.82, chaos: 0.1, tagline: "Bargain hunter. Will let you have it." },
  { id: "gambler", name: "The Gambler", emoji: "🎲", aggro: 1.0, chaos: 0.38, tagline: "Nobody knows what he's doing. Including him." },
  { id: "professor", name: "The Professor", emoji: "🎓", aggro: 1.0, chaos: 0.05, tagline: "Values everything correctly. Boring. Effective." },
];

/** Rough "fair" price for a tier, before personality and situation. */
function baseValue(tier: number, rules: Rules): number {
  const fairShare = rules.budget / rules.rosterSize;
  const mult = [0, 0.35, 0.6, 1.0, 1.5, 2.2, 3.1, 4.2, 5.5, 7.0, 8.8, 11.0, 13.5][
    Math.max(1, Math.min(MAX_TIER, Math.round(tier)))
  ];
  return fairShare * mult;
}

/**
 * The most this NPC is willing to pay for this lot.
 * Cached per-lot by the caller so the NPC doesn't re-roll its nerve mid-auction.
 */
export function npcValuation(
  lot: Lot,
  side: Side,
  rules: Rules,
  personality: NpcPersonality,
  lotsRemaining: number,
  rng: () => number
): number {
  const slotsLeft = rules.rosterSize - side.roster.length;
  if (slotsLeft <= 0) return 0;

  let value = baseValue(lot.tier, rules) * personality.aggro;

  // Chaos — a little nerve, a little tilt.
  value *= 1 + (rng() * 2 - 1) * personality.chaos;

  // Desperation: if there are barely more lots left than slots to fill, the
  // NPC stops being precious about value and starts filling chairs.
  if (lotsRemaining <= slotsLeft + 1) {
    value *= 1.9;
  } else if (lotsRemaining <= slotsLeft * 2) {
    value *= 1.3;
  }

  // Sitting on cash late is the classic auction mistake — spend it.
  const perSlot = side.budget / slotsLeft;
  const fairShare = rules.budget / rules.rosterSize;
  if (perSlot > fairShare * 1.6) value *= 1.25;

  return Math.max(1, Math.round(Math.min(value, maxBid(side, rules))));
}

export type NpcMove = { kind: "bid"; amount: number } | { kind: "match" } | { kind: "pass" };

/** What the NPC does on its turn. */
export function npcMove(
  valuation: number,
  side: Side,
  rules: Rules,
  currentBid: number,
  opening = currentBid === 0,
  opponent?: Side
): NpcMove {
  if (opening) {
    return canOpen(side, rules, opponent) && valuation >= 1
      ? { kind: "bid", amount: openingBid(side, rules) }
      : { kind: "pass" };
  }
  const next = currentBid + 1;
  if (next <= valuation && canRaise(side, rules, currentBid)) return { kind: "bid", amount: next };
  // Would pay this much but can't outbid — roll for it.
  if (valuation >= currentBid && canMatch(side, rules, currentBid)) return { kind: "match" };
  return { kind: "pass" };
}

/** How long the NPC "thinks" — closer to its ceiling, longer it stalls. */
export function npcThinkMs(valuation: number, currentBid: number): number {
  const headroom = valuation - currentBid;
  if (headroom >= 4) return 700 + Math.random() * 700;
  if (headroom >= 2) return 1100 + Math.random() * 900;
  return 1600 + Math.random() * 1400;
}

// ── Offline scoring (fallback when the AI judge is unreachable) ───────────────

export interface SideScore {
  sideId: string;
  power: number;
}

/**
 * Score a roster on what it IS, never on what it cost.
 *
 * Price is deliberately absent here and from everything downstream. A $1
 * steal and a $12 splurge of the same character are the same fighter, so
 * paying more must not make a pick contribute more — that would score the
 * bidding rather than the draft.
 */
export function scoreSide(side: Side): SideScore {
  // Superlinear in tier: one monster beats three mediocre picks, which is how
  // these drafts actually feel.
  const power = side.roster.reduce((sum, p) => sum + Math.pow(p.tier, 1.7), 0);
  return { sideId: side.id, power: Math.round(power * 10) / 10 };
}

/**
 * Power after the other side's hard counters have been applied.
 *
 * A scorpion opposite a dragon is not a matter of taste, so it does not wait
 * for a model to notice it. The counter removes its expected share of that
 * target's strength before anything else is compared, which is what stops the
 * offline path from calling a dragon unbeatable when the board contains the
 * one machine built to shoot it down.
 */
function counteredPower(side: Side, opponents: Side[]): number {
  const incoming = opponents.flatMap((o) => counterHits(o.roster, side.roster));
  return side.roster.reduce((sum, p) => {
    const hit = incoming.find((h) => h.target === p.name);
    const surviving = hit ? 1 - hit.effect : 1;
    return sum + Math.pow(p.tier, 1.7) * surviving;
  }, 0);
}

export function offlineVerdict(sides: Side[]): { winnerId: string; scores: SideScore[]; reasoning: string } {
  const scores = sides.map((s) => ({
    sideId: s.id,
    power: Math.round(counteredPower(s, sides.filter((o) => o.id !== s.id)) * 10) / 10,
  }));

  // Compare using raw unrounded floats so identical-looking rounded scores
  // never produce a true tie. Cascade through roster size and tier-by-tier
  // as further tiebreakers; the stable sideId comparison guarantees a winner
  // even for genuinely identical rosters.
  const raw = sides.map((s) => ({
    sideId: s.id,
    rawPower: counteredPower(s, sides.filter((o) => o.id !== s.id)),
    size: s.roster.length,
    tiers: [...s.roster].map((p) => p.tier).sort((a, b) => b - a),
  }));

  const sorted = [...raw].sort((a, b) => {
    if (Math.abs(b.rawPower - a.rawPower) > 1e-9) return b.rawPower - a.rawPower;
    if (b.size !== a.size) return b.size - a.size;
    for (let i = 0; i < Math.max(a.tiers.length, b.tiers.length); i++) {
      const d = (b.tiers[i] ?? 0) - (a.tiers[i] ?? 0);
      if (d !== 0) return d;
    }
    return a.sideId < b.sideId ? 1 : -1;
  });

  const winner = scores.find((s) => s.sideId === sorted[0].sideId)!;
  const loser = scores.find((s) => s.sideId === sorted[sorted.length - 1].sideId)!;
  const margin = winner.power - loser.power;
  const closeness =
    margin < 3 ? "It came down to the last pick." : margin < 12 ? "A clear but honest win." : "It was not close.";
  return {
    winnerId: winner.sideId,
    scores,
    reasoning: `Top-end power decided it — ${winner.power} to ${loser.power}. ${closeness}`,
  };
}

// ── Ratings ──────────────────────────────────────────────────────────────────

export const STARTING_RATING = 1000;

/** Standard Elo, K=32. Returns the new ratings for (winner, loser). */
export function eloUpdate(winner: number, loser: number, k = 32): [number, number] {
  const expectedWin = 1 / (1 + Math.pow(10, (loser - winner) / 400));
  const delta = Math.round(k * (1 - expectedWin));
  return [winner + delta, loser - delta];
}
