"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PLAYER_HP, cardFor, resolveBattle, type Adjustment, type BattleResult } from "@/lib/draftmasters/battle";
import type { RosterPick } from "@/lib/draftmasters/engine";
import { terrainFor } from "@/lib/draftmasters/terrain";
import { readVerdict } from "@/lib/draftmasters/verdict";
import { narrate } from "@/lib/draftmasters/flavour";
import { scriptFromFight } from "@/lib/draftmasters/script";
import BottomTabs from "./BottomTabs";
import Motes from "./Motes";
import UniversePicker from "./UniversePicker";
import LineupScreen, { type LineupResult } from "./LineupScreen";
import Scene, { SceneDefs } from "./Scene";
import Crest from "./Crest";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { normaliseRoomCode } from "@/lib/draftmasters/invite";
import {
  BUDGET_PRESETS,
  DEFAULT_RULES,
  NPC_PERSONALITIES,
  applyArena,
  buildLot,
  newVariantBudget,
  withUberCard,
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
  openingBid,
  otherSide,
  priceLabel,
  randomSeed,
  rollDie,
  type NpcPersonality,
  type Rules,
  type Side,
} from "@/lib/draftmasters/engine";
import type { Pack } from "@/lib/draftmasters/packs";
import { ARGUMENT_MAX, type ArgumentRuling } from "@/lib/draftmasters/arguments";
import ArgumentScreen from "./ArgumentScreen";
import { initAudio, isMuted, setMuted, sfx } from "@/lib/draftmasters/sfx";
import AuctionStage from "./AuctionStage";
import BattleStory, { type ToldBattle } from "./BattleStory";
import Icon from "./Icon";
import PersonAvatar from "../components/PersonAvatar";
import { InviteSheet, RoomDock, RoomVoice } from "./RoomVoice";
import { useSocial } from "./social-context";
import { PeerAudio } from "./VoiceKit";
import Wordmark from "./Wordmark";
import VerdictScreen from "./VerdictScreen";
import { rememberedMicGrant, useDraftMedia, type DraftMedia } from "./useDraftMedia";
import { STYLES } from "./styles";
import { BATTLE_STYLES } from "./battle-styles";
import {
  EMPTY_VIEW,
  type BattleScript,
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
/** Room to describe a board properly — qualifiers, exclusions, the lot. Mirrors the API cap. */
const TOPIC_MAX_CHARS = 600;

/* `lineup` sits between the last lot and the verdict: the draft decides who
   you have, the line-up decides what they do with it. */
type Screen = "setup" | "room" | "prep" | "ready" | "auction" | "arguments" | "lineup" | "verdict";
type Mode = "solo" | "pvp";
type Action = { kind: "bid"; amount: number } | { kind: "pass" } | { kind: "match" };

interface PrepState {
phase: "board" | "portraits" | "room";
/** Portraits resolved so far. Only meaningful in the portraits phase. */
done: number;
total: number;
}

interface Member {
  userId: string;
  name: string;
  avatarUrl: string | null;
  mic: boolean;
  cam: boolean;
}

interface Props {
  /**
   * True when this request arrived on DraftMasters' own domain rather than
   * through Great Souls. Only the wording changes — there is one deployment,
   * one database and one set of accounts behind both.
   */
  standalone?: boolean;
  sessionUser: { id: string; name: string; avatarUrl: string | null } | null;
  packs: PackSummary[];
  /** A room code from an invite link (?room=), already validated on the server. */
  initialRoom?: string | null;
}

/**
 * Read a JSON response that might not be JSON.
 *
 * When a serverless function is killed mid-flight — a board that took too long
 * to build, a cold start that timed out — the reply is not this app's JSON
 * error but the gateway's own HTML page. `res.json()` on that throws
 * `Unexpected token '<', "<HTML> <HE"...`, which is what the player saw
 * instead of being told the board timed out. Read the text, try to parse it,
 * and fall back to a sentence that says something true.
 */
async function readJson(res: Response, whenUnreadable: string): Promise<{ error?: string; pack?: unknown }> {
  const raw = await res.text();
  try {
    return JSON.parse(raw) as { error?: string; pack?: unknown };
  } catch {
    console.error("[draftmasters] non-JSON response", res.status, raw.slice(0, 200));
    throw new Error(res.ok ? whenUnreadable : `${whenUnreadable} (${res.status})`);
  }
}

/**
 * Put a card-sized image in R2 and hand back its public URL.
 *
 * Tries the Netlify function first because that is the only write path that
 * survives a Turbopack build (see the note at the call site), and falls back
 * to the Next route so a plain `next dev` still works locally.
 */
async function storePortraitImage(name: string, dataUrl: string): Promise<string> {
  const read = async (res: Response) => {
    const raw = await res.text();
    try {
      return JSON.parse(raw) as { url?: string; error?: string };
    } catch {
      // A function that died on load answers in plain text; parsing it blind
      // turned every server error into "Unexpected token 'I'".
      console.error("[portrait upload] non-JSON response", res.status, raw.slice(0, 200));
      return null;
    }
  };

  const fn = await fetch("/.netlify/functions/portrait-store", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, dataUrl }),
  }).catch(() => null);
  const stored = fn ? await read(fn) : null;
  if (stored?.url) return stored.url;

  const api = await fetch("/api/draftmasters/portrait/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, dataUrl }),
  }).catch(() => null);
  const viaApi = api ? await read(api) : null;
  if (viaApi?.url) return viaApi.url;

  throw new Error(
    stored?.error ?? viaApi?.error ?? "The photo service is down right now — try again shortly."
  );
}

