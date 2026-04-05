"use client";
/**
 * MoonhavenClient — 3D town square powered by Three.js.
 *
 * Wires in all existing Flock systems:
 *  • PartyKit WebSocket (real-time player positions, same protocol as TownClient)
 *  • NPC dialogue + ElevenLabs voice (same audio files as town)
 *  • Adventure overlay (dungeon/combat missions)
 *  • Stash, Vendor, Herald panels
 *  • Tag game
 *  • Coin economy
 *  • Chat bubbles
 *  • Party system
 *
 * 3D Rendering:
 *  • Three.js scene — moonlit fantasy town
 *  • GLB models from VIBE ENGINE (public/models/moonhaven/*.glb)
 *  • Billboard sprites fallback (avatar textures + NPC images)
 *  • WASD + click-to-move player controller
 *  • Orbit camera (mouse drag to rotate, scroll to zoom)
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdventureOverlay, { generateMission } from "@/app/town/AdventureOverlay";
import MoonhavenLobby from "./MoonhavenLobby";
// TheaterRoom overlay removed — screen share plays directly on 3D drive-in screen via VideoTexture
import StashPanel from "@/app/components/StashPanel";
import VendorPanel from "@/app/components/VendorPanel";
import HeraldPanel from "@/app/components/HeraldPanel";
import CharacterPanel from "@/app/components/CharacterPanel";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";
import { useVoice } from "@/app/components/VoiceWidget";
import {
  MOONHAVEN_NPCS, MOONHAVEN_BUILDINGS, MOONHAVEN_SPAWN,
  MOONHAVEN_ZONES, MOONHAVEN_DIALOGUE, type MoonhavenNPC,
} from "./npcData";

// ── Re-use town player shape ──────────────────────────────────────────────────
interface TownPlayer {
  user_id: string;
  username: string;
  avatar_url: string;
  avatar_config?: AvatarConfig | null;
  x: number;
  y: number;   // maps to z in 3D
  direction: string;
  chat_msg: string | null;
  chat_at: string | null;
  is_it?: boolean;
  equipped_item?: string | null;
  coins?: number;
  equipped_slots?: Record<string, { emoji: string; name: string; rarity: string } | null>;
}

export interface AvatarConfig {
  class: string;
  emoji: string;
  bodyColor: string;
  hairColor: string;
  accentColor: string;
}

interface Props {
  userId: string;
  username: string;
  avatarUrl: string;
  avatarConfig?: AvatarConfig | null;
  partyId?: string | null;
  partyLeaderId?: string | null;
  roomCode?: string | null;
}

const TAG_GAME_DURATION = 30;
const TAG_DIST_3D = 6; // Three.js world units (~2–3 character widths)
const CHASE_NOTES = [220, 233, 261, 246, 220, 196, 207, 233];
const NPC_VOICE_PATH = "/audio/npc";
const MOONHAVEN_WS_ROOM = "moonhaven-town";

// ── Drive-In emote system ──────────────────────────────────────────────────────
const DRIVE_EMOTES = [
  { id: "laugh",   emoji: "😂", label: "Laugh",   color: "#ffcc00", border: "#aa8800", cd: 2500 },
  { id: "cry",     emoji: "😢", label: "Cry",      color: "#5599ff", border: "#2255cc", cd: 2500 },
  { id: "tomato",  emoji: "🍅", label: "Throw!",   color: "#ff5522", border: "#aa2200", cd: 4000 },
  { id: "shush",   emoji: "🤫", label: "Shush",    color: "#cc55ff", border: "#7722aa", cd: 2000 },
  { id: "cola",    emoji: "🥤", label: "Sip Cola", color: "#cc9944", border: "#886622", cd: 3000 },
  { id: "popcorn", emoji: "🍿", label: "Popcorn",  color: "#ffbb33", border: "#cc8800", cd: 2000 },
] as const;
type DriveEmoteId = typeof DRIVE_EMOTES[number]["id"];
interface DriveParticle {
  x: number; y: number; vx: number; vy: number;
  content: string; isText?: boolean; textColor?: string;
  alpha: number; size: number; decay: number; gravity: number;
  rotation: number; rotV: number;
}
interface DriveTomato { sx: number; sy: number; tx: number; ty: number; t: number; }
interface DriveSplat { id: number; x: number; y: number; r: number; rot: number; }

// ── Quality system ─────────────────────────────────────────────────────────────
type QualityLevel = "low" | "med" | "high";

function detectQuality(): QualityLevel {
  if (typeof window === "undefined") return "low";
  const saved = localStorage.getItem("mh_quality") as QualityLevel | null;
  if (saved === "low" || saved === "med" || saved === "high") return saved;
  // Mobile / tablet → always low first visit
  const mobile = /iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent)
    || window.innerWidth < 768 || ("ontouchstart" in window);
  if (mobile) return "low";
  // CPU cores heuristic (navigator.hardwareConcurrency is available in all modern browsers)
  const cores = navigator.hardwareConcurrency || 2;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  if (cores <= 2 || (mem !== undefined && mem <= 2)) return "low";
  if (cores <= 6 || (mem !== undefined && mem <= 4)) return "med";
  return "high";
}

// ── Three.js lazy import helper ───────────────────────────────────────────────
type ThreeModule = typeof import("three");
let _THREE: ThreeModule | null = null;
async function getThree(): Promise<ThreeModule> {
  if (!_THREE) _THREE = await import("three");
  return _THREE;
}

// ── Emoji billboard canvas helper ─────────────────────────────────────────────
function makeEmojiCanvas(emoji: string, size = 128): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);
  ctx.font = `${size * 0.72}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, size / 2, size / 2);
  return canvas;
}

function makeUsernameCanvas(name: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 400; canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 400, 64);
  // Comic-style name plate
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 2;
  ctx.roundRect(8, 8, 384, 48, 12);
  ctx.fill();
  ctx.stroke();
  ctx.font = "900 28px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Text shadow for comic depth
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  ctx.fillText(name.length > 16 ? name.slice(0, 14) + "…" : name, 200, 32);
  return canvas;
}

// ── Chat bubble canvas ─────────────────────────────────────────────────────────
function makeChatCanvas(text: string): HTMLCanvasElement {
  const maxLen = 32;
  const display = text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
  const canvas = document.createElement("canvas");
  canvas.width = 640; canvas.height = 120;
  const ctx = canvas.getContext("2d")!;
  // Comic-style speech bubble
  ctx.fillStyle = "rgba(255,255,255,0.97)";
  ctx.strokeStyle = "#6644bb";
  ctx.lineWidth = 4;
  ctx.shadowColor = "rgba(50,0,100,0.35)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 4;
  ctx.roundRect(8, 8, 624, 96, 20);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.font = "900 38px sans-serif";
  ctx.fillStyle = "#1a0033";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(display, 320, 58);
  return canvas;
}

export default function MoonhavenClient({ userId, username, avatarUrl, avatarConfig, partyId, partyLeaderId: partyLeaderIdProp, roomCode }: Props) {
  const router = useRouter();
  const { joinRoom: joinVoiceRoom } = useVoice();
  const mountRef = useRef<HTMLDivElement>(null);
  const partyIdRef = useRef<string | null>(partyId ?? null);
  // wsPartyId drives the WS room — when it changes the WS effect re-runs and reconnects
  const [wsPartyId, setWsPartyId] = useState<string | null>(partyId ?? null);
  const [partyLeaderId, setPartyLeaderId] = useState<string | null>(partyLeaderIdProp ?? null);

  // ── Moonhaven Lobby ──────────────────────────────────────────────────────────
  const [moonhavenRoomId, setMoonhavenRoomId] = useState<string | null>(null);
  const [showLobby, setShowLobby] = useState(true);

  // Keep partyLeaderId in sync if prop changes (e.g. hot reload)
  useEffect(() => { setPartyLeaderId(partyLeaderIdProp ?? null); }, [partyLeaderIdProp]);

  // Sync partyId prop → ref + WS reconnect when party is joined while already in Moonhaven
  useEffect(() => {
    partyIdRef.current = partyId ?? null;
    setWsPartyId(partyId ?? null);
  }, [partyId]);

  // Also listen for party changes dispatched by GlobalPartyWidget (same-page party join)
  useEffect(() => {
    const handler = (e: Event) => {
      const newPartyId: string | null = (e as CustomEvent<{ partyId: string | null }>).detail?.partyId ?? null;
      if (newPartyId !== partyIdRef.current) {
        partyIdRef.current = newPartyId;
        setWsPartyId(newPartyId);
      }
    };
    window.addEventListener("gs:party-changed", handler);
    return () => window.removeEventListener("gs:party-changed", handler);
  }, []);

  // Skip lobby if roomCode already provided (from URL) — also join matching voice room
  useEffect(() => {
    if (roomCode) {
      setMoonhavenRoomId(roomCode);
      setShowLobby(false);
      const voiceRoomId = roomCode === "main" ? "moonhaven-main" : `moonhaven-${roomCode}`;
      const voiceRoomName = roomCode === "main" ? "🌙 Moonhaven — Public" : `🔐 Moonhaven — ${roomCode}`;
      joinVoiceRoom(voiceRoomId, voiceRoomName).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // handleEnterRoom — called from MoonhavenLobby
  const handleEnterRoom = useCallback(async (roomId: string) => {
    if (roomId !== "main") {
      const res = await fetch("/api/moonhaven-rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enter", roomId, userId, username, avatarUrl }),
      }).then(r => r.json()).catch(() => ({ ok: false }));
      if (!res.ok) {
        alert(res.error ?? "Cannot join that room right now");
        return;
      }
    } else {
      // Public room — just register
      fetch("/api/moonhaven-rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enter", roomId: "main", userId, username, avatarUrl }),
      }).catch(() => {});
    }
    // Update URL so the room is shareable
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (roomId === "main") url.searchParams.delete("room");
      else url.searchParams.set("room", roomId);
      window.history.replaceState({}, "", url.toString());
    }
    setMoonhavenRoomId(roomId);
    setShowLobby(false);
    // Auto-join matching voice room
    const voiceRoomId = roomId === "main" ? "moonhaven-main" : `moonhaven-${roomId}`;
    const voiceRoomName = roomId === "main" ? "🌙 Moonhaven — Public" : `🔐 Moonhaven — ${roomId}`;
    joinVoiceRoom(voiceRoomId, voiceRoomName).catch(() => {});
  }, [userId, username, avatarUrl, joinVoiceRoom]);

  // Heartbeat + leave on unmount when in a room
  useEffect(() => {
    if (!moonhavenRoomId || !userId) return;
    const timer = setInterval(() => {
      fetch("/api/moonhaven-rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "heartbeat", roomId: moonhavenRoomId, userId }),
      }).catch(() => {});
    }, 60_000);
    return () => {
      clearInterval(timer);
      fetch("/api/moonhaven-rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leave", userId }),
      }).catch(() => {});
    };
  }, [moonhavenRoomId, userId]);

  // ── Quality ───────────────────────────────────────────────────────────────
  const [quality, setQuality] = useState<QualityLevel>(detectQuality);
  const [showQualityPanel, setShowQualityPanel] = useState(false);
  const [showQualityPicker, setShowQualityPicker] = useState(true);

  // ── Mobile joystick (floating — spawns wherever you touch) ───────────────
  const joystickRef    = useRef<{ active: boolean; dx: number; dy: number }>({ active: false, dx: 0, dy: 0 });
  const joystickId     = useRef<number | null>(null);
  const joystickCenter = useRef({ x: 0, y: 0 });
  const VJOY_R = 62, VJOY_DEAD = 12;
  const [joystickVis, setJoystickVis] = useState({ cx: 0, cy: 0, kx: 0, ky: 0, visible: false });
  // Second touch = camera orbit (look up/down/left/right)
  const camTouchId   = useRef<number | null>(null);
  const camTouchLast = useRef({ x: 0, y: 0 });

  // ── Loading ───────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [loadMsg, setLoadMsg] = useState("Entering Moonhaven…");
  const [initError, setInitError] = useState<string | null>(null);

  // ── Chat ──────────────────────────────────────────────────────────────────
  const [chatInput, setChatInput] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [nearbyPlayers, setNearbyPlayers] = useState<TownPlayer[]>([]);
  const nearbyPlayersRef = useRef<TownPlayer[]>([]);
  const [playerCount, setPlayerCount] = useState(1);

  // ── NPC dialogue ──────────────────────────────────────────────────────────
  const [activeNPC, setActiveNPC] = useState<{ npc: MoonhavenNPC; line: string } | null>(null);
  const npcVoiceIndexRef = useRef<Record<string, number>>({});
  const npcDialogueCooldownRef = useRef<Record<string, number>>({});
  const [nearestNPC, setNearestNPC] = useState<MoonhavenNPC | null>(null);
  const nearestNPCRef = useRef<MoonhavenNPC | null>(null);

  // ── Party ─────────────────────────────────────────────────────────────────
  const [myParty, setMyParty] = useState<{ id: string; members: { userId: string; username: string }[] } | null>(null);

  // ── Economy ───────────────────────────────────────────────────────────────
  const [myCoins, setMyCoins] = useState(0);

  // ── Inventory / Character data ────────────────────────────────────────────
  const [myInventory, setMyInventory] = useState<unknown[]>([]);
  const [myEquippedSlots, setMyEquippedSlots] = useState<Record<string, unknown>>({});
  const [myAdventureStats, setMyAdventureStats] = useState<{ class: string|null; level:number; hp:number; max_hp:number; base_attack:number; xp:number; inventory:unknown[]; equipped_item_id:string|null; wins:number; quests_completed:number } | null>(null);

  // ── Room host / Hand of the King ─────────────────────────────────────────
  // roomHostId: first player in the room — controls jukebox/theater
  // roomHandId: player crowned by host — also controls jukebox/theater
  const [roomHostId, setRoomHostId] = useState<string | null>(null);
  const [roomHandId, setRoomHandId] = useState<string | null>(null);
  const [showPlayersPanel, setShowPlayersPanel] = useState(false);
  const seenPlayersRef = useRef<Set<string>>(new Set());
  const hostClaimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Derived: can this user control jukebox/theater?
  // (computed inline: roomHostId === userId || roomHandId === userId)

  // ── Jukebox ───────────────────────────────────────────────────────────────
  const [showJukebox, setShowJukebox] = useState(false);
  const [jukeboxInput, setJukeboxInput] = useState("");
  const [activeJukebox, setActiveJukebox] = useState<{ url: string; startedAt: number; byName: string } | null>(null);
  const [jukeboxPending, setJukeboxPending] = useState<{ url: string; suggesterName: string; suggesterId: string } | null>(null);

  // ── Panels ────────────────────────────────────────────────────────────────
  const [showStash, setShowStash] = useState(false);
  const [stashData, setStashData] = useState<unknown>(null);
  const [showVendor, setShowVendor] = useState(false);
  const [vendorStock, setVendorStock] = useState<unknown[]>([]);
  const [showHerald, setShowHerald] = useState(false);
  const [heraldChapters, setHeraldChapters] = useState<unknown[]>([]);
  const [showCharacter, setShowCharacter] = useState(false);
  const [showAdventure, setShowAdventure] = useState(false);
  const [activeMission, setActiveMission] = useState<unknown>(null);
  const [showCaptainDialog, setShowCaptainDialog] = useState(false);
  const [captainDialogTab, setCaptainDialogTab] = useState<"class" | "mission">("class");
  const [customMissionInput, setCustomMissionInput] = useState("");

  const CLASS_OPTIONS = [
    { key: "warrior", emoji: "⚔️", name: "Warrior", hp: 120, atk: "12–18", special: "Cleave: hit all enemies ×1.5" },
    { key: "mage",    emoji: "🪄", name: "Mage",    hp: 70,  atk: "22–30", special: "Fireball: AoE all enemies ×2" },
    { key: "archer",  emoji: "🏹", name: "Archer",  hp: 90,  atk: "16–24", special: "Piercing: hit 2 enemies ×1.8" },
    { key: "rogue",   emoji: "🗡️", name: "Rogue",   hp: 80,  atk: "20–28", special: "Backstab: single target ×2.5" },
  ];

  async function pickClass(cls: string) {
    const updated = { ...(myAdventureStats ?? { level: 1, xp: 0, hp: 100, max_hp: 100, base_attack: 10, inventory: [], equipped_item_id: null, wins: 0, quests_completed: 0 }), class: cls };
    setMyAdventureStats(updated as typeof myAdventureStats);
    setCaptainDialogTab("mission");
    try {
      await fetchWithTimeout("/api/adventure", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update-stats", patch: { class: cls } }) }, 5000);
    } catch { /* optimistic already applied */ }
  }

  async function startMission(missionKey: string, customText?: string) {
    const mission = generateMission(customText ?? missionKey, Date.now(), missionKey);
    setActiveMission(mission);
    setShowCaptainDialog(false);
    setTimeout(() => setShowAdventure(true), 200);
  }

  // ── Drive-In Theater ──────────────────────────────────────────────────────
  type TheaterState = { videoUrl: string | null; startedAt: number | null; hostId: string | null; seats: Record<string, { userId: string; username: string }>; isPaused?: boolean; pausedAt?: number | null; jukeboxUrl?: string | null; jukeboxStartedAt?: number | null; jukeboxBy?: string | null; screenshareOffer?: { active: boolean; hostId: string } | null };
  const [theaterState, setTheaterState] = useState<TheaterState | null>(null);
  const theaterStateRef = useRef<TheaterState | null>(null);
  const [driveInNear, setDriveInNear] = useState(false);
  const driveInNearRef = useRef(false);
  const screenMeshRef = useRef<import("three").Mesh | null>(null);

  // ── LIVE Screen Share → VideoTexture on 3D screen ──────────────────────
  const [ssStatus, _setSsStatus] = useState<"idle" | "hosting" | "viewing">("idle");
  const ssStatusRef = useRef<"idle" | "hosting" | "viewing">("idle");
  const setSsStatus = useCallback((v: "idle" | "hosting" | "viewing") => { ssStatusRef.current = v; _setSsStatus(v); }, []);
  const [ssError, setSsError] = useState<string | null>(null);
  const [showGameCast, setShowGameCast] = useState(false);
  const isSharingRef = useRef(false);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const videoTextureRef = useRef<import("three").VideoTexture | null>(null);
  const origScreenMatRef = useRef<import("three").Material | null>(null);
  const screenPeersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const screenSignalIdRef = useRef(0);
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const screenPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasRequestedRef = useRef(false);
  const colorSampleCanvas = useRef<HTMLCanvasElement | null>(null);
  const colorSampleCtx = useRef<CanvasRenderingContext2D | null>(null);

  const ICE_CONFIG = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
      { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
      { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
    ],
  };
  const postSsSignal = useCallback((toUser: string, type: string, payload: unknown) => {
    if (townSocketRef.current?.readyState === 1) {
      townSocketRef.current.send(JSON.stringify({
        type: "screen-signal", toUser, signalType: type, payload, fromUser: userId,
      }));
    }
  }, [userId]);

  // Apply a MediaStream as VideoTexture onto the 3D screen mesh
  const applyVideoToScreen = useCallback(async (stream: MediaStream) => {
    const vid = screenVideoRef.current;
    const mesh = screenMeshRef.current;
    if (!vid) { console.warn("[Theater] No video element ref"); return; }
    if (!mesh) { console.warn("[Theater] No screen mesh ref"); return; }
    vid.srcObject = stream;
    vid.muted = true;
    vid.playsInline = true;
    vid.style.background = "#000000";
    try { await vid.play(); } catch (e) { console.warn("[Theater] Video play failed:", e); }
    // Wait for first frame to be ready before creating texture
    await new Promise<void>(resolve => {
      if (vid.readyState >= 2) { resolve(); return; }
      vid.addEventListener("loadeddata", () => resolve(), { once: true });
      // Timeout fallback
      setTimeout(resolve, 2000);
    });
    const THREE = await getThree();
    // Save original material and position for restoration
    if (!origScreenMatRef.current) origScreenMatRef.current = mesh.material as import("three").Material;
    const tex = new THREE.VideoTexture(vid);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = rendererRef.current?.capabilities.getMaxAnisotropy() ?? 16;
    videoTextureRef.current = tex;
    mesh.material = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
    // Nudge screen forward so it renders in front of the border/frame mesh
    mesh.position.x -= 0.3;
    mesh.renderOrder = 1;
    console.log("[Theater] VideoTexture applied to screen mesh", { readyState: vid.readyState, videoWidth: vid.videoWidth, videoHeight: vid.videoHeight });
  }, []);

  // Restore original canvas texture when share stops
  const clearVideoFromScreen = useCallback(() => {
    const mesh = screenMeshRef.current;
    if (mesh && origScreenMatRef.current) {
      mesh.material = origScreenMatRef.current;
      origScreenMatRef.current = null;
      // Restore screen position (was nudged forward for video)
      mesh.position.x += 0.3;
      mesh.renderOrder = 0;
    }
    if (videoTextureRef.current) { videoTextureRef.current.dispose(); videoTextureRef.current = null; }
    const vid = screenVideoRef.current;
    if (vid) vid.srcObject = null;
  }, []);

  // Create WebRTC peer for screen share
  const createSsPeer = useCallback((peerId: string): RTCPeerConnection => {
    screenPeersRef.current.get(peerId)?.close();
    const pc = new RTCPeerConnection(ICE_CONFIG);
    screenPeersRef.current.set(peerId, pc);
    pc.onicecandidate = ({ candidate }) => { if (candidate) postSsSignal(peerId, "screen-ice", candidate.toJSON()); };
    pc.ontrack = (e) => {
      if (!e.streams[0]) return;
      setSsStatus("viewing");
      applyVideoToScreen(e.streams[0]).then(() => {
        // Attempt immediate unmute (works in Chrome if user has interacted)
        const vid = screenVideoRef.current;
        if (vid) vid.muted = false;
        // Fallback: unlock audio on next user gesture (required for Safari)
        const unlock = () => {
          if (screenVideoRef.current?.srcObject) screenVideoRef.current.muted = false;
          document.removeEventListener("click", unlock);
          document.removeEventListener("keydown", unlock);
        };
        document.addEventListener("click", unlock, { passive: true });
        document.addEventListener("keydown", unlock, { passive: true });
      });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" && !isSharingRef.current && hasRequestedRef.current) {
        screenPeersRef.current.delete(peerId);
        setTimeout(() => { if (!isSharingRef.current) postSsSignal(peerId, "screen-want", {}); }, 2000);
      }
    };
    return pc;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postSsSignal, applyVideoToScreen]);

  // Send WebRTC offer to a viewer
  const sendSsOfferTo = useCallback(async (viewerId: string) => {
    const stream = screenStreamRef.current;
    if (!stream) return;
    const pc = createSsPeer(viewerId);
    for (const track of stream.getTracks()) pc.addTrack(track, stream);
    // Force H.264 for iOS Safari compatibility
    try {
      const caps = RTCRtpSender.getCapabilities?.("video");
      if (caps) {
        const h264 = caps.codecs.filter(c => c.mimeType.toLowerCase() === "video/h264");
        const rest = caps.codecs.filter(c => c.mimeType.toLowerCase() !== "video/h264");
        for (const tc of pc.getTransceivers()) {
          if (tc.sender.track?.kind === "video") tc.setCodecPreferences([...h264, ...rest]);
        }
      }
    } catch { /* unsupported browser */ }
    // Bitrate cap
    for (const sender of pc.getSenders()) {
      if (sender.track?.kind === "video") {
        const params = sender.getParameters();
        if (!params.encodings?.length) params.encodings = [{}];
        params.encodings[0].maxBitrate = 10_000_000; // 10Mbps — needed for smooth video content
        // No maxFramerate cap — let WebRTC send every captured frame
        await sender.setParameters(params).catch(() => {});
      }
    }
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await postSsSignal(viewerId, "screen-offer", offer);
  }, [createSsPeer, postSsSignal]);

  // Process incoming WebRTC signals
  const handleScreenSignalRef = useRef<((sig: { fromUser: string; signalType: string; payload: Record<string, unknown> }) => Promise<void>) | null>(null);
  const handleScreenSignal = useCallback(async (sig: { fromUser: string; signalType: string; payload: Record<string, unknown> }) => {
    if (sig.signalType === "screen-want" && isSharingRef.current && screenStreamRef.current) {
      await sendSsOfferTo(sig.fromUser);
    } else if (sig.signalType === "screen-offer") {
      const pc = createSsPeer(sig.fromUser);
      await pc.setRemoteDescription(new RTCSessionDescription(sig.payload as unknown as RTCSessionDescriptionInit));
      const buffered = pendingIceRef.current.get(sig.fromUser) ?? [];
      for (const c of buffered) await pc.addIceCandidate(c).catch(() => {});
      pendingIceRef.current.delete(sig.fromUser);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      postSsSignal(sig.fromUser, "screen-answer", answer);
    } else if (sig.signalType === "screen-answer") {
      const pc = screenPeersRef.current.get(sig.fromUser);
      if (pc && pc.signalingState === "have-local-offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(sig.payload as unknown as RTCSessionDescriptionInit));
        const buffered = pendingIceRef.current.get(sig.fromUser) ?? [];
        for (const c of buffered) await pc.addIceCandidate(c).catch(() => {});
        pendingIceRef.current.delete(sig.fromUser);
      }
    } else if (sig.signalType === "screen-ice") {
      const pc = screenPeersRef.current.get(sig.fromUser);
      if (pc) {
        if (pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(sig.payload as RTCIceCandidateInit)).catch(() => {});
        else { const buf = pendingIceRef.current.get(sig.fromUser) ?? []; buf.push(sig.payload as RTCIceCandidateInit); pendingIceRef.current.set(sig.fromUser, buf); }
      }
    } else if (sig.signalType === "screen-stop") {
      setSsStatus("idle");
      hasRequestedRef.current = false;
      clearVideoFromScreen();
      screenPeersRef.current.forEach(pc => pc.close());
      screenPeersRef.current.clear();
    }
  }, [sendSsOfferTo, createSsPeer, postSsSignal, clearVideoFromScreen]);
  handleScreenSignalRef.current = handleScreenSignal;

  // Start screen share (host)
  const startScreenShare = useCallback(async () => {
    setSsError(null);
    if (!navigator.mediaDevices?.getDisplayMedia) { setSsError("Screen sharing isn't supported on this device"); return; }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { max: 1920 }, height: { max: 1080 }, frameRate: { ideal: 60, max: 60 } },
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      // Hint to the encoder that this is motion content (prioritize frame rate over sharpness)
      const vt = stream.getVideoTracks()[0];
      if (vt && "contentHint" in vt) (vt as MediaStreamTrack & { contentHint: string }).contentHint = "motion";
      screenStreamRef.current = stream;
      isSharingRef.current = true;
      setSsStatus("hosting");
      // Apply to 3D screen immediately (local preview)
      await applyVideoToScreen(stream);
      // Notify others — WS for instant real-time update, HTTP for persistence (new joiners)
      if (townSocketRef.current?.readyState === 1) {
        townSocketRef.current.send(JSON.stringify({ type: "screen-share-started", hostId: userId }));
      }
      fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "theater-screenshare-offer", offer: { active: true, hostId: userId }, partyId: partyId || undefined }) }).catch(() => {});
      stream.getVideoTracks()[0]?.addEventListener("ended", () => stopScreenShare());
      // Signals now arrive via PartyKit WebSocket — no polling needed
    } catch (e) {
      const err = e as Error;
      if (err.name !== "NotAllowedError") setSsError("Screen share failed: " + err.message);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, partyId, applyVideoToScreen]);

  // Stop screen share
  const stopScreenShare = useCallback(async () => {
    if (!isSharingRef.current) return;
    isSharingRef.current = false;
    setSsStatus("idle");
    screenPeersRef.current.forEach((_, peerId) => postSsSignal(peerId, "screen-stop", {}));
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    clearVideoFromScreen();
    screenPeersRef.current.forEach(pc => pc.close());
    screenPeersRef.current.clear();
    // Also broadcast screen-stop to all via WS (in case targeted signals missed someone)
    if (townSocketRef.current?.readyState === 1) {
      townSocketRef.current.send(JSON.stringify({ type: "screen-share-ended", userId }));
    }
    await fetch("/api/town", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "theater-screenshare-offer", offer: { active: false, hostId: userId } }) }).catch(() => {});
  }, [userId, postSsSignal, clearVideoFromScreen]);

  // Auto-request stream when a screenshare is active and we're near the screen
  useEffect(() => {
    const offer = theaterState?.screenshareOffer;
    if (offer?.active && offer.hostId !== userId && driveInNear && ssStatus === "idle" && !hasRequestedRef.current) {
      hasRequestedRef.current = true;
      setSsStatus("viewing");
      // Small delay so late joiners have time to send their player_update and register in userConnMap
      // before the host tries to route the screen-offer back to them
      setTimeout(() => postSsSignal(offer.hostId, "screen-want", {}), 600);
    }
    // Reset request flag when share ends so viewer can auto-request next share
    if (!offer?.active && hasRequestedRef.current) {
      hasRequestedRef.current = false;
    }
  }, [theaterState?.screenshareOffer, userId, driveInNear, ssStatus, postSsSignal]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSharingRef.current) { screenStreamRef.current?.getTracks().forEach(t => t.stop()); }
      screenPeersRef.current.forEach(pc => pc.close());
      if (screenPollRef.current) clearInterval(screenPollRef.current);
    };
  }, []);

  // Dynamic screen glow — sample video colors and apply to 3D light
  useEffect(() => {
    if (!colorSampleCanvas.current) {
      colorSampleCanvas.current = document.createElement("canvas");
      colorSampleCanvas.current.width = 8; colorSampleCanvas.current.height = 8;
      colorSampleCtx.current = colorSampleCanvas.current.getContext("2d", { willReadFrequently: true });
    }
  }, []);

  // ── Town battle (hostile NPC inline combat) ───────────────────────────────
  const [townBattle, setTownBattle] = useState<{ npc: MoonhavenNPC; enemyHp: number; maxHp: number; playerHp: number; maxPlayerHp: number; log: string[] } | null>(null);
  const [nearbyBandit, setNearbyBandit] = useState<MoonhavenNPC | null>(null);
  const nearbyBanditRef = useRef<MoonhavenNPC | null>(null);
  const townBattleRef = useRef<typeof townBattle>(null);

  // ── Tag game ──────────────────────────────────────────────────────────────
  const [tagItId, setTagItId] = useState<string | null>(null);
  const [tagItUsername, setTagItUsername] = useState<string>("");
  const [tagMsg, setTagMsg] = useState<string | null>(null);
  const [tagGameActive, setTagGameActive] = useState(false);
  const [tagTimeLeft, setTagTimeLeft] = useState(TAG_GAME_DURATION);
  const tagTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tagItIdRef = useRef<string | null>(null);
  const tagItUsernameRef = useRef<string>("");
  const tagGameActiveRef = useRef(false);
  const tagGameEndedAtRef = useRef<number>(0);
  // ── Chase music (Web Audio API) ──────────────────────────────────────────
  const audioCtxRef = useRef<AudioContext | null>(null);
  const chaseMusicActiveRef = useRef(false);
  const chaseNoteIdxRef = useRef(0);
  const chaseMusicTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Zone ─────────────────────────────────────────────────────────────────
  const [currentZone, setCurrentZone] = useState("plaza");

  // ── Chat open ref (avoids stale closure in keydown handler) ──────────────
  const chatOpenRef = useRef(false);

  // ── WS / Three.js refs ────────────────────────────────────────────────────
  const townSocketRef = useRef<{ send: (d: string) => void; close: () => void; readyState: number } | null>(null);
  const rendererRef = useRef<import("three").WebGLRenderer | null>(null);
  const sceneRef = useRef<import("three").Scene | null>(null);
  const cameraRef = useRef<import("three").PerspectiveCamera | null>(null);
  const playerMeshRef = useRef<import("three").Group | null>(null);
  const playerPosRef = useRef<[number, number, number]>([...MOONHAVEN_SPAWN]);
  const otherMeshesRef = useRef<Map<string, import("three").Group>>(new Map());
  const targetPositionsRef = useRef<Map<string, { x: number; z: number }>>(new Map());
  const npcMeshesRef = useRef<Map<string, import("three").Group>>(new Map());
  const deadNpcsRef = useRef<Set<string>>(new Set());
  const clockRef = useRef<import("three").Clock | null>(null);
  const frameIdRef = useRef<number>(0);
  const keysRef = useRef<Set<string>>(new Set());
  const targetPosRef = useRef<[number, number, number] | null>(null);
  // Camera orbit state
  const camOrbitRef = useRef({ theta: 0.8, phi: Math.PI / 5, radius: 16, dragging: false, lastX: 0, lastY: 0 });
  const jumpRef = useRef({ vy: 0, grounded: true });
  const gpPrevARef = useRef(false); // tracks previous A-button state for edge detection

  // ── Drive-In emote particle system ────────────────────────────────────────
  const driveParticlesRef = useRef<DriveParticle[]>([]);
  const driveTomatoRef = useRef<DriveTomato | null>(null);
  const [driveSplats, setDriveSplats] = useState<DriveSplat[]>([]);
  const driveSplatIdRef = useRef(0);
  const driveCooldownsRef = useRef<Partial<Record<DriveEmoteId, number>>>({});
  const [, setDriveCdTick] = useState(0);
  const driveCdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const driveEmoteCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const driveEmoteRafRef = useRef<number | null>(null);
  const driveAudioCtxRef = useRef<AudioContext | null>(null);

  // ── RPS Arena state ────────────────────────────────────────────────────────
  type RPSChoice = "rock" | "paper" | "scissors";
  type RPSPhase = "idle" | "waiting" | "choosing" | "revealing" | "result";
  const [rpsPhase, setRpsPhase] = useState<RPSPhase>("idle");
  const [rpsTimeLeft, setRpsTimeLeft] = useState(60);
  const [rpsMyChoice, setRpsMyChoice] = useState<RPSChoice | null>(null);
  const [rpsOpponentChoice, setRpsOpponentChoice] = useState<RPSChoice | null>(null);
  const [rpsOpponent, setRpsOpponent] = useState<{ userId: string; username: string } | null>(null);
  const [rpsResultWinner, setRpsResultWinner] = useState<string | null | "draw">(null); // userId or "draw"
  const [rpsNear, setRpsNear] = useState(false);
  const rpsNearRef = useRef(false);
  const rpsPhaseRef = useRef<RPSPhase>("idle");
  const rpsMyChoiceRef = useRef<RPSChoice | null>(null);
  const rpsOpponentRef = useRef<{ userId: string; username: string } | null>(null);
  const rpsMatchIdRef = useRef<string | null>(null);
  const rpsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rpsMyCommitRef = useRef<string | null>(null); // base64 of choice+nonce
  const rpsOpponentCommitRef = useRef<string | null>(null);
  const rpsOpponentRevealedRef = useRef<RPSChoice | null>(null);

  const setRpsPhaseSync = (p: RPSPhase) => { rpsPhaseRef.current = p; setRpsPhase(p); };

  const RPS_ARENA_POS: [number, number, number] = [40, 0, 4];
  const RPS_ARENA_RADIUS = 5;

  // ── Fetch stash + inventory + vendor data ────────────────────────────────
  const fetchStashData = useCallback(async () => {
    try {
      const r = await fetchWithTimeout("/api/town", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get-stash" }) }, 8000);
      const d = await r.json();
      if (d.stash_items) {
        setStashData(d);
        setMyInventory(Array.isArray(d.inventory) ? d.inventory : []);
        setMyEquippedSlots(d.equipped_slots ?? {});
      }
    } catch (e) { console.warn("Stash fetch failed:", e); }
    try {
      const r2 = await fetchWithTimeout("/api/town", { method: "GET" }, 5000);
      const d2 = await r2.json();
      if (d2.adventure_stats) setMyAdventureStats(d2.adventure_stats);
      if (d2.vendor_stock) setVendorStock(d2.vendor_stock);
      if (d2.coins !== undefined) setMyCoins(d2.coins);
    } catch (e) { console.warn("Stash vendor fetch failed:", e); }
  }, []);

  // ── Load economy on mount ─────────────────────────────────────────────────
  useEffect(() => {
    fetchWithTimeout("/api/town-economy?action=get", {}, 5000)
      .then(r => r.json())
      .then(d => { if (d.coins !== undefined) setMyCoins(d.coins); })
      .catch(() => {});
    fetchStashData();
  }, [fetchStashData]);

  // ── Refresh stash/character data when panels open ─────────────────────────
  useEffect(() => {
    if (showStash || showCharacter) fetchStashData();
  }, [showStash, showCharacter, fetchStashData]);

  // ── Window-level touch safety net — clears joystick if finger lifts outside mount div ──
  useEffect(() => {
    const clear = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joystickId.current) {
          joystickId.current = null;
          joystickRef.current = { active: false, dx: 0, dy: 0 };
          setJoystickVis(v => ({ ...v, visible: false }));
        }
        if (e.changedTouches[i].identifier === camTouchId.current) {
          camTouchId.current = null;
        }
      }
    };
    window.addEventListener("touchend", clear, { passive: true });
    window.addEventListener("touchcancel", clear, { passive: true });
    return () => {
      window.removeEventListener("touchend", clear);
      window.removeEventListener("touchcancel", clear);
    };
  }, []);

  // ── Chase music (Web Audio) ───────────────────────────────────────────────
  function startChaseMusic() {
    if (chaseMusicActiveRef.current) return;
    chaseMusicActiveRef.current = true;
    chaseNoteIdxRef.current = 0;
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    } catch { return; }
    playChaseNote();
  }
  function playChaseNote() {
    if (!chaseMusicActiveRef.current) return;
    const ctx = audioCtxRef.current; if (!ctx) return;
    const freq = CHASE_NOTES[chaseNoteIdxRef.current % CHASE_NOTES.length];
    chaseNoteIdxRef.current++;
    try {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.type = "square"; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.055, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.13);
    } catch { /* ignore */ }
    chaseMusicTimeoutRef.current = setTimeout(playChaseNote, 145);
  }
  function stopChaseMusic() {
    chaseMusicActiveRef.current = false;
    if (chaseMusicTimeoutRef.current) { clearTimeout(chaseMusicTimeoutRef.current); chaseMusicTimeoutRef.current = null; }
  }

  // ── Quality picker ────────────────────────────────────────────────────────
  function selectQuality(q: QualityLevel) {
    localStorage.setItem("mh_quality", q);
    setQuality(q);
    setShowQualityPicker(false);
  }

  // ── Tag game functions ────────────────────────────────────────────────────
  function beginTagGame(itId: string, itUname: string, startingTime = TAG_GAME_DURATION) {
    if (tagGameActiveRef.current) return;
    tagGameActiveRef.current = true;
    tagItIdRef.current = itId; tagItUsernameRef.current = itUname;
    setTagItId(itId); setTagItUsername(itUname);
    setTagGameActive(true); setTagTimeLeft(Math.round(startingTime));
    if (itId === userId) startChaseMusic();
    let timeLeft = Math.round(startingTime);
    tagTimerRef.current = setInterval(() => {
      timeLeft--; setTagTimeLeft(timeLeft);
      if (timeLeft <= 0) {
        endTagGame();
        wsSend({ type: "tag_end" });
      }
    }, 1000);
  }
  function endTagGame() {
    if (!tagGameActiveRef.current) return;
    tagGameActiveRef.current = false;
    tagGameEndedAtRef.current = Date.now();
    if (tagTimerRef.current) { clearInterval(tagTimerRef.current); tagTimerRef.current = null; }
    stopChaseMusic();
    const isLoser = tagItIdRef.current === userId;
    const loserUsername = tagItUsernameRef.current || "someone";
    setTagMsg(isLoser ? "😬 You were IT!" : `🏃 @${loserUsername} was IT — you survived!`);
    setTimeout(() => setTagMsg(null), 3000);
    setTagGameActive(false); setTagItId(null); setTagItUsername("");
    setTagTimeLeft(TAG_GAME_DURATION);
    tagItIdRef.current = null; tagItUsernameRef.current = "";
  }
  function wsSend(obj: Record<string, unknown>) {
    if (townSocketRef.current?.readyState === 1) townSocketRef.current.send(JSON.stringify(obj));
  }
  function startTag() {
    setTagItId(userId); setTagItUsername(username);
    tagItIdRef.current = userId; tagItUsernameRef.current = username;
    setTagMsg("🏃 You're IT! Chase someone!");
    setTimeout(() => setTagMsg(null), 3000);
    beginTagGame(userId, username);
    wsSend({ type: "tag_start", itId: userId, itUsername: username, timeLeft: TAG_GAME_DURATION });
  }
  function tryTag(targetId: string, targetUsername: string) {
    if (tagItIdRef.current !== userId) return;
    const [px, , pz] = playerPosRef.current;
    const targetMesh = otherMeshesRef.current.get(targetId);
    if (!targetMesh) { setTagMsg("Can't find that player!"); setTimeout(() => setTagMsg(null), 2000); return; }
    const dist = Math.hypot(targetMesh.position.x - px, targetMesh.position.z - pz);
    if (dist > TAG_DIST_3D) { setTagMsg("Too far away! Get closer! 🏃"); setTimeout(() => setTagMsg(null), 2000); return; }
    setTagItId(targetId); setTagItUsername(targetUsername);
    tagItIdRef.current = targetId; tagItUsernameRef.current = targetUsername;
    stopChaseMusic();
    setTagMsg(`🎯 You tagged @${targetUsername}! They're IT!`);
    setTimeout(() => setTagMsg(null), 3000);
    wsSend({ type: "tag_transfer", itId: targetId, itUsername: targetUsername });
  }

  // ── Theater + tag state — one-time fetch on mount, PartyKit WS handles all real-time updates ──
  const lastTheaterJson = useRef<string>("");
  const lastCoins = useRef<number | null>(null);
  useEffect(() => {
    // Single fetch on join to hydrate initial state (screenshare active? coins balance?)
    // No interval — PartyKit theater WS pushes all subsequent changes in real-time
    fetchWithTimeout("/api/town", { method: "GET" }, 5000)
      .then(r => r.json())
      .then((d: Record<string, unknown>) => {
        const ts = d.theater_state as TheaterState | null;
        if (ts) { lastTheaterJson.current = JSON.stringify(ts); setTheaterState(ts); theaterStateRef.current = ts; }
        if (d.coins !== undefined) { lastCoins.current = d.coins as number; setMyCoins(d.coins as number); }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Theater PartyKit WebSocket — real-time theater sync ─────────────────────
  useEffect(() => {
    const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST;
    if (!host || host === "FILL_IN_IF_USING_PARTYKIT" || host === "DISABLED") return;

    let ws: { send: (d: string) => void; close: () => void; addEventListener: (type: string, cb: (e: Event) => void) => void } | null = null;
    let cancelled = false;

    import("partysocket").then(({ default: PartySocket }) => {
      if (cancelled) return;
      ws = new PartySocket({ host, party: "theater", room: "main" }) as unknown as typeof ws;

      ws!.addEventListener("message", (evt: Event) => {
        try {
          const msg = JSON.parse((evt as MessageEvent).data as string);
          if (msg.type === "state" || msg.type === "state-patch") {
            const incoming = msg.type === "state" ? msg.state : msg.patch;
            if (incoming) {
              setTheaterState(prev => {
                const updated = { ...(prev ?? {}), ...incoming } as TheaterState;
                theaterStateRef.current = updated;
                lastTheaterJson.current = JSON.stringify(updated);
                return updated;
              });
            }
          }
        } catch { /* ignore */ }
      });
    });

    return () => { cancelled = true; ws?.close(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Keep chatOpenRef in sync with chatOpen state ──────────────────────────
  useEffect(() => { chatOpenRef.current = chatOpen; }, [chatOpen]);
  useEffect(() => { townBattleRef.current = townBattle; }, [townBattle]);

  // ── NPC voice playback ─────────────────────────────────────────────────────
  const playNPCVoice = useCallback((npcId: string, lineIndex: number) => {
    const src = `${NPC_VOICE_PATH}/${npcId}_${lineIndex}.mp3`;
    const audio = new Audio(src);
    audio.volume = 0.8;
    audio.play().catch(() => {});
  }, []);

  // ── NPC interaction handler ─────────────────────────────────────────────────
  const handleNPCClick = useCallback((npc: MoonhavenNPC) => {
    const now = Date.now();
    if ((npcDialogueCooldownRef.current[npc.id] ?? 0) > now) return;
    npcDialogueCooldownRef.current[npc.id] = now + 2000;

    const idx = npcVoiceIndexRef.current[npc.id] ?? 0;
    npcVoiceIndexRef.current[npc.id] = (idx + 1) % npc.dialogueCount;

    let line: string;
    if (MOONHAVEN_DIALOGUE[npc.id]) {
      line = MOONHAVEN_DIALOGUE[npc.id][idx % MOONHAVEN_DIALOGUE[npc.id].length];
    } else {
      line = `[${npc.name}: voice line ${idx}]`;
    }

    setActiveNPC({ npc, line });
    playNPCVoice(npc.id, idx);

    if (npc.interaction === "vendor") {
      setTimeout(() => setShowVendor(true), 800);
    } else if (npc.interaction === "herald") {
      setTimeout(() => setShowHerald(true), 800);
    } else if (npc.hostile) {
      setTownBattle({
        npc,
        enemyHp: 80,
        maxHp: 80,
        playerHp: 100,
        maxPlayerHp: 100,
        log: [`⚔️ ${npc.name} attacks!`],
      });
    } else if (npc.interaction === "adventure") {
      const mission = generateMission(npc.id, Date.now(), "moonhaven");
      setActiveMission(mission);
      setTimeout(() => setShowAdventure(true), 1000);
    } else if (npc.interaction === "quest") {
      setCaptainDialogTab(myAdventureStats?.class ? "mission" : "class");
      setShowCaptainDialog(true);
    }

    setTimeout(() => setActiveNPC(null), 4000);
  }, [playNPCVoice]);

  // Stable ref so the keydown handler (captured once) always calls the latest version
  const handleNPCClickRef = useRef(handleNPCClick);
  useEffect(() => { handleNPCClickRef.current = handleNPCClick; }, [handleNPCClick]);

  // ── Drive-in open/close ───────────────────────────────────────────────────
  // Drive-in no longer opens a separate room — screen share plays directly on the 3D screen
  // Anyone can share their screen on the drive-in
  const openDriveIn = useCallback(() => {
    if (ssStatus === "idle" && !theaterState?.screenshareOffer?.active) {
      startScreenShare();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ssStatus, theaterState?.screenshareOffer, startScreenShare]);

  // ── Drive-In emote: audio synthesis ─────────────────────────────────────
  const getEmoteAudioCtx = useCallback(() => {
    if (!driveAudioCtxRef.current) driveAudioCtxRef.current = new AudioContext();
    if (driveAudioCtxRef.current.state === "suspended") driveAudioCtxRef.current.resume().catch(() => {});
    return driveAudioCtxRef.current;
  }, []);

  const playEmoteSound = useCallback((id: DriveEmoteId) => {
    try {
      const ctx = getEmoteAudioCtx();
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
        src.buffer = noise(0.12); src.connect(filt); filt.connect(g); g.connect(dest);
        g.gain.value = 0.5; src.start(t);
      } else if (id === "shush") {
        const src = ctx.createBufferSource(), filt = ctx.createBiquadFilter(), g = ctx.createGain();
        filt.type = "bandpass"; filt.frequency.value = 2800; filt.Q.value = 0.7;
        src.buffer = noise(0.4); src.connect(filt); filt.connect(g); g.connect(dest);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07, t + 0.05);
        g.gain.linearRampToValueAtTime(0.07, t + 0.3); g.gain.linearRampToValueAtTime(0, t + 0.4);
        src.start(t);
      } else if (id === "cola") {
        const src = ctx.createBufferSource(), filt = ctx.createBiquadFilter(), g = ctx.createGain();
        filt.type = "bandpass"; filt.Q.value = 2;
        filt.frequency.setValueAtTime(900, t); filt.frequency.linearRampToValueAtTime(200, t + 0.3);
        src.buffer = noise(0.3); src.connect(filt); filt.connect(g); g.connect(dest);
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
  }, [getEmoteAudioCtx]);

  // ── Drive-In emote: project 3D world pos → 2D screen px ─────────────────
  const projectToScreen = useCallback((worldX: number, worldY: number, worldZ: number) => {
    const cam = cameraRef.current;
    if (!cam) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    // Inline THREE.Vector3 project to avoid async import at calltime
    const v = { x: worldX, y: worldY, z: worldZ };
    const e = cam.matrixWorldInverse.elements;
    const pe = cam.projectionMatrix.elements;
    const vx = e[0]*v.x + e[4]*v.y + e[8]*v.z + e[12];
    const vy = e[1]*v.x + e[5]*v.y + e[9]*v.z + e[13];
    const vz = e[2]*v.x + e[6]*v.y + e[10]*v.z + e[14];
    const vw = e[3]*v.x + e[7]*v.y + e[11]*v.z + e[15];
    const cx = (pe[0]*vx + pe[4]*vy + pe[8]*vz + pe[12]*vw) / (pe[3]*vx + pe[7]*vy + pe[11]*vz + pe[15]*vw);
    const cy = (pe[1]*vx + pe[5]*vy + pe[9]*vz + pe[13]*vw) / (pe[3]*vx + pe[7]*vy + pe[11]*vz + pe[15]*vw);
    return { x: (cx * 0.5 + 0.5) * window.innerWidth, y: (-cy * 0.5 + 0.5) * window.innerHeight };
  }, []);

  // ── Drive-In emote: trigger local particle + WS broadcast ────────────────
  const triggerDriveEmote = useCallback((id: DriveEmoteId) => {
    const cds = driveCooldownsRef.current;
    const emote = DRIVE_EMOTES.find(e => e.id === id)!;
    if ((cds[id] ?? 0) > Date.now()) return;
    cds[id] = Date.now() + emote.cd;
    playEmoteSound(id);

    // Kick off cooldown ticker
    if (!driveCdTimerRef.current) {
      driveCdTimerRef.current = setInterval(() => {
        setDriveCdTick(n => n + 1);
        if (!DRIVE_EMOTES.some(e => (driveCooldownsRef.current[e.id] ?? 0) > Date.now())) {
          clearInterval(driveCdTimerRef.current!);
          driveCdTimerRef.current = null;
        }
      }, 80);
    }
    setDriveCdTick(n => n + 1);

    // Broadcast to party WS
    if (townSocketRef.current?.readyState === 1) {
      townSocketRef.current.send(JSON.stringify({ type: "drive_emote", userId, emoteId: id }));
    }

    // Also show on own 3D avatar bubble
    getThree().then(THREE => {
      if (!playerMeshRef.current) return;
      const bubble = playerMeshRef.current.getObjectByName("chat_bubble") as import("three").Mesh | undefined;
      if (bubble) {
        const tex = new THREE.CanvasTexture(makeChatCanvas(emote.emoji));
        (bubble.material as import("three").MeshBasicMaterial).map = tex;
        (bubble.material as import("three").MeshBasicMaterial).needsUpdate = true;
        bubble.visible = true;
        setTimeout(() => { if (bubble) bubble.visible = false; }, 4000);
      }
    });

    // Particle spawn — using player's screen position as origin
    const [px, py, pz] = playerPosRef.current;
    const sp = projectToScreen(px, py + 1.5, pz);
    const pts = driveParticlesRef.current;

    const anchor = (content: string, opts: Partial<DriveParticle> = {}) => pts.push({
      x: sp.x, y: sp.y,
      vx: 0, vy: -0.5, gravity: 0,
      content, alpha: 1, size: 52, decay: 0.005, rotation: 0, rotV: 0,
      ...opts,
    });
    const float = (content: string, opts: Partial<DriveParticle> = {}) => pts.push({
      x: sp.x + (Math.random() - 0.5) * 40, y: sp.y,
      vx: (Math.random() - 0.5) * 2.2, vy: -2.2 - Math.random() * 2,
      content, alpha: 0.9, size: 20, decay: 0.016, gravity: 0.025,
      rotation: 0, rotV: (Math.random() - 0.5) * 0.08,
      ...opts,
    });
    const spawnText = (text: string, color: string, opts: Partial<DriveParticle> = {}) => pts.push({
      x: sp.x, y: sp.y - 60, vx: 0, vy: -1.1,
      content: text, isText: true, textColor: color,
      alpha: 1, size: 16, decay: 0.01, gravity: 0, rotation: 0, rotV: 0,
      ...opts,
    });

    if (id === "laugh") {
      anchor("😂");
      for (let i = 0; i < 5; i++) float("😂", { size: 14 + Math.random() * 10 });
      spawnText("HA HA!", "#ffee00", { size: 18 });
    } else if (id === "cry") {
      anchor("😢");
      for (let i = 0; i < 9; i++) pts.push({
        x: sp.x + (Math.random() - 0.5) * 24, y: sp.y,
        vx: (Math.random() - 0.5) * 0.9, vy: 1.6 + Math.random() * 2.2,
        content: "💧", alpha: 0.9, size: 12 + Math.random() * 8, decay: 0.02, gravity: 0.08,
        rotation: 0, rotV: 0,
      });
      spawnText("...", "#88aaff");
    } else if (id === "tomato") {
      // Get screen-space center of the drive-in screen mesh
      const screenCenter = screenMeshRef.current
        ? (() => { const v = { x: 0, y: 0, z: 0 }; screenMeshRef.current!.getWorldPosition(v as unknown as import("three").Vector3); return projectToScreen(v.x, v.y + 2, v.z); })()
        : { x: window.innerWidth * 0.5, y: window.innerHeight * 0.28 };
      driveTomatoRef.current = { sx: sp.x, sy: sp.y, tx: screenCenter.x, ty: screenCenter.y, t: 0 };
    } else if (id === "shush") {
      anchor("🤫");
      spawnText("SHHH!", "#dd88ff", { size: 17 });
      for (let i = 0; i < 4; i++) pts.push({
        x: sp.x + 20 + i * 14, y: sp.y - 30 - i * 10,
        vx: 1.0 + i * 0.3, vy: -0.7,
        content: "~", isText: true, textColor: "#cc99ee",
        alpha: 0.75 - i * 0.1, size: 14 - i, decay: 0.016, gravity: 0, rotation: 0, rotV: 0,
      });
    } else if (id === "cola") {
      anchor("🥤");
      for (let i = 0; i < 8; i++) pts.push({
        x: sp.x + (Math.random() - 0.5) * 18, y: sp.y,
        vx: (Math.random() - 0.5) * 1.5, vy: -2.2 - Math.random() * 1.5,
        content: "🫧", alpha: 0.85, size: 11 + Math.random() * 9, decay: 0.02, gravity: -0.02,
        rotation: 0, rotV: 0,
      });
      spawnText("glug glug", "#ffcc88", { size: 13 });
    } else if (id === "popcorn") {
      anchor("🍿");
      for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI * 2;
        pts.push({
          x: sp.x + (Math.random() - 0.5) * 20, y: sp.y,
          vx: Math.cos(angle) * (1.5 + Math.random() * 2.2),
          vy: -3 - Math.random() * 2.5,
          content: i % 2 === 0 ? "🌽" : "⭐",
          alpha: 1, size: 13 + Math.random() * 9, decay: 0.017, gravity: 0.1,
          rotation: Math.random() * Math.PI, rotV: (Math.random() - 0.5) * 0.2,
        });
      }
      spawnText("nom nom!", "#ffdd88", { size: 14 });
    }
  }, [playEmoteSound, projectToScreen, userId]);

  // ── Drive-In emote: remote player triggered animation ────────────────────
  const triggerRemoteDriveEmote = useCallback((fromUserId: string, id: DriveEmoteId) => {
    const emote = DRIVE_EMOTES.find(e => e.id === id);
    if (!emote) return;
    playEmoteSound(id);

    // Show on their 3D avatar bubble
    const mesh = otherMeshesRef.current.get(fromUserId);
    if (mesh) {
      const bubble = mesh.getObjectByName("chat_bubble") as import("three").Mesh | undefined;
      if (bubble) {
        getThree().then(THREE => {
          const tex = new THREE.CanvasTexture(makeChatCanvas(emote.emoji));
          (bubble.material as import("three").MeshBasicMaterial).map = tex;
          (bubble.material as import("three").MeshBasicMaterial).needsUpdate = true;
          bubble.visible = true;
          setTimeout(() => { if (bubble) bubble.visible = false; }, 4000);
        });
      }
      // Spawn particles from their screen position
      const wp = { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z };
      const sp = projectToScreen(wp.x, wp.y + 1.5, wp.z);
      const pts = driveParticlesRef.current;
      if (id === "tomato") {
        const screenCenter = screenMeshRef.current
          ? (() => { const v = { x: 0, y: 0, z: 0 }; screenMeshRef.current!.getWorldPosition(v as unknown as import("three").Vector3); return projectToScreen(v.x, v.y + 2, v.z); })()
          : { x: window.innerWidth * 0.5, y: window.innerHeight * 0.28 };
        driveTomatoRef.current = { sx: sp.x, sy: sp.y, tx: screenCenter.x, ty: screenCenter.y, t: 0 };
      } else {
        pts.push({ x: sp.x, y: sp.y, vx: 0, vy: -0.5, gravity: 0, content: emote.emoji, alpha: 1, size: 52, decay: 0.005, rotation: 0, rotV: 0 });
        for (let i = 0; i < 4; i++) pts.push({
          x: sp.x + (Math.random() - 0.5) * 36, y: sp.y,
          vx: (Math.random() - 0.5) * 2, vy: -2 - Math.random() * 1.8,
          content: emote.emoji, alpha: 0.85, size: 16 + Math.random() * 10, decay: 0.018, gravity: 0.025,
          rotation: 0, rotV: (Math.random() - 0.5) * 0.07,
        });
      }
    }
  }, [playEmoteSound, projectToScreen]);

  // ── RPS Arena: game logic ─────────────────────────────────────────────────
  const rpsChoiceEmoji = (c: RPSChoice | null) =>
    c === "rock" ? "🪨" : c === "paper" ? "📄" : c === "scissors" ? "✂️" : "❓";

  const rpsResolve = useCallback((myChoice: RPSChoice, opponentChoice: RPSChoice): "win" | "lose" | "draw" => {
    if (myChoice === opponentChoice) return "draw";
    if ((myChoice === "rock" && opponentChoice === "scissors") ||
        (myChoice === "paper" && opponentChoice === "rock") ||
        (myChoice === "scissors" && opponentChoice === "paper")) return "win";
    return "lose";
  }, []);

  const rpsStopTimer = useCallback(() => {
    if (rpsTimerRef.current) { clearInterval(rpsTimerRef.current); rpsTimerRef.current = null; }
  }, []);

  const rpsCooldownRef = useRef(false);
  const rpsCleanup = useCallback(() => {
    rpsStopTimer();
    setRpsMyChoice(null);
    setRpsOpponentChoice(null);
    setRpsOpponent(null);
    setRpsResultWinner(null);
    setRpsTimeLeft(5);
    rpsMyChoiceRef.current = null;
    rpsOpponentRef.current = null;
    rpsMatchIdRef.current = null;
    rpsMyCommitRef.current = null;
    rpsOpponentCommitRef.current = null;
    rpsOpponentRevealedRef.current = null;
    // Cooldown: prevent immediate re-enter for 2 seconds after cleanup
    rpsCooldownRef.current = true;
    setRpsPhaseSync("idle");
    setTimeout(() => { rpsCooldownRef.current = false; }, 2000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rpsStopTimer]);

  // Show choice emoji above a player's head via chat bubble
  const rpsShowChoiceAboveHead = useCallback((targetMesh: import("three").Group | null, choice: RPSChoice) => {
    if (!targetMesh) return;
    const emoji = rpsChoiceEmoji(choice);
    getThree().then(THREE => {
      const bubble = targetMesh.getObjectByName("chat_bubble") as import("three").Mesh | undefined;
      if (bubble) {
        const tex = new THREE.CanvasTexture(makeChatCanvas(emoji));
        (bubble.material as import("three").MeshBasicMaterial).map = tex;
        (bubble.material as import("three").MeshBasicMaterial).needsUpdate = true;
        bubble.visible = true;
        setTimeout(() => { if (bubble) bubble.visible = false; }, 5000);
      }
    });
  }, []);

  // Commit choice: XOR each char with 7 to lightly obfuscate (not crypto — friends-only)
  const rpsObfuscate = (s: string) => btoa(s.split("").map(c => String.fromCharCode(c.charCodeAt(0) ^ 7)).join(""));

  const rpsSubmitChoice = useCallback((choice: RPSChoice) => {
    if (rpsPhaseRef.current !== "choosing" || rpsMyChoiceRef.current) return;
    rpsMyChoiceRef.current = choice;
    setRpsMyChoice(choice);
    rpsMyCommitRef.current = rpsObfuscate(choice);
    // Send commit (obfuscated)
    if (townSocketRef.current?.readyState === 1) {
      townSocketRef.current.send(JSON.stringify({
        type: "rps_commit", matchId: rpsMatchIdRef.current, userId, commit: rpsMyCommitRef.current,
      }));
    }
    // If opponent already committed and revealed, we can reveal now
    if (rpsOpponentRevealedRef.current) {
      rpsRevealAndFinish(choice, rpsOpponentRevealedRef.current);
    }
    // Safety: if still stuck after 10s, re-send reveal to unstick
    const savedMatchId = rpsMatchIdRef.current;
    setTimeout(() => {
      if (rpsPhaseRef.current === "choosing" && rpsMyChoiceRef.current && rpsMatchIdRef.current === savedMatchId) {
        if (townSocketRef.current?.readyState === 1) {
          townSocketRef.current.send(JSON.stringify({
            type: "rps_reveal", matchId: rpsMatchIdRef.current, userId, choice: rpsMyChoiceRef.current,
          }));
        }
        // If opponent revealed but we missed it, check again
        if (rpsOpponentRevealedRef.current) {
          rpsRevealAndFinish(rpsMyChoiceRef.current, rpsOpponentRevealedRef.current);
        }
      }
    }, 10000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const rpsRevealAndFinish = useCallback((myChoice: RPSChoice, oppChoice: RPSChoice) => {
    rpsStopTimer();
    setRpsOpponentChoice(oppChoice);
    setRpsPhaseSync("revealing");

    // Show choices above heads
    rpsShowChoiceAboveHead(playerMeshRef.current, myChoice);
    const opp = rpsOpponentRef.current;
    if (opp) rpsShowChoiceAboveHead(otherMeshesRef.current.get(opp.userId) ?? null, oppChoice);

    const outcome = rpsResolve(myChoice, oppChoice);
    const winnerId = outcome === "draw" ? null : outcome === "win" ? userId : (opp?.userId ?? null);

    setTimeout(() => {
      setRpsResultWinner(outcome === "draw" ? "draw" : winnerId);
      setRpsPhaseSync("result");

      // Celebration/cry particles
      const [px, py, pz] = playerPosRef.current;
      if (outcome === "win") {
        // laugh particles for winner
        const sp = projectToScreen(px, py + 1.5, pz);
        for (let i = 0; i < 8; i++) driveParticlesRef.current.push({
          x: sp.x + (Math.random() - 0.5) * 50, y: sp.y,
          vx: (Math.random() - 0.5) * 3, vy: -3 - Math.random() * 2,
          content: ["🎉", "⭐", "✨", "🏆"][Math.floor(Math.random() * 4)],
          alpha: 1, size: 24, decay: 0.014, gravity: 0.06, rotation: 0, rotV: (Math.random() - 0.5) * 0.15,
        });
        playEmoteSound("laugh");
      } else if (outcome === "lose") {
        playEmoteSound("cry");
        const sp = projectToScreen(px, py + 1.5, pz);
        for (let i = 0; i < 6; i++) driveParticlesRef.current.push({
          x: sp.x + (Math.random() - 0.5) * 24, y: sp.y,
          vx: (Math.random() - 0.5) * 0.8, vy: 2 + Math.random() * 2,
          content: "💧", alpha: 0.9, size: 12, decay: 0.02, gravity: 0.08, rotation: 0, rotV: 0,
        });
      }

      // Record in DB — both clients POST, ON CONFLICT DO NOTHING makes it idempotent
      if (opp) {
        const [pid1, pid2] = [userId, opp.userId].sort();
        const p1Choice = pid1 === userId ? myChoice : oppChoice;
        const p2Choice = pid1 === userId ? oppChoice : myChoice;
        fetch("/api/rps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            matchId: rpsMatchIdRef.current,
            p1Id: pid1, p2Id: pid2,
            p1Choice, p2Choice,
            winnerId: outcome === "draw" ? null : winnerId,
          }),
        }).catch(() => {});
      }

      // Auto-reset after 4 seconds
      setTimeout(() => rpsCleanup(), 4000);
    }, 800); // 800ms dramatic pause before showing result
  }, [rpsStopTimer, rpsResolve, userId, playEmoteSound, projectToScreen, rpsShowChoiceAboveHead, rpsCleanup]);

  const rpsHandleMessage = useCallback((msg: Record<string, unknown>) => {
    if (msg.type === "rps_enter" && msg.userId !== userId) {
      // Someone entered arena — if we're waiting, start match
      // Only the player with the lower userId initiates to prevent dual-match race
      if (rpsPhaseRef.current === "waiting" && userId < (msg.userId as string)) {
        const opp = { userId: msg.userId as string, username: msg.username as string };
        rpsOpponentRef.current = opp;
        setRpsOpponent(opp);
        const matchId = [userId, msg.userId as string].sort().join("-") + "-" + Date.now();
        rpsMatchIdRef.current = matchId;
        setRpsPhaseSync("choosing");
        setRpsTimeLeft(60);
        // Countdown
        rpsStopTimer();
        let t = 60;
        rpsTimerRef.current = setInterval(() => {
          t--;
          setRpsTimeLeft(t);
          if (t <= 0) {
            rpsStopTimer();
            // Time's up — if no choice made, pick randomly
            if (!rpsMyChoiceRef.current) {
              const autoChoice = (["rock", "paper", "scissors"] as RPSChoice[])[Math.floor(Math.random() * 3)];
              rpsMyChoiceRef.current = autoChoice;
              setRpsMyChoice(autoChoice);
              rpsMyCommitRef.current = rpsObfuscate(autoChoice);
              if (townSocketRef.current?.readyState === 1) {
                townSocketRef.current.send(JSON.stringify({
                  type: "rps_commit", matchId: rpsMatchIdRef.current, userId, commit: rpsMyCommitRef.current, timedOut: true,
                }));
              }
            }
            // If opp already revealed, finish; else wait for their reveal
            if (rpsOpponentRevealedRef.current && rpsPhaseRef.current === "choosing") {
              rpsRevealAndFinish(rpsMyChoiceRef.current!, rpsOpponentRevealedRef.current);
            }
          }
        }, 1000);
        // Broadcast that match started
        if (townSocketRef.current?.readyState === 1) {
          townSocketRef.current.send(JSON.stringify({ type: "rps_start", matchId, p1: userId, p1Name: username, p2: msg.userId, p2Name: msg.username }));
        }
      }
    } else if (msg.type === "rps_start" && (msg.p1 === userId || msg.p2 === userId)) {
      const oppId = msg.p1 === userId ? msg.p2 as string : msg.p1 as string;
      const existing = rpsOpponentRef.current;
      if (!existing || existing.userId !== oppId) {
        // We're the second player — init match on our side
        const oppName = (msg.p1 === userId ? msg.p2Name : msg.p1Name) as string
          || rpsOpponentRef.current?.username
          || nearbyPlayersRef.current.find(p => p.user_id === oppId)?.username
          || "Opponent";
        const opp = { userId: oppId, username: oppName };
        rpsOpponentRef.current = opp;
        setRpsOpponent(opp);
        rpsMatchIdRef.current = msg.matchId as string;
        setRpsPhaseSync("choosing");
        setRpsTimeLeft(60);
        rpsStopTimer();
        let t = 60;
        rpsTimerRef.current = setInterval(() => {
          t--;
          setRpsTimeLeft(t);
          if (t <= 0) {
            rpsStopTimer();
            if (!rpsMyChoiceRef.current) {
              const autoChoice = (["rock", "paper", "scissors"] as RPSChoice[])[Math.floor(Math.random() * 3)];
              rpsMyChoiceRef.current = autoChoice;
              setRpsMyChoice(autoChoice);
              rpsMyCommitRef.current = rpsObfuscate(autoChoice);
              if (townSocketRef.current?.readyState === 1) {
                townSocketRef.current.send(JSON.stringify({
                  type: "rps_commit", matchId: rpsMatchIdRef.current, userId, commit: rpsMyCommitRef.current, timedOut: true,
                }));
              }
            }
            if (rpsOpponentRevealedRef.current && rpsPhaseRef.current === "choosing") {
              rpsRevealAndFinish(rpsMyChoiceRef.current!, rpsOpponentRevealedRef.current);
            }
          }
        }, 1000);
      }
    } else if (msg.type === "rps_commit" && msg.userId !== userId && msg.matchId === rpsMatchIdRef.current) {
      rpsOpponentCommitRef.current = msg.commit as string;
      // Both committed — trigger simultaneous reveal
      if (rpsMyChoiceRef.current) {
        if (townSocketRef.current?.readyState === 1) {
          townSocketRef.current.send(JSON.stringify({
            type: "rps_reveal", matchId: rpsMatchIdRef.current, userId, choice: rpsMyChoiceRef.current,
          }));
        }
        // If opponent already revealed while we were processing, finish now
        if (rpsOpponentRevealedRef.current && rpsPhaseRef.current === "choosing") {
          rpsRevealAndFinish(rpsMyChoiceRef.current, rpsOpponentRevealedRef.current);
        }
      }
    } else if (msg.type === "rps_reveal" && msg.userId !== userId && msg.matchId === rpsMatchIdRef.current) {
      const oppChoice = msg.choice as RPSChoice;
      // Guard: ignore if we already started revealing (prevents echo-loop double calls)
      if (rpsPhaseRef.current === "revealing" || rpsPhaseRef.current === "result") return;
      rpsOpponentRevealedRef.current = oppChoice;
      // Send our reveal (needed when we chose before opponent committed)
      if (rpsMyChoiceRef.current) {
        if (townSocketRef.current?.readyState === 1) {
          townSocketRef.current.send(JSON.stringify({
            type: "rps_reveal", matchId: rpsMatchIdRef.current, userId, choice: rpsMyChoiceRef.current,
          }));
        }
        rpsRevealAndFinish(rpsMyChoiceRef.current, oppChoice);
      }
      // If we haven't chosen yet, store for when we do
    } else if (msg.type === "rps_leave" && msg.userId !== userId) {
      if (rpsOpponentRef.current?.userId === msg.userId && rpsPhaseRef.current !== "result") {
        rpsCleanup();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, rpsStopTimer, rpsRevealAndFinish, rpsCleanup]);

  // ── Drive-In emote: particle canvas rAF loop ─────────────────────────────
  useEffect(() => {
    const canvas = driveEmoteCanvasRef.current;
    if (!canvas) return;
    let running = true;
    const render = () => {
      if (!running) return;
      driveEmoteRafRef.current = requestAnimationFrame(render);
      const ctx2 = canvas.getContext("2d");
      if (!ctx2) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx2.clearRect(0, 0, canvas.width, canvas.height);

      // Draw particles
      for (const pt of driveParticlesRef.current) {
        ctx2.save();
        ctx2.globalAlpha = Math.max(0, pt.alpha);
        ctx2.translate(pt.x, pt.y);
        ctx2.rotate(pt.rotation);
        if (pt.isText) {
          ctx2.font = `bold ${pt.size}px sans-serif`;
          ctx2.fillStyle = pt.textColor ?? "#fff";
          ctx2.textAlign = "center";
          ctx2.fillText(pt.content, 0, 0);
        } else {
          ctx2.font = `${pt.size}px serif`;
          ctx2.textAlign = "center";
          ctx2.fillText(pt.content, 0, 0);
        }
        ctx2.restore();
        pt.x += pt.vx; pt.y += pt.vy; pt.vy += pt.gravity;
        pt.alpha -= pt.decay; pt.rotation += pt.rotV;
      }
      driveParticlesRef.current = driveParticlesRef.current.filter(p => p.alpha > 0);

      // Draw tomato projectile
      const tom = driveTomatoRef.current;
      if (tom) {
        const arc = Math.sin(tom.t * Math.PI) * -120;
        const tx = tom.sx + (tom.tx - tom.sx) * tom.t;
        const ty = tom.sy + (tom.ty - tom.sy) * tom.t + arc;
        ctx2.save();
        ctx2.font = `${28 + tom.t * 8}px serif`;
        ctx2.textAlign = "center";
        ctx2.translate(tx, ty);
        ctx2.rotate(tom.t * Math.PI * 3);
        ctx2.fillText("🍅", 0, 0);
        ctx2.restore();
        tom.t = Math.min(1, tom.t + 0.028);
        if (tom.t >= 1) {
          driveTomatoRef.current = null;
          // Splat on screen
          const cx = 20 + Math.random() * 60;
          const cy = 10 + Math.random() * 80;
          const splats: DriveSplat[] = [
            { id: ++driveSplatIdRef.current, x: cx, y: cy, r: 12 + Math.random() * 7, rot: Math.random() * 360 },
          ];
          for (let d = 0; d < 5; d++) splats.push({
            id: ++driveSplatIdRef.current,
            x: cx + (Math.random() - 0.5) * 24, y: cy + (Math.random() - 0.5) * 24 + 4 + d * 3,
            r: 3 + Math.random() * 5, rot: Math.random() * 360,
          });
          setDriveSplats(prev => [...prev, ...splats]);
          const ids = splats.map(s => s.id);
          setTimeout(() => setDriveSplats(prev => prev.filter(s => !ids.includes(s.id))), 8000);
        }
      }
    };
    render();
    return () => { running = false; if (driveEmoteRafRef.current) cancelAnimationFrame(driveEmoteRafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // canvas ref is stable — particles are driven by refs not state

  // ── WebSocket (PartyKit) ───────────────────────────────────────────────────
  useEffect(() => {
    let ws: { send: (d: string) => void; close: () => void; readyState: number } | null = null;
    let pollTimer: ReturnType<typeof setInterval>;

    const connect = async () => {
      const { PartySocket } = await import("partysocket");
      // Party members share their party room; solo players get a private room so
      // strangers never bleed in. MOONHAVEN_WS_ROOM is kept for future public areas.
      ws = new PartySocket({
        host: process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999",
        room: `moonhaven-${moonhavenRoomId ?? "solo-" + userId}`,
      }) as unknown as typeof ws;
      townSocketRef.current = ws;

      (ws as unknown as { onmessage: (e: MessageEvent) => void }).onmessage = (e: MessageEvent) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "player_update" && msg.player?.user_id !== userId) {
            updateOtherPlayer(msg.player);
            // If we see mclevesque, they are always host
            if (msg.player?.username === "mclevesque") {
              setRoomHostId(msg.player.user_id as string);
            }
            // If we're the host and this is a new player, re-announce so they know who's host
            const pid = msg.player?.user_id as string;
            if (pid && !seenPlayersRef.current.has(pid)) {
              seenPlayersRef.current.add(pid);
              // Re-announce host status to the room so the new joiner learns it
              setTimeout(() => {
                ws?.send(JSON.stringify({ type: "room_host_announce", hostId: userId }));
              }, 300);
            }
          } else if (msg.type === "player_leave") {
            removeOtherPlayer(msg.userId);
            // If host left, clear host (next eligible player can claim)
            if (msg.userId === /* roomHostId captured in closure isn't reliable; use event */ undefined) { /* handled below */ }
            setRoomHostId(prev => {
              if (prev === msg.userId) return null; // host left — next join will trigger election
              return prev;
            });
            if (msg.userId) {
              setRoomHandId(prev => prev === msg.userId ? null : prev);
            }
          } else if (msg.type === "chat" && msg.userId !== userId) {
            showRemoteChat(msg.userId, msg.text);
          } else if (msg.type === "tag_start" && msg.itId && !tagGameActiveRef.current && Date.now() - tagGameEndedAtRef.current > 3000) {
            beginTagGame(msg.itId, msg.itUsername ?? "someone", msg.timeLeft ?? TAG_GAME_DURATION);
          } else if (msg.type === "tag_transfer" && msg.itId) {
            tagItIdRef.current = msg.itId; tagItUsernameRef.current = msg.itUsername ?? "";
            setTagItId(msg.itId); setTagItUsername(msg.itUsername ?? "");
            if (msg.itId === userId) { startChaseMusic(); setTagMsg("🏃 You're IT now! Run!"); setTimeout(() => setTagMsg(null), 3000); }
            else { stopChaseMusic(); }
          } else if (msg.type === "tag_end" && tagGameActiveRef.current) {
            endTagGame();
          } else if (msg.type === "drive_emote" && msg.userId !== userId && msg.emoteId) {
            triggerRemoteDriveEmote(msg.userId, msg.emoteId as DriveEmoteId);
          } else if (msg.type === "screen-share-started" && msg.hostId && msg.hostId !== userId) {
            // Host just started — update theaterState so auto-request effect fires immediately
            setTheaterState(prev => ({ ...(prev ?? {}), screenshareOffer: { active: true, hostId: msg.hostId as string } } as TheaterState));
          } else if (msg.type === "screen-signal" && msg.fromUser && msg.fromUser !== userId) {
            handleScreenSignalRef.current?.({ fromUser: msg.fromUser as string, signalType: msg.signalType as string, payload: msg.payload as Record<string, unknown> });
          } else if (msg.type === "screen-share-ended") {
            setSsStatus("idle");
            hasRequestedRef.current = false;
            clearVideoFromScreen();
            screenPeersRef.current.forEach(pc => pc.close());
            screenPeersRef.current.clear();
            setTheaterState(prev => prev ? { ...prev, screenshareOffer: null } : prev);
          } else if (msg.type === "rps_enter" || msg.type === "rps_start" || msg.type === "rps_commit" || msg.type === "rps_reveal" || msg.type === "rps_leave") {
            rpsHandleMessage(msg as Record<string, unknown>);
          } else if (msg.type === "jukebox_play" && msg.url) {
            setActiveJukebox({ url: msg.url as string, startedAt: (msg.startedAt as number) ?? Date.now(), byName: (msg.byName as string) ?? "Someone" });
            setJukeboxPending(null);
          } else if (msg.type === "jukebox_stop") {
            setActiveJukebox(null);
          } else if (msg.type === "jukebox_suggest" && msg.url && msg.suggesterName) {
            setJukeboxPending({ url: msg.url as string, suggesterName: msg.suggesterName as string, suggesterId: msg.suggesterId as string });
          } else if (msg.type === "room_host_announce" && msg.hostId) {
            // Cancel our own election timer — someone else is already host
            if (hostClaimTimerRef.current) { clearTimeout(hostClaimTimerRef.current); hostClaimTimerRef.current = null; }
            setRoomHostId(msg.hostId as string);
          } else if (msg.type === "hand_grant" && msg.handId) {
            setRoomHandId(msg.handId as string);
          } else if (msg.type === "hand_revoke") {
            setRoomHandId(null);
          } else if (msg.type === "kick" && msg.targetId === userId) {
            // We were kicked — go back to lobby
            setShowLobby(true);
            setMoonhavenRoomId(null);
            if (typeof window !== "undefined") {
              const url = new URL(window.location.href);
              url.searchParams.delete("room");
              window.history.replaceState({}, "", url.toString());
            }
          }
        } catch { /* ignore */ }
      };

      // ── Host election — if no one announces within 2s, claim host ────────
      seenPlayersRef.current.clear();
      if (hostClaimTimerRef.current) clearTimeout(hostClaimTimerRef.current);
      setRoomHostId(null);
      setRoomHandId(null);
      // mclevesque is always the default party leader
      if (username === "mclevesque") {
        setTimeout(() => {
          ws?.send(JSON.stringify({ type: "room_host_announce", hostId: userId }));
          setRoomHostId(userId);
        }, 300);
      } else {
        hostClaimTimerRef.current = setTimeout(() => {
          hostClaimTimerRef.current = null;
          setRoomHostId(prev => {
            if (prev === null) {
              // No host heard — we claim it
              ws?.send(JSON.stringify({ type: "room_host_announce", hostId: userId }));
              return userId;
            }
            return prev;
          });
        }, 2000);
      }
    };

    const sendPosition = () => {
      const [px, , pz] = playerPosRef.current;
      const payload = JSON.stringify({
        type: "player_update",
        player: {
          user_id: userId,
          username,
          avatar_url: avatarUrl,
          avatar_config: avatarConfig ?? null,
          x: Math.round(px),
          y: Math.round(pz), // town protocol uses y for the horizontal plane
          direction: "right",
          chat_msg: null,
          chat_at: null,
          zone: "moonhaven",
        },
      });
      if (townSocketRef.current?.readyState === 1) {
        townSocketRef.current.send(payload);
      }
    };

    connect().then(() => {
      sendPosition(); // register in userConnMap immediately — critical for late-join screen share routing
      pollTimer = setInterval(sendPosition, 2000);
    });

    return () => {
      ws?.close();
      clearInterval(pollTimer);
      if (hostClaimTimerRef.current) { clearTimeout(hostClaimTimerRef.current); hostClaimTimerRef.current = null; }
    };
  // moonhavenRoomId added so WS reconnects when room changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, username, avatarUrl, moonhavenRoomId]);

  // ── Three.js scene setup ───────────────────────────────────────────────────
  useEffect(() => {
    if (showQualityPicker || !mountRef.current) return;
    let destroyed = false;
    let THREE: ThreeModule;
    let GLTFLoader: unknown;

    const init = async () => {
      THREE = await getThree();
      setLoadMsg("Loading scene engine…");
      const gltfMod = await import("three/examples/jsm/loaders/GLTFLoader.js").catch(() => null);
      GLTFLoader = gltfMod?.GLTFLoader ?? null;

      if (destroyed || !mountRef.current) return;

      // ── Renderer ──────────────────────────────────────────────────────────
      setLoadMsg("Creating renderer…");
      const QL = detectQuality(); // read fresh from localStorage for this init
      const renderer = new THREE.WebGLRenderer({
        antialias: QL === "high",
        alpha: false,
        powerPreference: QL === "low" ? "low-power" : "high-performance",
      });
      renderer.setPixelRatio(QL === "low" ? 1 : Math.min(window.devicePixelRatio, QL === "med" ? 1.5 : 2));
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
      renderer.shadowMap.enabled = QL !== "low";
      if (QL !== "low") renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = QL === "low" ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 2.2;
      mountRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // ── Scene ─────────────────────────────────────────────────────────────
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0a0820);
      if (QL !== "low") scene.fog = new THREE.Fog(0x0a0820, QL === "med" ? 55 : 45, QL === "med" ? 105 : 90);
      sceneRef.current = scene;

      // ── Camera ────────────────────────────────────────────────────────────
      const camera = new THREE.PerspectiveCamera(
        60, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, QL === "low" ? 80 : 200
      );
      cameraRef.current = camera;
      updateCameraOrbit(camera);

      // ── Lights — moonlit night ────────────────────────────────────────────
      // Low quality: bright ambient + 1 directional only (no PointLights = huge perf win)
      const ambient = new THREE.AmbientLight(0x7788bb, QL === "low" ? 7.0 : 4.5);
      scene.add(ambient);

      const moon = new THREE.DirectionalLight(0xddeeff, QL === "low" ? 3.5 : 5.5);
      moon.position.set(20, 40, -10);
      moon.castShadow = QL !== "low";
      if (QL !== "low") {
        moon.shadow.mapSize.setScalar(QL === "high" ? 1024 : 512);
        moon.shadow.camera.near = 1; moon.shadow.camera.far = 120;
        moon.shadow.camera.left = -60; moon.shadow.camera.right = 60;
        moon.shadow.camera.top = 60; moon.shadow.camera.bottom = -60;
      }
      scene.add(moon);

      // Fountain glow + plaza lanterns — skip on low (each PointLight = expensive shader cost)
      const fountainGlow = QL !== "low" ? new THREE.PointLight(0x2244ff, 6.0, 40) : null;
      if (fountainGlow) { fountainGlow.position.set(0, 2, 0); scene.add(fountainGlow); }

      const lanternPositions: [number, number, number][] = [
        [8, 2.5, 0], [-8, 2.5, 0], [0, 2.5, 8], [0, 2.5, -8],
        [12, 2.5, 12], [-12, 2.5, 12], [12, 2.5, -12], [-12, 2.5, -12],
      ];
      const activeLanterns = QL === "low" ? [] : QL === "med" ? lanternPositions.slice(0, 4) : lanternPositions;
      for (const pos of activeLanterns) {
        const lantern = new THREE.PointLight(0xffcc66, 3.0, 22);
        lantern.position.set(...pos);
        scene.add(lantern);
      }

      // ── Ground ────────────────────────────────────────────────────────────
      const groundGeo = new THREE.PlaneGeometry(120, 120, QL === "low" ? 1 : 24, QL === "low" ? 1 : 24);
      let groundMat: import("three").Material;
      if (QL === "low") {
        // Low: flat solid color — zero texture uploads, zero canvas computation
        groundMat = new THREE.MeshBasicMaterial({ color: 0x3a3852 });
      } else {
        // Med/High: procedural cobblestone canvas texture
        const cobbleCanvas = document.createElement("canvas");
        cobbleCanvas.width = 512; cobbleCanvas.height = 512;
        const cctx2 = cobbleCanvas.getContext("2d")!;
        cctx2.fillStyle = "#3a3852"; cctx2.fillRect(0, 0, 512, 512);
        const rng = (min: number, max: number) => min + Math.random() * (max - min);
        for (let ci = 0; ci < 200; ci++) {
          const cx2 = rng(0, 512), cy2 = rng(0, 512);
          const cw = rng(18, 38), ch = rng(14, 26);
          const gray = Math.floor(rng(62, 88));
          cctx2.fillStyle = `rgb(${gray-8},${gray-5},${gray+4})`;
          cctx2.beginPath(); cctx2.roundRect(cx2, cy2, cw, ch, 3); cctx2.fill();
          cctx2.strokeStyle = `rgba(15,14,25,0.6)`; cctx2.lineWidth = 1.5; cctx2.stroke();
        }
        const cobbleTex = new THREE.CanvasTexture(cobbleCanvas);
        cobbleTex.wrapS = THREE.RepeatWrapping; cobbleTex.wrapT = THREE.RepeatWrapping;
        cobbleTex.repeat.set(8, 8);
        groundMat = new THREE.MeshStandardMaterial({ map: cobbleTex, color: 0x7a7898, roughness: 0.92, metalness: 0.03 });
      }
      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = QL !== "low";
      scene.add(ground);

      // Grass ring — skip on low (off-screen anyway due to reduced draw distance)
      if (QL !== "low") {
        const grassGeo = new THREE.RingGeometry(56, 90, QL === "med" ? 24 : 48);
        const grassMat = new THREE.MeshStandardMaterial({ color: 0x1a3a18, roughness: 1 });
        const grass = new THREE.Mesh(grassGeo, grassMat);
        grass.rotation.x = -Math.PI / 2; grass.position.y = 0.02;
        scene.add(grass);
      }

      // ── Moon Fountain (central) ───────────────────────────────────────────
      setLoadMsg("Building fountain…");
      buildFountain(THREE, scene);

      // ── Lantern posts ─────────────────────────────────────────────────────
      setLoadMsg("Placing lanterns…");
      for (const pos of activeLanterns) {
        buildLanternPost(THREE, scene, pos);
      }

      // ── Buildings ─────────────────────────────────────────────────────────
      setLoadMsg("Constructing buildings…");
      for (const bld of MOONHAVEN_BUILDINGS) {
        buildBuilding(THREE, scene, bld);
      }

      // ── Drive-In Theater ──────────────────────────────────────────────────
      setLoadMsg("Setting up Drive-In…");
      screenMeshRef.current = buildDriveIn(THREE, scene, QL);

      // ── RPS Arena ─────────────────────────────────────────────────────────
      setLoadMsg("Forging the arena…");
      (() => {
        const [ax, ay, az] = RPS_ARENA_POS;
        // Platform
        const platGeo = new THREE.CylinderGeometry(RPS_ARENA_RADIUS, RPS_ARENA_RADIUS, 0.35, 32);
        const platMat = new THREE.MeshStandardMaterial({ color: 0x2a1a3a, roughness: 0.7, metalness: 0.3 });
        const plat = new THREE.Mesh(platGeo, platMat); plat.position.set(ax, ay + 0.175, az); plat.receiveShadow = true; scene.add(plat);
        // Glowing ring border
        const ringGeo = new THREE.TorusGeometry(RPS_ARENA_RADIUS, 0.18, 8, 48);
        const ringMat = new THREE.MeshStandardMaterial({ color: 0xaa44ff, emissive: 0x7722cc, emissiveIntensity: 1.2, roughness: 0.3, metalness: 0.6 });
        const ring = new THREE.Mesh(ringGeo, ringMat); ring.rotation.x = Math.PI / 2; ring.position.set(ax, ay + 0.36, az); scene.add(ring);
        // Inner divider line (thin plane)
        const lineGeo = new THREE.PlaneGeometry(RPS_ARENA_RADIUS * 2, 0.06);
        const lineMat = new THREE.MeshStandardMaterial({ color: 0xdd99ff, emissive: 0xaa55ff, emissiveIntensity: 0.8, roughness: 0.5 });
        const line = new THREE.Mesh(lineGeo, lineMat); line.rotation.x = -Math.PI / 2; line.position.set(ax, ay + 0.38, az); scene.add(line);
        // Torch posts at cardinal corners
        const torchPositions: [number, number][] = [[ax+4.5, az], [ax-4.5, az], [ax, az+4.5], [ax, az-4.5]];
        torchPositions.forEach(([tx, tz]) => {
          const postGeo = new THREE.CylinderGeometry(0.1, 0.12, 2.2, 6);
          const postMat = new THREE.MeshStandardMaterial({ color: 0x5c3d1e, roughness: 0.8 });
          const post = new THREE.Mesh(postGeo, postMat); post.position.set(tx, ay + 1.1, tz); scene.add(post);
          // Flame orb
          const flameGeo = new THREE.SphereGeometry(0.22, 6, 6);
          const flameMat = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff3300, emissiveIntensity: 2.5, roughness: 0.3 });
          const flame = new THREE.Mesh(flameGeo, flameMat); flame.position.set(tx, ay + 2.35, tz); scene.add(flame);
          if (QL !== "low") {
            const light = new THREE.PointLight(0xff5500, 1.8, 8); light.position.set(tx, ay + 2.5, tz); scene.add(light);
          }
        });
        // Floating sign: "⚔ RPS ARENA"
        const signCanvas = document.createElement("canvas"); signCanvas.width = 320; signCanvas.height = 80;
        const sc = signCanvas.getContext("2d")!;
        sc.fillStyle = "rgba(18,6,36,0.92)"; sc.roundRect(4, 4, 312, 72, 12); sc.fill();
        sc.strokeStyle = "#aa44ff"; sc.lineWidth = 3; sc.strokeRect(5, 5, 310, 70);
        sc.font = "bold 32px serif"; sc.textAlign = "center"; sc.fillStyle = "#e8d4ff"; sc.fillText("⚔ RPS ARENA", 160, 38);
        sc.font = "13px monospace"; sc.fillStyle = "#9966cc"; sc.fillText("Enter the circle to fight", 160, 62);
        const signTex = new THREE.CanvasTexture(signCanvas);
        const signGeo = new THREE.PlaneGeometry(4.5, 1.1);
        const signMat = new THREE.MeshBasicMaterial({ map: signTex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
        const sign = new THREE.Mesh(signGeo, signMat); sign.position.set(ax, ay + 5.2, az - RPS_ARENA_RADIUS - 0.5); scene.add(sign);
        // Sign post
        const spostGeo = new THREE.CylinderGeometry(0.07, 0.07, 4.8, 6);
        const spostMat = new THREE.MeshStandardMaterial({ color: 0x5c3d1e, roughness: 0.8 });
        const spost = new THREE.Mesh(spostGeo, spostMat); spost.position.set(ax, ay + 2.4, az - RPS_ARENA_RADIUS - 0.5); scene.add(spost);
      })();

      // ── Stars backdrop — skip on low (pure cosmetic, many points) ───────────
      if (QL !== "low") { setLoadMsg("Painting stars…"); buildStars(THREE, scene); }

      // ── Forest trees ──────────────────────────────────────────────────────
      setLoadMsg("Growing forest…");
      buildForestTrees(THREE, scene);

      // ── Horse & Cart — skip on low ────────────────────────────────────────
      if (QL !== "low") { setLoadMsg("Summoning horse…"); buildHorseAndCart(THREE, scene); }

      // ── Market awnings ────────────────────────────────────────────────────
      setLoadMsg("Building market…");
      buildMarketAwnings(THREE, scene);

      // ── Cobblestone paths ─────────────────────────────────────────────────
      setLoadMsg("Laying cobblestones…");
      buildCobblePath(THREE, scene);

      // ── Castle walls & gate ───────────────────────────────────────────────
      buildCastleWalls(THREE, scene);

      // ── Player mesh ───────────────────────────────────────────────────────
      const playerGroup = await buildBillboard(THREE, avatarUrl, username, 0xffffff, avatarConfig ?? undefined);
      playerGroup.position.set(...MOONHAVEN_SPAWN);
      scene.add(playerGroup);
      playerMeshRef.current = playerGroup;
      playerPosRef.current = [...MOONHAVEN_SPAWN];

      // ── NPCs — load in parallel (sequential await was hanging init on missing GLBs) ──
      setLoadMsg("Summoning NPCs…");
      const npcGroups = await Promise.all(MOONHAVEN_NPCS.map(npc => buildNPCBillboard(THREE, npc, GLTFLoader)));
      if (destroyed) return () => {};
      MOONHAVEN_NPCS.forEach((npc, i) => {
        const group = npcGroups[i];
        group.position.set(...npc.position);
        group.scale.set(1.5, 1.5, 1.5);
        scene.add(group);
        npcMeshesRef.current.set(npc.id, group);
      });

      // ── Raycaster (click-to-move + NPC click) ─────────────────────────────
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();

      const onCanvasClick = (e: MouseEvent) => {
        if (!mountRef.current) return;
        const rect = mountRef.current.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        // Check NPC clicks first
        const npcHits: Array<[MoonhavenNPC, number]> = [];
        for (const npc of MOONHAVEN_NPCS) {
          const mesh = npcMeshesRef.current.get(npc.id);
          if (!mesh) continue;
          const objects = raycaster.intersectObject(mesh, true);
          if (objects.length > 0) npcHits.push([npc, objects[0].distance]);
        }
        if (npcHits.length > 0) {
          npcHits.sort((a, b) => a[1] - b[1]);
          handleNPCClick(npcHits[0][0]);
          return;
        }

        // Click-to-move on ground
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const target = new THREE.Vector3();
        raycaster.ray.intersectPlane(groundPlane, target);
        if (target) {
          targetPosRef.current = [target.x, 0, target.z];
        }
      };

      renderer.domElement.addEventListener("click", onCanvasClick);

      // ── Camera: scroll zoom + right-click drag to orbit ─────────────────
      const onWheel = (e: WheelEvent) => {
        camOrbitRef.current.radius = Math.max(5, Math.min(40, camOrbitRef.current.radius + e.deltaY * 0.02));
      };
      renderer.domElement.addEventListener("wheel", onWheel, { passive: true });
      renderer.domElement.addEventListener("contextmenu", e => e.preventDefault());

      const onMouseDown = (e: MouseEvent) => {
        if (e.button === 2) {
          camOrbitRef.current.dragging = true;
          camOrbitRef.current.lastX = e.clientX;
          camOrbitRef.current.lastY = e.clientY;
        }
      };
      const onMouseMove = (e: MouseEvent) => {
        if (!camOrbitRef.current.dragging) return;
        const dx = e.clientX - camOrbitRef.current.lastX;
        const dy = e.clientY - camOrbitRef.current.lastY;
        camOrbitRef.current.lastX = e.clientX;
        camOrbitRef.current.lastY = e.clientY;
        camOrbitRef.current.theta -= dx * 0.005;
        camOrbitRef.current.phi = Math.max(0.1, Math.min(1.3, camOrbitRef.current.phi + dy * 0.005));
      };
      const onMouseUp = () => { camOrbitRef.current.dragging = false; };
      renderer.domElement.addEventListener("mousedown", onMouseDown);
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);

      // ── Keyboard ─────────────────────────────────────────────────────────
      const onKeyDown = (e: KeyboardEvent) => {
        keysRef.current.add(e.code);
        if (e.code === "Enter" && !chatOpenRef.current) { setChatOpen(true); e.preventDefault(); }
        if (e.code === "Escape") { setChatOpen(false); setActiveNPC(null); }
        if (e.code === "KeyC" && !chatOpenRef.current) { setShowCharacter(c => !c); e.preventDefault(); }
        if (e.code === "KeyB" && !chatOpenRef.current) { setShowStash(s => !s); e.preventDefault(); }
        if (e.code === "KeyE" && !chatOpenRef.current) {
          // Tag nearest player if you're IT
          if (tagGameActiveRef.current && tagItIdRef.current === userId) {
            const [px, , pz] = playerPosRef.current;
            let nearest: TownPlayer | null = null;
            let nearestDist = Infinity;
            for (const p of nearbyPlayersRef.current) {
              if (p.user_id === userId) continue;
              const d = Math.hypot(p.x - px, p.y - pz);
              if (d < nearestDist) { nearestDist = d; nearest = p; }
            }
            if (nearest) { tryTag(nearest.user_id, nearest.username); e.preventDefault(); return; }
          }
          if (nearestNPCRef.current) { handleNPCClickRef.current(nearestNPCRef.current); e.preventDefault(); }
          else if (driveInNearRef.current) { openDriveIn(); e.preventDefault(); }
        }
        if (e.code === "Space" && !chatOpenRef.current) {
          if (jumpRef.current.grounded) {
            jumpRef.current.vy = 9;
            jumpRef.current.grounded = false;
            e.preventDefault();
            // Hop sound
            try {
              const ac = new AudioContext();
              const osc = ac.createOscillator();
              const g = ac.createGain();
              osc.connect(g); g.connect(ac.destination);
              osc.type = "sine";
              osc.frequency.setValueAtTime(320, ac.currentTime);
              osc.frequency.exponentialRampToValueAtTime(180, ac.currentTime + 0.18);
              g.gain.setValueAtTime(0.22, ac.currentTime);
              g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.22);
              osc.start(ac.currentTime); osc.stop(ac.currentTime + 0.22);
              osc.onended = () => ac.close();
            } catch { /* silent */ }
          }
        }
      };
      const onKeyUp = (e: KeyboardEvent) => { keysRef.current.delete(e.code); };
      // Clear all held keys on blur — prevents stuck movement when switching tabs/apps
      const onWindowBlur = () => keysRef.current.clear();
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      window.addEventListener("blur", onWindowBlur);

      // ── Resize ────────────────────────────────────────────────────────────
      const onResize = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener("resize", onResize);

      // ── Clock ────────────────────────────────────────────────────────────
      const clock = new THREE.Clock();
      clockRef.current = clock;

      // ── Animation loop ────────────────────────────────────────────────────
      let npcPatrolIndex: Record<string, number> = {};
      let npcPatrolT: Record<string, number> = {};
      let colorSampleFrame = 0;

      const animate = () => {
        frameIdRef.current = requestAnimationFrame(animate);
        const dt = Math.min(clock.getDelta(), 0.1);
        const [px, , pz] = playerPosRef.current;

        // Arrow keys — orbit camera (look around without mouse)
        const camRotSpeed = 1.8; // radians per second
        if (keysRef.current.has("ArrowLeft"))  camOrbitRef.current.theta += camRotSpeed * dt;
        if (keysRef.current.has("ArrowRight")) camOrbitRef.current.theta -= camRotSpeed * dt;
        if (keysRef.current.has("ArrowUp"))    camOrbitRef.current.phi = Math.max(0.1, camOrbitRef.current.phi - camRotSpeed * 0.7 * dt);
        if (keysRef.current.has("ArrowDown"))  camOrbitRef.current.phi = Math.min(1.3, camOrbitRef.current.phi + camRotSpeed * 0.7 * dt);

        // Gamepad input — left stick = move, right stick = camera orbit, A = jump
        const gamepads = navigator.getGamepads?.() ?? [];
        let gpLx = 0, gpLy = 0, gpRx = 0, gpRy = 0;
        let gpAPressed = false;
        for (const gp of gamepads) {
          if (!gp) continue;
          const DEAD = 0.20; // raised deadzone to kill drift
          const lx = Math.abs(gp.axes[0] ?? 0) > DEAD ? (gp.axes[0] ?? 0) : 0;
          const ly = Math.abs(gp.axes[1] ?? 0) > DEAD ? (gp.axes[1] ?? 0) : 0;
          const rx = Math.abs(gp.axes[2] ?? 0) > DEAD ? (gp.axes[2] ?? 0) : 0;
          const ry = Math.abs(gp.axes[3] ?? 0) > DEAD ? (gp.axes[3] ?? 0) : 0;
          if (Math.abs(lx) > Math.abs(gpLx)) gpLx = lx;
          if (Math.abs(ly) > Math.abs(gpLy)) gpLy = ly;
          if (Math.abs(rx) > Math.abs(gpRx)) gpRx = rx;
          if (Math.abs(ry) > Math.abs(gpRy)) gpRy = ry;
          // Button 0 = A (Xbox) / Cross (PS) — jump on press, not hold
          if (gp.buttons[0]?.pressed) gpAPressed = true;
        }
        // A button jump — edge-detect so it only fires once per press
        const gpAPrev = gpPrevARef.current;
        gpPrevARef.current = gpAPressed;
        if (gpAPressed && !gpAPrev && jumpRef.current.grounded) {
          jumpRef.current.vy = 9;
          jumpRef.current.grounded = false;
        }
        // Right stick → camera orbit
        if (gpRx !== 0) camOrbitRef.current.theta -= gpRx * camRotSpeed * dt;
        if (gpRy !== 0) camOrbitRef.current.phi = Math.max(0.1, Math.min(1.3, camOrbitRef.current.phi + gpRy * camRotSpeed * 0.7 * dt));

        // Player movement — WASD relative to camera
        const speed = 6;
        let mx = 0, mz = 0;
        const camFwd = new THREE.Vector3(
          Math.sin(camOrbitRef.current.theta),
          0,
          Math.cos(camOrbitRef.current.theta)
        );
        const camRight = new THREE.Vector3(
          Math.cos(camOrbitRef.current.theta),
          0,
          -Math.sin(camOrbitRef.current.theta)
        );

        // ── NORMAL WALKING MOVEMENT ──────────────────────────────────────

        if (keysRef.current.has("KeyW")) {
          mx -= camFwd.x; mz -= camFwd.z;
        }
        if (keysRef.current.has("KeyS")) {
          mx += camFwd.x; mz += camFwd.z;
        }
        if (keysRef.current.has("KeyA")) {
          mx -= camRight.x; mz -= camRight.z;
        }
        if (keysRef.current.has("KeyD")) {
          mx += camRight.x; mz += camRight.z;
        }
        // Gamepad left stick input — Y axis: negative = forward on stick = move forward
        if (gpLx !== 0 || gpLy !== 0) {
          mx += camRight.x * gpLx + camFwd.x * gpLy;  // +gpLy because stick-fwd = negative Y
          mz += camRight.z * gpLx + camFwd.z * gpLy;
          targetPosRef.current = null; // cancel click-to-move
        }
        // Mobile joystick input
        if (joystickRef.current.active) {
          mx += camRight.x * joystickRef.current.dx - camFwd.x * joystickRef.current.dy;
          mz += camRight.z * joystickRef.current.dx - camFwd.z * joystickRef.current.dy;
        }

        // Click-to-move (clears on WASD)
        if ((mx !== 0 || mz !== 0)) {
          targetPosRef.current = null;
        } else if (targetPosRef.current) {
          const [tx, , tz] = targetPosRef.current;
          const dx = tx - px, dz = tz - pz;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < 0.3) {
            targetPosRef.current = null;
          } else {
            mx = dx / dist;
            mz = dz / dist;
          }
        }

        // Eject from buildings FIRST (every frame, even when standing still)
        {
          let ejX = px, ejZ = pz; let ejected = false;
          for (const bld of MOONHAVEN_BUILDINGS) {
            const [bx, , bz] = bld.position;
            const hw = bld.size[0] / 2 + 1.2, hd = bld.size[2] / 2 + 1.2;
            if (ejX > bx - hw && ejX < bx + hw && ejZ > bz - hd && ejZ < bz + hd) {
              const pL = ejX - (bx - hw), pR = (bx + hw) - ejX;
              const pN = ejZ - (bz - hd), pS = (bz + hd) - ejZ;
              const minP = Math.min(pL, pR, pN, pS);
              if (minP === pL) ejX = bx - hw;
              else if (minP === pR) ejX = bx + hw;
              else if (minP === pN) ejZ = bz - hd;
              else ejZ = bz + hd;
              ejected = true;
            }
          }
          if (ejected) {
            playerPosRef.current = [ejX, playerPosRef.current[1], ejZ];
            if (playerMeshRef.current) { playerMeshRef.current.position.x = ejX; playerMeshRef.current.position.z = ejZ; }
          }
        }

        // Jump physics
        const walkPos = playerPosRef.current; // may have been ejected
        const [, py, ] = walkPos;
        let newY = py;
        if (!jumpRef.current.grounded || py > 0) {
          jumpRef.current.vy -= 22 * dt; // gravity
          newY = Math.max(0, py + jumpRef.current.vy * dt);
          if (newY <= 0) {
            newY = 0;
            jumpRef.current.vy = 0;
            jumpRef.current.grounded = true;
          }
        }

        const len = Math.sqrt(mx * mx + mz * mz);
        if (len > 0) {
          const newX = Math.max(-55, Math.min(78, walkPos[0] + (mx / len) * speed * dt));
          const newZ = Math.max(-55, Math.min(86, walkPos[2] + (mz / len) * speed * dt));
          // Building collision on new position
          let colX = newX, colZ = newZ;
          for (const bld of MOONHAVEN_BUILDINGS) {
            const [bx, , bz] = bld.position;
            const hw = bld.size[0] / 2 + 1.2, hd = bld.size[2] / 2 + 1.2;
            if (colX > bx - hw && colX < bx + hw && colZ > bz - hd && colZ < bz + hd) {
              const pL = colX - (bx - hw), pR = (bx + hw) - colX;
              const pN = colZ - (bz - hd), pS = (bz + hd) - colZ;
              const minP = Math.min(pL, pR, pN, pS);
              if (minP === pL) colX = bx - hw;
              else if (minP === pR) colX = bx + hw;
              else if (minP === pN) colZ = bz - hd;
              else colZ = bz + hd;
            }
          }
          playerPosRef.current = [colX, newY, colZ];
          if (playerMeshRef.current) {
            playerMeshRef.current.position.set(colX, newY, colZ);
            playerMeshRef.current.rotation.y = Math.atan2(mx, mz);
          }
        } else if (newY !== py) {
          playerPosRef.current = [px, newY, playerPosRef.current[2]];
          if (playerMeshRef.current) playerMeshRef.current.position.y = newY;
        }

        // Update camera orbit around player
        updateCameraOrbit(camera);

        // NPC patrol movement
        for (const npc of MOONHAVEN_NPCS) {
          if (!npc.patrol || npc.patrol.length < 2) continue;
          const mesh = npcMeshesRef.current.get(npc.id);
          if (!mesh) continue;

          npcPatrolT[npc.id] = (npcPatrolT[npc.id] ?? 0) + dt * 0.4;
          const t = npcPatrolT[npc.id];
          const iIdx = npcPatrolIndex[npc.id] ?? 0;
          if (t >= 1) {
            npcPatrolT[npc.id] = 0;
            npcPatrolIndex[npc.id] = (iIdx + 1) % npc.patrol.length;
          }
          const from = npc.patrol[iIdx];
          const to = npc.patrol[(iIdx + 1) % npc.patrol.length];
          mesh.position.set(
            from[0] + (to[0] - from[0]) * Math.min(t, 1),
            from[1] + (to[1] - from[1]) * Math.min(t, 1),
            from[2] + (to[2] - from[2]) * Math.min(t, 1),
          );
          // Face direction of travel
          const dx = to[0] - from[0], dz = to[2] - from[2];
          if (Math.abs(dx) + Math.abs(dz) > 0.01) {
            mesh.rotation.y = Math.atan2(dx, dz);
          }
        }

        // Billboard faces — always face camera
        const camPos = camera.position.clone();
        for (const [, group] of otherMeshesRef.current) {
          group.children.forEach(child => {
            if (child.userData.billboard) {
              child.lookAt(camPos);
            }
          });
        }
        for (const [, group] of npcMeshesRef.current) {
          group.children.forEach(child => {
            if (child.userData.billboard) {
              child.lookAt(camPos);
            }
          });
        }
        if (playerMeshRef.current) {
          playerMeshRef.current.children.forEach(child => {
            if (child.userData.billboard) child.lookAt(camPos);
          });
        }

        // Zone detection
        const [cpx, , cpz] = playerPosRef.current;
        for (const zone of MOONHAVEN_ZONES) {
          const b = zone.bounds;
          if (cpx >= b.minX && cpx <= b.maxX && cpz >= b.minZ && cpz <= b.maxZ) {
            setCurrentZone(prev => prev !== zone.id ? zone.id : prev);
            break;
          }
        }

        // Proximity bandit detection — auto-show combat HUD when in range
        if (!townBattleRef.current) {
          let closestBandit: MoonhavenNPC | null = null;
          let closestDist = 7; // detection radius in world units
          for (const npc of MOONHAVEN_NPCS) {
            if (!npc.hostile) continue;
            if (deadNpcsRef.current.has(npc.id)) continue;
            const [nx, , nz] = npc.position;
            const mesh = npcMeshesRef.current.get(npc.id);
            const npcPos = mesh ? mesh.position : new THREE.Vector3(nx, 0, nz);
            const dist = Math.hypot(cpx - npcPos.x, cpz - npcPos.z);
            if (dist < closestDist) { closestDist = dist; closestBandit = npc; }
          }
          if (closestBandit !== nearbyBanditRef.current) {
            nearbyBanditRef.current = closestBandit;
            setNearbyBandit(closestBandit);
          }
        }

        // NPC proximity — find nearest interactable NPC within 7 units
        {
          let closestNPC: MoonhavenNPC | null = null;
          let closestNPCDist = 7;
          for (const npc of MOONHAVEN_NPCS) {
            if (npc.hostile) continue;
            const mesh = npcMeshesRef.current.get(npc.id);
            const [nx, , nz] = npc.position;
            const npcX = mesh ? mesh.position.x : nx;
            const npcZ = mesh ? mesh.position.z : nz;
            const d = Math.hypot(cpx - npcX, cpz - npcZ);
            if (d < closestNPCDist) { closestNPCDist = d; closestNPC = npc; }
          }
          if (closestNPC?.id !== nearestNPCRef.current?.id) {
            nearestNPCRef.current = closestNPC;
            setNearestNPC(closestNPC);
          }
        }

        // Drive-in proximity — screen at [62, 0, 52], interact within 18 units (bigger theater)
        const distToScreen = Math.hypot(cpx - 62, cpz - 52);
        const nearScreen = distToScreen < 18;
        if (nearScreen !== driveInNearRef.current) {
          driveInNearRef.current = nearScreen;
          setDriveInNear(nearScreen);
        }

        // RPS Arena proximity
        const distToArena = Math.hypot(cpx - RPS_ARENA_POS[0], cpz - RPS_ARENA_POS[2]);
        const nearArena = distToArena < RPS_ARENA_RADIUS + 3;
        if (nearArena !== rpsNearRef.current) { rpsNearRef.current = nearArena; setRpsNear(nearArena); }
        // Enter/leave arena circle
        const insideArena = distToArena < RPS_ARENA_RADIUS;
        if (insideArena && rpsPhaseRef.current === "idle" && !rpsCooldownRef.current) {
          setRpsPhaseSync("waiting");
          if (townSocketRef.current?.readyState === 1) {
            townSocketRef.current.send(JSON.stringify({ type: "rps_enter", userId, username }));
          }
        } else if (!insideArena && rpsPhaseRef.current !== "idle") {
          // Walking out of arena during any phase — clean up the match
          if (townSocketRef.current?.readyState === 1) {
            townSocketRef.current.send(JSON.stringify({ type: "rps_leave", userId }));
          }
          rpsCleanup();
        }

        // Proximity audio — volume scales with distance to screen (like a real drive-in)
        const vid = screenVideoRef.current;
        if (vid && vid.srcObject) {
          const isHost = isSharingRef.current;
          if (isHost) {
            // Host stays muted (avoids echo — they hear their own audio from the source)
            vid.muted = true; vid.volume = 0;
          } else {
            // Viewers: unmute, volume based on distance
            // Full volume at 8 units, fades to 0 at 55 units
            const maxDist = 55, fullDist = 8;
            const vol = Math.max(0, Math.min(1, 1 - (distToScreen - fullDist) / (maxDist - fullDist)));
            vid.muted = false;
            vid.volume = vol * vol; // quadratic falloff for natural feel
          }
        }

        // Force VideoTexture to upload new frame every tick (Three.js doesn't auto-call update())
        if (videoTextureRef.current) videoTextureRef.current.needsUpdate = true;

        // Screen glow — dynamic color sampling when video is playing
        if (screenMeshRef.current) {
          const sLight = screenMeshRef.current.userData.screenLight as import("three").PointLight | undefined;
          if (sLight) {
            const isLive = ssStatusRef.current === "hosting" || ssStatusRef.current === "viewing";
            colorSampleFrame++;
            if (isLive && colorSampleFrame % 6 === 0 && screenVideoRef.current && colorSampleCtx.current && colorSampleCanvas.current) {
              // Sample average color from video for reactive ambient glow (throttled to every 6th frame)
              try {
                const vid = screenVideoRef.current;
                if (vid.readyState >= 2) {
                  colorSampleCtx.current.drawImage(vid, 0, 0, 8, 8);
                  const d = colorSampleCtx.current.getImageData(0, 0, 8, 8).data;
                  let r = 0, g = 0, b = 0, n = 0;
                  for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i+1]; b += d[i+2]; n++; }
                  if (n > 0) {
                    r = r/n/255; g = g/n/255; b = b/n/255;
                    sLight.color.setRGB(0.3 + r * 0.7, 0.3 + g * 0.7, 0.3 + b * 0.7);
                    sLight.intensity = 2.0 + ((r + g + b) / 3) * 1.5;
                  }
                }
              } catch { /* cross-origin — fallback to static glow */ }
            } else {
              sLight.intensity = 0.8 + Math.sin(clock.elapsedTime * 0.8) * 0.2;
              sLight.color.set(0x4455cc);
            }
          }
        }

        // Fountain glow pulse
        if (fountainGlow) fountainGlow.intensity = 2 + Math.sin(clock.elapsedTime * 1.5) * 0.5;

        // Smooth remote player interpolation — move toward target at constant speed
        const REMOTE_SPEED = 7; // units/sec — matches a brisk walking pace
        for (const [uid, mesh] of otherMeshesRef.current) {
          const target = targetPositionsRef.current.get(uid);
          if (!target) continue;
          const dx = target.x - mesh.position.x;
          const dz = target.z - mesh.position.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist > 0.05) {
            const step = Math.min(dist, REMOTE_SPEED * dt);
            mesh.position.x += (dx / dist) * step;
            mesh.position.z += (dz / dist) * step;
          }
        }

        renderer.render(scene, camera);
      };

      animate();
      setLoading(false);

      // Pause on tab hide to save battery
      const onVisChange = () => {
        if (document.hidden) {
          cancelAnimationFrame(frameIdRef.current);
        } else if (!destroyed) {
          animate();
        }
      };
      document.addEventListener("visibilitychange", onVisChange);

      return () => {
        destroyed = true;
        document.removeEventListener("visibilitychange", onVisChange);
        cancelAnimationFrame(frameIdRef.current);
        renderer.domElement.removeEventListener("click", onCanvasClick);
        renderer.domElement.removeEventListener("wheel", onWheel);
        renderer.domElement.removeEventListener("mousedown", onMouseDown);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        window.removeEventListener("blur", onWindowBlur);
        window.removeEventListener("resize", onResize);
        renderer.dispose();
        mountRef.current?.removeChild(renderer.domElement);
      };
    };

    const cleanup = init().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      setInitError(msg || "WebGL context failed. Try a different browser or device.");
      setLoading(false);
      return undefined;
    });
    return () => { destroyed = true; cleanup.then(fn => fn?.()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showQualityPicker]);

  // ── Camera orbit updater ──────────────────────────────────────────────────
  function updateCameraOrbit(camera: import("three").PerspectiveCamera) {
    const { theta, phi, radius } = camOrbitRef.current;
    const [px, py, pz] = playerPosRef.current;
    camera.position.set(
      px + radius * Math.sin(theta) * Math.cos(phi),
      py + radius * Math.sin(phi),
      pz + radius * Math.cos(theta) * Math.cos(phi),
    );
    camera.lookAt(px, py + 1, pz);
  }

  // ── Remote player management ──────────────────────────────────────────────
  const updateOtherPlayer = useCallback(async (player: TownPlayer) => {
    const THREE = await getThree();
    const scene = sceneRef.current;
    if (!scene) return;

    let group = otherMeshesRef.current.get(player.user_id);
    const isNew = !group;
    if (!group) {
      group = await buildBillboard(THREE, player.avatar_url, player.username, 0x88ffaa, player.avatar_config ?? undefined);
      scene.add(group);
      otherMeshesRef.current.set(player.user_id, group);
    }
    // First time: snap to position. After that: set target for smooth interpolation.
    if (isNew) {
      group.position.set(player.x, 0, player.y);
    }
    targetPositionsRef.current.set(player.user_id, { x: player.x, z: player.y });

    // Update chat bubble if present
    const bubbleMesh = group.getObjectByName("chat_bubble") as import("three").Mesh | undefined;
    if (player.chat_msg) {
      if (bubbleMesh) {
        const tex = new THREE.CanvasTexture(makeChatCanvas(player.chat_msg));
        (bubbleMesh.material as import("three").MeshBasicMaterial).map = tex;
        (bubbleMesh.material as import("three").MeshBasicMaterial).needsUpdate = true;
        bubbleMesh.visible = true;
      }
    } else if (bubbleMesh) {
      bubbleMesh.visible = false;
    }

    setNearbyPlayers(prev => {
      const filtered = prev.filter(p => p.user_id !== player.user_id);
      const next = [...filtered, player].slice(-20);
      nearbyPlayersRef.current = next;
      return next;
    });
    setPlayerCount(c => Math.max(c, otherMeshesRef.current.size + 1));
  }, []);

  const removeOtherPlayer = useCallback((id: string) => {
    const mesh = otherMeshesRef.current.get(id);
    if (mesh && sceneRef.current) {
      sceneRef.current.remove(mesh);
      otherMeshesRef.current.delete(id);
    }
    setNearbyPlayers(prev => {
      const next = prev.filter(p => p.user_id !== id);
      nearbyPlayersRef.current = next;
      return next;
    });
  }, []);

  const showRemoteChat = useCallback(async (userId: string, text: string) => {
    const THREE = await getThree();
    const group = otherMeshesRef.current.get(userId);
    if (!group) return;
    const bubbleMesh = group.getObjectByName("chat_bubble") as import("three").Mesh | undefined;
    if (bubbleMesh) {
      const tex = new THREE.CanvasTexture(makeChatCanvas(text));
      (bubbleMesh.material as import("three").MeshBasicMaterial).map = tex;
      (bubbleMesh.material as import("three").MeshBasicMaterial).needsUpdate = true;
      bubbleMesh.visible = true;
      setTimeout(() => { if (bubbleMesh) bubbleMesh.visible = false; }, 5000);
    }
  }, []);

  // ── Send chat ─────────────────────────────────────────────────────────────
  const sendChat = useCallback(() => {
    const text = chatInput.trim();
    if (!text) return;
    setChatInput("");
    setChatOpen(false);

    townSocketRef.current?.send(JSON.stringify({
      type: "chat",
      userId,
      text,
    }));

    // Show own bubble
    getThree().then(THREE => {
      if (!playerMeshRef.current) return;
      const bubbleMesh = playerMeshRef.current.getObjectByName("chat_bubble") as import("three").Mesh | undefined;
      if (bubbleMesh) {
        const tex = new THREE.CanvasTexture(makeChatCanvas(text));
        (bubbleMesh.material as import("three").MeshBasicMaterial).map = tex;
        (bubbleMesh.material as import("three").MeshBasicMaterial).needsUpdate = true;
        bubbleMesh.visible = true;
        setTimeout(() => { if (bubbleMesh) bubbleMesh.visible = false; }, 5000);
      }
    });
  }, [chatInput, userId]);

  // ── Mobile touch handlers (floating joystick + two-finger camera) ────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (joystickId.current === null) {
        joystickId.current = t.identifier;
        joystickCenter.current = { x: t.clientX, y: t.clientY };
        joystickRef.current = { active: true, dx: 0, dy: 0 };
        setJoystickVis({ cx: t.clientX, cy: t.clientY, kx: t.clientX, ky: t.clientY, visible: true });
      } else if (camTouchId.current === null) {
        camTouchId.current = t.identifier;
        camTouchLast.current = { x: t.clientX, y: t.clientY };
      }
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === joystickId.current) {
        const cx = joystickCenter.current.x;
        const cy = joystickCenter.current.y;
        const rawDx = t.clientX - cx;
        const rawDy = t.clientY - cy;
        const dist = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
        if (dist < VJOY_DEAD) {
          joystickRef.current = { active: true, dx: 0, dy: 0 };
          setJoystickVis(v => ({ ...v, kx: cx, ky: cy }));
        } else {
          const clamped = Math.min(dist, VJOY_R);
          const angle = Math.atan2(rawDy, rawDx);
          const kx = cx + Math.cos(angle) * clamped;
          const ky = cy + Math.sin(angle) * clamped;
          joystickRef.current = { active: true, dx: Math.cos(angle) * (clamped / VJOY_R), dy: Math.sin(angle) * (clamped / VJOY_R) };
          setJoystickVis(v => ({ ...v, kx, ky }));
        }
      } else if (t.identifier === camTouchId.current) {
        const dx = t.clientX - camTouchLast.current.x;
        const dy = t.clientY - camTouchLast.current.y;
        camOrbitRef.current.theta -= dx * 0.007;
        camOrbitRef.current.phi = Math.max(0.15, Math.min(1.2, camOrbitRef.current.phi + dy * 0.007));
        camTouchLast.current = { x: t.clientX, y: t.clientY };
      }
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === joystickId.current) {
        joystickId.current = null;
        joystickRef.current = { active: false, dx: 0, dy: 0 };
        setJoystickVis(v => ({ ...v, visible: false }));
      } else if (t.identifier === camTouchId.current) {
        camTouchId.current = null;
      }
    }
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  // Show lobby before 3D scene loads
  if (showLobby) {
    return <MoonhavenLobby onEnter={handleEnterRoom} initialCode={roomCode ?? undefined} />;
  }

  if (showQualityPicker) {
    const auto = detectQuality();
    const labels: Record<QualityLevel, { title: string; desc: string; icon: string }> = {
      low:  { title: "Low",    icon: "🌑", desc: "Best performance. Mobile / older hardware." },
      med:  { title: "Medium", icon: "🌓", desc: "Balanced. Shadows + smooth lighting." },
      high: { title: "High",   icon: "🌕", desc: "Full quality. Antialiasing + HDR." },
    };
    return (
      <div style={{ position: "fixed", inset: 0, background: "#070514", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "monospace", zIndex: 9999 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🌙</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#e0d8ff", marginBottom: 4 }}>Moonhaven</div>
        <div style={{ fontSize: 13, color: "#6655aa", marginBottom: 32 }}>Choose graphics quality before entering</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 340, padding: "0 20px", boxSizing: "border-box" }}>
          {(["low", "med", "high"] as QualityLevel[]).map(q => {
            const { title, icon, desc } = labels[q];
            const isAuto = q === auto;
            return (
              <button key={q} onClick={() => selectQuality(q)} style={{
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(100,80,220,0.35)",
                borderRadius: 12, padding: "14px 18px", cursor: "pointer", textAlign: "left",
                display: "flex", alignItems: "center", gap: 14, transition: "background 0.15s",
              }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(100,80,220,0.18)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
              >
                <span style={{ fontSize: 28 }}>{icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#ccbbff", fontWeight: 800, fontSize: 15, marginBottom: 3 }}>
                    {title}
                    {isAuto && <span style={{ marginLeft: 8, fontSize: 10, color: "#7766aa", fontWeight: 600, background: "rgba(100,80,220,0.2)", borderRadius: 4, padding: "1px 6px" }}>RECOMMENDED</span>}
                  </div>
                  <div style={{ color: "#554477", fontSize: 12 }}>{desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100dvh", background: "#0a0820", overflow: "hidden", fontFamily: "monospace" }}>
      {/* ── Customize avatar banner (first-time prompt) ───────────────────── */}
      {!avatarConfig && !loading && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 700,
          background: "linear-gradient(90deg, rgba(124,58,237,0.9), rgba(0,229,255,0.7))",
          backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
          padding: "8px 16px",
        }}>
          <span style={{ color: "#fff", fontSize: 13 }}>🎭 You haven&apos;t customized your avatar yet!</span>
          <a href="/customize" style={{
            background: "rgba(255,255,255,0.2)", color: "#fff",
            border: "1px solid rgba(255,255,255,0.4)", borderRadius: 6,
            padding: "4px 12px", fontSize: 12, fontWeight: 700,
            textDecoration: "none", letterSpacing: "0.05em",
          }}>
            Customize →
          </a>
        </div>
      )}

      {/* Three.js canvas mount — touch handlers for floating joystick + camera */}
      <div ref={mountRef} style={{ position: "absolute", inset: avatarConfig || loading ? 0 : "36px 0 0 0", touchAction: "none" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      />

      {/* ── Quality toggle ─────────────────────────────────────────────────── */}
      <div style={{ position: "fixed", bottom: 8, right: 8, zIndex: 600, userSelect: "none" }}>
        <button
          onClick={() => setShowQualityPanel(p => !p)}
          onPointerDown={e => e.stopPropagation()}
          style={{ background: "rgba(10,6,28,0.85)", border: "1px solid rgba(100,80,220,0.5)",
            borderRadius: 8, color: "#aabbff", padding: "5px 10px", cursor: "pointer",
            fontSize: 11, fontWeight: 700, letterSpacing: 1 }}
        >
          ⚙️ {quality === "low" ? "LOW" : quality === "med" ? "MED" : "HIGH"}
        </button>
        {showQualityPanel && (
          <div
            onPointerDown={e => e.stopPropagation()}
            style={{ position: "absolute", bottom: 34, right: 0, background: "rgba(8,5,22,0.97)",
              border: "1px solid rgba(100,80,220,0.4)", borderRadius: 12, padding: "12px 14px",
              display: "flex", flexDirection: "column", gap: 6, minWidth: 170,
              boxShadow: "0 4px 24px rgba(0,0,0,0.6)" }}
          >
            <div style={{ color: "#9988cc", fontSize: 11, fontWeight: 700, marginBottom: 2 }}>
              Graphics Quality
            </div>
            {(["low", "med", "high"] as QualityLevel[]).map(q => (
              <button key={q}
                onClick={() => { localStorage.setItem("mh_quality", q); window.location.reload(); }}
                style={{ background: q === quality ? "rgba(100,80,220,0.35)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${q === quality ? "rgba(150,120,255,0.6)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 7, color: q === quality ? "#ccbbff" : "#666",
                  padding: "7px 12px", cursor: "pointer", fontSize: 12,
                  fontWeight: q === quality ? 700 : 400, textAlign: "left", display: "flex", justifyContent: "space-between" }}
              >
                <span>{q === "low" ? "🟢 Low  (Fast)" : q === "med" ? "🟡 Medium" : "🔴 High  (Best)"}</span>
                {q === quality && <span style={{ opacity: 0.7 }}>✓</span>}
              </button>
            ))}
            <div style={{ fontSize: 10, color: "rgba(120,110,180,0.45)", marginTop: 4, lineHeight: 1.4 }}>
              Low = smooth on phones &amp; older PCs<br/>Reload applies the change
            </div>
            <hr style={{ border: "none", borderTop: "1px solid rgba(100,80,220,0.2)", margin: "4px 0" }} />
            <a href="/customize"
              onPointerDown={e => e.stopPropagation()}
              style={{ background: "rgba(100,80,220,0.18)", border: "1px solid rgba(150,120,255,0.3)",
                borderRadius: 7, color: "#ccbbff", padding: "7px 12px", fontSize: 12,
                textDecoration: "none", display: "block", textAlign: "left" }}
            >
              🎭 Customize Avatar
            </a>
          </div>
        )}
      </div>

      {/* ── Floating joystick visual (spawns at touch point) ──────────────── */}
      {joystickVis.visible && (
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 600 }}>
          {/* Base ring */}
          <div style={{
            position: "absolute",
            left: joystickVis.cx - VJOY_R,
            top: joystickVis.cy - VJOY_R,
            width: VJOY_R * 2,
            height: VJOY_R * 2,
            borderRadius: "50%",
            border: "2px solid rgba(120,100,255,0.5)",
            background: "rgba(10,6,28,0.45)",
          }} />
          {/* Knob */}
          <div style={{
            position: "absolute",
            left: joystickVis.kx - 22,
            top: joystickVis.ky - 22,
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "rgba(130,100,255,0.65)",
            border: "2px solid rgba(180,160,255,0.85)",
          }} />
        </div>
      )}

      {/* Loading screen */}
      {loading && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 100,
          background: "radial-gradient(ellipse at center, #0d0828 0%, #050514 100%)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20,
        }}>
          <div style={{ fontSize: 52 }}>🌙</div>
          <div style={{ fontSize: 22, color: "#aabbff", fontWeight: 900, letterSpacing: 4 }}>MOONHAVEN</div>
          <div style={{ fontSize: 12, color: "rgba(150,170,255,0.6)", letterSpacing: 2 }}>{loadMsg}</div>
          <div style={{ width: 200, height: 3, background: "rgba(100,120,255,0.2)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", background: "#8899ff", borderRadius: 2, animation: "mh-load 1.8s ease-in-out infinite" }} />
          </div>
          <style>{`@keyframes mh-load { 0%{width:10%} 50%{width:80%} 100%{width:10%} }`}</style>
        </div>
      )}

      {/* Error recovery screen */}
      {initError && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 110,
          background: "radial-gradient(ellipse at center, #1a0828 0%, #050514 100%)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18,
        }}>
          <div style={{ fontSize: 44 }}>⚠️</div>
          <div style={{ fontSize: 18, color: "#ff8866", fontWeight: 900 }}>Moonhaven failed to load</div>
          <div style={{ fontSize: 11, color: "rgba(200,150,150,0.45)", marginBottom: 4 }}>Failed at: {loadMsg}</div>
          <div style={{ fontSize: 12, color: "rgba(200,150,150,0.6)", maxWidth: 280, textAlign: "center" }}>{initError}</div>
          <button onClick={() => window.location.reload()} style={{
            padding: "10px 28px", borderRadius: 10, border: "1px solid rgba(200,100,100,0.4)",
            background: "rgba(200,80,80,0.2)", color: "#ff9988", fontSize: 14, cursor: "pointer", fontFamily: "monospace",
          }}>Reload</button>
        </div>
      )}

      {/* HUD — top bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px",
        background: "linear-gradient(to bottom, rgba(5,3,20,0.85) 0%, transparent 100%)",
        pointerEvents: "none",
      }}>
        <div style={{ pointerEvents: "all", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 10, color: "rgba(150,170,255,0.35)", fontWeight: 700, letterSpacing: "0.08em" }}>🌙 MOONHAVEN</div>
          <div style={{ fontSize: 10, color: "rgba(150,170,255,0.4)" }}>
            {currentZone === "plaza" ? "🌙 Moon Plaza" :
             currentZone === "market" ? "🏪 Market Row" :
             currentZone === "castle" ? "🏰 Castle Aurvale" :
             currentZone === "forest" ? "🌲 Moonwood Forest" :
             currentZone === "tavern" ? "🍺 Silver Moon Tavern" :
             currentZone === "workshop" ? "⚒️ Forge District" :
             currentZone === "drive_in" ? "🎬 Moonhaven Drive-In" :
             "🌙 Moonhaven"}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, pointerEvents: "all" }}>
          <div style={{ fontSize: 12, color: "#ffd700", fontWeight: 700 }}>🪙 {myCoins}</div>
          <button onClick={() => setShowPlayersPanel(p => !p)} style={{ fontSize: 11, color: "rgba(150,170,255,0.7)", background: showPlayersPanel ? "rgba(100,80,200,0.25)" : "none", border: showPlayersPanel ? "1px solid rgba(100,80,200,0.4)" : "1px solid transparent", borderRadius: 6, padding: "3px 7px", cursor: "pointer" }}>👥 {playerCount}</button>
        </div>
      </div>

      {/* ── Mobile bottom navbar ────────────────────────────────────────────── */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-evenly",
        padding: "8px 8px calc(8px + env(safe-area-inset-bottom))",
        background: "linear-gradient(to top, rgba(5,3,20,0.92) 0%, transparent 100%)",
        pointerEvents: "none",
      }}>
        {([
          { label: "Hub", emoji: "🔥", href: "/greatsouls/hub" },
          { label: "Watch", emoji: "🎬", href: "/greatsouls/watch" },
          { label: "Friends", emoji: "👥", href: "/friends" },
          { label: "Chat", emoji: "💬", href: "/messages" },
          { label: "Profile", emoji: "👤", href: "/greatsouls/profile" },
        ] as const).map(item => (
          <a
            key={item.label}
            href={item.href}
            style={{
              pointerEvents: "all", display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              color: "rgba(180,160,255,0.6)", textDecoration: "none",
              fontSize: 9, fontWeight: 700, letterSpacing: "0.05em",
              padding: "6px 10px", borderRadius: 8,
              minWidth: 44, minHeight: 44, justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 18 }}>{item.emoji}</span>
            <span>{item.label}</span>
          </a>
        ))}
      </div>

      {/* ── Players Panel ─────────────────────────────────────────────────────── */}
      {showPlayersPanel && (
        <div style={{
          position: "absolute", top: 52, right: 14, zIndex: 200,
          background: "rgba(8,5,30,0.97)", backdropFilter: "blur(14px)",
          border: "1px solid rgba(100,80,200,0.4)", borderRadius: 14,
          padding: "14px 16px", minWidth: 240, maxWidth: 300, color: "#fff", fontFamily: "monospace",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#c4b5ff" }}>👥 Players in Room</span>
            <button onClick={() => setShowPlayersPanel(false)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
          {/* Self */}
          {(() => {
            const roleBadge = roomHostId === userId ? " 👑" : roomHandId === userId ? " ⚔️" : "";
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, padding: "6px 8px", background: "rgba(100,80,200,0.12)", borderRadius: 8 }}>
                <img src={avatarUrl} alt={username} style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "#c4b5ff", flex: 1 }}>@{username}{roleBadge} <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>(you)</span></span>
              </div>
            );
          })()}
          {/* Other players */}
          {nearbyPlayers.filter(p => p.user_id !== userId).map(p => {
            const isHost = p.user_id === roomHostId;
            const isHand = p.user_id === roomHandId;
            const canMod = roomHostId === userId || roomHandId === userId;
            const isMe = roomHostId === userId;
            return (
              <div key={p.user_id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, padding: "6px 8px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                <img src={p.avatar_url || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${p.username}`} alt={p.username} style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: isHost ? "#ffd700" : isHand ? "#ffaa44" : "rgba(255,255,255,0.75)", flex: 1 }}>
                  @{p.username}{isHost ? " 👑" : isHand ? " ⚔️" : ""}
                </span>
                {/* Mod actions */}
                {canMod && !isHost && (
                  <div style={{ display: "flex", gap: 4 }}>
                    {isMe && (
                      isHand ? (
                        <button
                          onClick={() => { townSocketRef.current?.send(JSON.stringify({ type: "hand_revoke" })); setRoomHandId(null); }}
                          title="Revoke Hand of the King"
                          style={{ padding: "2px 6px", fontSize: 10, background: "rgba(255,170,50,0.15)", border: "1px solid rgba(255,170,50,0.4)", borderRadius: 5, color: "#ffaa44", cursor: "pointer" }}
                        >⚔️✕</button>
                      ) : (
                        <button
                          onClick={() => { townSocketRef.current?.send(JSON.stringify({ type: "hand_grant", handId: p.user_id })); setRoomHandId(p.user_id); }}
                          title="Crown as Hand of the King"
                          style={{ padding: "2px 6px", fontSize: 10, background: "rgba(255,200,0,0.1)", border: "1px solid rgba(255,200,0,0.35)", borderRadius: 5, color: "#ffd070", cursor: "pointer" }}
                        >⚔️</button>
                      )
                    )}
                    <button
                      onClick={() => { townSocketRef.current?.send(JSON.stringify({ type: "kick", targetId: p.user_id })); }}
                      title="Kick from room"
                      style={{ padding: "2px 6px", fontSize: 10, background: "rgba(200,50,50,0.15)", border: "1px solid rgba(200,50,50,0.4)", borderRadius: 5, color: "#f87171", cursor: "pointer" }}
                    >✕</button>
                  </div>
                )}
              </div>
            );
          })}
          {nearbyPlayers.filter(p => p.user_id !== userId).length === 0 && (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", textAlign: "center", padding: "8px 0" }}>No other players nearby</div>
          )}
          {/* Hand of the King note */}
          {roomHandId === userId && (
            <div style={{ marginTop: 8, padding: "6px 8px", background: "rgba(255,170,50,0.08)", borderRadius: 7, border: "1px solid rgba(255,170,50,0.25)", fontSize: 10, color: "#ffaa44" }}>
              ⚔️ You are the Hand of the King — you have mod powers
            </div>
          )}
        </div>
      )}

      {/* [E] Interact prompt — floats above toolbar when near an NPC or the drive-in screen */}
      {!loading && (nearestNPC || (driveInNear && ssStatus === "idle")) && !activeNPC && (
        <div style={{
          position: "absolute", bottom: 110, left: "50%", transform: "translateX(-50%)",
          zIndex: 55, pointerEvents: "none",
          display: "flex", alignItems: "center", gap: 8,
          background: "rgba(5,3,20,0.88)", border: "1px solid rgba(130,110,220,0.45)",
          borderRadius: 10, padding: "6px 14px",
          animation: "npc-pop 0.18s ease-out",
        }}>
          <span style={{
            background: "rgba(100,80,200,0.35)", border: "1px solid rgba(150,130,255,0.5)",
            borderRadius: 5, padding: "2px 7px", fontSize: 11, fontWeight: 700, color: "#ccbbff", letterSpacing: 1,
          }}>E</span>
          <span style={{ fontSize: 13, color: "rgba(210,200,255,0.85)", fontWeight: 600 }}>
            {nearestNPC
              ? `Talk to ${nearestNPC.name}`
              : "Open Drive-In Theater"}
          </span>
          {nearestNPC && <span style={{ fontSize: 16 }}>{nearestNPC.emoji}</span>}
        </div>
      )}

      {/* NPC dialogue popup */}
      {activeNPC && (
        <div style={{
          position: "absolute", bottom: 120, left: "50%", transform: "translateX(-50%)",
          zIndex: 60, maxWidth: 420, width: "90%",
          background: "linear-gradient(135deg, rgba(10,8,30,0.97) 0%, rgba(20,10,50,0.97) 100%)",
          border: "1px solid rgba(130,110,220,0.5)", borderRadius: 14,
          padding: "14px 18px", boxShadow: "0 8px 32px rgba(80,50,200,0.3)",
          animation: "npc-pop 0.2s ease-out",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 26 }}>{activeNPC.npc.emoji}</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#ccbbff" }}>{activeNPC.npc.name}</div>
              <div style={{ fontSize: 13, color: "rgba(150,130,200,0.6)" }}>{activeNPC.npc.role}</div>
            </div>
          </div>
          <div style={{ fontSize: 18, color: "rgba(220,215,255,0.95)", lineHeight: 1.6, fontStyle: "italic" }}>
            "{activeNPC.line}"
          </div>
        </div>
      )}

      {/* Chat input */}
      {chatOpen && (
        <div style={{
          position: "absolute", bottom: 116, left: "50%", transform: "translateX(-50%)",
          zIndex: 60, display: "flex", gap: 8, alignItems: "center",
        }}>
          <input
            autoFocus
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => { e.stopPropagation(); if (e.key === "Enter") sendChat(); if (e.key === "Escape") setChatOpen(false); }}
            placeholder="Say something…"
            style={{
              padding: "10px 16px", borderRadius: 12, border: "2px solid rgba(130,110,220,0.5)",
              background: "rgba(10,8,30,0.95)", color: "#fff", fontSize: 18, fontWeight: 600,
              width: 320, outline: "none",
            }}
          />
          <button onClick={sendChat} style={{
            padding: "10px 18px", borderRadius: 12, border: "2px solid rgba(130,110,220,0.5)",
            background: "rgba(80,60,180,0.6)", color: "#ccbbff", fontSize: 16, fontWeight: 700, cursor: "pointer",
          }}>Send</button>
        </div>
      )}

      {/* Bottom toolbar */}
      {((): React.ReactNode => {
        const toolbarBtns: Array<{ icon: string; label: string; onClick: () => void; highlight?: boolean }> = [
          { icon: "💬", label: "Chat [Enter]", onClick: () => setChatOpen(o => !o) },
          { icon: "🦘", label: "Jump [Space]", onClick: () => { if (jumpRef.current.grounded) { jumpRef.current.vy = 9; jumpRef.current.grounded = false; try { const ac = new AudioContext(); const osc = ac.createOscillator(); const g = ac.createGain(); osc.connect(g); g.connect(ac.destination); osc.type = "sine"; osc.frequency.setValueAtTime(320, ac.currentTime); osc.frequency.exponentialRampToValueAtTime(180, ac.currentTime + 0.18); g.gain.setValueAtTime(0.22, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.22); osc.start(ac.currentTime); osc.stop(ac.currentTime + 0.22); osc.onended = () => ac.close(); } catch { /**/ } } } },
          { icon: tagGameActive && tagItId === userId ? "🏷️ IT!" : "🏷️", label: tagGameActive ? (tagItId === userId ? "You're IT — tag someone!" : `Tag game — ${tagItUsername} is IT`) : "Play Tag", onClick: () => { if (!tagGameActive) startTag(); }, highlight: tagGameActive && tagItId === userId },
          { icon: "🎒", label: "Stash", onClick: () => { setShowStash(true); fetchStashData(); } },
          { icon: "⚔️", label: "Adventure", onClick: () => setShowAdventure(true) },
          { icon: "🧙", label: "Character", onClick: () => setShowCharacter(true) },
          { icon: "🗞️", label: "Herald", onClick: () => { setShowHerald(true); fetchHerald(); } },
          { icon: "🎬", label: "Drive-In Theater", onClick: openDriveIn },
        ];
        return (
          <div style={{
            position: "absolute", bottom: 56, left: "50%", transform: "translateX(-50%)",
            zIndex: 50, display: "flex", gap: 8, alignItems: "center",
            background: "rgba(5,3,20,0.85)", border: "1px solid rgba(100,80,200,0.3)",
            borderRadius: 14, padding: "8px 14px",
          }}>
            {toolbarBtns.map(btn => (
              <button key={btn.label} onClick={btn.onClick} title={btn.label} style={{
                padding: "7px 10px", fontSize: btn.highlight ? 14 : 18,
                background: btn.highlight ? "rgba(220,50,50,0.4)" : "rgba(80,60,180,0.25)",
                border: `1px solid ${btn.highlight ? "rgba(255,80,80,0.6)" : "rgba(100,80,200,0.25)"}`,
                borderRadius: 9, cursor: "pointer",
                color: btn.highlight ? "#ffcccc" : "#ccbbff", transition: "background 0.15s",
                animation: btn.highlight ? "pulse 0.8s ease-in-out infinite alternate" : "none",
              }}
                onMouseEnter={e => (e.currentTarget.style.background = btn.highlight ? "rgba(255,60,60,0.55)" : "rgba(100,80,220,0.45)")}
                onMouseLeave={e => (e.currentTarget.style.background = btn.highlight ? "rgba(220,50,50,0.4)" : "rgba(80,60,180,0.25)")}
              >{btn.icon}</button>
            ))}
            {/* Tag buttons for nearby players when you're IT */}
            {tagGameActive && tagItId === userId && nearbyPlayers.filter(p => p.user_id !== userId).map(p => (
              <button key={`tag-${p.user_id}`} onClick={() => tryTag(p.user_id, p.username)} style={{
                padding: "5px 10px", fontSize: 12, fontWeight: 700,
                background: "rgba(220,50,50,0.3)", border: "1px solid rgba(255,80,80,0.5)",
                borderRadius: 9, cursor: "pointer", color: "#ffaaaa",
              }}>🏷️ @{p.username}</button>
            ))}
            <div style={{ width: 1, height: 28, background: "rgba(100,80,200,0.2)" }} />
            <button onClick={() => setShowJukebox(j => !j)} title="Jukebox" style={{
              padding: "7px 10px", fontSize: 18,
              background: activeJukebox ? "rgba(220,50,150,0.3)" : "rgba(80,60,180,0.25)",
              border: `1px solid ${activeJukebox ? "rgba(255,80,180,0.5)" : "rgba(100,80,200,0.25)"}`,
              borderRadius: 9, cursor: "pointer", color: activeJukebox ? "#ffaaee" : "#ccbbff",
              animation: activeJukebox ? "pulse 1s ease-in-out infinite alternate" : "none",
            }}>🎵</button>
          </div>
        );
      })()}

      {/* Controls hint */}
      {!loading && (
        <div style={{
          position: "absolute", bottom: 116, right: 14, zIndex: 40,
          fontSize: 9, color: "rgba(100,90,180,0.4)", lineHeight: 1.8, textAlign: "right",
        }}>
          WASD / L-stick move · ↑↓←→ / R-stick look · Space jump<br />
          C = Character · B = Bag · E = Talk · 🎵 = Jukebox<br />
          Click ground to walk · Enter to chat<br />
          Right-drag to orbit · Scroll to zoom
        </div>
      )}

      {/* ── Jukebox panel ──────────────────────────────────────────────────── */}
      {showJukebox && (
        <div style={{
          position: "absolute", bottom: 120, left: "50%", transform: "translateX(-50%)",
          zIndex: 200, background: "rgba(8,5,30,0.97)", backdropFilter: "blur(14px)",
          border: "1px solid rgba(200,80,180,0.4)", borderRadius: 16, padding: "16px 20px",
          minWidth: 320, maxWidth: 400, color: "#fff", fontFamily: "monospace",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#ffaaee" }}>🎵 Party Jukebox</span>
            <button onClick={() => setShowJukebox(false)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 18 }}>✕</button>
          </div>

          {/* Now playing */}
          {activeJukebox && (
            <div style={{ marginBottom: 12, padding: "8px 10px", background: "rgba(220,80,180,0.1)", borderRadius: 8, border: "1px solid rgba(220,80,180,0.3)" }}>
              <div style={{ fontSize: 11, color: "#ffaaee", marginBottom: 4 }}>▶ Now Playing — by @{activeJukebox.byName}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", wordBreak: "break-all" }}>{activeJukebox.url}</div>
              {(roomHostId === userId || roomHandId === userId || !roomHostId) && (
                <button onClick={() => {
                  setActiveJukebox(null);
                  townSocketRef.current?.send(JSON.stringify({ type: "jukebox_stop", userId }));
                }} style={{ marginTop: 6, padding: "3px 10px", fontSize: 10, background: "rgba(200,50,50,0.2)", border: "1px solid rgba(200,50,50,0.4)", borderRadius: 6, color: "#f87171", cursor: "pointer" }}>■ Stop</button>
              )}
            </div>
          )}


          {/* Pending suggestion (host/hand sees approve button) */}
          {jukeboxPending && (roomHostId === userId || roomHandId === userId || !roomHostId) && (
            <div style={{ marginBottom: 12, padding: "8px 10px", background: "rgba(255,200,0,0.08)", borderRadius: 8, border: "1px solid rgba(255,200,0,0.3)" }}>
              <div style={{ fontSize: 11, color: "#ffd070", marginBottom: 4 }}>🎤 @{jukeboxPending.suggesterName} suggests:</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", wordBreak: "break-all", marginBottom: 6 }}>{jukeboxPending.url}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => {
                  const payload = { type: "jukebox_play", url: jukeboxPending.url, startedAt: Date.now(), byName: jukeboxPending.suggesterName };
                  townSocketRef.current?.send(JSON.stringify(payload));
                  setActiveJukebox({ url: jukeboxPending.url, startedAt: payload.startedAt, byName: jukeboxPending.suggesterName });
                  setJukeboxPending(null);
                }} style={{ flex: 1, padding: "4px 0", fontSize: 10, background: "rgba(100,200,100,0.15)", border: "1px solid rgba(100,200,100,0.4)", borderRadius: 6, color: "#4ade80", cursor: "pointer" }}>✓ Play it</button>
                <button onClick={() => setJukeboxPending(null)} style={{ flex: 1, padding: "4px 0", fontSize: 10, background: "rgba(200,50,50,0.1)", border: "1px solid rgba(200,50,50,0.3)", borderRadius: 6, color: "#f87171", cursor: "pointer" }}>✕ Skip</button>
              </div>
            </div>
          )}

          {/* Input — host/hand plays directly, others suggest */}
          {(() => {
            const isController = roomHostId === userId || roomHandId === userId;
            return (
              <>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    value={jukeboxInput}
                    onChange={e => setJukeboxInput(e.target.value)}
                    placeholder="YouTube URL…"
                    style={{ flex: 1, padding: "6px 8px", fontSize: 11, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(200,80,180,0.3)", borderRadius: 7, color: "#fff", outline: "none" }}
                    onKeyDown={e => e.stopPropagation()}
                  />
                  <button onClick={() => {
                    const url = jukeboxInput.trim();
                    if (!url) return;
                    if (isController) {
                      const payload = { type: "jukebox_play", url, startedAt: Date.now(), byName: username };
                      townSocketRef.current?.send(JSON.stringify(payload));
                      setActiveJukebox({ url, startedAt: payload.startedAt, byName: username });
                    } else {
                      townSocketRef.current?.send(JSON.stringify({ type: "jukebox_suggest", url, suggesterName: username, suggesterId: userId }));
                    }
                    setJukeboxInput("");
                  }} style={{ padding: "6px 12px", fontSize: 11, fontWeight: 700, background: "rgba(200,80,180,0.25)", border: "1px solid rgba(200,80,180,0.5)", borderRadius: 7, color: "#ffaaee", cursor: "pointer" }}>
                    {isController ? "▶ Play" : "💡 Suggest"}
                  </button>
                </div>
                {!isController && (
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 6 }}>
                    {roomHostId ? "Suggestions go to the room host to approve" : "Waiting for a host…"}
                  </div>
                )}

                {/* ── Host controls: crown / revoke Hand of the King ── */}
                {roomHostId === userId && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,200,0,0.15)" }}>
                    <div style={{ fontSize: 9, color: "rgba(255,200,0,0.5)", letterSpacing: 1, fontWeight: 700, marginBottom: 7, textTransform: "uppercase" }}>
                      👑 Hand of the King
                    </div>
                    {roomHandId ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ flex: 1, fontSize: 11, color: "#ffd070" }}>
                          {nearbyPlayers.find(p => p.user_id === roomHandId)?.username ?? roomHandId} is your Hand
                        </span>
                        <button
                          onClick={() => {
                            townSocketRef.current?.send(JSON.stringify({ type: "hand_revoke" }));
                            setRoomHandId(null);
                          }}
                          style={{ padding: "3px 8px", fontSize: 9, background: "rgba(200,50,50,0.15)", border: "1px solid rgba(200,50,50,0.3)", borderRadius: 5, color: "#f87171", cursor: "pointer" }}
                        >Revoke</button>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>Crown a player to give them music control:</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {nearbyPlayers.filter(p => p.user_id !== userId).map(p => (
                            <div key={p.user_id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <img src={p.avatar_url || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${p.username}`} alt={p.username} style={{ width: 20, height: 20, borderRadius: "50%" }} />
                              <span style={{ flex: 1, fontSize: 11, color: "rgba(255,255,255,0.65)" }}>@{p.username}</span>
                              <button
                                onClick={() => {
                                  townSocketRef.current?.send(JSON.stringify({ type: "hand_grant", handId: p.user_id }));
                                  setRoomHandId(p.user_id);
                                }}
                                style={{ padding: "3px 8px", fontSize: 9, background: "rgba(255,200,0,0.15)", border: "1px solid rgba(255,200,0,0.3)", borderRadius: 5, color: "#ffd070", cursor: "pointer" }}
                              >👑 Crown</button>
                            </div>
                          ))}
                          {nearbyPlayers.filter(p => p.user_id !== userId).length === 0 && (
                            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>No other players nearby</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {roomHandId === userId && (
                  <div style={{ marginTop: 8, fontSize: 10, color: "#ffd070" }}>👑 You are the Hand of the King</div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Hidden YouTube iframe — plays jukebox audio */}
      {activeJukebox && (() => {
        const ytMatch = activeJukebox.url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
        const videoId = ytMatch?.[1];
        if (!videoId) return null;
        // Compute start offset ONCE from the startedAt timestamp — don't recalculate on re-renders
        // Using startedAt as part of the key ensures a new iframe only on new songs
        const elapsed = Math.max(0, Math.floor((activeJukebox.startedAt ? (Date.now() - activeJukebox.startedAt) / 1000 : 0)));
        return (
          <iframe
            key={`${videoId}-${activeJukebox.startedAt}`}
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&start=${elapsed}&enablejsapi=0&loop=1`}
            allow="autoplay"
            style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none", top: 0, left: 0 }}
          />
        );
      })()}

      {/* Panels (same components as town) */}
      {showStash && (
        <StashPanel
          stashItems={(Array.isArray((stashData as { stash_items?: unknown } | null)?.stash_items) ? (stashData as { stash_items: unknown[] }).stash_items : []) as Parameters<typeof StashPanel>[0]["stashItems"]}
          inventoryItems={myInventory as Parameters<typeof StashPanel>[0]["inventoryItems"]}
          equippedSlots={myEquippedSlots as Parameters<typeof StashPanel>[0]["equippedSlots"]}
          coins={myCoins}
          onClose={() => setShowStash(false)}
          onEquip={() => {}}
          onDeposit={() => {}}
          onWithdraw={() => {}}
          onDrop={() => {}}
          onSell={() => {}}
        />
      )}
      {showVendor && (
        <VendorPanel
          inventoryItems={myInventory as Parameters<typeof VendorPanel>[0]["inventoryItems"]}
          stashItems={((stashData as { stash_items?: unknown[] } | null)?.stash_items ?? []) as Parameters<typeof VendorPanel>[0]["stashItems"]}
          coins={myCoins}
          onClose={() => setShowVendor(false)}
          onSellItem={() => {}}
        />
      )}
      {showHerald && (
        <HeraldPanel
          chapters={heraldChapters as Parameters<typeof HeraldPanel>[0]["chapters"]}
          onClose={() => setShowHerald(false)}
        />
      )}
      {showCharacter && (
        <CharacterPanel
          adventureStats={myAdventureStats}
          backpack={myInventory as Parameters<typeof CharacterPanel>[0]["backpack"]}
          equippedSlots={myEquippedSlots as Parameters<typeof CharacterPanel>[0]["equippedSlots"]}
          username={username}
          myCoins={myCoins}
          onClose={() => setShowCharacter(false)}
          onEquipSlot={() => {}}
        />
      )}
      {showCaptainDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", zIndex: 350, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowCaptainDialog(false)}>
          <div style={{ background: "linear-gradient(145deg, #1a1208, #0d0d00)", border: "2px solid rgba(255,200,50,0.4)", borderRadius: 22, padding: 28, width: "min(480px, 94vw)", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 0 60px rgba(255,200,50,0.15)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <span style={{ fontSize: 28 }}>🗡️</span>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#ffd700" }}>Captain Aldric</div>
                <div style={{ fontSize: 11, color: "rgba(255,200,80,0.5)", fontFamily: "monospace" }}>Knight Commander · Castle Gate</div>
              </div>
              <button onClick={() => setShowCaptainDialog(false)} style={{ marginLeft: "auto", background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {(["class", "mission"] as const).map(t => (
                <button key={t} onClick={() => setCaptainDialogTab(t)} style={{ flex: 1, background: captainDialogTab === t ? "rgba(255,200,50,0.2)" : "rgba(255,255,255,0.05)", border: `1px solid ${captainDialogTab === t ? "rgba(255,200,50,0.5)" : "rgba(255,255,255,0.1)"}`, borderRadius: 10, padding: "7px 0", fontSize: 12, color: captainDialogTab === t ? "#ffd700" : "rgba(255,255,255,0.4)", cursor: "pointer", fontWeight: 700, textTransform: "capitalize" }}>
                  {t === "class" ? "⚔️ Class" : "🗺️ Mission"}
                </button>
              ))}
            </div>
            {captainDialogTab === "class" && (
              <div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 14 }}>
                  {myAdventureStats?.class ? `Current class: ${myAdventureStats.class[0].toUpperCase() + myAdventureStats.class.slice(1)}. Switch anytime.` : "Choose your class to begin your adventure."}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {CLASS_OPTIONS.map(cls => (
                    <button key={cls.key} onClick={() => pickClass(cls.key)} style={{ background: myAdventureStats?.class === cls.key ? "rgba(255,200,50,0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${myAdventureStats?.class === cls.key ? "rgba(255,200,50,0.5)" : "rgba(255,255,255,0.1)"}`, borderRadius: 12, padding: "12px 14px", textAlign: "left", cursor: "pointer", display: "flex", gap: 12, alignItems: "center" }}>
                      <span style={{ fontSize: 26 }}>{cls.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: myAdventureStats?.class === cls.key ? "#ffd700" : "#fff" }}>{cls.name}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>HP: {cls.hp} · ATK: {cls.atk}</div>
                        <div style={{ fontSize: 10, color: "rgba(255,200,50,0.6)", marginTop: 2 }}>✨ {cls.special}</div>
                      </div>
                      {myAdventureStats?.class === cls.key && <span style={{ fontSize: 14, color: "#ffd700" }}>✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {captainDialogTab === "mission" && (
              <div>
                {!myAdventureStats?.class && (
                  <div style={{ fontSize: 13, color: "#ff8888", marginBottom: 12, padding: "8px 12px", background: "rgba(255,80,80,0.1)", borderRadius: 8 }}>
                    Pick a class first! <button onClick={() => setCaptainDialogTab("class")} style={{ marginLeft: 8, fontSize: 12, color: "#ffd700", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline" }}>Choose now →</button>
                  </div>
                )}
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 14 }}>Choose your mission:</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { key: "forest",        emoji: "🌲", name: "Forest Bandits",             desc: "Clear bandits from the forest road",                        diff: "⭐⭐" },
                    { key: "princess",      emoji: "👸", name: "Rescue Princess Pip!",        desc: "Save the kidnapped princess from bandit poets",             diff: "⭐⭐" },
                    { key: "cave",          emoji: "💎", name: "Crystal Cave",                desc: "Explore the haunted crystal caverns",                       diff: "⭐⭐⭐" },
                    { key: "pirates",       emoji: "🏴‍☠️", name: "Plunder of the Deep Caves",  desc: "Stop the pirates running the underground shanty concert",   diff: "⭐⭐⭐" },
                    { key: "ruins",         emoji: "💀", name: "Haunted Ruins",               desc: "Face the undead in ancient ruins",                          diff: "⭐⭐⭐" },
                    { key: "haunted_manor", emoji: "👻", name: "Haunted Manor of Dreadmoor",  desc: "Stop the ghost's dramatic third act monologue",             diff: "⭐⭐⭐" },
                    { key: "pizza",         emoji: "🐉", name: "The Dragon Stole My Pizza 🍕", desc: "Get your supreme pizza back from an emotionally complex dragon", diff: "⭐⭐⭐⭐" },
                    { key: "dragon",        emoji: "🐉", name: "Dragon's Peak",               desc: "Slay the dragon at the mountain's peak",                   diff: "⭐⭐⭐⭐⭐" },
                  ].map(m => {
                    const hasClass = !!myAdventureStats?.class;
                    return (
                      <button key={m.key} onClick={() => hasClass && startMission(m.key)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "12px 14px", textAlign: "left", cursor: hasClass ? "pointer" : "not-allowed", display: "flex", gap: 10, alignItems: "center", opacity: hasClass ? 1 : 0.5 }}>
                        <span style={{ fontSize: 26 }}>{m.emoji}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{m.name}</div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{m.desc}</div>
                        </div>
                        <span style={{ fontSize: 10, color: "rgba(255,200,50,0.7)" }}>{m.diff}</span>
                      </button>
                    );
                  })}
                </div>
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>✍️ Write your own adventure:</div>
                  <textarea value={customMissionInput} onChange={e => setCustomMissionInput(e.target.value)} onKeyDown={e => e.stopPropagation()} placeholder="Describe your mission... e.g. 'A dungeon full of fire giants under a volcano'" maxLength={120} rows={2} style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "8px 12px", fontSize: 12, color: "#fff", resize: "none", outline: "none", boxSizing: "border-box", fontFamily: "monospace" }} />
                  <button onClick={() => myAdventureStats?.class && customMissionInput.trim() && startMission("custom", customMissionInput.trim())} disabled={!myAdventureStats?.class || !customMissionInput.trim()} style={{ marginTop: 8, width: "100%", background: (myAdventureStats?.class && customMissionInput.trim()) ? "rgba(255,200,50,0.18)" : "rgba(255,255,255,0.04)", border: `1px solid ${(myAdventureStats?.class && customMissionInput.trim()) ? "rgba(255,200,50,0.5)" : "rgba(255,255,255,0.1)"}`, borderRadius: 10, padding: "9px 0", fontSize: 13, color: (myAdventureStats?.class && customMissionInput.trim()) ? "#ffd700" : "rgba(255,255,255,0.3)", cursor: (myAdventureStats?.class && customMissionInput.trim()) ? "pointer" : "not-allowed", fontWeight: 700 }}>
                    🚀 Begin Adventure!
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showAdventure && activeMission != null && (
        <AdventureOverlay
          userId={userId}
          username={username}
          avatarUrl={avatarUrl}
          myStats={(myAdventureStats ?? { class: null, level: 1, hp: 100, max_hp: 100, base_attack: 10, xp: 0, inventory: [], equipped_item_id: null, wins: 0, quests_completed: 0 }) as Parameters<typeof AdventureOverlay>[0]["myStats"]}
          sessionId={null}
          missionData={activeMission as Parameters<typeof AdventureOverlay>[0]["missionData"]}
          teamMembers={nearbyPlayers.map(p => ({ userId: p.user_id, username: p.username, avatarUrl: p.avatar_url, hp: 100, maxHp: 100, playerClass: null, isDowned: false }))}
          onClose={() => { setShowAdventure(false); setActiveMission(null); }}
          onStatsUpdate={(patch) => {
            setMyAdventureStats(prev => {
              const base = prev ?? { class: null, level: 1, hp: 100, max_hp: 100, base_attack: 10, xp: 0, inventory: [], equipped_item_id: null, wins: 0, quests_completed: 0 };
              return { ...base, ...(patch as object) };
            });
            // Persist important stats — skip HP which changes every hit during combat
            const p = patch as Record<string, unknown>;
            if ('inventory' in p || 'level' in p || 'xp' in p || 'wins' in p || 'quests_completed' in p || 'equipped_item_id' in p) {
              fetch("/api/adventure", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update-stats", patch: p }) }).catch(() => {});
            }
          }}
          onMinimize={() => {}}
          onCoinsEarned={(amount) => setMyCoins(c => c + amount)}
        />
      )}

      {/* Tag game banner */}
      {tagGameActive && (
        <div style={{
          position: "absolute", top: 52, left: "50%", transform: "translateX(-50%)",
          zIndex: 60, background: "rgba(200,50,50,0.9)", borderRadius: 10,
          padding: "6px 18px", fontSize: 12, color: "#fff", fontWeight: 800,
        }}>
          🏃 TAG GAME — {Math.ceil(tagTimeLeft)}s left
          {tagItId === userId && " — YOU'RE IT!"}
        </div>
      )}
      {tagMsg && (
        <div onClick={() => setTagMsg(null)} style={{
          position: "absolute", top: 90, left: "50%", transform: "translateX(-50%)",
          zIndex: 80, background: "rgba(0,0,0,0.8)", borderRadius: 10,
          padding: "10px 20px", fontSize: 14, color: "#fff", textAlign: "center",
          border: "1px solid rgba(255,80,80,0.3)", cursor: "pointer", whiteSpace: "nowrap",
        }}>
          {tagMsg}
        </div>
      )}

      {/* Town Battle Modal */}
      {/* Proximity bandit HUD — appears automatically when near hostile NPC */}
      {nearbyBandit && !townBattle && (
        <div style={{
          position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)",
          zIndex: 500, background: "rgba(15,8,28,0.92)", border: "2px solid #cc3322",
          borderRadius: 14, padding: "12px 20px", display: "flex", alignItems: "center",
          gap: 14, backdropFilter: "blur(8px)", minWidth: 280,
        }}>
          <div style={{ fontSize: 32 }}>{nearbyBandit.emoji}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, color: "#ff6644", fontSize: 13, marginBottom: 4 }}>
              ⚠️ {nearbyBandit.name} nearby!
            </div>
            <div style={{ background: "#2a1010", borderRadius: 5, height: 8, overflow: "hidden" }}>
              <div style={{ background: "#cc3322", width: "100%", height: "100%" }} />
            </div>
          </div>
          <button
            style={{ background: "#cc3322", border: "none", borderRadius: 8, color: "#fff", padding: "8px 14px", fontWeight: 700, cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" }}
            onClick={() => {
              setTownBattle({ npc: nearbyBandit, enemyHp: 80, maxHp: 80, playerHp: 100, maxPlayerHp: 100, log: [`⚔️ ${nearbyBandit.name} attacks!`] });
            }}
          >⚔️ Fight</button>
        </div>
      )}

      {townBattle && (
        <div style={{
          position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)",
          zIndex: 500, background: "rgba(15,8,28,0.95)", border: "2px solid #cc3322",
          borderRadius: 14, padding: "14px 18px", backdropFilter: "blur(8px)",
          minWidth: 320, maxWidth: "92vw", fontFamily: "monospace", color: "#fff",
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ fontSize: 24 }}>{townBattle.npc.emoji}</div>
            <div style={{ fontWeight: 800, color: "#ff6644", fontSize: 14 }}>{townBattle.npc.name}</div>
          </div>
          {/* HP bars */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#aaa", marginBottom: 2 }}>
              <span>Enemy HP</span><span style={{ color: "#ff8866" }}>{townBattle.enemyHp}/{townBattle.maxHp}</span>
            </div>
            <div style={{ background: "#333", borderRadius: 4, height: 8, overflow: "hidden" }}>
              <div style={{ background: "#cc3322", height: "100%", width: `${(townBattle.enemyHp / townBattle.maxHp) * 100}%`, transition: "width 0.3s" }} />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#aaa", marginBottom: 2 }}>
              <span>Your HP</span><span style={{ color: "#88ffcc" }}>{townBattle.playerHp}/{townBattle.maxPlayerHp}</span>
            </div>
            <div style={{ background: "#333", borderRadius: 4, height: 8, overflow: "hidden" }}>
              <div style={{ background: "#44cc88", height: "100%", width: `${(townBattle.playerHp / townBattle.maxPlayerHp) * 100}%`, transition: "width 0.3s" }} />
            </div>
          </div>
          {/* Last log line */}
          <div style={{ fontSize: 11, color: "#ccbbff", marginBottom: 10, minHeight: 16 }}>
            {townBattle.log[townBattle.log.length - 1]}
          </div>
          {/* Buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={{ flex: 1, background: "#cc3322", border: "none", borderRadius: 8, color: "#fff", padding: "8px 0", fontWeight: 700, cursor: "pointer", fontSize: 13 }}
              onClick={() => {
                const dmg = 15 + Math.floor(Math.random() * 10);
                const enemyDmg = 8 + Math.floor(Math.random() * 8);
                const newEnemyHp = Math.max(0, townBattle.enemyHp - dmg);
                const newPlayerHp = Math.max(0, townBattle.playerHp - enemyDmg);
                const log = [...townBattle.log, `⚔️ You deal ${dmg}! 🗡️ ${townBattle.npc.name} hits ${enemyDmg}!`];
                if (newEnemyHp <= 0) {
                  const reward = 50 + Math.floor(Math.random() * 30);
                  setMyCoins(c => c + reward);
                  // Remove enemy mesh from scene
                  const mesh = npcMeshesRef.current.get(townBattle.npc.id);
                  if (mesh && sceneRef.current) { sceneRef.current.remove(mesh); npcMeshesRef.current.delete(townBattle.npc.id); }
                  deadNpcsRef.current.add(townBattle.npc.id);
                  setNearbyBandit(null);
                  nearbyBanditRef.current = null;
                  setTownBattle(null);
                  fetch("/api/town-economy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add", amount: reward }) }).catch(() => {});
                } else if (newPlayerHp <= 0) {
                  setTownBattle(null);
                } else {
                  setTownBattle({ ...townBattle, enemyHp: newEnemyHp, playerHp: newPlayerHp, log });
                }
              }}
            >⚔️ Attack</button>
            <button
              style={{ flex: 1, background: "#443388", border: "none", borderRadius: 8, color: "#fff", padding: "8px 0", fontWeight: 700, cursor: "pointer", fontSize: 13 }}
              onClick={() => setTownBattle(null)}
            >🏃 Flee</button>
          </div>
        </div>
      )}

      {/* Drive-In LIVE Screen — inline controls, no overlay room */}
      {driveInNear && (
        <div
          onPointerDown={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          style={{
          position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)",
          zIndex: 500, background: "rgba(10,6,28,0.95)", border: `2px solid ${ssStatus !== "idle" ? "rgba(68,255,136,0.7)" : "rgba(100,80,220,0.7)"}`,
          borderRadius: 14, padding: "14px 20px", display: "flex", alignItems: "center",
          gap: 14, backdropFilter: "blur(8px)", minWidth: 320,
          animation: "npc-pop 0.2s ease-out",
        }}>
          <div style={{ fontSize: 32 }}>{ssStatus !== "idle" ? "📺" : "🎬"}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, color: ssStatus !== "idle" ? "#44ff88" : "#ccbbff", fontSize: 13, marginBottom: 3 }}>
              🌙 Moonhaven Drive-In
            </div>
            <div style={{ fontSize: 11, color: "rgba(180,160,255,0.6)" }}>
              {ssStatus === "hosting" ? "📺 You're sharing LIVE" :
               ssStatus === "viewing" ? "📺 Watching LIVE stream" :
               theaterState?.screenshareOffer?.active ? "🔴 Someone is sharing" :
               "🎥 Share your screen for everyone"}
            </div>
            {ssError && <div style={{ fontSize: 10, color: "#ff6666", marginTop: 3 }}>{ssError}</div>}
          </div>
          <div style={{ display: "flex", gap: 6, flexDirection: "column" }}>
            {ssStatus === "idle" && !theaterState?.screenshareOffer?.active && (<>
                <button
                  style={{ background: "linear-gradient(135deg,rgba(80,60,200,0.9),rgba(120,80,255,0.8))", border: "1px solid rgba(130,110,255,0.6)", borderRadius: 8, color: "#fff", padding: "8px 14px", fontWeight: 700, cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" }}
                  onClick={startScreenShare}
                >📺 Share Screen</button>
                <button
                  style={{ background: "rgba(255,170,0,0.15)", border: "1px solid rgba(255,170,0,0.4)", borderRadius: 8, color: "#ffaa00", padding: "6px 12px", fontWeight: 600, cursor: "pointer", fontSize: 11, whiteSpace: "nowrap" }}
                  onClick={() => setShowGameCast(prev => !prev)}
                >🎮 Cast a Game</button>
            </>)}
            {ssStatus === "hosting" && (
              <button
                style={{ background: "rgba(255,60,60,0.8)", border: "1px solid rgba(255,100,100,0.6)", borderRadius: 8, color: "#fff", padding: "8px 14px", fontWeight: 700, cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" }}
                onClick={stopScreenShare}
              >⏹ End Share</button>
            )}
          </div>
        </div>
      )}

      {/* Drive-In emoji reactions — full animated system with cooldowns, particles, tomato throw */}
      {driveInNear && ssStatus !== "idle" && (() => {
        const now = Date.now();
        return (
          <div
            onPointerDown={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
            style={{
              position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
              zIndex: 500, display: "flex", gap: 8,
              background: "rgba(8,4,22,0.92)", borderRadius: 18,
              padding: "10px 14px", backdropFilter: "blur(10px)",
              border: "1px solid rgba(100,80,220,0.45)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
            }}>
            {DRIVE_EMOTES.map(emote => {
              const cdExpiry = driveCooldownsRef.current[emote.id] ?? 0;
              const onCd = cdExpiry > now;
              const cdLeft = onCd ? Math.ceil((cdExpiry - now) / 1000) : 0;
              return (
                <button
                  key={emote.id}
                  title={emote.label}
                  disabled={onCd}
                  onClick={() => triggerDriveEmote(emote.id)}
                  style={{
                    position: "relative", overflow: "hidden",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    gap: 3,
                    background: onCd ? "rgba(0,0,0,0.55)" : "rgba(10,5,25,0.88)",
                    border: `2px solid ${onCd ? "#333" : emote.border}`,
                    borderRadius: 12, padding: "9px 7px",
                    cursor: onCd ? "default" : "pointer",
                    width: 58, flexShrink: 0,
                    backdropFilter: "blur(6px)",
                    boxShadow: onCd ? "none" : `0 0 12px ${emote.color}44, inset 0 1px 0 rgba(255,255,255,0.08)`,
                    transition: "transform 0.1s, box-shadow 0.1s",
                    opacity: onCd ? 0.5 : 1,
                    userSelect: "none",
                    WebkitTapHighlightColor: "transparent",
                    touchAction: "manipulation",
                  }}
                  onMouseEnter={e => { if (!onCd) (e.currentTarget as HTMLElement).style.transform = "scale(1.12)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
                >
                  {onCd && (
                    <div style={{
                      position: "absolute", inset: 0, borderRadius: "inherit",
                      background: "rgba(0,0,0,0.5)", display: "flex",
                      alignItems: "center", justifyContent: "center",
                      fontSize: 14, color: "#aaa", fontWeight: "bold",
                    }}>{cdLeft}s</div>
                  )}
                  <span style={{ fontSize: 28, lineHeight: 1, filter: onCd ? "grayscale(80%)" : "none" }}>{emote.emoji}</span>
                  <span style={{ fontSize: 9, color: onCd ? "#555" : emote.color, fontWeight: "bold", textAlign: "center", lineHeight: 1.2, whiteSpace: "nowrap" }}>{emote.label}</span>
                  {!onCd && <div style={{ position: "absolute", bottom: 0, left: 6, right: 6, height: 2, borderRadius: 1, background: emote.color, opacity: 0.6 }} />}
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* Particle canvas overlay — draws emote particles + tomato arc on top of Three.js */}
      <canvas
        ref={driveEmoteCanvasRef}
        style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 490 }}
      />

      {/* Tomato splats — rendered as DOM elements over the projected drive-in screen position */}
      {driveSplats.length > 0 && screenMeshRef.current && (() => {
        const wp = { x: 0, y: 0, z: 0 };
        screenMeshRef.current!.getWorldPosition(wp as unknown as import("three").Vector3);
        const sp = projectToScreen(wp.x, wp.y, wp.z);
        // Estimate screen size in pixels from its world scale
        const scaleX = (screenMeshRef.current!.scale.x || 1) * 18;
        const scaleY = (screenMeshRef.current!.scale.y || 1) * 12;
        return (
          <div style={{ position: "fixed", left: sp.x - scaleX, top: sp.y - scaleY, width: scaleX * 2, height: scaleY * 2, pointerEvents: "none", zIndex: 491, overflow: "hidden" }}>
            {driveSplats.map(s => (
              <div key={s.id} style={{
                position: "absolute",
                left: `${s.x}%`, top: `${s.y}%`,
                width: s.r * 2, height: s.r * 2,
                marginLeft: -s.r, marginTop: -s.r,
                borderRadius: "50%",
                background: "radial-gradient(circle at 40% 35%, #ff6644, #cc2200 60%, #881100)",
                transform: `rotate(${s.rot}deg) scaleX(${0.7 + Math.random() * 0.6})`,
                opacity: 0.88,
                boxShadow: "0 0 4px rgba(200,50,0,0.5)",
              }} />
            ))}
          </div>
        );
      })()}


      {/* RPS Arena UI — appears when near the arena or in a match */}
      {(rpsNear || rpsPhase !== "idle") && (() => {
        const choiceBtn = (choice: RPSChoice, emoji: string, label: string) => (
          <button
            key={choice}
            onClick={() => rpsSubmitChoice(choice)}
            disabled={!!rpsMyChoice}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              padding: "14px 18px", fontSize: 14, fontWeight: 800,
              background: rpsMyChoice === choice ? "rgba(170,68,255,0.35)" : rpsMyChoice ? "rgba(255,255,255,0.04)" : "rgba(20,8,44,0.9)",
              border: `2px solid ${rpsMyChoice === choice ? "#aa44ff" : "rgba(150,100,255,0.4)"}`,
              borderRadius: 14, cursor: rpsMyChoice ? "default" : "pointer",
              color: rpsMyChoice === choice ? "#e8d4ff" : "rgba(255,255,255,0.6)",
              boxShadow: rpsMyChoice === choice ? "0 0 18px rgba(170,68,255,0.5)" : "none",
              transition: "all 0.15s", opacity: rpsMyChoice && rpsMyChoice !== choice ? 0.4 : 1,
              userSelect: "none", touchAction: "manipulation", outline: "none",
              transform: rpsMyChoice === choice ? "scale(1.08)" : "scale(1)",
            }}
            onMouseEnter={e => { if (!rpsMyChoice) (e.currentTarget as HTMLElement).style.transform = "scale(1.06)"; }}
            onMouseLeave={e => { if (!rpsMyChoice) (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
          >
            <span style={{ fontSize: 40, lineHeight: 1 }}>{emoji}</span>
            <span style={{ fontSize: 12, letterSpacing: "0.08em" }}>{label}</span>
          </button>
        );

        return (
          <div
            onPointerDown={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
            style={{
              position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
              zIndex: 600,
              background: "rgba(8,3,22,0.97)", backdropFilter: "blur(14px)",
              border: "2px solid rgba(150,80,255,0.6)", borderRadius: 20,
              padding: "22px 28px", minWidth: 340, maxWidth: 420,
              boxShadow: "0 8px 48px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)",
              fontFamily: "monospace",
              animation: "npc-pop 0.22s ease-out",
            }}
          >
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <div style={{ fontSize: 11, color: "rgba(200,170,255,0.5)", letterSpacing: "0.15em", fontWeight: 700 }}>⚔ RPS ARENA</div>
                <button onClick={() => rpsCleanup()} style={{ background: "none", border: "none", color: "rgba(200,170,255,0.4)", fontSize: 14, cursor: "pointer", padding: "2px 6px" }} title="Close">✕</button>
              </div>

              {rpsPhase === "waiting" && (
                <>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#c4b5ff" }}>Waiting for opponent…</div>
                  <div style={{ fontSize: 11, color: "rgba(200,170,255,0.4)", marginTop: 6 }}>Step into the circle when another player enters</div>
                </>
              )}
              {rpsPhase === "choosing" && (
                <>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#ffdd44" }}>vs @{rpsOpponent?.username}</div>
                  <div style={{ marginTop: 6, fontSize: 13, color: rpsTimeLeft <= 10 ? "#ff5555" : "#aaffaa", fontWeight: 900, letterSpacing: "0.1em" }}>
                    {rpsMyChoice ? "⏳ Waiting for opponent…" : `⏱ Choose in ${rpsTimeLeft}s`}
                  </div>
                </>
              )}
              {(rpsPhase === "revealing" || rpsPhase === "result") && (
                <div style={{ fontSize: 18, fontWeight: 900, color: "#ffdd44" }}>vs @{rpsOpponent?.username}</div>
              )}
            </div>

            {/* Choice buttons */}
            {rpsPhase === "choosing" && (
              <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 6 }}>
                {choiceBtn("rock", "🪨", "ROCK")}
                {choiceBtn("paper", "📄", "PAPER")}
                {choiceBtn("scissors", "✂️", "SCISSORS")}
              </div>
            )}

            {/* Reveal phase */}
            {rpsPhase === "revealing" && (
              <div style={{ display: "flex", gap: 20, justifyContent: "center", alignItems: "center", padding: "10px 0" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>YOU</div>
                  <div style={{ fontSize: 56 }}>{rpsChoiceEmoji(rpsMyChoice)}</div>
                </div>
                <div style={{ fontSize: 20, color: "rgba(255,255,255,0.3)", fontWeight: 900 }}>VS</div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>@{rpsOpponent?.username}</div>
                  <div style={{ fontSize: 56 }}>{rpsOpponentChoice ? rpsChoiceEmoji(rpsOpponentChoice) : "❓"}</div>
                </div>
              </div>
            )}

            {/* Result */}
            {rpsPhase === "result" && (
              <>
                <div style={{ display: "flex", gap: 20, justifyContent: "center", alignItems: "center", padding: "8px 0" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>YOU</div>
                    <div style={{ fontSize: 52 }}>{rpsChoiceEmoji(rpsMyChoice)}</div>
                  </div>
                  <div style={{ fontSize: 18, color: "rgba(255,255,255,0.3)", fontWeight: 900 }}>VS</div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>@{rpsOpponent?.username}</div>
                    <div style={{ fontSize: 52 }}>{rpsChoiceEmoji(rpsOpponentChoice)}</div>
                  </div>
                </div>
                <div style={{ textAlign: "center", marginTop: 10, padding: "10px 0 4px" }}>
                  {rpsResultWinner === "draw" && (
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#ffdd44" }}>🤝 DRAW!</div>
                  )}
                  {rpsResultWinner === userId && (
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#4ade80" }}>🏆 YOU WIN!</div>
                  )}
                  {rpsResultWinner !== "draw" && rpsResultWinner !== userId && rpsResultWinner !== null && (
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#f87171" }}>💀 YOU LOSE</div>
                  )}
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 6 }}>ELO updated · ranked match</div>
                </div>
              </>
            )}

            {/* Dismiss for waiting phase */}
            {rpsPhase === "waiting" && (
              <button
                onClick={() => { rpsCleanup(); if (townSocketRef.current?.readyState === 1) townSocketRef.current.send(JSON.stringify({ type: "rps_leave", userId })); }}
                style={{ width: "100%", marginTop: 10, padding: "6px 0", background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(255,255,255,0.3)", cursor: "pointer", fontFamily: "monospace", fontSize: 11 }}
              >Leave Arena</button>
            )}
          </div>
        );
      })()}

      {/* Game Cast picker — opens game in new tab, then triggers screen share */}
      {showGameCast && ssStatus === "idle" && (
        <div style={{
          position: "fixed", bottom: 200, left: "50%", transform: "translateX(-50%)",
          zIndex: 510, background: "rgba(10,6,28,0.97)", border: "2px solid rgba(255,170,0,0.5)",
          borderRadius: 14, padding: "14px 18px", backdropFilter: "blur(10px)",
          minWidth: 300, maxWidth: 380, animation: "npc-pop 0.15s ease-out",
        }}>
          <div style={{ fontWeight: 800, color: "#ffaa00", fontSize: 14, marginBottom: 10, textAlign: "center" }}>
            🎮 Cast a Game to the Big Screen
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,200,100,0.5)", textAlign: "center", marginBottom: 10 }}>
            Opens the game, then share that tab to the drive-in
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { name: "Outbreak", path: "/outbreak", emoji: "☠️", desc: "VS Roguelike" },
              { name: "WHO DONE IT", path: "/whodoneit", emoji: "🔍", desc: "Mystery game" },
              { name: "Chess", path: "/chess", emoji: "♟️", desc: "Classic chess" },
              { name: "Poker", path: "/poker", emoji: "🃏", desc: "Texas Hold'em" },
              { name: "Pong", path: "/pong", emoji: "🏓", desc: "1v1 Pong" },
              { name: "Tightrope", path: "/tightrope", emoji: "🎪", desc: "Balance game" },
              { name: "Survivors", path: "/survivors", emoji: "🧟", desc: "Survival mode" },
              { name: "Draw", path: "/draw", emoji: "🎨", desc: "Drawing game" },
              { name: "Quiz", path: "/quiz", emoji: "🧠", desc: "Trivia" },
            ].map(game => (
              <button key={game.path} onClick={() => {
                window.open(game.path, "_blank");
                setShowGameCast(false);
                // Brief delay then prompt screen share so user can pick the game tab
                setTimeout(() => startScreenShare(), 1500);
              }} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8, cursor: "pointer", textAlign: "left", color: "#ddd", fontSize: 13,
              }}>
                <span style={{ fontSize: 20 }}>{game.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: "#eeddff" }}>{game.name}</div>
                  <div style={{ fontSize: 10, color: "rgba(180,160,255,0.5)" }}>{game.desc}</div>
                </div>
                <span style={{ fontSize: 10, color: "#888" }}>→</span>
              </button>
            ))}
          </div>
          <button onClick={() => setShowGameCast(false)} style={{
            marginTop: 10, width: "100%", padding: "6px", background: "none",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6,
            color: "#888", cursor: "pointer", fontSize: 11,
          }}>Close</button>
        </div>
      )}

      {/* Hidden video element for screen share stream → VideoTexture */}
      {/* NOTE: cannot use display:none — browsers skip frame decode. Off-screen instead. */}
      <video ref={screenVideoRef} style={{ position: "fixed", top: -9999, left: -9999, width: 1, height: 1, opacity: 0 }} autoPlay playsInline muted />

      {/* Portrait mode warning (mobile only) */}
      <div id="mh-portrait-warn" style={{
        display: "none", position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(5,3,20,0.97)", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 16,
        fontFamily: "monospace",
      }}>
        <div style={{ fontSize: 52 }}>📱</div>
        <div style={{ fontSize: 18, color: "#aabbff", fontWeight: 900 }}>Rotate to Landscape</div>
        <div style={{ fontSize: 12, color: "rgba(150,170,255,0.5)" }}>Moonhaven works best in landscape mode</div>
      </div>

      {/* Mobile joystick: floating version rendered above via joystickVis state */}

      <style>{`
        @keyframes npc-pop { from { opacity:0; transform:translateX(-50%) translateY(8px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
        @keyframes pulse { from { box-shadow: 0 0 0 0 rgba(255,80,80,0.4); } to { box-shadow: 0 0 0 6px rgba(255,80,80,0); } }
        @media (max-width: 768px) and (orientation: portrait) {
          #mh-portrait-warn { display: flex !important; }
        }
      `}</style>
    </div>
  );

  // ── Utility fetch functions ───────────────────────────────────────────────
  function fetchHerald() {
    fetch("/api/herald")
      .then(r => r.json())
      .then(d => setHeraldChapters(Array.isArray(d) ? d : []))
      .catch(() => {});
  }
  function handleVendorBuy(index: number) {
    const item = (vendorStock as Array<{ price: number }>)[index];
    if (!item || myCoins < item.price) return;
    setMyCoins(c => c - item.price);
  }
}

// ── NPC avatar canvas with colored background ─────────────────────────────────
function makeNPCCanvas(emoji: string, bgColor: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  // Outer glow
  ctx.shadowColor = bgColor;
  ctx.shadowBlur = 28;
  ctx.beginPath(); ctx.arc(128, 128, 118, 0, Math.PI * 2);
  ctx.fillStyle = bgColor + "cc";
  ctx.fill();
  // Inner circle
  ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.arc(128, 128, 110, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(100, 95, 20, 128, 128, 110);
  grad.addColorStop(0, "#ffffff22");
  grad.addColorStop(1, bgColor + "88");
  ctx.fillStyle = grad;
  ctx.fill();
  // Bright ring
  ctx.strokeStyle = "#ffffff55";
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(128, 128, 112, 0, Math.PI * 2); ctx.stroke();
  // Emoji
  ctx.font = "140px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, 128, 136);
  return canvas;
}

// ── Mobile virtual joystick ───────────────────────────────────────────────────
function MobileJoystick({ keysRef }: { keysRef: React.MutableRefObject<Set<string>> }) {
  const outerRef = React.useRef<HTMLDivElement>(null);
  const innerRef = React.useRef<HTMLDivElement>(null);
  const activeRef = React.useRef(false);
  const centerRef = React.useRef({ x: 0, y: 0 });

  // Only show on touch devices
  const [isTouch] = React.useState(() => typeof window !== "undefined" && ('ontouchstart' in window));
  if (!isTouch) return null;

  const RADIUS = 48;

  const onStart = (cx: number, cy: number) => {
    activeRef.current = true;
    if (outerRef.current) {
      const rect = outerRef.current.getBoundingClientRect();
      centerRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    onMove(cx, cy);
  };
  const onMove = (cx: number, cy: number) => {
    if (!activeRef.current) return;
    const dx = cx - centerRef.current.x;
    const dy = cy - centerRef.current.y;
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), RADIUS);
    const ang = Math.atan2(dy, dx);
    const tx = Math.cos(ang) * dist;
    const ty = Math.sin(ang) * dist;
    if (innerRef.current) {
      innerRef.current.style.transform = `translate(${tx}px, ${ty}px)`;
    }
    // Map to WASD
    const keys = keysRef.current;
    const threshold = RADIUS * 0.3;
    dx > threshold ? keys.add("KeyD") : keys.delete("KeyD");
    dx < -threshold ? keys.add("KeyA") : keys.delete("KeyA");
    dy > threshold ? keys.add("KeyS") : keys.delete("KeyS");
    dy < -threshold ? keys.add("KeyW") : keys.delete("KeyW");
  };
  const onEnd = () => {
    activeRef.current = false;
    if (innerRef.current) innerRef.current.style.transform = "translate(0,0)";
    ["KeyW","KeyA","KeyS","KeyD"].forEach(k => keysRef.current.delete(k));
  };

  return (
    <div
      ref={outerRef}
      onTouchStart={e => { e.preventDefault(); const t = e.touches[0]; onStart(t.clientX, t.clientY); }}
      onTouchMove={e => { e.preventDefault(); const t = e.touches[0]; onMove(t.clientX, t.clientY); }}
      onTouchEnd={e => { e.preventDefault(); onEnd(); }}
      style={{
        position: "fixed", bottom: "env(safe-area-inset-bottom, 80px)", left: 20,
        width: RADIUS * 2, height: RADIUS * 2,
        background: "rgba(80,60,180,0.18)", border: "2px solid rgba(130,100,255,0.35)",
        borderRadius: "50%", zIndex: 55, touchAction: "none",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        ref={innerRef}
        style={{
          width: RADIUS * 0.7, height: RADIUS * 0.7,
          background: "rgba(130,100,255,0.45)", borderRadius: "50%",
          border: "2px solid rgba(180,160,255,0.5)",
          transition: activeRef.current ? "none" : "transform 0.15s ease",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

// ── Three.js scene building helpers ──────────────────────────────────────────

async function buildBillboard(
  THREE: ThreeModule,
  imageUrl: string,
  name: string,
  glowColor: number,
  avatarConfig?: AvatarConfig,
): Promise<import("three").Group> {
  const group = new THREE.Group();

  // Determine ring colors from avatarConfig or fallback to glowColor hex
  const ringColor = avatarConfig?.accentColor ?? `#${glowColor.toString(16).padStart(6, "0")}`;
  const innerColor = avatarConfig?.bodyColor ?? "#ffffff";

  // Body sprite (avatar image on a plane)
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = `${ringColor}44`;
  ctx.beginPath(); ctx.arc(128, 128, 122, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `${innerColor}33`;
  ctx.beginPath(); ctx.arc(128, 128, 116, 0, Math.PI * 2); ctx.fill();

  // If avatarConfig, draw class emoji as background
  if (avatarConfig?.emoji) {
    ctx.font = "72px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = 0.18;
    ctx.fillText(avatarConfig.emoji, 128, 128);
    ctx.globalAlpha = 1;
  }

  // Try to load avatar image
  const bodyTex = new THREE.CanvasTexture(canvas);
  const bodyGeo = new THREE.PlaneGeometry(1.8, 1.8);
  const bodyMat = new THREE.MeshBasicMaterial({ map: bodyTex, transparent: true, depthWrite: false, depthTest: false });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.position.set(0, 1.4, 0);
  bodyMesh.renderOrder = 10;
  bodyMesh.userData.billboard = true;

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    const tc = document.createElement("canvas");
    tc.width = 256; tc.height = 256;
    const tc2 = tc.getContext("2d")!;
    tc2.beginPath(); tc2.arc(128, 128, 122, 0, Math.PI * 2); tc2.clip();
    tc2.filter = "saturate(210%) contrast(118%) brightness(108%)";
    tc2.drawImage(img, 0, 0, 256, 256);
    bodyTex.image = tc;
    bodyTex.colorSpace = THREE.SRGBColorSpace;
    bodyTex.needsUpdate = true;
  };
  img.src = imageUrl;

  // Class emoji badge (bottom-right of avatar circle, visible for configured players)
  if (avatarConfig?.emoji) {
    const badgeCanvas = document.createElement("canvas");
    badgeCanvas.width = 64; badgeCanvas.height = 64;
    const bctx = badgeCanvas.getContext("2d")!;
    bctx.fillStyle = "rgba(10,6,28,0.75)";
    bctx.beginPath(); bctx.arc(32, 32, 30, 0, Math.PI * 2); bctx.fill();
    bctx.strokeStyle = ringColor;
    bctx.lineWidth = 2.5;
    bctx.beginPath(); bctx.arc(32, 32, 29, 0, Math.PI * 2); bctx.stroke();
    bctx.font = "30px serif";
    bctx.textAlign = "center"; bctx.textBaseline = "middle";
    bctx.fillText(avatarConfig.emoji, 32, 32);
    const badgeTex = new THREE.CanvasTexture(badgeCanvas);
    const badgeGeo = new THREE.PlaneGeometry(0.55, 0.55);
    const badgeMat = new THREE.MeshBasicMaterial({ map: badgeTex, transparent: true, depthWrite: false, depthTest: false });
    const badgeMesh = new THREE.Mesh(badgeGeo, badgeMat);
    badgeMesh.position.set(0.65, 0.75, 0.01);
    badgeMesh.renderOrder = 11;
    badgeMesh.userData.billboard = true;
    group.add(badgeMesh);
  }

  group.add(bodyMesh);

  // Username label
  const nameTex = new THREE.CanvasTexture(makeUsernameCanvas(name));
  const nameGeo = new THREE.PlaneGeometry(1.6, 0.3);
  const nameMat = new THREE.MeshBasicMaterial({ map: nameTex, transparent: true, depthWrite: false, depthTest: false });
  const nameMesh = new THREE.Mesh(nameGeo, nameMat);
  nameMesh.position.set(0, 2.1, 0);
  nameMesh.renderOrder = 10;
  nameMesh.userData.billboard = true;
  group.add(nameMesh);

  // Chat bubble (starts hidden)
  const bubbleTex = new THREE.CanvasTexture(makeChatCanvas(""));
  const bubbleGeo = new THREE.PlaneGeometry(3.2, 0.6);
  const bubbleMat = new THREE.MeshBasicMaterial({ map: bubbleTex, transparent: true, depthWrite: false, depthTest: false });
  const bubbleMesh = new THREE.Mesh(bubbleGeo, bubbleMat);
  bubbleMesh.name = "chat_bubble";
  bubbleMesh.position.set(0, 2.65, 0);
  bubbleMesh.renderOrder = 10;
  bubbleMesh.userData.billboard = true;
  bubbleMesh.visible = false;
  group.add(bubbleMesh);

  return group;
}

async function buildNPCBillboard(
  THREE: ThreeModule,
  npc: MoonhavenNPC,
  GLTFLoader: unknown,
): Promise<import("three").Group> {
  const group = new THREE.Group();

  // Try to load GLB model — only if path is explicitly set on the NPC definition
  const glbPath = npc.model ?? null;
  if (GLTFLoader && glbPath) {
    try {
      const glb = await loadGLB(GLTFLoader, glbPath);
      if (glb) {
        group.add(glb);
        // Add floating name tag above
        const nameTex = new THREE.CanvasTexture(makeUsernameCanvas(npc.name));
        const nameGeo = new THREE.PlaneGeometry(1.6, 0.3);
        const nameMat = new THREE.MeshBasicMaterial({ map: nameTex, transparent: true, depthWrite: false });
        const nameMesh = new THREE.Mesh(nameGeo, nameMat);
        nameMesh.position.set(0, 2.3, 0);
        nameMesh.userData.billboard = true;
        group.add(nameMesh);
        return group;
      }
    } catch { /* fall through to billboard */ }
  }

  // Fallback: NPC canvas billboard with colored background
  const npcCanvas = makeNPCCanvas(npc.emoji, npc.color);
  const emojiTex = new THREE.CanvasTexture(npcCanvas);
  emojiTex.colorSpace = THREE.SRGBColorSpace;
  const emojiGeo = new THREE.PlaneGeometry(1.4, 1.4);
  const emojiMat = new THREE.MeshBasicMaterial({ map: emojiTex, transparent: true, depthWrite: false });
  const emojiMesh = new THREE.Mesh(emojiGeo, emojiMat);
  emojiMesh.position.set(0, 1.2, 0);
  emojiMesh.userData.billboard = true;

  // Try to load NPC portrait image — only if path is explicitly set on the NPC definition
  const imgPath = npc.portrait ?? null;
  const imgEl = new Image();
  imgEl.crossOrigin = "anonymous";
  imgEl.onload = () => {
    const tc = document.createElement("canvas");
    tc.width = 256; tc.height = 256;
    const tc2 = tc.getContext("2d")!;
    // Keep the colored background, overlay portrait
    tc2.drawImage(npcCanvas, 0, 0, 256, 256);
    tc2.save();
    tc2.beginPath(); tc2.arc(128, 128, 108, 0, Math.PI * 2); tc2.clip();
    tc2.drawImage(imgEl, 0, 0, 256, 256);
    tc2.restore();
    emojiTex.image = tc;
    emojiTex.needsUpdate = true;
  };
  if (imgPath) imgEl.src = imgPath; // only fetch if portrait path is explicitly defined

  group.add(emojiMesh);

  // Hostile NPCs get a red glow ring
  if (npc.hostile) {
    const ringGeo = new THREE.RingGeometry(0.6, 0.75, 16);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff3333, side: 2, transparent: true, opacity: 0.6 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    group.add(ring);
  }

  // Name tag
  const nameTex = new THREE.CanvasTexture(makeUsernameCanvas(`${npc.emoji} ${npc.name}`));
  const nameGeo = new THREE.PlaneGeometry(1.8, 0.3);
  const nameMat = new THREE.MeshBasicMaterial({ map: nameTex, transparent: true, depthWrite: false });
  const nameMesh = new THREE.Mesh(nameGeo, nameMat);
  nameMesh.position.set(0, 2.15, 0);
  nameMesh.userData.billboard = true;
  group.add(nameMesh);

  return group;
}

function loadGLB(GLTFLoader: unknown, path: string): Promise<import("three").Object3D | null> {
  return Promise.race([
    new Promise<import("three").Object3D | null>((resolve) => {
      const loader = new (GLTFLoader as new () => { load: (p: string, ok: (g: { scene: import("three").Object3D }) => void, _: unknown, err: () => void) => void })();
      loader.load(path, gltf => resolve(gltf.scene), undefined, () => resolve(null));
    }),
    // Timeout: if GLB doesn't load in 4s, fall back to billboard (never hang init)
    new Promise<null>(resolve => setTimeout(() => resolve(null), 4000)),
  ]);
}

function buildFountain(THREE: ThreeModule, scene: import("three").Scene) {
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x5a5a6a, roughness: 0.9, metalness: 0.1 });
  const moonMat = new THREE.MeshStandardMaterial({ color: 0xddeeff, roughness: 0.1, metalness: 0.3, emissive: new THREE.Color(0x334466), emissiveIntensity: 0.4 });

  // Basin
  const basinGeo = new THREE.CylinderGeometry(2.5, 2.2, 0.5, 24, 1, false);
  const basin = new THREE.Mesh(basinGeo, stoneMat);
  basin.position.y = 0.25;
  basin.castShadow = true; basin.receiveShadow = true;
  scene.add(basin);

  // Water surface
  const waterGeo = new THREE.CylinderGeometry(2.2, 2.2, 0.05, 24);
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x2244aa, roughness: 0.1, metalness: 0.6, transparent: true, opacity: 0.75 });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.y = 0.5;
  scene.add(water);

  // Column
  const colGeo = new THREE.CylinderGeometry(0.2, 0.25, 2, 8);
  const col = new THREE.Mesh(colGeo, stoneMat);
  col.position.y = 1.5;
  col.castShadow = true;
  scene.add(col);

  // Moon orb on top
  const orbGeo = new THREE.SphereGeometry(0.5, 16, 12);
  const orb = new THREE.Mesh(orbGeo, moonMat);
  orb.position.y = 3;
  scene.add(orb);
}

function buildLanternPost(THREE: ThreeModule, scene: import("three").Scene, pos: [number, number, number]) {
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xffaa44, roughness: 0.1, emissive: new THREE.Color(0x553300), emissiveIntensity: 1.5, transparent: true, opacity: 0.7 });

  const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.5, 6);
  const pole = new THREE.Mesh(poleGeo, ironMat);
  pole.position.set(pos[0], pos[1] - 1, pos[2]);
  pole.castShadow = true;
  scene.add(pole);

  const boxGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
  const box = new THREE.Mesh(boxGeo, glassMat);
  box.position.set(pos[0], pos[1] + 0.1, pos[2]);
  box.castShadow = true;
  scene.add(box);
}

function makeShopSignCanvas(label: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 96;
  const ctx = canvas.getContext("2d")!;
  // Dark carved wood background
  ctx.fillStyle = "#2a1608";
  ctx.roundRect(4, 4, 504, 88, 12);
  ctx.fill();
  // Gold border
  ctx.strokeStyle = "#c8921a";
  ctx.lineWidth = 3;
  ctx.roundRect(6, 6, 500, 84, 10);
  ctx.stroke();
  // Text shadow
  ctx.font = "bold 36px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#000000aa";
  ctx.fillText(label.length > 22 ? label.slice(0, 20) + "…" : label, 258, 50);
  // Gold painted text
  const grad = ctx.createLinearGradient(0, 20, 0, 76);
  grad.addColorStop(0, "#ffe066");
  grad.addColorStop(0.5, "#ffcc22");
  grad.addColorStop(1, "#cc8800");
  ctx.fillStyle = grad;
  ctx.fillText(label.length > 22 ? label.slice(0, 20) + "…" : label, 256, 48);
  return canvas;
}

function buildBuilding(THREE: ThreeModule, scene: import("three").Scene, bld: { id?: string; position: [number, number, number]; size: [number, number, number]; color: string; roofColor: string; label: string }) {
  const [bx, , bz] = bld.position;
  const [bw, bh, bd] = bld.size;

  // Stone base
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x4a4440, roughness: 0.95, metalness: 0.02 });
  const baseGeo = new THREE.BoxGeometry(bw + 0.4, 0.5, bd + 0.4);
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.set(bx, 0.25, bz);
  base.castShadow = true; base.receiveShadow = true;
  scene.add(base);

  const wallMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(bld.color), roughness: 0.88, metalness: 0 });
  const roofMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(bld.roofColor), roughness: 0.85, emissive: new THREE.Color(bld.roofColor), emissiveIntensity: 0.05 });

  // Walls
  const wallGeo = new THREE.BoxGeometry(bw, bh, bd);
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.position.set(bx, bh / 2 + 0.5, bz);
  wall.castShadow = true; wall.receiveShadow = true;
  scene.add(wall);

  // Roof — flat canopy for wide/market buildings, pyramid for normal buildings
  const isWide = bw > bh * 2;
  if (isWide) {
    // Flat overhanging roof/canopy
    const roofGeo = new THREE.BoxGeometry(bw + 1.2, 0.3, bd + 1.2);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(bx, bh + 0.5 + 0.15, bz);
    roof.castShadow = true; roof.receiveShadow = true;
    scene.add(roof);
    // Overhang lip
    const lipMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(bld.roofColor), roughness: 0.9 });
    const lipGeo = new THREE.BoxGeometry(bw + 1.6, 0.15, 0.4);
    const lip = new THREE.Mesh(lipGeo, lipMat);
    lip.position.set(bx, bh + 0.35, bz + bd / 2 + 0.7);
    scene.add(lip);
  } else {
    // Pyramid roof
    const roofH = bh * 0.55;
    const roofGeo = new THREE.ConeGeometry(Math.max(bw, bd) * 0.75, roofH, 4);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(bx, bh + 0.5 + roofH / 2, bz);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    scene.add(roof);
  }

  // Glowing windows
  const winMat = new THREE.MeshStandardMaterial({
    color: 0xffdd88,
    emissive: new THREE.Color(0xffaa22),
    emissiveIntensity: 2.2,
    roughness: 0.05,
    transparent: true, opacity: 0.92,
  });
  const winCount = Math.max(1, Math.floor(bw / 3));
  for (let wi = 0; wi < winCount; wi++) {
    const wx = bx - bw / 2 + (bw / (winCount + 1)) * (wi + 1);
    const winGeo = new THREE.BoxGeometry(0.7, 1.0, 0.06);
    const win = new THREE.Mesh(winGeo, winMat);
    win.position.set(wx, bh * 0.55 + 0.5, bz + bd / 2 + 0.02);
    scene.add(win);
    // Window sill
    const sillMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.9 });
    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.15), sillMat);
    sill.position.set(wx, bh * 0.55 + 0.5 - 0.55, bz + bd / 2 + 0.05);
    scene.add(sill);
  }

  // Door
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x5a3010, roughness: 0.9 });
  const doorGeo = new THREE.BoxGeometry(0.9, 1.8, 0.08);
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.position.set(bx, 1.4, bz + bd / 2 + 0.02);
  scene.add(door);
  // Door frame
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.85 });
  const frameTop = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.15, 0.1), frameMat);
  frameTop.position.set(bx, 2.35, bz + bd / 2 + 0.03);
  scene.add(frameTop);

  // Chimney (for buildings taller than 5 units)
  if (bh >= 5) {
    const chimMat = new THREE.MeshStandardMaterial({ color: 0x3a3030, roughness: 0.95 });
    const chimGeo = new THREE.BoxGeometry(0.6, 1.8, 0.6);
    const chim = new THREE.Mesh(chimGeo, chimMat);
    chim.position.set(bx + bw * 0.3, bh + 0.5 + 0.9, bz + bd * 0.2);
    chim.castShadow = true;
    scene.add(chim);
    // Chimney smoke glow at top
    const smokeLight = new THREE.PointLight(0xff8833, 0.8, 6);
    smokeLight.position.set(bx + bw * 0.3, bh + 2.5, bz + bd * 0.2);
    scene.add(smokeLight);
  }

  // Shop sign over door
  const signTex = new THREE.CanvasTexture(makeShopSignCanvas(bld.label));
  signTex.colorSpace = THREE.SRGBColorSpace;
  const signW = Math.min(bw * 0.85, 5);
  const signGeo = new THREE.PlaneGeometry(signW, signW * 0.18);
  const signMat = new THREE.MeshBasicMaterial({ map: signTex, transparent: false });
  const sign = new THREE.Mesh(signGeo, signMat);
  sign.position.set(bx, bh * 0.85 + 0.5, bz + bd / 2 + 0.1);
  scene.add(sign);
}

