"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/use-session";
import { useRouter } from "next/navigation";
import { usePortal } from "@/app/components/PortalContext";
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
  ],
  "ADVENTURE": [
    { id: "moonhaven", title: "Moonhaven", desc: "RPG adventure world", emoji: "🌙", href: "/moonhaven", multiplayer: true },
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

export default function GreatSoulsHub() {
  const { data: session, status } = useSession();
  const { portal, setPortal } = usePortal();
  const router = useRouter();
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (portal !== "greatsouls") setPortal("greatsouls");
    // Mark this user as a GS visitor so RYFT nav shows the toggle
    try { localStorage.setItem("ryft_gs_visited", "1"); } catch {}
  }, [portal, setPortal]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/greatsouls");
  }, [status, router]);

  // Fetch avatar
  useEffect(() => {
    if (session?.user?.id) {
      fetch(`/api/users?id=${session.user.id}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.avatar_url) setAvatar(d.avatar_url); })
        .catch(() => {});
    }
  }, [session?.user?.id]);

  if (status !== "authenticated") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0d0d0d" }}>
        <div style={{ color: "#d4a942", fontFamily: "serif", fontSize: 20 }}>Loading...</div>
      </div>
    );
  }

  const username = session.user?.name ?? "soul";

  return (
    <div style={{ minHeight: "100vh", background: "#0d0d0d", color: "#e8dcc8" }}>
      <style>{`
        .gs-card:hover {
          border-color: #d4a942 !important;
          transform: translateY(-4px);
          box-shadow: 0 8px 32px rgba(212,169,66,0.2), 0 0 0 1px rgba(212,169,66,0.3);
        }
        .gs-card:active { transform: translateY(-2px) scale(0.98); }
        .gs-card-image {
          width: 100%; aspect-ratio: 16/10;
          display: flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, rgba(212,169,66,0.06), rgba(196,83,26,0.06));
          font-size: 3rem; position: relative;
        }
        .gs-section-header {
          display: flex; align-items: center; gap: 12px;
          font-family: serif; font-weight: 600; font-size: 0.85rem;
          color: #d4a942; letter-spacing: 0.15em; text-transform: uppercase;
          padding: 24px 0 10px;
        }
        .gs-section-header::before, .gs-section-header::after {
          content: ''; flex: 1; height: 1px; background: #2a2a2a;
        }
        @media (max-width: 640px) { .gs-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (min-width: 641px) and (max-width: 1023px) { .gs-grid { grid-template-columns: repeat(3, 1fr) !important; } }
        @media (min-width: 1024px) { .gs-grid { grid-template-columns: repeat(4, 1fr) !important; } }
      `}</style>
      {/* GS Navbar */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 40,
        display: "flex", alignItems: "center", padding: "10px 16px",
        background: "rgba(13,13,13,0.95)", backdropFilter: "blur(8px)",
        borderBottom: "1px solid #2a2a2a",
      }}>
        <Link href="/greatsouls/hub" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <span style={{ fontSize: 20 }}>🔥</span>
          <span style={{ fontFamily: "serif", color: "#d4a942", fontWeight: 700, fontSize: 16, letterSpacing: "0.08em" }}>
            GREAT SOULS
          </span>
        </Link>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/leaderboards" style={{ color: "#8a6d2b", fontSize: 12, fontWeight: 700, textDecoration: "none", letterSpacing: "0.08em" }}>
            🏆 RANKS
          </Link>
          <Link href="/friends" style={{ color: "#8a6d2b", fontSize: 12, fontWeight: 700, textDecoration: "none", letterSpacing: "0.08em" }}>
            👥 FRIENDS
          </Link>
          <Link href="/messages" style={{ color: "#8a6d2b", fontSize: 12, fontWeight: 700, textDecoration: "none", letterSpacing: "0.08em" }}>
            💬 CHAT
          </Link>
          <Link href="/greatsouls/profile" style={{ color: "#8a6d2b", fontSize: 12, fontWeight: 700, textDecoration: "none", letterSpacing: "0.08em" }}>
            👤 PROFILE
          </Link>
          {/* Switch to RYFT UI */}
          <Link href="/profile" style={{
            display: "flex", alignItems: "center", gap: 5,
            background: "rgba(139,60,247,0.15)", border: "1px solid rgba(139,60,247,0.4)",
            borderRadius: 6, padding: "4px 10px", textDecoration: "none",
            color: "#a78bfa", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
          }}>
            ⚡ RYFT
          </Link>
          <Link href="/greatsouls/profile" style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
            {avatar ? (
              <img src={avatar} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", border: "2px solid #d4a942" }} />
            ) : (
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#2a2a2a", border: "2px solid #d4a942", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>🔥</div>
            )}
          </Link>
        </div>
      </nav>

      {/* Game sections */}
      <main style={{ maxWidth: 1152, margin: "0 auto", padding: "0 16px 80px" }}>
        {Object.entries(GAMES).map(([section, games]) => (
          <div key={section}>
            <div className="gs-section-header">
              <span>{SECTION_ICONS[section]} {section}</span>
            </div>

            <div className="gs-grid" style={{ display: "grid", gap: 16 }}>
              {games.map((game) => {
                const cardStyle: React.CSSProperties = {
                  display: "flex", flexDirection: "column", position: "relative",
                  background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12,
                  overflow: "hidden", textDecoration: "none",
                  opacity: game.comingSoon ? 0.6 : 1,
                  cursor: game.comingSoon ? "not-allowed" : "pointer",
                  transition: "all 0.2s ease",
                };
                const cardInner = (
                  <>
                    <div className="gs-card-image">
                      <span>{game.emoji}</span>
                      {game.multiplayer && !game.comingSoon && (
                        <div style={{
                          position: "absolute", top: 10, right: 10, width: 9, height: 9,
                          borderRadius: "50%", background: "#4caf7d",
                          boxShadow: "0 0 6px rgba(76,175,125,0.5)",
                        }} />
                      )}
                      {game.comingSoon && (
                        <div style={{
                          position: "absolute", top: 8, right: 8,
                          background: "rgba(212,169,66,0.2)", border: "1px solid #d4a942",
                          borderRadius: 4, padding: "1px 6px", fontSize: 9, color: "#d4a942",
                          fontWeight: 700, letterSpacing: "0.05em",
                        }}>SOON</div>
                      )}
                    </div>
                    <div style={{ padding: "12px 16px 16px" }}>
                      <div style={{ fontFamily: "serif", color: "#d4a942", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                        {game.title}
                      </div>
                      <div style={{ color: "#888", fontSize: 12.8, lineHeight: 1.3 }}>
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
                      className="gs-card"
                      style={cardStyle}
                    >
                      {cardInner}
                    </a>
                  );
                }
                return (
                  <Link
                    key={game.id}
                    href={game.comingSoon ? "#" : game.href}
                    className="gs-card"
                    style={cardStyle}
                    onClick={e => { if (game.comingSoon) e.preventDefault(); }}
                  >
                    {cardInner}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {/* Leaderboard link */}
        <div style={{ textAlign: "center", marginTop: 32 }}>
          <Link href="/leaderboards" style={{
            color: "#8a6d2b", fontFamily: "serif", fontSize: 12, letterSpacing: "0.15em",
            textDecoration: "none", textTransform: "uppercase",
          }}>
            VIEW FULL LEADERBOARDS →
          </Link>
        </div>
      </main>
    </div>
  );
}
