"use client";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSession, signIn } from "@/lib/use-session";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useVoice } from "@/app/components/VoiceWidget";
import { usePresence } from "@/lib/usePresence";
import { useNotifications } from "@/lib/useNotifications";

interface User { id: string; username: string; display_name: string; avatar_url: string; }
interface Message { id: number; sender_id: string; content: string; created_at: string; username: string; avatar_url: string; image_data?: string; is_ephemeral?: boolean; }
interface Group { id: number; name: string; created_by: string; created_at: string; member_count: number; }
type ChatMessage = Message;

function bloop(type: "send" | "receive") {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sine";
    if (type === "send") {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.08);
    } else {
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(380, ctx.currentTime + 0.1);
    }
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.18);
    osc.onended = () => ctx.close();
  } catch { /* silently fail */ }
}

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function renderTextWithLinks(text: string) {
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) =>
    URL_REGEX.test(part)
      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-blue)", textDecoration: "underline", wordBreak: "break-all" }}>{part}</a>
      : part
  );
}

function AiImage({ url, prompt }: { url: string; prompt: string }) {
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [src, setSrc] = useState(url);

  function manualRetry() {
    const bust = Math.floor(Math.random() * 100000);
    setSrc(`/api/generate-image?prompt=${encodeURIComponent(prompt)}&_=${bust}`);
    setStatus("loading");
  }

  return (
    <div>
      {status === "loading" && (
        <div style={{ width: 260, height: 260, background: "rgba(124,92,191,0.12)", borderRadius: 10, border: "1px solid rgba(124,92,191,0.3)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <div style={{ fontSize: 28, animation: "pulse-glow 2s ease-in-out infinite" }}>✦</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", textAlign: "center" }}>Generating<br /><em style={{ fontSize: 11, opacity: 0.7 }}>{prompt}</em></div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>~5–15 seconds</div>
        </div>
      )}
      {status === "error" && (
        <div style={{ width: 260, padding: "18px 14px", background: "rgba(191,92,92,0.1)", borderRadius: 10, border: "1px solid rgba(191,92,92,0.3)", textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "rgba(255,150,150,0.8)", marginBottom: 10 }}>Image failed to generate</div>
          <button onClick={manualRetry} style={{ background: "var(--accent-purple)", color: "#fff", border: "none", borderRadius: 7, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Try Again</button>
        </div>
      )}
      <img
        key={src}
        src={src}
        alt={prompt}
        onLoad={() => setStatus("done")}
        onError={() => setStatus("error")}
        style={{ maxWidth: "100%", maxHeight: 300, borderRadius: 10, display: status === "done" ? "block" : "none" }}
      />
      {status === "done" && prompt && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>✦ {prompt}</div>}
    </div>
  );
}

function InviteCard({ href, emoji, title, subtitle, cta, color, newTab }: { href: string; emoji: string; title: string; subtitle: string; cta: string; color: string; newTab?: boolean }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => newTab ? window.open(href, "_blank", "noopener,noreferrer") : (window.location.href = href)}
      onKeyDown={e => e.key === "Enter" && (newTab ? window.open(href, "_blank", "noopener,noreferrer") : (window.location.href = href))}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: `rgba(${color},0.12)`, border: `1px solid rgba(${color},0.35)`, borderRadius: 12, textDecoration: "none", color: "var(--text-primary)", maxWidth: 280, cursor: "pointer" }}
    >
      <div style={{ fontSize: 36, lineHeight: 1, flexShrink: 0 }}>{emoji}</div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: `rgb(${color})` }}>{title}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{subtitle}</div>
        <div style={{ marginTop: 8, display: "inline-block", background: `rgb(${color})`, color: "#fff", borderRadius: 6, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>{cta}</div>
      </div>
    </div>
  );
}

function ChessCard({ gameId }: { gameId: string }) {
  return <InviteCard href={`/chess/${gameId}`} emoji="♟" title="Chess Challenge!" subtitle="Click to play (spectators welcome)" cta="Open Board →" color="124,92,191" />;
}

function quizSound(type: "correct" | "wrong" | "tick" | "select") {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    if (type === "correct") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(523, ctx.currentTime);
      osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.45);
    } else if (type === "wrong") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.setValueAtTime(160, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
    } else if (type === "select") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.08);
    }
    osc.onended = () => ctx.close();
  } catch { /* ignore */ }
}

interface InlineQuizGame {
  id: string; topic: string;
  questions: Array<{ question: string; correct_answer: string; incorrect_answers: string[] }>;
  current_question: number;
  player1_id: string; player1_score: number; player1_answered: number;
  player1_username: string; player1_avatar: string;
  player2_id: string; player2_score: number; player2_answered: number;
  player2_username: string; player2_avatar: string;
  status: string; winner_id: string | null;
}

// Decode HTML entities (Open Trivia DB returns encoded strings)
function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&apos;/g, "'")
    .replace(/&ldquo;/g, "\u201c").replace(/&rdquo;/g, "\u201d")
    .replace(/&lsquo;/g, "\u2018").replace(/&rsquo;/g, "\u2019")
    .replace(/&ndash;/g, "\u2013").replace(/&mdash;/g, "\u2014")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function shuffleQuizAnswers(q: { correct_answer: string; incorrect_answers: string[] }, qIdx: number) {
  const correct = decodeHtml(q.correct_answer);
  // Deduplicate: if correct answer appears in incorrect_answers (HTML entity mismatch),
  // drop the duplicate so we never show the same text twice (which confuses "multiple correct" appearance)
  const seen = new Set<string>([correct.toLowerCase().trim()]);
  const ans: { text: string; correct: boolean }[] = [{ text: correct, correct: true }];
  q.incorrect_answers.forEach(a => {
    const decoded = decodeHtml(a);
    const key = decoded.toLowerCase().trim();
    if (!seen.has(key)) { seen.add(key); ans.push({ text: decoded, correct: false }); }
  });
  // Seeded Fisher-Yates — fully deterministic and stable across re-renders (no sort instability)
  for (let i = ans.length - 1; i > 0; i--) {
    const seed = Math.abs((qIdx * 2654435761 + i * 1013904223) >>> 0);
    const j = seed % (i + 1);
    [ans[i], ans[j]] = [ans[j], ans[i]];
  }
  return ans;
}

