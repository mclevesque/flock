import type * as Party from "partykit/server";
import {
  buildLot,
  buildPool,
  makeRng,
  maxBid,
  DEFAULT_RULES,
  type Lot,
  type Rules,
  type Side,
} from "../lib/draftmasters/engine";
import type { Pack } from "../lib/draftmasters/packs";

/**
 * DraftMasters PvP room — authoritative auction server.
 *
 * The server owns the clock and the money. Clients render state and send
 * intents ("bid 4"), which keeps two browsers from ever disagreeing about who
 * won a lot when both click in the same millisecond.
 *
 * Flow: lobby -> preparing (host builds the board + prefetches portraits)
 *       -> ready (both players ready up) -> bidding/sold loop -> complete.
 *
 * Opening rights alternate lot by lot. Only the opener may place the first bid;
 * if they pass, the right crosses to the other side; if both pass, the lot goes
 * unsold. After the lot is open, bidding is a normal free ascending auction.
 *
 * It also relays WebRTC signalling for the shared mics/cams, same wire format
 * as party/voice.ts so the client reuses the pattern the rest of the site uses.
 */

type Phase = "lobby" | "preparing" | "ready" | "bidding" | "sold" | "complete";

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
  kind: "bid" | "sold" | "passed" | "system";
}

const SOLD_REVEAL_MS = 3200;
const OPEN_PASS_SECONDS = 8;

export default class DraftMastersParty implements Party.Server {
  private members = new Map<string, Member>();
  private hostId: string | null = null;

  private phase: Phase = "lobby";
  private pack: Pack | null = null;
  private rules: Rules = { ...DEFAULT_RULES };
  private seed = Math.floor(Math.random() * 0x7fffffff);

  private pool: number[] = [];
  private cursor = 0;
  private lotIndex = 0;
  private lot: Lot | null = null;
  private currentBid = 0;
  private highBidderId: string | null = null;
  private openerId: string | null = null;
  private openerPassed = false;
  private deadline = 0;

  private sides = new Map<string, Side>();
  private readyIds = new Set<string>();
  private ticker: TickerEvent[] = [];
  private eventSeq = 0;
  private verdict: unknown = null;

  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(readonly room: Party.Room) {}

  // ── Connection lifecycle ───────────────────────────────────────────────────

  onConnect(conn: Party.Connection) {
    conn.send(JSON.stringify({ type: "state", state: this.publicState() }));
  }

