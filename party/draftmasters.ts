import type * as Party from "partykit/server";
import {
  buildLot,
  buildPool,
  canMatch,
  canOpen,
  canRaise,
  isFull,
  makeRng,
  maxBid,
  newVariantBudget,
  openingBid,
  otherSide,
  priceLabel,
  rollDie,
  DEFAULT_RULES,
  type Lot,
  type Rules,
  type Side,
  type VariantBudget,
} from "../lib/draftmasters/engine";
import type { Pack } from "../lib/draftmasters/packs";

/**
 * DraftMasters PvP room — authoritative auction server.
 *
 * Designed around one rule: nothing in here depends on a timer. Every state
 * change is caused by a message, and every message is idempotent against the
 * current phase. That is what makes a flaky phone survivable — a client that
 * drops for ten seconds reconnects, asks for the state, and is exactly where
 * it should be, because nothing could have expired while it was gone.
 *
 * Flow: lobby -> preparing -> ready -> (bidding -> [dice] -> sold)* -> complete
 *
 * Bidding is strictly alternating. Opening rights alternate lot by lot. On
 * your turn you bid, pass, or — when you can equal the price but not beat it —
 * match and roll dice for it. Ties reroll until someone wins.
 *
 * Host authority is soft: the person who opened the room is host, but if they
 * are not currently connected, any seated player may drive the room. Their
 * hostship is restored the moment they reconnect. No migration, no timers.
 */

type Phase = "lobby" | "preparing" | "ready" | "bidding" | "dice" | "sold" | "complete";

interface Member {
  conn: Party.Connection;
  userId: string;
  name: string;
  avatarUrl: string | null;
  mic: boolean;
  cam: boolean;
  /** Seats 0 and 1 bid; anyone beyond that is a spectator */
  seat: number;
}

interface TickerEvent {
  id: number;
  text: string;
  kind: "bid" | "sold" | "passed" | "dice" | "system";
}

interface DiceState {
  reason: "lot" | "verdict";
  sideIds: [string, string];
  rounds: { a: number; b: number }[];
  winnerId: string | null;
  price: number;
}

interface Verdict {
  winnerId: string;
  headline: string;
  reasoning: string;
  sideNotes: { sideId: string; score: number; mvp: string; bust: string; note: string }[];
  judged: "ai" | "offline";
  diceBreak?: DiceState | null;
}

export default class DraftMastersParty implements Party.Server {
  private members = new Map<string, Member>();
  private hostId: string | null = null;

  private phase: Phase = "lobby";
  private pack: Pack | null = null;
  private rules: Rules = { ...DEFAULT_RULES };
  private seed = Math.floor(Math.random() * 0x7fffffff);
  private matchId = "";

  private pool: number[] = [];
  private cursor = 0;
  /**
   * This draft's allowance of the rarest variant grades. Lives on the room so
   * both players see the same mythic land in the same game — and see it only
   * once.
   */
  private variants: VariantBudget = newVariantBudget();
  private lotIndex = 0;
  /** Entry index of the lot on the block, so a passed lot can be recycled */
  private lotEntryIndex = -1;
  /** Lots nobody took — dealt again if the pool runs dry with chairs empty */
  private unsold: number[] = [];
  private lot: Lot | null = null;
  private currentBid = 0;
  private highBidderId: string | null = null;
  private turnId: string | null = null;
  private openerId: string | null = null;
  private passedIds = new Set<string>();
  /** Sides that used their one free pass while drafting unopposed */
  private passLocked = new Set<string>();
  private dice: DiceState | null = null;

