import type { Lot, Rules, Side } from "@/lib/draftmasters/engine";
import type { Pack } from "@/lib/draftmasters/packs";

export type { Lot, Rules, Side, Pack };

export interface TickerEvent {
  id: number;
  text: string;
  kind: "bid" | "sold" | "passed" | "dice" | "system";
}

/**
 * A dice-off in progress or just resolved. Rolled when two sides are even —
 * a matched bid on a lot, or a tied verdict. Ties reroll until someone wins.
 */
export interface DiceState {
  reason: "lot" | "verdict";
  /** Both contestants, in roll order */
  sideIds: [string, string];
  /** Every round rolled so far; the last entry is the current one */
  rounds: { a: number; b: number }[];
  winnerId: string | null;
  /** Price the lot sells for if this is a lot dice-off */
  price: number;
}

/**
 * The shape both the solo engine and the PvP room produce. One view type means
 * one set of screens — the auction stage never needs to know which mode it's in.
 */
export interface GameView {
  phase: "ready" | "bidding" | "dice" | "sold" | "complete";
  lot: Lot | null;
  currentBid: number;
  highBidderId: string | null;
  /** Whose decision it is right now — bidding is strictly alternating */
  turnId: string | null;
  openerId: string | null;
  /** Sides that have declined to open this lot */
  passedIds: string[];
  /**
   * Sides that have used their one free pass while drafting unopposed —
   * their next lot must fill a slot.
   */
  passLocked: string[];
  dice: DiceState | null;
  lotsRemaining: number;
  sides: Side[];
  ticker: TickerEvent[];
  readyIds: string[];
}

/** How much one drafted pick mattered to the result, 0–10. */
export interface PickContribution {
  name: string;
  contribution: number;
}

export interface SideNote {
  sideId: string;
  score: number;
  mvp: string;
  bust: string;
  note: string;
  picks?: PickContribution[];
}

export interface Verdict {
  winnerId: string;
  headline: string;
  reasoning: string;
  sideNotes: SideNote[];
  judged: "ai" | "offline";
  /** Set when the judge scored it even and dice decided it */
  diceBreak?: DiceState | null;
}

export interface ChatLine {
  userId: string;
  name: string;
  text: string;
  at: number;
  /** Server-generated lines (dice rolls) render differently */
  system?: boolean;
}

export interface PackSummary {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
}

export interface PlayerRecord {
  userId: string;
  name: string;
  rating: number;
  pvpWins: number;
  pvpLosses: number;
  soloWins: number;
  soloLosses: number;
  streak: number;
  bestStreak: number;
}

/** imgQuery -> resolved portrait URL (null when nothing was found) */
export type PortraitMap = Record<string, string | null>;

export const EMPTY_VIEW: GameView = {
  phase: "ready",
  lot: null,
  currentBid: 0,
  highBidderId: null,
  turnId: null,
  openerId: null,
  passedIds: [],
  passLocked: [],
  dice: null,
  lotsRemaining: 0,
  sides: [],
  ticker: [],
  readyIds: [],
};
