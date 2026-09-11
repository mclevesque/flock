import type { Lot, Rules, Side } from "@/lib/draftmasters/engine";
import type { Pack } from "@/lib/draftmasters/packs";
import type { ContestPlan } from "@/lib/draftmasters/contest";

export type { Lot, Rules, Side, Pack, ContestPlan };

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

export type BeatKind =
  | "entrance"
  | "clash"
  | "kill"
  | "standoff"
  | "heroic"
  | "comic"
  | "turn"
  /** A scorecard, a ruling, an official's call — the beat a judged contest turns on */
  | "judgment"
  | "final";

/** One moment of the battle cinematic. */
export interface BattleBeat {
  actors: string[];
  sideId: string;
  targetSideId?: string;
  text: string;
  kind: BeatKind;
  /** 0–3; drives screen shake, slashes and musical accents */
  intensity: number;
  eliminated?: string[];
  /** Cards put back on their feet by this beat. Un-strikes them on screen. */
  revived?: string[];

  /** The rules line, for the technical log beside the stage. */
  plain?: string;
  /** Whether this beat has prose worth putting on the stage. */
  story?: boolean;
  /** Who swung at whom, and what it cost. See lib/draftmasters/script.ts. */
  from?: string;
  to?: string;
  damage?: number;
  hpAfter?: number;
  hpMax?: number;
  /** The attack used, and the one printed on the card, so a boost reads green. */
  atk?: number;
  atkBase?: number;
}

export interface BattleScript {
  beats: BattleBeat[];
  winnerId: string;
  /** Which board these cards came from, so the screen can rebuild their stats. */
  boardId?: string;
  /**
   * The order each side actually fights in, and who is holding back.
   *
   * The roster is in DRAFT order, which is the order lots came up at auction
   * and tells a player nothing during a battle.
   */
  lineup?: { sideId: string; order: string[]; captain: string | null }[];
  scripted: "ai" | "offline";
  /**
   * The story, once somebody has written it.
   *
   * In a friend game both clients used to call the writer with the same fight
   * and get two different accounts of it -- two bills, and two players reading
   * different battles. The driver writes it and it rides here, on the script
   * the room already shares, so the other player replays the same prose.
   */
  told?: {
    beats: { text: string; kills: string[]; turned: string[]; nulled: string[] }[];
    winnerId: string;
    why: string;
    mvp: { name: string; note: string } | null;
  } | null;
  /** FormatId the contest was staged as — see lib/draftmasters/contest */
  format?: string;
  /** Shown on the cinematic's top bar, e.g. "Judged beauty pageant" */
  formatLabel?: string;
  /**
   * What gets stamped on a competitor who is out. "DEAD" is wrong for a
   * pageant and wrong for a Pokemon battle — this is the one-word fix.
   */
  outLabel?: string;
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
  /**
   * The judge's read on what kind of contest this was, who was biased and
   * what technicality decided it. Handed straight to the battle writer so the
   * show is staged the same way the verdict was reasoned.
   */
  plan?: ContestPlan;
  /** Set when the judge scored it even and dice decided it */
  diceBreak?: DiceState | null;
  /**
   * The card the battle turned on, named by whoever wrote it.
   *
   * Not the resolver's MVP: that one was computed before the story existed
   * and could crown a card the prose never mentions.
   */
  mvp?: { name: string; note: string } | null;
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
  /** How many characters are on it. The one number every picker row shows. */
  count: number;
  /** The board's most prominent entry — the face on its card in the picker. */
  heroName: string;
  heroQuery: string;
  heroWiki: string;
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
