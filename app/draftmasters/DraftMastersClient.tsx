"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BUDGET_PRESETS,
  DEFAULT_RULES,
  NPC_PERSONALITIES,
  buildLot,
  buildPool,
  canMatch,
  canOpen,
  canRaise,
  isFull,
  makeRng,
  maxBid,
  npcMove,
  npcThinkMs,
  npcValuation,
  otherSide,
  randomSeed,
  rollDie,
  type NpcPersonality,
  type Rules,
  type Side,
} from "@/lib/draftmasters/engine";
import type { Pack } from "@/lib/draftmasters/packs";
import { initAudio, isMuted, setMuted, sfx } from "@/lib/draftmasters/sfx";
import AuctionStage from "./AuctionStage";
import MediaRail from "./MediaRail";
import VerdictScreen from "./VerdictScreen";
import { useDraftMedia, type DraftMedia } from "./useDraftMedia";
import { STYLES } from "./styles";
import {
  EMPTY_VIEW,
  type ChatLine,
  type DiceState,
  type GameView,
  type PackSummary,
  type PlayerRecord,
  type PortraitMap,
  type TickerEvent,
  type Verdict,
} from "./types";

/**
 * DraftMasters — auction draft for any topic.
 *
 * Two engines, one set of screens. Solo runs the auction locally against an
 * NPC; PvP mirrors an authoritative PartyKit room. Both produce the same
 * GameView, so every screen below is mode-agnostic.
 *
 * There are no clocks anywhere. Every lot resolves on a decision, and PvP
 * progression is client-driven and idempotent, so a phone that drops for ten
 * seconds resyncs to exactly where the game is.
 */

const TOPIC_EXAMPLES = [
  "Game of Thrones warriors",
  "One-hit wonders of the 90s",
  "NBA point guards",
  "Studio Ghibli characters",
  "Greek gods",
  "Cursed kitchen appliances",
];

const SYNC_INTERVAL_MS = 8000;

type Screen = "setup" | "room" | "prep" | "ready" | "auction" | "verdict";
type Mode = "solo" | "pvp";
type Action = { kind: "bid"; amount: number } | { kind: "pass" } | { kind: "match" };

interface Member {
  userId: string;
  name: string;
  avatarUrl: string | null;
  mic: boolean;
  cam: boolean;
}

interface Props {
  sessionUser: { id: string; name: string; avatarUrl: string | null } | null;
  packs: PackSummary[];
}

