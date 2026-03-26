"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "@/lib/use-session";
import Link from "next/link";
import InviteViaDm from "@/app/components/InviteViaDm";
import { useRouter } from "next/navigation";

// ── Sound effects (Web Audio, zero dependencies) ─────────────────────────────
function sndCtx() { try { return new AudioContext(); } catch { return null; } }

function sfxHit() {
  const c = sndCtx(); if (!c) return;
  const osc = c.createOscillator(), gain = c.createGain();
  osc.connect(gain); gain.connect(c.destination);
  osc.type = "square";
  osc.frequency.setValueAtTime(420, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(680, c.currentTime + 0.04);
  gain.gain.setValueAtTime(0.18, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.07);
  osc.start(c.currentTime); osc.stop(c.currentTime + 0.07);
  osc.onended = () => c.close();
}

function sfxWall() {
  const c = sndCtx(); if (!c) return;
  const osc = c.createOscillator(), gain = c.createGain();
  osc.connect(gain); gain.connect(c.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(280, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(180, c.currentTime + 0.06);
  gain.gain.setValueAtTime(0.10, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08);
  osc.start(c.currentTime); osc.stop(c.currentTime + 0.08);
  osc.onended = () => c.close();
}

function sfxScore() { // YOU scored
  const c = sndCtx(); if (!c) return;
  [[523.25,0],[659.25,0.07],[783.99,0.14],[1046.5,0.22]].forEach(([freq,delay]) => {
    const osc = c.createOscillator(), gain = c.createGain();
    osc.connect(gain); gain.connect(c.destination);
    osc.type = "square"; osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.12, c.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + 0.14);
    osc.start(c.currentTime + delay); osc.stop(c.currentTime + delay + 0.14);
  });
  setTimeout(() => c.close(), 700);
}

function sfxConcede() { // opponent scored
  const c = sndCtx(); if (!c) return;
  [[493.88,0],[369.99,0.09],[293.66,0.18],[220,0.28]].forEach(([freq,delay]) => {
    const osc = c.createOscillator(), gain = c.createGain();
    osc.connect(gain); gain.connect(c.destination);
    osc.type = "sawtooth"; osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.09, c.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + 0.16);
    osc.start(c.currentTime + delay); osc.stop(c.currentTime + delay + 0.16);
  });
  setTimeout(() => c.close(), 700);
}

function sfxWin() {
  const c = sndCtx(); if (!c) return;
  [[523.25,0],[659.25,0.09],[783.99,0.18],[1046.5,0.29],[1318.51,0.42]].forEach(([freq,delay]) => {
    const osc = c.createOscillator(), gain = c.createGain();
    osc.connect(gain); gain.connect(c.destination);
    osc.type = "triangle"; osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.14, c.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + 0.32);
    osc.start(c.currentTime + delay); osc.stop(c.currentTime + delay + 0.32);
  });
  setTimeout(() => c.close(), 900);
}

function sfxLose() {
  const c = sndCtx(); if (!c) return;
  [[440,0],[369.99,0.13],[293.66,0.28],[220,0.45],[146.83,0.64]].forEach(([freq,delay]) => {
    const osc = c.createOscillator(), gain = c.createGain();
    osc.connect(gain); gain.connect(c.destination);
    osc.type = "sawtooth"; osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.09, c.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + 0.22);
    osc.start(c.currentTime + delay); osc.stop(c.currentTime + delay + 0.22);
  });
  setTimeout(() => c.close(), 1100);
}

function sfxCountdown() {
  const c = sndCtx(); if (!c) return;
  const osc = c.createOscillator(), gain = c.createGain();
  osc.connect(gain); gain.connect(c.destination);
  osc.type = "triangle";
  osc.frequency.setValueAtTime(880, c.currentTime);
  gain.gain.setValueAtTime(0.15, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12);
  osc.start(c.currentTime); osc.stop(c.currentTime + 0.12);
  osc.onended = () => c.close();
}

// ── Background chiptune music ─────────────────────────────────────────────────
// A minor pentatonic arpeggio: A3 C4 E4 G4 A4 G4 E4 C4 (repeating)
const MUSIC_SEQ: [number, number][] = [
  [220.00, 0.13], [0, 0.02],
  [261.63, 0.13], [0, 0.02],
  [329.63, 0.13], [0, 0.02],
  [392.00, 0.13], [0, 0.02],
  [440.00, 0.18], [0, 0.07],
  [392.00, 0.13], [0, 0.02],
  [329.63, 0.13], [0, 0.02],
  [261.63, 0.13], [0, 0.02],
  [220.00, 0.18], [0, 0.12],
  [293.66, 0.13], [0, 0.02],
  [369.99, 0.13], [0, 0.02],
  [440.00, 0.13], [0, 0.02],
  [523.25, 0.18], [0, 0.07],
  [440.00, 0.13], [0, 0.02],
  [369.99, 0.13], [0, 0.02],
  [293.66, 0.13], [0, 0.02],
  [220.00, 0.22], [0, 0.18],
];

// ── Constants ──────────────────────────────────────────────────────────────────
const W = 800;
const H = 500;
const PAD_W = 14;
const PAD_H = 90;
const BALL_R = 10;
const PAD_SPEED = 6;
const BALL_SPEED_INIT = 5.5;
const MAX_BALL_SPEED = 16;
const AI_SPEED = 4.0;
const WINNING_SCORE = 7;
const COUNTDOWN_MS = 3000;
const POLL_MS = 80; // multiplayer poll interval