function buildStars(THREE: ThreeModule, scene: import("three").Scene) {
  const starCount = 1200;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const r = 90 + Math.random() * 20;
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 10; // above horizon
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xeeeeff, size: 0.25, sizeAttenuation: true });
  scene.add(new THREE.Points(geo, mat));
}

function buildForestTrees(THREE: ThreeModule, scene: import("three").Scene) {
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2f0a, roughness: 0.98 });
  const leafMats = [
    new THREE.MeshStandardMaterial({ color: 0x0d4a18, roughness: 1.0, emissive: new THREE.Color(0x002208), emissiveIntensity: 0.15 }),
    new THREE.MeshStandardMaterial({ color: 0x103d14, roughness: 1.0, emissive: new THREE.Color(0x001a06), emissiveIntensity: 0.12 }),
    new THREE.MeshStandardMaterial({ color: 0x183318, roughness: 1.0 }),
  ];
  // Trees outside building footprints — placed around the forest perimeter and western edge
  // Forest_edge building occupies x:-40..-20, z:10..30, so trees go just outside at x>-20
  const treePositions: [number, number][] = [
    // Forest approach corridor (x=-13 to -19, outside forest_edge x boundary of -20)
    [-15,8],[-17,10],[-19,5],[-13,12],[-18,14],[-16,18],
    [-14,22],[-13,26],[-19,30],[-15,34],[-17,38],[-13,40],
    // Western border (beyond forest_edge x=-40, so x<-41)
    [-42,14],[-44,18],[-42,24],[-46,20],[-44,28],
    // Southern forest fringe (z>30, outside forest_edge z boundary)
    [-22,32],[-26,34],[-30,32],[-34,36],[-28,38],[-32,40],
    // Northern forest fringe (z<10, outside forest_edge)
    [-22,8],[-26,6],[-30,7],[-34,5],[-38,8],
    // Eastern side scattered (map variety)
    [22,14],[24,18],[26,12],[28,20],[22,26],
  ];
  // Filter: skip any position inside a building footprint (2 unit padding)
  const filtered = treePositions.filter(([tx, tz]) =>
    !MOONHAVEN_BUILDINGS.some(b => {
      const hw = b.size[0] / 2 + 2, hd = b.size[2] / 2 + 2;
      return tx > b.position[0] - hw && tx < b.position[0] + hw &&
             tz > b.position[2] - hd && tz < b.position[2] + hd;
    })
  );
  for (const [tx, tz] of filtered) {
    const height = 3.5 + Math.random() * 2.5;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, height, 7), trunkMat);
    trunk.position.set(tx, height / 2, tz);
    trunk.castShadow = true;
    scene.add(trunk);
    const lm = leafMats[Math.floor(Math.random() * leafMats.length)];
    for (let layer = 0; layer < 3; layer++) {
      const r = (2.2 - layer * 0.5) * (0.85 + Math.random() * 0.3);
      const ly = height + layer * 1.2 + 0.5;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, 2.4, 7), lm);
      cone.position.set(tx, ly, tz);
      cone.castShadow = true;
      scene.add(cone);
    }
  }
}

