"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useVoice } from "@/app/components/VoiceWidget";

const VW = 900, VH = 560;
const SCREEN_X = 85, SCREEN_Y = 38, SCREEN_W = 730, SCREEN_H = 200;
const SEAT_ROWS = 3, SEAT_COLS = 4;
const SEAT_W = 54, SEAT_H = 60;
const SEAT_GAP_X = 92, SEAT_GAP_Y = 82;
const SEATS_START_Y = 308;
const PLAYER_R = 14;
const SPEED = 3.2;

const EMOTES = [
  { id: "laugh",   emoji: "😂", label: "Laugh",   color: "#ffcc00", border: "#aa8800", cd: 2500 },
  { id: "cry",     emoji: "😢", label: "Cry",      color: "#5599ff", border: "#2255cc", cd: 2500 },
  { id: "tomato",  emoji: "🍅", label: "Throw!",   color: "#ff5522", border: "#aa2200", cd: 4000 },
  { id: "shush",   emoji: "🤫", label: "Shush",    color: "#cc55ff", border: "#7722aa", cd: 2000 },
  { id: "cola",    emoji: "🥤", label: "Sip Cola", color: "#cc9944", border: "#886622", cd: 3000 },
  { id: "popcorn", emoji: "🍿", label: "Popcorn",  color: "#ffbb33", border: "#cc8800", cd: 2000 },
] as const;
type EmoteId = typeof EMOTES[number]["id"];

interface Particle {
  x: number; y: number; vx: number; vy: number;
  content: string; isText?: boolean; textColor?: string;
  alpha: number; size: number; decay: number; gravity: number;
  rotation: number; rotV: number;
}
interface TomatoProjectile { sx: number; sy: number; tx: number; ty: number; t: number; }
interface ScreenSplat { id: number; x: number; y: number; r: number; rot: number; }
interface TheaterSeat { userId: string; username: string; }
interface TheaterState {
  videoUrl: string | null; startedAt: number | null; hostId?: string | null;
  seats: Record<string, TheaterSeat>;
  isPaused?: boolean; pausedAt?: number | null;
  screenshareOffer?: unknown;
  jukeboxUrl?: string | null; jukeboxStartedAt?: number | null; jukeboxBy?: string | null;
}
interface ChatMessage { userId: string; username: string; avatarUrl: string; message: string; createdAt: number; }
interface TheaterRoomProps {
  theaterState: TheaterState | null;
  userId: string; username: string; avatarUrl?: string | null; myCoins: number;
  hostId?: string | null;
  partyId?: string | null;
  theaterChat?: ChatMessage[];
  onClose: () => void;
  onSetVideo: (videoUrl: string) => Promise<void>;
  onClearVideo: () => Promise<void>;
  onPause: () => Promise<void>;
  onUnpause: () => Promise<void>;
  onSeek: (newStartedAt: number) => Promise<void>;
  onSit: (seatIdx: number) => void;
  onStand: () => void;
  onChat: (message: string) => Promise<void>;
}