export default function DraftMastersClient({ sessionUser, packs, standalone = false, initialRoom = null }: Props) {
  // ── Identity ───────────────────────────────────────────────────────────────
  const [guestName, setGuestName] = useState("");
  const meId = useGuestId(sessionUser?.id);
  const myName = sessionUser?.name ?? (guestName.trim() || "Guest");
  const myAvatar = sessionUser?.avatarUrl ?? null;

  // ── Screen + config ────────────────────────────────────────────────────────
  const [screen, setScreen] = useState<Screen>("setup");
  /** Set on the line-up screen and handed to the judge with the roster. */
  const [lineup, setLineup] = useState<LineupResult | null>(null);
  const [mode, setMode] = useState<Mode>("solo");
  /**
   * Deliberately null.
   *
   * This used to default to "got", which meant the page opened with a choice
   * already made on the player's behalf — a gold ring on a pack nobody had
   * picked — and it made everything downstream unconditional, because there
   * was never a moment when no universe was selected. Starting empty is what
   * lets the settings stay out of the way until there is something to set
   * them for.
   */
  const [presetId, setPresetId] = useState<string | null>(null);
  const [customTopic, setCustomTopic] = useState("");
  /**
   * Universes chosen for this game.
   *
   * One is that board. Two or more is a crossover dealt from all of them —
   * which is what people were reaching for when they typed "Marvel vs DC"
   * into the custom box and waited twenty seconds for a model to invent a
   * worse version of a board we already had.
   */
  const [mixIds, setMixIds] = useState<string[]>([]);
  /**
   * Whether a model rewrites the battle's prose.
   *
   * Off by default. The fight is decided and scored in code either way —
   * this only chooses who writes it up, and the built-in narrator costs
   * nothing, never times out and works on a plane.
   */
  const [rulesIdx, setRulesIdx] = useState(0);
  /**
   * The variant dials, 0-10 each. Frequency is how many entries get a
   * condition rolled on them at all; wildness is how far the conditions are
   * allowed to reach — 10 still produces plenty of straight canonical states,
   * it just also produces "Azor Ahai reborn". Custom boards only.
   */
  const [variantRate, setVariantRate] = useState(5);
  const [variantWild, setVariantWild] = useState(5);
  /**
   * Pre-battle arguments. When on, the draft finishing opens one sealed box
   * per player instead of going straight to the verdict — see ArgumentScreen.
   *
   * OFF, and not offered. The round works, but it puts a writing exercise
   * between the last bid and the result, which is the moment the game is
   * actually about. Everything that serves it — the screen, the room protocol,
   * the claim checker, the judge's briefing — is left intact and still runs
   * whenever a board arrives with argumentsOn set, so turning it back on is
   * this one line and the setup toggle that used to set it.
   */
  const [argumentsOn] = useState(false);
  const argumentsOnRef = useRef(argumentsOn);
  argumentsOnRef.current = argumentsOn;
  const [rulings, setRulings] = useState<ArgumentRuling[]>([]);
  const [arguing, setArguing] = useState(false);
  const [argSubmitted, setArgSubmitted] = useState<string[]>([]);
  const rulingsRef = useRef<ArgumentRuling[]>([]);
  const [npc, setNpc] = useState<NpcPersonality>(NPC_PERSONALITIES[0]);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [audioMuted, setAudioMuted] = useState(false);

  // ── Board + game ───────────────────────────────────────────────────────────
  const [pack, setPack] = useState<Pack | null>(null);
  /** Read from the socket handler, which can't close over current state. */
  const packRef = useRef<Pack | null>(null);
  packRef.current = pack;
  const [rules, setRules] = useState<Rules>(DEFAULT_RULES);
  const [portraits, setPortraits] = useState<PortraitMap>({});
  /** imgQuery -> which lookup produced it; reported with 👍/👎 */
  const [portraitSources, setPortraitSources] = useState<Record<string, string>>({});
  const [portraitNote, setPortraitNote] = useState<string | null>(null);
  const [view, setView] = useState<GameView>(EMPTY_VIEW);
  /**
   * The room's own view, readable outside a render.
   *
   * A friend game keeps its rosters here; only a solo game fills gameRef. The
   * battle path read gameRef either way, found nothing in PvP, and returned
   * without a word -- which is what "BATTLE! does nothing" was.
   */
  const viewRef = useRef<GameView>(EMPTY_VIEW);
  viewRef.current = view;
  /**
   * What the prep screen is actually doing, not which of three boxes is lit.
   *
   * The old version was a single step index and the bar was drawn as
   * `(step + 0.35) / 3` — so it sat at 12%, jumped to 45%, sat again, jumped
   * to 78% and finished. Every one of those pauses was the longest part of the
   * job, which is why it read as stuck and then suddenly done.
   *
   * `done`/`total` are real counts during the portrait phase, which is the
   * part with knowable progress. The board phase has none to report — one
   * model call that either lands or does not — so it is shown as motion
   * rather than as a number that would be invented.
   */
  const [prep, setPrep] = useState<PrepState>({ phase: "board", done: 0, total: 0 });

  // ── Verdict + records ──────────────────────────────────────────────────────
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  /**
   * The battle as it was written, kept until the next draft.
   *
   * "Rewatch the battle" has to mean the SAME battle -- a second call would
   * write a different fight with different deaths, which makes the verdict
   * sitting underneath it a lie. So the story is cached and replayed.
   */
  const [toldBattle, setToldBattle] = useState<ToldBattle | null>(null);
  /** The script this client put up, so the told can be sent along with it. */
  const battleRef = useRef<BattleScript | null>(null);
  /** Both sides' cases, once the room has sealed them. Driver only. */
  const [pvpArgs, setPvpArgs] = useState<Record<string, string> | null>(null);
  /** One case each, sealed once -- the room refuses a rewrite anyway. */
  const argSealed = useRef(false);
  /**
   * The case this player makes before the fight, in their own words.
   *
   * Handed straight to whoever writes the battle -- there is no separate
   * ruling call and no panel. The brief judges it there, alongside everything
   * else it already knows about the rosters, which is the only place a case
   * can actually change what happens.
   */
  const [argument, setArgument] = useState("");
  const [battle, setBattle] = useState<BattleScript | null>(null);
  const [battleLoading, setBattleLoading] = useState(false);
  /**
   * The room is holding the reveal because the driver is off staging a fight.
   * Mirrors the server flag so the player who didn't press Battle doesn't get
   * the winner spoiled while the other one waits on the script.
   */
  const [peerStaging, setPeerStaging] = useState(false);
  /** Whether that hold is the judge deliberating or the show being staged */
  const [peerStagingKind, setPeerStagingKind] = useState<"judging" | "staging">("staging");
  /** Cleared when the cinematic is dismissed, so the verdict shows underneath */
  const [watchedBattle, setWatchedBattle] = useState(false);
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
  /** The room an invite link or a rejoin is checking before walking in. */
  const [joining, setJoining] = useState<string | null>(null);
  /** Why a room could not be joined — said on the shelf, instead of a blank screen. */
  const [roomNotice, setRoomNotice] = useState<{ code: string; kind: "gone" | "started" } | null>(null);
  /** The room this player was last in, for Back to your game. */
  const [remembered, setRemembered] = useState<StoredRoom | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  /** "Leave the game?" — and what to do once they say yes. */
  const [leaveAsk, setLeaveAsk] = useState<{ then: () => void } | null>(null);
  const matchIdRef = useRef<string>("");
  const router = useRouter();
  const social = useSocial();
  const { rememberRoom, setInGame, setJoinHandler } = social;
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
    /** Entry index on the block, so a passed lot can come back around */
    lotEntryIndex: -1,
    /** Lots nobody took — dealt again if the pool runs dry with chairs empty */
    unsold: [] as number[],
    seed: 0,
    seq: 0,
    npcVal: 0,
    pack: null as Pack | null,
    rules: DEFAULT_RULES,
    npc: NPC_PERSONALITIES[0],
    /** This draft's allowance of the rarest variant grades — spent as lots roll */
    variants: newVariantBudget(),
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

  useEffect(() => {
    return () => {
      if (npcTimer.current) clearTimeout(npcTimer.current);
      wsRef.current?.close();
    };
  }, []);

// ── Board building ─────────────────────────────────────────────────────────

  /**
   * Resolve the board's portraits before the draft starts.
   *
   * Two things this has to get right, both learned the hard way:
   *
   * BATCHING. The resolver answers at most BATCH queries per request and
   * silently drops the rest, so a board of 90 came back with 40 photos and 50
   * letters — which reads as "portraits are broken" rather than "the request
   * was capped".
   *
   * NOT BLOCKING ON ALL OF IT. The Pokémon board is 649 entries and a draft
   * only ever deals a couple of dozen of them. Waiting for all sixteen batches
   * before the first bid would put minutes on the prep screen to fetch photos
   * for Pokémon nobody is going to see. So the entries most likely to be dealt
   * — the pool is drawn by prominence — are fetched first and awaited, and the
   * long tail keeps loading behind the auction. Anything the draft reaches
   * before its batch lands is picked up by the per-lot fetch below.
   */
  const prefetchPortraits = useCallback(async (board: Pack) => {
    /**
     * Smaller batches than the resolver's 40-query cap, deliberately.
     *
     * Two reasons, and neither is the cap. A batch is the unit the progress
     * bar can move by, so 40 meant a 26-entry board finished in ONE step —
     * nothing, then done — which is how a bar ends up looking stuck. And a
     * batch is also the unit of parallelism: twelve queries come back sooner
     * than forty, so the first cards are on screen while the rest are still
     * in flight.
     */
    const BATCH = 12;
    /** Enough to cover any draft: the biggest roster is 8 a side. */
    const UP_FRONT = 10 * BATCH;
    /** Requests in flight at once. Above this the resolver just queues. */
    const LANES = 4;

    const queries = board.entries
      .map((e) => ({
        q: `${e.s ? `${e.n} ${e.s}` : e.n} ${board.imgContext}`.trim(),
        name: e.n,
        // Crossover boards tag each entry with its own wiki.
        wiki: e.wiki ?? board.wiki,
        f: e.f ?? 3,
      }))
      // Prominence order, because that is the order the pool favours too.
      .sort((a, b) => b.f - a.f);

    setPortraits({});
    setPortraitSources({});

    const blocking = Math.min(UP_FRONT, queries.length);
    setPrep({ phase: "portraits", done: 0, total: blocking });
    let done = 0;

    const fetchBatch = async (slice: typeof queries) => {
      try {
        const res = await fetch("/api/draftmasters/portrait", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ queries: slice, wiki: board.wiki }),
        });
        const data = await res.json();
        const map: PortraitMap = {};
        const sources: Record<string, string> = {};
        slice.forEach((q, k) => {
          map[q.q] = data?.portraits?.[k]?.url ?? null;
          sources[q.q] = data?.portraits?.[k]?.source ?? "none";
        });
        setPortraits((prev) => ({ ...prev, ...map }));
        setPortraitSources((prev) => ({ ...prev, ...sources }));
      } catch {
        /* lettered cards are a fine fallback for this batch */
      }
    };

    /**
     * Run the batches LANES at a time instead of one after another.
     *
     * They are independent requests against a stateless resolver, so waiting
     * for each before starting the next was pure latency — a 120-portrait
     * opening took ten round trips end to end when it could take three.
     * Progress is reported as each lane finishes a batch, which is what makes
     * the bar move in small real steps rather than one jump.
     */
    const run = async (from: number, to: number, report: boolean) => {
      const batches: (typeof queries)[] = [];
      for (let i = from; i < to; i += BATCH) batches.push(queries.slice(i, i + BATCH));
      let next = 0;
      await Promise.all(
        Array.from({ length: Math.min(LANES, batches.length) }, async () => {
          while (next < batches.length) {
            const slice = batches[next++];
            await fetchBatch(slice);
            if (report) {
              done += slice.length;
              setPrep({ phase: "portraits", done: Math.min(done, blocking), total: blocking });
            }
          }
        })
      );
    };

    await run(0, blocking, true);
    // The long tail keeps loading behind the auction; it must not hold the
    // prep screen or report progress against a bar that has already finished.
    if (queries.length > blocking) void run(blocking, queries.length, false);
  }, []);

  /**
   * Update a portrait locally and tell the room, so a photo one player finds
   * or uploads appears on the other player's card immediately.
   */
  const applyPortrait = useCallback(
    (imgQuery: string, url: string | null, source: string, broadcast = true) => {
      setPortraits((p) => ({ ...p, [imgQuery]: url }));
      setPortraitSources((p) => ({ ...p, [imgQuery]: source }));
      if (broadcast && mode === "pvp") send({ type: "portrait", imgQuery, url, source });
    },
    [mode, send]
  );

  /**
   * 👍 keeps this photo for the character from now on; 👎 blocks it (with its
   * source recorded, so we learn which lookups fail) and swaps in the next
   * candidate right away.
   */
  const handlePortraitFeedback = useCallback(
    async (verdict: "good" | "bad") => {
      const lot = view.lot;
      if (!lot) return;
      const url = portraits[lot.imgQuery];

      // A lettered card means every lookup came back empty — that's exactly
      // when you want another search, not a refusal. Go straight to a fresh
      // lookup with nothing to down-vote.
      const searchOnly = !url;
      if (verdict === "good" && searchOnly) {
        setPortraitNote("No photo yet — tap the card to upload one.");
        return;
      }

      initAudio();
      sfx.click();
      setPortraitNote(
        verdict === "good" ? "Saved — this photo is theirs from now on." : searchOnly ? "Searching…" : "Finding another…"
      );
      try {
        if (!searchOnly) {
          await fetch("/api/draftmasters/portrait/feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imgQuery: lot.imgQuery,
              name: lot.name,
              url,
              source: portraitSources[lot.imgQuery] ?? "unknown",
              verdict,
              userId: meId,
            }),
          });
        }
        if (verdict === "bad") {
          const entry = pack?.entries.find((e) => e.n === lot.name);
          const wiki = entry?.wiki ?? pack?.wiki ?? "";
          const res = await fetch(
            `/api/draftmasters/portrait?q=${encodeURIComponent(lot.imgQuery)}&name=${encodeURIComponent(lot.name)}` +
              `&wiki=${encodeURIComponent(wiki)}&fresh=1&t=${Date.now()}`,
            { cache: "no-store" }
          );
          const data = await res.json();
          applyPortrait(lot.imgQuery, data?.url ?? null, data?.source ?? "none");
          setPortraitNote(
            data?.url
              ? `Found one (${data.source}).`
              : "Still nothing out there — tap the card to upload one."
          );
        }
      } catch {
        setPortraitNote("Couldn't do that — try again.");
      }
    },
    [applyPortrait, meId, pack, portraits, portraitSources, view.lot]
  );

  /** Someone picked a file for a character with no photo anywhere. */

  const handlePortraitUpload = useCallback(
    async (file: File) => {
      const lot = view.lot;
      if (!lot) return;
      if (file.size > 8 * 1024 * 1024) {
        setPortraitNote("That image is too big — 8MB max.");
        return;
      }
      initAudio();
      sfx.click();
      setPortraitNote(`Uploading a photo for ${lot.name}…`);
      try {
        const dataUrl = await toCardSizedDataUrl(file);

        /* Written through the Netlify function, not a Next route.
           Turbopack rewrites the dynamic "@aws-sdk/client-s3" import to a
           hashed specifier that does not exist at runtime, so every R2 write
           from a Next route dies during module init and the platform answers
           with a plain-text "Internal Server Error". The studio has always
           used this function and has always worked; the in-game upload used
           the Next route and never did. Same path now.

           The Next route stays as the local fallback — `netlify dev` serves
           the function, a bare `next dev` does not. */
        const url = await storePortraitImage(lot.name, dataUrl);

        /* Recorded exactly like a 👍, keyed by character, so the photo wins
           on every board this character turns up on from now on. */
        await fetch("/api/draftmasters/portrait/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imgQuery: lot.imgQuery,
            name: lot.name,
            url,
            source: "curated",
            verdict: "good",
            userId: meId,
          }),
        }).catch(() => {
          /* The picture is stored and on screen; only "remember it" failed. */
        });

        applyPortrait(lot.imgQuery, url, "curated");
        setPortraitNote(`Saved — that's ${lot.name} from now on.`);
      } catch (e) {
        setPortraitNote(e instanceof Error ? e.message : "Upload failed — try again.");
      }
    },
    [applyPortrait, meId, view.lot]
  );

  useEffect(() => {
    setPortraitNote(null);
  }, [view.lot?.id]);

  /**
   * Safety net for the long tail.
   *
   * On a 649-entry board only the first few batches are resolved before the
   * draft opens and the rest arrive behind it, so a lot can come up before its
   * batch has landed. `undefined` means "not asked yet" and is the only case
   * worth chasing — `null` is a resolved miss and re-asking it every time the
   * lot changed would hammer the resolver for a picture that does not exist.
   */
  const chasing = useRef<string | null>(null);
  useEffect(() => {
    const lot = view.lot;
    if (!lot || portraits[lot.imgQuery] !== undefined) return;
    if (chasing.current === lot.imgQuery) return;
    chasing.current = lot.imgQuery;
    const wiki = pack?.entries.find((e) => e.n === lot.name)?.wiki ?? pack?.wiki ?? "";
    (async () => {
      try {
        const res = await fetch(
          `/api/draftmasters/portrait?q=${encodeURIComponent(lot.imgQuery)}` +
            `&name=${encodeURIComponent(lot.name)}&wiki=${encodeURIComponent(wiki)}`
        );
        const data = await res.json();
        applyPortrait(lot.imgQuery, data?.url ?? null, data?.source ?? "none", false);
      } catch {
        /* the lettered card stands */
      }
    })();
  }, [view.lot, portraits, pack, applyPortrait]);


  /** Resolve the chosen topic into a full board, portraits and all. */
  const buildBoard = useCallback(async (): Promise<Pack | null> => {
    setError(null);
    setPrep({ phase: "board", done: 0, total: 0 });

    let board: Pack | null = null;
    try {
      if (mixIds.length > 1) {
        // No model in this path at all: the boards already exist.
        const res = await fetch("/api/draftmasters/mix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: mixIds, variantRate, variantWild }),
        });
        const data = await readJson(res, "Could not mix those universes.");
        if (!res.ok) throw new Error(data?.error ?? "Could not mix those universes.");
        board = data.pack as Pack;
      } else if (customTopic.trim()) {
        const res = await fetch("/api/draftmasters/topic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: customTopic.trim(),
            variantRate,
            variantWild,
          }),
        });
        const data = await readJson(res, "Board building took too long. Try again, or shorten the topic.");
        if (!res.ok) throw new Error(data?.error ?? "Could not build that board.");
        board = data.pack as Pack;
      } else if (presetId) {
        // Path-addressed and no-store: the CDN can't serve a different board.
        const res = await fetch(`/api/draftmasters/pack/${encodeURIComponent(presetId)}`, { cache: "no-store" });
        const data = await readJson(res, "Could not load that board. Try again in a moment.");
        if (!res.ok) throw new Error("Could not load that topic.");
        board = data.pack as Pack;
        // A generated board is written to the dials; a ready-made one is
        // written already, so stamp them on here instead. After this every
        // board carries its own settings, which is what lets them ride along
        // to a PvP guest and into a rematch.
        board = { ...board, variantRate, variantWild };
      }
      if (board) {
        // The argument round is the host's call and has to reach the guest.
        board = { ...board, argumentsOn };
      } else {
        // Never default to a board the host didn't choose.
        throw new Error("Pick a topic first.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong building the board.");
      return null;
    }

    // Roll the setting. Same board, different fight — an animal draft is
    // usually a field and occasionally deep water, which changes everything.
    board = applyArena(board, Math.random);
    // One chance in five hundred that this board carries a cosmic card. Done
    // here so it is baked into the pack a PvP guest receives.
    board = withUberCard(board, Math.random);

    setPack(board);
    // prefetchPortraits drives the portrait phase itself, entry by entry.
    await prefetchPortraits(board);
    setPrep({ phase: "room", done: 0, total: 0 });
    sfx.boardReady();
    return board;
  }, [customTopic, mixIds, presetId, prefetchPortraits, variantRate, variantWild]);

  /** Names drafted in recent games on this board, so they get demoted. */
  const recentKey = (id: string) => `dm_recent_${id.split("#")[0]}`;

  const readRecent = useCallback((board: Pack): Set<string> => {
    try {
      const raw = localStorage.getItem(recentKey(board.id));
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  }, []);

  const rememberDrafted = useCallback((board: Pack | null, sides: Side[]) => {
    if (!board) return;
    try {
      const key = recentKey(board.id);
      const prev = JSON.parse(localStorage.getItem(key) ?? "[]") as string[];
      const now = sides.flatMap((s) => s.roster.map((p) => p.name.toLowerCase()));
      // Two games' worth is enough to break up repeats without freezing anyone out.
      localStorage.setItem(key, JSON.stringify([...new Set([...now, ...prev])].slice(0, 40)));
    } catch {
      /* no localStorage — repeats are the only cost */
    }
  }, []);

  // ── Solo game loop ─────────────────────────────────────────────────────────

  const commit = useCallback(() => {
    const g = gameRef.current;
    setView({
      ...g,
      sides: g.sides.map((s) => ({ ...s, roster: [...s.roster] })),
      ticker: [...g.ticker],
      readyIds: [...g.readyIds],
      passedIds: [...g.passedIds],
      passLocked: [...g.passLocked],
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
  /** The last fight, kept so the battle screen can replay the real thing. */
  const battleLogRef = useRef<BattleResult | null>(null);
  const finishVerdictRef = useRef<(v: Verdict) => void>(() => {});
  const verdictRef = useRef<Verdict | null>(null);
  verdictRef.current = verdict;
  const watchedBattleRef = useRef(false);
  watchedBattleRef.current = watchedBattle;

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
      const opening = !gg.highBidderId;
      const move = npcMove(S.npcVal, bot, S.rules, gg.currentBid, opening, otherSide(gg.sides, bot.id));
      // A locked bot has used its free pass — it has to fill the slot.
      const forced = move.kind === "pass" && opening && gg.passLocked.includes(bot.id);
      actRef.current(bot.id, forced ? { kind: "bid", amount: openingBid(bot, S.rules) } : move);
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
      if (amount < 0 || amount > maxBid(side, S.rules)) return;
      if (g.highBidderId ? amount <= g.currentBid : amount < openingBid(side, S.rules)) return;
      g.currentBid = amount;
      g.highBidderId = sideId;
      pushEvent(
        amount > 0 ? `${isMe ? "You bid" : `${side.name} bids`} $${amount}` : `${isMe ? "You claim" : `${side.name} claims`} it for free`,
        "bid"
      );
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
      if (g.highBidderId) {
        pushEvent(isMe ? "You let it go" : `${side.name} lets it go`, "passed");
        closeLotRef.current();
        return;
      }
      g.passedIds.push(sideId);
      if (other && !g.passedIds.includes(other.id) && canOpen(other, S.rules, side)) {
        pushEvent(`${isMe ? "You pass" : `${side.name} passes`} — over to ${nameOf(other.id)}`, "passed");
        g.turnId = other.id;
        sfx.click();
        commit();
        scheduleNpcRef.current();
        return;
      }
      // Unopposed: one free pass, then the next lot must fill a slot.
      if (!other || !canOpen(other, S.rules, side)) {
        if (g.passLocked.includes(sideId)) return;
        g.passLocked.push(sideId);
        pushEvent(`${isMe ? "You pass" : `${side.name} passes`} — the next one fills ${isMe ? "your" : "their"} slot`, "passed");
      }
      closeLotRef.current();
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
    const S = soloRef.current;
    if (!g.lot) return;
    clearNpc();

    if (g.highBidderId) {
      const side = g.sides.find((s) => s.id === g.highBidderId);
      if (side) {
        side.budget -= g.currentBid;
        side.roster.push({ ...g.lot, price: g.currentBid });
        g.passLocked = g.passLocked.filter((id) => id !== side.id);
        pushEvent(`SOLD — ${g.lot.name} to ${nameOf(side.id).toLowerCase()} for ${priceLabel(g.currentBid)}`, "sold");
        sfx.sold();
      }
    } else {
      if (S.lotEntryIndex >= 0) S.unsold.push(S.lotEntryIndex);
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

    // Chairs still empty but the board's run dry: deal the passed lots again.
    if (!allFull && S.cursor >= S.pool.length && S.unsold.length) {
      S.pool.push(...S.unsold);
      S.unsold = [];
      pushEvent("Bringing back the lots nobody took", "system");
    }

    if (allFull || S.cursor >= S.pool.length) {
      g.phase = "complete";
      g.lot = null;
      g.turnId = null;
      g.dice = null;
      pushEvent(allFull ? "Rosters full — calculate the winner" : "Board exhausted — calculate the winner", "system");
      commit();
      rememberDrafted(S.pack, g.sides);
      // With arguments on, the draft ends at the sealed box, not the verdict.
      setScreen(S.pack?.argumentsOn ? "arguments" : "verdict");
      return;
    }

    const entryIndex = S.pool[S.cursor++];
    S.lotEntryIndex = entryIndex;
    const rng = makeRng(S.seed + entryIndex * 7919 + S.cursor);
    g.lot = buildLot(board.entries[entryIndex], entryIndex, board, rng, S.variants);
    g.lotsRemaining = Math.max(0, S.pool.length - S.cursor);

    // Opening rights alternate, skipping anyone who can't open.
    const first = g.sides[S.lotIndex % g.sides.length];
    const second = g.sides.find((s) => s.id !== first.id);
    g.openerId = canOpen(first, S.rules, second) ? first.id : second && canOpen(second, S.rules, first) ? second.id : null;
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
      { id: "npc", name: npc.name, avatarUrl: null, budget: nextRules.budget, roster: [], isNpc: true },
    ];

    soloRef.current = {
      pool: buildPool(board, makeRng(seed), { recent: readRecent(board) }),
      cursor: 0,
      lotIndex: 0,
      lotEntryIndex: -1,
      unsold: [],
      seed,
      seq: 0,
      npcVal: 0,
      pack: board,
      rules: nextRules,
      npc,
      // Fresh allowance every draft. A generated board carries the dials it
      // was built at; a ready-made one has no dials of its own, so the
      // player's current settings drive it instead.
      variants: newVariantBudget(Math.random, board.variantWild, board.variantRate),
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
  }, [buildBoard, commit, meId, myAvatar, myName, npc, rulesIdx, variantRate, variantWild]);

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

  /**
   * Walk into a room.
   *
   * `check` is for every way of arriving that is not "I just made this room":
   * an invite link, a typed code, Back to your game. The server sends its
   * state the moment the socket opens, BEFORE anyone joins — so the room can
   * be looked at without sitting down in it. Empty with no host means it has
   * closed; mid-game with both seats taken and yours not among them means it
   * started without you. Either way the player is told so on the shelf,
   * instead of being seated alone in a room that is never going to fill —
   * which is what following an old invite link used to do.
   *
   * `tapped` says this came from a tap, which is what the browser needs
   * before it will show the mic prompt for the first time.
   */
  const connectRoom = useCallback(
    async (code: string, asHost: boolean, opts: { check?: boolean; tapped?: boolean } = {}) => {
      initAudio();
      // One room at a time.
      wsRef.current?.close();
      wsRef.current = null;
      setMode("pvp");
      setRoomCode(code);
      setIOpenedRoom(asHost);
      setError(null);
      setRoomNotice(null);
      setChat([]);
      setMembers([]);
      reportedRef.current = null;
      if (opts.check) setJoining(code);

      const { default: PartySocket } = await import("partysocket");
      const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999";
      const ws = new PartySocket({ host, room: code, party: "draftmasters" });
      wsRef.current = ws as unknown as { send: (s: string) => void; close: () => void };

      let admitted = false;
      let opened = false;

      const sendJoin = () => {
        ws.send(
          JSON.stringify({ type: "join", userId: meId, name: myName, avatarUrl: myAvatar, mic: mediaRef.current.micOn })
        );
        ws.send(JSON.stringify({ type: "sync" }));
      };

      const admit = () => {
        admitted = true;
        setJoining(null);
        if (opened) sendJoin();
        const stored: StoredRoom = { code, host: asHost, at: Date.now() };
        writeStoredRoom(stored);
        setRemembered(stored);
        rememberRoom(code, asHost);
        // The address carries the room, so a refresh lands back in it.
        setRoomParam(code);
        // Voice starts by itself once the mic has been allowed before, and
        // on any tap (Draft with a friend, Join, Rejoin, an invite card). An
        // invite link opened cold shows Turn on voice instead of a prompt
        // appearing out of nowhere.
        if (!opts.check || opts.tapped || rememberedMicGrant()) void mediaRef.current.start();
        setScreen("room");
      };

      const refuse = (kind: "gone" | "started") => {
        ws.close();
        if ((wsRef.current as unknown) === (ws as unknown)) wsRef.current = null;
        setJoining(null);
        setRoomNotice({ code, kind });
        setRoomCode(null);
        setMode("solo");
        setScreen("setup");
        setRoomParam(null);
        if (readStoredRoom()?.code === code) {
          writeStoredRoom(null);
          setRemembered(null);
          rememberRoom(null);
        }
      };

      // Every open — first connect or any reconnect — re-joins and resyncs.
      // Until the room has been looked at, an open only listens.
      ws.addEventListener("open", () => {
        opened = true;
        setConnected(true);
        if (admitted) sendJoin();
      });
      ws.addEventListener("close", () => setConnected(false));
      ws.addEventListener("message", (ev: MessageEvent) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(ev.data as string);
        } catch {
          return;
        }
        if (!admitted) {
          if (msg.type !== "state") return;
          const verdict = judgeRoom(msg.state as Record<string, unknown>, meId, asHost);
          if (verdict !== "ok") {
            refuse(verdict);
            return;
          }
          admit();
        }
        void serverMessageRef.current(msg);
      });

      if (!opts.check) admit();
    },
    [meId, myAvatar, myName, rememberRoom]
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

  // The room shows everyone whether your mic is live. Tell it when that changes.
  useEffect(() => {
    if (mode !== "pvp" || !roomCode || joining) return;
    send({ type: "media", mic: media.micOn });
  }, [joining, media.micOn, mode, roomCode, send]);

  // A room in play keeps its row fresh, so friends see "In a draft" and a
  // second device can offer Back to your game.
  useEffect(() => {
    if (mode !== "pvp" || !roomCode || joining) return;
    const id = setInterval(() => rememberRoom(roomCode, iOpenedRoom), 4 * 60_000);
    return () => clearInterval(id);
  }, [iOpenedRoom, joining, mode, rememberRoom, roomCode]);

  // Arriving on an invite link — or refreshing inside a room, which keeps
  // ?room= in the address — goes straight into the room. No code to type.
  const autoJoined = useRef(false);
  useEffect(() => {
    if (autoJoined.current) return;
    autoJoined.current = true;
    const stored = readStoredRoom();
    setRemembered(stored);
    if (!initialRoom) return;
    // Your own room, reopened after a refresh: you are its host, not a guest.
    void connectRoom(initialRoom, stored?.code === initialRoom && stored.host, { check: true });
  }, [connectRoom, initialRoom]);

  /** A room or a game is on screen. Everything that guards against leaving keys off this. */
  const trapped = screen !== "setup";
  const trappedRef = useRef(trapped);
  trappedRef.current = trapped;
  const roomCodeRef = useRef(roomCode);
  roomCodeRef.current = roomCode;

  // An invite card tapped in the friends sheet, or a toast's Join, while the
  // game is already open: join here rather than reloading the page.
  useEffect(() => {
    setJoinHandler((code) => {
      if (code === roomCodeRef.current && wsRef.current) return; // already there
      const mine = readStoredRoom();
      const go = () => void connectRoom(code, mine?.code === code && mine.host, { check: true, tapped: true });
      if (trappedRef.current) setLeaveAsk({ then: go });
      else go();
    });
    return () => setJoinHandler(null);
  }, [connectRoom, setJoinHandler]);

  // Friends' toasts and the chat sheet stay out of a game in progress.
  useEffect(() => {
    setInGame(trapped);
    return () => setInGame(false);
  }, [setInGame, trapped]);

  /**
   * The back gesture, inside a game.
   *
   * On a phone a swipe in from the screen edge is Back, and Back from a page
   * you arrived on by link is "leave the app" — which is how drafts were being
   * abandoned mid-bid by a thumb resting on the edge. While a room or a game
   * is on screen there is one extra history entry on top of this page: Back
   * lands on it, it is put straight back, and the player is asked. Nothing on
   * the shelf is guarded.
   */
  const leavingByLink = useRef(false);
  /**
   * The guard's own history.back() arrives as a popstate like any other. In
   * development React runs this effect twice, so that event can land on the
   * second run's listener and ask "Leave the game?" of a player who has only
   * just sat down. Pops inside this window are ours.
   */
  const ignorePopsUntil = useRef(0);
  useEffect(() => {
    if (!trapped) return;
    leavingByLink.current = false;
    const root = document.documentElement;
    root.classList.add("dm-guarded");
    const push = () => {
      try {
        window.history.pushState({ ...(window.history.state ?? {}), dmGuard: true }, "", window.location.href);
      } catch {
        /* history locked down in some webviews — the overscroll rule still helps */
      }
    };
    push();
    const onPop = () => {
      if (Date.now() < ignorePopsUntil.current) return;
      push();
      setLeaveAsk((cur) => cur ?? { then: () => {} });
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      root.classList.remove("dm-guarded");
      // Take the extra entry back out so a later Back goes where it should —
      // unless a link is already taking the player somewhere else.
      if (!leavingByLink.current && (window.history.state as { dmGuard?: boolean } | null)?.dmGuard) {
        const tidy = () => {
          window.removeEventListener("popstate", tidy);
          if (!roomCodeRef.current) setRoomParam(null);
        };
        window.addEventListener("popstate", tidy);
        ignorePopsUntil.current = Date.now() + 500;
        window.history.back();
      }
    };
  }, [trapped]);

  // Closing the tab or reloading mid-draft asks too. Only while it is live:
  // a lobby survives a reload (the address has the room), a verdict is over.
  const live = screen === "prep" || screen === "ready" || screen === "auction" || screen === "arguments" || screen === "lineup";
  useEffect(() => {
    if (!live) return;
    const hold = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", hold);
    return () => window.removeEventListener("beforeunload", hold);
  }, [live]);

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
    send({
      type: "board",
      pack: board,
      budget: preset.budget,
      rosterSize: preset.rosterSize,
      // The host's history shapes the queue; the server does the shuffling.
      recent: [...readRecent(board)],
    });
  }, [buildBoard, readRecent, rulesIdx, send]);

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
        // A (re)join is a fresh browser session on their side. Whatever
        // connection was left from before is dead and would fight the new offer.
        mediaRef.current.dropPeer(String(msg.userId));
        void mediaRef.current.connectTo(String(msg.userId));
        return;
      }
      if (msg.type === "media") {
        const id = String(msg.userId);
        setMembers((prev) => prev.map((m) => (m.userId === id ? { ...m, mic: Boolean(msg.mic) } : m)));
        return;
      }
      if (msg.type === "peer-left") {
        mediaRef.current.dropPeer(String(msg.userId));
        return;
      }
      if (msg.type === "portrait") {
        // The other player found or uploaded a photo — show it here too.
        const q = String(msg.imgQuery ?? "");
        if (q) {
          setPortraits((p) => ({ ...p, [q]: (msg.url as string) ?? null }));
          setPortraitSources((p) => ({ ...p, [q]: String(msg.source ?? "curated") }));
        }
        return;
      }
      // Sent to the driver alone, once every seated player has sealed a case.
      // This is the only time argument text reaches a client, and it reaches
      // exactly one — the one that has to call the panel.
      if (msg.type === "args-ready") {
        const args = (msg.args as { sideId: string; text: string }[]) ?? [];
        // With the argument ROUND off -- which it is -- there is no panel to
        // call. The cases exist so the storyteller can weigh both of them.
        if (!argumentsOnRef.current) {
          setPvpArgs(Object.fromEntries(args.map((x) => [x.sideId, x.text])));
          return;
        }
        void (async () => {
          setArguing(true);
          try {
            const res = await fetch("/api/draftmasters/argue", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                pack: packRef.current
                  ? {
                      name: packRef.current.name,
                      scenario: packRef.current.scenario,
                      criteria: packRef.current.criteria,
                      format: packRef.current.format,
                    }
                  : undefined,
                sides: gameRef.current.sides,
                args,
              }),
            });
            if (!res.ok) throw new Error("The panel couldn't read the arguments.");
            const data = (await res.json()) as { rulings: ArgumentRuling[] };
            send({ type: "rulings", rulings: data.rulings ?? [] });
          } catch (e) {
            setError(e instanceof Error ? e.message : "The panel couldn't read the arguments.");
          } finally {
            setArguing(false);
          }
        })();
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
      // Who has sealed a case — the server never sends what they wrote.
      //
      // Merged, never replaced. Sealing is one-way: once you have committed a
      // case you cannot take it back, so the UI must not un-seal you either.
      // Replacing this wholesale meant any state push that had not yet caught
      // up flipped the box back to "still writing", and it flickered between
      // the two while you waited for the other player.
      {
        const fromServer = (s.argSubmitted as string[]) ?? [];
        setArgSubmitted((prev) => {
          const merged = new Set(fromServer);
          if (prev.includes(meId)) merged.add(meId);
          return [...merged];
        });
      }
      const serverRulings = (s.rulings as ArgumentRuling[] | null) ?? [];
      rulingsRef.current = serverRulings;
      setRulings(serverRulings);
      setPeerStaging(Boolean(s.battleStaging));
      setPeerStagingKind(s.stagingKind === "judging" ? "judging" : "staging");
      matchIdRef.current = String(s.matchId ?? "");

      // The driver posts the battle script; everyone else watches the same one.
      const serverBattle = (s.battle as BattleScript | null) ?? null;
      setBattle((current) => {
        if (!serverBattle) return null;
        if (watchedBattleRef.current) return current; // don't replay for someone who skipped
        // Same fight: keep what is running -- unless the story has just been
        // written and has arrived attached to it.
        const sameFight = current && current.beats.length === serverBattle.beats.length;
        if (sameFight && !(serverBattle.told && !current.told)) return current;
        return serverBattle;
      });

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
        passLocked: (s.passLocked as string[]) ?? [],
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
      // The argument round sits between the last lot and the verdict; once the
      // panel has ruled, the room moves on.
      else if (phase === "complete")
        setScreen(serverPack?.argumentsOn && serverRulings.length === 0 ? "arguments" : "verdict");
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

  /**
   * Fight it, then read the verdict off the fight.
   *
   * This replaces asking a model who won. Every figure on the verdict screen
   * now comes from a battle that happened under the rules on the cards, which
   * is why the verdict can no longer contradict itself — the Sheik marked BUST
   * at 8/10 contribution was a free-text answer disagreeing with another
   * free-text answer, and there is no free text left in the scoring.
   */
  const settleWithTheFight = useCallback(async (line: LineupResult) => {
    const g = gameRef.current;
    const [a, b] = mode === "pvp" ? viewRef.current.sides : g.sides;
    if (!a || !b) return;

    const boardId = pack?.id?.split("#")[0];
    const toCard = (p: RosterPick) =>
      cardFor(
        { name: p.name, variant: p.variant, baseTier: p.tier, tier: p.tier, grade: p.variantGrade },
        boardId
      );

    // My side fights in the order I just set; theirs fights as drafted, since
    // an NPC has no line-up screen. A human opponent's order arrives with the
    // room state in PvP.
    const mineIsA = a.id === meId;
    const myLine = line.order.map(toCard);
    const myCap = line.captain ? toCard(line.captain) : undefined;
    const theirSide = mineIsA ? b : a;
    const theirLine = theirSide.roster.map(toCard);

    const ground = pack?.arenaName ? terrainFor(pack.arenaName, pack.arenaDesc) : null;

    // No health behind the line any more: the lines fight until one runs out.
    const hp = PLAYER_HP;
    const mine = { name: (mineIsA ? a : b).name, hp, cards: myLine, captain: myCap };
    const theirs = { name: theirSide.name, hp, cards: theirLine };

    /**
     * Ask the model what the rules cannot know — but only if it was asked for.
     *
     * It never sees who is winning and cannot return an outcome: the only
     * shape it can answer in is a handful of bounded, reasoned nudges, each
     * clamped again on the way back. If it is slow, down or daft, the fight
     * happens without it and nothing is said about it, because offline is not
     * a degraded mode. It is the game.
     */
    // No adjustments any more. The model that writes the battle decides it
    // too, in one call -- there is nothing left here for a second one to
    // advise, and the resolver below is only the offline fallback.
    const adjustments: Adjustment[] = [];

    const result = mineIsA
      ? resolveBattle(mine, theirs, { terrain: ground, adjustments })
      : resolveBattle(theirs, mine, { terrain: ground, adjustments });

    const ids: [string, string] = [a.id, b.id];
    const read = readVerdict(result, ids, hp);

    const verdict: Verdict = {
      winnerId: read.winnerId,
      headline: read.headline,
      reasoning: read.reasoning,
      judged: "offline",
      sideNotes: read.sides.map((s) => ({
        sideId: s.sideId,
        score: s.score,
        mvp: s.mvp,
        bust: s.bust,
        note: s.note,
        picks: s.picks.map((p) => ({ name: p.name, contribution: p.contribution })),
      })),
    };

    battleLogRef.current = result;

    // The show and the verdict come off the same log, in that order: the
    // cinematic plays over the verdict screen and `endBattle` uncovers it.
    const script: BattleScript = {
      ...scriptFromFight(result, narrate(result, { terrain: ground ?? undefined }), ids),
      scripted: "offline",
      boardId,
      lineup: [
        {
          sideId: (mineIsA ? a : b).id,
          order: myLine.map((x) => x.name),
          captain: myCap?.name ?? null,
        },
        // An NPC fights as drafted and holds nobody back.
        { sideId: theirSide.id, order: theirLine.map((x) => x.name), captain: null },
      ],
    };
    setWatchedBattle(false);
    setBattle(script);
    battleRef.current = script;
    if (mode === "pvp") {
      // The script first, so both players watch the same fight -- then the
      // verdict, which nothing here ever sent. Without it the guest sat on
      // "waiting for the host to call it" for the rest of the game, and
      // finishVerdictRef is the solo path: it rewrites gameRef, which in a
      // friend game is empty, and files the result as a solo match.
      send({ type: "battle", battle: script });
      send({ type: "verdict", verdict });
      return;
    }

    finishVerdictRef.current?.(verdict);
  }, [meId, mode, pack, send]);

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

  const submitArgument = useCallback(
    async (text: string) => {
      setError(null);
      if (mode === "pvp") {
        // The server seals it; it reaches the panel via the "args-ready"
        // message, so nothing here can leak it to the other client.
        send({ type: "argument", text });
        setArgSubmitted((prev) => (prev.includes(meId) ? prev : [...prev, meId]));
        return;
      }

      setArgSubmitted([meId]);
      setArguing(true);
      try {
        const res = await fetch("/api/draftmasters/argue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pack: pack
              ? { name: pack.name, scenario: pack.scenario, criteria: pack.criteria, format: pack.format }
              : undefined,
            sides: gameRef.current.sides,
            // Solo: only the human submits. The panel writes the NPC's case.
            args: text ? [{ sideId: meId, text }] : [],
          }),
        });
        if (!res.ok) throw new Error("The panel couldn't read the arguments. Try again.");
        const data = (await res.json()) as { rulings: ArgumentRuling[] };
        rulingsRef.current = data.rulings ?? [];
        setRulings(rulingsRef.current);
        setArgSubmitted(gameRef.current.sides.map((s) => s.id));
      } catch (e) {
        setError(e instanceof Error ? e.message : "The panel couldn't read the arguments.");
        setArgSubmitted([]);
      } finally {
        setArguing(false);
      }
    },
    [meId, mode, pack, send]
  );

  /**
   * Hold the crown back while a fight is being staged or played out. The
   * verdict has to be decided first — the script is written from it — but
   * showing it before the fight gives away the ending.
   */
  const revealHeld = battleLoading || peerStaging || battle !== null;

  /**
   * The battle has been written. The verdict takes its word for everything.
   *
   * The model that wrote the fight also decided it, named the card it turned
   * on, and said in plain words why -- all in the one call. The local resolver
   * ran BEFORE a word of it existed, so its summary ("8 cards went down across
   * 11 rounds") describes a battle nobody watched. Whatever the story says
   * happened is what happened.
   */
  const takeTold = useCallback((told: ToldBattle) => {
    setToldBattle(told);
    // One telling, shared. Both clients used to write their own -- two calls
    // for one fight, and two different accounts of it on the two screens.
    if (mode === "pvp" && battleRef.current) {
      const script = { ...battleRef.current, told };
      battleRef.current = script;
      send({ type: "battle", battle: script });
    }
    setVerdict((v) => {
      if (!v) return v;
      const won = g_sideName(gameRef.current, told.winnerId) ?? "The winner";
      const name = /^you$/i.test(won) ? "You win!" : `${won} wins!`;
      return {
        ...v,
        winnerId: told.winnerId || v.winnerId,
        headline: name,
        reasoning: told.why || v.reasoning,
        mvp: told.mvp,
      };
    });
  }, [mode, send]);

  /** Seal this player's case to the room, once, when the box closes. */
  const sealArgument = useCallback(
    (text: string) => {
      const t = text.trim();
      if (mode !== "pvp" || !t || argSealed.current) return;
      argSealed.current = true;
      send({ type: "argument", text: t });
    },
    [mode, send]
  );

  const endBattle = useCallback(() => {
    setWatchedBattle(true);
    setBattle(null);
    if (mode === "pvp") send({ type: "battle", battle: null });
  }, [mode, send]);

  const playAgain = useCallback(() => {
    sfx.click();
    // A new draft is a new battle. Nothing to replay, and last game's case
    // has nothing to do with this one.
    setToldBattle(null);
    setArgument("");
    battleRef.current = null;
    argSealed.current = false;
    setPvpArgs(null);
    clearNpc();
    setBattle(null);
    setWatchedBattle(false);
    setPeerStaging(false);
    setPeerStagingKind("staging");
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
    setMixIds([]);
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

  /**
   * Leave the room (or the game against the house) for the shelf.
   *
   * The seat is not given up — the server keeps a side for anyone who drops —
   * and the room stays remembered, so Back to your game and the same invite
   * link both put the player straight back where they were.
   */
  const leaveRoom = useCallback(() => {
    if (mode === "pvp") {
      wsRef.current?.close();
      wsRef.current = null;
      mediaRef.current.teardown();
      setRoomCode(null);
      setMembers([]);
      setChat([]);
      setJoining(null);
      setInviteOpen(false);
      setMode("solo");
    }
    clearNpc();
    setBattle(null);
    setVerdict(null);
    setPack(null);
    knownPackId.current = null;
    prevPhase.current = "";
    prevBid.current = 0;
    gameRef.current = { ...EMPTY_VIEW };
    setView(EMPTY_VIEW);
    setRoomParam(null);
    // Walking away from a finished game is being done with it. Walking away
    // mid-draft is not, so that room stays on offer as Back to your game.
    if (screen === "verdict") {
      writeStoredRoom(null);
      setRemembered(null);
      rememberRoom(null);
    }
    setScreen("setup");
  }, [clearNpc, mode, rememberRoom, screen]);

  const forgetRoom = useCallback(() => {
    writeStoredRoom(null);
    setRemembered(null);
    rememberRoom(null);
  }, [rememberRoom]);

  /** A link out of a game asks first. */
  const exitVia = useCallback(
    (e: React.MouseEvent, href: string) => {
      if (!trapped) return;
      e.preventDefault();
      setLeaveAsk({
        then: () => {
          leavingByLink.current = true;
          router.push(href);
        },
      });
    },
    [router, trapped]
  );

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
  /** Back to your game: this device's memory first, then the account's. */
  const backTo =
    remembered ?? (social.activeRoom ? { code: social.activeRoom.code, host: social.activeRoom.isHost, at: 0 } : null);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    /* data-standalone marks the game as owning the whole screen: the site nav,
       the fixed bottom nav and the floating voice/party pills are hidden while
       it is mounted (see styles.ts, "Standalone"). DraftMasters is heading for
       its own site, and on a phone that chrome was eating ~134px of a 812px
       screen to show controls that belong to a different app. */
    <div className="dm" data-standalone="1" data-guard={trapped ? "1" : "0"}>
      <style dangerouslySetInnerHTML={{ __html: STYLES + BATTLE_STYLES }} />
      {mode === "pvp" && !connected && <div className="dm-conn">Reconnecting…</div>}

      {/* The room's voice plays from up here, above every screen, so a call
          carries on from lobby to auction to battle without a gap. */}
      {mode === "pvp" && <PeerAudio media={media} />}
      {mode === "pvp" && roomCode && !joining && screen !== "setup" && screen !== "room" && screen !== "ready" && (
        <RoomDock
          key={roomCode}
          defaultOpen={screen !== "auction" && typeof window !== "undefined" && window.matchMedia("(min-width: 900px)").matches}
          members={members}
          meId={meId}
          myName={myName}
          myAvatar={myAvatar}
          media={media}
          chat={chat}
          onSendChat={sendChat}
          onMicChange={IGNORE}
        />
      )}
      {inviteOpen && roomCode && <InviteSheet code={roomCode} onClose={() => setInviteOpen(false)} />}
      {leaveAsk && (
        <div className="dm-leave-scrim" role="alertdialog" aria-modal="true" aria-labelledby="dm-leave-title">
          <div className="dm-leave">
            <h2 id="dm-leave-title">Leave the game?</h2>
            <p>
              {mode === "pvp"
                ? "Your seat is kept. Rejoin from the shelf, or open the room link again."
                : "This draft against the house will end."}
            </p>
            <div className="dm-leave-actions">
              <button type="button" className="dm-btn dm-btn-primary" autoFocus onClick={() => setLeaveAsk(null)}>
                Stay in the game
              </button>
              <button
                type="button"
                className="dm-btn dm-btn-ghost"
                onClick={() => {
                  const then = leaveAsk.then;
                  setLeaveAsk(null);
                  leaveRoom();
                  then();
                }}
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="dm-shell">
        {screen === "setup" && <Motes />}
        {screen === "setup" && <BottomTabs />}

        <header className="dm-head">
          <div>
            <h1 className="dm-wordmark"><Wordmark /></h1>
            {screen === "setup" && (
              <p className="dm-tagline">
                Travel the multiverse and draft a team to fight for you.
              </p>
            )}
          </div>
          {/* Setup keeps nothing but the mark and the universe selector — the
              mute and the way out are controls for a draft that is running,
              and on the shelf they were two buttons of chrome above the thing
              the player came for. Both reappear, floated into the corner, the
              moment the auction starts. */}
          {/* The one header control that stays on the shelf. Everything else
              in this row is for a draft that is running; a way into your own
              profile is not, and the design puts a face in the top corner. */}
          <Link
            href="/draftmasters/you"
            className="dm-head-me"
            title={`Signed in as ${myName}`}
            onClick={(e) => exitVia(e, "/draftmasters/you")}
          >
            <PersonAvatar src={myAvatar} seed={meId} />
          </Link>

          <div className="dm-head-actions" data-hide={screen === "setup" ? "1" : "0"}>
            {/* Your mic is your own face now: on the dock and in the room, tap it to mute. */}
            <button
              className="dm-btn dm-btn-icon dm-btn-ghost"
              onClick={toggleAudio}
              title={audioMuted ? "Unmute game sounds" : "Mute game sounds"}
              aria-pressed={!audioMuted}
            >
              <Icon name={audioMuted ? "mute" : "sound"} size={17} />
            </button>
            {/* On its own domain there is no hub to go back to, so the slot
                does the thing a player actually wants mid-game instead. */}
            {standalone ? (
              <Link
                href="/"
                className="dm-btn dm-btn-ghost"
                onClick={(e) => {
                  if (trapped) return exitVia(e, "/");
                  // The game already lives at "/", so a plain link to it went
                  // nowhere -- a player tapped it on the results screen and
                  // nothing happened. Outside a live room it is exactly "Play
                  // again — new topic".
                  e.preventDefault();
                  playAgain();
                }}
              >
                New draft
              </Link>
            ) : (
              <Link href="/games" className="dm-btn dm-btn-ghost" onClick={(e) => exitVia(e, "/games")}>
                Great Souls
              </Link>
            )}
          </div>
        </header>

        {screen === "setup" && (
          <RoomBanner
            joining={joining}
            notice={roomNotice}
            backTo={backTo}
            onRejoin={(code, host) => void connectRoom(code, host, { check: true, tapped: true })}
            onDismiss={() => setRoomNotice(null)}
            onForget={forgetRoom}
          />
        )}
        {screen === "setup" && (
          <SetupScreen
            standalone={standalone}
            mixIds={mixIds}
            setMixIds={setMixIds}
            packs={packs}
            presetId={presetId}
            setPresetId={setPresetId}
            customTopic={customTopic}
            setCustomTopic={setCustomTopic}
            variantRate={variantRate}
            setVariantRate={setVariantRate}
            variantWild={variantWild}
            setVariantWild={setVariantWild}
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
            onJoin={() => {
              const code = normaliseRoomCode(joinCode);
              if (code) void connectRoom(code, false, { check: true, tapped: true });
              else setError("Room codes are 4 to 6 letters and numbers.");
            }}
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
            myName={myName}
            myAvatar={myAvatar}
            onInvite={() => setInviteOpen(true)}
            packs={packs}
            presetId={presetId}
            setPresetId={setPresetId}
            mixIds={mixIds}
            setMixIds={setMixIds}
            customTopic={customTopic}
            setCustomTopic={setCustomTopic}
            variantRate={variantRate}
            setVariantRate={setVariantRate}
            variantWild={variantWild}
            setVariantWild={setVariantWild}
            rulesIdx={rulesIdx}
            setRulesIdx={setRulesIdx}
            error={error}
            onStart={() => void startPvpDraft()}
          />
        )}

        {screen === "prep" && (
          <PrepScreen prep={prep} topic={topicLabel} isHost={canDrive} roomCode={roomCode} onInvite={() => setInviteOpen(true)} />
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
            myName={myName}
            myAvatar={myAvatar}
            onInvite={() => setInviteOpen(true)}
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
              arenaName={pack?.arenaName}
              arenaDesc={pack?.arenaDesc}
              scenario={pack?.scenario}
              onBid={handleBid}
              onPass={handlePass}
              onMatch={handleMatch}
              onAdvance={handleAdvance}
              portraitNote={portraitNote}
              onPortraitFeedback={handlePortraitFeedback}
              onPortraitUpload={(f) => void handlePortraitUpload(f)}
              media={
                mode === "pvp" ? (
                  <RoomVoice
                    members={members}
                    meId={meId}
                    myName={myName}
                    myAvatar={myAvatar}
                    media={media}
                    chat={chat}
                    onSendChat={sendChat}
                    onMicChange={IGNORE}
                  />
                ) : null
              }
            />
          </>
        )}

        {screen === "arguments" && (
          <ArgumentScreen
            sides={view.sides}
            meId={meId}
            rulings={rulings}
            submitted={argSubmitted}
            busy={arguing}
            canDrive={canDrive}
            error={error}
            onSubmit={(t) => void submitArgument(t)}
            onSkip={() => void submitArgument("")}
            onContinue={() => setScreen("lineup")}
          />
        )}

        {screen === "lineup" && (() => {
          const me = view.sides.find((s) => s.id === meId) ?? view.sides[0];
          const them = view.sides.find((s) => s.id !== me?.id);
          if (!me || !me.roster.length) return null;
          return (
            <LineupScreen
              roster={me.roster}
              packId={pack?.id ?? "custom"}
              portraits={portraits}
              onConfirm={(r) => { setLineup(r); void settleWithTheFight(r); }}
            />
          );
        })()}

        {screen === "verdict" && (
          <VerdictScreen
            verdict={revealHeld ? null : verdict}
            loading={false}
            error={error}
            sides={view.sides}
            rules={rules}
            meId={meId}
            portraits={portraits}
            packName={pack?.name ?? "Draft"}
            canJudge={canDrive}
            watched={watchedBattle}
            argument={argument}
            setArgument={setArgument}
            onSealArgument={sealArgument}
            record={record}
            ratingDelta={ratingDelta}
            mode={mode}
            battleLoading={battleLoading}
            busy={battleLoading ? "staging" : peerStaging ? peerStagingKind : null}
            onBattle={() => {
              // Straight to the fight: the story takes a team, not an order,
              // and captains are out of the brief for now.
              const me = view.sides.find((s) => s.id === meId) ?? view.sides[0];
              void settleWithTheFight({ order: me?.roster ?? [], captain: null });
            }}
            onPlayAgain={playAgain}
          />
        )}
      </div>

      {battle && (
        <BattleStory
          script={battle}
          sides={view.sides}
          rules={rules}
          meId={meId}
          portraits={portraits}
          packName={pack?.name ?? "Draft"}
          arena={pack?.arenaName ?? null}
          argument={argument}
          args={pvpArgs}
          writer={mode !== "pvp" || canDrive}
          replay={toldBattle ?? battle.told ?? null}
          onTold={takeTold}
          onDone={endBattle}
        />
      )}
    </div>
  );
}

/** A side's display name, for the verdict headline. */
function g_sideName(g: { sides?: { id: string; name: string }[] } | null, id: string) {
  return g?.sides?.find((s) => s.id === id)?.name;
}

// ── Variant dials ────────────────────────────────────────────────────────────

const RATE_WORDS = [
  "Off — no variants at all",
  "Barely any",
  "Rare",
  "Sparse",
  "A light sprinkle",
  "The house default",
  "Common",
  "Most of the board",
  "Nearly everyone",
  "Almost every pick",
  "Everyone who could have one",
];

const WILD_WORDS = [
  "Strictly canon",
  "Straight-faced",
  "Grounded",
  "Grounded, with a wink",
  "Mostly sensible",
  "The house default",
  "Playful",
  "Getting silly",
  "Mythic and ridiculous",
  "Off the leash",
  "Unhinged — gods and punchlines",
];

/**
 * The two knobs on the variant mechanic, for custom boards.
 *
 * Deliberately not a preset picker: the interesting settings are the corners
 * (frequent but grounded, rare but unhinged), and a slider is the only control
 * that makes those obvious. Presets ship with their variants already written,
 * so this is hidden unless a topic is being typed.
 */
function VariantDials({
  rate,
  setRate,
  wild,
  setWild,
}: {
  rate: number;
  setRate: (n: number) => void;
  wild: number;
  setWild: (n: number) => void;
}) {
  return (
    <div className="dm-dials">
      <Dial
        id="dm-dial-rate"
        label="How often variants show up"
        value={rate}
        onChange={setRate}
        word={RATE_WORDS[rate]}
      />
      <Dial
        id="dm-dial-wild"
        label="How wild they get"
        value={wild}
        onChange={setWild}
        word={WILD_WORDS[wild]}
      />
      <p className="dm-note" style={{ marginTop: 4 }}>
        Variants are the conditions rolled onto a pick — <em>Jaime Lannister (one hand)</em>. Each one is colour-coded
        by how hard it hits, from <span className="dm-grade-swatch" data-grade="crippling">crippling</span> up to{" "}
        <span className="dm-grade-swatch" data-grade="mythic">mythic</span>.
      </p>
    </div>
  );
}


function Dial({
  id,
  label,
  value,
  onChange,
  word,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
  word: string;
}) {
  return (
    <div className="dm-dial">
      <label className="dm-dial-head" htmlFor={id}>
        <span>{label}</span>
        <span className="dm-dial-value">{value}/10</span>
      </label>
      <input
        id={id}
        className="dm-range"
        type="range"
        min={0}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="dm-dial-word">{word}</span>
    </div>
  );
}

/**
 * Shrink a picked photo to card size in the browser, before it is uploaded.
 *
 * This used to happen server-side with sharp, which was the wrong place for
 * two reasons. sharp is a native binary that is not a declared dependency —
 * it only exists here because Next pulls it in — so what resolves on a dev
 * machine is not reliably present in a Linux serverless bundle. And sending
 * the full-size photo meant a phone picture arrived as a base64 JSON body
 * several megabytes wide, which runs straight at the platform's request
 * ceiling; an 8MB payload is already rejected outright.
 *
 * Doing it here makes the upload a few hundred KB, removes the native module
 * from the function entirely, and is faster for the player as a bonus.
 * Falls back to the original file if the canvas route is unavailable.
 */
async function toCardSizedDataUrl(file: File): Promise<string> {
  const readAsDataUrl = () =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsDataURL(file);
    });

  try {
    const bitmap = await createImageBitmap(file);
    // Same box the server used to target: portrait, card-shaped, never upscaled.
    const scale = Math.min(1, 900 / bitmap.width, 1125 / bitmap.height);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    // WebP where it exists; browsers that refuse it hand back a PNG data URL,
    // which the server accepts too.
    const out = canvas.toDataURL("image/webp", 0.86);
    return out.startsWith("data:image/webp") ? out : canvas.toDataURL("image/jpeg", 0.86);
  } catch {
    return readAsDataUrl();
  }
}