function buildHorseAndCart(THREE: ThreeModule, scene: import("three").Scene) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x6b3f1a, roughness: 0.9, metalness: 0.02 });
  const legMat = new THREE.MeshStandardMaterial({ color: 0x4a2a0a, roughness: 0.95 });
  const cartMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.88, metalness: 0.04 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x2a1505, roughness: 0.9, metalness: 0.1 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5, metalness: 0.7 });

  // Horse body
  const horseBody = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 2.0), bodyMat);
  horseBody.position.set(0, 1.3, 0);
  horseBody.castShadow = true;
  group.add(horseBody);
  // Neck
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.7, 0.45), bodyMat);
  neck.position.set(0, 1.75, 1.05);
  neck.rotation.x = -0.35;
  group.add(neck);
  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.38, 0.62), bodyMat);
  head.position.set(0, 2.05, 1.45);
  group.add(head);
  // Ears
  for (const ex of [-0.12, 0.12]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 4), bodyMat);
    ear.position.set(ex, 2.3, 1.38);
    group.add(ear);
  }
  // Mane (dark strip)
  const maneMat = new THREE.MeshStandardMaterial({ color: 0x1a0a00, roughness: 0.95 });
  const mane = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.9), maneMat);
  mane.position.set(0, 1.9, 0.85);
  group.add(mane);
  // Tail
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.9, 6), maneMat);
  tail.rotation.x = 0.6;
  tail.position.set(0, 1.2, -1.15);
  group.add(tail);
  // Legs (4)
  for (const [lx, lz] of [[-0.32,0.65],[0.32,0.65],[-0.32,-0.65],[0.32,-0.65]] as [number,number][]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.88, 0.18), legMat);
    leg.position.set(lx, 0.44, lz);
    group.add(leg);
    // Hoof
    const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.22), new THREE.MeshStandardMaterial({ color: 0x1a0a00, roughness: 0.9 }));
    hoof.position.set(lx, 0.07, lz);
    group.add(hoof);
  }
  // Cart body
  const cart = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 2.6), cartMat);
  cart.position.set(0, 0.9, -2.4);
  cart.castShadow = true; cart.receiveShadow = true;
  group.add(cart);
  // Cart planks detail
  for (let pi = -1; pi <= 1; pi++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.08, 0.35), new THREE.MeshStandardMaterial({ color: 0xa07820, roughness: 0.95 }));
    plank.position.set(0, 1.31, -2.4 + pi * 0.7);
    group.add(plank);
  }
  // Wheels (4)
  for (const [wside, wpos] of [[-1,-1.4],[-1,-3.4],[1,-1.4],[1,-3.4]] as [number,number][]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.14, 14), wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wside * 1.0, 0.48, wpos);
    wheel.castShadow = true;
    group.add(wheel);
    // Metal rim
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.04, 6, 14), rimMat);
    rim.rotation.y = Math.PI / 2;
    rim.position.set(wside * 1.0, 0.48, wpos);
    group.add(rim);
    // Spokes
    for (let sp = 0; sp < 6; sp++) {
      const angle = (sp / 6) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.82, 0.04), wheelMat);
      spoke.rotation.z = Math.PI / 2;
      spoke.rotation.x = angle;
      spoke.position.set(wside * 1.0, 0.48, wpos);
      group.add(spoke);
    }
  }
  // Harness pole
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x5a3d10, roughness: 0.9 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.8, 6), poleMat);
  pole.rotation.z = Math.PI / 2;
  pole.position.set(0, 0.7, 1.1);
  group.add(pole);
  // Goods in cart
  const boxColors = [0xcc4422, 0x4488cc, 0x44aa55, 0xddaa22];
  for (let bi = 0; bi < 3; bi++) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.55), new THREE.MeshStandardMaterial({ color: boxColors[bi % boxColors.length], roughness: 0.88 }));
    box.position.set(-0.4 + (bi % 2) * 0.55, 1.55, -2.0 - Math.floor(bi / 2) * 0.6);
    group.add(box);
  }
  group.position.set(16, 0, 14);
  group.rotation.y = -0.5;
  scene.add(group);
}

