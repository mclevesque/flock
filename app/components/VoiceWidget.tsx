"use client";
import {
  useState, useEffect, useRef, useCallback, createContext, useContext,
} from "react";
import { useSession } from "next-auth/react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface VoiceParticipant {
  user_id: string;
  username: string;
  avatar_url: string | null;
  is_muted: boolean;
  last_heartbeat: number;
}

export interface VoiceRoom {
  id: string;
  name: string;
  type: string;
  participant_count?: number;
  creator_username?: string;
  creator_id?: string;
  creator_avatar?: string | null;
}

interface RoomMessage {
  id: number;
  room_id: string;
  user_id: string | null;
  username: string;
  avatar_url: string | null;
  content: string;
  is_ai: boolean;
  created_at: string;
}

interface IncomingCall {
  id: string;
  name: string;
  dm_pair: string;
  caller_id: string;
  caller_username: string;
  caller_avatar: string | null;
}

interface PeerState {
  pc: RTCPeerConnection;
  audioEl: HTMLAudioElement;
  volume: number;
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface VoiceCtx {
  currentRoomId: string | null;
  joinRoom: (roomId: string, roomName: string) => Promise<void>;
  leaveRoom: () => void;
  startDmCall: (peerId: string, peerUsername: string) => Promise<string>;
  isInVoice: boolean;
  participantCount: number;
  openRooms: VoiceRoom[];
  openMaxi: () => void;
  /** True when any participant (including local user) is actively speaking */
  anyoneSpeaking: boolean;
  /** Whether the local mic is muted */
  isMuted: boolean;
  /** Toggle local mic mute */
  toggleMute: () => void;
}

const VoiceContext = createContext<VoiceCtx>({
  currentRoomId: null,
  joinRoom: async () => {},
  leaveRoom: () => {},
  startDmCall: async () => "",
  isInVoice: false,
  participantCount: 0,
  openRooms: [],
  openMaxi: () => {},
  anyoneSpeaking: false,
  isMuted: false,
  toggleMute: () => {},
});

export function useVoice() { return useContext(VoiceContext); }

// ─── ICE Servers ──────────────────────────────────────────────────────────────

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

// ─── Kokoro TTS singleton ─────────────────────────────────────────────────────
// Bot → preferred kokoro voice ID
const BOT_VOICES: Record<string, string> = {
  default:   "am_michael",
  professor: "bm_george",
  coach:     "am_fenrir",
  roger:     "am_puck",
  pirate:    "bm_fable",
  karen:     "af_bella",
  yoda:      "bm_george",
};

// Curated list of kokoro voices shown in the picker
const KOKORO_VOICES = [
  { id: "af_heart",   name: "Heart",   flag: "🇺🇸", gender: "F", grade: "A",  traits: "❤️" },
  { id: "af_bella",   name: "Bella",   flag: "🇺🇸", gender: "F", grade: "A-", traits: "🔥" },
  { id: "af_nicole",  name: "Nicole",  flag: "🇺🇸", gender: "F", grade: "B-", traits: "🎧" },
  { id: "am_fenrir",  name: "Fenrir",  flag: "🇺🇸", gender: "M", grade: "C+", traits: "" },
  { id: "am_michael", name: "Michael", flag: "🇺🇸", gender: "M", grade: "C+", traits: "" },
  { id: "am_puck",    name: "Puck",    flag: "🇺🇸", gender: "M", grade: "C+", traits: "" },
  { id: "bf_emma",    name: "Emma",    flag: "🇬🇧", gender: "F", grade: "B-", traits: "🚺" },
  { id: "bm_fable",   name: "Fable",   flag: "🇬🇧", gender: "M", grade: "C",  traits: "🚹" },
  { id: "bm_george",  name: "George",  flag: "🇬🇧", gender: "M", grade: "C",  traits: "" },
];

let _kokoroTTS: any = null;
let _kokoroLoadPromise: Promise<any> | null = null;

async function loadKokoro(): Promise<any> {
  if (_kokoroTTS) return _kokoroTTS;
  if (_kokoroLoadPromise) return _kokoroLoadPromise;
  _kokoroLoadPromise = (async () => {
    const { KokoroTTS } = await import("kokoro-js");
    _kokoroTTS = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
      dtype: "q8",
      device: "wasm",
    });
    return _kokoroTTS;
  })().catch(e => {
    console.error("Kokoro failed:", e);
    _kokoroLoadPromise = null;
    return null;
  });
  return _kokoroLoadPromise;
}

async function speakKokoro(text: string, voiceId: string): Promise<void> {
  try {
    const tts = await loadKokoro();
    if (!tts) throw new Error("model unavailable");
    const audio = await tts.generate(text, { voice: voiceId });
    const blob = audio.toBlob();
    const url = URL.createObjectURL(blob);
    const el = new Audio(url);
    el.onended = () => URL.revokeObjectURL(url);
    el.play().catch(() => {});
  } catch {
    // Fallback to speechSynthesis
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    }
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  return <VoiceWidgetInner>{children}</VoiceWidgetInner>;
}

export default function VoiceWidget() { return null; }

// ─── Main Implementation ──────────────────────────────────────────────────────

