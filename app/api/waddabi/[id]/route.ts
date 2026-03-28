/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getWaddabiRoom, getWaddabiPlayers, addWaddabiPlayer, removeWaddabiPlayer,
  updateWaddabiState, setWaddabiRoomStatus
} from "@/lib/db";
import {
  WaddabiState, emptyState, advancePhaseIfNeeded,
  pickThreeWords, checkGuess, Stroke, ChatMsg
} from "@/lib/waddabi-engine";

type DbPlayer = {
  user_id: string;
  username: string;
  avatar: string | null;
  is_bot: boolean;
  bot_type?: string;
};

type DbRoom = {
  id: string;
  name: string;
  host_id: string;
  status: string;
  max_players: number;
  game_state: unknown;
};

function buildMaps(players: DbPlayer[]) {
  const playerNames: Record<string, string> = {};
  players.forEach(p => { playerNames[p.user_id] = p.username; });
  return { playerNames };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const [rawRoom, rawPlayers] = await Promise.all([
    getWaddabiRoom(id).catch(() => null),
    getWaddabiPlayers(id).catch(() => []),
  ]);

  if (!rawRoom) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  const room = rawRoom as unknown as DbRoom;
  if (room.status === "closed") return NextResponse.json({ error: "Room closed" }, { status: 410 });

  const players = rawPlayers as unknown as DbPlayer[];
  const state: WaddabiState = { ...emptyState(), ...(room.game_state as Partial<WaddabiState>) };
  const playerIds = players.map(p => p.user_id);
  const { playerNames } = buildMaps(players);

  const now = Date.now();

  // 1. Advance phase timers
  let advanced = advancePhaseIfNeeded(state, playerIds, playerNames, {}, now);

  // 2. If state changed, persist
  const changed = advanced.phase !== state.phase
    || advanced.currentTurnIdx !== state.currentTurnIdx
    || advanced.guessedThisRound.length !== state.guessedThisRound.length
    || advanced.chatHistory.length !== state.chatHistory.length;

  if (changed) {
    await updateWaddabiState(id, advanced as unknown as Record<string, unknown>).catch(() => {});
  }

  // Sanitize: hide current word from non-drawers
  const drawerIdx = advanced.turnOrder.length > 0
    ? advanced.currentTurnIdx % advanced.turnOrder.length
    : 0;
  const drawerId = advanced.turnOrder[drawerIdx] ?? null;
  const isDrawer = userId === drawerId;
  // For non-drawers: hide the actual word but send its masked shape (underscores + spaces)
  const maskedWord = advanced.currentWord
    ? advanced.currentWord.split("").map(ch => (ch === " " ? " " : "_")).join("")
    : null;
  const sanitized = isDrawer ? advanced : {
    ...advanced,
    currentWord: advanced.phase === "roundEnd" || advanced.phase === "gameOver" ? advanced.currentWord : maskedWord,
    wordChoices: null,
  };

  return NextResponse.json({
    room: { id: room.id, name: room.name, host_id: room.host_id, status: room.status, max_players: room.max_players },
    players,
    state: sanitized,
    isDrawer,
    drawerId,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const u = session.user;
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  const [rawRoom, rawPlayers] = await Promise.all([
    getWaddabiRoom(id).catch(() => null),
    getWaddabiPlayers(id).catch(() => []),
  ]);

  if (!rawRoom) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  const room = rawRoom as unknown as DbRoom;
  const players = rawPlayers as unknown as DbPlayer[];

  const state: WaddabiState = { ...emptyState(), ...(room.game_state as Partial<WaddabiState>) };
  const playerIds = players.filter(p => !p.is_bot).map(p => p.user_id);
  const isHost = String(room.host_id) === String(u.id);
  const uid = u.id!;

  // ── Join ──
  if (action === "join") {
    if (players.find(p => p.user_id === uid)) return NextResponse.json({ ok: true }); // already in
    if (players.length >= room.max_players) return NextResponse.json({ error: "Room full" }, { status: 400 });
    await addWaddabiPlayer(id, uid, u.name ?? "Player", u.image ?? null);
    const newState = { ...state, scores: { ...state.scores, [uid]: state.scores[uid] ?? 0 } };
    await updateWaddabiState(id, newState as unknown as Record<string, unknown>);
    return NextResponse.json({ ok: true });
  }

  // ── Leave ──
  if (action === "leave") {
    await removeWaddabiPlayer(id, uid);
    if (isHost) await setWaddabiRoomStatus(id, "closed");
    return NextResponse.json({ ok: true });
  }

  // ── Start ──
  if (action === "start") {
    if (!isHost) return NextResponse.json({ error: "Host only" }, { status: 403 });
    if (playerIds.length < 2) return NextResponse.json({ error: "Need at least 2 players" }, { status: 400 });

    const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
    const firstDrawer = shuffled[0];
    const { playerNames } = buildMaps(players);
    const scores: Record<string, number> = {};
    playerIds.forEach(pid => { scores[pid] = 0; });

    const sysMsg: ChatMsg = {
      id: Math.random().toString(36).slice(2),
      userId: "system", username: "Wadabbi?!",
      text: `🎨 ${playerNames[firstDrawer] ?? "Player"}'s turn to draw!`,
      isSystem: true, t: Date.now(),
    };

    const now = Date.now();
    const newState: WaddabiState = {
      ...state,
      phase: "choosing",
      turnOrder: shuffled,
      currentTurnIdx: 0,
      currentWord: null,
      wordChoices: pickThreeWords(),
      strokes: [],
      scores,
      guessedThisRound: [],
      phaseStartTime: now,
      chatHistory: [sysMsg],
      roundCount: 1,
      winner: null, winnerName: null,
    };

    await updateWaddabiState(id, newState as unknown as Record<string, unknown>);
    await setWaddabiRoomStatus(id, "playing");
    return NextResponse.json({ ok: true });
  }

  // ── Choose word ──
  if (action === "choose-word") {
    const drawerIdx = state.turnOrder.length > 0
      ? state.currentTurnIdx % state.turnOrder.length
      : 0;
    const drawerId = state.turnOrder[drawerIdx];
    if (uid !== drawerId) return NextResponse.json({ error: "Not your turn" }, { status: 403 });
    if (state.phase !== "choosing") return NextResponse.json({ error: "Not choosing" }, { status: 400 });
    const word = body.word as string;
    if (!state.wordChoices?.includes(word)) return NextResponse.json({ error: "Invalid word" }, { status: 400 });

    const now = Date.now();
    const newState: WaddabiState = {
      ...state,
      phase: "drawing",
      currentWord: word,
      wordChoices: null,
      strokes: [],
      roundStartTime: now,
      phaseStartTime: now,
      guessedThisRound: [],
    };
    await updateWaddabiState(id, newState as unknown as Record<string, unknown>);
    return NextResponse.json({ ok: true });
  }

  // ── Stroke ──
  if (action === "stroke") {
    const drawerIdx = state.turnOrder.length > 0
      ? state.currentTurnIdx % state.turnOrder.length
      : 0;
    const drawerId = state.turnOrder[drawerIdx];
    if (uid !== drawerId) return NextResponse.json({ error: "Not drawing" }, { status: 403 });
    if (state.phase !== "drawing") return NextResponse.json({ error: "Not drawing phase" }, { status: 400 });
    const stroke = body.stroke as Stroke;
    if (!stroke?.points?.length) return NextResponse.json({ error: "Invalid stroke" }, { status: 400 });
    const newState = { ...state, strokes: [...state.strokes, stroke] };
    await updateWaddabiState(id, newState as unknown as Record<string, unknown>);
    return NextResponse.json({ ok: true });
  }

  // ── Clear ──
  if (action === "clear") {
    const drawerIdx = state.turnOrder.length > 0
      ? state.currentTurnIdx % state.turnOrder.length
      : 0;
    const drawerId = state.turnOrder[drawerIdx];
    if (uid !== drawerId) return NextResponse.json({ error: "Not drawing" }, { status: 403 });
    const newState = { ...state, strokes: [] };
    await updateWaddabiState(id, newState as unknown as Record<string, unknown>);
    return NextResponse.json({ ok: true });
  }

  // ── Guess ──
  if (action === "guess") {
    const drawerIdx = state.turnOrder.length > 0
      ? state.currentTurnIdx % state.turnOrder.length
      : 0;
    const drawerUserId = state.turnOrder[drawerIdx];
    if (uid === drawerUserId) return NextResponse.json({ error: "Drawers can't guess" }, { status: 400 });
    if (state.phase !== "drawing") return NextResponse.json({ ok: true, correct: false });
    if (state.guessedThisRound.includes(uid)) return NextResponse.json({ ok: true, correct: false, alreadyGuessed: true });

    const guessText = (body.text as string ?? "").trim();
    if (!guessText) return NextResponse.json({ ok: true, correct: false });

    const correct = state.currentWord ? checkGuess(guessText, state.currentWord) : false;
    const now = Date.now();
    const username = u.name ?? "Player";

    const chatMsg: ChatMsg = {
      id: Math.random().toString(36).slice(2),
      userId: uid,
      username,
      text: correct ? `✅ ${username} guessed it!` : guessText,
      isCorrect: correct,
      t: now,
    };

    let newState = { ...state, chatHistory: [...state.chatHistory.slice(-80), chatMsg] };

    if (correct) {
      // Flat +1 for guesser, +1 for drawer
      newState = {
        ...newState,
        scores: {
          ...newState.scores,
          [uid]: (newState.scores[uid] ?? 0) + 1,
          ...(drawerUserId ? { [drawerUserId]: (newState.scores[drawerUserId] ?? 0) + 1 } : {}),
        },
        guessedThisRound: [...newState.guessedThisRound, uid],
      };

      // Round ends IMMEDIATELY on first correct guess
      const endMsg: ChatMsg = {
        id: Math.random().toString(36).slice(2),
        userId: "system",
        username: "Wadabbi?!",
        text: `🎉 "${state.currentWord}" — ${username} got it!`,
        isSystem: true,
        t: now + 1,
      };
      newState = {
        ...newState,
        phase: "roundEnd",
        phaseStartTime: now,
        chatHistory: [...newState.chatHistory, endMsg],
      };
    }

    await updateWaddabiState(id, newState as unknown as Record<string, unknown>);
    return NextResponse.json({ ok: true, correct });
  }

  // ── Chat ──
  if (action === "chat") {
    const text = (body.text as string ?? "").slice(0, 200);
    if (!text) return NextResponse.json({ ok: true });
    const msg: ChatMsg = {
      id: Math.random().toString(36).slice(2),
      userId: uid,
      username: u.name ?? "Player",
      text,
      t: Date.now(),
    };
    const newState = { ...state, chatHistory: [...state.chatHistory.slice(-80), msg] };
    await updateWaddabiState(id, newState as unknown as Record<string, unknown>);
    return NextResponse.json({ ok: true });
  }

  // ── Play again ──
  if (action === "play-again") {
    if (!isHost) return NextResponse.json({ error: "Host only" }, { status: 403 });
    const scores: Record<string, number> = {};
    playerIds.forEach(pid => { scores[pid] = 0; });
    const newState: WaddabiState = {
      ...emptyState(),
      phase: "lobby",
      scores,
      phaseStartTime: Date.now(),
    };
    await updateWaddabiState(id, newState as unknown as Record<string, unknown>);
    await setWaddabiRoomStatus(id, "waiting");
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rawRoom = await getWaddabiRoom(id).catch(() => null);
  if (!rawRoom) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const room = rawRoom as unknown as DbRoom;
  if (String(room.host_id) !== String(session.user.id)) return NextResponse.json({ error: "Host only" }, { status: 403 });
  await setWaddabiRoomStatus(id, "closed");
  return NextResponse.json({ ok: true });
}
