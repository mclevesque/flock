/**
 * DraftMasters — auction draft engine.
 *
 * The format is a straight ascending-bid auction draft (the "salary cap draft"
 * used in fantasy sports, and the one every $20 draft video on the internet
 * is really running):
 *
 *   • Everyone starts with the same budget.
 *   • Lots are nominated one at a time from a shuffled pool.
 *   • Bidding is open and ascending, minimum increment $1.
 *   • The clock resets on every bid. When it expires, high bidder buys the lot
 *     at their bid. If nobody opened, the lot passes unsold.
 *   • You must reserve $1 for every roster slot you still have to fill —
 *     so max bid = budget − (slotsRemaining − 1). This is the rule that stops
 *     someone blowing $20 on pick one and drafting four empty chairs.
 *   • The draft ends when every roster is full, or the pool runs dry.
 *
 * All of this is pure and deterministic given a seed, so the solo game and the
 * PartyKit room can run the same code and never disagree.
 */

import type { Entry, Pack, Variant } from "./packs";

export type Phase = "setup" | "nominating" | "bidding" | "sold" | "complete";

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
  /** Seconds on the clock when a lot opens */
  openSeconds: number;
  /** Seconds the clock resets to after each bid */
  bidSeconds: number;
}

export const DEFAULT_RULES: Rules = {
  budget: 20,
  rosterSize: 5,
  openSeconds: 15,
  bidSeconds: 8,
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

export function canBid(side: Side, rules: Rules, currentBid: number): boolean {
  return maxBid(side, rules) >= currentBid + 1;
}

export function isFull(side: Side, rules: Rules): boolean {
  return side.roster.length >= rules.rosterSize;
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
 * The most this NPC is willing to pay for this lot right now.
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

/**
 * Decide the NPC's next action against a standing bid.
 * Returns the amount to bid, or null to pass.
 */
export function npcDecide(
  valuation: number,
  currentBid: number,
  npcHoldsHighBid: boolean,
  side: Side,
  rules: Rules
): number | null {
  if (npcHoldsHighBid) return null;
  const ceiling = Math.min(valuation, maxBid(side, rules));
  const next = currentBid + 1;
  if (next > ceiling) return null;
  return next;
}

/** How long the NPC "thinks" before bidding — closer to its ceiling, longer it stalls. */
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