  private sides = new Map<string, Side>();
  private readyIds = new Set<string>();
  private ticker: TickerEvent[] = [];
  private eventSeq = 0;
  private verdict: Verdict | null = null;
  /** Battle cinematic script, posted by the driver so everyone watches together */
  private battle: unknown = null;
  /**
   * True while the driver is off fetching the verdict and the fight script.
   * Everyone holds the reveal until the fight lands, so the crown can't spoil
   * the fight it exists to pay off.
   */
  private battleStaging = false;
  /**
   * What the hold is for. Both players get a loading bar during the endgame,
   * and "the judge is working" and "staging the show" are different waits with
   * different things to say.
   */
  private stagingKind: "judging" | "staging" = "staging";
  private battleStagerId: string | null = null;

  constructor(readonly room: Party.Room) {}

  // ── Connection lifecycle ───────────────────────────────────────────────────

  onConnect(conn: Party.Connection) {
    conn.send(JSON.stringify({ type: "state", state: this.publicState() }));
  }

  onClose(conn: Party.Connection) {
    const member = this.members.get(conn.id);
    this.members.delete(conn.id);
    if (!member) return;

    // A reconnect shows up as a fresh connection before the old one closes,
    // so only announce a departure if they're actually gone.
    if (!this.isConnected(member.userId)) {
      this.room.broadcast(JSON.stringify({ type: "peer-left", userId: member.userId }));
      // Ready state is a live promise — a dropped player has to re-confirm.
      if (this.phase === "ready") this.readyIds.delete(member.userId);
      // Never leave the room holding a reveal for a fight that isn't coming.
      if (this.battleStagerId === member.userId) this.clearStaging();
      this.push(`${member.name} disconnected`, "system");
    }
    this.broadcastState();
  }

  onError(conn: Party.Connection) {
    this.onClose(conn);
  }

  // ── Messages ───────────────────────────────────────────────────────────────

  onMessage(raw: string, sender: Party.Connection) {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    switch (msg.type) {
      case "join":
        return this.handleJoin(msg, sender);
      case "sync":
        return sender.send(JSON.stringify({ type: "state", state: this.publicState() }));
      case "preparing":
        return this.handlePreparing(sender);
      case "board":
        return this.handleBoard(msg, sender);
      case "ready":
        return this.handleReady(msg, sender);
      case "bid":
        return this.handleBid(msg, sender);
      case "pass":
        return this.handlePass(sender);
      case "match":
        return this.handleMatch(sender);
      case "advance":
        return this.handleAdvance(msg);
      case "portrait":
        // A photo someone found or uploaded — pass it straight to the room so
        // both cards match. Not part of game state; it's per-client display.
        return this.room.broadcast(
          JSON.stringify({
            type: "portrait",
            imgQuery: String(msg.imgQuery ?? "").slice(0, 200),
            url: typeof msg.url === "string" ? msg.url.slice(0, 2000) : null,
            source: String(msg.source ?? "curated").slice(0, 32),
          }),
          [sender.id]
        );
      case "chat":
        return this.handleChat(msg, sender);
      case "media":
        return this.handleMedia(msg, sender);
      case "verdict":
        return this.handleVerdict(msg, sender);
      case "battle":
        return this.handleBattle(msg, sender);
      case "rematch":
        return this.handleRematch(sender);
      case "rtc-signal":
        return this.relaySignal(msg);
    }
  }

