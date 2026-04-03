"use client";

import { useSession } from "@/lib/use-session";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

interface GameCard {
  id: string;
  title: string;
  desc: string;
  emoji: string;
  href: string;
  externalHref?: string;
  multiplayer?: boolean;
  comingSoon?: boolean;
}

const GAMES: Record<string, GameCard[]> = {
  "BATTLE ARENA": [
    { id: "outbreak", title: "Outbreak", desc: "Co-op zombie survival roguelike", emoji: "🧟", href: "/outbreak", multiplayer: true },
    { id: "whodoneit", title: "Who Done It?", desc: "Murder mystery party game", emoji: "🔪", href: "/whodoneit", multiplayer: true },
    { id: "tightrope", title: "Tightrope Terror", desc: "Balance your way across the void", emoji: "🎪", href: "/tightrope" },
    { id: "matty", title: "Matty Milkers", desc: "Raw milk platformer adventure", emoji: "🥛", href: "/games/matty-milkers" },
    { id: "wingman", title: "Wingman", desc: "Dating platformer — charm your way to victory", emoji: "💘", href: "/games/wingman" },
  ],
  "TABLE GAMES": [
    { id: "chess", title: "Chess", desc: "Classic 1v1 with ELO rating", emoji: "♟️", href: "/chess", multiplayer: true },
    { id: "poker", title: "Poker", desc: "Texas Hold'em", emoji: "🃏", href: "/poker", multiplayer: true },
    { id: "pong", title: "Paddle", desc: "Classic back-and-forth pong", emoji: "🏓", href: "/pong", multiplayer: true },
  ],
  "PARTY GAMES": [
    { id: "waddabi", title: "Wadabbi?!", desc: "Draw it. Guess it. Win.", emoji: "🎨", href: "/waddabi", multiplayer: true },
    { id: "quiz", title: "Quiz", desc: "Trivia with friends", emoji: "🧠", href: "/quiz", multiplayer: true },
    { id: "draw", title: "Draw", desc: "Free canvas drawing", emoji: "🖌️", href: "/draw" },
    { id: "moon-sim", title: "Moon Sim", desc: "Take Matt to the moon. He hates it.", emoji: "🌙", href: "/games/moon-sim" },
  ],
  "ADVENTURE": [
    { id: "moonhaven", title: "Moonhaven", desc: "RPG adventure world", emoji: "🌙", href: "/moonhaven", multiplayer: true },
    { id: "town", title: "Town", desc: "Hang out in the square", emoji: "🏘️", href: "/town", multiplayer: true },
  ],
  "RETRO": [
    { id: "snes", title: "SNES", desc: "Classic retro games + netplay", emoji: "🕹️", href: "/emulator", multiplayer: true },
  ],
};

const SECTION_ICONS: Record<string, string> = {
  "BATTLE ARENA": "⚔️",
  "TABLE GAMES": "🎲",
  "PARTY GAMES": "🎉",
  "ADVENTURE": "🗺️",
  "RETRO": "🕹️",
};

export default function GamesHub() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/signin");
  }, [status, router]);

  if (status !== "authenticated") {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 52px)", color: "var(--text-muted)" }}>Loading...</div>;
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 20px 80px" }}>
      <style>{`
        .game-card-link {
          display: flex; flex-direction: column;
          background: var(--bg-surface); border: 1px solid var(--border); border-radius: 14px;
          overflow: hidden; text-decoration: none;
          transition: border-color 0.15s, transform 0.1s, box-shadow 0.15s;
        }
        .game-card-link:hover {
          border-color: var(--accent-purple);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        }
        .game-card-link.disabled { opacity: 0.45; pointer-events: none; }
        @media (max-width: 600px) {
          .games-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 4 }}>🎮 Games</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 28 }}>Pick a game. No matchmaking — just play.</p>

      {Object.entries(GAMES).map(([section, games]) => (
        <div key={section} style={{ marginBottom: 32 }}>
          {/* Section header */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 15 }}>{SECTION_ICONS[section]}</span>
            <span style={{
              color: "var(--accent-purple-bright)", fontSize: 11, fontWeight: 700,
              letterSpacing: "0.18em", textTransform: "uppercase",
            }}>
              {section}
            </span>
            <div style={{ flex: 1, height: 1, background: "var(--border)", marginLeft: 8 }} />
          </div>

          <div className="games-grid" style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 14,
          }}>
            {games.map((game) => {
              const cardInner = (
                <>
                  {/* Card image area */}
                  <div style={{
                    height: 110,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "linear-gradient(135deg, rgba(139,60,247,0.1), rgba(0,229,255,0.06))",
                    position: "relative",
                  }}>
                    <span style={{ fontSize: 48 }}>{game.emoji}</span>
                    {game.multiplayer && !game.comingSoon && (
                      <div style={{
                        position: "absolute", top: 8, right: 8, width: 9, height: 9,
                        borderRadius: "50%", background: "var(--accent-green)",
                        boxShadow: "0 0 8px rgba(76,175,125,0.6)",
                      }} />
                    )}
                    {game.comingSoon && (
                      <div style={{
                        position: "absolute", top: 8, right: 8,
                        background: "rgba(0,0,0,0.6)", color: "var(--text-muted)",
                        fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
                        padding: "2px 6px", borderRadius: 4,
                      }}>SOON</div>
                    )}
                  </div>
                  {/* Card text */}
                  <div style={{ padding: "12px 14px 14px" }}>
                    <div style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 700, marginBottom: 3 }}>
                      {game.title}
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: 12, lineHeight: 1.4 }}>
                      {game.desc}
                    </div>
                  </div>
                </>
              );
              if (game.externalHref) {
                return (
                  <a
                    key={game.id}
                    href={game.externalHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="game-card-link"
                  >
                    {cardInner}
                  </a>
                );
              }
              return (
                <Link
                  key={game.id}
                  href={game.comingSoon ? "#" : game.href}
                  className={`game-card-link${game.comingSoon ? " disabled" : ""}`}
                  onClick={e => { if (game.comingSoon) e.preventDefault(); }}
                >
                  {cardInner}
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      <div style={{ textAlign: "center", marginTop: 8 }}>
        <Link href="/leaderboards" style={{
          color: "var(--accent-purple-bright)", fontSize: 12, letterSpacing: "0.1em",
          textDecoration: "none", textTransform: "uppercase", fontWeight: 700,
        }}>
          VIEW LEADERBOARDS →
        </Link>
      </div>
    </div>
  );
}
