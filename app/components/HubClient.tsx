"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface GameCard {
  id: string;
  title: string;
  desc: string;
  emoji: string;
  href?: string;
  iframeUrl?: string;
  multiplayer?: boolean;
  comingSoon?: boolean;
}

const GAME_SECTIONS: { label: string; icon: string; games: GameCard[] }[] = [
  {
    label: "BATTLE ARENA", icon: "⚔️",
    games: [
      { id: "outbreak",  title: "Outbreak",        desc: "Co-op zombie survival roguelike",     emoji: "🧟", multiplayer: true,
        iframeUrl: `/games/outbreak/index.html` },
      { id: "waddabi",   title: "Wadabbi?!",        desc: "Draw it. Guess it. Win.",             emoji: "🎨", multiplayer: true, href: "/waddabi" },
      { id: "tightrope", title: "Tightrope Terror", desc: "Balance your way across the void",   emoji: "🎪",
        iframeUrl: "/games/tightrope/index.html" },
      { id: "matty",     title: "Matty Milkers",    desc: "Raw milk platformer adventure",       emoji: "🥛",
        iframeUrl: "/games/matty-milkers/index.html" },
      { id: "wingman",   title: "Wingman",           desc: "Dating platformer — charm your way", emoji: "💘",
        iframeUrl: "/games/wingman/index.html" },
    ],
  },
  {
    label: "TABLE GAMES", icon: "🎲",
    games: [
      { id: "chess",  title: "Chess",  desc: "Classic 1v1 with ELO rating", emoji: "♟️", multiplayer: true, href: "/chess" },
      { id: "pong",   title: "Paddle", desc: "Classic back-and-forth pong",  emoji: "🏓", multiplayer: true, href: "/pong" },
    ],
  },
  {
    label: "RETRO", icon: "🕹️",
    games: [
      { id: "emulator", title: "SNES", desc: "Classic retro games + netplay", emoji: "🕹️", multiplayer: true, href: "/emulator" },
    ],
  },
  {
    label: "COMING SOON", icon: "🚀",
    games: [
      { id: "reakt", title: "REAKT", desc: "Co-op 3D FPS with fracture chains", emoji: "💥", comingSoon: true },
    ],
  },
];

