"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/use-session";
import { useState, useEffect, useRef } from "react";
import { click, swoosh } from "@/app/components/sounds";
import StoryRecorder from "./StoryRecorder";

const navItems = [
  { href: "/feed", label: "✨ Share", short: "✨" },
  { href: "/chronicle", label: "📜 Chronicle", short: "📜" },
  { href: "/profile", label: "Profile", short: "👤" },
  { href: "/friends", label: "Friends", short: "👥" },
  { href: "/messages", label: "Messages", short: "💬" },
  { href: "/town", label: "🏘️ Town", short: "🏘️" },
  { href: "/stremio", label: "🎬 Stream", short: "🎬" },
];

// Top-level routes that do NOT get a back button
const TOP_LEVEL = ["/profile", "/friends", "/messages", "/stremio", "/chess", "/quiz", "/poker", "/emulator", "/pong", "/signin", "/draw", "/feed", "/town", "/chronicle", "/waddabi", "/vibe", "/moonhaven", "/outbreak"];

// Major sections where Town/Share should always show (signed-in top bar)
const TOWN_SHARE_SECTIONS = ["/feed", "/profile", "/friends", "/messages", "/town", "/chronicle", "/draw", "/stremio", "/chess", "/quiz", "/poker", "/emulator", "/pong", "/waddabi", "/signin", "/vibe", "/moonhaven", "/outbreak"];

const gameItems = [
  { href: "/chess", label: "♟️ Chess", desc: "Play 1v1 chess" },
  { href: "/quiz", label: "🧠 Quiz", desc: "Trivia with friends" },
  { href: "/pong", label: "🏓 Paddle", desc: "Classic back-and-forth" },
  { href: "/emulator", label: "🎮 SNES", desc: "Classic games" },
  { href: "/poker", label: "🃏 Poker", desc: "Texas Hold'em" },
  { href: "/waddabi", label: "🎨 Wadabbi?!", desc: "Draw it. Guess it. Win." },
  { href: "/draw", label: "🎨 Draw", desc: "Free canvas drawing" },
  { href: "/moonhaven", label: "🌙 Moonhaven", desc: "RPG adventure" },
  { href: "/outbreak", label: "🧟 Outbreak", desc: "Co-op zombie survival" },
];