type Mode = "menu" | "matchmaking" | "countdown" | "playing" | "paused" | "won" | "lost" | "mp_won" | "mp_lost" | "waiting_opponent";

interface GameState {
  ballX: number; ballY: number;
  ballVX: number; ballVY: number;
  padL: number; padR: number;
  scoreL: number; scoreR: number;
  waitFrames: number; // frames to skip after a score (prevents ghost scores)
  _lastT: number; // last frame timestamp for delta-time
}

interface Leaderboard { user_id: string; username: string; elo: number; wins: number; losses: number; }
interface PongRoom {
  id: string; host_id: string; opponent_id: string | null;
  host_username: string; opponent_username: string | null;
  status: string; countdown_at: number | string | null;
  ball_x: number; ball_y: number; ball_vx: number; ball_vy: number;
  host_paddle: number; opp_paddle: number;
  host_score: number; opp_score: number; winner_id: string | null;
}

function initState(): GameState {
  return {
    ballX: W / 2, ballY: H / 2,
    ballVX: 0, ballVY: 0, // will be set on serve
    padL: H / 2 - PAD_H / 2,
    padR: H / 2 - PAD_H / 2,
    scoreL: 0, scoreR: 0,
    waitFrames: 0,
    _lastT: 0,
  };
}

function serveBall(toRight: boolean): { vx: number; vy: number } {
  const angle = (Math.random() * 50 - 25) * (Math.PI / 180);
  const dir = toRight ? 1 : -1;
  return {
    vx: Math.cos(angle) * BALL_SPEED_INIT * dir,
    vy: Math.sin(angle) * BALL_SPEED_INIT,
  };
}