  private handleJoin(msg: Record<string, unknown>, sender: Party.Connection) {
    const userId = String(msg.userId ?? "").slice(0, 64);
    if (!userId) return;

    const wasConnected = this.isConnected(userId);

    // Reclaim a seat on reconnect rather than handing out a new one.
    const existingSeat = [...this.members.values()].find((m) => m.userId === userId)?.seat;
    const knownSide = this.sides.get(userId);
    let seat = existingSeat ?? (knownSide ? [...this.sides.keys()].indexOf(userId) : -1);
    if (seat < 0) {
      const taken = new Set([...this.members.values()].map((m) => m.seat));
      // Seated players keep their seat even while disconnected.
      this.sides.forEach((_, id) => taken.add([...this.sides.keys()].indexOf(id)));
      seat = 0;
      while (taken.has(seat)) seat++;
    }

    const member: Member = {
      conn: sender,
      userId,
      name: String(msg.name ?? "Drafter").slice(0, 32),
      avatarUrl: (msg.avatarUrl as string | null) ?? null,
      mic: Boolean(msg.mic),
      cam: false,
      seat,
    };
    this.members.set(sender.id, member);
    if (!this.hostId) this.hostId = userId;

    if (seat < 2 && !this.sides.has(userId)) {
      this.sides.set(userId, {
        id: userId,
        name: member.name,
        avatarUrl: member.avatarUrl,
        budget: this.rules.budget,
        roster: [],
        isNpc: false,
      });
    }

    if (!wasConnected) {
      this.push(`${member.name} ${knownSide ? "reconnected" : "joined"}`, "system");
      this.room.broadcast(
        JSON.stringify({
          type: "peer-joined",
          userId: member.userId,
          name: member.name,
          avatarUrl: member.avatarUrl,
        }),
        [sender.id]
      );
    }
    this.broadcastState();
  }

  /** Host flips the room to the prep screen while it builds the board. */
  private handlePreparing(sender: Party.Connection) {
    if (!this.canDrive(sender)) return;
    if (this.phase !== "lobby" && this.phase !== "complete") return;
    this.phase = "preparing";
    this.readyIds.clear();
    this.broadcastState();
  }

  /**
   * Host posts the fully resolved board — preset or AI-generated, already
   * portrait-prefetched on its side. The server never generates; it just deals.
   */
  private handleBoard(msg: Record<string, unknown>, sender: Party.Connection) {
    if (!this.canDrive(sender)) return;

    const pack = msg.pack as Pack | undefined;
    if (!pack || !Array.isArray(pack.entries) || pack.entries.length < 6) return;

    this.seed = Math.floor(Math.random() * 0x7fffffff);
    // Stamp every dealt board with a nonce. Two "Marvel villains" boards in a
    // row have different entries, and clients key their portrait cache on
    // this id — without the nonce the second board would show stale art.
    const baseId = String(pack.id).split("#")[0];
    this.pack = { ...pack, id: `${baseId}#${this.seed}` };
    this.matchId = `${this.room.id}-${this.seed}`;

    if (typeof msg.budget === "number" && msg.budget >= 10 && msg.budget <= 200) {
      this.rules.budget = Math.round(msg.budget);
    }
    if (typeof msg.rosterSize === "number" && msg.rosterSize >= 3 && msg.rosterSize <= 10) {
      this.rules.rosterSize = Math.round(msg.rosterSize);
    }

    const recent = Array.isArray(msg.recent)
      ? new Set((msg.recent as string[]).slice(0, 60).map((n) => String(n).toLowerCase()))
      : undefined;
    this.pool = buildPool(this.pack, makeRng(this.seed), { recent });
    // Fresh allowance each draft, at the wildness the host built the board at.
    this.variants = newVariantBudget(Math.random, this.pack.variantWild);
    this.cursor = 0;
    this.lotIndex = 0;
    this.unsold = [];
    this.lotEntryIndex = -1;
    this.verdict = null;
    this.battle = null;
    this.clearStaging();
    this.dice = null;
    this.ticker = [];
    this.readyIds.clear();
    this.passLocked.clear();
    for (const side of this.sides.values()) {
      side.budget = this.rules.budget;
      side.roster = [];
    }
    this.phase = "ready";
    this.push(`Board ready — ${pack.name}`, "system");
    this.broadcastState();
  }

  private handleReady(msg: Record<string, unknown>, sender: Party.Connection) {
    const member = this.members.get(sender.id);
    if (!member || this.phase !== "ready") return;
    if (!this.sides.has(member.userId)) return; // spectators don't gate the start

    if (msg.ready === false) this.readyIds.delete(member.userId);
    else this.readyIds.add(member.userId);
    this.broadcastState();

    const allReady = [...this.sides.keys()].every((id) => this.readyIds.has(id));
    if (allReady && this.sides.size >= 2) {
      this.push("Both drafters ready — here we go", "system");
      this.nominate();
    }
  }

