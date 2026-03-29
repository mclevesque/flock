"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/use-session";
import { useState, useEffect, useRef } from "react";
import { useNotifications } from "@/lib/useNotifications";

const TOP_LEVEL = ["/", "/friends", "/messages", "/chess", "/emulator", "/pong", "/signin", "/draw", "/waddabi", "/leaderboards", "/games", "/profile", "/customize", "/moonhaven", "/outbreak", "/whodoneit", "/tightrope"];

const gameSections = [
  { label: "⚔️ BATTLE ARENA", items: [
    { href: "/outbreak",          label: "🧟 Outbreak",         desc: "Co-op zombie survival" },
    { href: "/waddabi",           label: "🎨 Wadabbi?!",         desc: "Draw it. Guess it. Win." },
    { href: "/tightrope",         label: "🎪 Tightrope Terror",  desc: "Balance or fall" },
    { href: "/games/matty-milkers", label: "🥛 Matty Milkers",   desc: "Raw milk platformer" },
    { href: "/games/wingman",     label: "💘 Wingman",           desc: "Dating platformer" },
  ]},
  { label: "🎲 TABLE GAMES", items: [
    { href: "/chess", label: "♟️ Chess",  desc: "1v1 with ELO rating" },
    { href: "/pong",  label: "🏓 Paddle", desc: "Classic back-and-forth" },
  ]},
  { label: "🕹️ RETRO", items: [
    { href: "/emulator", label: "🕹️ SNES", desc: "Classic retro games" },
  ]},
];

