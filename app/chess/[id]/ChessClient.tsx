"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import InviteViaDm from "@/app/components/InviteViaDm";
import { useRouter } from "next/navigation";
import { Chess, Square } from "chess.js";
import { Chessboard } from "react-chessboard";

interface GameData {
  id: string;
  white_id: string; black_id: string;
  white_username: string; white_display: string; white_avatar: string;
  white_rating: number; white_wins: number; white_losses: number; white_draws: number;
  black_username: string; black_display: string; black_avatar: string;
  black_rating: number; black_wins: number; black_losses: number; black_draws: number;
  status: string; fen: string; moves: string[]; winner_id: string | null;
}

function PlayerBadge({ avatar, username, display, color, isActive, isWinner, isLoser, rating, wins, losses, draws }: {
  avatar: string; username: string; display: string;
  color: "white" | "black"; isActive: boolean; isWinner: boolean; isLoser: boolean;
  rating: number; wins: number; losses: number; draws: number;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
      background: isActive ? "rgba(124,92,191,0.15)" : "var(--bg-elevated)",
      border: `1px solid ${isActive ? "rgba(124,92,191,0.5)" : "var(--border)"}`,
      borderRadius: 10, transition: "all 0.2s",
    }}>
      <img src={avatar || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${username}`}
        alt={username} style={{ width: 36, height: 36, borderRadius: 8 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: isWinner ? "#4ad990" : isLoser ? "#f08080" : "var(--text-primary)" }}>
          {display || username}{isWinner && " 👑"}{isLoser && " 🏳"}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          @{username} · {color === "white" ? "White" : "Black"}
          <span style={{ marginLeft: 6, color: "var(--accent-purple-bright)", fontWeight: 700 }}>♟ {rating ?? 1200}</span>
          <span style={{ marginLeft: 6, color: "var(--text-muted)" }}>{wins ?? 0}W {losses ?? 0}L {draws ?? 0}D</span>
        </div>
      </div>
      {isActive && (
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ad990" }} />
          <span style={{ fontSize: 11, color: "#4ad990", fontWeight: 700 }}>To move</span>
        </div>
      )}
    </div>
  );
}

export default function ChessClient({ gameId }: { gameId: string }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [game, setGame] = useState<GameData | null>(null);
  const [chess, setChess] = useState(new Chess());
  const [moveFrom, setMoveFrom] = useState<Square | null>(null);
  const [squareStyles, setSquareStyles] = useState<Record<string, React.CSSProperties>>({});
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [promoting, setPromoting] = useState<{ from: Square; to: Square } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const myId = session?.user?.id ?? null;

  const loadGame = useCallback(async () => {
    try {
      const res = await fetch(`/api/chess/${gameId}`);
      if (!res.ok) { setLoading(false); return; }
      const data: GameData = await res.json();
      setGame(data);
      setChess(new Chess(data.fen));
    } catch { /* ignore */ }
    setLoading(false);
  }, [gameId]);

  useEffect(() => { loadGame(); }, [loadGame]);

  useEffect(() => {
    if (!game || game.status !== "active") return;
    const turn = chess.turn();
    const isMyTurn = (turn === "w" && game.white_id === myId) || (turn === "b" && game.black_id === myId);
    if (isMyTurn) return;
    const t = setInterval(loadGame, 5000);
    return () => clearInterval(t);
  }, [game, chess, myId, loadGame]);

  const isPlayer = game ? (myId === game.white_id || myId === game.black_id) : false;
  const isSpectator = !isPlayer;
  const boardOrientation: "white" | "black" = game && myId === game.black_id ? "black" : "white";

  function getMoveOptions(square: Square): Record<string, React.CSSProperties> {
    const moves = chess.moves({ square, verbose: true });
    if (!moves.length) return {};
    const styles: Record<string, React.CSSProperties> = {
      [square]: { background: "rgba(124,92,191,0.45)", borderRadius: "4px" },
    };
    moves.forEach(m => {
      styles[m.to] = {
        background: chess.get(m.to as Square)
          ? "radial-gradient(circle, rgba(191,92,92,0.65) 82%, transparent 82%)"
          : "radial-gradient(circle, rgba(124,92,191,0.55) 26%, transparent 26%)",
      };
    });
    return styles;
  }

  const lastMoveStyles: Record<string, React.CSSProperties> = useMemo(() => {
    if (!lastMove) return {};
    return {
      [lastMove.from]: { background: "rgba(124,92,191,0.28)" },
      [lastMove.to]: { background: "rgba(124,92,191,0.28)" },
    };
  }, [lastMove]);

  const combinedStyles = useMemo(() => ({ ...lastMoveStyles, ...squareStyles }), [lastMoveStyles, squareStyles]);

  async function sendMove(sanMove: string, from: Square, to: Square) {
    setError("");
    setLastMove({ from, to });
    const res = await fetch(`/api/chess/${gameId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ move: sanMove }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Move failed — try again");
      loadGame();
    } else {
      const d = await res.json();
      setGame(g => g ? { ...g, fen: d.fen, status: d.status, moves: [...(g.moves ?? []), sanMove] } : g);
      if (d.status !== "active") loadGame();
    }
  }

  function onSquareClick({ square }: { piece: unknown; square: string }) {
    const sq = square as Square;
    if (!game || game.status !== "active") return;
    const turn = chess.turn();
    const isMyTurn = (turn === "w" && game.white_id === myId) || (turn === "b" && game.black_id === myId);
    if (!isMyTurn) return;

    if (!moveFrom) {
      const piece = chess.get(sq);
      if (piece && piece.color === turn) {
        setMoveFrom(sq);
        setSquareStyles(getMoveOptions(sq));
      }
      return;
    }

    // Attempt the move
    const tempChess = new Chess(chess.fen());
    let move = null;
    try {
      // Check if it's a pawn promotion
      const movingPiece = chess.get(moveFrom);
      const isPromotion = movingPiece?.type === "p" &&
        ((movingPiece.color === "w" && sq[1] === "8") || (movingPiece.color === "b" && sq[1] === "1"));

      if (isPromotion) {
        setPromoting({ from: moveFrom, to: sq });
        setMoveFrom(null); setSquareStyles({});
        return;
      }
      move = tempChess.move({ from: moveFrom, to: sq });
    } catch { /* illegal */ }

    if (!move) {
      const piece = chess.get(sq);
      if (piece && piece.color === turn) {
        setMoveFrom(sq);
        setSquareStyles(getMoveOptions(sq));
      } else {
        setMoveFrom(null); setSquareStyles({});
      }
      return;
    }

    setMoveFrom(null); setSquareStyles({});
    setChess(tempChess);
    sendMove(move.san, moveFrom, sq);
  }

  function onPieceDrop({ sourceSquare, targetSquare }: { piece: unknown; sourceSquare: string; targetSquare: string | null }): boolean {
    if (!game || game.status !== "active") return false;
    if (!targetSquare) return false;
    const turn = chess.turn();
    const isMyTurn = (turn === "w" && game.white_id === myId) || (turn === "b" && game.black_id === myId);
    if (!isMyTurn) return false;

    const from = sourceSquare as Square;
    const to = targetSquare as Square;

    // Check promotion
    const piece = chess.get(from);
    const isPromotion = piece?.type === "p" &&
      ((piece.color === "w" && to[1] === "8") || (piece.color === "b" && to[1] === "1"));

    // Verify the move is legal first
    const tempChess = new Chess(chess.fen());
    let move = null;
    try {
      move = tempChess.move({ from, to, promotion: "q" });
    } catch { return false; }
    if (!move) return false;

    if (isPromotion) {
      setPromoting({ from, to });
      return true;
    }

    setMoveFrom(null); setSquareStyles({});
    setChess(tempChess);
    sendMove(move.san, from, to);
    return true;
  }

  function handlePromotion(piece: string) {
    if (!promoting) return;
    const { from, to } = promoting;
    const tempChess = new Chess(chess.fen());
    let move = null;
    try { move = tempChess.move({ from, to, promotion: piece }); } catch { /* */ }
    setPromoting(null);
    if (!move) return;
    setChess(tempChess);
    sendMove(move.san, from, to);
  }

  async function resign() {
    if (!confirm("Resign this game?")) return;
    await fetch(`/api/chess/${gameId}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resign" }),
    });
    loadGame();
  }

  async function offerDraw() {
    if (!confirm("Claim draw? (Ends game immediately)")) return;
    await fetch(`/api/chess/${gameId}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "draw" }),
    });
    loadGame();
  }

  const statusMsg = (() => {
    if (!game) return null;
    if (game.status === "finished") {
      const w = game.winner_id === game.white_id ? (game.white_display || game.white_username) : (game.black_display || game.black_username);
      return `${w} wins by checkmate! 👑`;
    }
    if (game.status === "resigned") {
      const w = game.winner_id === game.white_id ? (game.white_display || game.white_username) : (game.black_display || game.black_username);
      return `${w} wins by resignation!`;
    }
    if (game.status === "draw") return "Game drawn!";
    if (chess.isCheck()) return chess.turn() === "w" ? "White is in check!" : "Black is in check!";
    return null;
  })();

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--text-muted)" }}>Loading game...</div>
  );
  if (!game) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: 12, color: "var(--text-muted)" }}>
      Game not found. <Link href="/messages" style={{ color: "var(--accent-purple-bright)" }}>← Back to messages</Link>
    </div>
  );

  const turn = chess.turn();
  const isMyTurn = game.status === "active" && ((turn === "w" && game.white_id === myId) || (turn === "b" && game.black_id === myId));

  const topPlayer = boardOrientation === "white"
    ? { avatar: game.black_avatar, username: game.black_username, display: game.black_display, color: "black" as const, id: game.black_id, rating: game.black_rating ?? 1200, wins: game.black_wins ?? 0, losses: game.black_losses ?? 0, draws: game.black_draws ?? 0 }
    : { avatar: game.white_avatar, username: game.white_username, display: game.white_display, color: "white" as const, id: game.white_id, rating: game.white_rating ?? 1200, wins: game.white_wins ?? 0, losses: game.white_losses ?? 0, draws: game.white_draws ?? 0 };

  const bottomPlayer = boardOrientation === "white"
    ? { avatar: game.white_avatar, username: game.white_username, display: game.white_display, color: "white" as const, id: game.white_id, rating: game.white_rating ?? 1200, wins: game.white_wins ?? 0, losses: game.white_losses ?? 0, draws: game.white_draws ?? 0 }
    : { avatar: game.black_avatar, username: game.black_username, display: game.black_display, color: "black" as const, id: game.black_id, rating: game.black_rating ?? 1200, wins: game.black_wins ?? 0, losses: game.black_losses ?? 0, draws: game.black_draws ?? 0 };

  return (
    <div style={{ maxWidth: 1050, margin: "0 auto", padding: "20px 16px 80px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={() => router.back()} style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>←</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>♟ Chess</h1>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {isSpectator ? "Spectating" : isMyTurn ? "Your turn" : "Waiting..."} · #{gameId.slice(0, 8)}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {isSpectator && (
            <div style={{ fontSize: 12, background: "rgba(74,144,217,0.15)", border: "1px solid rgba(74,144,217,0.3)", color: "#4a90d9", borderRadius: 8, padding: "4px 10px" }}>
              👁 Spectating
            </div>
          )}
          <Link href="/messages" style={{ fontSize: 12, background: "rgba(124,92,191,0.15)", border: "1px solid rgba(124,92,191,0.3)", color: "var(--accent-purple-bright)", borderRadius: 8, padding: "4px 10px", textDecoration: "none", fontWeight: 700 }}>
            💬 Messages
          </Link>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 20, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

          <PlayerBadge {...topPlayer}
            isActive={game.status === "active" && turn === (topPlayer.color === "white" ? "w" : "b")}
            isWinner={game.winner_id === topPlayer.id}
            isLoser={!!game.winner_id && game.winner_id !== topPlayer.id && game.status !== "draw"}
          />

          {statusMsg && (
            <div style={{ padding: "8px 14px", background: chess.isCheck() && game.status === "active" ? "rgba(240,192,64,0.15)" : "rgba(74,217,144,0.12)", border: `1px solid ${chess.isCheck() && game.status === "active" ? "rgba(240,192,64,0.4)" : "rgba(74,217,144,0.35)"}`, borderRadius: 8, fontSize: 13, fontWeight: 700, color: chess.isCheck() && game.status === "active" ? "#f0c040" : "#4ad990", textAlign: "center" }}>
              {statusMsg}
            </div>
          )}

          {error && (
            <div style={{ padding: "6px 12px", background: "rgba(191,92,92,0.15)", border: "1px solid rgba(191,92,92,0.4)", borderRadius: 8, fontSize: 12, color: "#f08080" }}>
              {error}
            </div>
          )}

          <div style={{ width: 480 }}>
            <Chessboard options={{
              position: chess.fen(),
              boardOrientation,
              boardStyle: { borderRadius: "8px", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" },
              darkSquareStyle: { backgroundColor: "#7c5cbf" },
              lightSquareStyle: { backgroundColor: "#f0d9b5" },
              squareStyles: combinedStyles,
              allowDragging: isMyTurn && !isSpectator,
              animationDurationInMs: 120,
              onSquareClick,
              onPieceDrop,
            }} />
          </div>

          <PlayerBadge {...bottomPlayer}
            isActive={game.status === "active" && turn === (bottomPlayer.color === "white" ? "w" : "b")}
            isWinner={game.winner_id === bottomPlayer.id}
            isLoser={!!game.winner_id && game.winner_id !== bottomPlayer.id && game.status !== "draw"}
          />

          {isPlayer && game.status === "active" && (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={offerDraw} style={{ flex: 1, background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)", borderRadius: 8, padding: "8px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>½ Draw</button>
              <button onClick={resign} style={{ flex: 1, background: "rgba(191,92,92,0.1)", border: "1px solid rgba(191,92,92,0.4)", color: "#f08080", borderRadius: 8, padding: "8px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>🏳 Resign</button>
            </div>
          )}
          {isSpectator && game.status === "active" && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>Auto-refreshing every 2.5s</div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="panel" style={{ padding: 14 }}>
            <div className="panel-header" style={{ marginBottom: 8 }}>Invite to Watch</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>Send a game invite directly to a friend's DMs.</div>
            <InviteViaDm gameTag="chess" gameId={gameId} label="📨 Invite Friend" style={{ width: "100%", justifyContent: "center" }} />
          </div>

          <div className="panel" style={{ padding: 14 }}>
            <div className="panel-header" style={{ marginBottom: 10 }}>
              Moves <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>({game.moves?.length ?? 0})</span>
            </div>
            <div style={{ maxHeight: 360, overflowY: "auto" }}>
              {!game.moves?.length ? (
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>No moves yet.</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <tbody>
                    {Array.from({ length: Math.ceil(game.moves.length / 2) }, (_, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.03)" }}>
                        <td style={{ padding: "3px 4px", color: "var(--text-muted)", fontSize: 11, width: 24 }}>{i + 1}.</td>
                        <td style={{ padding: "3px 8px", fontFamily: "monospace", color: "var(--text-primary)", fontWeight: 600 }}>{game.moves[i * 2]}</td>
                        <td style={{ padding: "3px 8px", fontFamily: "monospace", color: "var(--text-secondary)" }}>{game.moves[i * 2 + 1] ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Promotion modal */}
      {promoting && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-bright)", borderRadius: 16, padding: 28, textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Promote pawn to:</div>
            <div style={{ display: "flex", gap: 12 }}>
              {[
                { piece: "q", label: chess.turn() === "w" ? "♕" : "♛", name: "Queen" },
                { piece: "r", label: chess.turn() === "w" ? "♖" : "♜", name: "Rook" },
                { piece: "b", label: chess.turn() === "w" ? "♗" : "♝", name: "Bishop" },
                { piece: "n", label: chess.turn() === "w" ? "♘" : "♞", name: "Knight" },
              ].map(({ piece, label, name }) => (
                <button key={piece} onClick={() => handlePromotion(piece)}
                  style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-bright)", borderRadius: 12, padding: "14px 18px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, transition: "background 0.15s" }}>
                  <span style={{ fontSize: 42, lineHeight: 1, color: chess.turn() === "w" ? "#fff" : "#1a1a2e", textShadow: chess.turn() === "w" ? "0 0 3px #333" : "0 0 3px rgba(255,255,255,0.6)" }}>{label}</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
