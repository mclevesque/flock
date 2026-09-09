"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import PartySocket from "partysocket";

// ── Types mirrored from server publicState ───────────────────────────────────
type Phase =
  | "lobby" | "picking" | "reading" | "buzzing" | "answering" | "reveal"
  | "dd-wager" | "final-wager" | "final-answer" | "final-reveal" | "done";

interface Player {
  id: string; username: string; avatarUrl: string | null;
  score: number; connected: boolean; isHost: boolean;
}
interface BoardCell { value: number; cleared: boolean; }
interface BoardCategory { name: string; values: BoardCell[]; }
interface BoardSnapshot { categories: BoardCategory[]; }
interface ActiveClue {
  category: string; value: number; clue: string;
  isDailyDouble: boolean; ddWager?: number;
  buzzWinnerId?: string; buzzLockedOutIds: string[];
  attemptDeadline?: number; buzzOpensAt?: number;
  answer?: string;
}
interface FinalSnapshot {
  category: string;
  clue: string | null;
  answer: string | null;
  wagers: Record<string, number>;
  answers: Record<string, string>;
  correct: Record<string, boolean>;
  wagerDeadline?: number;
  answerDeadline?: number;
}
interface RoomState {
  phase: Phase;
  players: Record<string, Player>;
  playerOrder: string[];
  board: BoardSnapshot | null;
  cleared: boolean[][];
  pickerId: string | null;
  activeClue: ActiveClue | null;
  finalState: FinalSnapshot | null;
  cluesRemaining: number;
  message: string | null;
  serverNow: number;
}

const GOLD = "#d4a942";
const EMBER = "#c4531a";
const GOLD_BRIGHT = "#f4d061";
const BG = "#0d0d0d";
const PANEL = "#14110b";

// ── Hook: countdown from a server deadline ───────────────────────────────────
function useDeadlineTick(deadline?: number): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!deadline) return;
    const iv = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(iv);
  }, [deadline]);
  if (!deadline) return 0;
  return Math.max(0, deadline - now);
}