function InlineQuizCard({ challengeId, sessionUserId, senderId }: { challengeId: string; sessionUserId: string | null; senderId: string }) {
  type Stage = "challenge" | "waiting" | "loading" | "playing" | "done";
  const [stage, setStage] = useState<Stage>("challenge");
  const [game, setGame] = useState<InlineQuizGame | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState("");
  const [topic, setTopic] = useState<string>("");
  const isChallenger = sessionUserId === senderId;
  // Track which question index we last reset for — prevents "already answered" stale-closure bug
  const lastShownQuestionRef = useRef(-1);
  // Memoize shuffled answers per question — prevents re-shuffle on re-renders which misaligns button clicks
  const shuffledAnswersRef = useRef<{ text: string; correct: boolean }[]>([]);
  const shuffledForQRef = useRef(-1);

  // DM quiz fully auto-start: no accept step for anyone.
  // Order: sessionStorage → existing game → auto-create game via accept API.
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // 1. Cached game → play immediately
      const stored = sessionStorage.getItem(`iq_${challengeId}`);
      if (stored) { setGameId(stored); setStage("playing"); return; }

      setStage("loading");
      try {
        const r = await fetch(`/api/quiz/challenge?id=${challengeId}`);
        if (!r.ok) { if (!cancelled) setStage("challenge"); return; }
        const d = await r.json();
        if (cancelled) return;
        if (d.topic) setTopic(d.topic);

        // 2. Game already exists
        if (d.gameId) {
          sessionStorage.setItem(`iq_${challengeId}`, d.gameId);
          setGameId(d.gameId); setStage("playing"); return;
        }

        // 3. No game — auto-accept to create it (works for both players in DM context)
        const ar = await fetch("/api/quiz/challenge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challengeId, action: "accept", dmGame: true }),
        });
        if (cancelled) return;
        const result = await ar.json();

        if (result.gameId) {
          sessionStorage.setItem(`iq_${challengeId}`, result.gameId);
          setGameId(result.gameId); setStage("playing");
        } else if (result.error?.includes("not ready")) {
          setError("retry"); setStage("challenge");
        } else {
          // Old challenge can't be recovered
          setError("expired"); setStage("challenge");
        }
      } catch { if (!cancelled) { setError("expired"); setStage("challenge"); } }
    }

    init();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeId]);

  // Poll game state
  useEffect(() => {
    if (!gameId || stage !== "playing") return;
    const load = async () => {
      try {
        const r = await fetch(`/api/quiz/${gameId}`);
        const g = await r.json();
        if (g && !g.error) {
          // Reset answer state whenever the current question changes from what we last showed
          if (g.current_question !== lastShownQuestionRef.current) {
            lastShownQuestionRef.current = g.current_question;
            setSelected(null);
            setRevealed(false);
          }
          setGame(g);
          if (g.status === "completed") setStage("done");
        }
      } catch { /* ignore */ }
    };
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, [gameId, stage]);

  async function accept() {
    setStage("loading"); setError("");
    try {
      const r = await fetch("/api/quiz/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, action: "accept", dmGame: true }),
      });
      const d = await r.json();
      if (d.gameId) {
        sessionStorage.setItem(`iq_${challengeId}`, d.gameId);
        setGameId(d.gameId); setStage("playing");
      } else {
      const msg = d.error ?? "Failed to start";
      setError(msg.includes("not ready") ? "Still generating questions — try again in a moment!" : msg);
      setStage("challenge");
    }
    } catch { setError("Network error"); setStage("challenge"); }
  }

  async function submitAnswer(answerIdx: number, isCorrect: boolean) {
    if (!game || !gameId || selected !== null) return;
    const qIdx = game.current_question;
    setSelected(answerIdx); setRevealed(true);
    quizSound(isCorrect ? "correct" : "wrong");
    try {
      const r = await fetch(`/api/quiz/${gameId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionIndex: qIdx, answerIndex: answerIdx, isCorrect, timeMs: 5000 }),
      });
      const g = await r.json();
      if (g && !g.error) {
        // If both players answered simultaneously, API response already shows next question
        // Reset UI so we can answer the next question immediately
        if (g.current_question !== qIdx && g.current_question !== lastShownQuestionRef.current) {
          lastShownQuestionRef.current = g.current_question;
          setSelected(null);
          setRevealed(false);
        }
        setGame(g);
        if (g.status === "completed") setStage("done");
      }
    } catch { /* ignore */ }
  }

  const cardBase: React.CSSProperties = { maxWidth: stage === "playing" ? 360 : 300, borderRadius: 14, overflow: "hidden" };

  if (stage === "loading") {
    return (
      <div style={{ ...cardBase, background: "rgba(74,144,217,0.08)", border: "1px solid rgba(74,144,217,0.2)", padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 20, animation: "pulse 1.2s ease-in-out infinite" }}>🧠</span>
        <div>
          <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 700 }}>Starting quiz…</div>
          {topic && <div style={{ fontSize: 11, color: "#4a90d9", marginTop: 2 }}>Topic: {topic}</div>}
        </div>
      </div>
    );
  }

  // Expired old challenge or retry state
  if (stage === "challenge") {
    const isExpired = error === "expired";
    const isRetry = error === "retry";
    return (
      <div style={{ ...cardBase, background: "rgba(74,144,217,0.07)", border: "1px solid rgba(74,144,217,0.18)", padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: topic ? 8 : 0 }}>
          <span style={{ fontSize: 24 }}>🧠</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: isExpired ? "var(--text-muted)" : "#4a90d9" }}>
              {isExpired ? "Quiz challenge expired" : "Quiz"}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {isExpired ? "Start a new /quiz challenge!" : isRetry ? "Questions loading…" : ""}
            </div>
          </div>
        </div>
        {topic && (
          <div style={{ background: "rgba(74,144,217,0.1)", border: "1px solid rgba(74,144,217,0.2)", borderRadius: 7, padding: "4px 10px", fontSize: 11, color: "#7ab8f0", fontWeight: 600, marginBottom: isRetry ? 8 : 0 }}>
            📚 {topic}
          </div>
        )}
        {isRetry && (
          <button onClick={() => { setError(""); setStage("loading"); /* re-run init */ const e = new Event("rerun"); document.dispatchEvent(e); }} style={{ width: "100%", background: "rgba(74,144,217,0.2)", color: "#4a90d9", border: "1px solid rgba(74,144,217,0.3)", borderRadius: 9, padding: "8px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Retry →
          </button>
        )}
      </div>
    );
  }

  if (stage === "waiting") {
    return (
      <div style={{ ...cardBase, background: "rgba(74,144,217,0.07)", border: "1px solid rgba(74,144,217,0.18)", padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: topic ? 8 : 0 }}>
          <span style={{ fontSize: 24, animation: "pulse 1.2s ease-in-out infinite" }}>🧠</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#4a90d9" }}>Starting quiz…</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{error || "Setting up the game…"}</div>
          </div>
        </div>
        {topic && (
          <div style={{ background: "rgba(74,144,217,0.1)", border: "1px solid rgba(74,144,217,0.2)", borderRadius: 7, padding: "4px 10px", fontSize: 11, color: "#7ab8f0", fontWeight: 600 }}>
            📚 {topic}
          </div>
        )}
      </div>
    );
  }

  if (stage === "done" && game) {
    const myId = sessionUserId;
    const myScore = game.player1_id === myId ? game.player1_score : game.player2_score;
    const oppScore = game.player1_id === myId ? game.player2_score : game.player1_score;
    const oppName = game.player1_id === myId ? game.player2_username : game.player1_username;
    const won = game.winner_id === myId;
    const tied = !game.winner_id;
    return (
      <div style={{ ...cardBase, background: won ? "rgba(74,217,144,0.1)" : tied ? "rgba(255,255,255,0.05)" : "rgba(239,68,68,0.08)", border: `1px solid ${won ? "rgba(74,217,144,0.4)" : tied ? "rgba(255,255,255,0.1)" : "rgba(239,68,68,0.3)"}`, padding: "14px 16px", textAlign: "center" }}>
        <div style={{ fontSize: 22, marginBottom: 6 }}>{won ? "🏆 You won!" : tied ? "🤝 Tied!" : "💀 You lost"}</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{myScore} – {oppScore} vs @{oppName}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Just for fun · no rating changes</div>
      </div>
    );
  }

  if (stage === "playing" && game) {
    const q = game.questions[game.current_question];
    if (!q) return null;
    // Memoize shuffle so answers don't reorder between renders (would misalign click targets)
    if (shuffledForQRef.current !== game.current_question) {
      shuffledAnswersRef.current = shuffleQuizAnswers(q, game.current_question);
      shuffledForQRef.current = game.current_question;
    }
    const answers = shuffledAnswersRef.current;
    const isPlayer1 = game.player1_id === sessionUserId;
    const myAnswered = Number(isPlayer1 ? game.player1_answered : game.player2_answered);
    const hasAnswered = myAnswered >= game.current_question;
    const oppAnswered = isPlayer1
      ? Number(game.player2_answered) >= game.current_question
      : Number(game.player1_answered) >= game.current_question;
    const myScore = isPlayer1 ? game.player1_score : game.player2_score;
    const oppScore = isPlayer1 ? game.player2_score : game.player1_score;
    const oppName = isPlayer1 ? game.player2_username : game.player1_username;
    return (
      <div style={{ ...cardBase, background: "rgba(13,15,22,0.95)", border: "1px solid rgba(74,144,217,0.3)", padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: "#4a90d9", fontWeight: 700 }}>🧠 Q{game.current_question + 1}/12 · {game.topic}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>You {myScore} – {oppScore} @{oppName}</div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12, lineHeight: 1.45 }}>{decodeHtml(q.question)}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {answers.map((ans, i) => {
            const isSelected = selected === i;
            const showResult = revealed || hasAnswered;
            let bg = "rgba(255,255,255,0.04)";
            let border = "1px solid rgba(255,255,255,0.08)";
            let color = "var(--text-secondary)";
            let scale = "scale(1)";
            if (showResult) {
              if (ans.correct) { bg = "rgba(74,217,144,0.2)"; border = "1px solid rgba(74,217,144,0.55)"; color = "#4ad990"; }
              else if (isSelected) { bg = "rgba(239,68,68,0.18)"; border = "1px solid rgba(239,68,68,0.45)"; color = "#f87171"; }
            } else if (isSelected) {
              scale = "scale(0.97)";
            }
            return (
              <button
                key={i}
                onClick={() => { if (!hasAnswered && !revealed) { quizSound("select"); submitAnswer(i, ans.correct); } }}
                disabled={hasAnswered || revealed}
                style={{
                  background: bg, border, borderRadius: 8, padding: "8px 12px",
                  color, fontSize: 12, textAlign: "left", cursor: hasAnswered || revealed ? "default" : "pointer",
                  transition: "all 0.15s", fontFamily: "inherit", transform: scale,
                  fontWeight: isSelected ? 700 : 400,
                }}
              >{ans.text}</button>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, textAlign: "center", minHeight: 16 }}>
          {(hasAnswered || revealed)
            ? oppAnswered
              ? "Both answered · loading next question…"
              : `Waiting for @${oppName} to answer…`
            : " "}
        </div>
      </div>
    );
  }

  return null;
}

function WatchCard({ roomId }: { roomId: string }) {
  return <InviteCard href={`/stremio/${roomId}`} emoji="🎬" title="Stream Together!" subtitle="Stream anything · screen · games · movies" cta="Join Stream →" color="239,130,56" />;
}

function SnesCard({ roomId }: { roomId: string }) {
  return <InviteCard href={`/emulator?joinRoom=${roomId}`} emoji="🕹️" title="Play SNES Together!" subtitle="Rollback netplay · join the lobby" cta="Open Arena →" color="124,58,237" newTab />;
}

function VoiceCard({ roomId }: { roomId: string }) {
  return <InviteCard href={`/messages?voice=${roomId}`} emoji="🎙️" title="Join Voice Chat!" subtitle="Click to join the voice room" cta="Join Room →" color="74,222,128" />;
}

function PokerCard({ roomId }: { roomId: string }) {
  return <InviteCard href={`/poker/${roomId}`} emoji="🃏" title="Poker Table!" subtitle="Texas Hold'em · join and play" cta="Join Table →" color="74,217,144" />;
}

function PartyCard({ partyId }: { partyId: string }) {
  return <InviteCard href={`/town?joinParty=${partyId}`} emoji="🎮" title="Party Invite!" subtitle="Join up in the Kingdom of Flock" cta="Join Party →" color="100,200,100" />;
}

function MessageContent({ content, sessionUserId, senderId }: { content: string; sessionUserId?: string | null; senderId?: string }) {
  if (content.startsWith("[image:")) {
    const inner = content.slice(7, -1);
    const protocolEnd = inner.startsWith("https://") ? 8 : inner.startsWith("http://") ? 7 : 0;
    const colonIdx = inner.indexOf(":", protocolEnd);
    const prompt = colonIdx >= 0 ? inner.slice(colonIdx + 1) : inner;
    const url = `/api/generate-image?prompt=${encodeURIComponent(prompt)}`;
    return <AiImage url={url} prompt={prompt} />;
  }
  if (content.startsWith("[gif:")) {
    const url = content.slice(5, -1);
    return <img src={url} alt="GIF" style={{ maxWidth: "100%", maxHeight: 250, borderRadius: 10, display: "block" }} />;
  }
  if (content.startsWith("[watch:")) {
    const roomId = content.slice(7, -1);
    return <WatchCard roomId={roomId} />;
  }
  if (content.startsWith("[poker:")) {
    const roomId = content.slice(7, -1);
    return <PokerCard roomId={roomId} />;
  }
  if (content.startsWith("[voice:")) {
    const roomId = content.slice(7, -1);
    return <VoiceCard roomId={roomId} />;
  }
  if (content.startsWith("[snes:")) {
    const roomId = content.slice(6, -1);
    return <SnesCard roomId={roomId} />;
  }
  if (content.startsWith("[chess:")) {
    const gameId = content.slice(7, -1);
    return <ChessCard gameId={gameId} />;
  }
  if (content.startsWith("[party:")) {
    const partyId = content.slice(7, -1);
    return <PartyCard partyId={partyId} />;
  }
  if (content.startsWith("[quiz:")) {
    const challengeId = content.slice(6, -1);
    return <InlineQuizCard challengeId={challengeId} sessionUserId={sessionUserId ?? null} senderId={senderId ?? ""} />;
  }
  return <>{renderTextWithLinks(content)}</>;
}

interface GifResult { id: string; images: { fixed_height: { url: string } }; title: string; }

function GifPicker({ onPick, onClose }: { onPick: (url: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [noKey, setNoKey] = useState(false);

  const search = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/gif-search?q=${encodeURIComponent(query)}`);
      const json = await res.json();
      setNoKey((!json.data || json.data.length === 0) && !query);
      setGifs(json.data ?? []);
    } catch { setGifs([]); }
    setLoading(false);
  }, []);

  useEffect(() => { search(""); }, [search]);
  useEffect(() => {
    if (!q) { search(""); return; }
    const t = setTimeout(() => search(q), 400);
    return () => clearTimeout(t);
  }, [q, search]);

  return (
    <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 12, zIndex: 9999, width: "min(480px, 95vw)", maxHeight: "60vh", display: "flex", flexDirection: "column", gap: 8, boxShadow: "0 8px 48px rgba(0,0,0,0.6)" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search GIFs..." autoFocus style={{ flex: 1, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 18, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}>×</button>
      </div>
      {noKey && <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "8px 0" }}>Add <strong>GIPHY_API_KEY</strong> to Vercel env vars to enable GIFs.<br />Get one free at developers.giphy.com</div>}
      {loading && <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>Loading...</div>}
      <div style={{ overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, flex: 1 }}>
        {gifs.map(gif => (
          <button key={gif.id} onClick={() => { onPick(gif.images.fixed_height.url); onClose(); }} style={{ background: "none", border: "1px solid transparent", cursor: "pointer", padding: 0, borderRadius: 8, overflow: "hidden", transition: "border-color 0.1s" }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent-purple)")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "transparent")}>
            <img src={gif.images.fixed_height.url} alt={gif.title} style={{ width: "100%", height: 90, objectFit: "cover", display: "block", borderRadius: 6 }} />
          </button>
        ))}
      </div>
      <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "right" }}>Powered by GIPHY</div>
    </div>
  );
}