function buildMarketAwnings(THREE: ThreeModule, scene: import("three").Scene) {
  const awningColors = [0xcc3311, 0x3355cc, 0x118833, 0xcc9911, 0x882299, 0x11aacc];
  const stallPositions: [number, number, number, number][] = [
    [-10, 0, 14, 0], [-4, 0, 14, 0], [2, 0, 14, 0], [8, 0, 14, 0],
    [-7, 0, 20, Math.PI], [1, 0, 20, Math.PI],
  ];
  stallPositions.forEach(([sx, , sz, ry], i) => {
    const color = awningColors[i % awningColors.length];
    const awningMat = new THREE.MeshStandardMaterial({ color, roughness: 0.88, side: 2 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x5a3810, roughness: 0.9 });
    // Counter
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.7, 1.0), new THREE.MeshStandardMaterial({ color: 0x7a5520, roughness: 0.9 }));
    counter.position.set(sx, 0.85, sz);
    counter.receiveShadow = true;
    scene.add(counter);
    // Awning roof (sloped plane)
    const awningGeo = new THREE.PlaneGeometry(3.2, 1.8);
    const awning = new THREE.Mesh(awningGeo, awningMat);
    awning.position.set(sx, 2.4, sz);
    awning.rotation.x = -0.4 + ry;
    awning.rotation.y = ry;
    awning.castShadow = true;
    scene.add(awning);
    // Awning stripes
    for (let s = 0; s < 4; s++) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(3.22, 0.18), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: 2 }));
      stripe.position.set(sx, 2.41, sz);
      stripe.rotation.x = -0.4 + ry;
      stripe.rotation.y = ry;
      scene.add(stripe);
    }
    // Support poles
    for (const px of [sx - 1.3, sx + 1.3]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5, 6), frameMat);
      pole.position.set(px, 1.25, sz);
      pole.castShadow = true;
      scene.add(pole);
    }
    // Stall goods
    const goodColors = [0xff6644, 0x44ff88, 0xffcc22, 0x44aaff];
    for (let gi = 0; gi < 3; gi++) {
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshStandardMaterial({ color: goodColors[gi % goodColors.length], roughness: 0.7 }));
      sphere.position.set(sx - 0.55 + gi * 0.55, 1.28, sz);
      scene.add(sphere);
    }
  });
}

