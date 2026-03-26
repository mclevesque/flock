"use client";
import { useEffect, useState, useCallback } from "react";
import { useSession } from "@/lib/use-session";
import { useRouter, usePathname } from "next/navigation";
import { useNotifications, type PushNotification } from "@/lib/useNotifications";

interface IncomingChallenge {
  id: string;
  from_user_id: string;
  from_username: string;
  from_avatar: string | null;
  game_type: "chess" | "quiz" | "emulator";
  game_name: string | null;
  expires_at: string;
}

interface AcceptedChallenge {
  id: string;
  to_username: string;
  game_type: string;
  game_name: string | null;
  result_game_id: string | null;
  netplay_room_id: string | null;
  ranked: boolean;
  status: string;
}

interface QuizChallenge {
  id: string;
  challenger_id: string;
  challenged_id: string;
  topic: string;
  status: string;
  created_at: string;
  challenger_username: string;
  challenger_avatar: string;
  challenger_rating: number;
  challenged_username: string;
  challenged_avatar: string;
  challenged_rating: number;
  game_id?: string | null;
}

const GAME_ICONS: Record<string, string> = {
  chess: "♟️",
  quiz: "🧠",
  emulator: "🎮",
};

const GAME_LABELS: Record<string, string> = {
  chess: "Chess",
  quiz: "Quiz",
  emulator: "SNES",
};

