"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "@/lib/use-session";
import { useRouter } from "next/navigation";
import { usePortal } from "@/app/components/PortalContext";
import { useVoice } from "@/app/components/VoiceWidget";
import Link from "next/link";
import BonfireSession from "./BonfireSession";
import {
  type StremioAuth,
  type StremioAddon,
  type CatalogItem,
  type MetaDetail,
  type ClassifiedStream,
  stremioLogin,
  getStoredAuth,
  clearAuth,
  getUserAddons,
  fetchCatalog,
  searchCatalog,
  fetchMeta,
  fetchStreams,
  buildTorrentUrl,
  isStremioDesktopRunning,
} from "./stremio-auth";

type View = "connect" | "browse" | "detail" | "player";

interface Props {
  sessionUserId: string | null;
  sessionUsername: string | null;
}

// ── Flavor text ───────────────────────────────────────────────────────────────

const LOADING_PHRASES = [
  "Consulting the archives...",
  "Summoning streams...",
  "The Vault opens...",
  "Searching the realms...",
  "Peering into the abyss...",
];

function randomPhrase() {
  return LOADING_PHRASES[Math.floor(Math.random() * LOADING_PHRASES.length)];
}

function soulScore(imdbRating?: string): number {
  const r = parseFloat(imdbRating ?? "0");
  return Math.round((r / 2) * 10) / 10; // 0-5 scale
}

function renderStars(rating: number) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.3;
  const stars: string[] = [];
  for (let i = 0; i < full; i++) stars.push("★");
  if (half) stars.push("✦");
  while (stars.length < 5) stars.push("☆");
  return stars.join("");
}

