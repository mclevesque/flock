import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getPokerRoom, getPokerPlayers, addPokerPlayer, removePokerPlayer,
  updatePokerState, updatePokerPlayerChips, updatePokerPlayerChipsAndStatus,
  setPokerRoomStatus, addBotToPokerRoom, cleanupIdlePokerRooms,
} from "@/lib/db";
import {
  GameState, PokerPlayer, PlayerAction, startHand, processAction,
  applyTimeout, shouldStartNewHand, declareGameWinner, emptyState, botDecide,
} from "@/lib/poker-engine";

type Params = { params: Promise<{ id: string }> };

const BOT_PERSONAS = [
  { name: "Chip Ace",    seed: "chipace"     },
  { name: "Lucky Lady",  seed: "luckylady"   },
  { name: "Iron Mike",   seed: "ironmike"    },
  { name: "The Shark",   seed: "theshark"    },
  { name: "Cowboy Carl", seed: "cowboycarl"  },
  { name: "Bluffmaster", seed: "bluffmaster" },
  { name: "Poker Pete",  seed: "pokerpete"   },
  { name: "Lady Luck",   seed: "ladyluck"    },
];

function botAvatar(seed: string) {
  return `https://api.dicebear.com/9.x/pixel-art/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9&beardProbability=40`;
}

async function tickState(
  roomId: string,
  state: GameState,
  pp: PokerPlayer[],
): Promise<{ state: GameState; chipDeltas: Record<string, number> }> {
  let chipDeltas: Record<string, number> = {};

  // Auto-timeout
  if (state.phase !== "waiting" && state.phase !== "showdown") {
    const tr = applyTimeout(state, pp);
    if (tr.state !== state) {
      state = tr.state;
      for (const [k, v] of Object.entries(tr.chipDeltas)) chipDeltas[k] = (chipDeltas[k] ?? 0) + v;
    }
  }

  // Auto-start new hand after showdown delay
  if (shouldStartNewHand(state)) {
    const active = pp.filter(p => p.chips > 0 && p.status === "active");
    if (active.length >= 2) {
      state = startHand(state, active);
    } else {
      // Only 1 player with chips — game over, declare winner
      state = declareGameWinner(state, pp);
    }
  }

  // Process bot turns (up to 8 consecutive bot actions)
  for (let i = 0; i < 8; i++) {
    const actionOn = state.actionOn;
    if (!actionOn || state.phase === "waiting" || state.phase === "showdown") break;

    const botPlayer = pp.find(p => p.user_id === actionOn && (p as unknown as { is_bot: boolean }).is_bot);
    if (!botPlayer) break; // Not a bot's turn

    // Check 800ms minimum think delay
    const decision = botDecide(state, pp, actionOn);
    if (!decision) break;

    const result = processAction(state, pp, actionOn, decision.action as PlayerAction, decision.amount);
    state = result.state;

    // Apply chip deltas to in-memory players
    pp = pp.map(p => ({
      ...p,
      chips: Math.max(0, p.chips + (result.chipDeltas[p.user_id] ?? 0)),
    }));

    for (const [k, v] of Object.entries(result.chipDeltas)) chipDeltas[k] = (chipDeltas[k] ?? 0) + v;

    // Auto-start new hand after bot action causes showdown
    if (shouldStartNewHand(state)) {
      const active = pp.filter(p => p.chips > 0 && p.status === "active");
      if (active.length >= 2) state = startHand(state, active);
      else state = declareGameWinner(state, pp);
    }
  }

  return { state, chipDeltas };
}

