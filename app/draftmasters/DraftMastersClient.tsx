"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BUDGET_PRESETS,
  DEFAULT_RULES,
  NPC_PERSONALITIES,
  buildLot,
  buildPool,
  makeRng,
  maxBid,
  npcDecide,
  npcThinkMs,
  npcValuation,
  randomSeed,
  type NpcPersonality,
  type Rules,
  type Side,
} from "@/lib/draftmasters/engine";
import type { Pack } from "@/lib/draftmasters/packs";
import { initAudio, isMuted, setMuted, sfx } from "@/lib/draftmasters/sfx";
import AuctionStage from "./AuctionStage";
import MediaRail from "./MediaRail";
import VerdictScreen from "./VerdictScreen";
import { useDraftMedia } from "./useDraftMedia";
import { STYLES } from "./styles";
import {
  EMPTY_VIEW,
  type ChatLine,
  type GameView,
  type PackSummary,
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
 */

const SOLD_REVEAL_MS = 3200;
const OPEN_PASS_SECONDS = 8;

const TOPIC_EXAMPLES = [
  "Game of Thrones warriors",
  "One-hit wonders of the 90s",
  "NBA point guards",
  "Studio Ghibli characters",
  "Greek gods",
  "Cursed kitchen appliances",
];

type Screen = "setup" | "prep" | "ready" | "auction" | "verdict";
type Mode = "solo" | "pvp";

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

  // ── Verdict ────────────────────────────────────────────────────────────────
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [judging, setJudging] = useState(false);

  // ── PvP ────────────────────────────────────────────────────────────────────
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [members, setMembers] = useState<
    { userId: string; name: string; avatarUrl: string | null; mic: boolean; cam: boolean }[]
  >([]);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const wsRef = useRef<{ send: (s: string) => void; close: () => void } | null>(null);

  const sendSignal = useCallback(
    (toUserId: string, signalType: string, payload: unknown) => {
      wsRef.current?.send(
        JSON.stringify({ type: "rtc-signal", toUserId, fromUserId: meId, signalType, payload })
      );
    },
    [meId]
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
  const lotTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const npcTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setAudioMuted(isMuted());
  }, []);

  // ── Invite links ───────────────────────────────────────────────────────────
  // /draftmasters?room=ABCDE drops straight into that room. Autoplay policy
  // means we can't open a mic before a gesture, so prefill the code and let
  // them tap Join rather than silently failing to connect.
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
      if (lotTimer.current) clearTimeout(lotTimer.current);
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
      } else {
        const res = await fetch(`/api/draftmasters/topic?packId=${presetId ?? "got"}`);
        const data = await res.json();
        if (!res.ok) throw new Error("Could not load that topic.");
        board = data.pack as Pack;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong building the board.");
      setScreen("setup");
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
    });
  }, []);

  const pushEvent = useCallback((text: string, kind: TickerEvent["kind"]) => {
    const g = gameRef.current;
    g.ticker.push({ id: ++soloRef.current.seq, text, kind });
    if (g.ticker.length > 40) g.ticker.shift();
  }, []);

  const clearTimers = useCallback(() => {
    if (lotTimer.current) clearTimeout(lotTimer.current);
    if (npcTimer.current) clearTimeout(npcTimer.current);
    lotTimer.current = null;
    npcTimer.current = null;
  }, []);

  // Declared as refs so the mutually recursive steps can call each other.
  const nominateRef = useRef<() => void>(() => {});
  const closeLotRef = useRef<() => void>(() => {});
  const passOpeningRef = useRef<() => void>(() => {});
  const scheduleNpcRef = useRef<() => void>(() => {});

  const doBid = useCallback(
    (sideId: string, amount: number) => {
      const g = gameRef.current;
      const S = soloRef.current;
      if (g.phase !== "bidding" || !g.lot) return;

      const side = g.sides.find((s) => s.id === sideId);
      if (!side) return;
      if (g.currentBid === 0 && g.openerId !== sideId) return;
      if (amount <= g.currentBid || amount > maxBid(side, S.rules)) return;
      if (g.highBidderId === sideId) return;

      g.currentBid = amount;
      g.highBidderId = sideId;
      pushEvent(`${sideId === meId ? "You bid" : `${side.name} bids`} $${amount}`, "bid");
      if (sideId === meId) sfx.bid(amount);
      else sfx.outbid(amount);

      g.deadline = Date.now() + S.rules.bidSeconds * 1000;
      clearTimers();
      lotTimer.current = setTimeout(() => closeLotRef.current(), S.rules.bidSeconds * 1000);
      commit();
      scheduleNpcRef.current();
    },
    [clearTimers, commit, meId, pushEvent]
  );

  scheduleNpcRef.current = () => {
    if (npcTimer.current) clearTimeout(npcTimer.current);
    const g = gameRef.current;
    const S = soloRef.current;
    if (g.phase !== "bidding") return;

    const bot = g.sides.find((s) => s.isNpc);
    if (!bot || g.highBidderId === bot.id) return;
    if (g.currentBid === 0 && g.openerId !== bot.id) return;
    if (maxBid(bot, S.rules) < 1) return;

    const think = npcThinkMs(S.npcVal, g.currentBid);
    // Never act after the clock would have expired anyway.
    const room = Math.max(300, g.deadline - Date.now() - 400);
    npcTimer.current = setTimeout(() => {
      const gg = gameRef.current;
      if (gg.phase !== "bidding") return;
      const npcSide = gg.sides.find((s) => s.isNpc);
      if (!npcSide) return;

      if (gg.currentBid === 0) {
        if (gg.openerId !== npcSide.id) return;
        if (S.npcVal >= 1 && maxBid(npcSide, S.rules) >= 1) doBid(npcSide.id, 1);
        else passOpeningRef.current();
      } else {
        const next = npcDecide(S.npcVal, gg.currentBid, gg.highBidderId === npcSide.id, npcSide, S.rules);
        if (next !== null) doBid(npcSide.id, next);
      }
    }, Math.min(think, room));
  };

  closeLotRef.current = () => {
    const g = gameRef.current;
    if (g.phase !== "bidding" || !g.lot) return;
    clearTimers();

    if (g.highBidderId && g.currentBid > 0) {
      const side = g.sides.find((s) => s.id === g.highBidderId);
      if (side) {
        side.budget -= g.currentBid;
        side.roster.push({ ...g.lot, price: g.currentBid });
        pushEvent(
          `SOLD — ${g.lot.name} to ${side.id === meId ? "you" : side.name} for $${g.currentBid}`,
          "sold"
        );
        sfx.sold();
      }
    } else {
      pushEvent(`PASSED — nobody wanted ${g.lot.name}`, "passed");
      sfx.passed();
    }

    g.phase = "sold";
    commit();
    lotTimer.current = setTimeout(() => nominateRef.current(), SOLD_REVEAL_MS);
  };

  passOpeningRef.current = () => {
    const g = gameRef.current;
    const S = soloRef.current;
    if (g.phase !== "bidding" || g.currentBid !== 0) return;

    if (!g.openerPassed) {
      const opener = g.sides.find((s) => s.id === g.openerId);
      const other = g.sides.find((s) => s.id !== g.openerId);
      pushEvent(
        `${opener?.id === meId ? "You pass" : `${opener?.name ?? "Opener"} passes`} — over to ${
          other?.id === meId ? "you" : (other?.name ?? "the other side")
        }`,
        "passed"
      );
      g.openerPassed = true;
      g.openerId = other?.id ?? null;

      const nextOpener = g.sides.find((s) => s.id === g.openerId);
      if (nextOpener && maxBid(nextOpener, S.rules) >= 1) {
        g.deadline = Date.now() + OPEN_PASS_SECONDS * 1000;
        clearTimers();
        lotTimer.current = setTimeout(() => {
          if (gameRef.current.currentBid === 0) passOpeningRef.current();
          else closeLotRef.current();
        }, OPEN_PASS_SECONDS * 1000);
        commit();
        scheduleNpcRef.current();
        return;
      }
    }
    closeLotRef.current();
  };

  nominateRef.current = () => {
    const g = gameRef.current;
    const S = soloRef.current;
    const board = S.pack;
    if (!board) return;
    clearTimers();

    const allFull = g.sides.every((s) => s.roster.length >= S.rules.rosterSize);
    const anyoneCanBid = g.sides.some((s) => maxBid(s, S.rules) >= 1);

    if (allFull || S.cursor >= S.pool.length || !anyoneCanBid) {
      g.phase = "complete";
      g.lot = null;
      pushEvent(
        allFull ? "Rosters full — calculate the winner" : "Board exhausted — calculate the winner",
        "system"
      );
      commit();
      setScreen("verdict");
      return;
    }

    const entryIndex = S.pool[S.cursor++];
    const rng = makeRng(S.seed + entryIndex * 7919 + S.cursor);
    g.lot = buildLot(board.entries[entryIndex], entryIndex, board, rng);
    g.lotsRemaining = Math.max(0, S.pool.length - S.cursor);

    // Opening rights alternate, skipping anyone who can't afford to open.
    const first = g.sides[S.lotIndex % g.sides.length];
    const second = g.sides.find((s) => s.id !== first.id);
    g.openerId =
      maxBid(first, S.rules) >= 1
        ? first.id
        : second && maxBid(second, S.rules) >= 1
          ? second.id
          : null;
    g.openerPassed = g.openerId !== first.id;
    S.lotIndex++;

    g.currentBid = 0;
    g.highBidderId = null;
    g.phase = "bidding";

    const bot = g.sides.find((s) => s.isNpc);
    S.npcVal = bot
      ? npcValuation(g.lot, bot, S.rules, S.npc, g.lotsRemaining, Math.random)
      : 0;

    const contested = g.sides.filter((s) => maxBid(s, S.rules) >= 1).length > 1;
    const secs = contested ? S.rules.openSeconds : 4;
    g.deadline = Date.now() + secs * 1000;

    sfx.lotIn();
    commit();
    lotTimer.current = setTimeout(() => {
      if (gameRef.current.currentBid === 0) passOpeningRef.current();
      else closeLotRef.current();
    }, secs * 1000);
    scheduleNpcRef.current();
  };

  // ── Starting a game ────────────────────────────────────────────────────────

  const startSolo = useCallback(async () => {
    initAudio();
    setMode("solo");
    setScreen("prep");
    setVerdict(null);

    const board = await buildBoard();
    if (!board) return;

    const preset = BUDGET_PRESETS[rulesIdx];
    const nextRules: Rules = {
      ...DEFAULT_RULES,
      budget: preset.budget,
      rosterSize: preset.rosterSize,
    };
    setRules(nextRules);

    const seed = randomSeed();
    const sides: Side[] = [
      { id: meId, name: myName, avatarUrl: myAvatar, budget: nextRules.budget, roster: [], isNpc: false },
      {
        id: "npc",
        name: `${npc.emoji} ${npc.name}`,
        avatarUrl: null,
        budget: nextRules.budget,
        roster: [],
        isNpc: true,
      },
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
      // The NPC is always ready — it's a computer.
      readyIds: ["npc"],
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
      wsRef.current?.send(JSON.stringify({ type: "ready", ready: true }));
      return;
    }
    const g = gameRef.current;
    if (!g.readyIds.includes(meId)) g.readyIds.push(meId);
    commit();
    setScreen("auction");
    setTimeout(() => nominateRef.current(), 500);
  }, [commit, meId, mode]);

  // ── PvP ────────────────────────────────────────────────────────────────────

  const connectRoom = useCallback(
    async (code: string, asHost: boolean) => {
      initAudio();
      setMode("pvp");
      setRoomCode(code);
      setError(null);

      const { default: PartySocket } = await import("partysocket");
      const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999";
      const ws = new PartySocket({ host, room: code, party: "draftmasters" });
      wsRef.current = ws as unknown as { send: (s: string) => void; close: () => void };

      ws.addEventListener("open", () => {
        ws.send(
          JSON.stringify({
            type: "join",
            userId: meId,
            name: myName,
            avatarUrl: myAvatar,
            mic: true,
          })
        );
      });

      ws.addEventListener("message", (ev: MessageEvent) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(ev.data as string);
        } catch {
          return;
        }
        // Via ref so the socket always reaches the current handler, not the
        // one that happened to exist when the room was opened.
        void serverMessageRef.current(msg);
      });

      // Mics on by default — arguing about the picks is the game.
      void mediaRef.current.start({ mic: true, cam: false });

      if (asHost) {
        ws.send(JSON.stringify({ type: "preparing" }));
        setScreen("prep");
        const board = await buildBoard();
        if (!board) return;
        const preset = BUDGET_PRESETS[rulesIdx];
        ws.send(
          JSON.stringify({
            type: "board",
            pack: board,
            budget: preset.budget,
            rosterSize: preset.rosterSize,
          })
        );
      } else {
        setScreen("prep");
      }
    },
    [buildBoard, meId, myAvatar, myName, rulesIdx]
  );

  const prevPhase = useRef<string>("");
  const prevBid = useRef(0);
  const knownPackId = useRef<string | null>(null);

  const handleServerMessage = useCallback(
    async (msg: Record<string, unknown>) => {
      if (msg.type === "chat") {
        setChat((prev) =>
          [...prev, { userId: String(msg.userId), name: String(msg.name), text: String(msg.text), at: Number(msg.at) }].slice(-60)
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
      const serverRules = s.rules as Rules;
      const phase = String(s.phase);

      setHostId((s.hostId as string) ?? null);
      setRules(serverRules);
      setMembers(
        (s.members as { userId: string; name: string; avatarUrl: string | null; mic: boolean; cam: boolean }[]) ?? []
      );
      setVerdict((s.verdict as Verdict | null) ?? null);

      // New board arrived — pull its portraits before the first lot drops.
      if (serverPack && serverPack.id !== knownPackId.current) {
        knownPackId.current = serverPack.id;
        setPack(serverPack);
        await prefetchPortraits(serverPack);
        sfx.boardReady();
      }

      // Mesh up with everyone already in the room.
      const memberList = (s.members as { userId: string }[]) ?? [];
      memberList.forEach((m) => {
        if (m.userId !== meId) void mediaRef.current.connectTo(m.userId);
      });

      const nextView: GameView = {
        phase: phase === "lobby" || phase === "preparing" ? "ready" : (phase as GameView["phase"]),
        lot: (s.lot as GameView["lot"]) ?? null,
        currentBid: Number(s.currentBid) || 0,
        highBidderId: (s.highBidderId as string) ?? null,
        openerId: (s.openerId as string) ?? null,
        openerPassed: Boolean(s.openerPassed),
        // Server clock is authoritative; correct for drift against our own.
        deadline: Number(s.deadline) + (Date.now() - Number(s.serverNow)),
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
      if (phase === "bidding" && nextView.currentBid > prevBid.current) {
        if (nextView.highBidderId !== meId) sfx.outbid(nextView.currentBid);
      }
      prevBid.current = phase === "bidding" ? nextView.currentBid : 0;
      prevPhase.current = phase;

      if (phase === "ready") setScreen("ready");
      else if (phase === "bidding" || phase === "sold") setScreen("auction");
      else if (phase === "complete") setScreen("verdict");
      else setScreen("prep");
    },
    [meId, prefetchPortraits]
  );

  const serverMessageRef = useRef(handleServerMessage);
  serverMessageRef.current = handleServerMessage;

  // ── Player actions ─────────────────────────────────────────────────────────

  const handleBid = useCallback(
    (amount: number) => {
      initAudio();
      if (mode === "pvp") {
        sfx.bid(amount);
        wsRef.current?.send(JSON.stringify({ type: "bid", amount }));
      } else {
        doBid(meId, amount);
      }
    },
    [doBid, meId, mode]
  );

  const handlePass = useCallback(() => {
    initAudio();
    sfx.click();
    if (mode === "pvp") wsRef.current?.send(JSON.stringify({ type: "pass" }));
    else passOpeningRef.current();
  }, [mode]);

  const handleJudge = useCallback(async () => {
    setJudging(true);
    setError(null);
    try {
      const res = await fetch("/api/draftmasters/judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packId: pack?.id,
          pack: pack
            ? { name: pack.name, scenario: pack.scenario, criteria: pack.criteria }
            : undefined,
          sides: view.sides,
        }),
      });
      const data = (await res.json()) as Verdict;
      if (!res.ok) throw new Error("The judge is out to lunch. Try again.");
      setVerdict(data);
      sfx.verdict();
      if (mode === "pvp") wsRef.current?.send(JSON.stringify({ type: "verdict", verdict: data }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach the judge.");
    } finally {
      setJudging(false);
    }
  }, [mode, pack, view.sides]);

  const playAgain = useCallback(() => {
    sfx.click();
    clearTimers();
    setVerdict(null);
    setError(null);
    setPortraits({});
    setPack(null);
    setCustomTopic("");
    knownPackId.current = null;
    prevPhase.current = "";
    prevBid.current = 0;
    if (mode === "pvp") {
      wsRef.current?.send(JSON.stringify({ type: "rematch" }));
    }
    gameRef.current = { ...EMPTY_VIEW };
    setView(EMPTY_VIEW);
    setScreen("setup");
  }, [clearTimers, mode]);

  const sendChat = useCallback((text: string) => {
    wsRef.current?.send(JSON.stringify({ type: "chat", text }));
  }, []);

  const toggleAudio = useCallback(() => {
    initAudio();
    const next = !audioMuted;
    setMuted(next);
    setAudioMuted(next);
    if (!next) sfx.click();
  }, [audioMuted]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const isHost = mode === "solo" || hostId === meId;
  const topicLabel = customTopic.trim() || packs.find((p) => p.id === presetId)?.name || "a topic";
  const iAmReady = view.readyIds.includes(meId);
  const seatedSides = view.sides;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="dm">
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
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
            onSolo={startSolo}
            onCreate={() => void connectRoom(makeRoomCode(), true)}
            onJoin={() => void connectRoom(joinCode.trim().toUpperCase(), false)}
          />
        )}

        {screen === "prep" && (
          <PrepScreen step={prepStep} topic={topicLabel} isHost={isHost} roomCode={roomCode} />
        )}

        {screen === "ready" && (
          <ReadyScreen
            pack={pack}
            rules={rules}
            sides={seatedSides}
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
            />
            {mode === "pvp" && (
              <div style={{ maxWidth: 380, marginLeft: "auto" }}>
                <MediaRail
                  media={media}
                  members={members}
                  meId={meId}
                  chat={chat}
                  onSendChat={sendChat}
                />
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
            canJudge={isHost}
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
  onSolo: () => void;
  onCreate: () => void;
  onJoin: () => void;
}) {
  // Arriving on an invite link prefills the code, so open the join panel
  // rather than hiding the one thing they came here to do.
  const [showJoin, setShowJoin] = useState(Boolean(joinCode));
  const usingCustom = customTopic.trim().length > 0;

  return (
    <>
      {error && (
        <div className="dm-error" style={{ marginBottom: 20 }}>
          {error}
        </div>
      )}

      {joinCode && (
        <div
          className="dm-panel"
          style={{ marginBottom: 22, borderColor: "var(--dm-gold)", textAlign: "center" }}
        >
          <p className="dm-eyebrow" style={{ marginBottom: 6 }}>
            You&apos;ve been invited
          </p>
          <p style={{ margin: "0 0 12px", fontSize: 15, color: "var(--dm-dim)" }}>
            Room <strong style={{ color: "var(--dm-gold)", letterSpacing: ".12em" }}>{joinCode}</strong> is
            waiting for you.
          </p>
          <button className="dm-btn dm-btn-primary dm-btn-lg" onClick={onJoin}>
            Join room {joinCode}
          </button>
        </div>
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
          The board is built to match your wording — <em>warriors</em> gets you fighters, not
          schemers.
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
            <button
              key={preset.label}
              className="dm-seg-item"
              data-on={rulesIdx === i ? "1" : "0"}
              onClick={() => setRulesIdx(i)}
            >
              <span className="dm-seg-label">{preset.label}</span>
              <span className="dm-seg-note">{preset.note}</span>
            </button>
          ))}
        </div>
        <p className="dm-note" style={{ marginTop: 10 }}>
          You must keep $1 for every slot you still have to fill — so blowing the bank early leaves
          you scavenging $1 leftovers.
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
            to use your Great Souls name and avatar.
          </p>
        </section>
      )}

      <section className="dm-section">
        <p className="dm-eyebrow">3 · Who are you drafting against?</p>
        <div className="dm-seg" style={{ marginBottom: 12 }}>
          {NPC_PERSONALITIES.map((p) => (
            <button
              key={p.id}
              className="dm-seg-item"
              data-on={npc.id === p.id ? "1" : "0"}
              onClick={() => setNpc(p)}
            >
              <span className="dm-seg-label">
                {p.emoji} {p.name}
              </span>
              <span className="dm-seg-note">{p.tagline}</span>
            </button>
          ))}
        </div>

        <div className="dm-row" style={{ marginTop: 16 }}>
          <button className="dm-btn dm-btn-primary dm-btn-lg" onClick={onSolo}>
            Start draft vs {npc.name}
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
          Drafting with a friend turns mics on by default — cameras stay off until someone asks for
          them.
        </p>
      </section>
    </>
  );
}