// ── Setup ────────────────────────────────────────────────────────────────────

/**
 * What's inside — the pack's contents, minus the surprises.
 *
 * A sealed pack you cannot see into is a gamble; a pack with a full contents
 * list is a menu. This is deliberately neither: the ordinary lots are shown so
 * you know what universe you are buying, and the ones worth opening a pack FOR
 * — the mythics and the cosmic cards — are held back as sealed slots. You can
 * see how many are in there. You cannot see which.
 */
function WhatsInside({
  pack,
  onClose,
}: {
  pack: PackSummary;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<
    { n: string; q: string; secret: boolean }[] | null
  >(null);
  const [art, setArt] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/draftmasters/pack/${pack.id}`, { cache: "no-store" });
        const { pack: full } = await res.json();
        if (!alive) return;
        const ctx = full.imgContext ?? "";
        const rows = full.entries.map((e: { n: string; s?: string; uberOnly?: boolean; variants?: { g?: string }[] }) => ({
          n: e.n,
          q: `${e.s ? `${e.n} ${e.s}` : e.n} ${ctx}`.trim(),
          // Held back: anything that can turn up as a mythic or an uber, and
          // the cosmic cards that are not in the ordinary rotation at all.
          secret: Boolean(e.uberOnly) || (e.variants ?? []).some((v) => v.g === "mythic" || v.g === "uber"),
        }));
        setEntries(rows);

        // Only the shown ones need faces.
        const open = rows.filter((r: { secret: boolean }) => !r.secret).slice(0, 60);
        const pres = await fetch("/api/draftmasters/portrait", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            queries: open.map((r: { n: string; q: string }) => ({ q: r.q, name: r.n, wiki: pack.heroWiki || undefined })),
          }),
        });
        const data = await pres.json();
        if (!alive) return;
        const next: Record<string, string | null> = {};
        open.forEach((r: { q: string }, i: number) => { next[r.q] = data?.portraits?.[i]?.url ?? null; });
        setArt(next);
      } catch {
        setEntries([]);
      }
    })();
    return () => { alive = false; };
  }, [pack.id, pack.heroWiki]);

  const shown = (entries ?? []).filter((e) => !e.secret);
  const sealed = (entries ?? []).filter((e) => e.secret);

  return (
    <div className="dm-sheet-scrim" onClick={onClose}>
      <div className="dm-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`What's inside ${pack.name}`}>
        <div className="dm-sheet-grip" aria-hidden="true" />
        <div className="dm-sheet-head">
          <h2 className="dm-sheet-title"><Crest pack={pack.id} size={18} /> {pack.name}</h2>
          <button type="button" className="dm-sheet-x" onClick={onClose} aria-label="Close"><Icon name="close" size={15} /></button>
        </div>

        {/* No record here yet, deliberately.
            The only numbers available are global — matches are stored without
            the board they were played on — so a per-universe record would be
            the site's overall win/loss wearing a Pokémon label. It goes in
            when matches carry their board; until then it is absent rather
            than wrong. */}

        {entries === null ? (
          <p className="dm-note" style={{ padding: "18px 0" }}>Opening the pack…</p>
        ) : (
          <>
            <p className="dm-eyebrow" style={{ marginTop: 14 }}>
              {shown.length} lots on the board
            </p>
            <div className="dm-inside-grid">
              {shown.map((e) => (
                <div key={e.n} className="dm-inside-cell" title={e.n}>
                  <span className="dm-inside-art">
                    {art[e.q] ? <img src={art[e.q]!} alt="" loading="lazy" /> : <span>{e.n.charAt(0)}</span>}
                  </span>
                  <span className="dm-inside-name">{e.n}</span>
                </div>
              ))}
            </div>

            {sealed.length > 0 && (
              <>
                <p className="dm-eyebrow" style={{ marginTop: 18 }}>
                  {sealed.length} sealed — mythics and rarer
                </p>
                <div className="dm-inside-grid">
                  {sealed.map((e, i) => (
                    <div key={i} className="dm-inside-cell" data-sealed="1">
                      <span className="dm-inside-art"><span>?</span></span>
                      <span className="dm-inside-name">Sealed</span>
                    </div>
                  ))}
                </div>
                <p className="dm-note" style={{ marginTop: 10 }}>
                  You will only find out which of these turned up by drafting the board.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The universe selector.
 *
 * The shelf is for browsing; this is for arriving. Twenty-one packs is a
 * pleasant swipe when you are undecided and a chore when you already know you
 * want Mortal Kombat, so the bar carries the current pick and opens a list
 * that jumps straight to it. Choosing scrolls the shelf rather than replacing
 * it, so the two stay in agreement and the pack you chose is the one under
 * your thumb.
 */
function UniverseSelect({
  packs,
  presetId,
  usingCustom,
  onPick,
}: {
  packs: PackSummary[];
  presetId: string | null;
  usingCustom: boolean;
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = packs.find((p) => p.id === presetId);
  const label = usingCustom ? "Custom" : current?.name ?? "Pick a universe";

  // Escape closes it, and a click anywhere else does too.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const jump = (id: string) => {
    onPick(id);
    setOpen(false);
    // Same reason as glideTo: "smooth" is a no-op in some engines, so this
    // asks for the jump plainly rather than an animation that may not happen.
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-card="${id}"]`)
        ?.scrollIntoView({ inline: "center", block: "nearest" });
    });
  };

  return (
    <div className="dm-usel">
      <button
        type="button"
        className="dm-usel-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="dm-usel-mark"><Crest pack={usingCustom ? "custom" : presetId ?? "custom"} size={13} /></span>
        <span className="dm-usel-label">{label}</span>
        {/* An SVG, not "⌄". The glyph sits high in its em box, so it reads as
            floating above the label however the flexbox is aligned. */}
        <svg className="dm-usel-chev" data-open={open ? "1" : "0"} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9.5 12 15.5 18 9.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <>
          <button
            type="button"
            className="dm-usel-scrim"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div className="dm-usel-menu" role="listbox">
            <button
              type="button"
              className="dm-usel-item"
              role="option"
              aria-selected={usingCustom}
              data-on={usingCustom ? "1" : "0"}
              onClick={() => jump("custom")}
            >
              <span className="dm-usel-mark"><Crest pack="custom" size={13} /></span>
              <span>Custom</span>
            </button>
            {packs.map((p) => (
              <button
                key={p.id}
                type="button"
                className="dm-usel-item"
                role="option"
                aria-selected={!usingCustom && presetId === p.id}
                data-on={!usingCustom && presetId === p.id ? "1" : "0"}
                onClick={() => jump(p.id)}
              >
                <span className="dm-usel-mark"><Crest pack={p.id} size={13} /></span>
                <span>{p.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The universe deck.
 *
 * A horizontal, snapping row of cards — one per board, custom first. Three
 * things make it feel like a deck rather than a scroller:
 *
 *   SNAP. `scroll-snap-type: x mandatory` means a swipe always lands on a card
 *   and never between two, so there is no half-card resting state to tidy up.
 *
 *   ART. Each card wears the curated portrait of its most prominent character.
 *   Those already exist in R2, so the picker costs one batched lookup and no
 *   new images.
 *
 *   FEEDBACK. On a phone, landing on a new card fires a short vibration. It is
 *   the difference between scrolling a list and handling something.
 */
function PackDeck({
  onOpenCustom,
  packs,
  presetId,
  usingCustom,
  customTopic,
  setCustomTopic,
  onPick,
  onContinue,
}: {
  packs: PackSummary[];
  presetId: string | null;
  usingCustom: boolean;
  customTopic: string;
  setCustomTopic: (v: string) => void;
  onOpenCustom: () => void;
  onPick: (id: string) => void;
  onContinue: () => void;
}) {
  const [art, setArt] = useState<Record<string, string | null>>({});
  const railRef = useRef<HTMLDivElement>(null);
  const lastHaptic = useRef<string>("");

  // One request for every card's face. The portraits are curated, so this
  // resolves from the database rather than going out to Google or Fandom.
  useEffect(() => {
    const queries = packs
      .filter((p) => p.heroQuery)
      .map((p) => ({ q: p.heroQuery, name: p.heroName, wiki: p.heroWiki || undefined }));
    if (!queries.length) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/draftmasters/portrait", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ queries }),
        });
        const data = await res.json();
        if (!alive) return;
        const next: Record<string, string | null> = {};
        packs.filter((p) => p.heroQuery).forEach((p, i) => {
          next[p.id] = data?.portraits?.[i]?.url ?? null;
        });
        setArt(next);
      } catch {
        /* the cards fall back to their emoji, which is a fine card */
      }
    })();
    return () => { alive = false; };
  }, [packs]);

  /**
   * A tick when a new card takes the centre.
   *
   * Deliberately gated on which card is centred rather than fired on scroll:
   * buzzing continuously through a swipe is noise, buzzing once on arrival is
   * a detent. Silent on anything without a vibration motor, which includes
   * every desktop browser and iOS Safari.
   */
  const [pickedCustom, setPickedCustom] = useState(false);
  /** Which case is under the middle of the shelf. Drives the dots and the count. */
  const [centred, setCentred] = useState("custom");

  const onScroll = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const mid = rail.scrollLeft + rail.clientWidth / 2;
    let closest = "";
    let best = Infinity;
    for (const el of Array.from(rail.children) as HTMLElement[]) {
      const c = el.offsetLeft + el.offsetWidth / 2;
      const d = Math.abs(c - mid);
      if (d < best) { best = d; closest = el.dataset.card ?? ""; }
    }
    // Which case is centred is set FIRST and unconditionally. The haptic guard
    // below used to `return` on the very first measurement, which was harmless
    // when that measurement came from mount — but the shelf no longer fires one
    // on mount, so the first thing it swallowed was the player's first swipe,
    // and the dots and the count sat on "Custom" while the shelf moved.
    if (closest) setCentred(closest);

    if (closest && closest !== lastHaptic.current) {
      const first = lastHaptic.current === "";
      lastHaptic.current = closest;
      // Silent on arrival at the case you started on; a detent needs a
      // departure to be a detent.
      if (!first) {
        try { navigator.vibrate?.(8); } catch { /* no motor, no problem */ }
        sfx.swipe();
      }
    }
  }, []);


  /**
   * Glide the shelf to a slot.
   *
   * Hand-animated rather than `behavior: "smooth"`, which is silently a no-op
   * in some engines — including the one this was tested in, where `auto`
   * scrolled and `smooth` did nothing at all. The arrows looked broken and the
   * code looked correct, which is the worst combination. One rAF loop works
   * everywhere and lets the easing match the rest of the app.
   */
  const glideTo = useCallback((el: HTMLElement) => {
    const rail = railRef.current;
    if (!rail) return;
    const to = el.offsetLeft + el.offsetWidth / 2 - rail.clientWidth / 2;
    const target = Math.max(0, Math.min(rail.scrollWidth - rail.clientWidth, to));
    const from = rail.scrollLeft;
    const dist = target - from;
    if (Math.abs(dist) < 1) return;

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      rail.scrollLeft = target;
      return;
    }

    const started = performance.now();
    const ms = 380;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / ms);
      rail.scrollLeft = from + dist * ease(t);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, []);

  /** Step one case left or right. */
  const stepCase = useCallback((dir: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;
    const slots = Array.from(rail.children) as HTMLElement[];
    if (!slots.length) return;
    // Index-based rather than a fixed nudge: with mandatory snap the resting
    // position is not a clean multiple of the slot width.
    const mid = rail.scrollLeft + rail.clientWidth / 2;
    let here = 0;
    let best = Infinity;
    slots.forEach((el, i) => {
      const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid);
      if (d < best) { best = d; here = i; }
    });
    const next = Math.max(0, Math.min(slots.length - 1, here + dir));
    if (next === here) return;
    glideTo(slots[next]);
    sfx.swipe();
  }, [glideTo]);

  const jumpToCase = useCallback((id: string) => {
    const el = railRef.current?.querySelector<HTMLElement>(`[data-card="${id}"]`);
    if (!el) return;
    glideTo(el);
    sfx.swipe();
  }, [glideTo]);

  return (
    <div className="dm-deck-wrap">
      <SceneDefs />
      <div className="dm-deck" ref={railRef} onScroll={onScroll}>
        {/* Custom leads: the only pack whose contents do not exist yet, so it
            is the one case with no cover photo. */}
        <div className="dm-case-slot" data-card="custom">
        <button
          type="button"
          className="dm-case dm-case-custom"
          data-on={pickedCustom || usingCustom ? "1" : "0"}
          onClick={() => { setPickedCustom(true); onOpenCustom(); }}
        >
          <span className="dm-case-3d">
            <span className="dm-case-side" aria-hidden="true" />
            <span className="dm-case-top" aria-hidden="true" />
            <span className="dm-case-face">
              <span className="dm-case-plate">
                <Scene pack="custom" className="dm-case-cover" />
                <span className="dm-case-scrim" aria-hidden="true" />
                <span className="dm-case-rule" aria-hidden="true" />
                <span className="dm-case-body">
                  <Crest pack="custom" size={16} className="dm-case-crest" />
                  <span className="dm-case-name">Custom</span>
                  <span className="dm-case-blurb">
                    Pick up to five universes and draft across all of them.
                  </span>
                  <span className="dm-case-draft">DRAFT</span>
                </span>
              </span>
            </span>
          </span>
        </button>
        </div>

        {packs.map((p, i) => (
          <div className="dm-case-slot" key={p.id} data-card={p.id}>
          <button
            type="button"
            className="dm-case"
            data-on={!pickedCustom && !usingCustom && presetId === p.id ? "1" : "0"}
            onClick={() => { setPickedCustom(false); onPick(p.id); }}
          >
            <span className="dm-case-3d">
              <span className="dm-case-side" aria-hidden="true" />
              <span className="dm-case-top" aria-hidden="true" />
              <span className="dm-case-face">
                <span className="dm-case-plate">
                  <Scene pack={p.id} className="dm-case-cover" />
                  <span className="dm-case-scrim" aria-hidden="true" />
                  <span className="dm-case-rule" aria-hidden="true" />
                  <span className="dm-case-body">
                    <Crest pack={p.id} size={16} className="dm-case-crest" />
                    <span className="dm-case-name">{p.name}</span>
                    <span className="dm-case-blurb">{p.blurb}</span>
                    {/* Tapping DRAFT picks the board AND moves on; tapping the
                        case only selects it. Two intentions, two targets. */}
                    <span
                      className="dm-case-draft"
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); setPickedCustom(false); onPick(p.id); onContinue(); }}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter" && e.key !== " ") return;
                        e.preventDefault(); e.stopPropagation();
                        setPickedCustom(false); onPick(p.id); onContinue();
                      }}
                    >
                      DRAFT
                    </span>
                  </span>
                </span>
              </span>
            </span>
          </button>
          </div>
        ))}
      </div>

      {/* With nothing peeking at the edge there is no other sign a second case
          exists, so the shelf says so itself. There is no way to look inside
          one: a sealed case you can read is not sealed, and a lot arriving
          unannounced is most of what the draft is for. */}
      <div className="dm-carousel">
        <button type="button" className="dm-carousel-arrow" data-dir="back"
          aria-label="Previous universe" onClick={() => stepCase(-1)}>
          <Icon name="chevron" size={18} />
        </button>

        {/* Four dots, not twenty-seven. With this many boards a full row stops
            being a position indicator and becomes a decorative smear — it says
            "there are lots" and nothing about where you are. A window of four
            around the current one says both. */}
        <div className="dm-carousel-dots" role="tablist" aria-label="Universes">
          {(() => {
            const ids = ["custom", ...packs.map((p) => p.id)];
            const at = Math.max(0, ids.indexOf(centred));
            const start = Math.max(0, Math.min(ids.length - 4, at - 1));
            return ids.slice(start, start + 4).map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                className="dm-carousel-dot"
                aria-selected={id === centred}
                aria-label={id === "custom" ? "Custom" : packs.find((p) => p.id === id)?.name ?? id}
                onClick={() => jumpToCase(id)}
              />
            ));
          })()}
        </div>

        <button type="button" className="dm-carousel-arrow" data-dir="next"
          aria-label="Next universe" onClick={() => stepCase(1)}>
          <Icon name="chevron" size={18} />
        </button>
      </div>

      <p className="dm-shelf-count">
        {centred === "custom"
          ? "Mix up to five universes"
          : `${packs.find((p) => p.id === centred)?.count ?? 0} characters`}
      </p>

    </div>
  );
}

function SetupScreen({
  standalone,
  packs,
  mixIds,
  setMixIds,
  presetId,
  setPresetId,
  customTopic,
  setCustomTopic,
  variantRate,
  setVariantRate,
  variantWild,
  setVariantWild,
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
  /** DraftMasters' own domain — see the Props note above. */
  standalone: boolean;
  packs: PackSummary[];
  /** Universes chosen on the Custom sheet. One plays alone; several get mixed. */
  mixIds: string[];
  setMixIds: (ids: string[]) => void;
  presetId: string | null;
  setPresetId: (id: string | null) => void;
  customTopic: string;
  setCustomTopic: (s: string) => void;
  variantRate: number;
  setVariantRate: (n: number) => void;
  variantWild: number;
  setVariantWild: (n: number) => void;
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
  /* Custom is no longer a typed topic — it is a mix of several universes.
     One chosen universe becomes an ordinary preset, so only two or more
     counts as custom. */
  const usingCustom = mixIds.length > 1;
  const hasTopic = usingCustom || Boolean(presetId);

  /**
   * The shelf and the settings are two pages, not one page that grows.
   *
   * Revealing four sections under the packs meant picking a universe pushed
   * the shelf up the screen and buried it under dials the player had not
   * asked for yet. Picking is one decision and setting up is another, so they
   * get one screen each: the shelf, then the table.
   */
  const [stage, setStage] = useState<"pick" | "tune">("pick");
  /** The Custom case opens this; it is the only way to build a mixed board. */
  const [customOpen, setCustomOpen] = useState(false);
  const [insideOpen, setInsideOpen] = useState(false);
  const selectedPack = packs.find((p) => p.id === presetId) ?? null;

  return (
    <>
      {error && (
        <div className="dm-error" style={{ marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* The ladder used to sit here, above the shelf — a panel of statistics
          between the player and the thing they came to do, which on a first
          visit read "no games on record yet" and said nothing at all. It moves
          below the packs, where it is a reason to come back rather than an
          obstacle to starting. */}

      {customOpen && (
        <div className="dm-sheet-scrim" role="dialog" aria-modal="true">
          <UniversePicker
            boards={packs.map((b) => ({ id: b.id, name: b.name, count: b.count }))}
            chosen={mixIds}
            onChange={setMixIds}
            onClose={() => setCustomOpen(false)}
            onConfirm={() => {
              setCustomOpen(false);
              // One universe chosen plays as itself, so it is just that board.
              // Two or more is a mix, which has no preset id at all.
              setPresetId(mixIds.length === 1 ? mixIds[0] : null);
              setCustomTopic("");
              setStage("tune");
            }}
          />
        </div>
      )}

      <section className="dm-section">
        {/* ── The deck ─────────────────────────────────────────────────────
            One card per universe, swiped rather than scanned. The old picker
            was a paragraph of prose above a grid of twenty text buttons, which
            asked the player to read the whole board before choosing anything.
            A deck asks them to look. The art is the boards' own most prominent
            character, already curated in R2, so the thing you are choosing
            between looks like the thing you are about to draft.

            Custom leads, because "anything you can type" is the pitch. */}
        <div className="dm-shelf-head" data-hide={stage === "tune" ? "1" : "0"}>
          <UniverseSelect
            packs={packs}
            presetId={presetId}
            usingCustom={usingCustom}
            onPick={(id) => {
              if (id === "custom") return;
              setCustomTopic("");
              // The builder checks mixIds BEFORE presetId, so a mix left over
              // from the last game outranks the board just picked -- which is
              // why choosing Dragon Ball Z kept re-dealing Thrones/Middle-earth.
              setMixIds([]);
              setPresetId(id);
            }}
          />
        </div>
        {stage === "pick" && (
          <PackDeck
            onOpenCustom={() => setCustomOpen(true)}
            packs={packs}
            presetId={presetId}
            usingCustom={usingCustom}
            customTopic={customTopic}
            setCustomTopic={setCustomTopic}
            onContinue={() => setStage("tune")}
            onPick={(id) => {
              setCustomTopic("");
              setMixIds([]);   // see above: a stale mix would win over this pick
              setPresetId(id);
            }}
          />
        )}

      </section>

      {/* ── Everything past this point waits for a universe ─────────────────
          The dials, the budget, the opponent and the name were all on screen
          before the player had chosen anything to apply them to — four
          sections of settings for a draft that did not exist yet, pushing the
          shelf up the page. They open once a pack is picked, so the first
          screen is the shelf and nothing else. */}
      {stage === "tune" && hasTopic && (
        <div className="dm-after-pick">
          <button
            type="button"
            className="dm-back"
            onClick={() => setStage("pick")}
          >
            ← {usingCustom ? "Custom" : packs.find((p) => p.id === presetId)?.name ?? "Change universe"}
          </button>
          <section className="dm-section">
            {/* The numbering started at 2, because this section never had a
                heading -- three steps on the page and only two of them said
                which step they were. */}
            <p className="dm-eyebrow">1 · Variants</p>
            {/* These govern whichever board you picked — a ready-made one
                rolls its authored variants at these settings, a generated one
                is written to them as well. */}
            <VariantDials rate={variantRate} setRate={setVariantRate} wild={variantWild} setWild={setVariantWild} />
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
          You can always bid your whole wallet — go all-in on one pick if you dare. Everyone still finishes with a
          full roster: go broke and you&apos;ll be claiming leftovers for free. No clock: every lot is decided by a
          bid or a pass, never by a timer.
        </p>
      </section>

      {/* The guest-name field is gone with guest play: the page now requires
          an account, so the name on the paddle is the account's. */}
      <section className="dm-section">
        <p className="dm-eyebrow">3 · Who are you drafting against?</p>
        <div className="dm-seg" style={{ marginBottom: 12 }}>
          {NPC_PERSONALITIES.map((p) => (
            <button key={p.id} className="dm-seg-item" data-on={npc.id === p.id ? "1" : "0"} onClick={() => setNpc(p)}>
              <span className="dm-seg-label">
                <Icon name={p.icon} size={15} /> {p.name}
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
            <Icon name="friends" size={16} /> Draft with a friend
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
          Drafting with a friend turns voice on by default, and you can mute anyone from their portrait. Ranked play is
          PvP only; solo games count toward your win/loss.
        </p>
      </section>

          {/* Your record, at the bottom and behind the same gate: on the first
              screen it was a panel reading "no games on record yet", which is
              the emptiest thing the site can say, sitting under the one thing
              that would fix it. */}
          {(record || leaderboard.length > 0) && (
            <section className="dm-section">
              <RecordPanel record={record} leaderboard={leaderboard} meId={meId} />
            </section>
          )}
        </div>
      )}
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
              {record.streak >= 3 && <span><Icon name="flame" size={13} /> {record.streak} in a row</span>}
            </>
          ) : (
            <span className="dm-note">No games on record yet — your first draft starts the ledger.</span>
          )}
        </div>
        {leaderboard.length > 0 && (
          <button className="dm-btn dm-btn-ghost" onClick={() => setOpen((v) => !v)}>
            {open ? "Hide ladder" : <><Icon name="trophy" size={14} /> Ladder</>}
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
  myName,
  myAvatar,
  onInvite,
  packs,
  presetId,
  setPresetId,
  mixIds,
  setMixIds,
  customTopic,
  setCustomTopic,
  variantRate,
  setVariantRate,
  variantWild,
  setVariantWild,
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
  myName: string;
  myAvatar: string | null;
  onInvite: () => void;
  packs: PackSummary[];
  presetId: string | null;
  setPresetId: (id: string | null) => void;
  /** Two or more ids means a mix, which by design has no presetId. */
  mixIds: string[];
  /** Picked again from inside the room, so changing it never leaves. */
  setMixIds: (ids: string[]) => void;
  customTopic: string;
  setCustomTopic: (s: string) => void;
  variantRate: number;
  setVariantRate: (n: number) => void;
  variantWild: number;
  setVariantWild: (n: number) => void;
  rulesIdx: number;
  setRulesIdx: (n: number) => void;
  error: string | null;
  onStart: () => void;
}) {
  const others = members.filter((m) => m.userId !== meId);
  /** The universes being picked in the sheet, or null when it is closed. */
  const [picking, setPicking] = useState<string[] | null>(null);
  const mixing = mixIds.length > 1;
  const hasTopic = mixing || Boolean(presetId);
  const chosen = mixing
    ? mixIds.map((id) => packs.find((p) => p.id === id)?.name ?? id).join(" + ")
    : (packs.find((p) => p.id === presetId)?.name ?? "topic");
  const pool = mixing
    ? mixIds.reduce((n, id) => n + (packs.find((p) => p.id === id)?.count ?? 0), 0)
    : (packs.find((p) => p.id === presetId)?.count ?? 0);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      {error && (
        <div className="dm-error" style={{ marginBottom: 18 }}>
          {error}
        </div>
      )}

      <div className="dm-panel" style={{ marginBottom: 18 }}>
        <p className="dm-eyebrow">The other seat</p>
        {/* The seat is the whole state of this screen: until somebody is in it
            nothing else on the page can happen, so it is the thing that looks
            like it matters rather than a line of small print under a button. */}
        <div className="dm-seat-card" data-filled={others.length ? "1" : "0"}>
          <span className="dm-seat-face">
            {others.length ? <PersonAvatar src={others[0].avatarUrl} seed={others[0].userId} /> : <Icon name="profile" size={18} />}
          </span>
          <span className="dm-seat-who">
            <b>{others.length ? others[0].name : "Nobody yet"}</b>
            <em>{others.length ? "Joined · mic on" : "A draft needs two."}</em>
          </span>
          {others.length ? (
            <span className="dm-seat-dot" aria-label="in the room" />
          ) : (
            <span className="dm-seat-empty">Empty</span>
          )}
        </div>

        {others.length === 0 &&
          (roomCode ? (
            <div style={{ marginTop: 12 }}>
              <RoomCode code={roomCode} onInvite={onInvite} />
            </div>
          ) : (
            <p className="dm-note" style={{ marginTop: 12 }}>Opening room…</p>
          ))}
      </div>

      <div className="dm-panel" style={{ marginBottom: 18 }}>
        <div className="dm-rv-head">
          <p className="dm-eyebrow">
            In the room · {members.length} {members.length === 1 ? "person" : "people"}
          </p>
        </div>
        {others.length === 0 && (
          <p className="dm-note" style={{ marginBottom: 12 }}>
            Just you so far. Voice is on — the moment they join, you can talk.
          </p>
        )}
        <RoomVoice
          members={members}
          meId={meId}
          myName={myName}
          myAvatar={myAvatar}
          media={media}
          chat={chat}
          onSendChat={onSendChat}
          onMicChange={IGNORE}
        />
      </div>

      {isHost ? (
        <div className="dm-panel">
          {/* Change used to send the host back to the shelf to pick again --
              and the shelf is outside the room, so a player changing the
              universe was dropped out of their own room and could not get
              back. It is the same picker the shelf's Custom case uses, opened
              over the room, so the room never goes anywhere. */}
          <p className="dm-eyebrow">The universe</p>
          <div className="dm-room-board">
            {!mixing && presetId ? <Crest pack={presetId} size={22} /> : <Icon name="cards" size={20} />}
            <span className="dm-room-board-who">
              <b>{hasTopic ? chosen : "Nothing picked yet"}</b>
              <em>{hasTopic ? `${pool} characters in the pool` : "Go back and open a case."}</em>
            </span>
            <button
              type="button"
              className="dm-btn dm-btn-ghost"
              onClick={() => setPicking(mixIds.length ? mixIds : presetId ? [presetId] : [])}
            >
              Change
            </button>
          </div>

          {picking && (
            <div className="dm-sheet-scrim" role="dialog" aria-modal="true">
              <UniversePicker
                boards={packs.map((b) => ({ id: b.id, name: b.name, count: b.count }))}
                chosen={picking}
                onChange={setPicking}
                onClose={() => setPicking(null)}
                onConfirm={() => {
                  // Exactly what the shelf does: one universe plays as itself,
                  // two or more are a mix with no preset id.
                  if (picking.length) {
                    setMixIds(picking);
                    setPresetId(picking.length === 1 ? picking[0] : null);
                    setCustomTopic("");
                  }
                  setPicking(null);
                }}
              />
            </div>
          )}

          <VariantDials rate={variantRate} setRate={setVariantRate} wild={variantWild} setWild={setVariantWild} />

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
                ? "Go back and pick a universe"
                : `Start the draft — ${chosen}`}
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

function RoomCode({ code, onInvite }: { code: string; onInvite?: () => void }) {
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
        {/* Friends first: a card in their chat is one tap for them, where a
            link has to be sent somewhere and opened. */}
        {onInvite && (
          <button
            className="dm-btn dm-btn-primary"
            style={{ flex: 1 }}
            onClick={() => {
              sfx.click();
              onInvite();
            }}
          >
            <Icon name="friends" size={14} /> Invite friend
          </button>
        )}
        <button className={onInvite ? "dm-btn" : "dm-btn dm-btn-primary"} style={{ flex: 1 }} onClick={() => void share()}>
          {copied === "link"
              ? <><Icon name="check" size={14} /> Link copied</>
              : <><Icon name="link" size={14} /> Copy invite link</>}
        </button>
      </div>
      <p className="dm-note" style={{ marginTop: 8 }}>
        {onInvite
          ? "Your friend gets a card in their chat that drops them straight into this room. The link does the same for anyone else."
          : "Send them the link and they drop straight into this room — no code to type."}
      </p>
    </div>
  );
}

// ── Prep ─────────────────────────────────────────────────────────────────────

/**
 * The prep screen, reporting what is actually happening.
 *
 * The bar is split by how much each phase really costs, not into equal
 * thirds: building the board is one model call of eight to twenty seconds,
 * finding the portraits is the long tail, and setting the room is instant.
 *
 * Only the portrait phase can report real progress, and it does — resolved
 * against total, counted as each batch lands. The board phase has nothing
 * honest to count, so instead of inventing a number it creeps: a curve that
 * always moves and never quite arrives, so the screen is visibly alive
 * without claiming to know something it does not. The bar also transitions in
 * CSS, so every change glides rather than snapping.
 */
function PrepScreen({
  prep,
  topic,
  isHost,
  roomCode,
  onInvite,
}: {
  prep: PrepState;
  topic: string;
  isHost: boolean;
  roomCode: string | null;
  onInvite?: () => void;
}) {
  /* The board phase gets the first third of the bar; portraits take it to
     94%, and the room closes it out. */
  const BOARD_CEILING = 34;

  const [creep, setCreep] = useState(0);
  useEffect(() => {
    if (prep.phase !== "board") return;
    const started = Date.now();
    const id = setInterval(() => {
      // Approaches the ceiling asymptotically on a ~14s scale: fast at first,
      // slower the longer it takes, never finishing on its own.
      const t = (Date.now() - started) / 14000;
      setCreep(BOARD_CEILING * (1 - Math.exp(-t)));
    }, 120);
    return () => clearInterval(id);
  }, [prep.phase]);

  const pct =
    prep.phase === "board"
      ? creep
      : prep.phase === "portraits"
        ? BOARD_CEILING + (prep.total ? (prep.done / prep.total) * (94 - BOARD_CEILING) : 0)
        : 97;

  const steps = [
    { key: "board", label: "Building the board", done: "Board built" },
    { key: "portraits", label: "Finding the portraits", done: "Portraits loaded" },
    { key: "room", label: "Setting the room", done: "Ready" },
  ] as const;
  const order = { board: 0, portraits: 1, room: 2 } as const;
  const at = order[prep.phase];

  if (!isHost) {
    return (
      <div className="dm-prep">
        <h2 className="dm-h2">Waiting for the host…</h2>
        <p className="dm-tagline">They&apos;re building the board.</p>
        {roomCode && (
          <div style={{ marginTop: 20 }}>
            <RoomCode code={roomCode} onInvite={onInvite} />
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
        {steps.map((st, i) => (
          <div key={st.key} className="dm-step" data-state={at > i ? "done" : at === i ? "active" : "todo"}>
            <span className="dm-step-dot">{at > i ? <Icon name="check" size={11} /> : ""}</span>
            <span>
              {at > i ? st.done : st.label}
              {/* The one honest count on this screen. */}
              {at === i && st.key === "portraits" && prep.total > 0 && (
                <span className="dm-prep-count"> {prep.done} / {prep.total}</span>
              )}
            </span>
          </div>
        ))}
      </div>

      <div className="dm-progress">
        <div className="dm-progress-fill" style={{ width: `${Math.min(100, pct)}%` }} />
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
  myName,
  myAvatar,
  onInvite,
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
  myName: string;
  myAvatar: string | null;
  onInvite: () => void;
}) {
  const waitingForOpponent = mode === "pvp" && sides.length < 2;

  return (
    <div className="dm-prep" style={{ maxWidth: 620 }}>
      <p className="dm-eyebrow">The house is open</p>
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
        {pack?.arenaName && (
          <p style={{ margin: "10px 0 0", fontSize: 13.5 }}>
            <span className="dm-arena-pill"><Icon name="pin" size={13} /> {pack.arenaName}</span>
          </p>
        )}
      </div>

      {waitingForOpponent && roomCode && (
        <>
          <p className="dm-eyebrow" style={{ marginTop: 22 }}>
            Bring in your opponent
          </p>
          <RoomCode code={roomCode} onInvite={onInvite} />
        </>
      )}

      <div className="dm-ready-grid">
        {sides.map((side) => {
          const ready = readyIds.includes(side.id);
          return (
            <div key={side.id} className="dm-ready-card" data-ready={ready ? "1" : "0"}>
              <div className="dm-ready-face">
                {side.isNpc ? <Icon name="bot" size={30} /> : <PersonAvatar src={side.avatarUrl} seed={side.id} />}
              </div>
              <div style={{ fontWeight: 750, marginTop: 6 }}>{side.id === meId ? "You" : side.name}</div>
              <div className="dm-ready-state" style={{ color: ready ? "var(--dm-green)" : "var(--dm-mute)" }}>
                {ready ? "Ready" : "Not ready"}
              </div>
            </div>
          );
        })}
        {waitingForOpponent && (
          <div className="dm-ready-card">
            <div className="dm-ready-face" data-empty="1"><Icon name="profile" size={26} /></div>
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
          <RoomVoice
            members={members}
            meId={meId}
            myName={myName}
            myAvatar={myAvatar}
            media={media}
            chat={chat}
            onSendChat={onSendChat}
            onMicChange={IGNORE}
          />
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

/** Voice panels whose mic changes already reach the room through an effect. */
const IGNORE = () => {};

interface StoredRoom {
  code: string;
  host: boolean;
  at: number;
}

const ROOM_KEY = "dm_room";
/** Older than this and the room itself is long gone; not worth offering. */
const ROOM_TTL_MS = 6 * 60 * 60 * 1000;

function readStoredRoom(): StoredRoom | null {
  try {
    const raw = localStorage.getItem(ROOM_KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as Partial<StoredRoom>;
    if (!r?.code || Date.now() - Number(r.at) > ROOM_TTL_MS) return null;
    return { code: String(r.code), host: Boolean(r.host), at: Number(r.at) };
  } catch {
    return null;
  }
}

function writeStoredRoom(room: StoredRoom | null) {
  try {
    if (room) localStorage.setItem(ROOM_KEY, JSON.stringify(room));
    else localStorage.removeItem(ROOM_KEY);
  } catch {
    /* no storage — the server row still offers the way back */
  }
}

/** Keep ?room= in the address while in a room, so a refresh walks back in. */
function setRoomParam(code: string | null) {
  try {
    const url = new URL(window.location.href);
    if (code) url.searchParams.set("room", code);
    else url.searchParams.delete("room");
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url.href);
  } catch {
    /* the room still works; a refresh just lands on the shelf */
  }
}

/**
 * Should a player walk into this room?
 *
 * Read from the state the server sends on connect, before any join. A seat
 * already holding your id is always yours to come back to.
 */
function judgeRoom(s: Record<string, unknown>, meId: string, asHost: boolean): "ok" | "gone" | "started" {
  const sides = (s.sides as { id: string }[] | undefined) ?? [];
  const members = (s.members as unknown[] | undefined) ?? [];
  if (sides.some((x) => x.id === meId)) return "ok";
  if (!s.hostId && !members.length && !sides.length) return asHost ? "ok" : "gone";
  if (s.phase !== "lobby" && sides.length >= 2) return "started";
  return "ok";
}

/** Joining, why a room could not be joined, or the way back into one. */
function RoomBanner({
  joining,
  notice,
  backTo,
  onRejoin,
  onDismiss,
  onForget,
}: {
  joining: string | null;
  notice: { code: string; kind: "gone" | "started" } | null;
  backTo: { code: string; host: boolean } | null;
  onRejoin: (code: string, host: boolean) => void;
  onDismiss: () => void;
  onForget: () => void;
}) {
  if (joining) {
    return (
      <div className="dm-rejoin" data-kind="joining" role="status">
        <span className="dm-rejoin-mark">
          <span className="dm-spin" aria-hidden="true" />
        </span>
        <span className="dm-rejoin-who">
          <b>Joining room {joining}…</b>
          <em>Checking the room is still open.</em>
        </span>
      </div>
    );
  }
  if (notice) {
    return (
      <div className="dm-rejoin" data-kind="notice" role="status">
        <span className="dm-rejoin-mark">
          <Icon name="cards" size={20} />
        </span>
        <span className="dm-rejoin-who">
          <b>{notice.kind === "gone" ? `Room ${notice.code} has closed` : `Room ${notice.code} already started`}</b>
          <em>
            {notice.kind === "gone"
              ? "Everyone left, so the room is gone. Host a new one and send a fresh invite."
              : "Both seats are taken and the draft is underway. Ask to be invited to the next one."}
          </em>
        </span>
        <button type="button" className="dm-rejoin-x" onClick={onDismiss} aria-label="Dismiss">
          <Icon name="close" size={15} />
        </button>
      </div>
    );
  }
  if (backTo) {
    return (
      <div className="dm-rejoin">
        <span className="dm-rejoin-mark">
          <Icon name="swords" size={20} />
        </span>
        <span className="dm-rejoin-who">
          <b>Back to your game</b>
          <em>
            Room {backTo.code}
            {backTo.host ? " · you're hosting" : ""}
          </em>
        </span>
        <button type="button" className="dm-btn dm-btn-primary" onClick={() => onRejoin(backTo.code, backTo.host)}>
          Rejoin
        </button>
        <button type="button" className="dm-rejoin-x" onClick={onForget} aria-label="Forget this room" title="Forget this room">
          <Icon name="close" size={15} />
        </button>
      </div>
    );
  }
  return null;
}

/** Unambiguous room codes — no O/0/I/1. */
function makeRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}