function getSeatPos(idx: number) {
  const row = Math.floor(idx / SEAT_COLS), col = idx % SEAT_COLS;
  const totalW = (SEAT_COLS - 1) * SEAT_GAP_X + SEAT_W;
  return { x: VW / 2 - totalW / 2 + col * SEAT_GAP_X + SEAT_W / 2, y: SEATS_START_Y + row * SEAT_GAP_Y + SEAT_H / 2 };
}
function extractYouTubeId(url: string): string | null {
  for (const p of [/[?&]v=([a-zA-Z0-9_-]{11})/, /youtu\.be\/([a-zA-Z0-9_-]{11})/, /embed\/([a-zA-Z0-9_-]{11})/, /shorts\/([a-zA-Z0-9_-]{11})/]) {
    const m = url.match(p); if (m) return m[1];
  }
  return null;
}
function buildEmbedUrl(videoUrl: string, startedAt: number | null, isPaused?: boolean, pausedAt?: number | null): string {
  const id = extractYouTubeId(videoUrl) ?? videoUrl;
  let elapsed: number;
  if (isPaused && pausedAt && startedAt) {
    elapsed = Math.floor((pausedAt - startedAt) / 1000);
  } else {
    elapsed = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
  }
  // mute=1 is required for autoplay on mobile/HTTP; we unmute via postMessage after load
  return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&start=${Math.max(0, elapsed)}&rel=0&enablejsapi=1`;
}
function usernameColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return ["#ff7f50","#87ceeb","#98fb98","#dda0dd","#f0e68c","#ff69b4","#00ced1","#ffa07a","#90ee90","#9370db"][h % 10];
}

export default function TheaterRoom({
  theaterState, userId, username, myCoins, hostId, partyId,
  theaterChat = [],
  onClose, onSetVideo, onClearVideo, onPause, onUnpause, onSeek,
  onSit, onStand, onChat,
}: TheaterRoomProps) {
  const isHost = !hostId || hostId === userId;

  // Voice chat — auto-join theater room if not already in a call
  const { joinRoom, leaveRoom, currentRoomId, isInVoice, participantCount, openMaxi, anyoneSpeaking } = useVoice();
  const autoJoinedVoiceRef = useRef(false);
  const THEATER_VOICE_ROOM = "theater-main";

  useEffect(() => {
    // Only auto-join theater voice if not already in a call — never interrupt existing calls
    if (!isInVoice) {
      autoJoinedVoiceRef.current = true;
      // Small delay to let theater render first
      const t = setTimeout(() => {
        joinRoom(THEATER_VOICE_ROOM, "🎬 Theater Voice").catch(() => {});
      }, 800);
      return () => {
        clearTimeout(t);
        // Leave theater voice on unmount only if we auto-joined it
        if (autoJoinedVoiceRef.current) leaveRoom();
      };
    }
    // User is in a call — keep them in it, don't disrupt
    return () => {};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Audio ducking: lower media when someone speaks, restore on silence ─────────
  const duckTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentVolumeRef = useRef(100); // 0-100 scale

  useEffect(() => {
    const targetVol = anyoneSpeaking ? 35 : 100;
    if (duckTimerRef.current) { clearInterval(duckTimerRef.current); duckTimerRef.current = null; }

    duckTimerRef.current = setInterval(() => {
      const cur  = currentVolumeRef.current;
      const step = anyoneSpeaking ? -4 : 3; // duck fast, restore slow
      const next = Math.max(0, Math.min(100, cur + step));
      currentVolumeRef.current = next;

      // YouTube iframe — YouTube Player API setVolume (0-100)
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func: "setVolume", args: [next] }), "*"
      );

      // Screen share video element
      const vid = screenVideoRef.current;
      if (vid) vid.volume = next / 100;

      if (next === targetVol) { clearInterval(duckTimerRef.current!); duckTimerRef.current = null; }
    }, anyoneSpeaking ? 30 : 60); // duck in ~300ms, restore in ~600ms

    return () => { if (duckTimerRef.current) clearInterval(duckTimerRef.current); };
  }, [anyoneSpeaking]); // eslint-disable-line

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const avatarImgRef = useRef<HTMLImageElement | null>(null);
  const avatarLoadedRef = useRef(false);
  const seatAvatarImgsRef = useRef<Map<string, HTMLImageElement>>(new Map());

  const playerRef = useRef({ x: VW / 2, y: VH - 40 });
  const targetRef = useRef<{ x: number; y: number } | null>(null);
  const keysRef = useRef<Set<string>>(new Set());

  const localSeatsRef = useRef<Record<string, TheaterSeat>>({});
  const mySeatRef = useRef<number | null>(null);
  const [mySeat, setMySeat] = useState<number | null>(null);

  const particlesRef = useRef<Particle[]>([]);
  const tomatoRef = useRef<TomatoProjectile | null>(null);
  const [screenSplats, setScreenSplats] = useState<ScreenSplat[]>([]);
  const splatIdRef = useRef(0);

  const cooldownsRef = useRef<Partial<Record<EmoteId, number>>>({});
  const [, setCdTick] = useState(0);
  const cdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Audio
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [soundMuted, setSoundMuted] = useState(false);
  const soundMutedRef = useRef(false);
  const getAudioCtx = () => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    return audioCtxRef.current;
  };
  const playEmoteSound = useCallback((id: EmoteId) => {
    if (soundMutedRef.current) return;
    try {
      const ctx = getAudioCtx();
      const dest = ctx.destination;
      const t = ctx.currentTime;
      const noise = (dur: number) => {
        const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        return buf;
      };
      if (id === "laugh") {
        [0, 0.13, 0.26].forEach((delay, i) => {
          const osc = ctx.createOscillator(), g = ctx.createGain();
          osc.type = "sine"; osc.frequency.value = 480 + i * 90;
          osc.connect(g); g.connect(dest);
          g.gain.setValueAtTime(0, t + delay);
          g.gain.linearRampToValueAtTime(0.13, t + delay + 0.04);
          g.gain.linearRampToValueAtTime(0, t + delay + 0.1);
          osc.start(t + delay); osc.stop(t + delay + 0.11);
        });
      } else if (id === "cry") {
        const osc = ctx.createOscillator(), g = ctx.createGain();
        osc.type = "sine"; osc.frequency.setValueAtTime(360, t); osc.frequency.linearRampToValueAtTime(190, t + 0.55);
        osc.connect(g); g.connect(dest);
        g.gain.setValueAtTime(0.1, t); g.gain.linearRampToValueAtTime(0, t + 0.55);
        osc.start(t); osc.stop(t + 0.56);
      } else if (id === "tomato") {
        const src = ctx.createBufferSource(), g = ctx.createGain(), filt = ctx.createBiquadFilter();
        filt.type = "lowpass"; filt.frequency.value = 350;
        src.buffer = noise(0.12);
        src.connect(filt); filt.connect(g); g.connect(dest);
        g.gain.value = 0.5; src.start(t);
      } else if (id === "shush") {
        const src = ctx.createBufferSource(), filt = ctx.createBiquadFilter(), g = ctx.createGain();
        filt.type = "bandpass"; filt.frequency.value = 2800; filt.Q.value = 0.7;
        src.buffer = noise(0.4);
        src.connect(filt); filt.connect(g); g.connect(dest);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07, t + 0.05);
        g.gain.linearRampToValueAtTime(0.07, t + 0.3); g.gain.linearRampToValueAtTime(0, t + 0.4);
        src.start(t);
      } else if (id === "cola") {
        const src = ctx.createBufferSource(), filt = ctx.createBiquadFilter(), g = ctx.createGain();
        filt.type = "bandpass"; filt.Q.value = 2;
        filt.frequency.setValueAtTime(900, t); filt.frequency.linearRampToValueAtTime(200, t + 0.3);
        src.buffer = noise(0.3);
        src.connect(filt); filt.connect(g); g.connect(dest);
        g.gain.setValueAtTime(0.18, t); g.gain.linearRampToValueAtTime(0, t + 0.3);
        src.start(t);
      } else if (id === "popcorn") {
        for (let i = 0; i < 7; i++) {
          const delay = i * 0.055 + Math.random() * 0.025;
          const src = ctx.createBufferSource(), g = ctx.createGain();
          const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.04), ctx.sampleRate);
          const d = buf.getChannelData(0);
          for (let j = 0; j < d.length; j++) d[j] = (Math.random() * 2 - 1) * Math.exp(-j / (d.length * 0.18));
          src.buffer = buf; src.connect(g); g.connect(dest);
          g.gain.value = 0.18 + Math.random() * 0.12;
          src.start(t + delay);
        }
      }
    } catch { /* AudioContext blocked */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Harp Jukebox state ────────────────────────────────────────────────────────
  const jukeboxIframeRef = useRef<HTMLIFrameElement | null>(null);
  const [jukeboxInput, setJukeboxInput] = useState("");
  const [jukeboxMuted, setJukeboxMuted] = useState(false);
  const [jukeboxLoading, setJukeboxLoading] = useState(false);
  const jukeboxMutedRef = useRef(false);
  const prevJukeboxMutedRef = useRef(false);

  const jukeboxUrl = theaterState?.jukeboxUrl ?? null;
  const jukeboxStartedAt = theaterState?.jukeboxStartedAt ?? null;
  const jukeboxBy = theaterState?.jukeboxBy ?? null;

  // Build jukebox embed — hidden 1x1 audio-only player
  function buildJukeboxEmbedUrl(url: string, startedAt: number | null): string {
    const id = extractYouTubeId(url) ?? url;
    const elapsed = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
    return `https://www.youtube.com/embed/${id}?autoplay=1&mute=0&start=${Math.max(0, elapsed)}&rel=0&enablejsapi=1`;
  }

  // Video state
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlTab, setUrlTab] = useState<"youtube" | "screenshare">("screenshare");
  const [settingVideo, setSettingVideo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(80);
  const [fsMode, setFsMode] = useState(false);
  const stableSrcRef = useRef("");

  // Mobile detection — declared early so fullscreen callbacks can use it
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 700);
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Proper fullscreen with orientation lock for mobile
  const enterFullscreen = useCallback(async () => {
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen();
      // Lock to landscape on mobile for true horizontal fullscreen
      if (isMobile && screen.orientation && typeof (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock === "function") {
        await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock!("landscape").catch(() => {});
      }
    } catch { /* not supported, fall through to CSS mode */ }
    setFsMode(true);
  }, [isMobile]);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      if (screen.orientation && typeof (screen.orientation as ScreenOrientation & { unlock?: () => void }).unlock === "function") {
        (screen.orientation as ScreenOrientation & { unlock?: () => void }).unlock!();
      }
    } catch { /* ignore */ }
    setFsMode(false);
  }, []);

  // Sync fsMode when user exits fullscreen via Escape key
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement && fsMode) setFsMode(false);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [fsMode]);
  const prevEmbedKeyRef = useRef("");

  // Screen share — host-initiated model (matches WatchRoom for mobile reliability)
  const [ssStatus, setSsStatus] = useState<"idle" | "hosting" | "viewing">("idle");
  const [ssError, setSsError] = useState<string | null>(null);
  const [ssVideoReady, setSsVideoReady] = useState(false);
  const [ssAudioMuted, setSsAudioMuted] = useState(true);
  const isSharingRef = useRef(false);
  const screenPeersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const screenSignalIdRef = useRef(0);
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasRequestedRef = useRef(false);
  const ssStuckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const videoUrl = theaterState?.videoUrl ?? null;
  const startedAt = theaterState?.startedAt ?? null;
  const isPaused = theaterState?.isPaused ?? false;
  const pausedAt = theaterState?.pausedAt ?? null;

  // embedKey only changes when the VIDEO URL changes (not on seek/pause)
  // This prevents iframe remount on every seek — we use seekTo postMessage instead
  const embedKey = videoUrl ?? "";
  const prevVideoUrlRef = useRef<string | null>(null);
  const prevStartedAtRef = useRef<number | null>(null);

  if (embedKey && embedKey !== prevEmbedKeyRef.current) {
    prevEmbedKeyRef.current = embedKey;
    stableSrcRef.current = buildEmbedUrl(videoUrl!, startedAt, isPaused, pausedAt);
  }

  // Seek sync: when startedAt changes but videoUrl stays the same → seekTo without remount
  // This runs for all viewers when host seeks
  useEffect(() => {
    if (!videoUrl || !startedAt) return;
    const urlChanged = videoUrl !== prevVideoUrlRef.current;
    const timeChanged = startedAt !== prevStartedAtRef.current;
    prevVideoUrlRef.current = videoUrl;
    prevStartedAtRef.current = startedAt;
    if (!urlChanged && timeChanged && !isPaused) {
      // Host seeked — send seekTo to this client's iframe
      const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func: "seekTo", args: [elapsed, true] }), "*"
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt]);

  // Load avatars
  useEffect(() => {
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => { avatarImgRef.current = img; avatarLoadedRef.current = true; };
    img.src = `/api/avatar/${userId}`;
  }, [userId]);

  // Sync seats from theaterState
  useEffect(() => {
    if (!theaterState?.seats) return;
    localSeatsRef.current = theaterState.seats;
    const entry = Object.entries(theaterState.seats).find(([, v]) => v.userId === userId);
    const seat = entry ? Number(entry[0]) : null;
    mySeatRef.current = seat; setMySeat(seat);
    for (const occupant of Object.values(theaterState.seats)) {
      if (!seatAvatarImgsRef.current.has(occupant.userId)) {
        const img = new Image(); img.crossOrigin = "anonymous";
        const uid = occupant.userId;
        img.onload = () => seatAvatarImgsRef.current.set(uid, img);
        img.src = `/api/avatar/${uid}`;
      }
    }
  }, [theaterState?.seats, userId]);

  // Pause sync for non-host viewers
  const prevIsPausedRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (prevIsPausedRef.current === null) { prevIsPausedRef.current = isPaused; return; }
    if (prevIsPausedRef.current === isPaused) return;
    prevIsPausedRef.current = isPaused;
    if (!isHost) {
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) return;
      const cmd = isPaused ? "pauseVideo" : "playVideo";
      iframe.contentWindow.postMessage(JSON.stringify({ event: "command", func: cmd, args: "" }), "*");
    }
  }, [isPaused, isHost]);

  // ── WebRTC Screen Share (host-initiated model with TURN — mirrors WatchRoom) ──
  const ICE_CONFIG = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      // TURN — required for mobile & strict NAT
      { urls: "turn:openrelay.metered.ca:80",                username: "openrelayproject", credential: "openrelayproject" },
      { urls: "turn:openrelay.metered.ca:443",               username: "openrelayproject", credential: "openrelayproject" },
      { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
    ],
  };

  const signalRoomId = `theater-${partyId || "main"}`;

  const postSsSignal = (toUser: string, type: string, payload: unknown) =>
    fetch(`/api/watch-room/${signalRoomId}/signals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toUser, type, payload }),
    }).catch(() => {});

  const apiPost = (action: string, extra?: object) =>
    fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) }).then(r => r.json());

  function createSsPeer(peerId: string): RTCPeerConnection {
    screenPeersRef.current.get(peerId)?.close();
    const pc = new RTCPeerConnection(ICE_CONFIG);
    screenPeersRef.current.set(peerId, pc);

    // Trickle ICE — send each candidate as it arrives (no waiting)
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) postSsSignal(peerId, "screen-ice", candidate.toJSON());
    };

    // Viewer receives track from host
    pc.ontrack = (e) => {
      const vid = screenVideoRef.current;
      if (!vid || !e.streams[0]) return;
      vid.srcObject = e.streams[0];
      vid.muted = true;
      vid.playsInline = true;
      setSsStatus("viewing");
      // Always show tap-to-play on mobile — auto-play is unreliable + video can appear black
      // On desktop try to auto-play muted, show overlay on failure
      if (isMobile) {
        setSsVideoReady(false);
        setSsAudioMuted(true);
        // Silently try muted play so it's ready when user taps
        vid.play().catch(() => {});
      } else {
        setTimeout(() => {
          vid.muted = true;
          vid.play()
            .then(() => { setSsVideoReady(true); setSsAudioMuted(true); })
            .catch(() => { setSsVideoReady(false); setSsAudioMuted(true); });
        }, 50);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") {
        if (!isSharingRef.current && hasRequestedRef.current) {
          screenPeersRef.current.delete(peerId);
          setTimeout(() => {
            if (!isSharingRef.current) postSsSignal(peerId, "screen-want", {});
          }, 2000);
        }
      }
    };

    return pc;
  }

  async function sendSsOfferTo(viewerId: string) {
    const stream = screenStreamRef.current;
    if (!stream) return;
    const pc = createSsPeer(viewerId);
    for (const track of stream.getTracks()) pc.addTrack(track, stream);

    // Force H.264 codec preference — iOS Safari hardware-decodes H.264 but has
    // unreliable VP9 support. Chrome desktop defaults to VP9 for window capture
    // specifically, which breaks on iPhone. H.264 works for all surface types.
    try {
      const videoCapabilities = RTCRtpSender.getCapabilities?.("video");
      if (videoCapabilities) {
        const h264 = videoCapabilities.codecs.filter(c => c.mimeType.toLowerCase() === "video/h264");
        const rest  = videoCapabilities.codecs.filter(c => c.mimeType.toLowerCase() !== "video/h264");
        for (const tc of pc.getTransceivers()) {
          if (tc.sender.track?.kind === "video") {
            tc.setCodecPreferences([...h264, ...rest]);
          }
        }
      }
    } catch { /* unsupported browser — ignore */ }

    // Bitrate + framerate cap (helps iOS decode without dropping frames)
    pc.onnegotiationneeded = async () => {
      try {
        for (const sender of pc.getSenders()) {
          if (sender.track?.kind === "video") {
            const params = sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
            params.encodings[0].maxBitrate = 4_000_000; // 4 Mbps — iOS handles this well
            params.encodings[0].maxFramerate = 30;
            await sender.setParameters(params).catch(() => {});
          }
        }
      } catch { /* ignore */ }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await postSsSignal(viewerId, "screen-offer", offer);
  }

  function startSsPoll() {
    if (screenPollRef.current) return;
    screenPollRef.current = setInterval(processSsSignals, 1500); // fast poll for reliability
  }
  function stopSsPoll() {
    if (screenPollRef.current) { clearInterval(screenPollRef.current); screenPollRef.current = null; }
  }

  async function processSsSignals() {
    try {
      const res = await fetch(`/api/watch-room/${signalRoomId}/signals?after=${screenSignalIdRef.current}`);
      if (!res.ok) return;
      const { signals } = await res.json();

      for (const sig of signals as { id: number; from_user: string; type: string; payload: Record<string, unknown> }[]) {
        if (sig.id > screenSignalIdRef.current) screenSignalIdRef.current = sig.id;

        if (sig.type === "screen-want") {
          // Viewer wants my stream — send offer
          if (isSharingRef.current && screenStreamRef.current) await sendSsOfferTo(sig.from_user);

        } else if (sig.type === "screen-offer") {
          // I'm a viewer receiving the host's offer
          const pc = createSsPeer(sig.from_user);
          await pc.setRemoteDescription(new RTCSessionDescription(sig.payload as unknown as RTCSessionDescriptionInit));
          const buffered = pendingIceRef.current.get(sig.from_user) ?? [];
          for (const c of buffered) await pc.addIceCandidate(c).catch(() => {});
          pendingIceRef.current.delete(sig.from_user);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await postSsSignal(sig.from_user, "screen-answer", answer);
          // Cancel stuck timer — offer arrived
          if (ssStuckTimerRef.current) { clearTimeout(ssStuckTimerRef.current); ssStuckTimerRef.current = null; }

        } else if (sig.type === "screen-answer") {
          // I'm the host receiving a viewer's answer
          const pc = screenPeersRef.current.get(sig.from_user);
          if (pc && pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(sig.payload as unknown as RTCSessionDescriptionInit));
            const buffered = pendingIceRef.current.get(sig.from_user) ?? [];
            for (const c of buffered) await pc.addIceCandidate(c).catch(() => {});
            pendingIceRef.current.delete(sig.from_user);
          }

        } else if (sig.type === "screen-ice") {
          const pc = screenPeersRef.current.get(sig.from_user);
          if (pc) {
            if (pc.remoteDescription) {
              await pc.addIceCandidate(new RTCIceCandidate(sig.payload as RTCIceCandidateInit)).catch(() => {});
            } else {
              const buf = pendingIceRef.current.get(sig.from_user) ?? [];
              buf.push(sig.payload as RTCIceCandidateInit);
              pendingIceRef.current.set(sig.from_user, buf);
            }
          }

        } else if (sig.type === "screen-stop") {
          setSsStatus("idle");
          setSsVideoReady(false);
          setSsAudioMuted(true);
          hasRequestedRef.current = false;
          stopSsPoll();
          if (ssStuckTimerRef.current) { clearTimeout(ssStuckTimerRef.current); ssStuckTimerRef.current = null; }
          const vid = screenVideoRef.current;
          if (vid) vid.srcObject = null;
          screenPeersRef.current.forEach(pc => pc.close());
          screenPeersRef.current.clear();
        }
      }
    } catch { /* network error, retry next tick */ }
  }

  const startScreenShare = async () => {
    setSsError(null);
    // Check if getDisplayMedia is supported (not available on iOS/Android)
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setSsError("Screen sharing isn't supported on your device");
      return;
    }
    try {
      // No displaySurface constraint — let the OS picker show Screen, Window AND Tab options
      const stream = await (navigator.mediaDevices as MediaDevices & { getDisplayMedia: (c?: object) => Promise<MediaStream> })
        .getDisplayMedia({
          video: { width: { max: 1920 }, height: { max: 1080 }, frameRate: { ideal: 30, max: 30 } },
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
      screenStreamRef.current = stream;
      isSharingRef.current = true;
      setSsStatus("hosting");
      setSsVideoReady(true);
      setSsAudioMuted(false);

      // Local preview (muted to avoid echo)
      const vid = screenVideoRef.current;
      if (vid) { vid.srcObject = stream; vid.muted = true; vid.play().catch(() => {}); }

      // Notify viewers (updates theaterState.screenshareOffer for all pollers)
      await apiPost("theater-screenshare-offer", { offer: { active: true, hostId: userId }, partyId: partyId || undefined });

      stream.getVideoTracks()[0]?.addEventListener("ended", stopScreenShare);
      startSsPoll();
    } catch (e) {
      const err = e as Error;
      if (err.name === "NotAllowedError") {
        // User dismissed the picker — silently ignore
      } else if (err.name === "NotSupportedError" || err.name === "TypeError") {
        setSsError("Screen sharing isn't supported on your device");
      } else {
        setSsError("Screen share failed: " + err.message);
      }
    }
  };

  const stopScreenShare = async () => {
    if (!isSharingRef.current) return;
    isSharingRef.current = false;
    setSsStatus("idle");
    setSsVideoReady(false);
    setSsAudioMuted(true);

    // Tell all connected viewers to stop
    for (const [peerId] of screenPeersRef.current) postSsSignal(peerId, "screen-stop", {});

    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    screenPeersRef.current.forEach(pc => pc.close());
    screenPeersRef.current.clear();

    const vid = screenVideoRef.current;
    if (vid) vid.srcObject = null;
    stopSsPoll();
    await apiPost("theater-ss-stop", { partyId: partyId || undefined }).catch(() => {});
  };

  // ── Harp Jukebox logic (placed after ssStatus/ssAudioMuted are declared) ─────
  // Auto-mute jukebox when screenshare with audio is active
  useEffect(() => {
    const ssAudioActive = (ssStatus === "hosting" || ssStatus === "viewing") && !ssAudioMuted;
    const shouldMute = jukeboxMutedRef.current || ssAudioActive;
    if (prevJukeboxMutedRef.current === shouldMute) return;
    prevJukeboxMutedRef.current = shouldMute;
    if (!jukeboxIframeRef.current?.contentWindow) return;
    const cmd = shouldMute ? "mute" : "unMute";
    jukeboxIframeRef.current.contentWindow.postMessage(JSON.stringify({ event: "command", func: cmd, args: "" }), "*");
  }, [jukeboxMuted, ssStatus, ssAudioMuted]); // eslint-disable-line

  const handleJukeboxPlay = async () => {
    if (!jukeboxInput.trim()) return;
    if (!extractYouTubeId(jukeboxInput.trim())) return;
    setJukeboxLoading(true);
    try {
      await apiPost("theater-jukebox-play", { jukeboxUrl: jukeboxInput.trim(), partyId: partyId || undefined });
      setJukeboxInput("");
    } catch { /* ignore */ } finally { setJukeboxLoading(false); }
  };

  const handleJukeboxStop = async () => {
    await apiPost("theater-jukebox-stop", { partyId: partyId || undefined });
  };

  const toggleJukeboxMute = () => {
    const next = !jukeboxMuted;
    jukeboxMutedRef.current = next;
    setJukeboxMuted(next);
    if (!jukeboxIframeRef.current?.contentWindow) return;
    const cmd = next ? "mute" : "unMute";
    jukeboxIframeRef.current.contentWindow.postMessage(JSON.stringify({ event: "command", func: cmd, args: "" }), "*");
  };

  // Viewer: when screenshareOffer becomes active OR host changes, send screen-want
  const screenshareOffer = theaterState?.screenshareOffer as { active?: boolean; hostId?: string } | null;
  const ssOfferActiveRef = useRef(false);
  const ssLastHostIdRef  = useRef<string | null>(null);

  useEffect(() => {
    const isActive = !!screenshareOffer?.active;
    const hostId   = screenshareOffer?.hostId ?? null;

    // Fire when: active state flips, OR same active=true but different hostId (new share session)
    const hostChanged = isActive && hostId !== ssLastHostIdRef.current && !isSharingRef.current;
    if (isActive === ssOfferActiveRef.current && !hostChanged) return;

    ssOfferActiveRef.current = isActive;
    ssLastHostIdRef.current  = hostId;

    if (!isActive) {
      // Host stopped — clean up viewer side
      hasRequestedRef.current = false;
      setSsStatus("idle");
      setSsVideoReady(false);
      setSsAudioMuted(true);
      if (ssStuckTimerRef.current) { clearTimeout(ssStuckTimerRef.current); ssStuckTimerRef.current = null; }
      const vid = screenVideoRef.current;
      if (vid) vid.srcObject = null;
      screenPeersRef.current.forEach(pc => pc.close());
      screenPeersRef.current.clear();
      stopSsPoll();
      return;
    }

    // Viewer (not the host) sends screen-want
    if (isSharingRef.current) return; // we are the host, skip
    const ssHostId = hostId;
    if (!ssHostId || ssHostId === userId) return;

    // Late joiners: clean up any stale connection before re-requesting
    screenPeersRef.current.forEach(pc => pc.close());
    screenPeersRef.current.clear();
    hasRequestedRef.current = true;
    setSsStatus("viewing");
    postSsSignal(ssHostId, "screen-want", {});
    startSsPoll();

    // Stuck-viewer guard: if no offer arrives in 8s, re-request
    if (ssStuckTimerRef.current) clearTimeout(ssStuckTimerRef.current);
    ssStuckTimerRef.current = setTimeout(() => {
      if (hasRequestedRef.current && !isSharingRef.current) {
        postSsSignal(ssHostId, "screen-want", {});
      }
    }, 8000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenshareOffer?.active, screenshareOffer?.hostId]);

  // Viewer tap to play / unmute
  function handleTapSsVideo(e?: React.MouseEvent | React.TouchEvent) {
    e?.stopPropagation();
    (e as React.MouseEvent)?.preventDefault?.();
    const vid = screenVideoRef.current;
    if (!vid) return;
    if (!ssVideoReady) {
      // Check if stream is dead — re-request if so
      const stream = vid.srcObject as MediaStream | null;
      const streamDead = !stream || !stream.active || stream.getVideoTracks().every(t => t.readyState === "ended");
      const hostId2 = screenshareOffer?.hostId;
      if (streamDead && screenshareOffer?.active && hostId2 && hostId2 !== userId) {
        postSsSignal(hostId2, "screen-want", {});
        if (!screenPollRef.current) startSsPoll();
        return;
      }
      // Call play() directly — do NOT null srcObject or use requestAnimationFrame,
      // as that breaks Android Chrome's user-gesture trust chain
      vid.muted = true;
      vid.playsInline = true;
      vid.play()
        .then(() => { setSsVideoReady(true); setSsAudioMuted(true); })
        .catch(() => {
          // Retry once synchronously
          vid.play()
            .then(() => { setSsVideoReady(true); setSsAudioMuted(true); })
            .catch(() => { setSsVideoReady(false); });
        });
    } else if (ssAudioMuted) {
      vid.muted = false;
      vid.volume = 1;
      vid.play().catch(() => {});
      setSsAudioMuted(false);
    }
  }

  // Cleanup on unmount
  useEffect(() => () => {
    if (cdTimerRef.current) clearInterval(cdTimerRef.current);
    if (ssStuckTimerRef.current) clearTimeout(ssStuckTimerRef.current);
    stopSsPoll();
    audioCtxRef.current?.close().catch(() => {});
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenPeersRef.current.forEach(pc => pc.close());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Emote triggers ────────────────────────────────────────────────────────
  const triggerEmote = useCallback((id: EmoteId) => {
    const cds = cooldownsRef.current;
    const emote = EMOTES.find(e => e.id === id)!;
    if ((cds[id] ?? 0) > Date.now()) return;
    cds[id] = Date.now() + emote.cd;
    playEmoteSound(id);
    if (!cdTimerRef.current) {
      cdTimerRef.current = setInterval(() => {
        setCdTick(t => t + 1);
        const anyActive = EMOTES.some(e => (cooldownsRef.current[e.id] ?? 0) > Date.now());
        if (!anyActive && cdTimerRef.current) { clearInterval(cdTimerRef.current); cdTimerRef.current = null; }
      }, 80);
    }
    setCdTick(t => t + 1);

    const seatIdx = mySeatRef.current;
    const p = seatIdx !== null ? getSeatPos(seatIdx) : playerRef.current;
    const pts = particlesRef.current;
    // anchor: stays snapped to seat, big, slow fade
    const anchor = (content: string, opts: Partial<Particle> = {}) => pts.push({
      x: p.x, y: p.y - 18,
      vx: 0, vy: 0, gravity: 0,
      content, alpha: 1, size: 46, decay: 0.006, rotation: 0, rotV: 0,
      ...opts,
    });
    // float: small secondary particles that drift upward
    const float = (content: string, opts: Partial<Particle> = {}) => pts.push({
      x: p.x + (Math.random() - 0.5) * 28, y: p.y - 22,
      vx: (Math.random() - 0.5) * 1.4, vy: -1.6 - Math.random() * 1.4,
      content, alpha: 0.9, size: 16, decay: 0.018, gravity: 0.018, rotation: 0, rotV: (Math.random() - 0.5) * 0.07,
      ...opts,
    });
    const spawnText = (text: string, color: string, opts: Partial<Particle> = {}) => pts.push({
      x: p.x, y: p.y - 52, vx: 0, vy: -0.9,
      content: text, isText: true, textColor: color, alpha: 1, size: 14, decay: 0.012, gravity: 0, rotation: 0, rotV: 0,
      ...opts,
    });

    if (id === "laugh") {
      anchor("😂");
      for (let i = 0; i < 5; i++) float("😂", { size: 12 + Math.random() * 8 });
      spawnText("HA HA!", "#ffee00", { size: 16 });
    } else if (id === "cry") {
      anchor("😢");
      for (let i = 0; i < 9; i++) pts.push({
        x: p.x + (Math.random() - 0.5) * 18, y: p.y - 10,
        vx: (Math.random() - 0.5) * 0.7, vy: 1.2 + Math.random() * 1.8,
        content: "💧", alpha: 0.9, size: 10 + Math.random() * 7, decay: 0.022, gravity: 0.06,
        rotation: 0, rotV: 0,
      });
      spawnText("...", "#88aaff", { y: p.y - 58 });
    } else if (id === "tomato") {
      tomatoRef.current = { sx: p.x, sy: p.y - 10, tx: VW / 2, ty: SCREEN_Y + SCREEN_H * 0.65, t: 0 };
    } else if (id === "shush") {
      anchor("🤫");
      spawnText("SHHH!", "#dd88ff", { size: 15, x: p.x });
      for (let i = 0; i < 4; i++) pts.push({
        x: p.x + 15 + i * 12, y: p.y - 30 - i * 8,
        vx: 0.8 + i * 0.2, vy: -0.6,
        content: "~", isText: true, textColor: "#cc99ee",
        alpha: 0.75 - i * 0.1, size: 13 - i, decay: 0.018, gravity: 0, rotation: 0, rotV: 0,
      });
    } else if (id === "cola") {
      anchor("🥤");
      for (let i = 0; i < 7; i++) pts.push({
        x: p.x + (Math.random() - 0.5) * 14, y: p.y - 15,
        vx: (Math.random() - 0.5) * 1.1, vy: -1.8 - Math.random() * 1.2,
        content: "🫧", alpha: 0.85, size: 9 + Math.random() * 7, decay: 0.022, gravity: -0.015,
        rotation: 0, rotV: 0,
      });
      spawnText("glug glug", "#ffcc88", { size: 12 });
    } else if (id === "popcorn") {
      anchor("🍿");
      for (let i = 0; i < 10; i++) {
        const angle = (Math.random() * Math.PI * 2);
        pts.push({
          x: p.x + (Math.random() - 0.5) * 16, y: p.y - 18,
          vx: Math.cos(angle) * (1.2 + Math.random() * 1.8),
          vy: -2.5 - Math.random() * 2,
          content: i % 2 === 0 ? "🌽" : "⭐",
          alpha: 1, size: 11 + Math.random() * 8, decay: 0.019, gravity: 0.09,
          rotation: Math.random() * Math.PI, rotV: (Math.random() - 0.5) * 0.18,
        });
      }
      spawnText("nom nom!", "#ffdd88", { size: 12 });
    }
  }, [playEmoteSound]);

  // ── Canvas drawing ──────────────────────────────────────────────────────────
  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const vx = (x: number) => x * W / VW;
    const vy = (y: number) => y * H / VH;

    ctx.clearRect(0, 0, W, H);

    // Carpet
    ctx.fillStyle = "#160808"; ctx.fillRect(0, 0, W, H);
    for (let row = 0; row < VH; row += 18) {
      ctx.fillStyle = row % 36 === 0 ? "rgba(100,10,10,0.22)" : "rgba(60,5,5,0.12)";
      ctx.fillRect(0, vy(row), W, vy(18));
    }
    ctx.strokeStyle = "rgba(120,20,20,0.1)"; ctx.lineWidth = 1;
    for (let gx = 0; gx < VW; gx += 30) {
      for (let gy = SCREEN_Y + SCREEN_H + 20; gy < VH; gy += 30) {
        ctx.beginPath();
        ctx.moveTo(vx(gx + 15), vy(gy)); ctx.lineTo(vx(gx + 30), vy(gy + 15));
        ctx.lineTo(vx(gx + 15), vy(gy + 30)); ctx.lineTo(vx(gx), vy(gy + 15));
        ctx.closePath(); ctx.stroke();
      }
    }

    // Side walls
    ctx.fillStyle = "#0d0404";
    ctx.fillRect(0, 0, vx(65), H); ctx.fillRect(vx(835), 0, W - vx(835), H);
    ctx.strokeStyle = "#3a1010"; ctx.lineWidth = vx(2);
    ctx.beginPath(); ctx.moveTo(vx(65), 0); ctx.lineTo(vx(65), H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(vx(835), 0); ctx.lineTo(vx(835), H); ctx.stroke();

    // Sconces
    for (const [wx, wy] of [[32, 310], [32, 440], [868, 310], [868, 440]] as [number, number][]) {
      ctx.fillStyle = "#4a2808"; ctx.fillRect(vx(wx - 10), vy(wy - 18), vx(20), vy(36));
      const grd = ctx.createRadialGradient(vx(wx), vy(wy - 18), 0, vx(wx), vy(wy - 18), vx(55));
      grd.addColorStop(0, "rgba(255,200,80,0.55)"); grd.addColorStop(0.3, "rgba(255,160,40,0.2)"); grd.addColorStop(1, "rgba(255,160,40,0)");
      ctx.fillStyle = grd; ctx.beginPath(); ctx.ellipse(vx(wx), vy(wy - 18), vx(55), vy(45), 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffe090"; ctx.beginPath(); ctx.ellipse(vx(wx), vy(wy - 18), vx(9), vy(13), 0, 0, Math.PI * 2); ctx.fill();
    }

    // Curtains
    const drawCurtain = (startX: number, dir: number) => {
      for (let fold = 0; fold < 4; fold++) {
        const ox = vx(startX + fold * dir * 16), fw = vx(18);
        ctx.fillStyle = fold % 2 === 0 ? "#8B0000" : "#6B0000";
        ctx.beginPath();
        ctx.moveTo(ox, 0);
        ctx.bezierCurveTo(ox + fw * 0.6, vy(70), ox - fw * 0.3, vy(140), ox + fw * 0.3, vy(SCREEN_Y + SCREEN_H + 30));
        ctx.lineTo(ox + fw, vy(SCREEN_Y + SCREEN_H + 30));
        ctx.bezierCurveTo(ox + fw * 1.3, vy(140), ox + fw * 0.7, vy(70), ox + fw, 0);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(180,30,30,0.3)"; ctx.fillRect(ox + fw * 0.45, 0, vx(3), vy(SCREEN_Y + SCREEN_H + 30));
      }
    };
    drawCurtain(SCREEN_X - 69, 1); drawCurtain(SCREEN_X + SCREEN_W + 5, -1);
    ctx.fillStyle = "#8a6030"; ctx.fillRect(vx(SCREEN_X - 75), vy(2), vx(SCREEN_W + 150), vy(8));
    ctx.fillStyle = "#c8a060"; ctx.fillRect(vx(SCREEN_X - 75), vy(2), vx(SCREEN_W + 150), vy(4));

    // Screen frame
    ctx.fillStyle = "#7a5008"; ctx.fillRect(vx(SCREEN_X - 10), vy(SCREEN_Y - 10), vx(SCREEN_W + 20), vy(SCREEN_H + 20));
    ctx.strokeStyle = "#c8a020"; ctx.lineWidth = vx(3);
    ctx.strokeRect(vx(SCREEN_X - 10), vy(SCREEN_Y - 10), vx(SCREEN_W + 20), vy(SCREEN_H + 20));
    ctx.fillStyle = "#020205"; ctx.fillRect(vx(SCREEN_X), vy(SCREEN_Y), vx(SCREEN_W), vy(SCREEN_H));
    if (!videoUrl && ssStatus !== "hosting") {
      ctx.fillStyle = "rgba(255,215,0,0.55)"; ctx.font = `bold ${vy(17)}px monospace`; ctx.textAlign = "center";
      ctx.fillText(isHost ? "🎬 Click screen to play a video" : "🎬 Waiting for the show to start...", vx(VW / 2), vy(SCREEN_Y + SCREEN_H / 2 - 8));
      if (isHost) {
        ctx.font = `${vy(12)}px monospace`; ctx.fillStyle = "rgba(255,215,0,0.4)"; ctx.fillText("🪙 50 gold", vx(VW / 2), vy(SCREEN_Y + SCREEN_H / 2 + 16));
      }
    } else if (isPaused) {
      ctx.fillStyle = "rgba(255,215,0,0.4)"; ctx.font = `bold ${vy(14)}px monospace`; ctx.textAlign = "center";
      ctx.fillText(isHost ? "⏸ Paused — click ▶ to resume" : "⏸ Host paused the stream", vx(VW / 2), vy(SCREEN_Y + SCREEN_H / 2));
    }

    // Aisle divider + row labels
    ctx.strokeStyle = "rgba(200,160,32,0.35)"; ctx.lineWidth = vx(2);
    ctx.beginPath(); ctx.moveTo(vx(66), vy(SEATS_START_Y - 18)); ctx.lineTo(vx(834), vy(SEATS_START_Y - 18)); ctx.stroke();
    for (let r = 0; r < SEAT_ROWS; r++) {
      ctx.fillStyle = "#555"; ctx.font = `bold ${vy(12)}px monospace`; ctx.textAlign = "right";
      ctx.fillText(String.fromCharCode(65 + r), vx(82), vy(SEATS_START_Y + r * SEAT_GAP_Y + SEAT_H / 2 + 4));
    }

    // Seats
    const seats = localSeatsRef.current;
    const avatarMap = seatAvatarImgsRef.current;
    for (let i = 0; i < SEAT_ROWS * SEAT_COLS; i++) {
      const pos = getSeatPos(i);
      const occupant = seats[i];
      const isMe = occupant?.userId === userId;
      const isEmpty = !occupant;
      ctx.fillStyle = isEmpty ? "#3a0808" : (isMe ? "#5a3800" : "#2a0606");
      ctx.beginPath(); ctx.roundRect(vx(pos.x - SEAT_W / 2), vy(pos.y - SEAT_H / 2), vx(SEAT_W), vy(SEAT_H * 0.58), vx(5)); ctx.fill();
      ctx.strokeStyle = isEmpty ? "#5a1a1a" : (isMe ? "#ffd700" : "#3a1010"); ctx.lineWidth = vx(isMe ? 2.5 : 1.5); ctx.stroke();
      ctx.fillStyle = isEmpty ? "#5a1212" : (isMe ? "#8a5a00" : "#441010");
      ctx.beginPath(); ctx.roundRect(vx(pos.x - SEAT_W / 2 + 5), vy(pos.y + SEAT_H * 0.04), vx(SEAT_W - 10), vy(SEAT_H * 0.34), vx(4)); ctx.fill();
      if (isEmpty) {
        ctx.fillStyle = "#3a1a1a"; ctx.font = `${vy(9)}px monospace`; ctx.textAlign = "center";
        ctx.fillText(String(i % SEAT_COLS + 1), vx(pos.x), vy(pos.y + SEAT_H * 0.42));
      }
      if (occupant) {
        const avatarImg = isMe ? avatarImgRef.current : (avatarMap.get(occupant.userId) ?? null);
        const ar = vx(SEAT_W * 0.52);
        const ax = vx(pos.x), ay = vy(pos.y - SEAT_H * 0.1);
        ctx.save(); ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI * 2); ctx.clip();
        if (avatarImg) {
          ctx.drawImage(avatarImg, ax - ar, ay - ar, ar * 2, ar * 2);
        } else {
          ctx.fillStyle = isMe ? "#4466ff" : "#446644";
          ctx.fillRect(ax - ar, ay - ar, ar * 2, ar * 2);
          ctx.fillStyle = "#fff"; ctx.font = `bold ${ar * 1.1}px monospace`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText((occupant.username[0] ?? "?").toUpperCase(), ax, ay); ctx.textBaseline = "alphabetic";
        }
        ctx.restore();
        ctx.strokeStyle = isMe ? "#ffd700" : "#888"; ctx.lineWidth = vx(1.5);
        ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI * 2); ctx.stroke();
        ctx.font = `bold ${vy(8)}px monospace`; ctx.fillStyle = isMe ? "#ffd700" : "#bbb"; ctx.textAlign = "center";
        ctx.fillText(isMe ? "You" : occupant.username.slice(0, 7), vx(pos.x), vy(pos.y + SEAT_H / 2 + 12));
        if (isMe) { ctx.font = `${vy(7)}px monospace`; ctx.fillStyle = "#ff8888"; ctx.fillText("(stand)", vx(pos.x), vy(pos.y + SEAT_H / 2 + 22)); }
      }
    }

    // Player avatar — only when not seated
    if (mySeatRef.current === null) {
      const p = playerRef.current;
      const px = vx(p.x), py = vy(p.y), pr = vx(PLAYER_R);
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath(); ctx.ellipse(px, py + pr + 1, pr * 0.85, pr * 0.28, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.clip();
      if (avatarLoadedRef.current && avatarImgRef.current) {
        ctx.drawImage(avatarImgRef.current, px - pr, py - pr, pr * 2, pr * 2);
      } else {
        ctx.fillStyle = "#2255cc"; ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
        ctx.fillStyle = "#fff"; ctx.font = `bold ${pr * 1.1}px monospace`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText((username[0] ?? "?").toUpperCase(), px, py); ctx.textBaseline = "alphabetic";
      }
      ctx.restore();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = vx(1.5); ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.stroke();
      ctx.font = `bold ${vy(11)}px monospace`; ctx.textAlign = "center";
      ctx.strokeStyle = "rgba(0,0,0,0.85)"; ctx.lineWidth = vy(3);
      ctx.strokeText(username.slice(0, 12), px, py - pr - 4);
      ctx.fillStyle = "#fff"; ctx.fillText(username.slice(0, 12), px, py - pr - 4);
    }

    // Tomato projectile
    const tom = tomatoRef.current;
    if (tom) {
      const arc = Math.sin(tom.t * Math.PI) * -80;
      const tx = vx(tom.sx + (tom.tx - tom.sx) * tom.t);
      const ty = vy(tom.sy + (tom.ty - tom.sy) * tom.t) + arc * (H / VH);
      ctx.font = `${vy(20)}px serif`; ctx.textAlign = "center";
      ctx.save(); ctx.translate(tx, ty); ctx.rotate(tom.t * Math.PI * 3); ctx.fillText("🍅", 0, 0); ctx.restore();
    }

    // Particles
    ctx.textAlign = "center";
    for (const pt of particlesRef.current) {
      ctx.save(); ctx.globalAlpha = Math.max(0, pt.alpha);
      ctx.translate(vx(pt.x), vy(pt.y)); ctx.rotate(pt.rotation);
      if (pt.isText) {
        ctx.font = `bold ${vy(pt.size)}px monospace`;
        ctx.strokeStyle = "rgba(0,0,0,0.7)"; ctx.lineWidth = vy(2.5); ctx.strokeText(pt.content, 0, 0);
        ctx.fillStyle = pt.textColor ?? "#fff"; ctx.fillText(pt.content, 0, 0);
      } else {
        ctx.font = `${vy(pt.size)}px serif`; ctx.fillText(pt.content, 0, 0);
      }
      ctx.restore();
    }
  }, [userId, username, videoUrl, isPaused, isHost, ssStatus]);

  // ── RAF loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current, container = containerRef.current;
    if (!canvas || !container) return;
    let rafId: number;
    const resize = () => { canvas.width = container.clientWidth; canvas.height = container.clientHeight; };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(container);

    const loop = () => {
      const keys = keysRef.current, p = playerRef.current;
      if (mySeatRef.current === null) {
        let dx = 0, dy = 0;
        if (keys.has("ArrowLeft") || keys.has("a") || keys.has("A")) dx -= SPEED;
        if (keys.has("ArrowRight") || keys.has("d") || keys.has("D")) dx += SPEED;
        if (keys.has("ArrowUp") || keys.has("w") || keys.has("W")) dy -= SPEED;
        if (keys.has("ArrowDown") || keys.has("s") || keys.has("S")) dy += SPEED;
        const tgt = targetRef.current;
        if (tgt && dx === 0 && dy === 0) {
          const tx = tgt.x - p.x, ty = tgt.y - p.y, d = Math.sqrt(tx * tx + ty * ty);
          if (d > 5) { dx = tx / d * SPEED; dy = ty / d * SPEED; } else targetRef.current = null;
        }
        p.x = Math.max(70, Math.min(VW - 70, p.x + dx));
        p.y = Math.max(SCREEN_Y + SCREEN_H + 38, Math.min(VH - 16, p.y + dy));
      }

      const tom = tomatoRef.current;
      if (tom) {
        tom.t = Math.min(1, tom.t + 0.035);
        if (tom.t >= 1) {
          tomatoRef.current = null;
          const cx = 25 + Math.random() * 50, cy = 15 + Math.random() * 70;
          const splats: ScreenSplat[] = [];
          splats.push({ id: ++splatIdRef.current, x: cx, y: cy, r: 10 + Math.random() * 6, rot: Math.random() * 360 });
          for (let d = 0; d < 4; d++) splats.push({ id: ++splatIdRef.current, x: cx + (Math.random() - 0.5) * 20, y: cy + (Math.random() - 0.5) * 20 + 5 + d * 3, r: 3 + Math.random() * 4, rot: Math.random() * 360 });
          setScreenSplats(prev => [...prev, ...splats]);
          const ids = splats.map(s => s.id);
          setTimeout(() => setScreenSplats(prev => prev.filter(s => !ids.includes(s.id))), 8000);
        }
      }

      particlesRef.current = particlesRef.current.filter(pt => {
        pt.x += pt.vx; pt.y += pt.vy; pt.vy += pt.gravity;
        pt.alpha -= pt.decay; pt.rotation += pt.rotV;
        return pt.alpha > 0;
      });

      drawFrame();
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      keysRef.current.add(e.key);
      if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)) e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key);
    window.addEventListener("keydown", onKeyDown); window.addEventListener("keyup", onKeyUp);
    return () => { cancelAnimationFrame(rafId); ro.disconnect(); window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); };
  }, [drawFrame]);

  // ── Seat interaction ────────────────────────────────────────────────────
  const handleSeatAction = useCallback((idx: number) => {
    const occupant = localSeatsRef.current[idx];
    if (occupant && occupant.userId !== userId) return;
    if (occupant && occupant.userId === userId) {
      const ns = { ...localSeatsRef.current }; delete ns[idx];
      localSeatsRef.current = ns; mySeatRef.current = null; setMySeat(null);
      const pos = getSeatPos(idx); playerRef.current = { x: pos.x, y: Math.min(VH - 16, pos.y + 85) };
      targetRef.current = null; onStand(); return;
    }
    const pos = getSeatPos(idx); playerRef.current = { x: pos.x, y: pos.y + 35 }; targetRef.current = null;
    const ns: Record<string, TheaterSeat> = {};
    for (const [k, v] of Object.entries(localSeatsRef.current)) { if (v.userId !== userId) ns[k] = v; }
    ns[idx] = { userId, username }; localSeatsRef.current = ns; mySeatRef.current = idx; setMySeat(idx); onSit(idx);
  }, [userId, username, onSit, onStand]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (showUrlInput) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / canvas.clientWidth * VW;
    const cy = (e.clientY - rect.top) / canvas.clientHeight * VH;
    if (cx >= SCREEN_X && cx <= SCREEN_X + SCREEN_W && cy >= SCREEN_Y && cy <= SCREEN_Y + SCREEN_H) {
      // Only host can open video modal
      if (isHost) { setShowUrlInput(true); }
      return;
    }
    for (let i = 0; i < SEAT_ROWS * SEAT_COLS; i++) {
      const pos = getSeatPos(i);
      if (Math.abs(cx - pos.x) < SEAT_W / 2 + 8 && Math.abs(cy - pos.y) < SEAT_H / 2 + 8) { handleSeatAction(i); return; }
    }
    if (cy > SCREEN_Y + SCREEN_H + 30 && mySeatRef.current === null)
      targetRef.current = { x: Math.max(70, Math.min(VW - 70, cx)), y: Math.min(VH - 16, cy) };
  }, [showUrlInput, handleSeatAction, isHost]);

  const handleCanvasTouch = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    const t = e.touches[0]; if (!t) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = (t.clientX - rect.left) / canvas.clientWidth * VW;
    const cy = (t.clientY - rect.top) / canvas.clientHeight * VH;
    if (showUrlInput) return;
    // Screen tap — open video modal (host only)
    if (cx >= SCREEN_X && cx <= SCREEN_X + SCREEN_W && cy >= SCREEN_Y && cy <= SCREEN_Y + SCREEN_H) {
      if (isHost) setShowUrlInput(true);
      return;
    }
    // Seat tap — sit/stand
    for (let i = 0; i < SEAT_ROWS * SEAT_COLS; i++) {
      const pos = getSeatPos(i);
      if (Math.abs(cx - pos.x) < SEAT_W / 2 + 10 && Math.abs(cy - pos.y) < SEAT_H / 2 + 10) {
        handleSeatAction(i); return;
      }
    }
    // Movement — only when not seated and below screen area
    if (cy > SCREEN_Y + SCREEN_H + 30 && mySeatRef.current === null)
      targetRef.current = { x: Math.max(70, Math.min(VW - 70, cx)), y: Math.min(VH - 16, cy) };
  }, [showUrlInput, handleSeatAction, isHost]);

  // ── Host controls ──────────────────────────────────────────────────────
  const sendYTCmd = (func: string, args?: unknown) =>
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args: args ?? "" }), "*");

  const handleVolumeChange = (v: number) => { setVolume(v); sendYTCmd("setVolume", [v]); };

  const handleTogglePause = async () => {
    if (!isHost) return;
    if (isPaused) { sendYTCmd("playVideo"); await onUnpause(); }
    else { sendYTCmd("pauseVideo"); await onPause(); }
  };

  const handleSeek = async (deltaSeconds: number) => {
    if (!isHost || !startedAt) return;
    const newStartedAt = startedAt - deltaSeconds * 1000;
    await onSeek(newStartedAt);
    const newElapsed = Math.max(0, Math.floor((Date.now() - newStartedAt) / 1000));
    sendYTCmd("seekTo", [newElapsed, true]);
  };

  const handleSetVideo = async () => {
    if (!urlInput.trim()) return;
    setSettingVideo(true); setError(null);
    try { await onSetVideo(urlInput.trim()); setShowUrlInput(false); setUrlInput(""); }
    catch { setError("Failed to set video"); } finally { setSettingVideo(false); }
  };

  // ── Chat ───────────────────────────────────────────────────────────────
  const [chatInput, setChatInput] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [showChat, setShowChat] = useState(false); // always default false; desktop opens via useEffect
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Open chat by default on desktop
  useEffect(() => {
    if (!isMobile) setShowChat(true);
  }, [isMobile]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [theaterChat.length]);

  const handleSendChat = async () => {
    const msg = chatInput.trim();
    if (!msg || sendingChat) return;
    setSendingChat(true);
    setChatInput("");
    try { await onChat(msg); } catch { /* ignore */ } finally { setSendingChat(false); }
  };

  const showVideo = !!videoUrl && !!embedKey;
  const now = Date.now();

  // In CSS fsMode, theater container expands. Web Fullscreen API handles real FS.
  const theaterStyle: React.CSSProperties = fsMode
    ? { position: "absolute", inset: 0, zIndex: 10 }  // fills the fixed parent
    : { flex: 1, position: "relative", overflow: "hidden", minWidth: 0 };

  // Emote button style
  const emoteBtn = (emote: typeof EMOTES[number], onCd: boolean): React.CSSProperties => ({
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: 2,
    background: onCd ? "rgba(0,0,0,0.55)" : "rgba(10,5,5,0.85)",
    border: `2px solid ${onCd ? "#333" : emote.border}`,
    borderRadius: isMobile ? 10 : 14,
    padding: isMobile ? "6px 8px" : "10px 6px",
    cursor: onCd ? "default" : "pointer",
    width: isMobile ? 54 : 60,
    flexShrink: 0,
    backdropFilter: "blur(6px)",
    boxShadow: onCd ? "none" : `0 0 10px ${emote.color}44, inset 0 1px 0 rgba(255,255,255,0.08)`,
    transition: "transform 0.1s, box-shadow 0.1s",
    position: "relative", overflow: "hidden",
    opacity: onCd ? 0.5 : 1,
    userSelect: "none", WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10001, display: "flex", flexDirection: "column", fontFamily: "monospace", background: "#0a0505" }}>
      <style>{`
        @keyframes splatIn {
          0%   { opacity: 0;    transform: translate(-50%,-50%) scale(0.15) rotate(var(--r)); }
          8%   { opacity: 1;    transform: translate(-50%,-50%) scale(1.4)  rotate(var(--r)); }
          22%  { opacity: 0.96; transform: translate(-50%,-50%) scale(1.05) rotate(var(--r)); }
          75%  { opacity: 0.9;  transform: translate(-50%,-50%) scale(1)    rotate(var(--r)); }
          100% { opacity: 0;    transform: translate(-50%,-50%) scale(0.9)  rotate(var(--r)); }
        }
        .emote-btn:hover:not(:disabled) { transform: scale(1.1) !important; }
        .emote-btn:active:not(:disabled) { transform: scale(0.92) !important; }
        .theater-chat-msg:hover { background: rgba(255,255,255,0.04) !important; }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>

      {/* Top bar */}
      {!fsMode && (
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "8px 12px", background: "#0a0505", borderBottom: "1px solid #2a0808",
          color: "#eee", flexShrink: 0, gap: 8,
        }}>
          <button onClick={onClose} style={{ background: "#1a0808", border: "1px solid #ff4466", color: "#ff6688", padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "monospace", fontSize: 13, flexShrink: 0, touchAction: "manipulation" }}>← Exit</button>
          <div style={{ color: "#888", fontSize: 11, textAlign: "center", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            🎬 Town Cinema &nbsp;·&nbsp; <span style={{ color: "#ffd700" }}>🪙 {myCoins.toLocaleString()}</span>
            {!isHost && hostId && <span style={{ color: "#666", marginLeft: 6 }}>· {theaterState?.hostId ? "Host is leading" : ""}</span>}
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
            {/* Compact voice chip — tap to open full voice widget */}
            <button onClick={openMaxi} title={isInVoice ? `Voice: ${participantCount} in theater` : "Join theater voice"} style={{
              display: "flex", alignItems: "center", gap: 4,
              background: isInVoice ? "rgba(0,60,20,0.8)" : "rgba(20,10,10,0.8)",
              border: `1px solid ${isInVoice ? "#33cc66" : "#2a1a1a"}`,
              borderRadius: 6, padding: "5px 9px", cursor: "pointer",
              fontFamily: "monospace", fontSize: 11, color: isInVoice ? "#44ff88" : "#554455",
              touchAction: "manipulation",
            }}>
              <span style={{ fontSize: 13 }}>{isInVoice ? "🎙️" : "🎙"}</span>
              {isInVoice && <span style={{ fontWeight: "bold" }}>{participantCount}</span>}
            </button>
            <button onClick={() => setShowChat(c => !c)} style={{ background: showChat ? "#1a0a1a" : "#0a050a", border: `1px solid ${showChat ? "#8855aa" : "#332233"}`, color: showChat ? "#cc88ff" : "#554455", padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontFamily: "monospace", fontSize: 12, touchAction: "manipulation" }}>
              💬{!isMobile && " Chat"}
            </button>
            {/* Fullscreen — uses Web Fullscreen API + landscape lock on mobile */}
            <button onClick={fsMode ? exitFullscreen : enterFullscreen} style={{ background: "rgba(0,0,0,0.7)", border: "1px solid #445566", color: "#aaccff", padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontFamily: "monospace", fontSize: 12, touchAction: "manipulation" }}>⛶</button>
          </div>
        </div>
      )}

      {/* Main area: theater + (desktop) chat */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0, flexDirection: "row" }}>

        {/* Theater canvas area */}
        <div ref={containerRef} style={theaterStyle}>
          <canvas ref={canvasRef} onClick={handleCanvasClick} onTouchStart={handleCanvasTouch}
            style={{ position: "absolute", inset: 0, display: "block", cursor: "pointer" }} />

          {/* YouTube iframe — CSS fullscreen via fsMode */}
          {showVideo && (
            <iframe
              ref={iframeRef}
              key={embedKey}
              src={stableSrcRef.current}
              style={fsMode ? {
                position: "absolute", inset: 0, width: "100%", height: "100%",
                border: "none", zIndex: 5,
              } : {
                position: "absolute",
                left: `${(SCREEN_X / VW) * 100}%`,
                top: `${(SCREEN_Y / VH) * 100}%`,
                width: `${(SCREEN_W / VW) * 100}%`,
                height: `${(SCREEN_H / VH) * 100}%`,
                border: "none", pointerEvents: showUrlInput ? "none" : "auto",
                opacity: isPaused ? 0 : 1,
              }}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              onLoad={() => {
                // Unmute after load — mobile browsers require mute=1 for autoplay,
                // so we start muted and immediately unmute via the YouTube iframe API
                setTimeout(() => {
                  iframeRef.current?.contentWindow?.postMessage(
                    JSON.stringify({ event: "command", func: "unMute", args: "" }), "*"
                  );
                  iframeRef.current?.contentWindow?.postMessage(
                    JSON.stringify({ event: "command", func: "setVolume", args: [80] }), "*"
                  );
                }, 1000);
              }}
            />
          )}

          {/* Hidden jukebox iframe — 1x1, audio only */}
          {jukeboxUrl && (
            <iframe
              ref={jukeboxIframeRef}
              key={`jukebox-${jukeboxUrl}`}
              src={buildJukeboxEmbedUrl(jukeboxUrl, jukeboxStartedAt)}
              style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none", zIndex: -1 }}
              allow="autoplay"
              title="jukebox"
              onLoad={() => {
                setTimeout(() => {
                  const ssAudioActive = (ssStatus === "hosting" || ssStatus === "viewing") && !ssAudioMuted;
                  if (jukeboxMutedRef.current || ssAudioActive) return;
                  jukeboxIframeRef.current?.contentWindow?.postMessage(
                    JSON.stringify({ event: "command", func: "unMute", args: "" }), "*"
                  );
                  jukeboxIframeRef.current?.contentWindow?.postMessage(
                    JSON.stringify({ event: "command", func: "setVolume", args: [70] }), "*"
                  );
                }, 1000);
              }}
            />
          )}

          {/* Exit fullscreen overlay */}
          {fsMode && (
            <button onClick={exitFullscreen} style={{
              position: "absolute", top: 14, right: 18, zIndex: 100000,
              background: "rgba(0,0,0,0.75)", border: "1px solid #555", color: "#eee",
              padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontFamily: "monospace", fontSize: 13,
            }}>⬛ Exit Fullscreen</button>
          )}

          {/* Screen share video overlay in theater screen area */}
          {(ssStatus === "viewing" || ssStatus === "hosting") && (
            <div style={{
              position: "absolute",
              ...(fsMode ? { inset: 0 } : {
                left: `${(SCREEN_X / VW) * 100}%`,
                top: `${(SCREEN_Y / VH) * 100}%`,
                width: `${(SCREEN_W / VW) * 100}%`,
                height: `${(SCREEN_H / VH) * 100}%`,
              }),
              background: "#000", zIndex: 6, overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {/* Video element — always rendered for viewer, hidden for host */}
              {/* pointer-events:none prevents Android Chrome native video chrome from intercepting taps */}
              <video
                ref={screenVideoRef}
                autoPlay playsInline muted
                style={{
                  width: "100%", height: "100%", objectFit: "contain",
                  display: ssStatus === "viewing" ? "block" : "none",
                  pointerEvents: "none",
                }}
              />

              {/* Host preview message */}
              {ssStatus === "hosting" && (
                <div style={{ color: "#44ff88", fontSize: 14, fontFamily: "monospace", textAlign: "center", padding: 16 }}>
                  🖥️ Sharing your screen<br />
                  <span style={{ fontSize: 11, color: "#888" }}>Viewers see this in real-time.</span>
                </div>
              )}

              {/* Tap-to-play / tap-to-unmute overlay — essential for mobile */}
              {ssStatus === "viewing" && (ssAudioMuted || !ssVideoReady) && (
                <div
                  onClick={handleTapSsVideo}
                  onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleTapSsVideo(e); }}
                  style={{
                    position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", zIndex: 8, cursor: "pointer",
                    background: ssVideoReady ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.75)",
                  }}
                >
                  <div style={{
                    background: "rgba(10,5,20,0.92)", borderRadius: 14, padding: "18px 28px",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                    border: "1px solid rgba(68,136,204,0.5)",
                  }}>
                    <div style={{ fontSize: 36 }}>{!ssVideoReady ? "▶" : "🔇"}</div>
                    <div style={{ color: "#fff", fontWeight: "bold", fontSize: 14, fontFamily: "monospace" }}>
                      {!ssVideoReady ? "Tap to play" : "Tap to unmute"}
                    </div>
                    <div style={{ color: "#6b7280", fontSize: 11, textAlign: "center", fontFamily: "monospace" }}>
                      {!ssVideoReady ? "Browser requires a tap to start video" : "Audio muted — tap to hear"}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Screen share status bar */}
          {ssStatus !== "idle" && !fsMode && (
            <div style={{
              position: "absolute",
              left: `${(SCREEN_X / VW) * 100}%`,
              top: `calc(${((SCREEN_Y + SCREEN_H) / VH) * 100}% + 4px)`,
              zIndex: 9, background: "rgba(0,20,10,0.85)", border: "1px solid #226622",
              borderRadius: 5, padding: "3px 10px", display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#44ff88", display: "inline-block", flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "#44ff88", fontFamily: "monospace" }}>
                {ssStatus === "hosting" ? "🖥️ Sharing screen" : "📺 Viewing screen share"}
              </span>
              {ssStatus === "hosting" && (
                <button onClick={stopScreenShare} style={{ background: "none", border: "1px solid #ff4466", color: "#ff6688", padding: "2px 8px", borderRadius: 4, cursor: "pointer", fontFamily: "monospace", fontSize: 10, touchAction: "manipulation" }}>⏹ Stop</button>
              )}
              {ssStatus === "viewing" && ssAudioMuted && (
                <button onClick={handleTapSsVideo} style={{ background: "none", border: "1px solid #4488cc", color: "#88ccff", padding: "2px 8px", borderRadius: 4, cursor: "pointer", fontFamily: "monospace", fontSize: 10, touchAction: "manipulation" }}>🔊 Unmute</button>
              )}
            </div>
          )}

          {/* Tomato splats */}
          {screenSplats.map(splat => (
            <div key={splat.id} style={{
              position: "absolute",
              left: `calc(${(SCREEN_X / VW) * 100}% + ${((splat.x / 100) * (SCREEN_W / VW) * 100).toFixed(2)}%)`,
              top: `calc(${(SCREEN_Y / VH) * 100}% + ${((splat.y / 100) * (SCREEN_H / VH) * 100).toFixed(2)}%)`,
              width: `${splat.r}%`, height: `${splat.r * 1.4}%`,
              background: "radial-gradient(ellipse, rgba(240,50,0,1) 0%, rgba(200,20,0,0.85) 35%, rgba(160,8,0,0.5) 65%, transparent 100%)",
              borderRadius: "38% 62% 50% 48% / 52% 44% 58% 46%",
              filter: "drop-shadow(0 0 4px rgba(255,60,0,0.7))",
              pointerEvents: "none", zIndex: 7,
              "--r": `${splat.rot}deg`,
              animation: "splatIn 6s forwards ease-out",
            } as React.CSSProperties} />
          ))}

          {/* Video controls bar — below screen */}
          {videoUrl && !fsMode && (
            <div style={{
              position: "absolute",
              left: `${(SCREEN_X / VW) * 100}%`,
              top: `calc(${((SCREEN_Y + SCREEN_H) / VH) * 100}% + 4px)`,
              width: `${(SCREEN_W / VW) * 100}%`,
              display: "flex", gap: 5, zIndex: 8, alignItems: "center", flexWrap: "wrap",
            }}>
              {isHost ? (
                <>
                  <button onClick={handleTogglePause} style={{ background: "rgba(0,0,0,0.75)", border: `1px solid ${isPaused ? "#44aa44" : "#555"}`, color: isPaused ? "#88ff88" : "#eee", padding: "4px 10px", borderRadius: 5, cursor: "pointer", fontFamily: "monospace", fontSize: 12, touchAction: "manipulation" }}>
                    {isPaused ? "▶ Resume" : "⏸ Pause"}
                  </button>
                  <button onClick={() => handleSeek(-30)} style={{ background: "rgba(0,0,0,0.75)", border: "1px solid #444", color: "#aaa", padding: "4px 8px", borderRadius: 5, cursor: "pointer", fontFamily: "monospace", fontSize: 12, touchAction: "manipulation" }}>⏮ 30s</button>
                  <button onClick={() => handleSeek(30)} style={{ background: "rgba(0,0,0,0.75)", border: "1px solid #444", color: "#aaa", padding: "4px 8px", borderRadius: 5, cursor: "pointer", fontFamily: "monospace", fontSize: 12, touchAction: "manipulation" }}>30s ⏭</button>
                  <button onClick={onClearVideo} style={{ background: "rgba(0,0,0,0.75)", border: "1px solid #663333", color: "#ff8888", padding: "4px 10px", borderRadius: 5, cursor: "pointer", fontFamily: "monospace", fontSize: 12, touchAction: "manipulation" }}>✕ End</button>
                  <button onClick={() => setShowUrlInput(true)} style={{ background: "rgba(0,0,0,0.75)", border: "1px solid #555", color: "#aaa", padding: "4px 8px", borderRadius: 5, cursor: "pointer", fontFamily: "monospace", fontSize: 12, touchAction: "manipulation" }}>🔄</button>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(0,0,0,0.7)", border: "1px solid #444", borderRadius: 5, padding: "3px 7px" }}>
                    <span style={{ fontSize: 11, color: "#888" }}>🔊</span>
                    <input type="range" min={0} max={100} value={volume} onChange={e => handleVolumeChange(Number(e.target.value))}
                      style={{ width: 60, accentColor: "#ffd700", cursor: "pointer" }} />
                  </div>
                </>
              ) : (
                <span style={{ fontSize: 11, color: "#664444", padding: "4px 8px", background: "rgba(0,0,0,0.5)", borderRadius: 5, border: "1px solid #332222" }}>
                  {isPaused ? "⏸ Paused by host" : "🎬 Host controls playback"}
                </span>
              )}
            </div>
          )}

          {/* Desktop emote bar — left side of canvas */}
          {!isMobile && (
            <div style={{
              position: "absolute", left: 8, top: "55%", transform: "translateY(-50%)",
              display: "flex", flexDirection: "column", gap: 7, zIndex: 20,
            }}>
              {EMOTES.map(emote => {
                const cdExpiry = cooldownsRef.current[emote.id] ?? 0;
                const onCd = cdExpiry > now;
                const cdLeft = onCd ? Math.ceil((cdExpiry - now) / 1000) : 0;
                return (
                  <button key={emote.id} className="emote-btn" onClick={() => triggerEmote(emote.id)} disabled={onCd} style={emoteBtn(emote, onCd)} title={emote.label}>
                    {onCd && <div style={{ position: "absolute", inset: 0, borderRadius: "inherit", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#aaa", fontWeight: "bold" }}>{cdLeft}s</div>}
                    <span style={{ fontSize: 26, lineHeight: 1, filter: onCd ? "grayscale(80%)" : "none" }}>{emote.emoji}</span>
                    <span style={{ fontSize: 8, color: onCd ? "#555" : emote.color, fontWeight: "bold", textAlign: "center", lineHeight: 1.2, whiteSpace: "nowrap" }}>{emote.label}</span>
                    {!onCd && <div style={{ position: "absolute", bottom: 0, left: 6, right: 6, height: 2, borderRadius: 1, background: emote.color, opacity: 0.6 }} />}
                  </button>
                );
              })}
              <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", userSelect: "none", padding: "7px 5px", background: "rgba(10,5,5,0.7)", border: "1px solid #2a1a1a", borderRadius: 10, width: 60 }}>
                <input type="checkbox" checked={soundMuted} onChange={e => { soundMutedRef.current = e.target.checked; setSoundMuted(e.target.checked); }} style={{ accentColor: "#ff5555", width: 14, height: 14, cursor: "pointer" }} />
                <span style={{ fontSize: 8, color: soundMuted ? "#555" : "#aaa", textAlign: "center", lineHeight: 1.2 }}>{soundMuted ? "🔇" : "🔊"} Sounds</span>
              </label>
            </div>
          )}

          {/* Video / Screen share modal */}
          {showUrlInput && isHost && (
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "#0a0d14", border: "2px solid #4488cc", borderRadius: 14, padding: "22px 26px", zIndex: 10, minWidth: Math.min(360, window.innerWidth - 32), boxShadow: "0 0 40px rgba(68,136,204,0.3)" }}>

              {/* Tabs */}
              <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
                {([["youtube", "🎬 YouTube"], ["screenshare", "🖥️ Screen Share"]] as const).map(([tab, label]) => (
                  <button key={tab} onClick={() => setUrlTab(tab)} style={{
                    flex: 1, padding: "7px 6px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                    cursor: "pointer", border: "none", fontFamily: "monospace", touchAction: "manipulation",
                    background: urlTab === tab ? (tab === "youtube" ? "rgba(255,80,80,0.25)" : "rgba(68,136,204,0.25)") : "rgba(255,255,255,0.04)",
                    color: urlTab === tab ? (tab === "youtube" ? "#ff8888" : "#88ccff") : "#555",
                    borderBottom: urlTab === tab ? `2px solid ${tab === "youtube" ? "#ff4444" : "#4488cc"}` : "2px solid transparent",
                  }}>{label}</button>
                ))}
              </div>

              {/* YouTube tab */}
              {urlTab === "youtube" && (
                <>
                  <div style={{ fontSize: 14, fontWeight: "bold", marginBottom: 4, color: "#ff8888" }}>🎬 Play a YouTube Video</div>
                  <div style={{ fontSize: 11, color: "#6688aa", marginBottom: 12, lineHeight: 1.5 }}>
                    Synced for everyone in the theater.<br />
                    <span style={{ color: "#ffd700" }}>Cost: 🪙 50 gold</span>
                    {myCoins < 50 && <span style={{ color: "#ff6644", marginLeft: 6 }}>— you need more gold!</span>}
                  </div>
                  {error && <div style={{ color: "#ff6688", fontSize: 11, marginBottom: 10 }}>{error}</div>}
                  <input
                    autoFocus
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !settingVideo) handleSetVideo(); }}
                    placeholder="youtube.com/watch?v=... or youtu.be/..."
                    style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: "1px solid #4488cc", borderRadius: 8, padding: "9px 11px", color: "#eee", fontSize: 16, fontFamily: "monospace", outline: "none", boxSizing: "border-box", marginBottom: 10 }}
                  />
                  <button
                    onClick={handleSetVideo}
                    disabled={settingVideo || !urlInput.trim() || myCoins < 50}
                    style={{ width: "100%", background: settingVideo || !urlInput.trim() || myCoins < 50 ? "rgba(255,80,80,0.08)" : "linear-gradient(135deg, rgba(255,80,80,0.3), rgba(200,40,40,0.2))", border: "1px solid #ff4444", color: "#ff8888", padding: "11px", borderRadius: 8, cursor: settingVideo || !urlInput.trim() || myCoins < 50 ? "default" : "pointer", fontFamily: "monospace", fontWeight: "bold", fontSize: 13, marginBottom: 8, opacity: myCoins < 50 ? 0.5 : 1, touchAction: "manipulation" }}
                  >{settingVideo ? "⏳ Setting…" : "▶ Play Video (🪙 50)"}</button>
                </>
              )}

              {/* Screen Share tab */}
              {urlTab === "screenshare" && (
                <>
                  <div style={{ fontSize: 14, fontWeight: "bold", marginBottom: 4, color: "#88ccff" }}>🖥️ Share Your Screen</div>
                  <div style={{ fontSize: 11, color: "#6688aa", marginBottom: 14, lineHeight: 1.6 }}>
                    P2P — streams directly to everyone, zero server cost.<br />
                    <span style={{ color: "#ff9944" }}>Desktop Chrome/Edge recommended to host.</span><br />
                    <span style={{ color: "#88aa66" }}>Mobile viewers can watch just fine. 📱</span>
                  </div>
                  {ssError && <div style={{ color: "#ff6688", fontSize: 11, marginBottom: 10 }}>{ssError}</div>}
                  {ssStatus === "hosting" ? (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ color: "#44ff88", fontSize: 12, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#44ff88", display: "inline-block", animation: "pulse 1.5s infinite" }} />
                        Sharing your screen — viewers can see it live
                      </div>
                      <button onClick={() => { stopScreenShare(); setShowUrlInput(false); }} style={{ width: "100%", background: "rgba(255,68,102,0.15)", border: "1px solid #ff4466", color: "#ff6688", padding: "9px", borderRadius: 8, cursor: "pointer", fontFamily: "monospace", fontWeight: "bold", touchAction: "manipulation" }}>⏹ Stop Sharing</button>
                    </div>
                  ) : (
                    <button onClick={async () => { await startScreenShare(); setShowUrlInput(false); }} style={{ width: "100%", background: "linear-gradient(135deg, rgba(68,136,204,0.25), rgba(40,80,140,0.2))", border: "1px solid #4488cc", color: "#88ccff", padding: "11px", borderRadius: 8, cursor: "pointer", fontFamily: "monospace", fontWeight: "bold", marginBottom: 10, fontSize: 13, touchAction: "manipulation" }}>
                      🖥️ Start Screen Share
                    </button>
                  )}
                </>
              )}

              <button onClick={() => { setShowUrlInput(false); setError(null); setUrlInput(""); }} style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid #333", color: "#555", padding: "7px", borderRadius: 8, cursor: "pointer", fontFamily: "monospace", touchAction: "manipulation" }}>Cancel</button>
            </div>
          )}

          {mySeat !== null && !isMobile && (
            <div style={{ position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.75)", border: "1px solid #444", borderRadius: 8, padding: "5px 16px", color: "#aaa", fontSize: 11, pointerEvents: "none", zIndex: 5 }}>
              Click your seat to stand up
            </div>
          )}
        </div>

        {/* Desktop right sidebar: jukebox + chat */}
        {!isMobile && !fsMode && (
          <div style={{ width: 260, flexShrink: 0, display: "flex", flexDirection: "column", borderLeft: "1px solid #1e0a1e" }}>
            {/* ── Harp Jukebox Panel ── */}
            <div style={{ background: "#09050d", borderBottom: "1px solid #1e0a1e", flexShrink: 0 }}>
              <div style={{ padding: "8px 10px", borderBottom: "1px solid #1e0a1e", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "#cc88ff", fontWeight: "bold" }}>🎵 Harp Jukebox</span>
                {jukeboxUrl && (
                  <div style={{ display: "flex", gap: 5 }}>
                    <button onClick={toggleJukeboxMute} title={jukeboxMuted ? "Unmute" : "Mute"} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: jukeboxMuted ? "#553355" : "#cc88ff", padding: 2, touchAction: "manipulation" }}>
                      {jukeboxMuted ? "🔇" : "🔊"}
                    </button>
                    <button onClick={handleJukeboxStop} title="Stop jukebox" style={{ background: "rgba(255,68,102,0.15)", border: "1px solid #ff4466", color: "#ff6688", padding: "2px 7px", borderRadius: 4, cursor: "pointer", fontFamily: "monospace", fontSize: 10, touchAction: "manipulation" }}>⏹ Stop</button>
                  </div>
                )}
              </div>
              {jukeboxUrl ? (
                <div style={{ padding: "6px 10px", fontSize: 11 }}>
                  <div style={{ color: "#cc88ff", marginBottom: 2 }}>♪ Now playing</div>
                  <div style={{ color: "#666", fontSize: 10 }}>queued by {jukeboxBy ?? "someone"}</div>
                </div>
              ) : (
                <div style={{ padding: "6px 8px", display: "flex", gap: 5 }}>
                  <input
                    value={jukeboxInput}
                    onChange={e => setJukeboxInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !jukeboxLoading) handleJukeboxPlay(); }}
                    placeholder="YouTube URL…"
                    style={{ flex: 1, background: "#120a18", border: "1px solid #3a1a3a", color: "#eee", borderRadius: 6, padding: "6px 8px", fontSize: 16, fontFamily: "monospace", outline: "none", minWidth: 0 }}
                  />
                  <button
                    onClick={handleJukeboxPlay}
                    disabled={jukeboxLoading || !jukeboxInput.trim()}
                    style={{ background: jukeboxLoading || !jukeboxInput.trim() ? "rgba(120,60,180,0.15)" : "rgba(150,80,220,0.3)", border: "1px solid #8855aa", color: "#cc88ff", padding: "6px 10px", borderRadius: 6, cursor: jukeboxInput.trim() && !jukeboxLoading ? "pointer" : "not-allowed", fontFamily: "monospace", fontSize: 12, fontWeight: "bold", opacity: jukeboxInput.trim() && !jukeboxLoading ? 1 : 0.5, touchAction: "manipulation", flexShrink: 0 }}>
                    {jukeboxLoading ? "…" : "▶"}
                  </button>
                </div>
              )}
            </div>

            {/* Desktop chat panel */}
        {showChat && (
          <div style={{
            flex: 1, background: "#090509",
            display: "flex", flexDirection: "column", minHeight: 0,
          }}>
            <div style={{ padding: "8px 10px", borderBottom: "1px solid #1e0e1e", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: "#cc88ff", fontWeight: "bold" }}>💬 Theater Chat</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "6px 0", minHeight: 0 }}>
              {theaterChat.length === 0 && (
                <div style={{ textAlign: "center", color: "#443344", fontSize: 11, padding: "20px 10px" }}>No messages yet. Say something! 🎬</div>
              )}
              {theaterChat.map((msg, i) => (
                <div key={`${msg.createdAt}_${i}`} className="theater-chat-msg" style={{ padding: "4px 10px", cursor: "default", borderRadius: 4, margin: "1px 4px" }}>
                  <span style={{ fontWeight: "bold", fontSize: 12, color: usernameColor(msg.username) }}>{msg.username}</span>
                  <span style={{ color: "#ccc", fontSize: 12, marginLeft: 5, wordBreak: "break-word" }}>{msg.message}</span>
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>
            <div style={{ padding: "8px", borderTop: "1px solid #1e0e1e", flexShrink: 0 }}>
              <div style={{ display: "flex", gap: 5 }}>
                <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                  placeholder="Chat..." maxLength={300}
                  style={{ flex: 1, background: "#120a12", border: "1px solid #331a33", color: "#eee", borderRadius: 6, padding: "7px 9px", fontSize: 16, fontFamily: "monospace", outline: "none" }} />
                <button onClick={handleSendChat} disabled={sendingChat || !chatInput.trim()}
                  style={{ background: "#4a0a6a", border: "1px solid #8855aa", color: "#cc88ff", padding: "7px 11px", borderRadius: 6, cursor: chatInput.trim() ? "pointer" : "not-allowed", fontFamily: "monospace", fontSize: 13, fontWeight: "bold", opacity: chatInput.trim() ? 1 : 0.5, touchAction: "manipulation" }}>↵</button>
              </div>
            </div>
          </div>
        )}
          </div>
        )}
      </div>

      {/* ── Mobile emote bar — OUTSIDE canvas, below theater ── */}
      {isMobile && !fsMode && (
        <div style={{
          display: "flex", flexDirection: "row", gap: 5, overflowX: "auto",
          padding: "6px 10px", background: "#0a0505", borderTop: "1px solid #1a0808",
          flexShrink: 0, alignItems: "center",
          WebkitOverflowScrolling: "touch" as unknown as undefined,
          scrollbarWidth: "none",
        }}>
          {EMOTES.map(emote => {
            const cdExpiry = cooldownsRef.current[emote.id] ?? 0;
            const onCd = cdExpiry > now;
            const cdLeft = onCd ? Math.ceil((cdExpiry - now) / 1000) : 0;
            return (
              <button key={emote.id} className="emote-btn" onClick={() => triggerEmote(emote.id)} disabled={onCd} style={emoteBtn(emote, onCd)} title={emote.label}>
                {onCd && <div style={{ position: "absolute", inset: 0, borderRadius: "inherit", background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#aaa", fontWeight: "bold" }}>{cdLeft}s</div>}
                <span style={{ fontSize: 22, lineHeight: 1, filter: onCd ? "grayscale(80%)" : "none" }}>{emote.emoji}</span>
                <span style={{ fontSize: 8, color: onCd ? "#555" : emote.color, fontWeight: "bold", whiteSpace: "nowrap" }}>{emote.label}</span>
              </button>
            );
          })}
          <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", userSelect: "none", padding: "5px 8px", background: "rgba(10,5,5,0.7)", border: "1px solid #2a1a1a", borderRadius: 10, flexShrink: 0, touchAction: "manipulation" }}>
            <input type="checkbox" checked={soundMuted} onChange={e => { soundMutedRef.current = e.target.checked; setSoundMuted(e.target.checked); }} style={{ accentColor: "#ff5555", width: 12, height: 12 }} />
            <span style={{ fontSize: 8, color: soundMuted ? "#555" : "#aaa" }}>{soundMuted ? "🔇" : "🔊"}</span>
          </label>
        </div>
      )}

      {/* ── Mobile chat drawer — slides up from bottom ── */}
      {isMobile && showChat && !fsMode && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          height: "52vh", background: "#090509",
          borderTop: "2px solid #2a1a2a", borderRadius: "16px 16px 0 0",
          zIndex: 40, display: "flex", flexDirection: "column",
          animation: "slideUp 0.22s ease-out",
          boxShadow: "0 -8px 40px rgba(100,0,150,0.25)",
        }}>
          {/* Handle */}
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 8, paddingBottom: 4 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "#3a2a3a" }} />
          </div>
          <div style={{ padding: "4px 12px 8px", borderBottom: "1px solid #1e0e1e", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: "#cc88ff", fontWeight: "bold" }}>💬 Theater Chat</span>
            <button onClick={() => setShowChat(false)} style={{ background: "none", border: "none", color: "#884466", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 4px", touchAction: "manipulation" }}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "6px 0", minHeight: 0 }}>
            {theaterChat.length === 0 && (
              <div style={{ textAlign: "center", color: "#443344", fontSize: 11, padding: "16px 10px" }}>No messages yet. Say something! 🎬</div>
            )}
            {theaterChat.map((msg, i) => (
              <div key={`${msg.createdAt}_${i}`} className="theater-chat-msg" style={{ padding: "4px 12px", cursor: "default", borderRadius: 4, margin: "1px 4px" }}>
                <span style={{ fontWeight: "bold", fontSize: 13, color: usernameColor(msg.username) }}>{msg.username}</span>
                <span style={{ color: "#ccc", fontSize: 13, marginLeft: 6, wordBreak: "break-word" }}>{msg.message}</span>
              </div>
            ))}
            <div ref={chatBottomRef} />
          </div>
          <div style={{ padding: "8px 10px", borderTop: "1px solid #1e0e1e", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                placeholder="Chat..." maxLength={300}
                style={{ flex: 1, background: "#120a12", border: "1px solid #331a33", color: "#eee", borderRadius: 8, padding: "9px 12px", fontSize: 16, fontFamily: "monospace", outline: "none" }} />
              <button onClick={handleSendChat} disabled={sendingChat || !chatInput.trim()}
                style={{ background: "#4a0a6a", border: "1px solid #8855aa", color: "#cc88ff", padding: "9px 14px", borderRadius: 8, cursor: chatInput.trim() ? "pointer" : "not-allowed", fontFamily: "monospace", fontSize: 15, fontWeight: "bold", opacity: chatInput.trim() ? 1 : 0.5, touchAction: "manipulation" }}>↵</button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile seat hint */}
      {isMobile && mySeat !== null && !showChat && !fsMode && (
        <div style={{ position: "absolute", bottom: 70, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.8)", border: "1px solid #444", borderRadius: 8, padding: "4px 14px", color: "#aaa", fontSize: 11, pointerEvents: "none", zIndex: 5 }}>
          Tap your seat to stand
        </div>
      )}
    </div>
  );
}