// ── Prep ─────────────────────────────────────────────────────────────────────

function PrepScreen({
  step,
  topic,
  isHost,
  roomCode,
}: {
  step: number;
  topic: string;
  isHost: boolean;
  roomCode: string | null;
}) {
  const steps = [
    { label: "Building the board", done: "Board built" },
    { label: "Finding the portraits", done: "Portraits loaded" },
    { label: "Setting the room", done: "Ready" },
  ];

  if (!isHost) {
    return (
      <div className="dm-prep">
        <h2 className="dm-h2">Waiting for the host…</h2>
        <p className="dm-tagline">They&apos;re picking a topic and building the board.</p>
        {roomCode && <div style={{ marginTop: 20 }}><RoomCode code={roomCode} /></div>}
      </div>
    );
  }

  return (
    <div className="dm-prep">
      <p className="dm-eyebrow">Preparing</p>
      <h2 className="dm-h2" style={{ fontSize: 24 }}>
        {topic}
      </h2>
      <p className="dm-tagline">
        Nothing starts until the whole board is loaded — no waiting on images mid-auction.
      </p>

      <div className="dm-prep-steps">
        {steps.map((s, i) => (
          <div
            key={s.label}
            className="dm-step"
            data-state={step > i ? "done" : step === i ? "active" : "todo"}
          >
            <span className="dm-step-dot">{step > i ? "✓" : ""}</span>
            <span>{step > i ? s.done : s.label}</span>
          </div>
        ))}
      </div>

      <div className="dm-progress">
        <div className="dm-progress-fill" style={{ width: `${((step + 0.35) / 3) * 100}%` }} />
      </div>

      {roomCode && (
        <>
          <p className="dm-eyebrow" style={{ marginTop: 26 }}>
            Room code
          </p>
          <RoomCode code={roomCode} />
        </>
      )}
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
  media: ReturnType<typeof useDraftMedia> | null;
  members: { userId: string; name: string; avatarUrl: string | null; mic: boolean; cam: boolean }[];
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

      <div
        className="dm-panel"
        style={{ marginTop: 18, textAlign: "left", fontSize: 14, lineHeight: 1.6 }}
      >
        <strong style={{ color: "var(--dm-gold)" }}>The scenario</strong>
        <p style={{ margin: "6px 0 0", color: "var(--dm-dim)" }}>{pack?.scenario}</p>
        <p style={{ margin: "12px 0 0", color: "var(--dm-mute)", fontSize: 13 }}>
          ${rules.budget} each · {rules.rosterSize} picks · {pack?.entries.length ?? 0} on the board ·
          opening rights alternate
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
              <div style={{ fontSize: 30 }}>
                {side.isNpc ? "🤖" : side.id === meId ? "🫵" : "🧑"}
              </div>
              <div style={{ fontWeight: 750, marginTop: 6 }}>
                {side.id === meId ? "You" : side.name}
              </div>
              <div
                className="dm-ready-state"
                style={{ color: ready ? "var(--dm-green)" : "var(--dm-mute)" }}
              >
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
        <button
          className="dm-btn dm-btn-primary dm-btn-lg dm-btn-block"
          onClick={onReady}
          disabled={iAmReady || waitingForOpponent}
        >
          {waitingForOpponent
            ? "Waiting for an opponent…"
            : iAmReady
              ? "Waiting for the other side…"
              : "I'm ready — start the draft"}
        </button>
      </div>

      {mode === "pvp" && media && (
        <div style={{ marginTop: 18, textAlign: "left" }}>
          <MediaRail
            media={media}
            members={members}
            meId={meId}
            chat={chat}
            onSendChat={onSendChat}
          />
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Room code plus the two ways people actually share one: a link you can paste
 * into any chat, and the code itself for reading out loud over voice.
 * Uses the native share sheet on phones and falls back to the clipboard.
 */
function RoomCode({ code }: { code: string }) {
  const [copied, setCopied] = useState<"link" | "code" | null>(null);

  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/draftmasters?room=${code}`
      : `/draftmasters?room=${code}`;

  const copy = async (text: string, which: "link" | "code") => {
    sfx.click();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      // Clipboard is blocked on insecure origins — the code stays on screen
      // to be read out, so this isn't worth surfacing as an error.
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