export default function ChallengePopup() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const onQuizHub = pathname === "/quiz";
  const [incoming, setIncoming] = useState<IncomingChallenge[]>([]);
  const [accepted, setAccepted] = useState<AcceptedChallenge | null>(null);
  const [responding, setResponding] = useState<string | null>(null);
  const [timers, setTimers] = useState<Record<string, number>>({});
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [seenAccepted, setSeenAccepted] = useState<Set<string>>(new Set());
  const [quizIncoming, setQuizIncoming] = useState<QuizChallenge[]>([]);
  const [quizDismissed, setQuizDismissed] = useState<Set<string>>(new Set());
  const [quizResponding, setQuizResponding] = useState<string | null>(null);

  const poll = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const res = await fetch("/api/challenge");
      if (!res.ok) return;
      const data = await res.json();
      setIncoming((data.incoming ?? []).filter((c: IncomingChallenge) => !dismissed.has(c.id)));
      if (data.accepted && !seenAccepted.has(data.accepted.id)) {
        setAccepted(data.accepted);
      }
    } catch { /* ignore */ }
  }, [session?.user?.id, dismissed, seenAccepted]);

  const pollQuiz = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const res = await fetch("/api/quiz");
      if (!res.ok) return;
      const data = await res.json();
      const allPending: QuizChallenge[] = data.pending ?? [];
      const myIncoming = allPending.filter(
        c => c.challenged_id === session.user!.id && c.status === "pending" && !quizDismissed.has(c.id)
      );
      setQuizIncoming(myIncoming);
    } catch { /* ignore */ }
  }, [session?.user?.id, quizDismissed]);

  // Receive challenges via PartyKit push instead of polling
  const { onNotification } = useNotifications();
  useEffect(() => {
    if (!session?.user?.id) return;
    const unsub = onNotification((n: PushNotification) => {
      if (n.type === "challenge" && n.from) {
        const challenge: IncomingChallenge = {
          id: n.id || Date.now().toString(),
          from_user_id: n.from.userId,
          from_username: n.from.username,
          from_avatar: n.from.avatarUrl || null,
          game_type: (n.gameType || "chess") as "chess" | "quiz" | "emulator",
          game_name: n.gameType || "Chess",
          expires_at: new Date(Date.now() + 60000).toISOString(),
        };
        if (!dismissed.has(challenge.id)) {
          setIncoming(prev => [...prev, challenge]);
        }
      }
    });
    return unsub;
  }, [session?.user?.id, onNotification, dismissed]);

  // Countdown timers for each incoming challenge
  useEffect(() => {
    if (incoming.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const next: Record<string, number> = {};
      incoming.forEach(c => {
        const msLeft = new Date(c.expires_at).getTime() - now;
        next[c.id] = Math.max(0, Math.ceil(msLeft / 1000));
      });
      setTimers(next);
      // Auto-dismiss expired
      incoming.forEach(c => {
        if (next[c.id] === 0) {
          setDismissed(prev => new Set([...prev, c.id]));
        }
      });
    }, 500);
    return () => clearInterval(interval);
  }, [incoming]);

  async function handleRespond(challengeId: string, action: "accept" | "decline") {
    setResponding(challengeId);
    try {
      const res = await fetch(`/api/challenge/${challengeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      setDismissed(prev => new Set([...prev, challengeId]));
      setIncoming(prev => prev.filter(c => c.id !== challengeId));
      if (action === "accept" && data.redirectUrl) {
        router.push(data.redirectUrl);
      }
    } catch { /* ignore */ }
    setResponding(null);
  }

  async function handleQuizRespond(challengeId: string, action: "accept" | "decline") {
    setQuizResponding(challengeId);
    try {
      const res = await fetch("/api/quiz/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, action }),
      });
      const data = await res.json();
      setQuizDismissed(prev => new Set([...prev, challengeId]));
      setQuizIncoming(prev => prev.filter(c => c.id !== challengeId));
      if (action === "accept" && data.gameId) {
        router.push(`/quiz/${data.gameId}`);
      }
    } catch { /* ignore */ }
    setQuizResponding(null);
  }

  function dismissAccepted() {
    if (accepted) {
      setSeenAccepted(prev => new Set([...prev, accepted.id]));
      setAccepted(null);
    }
  }

  function goToAccepted() {
    if (!accepted) return;
    if (accepted.game_type === "chess" && accepted.result_game_id) {
      router.push(`/chess/${accepted.result_game_id}`);
    } else if (accepted.game_type === "quiz") {
      router.push("/quiz");
    } else if (accepted.game_type === "emulator") {
      // Challenger is the host (role=host) — opponent already joined as guest
      const roomId = accepted.result_game_id ?? accepted.netplay_room_id ?? "";
      const ranked = accepted.ranked !== false ? "1" : "0";
      router.push(
        `/emulator?game=${encodeURIComponent(accepted.game_name ?? "")}&room=${roomId}&role=host&ranked=${ranked}`
      );
    }
    dismissAccepted();
  }

  const visibleIncoming = incoming.filter(c => !dismissed.has(c.id));
  // Don't show quiz popups on the quiz hub — they're already shown inline there
  const visibleQuizIncoming = onQuizHub ? [] : quizIncoming.filter(c => !quizDismissed.has(c.id));
  if (!session?.user?.id) return null;
  if (visibleIncoming.length === 0 && visibleQuizIncoming.length === 0 && !accepted) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 20,
      right: 20,
      zIndex: 9999,
      display: "flex",
      flexDirection: "column",
      gap: 10,
      maxWidth: 320,
    }}>
      {/* Accepted challenge notification (for the challenger) */}
      {accepted && !seenAccepted.has(accepted.id) && (
        <div style={{
          background: "linear-gradient(135deg, #1a2a1a, #0d1a0d)",
          border: "1px solid var(--accent-green)",
          borderRadius: 12,
          padding: "14px 16px",
          boxShadow: "0 8px 32px rgba(76,175,125,0.3)",
          animation: "slideInRight 0.3s ease",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--accent-green)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                Challenge Accepted! 🎉
              </div>
              <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>
                {GAME_ICONS[accepted.game_type]} {accepted.to_username} is ready to play {GAME_LABELS[accepted.game_type]}
                {accepted.game_name ? `: ${accepted.game_name}` : ""}!
              </div>
            </div>
            <button onClick={dismissAccepted} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 0 0 8px", flexShrink: 0 }}>×</button>
          </div>
          <button onClick={goToAccepted} style={{
            width: "100%", background: "var(--accent-green)", border: "none", borderRadius: 8,
            padding: "8px 0", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>
            Go to Game →
          </button>
        </div>
      )}

      {/* Incoming challenge cards */}
      {visibleIncoming.map(c => {
        const secs = timers[c.id] ?? 30;
        const pct = (secs / 30) * 100;
        const isExpired = secs === 0;
        return (
          <div key={c.id} style={{
            background: "linear-gradient(135deg, #1a1a2e, #12122a)",
            border: "1px solid var(--accent-purple)",
            borderRadius: 12,
            padding: "14px 16px",
            boxShadow: "0 8px 32px rgba(124,92,191,0.35)",
            opacity: isExpired ? 0.5 : 1,
            transition: "opacity 0.3s ease",
          }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <img
                  src={c.from_avatar ?? `https://api.dicebear.com/9.x/pixel-art/svg?seed=${c.from_username}`}
                  alt={c.from_username}
                  style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid var(--accent-purple)" }}
                />
                <div>
                  <div style={{ fontSize: 11, color: "var(--accent-purple-bright)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                    Challenge!
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>
                    <span style={{ color: "var(--accent-purple-bright)" }}>@{c.from_username}</span> wants to play
                  </div>
                </div>
              </div>
              <button
                onClick={() => setDismissed(prev => new Set([...prev, c.id]))}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 0 0 8px", flexShrink: 0 }}
              >×</button>
            </div>

            {/* Game pill */}
            <div style={{ marginBottom: 10 }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                background: "rgba(124,92,191,0.2)", border: "1px solid rgba(124,92,191,0.4)",
                borderRadius: 20, padding: "4px 12px", fontSize: 13, fontWeight: 700, color: "var(--text-primary)",
              }}>
                {GAME_ICONS[c.game_type]} {GAME_LABELS[c.game_type]}
                {c.game_name ? ` — ${c.game_name}` : ""}
              </span>
            </div>

            {/* Timer bar */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: secs > 10 ? "var(--accent-purple)" : secs > 5 ? "var(--away)" : "#e05555",
                  borderRadius: 2,
                  transition: "width 0.5s linear, background 0.3s ease",
                }} />
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3, textAlign: "right" }}>
                {isExpired ? "Expired" : `${secs}s`}
              </div>
            </div>

            {/* Buttons */}
            {!isExpired && (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => handleRespond(c.id, "accept")}
                  disabled={responding === c.id}
                  style={{
                    flex: 1, background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))",
                    border: "none", borderRadius: 8, padding: "8px 0", color: "#fff",
                    fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: responding === c.id ? 0.6 : 1,
                  }}
                >
                  {responding === c.id ? "…" : "Accept ✓"}
                </button>
                <button
                  onClick={() => handleRespond(c.id, "decline")}
                  disabled={responding === c.id}
                  style={{
                    flex: 1, background: "transparent", border: "1px solid var(--border)",
                    borderRadius: 8, padding: "8px 0", color: "var(--text-secondary)",
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  Decline ✗
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Quiz challenge cards */}
      {visibleQuizIncoming.map(c => (
        <div key={c.id} style={{
          background: "linear-gradient(135deg, #1a1a2e, #12122a)",
          border: "1px solid var(--accent-purple)",
          borderRadius: 12,
          padding: "14px 16px",
          boxShadow: "0 8px 32px rgba(124,92,191,0.35)",
          animation: "slideInRight 0.3s ease",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <img
                src={c.challenger_avatar || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${c.challenger_username}`}
                alt={c.challenger_username}
                style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid var(--accent-purple)" }}
              />
              <div>
                <div style={{ fontSize: 11, color: "var(--accent-purple-bright)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                  Quiz Challenge!
                </div>
                <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>
                  <span style={{ color: "var(--accent-purple-bright)" }}>@{c.challenger_username}</span> wants to battle
                </div>
              </div>
            </div>
            <button
              onClick={() => setQuizDismissed(prev => new Set([...prev, c.id]))}
              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 0 0 8px", flexShrink: 0 }}
            >×</button>
          </div>

          <div style={{ marginBottom: 10 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              background: "rgba(124,92,191,0.2)", border: "1px solid rgba(124,92,191,0.4)",
              borderRadius: 20, padding: "4px 12px", fontSize: 13, fontWeight: 700, color: "var(--text-primary)",
            }}>
              🧠 Quiz — {c.topic}
            </span>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => handleQuizRespond(c.id, "accept")}
              disabled={quizResponding === c.id}
              style={{
                flex: 1, background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))",
                border: "none", borderRadius: 8, padding: "8px 0", color: "#fff",
                fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: quizResponding === c.id ? 0.6 : 1,
              }}
            >
              {quizResponding === c.id ? "…" : "Accept ✓"}
            </button>
            <button
              onClick={() => handleQuizRespond(c.id, "decline")}
              disabled={quizResponding === c.id}
              style={{
                flex: 1, background: "transparent", border: "1px solid var(--border)",
                borderRadius: 8, padding: "8px 0", color: "var(--text-secondary)",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              Decline ✗
            </button>
          </div>
        </div>
      ))}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
