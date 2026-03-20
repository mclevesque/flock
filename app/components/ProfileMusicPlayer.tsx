"use client";
import { useState, useRef, useEffect } from "react";

const SAMPLE_TRACKS = [
  { title: "Ginseng Strip 2002", artist: "Bladee", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
  { title: "Kyoto", artist: "Yung Lean", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
  { title: "fool", artist: "drain gang", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" },
];

interface ProfileMusicPlayerProps {
  track?: { title: string; artist: string; url: string };
}

// Extend Window for YouTube IFrame API
declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
  }
}

// ── YouTube player (hidden iframe, audio only) ──────────────────────────────
function YouTubeMusicPlayer({ track }: { track: { title: string; artist: string; url: string } }) {
  const videoId = track.url.slice(3); // strip "yt:"
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const playerRef = useRef<YT.Player | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let player: YT.Player;

    function initPlayer() {
      if (!divRef.current) return;
      player = new window.YT.Player(divRef.current, {
        videoId,
        playerVars: { autoplay: 1, controls: 0, rel: 0, modestbranding: 1 },
        events: {
          onReady: (e: YT.PlayerEvent) => {
            playerRef.current = e.target;
            const dur = e.target.getDuration();
            if (dur > 0) setDuration(dur);
            e.target.playVideo();
          },
          onStateChange: (e: YT.OnStateChangeEvent) => {
            if (e.data === window.YT.PlayerState.PLAYING) {
              setPlaying(true);
              const dur = playerRef.current?.getDuration() ?? 0;
              if (dur > 0) setDuration(dur);
              intervalRef.current = setInterval(() => {
                const cur = playerRef.current?.getCurrentTime() ?? 0;
                setProgress(cur);
              }, 500);
            } else {
              setPlaying(false);
              if (intervalRef.current) clearInterval(intervalRef.current);
            }
          },
        },
      });
    }

    if (window.YT?.Player) {
      initPlayer();
    } else {
      // Load API script once
      if (!document.getElementById("yt-iframe-api")) {
        const tag = document.createElement("script");
        tag.id = "yt-iframe-api";
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
      }
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      try { player?.destroy(); } catch { /* ignore */ }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  function togglePlay() {
    if (!playerRef.current) return;
    if (playing) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  }

  function fmt(s: number) {
    if (!s || isNaN(s)) return "0:00";
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  }

  const pct = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0;

  return (
    <div style={{
      background: "var(--bg-elevated)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: "10px 14px",
      display: "flex",
      alignItems: "center",
      gap: 12,
    }}>
      {/* Hidden YouTube div — YT API replaces this with an iframe */}
      <div ref={divRef} style={{ position: "fixed", top: -9999, left: -9999, width: 1, height: 1 }} />

      {/* Album art — YouTube red */}
      <div style={{
        width: 40, height: 40, borderRadius: 8, flexShrink: 0,
        background: "linear-gradient(135deg, #ff0000, #cc2200)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
      }}>
        {playing ? "♫" : "▶"}
      </div>

      {/* Track info */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{track.title}</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 6 }}>{track.artist}</span>
          </div>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {fmt(progress)} / {fmt(duration)}
          </span>
        </div>
        {/* Red scroll bar matching actual duration */}
        <div
          style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden", cursor: "pointer" }}
          onClick={e => {
            if (!playerRef.current || !duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            playerRef.current.seekTo(ratio * duration, true);
            setProgress(ratio * duration);
          }}
        >
          <div style={{
            height: "100%", width: `${pct}%`,
            background: "linear-gradient(90deg, #cc0000, #ff4444)",
            borderRadius: 2,
            transition: "width 0.5s linear",
          }} />
        </div>
      </div>

      {/* Controls */}
      <button
        onClick={togglePlay}
        style={{
          width: 36, height: 36, borderRadius: "50%",
          background: playing ? "rgba(255,0,0,0.25)" : "linear-gradient(135deg, #ff0000, #cc2200)",
          border: "none", color: "#fff", fontSize: 14, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}
      >
        {playing ? "⏸" : "▶"}
      </button>

      <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>
        YouTube
      </span>
    </div>
  );
}

// ── Regular audio player ────────────────────────────────────────────────────
function AudioMusicPlayer({ track }: { track: { title: string; artist: string; url: string } }) {
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setProgress(audio.currentTime);
    const onMeta = () => {
      setDuration(audio.duration);
      audio.play().then(() => { setPlaying(true); setBlocked(false); }).catch(() => setBlocked(true));
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.pause();
    };
  }, []);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); } else { audio.play().catch(() => {}); }
    setPlaying(!playing);
  }

  function fmt(s: number) {
    if (!s || isNaN(s)) return "0:00";
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  }

  const pct = duration ? (progress / duration) * 100 : 0;

  return (
    <div
      onClick={blocked ? () => { audioRef.current?.play().then(() => { setPlaying(true); setBlocked(false); }).catch(() => {}) } : undefined}
      style={{
        background: "var(--bg-elevated)",
        border: `1px solid ${blocked ? "rgba(124,92,191,0.5)" : "var(--border)"}`,
        borderRadius: 12, padding: "10px 14px",
        display: "flex", alignItems: "center", gap: 12,
        cursor: blocked ? "pointer" : "default",
      }}
    >
      <audio ref={audioRef} src={track.url} preload="metadata" />

      <div style={{
        width: 40, height: 40, borderRadius: 8, flexShrink: 0,
        background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
      }}>
        {playing ? "♫" : "♩"}
      </div>

      <div style={{ flex: 1, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{track.title}</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 6 }}>{track.artist}</span>
          </div>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {fmt(progress)} / {fmt(duration)}
          </span>
        </div>
        <div
          style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden", cursor: "pointer" }}
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            if (audioRef.current && duration) audioRef.current.currentTime = ratio * duration;
          }}
        >
          <div style={{
            height: "100%", width: `${pct}%`,
            background: "linear-gradient(90deg, var(--accent-purple), var(--accent-blue))",
            borderRadius: 2, transition: "width 0.2s linear",
          }} />
        </div>
      </div>

      <button
        onClick={togglePlay}
        style={{
          width: 36, height: 36, borderRadius: "50%",
          background: playing ? "rgba(124,92,191,0.3)" : "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))",
          border: "none", color: "#fff", fontSize: 14, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}
      >
        {playing ? "⏸" : "▶"}
      </button>

      <span style={{ fontSize: 10, color: blocked ? "var(--accent-purple-bright)" : "var(--text-muted)", flexShrink: 0 }}>
        {blocked ? "▶ Click to play" : "Profile Song"}
      </span>
    </div>
  );
}

// ── Main export ─────────────────────────────────────────────────────────────
export default function ProfileMusicPlayer({ track = SAMPLE_TRACKS[0] }: ProfileMusicPlayerProps) {
  if (track.url.startsWith("yt:")) {
    return <YouTubeMusicPlayer track={track} />;
  }
  return <AudioMusicPlayer track={track} />;
}
