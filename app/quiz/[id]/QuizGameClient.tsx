"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

interface QuizQuestion {
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
}

interface QuizGame {
  id: string;
  topic: string;
  questions: QuizQuestion[];
  current_question: number;
  player1_id: string; player1_score: number; player1_answered: number;
  player1_username: string; player1_avatar: string; player1_rating: number;
  player2_id: string; player2_score: number; player2_answered: number;
  player2_username: string; player2_avatar: string; player2_rating: number;
  status: string; winner_id: string | null;
}

interface Props {
  initialGame: QuizGame;
  sessionUserId: string;
}

const QUESTION_TIME = 20; // seconds per question

// Deterministic shuffle using question index as seed
function shuffleAnswers(q: QuizQuestion, qIndex: number): { text: string; correct: boolean }[] {
  const answers = [
    { text: q.correct_answer, correct: true },
    ...q.incorrect_answers.map(a => ({ text: a, correct: false })),
  ];
  // Seeded sort
  return answers.sort((a, b) => {
    const ha = (a.text.charCodeAt(0) + qIndex * 7) % 4;
    const hb = (b.text.charCodeAt(0) + qIndex * 7) % 4;
    return ha - hb;
  });
}

// Web Audio API sounds
function playSound(type: "correct" | "wrong" | "tick" | "complete") {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "correct") {
      osc.frequency.setValueAtTime(523, ctx.currentTime);
      osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } else if (type === "wrong") {
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.setValueAtTime(150, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === "tick") {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.05);
    } else if (type === "complete") {
      osc.frequency.setValueAtTime(392, ctx.currentTime);
      osc.frequency.setValueAtTime(523, ctx.currentTime + 0.15);
      osc.frequency.setValueAtTime(659, ctx.currentTime + 0.3);
      osc.frequency.setValueAtTime(784, ctx.currentTime + 0.45);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.7);
    }
  } catch { /* ignore audio errors */ }
}

