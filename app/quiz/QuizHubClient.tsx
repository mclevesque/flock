"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Challenge {
  id: string; challenger_id: string; challenged_id: string; topic: string; status: string; created_at: string;
  challenger_username: string; challenger_avatar: string; challenger_rating: number;
  challenged_username: string; challenged_avatar: string; challenged_rating: number;
  game_id?: string | null;
}

interface RecentGame {
  id: string; topic: string; status: string; player1_id: string; player2_id: string;
  player1_score: number; player2_score: number; winner_id: string | null;
  player1_username: string; player1_avatar: string;
  player2_username: string; player2_avatar: string;
  updated_at: string;
}

interface LeaderboardEntry {
  id: string; username: string; display_name: string; avatar_url: string;
  quiz_rating: number; quiz_wins: number; quiz_losses: number; quiz_draws: number;
}

interface User {
  id: string; username: string; display_name: string; avatar_url: string;
}

interface Props {
  pending: Challenge[];
  recent: RecentGame[];
  leaderboard: LeaderboardEntry[];
  allUsers: User[];
  sessionUserId: string;
  initialChallengeUserId?: string;
}

export default function QuizHubClient({ pending, recent, leaderboard, allUsers, sessionUserId, initialChallengeUserId }: Props) {
  const router = useRouter();
  const [showChallenge, setShowChallenge] = useState(!!initialChallengeUserId);
  const initUser = initialChallengeUserId ? (allUsers.find(u => u.id === initialChallengeUserId) ?? null) : null;
  const [selectedUser, setSelectedUser] = useState<User | null>(initUser);
  const [topicInput, setTopicInput] = useState("");
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [responding, setResponding] = useState<string | null>(null);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [practiceTopic, setPracticeTopic] = useState("");
  const [practiceSending, setPracticeSending] = useState(false);
  const [pendingList, setPendingList] = useState(pending);

  const filteredUsers = allUsers.filter(u =>
    u.id !== sessionUserId &&
    (u.username.toLowerCase().includes(search.toLowerCase()) ||
     (u.display_name ?? "").toLowerCase().includes(search.toLowerCase()))
  );

  // Poll for outgoing challenges becoming accepted (auto-redirect challenger)
  useEffect(() => {
    const outgoing = pendingList.filter(c => c.challenger_id === sessionUserId && c.status === "pending" && !c.game_id);
    if (outgoing.length === 0) return;

    const knownGameIds = new Set(pendingList.filter(c => c.game_id).map(c => c.game_id));

    const interval = setInterval(async () => {
      const res = await fetch("/api/quiz");
      if (!res.ok) return;
      const data = await res.json();
      const updated: Challenge[] = data.pending ?? [];
      setPendingList(updated);

      for (const c of updated) {
        if (c.challenger_id === sessionUserId && c.game_id && !knownGameIds.has(c.game_id)) {
          clearInterval(interval);
          router.push(`/quiz/${c.game_id}`);
          return;
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [pendingList, sessionUserId, router]);

  async function startPractice() {
    setPracticeSending(true);
    try {
      const res = await fetch("/api/quiz/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: practiceTopic.trim() || "General Knowledge" }),
      });
      const data = await res.json();
      if (data.gameId) {
        router.push(`/quiz/${data.gameId}`);
        return;
      }
      alert(data.error ?? "Failed to start practice game");
    } catch {
      alert("Request timed out. Please try again.");
    }
    setPracticeSending(false);
  }

  async function sendChallenge() {
    if (!selectedUser || !topicInput.trim()) return;
    setSending(true);
    const res = await fetch("/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengedId: selectedUser.id, topic: topicInput.trim() }),
    });
    const data = await res.json();
    setSending(false);
    setShowChallenge(false);
    setSelectedUser(null);
    // Add to pending list so polling starts
    if (data.id) {
      setPendingList(prev => [{ ...data, game_id: null }, ...prev]);
    }
  }

  async function cancelChallenge(challengeId: string) {
    setPendingList(prev => prev.filter(c => c.id !== challengeId));
    await fetch("/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", challengeId }),
    });
  }

  async function respond(challengeId: string, action: "accept" | "decline") {
    setResponding(challengeId);
    const res = await fetch("/api/quiz/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId, action }),
    });
    const data = await res.json();
    if (action === "accept") {
      if (data.gameId) {
        router.push(`/quiz/${data.gameId}`);
        return;
      }
      // API key issue — show error, let them try again
      alert(data.error ?? "Failed to start game. Please try again.");
      setResponding(null);
      return;
    }
    setPendingList(prev => prev.filter(c => c.id !== challengeId));
    setResponding(null);
  }

  const myEntry = leaderboard.find(e => e.id === sessionUserId);
  const outgoingPending = pendingList.filter(c => c.challenger_id === sessionUserId && c.status === "pending" && !c.game_id);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px 80px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Quiz Battle
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 0" }}>
            Challenge friends on ANY topic. 12 questions. Progressive difficulty.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setPracticeOpen(true)}
            style={{
              background: "var(--bg-elevated)", color: "var(--text-secondary)",
              border: "1px solid var(--border)", borderRadius: 10, padding: "10px 16px",
              fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}
          >
            🤖 Practice
          </button>
          <button
            onClick={() => setShowChallenge(true)}
            style={{
              background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))",
              color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px",
              fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}
          >
            + Challenge
          </button>
        </div>
      </div>

      {/* My rating strip */}
      {myEntry && (
        <div className="panel" style={{ marginBottom: 20, padding: "12px 16px", display: "flex", alignItems: "center", gap: 16 }}>
          <img src={myEntry.avatar_url || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${myEntry.username}`}
            alt="" style={{ width: 40, height: 40, borderRadius: 10, border: "1px solid var(--border)" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Your Rating</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{myEntry.quiz_wins}W · {myEntry.quiz_losses}L · {myEntry.quiz_draws}D</div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "var(--accent-purple-bright)" }}>
            {myEntry.quiz_rating ?? 1200}
          </div>
        </div>
      )}

      {/* Outgoing challenges waiting banner */}
      {outgoingPending.length > 0 && (
        <div style={{ marginBottom: 16, padding: "12px 16px", background: "rgba(124,92,191,0.1)", border: "1px solid rgba(124,92,191,0.3)", borderRadius: 10, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 16, height: 16, border: "2px solid var(--accent-purple)", borderTop: "2px solid transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Waiting for {outgoingPending.map(c => c.challenged_username).join(", ")} to accept… you&apos;ll be taken straight into the game.
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Pending challenges */}
          <div className="panel">
            <div className="panel-header">Pending Challenges {pendingList.length > 0 && <span style={{ marginLeft: 6, background: "var(--accent-purple)", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 11 }}>{pendingList.length}</span>}</div>
            <div style={{ padding: 14 }}>
              {pendingList.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "12px 0" }}>
                  No pending challenges. Challenge someone!
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {pendingList.map(c => {
                    const isIncoming = c.challenged_id === sessionUserId;
                    const otherUsername = isIncoming ? c.challenger_username : c.challenged_username;
                    const otherAvatar = isIncoming ? c.challenger_avatar : c.challenged_avatar;
                    const otherRating = isIncoming ? c.challenger_rating : c.challenged_rating;
                    return (
                      <div key={c.id} style={{
                        display: "flex", alignItems: "center", gap: 12,
                        background: "var(--bg-elevated)", borderRadius: 10, padding: "10px 12px",
                        border: `1px solid ${isIncoming ? "rgba(124,92,191,0.4)" : "var(--border)"}`,
                      }}>
                        <img src={otherAvatar || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${otherUsername}`}
                          alt="" style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid var(--border)", flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>
                            {isIncoming ? "Challenge from " : "Sent to "}
                            <Link href={`/profile/${otherUsername}`} style={{ color: "var(--accent-purple-bright)", textDecoration: "none" }}>{otherUsername}</Link>
                            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400, marginLeft: 6 }}>({otherRating ?? 1200})</span>
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Topic: <strong style={{ color: "var(--text-secondary)" }}>{c.topic}</strong></div>
                        </div>
                        {isIncoming && (
                          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            <button
                              onClick={() => respond(c.id, "accept")}
                              disabled={responding === c.id}
                              style={{ background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))", color: "#fff", border: "none", borderRadius: 7, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                            >
                              {responding === c.id ? "Loading…" : "Accept"}
                            </button>
                            <button
                              onClick={() => respond(c.id, "decline")}
                              disabled={responding === c.id}
                              style={{ background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 7, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                            >
                              Decline
                            </button>
                          </div>
                        )}
                        {!isIncoming && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                            <div style={{ width: 10, height: 10, border: "2px solid var(--accent-purple)", borderTop: "2px solid transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Waiting…</span>
                            <button
                              onClick={() => cancelChallenge(c.id)}
                              title="Cancel challenge"
                              style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 14, cursor: "pointer", padding: "2px 4px", lineHeight: 1, borderRadius: 4 }}
                            >✕</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Recent games */}
          <div className="panel">
            <div className="panel-header">Recent Battles</div>
            <div style={{ padding: 14 }}>
              {recent.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "12px 0" }}>No games played yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {recent.map(g => {
                    const isP1 = g.player1_id === sessionUserId;
                    const myScore = isP1 ? g.player1_score : g.player2_score;
                    const opScore = isP1 ? g.player2_score : g.player1_score;
                    const opName = isP1 ? g.player2_username : g.player1_username;
                    const opAvatar = isP1 ? g.player2_avatar : g.player1_avatar;
                    const won = g.winner_id === sessionUserId;
                    const lost = g.winner_id && g.winner_id !== sessionUserId;
                    const resultColor = won ? "#4ad990" : lost ? "#f08080" : "var(--text-muted)";
                    const resultLabel = won ? "Win" : lost ? "Loss" : "Draw";
                    return (
                      <Link key={g.id} href={`/quiz/${g.id}`} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10, background: "var(--bg-elevated)", borderRadius: 8, padding: "8px 12px" }}>
                        <img src={opAvatar || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${opName}`}
                          alt="" style={{ width: 32, height: 32, borderRadius: 7, border: "1px solid var(--border)", flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>vs {opName}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{g.topic}</div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: resultColor }}>{resultLabel}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{myScore} – {opScore}</div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="panel" style={{ alignSelf: "start" }}>
          <div className="panel-header">Leaderboard</div>
          <div style={{ padding: 10 }}>
            {leaderboard.map((entry, i) => (
              <Link key={entry.id} href={`/profile/${entry.username}`} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8, padding: "6px 6px", borderRadius: 7, background: entry.id === sessionUserId ? "rgba(124,92,191,0.1)" : "transparent" }}>
                <span style={{ fontSize: 11, color: i < 3 ? ["#ffd700", "#c0c0c0", "#cd7f32"][i] : "var(--text-muted)", fontWeight: 700, width: 20, textAlign: "center" }}>
                  {i + 1}
                </span>
                <img src={entry.avatar_url || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${entry.username}`}
                  alt="" style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid var(--border)", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.username}</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--accent-purple-bright)", flexShrink: 0 }}>
                  {entry.quiz_rating ?? 1200}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Practice modal */}
      {practiceOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 400 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>🤖 Practice vs Bot</div>
              <button onClick={() => { setPracticeOpen(false); setPracticeTopic(""); }} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>No rating changes. Great for testing!</div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Topic</div>
              <input
                value={practiceTopic}
                onChange={e => setPracticeTopic(e.target.value)}
                placeholder='e.g. "Pokemon", "History", leave blank for general'
                style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
              <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                {["Movies", "Science", "History", "Sports", "Music", "Pokemon", "Video Games", "Anime"].map(t => (
                  <button key={t} onClick={() => setPracticeTopic(t)} style={{
                    background: practiceTopic === t ? "rgba(124,92,191,0.2)" : "var(--bg-elevated)",
                    color: practiceTopic === t ? "var(--accent-purple-bright)" : "var(--text-muted)",
                    border: `1px solid ${practiceTopic === t ? "rgba(124,92,191,0.5)" : "var(--border)"}`,
                    borderRadius: 6, padding: "3px 8px", fontSize: 10, cursor: "pointer",
                  }}>{t}</button>
                ))}
              </div>
            </div>
            <button
              onClick={startPractice}
              disabled={practiceSending}
              style={{
                width: "100%",
                background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))",
                color: "#fff", border: "none", borderRadius: 10, padding: "12px",
                fontSize: 14, fontWeight: 700, cursor: practiceSending ? "default" : "pointer", opacity: practiceSending ? 0.7 : 1,
              }}
            >
              {practiceSending ? "Generating questions…" : "Start Practice"}
            </button>
          </div>
        </div>
      )}

      {/* Challenge modal */}
      {showChallenge && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 440 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>New Challenge</div>
              <button onClick={() => { setShowChallenge(false); setTopicInput(""); setSelectedUser(null); }} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            {/* Topic input — any topic */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Topic — anything!</div>
              <input
                value={topicInput}
                onChange={e => setTopicInput(e.target.value)}
                placeholder='e.g. "The Lord of the Rings", "NBA", "Ancient Rome"…'
                style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
              <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                {["Movies", "Science", "History", "Sports", "Music", "Geography", "Video Games", "Anime"].map(t => (
                  <button key={t} onClick={() => setTopicInput(t)} style={{
                    background: topicInput === t ? "rgba(124,92,191,0.2)" : "var(--bg-elevated)",
                    color: topicInput === t ? "var(--accent-purple-bright)" : "var(--text-muted)",
                    border: `1px solid ${topicInput === t ? "rgba(124,92,191,0.5)" : "var(--border)"}`,
                    borderRadius: 6, padding: "3px 8px", fontSize: 10, cursor: "pointer",
                  }}>{t}</button>
                ))}
              </div>
            </div>

            {/* User search */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Challenge</div>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search username..."
                style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
              {filteredUsers.slice(0, 10).map(u => (
                <button key={u.id} onClick={() => setSelectedUser(u)} style={{
                  display: "flex", alignItems: "center", gap: 10, background: selectedUser?.id === u.id ? "rgba(124,92,191,0.15)" : "var(--bg-elevated)",
                  border: `1px solid ${selectedUser?.id === u.id ? "var(--accent-purple)" : "var(--border)"}`,
                  borderRadius: 8, padding: "8px 10px", cursor: "pointer", textAlign: "left",
                }}>
                  <img src={u.avatar_url || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${u.username}`}
                    alt="" style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid var(--border)", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{u.display_name || u.username}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>@{u.username}</div>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={sendChallenge}
              disabled={!selectedUser || !topicInput.trim() || sending}
              style={{
                width: "100%",
                background: selectedUser && topicInput.trim() ? "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))" : "var(--bg-elevated)",
                color: selectedUser && topicInput.trim() ? "#fff" : "var(--text-muted)",
                border: "none", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 700,
                cursor: selectedUser && topicInput.trim() ? "pointer" : "default",
              }}
            >
              {sending ? "Generating questions…" : selectedUser && topicInput.trim() ? `Challenge ${selectedUser.username}` : "Select opponent + topic"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