export default function DraftMastersClient({ sessionUser, packs }: Props) {
  // ── Identity ───────────────────────────────────────────────────────────────
  const [guestName, setGuestName] = useState("");
  const meId = useGuestId(sessionUser?.id);
  const myName = sessionUser?.name ?? (guestName.trim() || "Guest");
  const myAvatar = sessionUser?.avatarUrl ?? null;

  // ── Screen + config ────────────────────────────────────────────────────────
  const [screen, setScreen] = useState<Screen>("setup");
  const [mode, setMode] = useState<Mode>("solo");
  const [presetId, setPresetId] = useState<string | null>("got");
  const [customTopic, setCustomTopic] = useState("");
  const [rulesIdx, setRulesIdx] = useState(0);
  const [npc, setNpc] = useState<NpcPersonality>(NPC_PERSONALITIES[0]);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [audioMuted, setAudioMuted] = useState(false);

  // ── Board + game ───────────────────────────────────────────────────────────
  const [pack, setPack] = useState<Pack | null>(null);
  const [rules, setRules] = useState<Rules>(DEFAULT_RULES);
  const [portraits, setPortraits] = useState<PortraitMap>({});
  const [view, setView] = useState<GameView>(EMPTY_VIEW);
  const [prepStep, setPrepStep] = useState(0);

  // ── Verdict + records ──────────────────────────────────────────────────────
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [judging, setJudging] = useState(false);
  const [record, setRecord] = useState<PlayerRecord | null>(null);
  const [leaderboard, setLeaderboard] = useState<PlayerRecord[]>([]);
  const [ratingDelta, setRatingDelta] = useState<number | null>(null);
  const reportedRef = useRef<string | null>(null);

  // ── PvP ────────────────────────────────────────────────────────────────────
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [iOpenedRoom, setIOpenedRoom] = useState(false);
  const [hostId, setHostId] = useState<string | null>(null);
  const [hostConnected, setHostConnected] = useState(true);
  const [connected, setConnected] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const matchIdRef = useRef<string>("");
  const wsRef = useRef<{ send: (s: string) => void; close: () => void } | null>(null);

  const send = useCallback((payload: Record<string, unknown>) => {
    wsRef.current?.send(JSON.stringify(payload));
  }, []);

  const sendSignal = useCallback(
    (toUserId: string, signalType: string, payload: unknown) => {
      send({ type: "rtc-signal", toUserId, fromUserId: meId, signalType, payload });
    },
    [meId, send]
  );
  const media = useDraftMedia(meId, sendSignal);
  const mediaRef = useRef(media);
  mediaRef.current = media;

  // ── Solo engine state (refs — the game loop can't wait for React) ──────────
  const gameRef = useRef<GameView>({ ...EMPTY_VIEW });
  const soloRef = useRef({
    pool: [] as number[],
    cursor: 0,
    lotIndex: 0,
    seed: 0,
    seq: 0,
    npcVal: 0,
    pack: null as Pack | null,
    rules: DEFAULT_RULES,
    npc: NPC_PERSONALITIES[0],
  });
  const npcTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setAudioMuted(isMuted());
  }, []);

  // ── Records ────────────────────────────────────────────────────────────────

  const loadRecords = useCallback(async () => {
    try {
      const res = await fetch(`/api/draftmasters/record?userId=${encodeURIComponent(meId)}`);
      const data = await res.json();
      setRecord(data.record ?? null);
      setLeaderboard(Array.isArray(data.leaderboard) ? data.leaderboard : []);
    } catch {
      /* records are a nice-to-have; the game doesn't wait on them */
    }
  }, [meId]);

  useEffect(() => {
    if (meId && meId !== "guest") void loadRecords();
  }, [meId, loadRecords]);

  /** Report a decided game. Keyed by match id, so a room reporting twice counts once. */
  const reportMatch = useCallback(
    async (final: Verdict, sides: Side[], matchId: string, gameMode: Mode) => {
      if (!matchId || reportedRef.current === matchId) return;
      reportedRef.current = matchId;
      try {
        const res = await fetch("/api/draftmasters/record", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            matchId,
            mode: gameMode,
            roomCode: gameMode === "pvp" ? roomCode : null,
            topic: pack?.name ?? "Draft",
            sides,
            winnerId: final.winnerId,
            verdict: final,
            reporterId: meId,
          }),
        });
        const data = await res.json();
        if (data?.record) setRecord(data.record);
        if (typeof data?.delta === "number" && !data.duplicate) {
          const iWon = final.winnerId === meId;
          setRatingDelta(gameMode === "pvp" ? (iWon ? data.delta : -data.delta) : null);
        }
        void loadRecords();
      } catch {
        /* recorded next time */
      }
    },
    [loadRecords, meId, pack?.name, roomCode]
  );

  // ── Invite links ───────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const invited = new URLSearchParams(window.location.search).get("room");
      if (invited) setJoinCode(invited.toUpperCase().slice(0, 6));
    } catch {
      /* no search params to read */
    }
  }, []);

  useEffect(() => {
    return () => {
      if (npcTimer.current) clearTimeout(npcTimer.current);
      wsRef.current?.close();
    };
  }, []);

  // ── Board building ─────────────────────────────────────────────────────────

  const prefetchPortraits = useCallback(async (board: Pack) => {
    const queries = board.entries.map((e) => ({
      q: `${e.s ? `${e.n} ${e.s}` : e.n} ${board.imgContext}`.trim(),
      name: e.n,
    }));
    try {
      const res = await fetch("/api/draftmasters/portrait", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queries, wiki: board.wiki }),
      });
      const data = await res.json();
      const map: PortraitMap = {};
      queries.forEach((q, i) => {
        map[q.q] = data?.portraits?.[i]?.url ?? null;
      });
      setPortraits(map);
    } catch {
      setPortraits({}); // lettered cards are a fine fallback
    }
  }, []);

  /** Resolve the chosen topic into a full board, portraits and all. */
  const buildBoard = useCallback(async (): Promise<Pack | null> => {
    setError(null);
    setPrepStep(0);

    let board: Pack | null = null;
    try {
      if (customTopic.trim()) {
        const res = await fetch("/api/draftmasters/topic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: customTopic.trim() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Could not build that board.");
        board = data.pack as Pack;
      } else if (presetId) {
        const res = await fetch(`/api/draftmasters/topic?packId=${presetId}`);
        const data = await res.json();
        if (!res.ok) throw new Error("Could not load that topic.");
        board = data.pack as Pack;
      } else {
        // Never default to a board the host didn't choose.
        throw new Error("Pick a topic first.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong building the board.");
      return null;
    }

    setPrepStep(1);
    setPack(board);
    await prefetchPortraits(board);
    setPrepStep(2);
    sfx.boardReady();
    return board;
  }, [customTopic, presetId, prefetchPortraits]);

  // ── Solo game loop ─────────────────────────────────────────────────────────

  const commit = useCallback(() => {
    const g = gameRef.current;
    setView({
      ...g,
      sides: g.sides.map((s) => ({ ...s, roster: [...s.roster] })),
      ticker: [...g.ticker],
      readyIds: [...g.readyIds],
      passedIds: [...g.passedIds],
      dice: g.dice ? { ...g.dice, rounds: [...g.dice.rounds] } : null,
    });
  }, []);

  const pushEvent = useCallback((text: string, kind: TickerEvent["kind"]) => {
    const g = gameRef.current;
    g.ticker.push({ id: ++soloRef.current.seq, text, kind });
    if (g.ticker.length > 40) g.ticker.shift();
  }, []);

  const clearNpc = useCallback(() => {
    if (npcTimer.current) clearTimeout(npcTimer.current);
    npcTimer.current = null;
  }, []);

  // Mutually recursive steps live in refs so each can reach the others.
  const nominateRef = useRef<() => void>(() => {});
  const closeLotRef = useRef<() => void>(() => {});
  const actRef = useRef<(sideId: string, action: Action) => void>(() => {});
  const startDiceRef = useRef<(reason: DiceState["reason"], ids: [string, string], price: number) => void>(() => {});
  const rollRoundRef = useRef<() => void>(() => {});
  const scheduleNpcRef = useRef<() => void>(() => {});
  const finishVerdictRef = useRef<(v: Verdict) => void>(() => {});
  const verdictRef = useRef<Verdict | null>(null);
  verdictRef.current = verdict;

  const nameOf = useCallback(
    (id: string) => (id === meId ? "You" : (gameRef.current.sides.find((s) => s.id === id)?.name ?? "—")),
    [meId]
  );

  scheduleNpcRef.current = () => {
    clearNpc();
    const g = gameRef.current;
    const S = soloRef.current;
    if (g.phase !== "bidding") return;
    const bot = g.sides.find((s) => s.isNpc);
    if (!bot || g.turnId !== bot.id) return;

    npcTimer.current = setTimeout(() => {
      const gg = gameRef.current;
      if (gg.phase !== "bidding" || gg.turnId !== bot.id) return;
      actRef.current(bot.id, npcMove(S.npcVal, bot, S.rules, gg.currentBid));
    }, npcThinkMs(S.npcVal, g.currentBid));
  };

  actRef.current = (sideId, action) => {
    const g = gameRef.current;
    const S = soloRef.current;
    if (g.phase !== "bidding" || !g.lot || g.turnId !== sideId) return;
    const side = g.sides.find((s) => s.id === sideId);
    if (!side) return;
    const other = otherSide(g.sides, sideId);
    const isMe = sideId === meId;

    if (action.kind === "bid") {
      const amount = action.amount;
      if (amount <= g.currentBid || amount > maxBid(side, S.rules)) return;
      g.currentBid = amount;
      g.highBidderId = sideId;
      pushEvent(`${isMe ? "You bid" : `${side.name} bids`} $${amount}`, "bid");
      if (isMe) sfx.bid(amount);
      else sfx.outbid(amount);

      if (other && (canRaise(other, S.rules, amount) || canMatch(other, S.rules, amount))) {
        g.turnId = other.id;
        commit();
        scheduleNpcRef.current();
      } else {
        closeLotRef.current();
      }
      return;
    }

    if (action.kind === "pass") {
      if (g.currentBid > 0) {
        pushEvent(isMe ? "You let it go" : `${side.name} lets it go`, "passed");
        closeLotRef.current();
        return;
      }
      g.passedIds.push(sideId);
      if (other && !g.passedIds.includes(other.id) && canOpen(other, S.rules)) {
        pushEvent(`${isMe ? "You pass" : `${side.name} passes`} — over to ${nameOf(other.id)}`, "passed");
        g.turnId = other.id;
        sfx.click();
        commit();
        scheduleNpcRef.current();
      } else {
        closeLotRef.current();
      }
      return;
    }

    if (action.kind === "match") {
      if (!g.highBidderId || !canMatch(side, S.rules, g.currentBid)) return;
      pushEvent(`${isMe ? "You match" : `${side.name} matches`} $${g.currentBid} — dice decide it`, "dice");
      startDiceRef.current("lot", [g.highBidderId, sideId], g.currentBid);
    }
  };

  startDiceRef.current = (reason, ids, price) => {
    const g = gameRef.current;
    g.dice = { reason, sideIds: ids, rounds: [], winnerId: null, price };
    g.phase = "dice";
    g.turnId = null;
    rollRoundRef.current();
  };

  rollRoundRef.current = () => {
    const g = gameRef.current;
    if (!g.dice || g.dice.winnerId) return;
    const a = rollDie();
    const b = rollDie();
    g.dice.rounds.push({ a, b });
    const [idA, idB] = g.dice.sideIds;
    sfx.click();

    if (a === b) {
      pushEvent(`Dice: ${a}–${b}, tie — rerolling`, "dice");
      commit();
      return; // the stage animates the tie and calls advance
    }

    const winnerId = a > b ? idA : idB;
    g.dice.winnerId = winnerId;
    pushEvent(`Dice: ${a}–${b} — ${nameOf(winnerId)} win${winnerId === meId ? "" : "s"} it`, "dice");
    // The stage shows the winning die, then calls advance — same rule as PvP.
    commit();
  };

  /** Apply a decided dice-off: award the lot, or crown the verdict winner. */
  const finishDice = useCallback(() => {
    const g = gameRef.current;
    if (!g.dice || g.dice.winnerId === null) return;
    const winnerId = g.dice.winnerId;
    if (g.dice.reason === "lot") {
      g.highBidderId = winnerId;
      g.currentBid = g.dice.price;
      closeLotRef.current();
      return;
    }
    const current = verdictRef.current;
    const final: Verdict = current
      ? { ...current, winnerId, diceBreak: g.dice }
      : { winnerId, headline: "Dice decide it", reasoning: "", sideNotes: [], judged: "offline", diceBreak: g.dice };
    finishVerdictRef.current(final);
  }, []);

  closeLotRef.current = () => {
    const g = gameRef.current;
    if (!g.lot) return;
    clearNpc();

    if (g.highBidderId && g.currentBid > 0) {
      const side = g.sides.find((s) => s.id === g.highBidderId);
      if (side) {
        side.budget -= g.currentBid;
        side.roster.push({ ...g.lot, price: g.currentBid });
        pushEvent(`SOLD — ${g.lot.name} to ${nameOf(side.id).toLowerCase()} for $${g.currentBid}`, "sold");
        sfx.sold();
      }
    } else {
      pushEvent(`PASSED — nobody wanted ${g.lot.name}`, "passed");
      sfx.passed();
    }

    g.turnId = null;
    g.phase = "sold";
    commit();
    // The stage calls advance after the reveal.
  };

  nominateRef.current = () => {
    const g = gameRef.current;
    const S = soloRef.current;
    const board = S.pack;
    if (!board) return;
    clearNpc();

    const allFull = g.sides.every((s) => isFull(s, S.rules));
    const anyoneCanOpen = g.sides.some((s) => canOpen(s, S.rules));

    if (allFull || S.cursor >= S.pool.length || !anyoneCanOpen) {
      g.phase = "complete";
      g.lot = null;
      g.turnId = null;
      g.dice = null;
      pushEvent(allFull ? "Rosters full — calculate the winner" : "Board exhausted — calculate the winner", "system");
      commit();
      setScreen("verdict");
      return;
    }

    const entryIndex = S.pool[S.cursor++];
    const rng = makeRng(S.seed + entryIndex * 7919 + S.cursor);
    g.lot = buildLot(board.entries[entryIndex], entryIndex, board, rng);
    g.lotsRemaining = Math.max(0, S.pool.length - S.cursor);

    // Opening rights alternate, skipping anyone who can't open.
    const first = g.sides[S.lotIndex % g.sides.length];
    const second = g.sides.find((s) => s.id !== first.id);
    g.openerId = canOpen(first, S.rules) ? first.id : second && canOpen(second, S.rules) ? second.id : null;
    S.lotIndex++;

    g.turnId = g.openerId;
    g.currentBid = 0;
    g.highBidderId = null;
    g.passedIds = [];
    g.dice = null;
    g.phase = "bidding";

    const bot = g.sides.find((s) => s.isNpc);
    S.npcVal = bot ? npcValuation(g.lot, bot, S.rules, S.npc, g.lotsRemaining, Math.random) : 0;

    sfx.lotIn();
    commit();
    scheduleNpcRef.current();
  };

  /** Solo progression after a reveal or a dice round — mirrors the server's advance. */
  const soloAdvance = useCallback(() => {
    const g = gameRef.current;
    if (g.phase === "sold") nominateRef.current();
    else if (g.phase === "dice" && g.dice) {
      if (g.dice.winnerId !== null) finishDice();
      else rollRoundRef.current();
    }
  }, [finishDice]);

  // ── Starting a game ────────────────────────────────────────────────────────

  const startSolo = useCallback(async () => {
    initAudio();
    setMode("solo");
    setScreen("prep");
    setVerdict(null);
    setRatingDelta(null);

    const board = await buildBoard();
    if (!board) {
      setScreen("setup");
      return;
    }

    const preset = BUDGET_PRESETS[rulesIdx];
    const nextRules: Rules = { budget: preset.budget, rosterSize: preset.rosterSize };
    setRules(nextRules);

    const seed = randomSeed();
    matchIdRef.current = `solo-${meId}-${seed}`;
    const sides: Side[] = [
      { id: meId, name: myName, avatarUrl: myAvatar, budget: nextRules.budget, roster: [], isNpc: false },
      { id: "npc", name: `${npc.emoji} ${npc.name}`, avatarUrl: null, budget: nextRules.budget, roster: [], isNpc: true },
    ];

    soloRef.current = {
      pool: buildPool(board, makeRng(seed)),
      cursor: 0,
      lotIndex: 0,
      seed,
      seq: 0,
      npcVal: 0,
      pack: board,
      rules: nextRules,
      npc,
    };
    gameRef.current = {
      ...EMPTY_VIEW,
      phase: "ready",
      sides,
      readyIds: ["npc"], // the NPC is always ready — it's a computer
      lotsRemaining: board.entries.length,
      ticker: [],
    };
    commit();
    setScreen("ready");
  }, [buildBoard, commit, meId, myAvatar, myName, npc, rulesIdx]);

  const readyUp = useCallback(() => {
    initAudio();
    sfx.ready();
    if (mode === "pvp") {
      send({ type: "ready", ready: true });
      return;
    }
    const g = gameRef.current;
    if (!g.readyIds.includes(meId)) g.readyIds.push(meId);
    commit();
    setScreen("auction");
    setTimeout(() => nominateRef.current(), 500);
  }, [commit, meId, mode, send]);

  // ── PvP ────────────────────────────────────────────────────────────────────

  const connectRoom = useCallback(
    async (code: string, asHost: boolean) => {
      initAudio();
      setMode("pvp");
      setRoomCode(code);
      setIOpenedRoom(asHost);
      setError(null);
      setChat([]);
      reportedRef.current = null;

      const { default: PartySocket } = await import("partysocket");
      const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999";
      const ws = new PartySocket({ host, room: code, party: "draftmasters" });
      wsRef.current = ws as unknown as { send: (s: string) => void; close: () => void };

      // Every open — first connect or any reconnect — re-joins and resyncs.
      ws.addEventListener("open", () => {
        setConnected(true);
        ws.send(JSON.stringify({ type: "join", userId: meId, name: myName, avatarUrl: myAvatar, mic: true }));
        ws.send(JSON.stringify({ type: "sync" }));
      });
      ws.addEventListener("close", () => setConnected(false));
      ws.addEventListener("message", (ev: MessageEvent) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(ev.data as string);
        } catch {
          return;
        }
        void serverMessageRef.current(msg);
      });

      // Mics on by default — arguing about the picks is the game.
      void mediaRef.current.start({ mic: true, cam: false });
      setScreen("room");
    },
    [meId, myAvatar, myName]
  );

  // Safety net: periodically and whenever the tab comes back, ask for the
  // authoritative state. Cheap, and it guarantees convergence after any blip.
  useEffect(() => {
    if (mode !== "pvp") return;
    const sync = () => send({ type: "sync" });
    const id = setInterval(sync, SYNC_INTERVAL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", sync);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", sync);
    };
  }, [mode, send]);

  /** Host commits the topic and deals the board. Everyone is already in the room. */
  const startPvpDraft = useCallback(async () => {
    initAudio();
    sfx.click();
    send({ type: "preparing" });
    setScreen("prep");
    const board = await buildBoard();
    if (!board) {
      setScreen("room");
      return;
    }
    const preset = BUDGET_PRESETS[rulesIdx];
    send({ type: "board", pack: board, budget: preset.budget, rosterSize: preset.rosterSize });
  }, [buildBoard, rulesIdx, send]);

  const prevPhase = useRef<string>("");
  const prevBid = useRef(0);
  const knownPackId = useRef<string | null>(null);

  const handleServerMessage = useCallback(
    async (msg: Record<string, unknown>) => {
      if (msg.type === "chat") {
        setChat((prev) =>
          [
            ...prev,
            {
              userId: String(msg.userId),
              name: String(msg.name),
              text: String(msg.text),
              at: Number(msg.at),
              system: Boolean(msg.system),
            },
          ].slice(-80)
        );
        return;
      }
      if (msg.type === "rtc-signal") {
        void mediaRef.current.handleSignal({
          fromUserId: String(msg.fromUserId),
          signalType: msg.signalType as "offer" | "answer" | "ice",
          payload: msg.payload as Record<string, unknown>,
        });
        return;
      }
      if (msg.type === "peer-joined") {
        void mediaRef.current.connectTo(String(msg.userId));
        return;
      }
      if (msg.type === "peer-left") {
        mediaRef.current.dropPeer(String(msg.userId));
        return;
      }
      if (msg.type !== "state") return;

      const s = msg.state as Record<string, unknown>;
      const serverPack = s.pack as Pack | null;
      const phase = String(s.phase);

      setHostId((s.hostId as string) ?? null);
      setHostConnected(Boolean(s.hostConnected));
      setRules(s.rules as Rules);
      setMembers((s.members as Member[]) ?? []);
      setVerdict((s.verdict as Verdict | null) ?? null);
      matchIdRef.current = String(s.matchId ?? "");

      // New board arrived — pull its portraits before the first lot drops.
      // The server stamps a nonce on every board so this fires per deal.
      if (serverPack && serverPack.id !== knownPackId.current) {
        knownPackId.current = serverPack.id;
        setPack(serverPack);
        await prefetchPortraits(serverPack);
        sfx.boardReady();
      } else if (!serverPack) {
        knownPackId.current = null;
        setPack(null);
      }

      // Mesh up with everyone already in the room.
      ((s.members as { userId: string }[]) ?? []).forEach((m) => {
        if (m.userId !== meId) void mediaRef.current.connectTo(m.userId);
      });

      const nextView: GameView = {
        phase: phase === "lobby" || phase === "preparing" ? "ready" : (phase as GameView["phase"]),
        lot: (s.lot as GameView["lot"]) ?? null,
        currentBid: Number(s.currentBid) || 0,
        highBidderId: (s.highBidderId as string) ?? null,
        turnId: (s.turnId as string) ?? null,
        openerId: (s.openerId as string) ?? null,
        passedIds: (s.passedIds as string[]) ?? [],
        dice: (s.dice as DiceState | null) ?? null,
        lotsRemaining: Number(s.lotsRemaining) || 0,
        sides: (s.sides as Side[]) ?? [],
        ticker: (s.ticker as TickerEvent[]) ?? [],
        readyIds: (s.readyIds as string[]) ?? [],
      };
      setView(nextView);

      // Sound on transitions the server drives.
      if (phase === "bidding" && prevPhase.current !== "bidding") sfx.lotIn();
      if (phase === "sold" && prevPhase.current !== "sold") {
        if (nextView.highBidderId) sfx.sold();
        else sfx.passed();
      }
      if (phase === "bidding" && nextView.currentBid > prevBid.current && nextView.highBidderId !== meId) {
        sfx.outbid(nextView.currentBid);
      }
      if (phase === "dice" && prevPhase.current !== "dice") sfx.click();
      prevBid.current = phase === "bidding" ? nextView.currentBid : 0;
      prevPhase.current = phase;

      if (phase === "ready") setScreen("ready");
      else if (phase === "bidding" || phase === "sold" || phase === "dice") setScreen("auction");
      else if (phase === "complete") setScreen("verdict");
      else if (phase === "lobby") setScreen("room");
      else setScreen("prep");

      // A decided game gets recorded by whoever sees it decided.
      const v = s.verdict as Verdict | null;
      if (phase === "complete" && v?.winnerId && nextView.sides.length === 2 && s.matchId) {
        if (!v.diceBreak || v.diceBreak.winnerId) {
          void reportMatch(v, nextView.sides, String(s.matchId), "pvp");
        }
      }
    },
    [meId, prefetchPortraits, reportMatch]
  );

  const serverMessageRef = useRef(handleServerMessage);
  serverMessageRef.current = handleServerMessage;

  // ── Player actions ─────────────────────────────────────────────────────────

  const handleBid = useCallback(
    (amount: number) => {
      initAudio();
      if (mode === "pvp") {
        sfx.bid(amount);
        send({ type: "bid", amount });
      } else {
        actRef.current(meId, { kind: "bid", amount });
      }
    },
    [meId, mode, send]
  );

  const handlePass = useCallback(() => {
    initAudio();
    if (mode === "pvp") {
      sfx.click();
      send({ type: "pass" });
    } else {
      actRef.current(meId, { kind: "pass" });
    }
  }, [meId, mode, send]);

  const handleMatch = useCallback(() => {
    initAudio();
    if (mode === "pvp") send({ type: "match" });
    else actRef.current(meId, { kind: "match" });
  }, [meId, mode, send]);

  const handleAdvance = useCallback(() => {
    if (mode === "pvp") {
      // Name the phase we're advancing from so a late duplicate can't push
      // the room through two steps.
      send({ type: "advance", from: view.phase, round: view.dice?.rounds.length ?? 0 });
    } else {
      soloAdvance();
    }
  }, [mode, send, soloAdvance, view.phase, view.dice?.rounds.length]);

  finishVerdictRef.current = (final: Verdict) => {
    const g = gameRef.current;
    g.phase = "complete";
    g.dice = final.diceBreak ?? null;
    commit();
    setVerdict(final);
    setScreen("verdict");
    sfx.verdict();
    void reportMatch(final, g.sides, matchIdRef.current, "solo");
  };

  const handleJudge = useCallback(async () => {
    setJudging(true);
    setError(null);
    try {
      const res = await fetch("/api/draftmasters/judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packId: pack?.id?.split("#")[0],
          pack: pack ? { name: pack.name, scenario: pack.scenario, criteria: pack.criteria } : undefined,
          sides: view.sides,
        }),
      });
      const data = (await res.json()) as Verdict;
      if (!res.ok) throw new Error("The judge is out to lunch. Try again.");

      if (mode === "pvp") {
        // The room decides whether it's a tie and runs the dice.
        send({ type: "verdict", verdict: data });
        return;
      }

      const notes = data.sideNotes ?? [];
      if (notes.length === 2 && notes[0].score === notes[1].score) {
        setVerdict(data);
        verdictRef.current = data;
        const g = gameRef.current;
        setScreen("auction");
        startDiceRef.current("verdict", [g.sides[0].id, g.sides[1].id], 0);
        return;
      }
      finishVerdictRef.current(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach the judge.");
    } finally {
      setJudging(false);
    }
  }, [mode, pack, send, view.sides]);

  const playAgain = useCallback(() => {
    sfx.click();
    clearNpc();
    setVerdict(null);
    setRatingDelta(null);
    setError(null);
    setPortraits({});
    setPack(null);
    // Clear BOTH topic inputs. Leaving presetId set is why a rematch kept
    // dealing the previous board — the old pick was still "selected", and the
    // host could hit Build without noticing.
    setCustomTopic("");
    setPresetId(null);
    knownPackId.current = null;
    prevPhase.current = "";
    prevBid.current = 0;
    reportedRef.current = null;
    gameRef.current = { ...EMPTY_VIEW };
    setView(EMPTY_VIEW);
    if (mode === "pvp") {
      // The room goes back to its lobby; the server drives the screen.
      send({ type: "rematch" });
      setScreen("room");
    } else {
      setScreen("setup");
    }
  }, [clearNpc, mode, send]);

  const sendChat = useCallback((text: string) => send({ type: "chat", text }), [send]);

  const toggleAudio = useCallback(() => {
    initAudio();
    const next = !audioMuted;
    setMuted(next);
    setAudioMuted(next);
    if (!next) sfx.click();
  }, [audioMuted]);

  // ── Derived ────────────────────────────────────────────────────────────────

  // Mirrors the server's rule: the host drives, unless they're gone.
  const canDrive =
    mode === "solo" || hostId === meId || (hostId === null && iOpenedRoom) || (hostId !== null && !hostConnected);
  const topicLabel = customTopic.trim() || packs.find((p) => p.id === presetId)?.name || "a topic";
  const iAmReady = view.readyIds.includes(meId);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="dm">
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      {mode === "pvp" && !connected && <div className="dm-conn">Reconnecting…</div>}
      <div className="dm-shell">
        <header className="dm-head">
          <div>
            <h1 className="dm-wordmark">DraftMasters</h1>
            {screen === "setup" && (
              <p className="dm-tagline">
                Auction draft anything. ${BUDGET_PRESETS[rulesIdx].budget} in your pocket,{" "}
                {BUDGET_PRESETS[rulesIdx].rosterSize} picks, one winner.
              </p>
            )}
          </div>
          <div className="dm-head-actions">
            <button
              className="dm-btn dm-btn-icon dm-btn-ghost"
              onClick={toggleAudio}
              title={audioMuted ? "Unmute sounds" : "Mute sounds"}
              aria-pressed={!audioMuted}
            >
              {audioMuted ? "🔇" : "🔊"}
            </button>
            <Link href="/games" className="dm-btn dm-btn-ghost">
              Great Souls
            </Link>
          </div>
        </header>

        {screen === "setup" && (
          <SetupScreen
            packs={packs}
            presetId={presetId}
            setPresetId={setPresetId}
            customTopic={customTopic}
            setCustomTopic={setCustomTopic}
            rulesIdx={rulesIdx}
            setRulesIdx={setRulesIdx}
            npc={npc}
            setNpc={setNpc}
            joinCode={joinCode}
            setJoinCode={setJoinCode}
            guestName={guestName}
            setGuestName={setGuestName}
            signedIn={Boolean(sessionUser)}
            error={error}
            record={record}
            leaderboard={leaderboard}
            meId={meId}
            onSolo={startSolo}
            onCreate={() => void connectRoom(makeRoomCode(), true)}
            onJoin={() => void connectRoom(joinCode.trim().toUpperCase(), false)}
          />
        )}

        {screen === "room" && (
          <RoomLobby
            roomCode={roomCode}
            isHost={canDrive}
            members={members}
            meId={meId}
            media={media}
            chat={chat}
            onSendChat={sendChat}
            packs={packs}
            presetId={presetId}
            setPresetId={setPresetId}
            customTopic={customTopic}
            setCustomTopic={setCustomTopic}
            rulesIdx={rulesIdx}
            setRulesIdx={setRulesIdx}
            error={error}
            onStart={() => void startPvpDraft()}
          />
        )}

        {screen === "prep" && (
          <PrepScreen step={prepStep} topic={topicLabel} isHost={canDrive} roomCode={roomCode} />
        )}

        {screen === "ready" && (
          <ReadyScreen
            pack={pack}
            rules={rules}
            sides={view.sides}
            readyIds={view.readyIds}
            meId={meId}
            iAmReady={iAmReady}
            mode={mode}
            roomCode={roomCode}
            onReady={readyUp}
            media={mode === "pvp" ? media : null}
            members={members}
            chat={chat}
            onSendChat={sendChat}
          />
        )}

        {screen === "auction" && (
          <>
            <AuctionStage
              view={view}
              rules={rules}
              meId={meId}
              portraits={portraits}
              speaking={media.speaking}
              packName={pack?.name ?? "Draft"}
              onBid={handleBid}
              onPass={handlePass}
              onMatch={handleMatch}
              onAdvance={handleAdvance}
            />
            {mode === "pvp" && (
              <div style={{ maxWidth: 380, marginLeft: "auto" }}>
                <MediaRail media={media} members={members} meId={meId} chat={chat} onSendChat={sendChat} />
              </div>
            )}
          </>
        )}

        {screen === "verdict" && (
          <VerdictScreen
            verdict={verdict}
            loading={judging}
            error={error}
            sides={view.sides}
            rules={rules}
            meId={meId}
            portraits={portraits}
            packName={pack?.name ?? "Draft"}
            canJudge={canDrive}
            record={record}
            ratingDelta={ratingDelta}
            mode={mode}
            onJudge={handleJudge}
            onPlayAgain={playAgain}
          />
        )}
      </div>
    </div>
  );
}