  onClose(conn: Party.Connection) {
    const member = this.members.get(conn.id);
    this.members.delete(conn.id);
    if (!member) return;

    this.room.broadcast(JSON.stringify({ type: "peer-left", userId: member.userId }));
    this.readyIds.delete(member.userId);

    // Host migrates to whoever's left so the room doesn't lock up.
    if (this.hostId === member.userId) {
      const next = [...this.members.values()].sort((a, b) => a.seat - b.seat)[0];
      this.hostId = next?.userId ?? null;
    }
    this.push(`${member.name} left`, "system");
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
      case "chat":
        return this.handleChat(msg, sender);
      case "media":
        return this.handleMedia(msg, sender);
      case "verdict":
        return this.handleVerdict(msg, sender);
      case "rematch":
        return this.handleRematch(sender);
      case "rtc-signal":
        return this.relaySignal(msg);
    }
  }

  private handleJoin(msg: Record<string, unknown>, sender: Party.Connection) {
    const userId = String(msg.userId ?? "").slice(0, 64);
    if (!userId) return;

    // Reclaim a seat on reconnect rather than handing out a new one.
    const existing = [...this.members.values()].find((m) => m.userId === userId);
    let seat = existing?.seat ?? 0;
    if (!existing) {
      const taken = new Set([...this.members.values()].map((m) => m.seat));
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

    this.push(`${member.name} joined`, "system");
    this.room.broadcast(
      JSON.stringify({
        type: "peer-joined",
        userId: member.userId,
        name: member.name,
        avatarUrl: member.avatarUrl,
      }),
      [sender.id]
    );
    this.broadcastState();
  }

  /** Host flips the room to the prep screen while it builds the board. */
  private handlePreparing(sender: Party.Connection) {
    const member = this.members.get(sender.id);
    if (!member || member.userId !== this.hostId) return;
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
    const member = this.members.get(sender.id);
    if (!member || member.userId !== this.hostId) return;

    const pack = msg.pack as Pack | undefined;
    if (!pack || !Array.isArray(pack.entries) || pack.entries.length < 6) return;

    this.pack = pack;
    if (typeof msg.budget === "number" && msg.budget >= 10 && msg.budget <= 200) {
      this.rules.budget = Math.round(msg.budget);
    }
    if (typeof msg.rosterSize === "number" && msg.rosterSize >= 3 && msg.rosterSize <= 10) {
      this.rules.rosterSize = Math.round(msg.rosterSize);
    }

    this.seed = Math.floor(Math.random() * 0x7fffffff);
    this.pool = buildPool(pack, makeRng(this.seed));
    this.cursor = 0;
    this.lotIndex = 0;
    this.verdict = null;
    this.ticker = [];
    this.readyIds.clear();
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

  private handleBid(msg: Record<string, unknown>, sender: Party.Connection) {
    const member = this.members.get(sender.id);
    if (!member || this.phase !== "bidding" || !this.lot) return;

    const side = this.sides.get(member.userId);
    if (!side) return; // spectators can't bid

    // Opening rights: until there's a bid on the board, only the opener may act.
    if (this.currentBid === 0 && this.openerId !== member.userId) return;

    const amount = Math.round(Number(msg.amount));
    if (!Number.isFinite(amount)) return;
    if (amount <= this.currentBid) return;
    if (amount > maxBid(side, this.rules)) return;
    if (this.highBidderId === member.userId) return; // no bidding against yourself

    this.currentBid = amount;
    this.highBidderId = member.userId;
    this.push(`${side.name} bids $${amount}`, "bid");

    this.deadline = Date.now() + this.rules.bidSeconds * 1000;
    this.arm(this.rules.bidSeconds * 1000, () => this.closeLot());
    this.broadcastState();
  }

  /**
   * Declining to open. Only meaningful before the first bid — after that,
   * simply not bidding is the pass.
   */
  private handlePass(sender: Party.Connection) {
    const member = this.members.get(sender.id);
    if (!member || this.phase !== "bidding" || !this.lot) return;
    if (this.currentBid !== 0) return;
    if (this.openerId !== member.userId) return;
    this.passOpening();
  }

  private passOpening() {
    const opener = this.openerId ? this.sides.get(this.openerId) : null;

    if (!this.openerPassed) {
      // Opening right crosses to the other side with a fresh, shorter window.
      const other = [...this.sides.values()].find((s) => s.id !== this.openerId);
      this.push(`${opener?.name ?? "Opener"} passes — over to ${other?.name ?? "the other side"}`, "passed");
      this.openerPassed = true;
      this.openerId = other?.id ?? null;

      if (this.openerId && maxBid(this.sides.get(this.openerId)!, this.rules) >= 1) {
        this.deadline = Date.now() + OPEN_PASS_SECONDS * 1000;
        this.arm(OPEN_PASS_SECONDS * 1000, () => this.closeLot());
        this.broadcastState();
        return;
      }
    }
    // Both sides declined.
    this.closeLot();
  }

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

  private handleMedia(msg: Record<string, unknown>, sender: Party.Connection) {
    const member = this.members.get(sender.id);
    if (!member) return;
    if (typeof msg.mic === "boolean") member.mic = msg.mic;
    if (typeof msg.cam === "boolean") member.cam = msg.cam;
    this.room.broadcast(
      JSON.stringify({ type: "media", userId: member.userId, mic: member.mic, cam: member.cam })
    );
  }

  /** The host runs the judge call and posts the result so both sides see one verdict. */
  private handleVerdict(msg: Record<string, unknown>, sender: Party.Connection) {
    const member = this.members.get(sender.id);
    if (!member || member.userId !== this.hostId) return;
    this.verdict = msg.verdict ?? null;
    this.broadcastState();
  }

  private handleRematch(sender: Party.Connection) {
    const member = this.members.get(sender.id);
    if (!member || member.userId !== this.hostId) return;
    this.clearTimer();
    this.phase = "lobby";
    this.lot = null;
    this.verdict = null;
    this.currentBid = 0;
    this.highBidderId = null;
    this.openerId = null;
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

  // ── Auction flow ───────────────────────────────────────────────────────────

  private nominate() {
    if (!this.pack) return;

    const allFull = [...this.sides.values()].every(
      (s) => s.roster.length >= this.rules.rosterSize
    );
    const anyoneCanBid = [...this.sides.values()].some((s) => maxBid(s, this.rules) >= 1);

    if (allFull || this.cursor >= this.pool.length || !anyoneCanBid) {
      this.phase = "complete";
      this.lot = null;
      this.clearTimer();
      this.push(
        allFull ? "Rosters full — calculate the winner" : "Board exhausted — calculate the winner",
        "system"
      );
      this.broadcastState();
      return;
    }

    const entryIndex = this.pool[this.cursor++];
    const rng = makeRng(this.seed + entryIndex * 7919 + this.cursor);
    this.lot = buildLot(this.pack.entries[entryIndex], entryIndex, this.pack, rng);

    // Opening rights alternate lot by lot, skipping anyone who can't afford to open.
    const seated = [...this.sides.values()].sort((a, b) => this.seatOf(a.id) - this.seatOf(b.id));
    const first = seated[this.lotIndex % seated.length];
    const second = seated.find((s) => s.id !== first.id);
    this.openerId =
      maxBid(first, this.rules) >= 1
        ? first.id
        : second && maxBid(second, this.rules) >= 1
          ? second.id
          : null;
    this.openerPassed = this.openerId !== first.id;
    this.lotIndex++;

    this.currentBid = 0;
    this.highBidderId = null;
    this.phase = "bidding";

    // If only one side can still bid (the other is full or reduced to nothing),
    // there's no auction left to run — don't make them sit through a full clock
    // on every remaining lot just to buy it for $1.
    const contested = [...this.sides.values()].filter((s) => maxBid(s, this.rules) >= 1).length > 1;
    const seconds = contested ? this.rules.openSeconds : 4;
    this.deadline = Date.now() + seconds * 1000;
    this.arm(seconds * 1000, () => this.onOpenTimeout());
    this.broadcastState();
  }

  /** Clock ran out with no bid — treat it as the opener declining. */
  private onOpenTimeout() {
    if (this.phase !== "bidding") return;
    if (this.currentBid === 0) return this.passOpening();
    this.closeLot();
  }

  private closeLot() {
    if (this.phase !== "bidding" || !this.lot) return;

    if (this.highBidderId && this.currentBid > 0) {
      const side = this.sides.get(this.highBidderId);
      if (side) {
        side.budget -= this.currentBid;
        side.roster.push({ ...this.lot, price: this.currentBid });
        this.push(`SOLD — ${this.lot.name} to ${side.name} for $${this.currentBid}`, "sold");
      }
    } else {
      this.push(`PASSED — nobody wanted ${this.lot.name}`, "passed");
    }

    this.phase = "sold";
    this.broadcastState();
    this.arm(SOLD_REVEAL_MS, () => this.nominate());
  }

  // ── Plumbing ───────────────────────────────────────────────────────────────

  private seatOf(userId: string): number {
    for (const m of this.members.values()) if (m.userId === userId) return m.seat;
    return 99;
  }

  private arm(ms: number, fn: () => void) {
    this.clearTimer();
    this.timer = setTimeout(fn, ms);
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
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
      lot: this.lot,
      currentBid: this.currentBid,
      highBidderId: this.highBidderId,
      openerId: this.openerId,
      openerPassed: this.openerPassed,
      /** Absolute ms — clients render their own countdown off this */
      deadline: this.deadline,
      serverNow: Date.now(),
      lotsRemaining: Math.max(0, this.pool.length - this.cursor),
      sides: [...this.sides.values()],
      readyIds: [...this.readyIds],
      members: [...this.members.values()].map((m) => ({
        userId: m.userId,
        name: m.name,
        avatarUrl: m.avatarUrl,
        mic: m.mic,
        cam: m.cam,
        seat: m.seat,
      })),
      ticker: this.ticker.slice(-12),
      verdict: this.verdict,
    };
  }

  private broadcastState() {
    this.room.broadcast(JSON.stringify({ type: "state", state: this.publicState() }));
  }
}