function ChatView({
  messages, sessionUserId, onSend, onUnsend, onSendImage, placeholder, headerContent, onBack, isMobile, opponentId, onCall, isInCall, groupId
}: {
  messages: ChatMessage[];
  sessionUserId: string;
  onSend: (text: string) => Promise<void>;
  onUnsend?: (id: number) => void;
  onSendImage?: (imageData: string) => void;
  placeholder: string;
  headerContent: React.ReactNode;
  onBack?: () => void;
  isMobile: boolean;
  opponentId?: string;
  onCall?: () => void;
  isInCall?: boolean;
  groupId?: number;
}) {
  const [input, setInput] = useState("");
  const [showGif, setShowGif] = useState(false);
  const [imaginePrompt, setImaginePrompt] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [chessHint, setChessHint] = useState(false);
  const [quizHint, setQuizHint] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handlePaste(e: React.ClipboardEvent) {
    if (!onSendImage) return;
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find(item => item.type.startsWith("image/"));
    if (!imageItem) return;
    e.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) return;
    const bitmap = await createImageBitmap(file);
    const MAX = 600;
    const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
    if (dataUrl.length > 820000) { alert("Image too large to send — try a smaller screenshot."); return; }
    onSendImage(dataUrl);
  }

  // Browser session restore can repopulate the textarea after React's initial render.
  // This fires after mount, overriding any browser-restored value with an empty string.
  useEffect(() => {
    setInput("");
    if (textareaRef.current) textareaRef.current.value = "";
  }, []);

  // Only auto-scroll when user is already at the bottom
  useEffect(() => {
    if (atBottom) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, atBottom]);

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    setAtBottom(scrollHeight - scrollTop - clientHeight < 80);
  }

  function handleInput(val: string) {
    setInput(val);
    setImaginePrompt(null); // /imagine disabled
    setChessHint(val === "/chess");
    setQuizHint(val === "/quiz" || val.startsWith("/quiz "));
  }

  async function send() {
    const text = input.trim();
    if (!text) return;
    setInput(""); setImaginePrompt(null); setChessHint(false); setQuizHint(false);
    if (text === "/chess" && opponentId) {
      setGenerating(true);
      try {
        const res = await fetch("/api/chess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ opponentId }),
        });
        const game = await res.json();
        if (game.id) await onSend(`[chess:${game.id}]`);
        else await onSend("Failed to create chess game.");
      } catch {
        await onSend("Failed to create chess game.");
      }
      setGenerating(false);
    } else if ((text === "/quiz" || text.startsWith("/quiz ")) && opponentId) {
      setGenerating(true);
      try {
        const topic = text.startsWith("/quiz ") ? text.slice(6).trim() : "General Knowledge";
        const res = await fetch("/api/quiz", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challengedId: opponentId, topic, dmGame: true }),
        });
        const challenge = await res.json();
        if (challenge.id) {
          // If game auto-started (DM mode), cache the gameId so this player sees it instantly
          if (challenge.gameId) {
            sessionStorage.setItem(`iq_${challenge.id}`, challenge.gameId);
          }
          await onSend(`[quiz:${challenge.id}]`);
        } else await onSend("Failed to create quiz challenge.");
      } catch {
        await onSend("Failed to create quiz challenge.");
      }
      setGenerating(false);
    } else {
      await onSend(text);
    }
  }

  return (
    <>
      <div className="panel-header" style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
        {isMobile && onBack && <button onClick={onBack} style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 18, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>←</button>}
        {headerContent}
      </div>
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "visible", padding: "16px 36px 16px 16px", display: "flex", flexDirection: "column", gap: 0, position: "relative" }}
      >
        {messages.map((msg, idx) => {
          const mine = msg.sender_id === sessionUserId;
          const isMedia = msg.content.startsWith("[image:") || msg.content.startsWith("[gif:") || msg.content.startsWith("[chess:") || msg.content.startsWith("[quiz:") || msg.content.startsWith("[watch:") || msg.content.startsWith("[poker:") || msg.content.startsWith("[voice:") || msg.content.startsWith("[snes:") || msg.content.startsWith("[party:");
          const isQuiz = msg.content.startsWith("[quiz:");
          // Group consecutive messages from same sender — hide avatar/name if previous msg same sender
          const prevMsg = messages[idx - 1];
          const isGrouped = prevMsg && prevMsg.sender_id === msg.sender_id;
          return (
            <div
              key={msg.id}
              className="msg-row"
              style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 10, position: "relative", paddingLeft: 2, marginTop: idx === 0 ? 0 : isGrouped ? 2 : 14 }}
            >
              {/* Avatar column — always left */}
              <div style={{ width: 34, flexShrink: 0, paddingTop: 2 }}>
                {!isGrouped && (
                  <Link href={`/profile/${msg.username}`} style={{ textDecoration: "none" }}>
                    <img
                      src={msg.avatar_url || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${msg.username}`}
                      style={{ width: 34, height: 34, borderRadius: 9, display: "block", border: "1px solid var(--border)" }}
                      alt="avatar"
                    />
                  </Link>
                )}
              </div>

              {/* Message body */}
              <div style={{ flex: 1, minWidth: 0, maxWidth: isQuiz ? "calc(100% - 44px)" : "calc(100% - 44px)" }}>
                {!isGrouped && (
                  <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginBottom: 2 }}>
                    <Link href={`/profile/${msg.username}`} style={{ textDecoration: "none" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: mine ? "var(--accent-purple-bright)" : "var(--text-primary)" }}>
                        @{msg.username}
                      </span>
                    </Link>
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                )}
                <div style={{ position: "relative", display: "inline-flex", alignItems: "flex-start", maxWidth: "100%", width: isQuiz ? "100%" : undefined }}>
                  <div
                    className={mine ? "bubble-mine" : "bubble-theirs"}
                    style={{
                      padding: (isMedia || msg.image_data) ? "6px" : "7px 12px",
                      fontSize: 14,
                      lineHeight: 1.5,
                      color: "var(--text-primary)",
                      maxWidth: isQuiz ? "100%" : "calc(min(520px, 100%))",
                      width: isQuiz ? "100%" : undefined,
                    }}
                  >
                    {msg.image_data ? (
                      <img src={msg.image_data} alt="pasted image" style={{ maxWidth: 280, maxHeight: 280, borderRadius: 8, display: "block" }} />
                    ) : (
                      <MessageContent content={msg.content} sessionUserId={sessionUserId} senderId={msg.sender_id} />
                    )}
                  </div>
                  {/* Unsend button — own messages only, revealed on hover */}
                  {mine && (
                    <button
                      className="unsend-btn"
                      title="Unsend"
                      onClick={async () => {
                        const endpoint = groupId ? `/api/groups/${groupId}/messages` : "/api/messages";
                        const res = await fetch(endpoint, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: msg.id }) });
                        if (res.ok) onUnsend?.(msg.id);
                      }}
                      style={{
                        position: "absolute", top: "50%", right: -26, transform: "translateY(-50%)",
                        background: "rgba(220,60,60,0.85)", border: "none", borderRadius: 5,
                        color: "#fff", fontSize: 11, fontWeight: 800, lineHeight: 1,
                        width: 20, height: 20, cursor: "pointer", display: "flex",
                        alignItems: "center", justifyContent: "center", flexShrink: 0,
                        opacity: 0, transition: "opacity 0.15s ease",
                      }}
                    >×</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
        {/* Get the tea — jump to bottom when scrolled up */}
        {!atBottom && (
          <div style={{ position: "sticky", bottom: 8, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
            <button
              onClick={() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); setAtBottom(true); }}
              style={{
                pointerEvents: "all",
                background: "linear-gradient(135deg, #7c5cbf, #e84393)",
                color: "#fff", border: "none", borderRadius: 20,
                padding: "7px 18px", fontSize: 12, fontWeight: 700,
                cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              ☕ Get the tea ↓
            </button>
          </div>
        )}
      </div>

      {imaginePrompt && (
        <div style={{ padding: "6px 14px", borderTop: "1px solid var(--border)", background: "rgba(124,92,191,0.08)", fontSize: 12, color: "var(--accent-purple-bright)", display: "flex", alignItems: "center", gap: 8 }}>
          <span>✦</span> Will generate: <em>{imaginePrompt}</em>
        </div>
      )}
      {chessHint && opponentId && (
        <div style={{ padding: "6px 14px", borderTop: "1px solid var(--border)", background: "rgba(74,144,217,0.08)", fontSize: 12, color: "#4a90d9", display: "flex", alignItems: "center", gap: 8 }}>
          <span>♟</span> Will challenge to chess — press Send!
        </div>
      )}
      {quizHint && opponentId && (
        <div style={{ padding: "6px 14px", borderTop: "1px solid var(--border)", background: "rgba(74,144,217,0.08)", fontSize: 12, color: "#4a90d9", display: "flex", alignItems: "center", gap: 8 }}>
          <span>🧠</span> Will send a quiz challenge — press Send! (add topic: /quiz Science)
        </div>
      )}

      <div style={{ padding: isMobile ? "8px 10px" : "10px 14px", borderTop: "1px solid var(--border)", display: "flex", gap: isMobile ? 4 : 6, alignItems: "flex-end", position: "relative", flexShrink: 0 }}>
        {showGif && (
          <GifPicker
            onPick={async (url) => { bloop("send"); await onSend(`[gif:${url}]`); setShowGif(false); }}
            onClose={() => setShowGif(false)}
          />
        )}
        {/* GIF button — icon-only on mobile to save space */}
        <button
          onClick={() => setShowGif(v => !v)}
          title="Send a GIF"
          style={{
            background: showGif ? "rgba(124,92,191,0.2)" : "transparent",
            border: "1px solid var(--border)", borderRadius: 8,
            padding: isMobile ? "10px 9px" : "8px 10px",
            fontSize: isMobile ? 13 : 11, fontWeight: 800,
            color: showGif ? "var(--accent-purple-bright)" : "var(--text-muted)",
            cursor: "pointer", flexShrink: 0,
            minWidth: isMobile ? 40 : "auto", minHeight: isMobile ? 42 : "auto",
            letterSpacing: isMobile ? 0 : "0.5px",
          }}
        >
          {isMobile ? "🖼" : "GIF"}
        </button>
        {/* Call button — always visible, prominent on mobile */}
        {onCall && (
          <button
            onClick={onCall}
            title={isInCall ? "End call" : "Start voice call"}
            style={{
              background: isInCall ? "rgba(239,68,68,0.15)" : "rgba(74,222,128,0.1)",
              border: `1px solid ${isInCall ? "rgba(239,68,68,0.3)" : "rgba(74,222,128,0.25)"}`,
              borderRadius: 8, padding: isMobile ? "10px 11px" : "8px 10px",
              fontSize: 15, color: isInCall ? "#f87171" : "#4ade80",
              cursor: "pointer", flexShrink: 0,
              minWidth: isMobile ? 44 : "auto", minHeight: isMobile ? 42 : "auto",
            }}
          >
            {isInCall ? "📵" : "📞"}
          </button>
        )}
        {/* Quiz button — hidden on mobile to save space (user can type /quiz) */}
        {opponentId && !isMobile && (
          <button onClick={() => { setInput("/quiz"); setQuizHint(true); }} title="Quiz Challenge" style={{ background: quizHint ? "rgba(74,144,217,0.2)" : "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 14, color: quizHint ? "#4a90d9" : "var(--text-muted)", cursor: "pointer", flexShrink: 0 }}>
            🧠
          </button>
        )}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => handleInput(e.target.value)}
          onKeyDown={e => { e.stopPropagation(); if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          onPaste={handlePaste}
          onFocus={() => { setTimeout(() => { textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, 300); }}
          placeholder={isMobile ? "Message..." : placeholder}
          autoComplete="off"
          style={{ flex: 1, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 13px", color: "var(--text-primary)", fontSize: 16, resize: "none", outline: "none", fontFamily: "inherit", minHeight: 42, maxHeight: 100 }}
          rows={1}
        />
        <button
          onClick={send}
          disabled={generating}
          style={{
            background: imaginePrompt || chessHint || quizHint ? "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))" : "var(--accent-purple)",
            color: "#fff", border: "none", borderRadius: 10,
            padding: isMobile ? "10px 13px" : "10px 14px",
            fontSize: isMobile ? 18 : 13, fontWeight: 700,
            cursor: generating ? "default" : "pointer",
            flexShrink: 0, opacity: generating ? 0.6 : 1,
            minWidth: isMobile ? 44 : 52, minHeight: isMobile ? 42 : "auto",
          }}
        >
          {generating ? "✦" : isMobile ? "→" : imaginePrompt ? "✦" : chessHint ? "♟" : quizHint ? "🧠" : "Send"}
        </button>
      </div>
    </>
  );
}

function MessagesInner() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const withId = searchParams.get("with");
  const { openRooms, joinRoom: joinVoiceRoom, currentRoomId: voiceRoomId, openMaxi, startDmCall, leaveRoom: leaveVoiceRoom, isInVoice, participantCount } = useVoice();
  const { isOnline } = usePresence();
  const { onNotification } = useNotifications();

  // Track visual viewport height for Android keyboard support
  const [vpHeight, setVpHeight] = useState<number | null>(null);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const update = () => setVpHeight(vv.height);
    vv.addEventListener("resize", update);
    update();
    return () => vv.removeEventListener("resize", update);
  }, []);

  // Lock body scroll so only the message area scrolls
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const [tab, setTab] = useState<"dms" | "groups">("dms");
  const [users, setUsers] = useState<User[]>([]);
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [friendWatchRooms, setFriendWatchRooms] = useState<{
    friend_user_id: string; room_id: string; room_name: string;
    is_screen_sharing: boolean; invite_only: boolean;
  }[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const deletedMsgIds = useRef<Set<number>>(new Set());
  const deletedGroupMsgIds = useRef<Set<number>>(new Set());
  const [isMobile, setIsMobile] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [groupMessages, setGroupMessages] = useState<ChatMessage[]>([]);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  const prevMsgIds = useRef<Set<number>>(new Set());
  const prevGroupMsgIds = useRef<Set<number>>(new Set());

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    fetch("/api/friends").then(r => r.json()).then(data => {
      if (Array.isArray(data)) setUsers(data);
    }).catch(() => {});
    if (session?.user?.id) {
      fetch("/api/groups").then(r => r.json()).then(data => {
        if (Array.isArray(data)) setGroups(data);
      }).catch(() => {});
      // Fetch which friends are watching streams
      fetch("/api/friends/watch-rooms").then(r => r.json()).then(data => {
        if (Array.isArray(data)) setFriendWatchRooms(data);
      }).catch(() => {});
    }
  }, [session]);

  useEffect(() => {
    if (withId && users.length > 0) {
      const found = users.find(u => u.id === withId);
      if (found) { setActiveUser(found); setShowChat(true); }
    }
  }, [withId, users]);

  // ── Pure WebSocket DM system ─────────────────────────────────────────────────
  const dmWsRef = useRef<{ send: (d: string) => void; close: () => void } | null>(null);

  const loadMessages = useCallback(() => {
    if (!activeUser || !session?.user?.id) return;
    fetch(`/api/messages?with=${activeUser.id}`).then(r => r.json()).then((data: ChatMessage[]) => {
      if (!Array.isArray(data)) return;
      const filtered = data.filter(m => !deletedMsgIds.current.has(m.id));
      const dbIds = new Set(filtered.map(m => m.id));
      prevMsgIds.current = dbIds as Set<number>;
      // Merge: keep DB as source of truth, preserve recent local msgs + ephemeral images (up to 5 min)
      setMessages(prev => {
        const now = Date.now();
        const recentLocal = prev.filter(m => !dbIds.has(m.id) && (
          (m.is_ephemeral && now - new Date(m.created_at).getTime() < 300000) || // ephemeral images: 5 min TTL
          (!m.is_ephemeral && now - new Date(m.created_at).getTime() < 15000)    // regular optimistic: 15s
        ));
        if (recentLocal.length === 0) return filtered;
        return [...filtered, ...recentLocal];
      });
    }).catch(() => {});
  }, [activeUser, session]);

  // Load initial messages + connect DM WebSocket when conversation changes
  const sessionUserId = session?.user?.id;
  useEffect(() => {
    if (!activeUser?.id || !sessionUserId) return;
    prevMsgIds.current = new Set();
    loadMessages(); // Load history from DB

    const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST;
    if (!host || host === "DISABLED") return;

    const pairId = [sessionUserId, activeUser.id].sort().join("-");

    // Small delay to avoid React strict mode double-mount teardown
    const timer = setTimeout(() => {
      import("partysocket").then(({ default: PartySocket }) => {
        dmWsRef.current?.close();
        const ws = new PartySocket({ host, room: `dm-${pairId}` }) as unknown as
          { send: (d: string) => void; close: () => void; addEventListener: (t: string, cb: (e: Event) => void) => void };
        dmWsRef.current = ws;

        ws.addEventListener("message", (evt: Event) => {
          try {
            const msg = JSON.parse((evt as MessageEvent).data as string);
            if (msg.type === "dm") {
              const newMsg: ChatMessage = {
                id: msg.id ?? Date.now(),
                sender_id: msg.senderId,
                content: msg.content,
                created_at: msg.createdAt ?? new Date().toISOString(),
                username: msg.username,
                avatar_url: msg.avatarUrl ?? "",
              };
              setMessages(prev => {
                if (prev.some(m => m.id === newMsg.id || (m.content === newMsg.content && m.sender_id === newMsg.sender_id && Math.abs(new Date(m.created_at).getTime() - new Date(newMsg.created_at).getTime()) < 2000))) return prev;
                return [...prev, newMsg];
              });
              if (msg.senderId !== sessionUserId) bloop("receive");
            } else if (msg.type === "dm-image" && msg.imageData) {
              const newMsg: ChatMessage = {
                id: msg.id ?? Date.now(),
                sender_id: msg.senderId,
                content: "",
                image_data: msg.imageData,
                is_ephemeral: true,
                created_at: msg.createdAt ?? new Date().toISOString(),
                username: msg.username,
                avatar_url: msg.avatarUrl ?? "",
              };
              setMessages(prev => {
                if (prev.some(m => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
              });
              if (msg.senderId !== sessionUserId) bloop("receive");
            }
          } catch { /* ignore */ }
        });
      }).catch(() => {});
    }, 500); // debounce to let React settle

    // 30s fallback poll — catches any messages missed by WS
    const pollIv = setInterval(loadMessages, 30000);

    return () => {
      clearTimeout(timer);
      clearInterval(pollIv);
      dmWsRef.current?.close();
      dmWsRef.current = null;
    };
  }, [activeUser?.id, sessionUserId]); // eslint-disable-line

  const loadGroupMessages = useCallback(() => {
    if (!activeGroup) return;
    fetch(`/api/groups/${activeGroup.id}/messages`).then(r => r.json()).then((data: ChatMessage[]) => {
      if (!Array.isArray(data)) return;
      const filtered = data.filter(m => !deletedGroupMsgIds.current.has(m.id));
      const newIds = new Set(filtered.map(m => m.id));
      if (prevGroupMsgIds.current.size > 0 && filtered.some(m => !prevGroupMsgIds.current.has(m.id) && m.sender_id !== session?.user?.id)) bloop("receive");
      prevGroupMsgIds.current = newIds as Set<number>;
      setGroupMessages(filtered);
    }).catch(() => {});
  }, [activeGroup, session]);

  useEffect(() => {
    prevGroupMsgIds.current = new Set();
    loadGroupMessages();
    const t = setInterval(loadGroupMessages, 30000); // 30s fallback — PartyKit push handles real-time
    return () => clearInterval(t);
  }, [loadGroupMessages]);

  async function sendDM(text: string) {
    if (!activeUser || !session?.user?.id) return;
    bloop("send");
    const myId = session.user.id;
    const myName = (session.user as { name?: string }).name ?? "User";
    const myAvatar = (session.user as { image?: string }).image ?? "";
    const now = new Date().toISOString();
    const tempId = Date.now();
    // Optimistic local append — show immediately while DB saves
    setMessages(prev => [...prev, { id: tempId, sender_id: myId, content: text, created_at: now, username: myName, avatar_url: myAvatar }]);

    // DB save FIRST — must succeed before broadcasting
    const body = JSON.stringify({ receiverId: activeUser.id, content: text });
    let saved = false;
    let realId: number | undefined;
    let realCreatedAt: string | undefined;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const r = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body });
        if (r.ok) {
          const data = await r.json().catch(() => ({}));
          realId = data.message?.id;
          realCreatedAt = data.message?.created_at;
          saved = true;
          break;
        }
        const errText = await r.text().catch(() => "");
        console.warn(`DM save attempt ${attempt} failed (${r.status}):`, errText);
      } catch (e) {
        console.warn(`DM save attempt ${attempt} error:`, e);
      }
      if (attempt < 3) await new Promise(res => setTimeout(res, attempt * 2000)); // 2s, 4s backoff
    }

    if (saved) {
      // Replace tempId with real DB id so message survives refresh
      if (realId) {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: realId!, created_at: realCreatedAt ?? m.created_at } : m));
      }
      // Broadcast via WS with real id so other side deduplicates correctly
      dmWsRef.current?.send(JSON.stringify({
        type: "dm", id: realId ?? tempId, senderId: myId, content: text,
        username: myName, avatarUrl: myAvatar, createdAt: realCreatedAt ?? now,
      }));
    } else {
      console.error("DM failed to save after 3 attempts — message may be lost");
    }
  }

  function sendImageDM(imageData: string) {
    if (!activeUser || !session?.user?.id) return;
    const myId = session.user.id;
    const myName = (session.user as { name?: string }).name ?? "User";
    const myAvatar = (session.user as { image?: string }).image ?? "";
    const now = new Date().toISOString();
    const tempId = Date.now();
    // Optimistic append — ephemeral, no DB write
    setMessages(prev => [...prev, { id: tempId, sender_id: myId, content: "", image_data: imageData, is_ephemeral: true, created_at: now, username: myName, avatar_url: myAvatar }]);
    // WS only
    dmWsRef.current?.send(JSON.stringify({ type: "dm-image", id: tempId, senderId: myId, imageData, username: myName, avatarUrl: myAvatar, createdAt: now }));
    bloop("send");
  }

  async function sendGroupMsg(text: string) {
    if (!activeGroup) return;
    bloop("send");
    await fetch(`/api/groups/${activeGroup.id}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: text }) }).catch(() => {});
    setTimeout(loadGroupMessages, 400);
  }

  async function createGroup() {
    if (!newGroupName.trim()) return;
    setCreatingGroup(true);
    const res = await fetch("/api/groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newGroupName.trim(), memberIds: selectedMembers }) });
    const data = await res.json();
    if (data.id) {
      const g: Group = { id: data.id, name: newGroupName.trim(), created_by: session?.user?.id ?? "", created_at: new Date().toISOString(), member_count: selectedMembers.length + 1 };
      setGroups(prev => [g, ...prev]);
      setActiveGroup(g); setTab("groups"); setShowNewGroup(false); setNewGroupName(""); setSelectedMembers([]);
      if (isMobile) setShowChat(true);
    }
    setCreatingGroup(false);
  }

  if (!session) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100vh - 76px)", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 40 }}>💬</div>
        <h2 style={{ margin: 0 }}>Sign in to message people</h2>
        <button onClick={() => signIn()} style={{ background: "var(--accent-purple)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Sign In</button>
      </div>
    );
  }

  const sidebar = (
    <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg-elevated, #1a1d26)", borderRight: "1px solid var(--border)", minHeight: 0 }}>
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", padding: "0 8px" }}>
        {(["dms", "groups"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: "10px 0", background: "none", border: "none", borderBottom: tab === t ? "2px solid var(--accent-purple)" : "2px solid transparent", color: tab === t ? "var(--accent-purple-bright)" : "var(--text-muted)", fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {t === "dms" ? "Direct" : "Groups"}
          </button>
        ))}
      </div>

      {tab === "dms" ? (
        <>
          {/* Voice rooms section */}
          {openRooms.length > 0 && (
            <div style={{ borderBottom: "1px solid var(--border)" }}>
              <div style={{ padding: "6px 10px 4px", fontSize: 10, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                🎙️ Voice Rooms
              </div>
              {openRooms.slice(0, 5).map(room => (
                <button
                  key={room.id}
                  onClick={() => {
                    joinVoiceRoom(room.id, room.name);
                    openMaxi();
                  }}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 8,
                    padding: "7px 10px",
                    background: voiceRoomId === room.id ? "rgba(74,222,128,0.12)" : "transparent",
                    border: "none",
                    borderLeft: voiceRoomId === room.id ? "2px solid #4ade80" : "2px solid transparent",
                    cursor: "pointer", textAlign: "left",
                  }}
                >
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <img
                      src={room.creator_avatar ?? `https://api.dicebear.com/9.x/pixel-art/svg?seed=${room.creator_username}`}
                      style={{ width: 28, height: 28, borderRadius: 7, border: "2px solid rgba(74,222,128,0.4)" }}
                      alt=""
                    />
                    <span style={{
                      position: "absolute", bottom: -3, right: -3,
                      width: 8, height: 8, borderRadius: "50%",
                      background: "#4ade80", border: "2px solid var(--bg-surface)",
                    }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: voiceRoomId === room.id ? "#4ade80" : "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {room.name}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      {room.participant_count ?? 0} in voice
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="panel-header">Direct Messages</div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {users.length === 0 && <div style={{ padding: 16, fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>No friends yet.<br />Add friends from their profile!</div>}
            {users.map(u => {
              const watchRoom = friendWatchRooms.find(wr => wr.friend_user_id === u.id);
              return (
              <div key={u.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                <button onClick={() => { setActiveUser(u); prevMsgIds.current = new Set(); if (isMobile) setShowChat(true); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: activeUser?.id === u.id ? "rgba(124,92,191,0.15)" : "transparent", border: "none", borderLeft: activeUser?.id === u.id ? "2px solid var(--accent-purple)" : "2px solid transparent", cursor: "pointer", textAlign: "left" }}>
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <img src={u.avatar_url || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${u.username}`} style={{ width: 34, height: 34, borderRadius: 8 }} alt={u.username} />
                    <span style={{ position: "absolute", bottom: 0, right: 0, width: 9, height: 9, borderRadius: "50%", background: isOnline(u.id) ? "var(--online)" : "var(--offline)", border: "2px solid var(--bg-surface)" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{u.display_name || u.username}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>@{u.username}</div>
                  </div>
                </button>
                {/* Watch room badge */}
                {watchRoom && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 10px 6px", marginTop: -2 }}>
                    <span style={{ fontSize: 10, color: watchRoom.is_screen_sharing ? "#f87171" : "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}>
                      {watchRoom.is_screen_sharing ? <><span style={{ width: 5, height: 5, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />📺 Watching live</> : <>📺 In stream room</>}
                    </span>
                    <a href={`/stremio/${watchRoom.room_id}`} style={{ marginLeft: "auto", background: watchRoom.is_screen_sharing ? "rgba(239,68,68,0.12)" : "rgba(124,58,237,0.12)", border: `1px solid ${watchRoom.is_screen_sharing ? "rgba(239,68,68,0.3)" : "rgba(124,58,237,0.3)"}`, borderRadius: 5, padding: "1px 7px", color: watchRoom.is_screen_sharing ? "#f87171" : "#a78bfa", fontSize: 10, fontWeight: 700, textDecoration: "none", flexShrink: 0 }}>Join →</a>
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Group Chats</span>
            <button onClick={() => setShowNewGroup(true)} style={{ background: "var(--accent-purple)", color: "#fff", border: "none", borderRadius: 6, padding: "2px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+ New</button>
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {groups.length === 0 && <div style={{ padding: 16, fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>No groups yet.<br />Create one!</div>}
            {groups.map(g => (
              <button key={g.id} onClick={() => { setActiveGroup(g); prevGroupMsgIds.current = new Set(); if (isMobile) setShowChat(true); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: activeGroup?.id === g.id ? "rgba(124,92,191,0.15)" : "transparent", border: "none", borderLeft: activeGroup?.id === g.id ? "2px solid var(--accent-purple)" : "2px solid transparent", cursor: "pointer", textAlign: "left" }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>👥</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{g.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{g.member_count} members</div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {showNewGroup && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="panel" style={{ width: 360, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>Create Group Chat</div>
            <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Group name..." style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 14, outline: "none", fontFamily: "inherit" }} />
            <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700 }}>ADD MEMBERS</div>
            <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
              {users.map(u => (
                <label key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", cursor: "pointer" }}>
                  <input type="checkbox" checked={selectedMembers.includes(u.id)} onChange={e => setSelectedMembers(prev => e.target.checked ? [...prev, u.id] : prev.filter(id => id !== u.id))} />
                  <img src={u.avatar_url || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${u.username}`} style={{ width: 26, height: 26, borderRadius: 6 }} alt="" />
                  <span style={{ fontSize: 13 }}>{u.display_name || u.username}</span>
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowNewGroup(false)} style={{ flex: 1, background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)", borderRadius: 8, padding: "9px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button onClick={createGroup} disabled={!newGroupName.trim() || creatingGroup} style={{ flex: 1, background: "var(--accent-purple)", color: "#fff", border: "none", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{creatingGroup ? "Creating..." : "Create"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Voice status bar — Discord-style bottom bar */}
      {isInVoice && (
        <div style={{
          borderTop: "1px solid var(--border)", padding: "8px 10px",
          background: "rgba(74,222,128,0.07)", display: "flex", alignItems: "center", gap: 8,
          flexShrink: 0,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", flexShrink: 0, boxShadow: "0 0 6px #4ade80" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#4ade80" }}>Voice Connected</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{participantCount} in call</div>
          </div>
          <button
            onClick={() => leaveVoiceRoom()}
            title="Leave voice"
            style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, padding: "3px 8px", color: "#f87171", fontSize: 10, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
          >
            Leave
          </button>
        </div>
      )}
    </div>
  );

  const chatPane = (
    <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", flex: 1, minHeight: 0, background: "var(--bg-page, #0d0f14)" }}>
      {tab === "dms" ? (
        !activeUser ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, color: "var(--text-muted)" }}>
            <div style={{ fontSize: 32 }}>👈</div>
            <div style={{ fontSize: 14 }}>Select someone to message</div>
            <div style={{ fontSize: 11, opacity: 0.6, textAlign: "center" }}>Type /chess for chess · /quiz to challenge<br />Use GIF button for GIFs · 🧠 for quiz</div>
          </div>
        ) : (
          <ChatView messages={messages} sessionUserId={session.user?.id ?? ""} onSend={sendDM} onSendImage={sendImageDM}
            onUnsend={(id) => { deletedMsgIds.current.add(id); setMessages(prev => prev.filter(m => m.id !== id)); }}
            placeholder={`Message @${activeUser.username}... (/chess)`}
            isMobile={isMobile} onBack={() => setShowChat(false)}
            opponentId={activeUser.id}
            onCall={() => isInVoice ? leaveVoiceRoom() : startDmCall(activeUser.id, activeUser.username)}
            isInCall={isInVoice}
            headerContent={
              <DmCallHeader activeUser={activeUser} onSend={sendDM} sessionUserId={session.user?.id ?? ""} />
            }
          />
        )
      ) : (
        !activeGroup ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, color: "var(--text-muted)" }}>
            <div style={{ fontSize: 32 }}>👥</div>
            <div style={{ fontSize: 14 }}>Select a group or create one</div>
          </div>
        ) : (
          <ChatView messages={groupMessages} sessionUserId={session.user?.id ?? ""} onSend={sendGroupMsg}
            onUnsend={(id) => { deletedGroupMsgIds.current.add(id); setGroupMessages(prev => prev.filter(m => m.id !== id)); }}
            placeholder={`Message ${activeGroup.name}...`}
            isMobile={isMobile} onBack={() => setShowChat(false)} groupId={activeGroup.id}
            headerContent={
              <>
                <span style={{ fontSize: 16 }}>👥</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{activeGroup.name}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{activeGroup.member_count} members</span>
              </>
            }
          />
        )
      )}
    </div>
  );

  if (isMobile) {
    // When keyboard is open, vpHeight shrinks — use it directly (no bottom nav visible)
    // When keyboard is closed, vpHeight ≈ full screen — add 52px padding for bottom nav
    const keyboardOpen = vpHeight !== null && vpHeight < (typeof window !== "undefined" ? window.innerHeight * 0.75 : 9999);
    // vpHeight already excludes the sticky navbar height; subtract remaining chrome
    const containerHeight = vpHeight ? `${keyboardOpen ? vpHeight : vpHeight - 52}px` : "calc(100svh - 52px)";
    return (
      <div style={{
        height: containerHeight,
        display: "flex", flexDirection: "column", overflow: "hidden",
        paddingBottom: keyboardOpen ? 0 : 52,
        boxSizing: "border-box",
      }}>
        {showChat && (activeUser || activeGroup) ? chatPane : sidebar}
      </div>
    );
  }

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "280px 1fr",
      height: "calc(100dvh - 52px)",
      overflow: "hidden",
    }}>
      {sidebar}
      {chatPane}
    </div>
  );
}

export default function MessagesPage() {
  return <Suspense><MessagesInner /></Suspense>;
}

function DmCallHeader({ activeUser, onSend, sessionUserId }: {
  activeUser: { id: string; username: string; display_name: string; avatar_url: string };
  onSend: (text: string) => Promise<void>;
  sessionUserId: string;
}) {
  const { startDmCall, currentRoomId, leaveRoom, isInVoice, participantCount, isMuted, toggleMute } = useVoice();
  const [calling, setCalling] = useState(false);
  const [showGames, setShowGames] = useState(false);
  const [busy, setBusy] = useState(false);
  const [incomingCall, setIncomingCall] = useState<{ roomId: string; callerUsername: string; callerAvatar: string | null } | null>(null);
  const [dismissedCallId, setDismissedCallId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Incoming call delivered instantly via PartyKit notifications — no polling needed
  useEffect(() => {
    if (isInVoice || !sessionUserId) { setIncomingCall(null); return; }
    const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST;
    if (!host || host === "DISABLED") return;
    let cancelled = false;
    import("partysocket").then(({ default: PartySocket }) => {
      if (cancelled) return;
      const ws = new PartySocket({ host, party: "notifications", room: sessionUserId });
      const handleMsg = (evt: Event) => {
        try {
          const msg = JSON.parse((evt as MessageEvent).data as string);
          const handle = (m: Record<string, unknown>) => {
            if (m.type === "incoming_call" && m.callerUsername) {
              if ((m.roomId as string) !== dismissedCallId) {
                setIncomingCall({ roomId: m.roomId as string, callerUsername: m.callerUsername as string, callerAvatar: m.callerAvatar as string | null });
              }
            }
          };
          if (msg.type === "snapshot" && Array.isArray(msg.pending)) msg.pending.forEach(handle);
          else handle(msg);
        } catch { /* ignore */ }
      };
      (ws as unknown as EventTarget).addEventListener("message", handleMsg);
      return () => ws.close();
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [isInVoice, sessionUserId, dismissedCallId]);

  // Ringing = we're in voice but the callee hasn't joined yet
  const ringing = isInVoice && participantCount < 2;
  const connected = isInVoice && participantCount >= 2;

  async function handleCall() {
    setCalling(true);
    try { await startDmCall(activeUser.id, activeUser.username); }
    catch { /* ignore */ }
    setCalling(false);
  }

  async function acceptIncomingCall() {
    if (!incomingCall) return;
    setIncomingCall(null);
    await startDmCall(activeUser.id, activeUser.username);
  }

  async function sendChess() {
    setBusy(true); setShowGames(false);
    try {
      const res = await fetch("/api/chess", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opponentId: activeUser.id }) });
      const game = await res.json();
      if (game.id) await onSend(`[chess:${game.id}]`);
    } catch { /* ignore */ }
    setBusy(false);
  }

  async function sendQuiz() {
    setBusy(true); setShowGames(false);
    try {
      const res = await fetch("/api/quiz", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challengedId: activeUser.id, topic: "General Knowledge", dmGame: true }) });
      const challenge = await res.json();
      if (challenge.id) {
        if (challenge.gameId) sessionStorage.setItem(`iq_${challenge.id}`, challenge.gameId);
        await onSend(`[quiz:${challenge.id}]`);
      }
    } catch { /* ignore */ }
    setBusy(false);
  }

  async function sendPoker() {
    setBusy(true); setShowGames(false);
    try {
      const res = await fetch("/api/poker", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: `${activeUser.username}'s Table` }) });
      const room = await res.json();
      if (room.id) await onSend(`[poker:${room.id}]`);
    } catch { /* ignore */ }
    setBusy(false);
  }

  async function sendWatch() {
    setBusy(true); setShowGames(false);
    try {
      const res = await fetch("/api/watch-room", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Stream Together" }) });
      const room = await res.json();
      if (room.id) await onSend(`[watch:${room.id}]`);
    } catch { /* ignore */ }
    setBusy(false);
  }

  async function sendVoiceInvite() {
    setShowGames(false);
    if (currentRoomId) {
      await onSend(`[voice:${currentRoomId}]`);
    } else {
      await startDmCall(activeUser.id, activeUser.username);
    }
  }

  async function sendSnesInvite() {
    setBusy(true); setShowGames(false);
    try {
      const res = await fetch("/api/emulator-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", gameName: "Super Mario World", ranked: false }),
      });
      const room = await res.json();
      if (room.id) {
        // Open arena in new tab for host, send invite card to friend
        window.open(`/emulator?room=${room.id}&role=host`, "_blank");
        await onSend(`[snes:${room.id}]`);
      }
    } catch { /* ignore */ }
    setBusy(false);
  }

  return (
    <>
      <img
        src={activeUser.avatar_url || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${activeUser.username}`}
        style={{ width: 26, height: 26, borderRadius: 7 }} alt={activeUser.username}
      />
      <Link href={`/profile/${activeUser.username}`} style={{ fontSize: 14, color: "var(--text-primary)", textDecoration: "none", fontWeight: 700 }}>
        {activeUser.display_name || activeUser.username}
      </Link>
      {!isMobile && <span style={{ fontSize: 11, color: "var(--online)", background: "rgba(76,175,125,0.15)", borderRadius: 6, padding: "1px 7px" }}>Online</span>}
      <div style={{ marginLeft: "auto", display: "flex", gap: isMobile ? 4 : 6, alignItems: "center", position: "relative" }}>
        {/* Games dropdown */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowGames(v => !v)}
            disabled={busy}
            title="Invite to game"
            style={{ background: showGames ? "rgba(124,92,191,0.2)" : "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: isMobile ? "4px 8px" : "4px 10px", fontSize: 13, color: showGames ? "var(--accent-purple-bright)" : "var(--text-muted)", cursor: "pointer", fontWeight: 700, minWidth: 36, minHeight: 36 }}
          >
            🎮
          </button>
          {showGames && (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 6, zIndex: 200, minWidth: 170, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", display: "flex", flexDirection: "column", gap: 2 }}>
              {[
                { label: "♟ Chess", fn: sendChess },
                { label: "🧠 Quiz", fn: sendQuiz },
                { label: "🃏 Poker", fn: sendPoker },
                { label: "🎬 Stream Together", fn: sendWatch },
                { label: currentRoomId ? "🎙️ Invite to My Voice Room" : "📞 Start Voice Call", fn: sendVoiceInvite },
                { label: "🕹️ Play SNES Together", fn: sendSnesInvite },
              ].map(item => (
                <button key={item.label} onClick={item.fn}
                  style={{ padding: "8px 12px", background: "transparent", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, color: "var(--text-primary)", cursor: "pointer", textAlign: "left" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(124,92,191,0.15)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Call / Ringing / End */}
        {ringing ? (
          <button onClick={leaveRoom} style={{ background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.35)", borderRadius: 8, padding: "4px 10px", color: "#fbbf24", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ display: "inline-block", animation: "ring 1s ease infinite" }}>📞</span>{!isMobile && " Calling…"} ✕
          </button>
        ) : connected ? (
          <>
            <button
              onClick={toggleMute}
              title={isMuted ? "Unmute mic" : "Mute mic"}
              style={{
                background: isMuted ? "rgba(239,68,68,0.18)" : "rgba(74,222,128,0.12)",
                border: `1px solid ${isMuted ? "rgba(239,68,68,0.4)" : "rgba(74,222,128,0.3)"}`,
                borderRadius: 8, padding: isMobile ? "4px 8px" : "4px 10px",
                color: isMuted ? "#f87171" : "#4ade80",
                fontSize: 14, cursor: "pointer", minWidth: 36, minHeight: 36,
              }}
            >
              {isMuted ? "🔇" : "🎙️"}
            </button>
            <button onClick={leaveRoom} style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: isMobile ? "4px 8px" : "4px 12px", color: "#f87171", fontSize: isMobile ? 14 : 12, fontWeight: 700, cursor: "pointer", minWidth: 36, minHeight: 36 }}>
              {isMobile ? "📵" : "📵 End"}
            </button>
          </>
        ) : (
          <button onClick={handleCall} disabled={calling} style={{ background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.3)", borderRadius: 8, padding: isMobile ? "4px 8px" : "4px 12px", color: "#4ade80", fontSize: isMobile ? 14 : 12, fontWeight: 700, cursor: "pointer", opacity: calling ? 0.7 : 1, minWidth: 36, minHeight: 36 }}>
            {calling ? "📞…" : isMobile ? "📞" : "📞 Call"}
          </button>
        )}
      </div>

      {/* Incoming call banner (shown to callee in the chat) */}
      {incomingCall && !isInVoice && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
          background: "linear-gradient(135deg, #0a1a0a, #0d2010)",
          border: "1px solid rgba(74,222,128,0.4)",
          borderTop: "none",
          padding: "10px 16px",
          display: "flex", alignItems: "center", gap: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}>
          <img
            src={incomingCall.callerAvatar || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${incomingCall.callerUsername}`}
            style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #4ade80", flexShrink: 0 }}
            alt=""
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "#4ade80", fontWeight: 700, marginBottom: 1 }}>Incoming Voice Call</div>
            <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>@{incomingCall.callerUsername} is calling…</div>
          </div>
          <button onClick={acceptIncomingCall} style={{ background: "#16a34a", border: "none", borderRadius: 8, padding: "6px 14px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            ✓ Answer
          </button>
          <button onClick={() => { setDismissedCallId(incomingCall.roomId); setIncomingCall(null); }} style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "6px 14px", color: "#f87171", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            ✕
          </button>
        </div>
      )}
      <style>{`@keyframes ring { 0%,100%{transform:rotate(-15deg)} 50%{transform:rotate(15deg)} }`}</style>
    </>
  );
}
