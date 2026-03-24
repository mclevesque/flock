"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { buildPlaylist, VIBE_TAGS, VibeVideo } from "@/app/vibe/vibeData";
import { usePathname } from "next/navigation";

// ── Context ───────────────────────────────────────────────────────────────────

interface VibeContextType {
  playlist: VibeVideo[];
  currentIndex: number;
  playing: boolean;
  muted: boolean;
  expanded: boolean;
  interests: string[];
  setInterests: (tags: string[]) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  toggleMute: () => void;
  setExpanded: (v: boolean) => void;
  jumpTo: (index: number) => void;
  loadInterests: () => Promise<void>;
}

const VibeContext = createContext<VibeContextType>({
  playlist: [], currentIndex: 0, playing: false, muted: false, expanded: false, interests: [],
  setInterests: () => {}, play: () => {}, pause: () => {}, stop: () => {}, next: () => {}, prev: () => {},
  toggleMute: () => {}, setExpanded: () => {}, jumpTo: () => {}, loadInterests: async () => {},
});

export function useVibe() { return useContext(VibeContext); }

// ── Provider ──────────────────────────────────────────────────────────────────

export function VibeProvider({ children }: { children: React.ReactNode }) {
  const [interests, setInterestsState] = useState<string[]>([]);
  const [playlist, setPlaylist] = useState<VibeVideo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const pathname = usePathname();

  const loadInterests = useCallback(async () => {
    try {
      const res = await fetch("/api/vibe");
      const data = await res.json();
      const tags: string[] = Array.isArray(data.interests) ? data.interests : [];
      setInterestsState(tags);
      if (tags.length > 0) {
        setPlaylist(buildPlaylist(tags));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadInterests(); }, [loadInterests]);

  const setInterests = useCallback((tags: string[]) => {
    setInterestsState(tags);
    const pl = buildPlaylist(tags);
    setPlaylist(pl);
    setCurrentIndex(0);
    setIframeKey(k => k + 1);
  }, []);

  const play = useCallback(() => setPlaying(true), []);
  const pause = useCallback(() => setPlaying(false), []);
  const stop = useCallback(() => { setPlaying(false); setPlaylist([]); setCurrentIndex(0); }, []);

  const next = useCallback(() => {
    setCurrentIndex(i => {
      const n = (i + 1) % Math.max(playlist.length, 1);
      setIframeKey(k => k + 1);
      return n;
    });
    setPlaying(true);
  }, [playlist.length]);

  const prev = useCallback(() => {
    setCurrentIndex(i => {
      const n = (i - 1 + Math.max(playlist.length, 1)) % Math.max(playlist.length, 1);
      setIframeKey(k => k + 1);
      return n;
    });
    setPlaying(true);
  }, [playlist.length]);

  const toggleMute = useCallback(() => setMuted(m => !m), []);

  const jumpTo = useCallback((index: number) => {
    setCurrentIndex(index);
    setIframeKey(k => k + 1);
    setPlaying(true);
  }, []);

  const currentVideo = playlist[currentIndex];
  const onVibePage = pathname === "/vibe";

  // Auto-skip on YouTube error (removed/private/embed-blocked)
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (typeof e.data !== "string") return;
      try {
        const d = JSON.parse(e.data);
        if (d.event === "infoDelivery" && d.info?.playerState === 0) {
          // Video ended naturally — advance
          setCurrentIndex(i => (i + 1) % Math.max(playlist.length, 1));
          setIframeKey(k => k + 1);
        }
        if (d.event === "onError") {
          // Errors 100, 101, 150 = unavailable/embed blocked — skip silently
          setCurrentIndex(i => (i + 1) % Math.max(playlist.length, 1));
          setIframeKey(k => k + 1);
        }
      } catch { /* not a YouTube message */ }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [playlist.length]);

  // Show mini player when playing and not on a profile page (profile has its own Vibe tab)
  const onProfilePage = pathname.startsWith("/profile");
  const showMini = currentVideo && !onVibePage && !onProfilePage;

  return (
    <VibeContext.Provider value={{
      playlist, currentIndex, playing, muted, expanded, interests,
      setInterests, play, pause, stop, next, prev, toggleMute, setExpanded, jumpTo, loadInterests,
    }}>
      {children}

      {/* ── Persistent iframe — always mounted when playing, never unmounts ── */}
      {/* Must be 480x270 off-screen — YouTube refuses to play in sub-100px containers */}
      {currentVideo && (
        <div style={{ position: "fixed", left: -9999, top: -9999, width: 480, height: 270, pointerEvents: "none", opacity: 0 }}
          aria-hidden="true">
          <iframe
            key={iframeKey}
            ref={iframeRef}
            src={currentVideo.searchQuery
              ? `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(currentVideo.searchQuery)}&autoplay=${playing ? 1 : 0}&mute=${muted ? 1 : 0}&rel=0&enablejsapi=1`
              : `https://www.youtube.com/embed/${currentVideo.id}?autoplay=${playing ? 1 : 0}&mute=${muted ? 1 : 0}&rel=0&modestbranding=1&iv_load_policy=3&enablejsapi=1`}
            allow="autoplay; encrypted-media"
            style={{ width: 480, height: 270, border: "none" }}
            title="vibe-player"
          />
        </div>
      )}

      {/* ── Mini player pill (visible when on other tabs) ── */}
      {showMini && (
        <MiniPlayer
          video={currentVideo}
          muted={muted}
          onToggleMute={toggleMute}
          onNext={next}
          onPrev={prev}
          onExpand={() => {}}
          iframeKey={iframeKey}
          playing={playing}
          onPause={pause}
          onPlay={play}
          onStop={stop}
        />
      )}
    </VibeContext.Provider>
  );
}

// ── Mini Player Pill ──────────────────────────────────────────────────────────

function MiniPlayer({ video, muted, onToggleMute, onNext, onPrev, playing, onPause, onPlay, onStop }: {
  video: VibeVideo;
  muted: boolean;
  onToggleMute: () => void;
  onNext: () => void;
  onPrev: () => void;
  onExpand: () => void;
  iframeKey: number;
  playing: boolean;
  onPause: () => void;
  onPlay: () => void;
  onStop: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const tagEmojis = VIBE_TAGS.filter(t => video.tags.includes(t.id)).map(t => t.emoji).join("");

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        zIndex: 9999,
        background: "rgba(10,10,20,0.92)",
        border: "1px solid rgba(124,58,237,0.5)",
        borderRadius: 40,
        backdropFilter: "blur(12px)",
        boxShadow: "0 4px 24px rgba(124,58,237,0.25)",
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: hovered ? "8px 14px" : "6px 10px",
        transition: "all 0.2s ease",
        cursor: "pointer",
        maxWidth: hovered ? 340 : 180,
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      {/* Pulse ring when playing */}
      {playing && !muted && (
        <span style={{
          width: 8, height: 8, borderRadius: "50%", background: "#a855f7", flexShrink: 0,
          animation: "vibe-pulse 1.2s ease-in-out infinite",
        }} />
      )}

      {/* Tag emoji + title */}
      <span style={{ fontSize: 13, flexShrink: 0 }}>{tagEmojis || "⚡"}</span>
      {hovered && (
        <span style={{
          fontSize: 11, color: "rgba(255,255,255,0.7)", whiteSpace: "nowrap",
          overflow: "hidden", textOverflow: "ellipsis", maxWidth: 130,
        }}>
          {video.title}
        </span>
      )}

      {/* Controls */}
      <button onClick={e => { e.stopPropagation(); onPrev(); }}
        style={miniBtn} title="Previous">⏮</button>
      <button onClick={e => { e.stopPropagation(); playing ? onPause() : onPlay(); }}
        style={miniBtn} title={playing ? "Pause" : "Play"}>{playing ? "⏸" : "▶"}</button>
      <button onClick={e => { e.stopPropagation(); onNext(); }}
        style={miniBtn} title="Next">⏭</button>
      <button onClick={e => { e.stopPropagation(); onToggleMute(); }}
        style={miniBtn} title={muted ? "Unmute" : "Mute"}>{muted ? "🔇" : "🔊"}</button>
      <button onClick={e => { e.stopPropagation(); onStop(); }}
        style={{ ...miniBtn, color: "rgba(255,100,100,0.8)", fontSize: 12 }} title="Close player">✕</button>

      <style>{`
        @keyframes vibe-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}

const miniBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "rgba(255,255,255,0.8)",
  fontSize: 14,
  cursor: "pointer",
  padding: "2px 3px",
  lineHeight: 1,
  flexShrink: 0,
};
