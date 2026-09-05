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
 *   • Reserve rule: you must keep $1 for every roster slot still open, so
 *     max bid = budget − (slotsRemaining − 1). Blowing the bank on pick one
 *     leaves you scavenging $1 leftovers, not drafting empty chairs.
 *   • The draft ends when every roster is full, or the pool runs dry.
 *
 * Pure and deterministic given a seed, so the solo game and the PartyKit
 * room run the same code and never disagree.
 */

import type { Entry, Pack, Variant } from "./packs";

export interface Lot {
  /** Stable id — pack entry index plus variant index */
  id: string;
  name: string;
  /** Rolled condition, e.g. "two hands" — null when the entry has no variants */
  variant: string | null;
  /** Effective tier after the variant is applied */
  tier: number;
  /** Query used for the portrait lookup */
  imgQuery: string;
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

// ── Lot construction ─────────────────────────────────────────────────────────

/** Roll one entry into a concrete lot, picking a variant if it has any. */
export function buildLot(entry: Entry, entryIndex: number, pack: Pack, rng: () => number): Lot {
  let variant: Variant | null = null;
  let variantIndex = -1;
  if (entry.variants && entry.variants.length > 0) {
    variantIndex = Math.floor(rng() * entry.variants.length);
    variant = entry.variants[variantIndex];
  }
  const searchBase = entry.s ? `${entry.n} ${entry.s}` : entry.n;
  return {
    id: `${pack.id}:${entryIndex}:${variantIndex}`,
    name: entry.n,
    variant: variant ? variant.v : null,
    tier: variant ? variant.t : entry.t,
    imgQuery: `${searchBase} ${pack.imgContext}`.trim(),
  };
}

/** Shuffle the pack into a draft order. Returns entry indices, not lots. */
export function buildPool(pack: Pack, rng: () => number): number[] {
  const idx = pack.entries.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

// ── Budget rules ─────────────────────────────────────────────────────────────

/**
 * Most a side can legally bid right now.
 * Reserves $1 for every slot they'd still need to fill after winning this lot.
 * Returns 0 when the side is full (and therefore out of the bidding).
 */
export function maxBid(side: Side, rules: Rules): number {
  const slotsLeft = rules.rosterSize - side.roster.length;
  if (slotsLeft <= 0) return 0;
  return Math.max(0, side.budget - (slotsLeft - 1));
}

export function isFull(side: Side, rules: Rules): boolean {
  return side.roster.length >= rules.rosterSize;
}

/** Can put the first dollar on an unbid lot. */
export function canOpen(side: Side, rules: Rules): boolean {
  return !isFull(side, rules) && maxBid(side, rules) >= 1;
}

/** Can beat the standing bid. */
export function canRaise(side: Side, rules: Rules, currentBid: number): boolean {
  return !isFull(side, rules) && maxBid(side, rules) > currentBid;
}

/**
 * Can equal the standing bid but not beat it — the "even" case. Rather than
 * letting turn order decide, the matching side may roll dice for the lot.
 */
export function canMatch(side: Side, rules: Rules, currentBid: number): boolean {
  return currentBid > 0 && !isFull(side, rules) && maxBid(side, rules) === currentBid;
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
  const mult = [0, 0.35, 0.6, 1.0, 1.5, 2.2][Math.max(1, Math.min(5, Math.round(tier)))];
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
export function npcMove(valuation: number, side: Side, rules: Rules, currentBid: number): NpcMove {
  if (currentBid === 0) {
    return canOpen(side, rules) && valuation >= 1 ? { kind: "bid", amount: 1 } : { kind: "pass" };
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
  spent: number;
  /** Power per dollar actually spent — the value story */
  efficiency: number;
}

export function scoreSide(side: Side): SideScore {
  // Superlinear in tier: one monster beats three mediocre picks, which is how
  // these drafts actually feel.
  const power = side.roster.reduce((sum, p) => sum + Math.pow(p.tier, 1.7), 0);
  const spent = side.roster.reduce((sum, p) => sum + p.price, 0);
  return {
    sideId: side.id,
    power: Math.round(power * 10) / 10,
    spent,
    efficiency: spent > 0 ? Math.round((power / spent) * 100) / 100 : 0,
  };
}

export function offlineVerdict(sides: Side[]): { winnerId: string; scores: SideScore[]; reasoning: string } {
  const scores = sides.map(scoreSide);
  const sorted = [...scores].sort((a, b) => b.power - a.power || b.efficiency - a.efficiency);
  const winner = sorted[0];
  const loser = sorted[sorted.length - 1];
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