  // ── Turn actions ───────────────────────────────────────────────────────────

  private actor(sender: Party.Connection): Side | null {
    const member = this.members.get(sender.id);
    if (!member || this.phase !== "bidding" || !this.lot) return null;
    const side = this.sides.get(member.userId);
    if (!side) return null; // spectators can't act
    if (this.turnId !== side.id) return null; // not your move
    return side;
  }

  private handleBid(msg: Record<string, unknown>, sender: Party.Connection) {
    const side = this.actor(sender);
    if (!side) return;

    const amount = Math.round(Number(msg.amount));
    if (!Number.isFinite(amount) || amount < 0) return;
    if (amount > maxBid(side, this.rules)) return;
    if (this.highBidderId) {
      if (amount <= this.currentBid) return; // a raise must beat the bid
    } else if (amount < openingBid(side, this.rules)) {
      return; // opening is $1 — or a $0 claim if that's all you have
    }

    this.currentBid = amount;
    this.highBidderId = side.id;
    this.push(amount > 0 ? `${side.name} bids $${amount}` : `${side.name} claims it for free`, "bid");

    // The other side answers — unless they can't do anything at all, in which
    // case the lot closes rather than making them click Pass to lose.
    const other = otherSide(this.sidesList(), side.id);
    if (
      other &&
      (canRaise(other, this.rules, this.currentBid) || canMatch(other, this.rules, this.currentBid))
    ) {
      this.turnId = other.id;
      this.broadcastState();
    } else {
      this.closeLot();
    }
  }

  private handlePass(sender: Party.Connection) {
    const side = this.actor(sender);
    if (!side) return;

    if (this.highBidderId) {
      // Declining to raise hands it to the high bidder.
      this.push(`${side.name} lets it go`, "passed");
      this.closeLot();
      return;
    }

    // Declining to open. Offer it to the other side if they can take it.
    this.passedIds.add(side.id);
    const other = otherSide(this.sidesList(), side.id);
    if (other && !this.passedIds.has(other.id) && canOpen(other, this.rules, side)) {
      this.push(`${side.name} passes — over to ${other.name}`, "passed");
      this.turnId = other.id;
      this.broadcastState();
      return;
    }

    // Nobody else can take it, so this side is drafting unopposed. One free
    // pass, then the next lot has to fill a slot — otherwise you could sift
    // the whole board for the perfect leftover.
    if (!other || !canOpen(other, this.rules, side)) {
      if (this.passLocked.has(side.id)) return; // must buy; the UI disables Pass, this is the backstop
      this.passLocked.add(side.id);
      this.push(`${side.name} passes — the next one fills their slot`, "passed");
    }
    this.closeLot();
  }

  /** Equal the standing bid and roll for it. */
  private handleMatch(sender: Party.Connection) {
    const side = this.actor(sender);
    if (!side || !this.highBidderId) return;
    if (!canMatch(side, this.rules, this.currentBid)) return;

    this.push(`${side.name} matches $${this.currentBid} — dice decide it`, "dice");
    this.startDice("lot", [this.highBidderId, side.id], this.currentBid);
  }

  /**
   * Client-driven progression. After a "sold" reveal or a tied dice round,
   * clients send advance once their animation is done. Idempotent: the phase
   * (and dice round count) has to match what the client saw, so two clients
   * advancing at once produce one step, not two.
   */
  private handleAdvance(msg: Record<string, unknown>) {
    // An advance names the phase the client saw. Both clients advance a
    // decided roll; the first awards the lot (-> sold) and the second must NOT
    // then be read as "advance the sold reveal" — that skipped the reveal.
    if (msg.from !== this.phase) return;

    if (this.phase === "sold") {
      this.nominate();
      return;
    }
    if (this.phase === "dice" && this.dice) {
      // A decided roll stays on screen until a client says it has been seen —
      // otherwise a first-roll winner would flash for zero frames before SOLD.
      if (this.dice.winnerId !== null) {
        this.finishDice();
        return;
      }
      const seen = Number(msg.round);
      if (seen !== this.dice.rounds.length) return; // stale or duplicate
      this.rollRound();
    }
  }

