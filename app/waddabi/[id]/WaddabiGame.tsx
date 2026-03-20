"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import InviteViaDm from "@/app/components/InviteViaDm";

// ─── Types ─────────────────────────────────────────────────────────────────

interface Point { x: number; y: number; }

interface Stroke {
  id: string;
  points: Point[];
  color: string;
  size: number;
  t: number;
}

interface ChatMsg {
  id: string;
  userId: string;
  username: string;
  text: string;
  isCorrect?: boolean;
  isSystem?: boolean;
  t: number;
}

interface WaddabiState {
  phase: "lobby" | "choosing" | "drawing" | "roundEnd" | "gameOver";
  turnOrder: string[];
  currentTurnIdx: number;
  currentWord: string | null;
  wordChoices: string[] | null;
  strokes: Stroke[];
  scores: Record<string, number>;
  guessedThisRound: string[];
  roundStartTime: number;
  phaseStartTime: number;
  chatHistory: ChatMsg[];
  roundCount: number;
  targetScore: number;
  winner: string | null;
  winnerName: string | null;
  roundDuration: number;
  choosingDuration: number;
}

interface Player {
  user_id: string;
  username: string;
  avatar: string | null;
  is_bot: boolean;
  bot_type?: string;
}

interface Room {
  id: string;
  name: string;
  host_id: string;
  status: string;
  max_players: number;
}

interface Props {
  roomId: string;
  initialRoom: Room;
  initialPlayers: Player[];
  sessionUserId: string | null;
  sessionUsername: string;
  sessionImage: string | null;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const COLORS = [
  "#1a1a1a", "#ffffff", "#e74c3c", "#e67e22", "#f1c40f",
  "#2ecc71", "#3498db", "#9b59b6", "#e91e8c", "#8B4513",
  "#95a5a6", "#1a237e",
];

const BRUSH_SIZES = [3, 8, 16];

// ─── Drawing helpers ────────────────────────────────────────────────────────

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (!stroke.points.length) return;
  ctx.beginPath();
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (stroke.points.length === 1) {
    ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.size / 2, 0, Math.PI * 2);
    ctx.fillStyle = stroke.color;
    ctx.fill();
  } else {
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
  }
}

function wordMask(word: string, elapsed: number): string {
  if (!word) return "";
  const showHint = elapsed > 30000;
  return word.split("").map((ch, i) => {
    if (ch === " ") return "  ";
    if (i === 0 && showHint) return ch.toUpperCase();
    return "_";
  }).join(" ");
}

function getCanvasPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number): Point {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function WaddabiGame({ roomId, initialRoom, initialPlayers, sessionUserId, sessionUsername, sessionImage }: Props) {
  const router = useRouter();

  const [room, setRoom] = useState<Room>(initialRoom);
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [state, setState] = useState<WaddabiState | null>(null);
  const [isDrawer, setIsDrawer] = useState(false);
  const [drawerId, setDrawerId] = useState<string | null>(null);

  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);

  const [color, setColor] = useState(COLORS[0]);
  const [brushSize, setBrushSize] = useState(BRUSH_SIZES[0]);

  const [timerPct, setTimerPct] = useState(1);
  const [timeLeft, setTimeLeft] = useState(0);

  const [confetti, setConfetti] = useState<Array<{ id: number; x: number; y: number; color: string; angle: number; speed: number }>>([]);
  const confettiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [copyDone, setCopyDone] = useState(false);
  const [joined, setJoined] = useState(() =>
    initialPlayers.some(p => p.user_id === sessionUserId)
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const currentStrokePointsRef = useRef<Point[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef<WaddabiState | null>(null);

  const isHost = sessionUserId !== null && String(room.host_id) === String(sessionUserId);

  // ─── Canvas: full redraw from scratch ──────────────────────────────────

  const redrawAll = useCallback((strokes: Stroke[], roundStartTime: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const elapsed = Date.now() - roundStartTime;
    for (const stroke of strokes) {
      if (stroke.t > elapsed) continue; // bot stroke not yet due
      drawStroke(ctx, stroke);
    }
  }, []);

  // White canvas init
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  // ─── Bot stroke animation loop ────────────────────────────────────────
  // When in drawing phase with bot strokes that have t > 0, we need to
  // continuously redraw as time passes so strokes appear at their scheduled time.

  useEffect(() => {
    if (!state || state.phase !== "drawing") return;
    const hasBotStrokes = state.strokes.some(s => s.t > 0);
    if (!hasBotStrokes) return;

    const interval = setInterval(() => {
      const s = stateRef.current;
      if (s && s.phase === "drawing") {
        redrawAll(s.strokes, s.roundStartTime);
      }
    }, 250);
    return () => clearInterval(interval);
  }, [state?.phase, state?.strokes?.length, state?.roundStartTime, redrawAll]);

  // Keep stateRef in sync
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ─── Auto-join if visiting via invite link ───────────────────────────

  useEffect(() => {
    if (!sessionUserId) return;
    if (joined) return;
    // Auto-join if room has space
    fetch(`/api/waddabi/${roomId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join" }),
    }).then(r => r.json()).then(d => {
      if (d.ok) setJoined(true);
    }).catch(() => {});
  }, [sessionUserId, roomId, joined]);

  // ─── API polling ──────────────────────────────────────────────────────

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`/api/waddabi/${roomId}`, { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 410 || res.status === 404) router.push("/waddabi");
        return;
      }
      const data = await res.json();
      setRoom(data.room);
      setPlayers(data.players);
      setIsDrawer(data.isDrawer);
      setDrawerId(data.drawerId);

      const newState: WaddabiState = data.state;
      setState(prev => {
        const phaseChanged = prev?.phase !== newState.phase || prev?.currentTurnIdx !== newState.currentTurnIdx;
        const strokesCleared = (newState.strokes?.length ?? 0) < (prev?.strokes?.length ?? 0);

        if (phaseChanged || strokesCleared) {
          requestAnimationFrame(() => {
            if (["drawing", "roundEnd", "gameOver"].includes(newState.phase)) {
              redrawAll(newState.strokes, newState.roundStartTime);
            } else {
              const cv = canvasRef.current;
              if (cv) {
                const ctx2 = cv.getContext("2d");
                if (ctx2) { ctx2.fillStyle = "#fff"; ctx2.fillRect(0, 0, cv.width, cv.height); }
              }
            }
          });
        } else if ((newState.strokes?.length ?? 0) > (prev?.strokes?.length ?? 0)) {
          // New human strokes: incremental render
          requestAnimationFrame(() => redrawAll(newState.strokes, newState.roundStartTime));
        }
        return newState;
      });
    } catch {
      // ignore
    }
  }, [roomId, router, redrawAll]);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 700);
    pollRef.current = interval;
    return () => clearInterval(interval);
  }, [fetchState]);

  // ─── Timer display ────────────────────────────────────────────────────

  useEffect(() => {
    if (!state) return;
    const tick = () => {
      const now = Date.now();
      if (state.phase === "drawing") {
        const elapsed = now - state.roundStartTime;
        const remaining = Math.max(0, state.roundDuration - elapsed);
        setTimerPct(remaining / state.roundDuration);
        setTimeLeft(Math.ceil(remaining / 1000));
      } else if (state.phase === "choosing") {
        const elapsed = now - state.phaseStartTime;
        const remaining = Math.max(0, state.choosingDuration - elapsed);
        setTimerPct(remaining / state.choosingDuration);
        setTimeLeft(Math.ceil(remaining / 1000));
      } else {
        setTimerPct(1);
        setTimeLeft(0);
      }
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [state]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state?.chatHistory]);

  // Confetti on game over
  useEffect(() => {
    if (state?.phase === "gameOver") {
      const pieces = Array.from({ length: 40 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: -10 - Math.random() * 40,
        color: ["#a855f7", "#ec4899", "#f97316", "#f1c40f", "#2ecc71", "#3498db"][i % 6],
        angle: Math.random() * 360,
        speed: 1 + Math.random() * 2,
      }));
      setConfetti(pieces);
      if (confettiTimerRef.current) clearTimeout(confettiTimerRef.current);
      confettiTimerRef.current = setTimeout(() => setConfetti([]), 5000);
    } else {
      setConfetti([]);
    }
  }, [state?.phase]);

  // ─── Canvas drawing handlers ──────────────────────────────────────────

  function startStroke(x: number, y: number) {
    if (!isDrawer || state?.phase !== "drawing") return;
    isDrawingRef.current = true;
    currentStrokePointsRef.current = [{ x, y }];
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.moveTo(x, y);
  }

  function continueStroke(x: number, y: number) {
    if (!isDrawingRef.current) return;
    currentStrokePointsRef.current.push({ x, y });
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  async function endStroke() {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const pts = currentStrokePointsRef.current;
    currentStrokePointsRef.current = [];
    if (!pts.length) return;
    const stroke: Stroke = {
      id: Math.random().toString(36).slice(2),
      points: pts,
      color,
      size: brushSize,
      t: 0,
    };
    try {
      await fetch(`/api/waddabi/${roomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stroke", stroke }),
      });
    } catch { /* ignore */ }
  }

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    startStroke(...[getCanvasPoint(canvas, e.clientX, e.clientY)].map(p => [p.x, p.y])[0] as [number, number]);
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pt = getCanvasPoint(canvas, e.clientX, e.clientY);
    continueStroke(pt.x, pt.y);
  }

  function onTouchStart(e: React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const touch = e.touches[0];
    const pt = getCanvasPoint(canvas, touch.clientX, touch.clientY);
    startStroke(pt.x, pt.y);
  }

  function onTouchMove(e: React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const touch = e.touches[0];
    const pt = getCanvasPoint(canvas, touch.clientX, touch.clientY);
    continueStroke(pt.x, pt.y);
  }

  // ─── Actions ──────────────────────────────────────────────────────────

  async function doAction(action: string, extra: Record<string, unknown> = {}) {
    try {
      await fetch(`/api/waddabi/${roomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      fetchState();
    } catch { /* ignore */ }
  }

  async function handleClear() {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    }
    await doAction("clear");
  }

  async function handleSend() {
    const text = chatInput.trim();
    if (!text || sending) return;
    setChatInput("");
    setSending(true);
    try {
      const action = state?.phase === "drawing" && !isDrawer ? "guess" : "chat";
      await fetch(`/api/waddabi/${roomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, text }),
      });
      fetchState();
    } catch { /* ignore */ }
    finally { setSending(false); }
  }

  async function handleLeave() {
    await doAction("leave");
    router.push("/waddabi");
  }

  function copyInviteLink() {
    const url = `${window.location.origin}/waddabi/${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  function getDrawerName() {
    if (!drawerId) return "someone";
    return players.find(p => p.user_id === drawerId)?.username ?? "someone";
  }

  function alreadyGuessed() {
    if (!sessionUserId || !state) return false;
    return state.guessedThisRound.includes(sessionUserId);
  }

  const timerColor = timerPct > 0.5 ? "#4ade80" : timerPct > 0.25 ? "#fbbf24" : "#f87171";
  const phase = state?.phase ?? "lobby";
  const isGuessInput = phase === "drawing" && !isDrawer && !alreadyGuessed();

  // ─── Phase overlays ────────────────────────────────────────────────────

  function LobbyOverlay() {
    const inviteUrl = typeof window !== "undefined" ? `${window.location.origin}/waddabi/${roomId}` : "";
    return (
      <div style={{ position: "absolute", inset: 0, background: "rgba(10,10,20,0.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "14px", zIndex: 10, borderRadius: "10px" }}>
        {/* Branding */}
        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <div style={{ fontSize: "2.8rem", fontWeight: 900, background: "linear-gradient(135deg, #a855f7, #ec4899, #f97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", letterSpacing: "-1px" }}>
            Wadabbi?!
          </div>
          <div style={{ color: "#5a4a7e", fontSize: "0.8rem", letterSpacing: "0.15em", marginTop: 2 }}>DRAW IT · GUESS IT · WIN IT</div>
        </div>

        <div style={{ color: "#7a6a9e", fontSize: "0.9rem" }}>
          {players.length} / {room.max_players} players joined
        </div>

        {/* Player avatars */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center", maxWidth: "320px" }}>
          {players.map(p => (
            <div key={p.user_id} style={{ textAlign: "center" }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#2a1a4e", border: "2px solid #4a2a7e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", overflow: "hidden" }}>
                {p.avatar ? <img src={p.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (p.is_bot ? "🤖" : "🎮")}
              </div>
              <div style={{ fontSize: "0.65rem", color: "#7a6a9e", marginTop: 2, maxWidth: 40, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.username}</div>
            </div>
          ))}
        </div>

        {/* Invite link */}
        <div style={{ background: "#0d0b1e", border: "1px solid #2a1a4e", borderRadius: "10px", padding: "10px 16px", width: "100%", maxWidth: "300px", textAlign: "center" }}>
          <div style={{ fontSize: "0.72rem", color: "#5a4a7e", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Invite Friends</div>
          <InviteViaDm gameTag="waddabi" gameId={roomId} label="📨 Invite to Game" style={{ width: "100%" }} />
        </div>

        {isHost && (
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
            <button
              onClick={() => doAction("add-bot")}
              disabled={players.length >= room.max_players}
              style={{ background: "#2a1a4e", color: "#a855f7", border: "1px solid #4a2a7e", borderRadius: "10px", padding: "10px 20px", cursor: "pointer", fontWeight: 600, fontSize: "0.9rem", opacity: players.length >= room.max_players ? 0.5 : 1 }}
            >
              🤖 Add Bot
            </button>
            <button
              onClick={() => doAction("start")}
              disabled={players.length < 2}
              style={{ background: players.length >= 2 ? "linear-gradient(135deg, #7c3aed, #a855f7)" : "#2a1a4e", color: "#fff", border: "none", borderRadius: "10px", padding: "10px 24px", cursor: players.length >= 2 ? "pointer" : "not-allowed", fontWeight: 700, fontSize: "1rem", opacity: players.length < 2 ? 0.5 : 1 }}
            >
              🚀 Start Game
            </button>
          </div>
        )}
        {!isHost && <div style={{ color: "#5a4a7e", fontSize: "0.85rem" }}>Waiting for host to start...</div>}

        {/* Remove bots */}
        {isHost && players.some(p => p.is_bot) && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center", maxWidth: "300px" }}>
            {players.filter(p => p.is_bot).map(bot => (
              <button
                key={bot.user_id}
                onClick={() => doAction("remove-bot", { botId: bot.user_id })}
                style={{ background: "#1e1640", border: "1px solid #3d2a6e", borderRadius: "20px", color: "#9b8bc4", padding: "4px 12px", fontSize: "0.78rem", cursor: "pointer" }}
              >
                {bot.username} ✕
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  function ChoosingOverlay() {
    if (!state) return null;
    if (isDrawer && state.wordChoices) {
      return (
        <div style={{ position: "absolute", inset: 0, background: "rgba(10,10,20,0.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", zIndex: 10, borderRadius: "10px" }}>
          <div style={{ fontWeight: 800, fontSize: "1.2rem", marginBottom: "4px" }}>Choose your word!</div>
          <div style={{ color: "#7a6a9e", fontSize: "0.85rem", marginBottom: "8px" }}>You have {timeLeft}s</div>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
            {state.wordChoices.map(w => (
              <button
                key={w}
                onClick={() => doAction("choose-word", { word: w })}
                style={{ background: "linear-gradient(135deg, #1e1640, #2a1a4e)", border: "2px solid #6d3fba", borderRadius: "12px", color: "#e8e8f0", padding: "14px 28px", fontSize: "1.1rem", fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}
                onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = "linear-gradient(135deg, #7c3aed, #a855f7)"; }}
                onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = "linear-gradient(135deg, #1e1640, #2a1a4e)"; }}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div style={{ position: "absolute", inset: 0, background: "rgba(10,10,20,0.9)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", zIndex: 10, borderRadius: "10px" }}>
        <div style={{ fontSize: "2.5rem" }}>✏️</div>
        <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{getDrawerName()} is choosing a word...</div>
        <div style={{ color: "#7a6a9e", fontSize: "0.85rem" }}>{timeLeft}s remaining</div>
      </div>
    );
  }

  function RoundEndOverlay() {
    if (!state) return null;
    const elapsed = Date.now() - state.phaseStartTime;
    const remaining = Math.max(0, Math.ceil((5000 - elapsed) / 1000));
    return (
      <div style={{ position: "absolute", inset: 0, background: "rgba(10,10,20,0.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "14px", zIndex: 10, borderRadius: "10px" }}>
        <div style={{ fontSize: "2.5rem" }}>⏱️</div>
        <div style={{ fontWeight: 800, fontSize: "1.3rem" }}>Round Over!</div>
        <div style={{ color: "#a855f7", fontSize: "1.1rem", fontWeight: 700 }}>
          The word was: <span style={{ color: "#f97316" }}>{state.currentWord ?? "?"}</span>
        </div>
        <div style={{ color: "#7a6a9e", fontSize: "0.85rem" }}>Next round in {remaining}s...</div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center", marginTop: "8px" }}>
          {[...players].sort((a, b) => (state.scores[b.user_id] ?? 0) - (state.scores[a.user_id] ?? 0)).map(p => (
            <div key={p.user_id} style={{ background: "#1e1640", border: "1px solid #3d2a6e", borderRadius: "10px", padding: "8px 16px", textAlign: "center", minWidth: "80px" }}>
              <div style={{ fontSize: "0.75rem", color: "#7a6a9e", marginBottom: "2px" }}>{p.username}</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#a855f7" }}>{state.scores[p.user_id] ?? 0}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function GameOverOverlay() {
    if (!state) return null;
    return (
      <div style={{ position: "absolute", inset: 0, background: "rgba(10,10,20,0.95)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", zIndex: 10, borderRadius: "10px", overflow: "hidden" }}>
        {confetti.map(p => (
          <div key={p.id} style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, width: "10px", height: "10px", background: p.color, borderRadius: "2px", transform: `rotate(${p.angle}deg)`, animation: `confettiFall ${2 / p.speed}s linear forwards`, pointerEvents: "none" }} />
        ))}
        <div style={{ fontSize: "3.5rem" }}>🏆</div>
        <div style={{ fontWeight: 900, fontSize: "1.8rem", textAlign: "center" }}>
          {state.winnerName ?? "Someone"} wins!
        </div>
        <div style={{ color: "#7a6a9e", fontSize: "0.9rem" }}>Final Scores</div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
          {[...players].sort((a, b) => (state.scores[b.user_id] ?? 0) - (state.scores[a.user_id] ?? 0)).map((p, i) => (
            <div key={p.user_id} style={{ background: i === 0 ? "linear-gradient(135deg, #7c3aed22, #f9731622)" : "#1e1640", border: `1px solid ${i === 0 ? "#f97316" : "#3d2a6e"}`, borderRadius: "12px", padding: "12px 20px", textAlign: "center", minWidth: "90px" }}>
              {i === 0 && <div style={{ fontSize: "1.2rem", marginBottom: "4px" }}>👑</div>}
              <div style={{ fontSize: "0.8rem", color: "#9b8bc4", marginBottom: "2px" }}>{p.username}</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: i === 0 ? "#f97316" : "#a855f7" }}>{state.scores[p.user_id] ?? 0}</div>
            </div>
          ))}
        </div>
        {isHost && (
          <button
            onClick={() => doAction("play-again")}
            style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)", color: "#fff", border: "none", borderRadius: "12px", padding: "12px 32px", fontSize: "1rem", fontWeight: 700, cursor: "pointer", marginTop: "8px", boxShadow: "0 4px 20px rgba(124,58,237,0.4)" }}
          >
            🔄 Play Again
          </button>
        )}
        <button
          onClick={handleLeave}
          style={{ background: "transparent", color: "#5a4a7e", border: "1px solid #2a1a4e", borderRadius: "10px", padding: "8px 20px", fontSize: "0.85rem", cursor: "pointer" }}
        >
          Leave Room
        </button>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div style={{
      height: "calc(100dvh - 52px)",
      background: "#0a0a14",
      color: "#e8e8f0",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      <style>{`
        @keyframes confettiFall {
          0% { opacity: 1; transform: translateY(0) rotate(0deg); }
          100% { opacity: 0; transform: translateY(100vh) rotate(720deg); }
        }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #0d0b1e; }
        ::-webkit-scrollbar-thumb { background: #2a1a4e; border-radius: 3px; }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        background: "#110d22",
        borderBottom: "1px solid #2a1a4e",
        padding: "8px 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{
            fontWeight: 900, fontSize: "1.3rem",
            background: "linear-gradient(135deg, #a855f7, #ec4899, #f97316)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          }}>
            Wadabbi?!
          </span>
          <span style={{ color: "#4a3a7e", fontSize: "0.9rem" }}>·</span>
          <span style={{ color: "#7a6a9e", fontSize: "0.82rem", fontWeight: 600 }}>{room.name}</span>
          {state && state.phase !== "lobby" && (
            <span style={{ color: "#4a3a7e", fontSize: "0.75rem" }}>Round {state.roundCount}</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {phase === "lobby" && (
            <button
              onClick={copyInviteLink}
              style={{ background: "transparent", color: copyDone ? "#4ade80" : "#7a6a9e", border: `1px solid ${copyDone ? "#4ade80" : "#2a1a4e"}`, borderRadius: "8px", padding: "4px 10px", fontSize: "0.75rem", cursor: "pointer" }}
            >
              {copyDone ? "✅ Copied!" : "🔗 Invite"}
            </button>
          )}
          <button
            onClick={handleLeave}
            style={{ background: "transparent", color: "#5a4a7e", border: "1px solid #2a1a4e", borderRadius: "8px", padding: "5px 12px", fontSize: "0.8rem", cursor: "pointer" }}
          >
            Leave
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* Left panel */}
        <div style={{ flex: "1 1 0", display: "flex", flexDirection: "column", padding: "10px", gap: "8px", minWidth: 0, overflow: "hidden" }}>

          {/* Word bar */}
          <div style={{ background: "#16122e", borderRadius: "10px", padding: "8px 14px", textAlign: "center", border: "1px solid #2a1a4e", flexShrink: 0 }}>
            {phase === "drawing" && (
              <>
                {isDrawer ? (
                  <div>
                    <span style={{ color: "#7a6a9e", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>Draw this word</span>
                    <div style={{ fontWeight: 900, fontSize: "1.5rem", color: "#a855f7", marginTop: "2px" }}>{state?.currentWord}</div>
                  </div>
                ) : alreadyGuessed() ? (
                  <div style={{ color: "#4ade80", fontWeight: 700 }}>✅ You guessed it!</div>
                ) : (
                  <div>
                    <span style={{ color: "#7a6a9e", fontSize: "0.7rem" }}>Guess the word</span>
                    <div style={{ fontFamily: "monospace", fontSize: "1.3rem", fontWeight: 700, letterSpacing: "0.2em", color: "#e8e8f0", marginTop: "3px" }}>
                      {wordMask(state?.currentWord ?? "", Date.now() - (state?.roundStartTime ?? 0))}
                    </div>
                    <div style={{ color: "#5a4a7e", fontSize: "0.7rem", marginTop: "2px" }}>
                      {(state?.currentWord ?? "").split(" ").map(w => w.replace(/[^ ]/g, "_").length).filter(n => n > 0).join(", ")} letters
                    </div>
                  </div>
                )}
                <div style={{ height: "5px", borderRadius: "3px", background: "#1e1640", overflow: "hidden", marginTop: "6px" }}>
                  <div style={{ height: "100%", width: `${timerPct * 100}%`, background: timerColor, borderRadius: "3px", transition: "width 0.25s linear, background 0.5s" }} />
                </div>
                <div style={{ color: timerColor, fontSize: "0.72rem", marginTop: "3px", fontWeight: 600 }}>{timeLeft}s</div>
              </>
            )}
            {phase === "choosing" && (
              <div style={{ color: "#9b8bc4" }}>
                {isDrawer ? "Choose your word!" : `${getDrawerName()} is choosing...`}
                <div style={{ height: "5px", borderRadius: "3px", background: "#1e1640", overflow: "hidden", marginTop: "5px" }}>
                  <div style={{ height: "100%", width: `${timerPct * 100}%`, background: "#a855f7", borderRadius: "3px", transition: "width 0.25s linear" }} />
                </div>
                <div style={{ color: "#7a6a9e", fontSize: "0.72rem", marginTop: "3px" }}>{timeLeft}s</div>
              </div>
            )}
            {phase === "lobby" && <div style={{ color: "#5a4a7e", fontWeight: 600, fontSize: "0.85rem" }}>Lobby — waiting to start</div>}
            {phase === "roundEnd" && <div style={{ color: "#f97316", fontWeight: 700, fontSize: "0.85rem" }}>Round End — word was: <strong>{state?.currentWord}</strong></div>}
            {phase === "gameOver" && <div style={{ color: "#f97316", fontWeight: 700, fontSize: "0.85rem" }}>🏆 {state?.winnerName} wins!</div>}
          </div>

          {/* Canvas — flex: 1 fills all remaining space */}
          <div style={{ position: "relative", background: "#fff", borderRadius: "10px", overflow: "hidden", border: "2px solid #2a1a4e", flex: "1 1 0", minHeight: 0 }}>
            <canvas
              ref={canvasRef}
              width={800}
              height={550}
              style={{ width: "100%", height: "100%", display: "block", cursor: isDrawer && phase === "drawing" ? "crosshair" : "default", touchAction: "none" }}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={() => endStroke()}
              onMouseLeave={() => { if (isDrawingRef.current) endStroke(); }}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={e => { e.preventDefault(); endStroke(); }}
            />
            {phase === "lobby" && <LobbyOverlay />}
            {phase === "choosing" && <ChoosingOverlay />}
            {phase === "roundEnd" && <RoundEndOverlay />}
            {phase === "gameOver" && <GameOverOverlay />}
          </div>

          {/* Drawing toolbar */}
          {phase === "drawing" && isDrawer && (
            <div style={{ background: "#16122e", borderRadius: "10px", padding: "8px 10px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", border: "1px solid #2a1a4e", flexShrink: 0 }}>
              <span style={{ color: "#5a4a7e", fontSize: "0.72rem", fontWeight: 600 }}>COLOR</span>
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} style={{ width: "22px", height: "22px", borderRadius: "50%", background: c, border: color === c ? "3px solid #a855f7" : "2px solid #2a1a4e", cursor: "pointer", padding: 0, flexShrink: 0, transform: color === c ? "scale(1.2)" : "scale(1)", transition: "transform 0.1s" }} />
              ))}
              <div style={{ width: "1px", height: "20px", background: "#2a1a4e" }} />
              <span style={{ color: "#5a4a7e", fontSize: "0.72rem", fontWeight: 600 }}>SIZE</span>
              {BRUSH_SIZES.map(sz => (
                <button key={sz} onClick={() => setBrushSize(sz)} style={{ width: "30px", height: "30px", background: brushSize === sz ? "#2a1a4e" : "transparent", border: `2px solid ${brushSize === sz ? "#a855f7" : "#2a1a4e"}`, borderRadius: "7px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0 }}>
                  <div style={{ borderRadius: "50%", background: "#e8e8f0", width: `${sz * 0.8 + 4}px`, height: `${sz * 0.8 + 4}px` }} />
                </button>
              ))}
              <div style={{ flex: 1 }} />
              <button onClick={handleClear} style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "7px", padding: "5px 12px", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>🗑️ Clear</button>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div style={{ width: "240px", flexShrink: 0, background: "#0d0b1e", borderLeft: "1px solid #1e1640", display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Players */}
          <div style={{ padding: "8px 10px", borderBottom: "1px solid #1e1640", flexShrink: 0 }}>
            <div style={{ fontSize: "0.68rem", color: "#4a3a7e", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>
              Players ({players.length}/{room.max_players})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {[...players].sort((a, b) => (state?.scores[b.user_id] ?? 0) - (state?.scores[a.user_id] ?? 0)).map(p => {
                const isCurrentDrawer = p.user_id === drawerId;
                const hasGuessed = state?.guessedThisRound.includes(p.user_id);
                const score = state?.scores[p.user_id] ?? 0;
                return (
                  <div key={p.user_id} style={{ display: "flex", alignItems: "center", gap: "6px", background: isCurrentDrawer ? "#1e1640" : "transparent", borderRadius: "7px", padding: "5px 7px", border: isCurrentDrawer ? "1px solid #3d2a6e" : "1px solid transparent" }}>
                    <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: "#2a1a4e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", flexShrink: 0, overflow: "hidden" }}>
                      {p.avatar ? <img src={p.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (p.is_bot ? "🤖" : "🎮")}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: isCurrentDrawer ? "#e8e8f0" : "#b8b0d0" }}>{p.username}</span>
                        {isCurrentDrawer && <span style={{ fontSize: "11px" }}>✏️</span>}
                        {hasGuessed && phase === "drawing" && !isCurrentDrawer && <span style={{ fontSize: "11px" }}>✅</span>}
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: "0.88rem", color: "#a855f7", flexShrink: 0 }}>{score}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chat */}
          <div style={{ flex: "1 1 0", overflowY: "auto", padding: "6px 8px", display: "flex", flexDirection: "column", gap: "3px", minHeight: 0 }}>
            {(state?.chatHistory ?? []).map(msg => (
              <div key={msg.id} style={{ fontSize: "0.78rem", padding: "2px 0", lineHeight: 1.4 }}>
                {msg.isSystem ? (
                  <span style={{ color: "#6d3fba", fontStyle: "italic" }}>{msg.text}</span>
                ) : msg.isCorrect ? (
                  <span style={{ color: "#4ade80", fontWeight: 600 }}>{msg.text}</span>
                ) : (
                  <span>
                    <span style={{ color: "#7a6a9e", fontWeight: 600 }}>{msg.username}: </span>
                    <span style={{ color: "#c8c0e0" }}>{msg.text}</span>
                  </span>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <div style={{ display: "flex", gap: "5px", padding: "7px 8px", borderTop: "1px solid #1e1640", flexShrink: 0 }}>
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSend(); }}
              disabled={!sessionUserId || sending}
              placeholder={isGuessInput ? "Type your guess..." : "Chat..."}
              maxLength={200}
              style={{ flex: 1, background: "#0a0a14", border: `1px solid ${isGuessInput ? "#3d2a6e" : "#1e1640"}`, borderRadius: "7px", padding: "7px 8px", color: "#e8e8f0", fontSize: "16px", outline: "none", touchAction: "manipulation", WebkitUserSelect: "text" as const }}
            />
            <button
              onClick={handleSend}
              disabled={!sessionUserId || !chatInput.trim() || sending}
              style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: "7px", padding: "7px 10px", cursor: "pointer", fontSize: "0.82rem", opacity: !chatInput.trim() ? 0.4 : 1, flexShrink: 0 }}
            >
              {isGuessInput ? "→" : "💬"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
