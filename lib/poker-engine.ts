// ─── Texas Hold'em Poker Engine ──────────────────────────────────────────────
// Pure functions — no DB. All game state lives in a JSONB column.

export type Card = string; // "As", "Kh", "Qd", "Jc", "Ts", "9h" …
export type Phase = "waiting" | "preflop" | "flop" | "turn" | "river" | "showdown";

export interface GameState {
  phase: Phase;
  deck: Card[];
  communityCards: Card[];
  hands: Record<string, Card[]>;       // userId → [card, card]
  pot: number;
  sidePots: SidePot[];
  currentBet: number;                  // highest bet in this round
  roundBets: Record<string, number>;   // bets this round (reset each round)
  totalBets: Record<string, number>;   // total invested this hand (for side pots)
  actionOn: string | null;
  actedSinceLastRaise: string[];       // fold/check/call clears; raise resets to [raiser]
  dealerUserId: string | null;
  sbUserId: string | null;
  bbUserId: string | null;
  folded: string[];
  allIn: string[];
  lastActionTime: number;
  winners: string[] | null;
  handRanks: Record<string, { name: string; bestCards: Card[] }> | null;
  actionLog: ActionEntry[];
  handNumber: number;
  minRaise: number;
  showdownAt: number | null; // timestamp when showdown started (for auto-advance)
  gameWinnerId: string | null; // set when one player collects all chips
  championId: string | null;   // table champion — player with most game wins
  gameWins: Record<string, number>; // userId → number of games won at this table
}

export interface SidePot {
  amount: number;
  eligible: string[]; // userIds who can win this pot
}

export interface ActionEntry {
  userId: string;
  username: string;
  action: string;
  amount: number;
  timestamp: number;
}

export interface PokerPlayer {
  user_id: string;
  username: string;
  avatar_url: string | null;
  chips: number;
  seat: number;
  status: string; // 'active' | 'sitting_out' | 'busted'
}

// ─── Constants ────────────────────────────────────────────────────────────────
export const SMALL_BLIND = 10;
export const BIG_BLIND = 20;
export const ACTION_TIMEOUT_MS = 30_000;
export const SHOWDOWN_DELAY_MS = 5_000;

// ─── Card helpers ─────────────────────────────────────────────────────────────
const RANKS = "23456789TJQKA";
const RANK_VAL: Record<string, number> = {};
for (let i = 0; i < RANKS.length; i++) RANK_VAL[RANKS[i]] = i + 2;

function rv(c: Card) { return RANK_VAL[c[0]] ?? 0; }
function suit(c: Card) { return c[1]; }

export function cardLabel(c: Card): { rank: string; suit: string; color: string } {
  const suitMap: Record<string, { sym: string; color: string }> = {
    h: { sym: "♥", color: "#e05555" },
    d: { sym: "♦", color: "#e05555" },
    s: { sym: "♠", color: "#1a1a1a" },
    c: { sym: "♣", color: "#1a6b1a" },
  };
  const rankMap: Record<string, string> = { T: "10", J: "J", Q: "Q", K: "K", A: "A" };
  const rank = rankMap[c[0]] ?? c[0];
  const info = suitMap[c[1]] ?? { sym: "?", color: "#888" };
  return { rank, suit: info.sym, color: info.color };
}

// ─── Deck ─────────────────────────────────────────────────────────────────────
function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const r of RANKS) for (const s of "hdsc") deck.push(r + s);
  return shuffle(deck);
}