const QUALITY_BADGES: Record<string, { color: string; icon: string }> = {
  "4K": { color: "#d4a942", icon: "🔥" },
  "1080p": { color: "#a0a0a0", icon: "⚔️" },
  "720p": { color: "#8a6d2b", icon: "🛡️" },
  "480p": { color: "#6a5a4a", icon: "📜" },
  "Unknown": { color: "#4a4a4a", icon: "❓" },
};

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function SoulCinema({ sessionUserId, sessionUsername }: Props) {
  const { status } = useSession();
  const { setPortal } = usePortal();
  const router = useRouter();
  const voice = useVoice();

  // Stremio auth
  const [stremioAuth, setStremioAuth] = useState<StremioAuth | null>(null);
  const [addons, setAddons] = useState<StremioAddon[]>([]);
  const [isGuest, setIsGuest] = useState(false);

  // Navigation
  const [view, setView] = useState<View>("connect");
  const [contentType, setContentType] = useState<"movie" | "series">("movie");

  // Browse
  const [catalogs, setCatalogs] = useState<Record<string, CatalogItem[]>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CatalogItem[] | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Detail
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [meta, setMeta] = useState<MetaDetail | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);

  // Streams
  const [streams, setStreams] = useState<ClassifiedStream[]>([]);
  const [streamsLoading, setStreamsLoading] = useState(false);
  const [streamsRequested, setStreamsRequested] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(1);

  // Player
  const [playerUrl, setPlayerUrl] = useState("");
  const [playerStream, setPlayerStream] = useState<ClassifiedStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Bonfire
  const [bonfireOpen, setBonfireOpen] = useState(false);

  // Connect form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [connectError, setConnectError] = useState("");
  const [connectLoading, setConnectLoading] = useState(false);

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    setPortal("greatsouls");
  }, [setPortal]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/greatsouls");
  }, [status, router]);

  // Try to restore Stremio auth from localStorage
  useEffect(() => {
    const stored = getStoredAuth();
    if (stored) {
      setStremioAuth(stored);
      setView("browse");
      getUserAddons(stored.authKey).then(setAddons).catch(() => {});
    }
  }, []);

  // Load catalogs when switching to browse
  useEffect(() => {
    if (view !== "browse") return;
    if (catalogs[`${contentType}_top`]) return; // already loaded

    setBrowseLoading(true);
    Promise.all([
      fetchCatalog(contentType, "top").then(items => ({ key: `${contentType}_top`, items })),
      fetchCatalog(contentType, "year").then(items => ({ key: `${contentType}_year`, items })),
    ]).then(results => {
      setCatalogs(prev => {
        const next = { ...prev };
        for (const r of results) next[r.key] = r.items;
        return next;
      });
    }).finally(() => setBrowseLoading(false));
  }, [view, contentType, catalogs]);

  // ── Search ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      setBrowseLoading(true);
      const results = await searchCatalog(contentType, searchQuery.trim());
      setSearchResults(results);
      setBrowseLoading(false);
    }, 400);
    return () => clearTimeout(searchTimerRef.current);
  }, [searchQuery, contentType]);

  // ── Detail ────────────────────────────────────────────────────────────────

  const openDetail = useCallback(async (item: CatalogItem) => {
    setSelectedItem(item);
    setView("detail");
    setMetaLoading(true);
    setStreams([]);
    setStreamsRequested(false);
    setSelectedSeason(1);
    const m = await fetchMeta(item.type, item.id);
    setMeta(m);
    setMetaLoading(false);
  }, []);

  const summonStreams = useCallback(async (videoId?: string) => {
    if (!stremioAuth || addons.length === 0) return;
    setStreamsLoading(true);
    setStreamsRequested(true);
    const id = videoId ?? selectedItem?.id ?? "";
    const type = selectedItem?.type ?? "movie";
    const result = await fetchStreams(addons, type, id);
    setStreams(result);
    setStreamsLoading(false);
  }, [stremioAuth, addons, selectedItem]);

  // ── Play ──────────────────────────────────────────────────────────────────

  const playStream = useCallback(async (stream: ClassifiedStream) => {
    setPlayerStream(stream);
    if (stream.streamType === "http" && stream.url) {
      setPlayerUrl(stream.url);
      setView("player");
    } else if (stream.streamType === "torrent" && stream.infoHash) {
      const running = await isStremioDesktopRunning();
      if (running) {
        setPlayerUrl(buildTorrentUrl(stream.infoHash, stream.fileIdx));
        setView("player");
      } else {
        // Open in Stremio app
        const stremioLink = `stremio://detail/${selectedItem?.type ?? "movie"}/${selectedItem?.id ?? ""}`;
        window.open(stremioLink, "_blank");
      }
    }
  }, [selectedItem]);

  // ── Connect Handler ───────────────────────────────────────────────────────

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setConnectLoading(true);
    setConnectError("");
    try {
      const auth = await stremioLogin(email.trim(), password);
      setStremioAuth(auth);
      const userAddons = await getUserAddons(auth.authKey);
      setAddons(userAddons);
      setView("browse");
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : String(err ?? "Login failed"));
    } finally {
      setConnectLoading(false);
    }
  }

  function enterGuest() {
    setIsGuest(true);
    setView("browse");
  }

  function disconnect() {
    clearAuth();
    setStremioAuth(null);
    setAddons([]);
    setIsGuest(false);
    setView("connect");
  }

  // ── Loading gate ──────────────────────────────────────────────────────────

  if (status !== "authenticated") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0d0d0d" }}>
        <div style={{ color: "#d4a942", fontFamily: "'Cinzel', serif", fontSize: 20 }}>Loading...</div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div style={{ minHeight: "100vh", background: "#0d0d0d", color: "#e8dcc8" }}>
      <style>{`
        @keyframes gsEmberFloat {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.4; }
          50% { transform: translateY(-20px) scale(1.3); opacity: 0.7; }
        }
        @keyframes soulPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .sc-poster:hover {
          border-color: #d4a942 !important;
          transform: translateY(-4px) !important;
          box-shadow: 0 8px 32px rgba(212,169,66,0.2), 0 0 0 1px rgba(212,169,66,0.3) !important;
        }
        .sc-poster:active { transform: translateY(-2px) scale(0.98) !important; }
        .sc-stream:hover {
          border-color: #d4a942 !important;
          background: #222222 !important;
        }
        .sc-pill:hover { background: rgba(212,169,66,0.15) !important; }
        .sc-row { display: flex; gap: 12px; overflow-x: auto; padding: 4px 0 12px; scrollbar-width: none; }
        .sc-row::-webkit-scrollbar { display: none; }
        @media (max-width: 640px) {
          .sc-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .sc-detail-hero { flex-direction: column !important; }
          .sc-detail-poster { width: 140px !important; }
        }
        @media (min-width: 641px) and (max-width: 1023px) {
          .sc-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (min-width: 1024px) {
          .sc-grid { grid-template-columns: repeat(5, 1fr) !important; }
        }
      `}</style>

      {/* Ember particles */}
      {[18, 35, 52, 68, 24, 41, 59, 75].map((left, i) => (
        <div
          key={i}
          style={{
            position: "fixed", width: 4, height: 4, borderRadius: "50%",
            background: "#d4a942", opacity: 0.3,
            left: `${left}%`, bottom: `${12 + i * 3}%`,
            animation: `gsEmberFloat ${3 + (i % 3) * 0.7}s ease-in-out infinite`,
            animationDelay: `${i * 0.4}s`,
            pointerEvents: "none", zIndex: 0,
          }}
        />
      ))}

      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 40,
        display: "flex", alignItems: "center", padding: "10px 16px",
        background: "rgba(13,13,13,0.95)", backdropFilter: "blur(8px)",
        borderBottom: "1px solid #2a2a2a",
      }}>
        <Link href="/greatsouls/hub" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <span style={{ fontSize: 18 }}>🔥</span>
          <span style={{ fontFamily: "'Cinzel', serif", color: "#6a5a4a", fontWeight: 700, fontSize: 13, letterSpacing: "0.08em" }}>
            HUB
          </span>
        </Link>

        <div style={{ width: 1, height: 20, background: "#2a2a2a", margin: "0 12px" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>🎬</span>
          <span style={{ fontFamily: "'Cinzel', serif", color: "#d4a942", fontWeight: 700, fontSize: 15, letterSpacing: "0.1em" }}>
            SOUL CINEMA
          </span>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          {(stremioAuth || isGuest) && (
            <button
              onClick={() => { setView("browse"); setSelectedItem(null); setMeta(null); setStreams([]); }}
              style={{
                background: "none", border: "none", color: "#8a6d2b", fontSize: 12,
                fontWeight: 700, cursor: "pointer", letterSpacing: "0.08em",
              }}
            >
              📖 BROWSE
            </button>
          )}
          {stremioAuth && (
            <button
              onClick={disconnect}
              style={{
                background: "none", border: "none", color: "#6a5a4a", fontSize: 11,
                cursor: "pointer", letterSpacing: "0.05em",
              }}
            >
              DISCONNECT
            </button>
          )}
        </div>
      </nav>

      {/* ── Main Content ───────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px 100px", position: "relative", zIndex: 1 }}>

        {/* ═══ CONNECT VIEW ═══ */}
        {view === "connect" && (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            minHeight: "60vh", animation: "fadeSlideUp 0.4s ease",
          }}>
            <div style={{ fontSize: 64, marginBottom: 20 }}>🎬</div>
            <h1 style={{
              fontFamily: "'Cinzel', serif", color: "#d4a942", fontSize: 32, fontWeight: 700,
              letterSpacing: "0.12em", margin: "0 0 4px", textAlign: "center",
              textShadow: "0 0 30px rgba(212,169,66,0.3)",
            }}>
              SOUL CINEMA
            </h1>
            <p style={{ color: "#6a5a4a", fontSize: 11, letterSpacing: "0.25em", textTransform: "uppercase", margin: "0 0 32px" }}>
              THE VAULT AWAITS
            </p>

            <form onSubmit={handleConnect} style={{
              display: "flex", flexDirection: "column", gap: 12,
              width: "100%", maxWidth: 340, marginBottom: 16,
            }}>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Stremio email"
                style={{
                  width: "100%", padding: "14px 18px", fontSize: 16,
                  background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8,
                  color: "#e8dcc8", outline: "none",
                }}
              />
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                style={{
                  width: "100%", padding: "14px 18px", fontSize: 16,
                  background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8,
                  color: "#e8dcc8", outline: "none",
                }}
              />
              <button
                type="submit"
                disabled={!email.trim() || !password || connectLoading}
                style={{
                  width: "100%", padding: "14px 24px", fontSize: 15, fontWeight: 700,
                  background: (!email.trim() || !password || connectLoading)
                    ? "#2a2a2a"
                    : "linear-gradient(135deg, #d4a942, #8a6d2b)",
                  color: (!email.trim() || !password || connectLoading) ? "#6a5a4a" : "#0d0d0d",
                  border: "1px solid #d4a942", borderRadius: 8,
                  cursor: (!email.trim() || !password || connectLoading) ? "default" : "pointer",
                  fontFamily: "'Cinzel', serif", letterSpacing: "0.1em", textTransform: "uppercase",
                  transition: "all 0.2s",
                }}
              >
                {connectLoading ? "Connecting..." : "Connect Stremio"}
              </button>

              {connectError && (
                <p style={{ color: "#c4531a", fontSize: 13, textAlign: "center", margin: 0 }}>{connectError}</p>
              )}
            </form>

            <button
              onClick={enterGuest}
              style={{
                background: "none", border: "1px solid #2a2a2a", borderRadius: 8,
                padding: "12px 24px", color: "#6a5a4a", fontSize: 13,
                cursor: "pointer", letterSpacing: "0.05em", transition: "all 0.2s",
                width: "100%", maxWidth: 340,
              }}
            >
              Enter as Guest — Browse Only
            </button>

            <p style={{
              color: "#4a4a4a", fontSize: 10, textAlign: "center", margin: "24px 0 0",
              maxWidth: 340, lineHeight: 1.6,
            }}>
              Soul Cinema connects to your Stremio account. Content is provided by your
              configured Stremio addons. Great Souls does not host or distribute any media content.
            </p>
          </div>
        )}

        {/* ═══ BROWSE VIEW ═══ */}
        {view === "browse" && (
          <div style={{ animation: "fadeSlideUp 0.3s ease" }}>
            {/* Search + Type Toggle */}
            <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={contentType === "movie" ? "Search movies..." : "Search series..."}
                style={{
                  flex: 1, minWidth: 200, padding: "12px 16px", fontSize: 16,
                  background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8,
                  color: "#e8dcc8", outline: "none",
                }}
              />
              <div style={{ display: "flex", gap: 4 }}>
                {(["movie", "series"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => { setContentType(t); setSearchQuery(""); setSearchResults(null); }}
                    className="sc-pill"
                    style={{
                      padding: "10px 18px", fontSize: 13, fontWeight: 700,
                      background: contentType === t ? "rgba(212,169,66,0.2)" : "#1a1a1a",
                      border: `1px solid ${contentType === t ? "#d4a942" : "#2a2a2a"}`,
                      borderRadius: 8, color: contentType === t ? "#d4a942" : "#8a6d2b",
                      cursor: "pointer", letterSpacing: "0.05em", textTransform: "uppercase",
                      fontFamily: "'Cinzel', serif", transition: "all 0.15s",
                    }}
                  >
                    {t === "movie" ? "Movies" : "Series"}
                  </button>
                ))}
              </div>
            </div>

            {/* Loading */}
            {browseLoading && (
              <div style={{ textAlign: "center", padding: 40 }}>
                <div style={{
                  color: "#d4a942", fontFamily: "'Cinzel', serif", fontSize: 16,
                  animation: "soulPulse 2s ease-in-out infinite",
                }}>
                  {randomPhrase()}
                </div>
              </div>
            )}

            {/* Search results */}
            {searchResults !== null && !browseLoading && (
              <div>
                <div style={{
                  fontFamily: "'Cinzel', serif", color: "#d4a942", fontSize: 14,
                  letterSpacing: "0.12em", marginBottom: 12, textTransform: "uppercase",
                }}>
                  {searchResults.length > 0 ? `${searchResults.length} results` : "The archives hold no answers..."}
                </div>
                <div className="sc-grid" style={{ display: "grid", gap: 16 }}>
                  {searchResults.map(item => (
                    <PosterCard key={item.id} item={item} onClick={() => openDetail(item)} />
                  ))}
                </div>
              </div>
            )}

            {/* Catalog rows */}
            {searchResults === null && !browseLoading && (
              <>
                <CatalogRow
                  title="Trending"
                  items={catalogs[`${contentType}_top`] ?? []}
                  onSelect={openDetail}
                />
                <CatalogRow
                  title="Recently Added"
                  items={catalogs[`${contentType}_year`] ?? []}
                  onSelect={openDetail}
                />
              </>
            )}

            {/* Guest banner */}
            {isGuest && !stremioAuth && (
              <div style={{
                marginTop: 32, padding: "16px 20px", background: "rgba(212,169,66,0.08)",
                border: "1px solid rgba(212,169,66,0.2)", borderRadius: 12, textAlign: "center",
              }}>
                <p style={{ color: "#d4a942", fontSize: 14, margin: "0 0 8px", fontFamily: "'Cinzel', serif" }}>
                  Connect Stremio to unlock streams
                </p>
                <button
                  onClick={() => setView("connect")}
                  style={{
                    background: "linear-gradient(135deg, #d4a942, #8a6d2b)",
                    color: "#0d0d0d", border: "none", borderRadius: 8,
                    padding: "10px 20px", fontSize: 13, fontWeight: 700,
                    cursor: "pointer", fontFamily: "'Cinzel', serif",
                    letterSpacing: "0.08em", textTransform: "uppercase",
                  }}
                >
                  Connect Account
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══ DETAIL VIEW ═══ */}
        {view === "detail" && selectedItem && (
          <div style={{ animation: "fadeSlideUp 0.3s ease" }}>
            {/* Back */}
            <button
              onClick={() => { setView("browse"); setSelectedItem(null); setMeta(null); setStreams([]); }}
              style={{
                background: "none", border: "none", color: "#8a6d2b", fontSize: 14,
                cursor: "pointer", padding: "8px 0", marginBottom: 16,
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              ← Back to browse
            </button>

            {metaLoading ? (
              <div style={{ textAlign: "center", padding: 60 }}>
                <div style={{ color: "#d4a942", fontFamily: "'Cinzel', serif", fontSize: 16, animation: "soulPulse 2s ease-in-out infinite" }}>
                  {randomPhrase()}
                </div>
              </div>
            ) : meta ? (
              <>
                {/* Hero */}
                <div style={{
                  position: "relative", borderRadius: 16, overflow: "hidden",
                  marginBottom: 24, background: "#1a1a1a",
                }}>
                  {meta.background && (
                    <div style={{
                      position: "absolute", inset: 0,
                      backgroundImage: `url(${meta.background})`,
                      backgroundSize: "cover", backgroundPosition: "center",
                      opacity: 0.3, filter: "blur(2px)",
                    }} />
                  )}
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, #0d0d0d 0%, transparent 60%)" }} />

                  <div className="sc-detail-hero" style={{
                    position: "relative", display: "flex", gap: 24, padding: 24, alignItems: "flex-end",
                  }}>
                    {meta.poster && (
                      <img
                        src={meta.poster}
                        alt=""
                        className="sc-detail-poster"
                        style={{ width: 180, borderRadius: 12, border: "2px solid #2a2a2a", flexShrink: 0 }}
                      />
                    )}
                    <div style={{ flex: 1 }}>
                      <h2 style={{
                        fontFamily: "'Cinzel', serif", color: "#d4a942", fontSize: 28,
                        fontWeight: 700, margin: "0 0 8px", lineHeight: 1.2,
                        textShadow: "0 2px 8px rgba(0,0,0,0.8)",
                      }}>
                        {meta.name}
                      </h2>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10, alignItems: "center" }}>
                        {meta.year && <span style={{ color: "#a89878", fontSize: 14 }}>{meta.year}</span>}
                        {meta.runtime && <span style={{ color: "#6a5a4a", fontSize: 13 }}>{meta.runtime}</span>}
                        {meta.imdbRating && (
                          <span style={{ color: "#d4a942", fontSize: 14, letterSpacing: "0.05em" }}>
                            {renderStars(soulScore(meta.imdbRating))} {soulScore(meta.imdbRating)}/5
                          </span>
                        )}
                      </div>

                      {meta.genres && meta.genres.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                          {meta.genres.map(g => (
                            <span key={g} style={{
                              padding: "3px 10px", fontSize: 11, borderRadius: 6,
                              border: "1px solid #d4a942", color: "#d4a942",
                              letterSpacing: "0.05em", textTransform: "uppercase",
                            }}>
                              {g}
                            </span>
                          ))}
                        </div>
                      )}

                      {meta.description && (
                        <p style={{ color: "#a89878", fontSize: 14, lineHeight: 1.6, margin: 0, maxWidth: 600 }}>
                          {meta.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Series: season/episode picker */}
                {meta.type === "series" && meta.videos && meta.videos.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                      {Array.from(new Set(meta.videos.map(v => v.season))).filter(s => s > 0).sort((a, b) => a - b).map(s => (
                        <button
                          key={s}
                          onClick={() => setSelectedSeason(s)}
                          style={{
                            padding: "8px 16px", fontSize: 13, fontWeight: 700,
                            background: selectedSeason === s ? "rgba(212,169,66,0.2)" : "#1a1a1a",
                            border: `1px solid ${selectedSeason === s ? "#d4a942" : "#2a2a2a"}`,
                            borderRadius: 8, color: selectedSeason === s ? "#d4a942" : "#8a6d2b",
                            cursor: "pointer", fontFamily: "'Cinzel', serif",
                          }}
                        >
                          S{s}
                        </button>
                      ))}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {meta.videos
                        .filter(v => v.season === selectedSeason)
                        .sort((a, b) => a.episode - b.episode)
                        .map(ep => (
                          <button
                            key={ep.id}
                            onClick={() => stremioAuth ? summonStreams(ep.id) : undefined}
                            className="sc-stream"
                            style={{
                              display: "flex", alignItems: "center", gap: 12,
                              padding: "12px 16px", background: "#1a1a1a",
                              border: "1px solid #2a2a2a", borderRadius: 10,
                              color: "#e8dcc8", cursor: stremioAuth ? "pointer" : "default",
                              textAlign: "left", transition: "all 0.15s",
                              opacity: stremioAuth ? 1 : 0.5,
                            }}
                          >
                            <span style={{ color: "#d4a942", fontWeight: 700, fontSize: 14, minWidth: 32 }}>
                              E{ep.episode}
                            </span>
                            <span style={{ fontSize: 14 }}>{ep.title || `Episode ${ep.episode}`}</span>
                            {stremioAuth && (
                              <span style={{ marginLeft: "auto", color: "#8a6d2b", fontSize: 12 }}>
                                Summon Streams →
                              </span>
                            )}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {/* Summon Streams button (movies) */}
                {meta.type !== "series" && (
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
                    {stremioAuth ? (
                      <button
                        onClick={() => summonStreams()}
                        disabled={streamsLoading}
                        style={{
                          padding: "14px 28px", fontSize: 15, fontWeight: 700,
                          background: streamsLoading ? "#2a2a2a" : "linear-gradient(135deg, #d4a942, #8a6d2b)",
                          color: streamsLoading ? "#6a5a4a" : "#0d0d0d",
                          border: "1px solid #d4a942", borderRadius: 10,
                          cursor: streamsLoading ? "default" : "pointer",
                          fontFamily: "'Cinzel', serif", letterSpacing: "0.08em", textTransform: "uppercase",
                          transition: "all 0.2s",
                        }}
                      >
                        {streamsLoading ? "Summoning..." : "⚔️ Summon Streams"}
                      </button>
                    ) : (
                      <div style={{
                        padding: "14px 28px", fontSize: 14, color: "#6a5a4a",
                        border: "1px dashed #2a2a2a", borderRadius: 10, textAlign: "center",
                      }}>
                        Connect Stremio to summon streams
                      </div>
                    )}
                  </div>
                )}

                {/* Streams list */}
                {streamsLoading && (
                  <div style={{ textAlign: "center", padding: 32 }}>
                    <div style={{ color: "#d4a942", fontFamily: "'Cinzel', serif", fontSize: 15, animation: "soulPulse 2s ease-in-out infinite" }}>
                      Summoning streams...
                    </div>
                  </div>
                )}

                {!streamsLoading && streams.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{
                      fontFamily: "'Cinzel', serif", color: "#d4a942", fontSize: 13,
                      letterSpacing: "0.12em", marginBottom: 4, textTransform: "uppercase",
                    }}>
                      {streams.length} streams found
                    </div>
                    {streams.map((s, i) => {
                      const badge = QUALITY_BADGES[s.quality] ?? QUALITY_BADGES["Unknown"];
                      return (
                        <button
                          key={i}
                          onClick={() => playStream(s)}
                          className="sc-stream"
                          style={{
                            display: "flex", alignItems: "center", gap: 12,
                            padding: "14px 16px", background: "#1a1a1a",
                            border: "1px solid #2a2a2a", borderRadius: 10,
                            color: "#e8dcc8", cursor: "pointer", textAlign: "left",
                            transition: "all 0.15s", width: "100%",
                          }}
                        >
                          <span style={{ fontSize: 18 }}>
                            {s.streamType === "http" ? "🌐" : s.streamType === "torrent" ? "🧲" : "🔗"}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {s.title || s.name || s.addonName}
                            </div>
                            <div style={{ fontSize: 11, color: "#6a5a4a", marginTop: 2 }}>
                              {s.addonName}
                              {s.streamType === "torrent" && " — Requires Stremio Desktop"}
                            </div>
                          </div>
                          <span style={{
                            padding: "4px 10px", fontSize: 11, fontWeight: 700,
                            borderRadius: 6, border: `1px solid ${badge.color}`, color: badge.color,
                            letterSpacing: "0.05em", whiteSpace: "nowrap",
                          }}>
                            {badge.icon} {s.quality}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {!streamsLoading && streams.length === 0 && streamsRequested && (
                  <div style={{
                    padding: "24px 20px", background: "rgba(212,169,66,0.06)",
                    border: "1px solid rgba(212,169,66,0.15)", borderRadius: 12,
                    textAlign: "center",
                  }}>
                    <p style={{ color: "#d4a942", fontFamily: "'Cinzel', serif", fontSize: 15, margin: "0 0 6px" }}>
                      The archives hold no streams
                    </p>
                    <p style={{ color: "#6a5a4a", fontSize: 12, margin: 0 }}>
                      Your addons returned no results for this title. It may not be available yet, or you may need more stream addons configured in Stremio.
                    </p>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        {/* ═══ PLAYER VIEW ═══ */}
        {view === "player" && playerUrl && (
          <div style={{ animation: "fadeSlideUp 0.3s ease" }}>
            <button
              onClick={() => { setView("detail"); setPlayerUrl(""); }}
              style={{
                background: "none", border: "none", color: "#8a6d2b", fontSize: 14,
                cursor: "pointer", padding: "8px 0", marginBottom: 12,
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              ← Back
            </button>

            {playerStream && (
              <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: "'Cinzel', serif", color: "#d4a942", fontSize: 16, fontWeight: 700 }}>
                  {selectedItem?.name}
                </span>
                {playerStream.quality !== "Unknown" && (
                  <span style={{
                    padding: "3px 8px", fontSize: 10, fontWeight: 700,
                    borderRadius: 4, border: `1px solid ${QUALITY_BADGES[playerStream.quality]?.color ?? "#4a4a4a"}`,
                    color: QUALITY_BADGES[playerStream.quality]?.color ?? "#4a4a4a",
                  }}>
                    {playerStream.quality}
                  </span>
                )}
              </div>
            )}

            {/* Video player */}
            <div style={{
              position: "relative", borderRadius: 16, overflow: "hidden",
              background: "#000", border: "1px solid #2a2a2a",
              aspectRatio: "16/9", width: "100%",
            }}>
              <video
                ref={videoRef}
                src={playerUrl}
                controls
                autoPlay
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
                onError={() => {
                  // If video fails, it might be a CORS or codec issue
                }}
              />
            </div>

            {/* Voice chat controls */}
            <div style={{
              display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap",
            }}>
              <button
                onClick={() => setBonfireOpen(true)}
                style={{
                  padding: "12px 20px", fontSize: 13, fontWeight: 700,
                  background: "rgba(212,169,66,0.15)",
                  border: "1px solid #d4a942",
                  borderRadius: 10, color: "#d4a942",
                  cursor: "pointer", fontFamily: "'Cinzel', serif",
                  letterSpacing: "0.06em", textTransform: "uppercase",
                }}
              >
                🔥 Light the Bonfire
              </button>
              <button
                onClick={() => {
                  if (voice.isInVoice) {
                    voice.leaveRoom();
                  } else {
                    voice.joinRoom(`cinema-solo-${sessionUserId}`, "🎬 Soul Cinema");
                  }
                }}
                style={{
                  padding: "12px 20px", fontSize: 13, fontWeight: 700,
                  background: voice.isInVoice ? "rgba(239,68,68,0.2)" : "#1a1a1a",
                  border: `1px solid ${voice.isInVoice ? "#ef4444" : "#2a2a2a"}`,
                  borderRadius: 10, color: voice.isInVoice ? "#ef4444" : "#8a6d2b",
                  cursor: "pointer", letterSpacing: "0.06em",
                }}
              >
                {voice.isInVoice ? "🔇 Leave Voice" : "🎙️ Voice Chat"}
              </button>
            </div>

            <p style={{
              color: "#4a4a4a", fontSize: 10, margin: "16px 0 0", lineHeight: 1.5,
            }}>
              Content provided by your Stremio addons. Great Souls does not host or distribute any media.
            </p>
          </div>
        )}

      </main>

      {/* Bonfire overlay */}
      {bonfireOpen && sessionUserId && sessionUsername && playerUrl && (
        <BonfireSession
          sessionUserId={sessionUserId}
          sessionUsername={sessionUsername}
          movieTitle={selectedItem?.name}
          streamUrl={playerUrl}
          posterUrl={meta?.poster}
          onClose={() => setBonfireOpen(false)}
        />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═════════════════════════════════════════════════════════════════════════════

function CatalogRow({ title, items, onSelect }: { title: string; items: CatalogItem[]; onSelect: (item: CatalogItem) => void }) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        fontFamily: "'Cinzel', serif", fontWeight: 600, fontSize: 14,
        color: "#d4a942", letterSpacing: "0.12em", textTransform: "uppercase",
        padding: "0 0 8px",
      }}>
        <span>{title}</span>
        <div style={{ flex: 1, height: 1, background: "#2a2a2a" }} />
      </div>
      <div className="sc-row">
        {items.slice(0, 20).map(item => (
          <PosterCard key={item.id} item={item} onClick={() => onSelect(item)} compact />
        ))}
      </div>
    </div>
  );
}

function PosterCard({ item, onClick, compact }: { item: CatalogItem; onClick: () => void; compact?: boolean }) {
  const width = compact ? 150 : undefined;
  return (
    <button
      onClick={onClick}
      className="sc-poster"
      style={{
        display: "flex", flexDirection: "column",
        background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10,
        overflow: "hidden", cursor: "pointer", textAlign: "left",
        transition: "all 0.2s ease", flexShrink: 0,
        width: compact ? width : "100%",
      }}
    >
      <div style={{
        aspectRatio: "2/3", background: "#111",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}>
        {item.poster ? (
          <img
            src={item.poster}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            loading="lazy"
          />
        ) : (
          <span style={{ fontSize: 40, opacity: 0.3 }}>🎬</span>
        )}
      </div>
      <div style={{ padding: compact ? "8px 10px" : "10px 14px" }}>
        <div style={{
          fontFamily: "'Cinzel', serif", color: "#d4a942", fontSize: compact ? 12 : 14,
          fontWeight: 700, marginBottom: 2,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {item.name}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {item.year && <span style={{ color: "#6a5a4a", fontSize: 11 }}>{item.year}</span>}
          {item.imdbRating && (
            <span style={{ color: "#d4a942", fontSize: 11 }}>
              ★ {soulScore(item.imdbRating)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