// ── Setup ────────────────────────────────────────────────────────────────────

function SetupScreen({
  packs,
  presetId,
  setPresetId,
  customTopic,
  setCustomTopic,
  rulesIdx,
  setRulesIdx,
  npc,
  setNpc,
  joinCode,
  setJoinCode,
  guestName,
  setGuestName,
  signedIn,
  error,
  record,
  leaderboard,
  meId,
  onSolo,
  onCreate,
  onJoin,
}: {
  packs: PackSummary[];
  presetId: string | null;
  setPresetId: (id: string | null) => void;
  customTopic: string;
  setCustomTopic: (s: string) => void;
  rulesIdx: number;
  setRulesIdx: (n: number) => void;
  npc: NpcPersonality;
  setNpc: (p: NpcPersonality) => void;
  joinCode: string;
  setJoinCode: (s: string) => void;
  guestName: string;
  setGuestName: (s: string) => void;
  signedIn: boolean;
  error: string | null;
  record: PlayerRecord | null;
  leaderboard: PlayerRecord[];
  meId: string;
  onSolo: () => void;
  onCreate: () => void;
  onJoin: () => void;
}) {
  // Arriving on an invite link prefills the code, so open the join panel
  // rather than hiding the one thing they came here to do.
  const [showJoin, setShowJoin] = useState(Boolean(joinCode));
  const usingCustom = customTopic.trim().length > 0;
  const hasTopic = usingCustom || Boolean(presetId);

  return (
    <>
      {error && (
        <div className="dm-error" style={{ marginBottom: 20 }}>
          {error}
        </div>
      )}

      {joinCode && (
        <div className="dm-panel" style={{ marginBottom: 22, borderColor: "var(--dm-gold)", textAlign: "center" }}>
          <p className="dm-eyebrow" style={{ marginBottom: 6 }}>
            You&apos;ve been invited
          </p>
          <p style={{ margin: "0 0 12px", fontSize: 15, color: "var(--dm-dim)" }}>
            Room <strong style={{ color: "var(--dm-gold)", letterSpacing: ".12em" }}>{joinCode}</strong> is waiting for
            you.
          </p>
          <button className="dm-btn dm-btn-primary dm-btn-lg" onClick={onJoin}>
            Join room {joinCode}
          </button>
        </div>
      )}

      {(record || leaderboard.length > 0) && (
        <section className="dm-section">
          <RecordPanel record={record} leaderboard={leaderboard} meId={meId} />
        </section>
      )}

      <section className="dm-section">
        <p className="dm-eyebrow">1 · Pick a topic</p>
        <div className="dm-custom">
          <input
            className="dm-input"
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value)}
            placeholder="Type any topic — “Game of Thrones warriors”…"
            maxLength={120}
            aria-label="Custom topic"
          />
        </div>
        <div className="dm-examples">
          {TOPIC_EXAMPLES.map((ex) => (
            <button key={ex} className="dm-chip" onClick={() => setCustomTopic(ex)}>
              {ex}
            </button>
          ))}
        </div>
        <p className="dm-note" style={{ marginTop: 10 }}>
          The board is built to match your wording — <em>warriors</em> gets you fighters, not schemers.
        </p>

        <p className="dm-eyebrow" style={{ marginTop: 22 }}>
          …or start from a ready-made board
        </p>
        <div className="dm-topics">
          {packs.map((p) => (
            <button
              key={p.id}
              className="dm-topic"
              data-on={!usingCustom && presetId === p.id ? "1" : "0"}
              onClick={() => {
                setCustomTopic("");
                setPresetId(p.id);
              }}
            >
              <span className="dm-topic-emoji">{p.emoji}</span>
              <span className="dm-topic-name">{p.name}</span>
              <span className="dm-topic-blurb">{p.blurb}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="dm-section">
        <p className="dm-eyebrow">2 · Budget</p>
        <div className="dm-seg">
          {BUDGET_PRESETS.map((preset, i) => (
            <button key={preset.label} className="dm-seg-item" data-on={rulesIdx === i ? "1" : "0"} onClick={() => setRulesIdx(i)}>
              <span className="dm-seg-label">{preset.label}</span>
              <span className="dm-seg-note">{preset.note}</span>
            </button>
          ))}
        </div>
        <p className="dm-note" style={{ marginTop: 10 }}>
          You must keep $1 for every slot you still have to fill — so blowing the bank early leaves you scavenging $1
          leftovers. No clock: every lot is decided by a bid or a pass, never by a timer.
        </p>
      </section>

      {!signedIn && (
        <section className="dm-section">
          <p className="dm-eyebrow">Your name</p>
          <input
            className="dm-input"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="Guest"
            maxLength={24}
            aria-label="Your display name"
            style={{ maxWidth: 280 }}
          />
          <p className="dm-note" style={{ marginTop: 8 }}>
            Playing as a guest.{" "}
            <Link href="/signin" style={{ color: "var(--dm-gold)" }}>
              Sign in
            </Link>{" "}
            to use your Great Souls name and keep your record across devices.
          </p>
        </section>
      )}

      <section className="dm-section">
        <p className="dm-eyebrow">3 · Who are you drafting against?</p>
        <div className="dm-seg" style={{ marginBottom: 12 }}>
          {NPC_PERSONALITIES.map((p) => (
            <button key={p.id} className="dm-seg-item" data-on={npc.id === p.id ? "1" : "0"} onClick={() => setNpc(p)}>
              <span className="dm-seg-label">
                {p.emoji} {p.name}
              </span>
              <span className="dm-seg-note">{p.tagline}</span>
            </button>
          ))}
        </div>

        <div className="dm-row" style={{ marginTop: 16 }}>
          <button className="dm-btn dm-btn-primary dm-btn-lg" onClick={onSolo} disabled={!hasTopic}>
            {hasTopic ? `Start draft vs ${npc.name}` : "Pick a topic to start"}
          </button>
          <button className="dm-btn dm-btn-lg" onClick={onCreate}>
            🎙️ Draft with a friend
          </button>
          <button className="dm-btn dm-btn-ghost dm-btn-lg" onClick={() => setShowJoin((v) => !v)}>
            Join a room
          </button>
        </div>

        {showJoin && (
          <div className="dm-row" style={{ marginTop: 12 }}>
            <input
              className="dm-input"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ROOM CODE"
              maxLength={6}
              aria-label="Room code"
              style={{ maxWidth: 200, letterSpacing: "0.2em", fontWeight: 700 }}
            />
            <button className="dm-btn dm-btn-primary" onClick={onJoin} disabled={joinCode.trim().length < 4}>
              Join
            </button>
          </div>
        )}

        <p className="dm-note" style={{ marginTop: 12 }}>
          Drafting with a friend turns mics on by default — cameras stay off until someone asks for them. Ranked play is
          PvP only; solo games count toward your win/loss.
        </p>
      </section>
    </>
  );
}

// ── Records ──────────────────────────────────────────────────────────────────

function RecordPanel({ record, leaderboard, meId }: { record: PlayerRecord | null; leaderboard: PlayerRecord[]; meId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="dm-panel">
      <div className="dm-row" style={{ justifyContent: "space-between" }}>
        <div className="dm-record">
          {record ? (
            <>
              <span>
                <strong>{record.rating}</strong> rating
              </span>
              <span>
                <strong>
                  {record.pvpWins}–{record.pvpLosses}
                </strong>{" "}
                vs friends
              </span>
              <span>
                <strong>
                  {record.soloWins}–{record.soloLosses}
                </strong>{" "}
                vs the house
              </span>
              {record.streak >= 3 && <span>🔥 {record.streak} in a row</span>}
            </>
          ) : (
            <span className="dm-note">No games on record yet — your first draft starts the ledger.</span>
          )}
        </div>
        {leaderboard.length > 0 && (
          <button className="dm-btn dm-btn-ghost" onClick={() => setOpen((v) => !v)}>
            {open ? "Hide ladder" : "🏆 Ladder"}
          </button>
        )}
      </div>
      {open && (
        <div className="dm-lb">
          {leaderboard.slice(0, 15).map((p, i) => (
            <div key={p.userId} className="dm-lb-row" data-me={p.userId === meId ? "1" : "0"}>
              <span className="dm-lb-rank">{i + 1}</span>
              <span className="dm-lb-name">{p.userId === meId ? `${p.name} (you)` : p.name}</span>
              <span className="dm-lb-rating">{p.rating}</span>
              <span className="dm-lb-wl">
                {p.pvpWins}–{p.pvpLosses}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Room lobby ───────────────────────────────────────────────────────────────

function RoomLobby({
  roomCode,
  isHost,
  members,
  meId,
  media,
  chat,
  onSendChat,
  packs,
  presetId,
  setPresetId,
  customTopic,
  setCustomTopic,
  rulesIdx,
  setRulesIdx,
  error,
  onStart,
}: {
  roomCode: string | null;
  isHost: boolean;
  members: Member[];
  meId: string;
  media: DraftMedia;
  chat: ChatLine[];
  onSendChat: (t: string) => void;
  packs: PackSummary[];
  presetId: string | null;
  setPresetId: (id: string | null) => void;
  customTopic: string;
  setCustomTopic: (s: string) => void;
  rulesIdx: number;
  setRulesIdx: (n: number) => void;
  error: string | null;
  onStart: () => void;
}) {
  const others = members.filter((m) => m.userId !== meId);
  const usingCustom = customTopic.trim().length > 0;
  const hasTopic = usingCustom || Boolean(presetId);
  const chosen = usingCustom ? customTopic.trim() : (packs.find((p) => p.id === presetId)?.name ?? "topic");

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      {error && (
        <div className="dm-error" style={{ marginBottom: 18 }}>
          {error}
        </div>
      )}

      <div className="dm-panel" style={{ marginBottom: 18 }}>
        <p className="dm-eyebrow">Invite your opponent</p>
        {roomCode ? <RoomCode code={roomCode} /> : <p className="dm-note">Opening room…</p>}
      </div>

      <div className="dm-panel" style={{ marginBottom: 18 }}>
        <p className="dm-eyebrow">
          In the room · {members.length} {members.length === 1 ? "person" : "people"}
        </p>
        {others.length === 0 && (
          <p className="dm-note" style={{ marginBottom: 12 }}>
            Just you so far. Your mic is already live — as soon as they join you can talk.
          </p>
        )}
        <MediaRail media={media} members={members} meId={meId} chat={chat} onSendChat={onSendChat} />
      </div>

      {isHost ? (
        <div className="dm-panel">
          <p className="dm-eyebrow">Pick the topic</p>
          <input
            className="dm-input"
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value)}
            placeholder="Type any topic — “Game of Thrones warriors”…"
            maxLength={120}
            aria-label="Custom topic"
            style={{ width: "100%" }}
          />
          <div className="dm-topics" style={{ marginTop: 12 }}>
            {packs.map((p) => (
              <button
                key={p.id}
                className="dm-topic"
                data-on={!usingCustom && presetId === p.id ? "1" : "0"}
                onClick={() => {
                  setCustomTopic("");
                  setPresetId(p.id);
                }}
              >
                <span className="dm-topic-emoji">{p.emoji}</span>
                <span className="dm-topic-name">{p.name}</span>
              </button>
            ))}
          </div>

          <p className="dm-eyebrow" style={{ marginTop: 20 }}>
            Budget
          </p>
          <div className="dm-seg">
            {BUDGET_PRESETS.map((preset, i) => (
              <button key={preset.label} className="dm-seg-item" data-on={rulesIdx === i ? "1" : "0"} onClick={() => setRulesIdx(i)}>
                <span className="dm-seg-label">{preset.label}</span>
                <span className="dm-seg-note">{preset.note}</span>
              </button>
            ))}
          </div>

          <button
            className="dm-btn dm-btn-primary dm-btn-lg dm-btn-block"
            style={{ marginTop: 18 }}
            onClick={onStart}
            disabled={others.length === 0 || !hasTopic}
          >
            {others.length === 0
              ? "Waiting for your opponent…"
              : !hasTopic
                ? "Pick a topic to build the board"
                : `Build the board — ${chosen}`}
          </button>
        </div>
      ) : (
        <div className="dm-panel" style={{ textAlign: "center" }}>
          <p className="dm-eyebrow">You&apos;re in</p>
          <p className="dm-note">The host is picking a topic. Talk it out — your mic is already on.</p>
        </div>
      )}
    </div>
  );
}

// ── Room code + invite link ──────────────────────────────────────────────────

function RoomCode({ code }: { code: string }) {
  const [copied, setCopied] = useState<"link" | "code" | null>(null);

  const link =
    typeof window !== "undefined" ? `${window.location.origin}/draftmasters?room=${code}` : `/draftmasters?room=${code}`;

  const copy = async (text: string, which: "link" | "code") => {
    sfx.click();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* clipboard blocked — the code stays on screen to be read out */
    }
  };

  const share = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "DraftMasters", text: "Draft against me:", url: link });
        return;
      } catch {
        /* dismissed — fall through to copying */
      }
    }
    void copy(link, "link");
  };

  return (
    <div>
      <button
        className="dm-room-code"
        onClick={() => void copy(code, "code")}
        title="Copy the code"
        style={{ width: "100%", cursor: "pointer", fontFamily: "inherit" }}
      >
        {copied === "code" ? "COPIED" : code}
      </button>
      <div className="dm-row" style={{ marginTop: 8 }}>
        <button className="dm-btn dm-btn-primary" style={{ flex: 1 }} onClick={() => void share()}>
          {copied === "link" ? "✓  Link copied" : "🔗  Copy invite link"}
        </button>
      </div>
      <p className="dm-note" style={{ marginTop: 8 }}>
        Send them the link and they drop straight into this room — no code to type.
      </p>
    </div>
  );
}