  // ── Dice ───────────────────────────────────────────────────────────────────

  private startDice(reason: DiceState["reason"], sideIds: [string, string], price: number) {
    this.dice = { reason, sideIds, rounds: [], winnerId: null, price };
    this.phase = "dice";
    this.rollRound();
  }

  private rollRound() {
    if (!this.dice) return;
    const a = rollDie();
    const b = rollDie();
    this.dice.rounds.push({ a, b });

    const [idA, idB] = this.dice.sideIds;
    const nameA = this.sides.get(idA)?.name ?? "A";
    const nameB = this.sides.get(idB)?.name ?? "B";
    const round = this.dice.rounds.length;
    const label = round > 1 ? ` (reroll ${round - 1})` : "";

    if (a === b) {
      this.say(`🎲 ${nameA} rolls ${a}, ${nameB} rolls ${b} — tie! Rolling again…${label}`);
      this.push(`Dice: ${a}–${b}, tie — rerolling`, "dice");
      this.broadcastState();
      return; // clients animate, then send advance to reroll
    }

    const winnerId = a > b ? idA : idB;
    const winnerName = a > b ? nameA : nameB;
    this.dice.winnerId = winnerId;
    this.say(`🎲 ${nameA} rolls ${a}, ${nameB} rolls ${b} — ${winnerName} wins the roll!${label}`);
    this.push(`Dice: ${a}–${b} — ${winnerName} wins it`, "dice");
    // Phase stays "dice" so the winning roll is actually seen; a client
    // `advance` finishes it. Same idempotent step as the tie reroll.
    this.broadcastState();
  }

  /** Apply a decided dice-off: award the lot, or crown the verdict winner. */
  private finishDice() {
    if (!this.dice || this.dice.winnerId === null) return;
    const winnerId = this.dice.winnerId;
    if (this.dice.reason === "lot") {
      this.highBidderId = winnerId;
      this.currentBid = this.dice.price;
      this.closeLot();
    } else {
      if (this.verdict) this.verdict = { ...this.verdict, winnerId, diceBreak: this.dice };
      this.phase = "complete";
      this.broadcastState();
    }
  }

  // ── Auction flow ───────────────────────────────────────────────────────────

  private nominate() {
    if (!this.pack) return;
    const sides = this.sidesList();

    const allFull = sides.every((s) => isFull(s, this.rules));

    // Chairs still empty but the board's run dry: deal the passed lots again.
    // Nobody finishes short-handed because they were picky early.
    if (!allFull && this.cursor >= this.pool.length && this.unsold.length) {
      this.pool.push(...this.unsold);
      this.unsold = [];
      this.push("Bringing back the lots nobody took", "system");
    }

    if (allFull || this.cursor >= this.pool.length) {
      this.phase = "complete";
      this.lot = null;
      this.turnId = null;
      this.dice = null;
      this.push(
        allFull ? "Rosters full — calculate the winner" : "Board exhausted — calculate the winner",
        "system"
      );
      this.broadcastState();
      return;
    }

    const entryIndex = this.pool[this.cursor++];
    this.lotEntryIndex = entryIndex;
    const rng = makeRng(this.seed + entryIndex * 7919 + this.cursor);
    this.lot = buildLot(this.pack.entries[entryIndex], entryIndex, this.pack, rng, this.variants);

    // Opening rights alternate lot by lot, skipping anyone who can't open.
    const ordered = [...sides].sort((a, b) => this.seatOf(a.id) - this.seatOf(b.id));
    const first = ordered[this.lotIndex % ordered.length];
    const second = ordered.find((s) => s.id !== first.id);
    // A broke side can't open while the other still has money — the opener
    // alternation skips them until free claims are legitimately unlocked.
    this.openerId = canOpen(first, this.rules, second)
      ? first.id
      : second && canOpen(second, this.rules, first)
        ? second.id
        : null;
    this.lotIndex++;

    this.turnId = this.openerId;
    this.currentBid = 0;
    this.highBidderId = null;
    this.passedIds.clear();
    this.dice = null;
    this.phase = "bidding";
    this.broadcastState();
  }