export default function QuizGameClient({ initialGame, sessionUserId }: Props) {
  const [game, setGame] = useState<QuizGame>(initialGame);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const [answered, setAnswered] = useState<number | null>(null); // which option index I picked
  const [revealed, setRevealed] = useState(false);
  const [questionStart, setQuestionStart] = useState(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPollQ = useRef(-1);
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const isPlayer1 = game.player1_id === sessionUserId;
  const isBotGame = game.player2_id === "bot";
  const myScore = isPlayer1 ? game.player1_score : game.player2_score;
  const opScore = isPlayer1 ? game.player2_score : game.player1_score;
  const myAnswered = isPlayer1 ? game.player1_answered : game.player2_answered;
  const opAnswered = isPlayer1 ? game.player2_answered : game.player1_answered;
  const opUsername = isPlayer1 ? game.player2_username : game.player1_username;
  const opAvatar = isPlayer1 ? game.player2_avatar : game.player1_avatar;
  const myUsername = isPlayer1 ? game.player1_username : game.player2_username;
  const myAvatar = isPlayer1 ? game.player1_avatar : game.player2_avatar;

  const currentQ = game.current_question;
  const questions = game.questions ?? [];
  const question = questions[currentQ];
  const shuffled = question ? shuffleAnswers(question, currentQ) : [];
  const correctIdx = shuffled.findIndex(a => a.correct);

  const iHaveAnswered = myAnswered >= currentQ;
  const opHasAnswered = opAnswered >= currentQ;

  // Poll for game updates
  const poll = useCallback(async () => {
    if (unmountedRef.current) return;
    if (game.status === "completed" || game.status === "abandoned") return;
    const res = await fetch(`/api/quiz/${game.id}`);
    if (!res.ok || unmountedRef.current) return;
    const updated: QuizGame = await res.json();
    if (unmountedRef.current) return;

    if (updated.current_question !== game.current_question) {
      setAnswered(null);
      setRevealed(false);
      setTimeLeft(QUESTION_TIME);
      setQuestionStart(Date.now());
      lastPollQ.current = updated.current_question;
    }

    if (updated.status === "completed") {
      playSound("complete");
    }

    setGame(updated);
  }, [game.id, game.status, game.current_question]);

  useEffect(() => {
    pollRef.current = setInterval(poll, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [poll]);

  // Countdown timer
  useEffect(() => {
    if (game.status === "completed" || game.status === "abandoned") return;
    if (iHaveAnswered) return;

    timerRef.current = setInterval(() => {
      if (unmountedRef.current) return;
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleAnswer(-1, true);
          return 0;
        }
        if (prev <= 4) playSound("tick");
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQ, game.status, iHaveAnswered]);

  // Reset timer when question changes
  useEffect(() => {
    setTimeLeft(QUESTION_TIME);
    setQuestionStart(Date.now());
  }, [currentQ]);

  async function handleAnswer(optionIdx: number, timeout = false) {
    if (iHaveAnswered) return;
    if (timerRef.current) clearInterval(timerRef.current);

    const isCorrect = !timeout && optionIdx === correctIdx;
    const timeMs = Date.now() - questionStart;

    setAnswered(optionIdx);
    setRevealed(true);
    if (isCorrect) playSound("correct");
    else playSound("wrong");

    await fetch(`/api/quiz/${game.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionIndex: currentQ, answerIndex: optionIdx, isCorrect, timeMs }),
    });
    // Poll immediately after answering
    setTimeout(poll, 500);
  }

  // ── ABANDONED STATE (legacy — shouldn't happen anymore, but keep as fallback) ──
  if (game.status === "abandoned") {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "60px 16px", textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🚪</div>
        <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 8, color: "var(--text-secondary)" }}>
          Game ended
        </div>
        <div style={{ fontSize: 15, color: "var(--text-muted)", marginBottom: 32 }}>
          This game was abandoned.
        </div>
        <Link href="/quiz" style={{ background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))", color: "#fff", borderRadius: 10, padding: "12px 24px", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
          Back to Hub
        </Link>
      </div>
    );
  }

  // ── COMPLETED STATE ──────────────────────────────────────────────────────
  if (game.status === "completed") {
    const won = game.winner_id === sessionUserId;
    const tied = !game.winner_id;
    // Check if game ended early (someone forfeited) — one player has 0 questions answered
    const forfeitedEarly = game.current_question < (game.questions?.length ?? 12) - 1;
    const opponentForfeited = forfeitedEarly && won;
    const iForfeited = forfeitedEarly && !won && !tied;
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "60px 16px", textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>
          {won ? "🏆" : tied ? "🤝" : "💀"}
        </div>
        <div style={{ fontSize: 32, fontWeight: 900, marginBottom: 8,
          color: won ? "#4ad990" : tied ? "var(--accent-purple-bright)" : "#f08080",
        }}>
          {won ? "Victory!" : tied ? "Draw!" : "Defeat"}
        </div>
        {opponentForfeited && (
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>
            🚪 {opUsername} left the game — you win!
          </div>
        )}
        {iForfeited && (
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>
            You forfeited the game.
          </div>
        )}
        <div style={{ fontSize: 16, color: "var(--text-secondary)", marginBottom: 32 }}>
          {myUsername}: <strong>{myScore}</strong> — {opUsername}: <strong>{opScore}</strong>
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <Link href="/quiz" style={{ background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))", color: "#fff", borderRadius: 10, padding: "12px 24px", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
            Back to Hub
          </Link>
        </div>
      </div>
    );
  }

  // ── ACTIVE GAME ──────────────────────────────────────────────────────────
  const timerPct = (timeLeft / QUESTION_TIME) * 100;
  const timerColor = timeLeft > 11 ? "#4ad990" : timeLeft > 5 ? "#f0c040" : "#f08080";

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 16px 80px" }}>
      {/* Score header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 16px" }}>
        {/* Me */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
          <img src={myAvatar || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${myUsername}`}
            alt="" style={{ width: 36, height: 36, borderRadius: 8, border: "2px solid var(--accent-purple)" }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>{myUsername}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "var(--accent-purple-bright)" }}>{myScore}</div>
          </div>
        </div>

        {/* Q counter */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Q {currentQ + 1} / {questions.length}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: game.topic === "General Knowledge" ? "var(--text-secondary)" : "var(--accent-blue)" }}>{game.topic}</div>
        </div>

        {/* Opponent */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end", flexDirection: "row-reverse" }}>
          <img src={opAvatar || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${opUsername}`}
            alt="" style={{ width: 36, height: 36, borderRadius: 8, border: "2px solid var(--accent-blue)" }} />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>{opUsername}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "var(--accent-blue)" }}>{opScore}</div>
          </div>
        </div>
      </div>

      {/* Timer bar */}
      <div style={{ height: 6, background: "var(--bg-elevated)", borderRadius: 3, marginBottom: 20, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${timerPct}%`,
          background: timerColor,
          borderRadius: 3,
          transition: "width 1s linear, background 0.3s",
        }} />
      </div>

      {/* Question */}
      <div className="panel" style={{ marginBottom: 20, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>
            Question {currentQ + 1}
          </span>
          <span style={{ fontSize: 18, fontWeight: 800, color: timerColor }}>{timeLeft}s</span>
        </div>
        <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.5, color: "var(--text-primary)" }}>
          {question?.question ?? "Loading..."}
        </div>
      </div>

      {/* Answers */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        {shuffled.map((opt, i) => {
          let bg = "var(--bg-elevated)";
          let border = "var(--border)";
          let color = "var(--text-primary)";

          if (revealed) {
            if (i === correctIdx) { bg = "rgba(74,217,144,0.2)"; border = "#4ad990"; color = "#4ad990"; }
            else if (i === answered) { bg = "rgba(240,128,128,0.2)"; border = "#f08080"; color = "#f08080"; }
          } else if (answered === i) {
            bg = "rgba(124,92,191,0.2)"; border = "var(--accent-purple)";
          }

          return (
            <button
              key={i}
              onClick={() => handleAnswer(i)}
              disabled={iHaveAnswered}
              style={{
                background: bg, border: `2px solid ${border}`,
                borderRadius: 10, padding: "14px 16px", fontSize: 14, fontWeight: 600,
                color, cursor: iHaveAnswered ? "default" : "pointer",
                textAlign: "left", transition: "all 0.15s",
                display: "flex", alignItems: "center", gap: 10,
              }}
            >
              <span style={{ background: "var(--bg-base)", borderRadius: 6, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                {["A","B","C","D"][i]}
              </span>
              {opt.text}
            </button>
          );
        })}
      </div>

      {/* Opponent status */}
      <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>
        {opHasAnswered ? (
          <span style={{ color: "var(--accent-blue)" }}>✓ {opUsername} has answered</span>
        ) : (
          <span>⏳ Waiting for {opUsername}...</span>
        )}
        {iHaveAnswered && !opHasAnswered && (
          <div style={{ marginTop: 6 }}>You answered — next question loads when both players are ready.</div>
        )}
      </div>

      {/* Leave game */}
      <div style={{ textAlign: "center", marginTop: 24 }}>
        {isBotGame && (
          <div style={{ fontSize: 11, color: "var(--accent-purple-bright)", marginBottom: 6, fontWeight: 600 }}>🤖 Practice Mode — no rating changes</div>
        )}
        <button
          onClick={async () => {
            if (!isBotGame && !confirm(`Leave this game? You will lose and ${opUsername} will win — rating changes apply.`)) return;
            await fetch(`/api/quiz/${game.id}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "forfeit" }),
            });
            window.location.href = "/quiz";
          }}
          style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}
        >
          {isBotGame ? "Quit practice" : "Leave game (you lose)"}
        </button>
      </div>
    </div>
  );
}