// ── Prep ─────────────────────────────────────────────────────────────────────

function PrepScreen({ step, topic, isHost, roomCode }: { step: number; topic: string; isHost: boolean; roomCode: string | null }) {
  const steps = [
    { label: "Building the board", done: "Board built" },
    { label: "Finding the portraits", done: "Portraits loaded" },
    { label: "Setting the room", done: "Ready" },
  ];

  if (!isHost) {
    return (
      <div className="dm-prep">
        <h2 className="dm-h2">Waiting for the host…</h2>
        <p className="dm-tagline">They&apos;re building the board.</p>
        {roomCode && (
          <div style={{ marginTop: 20 }}>
            <RoomCode code={roomCode} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="dm-prep">
      <p className="dm-eyebrow">Preparing</p>
      <h2 className="dm-h2" style={{ fontSize: 24 }}>
        {topic}
      </h2>
      <p className="dm-tagline">Nothing starts until the whole board is loaded — no waiting on images mid-auction.</p>

      <div className="dm-prep-steps">
        {steps.map((s, i) => (
          <div key={s.label} className="dm-step" data-state={step > i ? "done" : step === i ? "active" : "todo"}>
            <span className="dm-step-dot">{step > i ? "✓" : ""}</span>
            <span>{step > i ? s.done : s.label}</span>
          </div>
        ))}
      </div>

      <div className="dm-progress">
        <div className="dm-progress-fill" style={{ width: `${((step + 0.35) / 3) * 100}%` }} />
      </div>
    </div>
  );
}

// ── Ready check ──────────────────────────────────────────────────────────────

function ReadyScreen({
  pack,
  rules,
  sides,
  readyIds,
  meId,
  iAmReady,
  mode,
  roomCode,
  onReady,
  media,
  members,
  chat,
  onSendChat,
}: {
  pack: Pack | null;
  rules: Rules;
  sides: Side[];
  readyIds: string[];
  meId: string;
  iAmReady: boolean;
  mode: Mode;
  roomCode: string | null;
  onReady: () => void;
  media: DraftMedia | null;
  members: Member[];
  chat: ChatLine[];
  onSendChat: (t: string) => void;
}) {
  const waitingForOpponent = mode === "pvp" && sides.length < 2;

  return (
    <div className="dm-prep" style={{ maxWidth: 620 }}>
      <p className="dm-eyebrow">{pack?.emoji} Board ready</p>
      <h2 className="dm-wordmark" style={{ fontSize: "clamp(26px, 7vw, 40px)" }}>
        {pack?.name ?? "Draft"}
      </h2>
      <p className="dm-tagline">{pack?.blurb}</p>

      <div className="dm-panel" style={{ marginTop: 18, textAlign: "left", fontSize: 14, lineHeight: 1.6 }}>
        <strong style={{ color: "var(--dm-gold)" }}>The scenario</strong>
        <p style={{ margin: "6px 0 0", color: "var(--dm-dim)" }}>{pack?.scenario}</p>
        <p style={{ margin: "12px 0 0", color: "var(--dm-mute)", fontSize: 13 }}>
          ${rules.budget} each · {rules.rosterSize} picks · {pack?.entries.length ?? 0} on the board · opening rights
          alternate · no clock
        </p>
      </div>

      {waitingForOpponent && roomCode && (
        <>
          <p className="dm-eyebrow" style={{ marginTop: 22 }}>
            Send this code to your opponent
          </p>
          <RoomCode code={roomCode} />
        </>
      )}

      <div className="dm-ready-grid">
        {sides.map((side) => {
          const ready = readyIds.includes(side.id);
          return (
            <div key={side.id} className="dm-ready-card" data-ready={ready ? "1" : "0"}>
              <div style={{ fontSize: 30 }}>{side.isNpc ? "🤖" : side.id === meId ? "🫵" : "🧑"}</div>
              <div style={{ fontWeight: 750, marginTop: 6 }}>{side.id === meId ? "You" : side.name}</div>
              <div className="dm-ready-state" style={{ color: ready ? "var(--dm-green)" : "var(--dm-mute)" }}>
                {ready ? "Ready" : "Not ready"}
              </div>
            </div>
          );
        })}
        {waitingForOpponent && (
          <div className="dm-ready-card">
            <div style={{ fontSize: 30 }}>⏳</div>
            <div style={{ fontWeight: 750, marginTop: 6 }}>Empty seat</div>
            <div className="dm-ready-state" style={{ color: "var(--dm-mute)" }}>
              Waiting
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 20 }}>
        <button className="dm-btn dm-btn-primary dm-btn-lg dm-btn-block" onClick={onReady} disabled={iAmReady || waitingForOpponent}>
          {waitingForOpponent ? "Waiting for an opponent…" : iAmReady ? "Waiting for the other side…" : "I'm ready — start the draft"}
        </button>
      </div>

      {mode === "pvp" && media && (
        <div style={{ marginTop: 18, textAlign: "left" }}>
          <MediaRail media={media} members={members} meId={meId} chat={chat} onSendChat={onSendChat} />
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Stable id for signed-out players so a refresh doesn't lose their seat. */
function useGuestId(sessionId?: string): string {
  const [id, setId] = useState(() => sessionId ?? "guest");

  useEffect(() => {
    if (sessionId) {
      setId(sessionId);
      return;
    }
    try {
      let stored = localStorage.getItem("dm_guest_id");
      if (!stored) {
        stored = `g_${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem("dm_guest_id", stored);
      }
      setId(stored);
    } catch {
      setId(`g_${Math.random().toString(36).slice(2, 10)}`);
    }
  }, [sessionId]);

  return id;
}

/** Unambiguous room codes — no O/0/I/1. */
function makeRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}