function buildCobblePath(THREE: ThreeModule, scene: import("three").Scene) {
  const pathMat = new THREE.MeshStandardMaterial({ color: 0x5a5248, roughness: 0.93, metalness: 0.02 });
  const pathDefs: [number, number, number, number, number][] = [
    // x, z, width, depth, rotation
    [0, -14, 3.5, 10, 0],   // plaza → castle
    [0, 14, 3.5, 8, 0],     // plaza → market
    [14, 0, 8, 3.5, 0],     // plaza → tavern
    [-14, 0, 8, 3.5, 0],    // plaza → workshop
    [-14, 12, 3, 8, 0],     // workshop → forest
  ];
  for (const [px, pz, pw, pd] of pathDefs) {
    const path = new THREE.Mesh(new THREE.PlaneGeometry(pw, pd), pathMat);
    path.rotation.x = -Math.PI / 2;
    path.position.set(px, 0.01, pz);
    path.receiveShadow = true;
    scene.add(path);
    // Path border stones
    for (let i = 0; i < Math.floor(pd / 2); i++) {
      for (const side of [-1, 1]) {
        const stone = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.5), new THREE.MeshStandardMaterial({ color: 0x666055, roughness: 0.98 }));
        stone.position.set(px + side * (pw / 2 + 0.15), 0.06, pz - pd / 2 + i * 2 + 1);
        scene.add(stone);
      }
    }
  }
}