  private closeLot() {
    if (!this.lot) return;

    if (this.highBidderId) {
      const side = this.sides.get(this.highBidderId);
      if (side) {
        side.budget -= this.currentBid;
        side.roster.push({ ...this.lot, price: this.currentBid });
        this.passLocked.delete(side.id); // a filled slot earns the free pass back
        this.push(`SOLD — ${this.lot.name} to ${side.name} for ${priceLabel(this.currentBid)}`, "sold");
      }
    } else {
      if (this.lotEntryIndex >= 0) this.unsold.push(this.lotEntryIndex);
      this.push(`PASSED — nobody wanted ${this.lot.name}`, "passed");
    }

    this.turnId = null;
    this.phase = "sold";
    this.broadcastState();
    // Clients send `advance` after the reveal; nothing here waits on a clock.
  }

  // ── Room messages ──────────────────────────────────────────────────────────

  private handleChat(msg: Record<string, unknown>, sender: Party.Connection) {
    const member = this.members.get(sender.id);
    if (!member) return;
    const text = String(msg.text ?? "").slice(0, 300).trim();
    if (!text) return;
    this.room.broadcast(
      JSON.stringify({
        type: "chat",
        userId: member.userId,
        name: member.name,
        avatarUrl: member.avatarUrl,
        text,
        at: Date.now(),
      })
    );
  }

  /** A line from the room itself — dice rolls land in chat where everyone sees them. */
  private say(text: string) {
    this.room.broadcast(
      JSON.stringify({ type: "chat", userId: "room", name: "Dice", text, at: Date.now(), system: true })
    );
  }

  private handleMedia(msg: Record<string, unknown>, sender: Party.Connection) {
    const member = this.members.get(sender.id);
    if (!member) return;
    if (typeof msg.mic === "boolean") member.mic = msg.mic;
    if (typeof msg.cam === "boolean") member.cam = msg.cam;
    this.room.broadcast(
      JSON.stringify({ type: "media", userId: member.userId, mic: member.mic, cam: member.cam })
    );
  }

  /**
   * The driver runs the judge call and posts the result so both sides see one
   * verdict. If the judge scored it even, the dice settle it.
   */
  private handleVerdict(msg: Record<string, unknown>, sender: Party.Connection) {
    if (!this.canDrive(sender)) return;
    if (this.phase !== "complete") return;
    const verdict = msg.verdict as Verdict | null;
    if (!verdict) return;
    this.verdict = verdict;

    const notes = verdict.sideNotes ?? [];
    const sides = this.sidesList();
    if (notes.length === 2 && notes[0].score === notes[1].score && sides.length === 2) {
      this.clearStaging();
      this.push("The judge has it even — dice decide it", "dice");
      this.startDice("verdict", [sides[0].id, sides[1].id], 0);
      return;
    }
    this.broadcastState();
  }

  /**
   * The driver posts the battle script so both players watch the same fight,
   * beat for beat, rather than each generating their own.
   */
  private handleBattle(msg: Record<string, unknown>, sender: Party.Connection) {
    if (!this.canDrive(sender)) return;
    if (this.phase !== "complete") return;

    // A staging ping carries no script — it just opens or closes the hold.
    if (msg.staging !== undefined) {
      if (msg.staging) {
        this.battleStaging = true;
        this.stagingKind = msg.stage === "judging" ? "judging" : "staging";
        this.battleStagerId = this.members.get(sender.id)?.userId ?? null;
      } else {
        this.clearStaging();
      }
      this.broadcastState();
      return;
    }

    this.battle = msg.battle ?? null;
    this.clearStaging();
    this.broadcastState();
  }