function VoiceWidgetInner({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  const username = session?.user?.name ?? "User";
  const avatarUrl = session?.user?.image ?? null;

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // UI state
  const [open, setOpen] = useState(false);
  const [uiSize, setUiSize] = useState<"normal" | "maxi">("normal");
  const [tab, setTab] = useState<"rooms" | "current">("rooms");

  // ── Pop-out window state ──────────────────────────────────────────────────────
  const [popupAlive, setPopupAlive] = useState(false);
  const popupWinRef = useRef<Window | null>(null);
  const popupBcRef  = useRef<BroadcastChannel | null>(null);

  // Voice state
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [currentRoomName, setCurrentRoomName] = useState("");
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [openRooms, setOpenRooms] = useState<VoiceRoom[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set());
  const [peerVolumes, setPeerVolumes] = useState<Record<string, number>>({});

  // Screen share
  const [isSharing, setIsSharing] = useState(false);
  const [remoteScreens, setRemoteScreens] = useState<Map<string, MediaStream>>(new Map());
  const screenStreamRef = useRef<MediaStream | null>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  // Room chat
  const [roomMessages, setRoomMessages] = useState<RoomMessage[]>([]);
  const [roomInput, setRoomInput] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const msgBottomRef = useRef<HTMLDivElement>(null);

  // AI assistant
  const [isRecording, setIsRecording] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTextInput, setAiTextInput] = useState("");
  const [showAiText, setShowAiText] = useState(false);
  const [micStatus, setMicStatus] = useState<"idle" | "granted" | "denied">("idle");
  const [pillPos, setPillPos] = useState<{ x: number; y: number } | null>(null);
  const pillDragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string | null>(null); // kokoro voice ID, null = use bot default
  const [kokoroStatus, setKokoroStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [selectedBot, setSelectedBot] = useState<string>("default");
  const [activeBotIds, setActiveBotIds] = useState<string[]>([]);
  const processedMsgIdsRef = useRef<Set<number>>(new Set());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Device settings
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  // Create room
  const [showCreate, setShowCreate] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");

  // Incoming calls
  const [incomingCalls, setIncomingCalls] = useState<IncomingCall[]>([]);
  const [dismissedCalls, setDismissedCalls] = useState<Set<string>>(new Set());

  // Game invites
  interface GameInvite { id: number; content: string; created_at: string; sender_id: string; sender_username: string; sender_avatar: string | null; }
  const [gameInvites, setGameInvites] = useState<GameInvite[]>([]);
  const [dismissedInvites, setDismissedInvites] = useState<Set<number>>(new Set());

  // Auto-dismiss invites after 5 minutes
  useEffect(() => {
    if (gameInvites.length === 0) return;
    const checkExpiry = () => {
      const now = Date.now();
      setDismissedInvites(prev => {
        const next = new Set(prev);
        gameInvites.forEach(inv => {
          if (now - new Date(inv.created_at).getTime() > 5 * 60 * 1000) next.add(inv.id);
        });
        return next;
      });
    };
    checkExpiry();
    const iv = setInterval(checkExpiry, 15_000);
    return () => clearInterval(iv);
  }, [gameInvites]);
  const [closingRoom, setClosingRoom] = useState<string | null>(null);

  // Floating DM panel
  const [dmOpen, setDmOpen] = useState(false);
  const [dmFriends, setDmFriends] = useState<{id:string, username:string, display_name:string|null, avatar_url:string|null}[]>([]);
  const [dmActiveUser, setDmActiveUser] = useState<{id:string, username:string, avatar_url:string|null} | null>(null);
  const [dmMessages, setDmMessages] = useState<{id:number, sender_id:string, content:string, created_at:string, username:string, avatar_url:string|null}[]>([]);
  const [dmInput, setDmInput] = useState("");
  const [dmSending, setDmSending] = useState(false);
  const dmPollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const dmMsgBottomRef = useRef<HTMLDivElement>(null);
  // Friends in watch rooms — for "Watching" badges in DM list
  const [friendWatchRooms, setFriendWatchRooms] = useState<{
    friend_user_id: string; room_id: string; room_name: string;
    is_screen_sharing: boolean; invite_only: boolean;
  }[]>([]);

  // Refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, PeerState>>(new Map());
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const signalPollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const signalAfterRef = useRef<number>(Date.now() - 5000);
  const currentRoomRef = useRef<string | null>(null);
  const pendingIce = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  // ── Device enumeration ───────────────────────────────────────────────────────
  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices?.()
      .then(devs => setDevices(devs.filter(d => d.kind === "audioinput")))
      .catch(() => {});
  }, []);

  // ── Preload kokoro when voice picker is opened ────────────────────────────────
  useEffect(() => {
    if (showVoicePicker && kokoroStatus === "idle") {
      setKokoroStatus("loading");
      loadKokoro().then(tts => {
        setKokoroStatus(tts ? "ready" : "error");
      });
    }
  }, [showVoicePicker, kokoroStatus]);

  // ── Scroll chat to bottom ────────────────────────────────────────────────────
  useEffect(() => {
    msgBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [roomMessages]);

  // ── Fetch room messages ──────────────────────────────────────────────────────
  const fetchRoomMessages = useCallback(async (roomId: string) => {
    const res = await fetch(`/api/voice/${roomId}?messages=1`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) setRoomMessages(data);
    }
  }, []);

  // ── Get local audio stream ────────────────────────────────────────────────────
  async function getLocalStream(): Promise<MediaStream> {
    if (localStreamRef.current?.active) return localStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: selectedDevice ? { exact: selectedDevice } : undefined,
        echoCancellation: true,
        noiseSuppression,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 1,
      },
    });
    localStreamRef.current = stream;

    // ── Local speaker self-detection (so YOU see your own glow) ──────────────
    try {
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let frame = 0;
      function checkLocal() {
        frame++;
        if (frame % 4 === 0) {
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((s, v) => s + v, 0) / data.length;
          if (userId) {
            setSpeakingUsers(prev => {
              const next = new Set(prev);
              avg > 8 ? next.add(userId) : next.delete(userId);
              return next;
            });
          }
        }
        requestAnimationFrame(checkLocal);
      }
      requestAnimationFrame(checkLocal);
    } catch { /* AudioContext not available — skip */ }

    return stream;
  }

  // ── Create RTCPeerConnection ──────────────────────────────────────────────────
  function createPC(peerId: string, roomId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const audioEl = new Audio();
    audioEl.autoplay = true;

    const peerState: PeerState = { pc, audioEl, volume: 1 };
    peersRef.current.set(peerId, peerState);

    pc.onicecandidate = (e) => {
      if (e.candidate && currentRoomRef.current) {
        fetch("/api/voice/signals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId, toUserId: peerId, type: "ice", payload: e.candidate.toJSON() }),
        }).catch(() => {});
      }
    };

    pc.ontrack = (e) => {
      if (e.track.kind === "video") {
        // Screen share track
        setRemoteScreens(prev => new Map([...prev, [peerId, e.streams[0]]]));
        e.track.onended = () => {
          setRemoteScreens(prev => { const n = new Map(prev); n.delete(peerId); return n; });
        };
        // Attach to video element if it exists
        setTimeout(() => {
          const el = remoteVideoRefs.current.get(peerId);
          if (el) el.srcObject = e.streams[0];
        }, 100);
        return;
      }
      // Audio track
      audioEl.srcObject = e.streams[0];
      try {
        const ctx = new AudioContext();
        const src = ctx.createMediaStreamSource(e.streams[0]);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        let frame = 0;
        function checkSpeaking() {
          frame++;
          if (frame % 4 === 0) {
            analyser.getByteFrequencyData(data);
            const avg = data.reduce((s, v) => s + v, 0) / data.length;
            setSpeakingUsers(prev => {
              const next = new Set(prev);
              if (avg > 8) next.add(peerId);
              else next.delete(peerId);
              return next;
            });
          }
          requestAnimationFrame(checkSpeaking);
        }
        requestAnimationFrame(checkSpeaking);
      } catch { /* optional */ }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        peersRef.current.delete(peerId);
        setSpeakingUsers(prev => { const n = new Set(prev); n.delete(peerId); return n; });
        setRemoteScreens(prev => { const n = new Map(prev); n.delete(peerId); return n; });
      }
    };

    // Handle renegotiation needed (e.g. when adding screen share)
    pc.onnegotiationneeded = async () => {
      if (!currentRoomRef.current) return;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await fetch("/api/voice/signals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId: currentRoomRef.current, toUserId: peerId, type: "offer",
            payload: { sdp: offer.sdp, type: offer.type },
          }),
        });
      } catch { /* ignore */ }
    };

    return pc;
  }

  // ── Join room ─────────────────────────────────────────────────────────────────
  const joinRoom = useCallback(async (roomId: string, roomName: string) => {
    if (!userId) return;
    // Guard: already in this room — don't double-join
    if (currentRoomRef.current === roomId) return;
    if (currentRoomRef.current) await doLeave();
    setIsConnecting(true);
    setCurrentRoomId(roomId);
    setCurrentRoomName(roomName);
    setTab("current");
    currentRoomRef.current = roomId;

    try {
      const stream = await getLocalStream();
      await fetch(`/api/voice/${roomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join" }),
      });

      const res = await fetch(`/api/voice/${roomId}`);
      const data = await res.json();
      const existing: Array<{ user_id: string }> = Array.isArray(data.participants) ? data.participants : [];

      for (const p of existing) {
        if (p.user_id === userId) continue;
        const pc = createPC(p.user_id, roomId);
        stream.getTracks().forEach(t => pc.addTrack(t, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await fetch("/api/voice/signals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId, toUserId: p.user_id, type: "offer",
            payload: { sdp: offer.sdp, type: offer.type },
          }),
        });
      }

      signalAfterRef.current = Date.now();
      fetchRoomMessages(roomId);
      setIsConnecting(false);
    } catch (e) {
      setIsConnecting(false);
      setCurrentRoomId(null);
      setCurrentRoomName("");
      currentRoomRef.current = null;
      const err = e as { name?: string };
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        alert("Microphone access was denied. Please allow mic access in your browser settings and try again.");
      } else if (err?.name === "NotFoundError") {
        alert("No microphone found. Connect a microphone and try again.");
      } else {
        alert("Could not join voice call. Please check your microphone and try again.");
      }
    }
  }, [userId, noiseSuppression, selectedDevice]); // eslint-disable-line

  // ── Process signals ───────────────────────────────────────────────────────────
  const processSignals = useCallback(async () => {
    const roomId = currentRoomRef.current;
    if (!roomId || !userId) return;

    const after = signalAfterRef.current;
    const res = await fetch(`/api/voice/signals?roomId=${roomId}&after=${after}`);
    if (!res.ok) return;
    const signals = await res.json();
    if (!Array.isArray(signals) || signals.length === 0) return;

    signalAfterRef.current = Date.now();
    const stream = localStreamRef.current;

    for (const sig of signals) {
      const from = sig.from_user_id as string;
      const type = sig.type as string;
      let payload: Record<string, unknown>;
      try { payload = JSON.parse(sig.payload as string); } catch { continue; }

      if (type === "offer") {
        let peerState = peersRef.current.get(from);
        if (!peerState) {
          const pc = createPC(from, roomId);
          if (stream) stream.getTracks().forEach(t => pc.addTrack(t, stream));
          peerState = peersRef.current.get(from)!;
        }
        const { pc } = peerState;
        if (pc.signalingState === "stable" || pc.signalingState === "have-remote-offer") {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(payload as unknown as RTCSessionDescriptionInit));
            const buffered = pendingIce.current.get(from) ?? [];
            for (const c of buffered) await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
            pendingIce.current.delete(from);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await fetch("/api/voice/signals", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                roomId, toUserId: from, type: "answer",
                payload: { sdp: answer.sdp, type: answer.type },
              }),
            });
          } catch (e) { console.error("Answer error", e); }
        }
      } else if (type === "answer") {
        const peerState = peersRef.current.get(from);
        if (peerState && peerState.pc.signalingState === "have-local-offer") {
          try {
            await peerState.pc.setRemoteDescription(
              new RTCSessionDescription(payload as unknown as RTCSessionDescriptionInit)
            );
            const buffered = pendingIce.current.get(from) ?? [];
            for (const c of buffered) await peerState.pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
            pendingIce.current.delete(from);
          } catch (e) { console.error("setRemoteDescription error", e); }
        }
      } else if (type === "ice") {
        const peerState = peersRef.current.get(from);
        if (peerState) {
          if (peerState.pc.remoteDescription !== null) {
            peerState.pc.addIceCandidate(new RTCIceCandidate(payload as RTCIceCandidateInit)).catch(() => {});
          } else {
            const buf = pendingIce.current.get(from) ?? [];
            buf.push(payload as RTCIceCandidateInit);
            pendingIce.current.set(from, buf);
          }
        }
      }
    }
  }, [userId]); // eslint-disable-line

  // ── Leave / cleanup ───────────────────────────────────────────────────────────
  const doLeave = useCallback(async () => {
    const roomId = currentRoomRef.current;
    if (roomId && userId) {
      fetch(`/api/voice/${roomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leave" }),
      }).catch(() => {});
    }
    stopScreenShare();
    peersRef.current.forEach(({ pc, audioEl }) => { pc.close(); audioEl.srcObject = null; });
    peersRef.current.clear();
    pendingIce.current.clear();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    currentRoomRef.current = null;
    setCurrentRoomId(null);
    setCurrentRoomName("");
    setParticipants([]);
    setSpeakingUsers(new Set());
    setRemoteScreens(new Map());
    setRoomMessages([]);
    setActiveBotIds([]);
    processedMsgIdsRef.current.clear();
    setTab("rooms");
    setUiSize("normal");
  }, [userId]); // eslint-disable-line

  const leaveRoom = useCallback(() => { doLeave(); }, [doLeave]);

  // ── Disconnect guard: warn before leaving page while in voice ─────────────────
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (!currentRoomRef.current) return;
      e.preventDefault();
      e.returnValue = "You'll be disconnected from voice chat if you leave.";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, []);

  // ── Start DM call ─────────────────────────────────────────────────────────────
  const startDmCall = useCallback(async (peerId: string, peerUsername: string): Promise<string> => {
    if (!userId) return "";

    // Already in voice together — just open the widget, no need to call again
    if (currentRoomRef.current && participants.some(p => p.user_id === peerId)) {
      setOpen(true);
      setTab("current");
      return currentRoomRef.current;
    }

    const dmPair = [userId, peerId].sort().join(":");
    let roomId = "";
    try {
      const res = await fetch(`/api/voice?dm_pair=${encodeURIComponent(dmPair)}`);
      const rooms = await res.json();
      const existing = Array.isArray(rooms) ? rooms.find((r: VoiceRoom & { dm_pair?: string }) => r.dm_pair === dmPair) : null;
      if (existing) {
        roomId = existing.id;
      } else {
        const cres = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: `Call with @${peerUsername}`, type: "dm", dmPair }),
        });
        const { id } = await cres.json();
        roomId = id;
      }
    } catch { return ""; }
    await joinRoom(roomId, `Call with @${peerUsername}`);
    setOpen(true);
    return roomId;
  }, [userId, joinRoom, participants]); // eslint-disable-line

  // ── Screen share ──────────────────────────────────────────────────────────────
  async function startScreenShare() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = stream;
      setIsSharing(true);
      // Add video tracks to all existing peer connections
      peersRef.current.forEach(({ pc }) => {
        stream.getVideoTracks().forEach(t => pc.addTrack(t, stream));
      });
      stream.getVideoTracks()[0].onended = () => stopScreenShare();
    } catch { /* user cancelled */ }
  }

  function stopScreenShare() {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    setIsSharing(false);
    // Remove video senders
    peersRef.current.forEach(({ pc }) => {
      pc.getSenders().filter(s => s.track?.kind === "video").forEach(s => {
        try { pc.removeTrack(s); } catch { /* ignore */ }
      });
    });
  }

  // ── AI TTS speaker ────────────────────────────────────────────────────────────
  function speakWithBestVoice(text: string, voiceName: string | null, botId?: string) {
    const voiceId = voiceName ?? BOT_VOICES[botId ?? selectedBot] ?? "af_heart";
    speakKokoro(text, voiceId);
    // Warm up kokoro if not yet loaded
    if (kokoroStatus === "idle") {
      setKokoroStatus("loading");
      loadKokoro().then(tts => setKokoroStatus(tts ? "ready" : "error"));
    }
  }

  function previewVoice(voiceId: string) {
    speakKokoro("Hey there! I'm your AI assistant — nice to meet you.", voiceId);
  }

  // ── AI push-to-talk ───────────────────────────────────────────────────────────
  // Temporary mic stream used when not in a voice room
  const tempMicStreamRef = useRef<MediaStream | null>(null);

  async function startRecording() {
    let stream = localStreamRef.current;
    // If not in a voice room, request a temporary mic stream
    if (!stream) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: selectedDevice ? { exact: selectedDevice } : undefined,
            echoCancellation: true,
            noiseSuppression,
            autoGainControl: true,
          },
        });
        tempMicStreamRef.current = stream;
      } catch {
        setMicStatus("denied");
        return;
      }
    }
    setMicStatus("granted");
    try {
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch { /* ignore */ }
  }

  async function stopRecordingAndAsk() {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    setIsRecording(false);
    await new Promise<void>(resolve => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });
    const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    // Release temp mic stream if we opened one just for this recording
    if (tempMicStreamRef.current) {
      tempMicStreamRef.current.getTracks().forEach(t => t.stop());
      tempMicStreamRef.current = null;
    }
    if (audioBlob.size < 1000) return; // too short
    setAiLoading(true);
    try {
      const form = new FormData();
      form.append("audio", audioBlob, "question.webm");
      form.append("roomId", currentRoomRef.current ?? "");
      form.append("bot", selectedBot);
      const res = await fetch("/api/voice/ai", { method: "POST", body: form });
      if (res.ok) {
        const data = await res.json();
        if (currentRoomRef.current) fetchRoomMessages(currentRoomRef.current);
        // TTS — speak the answer locally
        if (data.answer) speakWithBestVoice(data.answer, selectedVoiceName);
      }
    } catch { /* ignore */ } finally {
      setAiLoading(false);
    }
  }

  async function sendAiTextQuestion() {
    const q = aiTextInput.trim();
    if (!q) return;
    setAiTextInput("");
    setShowAiText(false);
    setAiLoading(true);
    try {
      const res = await fetch("/api/voice/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, roomId: currentRoomRef.current ?? "", bot: selectedBot }),
      });
      if (res.ok) {
        const data = await res.json();
        if (currentRoomRef.current) fetchRoomMessages(currentRoomRef.current);
        if (data.answer) speakWithBestVoice(data.answer, selectedVoiceName);
      }
    } catch { /* ignore */ } finally {
      setAiLoading(false);
    }
  }

  // ── Room chat send ────────────────────────────────────────────────────────────
  async function sendRoomMessage() {
    const text = roomInput.trim();
    if (!text || !currentRoomRef.current) return;
    setSendingMsg(true);
    setRoomInput("");
    try {
      await fetch(`/api/voice/${currentRoomRef.current}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sendMessage", content: text }),
      });
      fetchRoomMessages(currentRoomRef.current);
    } catch { /* ignore */ } finally {
      setSendingMsg(false);
    }
  }

  // ── Heartbeat (presence / online status) ──────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const send = () => fetch("/api/heartbeat", { method: "POST" }).catch(() => {});
    send(); // immediate on load
    const iv = setInterval(send, 60_000);
    return () => clearInterval(iv);
  }, [userId]);

  // ── Pop-out window management ─────────────────────────────────────────────────
  function openPopup() {
    const [w, h] = [360, 580];
    const left = window.screenX + window.outerWidth - w - 20;
    const top  = window.screenY + 80;
    const params = currentRoomId
      ? `?roomId=${encodeURIComponent(currentRoomId)}&roomName=${encodeURIComponent(currentRoomName)}`
      : "";
    const win = window.open(
      `/voice-popup${params}`,
      "flock-voice-popup",
      `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no`
    );
    if (!win) { alert("Pop-up blocked — please allow pop-ups for this site."); return; }
    popupWinRef.current = win;

    // BroadcastChannel to relay commands and receive state
    if (popupBcRef.current) popupBcRef.current.close();
    const bc = new BroadcastChannel("flock-voice");
    popupBcRef.current = bc;

    bc.onmessage = (e) => {
      const msg = e.data as { type: string; roomId?: string | null; participants?: VoiceParticipant[]; speaking?: string[]; };
      if (msg.type === "ready") {
        setPopupAlive(true);
        // If we're currently in voice, hand off to popup then leave here
        if (currentRoomRef.current) {
          bc.postMessage({ type: "join", roomId: currentRoomRef.current, roomName: currentRoomName });
          setTimeout(() => doLeave(), 800); // short delay so popup can join first
        }
      } else if (msg.type === "state") {
        // Mirror popup's voice state in main window for context providers
        if (msg.roomId) {
          setCurrentRoomId(msg.roomId);
          if (Array.isArray(msg.participants)) setParticipants(msg.participants);
          if (Array.isArray(msg.speaking))     setSpeakingUsers(new Set(msg.speaking));
        }
      } else if (msg.type === "closing") {
        setPopupAlive(false);
        popupWinRef.current = null;
        // If they were in a room, silently rejoin in the main window
        if (msg.roomId) {
          const savedName = currentRoomName || "Voice";
          setTimeout(() => joinRoom(msg.roomId as string, savedName), 300);
        }
      }
    };

    // Poll to detect popup closed via title-bar X
    const pollTimer = setInterval(() => {
      if (win.closed) {
        clearInterval(pollTimer);
        setPopupAlive(false);
        popupWinRef.current = null;
        bc.close();
      }
    }, 1000);
  }

  function focusPopup() {
    if (popupWinRef.current && !popupWinRef.current.closed) {
      popupWinRef.current.focus();
    } else {
      openPopup();
    }
  }

  // ── Persist current room to sessionStorage (survives refresh) ─────────────────
  useEffect(() => {
    if (currentRoomId && currentRoomName) {
      sessionStorage.setItem("flock_voice_room", JSON.stringify({ id: currentRoomId, name: currentRoomName }));
      setOpen(true); // keep widget open across navigation
    } else if (!currentRoomId && !popupAlive) {
      sessionStorage.removeItem("flock_voice_room");
    }
  }, [currentRoomId, currentRoomName, popupAlive]); // eslint-disable-line

  // ── Auto-rejoin saved room on page load / refresh ─────────────────────────────
  useEffect(() => {
    if (!userId || currentRoomRef.current) return;
    const saved = sessionStorage.getItem("flock_voice_room");
    if (!saved) return;
    try {
      const { id, name } = JSON.parse(saved) as { id: string; name: string };
      if (!id) return;
      // Small delay so the session + WS layer is ready
      const t = setTimeout(async () => {
        try {
          const res = await fetch(`/api/voice/${id}`);
          if (res.ok) {
            await joinRoom(id, name);
            setOpen(true);
          } else {
            sessionStorage.removeItem("flock_voice_room");
          }
        } catch {
          sessionStorage.removeItem("flock_voice_room");
        }
      }, 800);
      return () => clearTimeout(t);
    } catch { sessionStorage.removeItem("flock_voice_room"); }
  }, [userId]); // eslint-disable-line

  // ── Resume audio after visibility change / tab switch ─────────────────────────
  useEffect(() => {
    function handleVisible() {
      if (document.visibilityState !== "visible") return;
      // Resume any paused audio elements (browser may have suspended them)
      peersRef.current.forEach(({ audioEl }) => {
        if (audioEl.paused && audioEl.srcObject) {
          audioEl.play().catch(() => {});
        }
      });
    }
    document.addEventListener("visibilitychange", handleVisible);
    // Also resume immediately on focus (handles alt-tab, click back to window)
    window.addEventListener("focus", handleVisible);
    return () => {
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("focus", handleVisible);
    };
  }, []);

  // ── Auto-join from URL ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const params = new URLSearchParams(window.location.search);
    const voiceParam = params.get("voice");
    if (voiceParam && !currentRoomRef.current) {
      setTimeout(async () => {
        try {
          const res = await fetch(`/api/voice/${voiceParam}`);
          if (res.ok) {
            const { room } = await res.json();
            joinRoom(voiceParam, room?.name ?? "Voice Room");
            setOpen(true);
          }
        } catch { /* ignore */ }
      }, 800);
    }
  }, [userId]); // eslint-disable-line

  // ── Polling ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      const roomId = currentRoomRef.current;
      if (!roomId) {
        fetch("/api/voice").then(r => r.json()).then(d => {
          if (Array.isArray(d)) setOpenRooms(d);
        }).catch(() => {});
        if (userId) {
          fetch("/api/voice?incoming=1").then(r => r.json()).then(d => {
            if (Array.isArray(d)) setIncomingCalls(d);
          }).catch(() => {});
          fetch("/api/messages/invites").then(r => r.json()).then(d => {
            if (Array.isArray(d)) setGameInvites(d);
          }).catch(() => {});
        }
        return;
      }
      fetch(`/api/voice/${roomId}`).then(r => r.json()).then(({ participants: pp }) => {
        if (Array.isArray(pp)) setParticipants(pp);
      }).catch(() => {});
      // Poll messages when in maxi mode or always
      fetchRoomMessages(roomId);
    }, 5000);

    signalPollRef.current = setInterval(processSignals, 3000);

    fetch("/api/voice").then(r => r.json()).then(d => {
      if (Array.isArray(d)) setOpenRooms(d);
    }).catch(() => {});

    return () => {
      clearInterval(pollRef.current);
      clearInterval(signalPollRef.current);
    };
  }, [processSignals, userId, fetchRoomMessages]);

  // ── Close voice room ──────────────────────────────────────────────────────────
  async function handleCloseRoom(roomId: string) {
    setClosingRoom(roomId);
    try {
      await fetch(`/api/voice/${roomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close" }),
      });
      if (currentRoomRef.current === roomId) doLeave();
      setOpenRooms(prev => prev.filter(r => r.id !== roomId));
    } catch { /* ignore */ }
    setClosingRoom(null);
  }

  // ── Mute ──────────────────────────────────────────────────────────────────────
  async function toggleMute() {
    const stream = localStreamRef.current;
    if (stream) {
      const newMuted = !isMuted;
      stream.getAudioTracks().forEach(t => { t.enabled = !newMuted; });
      setIsMuted(newMuted);
      if (currentRoomRef.current && userId) {
        fetch(`/api/voice/${currentRoomRef.current}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "mute", muted: newMuted }),
        }).catch(() => {});
      }
    }
  }

  // ── Create room ───────────────────────────────────────────────────────────────
  async function handleCreateRoom() {
    if (!userId) return;
    const name = newRoomName.trim() || `${username}'s Room`;
    const res = await fetch("/api/voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const { id } = await res.json();
    if (id) {
      setNewRoomName("");
      setShowCreate(false);
      await joinRoom(id, name);
    }
  }

  // ── Per-peer volume ────────────────────────────────────────────────────────────
  function setPeerVolume(peerId: string, vol: number) {
    const ps = peersRef.current.get(peerId);
    if (ps) ps.audioEl.volume = vol;
    setPeerVolumes(prev => ({ ...prev, [peerId]: vol }));
  }

  async function reinitStream() {
    if (!currentRoomRef.current) return;
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    try {
      const stream = await getLocalStream();
      peersRef.current.forEach(({ pc }) => {
        const sender = pc.getSenders().find(s => s.track?.kind === "audio");
        if (sender) sender.replaceTrack(stream.getAudioTracks()[0]).catch(() => {});
      });
    } catch { /* ignore */ }
  }

  // ── Bot participants ──────────────────────────────────────────────────────────
  function addBotToRoom(botId: string) {
    if (activeBotIds.includes(botId) || activeBotIds.length >= 3) return;
    setActiveBotIds(prev => [...prev, botId]);
  }
  function removeBotFromRoom(botId: string) {
    setActiveBotIds(prev => prev.filter(id => id !== botId));
  }

  // Auto-respond: bots reply to new human messages in room chat
  useEffect(() => {
    if (activeBotIds.length === 0 || roomMessages.length === 0) return;
    const newHuman = roomMessages.filter(
      m => !m.is_ai && !processedMsgIdsRef.current.has(m.id) && !m.content.startsWith("❓")
    );
    if (newHuman.length === 0) return;
    newHuman.forEach(m => processedMsgIdsRef.current.add(m.id));
    newHuman.forEach(msg => {
      activeBotIds.forEach((botId, i) => {
        const delay = 1200 + i * 2200 + Math.random() * 800;
        setTimeout(async () => {
          const roomId = currentRoomRef.current;
          if (!roomId) return;
          const res = await fetch("/api/voice/ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: msg.content, roomId, bot: botId }),
          }).catch(() => null);
          if (res?.ok) {
            const data = await res.json();
            fetchRoomMessages(roomId);
            if (data.answer) speakWithBestVoice(data.answer, selectedVoiceName);
          }
        }, delay);
      });
    });
  }, [roomMessages]); // eslint-disable-line

  // ── Open maxi externally ──────────────────────────────────────────────────────
  const openMaxi = useCallback(() => {
    setOpen(true);
    setUiSize("maxi");
  }, []);

  // ── Floating DM panel ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (dmOpen && userId) {
      if (dmFriends.length === 0) {
        fetch("/api/friends").then(r => r.json()).then(data => {
          if (Array.isArray(data)) setDmFriends(data);
        }).catch(() => {});
      }
      // Refresh which friends are currently in watch rooms
      fetch("/api/friends/watch-rooms").then(r => r.json()).then(data => {
        if (Array.isArray(data)) setFriendWatchRooms(data);
      }).catch(() => {});
    }
  }, [dmOpen, userId]); // eslint-disable-line

  useEffect(() => {
    if (!dmActiveUser) return;
    const load = async () => {
      const msgs = await fetch(`/api/messages?with=${dmActiveUser.id}`).then(r => r.json()).catch(() => []);
      if (Array.isArray(msgs)) setDmMessages(msgs.slice(-40));
    };
    load();
    dmPollRef.current = setInterval(load, 3000);
    return () => clearInterval(dmPollRef.current);
  }, [dmActiveUser]); // eslint-disable-line

  useEffect(() => {
    dmMsgBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [dmMessages]);

  async function sendDm() {
    if (!dmActiveUser || !dmInput.trim() || !userId) return;
    setDmSending(true);
    const text = dmInput.trim();
    setDmInput("");
    try {
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: dmActiveUser.id, content: text }),
      });
      const msgs = await fetch(`/api/messages?with=${dmActiveUser.id}`).then(r => r.json()).catch(() => []);
      if (Array.isArray(msgs)) setDmMessages(msgs.slice(-40));
    } catch { /* ignore */ } finally {
      setDmSending(false);
    }
  }

  // ── Bot definitions ───────────────────────────────────────────────────────────
  const BOTS = [
    { id: "default",   emoji: "🤖", label: "Default AI",         desc: "Helpful & concise" },
    { id: "professor", emoji: "🎓", label: "The Professor",      desc: "Deep, insightful explanations" },
    { id: "coach",     emoji: "💪", label: "Coach",              desc: "Motivating & action-focused" },
    { id: "roger",     emoji: "🥛", label: "Roger",              desc: "Raw milk conspiracy theorist" },
    { id: "pirate",    emoji: "🏴‍☠️", label: "Captain Blackbeak", desc: "Salty pirate speak" },
    { id: "karen",     emoji: "💅", label: "Karen",              desc: "Perpetually outraged suburbanite" },
    { id: "yoda",      emoji: "🟢", label: "Yoda",               desc: "Speak backwards, I do" },
  ];

  // ────────────────────────────────────────────────────────────────────────────
  // UI
  // ────────────────────────────────────────────────────────────────────────────

  if (!userId) return <>{children}</>;

  const inVoice = !!currentRoomId;
  const myParticipant = participants.find(p => p.user_id === userId);
  const isMaxi = open && uiSize === "maxi";

  // ── If popup is alive, render children + a small "voice is in popup" pill ─────
  if (popupAlive) {
    return (
      <VoiceContext.Provider value={{ currentRoomId, joinRoom, leaveRoom, startDmCall, isInVoice: inVoice, participantCount: participants.length, openRooms, openMaxi, anyoneSpeaking: speakingUsers.size > 0, isMuted, toggleMute }}>
        {children}
        <div
          onClick={focusPopup}
          style={{
            position: "fixed", bottom: 16, right: 16, zIndex: 9500,
            background: "rgba(13,15,20,0.94)", backdropFilter: "blur(12px)",
            border: "1px solid rgba(124,58,237,0.45)", borderRadius: 50,
            padding: "8px 16px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8,
            boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
            fontSize: 13, color: "#c4b5fd", fontWeight: 700,
            transition: "all 0.2s ease",
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(124,58,237,0.8)")}
          onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(124,58,237,0.45)")}
          title="Click to focus voice window"
        >
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#7c3aed", boxShadow: "0 0 8px #7c3aed", animation: "voicePulse 2s ease infinite" }} />
          🔊 Voice pop-out ↗
        </div>
        <style>{`@keyframes voicePulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      </VoiceContext.Provider>
    );
  }

  // Shared panel content (used in both normal and maxi)
  const participantsPanel = (
    <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
      <div style={{ padding: "4px 16px 8px", fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
        In Voice · {participants.length}
      </div>
      {participants.map(p => {
        const isSpeaking = speakingUsers.has(p.user_id) && !p.is_muted;
        const peerVol = peerVolumes[p.user_id] ?? 1;
        return (
          <div key={p.user_id} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)",
          }}>
            <div style={{ position: "relative" }}>
              <img
                src={p.avatar_url ?? `https://api.dicebear.com/9.x/pixel-art/svg?seed=${p.username}`}
                alt={p.username}
                style={{
                  width: 36, height: 36, borderRadius: "50%",
                  border: `2px solid ${isSpeaking ? "#4ade80" : "rgba(255,255,255,0.1)"}`,
                  boxShadow: isSpeaking ? "0 0 10px rgba(74,222,128,0.6)" : "none",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                }}
              />
              {p.is_muted && (
                <span style={{
                  position: "absolute", bottom: -2, right: -2,
                  background: "#ef4444", borderRadius: "50%",
                  width: 15, height: 15, display: "flex",
                  alignItems: "center", justifyContent: "center", fontSize: 8,
                }}>🔇</span>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 600,
                color: p.user_id === userId ? "#a78bfa" : "#e8eaf6",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                @{p.username}{p.user_id === userId ? " (you)" : ""}
              </div>
              {isSpeaking && <div style={{ fontSize: 10, color: "#4ade80" }}>speaking…</div>}
            </div>
            {p.user_id !== userId && (
              <input
                type="range" min={0} max={1} step={0.1}
                value={peerVol}
                onChange={e => setPeerVolume(p.user_id, Number(e.target.value))}
                title={`Volume: ${Math.round(peerVol * 100)}%`}
                style={{ width: 52, accentColor: "#7c3aed" }}
              />
            )}
          </div>
        );
      })}


      {/* Remote screen share video */}
      {remoteScreens.size > 0 && Array.from(remoteScreens.entries()).map(([peerId, stream]) => (
        <div key={peerId} style={{ padding: "8px 16px" }}>
          <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4 }}>
            📺 {participants.find(p => p.user_id === peerId)?.username ?? peerId}'s screen
          </div>
          <video
            ref={el => {
              if (el) { remoteVideoRefs.current.set(peerId, el); el.srcObject = stream; }
            }}
            autoPlay
            muted
            style={{ width: "100%", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "#000" }}
          />
        </div>
      ))}

      {/* Local screen share indicator */}
      {isSharing && screenStreamRef.current && (
        <div style={{ padding: "8px 16px" }}>
          <div style={{ fontSize: 10, color: "#fbbf24", marginBottom: 4 }}>📺 Sharing your screen</div>
          <video
            ref={el => { if (el && screenStreamRef.current) el.srcObject = screenStreamRef.current; }}
            autoPlay
            muted
            style={{ width: "100%", borderRadius: 8, border: "1px solid rgba(251,191,36,0.4)", background: "#000", maxHeight: 180, objectFit: "contain" }}
          />
        </div>
      )}
    </div>
  );

  const controlsBar = (
    <div style={{
      padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.08)",
      display: "flex", gap: 6, flexWrap: "wrap",
    }}>
      <CtrlBtn onClick={toggleMute} active={isMuted} color={isMuted ? "#ef4444" : "#4ade80"} title={isMuted ? "Unmute" : "Mute"}>
        {isMuted ? "🔇" : "🎙️"}
      </CtrlBtn>
      <CtrlBtn
        onClick={isSharing ? stopScreenShare : startScreenShare}
        active={isSharing}
        color={isSharing ? "#fbbf24" : "#60a5fa"}
        title={isSharing ? "Stop sharing" : "Share screen"}
      >
        {isSharing ? "🖥️✓" : "🖥️"}
      </CtrlBtn>
      <CtrlBtn onClick={leaveRoom} color="#ef4444" title="Leave">
        📵
      </CtrlBtn>
      <CtrlBtn onClick={focusPopup} color={popupAlive ? "#4ade80" : "#94a3b8"} title={popupAlive ? "Voice is in pop-out window — click to focus it" : "Pop out voice to a separate window"}>
        {popupAlive ? "🔊↗" : "↗"}
      </CtrlBtn>
      <button
        onClick={() => handleCloseRoom(currentRoomId!)}
        title="Close room for everyone"
        style={{
          flex: "0 0 auto", padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)",
          background: "rgba(239,68,68,0.1)", color: "#f87171",
          fontSize: 11, fontWeight: 700, cursor: "pointer",
        }}
      >
        ✕ End
      </button>
    </div>
  );

  // Voice picker panel
  const voicePickerPanel = showVoicePicker && (
    <div style={{
      borderTop: "1px solid rgba(255,255,255,0.06)",
      background: "rgba(10,12,18,0.95)",
      maxHeight: 300, overflowY: "auto",
    }}>
      {/* Bot picker */}
      <div style={{ padding: "8px 14px 4px", fontSize: 10, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
        Choose Bot
      </div>
      {BOTS.map(b => {
        const isActive = activeBotIds.includes(b.id);
        const isSelected = selectedBot === b.id;
        return (
          <div
            key={b.id}
            onClick={() => setSelectedBot(b.id)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "7px 14px", cursor: "pointer",
              background: isSelected ? "rgba(124,58,237,0.15)" : "transparent",
              borderLeft: `2px solid ${isSelected ? "#7c3aed" : "transparent"}`,
            }}
          >
            <span style={{ fontSize: 18 }}>{b.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: isSelected ? "#a78bfa" : "#e8eaf6" }}>{b.label}</div>
              <div style={{ fontSize: 10, color: "#6b7280" }}>{b.desc}</div>
            </div>
            {/* Add/remove from room */}
            {inVoice && (
              <button
                onClick={e => { e.stopPropagation(); isActive ? removeBotFromRoom(b.id) : addBotToRoom(b.id); }}
                title={isActive ? "Remove from room" : "Add to room"}
                style={{
                  background: isActive ? "rgba(239,68,68,0.15)" : "rgba(74,222,128,0.12)",
                  border: `1px solid ${isActive ? "rgba(239,68,68,0.3)" : "rgba(74,222,128,0.25)"}`,
                  borderRadius: 6, padding: "2px 8px",
                  color: isActive ? "#f87171" : "#4ade80",
                  fontSize: 10, fontWeight: 700, cursor: "pointer",
                }}
              >
                {isActive ? "− Room" : "+ Room"}
              </button>
            )}
            {isSelected && <span style={{ fontSize: 10, color: "#7c3aed" }}>●</span>}
          </div>
        );
      })}

      <div style={{ padding: "8px 14px 4px", fontSize: 10, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, borderTop: "1px solid rgba(255,255,255,0.04)", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
        Choose Voice
        {kokoroStatus === "loading" && <span style={{ fontSize: 9, color: "#fbbf24", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>⏳ loading model…</span>}
        {kokoroStatus === "ready" && <span style={{ fontSize: 9, color: "#4ade80", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>✓ neural</span>}
        {kokoroStatus === "error" && <span style={{ fontSize: 9, color: "#f87171", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>⚠ fallback</span>}
      </div>
      {/* Auto = use bot-specific default voice */}
      <div
        onClick={() => setSelectedVoiceName(null)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "6px 14px", cursor: "pointer",
          background: selectedVoiceName === null ? "rgba(124,58,237,0.15)" : "transparent",
          borderLeft: `2px solid ${selectedVoiceName === null ? "#7c3aed" : "transparent"}`,
        }}
      >
        <span style={{ flex: 1, fontSize: 12, color: selectedVoiceName === null ? "#a78bfa" : "#9ca3af", fontWeight: 600 }}>
          ✨ Auto (per-bot voice)
        </span>
        {selectedVoiceName === null && <span style={{ fontSize: 10, color: "#7c3aed" }}>●</span>}
      </div>
      {KOKORO_VOICES.map(v => {
        const isSelected = selectedVoiceName === v.id;
        return (
          <div
            key={v.id}
            onClick={() => setSelectedVoiceName(v.id)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 14px", cursor: "pointer",
              background: isSelected ? "rgba(124,58,237,0.15)" : "transparent",
              borderLeft: `2px solid ${isSelected ? "#7c3aed" : "transparent"}`,
            }}
          >
            <span style={{ fontSize: 13 }}>{v.flag}</span>
            <span style={{ fontSize: 11, color: "#6b7280" }}>{v.gender}</span>
            <span style={{ flex: 1, fontSize: 12, color: isSelected ? "#a78bfa" : "#e8eaf6", fontWeight: isSelected ? 700 : 400 }}>
              {v.name} {v.traits}
            </span>
            <span style={{ fontSize: 9, color: v.grade.startsWith("A") ? "#4ade80" : v.grade.startsWith("B") ? "#60a5fa" : "#6b7280", fontWeight: 700 }}>{v.grade}</span>
            <button
              onClick={e => { e.stopPropagation(); previewVoice(v.id); }}
              title="Preview"
              style={{
                background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 4,
                padding: "2px 6px", color: "#6b7280", fontSize: 10, cursor: "pointer",
              }}
            >▶</button>
          </div>
        );
      })}
    </div>
  );

  // AI input bar
  const aiBar = showAiText && (
    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      {micStatus === "denied" && (
        <div style={{ padding: "5px 14px", background: "rgba(239,68,68,0.12)", fontSize: 11, color: "#fca5a5", display: "flex", alignItems: "center", gap: 6 }}>
          🚫 Mic blocked — click the 🔒 icon in your browser bar and allow microphone
        </div>
      )}
      {micStatus === "idle" && (
        <div style={{ padding: "5px 14px", background: "rgba(251,191,36,0.08)", fontSize: 11, color: "#fde68a" }}>
          ⏳ Requesting mic access…
        </div>
      )}
    <div style={{ padding: "6px 14px", display: "flex", gap: 6 }}>
      <div
        onMouseDown={() => { startRecording(); }}
        onMouseUp={stopRecordingAndAsk}
        onTouchStart={e => { e.preventDefault(); startRecording(); }}
        onTouchEnd={stopRecordingAndAsk}
        title={micStatus === "denied" ? "Mic blocked — allow in browser settings" : "Hold to speak your question"}
        style={{
          flexShrink: 0,
          background: micStatus === "denied" ? "rgba(239,68,68,0.15)" : isRecording ? "rgba(239,68,68,0.3)" : "rgba(167,139,250,0.2)",
          border: `1px solid ${micStatus === "denied" ? "#ef4444" : isRecording ? "#ef4444" : "rgba(167,139,250,0.4)"}`,
          borderRadius: 8, padding: "8px 10px", cursor: micStatus === "denied" ? "not-allowed" : "pointer",
          fontSize: 16, userSelect: "none",
          animation: isRecording ? "pulse 0.8s infinite" : "none",
          opacity: micStatus === "denied" ? 0.5 : 1,
        }}
      >
        {micStatus === "denied" ? "🚫" : "🎤"}
      </div>
      <input
        value={aiTextInput}
        onChange={e => setAiTextInput(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") sendAiTextQuestion(); }}
        placeholder="Ask AI anything…"
        style={{
          flex: 1, background: "#1a1d26", border: "1px solid #2a2d3a",
          borderRadius: 8, padding: "8px 10px", color: "#e8eaf6", fontSize: 16,
          outline: "none", fontFamily: "inherit",
        }}
      />
      <button
        onClick={sendAiTextQuestion}
        disabled={!aiTextInput.trim() || aiLoading}
        style={{
          background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
          border: "none", borderRadius: 8, padding: "0 12px",
          color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
        }}
      >
        Ask
      </button>
    </div>
    </div>
  );

  // Room chat panel
  const chatPanel = (
    <div style={{
      display: "flex", flexDirection: "column",
      ...(isMaxi ? { flex: 1, minHeight: 0 } : { height: 220, flexShrink: 0 }),
      borderTop: isMaxi ? "none" : "1px solid rgba(255,255,255,0.08)",
    }}>
      <div style={{ padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase" }}>
        Room Chat
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
        {roomMessages.length === 0 && (
          <div style={{ fontSize: 12, color: "#374151", textAlign: "center", padding: "16px 0" }}>No messages yet</div>
        )}
        {roomMessages.map(msg => (
          <div key={msg.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <img
              src={msg.avatar_url ?? `https://api.dicebear.com/9.x/pixel-art/svg?seed=${msg.username}`}
              style={{ width: 22, height: 22, borderRadius: 5, flexShrink: 0, marginTop: 2 }}
              alt=""
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: msg.is_ai ? "#a78bfa" : msg.user_id === userId ? "#60a5fa" : "#9ca3af",
                marginRight: 6,
              }}>
                {msg.username}
              </span>
              <span style={{ fontSize: 13, color: msg.is_ai ? "#c4b5fd" : "#e8eaf6", wordBreak: "break-word" }}>
                {msg.content}
              </span>
            </div>
          </div>
        ))}
        <div ref={msgBottomRef} />
      </div>
      <div style={{ padding: "8px 12px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 6 }}>
        <input
          value={roomInput}
          onChange={e => setRoomInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendRoomMessage(); } }}
          placeholder="Message…"
          style={{
            flex: 1, background: "#1a1d26", border: "1px solid #2a2d3a",
            borderRadius: 8, padding: "7px 10px", color: "#e8eaf6", fontSize: 16,
            outline: "none", fontFamily: "inherit",
          }}
        />
        <button
          onClick={sendRoomMessage}
          disabled={sendingMsg || !roomInput.trim()}
          style={{
            background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
            border: "none", borderRadius: 8, padding: "0 12px",
            color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}
        >
          →
        </button>
      </div>
    </div>
  );

  return (
    <VoiceContext.Provider value={{
      currentRoomId, joinRoom, leaveRoom, startDmCall,
      isInVoice: inVoice,
      participantCount: participants.length,
      openRooms,
      openMaxi,
      anyoneSpeaking: speakingUsers.size > 0,
      isMuted,
      toggleMute,
    }}>
      {children}

      {/* ── Game invite banners — top-left, expire after 5 min ───────────────── */}
      {gameInvites.filter(inv => !dismissedInvites.has(inv.id)).length > 0 && (
        <div style={{
          position: "fixed", top: 70, left: 16, zIndex: 9400,
          display: "flex", flexDirection: "column", gap: 8,
          pointerEvents: "none",
        }}>
          {gameInvites.filter(inv => !dismissedInvites.has(inv.id)).map(inv => {
            const isSnes = inv.content.startsWith("[snes:");
            const isChess = inv.content.startsWith("[chess:");
            const isPoker = inv.content.startsWith("[poker:");
            const isQuiz = inv.content.startsWith("[quiz:");
            const emoji = isSnes ? "🕹️" : isChess ? "♟️" : isPoker ? "🃏" : isQuiz ? "🧠" : "🎮";
            const label = isSnes ? "Arena invite" : isChess ? "Chess challenge" : isPoker ? "Poker invite" : isQuiz ? "Quiz challenge" : "Game invite";
            const color = isSnes ? "124,58,237" : isChess ? "74,144,217" : isPoker ? "74,217,144" : "234,179,8";
            const roomId = inv.content.slice(isSnes ? 6 : isChess ? 7 : isPoker ? 7 : 6, -1);
            const href = isSnes ? `/emulator?joinRoom=${roomId}` : isChess ? `/chess/${roomId}` : isPoker ? `/poker/${roomId}` : `/quiz/${roomId}`;
            const msOld = Date.now() - new Date(inv.created_at).getTime();
            const secsLeft = Math.max(0, Math.ceil((5 * 60 * 1000 - msOld) / 1000));
            const minsLeft = Math.ceil(secsLeft / 60);
            return (
              <div key={inv.id} style={{
                width: "min(300px, calc(100vw - 32px)",
                background: "rgba(13,15,20,0.97)", backdropFilter: "blur(16px)",
                border: `1px solid rgba(${color},0.4)`,
                borderRadius: 14, padding: "12px 14px",
                boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
                display: "flex", alignItems: "center", gap: 10,
                animation: "ringIn 0.3s ease",
                pointerEvents: "all",
              }}>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <img src={inv.sender_avatar ?? `https://api.dicebear.com/9.x/pixel-art/svg?seed=${inv.sender_username}`} alt={inv.sender_username} style={{ width: 40, height: 40, borderRadius: "50%", border: `2px solid rgba(${color},0.8)` }} />
                  <span style={{ position: "absolute", bottom: -3, right: -3, fontSize: 14, lineHeight: 1 }}>{emoji}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: `rgb(${color})`, fontWeight: 800, marginBottom: 1 }}>{label} · {minsLeft}m left</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#e8eaf6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>@{inv.sender_username} challenged you</div>
                </div>
                <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                  <button onClick={() => { setDismissedInvites(prev => new Set([...prev, inv.id])); window.location.href = href; }} style={{ background: `rgba(${color},0.2)`, border: `1px solid rgba(${color},0.4)`, borderRadius: 8, padding: "6px 10px", color: `rgb(${color})`, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Join →</button>
                  <button onClick={() => setDismissedInvites(prev => new Set([...prev, inv.id]))} style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "6px 10px", color: "#f87171", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MAXI full-screen overlay ────────────────────────────────────────── */}
      {isMaxi && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9600,
          background: "rgba(5,7,13,0.97)",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{
            width: "100%", height: "100%",
            background: "rgba(13,15,22,0.98)",
            display: "flex", flexDirection: "column",
          }}>
            {/* Maxi header */}
            <div style={{
              padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
            }}>
              <span style={{
                width: 10, height: 10, borderRadius: "50%", background: "#4ade80",
                boxShadow: "0 0 8px #4ade80", flexShrink: 0,
                animation: "pulse 1.5s infinite",
              }} />
              <span style={{ flex: 1, color: "#e8eaf6", fontWeight: 800, fontSize: 16 }}>
                🎙️ {currentRoomName || "Voice Room"}
              </span>
              <InviteRow roomId={currentRoomId!} />
              <button onClick={() => setUiSize("normal")} title="Restore" style={{
                background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 6,
                color: "#9ca3af", cursor: "pointer", fontSize: 14, padding: "4px 8px",
              }}>⊟</button>
              <button
                onClick={() => { doLeave(); setOpen(false); }}
                title="Leave & close"
                style={{
                  background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: 6, color: "#f87171", cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "4px 10px",
                }}
              >✕ Leave</button>
            </div>

            {/* Maxi body: narrow participants left, wide chat right */}
            <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
              {/* Left: participants + controls (fixed narrow width) */}
              <div style={{ width: 260, flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 0, borderRight: "1px solid rgba(255,255,255,0.07)" }}>
                {participantsPanel}
                {controlsBar}
              </div>
              {/* Right: chat takes all remaining space */}
              {chatPanel}
            </div>
          </div>
        </div>
      )}

      {/* ── Normal floating panel + pill ─────────────────────────────────────── */}
      {!isMaxi && (
        <div style={{
          position: "fixed",
          bottom: isMobile ? "calc(56px + env(safe-area-inset-bottom) + 8px)" : 0,
          right: 0, zIndex: 9500,
          display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8,
          padding: isMobile ? "0 0 0 0" : "0 0 8px 0",
          paddingBottom: isMobile ? 0 : "max(8px, env(safe-area-inset-bottom))",
          transform: (!isMobile && pillPos) ? `translate(${pillPos.x}px, ${pillPos.y}px)` : undefined,
          transition: pillDragRef.current ? "none" : "transform 0.1s ease",
        }}>
          {/* Normal panel */}
          {open && (
            <div style={isMobile ? {
              /* Mobile: bottom sheet that slides up from bottom */
              position: "fixed", bottom: 0, left: 0, right: 0,
              maxHeight: "65vh",
              background: "rgba(13,15,20,0.98)", backdropFilter: "blur(16px)",
              borderTop: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "16px 16px 0 0", overflow: "hidden",
              boxShadow: "0 -12px 60px rgba(0,0,0,0.9)",
              display: "flex", flexDirection: "column",
              paddingBottom: "env(safe-area-inset-bottom)",
              zIndex: 9600,
              animation: "slideUp 0.25s ease",
            } : {
              width: "min(340px, 96vw)", maxHeight: "80vh",
              background: "rgba(13,15,20,0.97)", backdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 16, overflow: "hidden",
              boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
              display: "flex", flexDirection: "column",
              marginRight: 8,
            }}>
              {/* Panel header */}
              <div style={{
                padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ fontSize: 15 }}>🎙️</span>
                <span style={{ flex: 1, color: "#e8eaf6", fontWeight: 800, fontSize: 14 }}>
                  {inVoice ? currentRoomName : "Voice Chat"}
                </span>
                {inVoice && (
                  <div style={{ display: "flex", gap: 4 }}>
                    <TabBtn active={tab === "current"} onClick={() => setTab("current")}>Room</TabBtn>
                    <TabBtn active={tab === "rooms"} onClick={() => setTab("rooms")}>Browse</TabBtn>
                  </div>
                )}
                {inVoice && (
                  <button onClick={() => setUiSize("maxi")} title="Expand" style={{
                    background: "none", border: "none", color: "#6b7280",
                    cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 2,
                  }}>⊞</button>
                )}
                <button onClick={() => { setOpen(false); }} style={{
                  background: "none", border: "none", color: "#6b7280",
                  cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 2,
                }}>×</button>
              </div>

              {/* Current room tab */}
              {inVoice && tab === "current" && (
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
                  {participantsPanel}
                  <div style={{ padding: "6px 14px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <InviteRow roomId={currentRoomId!} />
                  </div>
                  {/* Full chat with input */}
                  {chatPanel}
                  {/* Settings */}
                  <div style={{ padding: "6px 14px 8px" }}>
                    <button onClick={() => setShowSettings(v => !v)} style={{
                      background: "none", border: "none", color: "#6b7280",
                      fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                    }}>
                      ⚙️ {showSettings ? "Hide" : "Settings"}
                    </button>
                    {showSettings && (
                      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                        {devices.length > 1 && (
                          <select
                            value={selectedDevice}
                            onChange={e => { setSelectedDevice(e.target.value); reinitStream(); }}
                            style={{ background: "#1a1d26", border: "1px solid #2a2d3a", borderRadius: 6, padding: "5px 8px", color: "#e8eaf6", fontSize: 16, width: "100%" }}
                          >
                            {devices.map(d => (
                              <option key={d.deviceId} value={d.deviceId}>
                                {d.label || `Mic ${d.deviceId.slice(0, 8)}`}
                              </option>
                            ))}
                          </select>
                        )}
                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: "#94a3b8" }}>
                          <input type="checkbox" checked={noiseSuppression} onChange={e => { setNoiseSuppression(e.target.checked); reinitStream(); }} style={{ accentColor: "#7c3aed" }} />
                          Noise suppression
                        </label>
                      </div>
                    )}
                  </div>
                  {controlsBar}
                </div>
              )}

              {/* Rooms tab */}
              {(!inVoice || tab === "rooms") && (
                <div style={{ flex: 1, overflowY: "auto" }}>
                  <div style={{ padding: "12px 14px" }}>
                    {!showCreate ? (
                      <button onClick={() => setShowCreate(true)} style={{
                        width: "100%", background: "rgba(124,58,237,0.15)",
                        border: "1px dashed rgba(124,58,237,0.4)", borderRadius: 10,
                        padding: "10px 0", color: "#a78bfa", fontSize: 13,
                        fontWeight: 700, cursor: "pointer", marginBottom: 12,
                      }}>
                        + Start a Voice Room
                      </button>
                    ) : (
                      <div style={{ marginBottom: 12, display: "flex", gap: 6 }}>
                        <input
                          autoFocus value={newRoomName}
                          onChange={e => setNewRoomName(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") handleCreateRoom(); if (e.key === "Escape") setShowCreate(false); }}
                          placeholder="Room name…"
                          style={{ flex: 1, background: "#1a1d26", border: "1px solid #2a2d3a", borderRadius: 8, padding: "7px 10px", color: "#e8eaf6", fontSize: 16, outline: "none" }}
                        />
                        <button onClick={handleCreateRoom} style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)", border: "none", borderRadius: 8, padding: "0 14px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Go</button>
                      </div>
                    )}
                    {openRooms.length === 0 ? (
                      <div style={{ textAlign: "center", color: "#374151", fontSize: 13, padding: "20px 0" }}>No active voice rooms</div>
                    ) : (
                      openRooms.map(room => (
                        <div key={room.id} style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "10px 12px",
                          background: currentRoomId === room.id ? "rgba(124,58,237,0.15)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${currentRoomId === room.id ? "rgba(124,58,237,0.3)" : "rgba(255,255,255,0.06)"}`,
                          borderRadius: 10, marginBottom: 6,
                        }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 6px #4ade80", flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#e8eaf6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{room.name}</div>
                            <div style={{ fontSize: 11, color: "#6b7280" }}>{room.participant_count ?? 0} in room{room.creator_username ? ` · @${room.creator_username}` : ""}</div>
                          </div>
                          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                            {room.creator_id === userId && (
                              <button onClick={() => handleCloseRoom(room.id)} disabled={closingRoom === room.id} title="Close room" style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6, padding: "4px 8px", color: "#f87171", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                                {closingRoom === room.id ? "…" : "✕"}
                              </button>
                            )}
                            {currentRoomId === room.id ? (
                              <button onClick={leaveRoom} style={{ background: "#ef4444", border: "none", borderRadius: 6, padding: "4px 10px", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Leave</button>
                            ) : (
                              <button onClick={() => joinRoom(room.id, room.name)} style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)", border: "none", borderRadius: 6, padding: "4px 10px", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Join</button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Incoming call banners */}
          {incomingCalls.filter(c => !dismissedCalls.has(c.id) && currentRoomId !== c.id && !participants.some(p => p.user_id === c.caller_id)).map(call => (
            <div key={call.id} style={{
              width: "min(300px, 94vw)",
              background: "rgba(13,15,20,0.97)", backdropFilter: "blur(16px)",
              border: "1px solid rgba(74,222,128,0.35)",
              borderRadius: 14, padding: "12px 14px",
              boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
              display: "flex", alignItems: "center", gap: 10,
              marginRight: 8, animation: "ringIn 0.3s ease",
            }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <img src={call.caller_avatar ?? `https://api.dicebear.com/9.x/pixel-art/svg?seed=${call.caller_username}`} alt={call.caller_username} style={{ width: 38, height: 38, borderRadius: "50%", border: "2px solid #4ade80" }} />
                <span style={{ position: "absolute", bottom: -2, right: -2, width: 14, height: 14, borderRadius: "50%", background: "#4ade80", border: "2px solid #0d0f14", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7 }}>📞</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: "#4ade80", fontWeight: 800, marginBottom: 1 }}>Incoming call</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#e8eaf6" }}>@{call.caller_username}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => { setDismissedCalls(prev => new Set([...prev, call.id])); joinRoom(call.id, call.name); }} style={{ background: "#16a34a", border: "none", borderRadius: 8, padding: "6px 12px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✓</button>
                <button onClick={() => setDismissedCalls(prev => new Set([...prev, call.id]))} style={{ background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "6px 12px", color: "#f87171", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✕</button>
              </div>
            </div>
          ))}

          {/* Floating pills row: DM + Voice */}
          <div style={{ display: "flex", gap: 8, marginRight: 8, alignItems: "flex-end" }}>

            {/* ── DM pill ── */}
            <div style={{ position: "relative" }}>
              {/* DM panel */}
              {dmOpen && (
                <div style={{
                  ...(isMobile ? {
                    position: "fixed" as const, bottom: 0, left: 0, right: 0,
                    maxHeight: "65vh",
                    borderRadius: "16px 16px 0 0",
                    borderTop: "1px solid rgba(255,255,255,0.12)",
                    paddingBottom: "env(safe-area-inset-bottom)",
                    zIndex: 9600,
                    animation: "slideUp 0.25s ease",
                  } : {
                    position: "absolute" as const, bottom: "calc(100% + 10px)", right: 0,
                    width: 300,
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.1)",
                    boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
                  }),
                  maxHeight: "72vh",
                  background: "rgba(13,15,20,0.97)", backdropFilter: "blur(16px)",
                  display: "flex", flexDirection: "column", overflow: "hidden",
                }}>
                  {!dmActiveUser ? (
                    <>
                      <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 15 }}>💬</span>
                        <span style={{ flex: 1, color: "#e8eaf6", fontWeight: 800, fontSize: 14 }}>Messages</span>
                        <button onClick={() => window.location.href = "/messages"} title="Open full messages" style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 12, padding: "2px 4px" }}>⤢</button>
                        <button onClick={() => setDmOpen(false)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 18 }}>×</button>
                      </div>
                      <div style={{ flex: 1, overflowY: "auto" }}>
                        {dmFriends.length === 0 ? (
                          <div style={{ padding: 20, textAlign: "center", color: "#4b5563", fontSize: 13 }}>Loading contacts…</div>
                        ) : dmFriends.map(f => {
                          const watchRoom = friendWatchRooms.find(wr => wr.friend_user_id === f.id);
                          return (
                          <div
                            key={f.id}
                            style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                          >
                            <div
                              onClick={() => setDmActiveUser({ id: f.id, username: f.username, avatar_url: f.avatar_url })}
                              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", transition: "background 0.1s" }}
                              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                            >
                              <img src={f.avatar_url ?? `https://api.dicebear.com/9.x/pixel-art/svg?seed=${f.username}`} alt="" style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0 }} />
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: "#e8eaf6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.display_name ?? f.username}</div>
                                <div style={{ fontSize: 11, color: "#6b7280" }}>@{f.username}</div>
                              </div>
                            </div>
                            {/* Watch room badge */}
                            {watchRoom && (
                              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 14px 8px", marginTop: -4 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: watchRoom.is_screen_sharing ? "#f87171" : "#94a3b8" }}>
                                  {watchRoom.is_screen_sharing
                                    ? <><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />📺 Watching live</>
                                    : <>📺 In a stream room</>
                                  }
                                </div>
                                <a
                                  href={`/stremio/${watchRoom.room_id}`}
                                  style={{
                                    marginLeft: "auto", background: watchRoom.is_screen_sharing ? "rgba(239,68,68,0.15)" : "rgba(124,58,237,0.15)",
                                    border: `1px solid ${watchRoom.is_screen_sharing ? "rgba(239,68,68,0.35)" : "rgba(124,58,237,0.35)"}`,
                                    borderRadius: 6, padding: "2px 8px",
                                    color: watchRoom.is_screen_sharing ? "#f87171" : "#a78bfa",
                                    fontSize: 11, fontWeight: 700, textDecoration: "none",
                                    flexShrink: 0,
                                  }}
                                >
                                  Join →
                                </a>
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        <button onClick={() => { setDmActiveUser(null); setDmMessages([]); clearInterval(dmPollRef.current); }} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 16, padding: "0 4px" }}>←</button>
                        <img src={dmActiveUser.avatar_url ?? `https://api.dicebear.com/9.x/pixel-art/svg?seed=${dmActiveUser.username}`} alt="" style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0 }} />
                        <span style={{ flex: 1, color: "#e8eaf6", fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>@{dmActiveUser.username}</span>
                        <button onClick={() => { setDmOpen(false); window.location.href = `/messages`; }} title="Open in messages" style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 12 }}>⤢</button>
                        <button onClick={() => setDmOpen(false)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 18 }}>×</button>
                      </div>
                      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
                        {dmMessages.length === 0 && <div style={{ textAlign: "center", color: "#4b5563", fontSize: 12, padding: 16 }}>No messages yet — say hi! 👋</div>}
                        {dmMessages.map(msg => {
                          const isMine = msg.sender_id === userId;
                          const cardMatch = msg.content?.match(/^\[(\w+):([^\]]+)\]$/);
                          const display = cardMatch ? `🎮 ${cardMatch[1].toUpperCase()} invite` : (msg.content ?? "");
                          const timeStr = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
                          return (
                            <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : "flex-start", gap: 2 }}>
                              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, flexDirection: isMine ? "row-reverse" : "row" }}>
                                {!isMine && (
                                  <img
                                    src={msg.avatar_url ?? `https://api.dicebear.com/9.x/pixel-art/svg?seed=${dmActiveUser!.username}`}
                                    alt=""
                                    style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, marginBottom: 2 }}
                                  />
                                )}
                                <div style={{ maxWidth: "75%", padding: "7px 11px", borderRadius: isMine ? "12px 12px 3px 12px" : "12px 12px 12px 3px", background: isMine ? "linear-gradient(135deg, rgba(124,58,237,0.5), rgba(79,70,229,0.4))" : "rgba(255,255,255,0.09)", color: "#e8eaf6", fontSize: 13, lineHeight: 1.45, wordBreak: "break-word", border: isMine ? "1px solid rgba(124,58,237,0.35)" : "1px solid rgba(255,255,255,0.07)" }}>
                                  {display}
                                </div>
                              </div>
                              {timeStr && <span style={{ fontSize: 10, color: "#4b5563", paddingLeft: isMine ? 0 : 28, paddingRight: isMine ? 2 : 0 }}>{timeStr}</span>}
                            </div>
                          );
                        })}
                        <div ref={dmMsgBottomRef} />
                      </div>
                      <div style={{ padding: "8px 12px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 6, flexShrink: 0 }}>
                        <input
                          value={dmInput}
                          onChange={e => setDmInput(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") sendDm(); }}
                          placeholder={`Message @${dmActiveUser.username}…`}
                          style={{ flex: 1, background: "#1a1d26", border: "1px solid #2a2d3a", borderRadius: 8, padding: "7px 10px", color: "#e8eaf6", fontSize: 16, outline: "none", fontFamily: "inherit" }}
                        />
                        <button onClick={sendDm} disabled={!dmInput.trim() || dmSending} style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)", border: "none", borderRadius: 8, padding: "0 12px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: dmInput.trim() ? 1 : 0.5 }}>→</button>
                      </div>
                    </>
                  )}
                </div>
              )}
              {/* DM button */}
              <button
                onClick={() => setDmOpen(v => !v)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: dmOpen ? "rgba(124,58,237,0.25)" : "rgba(13,15,20,0.92)",
                  backdropFilter: "blur(12px)",
                  border: `1px solid ${dmOpen ? "rgba(124,58,237,0.5)" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: 50, padding: isMobile ? "9px 11px" : "10px 14px",
                  cursor: "pointer",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
                  transition: "all 0.2s ease",
                }}
              >
                <span style={{ fontSize: isMobile ? 18 : 16 }}>💬</span>
              </button>
            </div>

            {/* ── Voice pill ── */}
            <button
              onClick={() => { if (!pillDragRef.current) setOpen(v => !v); }}
              onMouseDown={e => {
                if (e.button !== 0) return;
                pillDragRef.current = { startX: e.clientX, startY: e.clientY, startPosX: pillPos?.x ?? 0, startPosY: pillPos?.y ?? 0 };
                const onMove = (ev: MouseEvent) => {
                  if (!pillDragRef.current) return;
                  const dx = ev.clientX - pillDragRef.current.startX;
                  const dy = ev.clientY - pillDragRef.current.startY;
                  if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
                    setPillPos({ x: pillDragRef.current.startPosX + dx, y: pillDragRef.current.startPosY + dy });
                  }
                };
                const onUp = () => {
                  setTimeout(() => { pillDragRef.current = null; }, 50);
                  window.removeEventListener("mousemove", onMove);
                  window.removeEventListener("mouseup", onUp);
                };
                window.addEventListener("mousemove", onMove);
                window.addEventListener("mouseup", onUp);
              }}
              onTouchStart={e => {
                const t = e.touches[0];
                pillDragRef.current = { startX: t.clientX, startY: t.clientY, startPosX: pillPos?.x ?? 0, startPosY: pillPos?.y ?? 0 };
                const onMove = (ev: TouchEvent) => {
                  if (!pillDragRef.current) return;
                  if (isMobile) return; // no dragging on mobile
                  const touch = ev.touches[0];
                  const dx = touch.clientX - pillDragRef.current.startX;
                  const dy = touch.clientY - pillDragRef.current.startY;
                  setPillPos({ x: pillDragRef.current.startPosX + dx, y: pillDragRef.current.startPosY + dy });
                };
                const onEnd = () => {
                  setTimeout(() => { pillDragRef.current = null; }, 50);
                  window.removeEventListener("touchmove", onMove);
                  window.removeEventListener("touchend", onEnd);
                };
                window.addEventListener("touchmove", onMove, { passive: true });
                window.addEventListener("touchend", onEnd);
              }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: isMobile ? 0 : 8,
                background: inVoice
                  ? "linear-gradient(135deg, rgba(74,222,128,0.25), rgba(22,163,74,0.2))"
                  : "rgba(13,15,20,0.92)",
                backdropFilter: "blur(12px)",
                border: `1px solid ${inVoice ? "rgba(74,222,128,0.4)" : "rgba(255,255,255,0.1)"}`,
                borderRadius: 50,
                padding: isMobile ? "9px 11px" : "10px 16px",
                cursor: "pointer",
                boxShadow: inVoice ? "0 0 20px rgba(74,222,128,0.3)" : "0 4px 24px rgba(0,0,0,0.6)",
                transition: "all 0.2s ease",
                position: "relative",
              }}
            >
              {inVoice ? (
                <>
                  {isMobile ? (
                    /* Mobile: just the mic icon + small active dot */
                    <>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 6px #4ade80", position: "absolute", top: 3, right: 3, animation: "pulse 1.5s infinite" }} />
                      <span style={{ fontSize: 18 }}>{myParticipant?.is_muted ? "🔇" : "🎙️"}</span>
                    </>
                  ) : (
                    /* Desktop: full pill with room name */
                    <>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 6px #4ade80", flexShrink: 0, animation: "pulse 1.5s infinite" }} />
                      <span style={{ color: "#4ade80", fontWeight: 800, fontSize: 13 }}>
                        {myParticipant?.is_muted ? "🔇" : "🎙️"} {currentRoomName.slice(0, 20)}{currentRoomName.length > 20 ? "…" : ""}
                      </span>
                      <span style={{ background: "rgba(74,222,128,0.2)", color: "#4ade80", borderRadius: 20, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>
                        {participants.length}
                      </span>
                      <button
                        onClick={e => { e.stopPropagation(); setOpen(true); setUiSize("maxi"); }}
                        title="Expand"
                        style={{ background: "rgba(74,222,128,0.15)", border: "none", borderRadius: 6, padding: "2px 6px", color: "#4ade80", fontSize: 12, cursor: "pointer", fontWeight: 700 }}
                      >⊞</button>
                    </>
                  )}
                </>
              ) : isConnecting ? (
                <span style={{ color: "#fbbf24", fontSize: isMobile ? 18 : 13, fontWeight: 700 }}>{isMobile ? "🔄" : "🔄 Connecting…"}</span>
              ) : (
                <span style={{ color: "#8890a4", fontSize: isMobile ? 18 : 13, fontWeight: 700 }}>{isMobile ? "🎙️" : "🎙️ Voice"}</span>
              )}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes ringIn {
          from { opacity: 0; transform: translateY(12px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </VoiceContext.Provider>
  );
}

// ─── Helper components ─────────────────────────────────────────────────────────

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: "3px 10px", borderRadius: 6, border: "none",
      background: active ? "rgba(124,58,237,0.3)" : "transparent",
      color: active ? "#a78bfa" : "#6b7280",
      fontSize: 11, fontWeight: 700, cursor: "pointer",
    }}>
      {children}
    </button>
  );
}

function InviteRow({ roomId }: { roomId: string }) {
  const [copied, setCopied] = useState(false);
  function copyLink() {
    const link = `${window.location.origin}/messages?voice=${roomId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      const ta = document.createElement("textarea");
      ta.value = link; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button onClick={copyLink} style={{
      background: copied ? "rgba(74,222,128,0.15)" : "rgba(124,58,237,0.15)",
      border: `1px solid ${copied ? "rgba(74,222,128,0.3)" : "rgba(124,58,237,0.3)"}`,
      borderRadius: 7, padding: "4px 10px", fontSize: 12, fontWeight: 700,
      color: copied ? "#4ade80" : "#a78bfa", cursor: "pointer", flexShrink: 0,
    }}>
      {copied ? "✓ Copied!" : "🔗 Invite"}
    </button>
  );
}

function CtrlBtn({ onClick, color, title, children, active }: {
  onClick: () => void; color: string; title: string; children: React.ReactNode; active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        flex: "0 0 auto", padding: "7px 12px", borderRadius: 8, border: "none",
        background: active ? `${color}22` : "rgba(255,255,255,0.06)",
        color: active ? color : "#94a3b8",
        fontSize: 14, fontWeight: 700, cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {children}
    </button>
  );
}