function buildCastleWalls(THREE: ThreeModule, scene: import("three").Scene) {
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x4a4858, roughness: 0.94, metalness: 0.04 });
  const darkStoneMat = new THREE.MeshStandardMaterial({ color: 0x363344, roughness: 0.96 });
  // Castle perimeter wall segments
  const wallSegments: [number, number, number, number, number][] = [
    // x, z, width, height, rotY
    [-11, -36, 1.2, 8, 0],  // left corner tower
    [11, -36, 1.2, 8, 0],   // right corner tower
    [-11, -20, 1.2, 8, 0],  // left front tower
    [11, -20, 1.2, 8, 0],   // right front tower
  ];
  for (const [wx, wz, ww, wh] of wallSegments) {
    // Tower
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(ww, ww * 1.1, wh, 8), stoneMat);
    tower.position.set(wx, wh / 2, wz);
    tower.castShadow = true; tower.receiveShadow = true;
    scene.add(tower);
    // Battlements on top
    for (let b = 0; b < 6; b++) {
      const angle = (b / 6) * Math.PI * 2;
      const bx2 = wx + Math.cos(angle) * ww * 0.8;
      const bz2 = wz + Math.sin(angle) * ww * 0.8;
      const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.4), darkStoneMat);
      merlon.position.set(bx2, wh + 0.3, bz2);
      scene.add(merlon);
    }
  }
  // Castle gate arch
  const gateLeft = new THREE.Mesh(new THREE.BoxGeometry(2, 10, 1.5), stoneMat);
  gateLeft.position.set(-2, 5, -19);
  gateLeft.castShadow = true;
  scene.add(gateLeft);
  const gateRight = new THREE.Mesh(new THREE.BoxGeometry(2, 10, 1.5), stoneMat);
  gateRight.position.set(2, 5, -19);
  gateRight.castShadow = true;
  scene.add(gateRight);
  const gateTop = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 1.5), darkStoneMat);
  gateTop.position.set(0, 10, -19);
  gateTop.castShadow = true;
  scene.add(gateTop);
  // Portcullis bars
  const barMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7, metalness: 0.8 });
  for (let bi = -1; bi <= 1; bi++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 6, 0.1), barMat);
    bar.position.set(bi * 0.8, 6, -19);
    scene.add(bar);
  }
  for (let bi = 0; bi < 3; bi++) {
    const hbar = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.1, 0.1), barMat);
    hbar.position.set(0, 4 + bi * 1.5, -19);
    scene.add(hbar);
  }
  // Castle ambient torch lights
  const torchPositions: [number, number, number][] = [[-11, 6, -20],[11, 6, -20],[-11, 6, -36],[11, 6, -36]];
  for (const [tx, ty, tz] of torchPositions) {
    const torchLight = new THREE.PointLight(0xff8833, 2.5, 14);
    torchLight.position.set(tx, ty, tz);
    scene.add(torchLight);
    // Torch bracket visual
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 0.15), new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8, metalness: 0.6 }));
    bracket.position.set(tx, ty, tz);
    scene.add(bracket);
    // Flame glow
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 6), new THREE.MeshBasicMaterial({ color: 0xff6600 }));
    flame.position.set(tx, ty + 0.35, tz);
    scene.add(flame);
  }
}