// ── Main component ──────────────────────────────────────────────────────────
export default function NerdAlertRoom({
  roomCode, userId, username, avatarUrl,
}: { roomCode: string; userId: string; username: string; avatarUrl: string | null }) {
  const router = useRouter();
  const [state, setState] = useState<RoomState | null>(null);
  const [connected, setConnected] = useState(false);
  const [answerInput, setAnswerInput] = useState("");
  const [wagerInput, setWagerInput] = useState("");
  const [finalAnswerInput, setFinalAnswerInput] = useState("");
  const [finalWagerInput, setFinalWagerInput] = useState("");
  const [submittedFinalWager, setSubmittedFinalWager] = useState(false);
  const [submittedFinalAnswer, setSubmittedFinalAnswer] = useState(false);
  const socketRef = useRef<PartySocket | null>(null);
  const lastPhaseRef = useRef<Phase | null>(null);

  // Reset transient inputs when phase changes
  useEffect(() => {
    if (!state) return;
    if (state.phase !== lastPhaseRef.current) {
      if (state.phase === "picking" || state.phase === "buzzing" || state.phase === "reading") {
        setAnswerInput("");
      }
      if (state.phase === "picking") setWagerInput("");
      if (state.phase === "final-wager") setSubmittedFinalWager(false);
      if (state.phase === "final-answer") setSubmittedFinalAnswer(false);
      lastPhaseRef.current = state.phase;
    }
  }, [state]);

  // Connect to PartyKit
  useEffect(() => {
    const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST;
    if (!host) {
      console.error("NEXT_PUBLIC_PARTYKIT_HOST not set");
      return;
    }
    const socket = new PartySocket({ host, room: roomCode, party: "nerdalert" });
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      setConnected(true);
      socket.send(JSON.stringify({ type: "join", userId, username, avatarUrl }));
    });
    socket.addEventListener("close", () => setConnected(false));
    socket.addEventListener("message", (e) => {
      try {
        const msg = JSON.parse(e.data) as { type: string; state?: RoomState };
        if (msg.type === "state" && msg.state) setState(msg.state);
      } catch { /* ignore */ }
    });
    return () => { socket.close(); socketRef.current = null; };
  }, [roomCode, userId, username, avatarUrl]);

  const send = useCallback((payload: Record<string, unknown>) => {
    const s = socketRef.current;
    if (!s) return;
    s.send(JSON.stringify({ ...payload, userId }));
  }, [userId]);

  if (!state) {
    return (
      <div style={{ minHeight: "100dvh", background: BG, color: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cinzel', serif" }}>
        {connected ? "Loading room…" : "Connecting…"}
      </div>
    );
  }

  const me = state.players[userId];
  const isHost = !!me?.isHost;
  const isPicker = state.pickerId === userId;
  const activePlayers = state.playerOrder.map(id => state.players[id]).filter(Boolean);

  return (
    <div style={{ minHeight: "100dvh", background: BG, color: "#e8dcc8", padding: "16px 12px 80px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <RoomHeader code={roomCode} phase={state.phase} cluesRemaining={state.cluesRemaining} onLeave={() => router.push("/nerd-alert")} />

        {/* Lobby */}
        {state.phase === "lobby" && (
          <Lobby
            code={roomCode}
            players={activePlayers}
            isHost={isHost}
            onStart={() => send({ type: "start" })}
            onKick={(targetId) => send({ type: "kick", targetId })}
            myId={userId}
          />
        )}

        {/* Main game */}
        {state.phase !== "lobby" && state.phase !== "done" && state.phase !== "final-wager" && state.phase !== "final-answer" && state.phase !== "final-reveal" && state.board && (
          <GameBoard
            board={state.board}
            phase={state.phase}
            isPicker={isPicker}
            pickerName={state.pickerId ? state.players[state.pickerId]?.username ?? "?" : "?"}
            activeClue={state.activeClue}
            myId={userId}
            myScore={me?.score ?? 0}
            message={state.message}
            answerInput={answerInput}
            setAnswerInput={setAnswerInput}
            wagerInput={wagerInput}
            setWagerInput={setWagerInput}
            onPick={(catIdx, rowIdx) => send({ type: "pick", catIdx, rowIdx })}
            onBuzz={() => send({ type: "buzz" })}
            onSubmitAnswer={(answer) => send({ type: "submit-answer", answer })}
            onDDWager={(wager) => send({ type: "dd-wager", wager })}
          />
        )}

        {/* Final phases */}
        {state.phase === "final-wager" && state.finalState && (
          <FinalWager
            finalState={state.finalState}
            me={me}
            wagerInput={finalWagerInput}
            setWagerInput={setFinalWagerInput}
            submitted={submittedFinalWager}
            onSubmit={(wager) => { send({ type: "final-wager", wager }); setSubmittedFinalWager(true); }}
            players={state.players}
          />
        )}
        {state.phase === "final-answer" && state.finalState && (
          <FinalAnswer
            finalState={state.finalState}
            me={me}
            answerInput={finalAnswerInput}
            setAnswerInput={setFinalAnswerInput}
            submitted={submittedFinalAnswer}
            onSubmit={(answer) => { send({ type: "final-answer", answer }); setSubmittedFinalAnswer(true); }}
            players={state.players}
          />
        )}
        {state.phase === "final-reveal" && state.finalState && (
          <FinalReveal finalState={state.finalState} players={state.players} />
        )}
        {state.phase === "done" && (
          <DoneScreen players={state.players} playerOrder={state.playerOrder} isHost={isHost} onReset={() => send({ type: "reset" })} onStart={() => send({ type: "start" })} />
        )}

        {/* Scoreboard always shown unless on intro screens */}
        {state.phase !== "lobby" && (
          <Scoreboard players={activePlayers} pickerId={state.pickerId} myId={userId} />
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────
function RoomHeader({ code, phase, cluesRemaining, onLeave }: { code: string; phase: Phase; cluesRemaining: number; onLeave: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
      <button onClick={onLeave} style={{ background: "transparent", border: "1px solid #2a2018", color: "#888", fontSize: 12, padding: "6px 12px", borderRadius: 8, cursor: "pointer" }}>← Leave</button>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "'Cinzel', serif", color: GOLD, fontSize: 22, fontWeight: 800, letterSpacing: "0.1em" }}>NERD ALERT!</div>
        <div style={{ color: "#a08040", fontSize: 11, marginTop: 2, letterSpacing: "0.2em" }}>ROOM · {code}</div>
      </div>
      <div style={{ color: "#666", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>
        {phase === "lobby" ? "WAITING" : phase === "done" ? "DONE" : `${cluesRemaining} CLUES LEFT`}
      </div>
    </div>
  );
}

function Lobby({ code, players, isHost, onStart, onKick, myId }: {
  code: string; players: Player[]; isHost: boolean;
  onStart: () => void; onKick: (id: string) => void; myId: string;
}) {
  const url = typeof window !== "undefined" ? `${window.location.origin}/nerd-alert/${code}` : "";
  const [copied, setCopied] = useState(false);
  function copy() {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }

  return (
    <div style={{ textAlign: "center", padding: "40px 16px" }}>
      <div style={{ color: "#a08040", fontSize: 13, letterSpacing: "0.2em", marginBottom: 8 }}>SHARE THIS CODE</div>
      <div style={{
        display: "inline-block",
        padding: "16px 36px", borderRadius: 16,
        background: "linear-gradient(180deg, #1a1410, #0f0c08)",
        border: `2px solid ${GOLD}`,
        boxShadow: `0 0 32px rgba(212,169,66,0.3)`,
      }}>
        <div style={{ fontFamily: "'Cinzel', serif", fontSize: 56, fontWeight: 800, letterSpacing: "0.3em", color: GOLD_BRIGHT, marginLeft: "0.3em" }}>
          {code}
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <button onClick={copy} style={{ background: "transparent", border: `1px solid ${EMBER}`, color: EMBER, fontFamily: "'Cinzel', serif", fontSize: 12, padding: "6px 16px", borderRadius: 8, cursor: "pointer", letterSpacing: "0.1em" }}>
          {copied ? "COPIED!" : "COPY LINK"}
        </button>
      </div>

      <div style={{ marginTop: 36, marginBottom: 12, color: "#a08040", fontSize: 13, letterSpacing: "0.2em" }}>
        PLAYERS ({players.length})
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", maxWidth: 600, margin: "0 auto" }}>
        {players.map(p => (
          <div key={p.id} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 14px", borderRadius: 24,
            background: p.connected ? "rgba(212,169,66,0.1)" : "rgba(80,80,80,0.1)",
            border: `1px solid ${p.connected ? "#3a2a1a" : "#2a2a2a"}`,
            opacity: p.connected ? 1 : 0.5,
          }}>
            {p.avatarUrl && <img src={p.avatarUrl} alt="" style={{ width: 24, height: 24, borderRadius: "50%" }} />}
            <span style={{ color: p.connected ? "#e8dcc8" : "#666", fontSize: 14 }}>{p.username}</span>
            {p.isHost && <span style={{ color: GOLD, fontSize: 10, letterSpacing: "0.1em" }}>★ HOST</span>}
            {isHost && p.id !== myId && (
              <button onClick={() => onKick(p.id)} title="Kick" style={{ background: "transparent", border: "none", color: "#666", cursor: "pointer", fontSize: 13, padding: 0 }}>×</button>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 40 }}>
        {isHost ? (
          <button onClick={onStart} disabled={players.length < 1} style={{
            padding: "14px 40px", borderRadius: 10,
            background: `linear-gradient(135deg, ${GOLD}, ${EMBER})`,
            color: BG, fontFamily: "'Cinzel', serif", fontWeight: 800, fontSize: 18,
            letterSpacing: "0.15em", border: "none", cursor: "pointer",
            boxShadow: `0 0 32px rgba(196,83,26,0.4)`,
          }}>
            START GAME →
          </button>
        ) : (
          <div style={{ color: "#888", fontSize: 13 }}>Waiting for host to start…</div>
        )}
      </div>
    </div>
  );
}

function GameBoard({
  board, phase, isPicker, pickerName, activeClue, myId, myScore, message,
  answerInput, setAnswerInput, wagerInput, setWagerInput,
  onPick, onBuzz, onSubmitAnswer, onDDWager,
}: {
  board: BoardSnapshot;
  phase: Phase;
  isPicker: boolean;
  pickerName: string;
  activeClue: ActiveClue | null;
  myId: string;
  myScore: number;
  message: string | null;
  answerInput: string;
  setAnswerInput: (s: string) => void;
  wagerInput: string;
  setWagerInput: (s: string) => void;
  onPick: (catIdx: number, rowIdx: number) => void;
  onBuzz: () => void;
  onSubmitAnswer: (answer: string) => void;
  onDDWager: (wager: number) => void;
}) {
  const showBoard = phase === "picking";
  const showClue = !showBoard && activeClue !== null;

  return (
    <div>
      {phase === "picking" && (
        <div style={{ textAlign: "center", color: "#a08040", fontFamily: "'Cinzel', serif", letterSpacing: "0.18em", fontSize: 14, marginBottom: 16 }}>
          {isPicker ? "🎯 YOUR PICK" : `${pickerName.toUpperCase()} IS PICKING`}
        </div>
      )}

      {showBoard && (
        <BoardGrid board={board} isPicker={isPicker} onPick={onPick} />
      )}

      {showClue && activeClue && (
        <ClueDisplay
          activeClue={activeClue}
          phase={phase}
          isPicker={isPicker}
          myId={myId}
          myScore={myScore}
          message={message}
          answerInput={answerInput}
          setAnswerInput={setAnswerInput}
          wagerInput={wagerInput}
          setWagerInput={setWagerInput}
          onBuzz={onBuzz}
          onSubmitAnswer={onSubmitAnswer}
          onDDWager={onDDWager}
        />
      )}
    </div>
  );
}

function BoardGrid({ board, isPicker, onPick }: { board: BoardSnapshot; isPicker: boolean; onPick: (c: number, r: number) => void }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
      gap: 4,
      background: "#000",
      padding: 4,
      borderRadius: 8,
      border: `2px solid ${GOLD}`,
      boxShadow: `0 0 32px rgba(212,169,66,0.15)`,
    }}>
      {/* Category headers */}
      {board.categories.map((cat, ci) => (
        <div key={ci} style={{
          background: "linear-gradient(180deg, #1a1410, #0f0c08)",
          color: GOLD_BRIGHT,
          fontFamily: "'Cinzel', serif",
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: "0.04em",
          padding: "12px 6px",
          minHeight: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          textTransform: "uppercase",
          border: `1px solid ${GOLD}`,
          borderRadius: 4,
          lineHeight: 1.15,
        }}>{cat.name}</div>
      ))}
      {/* Value tiles — 5 rows */}
      {[0, 1, 2, 3, 4].map(rowIdx =>
        board.categories.map((cat, ci) => {
          const cell = cat.values[rowIdx];
          const cleared = cell.cleared;
          return (
            <button
              key={`${ci}-${rowIdx}`}
              disabled={cleared || !isPicker}
              onClick={() => onPick(ci, rowIdx)}
              style={{
                background: cleared ? "#000" : "linear-gradient(180deg, #1a1410, #0a0805)",
                color: cleared ? "transparent" : GOLD_BRIGHT,
                fontFamily: "'Cinzel', serif",
                fontWeight: 800,
                fontSize: "clamp(14px, 3.5vw, 28px)",
                padding: "20px 4px",
                minHeight: 56,
                border: `1px solid ${cleared ? "#1a1410" : GOLD}`,
                borderRadius: 4,
                cursor: cleared || !isPicker ? "default" : "pointer",
                transition: "all 0.15s",
                boxShadow: cleared ? "none" : "inset 0 0 12px rgba(212,169,66,0.1)",
                opacity: isPicker || cleared ? 1 : 0.85,
              }}
              onMouseEnter={(e) => { if (!cleared && isPicker) e.currentTarget.style.background = "linear-gradient(180deg, #2a1d10, #1a1408)"; }}
              onMouseLeave={(e) => { if (!cleared && isPicker) e.currentTarget.style.background = "linear-gradient(180deg, #1a1410, #0a0805)"; }}
            >
              ${cell.value}
            </button>
          );
        }),
      )}
    </div>
  );
}

function ClueDisplay({
  activeClue, phase, isPicker, myId, myScore, message,
  answerInput, setAnswerInput, wagerInput, setWagerInput,
  onBuzz, onSubmitAnswer, onDDWager,
}: {
  activeClue: ActiveClue; phase: Phase; isPicker: boolean; myId: string; myScore: number;
  message: string | null;
  answerInput: string; setAnswerInput: (s: string) => void;
  wagerInput: string; setWagerInput: (s: string) => void;
  onBuzz: () => void; onSubmitAnswer: (a: string) => void; onDDWager: (w: number) => void;
}) {
  const lockedOut = activeClue.buzzLockedOutIds.includes(myId);
  const iAmBuzzWinner = activeClue.buzzWinnerId === myId;
  const buzzLockMs = useDeadlineTick(activeClue.buzzOpensAt);
  const attemptMs = useDeadlineTick(activeClue.attemptDeadline);

  return (
    <div style={{
      background: "linear-gradient(180deg, #0a0805 0%, #1a1410 100%)",
      border: `2px solid ${activeClue.isDailyDouble ? EMBER : GOLD}`,
      borderRadius: 12,
      padding: "20px 24px",
      minHeight: 280,
      display: "flex",
      flexDirection: "column",
      gap: 16,
      boxShadow: `0 0 48px ${activeClue.isDailyDouble ? "rgba(196,83,26,0.25)" : "rgba(212,169,66,0.15)"}`,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${activeClue.isDailyDouble ? EMBER : "#3a2a1a"}`, paddingBottom: 10 }}>
        <span style={{ color: activeClue.isDailyDouble ? EMBER : GOLD, fontFamily: "'Cinzel', serif", fontSize: 13, letterSpacing: "0.1em" }}>
          {activeClue.isDailyDouble && "⚡ DAILY DOUBLE · "}{activeClue.category}
        </span>
        <span style={{ color: GOLD_BRIGHT, fontFamily: "'Cinzel', serif", fontWeight: 800, fontSize: 18 }}>
          ${activeClue.isDailyDouble && activeClue.ddWager ? activeClue.ddWager : activeClue.value}
        </span>
      </div>

      {/* DD wager */}
      {phase === "dd-wager" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 24, color: EMBER, letterSpacing: "0.1em" }}>⚡ DAILY DOUBLE ⚡</div>
          {isPicker ? (
            <>
              <div style={{ color: "#a08040", fontSize: 14 }}>How much do you wager? (5 – {Math.max(myScore, 1000)})</div>
              <input
                type="number" autoFocus
                value={wagerInput}
                onChange={(e) => setWagerInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") onDDWager(parseInt(wagerInput, 10) || 5); }}
                placeholder="5"
                style={{
                  padding: "16px 20px", fontSize: 28, textAlign: "center",
                  background: BG, border: `2px solid ${EMBER}`, borderRadius: 10,
                  color: GOLD_BRIGHT, fontFamily: "'Cinzel', serif", fontWeight: 800, width: 220, outline: "none",
                }}
              />
              <button onClick={() => onDDWager(parseInt(wagerInput, 10) || 5)} style={{
                padding: "10px 24px", borderRadius: 8, background: EMBER, color: "#fff",
                fontFamily: "'Cinzel', serif", fontSize: 14, fontWeight: 700, letterSpacing: "0.1em", border: "none", cursor: "pointer",
              }}>WAGER</button>
              <div style={{ color: "#666", fontSize: 11 }}>⏱ {Math.ceil(attemptMs / 1000)}s</div>
            </>
          ) : (
            <div style={{ color: "#888", fontSize: 14 }}>Waiting for picker to wager…</div>
          )}
        </div>
      )}

      {/* Clue (reading/buzzing/answering/reveal) */}
      {(phase === "reading" || phase === "buzzing" || phase === "answering" || phase === "reveal") && (
        <>
          <div style={{
            flex: 1,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "20px 8px",
            color: "#fff",
            fontFamily: "Georgia, serif",
            fontSize: "clamp(16px, 3.2vw, 26px)",
            lineHeight: 1.4,
            textAlign: "center",
            minHeight: 120,
          }}>
            {activeClue.clue}
          </div>

          {phase === "reveal" && (
            <div style={{
              padding: "16px",
              background: "rgba(212,169,66,0.08)",
              border: `1px solid ${GOLD}`, borderRadius: 8,
              textAlign: "center",
            }}>
              <div style={{ color: GOLD, fontSize: 11, letterSpacing: "0.2em", marginBottom: 4 }}>ANSWER</div>
              <div style={{ color: GOLD_BRIGHT, fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: 20 }}>
                {activeClue.answer}
              </div>
              {message && <div style={{ color: "#a08040", fontSize: 13, marginTop: 8 }}>{message}</div>}
            </div>
          )}

          {phase === "reading" && (
            <div style={{ textAlign: "center", color: "#666", fontSize: 13, letterSpacing: "0.1em" }}>
              {activeClue.isDailyDouble ? "GET READY…" : `BUZZER OPENS IN ${Math.ceil(buzzLockMs / 1000)}s`}
            </div>
          )}

          {phase === "buzzing" && !activeClue.isDailyDouble && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <button
                onClick={onBuzz}
                disabled={lockedOut}
                style={{
                  width: "100%", maxWidth: 360, padding: "22px",
                  borderRadius: 12,
                  background: lockedOut ? "#2a1410" : `linear-gradient(135deg, ${EMBER}, #ff7a3a)`,
                  color: "#fff", fontFamily: "'Cinzel', serif", fontWeight: 800,
                  fontSize: 32, letterSpacing: "0.2em", border: "none",
                  cursor: lockedOut ? "not-allowed" : "pointer",
                  boxShadow: lockedOut ? "none" : `0 0 32px rgba(255,122,58,0.5)`,
                  animation: lockedOut ? "none" : "buzzPulse 0.8s ease-in-out infinite",
                }}
              >
                {lockedOut ? "LOCKED OUT" : "BUZZ!"}
              </button>
              <div style={{ color: "#666", fontSize: 11 }}>⏱ {Math.ceil(attemptMs / 1000)}s · first to press answers</div>
            </div>
          )}

          {phase === "answering" && (
            iAmBuzzWinner ? (
              <form onSubmit={(e) => { e.preventDefault(); onSubmitAnswer(answerInput); }} style={{ display: "flex", gap: 8 }}>
                <input
                  autoFocus
                  value={answerInput}
                  onChange={(e) => setAnswerInput(e.target.value)}
                  placeholder="Type your answer…"
                  style={{
                    flex: 1, padding: "14px 18px", fontSize: 18,
                    background: BG, border: `2px solid ${GOLD}`, borderRadius: 10,
                    color: "#fff", outline: "none", fontFamily: "Georgia, serif",
                  }}
                />
                <button type="submit" style={{
                  padding: "0 24px", background: GOLD, color: BG,
                  fontFamily: "'Cinzel', serif", fontSize: 14, fontWeight: 800, letterSpacing: "0.1em",
                  border: "none", borderRadius: 10, cursor: "pointer",
                }}>SUBMIT</button>
                <div style={{ alignSelf: "center", color: "#666", fontSize: 11, marginLeft: 6, minWidth: 28 }}>⏱{Math.ceil(attemptMs / 1000)}</div>
              </form>
            ) : (
              <div style={{ textAlign: "center", color: "#888", fontSize: 14, fontFamily: "'Cinzel', serif", letterSpacing: "0.08em" }}>
                ⌛ {activeClue.buzzWinnerId ? "ANSWERING…" : "WAITING…"}
              </div>
            )
          )}
        </>
      )}

      <style>{`
        @keyframes buzzPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 32px rgba(255,122,58,0.5); }
          50% { transform: scale(1.03); box-shadow: 0 0 48px rgba(255,122,58,0.8); }
        }
      `}</style>
    </div>
  );
}

function Scoreboard({ players, pickerId, myId }: { players: Player[]; pickerId: string | null; myId: string }) {
  return (
    <div style={{
      marginTop: 20, padding: "12px",
      background: PANEL, border: "1px solid #2a2018", borderRadius: 10,
      display: "flex", gap: 10, overflowX: "auto",
    }}>
      {players.map(p => (
        <div key={p.id} style={{
          flexShrink: 0,
          padding: "10px 14px",
          borderRadius: 8,
          background: p.id === pickerId ? "rgba(212,169,66,0.12)" : "rgba(255,255,255,0.03)",
          border: `1px solid ${p.id === pickerId ? GOLD : "#2a2018"}`,
          opacity: p.connected ? 1 : 0.4,
          minWidth: 120,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {p.avatarUrl && <img src={p.avatarUrl} alt="" style={{ width: 20, height: 20, borderRadius: "50%" }} />}
            <span style={{ color: p.id === myId ? GOLD_BRIGHT : "#e8dcc8", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>{p.username}{p.id === pickerId && " 🎯"}</span>
          </div>
          <div style={{
            fontFamily: "'Cinzel', serif", fontWeight: 800,
            color: p.score >= 0 ? GOLD_BRIGHT : "#ff7a7a",
            fontSize: 20, marginTop: 4,
          }}>
            ${p.score}
          </div>
        </div>
      ))}
    </div>
  );
}

function FinalWager({ finalState, me, wagerInput, setWagerInput, submitted, onSubmit, players }: {
  finalState: FinalSnapshot; me: Player | undefined; wagerInput: string; setWagerInput: (s: string) => void;
  submitted: boolean; onSubmit: (w: number) => void; players: Record<string, Player>;
}) {
  const remaining = useDeadlineTick(finalState.wagerDeadline);
  const eligible = !!me && me.score > 0;
  const myMax = me?.score ?? 0;

  return (
    <div style={{ padding: "40px 20px", textAlign: "center" }}>
      <div style={{ fontFamily: "'Cinzel', serif", fontSize: 36, color: EMBER, letterSpacing: "0.18em", marginBottom: 8 }}>
        ⚡ FINAL NERD ALERT ⚡
      </div>
      <div style={{ color: GOLD_BRIGHT, fontFamily: "'Cinzel', serif", fontSize: 18, letterSpacing: "0.12em", marginBottom: 24 }}>
        {finalState.category}
      </div>

      {eligible ? (
        submitted ? (
          <div style={{ color: GOLD, fontSize: 16 }}>✓ Wager locked in. Waiting on others…</div>
        ) : (
          <div style={{ maxWidth: 360, margin: "0 auto" }}>
            <div style={{ color: "#a08040", fontSize: 14, marginBottom: 12 }}>
              Wager any amount from 0 to ${myMax} — secretly. You only see the clue after everyone wagers.
            </div>
            <input
              type="number" autoFocus
              value={wagerInput}
              onChange={(e) => setWagerInput(e.target.value)}
              min={0} max={myMax}
              placeholder="0"
              style={{
                padding: "16px 20px", fontSize: 28, textAlign: "center",
                background: BG, border: `2px solid ${EMBER}`, borderRadius: 10,
                color: GOLD_BRIGHT, fontFamily: "'Cinzel', serif", fontWeight: 800, width: 220, outline: "none",
              }}
            />
            <div>
              <button onClick={() => onSubmit(Math.max(0, Math.min(myMax, parseInt(wagerInput, 10) || 0)))} style={{
                marginTop: 14, padding: "12px 28px", borderRadius: 10,
                background: EMBER, color: "#fff", fontFamily: "'Cinzel', serif", fontWeight: 700,
                fontSize: 14, letterSpacing: "0.12em", border: "none", cursor: "pointer",
              }}>
                LOCK IT IN
              </button>
            </div>
          </div>
        )
      ) : (
        <div style={{ color: "#888", fontSize: 14 }}>You're out (score ≤ $0). Sit back and watch.</div>
      )}

      <div style={{ marginTop: 28, color: "#666", fontSize: 12, letterSpacing: "0.12em" }}>⏱ {Math.ceil(remaining / 1000)}s</div>
      <FinalStatus players={players} wagers={finalState.wagers} answers={null} />
    </div>
  );
}

function FinalAnswer({ finalState, me, answerInput, setAnswerInput, submitted, onSubmit, players }: {
  finalState: FinalSnapshot; me: Player | undefined; answerInput: string; setAnswerInput: (s: string) => void;
  submitted: boolean; onSubmit: (a: string) => void; players: Record<string, Player>;
}) {
  const remaining = useDeadlineTick(finalState.answerDeadline);
  const eligible = !!me && me.score > 0;

  return (
    <div style={{ padding: "20px", textAlign: "center" }}>
      <div style={{ fontFamily: "'Cinzel', serif", fontSize: 18, color: EMBER, letterSpacing: "0.2em", marginBottom: 8 }}>
        ⚡ FINAL NERD ALERT
      </div>
      <div style={{ color: GOLD, fontFamily: "'Cinzel', serif", fontSize: 14, letterSpacing: "0.12em", marginBottom: 20 }}>
        {finalState.category}
      </div>
      <div style={{
        padding: "24px",
        background: "linear-gradient(180deg, #0a0805, #1a1410)",
        border: `2px solid ${EMBER}`, borderRadius: 12,
        fontFamily: "Georgia, serif", fontSize: "clamp(16px, 3.2vw, 24px)", color: "#fff",
        lineHeight: 1.4, marginBottom: 24,
      }}>
        {finalState.clue ?? "…"}
      </div>

      {eligible ? (
        submitted ? (
          <div style={{ color: GOLD, fontSize: 16 }}>✓ Answer locked. Waiting on others…</div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); onSubmit(answerInput); }} style={{ display: "flex", gap: 8, maxWidth: 600, margin: "0 auto" }}>
            <input
              autoFocus
              value={answerInput}
              onChange={(e) => setAnswerInput(e.target.value)}
              placeholder="Your answer…"
              style={{
                flex: 1, padding: "14px 18px", fontSize: 18,
                background: BG, border: `2px solid ${GOLD}`, borderRadius: 10,
                color: "#fff", outline: "none", fontFamily: "Georgia, serif",
              }}
            />
            <button type="submit" style={{
              padding: "0 24px", background: GOLD, color: BG,
              fontFamily: "'Cinzel', serif", fontSize: 14, fontWeight: 800, letterSpacing: "0.1em",
              border: "none", borderRadius: 10, cursor: "pointer",
            }}>SUBMIT</button>
          </form>
        )
      ) : (
        <div style={{ color: "#888", fontSize: 14 }}>You're spectating this round.</div>
      )}

      <div style={{ marginTop: 20, color: "#666", fontSize: 12, letterSpacing: "0.12em" }}>⏱ {Math.ceil(remaining / 1000)}s</div>
      <FinalStatus players={players} wagers={finalState.wagers} answers={finalState.answers} />
    </div>
  );
}

function FinalStatus({ players, wagers, answers }: { players: Record<string, Player>; wagers: Record<string, number>; answers: Record<string, string> | null }) {
  return (
    <div style={{ marginTop: 24, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
      {Object.values(players).filter(p => p.score > 0 && p.connected).map(p => {
        const wagered = wagers[p.id] != null;
        const answered = answers ? !!answers[p.id] : false;
        return (
          <div key={p.id} style={{
            padding: "6px 12px", borderRadius: 16,
            background: "rgba(255,255,255,0.04)", border: "1px solid #2a2018", fontSize: 12, color: "#a08040",
          }}>
            {p.username}: {answers === null ? (wagered ? "✓ wagered" : "thinking…") : (answered ? "✓ answered" : (wagered ? "writing…" : "—"))}
          </div>
        );
      })}
    </div>
  );
}

function FinalReveal({ finalState, players }: { finalState: FinalSnapshot; players: Record<string, Player> }) {
  // Reveal in ascending pre-reveal score order — drama.
  const sorted = Object.values(players)
    .filter(p => p.score >= 0 && finalState.wagers[p.id] != null)
    .sort((a, b) => {
      // For drama, ascending pre-reveal score
      const aDelta = finalState.correct[a.id] ? -1 : 1; // didn't really pre-sort cleanly w/o pre-score, sort by current asc instead
      const bDelta = finalState.correct[b.id] ? -1 : 1;
      return a.score - b.score;
    });

  return (
    <div style={{ padding: "20px", textAlign: "center" }}>
      <div style={{ fontFamily: "'Cinzel', serif", fontSize: 28, color: EMBER, letterSpacing: "0.18em", marginBottom: 8 }}>
        THE REVEAL
      </div>
      <div style={{ color: "#a08040", fontFamily: "'Cinzel', serif", fontSize: 14, letterSpacing: "0.12em", marginBottom: 12 }}>
        {finalState.category}
      </div>
      <div style={{
        padding: "20px",
        background: "linear-gradient(180deg, #0a0805, #1a1410)",
        border: `2px solid ${GOLD}`, borderRadius: 12,
        fontFamily: "Georgia, serif", fontSize: "clamp(15px, 2.6vw, 20px)", color: "#fff",
        lineHeight: 1.4, marginBottom: 16,
      }}>
        {finalState.clue}
      </div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ color: GOLD, fontSize: 12, letterSpacing: "0.2em", marginBottom: 4 }}>CORRECT ANSWER</div>
        <div style={{ color: GOLD_BRIGHT, fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: 22 }}>{finalState.answer}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 540, margin: "0 auto" }}>
        {sorted.map(p => {
          const correct = !!finalState.correct[p.id];
          const wager = finalState.wagers[p.id] ?? 0;
          const submitted = finalState.answers[p.id] ?? "";
          return (
            <div key={p.id} style={{
              padding: "12px 16px", borderRadius: 10,
              background: correct ? "rgba(212,169,66,0.1)" : "rgba(196,83,26,0.08)",
              border: `1px solid ${correct ? GOLD : EMBER}`,
              textAlign: "left",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, color: "#e8dcc8" }}>{p.username}</span>
                <span style={{ fontFamily: "'Cinzel', serif", fontWeight: 800, color: correct ? GOLD_BRIGHT : "#ff7a7a", fontSize: 18 }}>
                  {correct ? `+$${wager}` : `−$${wager}`}
                </span>
              </div>
              <div style={{ color: "#a08040", fontSize: 13, marginTop: 4, fontStyle: "italic" }}>
                "{submitted || "(no answer)"}"
              </div>
              <div style={{ color: "#888", fontSize: 11, marginTop: 2 }}>
                Wagered ${wager} · Final score ${p.score}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DoneScreen({ players, playerOrder, isHost, onReset, onStart }: {
  players: Record<string, Player>; playerOrder: string[]; isHost: boolean; onReset: () => void; onStart: () => void;
}) {
  const ranked = playerOrder.map(id => players[id]).filter(Boolean).sort((a, b) => b.score - a.score);
  const winner = ranked[0];
  return (
    <div style={{ padding: "40px 20px", textAlign: "center" }}>
      <div style={{ fontFamily: "'Cinzel', serif", fontSize: 36, color: GOLD, letterSpacing: "0.2em", marginBottom: 24 }}>
        🏆 NERD CHAMPION
      </div>
      {winner && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>👑</div>
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 28, fontWeight: 800, color: GOLD_BRIGHT, letterSpacing: "0.06em" }}>{winner.username}</div>
          <div style={{ color: GOLD, fontSize: 22, marginTop: 4 }}>${winner.score}</div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 360, margin: "0 auto 32px" }}>
        {ranked.slice(1).map((p, i) => (
          <div key={p.id} style={{
            display: "flex", justifyContent: "space-between", padding: "8px 14px",
            background: "rgba(255,255,255,0.04)", border: "1px solid #2a2018", borderRadius: 8,
          }}>
            <span style={{ color: "#a08040" }}>#{i + 2} {p.username}</span>
            <span style={{ color: "#e8dcc8", fontWeight: 600 }}>${p.score}</span>
          </div>
        ))}
      </div>

      {isHost && (
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={onStart} style={{
            padding: "12px 28px", borderRadius: 10,
            background: `linear-gradient(135deg, ${GOLD}, ${EMBER})`,
            color: BG, fontFamily: "'Cinzel', serif", fontWeight: 800, fontSize: 14,
            letterSpacing: "0.12em", border: "none", cursor: "pointer",
          }}>PLAY AGAIN →</button>
          <button onClick={onReset} style={{
            padding: "12px 28px", borderRadius: 10,
            background: "transparent", border: `1px solid #3a2a1a`,
            color: "#a08040", fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: 14,
            letterSpacing: "0.1em", cursor: "pointer",
          }}>BACK TO LOBBY</button>
        </div>
      )}
    </div>
  );
}