export default function HubClient({ username, userId }: { username: string; userId: string }) {
  const [activeGame, setActiveGame] = useState<GameCard | null>(null);
  const [escPrompt, setEscPrompt] = useState(false);
  const [gpConnected, setGpConnected] = useState(false);
  const [gpName, setGpName] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Gamepad detection
  useEffect(() => {
    const onConnect = (e: GamepadEvent) => { setGpConnected(true); setGpName(e.gamepad.id.split("(")[0].trim()); };
    const onDisconnect = () => setGpConnected(false);
    window.addEventListener("gamepadconnected", onConnect);
    window.addEventListener("gamepaddisconnected", onDisconnect);
    const poll = setInterval(() => {
      try {
        const gps = navigator.getGamepads();
        for (let i = 0; i < gps.length; i++) if (gps[i]) { setGpConnected(true); setGpName(gps[i]!.id.split("(")[0].trim()); break; }
      } catch {}
    }, 1000);
    return () => { window.removeEventListener("gamepadconnected", onConnect); window.removeEventListener("gamepaddisconnected", onDisconnect); clearInterval(poll); };
  }, []);

  // Forward gamepad to iframe
  useEffect(() => {
    if (!activeGame) return;
    const iv = setInterval(() => {
      try {
        const gps = navigator.getGamepads ? navigator.getGamepads() : [];
        for (let i = 0; i < gps.length; i++) {
          const gp = gps[i];
          if (gp && iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage({
              type: "gamepad",
              buttons: Array.from(gp.buttons).map(b => b.pressed),
              axes: Array.from(gp.axes),
            }, "*");
            break;
          }
        }
      } catch {}
    }, 16);
    return () => clearInterval(iv);
  }, [activeGame]);

  // Double-ESC to exit game
  useEffect(() => {
    if (!activeGame) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (escPrompt) { setActiveGame(null); setEscPrompt(false); }
      else {
        setEscPrompt(true);
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => setEscPrompt(false), 2000);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); if (timer) clearTimeout(timer); };
  }, [activeGame, escPrompt]);

  function getIframeUrl(game: GameCard) {
    if (!game.iframeUrl) return null;
    const base = game.iframeUrl;
    if (game.id === "outbreak") {
      const avatar = encodeURIComponent(`/api/avatar/${userId}?v=2`);
      const party = encodeURIComponent(process.env.NEXT_PUBLIC_PARTYKIT_HOST || "localhost:1999");
      return `${base}?userId=${userId}&username=${username}&avatar=${avatar}&partyHost=${party}&supermusic=1`;
    }
    return `${base}?userId=${userId}&username=${username}`;
  }

  function handleGameClick(game: GameCard) {
    if (game.comingSoon) return;
    if (game.href) { window.location.href = game.href; return; }
    setActiveGame(game);
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#0d0d0d", position: "relative", overflow: "hidden" }}>

      {/* Game overlay */}
      {activeGame && (
        <div id="game-overlay" style={{ position: "fixed", inset: 0, zIndex: 50, background: "#0d0d0d", display: "flex", flexDirection: "column", height: "100dvh" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "rgba(26,26,26,0.95)", borderBottom: "1px solid #2a2a2a", flexShrink: 0 }}>
            <button onClick={() => { setActiveGame(null); setEscPrompt(false); }} style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "rgba(13,13,13,0.6)", border: "1px solid #2a2a2a", color: "#e8dcc8", cursor: "pointer" }}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
            <span style={{ color: "#d4a942", fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em" }}>{activeGame.title}</span>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
              {gpConnected && <span style={{ color: "#4ade80", fontSize: 10 }}>🎮</span>}
              <button onClick={() => { const el = document.getElementById("game-overlay"); if (document.fullscreenElement) document.exitFullscreen(); else el?.requestFullscreen(); }} style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, background: "rgba(13,13,13,0.6)", border: "1px solid #333", color: "#888", cursor: "pointer", fontSize: 14 }} title="Fullscreen">⛶</button>
            </div>
          </div>
          <iframe ref={iframeRef} src={getIframeUrl(activeGame) ?? ""} style={{ flex: 1, border: "none", width: "100%" }} allow="autoplay; gamepad" title={activeGame.title} />
          {escPrompt && (
            <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.9)", border: "1px solid #d4a942", borderRadius: 12, padding: "10px 24px", zIndex: 100 }}>
              <span style={{ color: "#d4a942", fontSize: 13, fontFamily: "'Cinzel', serif" }}>Press ESC again to exit</span>
            </div>
          )}
        </div>
      )}

      {/* Hub */}
      {!activeGame && (
        <>
          {/* Ember particles */}
          {[22, 38, 55, 70, 30, 48].map((left, i) => (
            <div key={i} className="ember" style={{ left: `${left}%`, bottom: `${6 + i * 3}%`, "--dur": `${3.5 + (i % 3) * 0.8}s`, animationDelay: `${i * 0.6}s` } as React.CSSProperties} />
          ))}

          {gpConnected && (
            <div style={{ background: "rgba(74,222,128,0.08)", borderBottom: "1px solid rgba(74,222,128,0.2)", padding: "4px 16px", textAlign: "center", color: "#4ade80", fontSize: 11 }}>
              🎮 {gpName || "Controller"} connected
            </div>
          )}

          <main style={{ maxWidth: 1100, margin: "0 auto", padding: "0 16px 80px" }}>
            {GAME_SECTIONS.map(({ label, icon, games }) => (
              <div key={label}>
                <div className="section-header"><span>{icon} {label}</span></div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
                  {games.map(game => (
                    <div key={game.id} className={`game-card${game.comingSoon ? " coming-soon" : ""}`} onClick={() => handleGameClick(game)}>
                      <div className="card-image"><span>{game.emoji}</span></div>
                      {game.comingSoon && <div style={{ position: "absolute", top: 8, right: 8, background: "#2a2a2a", color: "#666", fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20, letterSpacing: "0.05em" }}>SOON</div>}
                      {game.multiplayer && !game.comingSoon && <div className="card-badge" />}
                      <div className="card-body">
                        <div className="card-title">{game.title}</div>
                        <div className="card-desc">{game.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Leaderboard preview */}
            <div className="section-header"><span>🏆 LEADERBOARDS</span></div>
            <LeaderboardPreview />
            <div style={{ textAlign: "center", marginTop: 12 }}>
              <Link href="/leaderboards" style={{ fontFamily: "'Cinzel', serif", fontSize: 11, letterSpacing: "0.12em", color: "#8a6d2b", textDecoration: "none" }}>
                VIEW FULL LEADERBOARDS →
              </Link>
            </div>

            {/* Footer */}
            <div style={{ textAlign: "center", padding: "40px 0 16px", borderTop: "1px solid #2a2a2a", marginTop: 40 }}>
              <p style={{ color: "#444", fontSize: 11, margin: 0 }}>🔥 GREAT SOULS · A gathering of legends</p>
            </div>
          </main>
        </>
      )}
    </div>
  );
}

function LeaderboardPreview() {
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  useEffect(() => {
    fetch("/api/users/all").then(r => r.ok ? r.json() : []).then(d => setUsers(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  if (!users.length) return <div style={{ color: "#444", fontSize: 13, padding: "12px 0" }}>Loading...</div>;

  const card = (title: string, sorted: typeof users, key: string, fallback: number) => (
    <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12, padding: 16 }}>
      <h4 style={{ fontFamily: "'Cinzel', serif", color: "#d4a942", fontSize: 11, fontWeight: 700, marginBottom: 12, letterSpacing: "0.12em" }}>{title}</h4>
      {sorted.slice(0, 5).map((u: any, i: number) => (
        <div key={u.username as string} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
          <span style={{ color: "#8a6d2b", fontSize: 11, width: 16 }}>{i + 1}</span>
          <img src={`/api/avatar/${u.id}?v=2`} alt="" style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover" }} />
          <span style={{ flex: 1, fontSize: 13, color: "#e8dcc8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.username as string}</span>
          <span style={{ color: "#d4a942", fontSize: 13, fontWeight: 700 }}>{(u.stats as any)?.[key] ?? fallback}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
      {card("♟️ CHESS ELO", [...users].sort((a: any, b: any) => (b.stats?.chess_rating ?? 1200) - (a.stats?.chess_rating ?? 1200)), "chess_rating", 1200)}
      {card("🏓 PADDLE ELO", [...users].sort((a: any, b: any) => (b.stats?.paddle_rating ?? 1200) - (a.stats?.paddle_rating ?? 1200)), "paddle_rating", 1200)}
      {card("🧟 OUTBREAK KILLS", [...users].sort((a: any, b: any) => (b.stats?.outbreak_best_kills ?? 0) - (a.stats?.outbreak_best_kills ?? 0)), "outbreak_best_kills", 0)}
    </div>
  );
}