// ── Drive-In Theater ──────────────────────────────────────────────────────────
function buildDriveIn(THREE: ThreeModule, scene: import("three").Scene, QL: QualityLevel = "med"): import("three").Mesh {
  const SX = 62, SZ = 52, SW = 54, SH = 20; // Widescreen cinema — 2.7:1 ratio, ~3x bigger

  // ── Dark concrete cinema floor ─────────────────────────────────────────────
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x0e0e16, roughness: 0.97 });
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(70, 64), floorMat);
  pad.rotation.x = -Math.PI / 2; pad.position.set(SX - 23, 0.012, SZ);
  pad.receiveShadow = true; scene.add(pad);
  // Purple glow border strips along floor edge
  const trimMat = new THREE.MeshBasicMaterial({ color: 0x1a0840 });
  for (const [bx, bz, bw, bd] of [
    [SX - 23, SZ - 32, 70, 0.6], [SX - 23, SZ + 32, 70, 0.6],
    [SX + 12,  SZ, 0.6, 64],    [SX - 58,  SZ, 0.6, 64],
  ] as [number, number, number, number][]) {
    const trim = new THREE.Mesh(new THREE.PlaneGeometry(bw, bd), trimMat);
    trim.rotation.x = -Math.PI / 2; trim.position.set(bx, 0.014, bz); scene.add(trim);
  }

  // ── Screen scaffold ───────────────────────────────────────────────────────
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2c, roughness: 0.78, metalness: 0.55 });
  for (const pz of [SZ - SW * 0.53, SZ + SW * 0.53]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.30, SH + 3.5, 8), frameMat);
    pole.position.set(SX, (SH + 3.5) / 2, pz); pole.castShadow = true; scene.add(pole);
    const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 6, 6), frameMat);
    brace.position.set(SX - 1.8, 2.8, pz); brace.rotation.z = 0.65; scene.add(brace);
  }
  const topBar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, SW + 4), frameMat);
  topBar.position.set(SX, SH + 2.0, SZ); scene.add(topBar);
  const botBar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, SW + 3.5), frameMat);
  botBar.position.set(SX, 0.42, SZ); scene.add(botBar);
  const borderMat = new THREE.MeshStandardMaterial({ color: 0x0c0c18, roughness: 0.7, metalness: 0.5 });
  const border = new THREE.Mesh(new THREE.BoxGeometry(0.18, SH + 0.8, SW + 0.8), borderMat);
  border.position.set(SX - 0.08, SH / 2 + 0.4, SZ); scene.add(border);

  // ── Screen surface (widescreen canvas) ───────────────────────────────────
  const sc = document.createElement("canvas");
  sc.width = 1080; sc.height = 400; // 2.7:1 ratio
  const ctx = sc.getContext("2d")!;
  const bg = ctx.createLinearGradient(0, 0, 0, 400);
  bg.addColorStop(0, "#05051a"); bg.addColorStop(1, "#020210");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 1080, 400);
  for (let y = 0; y < 400; y += 4) { ctx.fillStyle = "rgba(0,0,0,0.14)"; ctx.fillRect(0, y, 1080, 1); }
  ctx.strokeStyle = "rgba(100,120,255,0.32)"; ctx.lineWidth = 7; ctx.strokeRect(5, 5, 1070, 390);
  ctx.font = "110px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("🌙", 540, 155);
  ctx.font = "bold 44px monospace"; ctx.fillStyle = "#aabbff";
  ctx.fillText("MOONHAVEN CINEMA", 540, 280);
  ctx.font = "21px monospace"; ctx.fillStyle = "rgba(140,160,255,0.5)";
  ctx.fillText("🎬  Walk up & press E  🎬", 540, 338);
  ctx.fillStyle = "#aaccff"; ctx.font = "14px serif";
  for (let i = 0; i < 8; i++) ctx.fillText(["✨","⭐","🌟","✨","⭐","🌟","✨","⭐"][i], 80 + i * 115, 78);

  const screenTex = new THREE.CanvasTexture(sc);
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex, side: THREE.DoubleSide });
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), screenMat);
  screenMesh.rotation.y = -Math.PI / 2;
  screenMesh.position.set(SX, SH / 2 + 0.4, SZ);
  scene.add(screenMesh);
  const screenLight = new THREE.PointLight(0x4455cc, 2.2, 60);
  screenLight.position.set(SX - 10, SH / 2, SZ);
  scene.add(screenLight);
  screenMesh.userData.screenLight = screenLight;

  // ── Cinema seating — InstancedMesh (3 draw calls for all seats) ──────────
  const ROWS = 7, COLS = 16, ROW_DEPTH = 2.35, SEAT_PITCH = 2.05, RAKE = 0.40;
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x6b0f1a, roughness: 0.78 });
  const metalMat2 = new THREE.MeshStandardMaterial({ color: 0x1c1c2e, roughness: 0.55, metalness: 0.70 });
  const firstRowX = SX - 13;
  const seatCount = ROWS * (COLS - 2); // minus 2 for center aisle

  // Three instanced meshes: frame, cushion, backrest
  const frameInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.78, 0.46, 0.90), metalMat2, seatCount);
  const cushInst  = new THREE.InstancedMesh(new THREE.BoxGeometry(0.68, 0.14, 0.82), seatMat,   seatCount);
  const backInst  = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.88, 0.80), seatMat,   seatCount);
  frameInst.castShadow = true;
  const dummy = new THREE.Object3D();
  let si = 0;

  for (let row = 0; row < ROWS; row++) {
    const rx = firstRowX - row * ROW_DEPTH;
    const ry = row * RAKE;

    // Stepped riser (raised platform for each row after first)
    if (row > 0) {
      const riser = new THREE.Mesh(
        new THREE.BoxGeometry(ROW_DEPTH + 0.1, RAKE + 0.02, COLS * SEAT_PITCH + 3),
        new THREE.MeshStandardMaterial({ color: 0x121220, roughness: 0.96 })
      );
      riser.position.set(rx + ROW_DEPTH / 2, ry - RAKE / 2, SZ);
      scene.add(riser);
    }
    // Aisle step lights
    for (const slz of [SZ - COLS * SEAT_PITCH / 2 - 1.8, SZ + COLS * SEAT_PITCH / 2 + 1.8]) {
      const sl = new THREE.PointLight(0x3322aa, 0.22, 5);
      sl.position.set(rx, ry + 0.2, slz); scene.add(sl);
    }

    for (let col = 0; col < COLS; col++) {
      if (col === 7 || col === 8) continue; // center aisle gap
      const rz = SZ - (COLS - 1) * SEAT_PITCH / 2 + col * SEAT_PITCH;

      dummy.position.set(rx,        ry + 0.23, rz); dummy.updateMatrix(); frameInst.setMatrixAt(si, dummy.matrix);
      dummy.position.set(rx,        ry + 0.49, rz); dummy.updateMatrix(); cushInst.setMatrixAt(si, dummy.matrix);
      dummy.position.set(rx - 0.32, ry + 0.93, rz); dummy.updateMatrix(); backInst.setMatrixAt(si, dummy.matrix);
      si++;
    }
  }
  frameInst.instanceMatrix.needsUpdate = true;
  cushInst.instanceMatrix.needsUpdate  = true;
  backInst.instanceMatrix.needsUpdate  = true;
  scene.add(frameInst, cushInst, backInst);

  // Center aisle carpet strip
  const aisleMat = new THREE.MeshStandardMaterial({ color: 0x1a0828, roughness: 0.98 });
  const aisleStrip = new THREE.Mesh(
    new THREE.PlaneGeometry(ROWS * ROW_DEPTH + 2, SEAT_PITCH * 1.6),
    aisleMat
  );
  aisleStrip.rotation.x = -Math.PI / 2;
  aisleStrip.position.set(firstRowX - (ROWS - 1) * ROW_DEPTH / 2, 0.016, SZ);
  scene.add(aisleStrip);

  // ── Projector booth ───────────────────────────────────────────────────────
  const boothX = SX - 32;
  const boothMat = new THREE.MeshStandardMaterial({ color: 0x14142a, roughness: 0.88 });
  const booth = new THREE.Mesh(new THREE.BoxGeometry(5.0, 4.5, 5.0), boothMat);
  booth.position.set(boothX, 2.25, SZ); booth.castShadow = true; scene.add(booth);
  const boothRoof = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.28, 5.8), new THREE.MeshStandardMaterial({ color: 0x0e0e1c }));
  boothRoof.position.set(boothX, 4.64, SZ); scene.add(boothRoof);
  const projWin = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.52, 0.06), new THREE.MeshBasicMaterial({ color: 0xffcc44 }));
  projWin.position.set(boothX + 2.6, 2.3, SZ); scene.add(projWin);
  const beamLen = SX - boothX - 5.5;
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xeeeeff, transparent: true, opacity: 0.05 });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(beamLen, 0.4, 1.2), beamMat);
  beam.position.set(boothX + 3 + beamLen / 2, 2.3, SZ); scene.add(beam);
  const beam2 = new THREE.Mesh(new THREE.BoxGeometry(beamLen * 0.5, 0.9, 4.5), beamMat);
  beam2.position.set(SX - beamLen * 0.25, 2.3, SZ); scene.add(beam2);
  { const l = new THREE.PointLight(0xffcc44, 2.0, 18); l.position.set(boothX + 3, 2.6, SZ); scene.add(l); }
  // Booth sign
  const bsc = document.createElement("canvas"); bsc.width = 200; bsc.height = 52;
  const bctx = bsc.getContext("2d")!;
  bctx.fillStyle = "#10102a"; bctx.fillRect(0,0,200,52);
  bctx.font = "bold 18px monospace"; bctx.fillStyle = "#aabbff";
  bctx.textAlign = "center"; bctx.textBaseline = "middle"; bctx.fillText("🎬 BOOTH", 100, 26);
  const boothSign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bsc), side: THREE.DoubleSide }));
  boothSign.position.set(boothX + 2.6, 3.2, SZ); scene.add(boothSign);

  // ── Entrance arch and marquee ─────────────────────────────────────────────
  const archZ = SZ + 32;
  const archCX = SX - 23;
  const archMat = new THREE.MeshStandardMaterial({ color: 0x2e1a5e, roughness: 0.65, metalness: 0.40, emissive: new THREE.Color(0x180830), emissiveIntensity: 0.45 });
  for (const px of [archCX - 26, archCX + 26]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.68, 11, 8), archMat);
    pillar.position.set(px, 5.5, archZ); pillar.castShadow = true; scene.add(pillar);
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.72, 8, 8), new THREE.MeshStandardMaterial({ color: 0x9966ff, emissive: new THREE.Color(0x6633cc), emissiveIntensity: 0.9 }));
    finial.position.set(px, 11.3, archZ); scene.add(finial);
    { const l = new THREE.PointLight(0x9966ff, 1.3, 12); l.position.set(px, 12, archZ); scene.add(l); }
  }
  const archBar = new THREE.Mesh(new THREE.BoxGeometry(53, 0.7, 0.5), archMat);
  archBar.position.set(archCX, 11, archZ); scene.add(archBar);
  // Marquee sign
  const msc = document.createElement("canvas"); msc.width = 512; msc.height = 96;
  const mctx = msc.getContext("2d")!;
  const mg = mctx.createLinearGradient(0,0,512,0);
  mg.addColorStop(0,"#140830"); mg.addColorStop(0.5,"#220f48"); mg.addColorStop(1,"#140830");
  mctx.fillStyle = mg; mctx.fillRect(0,0,512,96);
  mctx.strokeStyle = "rgba(150,110,255,0.65)"; mctx.lineWidth = 3; mctx.strokeRect(3,3,506,90);
  mctx.font = "bold 30px serif"; mctx.fillStyle = "#e0d0ff"; mctx.textAlign = "center"; mctx.textBaseline = "middle";
  mctx.fillText("🌙 MOONHAVEN CINEMA 🎬", 256, 42);
  mctx.font = "17px monospace"; mctx.fillStyle = "rgba(180,155,255,0.65)";
  mctx.fillText("✨ 🍿 🌟 NOW SHOWING 🌟 🍿 ✨", 256, 74);
  const marquee = new THREE.Mesh(new THREE.PlaneGeometry(16, 2.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(msc), side: THREE.DoubleSide }));
  marquee.position.set(archCX, 11.2, archZ); scene.add(marquee);
  { const l = new THREE.PointLight(0x9966ff, 3.5, 32); l.position.set(archCX, 12, archZ); scene.add(l); }

  // Fairy lights along arch
  const fLightMat = new THREE.MeshBasicMaterial({ color: 0xffee88 });
  for (let li = 0; li < 26; li++) {
    const lpx = archCX - 26 + li * 2.0;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 4, 4), fLightMat);
    dot.position.set(lpx, 10.7 + Math.sin(li * 0.58) * 0.3, archZ); scene.add(dot);
    if (li % 4 === 0) { const dl = new THREE.PointLight(0xffee88, 0.5, 5); dl.position.set(lpx, 10.7, archZ); scene.add(dl); }
  }

  // ── Snack stand (bigger, brighter, unmissable) ────────────────────────────
  const cartX = archCX - 10, cartZ2 = archZ - 4;
  const cartBody = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.5, 2.4), new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.5 }));
  cartBody.position.set(cartX, 0.75, cartZ2); scene.add(cartBody);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 2.6), new THREE.MeshStandardMaterial({ color: 0xeeeecc, roughness: 0.55 }));
  counter.position.set(cartX, 1.56, cartZ2); scene.add(counter);
  const cartUmb = new THREE.Mesh(new THREE.ConeGeometry(2.1, 0.85, 8), new THREE.MeshStandardMaterial({ color: 0xeecc22, roughness: 0.6 }));
  cartUmb.position.set(cartX, 2.65, cartZ2); scene.add(cartUmb);
  const cartPole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.65, 6), new THREE.MeshStandardMaterial({ color: 0x999999 }));
  cartPole.position.set(cartX, 1.3, cartZ2); scene.add(cartPole);
  const csc = document.createElement("canvas"); csc.width = 192; csc.height = 80;
  const cctx = csc.getContext("2d")!;
  cctx.fillStyle = "#1a0808"; cctx.fillRect(0,0,192,80);
  cctx.font = "bold 20px monospace"; cctx.fillStyle = "#ffddaa";
  cctx.textAlign = "center"; cctx.textBaseline = "top"; cctx.fillText("SNACKS", 96, 6);
  cctx.font = "34px serif"; cctx.fillText("🍿 🥤 🍭", 96, 34);
  const cartSign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.72), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(csc), side: THREE.DoubleSide }));
  cartSign.position.set(cartX + 1.3, 1.1, cartZ2); scene.add(cartSign);
  if (QL !== "low") {
    const l = new THREE.PointLight(0xff9933, 1.8, 12); l.position.set(cartX, 3.5, cartZ2); scene.add(l);
    const l2 = new THREE.PointLight(0xffcc44, 0.8, 8); l2.position.set(cartX, 1.8, cartZ2 + 1.5); scene.add(l2);
  }

  // ── Big moon above theater ────────────────────────────────────────────────
  const moon3 = new THREE.Mesh(new THREE.SphereGeometry(4.5, QL === "low" ? 8 : 16, QL === "low" ? 8 : 16), new THREE.MeshBasicMaterial({ color: 0xfff5dd }));
  moon3.position.set(SX + 5, 36, SZ - 10); scene.add(moon3);
  if (QL !== "low") { const l = new THREE.PointLight(0xffeebb, 2.8, 70); l.position.set(SX + 5, 36, SZ - 10); scene.add(l); }

  // ── Lit path from town to theater ────────────────────────────────────────
  const pathMat2 = new THREE.MeshStandardMaterial({ color: 0x1a1a26, roughness: 0.97 });
  const walkway = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 56), pathMat2);
  walkway.rotation.x = -Math.PI / 2;
  walkway.position.set(archCX, 0.015, archZ / 2 + 4);
  scene.add(walkway);
  // Path lanterns = 16 PointLights — only on med/high
  if (QL !== "low") {
    for (let pli = 0; pli < 8; pli++) {
      const plz = 12 + pli * 7;
      for (const side of [-1, 1]) {
        const plx = archCX + side * 3.2;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.9, 6), new THREE.MeshStandardMaterial({ color: 0x333344 }));
        post.position.set(plx, 0.95, plz); scene.add(post);
        const globe = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffdd88 }));
        globe.position.set(plx, 2.0, plz); scene.add(globe);
        const pll = new THREE.PointLight(0xffaa44, 0.65, 7);
        pll.position.set(plx, 2.1, plz); scene.add(pll);
      }
    }
  }

  return screenMesh;
}