  private clearStaging() {
    this.battleStaging = false;
    this.stagingKind = "staging";
    this.battleStagerId = null;
  }

  private handleRematch(sender: Party.Connection) {
    if (!this.canDrive(sender)) return;
    this.phase = "lobby";
    // Drop the old board entirely — leaving it here is how a rematch kept
    // dealing the previous topic.
    this.pack = null;
    this.pool = [];
    this.variants = newVariantBudget();
    this.unsold = [];
    this.lotEntryIndex = -1;
    this.lot = null;
    this.verdict = null;
    this.battle = null;
    this.clearStaging();
    this.dice = null;
    this.currentBid = 0;
    this.highBidderId = null;
    this.turnId = null;
    this.openerId = null;
    this.passedIds.clear();
    this.passLocked.clear();
    this.readyIds.clear();
    for (const side of this.sides.values()) {
      side.budget = this.rules.budget;
      side.roster = [];
    }
    this.ticker = [];
    this.push("Rematch — pick a topic", "system");
    this.broadcastState();
  }

  private relaySignal(msg: Record<string, unknown>) {
    const to = msg.toUserId;
    if (typeof to !== "string") return;
    for (const member of this.members.values()) {
      if (member.userId === to) {
        member.conn.send(JSON.stringify(msg));
        return;
      }
    }
  }

  // ── Plumbing ───────────────────────────────────────────────────────────────

  private sidesList(): Side[] {
    return [...this.sides.values()];
  }

  private isConnected(userId: string): boolean {
    for (const m of this.members.values()) if (m.userId === userId) return true;
    return false;
  }

  /**
   * May this connection drive the room (build boards, judge, rematch)?
   * The host always can. If the host is not connected, any seated player can —
   * the room must never lock up waiting for someone who dropped.
   */
  private canDrive(sender: Party.Connection): boolean {
    const member = this.members.get(sender.id);
    if (!member) return false;
    if (member.userId === this.hostId) return true;
    if (this.hostId && this.isConnected(this.hostId)) return false;
    return this.sides.has(member.userId);
  }

  private seatOf(userId: string): number {
    for (const m of this.members.values()) if (m.userId === userId) return m.seat;
    const idx = [...this.sides.keys()].indexOf(userId);
    return idx >= 0 ? idx : 99;
  }

  private push(text: string, kind: TickerEvent["kind"]) {
    this.ticker.push({ id: ++this.eventSeq, text, kind });
    if (this.ticker.length > 40) this.ticker.shift();
  }

  private publicState() {
    return {
      phase: this.phase,
      pack: this.pack,
      rules: this.rules,
      hostId: this.hostId,
      hostConnected: this.hostId ? this.isConnected(this.hostId) : false,
      matchId: this.matchId,
      lot: this.lot,
      currentBid: this.currentBid,
      highBidderId: this.highBidderId,
      turnId: this.turnId,
      openerId: this.openerId,
      passedIds: [...this.passedIds],
      passLocked: [...this.passLocked],
      dice: this.dice,
      lotsRemaining: Math.max(0, this.pool.length - this.cursor),
      sides: this.sidesList(),
      readyIds: [...this.readyIds],
      members: [...this.members.values()].map((m) => ({
        userId: m.userId,
        name: m.name,
        avatarUrl: m.avatarUrl,
        mic: m.mic,
        cam: m.cam,
        seat: m.seat,
      })),
      ticker: this.ticker.slice(-14),
      verdict: this.verdict,
      battle: this.battle,
      battleStaging: this.battleStaging,
      stagingKind: this.stagingKind,
    };
  }

  private broadcastState() {
    this.room.broadcast(JSON.stringify({ type: "state", state: this.publicState() }));
  }
}