export default function Navbar() {
  const path = usePathname();
  if (path === "/voice-popup") return null;

  const router = useRouter();
  const { data: session } = useSession();
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [gamesOpen, setGamesOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [avatar, setAvatar] = useState<string>(`/api/avatar/${session?.user?.id}?v=2`);
  const [firstFriendAvatar, setFirstFriendAvatar] = useState<string | null>(null);
  const gamesRef = useRef<HTMLDivElement>(null);
  const touchStartYRef = useRef<number>(0);

  const { friendRequestCount, unreadMessageCount, clearUnreadMessages } = useNotifications();
  useEffect(() => { setPendingCount(friendRequestCount); }, [friendRequestCount]);
  useEffect(() => { setUnreadMessages(unreadMessageCount); }, [unreadMessageCount]);

  useEffect(() => {
    if (!session?.user?.id) return;
    fetch("/api/friend-requests").then(r => r.json()).then(d => {
      setPendingCount(Array.isArray(d.incoming) ? d.incoming.length : 0);
    }).catch(() => {});
    fetch("/api/friends").then(r => r.json()).then((friends: { avatar_url?: string | null }[]) => {
      if (Array.isArray(friends) && friends.length > 0 && friends[0].avatar_url) setFirstFriendAvatar(friends[0].avatar_url);
    }).catch(() => {});
    fetch(`/api/users?id=${session.user.id}`).then(r => r.json()).then(d => {
      if (d?.avatar_url) setAvatar(d.avatar_url);
    }).catch(() => {});
  }, [session?.user?.id]);

  useEffect(() => {
    if (path.startsWith("/messages")) { clearUnreadMessages(); setUnreadMessages(0); }
  }, [path, clearUnreadMessages]);

  useEffect(() => {
    if (!gamesOpen) return;
    function close(e: MouseEvent) { if (gamesRef.current && !gamesRef.current.contains(e.target as Node)) setGamesOpen(false); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [gamesOpen]);

  const isSubpage = !TOP_LEVEL.some(r => path === r || path === r + "/") && path !== "/";
  const isGame = gameSections.flatMap(s => s.items).some(g => path.startsWith(g.href));

  // Gold active indicator
  const activeStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700,
    textDecoration: "none", cursor: "pointer", background: "transparent", border: "none",
    color: active ? "#d4a942" : "#666",
    borderBottom: active ? "2px solid #d4a942" : "2px solid transparent",
    fontFamily: "'Cinzel', serif", letterSpacing: "0.06em", transition: "color 0.15s",
    whiteSpace: "nowrap" as const,
  });

  const Badge = ({ n }: { n: number }) => n > 0 ? (
    <span style={{ position: "absolute", top: -4, right: -4, background: "#c4531a", color: "#fff", borderRadius: 999, minWidth: 15, height: 15, fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>
      {n > 99 ? "99+" : n}
    </span>
  ) : null;

  const BottomTab = ({ href, icon, label, badge, onClick: cb }: { href: string; icon: string; label: string; badge?: number; onClick?: () => void }) => {
    const active = href === "/" ? path === "/" : path.startsWith(href);
    return (
      <Link href={href} onClick={cb} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "7px 4px 6px", textDecoration: "none", position: "relative", gap: 3, minHeight: 56, color: active ? "#d4a942" : "#555" }}>
        {active && <div style={{ position: "absolute", top: 0, left: "22%", right: "22%", height: 2, background: "#d4a942", borderRadius: "0 0 3px 3px" }} />}
        <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
        <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, fontFamily: "'Cinzel', serif", letterSpacing: "0.05em" }}>{label}</span>
        {(badge ?? 0) > 0 && <Badge n={badge!} />}
      </Link>
    );
  };

  return (
    <header style={{ background: "rgba(10,8,4,0.97)", borderBottom: "1px solid rgba(212,169,66,0.2)", position: "sticky", top: 0, zIndex: 1000 }}>

      {/* ── Desktop ──────────────────────────────────────────────────────────── */}
      <div className="desktop-only" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 16px", height: 52, display: "flex", alignItems: "center", gap: 8 }}>
        {isSubpage && (
          <button onClick={() => router.back()} style={{ background: "transparent", border: "1px solid #2a2a2a", borderRadius: 8, padding: "5px 10px", fontSize: 16, color: "#666", cursor: "pointer", flexShrink: 0 }}>←</button>
        )}

        {/* Logo */}
        <Link href="/" style={{ textDecoration: "none", flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 22 }}>🔥</span>
          <span style={{ fontFamily: "'Cinzel', serif", fontWeight: 900, fontSize: 15, color: "#d4a942", letterSpacing: "0.1em" }}>GREAT SOULS</span>
        </Link>

        {/* Nav */}
        <nav style={{ display: "flex", gap: 2, alignItems: "center", flex: 1, justifyContent: "center" }}>
          {/* Games dropdown */}
          <div ref={gamesRef} style={{ position: "relative" }}>
            <button onClick={() => setGamesOpen(o => !o)} style={{ ...activeStyle(isGame || gamesOpen), display: "flex", alignItems: "center", gap: 4 }}>
              🕹️ Games
              <span style={{ fontSize: 9, opacity: 0.6, transform: gamesOpen ? "rotate(180deg)" : "none", display: "inline-block", transition: "transform 0.15s" }}>▼</span>
            </button>
            {gamesOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", background: "#1a1a1a", border: "1px solid rgba(212,169,66,0.25)", borderRadius: 12, padding: "8px 6px", minWidth: 240, boxShadow: "0 12px 40px rgba(0,0,0,0.7)", zIndex: 10000 }}>
                <Link href="/" onClick={() => setGamesOpen(false)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderRadius: 8, textDecoration: "none", color: "#d4a942", fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: 11, letterSpacing: "0.06em" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,169,66,0.08)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  🏠 All Games →
                </Link>
                <div style={{ borderTop: "1px solid #2a2a2a", margin: "4px 0 6px" }} />
                {gameSections.map(section => (
                  <div key={section.label}>
                    <div style={{ padding: "4px 10px 2px", fontSize: 10, fontWeight: 700, color: "#8a6d2b", letterSpacing: "0.12em" }}>{section.label}</div>
                    {section.items.map(g => {
                      const active = path.startsWith(g.href);
                      return (
                        <Link key={g.href} href={g.href} onClick={() => setGamesOpen(false)}
                          style={{ display: "flex", flexDirection: "column", padding: "6px 10px", borderRadius: 7, textDecoration: "none", background: active ? "rgba(212,169,66,0.1)" : "transparent", color: active ? "#d4a942" : "#e8dcc8", transition: "background 0.1s" }}
                          onMouseEnter={e => (e.currentTarget.style.background = active ? "rgba(212,169,66,0.15)" : "rgba(255,255,255,0.04)")}
                          onMouseLeave={e => (e.currentTarget.style.background = active ? "rgba(212,169,66,0.1)" : "transparent")}>
                          <span style={{ fontWeight: 600, fontSize: 12 }}>{g.label}</span>
                          <span style={{ fontSize: 10, color: "#555", marginTop: 1 }}>{g.desc}</span>
                        </Link>
                      );
                    })}
                    <div style={{ height: 4 }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <Link href="/friends" style={{ ...activeStyle(path.startsWith("/friends")), position: "relative", display: "inline-block" } as React.CSSProperties}>
            👥 Friends
            <Badge n={pendingCount} />
          </Link>
          <Link href="/messages" onClick={() => setUnreadMessages(0)} style={{ ...activeStyle(path.startsWith("/messages")), position: "relative", display: "inline-block" } as React.CSSProperties}>
            💬 Messages
            <Badge n={unreadMessages} />
          </Link>
          <Link href="/moonhaven" style={activeStyle(path.startsWith("/moonhaven")) as React.CSSProperties}>🌙 Moonhaven</Link>
          <Link href="/leaderboards" style={activeStyle(path.startsWith("/leaderboards")) as React.CSSProperties}>🏆 Leaderboards</Link>
        </nav>

        {/* Right: avatar + sign out */}
        {session ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <Link href={`/profile/${session.user?.name}`} style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
              <img src={avatar} alt="avatar" onError={e => { (e.currentTarget as HTMLImageElement).src = `/api/avatar/${session.user?.id}?v=2`; (e.currentTarget as HTMLImageElement).onerror = null; }}
                style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid rgba(212,169,66,0.5)", display: "block", objectFit: "cover" }} />
              <span style={{ fontSize: 13, color: "#8a6d2b", fontWeight: 600 }}>@{session.user?.name}</span>
            </Link>
            <button onClick={() => signOut()} style={{ background: "transparent", border: "1px solid #2a2a2a", color: "#555", borderRadius: 7, padding: "4px 8px", fontSize: 12, cursor: "pointer" }}>Out</button>
          </div>
        ) : (
          <button onClick={() => router.push("/signin")} className="btn-gold" style={{ flexShrink: 0 }}>Enter</button>
        )}
      </div>

      {/* ── Mobile header ────────────────────────────────────────────────────── */}
      <div className="mobile-only" style={{ height: 52, alignItems: "center", justifyContent: "space-between", padding: "0 12px" }}>
        <div style={{ width: 40, flexShrink: 0 }}>
          {isSubpage && (
            <button onClick={() => router.back()} style={{ background: "transparent", border: "none", fontSize: 20, color: "#666", cursor: "pointer", minWidth: 40, minHeight: 44, padding: 0 }}>←</button>
          )}
        </div>
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 24 }}>🔥</span>
          <span style={{ fontFamily: "'Cinzel', serif", fontWeight: 900, fontSize: 14, color: "#d4a942", letterSpacing: "0.1em" }}>GREAT SOULS</span>
        </Link>
        <div style={{ width: 40, flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>
          {session ? (
            <Link href={`/profile/${session.user?.name}`}>
              <img src={avatar} alt="avatar" onError={e => { (e.currentTarget as HTMLImageElement).src = `/api/avatar/${session.user?.id}?v=2`; (e.currentTarget as HTMLImageElement).onerror = null; }}
                style={{ width: 30, height: 30, borderRadius: "50%", border: "2px solid rgba(212,169,66,0.4)", display: "block", objectFit: "cover" }} />
            </Link>
          ) : (
            <button onClick={() => router.push("/signin")} style={{ background: "linear-gradient(135deg, #8a6d2b, #d4a942)", color: "#0d0d0d", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Enter</button>
          )}
        </div>
      </div>

      {/* ── Mobile bottom bar ────────────────────────────────────────────────── */}
      <div className="mobile-bottom-nav" style={{
        display: "none", position: "fixed", bottom: 0, left: 0, right: 0,
        background: "rgba(8,6,2,0.97)", backdropFilter: "blur(12px)",
        borderTop: "1px solid rgba(212,169,66,0.15)",
        zIndex: 200, alignItems: "stretch", paddingBottom: "env(safe-area-inset-bottom)",
      }}>
        <BottomTab href="/" icon="🏠" label="Games" />
        <BottomTab href="/messages" icon="💬" label="Messages" badge={unreadMessages} onClick={() => setUnreadMessages(0)} />
        <BottomTab href="/moonhaven" icon="🌙" label="Moonhaven" />
        <BottomTab href="/friends" icon="👥" label="Friends" badge={pendingCount} />
        {/* Profile tab */}
        <Link href={session ? `/profile/${session.user?.name}` : "/signin"} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "7px 4px 6px", textDecoration: "none", position: "relative", gap: 3, minHeight: 56, color: path.startsWith("/profile") ? "#d4a942" : "#555" }}>
          {path.startsWith("/profile") && <div style={{ position: "absolute", top: 0, left: "22%", right: "22%", height: 2, background: "#d4a942", borderRadius: "0 0 3px 3px" }} />}
          {session ? (
            <img src={avatar} alt="me" style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover", border: `1.5px solid ${path.startsWith("/profile") ? "#d4a942" : "#333"}` }} onError={e => { (e.currentTarget as HTMLImageElement).src = `/api/avatar/${session.user?.id}?v=2`; }} />
          ) : <span style={{ fontSize: 22 }}>👤</span>}
          <span style={{ fontSize: 10, fontWeight: path.startsWith("/profile") ? 700 : 500, fontFamily: "'Cinzel', serif", letterSpacing: "0.05em" }}>Me</span>
        </Link>

        {/* More drawer button */}
        <button onClick={() => setMoreOpen(o => !o)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "7px 4px 6px", background: "transparent", border: "none", cursor: "pointer", color: moreOpen ? "#d4a942" : "#555", gap: 3, minHeight: 56, position: "relative" }}>
          {moreOpen && <div style={{ position: "absolute", top: 0, left: "22%", right: "22%", height: 2, background: "#d4a942", borderRadius: "0 0 3px 3px" }} />}
          <span style={{ fontSize: 22 }}>{moreOpen ? "✕" : "☰"}</span>
          <span style={{ fontSize: 10, fontFamily: "'Cinzel', serif", letterSpacing: "0.05em" }}>More</span>
        </button>
      </div>

      {/* More drawer */}
      {moreOpen && (
        <>
          <div className="mobile-bottom-nav" onTouchStart={e => { touchStartYRef.current = e.touches[0].clientY; }} onTouchEnd={e => { if (e.changedTouches[0].clientY - touchStartYRef.current > 60) setMoreOpen(false); }}
            style={{ display: "none", position: "fixed", bottom: "calc(56px + env(safe-area-inset-bottom))", left: 0, right: 0, background: "rgba(10,8,4,0.98)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(212,169,66,0.2)", zIndex: 199, flexDirection: "column", padding: "20px 16px 12px", boxShadow: "0 -16px 48px rgba(0,0,0,0.8)", borderRadius: "20px 20px 0 0" }}>
            <div style={{ width: 36, height: 3, background: "rgba(212,169,66,0.2)", borderRadius: 99, margin: "0 auto 16px" }} />
            <div style={{ fontSize: 10, color: "#8a6d2b", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 12, fontFamily: "'Cinzel', serif", fontWeight: 700 }}>Games</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
              {gameSections.flatMap(s => s.items).map(g => {
                const active = path.startsWith(g.href);
                return (
                  <Link key={g.href} href={g.href} onClick={() => setMoreOpen(false)}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "14px 8px", borderRadius: 12, textDecoration: "none", background: active ? "rgba(212,169,66,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${active ? "rgba(212,169,66,0.3)" : "rgba(255,255,255,0.06)"}`, color: active ? "#d4a942" : "#888" }}>
                    <span style={{ fontSize: 24 }}>{g.label.split(" ")[0]}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, textAlign: "center" }}>{g.label.replace(/^[^\s]+\s/, "")}</span>
                  </Link>
                );
              })}
            </div>
            {session && (
              <div style={{ borderTop: "1px solid rgba(212,169,66,0.15)", paddingTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
                <img src={avatar} style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(212,169,66,0.4)" }} alt="" />
                <span style={{ fontSize: 13, color: "#8a6d2b", fontWeight: 600, flex: 1 }}>@{session.user?.name}</span>
                <button onClick={() => signOut()} style={{ background: "rgba(196,83,26,0.15)", border: "1px solid rgba(196,83,26,0.3)", borderRadius: 10, padding: "7px 16px", color: "#c4531a", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Sign Out</button>
              </div>
            )}
          </div>
          <div className="mobile-bottom-nav" style={{ display: "none", position: "fixed", inset: 0, bottom: "calc(56px + env(safe-area-inset-bottom))", background: "rgba(0,0,0,0.6)", zIndex: 198 }} onClick={() => setMoreOpen(false)} />
        </>
      )}
    </header>
  );
}