// GET — return sanitized game state
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id ?? null;

  // Fire-and-forget idle cleanup (no await — doesn't slow response)
  cleanupIdlePokerRooms().catch(() => {});

  try {
    const [room, players] = await Promise.all([getPokerRoom(id), getPokerPlayers(id)]);
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    let state = room.game_state as GameState;
    const pp = players as unknown as PokerPlayer[];

    const { state: ticked, chipDeltas } = await tickState(id, state, pp);
    const mutated = ticked !== state;
    state = ticked;

    if (mutated) {
      await updatePokerState(id, state as unknown as Record<string, unknown>);
      for (const [uid, delta] of Object.entries(chipDeltas)) {
        const p = pp.find(pl => pl.user_id === uid);
        if (p) await updatePokerPlayerChips(id, uid, Math.max(0, p.chips + delta));
      }
    }

    // Sanitize: hide opponents' hole cards unless showdown
    const sanitized: GameState = JSON.parse(JSON.stringify(state));
    if (sanitized.hands && state.phase !== "showdown") {
      for (const uid of Object.keys(sanitized.hands)) {
        if (uid !== userId) sanitized.hands[uid] = ["??", "??"];
      }
    }

    return NextResponse.json({
      room: {
        id: room.id, name: room.name, status: room.status,
        max_players: Number(room.max_players), buy_in: Number(room.buy_in),
        host_id: room.host_id,
      },
      players: pp.map(p => ({
        user_id: p.user_id,
        username: p.username,
        avatar_url: (p as unknown as { bot_avatar?: string }).bot_avatar ?? p.avatar_url,
        seat: Number(p.seat),
        chips: Number(p.chips),
        status: p.status,
        is_bot: !!(p as unknown as { is_bot?: boolean }).is_bot,
      })),
      state: sanitized,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST — player actions
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const body = await req.json().catch(() => ({}));
  const { action, amount, botId } = body as { action: string; amount?: number; botId?: string };

  try {
    const [room, players] = await Promise.all([getPokerRoom(id), getPokerPlayers(id)]);
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    let pp = players as unknown as PokerPlayer[];
    let state = room.game_state as GameState;

    // ── Join / Leave / Start ──
    if (action === "join") {
      const buyIn = Number(room.buy_in);
      if (pp.length >= Number(room.max_players)) return NextResponse.json({ error: "Table full" }, { status: 400 });
      if (pp.find(p => p.user_id === userId)) return NextResponse.json({ error: "Already seated" }, { status: 400 });
      await addPokerPlayer(id, userId, buyIn);
      return NextResponse.json({ ok: true });
    }

    if (action === "leave") {
      await removePokerPlayer(id, userId);
      const remaining = pp.filter(p => p.user_id !== userId);
      if (remaining.length === 0) await setPokerRoomStatus(id, "finished");
      return NextResponse.json({ ok: true });
    }

    if (action === "start") {
      if (String(room.host_id) !== userId) return NextResponse.json({ error: "Only host can start" }, { status: 403 });
      if (pp.length < 2) return NextResponse.json({ error: "Need at least 2 players" }, { status: 400 });
      const fresh = startHand(state, pp);
      await updatePokerState(id, fresh as unknown as Record<string, unknown>);
      await setPokerRoomStatus(id, "playing");
      return NextResponse.json({ ok: true });
    }

    if (action === "new-game") {
      if (String(room.host_id) !== userId) return NextResponse.json({ error: "Only host can start a new game" }, { status: 403 });
      const buyIn = Number(room.buy_in);
      // Reset all players to buy_in chips and active status
      await Promise.all(pp.map(p => updatePokerPlayerChipsAndStatus(id, p.user_id, buyIn, "active")));
      // Keep champion/gameWins, clear everything else
      const freshState: GameState = {
        ...emptyState(),
        championId: state.championId ?? null,
        gameWins: state.gameWins ?? {},
      };
      const freshPp = pp.map(p => ({ ...p, chips: buyIn, status: "active" }));
      const newHandState = startHand(freshState, freshPp);
      await updatePokerState(id, newHandState as unknown as Record<string, unknown>);
      await setPokerRoomStatus(id, "playing");
      return NextResponse.json({ ok: true });
    }

    if (action === "sit-down") {
      const player = pp.find(p => p.user_id === userId);
      if (!player) return NextResponse.json({ error: "Not at this table" }, { status: 400 });
      if (player.chips > 0) return NextResponse.json({ error: "You still have chips" }, { status: 400 });
      if (state.phase !== "waiting") return NextResponse.json({ error: "Can only rejoin between games" }, { status: 400 });
      const buyIn = Number(room.buy_in);
      await updatePokerPlayerChipsAndStatus(id, userId, buyIn, "active");
      return NextResponse.json({ ok: true });
    }

    // ── Bot management (host only) ──
    if (action === "add-bot") {
      if (String(room.host_id) !== userId) return NextResponse.json({ error: "Only host can add bots" }, { status: 403 });
      if (pp.length >= Number(room.max_players)) return NextResponse.json({ error: "Table full" }, { status: 400 });

      // Find which personas are already seated
      const usedSeeds = new Set(
        pp
          .filter(p => (p as unknown as { is_bot?: boolean }).is_bot)
          .map(p => {
            const parts = p.user_id.split(":");
            return parts[1] ?? "";
          })
      );

      const persona = BOT_PERSONAS.find(b => !usedSeeds.has(b.seed));
      if (!persona) return NextResponse.json({ error: "No more bot personas available" }, { status: 400 });

      const newBotId = `bot:${persona.seed}:${id}`;
      const buyIn = Number(room.buy_in);
      await addBotToPokerRoom(id, newBotId, persona.name, botAvatar(persona.seed), buyIn);
      return NextResponse.json({ ok: true, botId: newBotId, botName: persona.name });
    }

    if (action === "remove-bot") {
      if (String(room.host_id) !== userId) return NextResponse.json({ error: "Only host can remove bots" }, { status: 403 });
      if (!botId) return NextResponse.json({ error: "botId required" }, { status: 400 });

      const bot = pp.find(p => p.user_id === botId && (p as unknown as { is_bot?: boolean }).is_bot);
      if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

      await removePokerPlayer(id, botId);
      return NextResponse.json({ ok: true });
    }

    // ── Chat message (persisted in game_state.chatHistory) ──
    if (action === "chat") {
      const msg = (body as { message?: string }).message?.trim().slice(0, 150);
      if (!msg) return NextResponse.json({ error: "Empty message" }, { status: 400 });
      const username = (session.user as { name?: string | null }).name ?? "Player";
      const extState = state as unknown as { chatHistory?: { user: string; msg: string; id: string }[] };
      const history = extState.chatHistory ?? [];
      const newEntry = { user: username, msg, id: `${Date.now()}_${userId.slice(-4)}` };
      const newHistory = [...history.slice(-49), newEntry];
      (state as unknown as { chatHistory: typeof newHistory }).chatHistory = newHistory;
      await updatePokerState(id, state as unknown as Record<string, unknown>);
      return NextResponse.json({ ok: true });
    }

    // ── Speaking status (mic indicator) ──
    if (action === "speaking") {
      const isSpeaking = !!(body as { isSpeaking?: boolean }).isSpeaking;
      const extState = state as unknown as { speakingPlayers?: Record<string, number> };
      const sp = extState.speakingPlayers ?? {};
      if (isSpeaking) {
        sp[userId] = Date.now();
      } else {
        delete sp[userId];
      }
      (state as unknown as { speakingPlayers: typeof sp }).speakingPlayers = sp;
      await updatePokerState(id, state as unknown as Record<string, unknown>);
      return NextResponse.json({ ok: true });
    }

    // ── Game actions ──
    const validActions: PlayerAction[] = ["fold", "check", "call", "raise", "allin"];
    if (!validActions.includes(action as PlayerAction)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const player = pp.find(p => p.user_id === userId);
    if (!player) return NextResponse.json({ error: "Not seated at this table" }, { status: 403 });
    if (state.actionOn !== userId) return NextResponse.json({ error: "Not your turn" }, { status: 400 });

    const result = processAction(state, pp, userId, action as PlayerAction, amount ?? 0);
    state = result.state;

    // Apply chip deltas to in-memory players
    pp = pp.map(p => ({
      ...p,
      chips: Math.max(0, p.chips + (result.chipDeltas[p.user_id] ?? 0)),
    }));

    // Persist chip changes from human action
    for (const [uid, delta] of Object.entries(result.chipDeltas)) {
      const p = (players as unknown as PokerPlayer[]).find(pl => pl.user_id === uid);
      if (p) await updatePokerPlayerChips(id, uid, Math.max(0, Number(p.chips) + delta));
    }

    // Auto-start new hand after showdown
    if (shouldStartNewHand(state)) {
      const active = pp.filter(p => p.chips > 0 && p.status === "active");
      if (active.length >= 2) state = startHand(state, active);
    }

    // Now tick bots
    const { state: ticked, chipDeltas: botDeltas } = await tickState(id, state, pp);
    state = ticked;

    await updatePokerState(id, state as unknown as Record<string, unknown>);

    // Persist bot chip deltas
    const freshPlayers = await getPokerPlayers(id) as unknown as PokerPlayer[];
    for (const [uid, delta] of Object.entries(botDeltas)) {
      const p = freshPlayers.find(pl => pl.user_id === uid);
      if (p) await updatePokerPlayerChips(id, uid, Math.max(0, Number(p.chips) + delta));
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE — host closes / removes the room
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  try {
    const room = await getPokerRoom(id);
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
    if (String(room.host_id) !== userId) return NextResponse.json({ error: "Only the host can close this room" }, { status: 403 });

    await setPokerRoomStatus(id, "closed");
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
