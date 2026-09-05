import type { Lot, Rules, Side } from "@/lib/draftmasters/engine";
import type { Pack } from "@/lib/draftmasters/packs";

export type { Lot, Rules, Side, Pack };

export interface TickerEvent {
  id: number;
  text: string;
  kind: "bid" | "sold" | "passed" | "system";
}

/**
 * The shape both the solo engine and the PvP room produce. One view type means
 * one set of screens — the auction stage never needs to know which mode it's in.
 */
export interface GameView {
  phase: "ready" | "bidding" | "sold" | "complete";
  lot: Lot | null;
  currentBid: number;
  highBidderId: string | null;
  openerId: string | null;
  openerPassed: boolean;
  /** Absolute epoch ms the current window closes */
  deadline: number;
  lotsRemaining: number;
  sides: Side[];
  ticker: TickerEvent[];
  readyIds: string[];
}

export interface SideNote {
  sideId: string;
  score: number;
  mvp: string;
  bust: string;
  note: string;
}

export interface Verdict {
  winnerId: string;
  headline: string;
  reasoning: string;
  sideNotes: SideNote[];
  judged: "ai" | "offline";
}

export interface ChatLine {
  userId: string;
  name: string;
  text: string;
  at: number;
}

export interface PackSummary {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
}

/** imgQuery -> resolved portrait URL (null when nothing was found) */
export type PortraitMap = Record<string, string | null>;

export const EMPTY_VIEW: GameView = {
  phase: "ready",
  lot: null,
  currentBid: 0,
  highBidderId: null,
  openerId: null,
  openerPassed: false,
  deadline: 0,
  lotsRemaining: 0,
  sides: [],
  ticker: [],
  readyIds: [],
};