function shuffle(arr: Card[]): Card[] {
  const d = [...arr];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// ─── Hand evaluation ──────────────────────────────────────────────────────────
const HAND_NAMES = [
  "High Card", "One Pair", "Two Pair", "Three of a Kind",
  "Straight", "Flush", "Full House", "Four of a Kind", "Straight Flush",
];

function score5(cards: Card[]): number[] {
  const ranks = cards.map(rv).sort((a, b) => b - a);
  const suits = cards.map(suit);
  const isFlush = suits.every(s => s === suits[0]);

  let straight = false, sHigh = 0;
  if (new Set(ranks).size === 5) {
    if (ranks[0] - ranks[4] === 4) { straight = true; sHigh = ranks[0]; }
    if (JSON.stringify(ranks) === JSON.stringify([14, 5, 4, 3, 2])) { straight = true; sHigh = 5; }
  }

  const freq: Record<number, number> = {};
  for (const r of ranks) freq[r] = (freq[r] || 0) + 1;
  const groups = Object.entries(freq)
    .map(([r, c]) => [+r, c] as [number, number])
    .sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  if (isFlush && straight) return [8, sHigh];
  if (groups[0][1] === 4) return [7, groups[0][0], groups[1][0]];
  if (groups[0][1] === 3 && groups[1]?.[1] === 2) return [6, groups[0][0], groups[1][0]];
  if (isFlush) return [5, ...ranks];
  if (straight) return [4, sHigh];
  if (groups[0][1] === 3) return [3, groups[0][0], groups[1][0], groups[2][0]];
  if (groups[0][1] === 2 && groups[1]?.[1] === 2) return [2, groups[0][0], groups[1][0], groups[2]?.[0] ?? 0];
  if (groups[0][1] === 2) return [1, groups[0][0], ...ranks.filter(r => r !== groups[0][0])];
  return [0, ...ranks];
}

function cmp(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

function bestOf7(cards: Card[]): { score: number[]; name: string; bestCards: Card[] } {
  let best: number[] = [-1];
  let bestCards: Card[] = [];
  const n = cards.length;
  for (let a = 0; a < n - 4; a++)
    for (let b = a + 1; b < n - 3; b++)
      for (let c = b + 1; c < n - 2; c++)
        for (let d = c + 1; d < n - 1; d++)
          for (let e = d + 1; e < n; e++) {
            const combo = [cards[a], cards[b], cards[c], cards[d], cards[e]];
            const s = score5(combo);
            if (cmp(s, best) > 0) { best = s; bestCards = combo; }
          }
  return { score: best, name: HAND_NAMES[best[0]] ?? "Unknown", bestCards };
}

// ─── Side pot calculation ─────────────────────────────────────────────────────
function calcSidePots(totalBets: Record<string, number>, notFolded: string[]): SidePot[] {
  const all = Object.keys(totalBets);
  const levels = [...new Set(Object.values(totalBets))].sort((a, b) => a - b);
  const pots: SidePot[] = [];
  let prev = 0;
  for (const lvl of levels) {
    const diff = lvl - prev;
    if (diff <= 0) continue;
    const contributors = all.filter(id => (totalBets[id] ?? 0) >= lvl);
    const eligible = notFolded.filter(id => (totalBets[id] ?? 0) >= lvl);
    if (contributors.length > 0 && eligible.length > 0) {
      pots.push({ amount: diff * contributors.length, eligible });
    }
    prev = lvl;
  }
  return pots;
}

// ─── Player ordering ──────────────────────────────────────────────────────────
function bySeats(players: PokerPlayer[]): PokerPlayer[] {
  return [...players].sort((a, b) => a.seat - b.seat);
}

/** Returns players in seat order starting from the seat AFTER `afterUserId` */
function fromAfter(players: PokerPlayer[], afterUserId: string, excludeFolded: string[] = [], excludeAllIn: string[] = []): PokerPlayer[] {
  const eligible = bySeats(players).filter(p =>
    !excludeFolded.includes(p.user_id) && !excludeAllIn.includes(p.user_id)
  );
  const idx = eligible.findIndex(p => p.user_id === afterUserId);
  if (idx === -1) return eligible;
  return [...eligible.slice(idx + 1), ...eligible.slice(0, idx + 1)];
}

// ─── Start a new hand ─────────────────────────────────────────────────────────
export function startHand(prev: GameState, players: PokerPlayer[]): GameState {
  const active = bySeats(players.filter(p => p.chips > 0 && p.status === "active"));
  if (active.length < 2) return { ...prev, phase: "waiting" };

  const deck = createDeck();
  let deckPos = 0;

  // Rotate dealer
  let dealerIdx = 0;
  if (prev.dealerUserId) {
    const pIdx = active.findIndex(p => p.user_id === prev.dealerUserId);
    dealerIdx = pIdx === -1 ? 0 : (pIdx + 1) % active.length;
  }
  const dealer = active[dealerIdx];
  const sbIdx = (dealerIdx + 1) % active.length;
  const bbIdx = (dealerIdx + 2) % active.length;
  const sb = active[sbIdx];
  const bb = active[bbIdx];

  // Deal 2 cards each
  const hands: Record<string, Card[]> = {};
  for (const p of active) hands[p.user_id] = [deck[deckPos++], deck[deckPos++]];

  // Post blinds
  const sbAmt = Math.min(SMALL_BLIND, sb.chips);
  const bbAmt = Math.min(BIG_BLIND, bb.chips);
  const roundBets: Record<string, number> = { [sb.user_id]: sbAmt, [bb.user_id]: bbAmt };
  const totalBets: Record<string, number> = { [sb.user_id]: sbAmt, [bb.user_id]: bbAmt };

  const allIn: string[] = [];
  if (sbAmt >= sb.chips) allIn.push(sb.user_id);
  if (bbAmt >= bb.chips) allIn.push(bb.user_id);

  // Pre-flop: UTG acts first (player after BB). Heads-up: dealer/SB acts first.
  const actionOn = active.length === 2
    ? sb.user_id
    : active[(bbIdx + 1) % active.length].user_id;

  return {
    phase: "preflop",
    deck: deck.slice(deckPos),
    communityCards: [],
    hands,
    pot: 0,
    sidePots: [],
    currentBet: bbAmt,
    roundBets,
    totalBets,
    actionOn,
    actedSinceLastRaise: [],
    dealerUserId: dealer.user_id,
    sbUserId: sb.user_id,
    bbUserId: bb.user_id,
    folded: [],
    allIn,
    lastActionTime: Date.now(),
    winners: null,
    handRanks: null,
    actionLog: [
      { userId: sb.user_id, username: sb.username, action: "posts small blind", amount: sbAmt, timestamp: Date.now() },
      { userId: bb.user_id, username: bb.username, action: "posts big blind", amount: bbAmt, timestamp: Date.now() },
    ],
    handNumber: (prev.handNumber ?? 0) + 1,
    minRaise: BIG_BLIND,
    showdownAt: null,
    gameWinnerId: null,
    championId: prev.championId ?? null,
    gameWins: prev.gameWins ?? {},
  };
}

// ─── Process a player action ──────────────────────────────────────────────────
export type PlayerAction = "fold" | "check" | "call" | "raise" | "allin";

export interface ActionResult {
  state: GameState;
  chipDeltas: Record<string, number>; // chip changes to apply to DB (negative = bet, positive = won)
}

export function processAction(
  state: GameState,
  players: PokerPlayer[],
  userId: string,
  action: PlayerAction,
  raiseAmount = 0,
): ActionResult {
  if (state.actionOn !== userId) return { state, chipDeltas: {} };
  if (state.phase === "waiting" || state.phase === "showdown") return { state, chipDeltas: {} };

  const player = players.find(p => p.user_id === userId);
  if (!player) return { state, chipDeltas: {} };

  let st = { ...state };
  st.actionLog = [...st.actionLog];
  st.roundBets = { ...st.roundBets };
  st.totalBets = { ...st.totalBets };
  st.folded = [...st.folded];
  st.allIn = [...st.allIn];
  const chips = player.chips; // current chips (before this hand's bets)
  const alreadyBet = st.roundBets[userId] ?? 0;
  const toCall = Math.max(0, st.currentBet - alreadyBet);

  const log = (a: string, amt = 0) =>
    st.actionLog.push({ userId, username: player.username, action: a, amount: amt, timestamp: Date.now() });

  if (action === "fold") {
    st.folded.push(userId);
    st.actedSinceLastRaise = [...st.actedSinceLastRaise, userId];
    log("folds");
  } else if (action === "check") {
    if (toCall > 0) return { state, chipDeltas: {} }; // can't check when there's a bet
    st.actedSinceLastRaise = [...st.actedSinceLastRaise, userId];
    log("checks");
  } else if (action === "call") {
    const callAmt = Math.min(toCall, chips - alreadyBet);
    const newBet = alreadyBet + callAmt;
    st.roundBets[userId] = newBet;
    st.totalBets[userId] = (st.totalBets[userId] ?? 0) + callAmt;
    if (newBet >= chips) { if (!st.allIn.includes(userId)) st.allIn.push(userId); log("calls all-in", callAmt); }
    else log("calls", callAmt);
    st.actedSinceLastRaise = [...st.actedSinceLastRaise, userId];
  } else if (action === "raise" || action === "allin") {
    const totalBetTarget = action === "allin" ? chips : Math.min(raiseAmount, chips);
    if (totalBetTarget <= alreadyBet) return { state, chipDeltas: {} };
    const added = totalBetTarget - alreadyBet;
    st.roundBets[userId] = totalBetTarget;
    st.totalBets[userId] = (st.totalBets[userId] ?? 0) + added;
    if (totalBetTarget > st.currentBet) {
      st.minRaise = totalBetTarget - st.currentBet;
      st.currentBet = totalBetTarget;
      st.actedSinceLastRaise = [userId]; // others must re-act
    } else {
      st.actedSinceLastRaise = [...st.actedSinceLastRaise, userId];
    }
    if (totalBetTarget >= chips) { if (!st.allIn.includes(userId)) st.allIn.push(userId); }
    log(action === "allin" ? "goes all-in" : "raises to", totalBetTarget);
  }

  st.lastActionTime = Date.now();

  // ── Check if betting round is over ────────────────────────────────────────
  const result = advanceIfDone(st, players);
  return result;
}

// ─── Check betting complete → advance phase ────────────────────────────────
function advanceIfDone(state: GameState, players: PokerPlayer[]): ActionResult {
  const active = players.filter(p =>
    !state.folded.includes(p.user_id) && !state.allIn.includes(p.user_id)
  );

  const allActed = active.every(p => state.actedSinceLastRaise.includes(p.user_id));
  const allMatched = active.every(p => (state.roundBets[p.user_id] ?? 0) >= state.currentBet);

  // Only one player left total (everyone else folded)
  const notFolded = players.filter(p => !state.folded.includes(p.user_id));
  if (notFolded.length === 1) {
    return endHandEarly(state, players);
  }

  if (!allActed || !allMatched) {
    // Find next player to act
    const next = nextToAct(state, players);
    return { state: { ...state, actionOn: next }, chipDeltas: {} };
  }

  // Betting done — advance phase
  return advancePhase(state, players);
}

function nextToAct(state: GameState, players: PokerPlayer[]): string | null {
  const eligible = bySeats(players).filter(p =>
    !state.folded.includes(p.user_id) && !state.allIn.includes(p.user_id)
  );
  if (eligible.length === 0) return null;

  const current = state.actionOn;
  const idx = eligible.findIndex(p => p.user_id === current);
  for (let i = 1; i <= eligible.length; i++) {
    const candidate = eligible[(idx + i) % eligible.length];
    const bet = state.roundBets[candidate.user_id] ?? 0;
    const needsToAct = bet < state.currentBet || !state.actedSinceLastRaise.includes(candidate.user_id);
    if (needsToAct) return candidate.user_id;
  }
  return null;
}

// ─── Advance to next phase ────────────────────────────────────────────────────
function advancePhase(state: GameState, players: PokerPlayer[]): ActionResult {
  const notFolded = players.filter(p => !state.folded.includes(p.user_id));

  // Collect bets into pot
  const collected = Object.values(state.roundBets).reduce((s, v) => s + v, 0);
  const newPot = state.pot + collected;

  const baseState: GameState = {
    ...state,
    pot: newPot,
    roundBets: {},
    currentBet: 0,
    actedSinceLastRaise: [],
    minRaise: BIG_BLIND,
    sidePots: calcSidePots(state.totalBets, notFolded.map(p => p.user_id)),
  };

  // Everyone except one is all-in → run out the board without betting
  const canAct = notFolded.filter(p => !state.allIn.includes(p.user_id));

  const nextPhaseMap: Record<string, Phase> = {
    preflop: "flop", flop: "turn", turn: "river", river: "showdown",
  };
  const nextPhase = nextPhaseMap[state.phase] ?? "showdown";

  if (nextPhase === "showdown") {
    return doShowdown(baseState, players);
  }

  // Deal community cards
  let newDeck = [...baseState.deck];
  let newCommunity = [...baseState.communityCards];
  if (nextPhase === "flop") { newCommunity = newDeck.slice(0, 3); newDeck = newDeck.slice(3); }
  else if (nextPhase === "turn" || nextPhase === "river") { newCommunity = [...newCommunity, newDeck[0]]; newDeck = newDeck.slice(1); }

  // First to act post-flop: first active (not folded, not all-in) player after dealer
  let firstToAct: string | null = null;
  if (canAct.length > 0 && baseState.dealerUserId) {
    const order = fromAfter(canAct, baseState.dealerUserId);
    firstToAct = order[0]?.user_id ?? null;
  }

  // If nobody can act (all all-in), run remaining streets automatically
  if (canAct.length <= 1) {
    const runoutState: GameState = { ...baseState, phase: nextPhase, deck: newDeck, communityCards: newCommunity, actionOn: null };
    return advancePhase(runoutState, players);
  }

  return {
    state: {
      ...baseState,
      phase: nextPhase,
      deck: newDeck,
      communityCards: newCommunity,
      actionOn: firstToAct,
    },
    chipDeltas: {},
  };
}

// ─── Showdown ────────────────────────────────────────────────────────────────
function doShowdown(state: GameState, players: PokerPlayer[]): ActionResult {
  const notFolded = players.filter(p => !state.folded.includes(p.user_id));
  const handRanks: Record<string, { name: string; bestCards: Card[] }> = {};
  for (const p of notFolded) {
    const cards = state.hands[p.user_id] ?? [];
    if (cards.length === 2) {
      const res = bestOf7([...cards, ...state.communityCards]);
      handRanks[p.user_id] = { name: res.name, bestCards: res.bestCards };
    }
  }

  // Distribute side pots
  const chipDeltas: Record<string, number> = {};
  const pots = calcSidePots(state.totalBets, notFolded.map(p => p.user_id));

  // Add any remaining pot
  const totalPotAmount = state.pot;
  if (pots.length === 0 && totalPotAmount > 0) {
    pots.push({ amount: totalPotAmount, eligible: notFolded.map(p => p.user_id) });
  }

  const allWinners = new Set<string>();

  for (const pot of pots) {
    if (pot.eligible.length === 0) continue;
    const eligPlayers = notFolded.filter(p => pot.eligible.includes(p.user_id));
    if (eligPlayers.length === 0) continue;
    if (eligPlayers.length === 1) {
      chipDeltas[eligPlayers[0].user_id] = (chipDeltas[eligPlayers[0].user_id] ?? 0) + pot.amount;
      allWinners.add(eligPlayers[0].user_id);
      continue;
    }
    // Evaluate hands
    const scored = eligPlayers.map(p => ({
      userId: p.user_id,
      ...bestOf7([...(state.hands[p.user_id] ?? []), ...state.communityCards]),
    }));
    let best = scored[0].score;
    for (const s of scored) if (cmp(s.score, best) > 0) best = s.score;
    const winners = scored.filter(s => cmp(s.score, best) === 0).map(s => s.userId);
    const share = Math.floor(pot.amount / winners.length);
    const rem = pot.amount - share * winners.length;
    for (let i = 0; i < winners.length; i++) {
      chipDeltas[winners[i]] = (chipDeltas[winners[i]] ?? 0) + share + (i === 0 ? rem : 0);
      allWinners.add(winners[i]);
    }
  }

  // Deduct total bets from chip deltas (net change)
  for (const [uid, bet] of Object.entries(state.totalBets)) {
    chipDeltas[uid] = (chipDeltas[uid] ?? 0) - bet;
  }

  return {
    state: {
      ...state,
      phase: "showdown",
      actionOn: null,
      winners: [...allWinners],
      handRanks,
      showdownAt: Date.now(),
    },
    chipDeltas,
  };
}

// ─── End hand early (everyone folded except one) ──────────────────────────────
function endHandEarly(state: GameState, players: PokerPlayer[]): ActionResult {
  const collected = Object.values(state.roundBets).reduce((s, v) => s + v, 0);
  const totalPot = state.pot + collected;
  const winner = players.find(p => !state.folded.includes(p.user_id));
  if (!winner) return { state, chipDeltas: {} };

  const chipDeltas: Record<string, number> = { [winner.user_id]: totalPot };
  for (const [uid, bet] of Object.entries(state.totalBets)) {
    chipDeltas[uid] = (chipDeltas[uid] ?? 0) - bet;
  }

  return {
    state: {
      ...state,
      phase: "showdown",
      pot: totalPot,
      roundBets: {},
      actionOn: null,
      winners: [winner.user_id],
      handRanks: null,
      showdownAt: Date.now(),
    },
    chipDeltas,
  };
}

// ─── Auto-timeout current player ─────────────────────────────────────────────
export function applyTimeout(state: GameState, players: PokerPlayer[]): ActionResult {
  if (!state.actionOn) return { state, chipDeltas: {} };
  if (Date.now() - state.lastActionTime < ACTION_TIMEOUT_MS) return { state, chipDeltas: {} };
  return processAction(state, players, state.actionOn, "fold");
}

// ─── Auto-advance after showdown delay ───────────────────────────────────────
export function shouldStartNewHand(state: GameState): boolean {
  return (
    state.phase === "showdown" &&
    state.showdownAt !== null &&
    state.gameWinnerId === null &&
    Date.now() - state.showdownAt > SHOWDOWN_DELAY_MS
  );
}

// ─── Declare game winner (one player has all chips) ──────────────────────────
export function declareGameWinner(state: GameState, players: PokerPlayer[]): GameState {
  const withChips = players.filter(p => p.chips > 0);
  const winner = withChips.length === 1 ? withChips[0] : null;
  if (!winner) return { ...state, phase: "waiting", actionOn: null };

  const gameWins = { ...(state.gameWins ?? {}) };
  gameWins[winner.user_id] = (gameWins[winner.user_id] ?? 0) + 1;

  // Champion = player with most game wins; ties go to most recent winner
  const maxWins = Math.max(...Object.values(gameWins));
  const newChampionId = gameWins[winner.user_id] >= maxWins ? winner.user_id : (state.championId ?? winner.user_id);

  return {
    ...state,
    phase: "waiting",
    actionOn: null,
    gameWinnerId: winner.user_id,
    championId: newChampionId,
    gameWins,
  };
}

// ─── Bot AI ───────────────────────────────────────────────────────────────────

/** Simple hole-card strength heuristic (0–1) */
function holeStrength(cards: Card[]): number {
  if (cards.length < 2) return 0.3;
  const r1 = RANK_VAL[cards[0][0]] ?? 2;
  const r2 = RANK_VAL[cards[1][0]] ?? 2;
  const suited = cards[0][1] === cards[1][1];
  if (cards[0][0] === cards[1][0]) return 0.5 + (Math.max(r1, r2) / 14) * 0.5; // pocket pair
  const hi = Math.max(r1, r2);
  const lo = Math.min(r1, r2);
  const gap = hi - lo;
  return Math.min(1, (hi / 14) * 0.4 + (lo / 14) * 0.15 + (suited ? 0.08 : 0) + Math.max(0, (6 - gap) * 0.015));
}

/** Board texture bonus — made hand on the board = stronger */
function boardBonus(hand: Card[], community: Card[]): number {
  if (community.length === 0) return 0;
  const all = [...hand, ...community];
  const rankCounts: Record<string, number> = {};
  for (const c of all) rankCounts[c[0]] = (rankCounts[c[0]] ?? 0) + 1;
  const maxCount = Math.max(...Object.values(rankCounts));
  if (maxCount >= 4) return 0.5;
  if (maxCount >= 3) return 0.3;
  if (maxCount >= 2) return 0.15;
  return 0;
}

export function botDecide(
  state: GameState,
  players: PokerPlayer[],
  botId: string,
): { action: PlayerAction; amount: number } {
  const bot = players.find(p => p.user_id === botId);
  if (!bot || bot.chips <= 0) return { action: "fold", amount: 0 };

  const myBet = state.roundBets[botId] ?? 0;
  const toCall = Math.max(0, state.currentBet - myBet);
  const canCheck = toCall === 0;
  const chips = bot.chips;

  const hand = state.hands?.[botId] ?? [];
  const strength = Math.min(1, holeStrength(hand) + boardBonus(hand, state.communityCards ?? []));

  // Bot "personality" based on seat (deterministic but varied)
  const aggression = 0.3 + (bot.seat % 5) * 0.08; // 0.30–0.62
  const rand = Math.random();

  if (canCheck) {
    if (strength > 0.65 && rand < aggression) {
      const minR = (state.minRaise ?? BIG_BLIND) + state.currentBet;
      const raise = Math.min(chips, Math.round(minR + Math.random() * minR));
      if (raise <= chips) return { action: "raise", amount: raise };
    }
    return { action: "check", amount: 0 };
  }

  // Must call or fold
  const callFrac = toCall / chips;
  if (strength > 0.7 || (strength > 0.45 && callFrac < 0.15)) {
    if (strength > 0.8 && rand < aggression * 0.7) {
      const minR = (state.minRaise ?? BIG_BLIND) + state.currentBet;
      const raise = Math.min(chips, Math.round(minR + Math.random() * minR));
      if (raise > toCall && raise <= chips) return { action: "raise", amount: raise };
    }
    return { action: "call", amount: toCall };
  }
  if (strength > 0.3 && callFrac < 0.05) return { action: "call", amount: toCall };
  return { action: "fold", amount: 0 };
}

// ─── Initial empty state ──────────────────────────────────────────────────────
export function emptyState(): GameState {
  return {
    phase: "waiting",
    deck: [], communityCards: [], hands: {},
    pot: 0, sidePots: [], currentBet: 0,
    roundBets: {}, totalBets: {},
    actionOn: null, actedSinceLastRaise: [],
    dealerUserId: null, sbUserId: null, bbUserId: null,
    folded: [], allIn: [],
    lastActionTime: Date.now(),
    winners: null, handRanks: null,
    actionLog: [], handNumber: 0, minRaise: BIG_BLIND,
    showdownAt: null,
    gameWinnerId: null, championId: null, gameWins: {},
  };
}