// ── Drawing helper ─────────────────────────────────────────────────────────────
function drawFrame(ctx: CanvasRenderingContext2D, s: GameState, countdown: number | null, waiting: boolean, mpMode: boolean, isHost: boolean) {
  ctx.fillStyle = "#0a0a14";
  ctx.fillRect(0, 0, W, H);

  ctx.setLineDash([12, 10]);
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "bold 52px monospace";
  ctx.textAlign = "center";
  ctx.fillText(String(s.scoreL), W / 2 - 90, 66);
  ctx.fillText(String(s.scoreR), W / 2 + 90, 66);

  const drawPad = (x: number, y: number, color: string) => {
    ctx.shadowColor = color; ctx.shadowBlur = 18;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, PAD_W, PAD_H, 6);
    ctx.fill();
    ctx.shadowBlur = 0;
  };

  drawPad(20, s.padL, "#7c3aed");
  drawPad(W - 20 - PAD_W, s.padR, "#ef4444");

  if (!waiting && countdown === null) {
    ctx.shadowColor = "#f9fafb"; ctx.shadowBlur = 22;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(s.ballX, s.ballY, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  ctx.font = "12px sans-serif";
  ctx.fillStyle = "rgba(124,58,237,0.7)";
  ctx.textAlign = "left";
  ctx.fillText(mpMode ? (isHost ? "YOU" : "OPP") : "YOU", 24, H - 14);
  ctx.fillStyle = "rgba(239,68,68,0.7)";
  ctx.textAlign = "right";
  ctx.fillText(mpMode ? (isHost ? "OPP" : "YOU") : "AI", W - 24, H - 14);

  if (countdown !== null && countdown > 0) {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, W, H);
    ctx.font = "bold 120px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "#a78bfa"; ctx.shadowBlur = 40;
    ctx.fillText(String(countdown), W / 2, H / 2 + 40);
    ctx.shadowBlur = 0;
    ctx.font = "18px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("Get ready!", W / 2, H / 2 + 90);
  }

  if (waiting) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, W, H);
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#a78bfa";
    ctx.fillText("Waiting for opponent…", W / 2, H / 2 - 10);
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText("Share the link below to invite a friend", W / 2, H / 2 + 22);
  }
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function PongClient() {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  const username = session?.user?.name ?? "Guest";
  const router = useRouter();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(initState());
  const keysRef = useRef<Record<string, boolean>>({});
  const modeRef = useRef<Mode>("menu");
  const animRef = useRef<number>(0);

  const [mode, setMode] = useState<Mode>("menu");
  const [scores, setScores] = useState({ l: 0, r: 0 });
  const [countdownNum, setCountdownNum] = useState<number | null>(null);
  const countdownRef = useRef<number | null>(null);

  // Multiplayer
  const [mpRoom, setMpRoom] = useState<PongRoom | null>(null);
  const mpRoomRef = useRef<PongRoom | null>(null);
  const [isHost, setIsHost] = useState(false);
  const isHostRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [mpEloGain, setMpEloGain] = useState<number | null>(null);

  // Music
  const musicCtxRef = useRef<AudioContext | null>(null);
  const musicTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const musicNoteIdxRef = useRef(0);
  const musicNextTimeRef = useRef(0);
  const [musicOn, setMusicOn] = useState(true);
  const musicOnRef = useRef(true);

  function startMusic() {
    if (!musicOnRef.current) return;
    stopMusic();
    try {
      const ctx = new AudioContext();
      musicCtxRef.current = ctx;
      musicNoteIdxRef.current = 0;
      musicNextTimeRef.current = ctx.currentTime + 0.15;
      const schedule = () => {
        const c = musicCtxRef.current;
        if (!c) return;
        while (musicNextTimeRef.current < c.currentTime + 0.55) {
          const [freq, dur] = MUSIC_SEQ[musicNoteIdxRef.current % MUSIC_SEQ.length];
          if (freq > 0) {
            const osc = c.createOscillator();
            const g = c.createGain();
            osc.connect(g); g.connect(c.destination);
            osc.type = "square"; osc.frequency.value = freq;
            g.gain.setValueAtTime(0.055, musicNextTimeRef.current);
            g.gain.exponentialRampToValueAtTime(0.001, musicNextTimeRef.current + dur * 0.85);
            osc.start(musicNextTimeRef.current); osc.stop(musicNextTimeRef.current + dur);
          }
          musicNextTimeRef.current += dur;
          musicNoteIdxRef.current++;
        }
        musicTimerRef.current = setTimeout(schedule, 150);
      };
      schedule();
    } catch { /* AudioContext not available */ }
  }

  function stopMusic() {
    if (musicTimerRef.current) clearTimeout(musicTimerRef.current);
    musicTimerRef.current = null;
    if (musicCtxRef.current) {
      musicCtxRef.current.close().catch(() => {});
      musicCtxRef.current = null;
    }
  }

  function toggleMusic() {
    const next = !musicOnRef.current;
    musicOnRef.current = next;
    setMusicOn(next);
    if (next && modeRef.current === "playing") startMusic();
    else stopMusic();
  }

  // ELO + leaderboard
  const [myElo, setMyElo] = useState<{ elo: number; wins: number; losses: number } | null>(null);
  const [leaderboard, setLeaderboard] = useState<Leaderboard[]>([]);
  const [joinRoomId, setJoinRoomId] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("join") ?? "";
  });
  const [joining, setJoining] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joinError, setJoinError] = useState("");

  // Score flash overlay
  const [scoreFlash, setScoreFlash] = useState<{ text: string; color: string } | null>(null);
  const scoreFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showScoreFlash(text: string, color: string) {
    if (scoreFlashTimer.current) clearTimeout(scoreFlashTimer.current);
    setScoreFlash({ text, color });
    scoreFlashTimer.current = setTimeout(() => setScoreFlash(null), 1200);
  }

  // Friends for invite dropdown
  const [friends, setFriends] = useState<{ user_id: string; username: string }[]>([]);
  const [inviteSent, setInviteSent] = useState<string | null>(null);
  useEffect(() => {
    if (!userId) return;
    fetch("/api/friends").then(r => r.json()).then(d => {
      if (Array.isArray(d)) setFriends(d.map((f: { user_id?: string; friend_id?: string; username?: string; friend_username?: string }) => ({
        user_id: f.friend_id ?? f.user_id ?? "",
        username: f.friend_username ?? f.username ?? "?",
      })).filter((f: { user_id: string }) => f.user_id));
    }).catch(() => {});
  }, [userId]);

  const setModeSync = useCallback((m: Mode) => {
    modeRef.current = m;
    setMode(m);
  }, []);

  // Load ELO + leaderboard on mount
  useEffect(() => {
    fetch("/api/pong?leaderboard=1").then(r => r.json()).then(d => {
      if (Array.isArray(d)) setLeaderboard(d);
    }).catch(() => {});
    if (userId) {
      fetch(`/api/pong?userId=${userId}`).then(r => r.json()).then(d => {
        if (d?.elo) setMyElo(d);
      }).catch(() => {});
    }
  }, [userId]);

  // ── Solo game logic ─────────────────────────────────────────────────────────
  const soloLoop = useCallback(() => {
    if (modeRef.current !== "playing") return;
    const s = stateRef.current;
    const keys = keysRef.current;

    // Delta-time: normalize to 60fps so speed is consistent across refresh rates
    const now = performance.now();
    const dt = s._lastT ? Math.min((now - s._lastT) / 16.667, 3) : 1; // cap at 3× to avoid huge jumps
    s._lastT = now;

    if (s.waitFrames > 0) {
      s.waitFrames -= dt;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (ctx) drawFrame(ctx, s, null, false, false, true);
      animRef.current = requestAnimationFrame(soloLoop);
      return;
    }

    // Player movement (scaled by dt)
    if ((keys["w"] || keys["W"] || keys["ArrowUp"]) && s.padL > 0) s.padL = Math.max(0, s.padL - PAD_SPEED * dt);
    if ((keys["s"] || keys["S"] || keys["ArrowDown"]) && s.padL < H - PAD_H) s.padL = Math.min(H - PAD_H, s.padL + PAD_SPEED * dt);

    // AI (right paddle, scaled by dt)
    const aiCenter = s.padR + PAD_H / 2;
    const diff = s.ballY - aiCenter;
    if (Math.abs(diff) > 3) s.padR += (diff > 0 ? Math.min(AI_SPEED, diff) : Math.max(-AI_SPEED, diff)) * dt;
    s.padR = Math.max(0, Math.min(H - PAD_H, s.padR));

    // Ball movement (scaled by dt)
    s.ballX += s.ballVX * dt;
    s.ballY += s.ballVY * dt;

    // Top/bottom walls
    if (s.ballY - BALL_R <= 0) { s.ballY = BALL_R; s.ballVY = Math.abs(s.ballVY); sfxWall(); }
    if (s.ballY + BALL_R >= H) { s.ballY = H - BALL_R; s.ballVY = -Math.abs(s.ballVY); sfxWall(); }

    // Left paddle
    if (s.ballVX < 0 && s.ballX - BALL_R <= 20 + PAD_W && s.ballX - BALL_R >= 14 &&
      s.ballY + BALL_R >= s.padL && s.ballY - BALL_R <= s.padL + PAD_H) {
      s.ballX = 20 + PAD_W + BALL_R + 1;
      const hit = (s.ballY - (s.padL + PAD_H / 2)) / (PAD_H / 2);
      const angle = hit * 60 * (Math.PI / 180);
      const speed = Math.min(Math.hypot(s.ballVX, s.ballVY) * 1.05, MAX_BALL_SPEED);
      s.ballVX = Math.cos(angle) * speed;
      s.ballVY = Math.sin(angle) * speed;
      sfxHit();
    }

    // Right paddle
    if (s.ballVX > 0 && s.ballX + BALL_R >= W - 20 - PAD_W && s.ballX + BALL_R <= W - 14 &&
      s.ballY + BALL_R >= s.padR && s.ballY - BALL_R <= s.padR + PAD_H) {
      s.ballX = W - 20 - PAD_W - BALL_R - 1;
      const hit = (s.ballY - (s.padR + PAD_H / 2)) / (PAD_H / 2);
      const angle = hit * 60 * (Math.PI / 180);
      const speed = Math.min(Math.hypot(s.ballVX, s.ballVY) * 1.05, MAX_BALL_SPEED);
      s.ballVX = -Math.cos(angle) * speed;
      s.ballVY = Math.sin(angle) * speed;
      sfxHit();
    }

    // Scoring (only when ball exits the field, not near paddle zone)
    if (s.ballX + BALL_R < 0) {
      s.scoreR++;
      setScores({ l: s.scoreL, r: s.scoreR });
      sfxConcede();
      showScoreFlash("AI +1", "#ef4444");
      if (s.scoreR >= WINNING_SCORE) { sfxLose(); stopMusic(); setModeSync("lost"); return; }
      const v = serveBall(false);
      s.ballX = W / 2; s.ballY = H / 2; s.ballVX = v.vx; s.ballVY = v.vy;
      s.waitFrames = 180; // 3 second delay after score
    } else if (s.ballX - BALL_R > W) {
      s.scoreL++;
      setScores({ l: s.scoreL, r: s.scoreR });
      sfxScore();
      showScoreFlash("YOU +1 🎉", "#a78bfa");
      if (s.scoreL >= WINNING_SCORE) { sfxWin(); stopMusic(); setModeSync("won"); return; }
      const v = serveBall(true);
      s.ballX = W / 2; s.ballY = H / 2; s.ballVX = v.vx; s.ballVY = v.vy;
      s.waitFrames = 180; // 3 second delay after score
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx) drawFrame(ctx, s, null, false, false, true);
    animRef.current = requestAnimationFrame(soloLoop);
  }, [setModeSync]);

  // ── Multiplayer loop (host only runs physics) ────────────────────────────────
  const mpLoop = useCallback(() => {
    if (modeRef.current !== "playing") return;
    const s = stateRef.current;
    const keys = keysRef.current;
    const host = isHostRef.current;
    const room = mpRoomRef.current;
    if (!room) return;

    if (s.waitFrames > 0) {
      s.waitFrames--;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (ctx) drawFrame(ctx, s, null, false, true, host);
      animRef.current = requestAnimationFrame(mpLoop);
      return;
    }

    // Local paddle control
    const myPad = host ? s.padL : s.padR;
    let newPad = myPad;
    if ((keys["w"] || keys["W"] || keys["ArrowUp"]) && newPad > 0) newPad = Math.max(0, newPad - PAD_SPEED);
    if ((keys["s"] || keys["S"] || keys["ArrowDown"]) && newPad < H - PAD_H) newPad = Math.min(H - PAD_H, newPad + PAD_SPEED);
    if (host) s.padL = newPad;
    else s.padR = newPad;

    // Host runs ball physics
    if (host) {
      s.ballX += s.ballVX;
      s.ballY += s.ballVY;

      if (s.ballY - BALL_R <= 0) { s.ballY = BALL_R; s.ballVY = Math.abs(s.ballVY); sfxWall(); }
      if (s.ballY + BALL_R >= H) { s.ballY = H - BALL_R; s.ballVY = -Math.abs(s.ballVY); sfxWall(); }

      if (s.ballVX < 0 && s.ballX - BALL_R <= 20 + PAD_W && s.ballX - BALL_R >= 14 &&
        s.ballY + BALL_R >= s.padL && s.ballY - BALL_R <= s.padL + PAD_H) {
        s.ballX = 20 + PAD_W + BALL_R + 1;
        const hit = (s.ballY - (s.padL + PAD_H / 2)) / (PAD_H / 2);
        const angle = hit * 60 * (Math.PI / 180);
        const speed = Math.min(Math.hypot(s.ballVX, s.ballVY) * 1.05, MAX_BALL_SPEED);
        s.ballVX = Math.cos(angle) * speed;
        s.ballVY = Math.sin(angle) * speed;
        sfxHit();
      }

      if (s.ballVX > 0 && s.ballX + BALL_R >= W - 20 - PAD_W && s.ballX + BALL_R <= W - 14 &&
        s.ballY + BALL_R >= s.padR && s.ballY - BALL_R <= s.padR + PAD_H) {
        s.ballX = W - 20 - PAD_W - BALL_R - 1;
        const hit = (s.ballY - (s.padR + PAD_H / 2)) / (PAD_H / 2);
        const angle = hit * 60 * (Math.PI / 180);
        const speed = Math.min(Math.hypot(s.ballVX, s.ballVY) * 1.05, MAX_BALL_SPEED);
        s.ballVX = -Math.cos(angle) * speed;
        s.ballVY = Math.sin(angle) * speed;
        sfxHit();
      }

      if (s.ballX + BALL_R < 0) {
        s.scoreR++; setScores({ l: s.scoreL, r: s.scoreR });
        sfxConcede();
        showScoreFlash(isHostRef.current ? "OPP +1" : "YOU +1 🎉", isHostRef.current ? "#ef4444" : "#a78bfa");
        if (s.scoreR >= WINNING_SCORE) {
          sfxLose(); stopMusic();
          finishMpGame(room.opponent_id!);
          return;
        }
        const v = serveBall(false);
        s.ballX = W / 2; s.ballY = H / 2; s.ballVX = v.vx; s.ballVY = v.vy;
        s.waitFrames = 50;
      } else if (s.ballX - BALL_R > W) {
        s.scoreL++; setScores({ l: s.scoreL, r: s.scoreR });
        sfxScore();
        showScoreFlash(isHostRef.current ? "YOU +1 🎉" : "OPP +1", isHostRef.current ? "#a78bfa" : "#ef4444");
        if (s.scoreL >= WINNING_SCORE) {
          sfxWin(); stopMusic();
          finishMpGame(room.host_id);
          return;
        }
        const v = serveBall(true);
        s.ballX = W / 2; s.ballY = H / 2; s.ballVX = v.vx; s.ballVY = v.vy;
        s.waitFrames = 50;
      }
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx) drawFrame(ctx, s, null, false, true, host);
    animRef.current = requestAnimationFrame(mpLoop);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setModeSync]);

  async function finishMpGame(winnerId: string) {
    const room = mpRoomRef.current;
    if (!room) return;
    cancelAnimationFrame(animRef.current);
    const won = winnerId === userId;
    setModeSync(won ? "mp_won" : "mp_lost");
    try {
      const r = await fetch("/api/pong", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "finish", roomId: room.id, winnerId }),
      });
      const d = await r.json();
      if (d.eloResult) {
        setMpEloGain(won ? d.eloResult.eloGain : -d.eloResult.eloGain);
        if (userId) fetch(`/api/pong?userId=${userId}`).then(r => r.json()).then(d => { if (d?.elo) setMyElo(d); }).catch(() => {});
        fetch("/api/pong?leaderboard=1").then(r => r.json()).then(d => { if (Array.isArray(d)) setLeaderboard(d); }).catch(() => {});
      }
    } catch { /* ignore */ }
  }

  // ── Multiplayer polling ──────────────────────────────────────────────────────
  const startMpPoll = useCallback((roomId: string) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(async () => {
      const m = modeRef.current;
      if (m === "mp_won" || m === "mp_lost" || m === "menu") {
        clearInterval(pollTimerRef.current!);
        return;
      }
      try {
        const r = await fetch(`/api/pong?roomId=${roomId}`);
        if (!r.ok) return;
        const room: PongRoom = await r.json();
        mpRoomRef.current = room;
        setMpRoom(room);
        const host = isHostRef.current;

        // Opponent disconnected / abandoned
        if (room.status === "abandoned" || room.status === "finished") {
          clearInterval(pollTimerRef.current!);
          if (room.status === "finished" && room.winner_id) {
            const won = room.winner_id === userId;
            setModeSync(won ? "mp_won" : "mp_lost");
          }
          return;
        }

        // Opponent joined → start countdown
        if (m === "waiting_opponent" && room.status === "countdown" && room.countdown_at) {
          setModeSync("countdown");
          startCountdown(room.countdown_at);
          return;
        }

        // Sync remote paddle + ball (non-host syncs everything from host)
        if (m === "playing") {
          const s = stateRef.current;
          if (host) {
            // Host reads opponent paddle
            s.padR = room.opp_paddle;
          } else {
            // Opponent reads host paddle + ball
            s.padL = room.host_paddle;
            s.ballX = room.ball_x;
            s.ballY = room.ball_y;
            s.ballVX = room.ball_vx;
            s.ballVY = room.ball_vy;
            s.scoreL = room.host_score;
            s.scoreR = room.opp_score;
            setScores({ l: room.host_score, r: room.opp_score });
          }
        }

        // Send local state to DB
        if (m === "playing") {
          const s = stateRef.current;
          const patch: Record<string, unknown> = {
            action: "update", roomId,
            ...(host ? {
              hostPaddle: Math.round(s.padL * 10) / 10,
              ballX: Math.round(s.ballX * 10) / 10,
              ballY: Math.round(s.ballY * 10) / 10,
              ballVX: Math.round(s.ballVX * 100) / 100,
              ballVY: Math.round(s.ballVY * 100) / 100,
              hostScore: s.scoreL,
              oppScore: s.scoreR,
            } : {
              oppPaddle: Math.round(s.padR * 10) / 10,
            }),
          };
          fetch("/api/pong", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          }).catch(() => {});
        }
      } catch { /* ignore */ }
    }, POLL_MS);
  }, [userId, setModeSync]);

  function startCountdown(countdownAt: number | string | null) {
    // neon returns BIGINT as string — coerce to number to prevent string concatenation
    const at = Number(countdownAt) || Date.now();
    const end = at + COUNTDOWN_MS;
    let lastBeep = -1;
    const tick = () => {
      // Clamp between 0 and 3 so a stale/wrong timestamp never shows garbage
      const remaining = Math.min(3, Math.max(0, Math.ceil((end - Date.now()) / 1000)));
      if (remaining > 0) {
        if (remaining !== lastBeep) { sfxCountdown(); lastBeep = remaining; }
        countdownRef.current = remaining;
        setCountdownNum(remaining);
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (ctx) drawFrame(ctx, stateRef.current, remaining, false, true, isHostRef.current);
        setTimeout(tick, 200);
      } else {
        countdownRef.current = null;
        setCountdownNum(null);
        // Start game
        const v = serveBall(true);
        const s = stateRef.current;
        s.ballX = W / 2; s.ballY = H / 2; s.ballVX = v.vx; s.ballVY = v.vy;
        s.waitFrames = 0;
        setModeSync("playing");
        startMusic();
        animRef.current = requestAnimationFrame(mpLoop);
      }
    };
    tick();
  }

  // ── Create multiplayer room ──────────────────────────────────────────────────
  async function createRoom() {
    if (!userId) return;
    setCreating(true);
    try {
      const r = await fetch("/api/pong", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create" }),
      });
      const room: PongRoom = await r.json();
      setMpRoom(room);
      mpRoomRef.current = room;
      setIsHost(true);
      isHostRef.current = true;
      stateRef.current = initState();
      setModeSync("waiting_opponent");
      startMpPoll(room.id);
    } catch { /* ignore */ } finally {
      setCreating(false);
    }
  }

  // ── Join multiplayer room ─────────────────────────────────────────────────────
  async function joinRoom() {
    if (!userId || !joinRoomId.trim()) return;
    setJoining(true); setJoinError("");
    try {
      const r = await fetch("/api/pong", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", roomId: joinRoomId.trim() }),
      });
      const d = await r.json();
      if (!r.ok) { setJoinError(d.error ?? "Room not found or already started"); return; }
      const room: PongRoom = d as PongRoom;
      setMpRoom(room);
      mpRoomRef.current = room;
      setIsHost(false);
      isHostRef.current = false;
      stateRef.current = initState();
      startCountdown(room.countdown_at!);
      startMpPoll(room.id);
    } catch { setJoinError("Could not join room"); } finally {
      setJoining(false);
    }
  }

  // ── Solo start ────────────────────────────────────────────────────────────────
  function startSolo() {
    cancelAnimationFrame(animRef.current);
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    const s = initState();
    const v = serveBall(true);
    s.ballVX = v.vx; s.ballVY = v.vy;
    stateRef.current = s;
    setScores({ l: 0, r: 0 });
    setModeSync("playing");
    startMusic();
    animRef.current = requestAnimationFrame(soloLoop);
  }

  // ── Key listeners ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current[e.key] = true;
      if (e.key === " ") {
        if (modeRef.current === "playing" && !mpRoomRef.current) setModeSync("paused");
        else if (modeRef.current === "paused") {
          setModeSync("playing");
          animRef.current = requestAnimationFrame(soloLoop);
        }
      }
      if (e.key === "Escape") {
        if (modeRef.current === "playing" && !mpRoomRef.current) setModeSync("paused");
        else if (modeRef.current === "paused") {
          // Double-escape: exit back to profile
          window.location.href = "/profile";
        }
      }
      if (["ArrowUp", "ArrowDown", " "].includes(e.key)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => { delete keysRef.current[e.key]; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [setModeSync, soloLoop]);

  // ── Game loop start/stop ──────────────────────────────────────────────────────
  useEffect(() => {
    if (mode === "paused") {
      cancelAnimationFrame(animRef.current);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (ctx) drawFrame(ctx, stateRef.current, null, false, false, true);
    }
  }, [mode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      stopMusic();
      const room = mpRoomRef.current;
      if (room && modeRef.current !== "mp_won" && modeRef.current !== "mp_lost") {
        fetch("/api/pong", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "abandon", roomId: room.id }) }).catch(() => {});
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Draw menu on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "menu") return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0a0a14";
    ctx.fillRect(0, 0, W, H);
    ctx.shadowColor = "#7c3aed"; ctx.shadowBlur = 70;
    ctx.fillStyle = "rgba(124,58,237,0.10)"; ctx.fillRect(0, 0, W / 2, H);
    ctx.shadowColor = "#ef4444"; ctx.shadowBlur = 70;
    ctx.fillStyle = "rgba(239,68,68,0.10)"; ctx.fillRect(W / 2, 0, W / 2, H);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff"; ctx.font = "bold 58px monospace"; ctx.textAlign = "center";
    ctx.fillText("🏓 PADDLE", W / 2, H / 2 - 40);
    ctx.font = "16px sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText("Solo vs AI  ·  Multiplayer  ·  ELO Ranked", W / 2, H / 2 + 16);
  }, [mode]);

  // ── Touch/mouse paddle ────────────────────────────────────────────────────────
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (modeRef.current !== "playing") return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const scaleY = H / rect.height;
    const y = (e.clientY - rect.top) * scaleY;
    if (isHostRef.current || !mpRoomRef.current) {
      stateRef.current.padL = Math.max(0, Math.min(H - PAD_H, y - PAD_H / 2));
    } else {
      stateRef.current.padR = Math.max(0, Math.min(H - PAD_H, y - PAD_H / 2));
    }
  }, []);

  const isMp = !!mpRoomRef.current;
  const roomLink = mpRoom ? `${typeof window !== "undefined" ? window.location.origin : ""}/pong?join=${mpRoom.id}` : "";

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px 40px" }}>
      <style>{`
        @keyframes pongScoreFlash {
          0%   { opacity: 1; transform: translate(-50%,-50%) scale(1.3); }
          40%  { opacity: 1; transform: translate(-50%,-60%) scale(1.0); }
          100% { opacity: 0; transform: translate(-50%,-80%) scale(0.85); }
        }
      `}</style>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        {/* Back button */}
        <button
          onClick={() => router.back()}
          style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", borderRadius: 10, padding: "7px 14px", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer", fontWeight: 600, flexShrink: 0 }}
        >
          ← Back
        </button>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, background: "linear-gradient(135deg, #7c3aed, #ef4444)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          🏓 Paddle
        </h1>
        {myElo && (
          <span style={{ fontSize: 13, background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 20, padding: "3px 12px", color: "#a78bfa" }}>
            ⚡ {myElo.elo} ELO · {myElo.wins}W {myElo.losses}L
          </span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {mode === "menu" && (
            <>
              <button onClick={startSolo} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 16px", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" }}>🤖 vs AI</button>
              {userId && <button onClick={createRoom} disabled={creating} style={{ background: "linear-gradient(135deg, #7c3aed, #ef4444)", border: "none", borderRadius: 8, padding: "7px 18px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: creating ? 0.6 : 1 }}>⚡ Create Game</button>}
              {!userId && <Link href="/signin" style={{ background: "linear-gradient(135deg, #7c3aed, #ef4444)", border: "none", borderRadius: 8, padding: "7px 18px", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>Sign in to play ranked</Link>}
            </>
          )}
              {mode === "playing" && !isMp && (
            <button onClick={() => { stopMusic(); setModeSync("paused"); }} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 14px", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" }}>⏸ Pause</button>
          )}
          {mode === "playing" && (
            <button onClick={toggleMusic} title={musicOn ? "Mute music" : "Play music"} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", color: "var(--text-muted)", fontSize: 15, cursor: "pointer" }}>
              {musicOn ? "🔊" : "🔇"}
            </button>
          )}
          {mode === "paused" && (
            <>
              <button onClick={() => { setModeSync("playing"); startMusic(); animRef.current = requestAnimationFrame(soloLoop); }} style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.4)", borderRadius: 8, padding: "6px 14px", color: "#a78bfa", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>▶ Resume</button>
              <button onClick={startSolo} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 14px", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" }}>↺ Restart</button>
            </>
          )}
          {(mode === "won" || mode === "lost") && (
            <button onClick={startSolo} style={{ background: "linear-gradient(135deg, #7c3aed, #ef4444)", border: "none", borderRadius: 8, padding: "7px 18px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>▶ Play Again</button>
          )}
          {(mode === "mp_won" || mode === "mp_lost") && (
            <button onClick={() => { stopMusic(); setMpRoom(null); mpRoomRef.current = null; setModeSync("menu"); }} style={{ background: "linear-gradient(135deg, #7c3aed, #ef4444)", border: "none", borderRadius: 8, padding: "7px 18px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>↩ Back to Menu</button>
          )}
        </div>
      </div>

      {/* Canvas area */}
      <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", boxShadow: "0 0 40px rgba(124,58,237,0.2), 0 0 80px rgba(239,68,68,0.08)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <canvas
          ref={canvasRef}
          width={W} height={H}
          onPointerMove={handlePointerMove}
          style={{ display: "block", width: "100%", touchAction: "none", cursor: mode === "playing" ? "none" : "default" }}
        />

        {/* Overlays */}
        {mode === "menu" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", paddingBottom: 60 }}>
            <div style={{ display: "flex", gap: 14 }}>
              <button onClick={startSolo} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 12, padding: "12px 28px", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>🤖 vs AI</button>
              {userId && <button onClick={createRoom} disabled={creating} style={{ background: "linear-gradient(135deg, #7c3aed, #ef4444)", border: "none", borderRadius: 12, padding: "12px 28px", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", opacity: creating ? 0.6 : 1 }}>⚡ Play Online</button>}
            </div>
          </div>
        )}

        {/* Score flash */}
        {scoreFlash && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none", animation: "pongScoreFlash 1.2s ease-out forwards", zIndex: 10 }}>
            <div style={{ fontSize: "clamp(28px,6vw,52px)", fontWeight: 900, color: scoreFlash.color, textShadow: `0 0 24px ${scoreFlash.color}`, letterSpacing: 2, textAlign: "center", whiteSpace: "nowrap" }}>
              {scoreFlash.text}
            </div>
          </div>
        )}

        {mode === "paused" && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>⏸</div>
            <div style={{ color: "#fff", fontSize: 22, fontWeight: 700 }}>Paused</div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 4 }}>Space to resume</div>
          </div>
        )}

        {(mode === "won" || mode === "lost") && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.78)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 64, marginBottom: 8 }}>{mode === "won" ? "🏆" : "😔"}</div>
            <div style={{ color: mode === "won" ? "#a78bfa" : "#ef4444", fontSize: 30, fontWeight: 800, marginBottom: 8 }}>{mode === "won" ? "You Win!" : "AI Wins!"}</div>
            <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 18, marginBottom: 24 }}>{scores.l} — {scores.r}</div>
            <button onClick={startSolo} style={{ background: "linear-gradient(135deg, #7c3aed, #ef4444)", border: "none", borderRadius: 12, padding: "12px 32px", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>▶ Play Again</button>
          </div>
        )}

        {(mode === "mp_won" || mode === "mp_lost") && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.78)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 64, marginBottom: 8 }}>{mode === "mp_won" ? "🏆" : "😔"}</div>
            <div style={{ color: mode === "mp_won" ? "#a78bfa" : "#ef4444", fontSize: 30, fontWeight: 800, marginBottom: 8 }}>{mode === "mp_won" ? "You Win!" : "Opponent Wins!"}</div>
            <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 18, marginBottom: 6 }}>{scores.l} — {scores.r}</div>
            {mpEloGain !== null && (
              <div style={{ color: mpEloGain > 0 ? "#4ade80" : "#f87171", fontSize: 20, fontWeight: 700, marginBottom: 20 }}>
                {mpEloGain > 0 ? "+" : ""}{mpEloGain} ELO
              </div>
            )}
            <button onClick={() => { stopMusic(); setMpRoom(null); mpRoomRef.current = null; setModeSync("menu"); }} style={{ background: "linear-gradient(135deg, #7c3aed, #ef4444)", border: "none", borderRadius: 12, padding: "12px 32px", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>↩ Menu</button>
          </div>
        )}
      </div>

      {/* Waiting for opponent panel */}
      {mode === "waiting_opponent" && mpRoom && (
        <div style={{ marginTop: 16, background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 14, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#a78bfa" }}>⏳ Waiting for opponent…</div>

          {/* Room link row */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 0, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Room: <strong style={{ color: "var(--text-primary)" }}>{mpRoom.id}</strong>
            </div>
            <InviteViaDm gameTag="pong" gameId={mpRoom?.id ?? ""} label="📨 Invite Friend" />
          </div>

          {/* Invite a friend */}
          {friends.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>Invite a friend directly:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {friends.map(f => (
                  <button
                    key={f.user_id}
                    onClick={async () => {
                      try {
                        await fetch("/api/messages", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ recipientId: f.user_id, content: `🏓 Come play Paddle with me! Join here: ${roomLink}` }),
                        });
                        setInviteSent(f.user_id);
                        setTimeout(() => setInviteSent(null), 3000);
                      } catch { /* ignore */ }
                    }}
                    style={{
                      background: inviteSent === f.user_id ? "rgba(74,238,74,0.15)" : "rgba(255,255,255,0.06)",
                      border: `1px solid ${inviteSent === f.user_id ? "rgba(74,238,74,0.4)" : "var(--border)"}`,
                      borderRadius: 8, padding: "6px 14px", color: inviteSent === f.user_id ? "#4aee4a" : "var(--text-secondary)",
                      fontSize: 13, cursor: "pointer", fontWeight: 600, transition: "all 0.2s",
                    }}
                  >
                    {inviteSent === f.user_id ? "✓ Sent!" : `Invite @${f.username}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cancel */}
          <button
            onClick={() => {
              if (pollTimerRef.current) clearInterval(pollTimerRef.current);
              if (mpRoom) fetch("/api/pong", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "abandon", roomId: mpRoom.id }) }).catch(() => {});
              setMpRoom(null); mpRoomRef.current = null; setModeSync("menu");
            }}
            style={{ alignSelf: "flex-start", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "6px 14px", color: "#f87171", fontSize: 12, cursor: "pointer" }}
          >
            ✕ Cancel
          </button>
        </div>
      )}

      {/* Join game panel */}
      {mode === "menu" && userId && (
        <div style={{ marginTop: 16, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)", flexShrink: 0 }}>Have a room ID?</span>
          <input
            value={joinRoomId}
            onChange={e => setJoinRoomId(e.target.value)}
            onKeyDown={e => e.key === "Enter" && joinRoom()}
            placeholder="Paste Room ID…"
            style={{ flex: 1, minWidth: 120, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none" }}
          />
          <button onClick={joinRoom} disabled={joining || !joinRoomId.trim()} style={{ background: "linear-gradient(135deg, #7c3aed, #ef4444)", border: "none", borderRadius: 8, padding: "8px 18px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: joining || !joinRoomId.trim() ? 0.6 : 1 }}>
            {joining ? "Joining…" : "Join"}
          </button>
          {joinError && <span style={{ fontSize: 12, color: "#f87171", width: "100%" }}>⚠ {joinError}</span>}
        </div>
      )}

      {/* Controls hint */}
      <div style={{ marginTop: 12, display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
        {[["W / ↑", "Paddle up"], ["S / ↓", "Paddle down"], ["Mouse / Touch", "Move paddle"], ["Space", "Pause (solo)"]].map(([k, d]) => (
          <div key={k} style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <span style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.13)", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontFamily: "monospace", color: "var(--text-secondary)" }}>{k}</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{d}</span>
          </div>
        ))}
      </div>

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>⚡ Paddle Leaderboard</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {leaderboard.slice(0, 10).map((p, i) => (
              <div key={p.user_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", background: p.user_id === userId ? "rgba(124,58,237,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${p.user_id === userId ? "rgba(124,58,237,0.3)" : "var(--border)"}`, borderRadius: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? "#fbbf24" : i === 1 ? "#94a3b8" : i === 2 ? "#cd7c2f" : "var(--text-muted)", width: 22, textAlign: "center" }}>#{i + 1}</span>
                <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>@{p.username}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa" }}>{p.elo}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.wins}W {p.losses}L</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