export default function Navbar() {
  const path = usePathname();
  // Voice popup runs in its own window — no navbar needed
  if (path === "/voice-popup") return null;
  const router = useRouter();
  const { data: session } = useSession();
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [chronicleUnread, setChronicleUnread] = useState(0);
  const [gamesOpen, setGamesOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [dbAvatar, setDbAvatar] = useState<string | null>(null);
  const [firstFriendAvatar, setFirstFriendAvatar] = useState<string | null>(null);
  const [hasSnesAccess, setHasSnesAccess] = useState(false);
  const [storyRecorderOpen, setStoryRecorderOpen] = useState(false);
  const gamesRef = useRef<HTMLDivElement>(null);
  const touchStartYRef = useRef<number>(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  useEffect(() => {
    if (!session?.user?.id) return;
    function check() {
      fetch("/api/friend-requests").then(r => r.json()).then(d => {
        setPendingCount(Array.isArray(d.incoming) ? d.incoming.length : 0);
      }).catch(() => {});
    }
    check();
    const t = setInterval(check, 30000);
    // Fetch first friend's avatar for the Friends tab icon
    fetch("/api/friends").then(r => r.json()).then((friends: { avatar_url?: string | null }[]) => {
      if (Array.isArray(friends) && friends.length > 0 && friends[0].avatar_url) {
        setFirstFriendAvatar(friends[0].avatar_url);
      }
    }).catch(() => {});
    // Fetch SNES access once on mount
    fetch(`/api/privileges?userId=${session.user.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.snes_access) setHasSnesAccess(true); })
      .catch(() => {});
    return () => clearInterval(t);
  }, [session?.user?.id]);

  // Track chronicle reply notifications
  useEffect(() => {
    if (!session?.user?.id) return;
    const storageKey = `ryft_chronicle_seen_${session.user.id}`;

    async function checkChronicle() {
      try {
        const onChroniclePage = window.location.pathname.startsWith("/chronicle");
        if (onChroniclePage) {
          // Mark all current comments as seen
          localStorage.setItem(storageKey, String(Date.now()));
          setChronicleUnread(0);
          return;
        }

        const since = localStorage.getItem(storageKey);
        if (!since) {
          // First visit ever — seed the timestamp, show no badge
          localStorage.setItem(storageKey, String(Date.now()));
          setChronicleUnread(0);
          return;
        }

        const r = await fetch(`/api/notifications?since=${since}`);
        if (!r.ok) return;
        const d = await r.json();
        setChronicleUnread(d.chronicleReplies ?? 0);
      } catch { /* ignore */ }
    }

    checkChronicle();
    const t = setInterval(checkChronicle, 60000);
    return () => clearInterval(t);
  }, [session?.user?.id]);

  // Clear chronicle badge when navigating to /chronicle
  useEffect(() => {
    if (!session?.user?.id || !path.startsWith("/chronicle")) return;
    const storageKey = `ryft_chronicle_seen_${session.user.id}`;
    localStorage.setItem(storageKey, String(Date.now()));
    setChronicleUnread(0);
  }, [path, session?.user?.id]);

  // Track unread messages (conversations with messages newer than last visit)
  useEffect(() => {
    if (!session?.user?.id) return;
    const storageKey = `ryft_msgs_seen_${session.user.id}`;
    let initialized = false;

    async function checkUnread() {
      try {
        const r = await fetch("/api/messages");
        if (!r.ok) return;
        const convs: { other_user: string; created_at: string }[] = await r.json();
        if (!Array.isArray(convs)) return;
        const saved = JSON.parse(localStorage.getItem(storageKey) ?? "{}") as Record<string, string>;

        if (!initialized) {
          // First load: seed timestamps, don't show badge (unless navigated away)
          const onMessagesPage = window.location.pathname.startsWith("/messages");
          if (onMessagesPage) {
            // Mark all as seen
            const next: Record<string, string> = {};
            for (const c of convs) next[c.other_user] = c.created_at;
            localStorage.setItem(storageKey, JSON.stringify(next));
            setUnreadMessages(0);
          } else {
            // If no saved data at all, seed timestamps (first visit or cleared localStorage)
            // Don't show old messages as unread
            const hasSavedData = Object.keys(saved).length > 0;
            if (!hasSavedData) {
              const next: Record<string, string> = {};
              for (const c of convs) next[c.other_user] = c.created_at;
              localStorage.setItem(storageKey, JSON.stringify(next));
              setUnreadMessages(0);
            } else {
              // Count conversations newer than saved
              let count = 0;
              for (const c of convs) {
                const last = saved[c.other_user];
                if (!last || new Date(c.created_at) > new Date(last)) count++;
              }
              setUnreadMessages(count);
            }
          }
          initialized = true;
          return;
        }

        let count = 0;
        for (const c of convs) {
          const last = saved[c.other_user];
          if (!last || new Date(c.created_at) > new Date(last)) count++;
        }
        setUnreadMessages(count);
      } catch { /* ignore */ }
    }

    checkUnread();
    const t = setInterval(checkUnread, 30000);

    return () => clearInterval(t);
  }, [session?.user?.id]);

  // Clear badge immediately whenever the user navigates to /messages (reactive to Next.js routing)
  useEffect(() => {
    if (!session?.user?.id || !path.startsWith("/messages")) return;
    const storageKey = `ryft_msgs_seen_${session.user.id}`;
    fetch("/api/messages").then(r => r.json()).then((convs: { other_user: string; created_at: string }[]) => {
      if (!Array.isArray(convs)) return;
      const next: Record<string, string> = {};
      for (const c of convs) next[c.other_user] = c.created_at;
      localStorage.setItem(storageKey, JSON.stringify(next));
      setUnreadMessages(0);
    }).catch(() => {});
  }, [path, session?.user?.id]);

  // Fetch actual DB avatar (may differ from OAuth session image after profile edit).
  // If no avatar is in DB yet, or the stored URL is a raw OAuth URL that can expire,
  // upload it to Vercel Blob for a permanent CDN URL.
  useEffect(() => {
    if (!session?.user?.id) return;
    fetch(`/api/users?id=${session.user.id}`)
      .then(r => r.json())
      .then(d => {
        const storedUrl: string | undefined = d?.avatar_url;
        const sessionImg: string | undefined = session?.user?.image ?? undefined;

        // Helper: returns true for raw OAuth image URLs that can expire
        function isVolatileUrl(url: string) {
          return (
            url.includes("googleusercontent.com") ||
            url.includes("avatars.githubusercontent.com") ||
            url.includes("pbs.twimg.com") ||
            url.includes("platform-lookaside.fbsbx.com")
          );
        }

        // Helper: upload a URL to Vercel Blob and persist permanent URL to DB
        function persistToBlobAndSave(imageUrl: string) {
          fetch("/api/avatar-upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageUrl }),
          })
            .then(r => r.json())
            .then(uploadData => {
              const permanentUrl: string = uploadData.url ?? imageUrl;
              setDbAvatar(permanentUrl);
              fetch("/api/users", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ avatar_url: permanentUrl }),
              }).catch(() => {});
            })
            .catch(() => {
              // Blob upload failed — fall back to saving the raw URL so at least
              // the avatar shows until the next session migration attempt
              setDbAvatar(imageUrl);
              fetch("/api/users", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ avatar_url: imageUrl }),
              }).catch(() => {});
            });
        }

        if (storedUrl) {
          // Show whatever we have immediately
          setDbAvatar(storedUrl);
          // If it's a volatile OAuth URL, silently migrate it to Blob in the background
          if (isVolatileUrl(storedUrl) && sessionImg) {
            persistToBlobAndSave(sessionImg);
          }
        } else if (sessionImg) {
          // No avatar in DB yet — show the OAuth image immediately, then persist to Blob
          setDbAvatar(sessionImg);
          persistToBlobAndSave(sessionImg);
        }
      })
      .catch(() => {});
  }, [session?.user?.id]);

  // Close games dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (gamesRef.current && !gamesRef.current.contains(e.target as Node)) {
        setGamesOpen(false);
      }
    }
    if (gamesOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [gamesOpen]);

  const visibleGameItems = gameItems.filter(g => g.href !== "/emulator" || hasSnesAccess);
  const isGameActive = visibleGameItems.some(g => path.startsWith(g.href));
  // Show back button on any subpage (dynamic routes, /profile/edit, etc.)
  const isSubpage = !TOP_LEVEL.some(r => path === r || (r !== "/" && path === r + "/")) && path !== "/";

  // Show Town/Share whenever signed in on any major section (not just root-level)
  const showTownShare = session && TOWN_SHARE_SECTIONS.some(s => path.startsWith(s));

  const avatar = dbAvatar ?? session?.user?.image ?? `/api/avatar/${session?.user?.id}?v=2`;

  // Long-press on profile avatar → open story recorder (mobile only)
  const avatarTouchStart = () => {
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setStoryRecorderOpen(true);
    }, 500);
  };
  const avatarTouchEnd = (e: React.TouchEvent) => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    if (longPressFired.current) e.preventDefault();
  };
  const avatarTouchMove = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };

  // Shared nav tab renderer for bottom bar
  const BottomTab = ({ href, icon, label, badge, onClick: onTabClick, customIcon }: { href: string; icon?: string; label: string; badge?: number; onClick?: () => void; customIcon?: React.ReactNode }) => {
    const active = path.startsWith(href);
    return (
      <Link href={href}
        onClick={() => { click(); onTabClick?.(); setMoreOpen(false); }}
        style={{
          flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "7px 4px 6px", textDecoration: "none", position: "relative", gap: 3, minHeight: 56,
          color: active ? "var(--accent-purple-bright)" : "var(--text-muted)",
        }}>
        {active && <div style={{ position: "absolute", top: 0, left: "22%", right: "22%", height: 2, background: "var(--accent-purple-bright)", borderRadius: "0 0 3px 3px" }} />}
        {customIcon ? (
          <div style={{ lineHeight: 1 }}>{customIcon}</div>
        ) : (
          <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
        )}
        <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, letterSpacing: 0.2 }}>{label}</span>
        {(badge ?? 0) > 0 && (
          <span style={{ position: "absolute", top: 5, left: "calc(50% + 6px)", background: "#e05555", color: "#fff", borderRadius: 999, minWidth: 15, height: 15, fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>
            {(badge ?? 0) > 99 ? "99+" : badge}
          </span>
        )}
      </Link>
    );
  };

  // Profile avatar icon for bottom tab
  const ProfileAvatarIcon = () => (
    <img
      src={avatar}
      alt="profile"
      onError={e => { (e.currentTarget as HTMLImageElement).src = `/api/avatar/${session?.user?.id}?v=2`; (e.currentTarget as HTMLImageElement).onerror = null; }}
      style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover", border: "1.5px solid var(--border-bright)", display: "block" }}
    />
  );

  // Friends dual-avatar icon for bottom tab
  const FriendsAvatarIcon = () => (
    <div style={{ position: "relative", width: 30, height: 22, flexShrink: 0 }}>
      {/* User avatar on left */}
      <img
        src={avatar}
        alt="you"
        onError={e => { (e.currentTarget as HTMLImageElement).src = `/api/avatar/${session?.user?.id}?v=2`; (e.currentTarget as HTMLImageElement).onerror = null; }}
        style={{ width: 18, height: 18, borderRadius: "50%", objectFit: "cover", border: "1.5px solid var(--border-bright)", position: "absolute", left: 0, top: 2, zIndex: 2 }}
      />
      {/* First friend's avatar on right */}
      {firstFriendAvatar ? (
        <img
          src={firstFriendAvatar}
          alt="friend"
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          style={{ width: 18, height: 18, borderRadius: "50%", objectFit: "cover", border: "1.5px solid rgba(255,255,255,0.25)", position: "absolute", left: 12, top: 2, zIndex: 1 }}
        />
      ) : (
        <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "1.5px solid rgba(255,255,255,0.25)", position: "absolute", left: 12, top: 2, zIndex: 1 }} />
      )}
    </div>
  );

  return (
    <header style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 1000 }}>

      {/* ── DESKTOP header row ───────────────────────────────────────────────── */}
      <div className="desktop-only" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 12px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        {isSubpage && (
          <button onClick={() => router.back()} title="Go back"
            style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 10px", fontSize: 16, color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0, lineHeight: 1 }}>
            ←
          </button>
        )}
        <Link href="/profile" style={{ textDecoration: "none", flexShrink: 0 }}>
          <img
            src="/RYFTLOGO.png"
            alt="RYFT"
            style={{ height: 34, width: 34, display: "block", filter: "drop-shadow(0 0 6px rgba(0,229,255,0.5)) drop-shadow(0 0 12px rgba(139,60,247,0.35))" }}
          />
        </Link>
        <nav className="nav-links-desktop" style={{ display: "flex", gap: 2, alignItems: "center", flex: 1, justifyContent: "center" }}>
          {navItems.map(({ href, label, short }) => {
            const active = path.startsWith(href);
            const isMessages = href === "/messages";
            const isChronicle = href === "/chronicle";
            const isFriends = href === "/friends";
            return (
              <Link key={href} href={href} className="nav-item-mobile"
                onClick={() => { click(); if (isMessages) setUnreadMessages(0); if (isChronicle) setChronicleUnread(0); }}
                style={{ position: "relative", padding: "6px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none", color: active ? "var(--accent-purple-bright)" : "var(--text-secondary)", background: active ? "rgba(124,92,191,0.15)" : "transparent", border: active ? "1px solid rgba(124,92,191,0.3)" : "1px solid transparent", transition: "all 0.15s ease", whiteSpace: "nowrap" }}>
                <span className="nav-link-label">{label}</span>
                <span className="nav-link-short">{short}</span>
                {isFriends && pendingCount > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: "#e05555", color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{pendingCount}</span>}
                {isMessages && unreadMessages > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: "#e05555", color: "#fff", borderRadius: "50%", minWidth: 16, height: 16, padding: "0 3px", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{unreadMessages > 99 ? "99+" : unreadMessages}</span>}
                {isChronicle && chronicleUnread > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: "#e05555", color: "#fff", borderRadius: "50%", minWidth: 16, height: 16, padding: "0 3px", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{chronicleUnread > 99 ? "99+" : chronicleUnread}</span>}
              </Link>
            );
          })}
          <div ref={gamesRef} style={{ position: "relative" }}>
            <button onClick={() => { setGamesOpen(o => !o); swoosh(); }} className="nav-item-mobile"
              style={{ padding: "6px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600, color: isGameActive ? "var(--accent-purple-bright)" : "var(--text-secondary)", background: isGameActive ? "rgba(124,92,191,0.15)" : gamesOpen ? "rgba(124,92,191,0.1)" : "transparent", border: isGameActive ? "1px solid rgba(124,92,191,0.3)" : "1px solid transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, transition: "all 0.15s ease", whiteSpace: "nowrap" }}>
              <span className="nav-link-label">🕹️ Games</span>
              <span className="nav-link-short">🕹️</span>
              <span style={{ fontSize: 9, opacity: 0.7, transition: "transform 0.15s ease", display: "inline-block", transform: gamesOpen ? "rotate(180deg)" : "none" }}>▼</span>
            </button>
            {gamesOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 12, padding: 8, minWidth: 200, boxShadow: "0 12px 40px rgba(0,0,0,0.5)", zIndex: 10000 }}>
                {visibleGameItems.map(g => {
                  const active = path.startsWith(g.href);
                  return (
                    <Link key={g.href} href={g.href} onClick={() => setGamesOpen(false)}
                      style={{ display: "flex", flexDirection: "column", padding: "10px 12px", borderRadius: 8, textDecoration: "none", background: active ? "rgba(124,92,191,0.15)" : "transparent", color: active ? "var(--accent-purple-bright)" : "var(--text-primary)", transition: "background 0.1s ease" }}
                      onMouseEnter={e => (e.currentTarget.style.background = active ? "rgba(124,92,191,0.2)" : "rgba(255,255,255,0.05)")}
                      onMouseLeave={e => (e.currentTarget.style.background = active ? "rgba(124,92,191,0.15)" : "transparent")}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{g.label}</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{g.desc}</span>
                    </Link>
                  );
                })}
                <div style={{ borderTop: "1px solid var(--border)", margin: "6px 0" }} />
                <div style={{ padding: "6px 12px", fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>Challenge friends in any game ⚔️</div>
              </div>
            )}
          </div>
        </nav>
        {session ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <Link href="/profile" style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
              <div style={{ position: "relative" }}>
                <img src={avatar} alt="avatar" onError={e => { (e.currentTarget as HTMLImageElement).src = `/api/avatar/${session.user?.id}?v=2`; (e.currentTarget as HTMLImageElement).onerror = null; }} style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid var(--border-bright)", display: "block" }} />
                <span className="status-dot online" style={{ position: "absolute", bottom: 0, right: 0, width: 8, height: 8, border: "2px solid var(--bg-surface)" }} />
              </div>
              <span className="nav-username" style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>@{session.user?.name?.toLowerCase().replace(/\s/g, "") ?? "you"}</span>
            </Link>
            <button onClick={() => signOut()} style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)", borderRadius: 7, padding: "4px 8px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>Out</button>
          </div>
        ) : (
          <button onClick={() => router.push("/signin")} style={{ background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>Sign In</button>
        )}
      </div>

      {/* ── MOBILE header row ────────────────────────────────────────────────── */}
      <div className="mobile-only" style={{ height: 52, alignItems: "center", justifyContent: "space-between", padding: "0 12px" }}>

        {/* Left anchor: back button on subpages, else fixed-width spacer */}
        <div style={{ width: 40, flexShrink: 0 }}>
          {isSubpage && (
            <button onClick={() => router.back()}
              style={{ background: "transparent", border: "none", fontSize: 20, color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", minWidth: 40, minHeight: 44, padding: 0 }}>
              ←
            </button>
          )}
        </div>

        {/* Center cluster: [Town] · ryft · [Share] — show on all major sections when signed in */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {showTownShare && (
            <Link href="/town" onClick={() => click()}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, textDecoration: "none", padding: "4px 6px", borderRadius: 8, color: (path.startsWith("/moonhaven") || path.startsWith("/town")) ? "var(--accent-purple-bright)" : "var(--text-muted)", background: (path.startsWith("/moonhaven") || path.startsWith("/town")) ? "rgba(124,92,191,0.12)" : "transparent" }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>🏘️</span>
              <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.3 }}>Town</span>
            </Link>
          )}

          <Link href={session ? "/profile" : "/"} style={{ textDecoration: "none" }}>
            <img
              src="/RYFTLOGO.png"
              alt="RYFT"
              style={{ height: 34, width: 34, display: "block", filter: "drop-shadow(0 0 6px rgba(0,229,255,0.5)) drop-shadow(0 0 12px rgba(139,60,247,0.35))" }}
            />
          </Link>

          {showTownShare && (
            <Link href="/feed" onClick={() => click()}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, textDecoration: "none", padding: "4px 6px", borderRadius: 8, color: path.startsWith("/feed") ? "var(--accent-purple-bright)" : "var(--text-muted)", background: path.startsWith("/feed") ? "rgba(124,92,191,0.12)" : "transparent" }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>✨</span>
              <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.3 }}>Share</span>
            </Link>
          )}
        </div>

        {/* Right anchor: avatar when signed in, Sign In button when not */}
        <div style={{ width: 40, flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>
          {session ? (
            <div
              onTouchStart={avatarTouchStart}
              onTouchEnd={avatarTouchEnd}
              onTouchMove={avatarTouchMove}
              onClick={() => { if (!longPressFired.current) router.push("/profile"); }}
              style={{ cursor: "pointer", WebkitUserSelect: "none", userSelect: "none" }}
            >
              <div style={{ position: "relative" }}>
                <img src={avatar} alt="avatar" onError={e => { (e.currentTarget as HTMLImageElement).src = `/api/avatar/${session.user?.id}?v=2`; (e.currentTarget as HTMLImageElement).onerror = null; }} style={{ width: 30, height: 30, borderRadius: "50%", border: "2px solid var(--border-bright)", display: "block" }} />
                <span className="status-dot online" style={{ position: "absolute", bottom: 0, right: 0, width: 7, height: 7, border: "2px solid var(--bg-surface)" }} />
              </div>
            </div>
          ) : (
            <button onClick={() => router.push("/signin")} style={{ background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))", color: "#fff", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>Sign In</button>
          )}
        </div>
      </div>

      {/* ── Mobile bottom tab bar: Messages · Profile · Friends · More ────── */}
      <div className="mobile-bottom-nav" style={{
        display: "none",
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "rgba(13,15,20,0.97)", backdropFilter: "blur(12px)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        zIndex: 200, alignItems: "stretch",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}>
        <BottomTab href="/messages" icon="💬" label="Messages" badge={unreadMessages} onClick={() => setUnreadMessages(0)} />
        {/* Profile tab — long-press opens story recorder on mobile */}
        <div
          onTouchStart={avatarTouchStart}
          onTouchEnd={avatarTouchEnd}
          onTouchMove={avatarTouchMove}
          onClick={() => { if (!longPressFired.current) { click(); router.push("/profile"); } }}
          style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: "7px 4px 6px", cursor: "pointer", position: "relative", gap: 3, minHeight: 56,
            color: path.startsWith("/profile") ? "var(--accent-purple-bright)" : "var(--text-muted)",
            WebkitUserSelect: "none", userSelect: "none",
          }}>
          {path.startsWith("/profile") && <div style={{ position: "absolute", top: 0, left: "22%", right: "22%", height: 2, background: "var(--accent-purple-bright)", borderRadius: "0 0 3px 3px" }} />}
          <div style={{ lineHeight: 1 }}>{session ? <ProfileAvatarIcon /> : <span style={{ fontSize: 22 }}>👤</span>}</div>
          <span style={{ fontSize: 10, fontWeight: path.startsWith("/profile") ? 700 : 500, letterSpacing: 0.2 }}>Profile</span>
        </div>
        <BottomTab href="/friends" label="Friends" badge={pendingCount} customIcon={session ? <FriendsAvatarIcon /> : undefined} icon={session ? undefined : "👥"} />
        <button onClick={() => { setMoreOpen(o => !o); swoosh(); }}
          style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: "7px 4px 6px", background: "transparent", border: "none", cursor: "pointer", position: "relative",
            color: moreOpen ? "var(--accent-purple-bright)" : "var(--text-muted)", gap: 3, minHeight: 56,
          }}>
          {moreOpen && <div style={{ position: "absolute", top: 0, left: "22%", right: "22%", height: 2, background: "var(--accent-purple-bright)", borderRadius: "0 0 3px 3px" }} />}
          <span style={{ fontSize: 22, lineHeight: 1 }}>{moreOpen ? "✕" : "☰"}</span>
          <span style={{ fontSize: 10, fontWeight: moreOpen ? 700 : 500, letterSpacing: 0.2 }}>More</span>
        </button>
      </div>

      {/* ── More drawer ──────────────────────────────────────────────────────── */}
      {moreOpen && (
        <div
          className="mobile-bottom-nav"
          onTouchStart={e => { touchStartYRef.current = e.touches[0].clientY; }}
          onTouchEnd={e => {
            const delta = e.changedTouches[0].clientY - touchStartYRef.current;
            if (delta > 60) { setMoreOpen(false); swoosh(); }
          }}
          style={{
            display: "none",
            position: "fixed", bottom: "calc(56px + env(safe-area-inset-bottom))", left: 0, right: 0,
            background: "rgba(13,15,20,0.98)", backdropFilter: "blur(20px)",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            zIndex: 199, flexDirection: "column", padding: "20px 16px 12px",
            boxShadow: "0 -16px 48px rgba(0,0,0,0.7)",
            borderRadius: "20px 20px 0 0",
          }}>
          {/* Handle bar */}
          <div style={{ width: 36, height: 3, background: "rgba(255,255,255,0.15)", borderRadius: 99, margin: "0 auto 16px" }} />
          <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12, fontWeight: 700 }}>Explore</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
            {[
              { href: "/chronicle", icon: "📜", label: "Chronicle", badge: chronicleUnread },
              { href: "/draw", icon: "🎨", label: "Draw" },
              { href: "/stremio", icon: "🎬", label: "Stream" },
            ].map(item => {
              const active = path.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href}
                  onClick={() => { click(); setMoreOpen(false); if (item.href === "/chronicle") setChronicleUnread(0); }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "14px 8px", borderRadius: 16, textDecoration: "none", position: "relative", background: active ? "rgba(124,92,191,0.18)" : "rgba(255,255,255,0.04)", border: `1px solid ${active ? "rgba(124,92,191,0.35)" : "rgba(255,255,255,0.07)"}`, color: active ? "var(--accent-purple-bright)" : "var(--text-secondary)" }}>
                  <span style={{ fontSize: 26 }}>{item.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>{item.label}</span>
                  {"badge" in item && (item.badge as number) > 0 && (
                    <span style={{ position: "absolute", top: 5, right: 7, background: "#e05555", color: "#fff", borderRadius: 999, minWidth: 15, height: 15, fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{(item.badge as number) > 99 ? "99+" : item.badge}</span>
                  )}
                </Link>
              );
            })}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12, fontWeight: 700 }}>Games</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
            {visibleGameItems.map(g => {
              const active = path.startsWith(g.href);
              return (
                <Link key={g.href} href={g.href} onClick={() => { click(); setMoreOpen(false); }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "14px 8px", borderRadius: 16, textDecoration: "none", background: active ? "rgba(124,92,191,0.18)" : "rgba(255,255,255,0.04)", border: `1px solid ${active ? "rgba(124,92,191,0.35)" : "rgba(255,255,255,0.07)"}`, color: active ? "var(--accent-purple-bright)" : "var(--text-secondary)" }}>
                  <span style={{ fontSize: 24 }}>{g.label.split(" ")[0]}</span>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>{g.label.replace(/^[^\s]+\s/, "")}</span>
                </Link>
              );
            })}
          </div>
          {session && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
              <img src={avatar} style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--border-bright)" }} alt="" />
              <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600, flex: 1 }}>@{session.user?.name?.toLowerCase().replace(/\s/g, "") ?? "you"}</span>
              <Link href="/messages" onClick={() => { click(); setMoreOpen(false); }}
                style={{ background: "rgba(124,92,191,0.15)", border: "1px solid rgba(124,92,191,0.3)", borderRadius: 10, padding: "7px 12px", color: "var(--accent-purple-bright)", fontSize: 12, fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                🎤 Voice
              </Link>
              <button onClick={() => signOut()} style={{ background: "rgba(255,80,80,0.12)", border: "1px solid rgba(255,80,80,0.25)", borderRadius: 10, padding: "7px 16px", color: "#f87171", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Sign Out</button>
            </div>
          )}
        </div>
      )}

      {/* Backdrop */}
      {moreOpen && (
        <div className="mobile-bottom-nav" style={{ display: "none", position: "fixed", inset: 0, bottom: "calc(56px + env(safe-area-inset-bottom))", background: "rgba(0,0,0,0.5)", zIndex: 198 }} onClick={() => setMoreOpen(false)} />
      )}

      {/* Story recorder — opened by long-pressing profile avatar on mobile */}
      {storyRecorderOpen && session && (
        <StoryRecorder
          onClose={() => setStoryRecorderOpen(false)}
          onUploaded={() => setStoryRecorderOpen(false)}
        />
      )}
    </header>
  );
}
