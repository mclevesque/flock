"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import GamepadMapper from "@/app/components/GamepadMapper";
import InviteViaDm from "@/app/components/InviteViaDm";

// ─── ROM catalog ─────────────────────────────────────────────────────────────
const CATALOG = [
  { name: "Street Fighter II Turbo", genre: "Fighting", players: 2,    romUrl: "/roms/street-fighter-2-turbo.zip" },
  { name: "Super Mario World",        genre: "Platformer", players: 2,  romUrl: "/roms/super-mario-world.zip" },
  { name: "Super Mario RPG",          genre: "RPG", players: 1,         romUrl: "/roms/super-mario-rpg.zip" },
  { name: "F-Zero",                   genre: "Racing", players: 1,      romUrl: "/roms/f-zero.zip" },
  { name: "Mortal Kombat II",         genre: "Fighting", players: 2,    romUrl: "/roms/mortal-kombat-2.zip" },
  { name: "Donkey Kong Country",      genre: "Platformer", players: 2,  romUrl: "/roms/donkey-kong-country.zip" },
  { name: "Kirby Super Star",         genre: "Platformer", players: 2,  romUrl: "/roms/kirby-super-star.zip" },
  { name: "Contra III",               genre: "Action", players: 2,      romUrl: "/roms/contra-3.zip" },
  { name: "NBA Jam",                  genre: "Sports", players: 2,      romUrl: "/roms/nba-jam.zip" },
  { name: "Mega Man X",               genre: "Action", players: 1,      romUrl: "/roms/mega-man-x.zip" },
  { name: "Chrono Trigger",           genre: "RPG", players: 1,         romUrl: "/roms/chrono-trigger.zip" },
  { name: "Zelda: A Link to the Past",genre: "Adventure", players: 1,   romUrl: "/roms/zelda-lttp.zip" },
  { name: "Super Punch-Out!!",        genre: "Sports", players: 1,      romUrl: "/roms/super-punch-out.zip" },
  { name: "Turtles in Time",          genre: "Beat em up", players: 2,  romUrl: "/roms/tmnt-turtles-in-time.zip" },
  { name: "Earthbound",               genre: "RPG", players: 1,         romUrl: "/roms/earthbound.zip" },
  { name: "Super Bomberman",          genre: "Multiplayer", players: 2, romUrl: "/roms/super-bomberman.zip" },
  { name: "Super Mario Kart",         genre: "Racing", players: 2,      romUrl: "/roms/super-mario-kart.zip" },
  { name: "Star Fox",                 genre: "Action", players: 1,      romUrl: "/roms/star-fox.zip" },
  { name: "Final Fantasy VI",         genre: "RPG", players: 1,         romUrl: "/roms/final-fantasy-6.zip" },
  { name: "Super Castlevania IV",     genre: "Action", players: 1,      romUrl: "/roms/super-castlevania-4.zip" },
  { name: "Evo: Search for Eden",     genre: "RPG", players: 1,         romUrl: "/roms/evo-search-for-eden.zip" },
  { name: "Illusion of Gaia",         genre: "Adventure", players: 1,   romUrl: "/roms/illusion-of-gaia.zip" },
  { name: "ActRaiser",                genre: "Action", players: 1,      romUrl: "/roms/actraiser.zip" },
  { name: "Secret of Mana",           genre: "RPG", players: 2,         romUrl: "/roms/secret-of-mana.zip" },
  { name: "Lufia II",                 genre: "RPG", players: 1,         romUrl: "/roms/lufia-2.zip" },
  { name: "Soul Blazer",              genre: "RPG", players: 1,         romUrl: "/roms/soul-blazer.zip" },
  { name: "Breath of Fire II",        genre: "RPG", players: 1,         romUrl: "/roms/breath-of-fire-2.zip" },
  { name: "Street Fighter Alpha 2",   genre: "Fighting", players: 2,    romUrl: "/roms/street-fighter-alpha-2.zip" },
  { name: "Killer Instinct",          genre: "Fighting", players: 2,    romUrl: "/roms/killer-instinct.zip" },
  { name: "Yoshi's Island",           genre: "Platformer", players: 1,  romUrl: "/roms/yoshis-island.zip" },
  { name: "Donkey Kong Country 2",    genre: "Platformer", players: 2,  romUrl: "/roms/dkc-2.zip" },
  { name: "Mega Man X3",              genre: "Action", players: 1,      romUrl: "/roms/mega-man-x3.zip" },
  { name: "Sunset Riders",            genre: "Action", players: 2,      romUrl: "/roms/sunset-riders.zip" },
];

const VS_GAMES = CATALOG.filter(g => g.players === 2);
const GENRES = ["All", "Fighting", "Sports", "Platformer", "Action", "Racing", "RPG", "Adventure", "Beat em up", "Multiplayer"];

// Franchise ELO mapping
const SF_GAMES = ["Street Fighter II Turbo", "Street Fighter Alpha 2"];
const MK_GAMES = ["Mortal Kombat II"];
function getGameFranchise(name: string): "sf" | "mk" | "general" {
  if (SF_GAMES.includes(name)) return "sf";
  if (MK_GAMES.includes(name)) return "mk";
  return "general";
}

interface LeaderboardEntry {
  id: string; username: string; display_name: string; avatar_url: string;
  snes_rating: number; snes_wins: number; snes_losses: number;
  sf_rating?: number; sf_wins?: number; sf_losses?: number;
  mk_rating?: number; mk_wins?: number; mk_losses?: number;
}

interface Room {
  id: string; host_id: string; game_name: string; status: string; ranked: boolean;
  host_username: string; host_avatar: string;
  guest_id?: string; guest_username?: string; guest_avatar?: string;
  game_started?: boolean;
  created_at: string;
}

interface LobbyMessage {
  id: number; room_id: string; user_id: string; username: string;
  avatar_url: string | null; content: string; created_at: string;
}

interface Props {
  leaderboard: LeaderboardEntry[];
  sfLeaderboard: LeaderboardEntry[];
  mkLeaderboard: LeaderboardEntry[];
  rooms: Room[];
  sessionUserId: string | null;
  sessionUsername: string | null;
  sessionAvatar?: string | null;
  hasSnesAccess: boolean;
}

function getRomSrc(romUrl: string): string {
  if (romUrl.startsWith("/")) return romUrl;
  return `/api/rom-proxy?url=${encodeURIComponent(romUrl)}`;
}

type NetplayStatus = "idle" | "waiting" | "connected" | "error";

// ── Sound helpers ─────────────────────────────────────────────────────────────
function playSwoopSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.12);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
    osc.onended = () => ctx.close();
  } catch { /* no AudioContext */ }
}

function playCopySound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "triangle";
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
    osc.onended = () => ctx.close();
  } catch { /* no AudioContext */ }
}

export default function EmulatorClient({ leaderboard, sfLeaderboard, mkLeaderboard, rooms: initialRooms, sessionUserId, sessionUsername, sessionAvatar, hasSnesAccess }: Props) {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("All");
  const [activeRom, setActiveRom] = useState<{ name: string; url: string } | null>(null);
  const [romFile, setRomFile] = useState<File | null>(null);
  const [emuLoading, setEmuLoading] = useState(false);
  const [rooms, setRooms] = useState(initialRooms);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [reportModal, setReportModal] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [gamepadConnected, setGamepadConnected] = useState(false);
  const [fps, setFps] = useState<number | null>(null);
  const [roomPollResult, setRoomPollResult] = useState<Record<string, unknown> | null>(null);
  const [lbTab, setLbTab] = useState<"general" | "sf" | "mk">("general");
  const [copied, setCopied] = useState(false);
  const [netplayStatus, setNetplayStatus] = useState<NetplayStatus>("idle");
  const [fsMode, setFsMode] = useState(false);

  // ── Save states ───────────────────────────────────────────────────────────
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [saveStateAvailable, setSaveStateAvailable] = useState(false); // has an existing save for this game

  function getSaveKey(gameName: string) {
    return `ryft_snes_save_${gameName.replace(/[^a-zA-Z0-9]/g, "_")}`;
  }

  function captureAndSaveState(gameName: string): boolean {
    try {
      const w = window as unknown as Record<string, unknown>;
      const gm = w.EJS_gameManager as Record<string, unknown> | undefined;
      if (!gm || typeof gm.saveState !== "function") return false;
      const state = (gm.saveState as () => unknown)();
      if (!state) return false;
      // Convert Uint8Array / ArrayBuffer to base64 for localStorage
      let b64: string;
      if (state instanceof Uint8Array || state instanceof ArrayBuffer) {
        const arr = state instanceof Uint8Array ? state : new Uint8Array(state as ArrayBuffer);
        let str = "";
        for (let i = 0; i < arr.length; i++) str += String.fromCharCode(arr[i]);
        b64 = btoa(str);
      } else if (typeof state === "string") {
        b64 = btoa(state);
      } else {
        b64 = JSON.stringify(state);
      }
      localStorage.setItem(getSaveKey(gameName), JSON.stringify({ data: b64, savedAt: new Date().toISOString(), gameName }));
      return true;
    } catch { return false; }
  }

  function loadSaveState(gameName: string): boolean {
    try {
      const raw = localStorage.getItem(getSaveKey(gameName));
      if (!raw) return false;
      const { data } = JSON.parse(raw) as { data: string; savedAt: string };
      const w = window as unknown as Record<string, unknown>;
      const gm = w.EJS_gameManager as Record<string, unknown> | undefined;
      if (!gm || typeof gm.loadState !== "function") return false;
      // Decode base64 → Uint8Array
      const str = atob(data);
      const arr = new Uint8Array(str.length);
      for (let i = 0; i < str.length; i++) arr[i] = str.charCodeAt(i);
      (gm.loadState as (s: Uint8Array) => void)(arr);
      return true;
    } catch { return false; }
  }

  function hasSaveState(gameName: string) {
    return !!localStorage.getItem(getSaveKey(gameName));
  }

  function getSaveInfo(gameName: string): { savedAt: string } | null {
    try {
      const raw = localStorage.getItem(getSaveKey(gameName));
      if (!raw) return null;
      return JSON.parse(raw) as { savedAt: string };
    } catch { return null; }
  }

  // Lobby minimized state
  const [lobbyMinimized, setLobbyMinimized] = useState(false);

  // Lobby state
  const [lobbyRoom, setLobbyRoom] = useState<Room | null>(null);
  const [lobbyMessages, setLobbyMessages] = useState<LobbyMessage[]>([]);
  const [lobbyInput, setLobbyInput] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [startingGame, setStartingGame] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [closingRoomId, setClosingRoomId] = useState<string | null>(null);
  const [showGamePicker, setShowGamePicker] = useState(false);
  const [lobbyRanked, setLobbyRanked] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const lobbyPollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Invite via DM

  const [inviteFriends, setInviteFriends] = useState<{id:string, username:string, display_name:string|null, avatar_url:string|null}[]>([]);
  const [inviteSending, setInviteSending] = useState<string | null>(null);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());

  const fileRef = useRef<HTMLInputElement>(null);
  const emulatorContainerRef = useRef<HTMLDivElement>(null);
  const fpsTimestamps = useRef<number[]>([]);
  const gameLoopRef = useRef<number>(0);
  const stickState = useRef({ up: false, down: false, left: false, right: false });

  // Netplay / challenge params from URL — also stored in refs so pollLobby can set them
  // before loadRomUrl triggers the emulator useEffect (useSearchParams doesn't update on replaceState)
  const netplayRoom = searchParams?.get("room") ?? null;
  const netplayRole = (searchParams?.get("role") ?? "host") as "host" | "join";
  const isRanked = searchParams?.get("ranked") !== "0";
  const isNetplayMode = !!netplayRoom;
  const netplayRoomRef = useRef<string | null>(netplayRoom);
  const netplayRoleRef = useRef<"host" | "join">(netplayRole);

  // ── Track B: custom netplay layer (PartyKit signaling + state sync) ──────────
  const npWsRef        = useRef<WebSocket | null>(null);
  const npRTCRef       = useRef<RTCPeerConnection | null>(null);
  const npChannelRef   = useRef<RTCDataChannel | null>(null);
  const peerInputRef   = useRef<number>(0);      // latest bitmask received from peer
  const localInputRef  = useRef<number>(0);      // our own bitmask sent last tick
  const npFrameRef     = useRef<number>(0);
  const npPingRef      = useRef<number>(0);
  const [npPing, setNpPing] = useState<number | null>(null);
  const [npConnected, setNpConnected] = useState(false);
  const npStateSyncRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Invite dropdown toggle
  const [showInviteDropdown, setShowInviteDropdown] = useState(false);
  const [bootingGuest, setBootingGuest] = useState(false);
  const [claimingP2, setClaimingP2] = useState(false);

  const filtered = CATALOG.filter(g => {
    const matchSearch = !search || g.name.toLowerCase().includes(search.toLowerCase()) || g.genre.toLowerCase().includes(search.toLowerCase());
    const matchGenre = genre === "All" || g.genre === genre;
    return matchSearch && matchGenre;
  });

  function loadRomFile(file: File, gameName?: string) {
    killEmulator();
    const url = URL.createObjectURL(file);
    setRomFile(file);
    setActiveRom({ name: gameName ?? file.name.replace(/\.(sfc|smc|zip)$/i, ""), url });
  }

  function loadRomUrl(romUrl: string, gameName: string) {
    killEmulator();
    setEmuLoading(true);
    setActiveRom({ name: gameName, url: getRomSrc(romUrl) });
    setSaveStateAvailable(hasSaveState(gameName));
  }

  // ── Lobby: create a room ─────────────────────────────────────────────────────
  async function createLobbyRoom(gameName: string, ranked = true) {
    if (!sessionUserId) return;
    setCreatingRoom(true);
    try {
      const res = await fetch("/api/emulator-room", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", gameName, ranked }),
      });
      const room = await res.json();
      if (room?.id) {
        setLobbyRoom(room as Room);
        startLobbyPoll(room.id);
      }
    } catch { /* ignore */ } finally {
      setCreatingRoom(false);
    }
  }

  // ── Lobby: join a room ───────────────────────────────────────────────────────
  async function joinLobbyRoom(roomId: string) {
    if (!sessionUserId) return;
    const res = await fetch("/api/emulator-room", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join", roomId }),
    });
    const room = await res.json();
    setLobbyRoom(room as Room);
    startLobbyPoll(roomId);
  }

  // ── Lobby: leave (dismiss panel, room stays alive for 20 min) ───────────────
  function leaveLobbyRoom() {
    if (!lobbyRoom) return;
    clearInterval(lobbyPollRef.current);
    sessionStorage.removeItem("lobbyRoomId");
    setLobbyRoom(null);
    setLobbyMessages([]);
    refreshRooms();
  }

  // ── Lobby: close room (host-only — permanently removes from list) ──────────
  async function closeHostRoom() {
    if (!lobbyRoom) return;
    clearInterval(lobbyPollRef.current);
    await fetch("/api/emulator-room", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close", roomId: lobbyRoom.id }),
    }).catch(() => {});
    sessionStorage.removeItem("lobbyRoomId");
    setLobbyRoom(null);
    setLobbyMessages([]);
    refreshRooms();
  }

  // ── Lobby: poll room + messages ──────────────────────────────────────────────
  function startLobbyPoll(roomId: string) {
    clearInterval(lobbyPollRef.current);
    lobbyPollRef.current = setInterval(() => pollLobby(roomId), 4000);
  }

  const pollLobby = useCallback(async (roomId: string) => {
    try {
      // Heartbeat: keeps updated_at fresh so the 20-min auto-expiry doesn't close an active lobby
      fetch("/api/emulator-room", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "heartbeat", roomId }),
      }).catch(() => {});

      const [roomRes, msgsRes] = await Promise.all([
        fetch(`/api/emulator-room?id=${roomId}`),
        fetch(`/api/emulator-room?messages=${roomId}`),
      ]);
      if (roomRes.ok) {
        const room = await roomRes.json() as Room;
        setLobbyRoom(room);
        // Game started → launch emulator for both players
        if (room.game_started) {
          clearInterval(lobbyPollRef.current);
          sessionStorage.removeItem("lobbyRoomId");
          setLobbyRoom(null);
          setLobbyMessages([]);
          const entry = CATALOG.find(g => g.name === room.game_name);
          const isHost = room.host_id === sessionUserId;
          // Set refs BEFORE loadRomUrl so the emulator useEffect sees them
          netplayRoomRef.current = roomId;
          netplayRoleRef.current = isHost ? "host" : "join";
          if (entry?.romUrl) loadRomUrl(entry.romUrl, entry.name);
          setActiveRoom(room);
          const params = new URLSearchParams(window.location.search);
          params.set("room", roomId);
          params.set("role", isHost ? "host" : "join");
          params.set("ranked", room.ranked ? "1" : "0");
          if (entry?.romUrl) params.set("game", room.game_name);
          window.history.replaceState({}, "", `?${params.toString()}`);
        }
      }
      if (msgsRes.ok) {
        const msgs = await msgsRes.json() as LobbyMessage[];
        setLobbyMessages(msgs);
      }
    } catch { /* ignore */ }
  }, [sessionUserId]); // eslint-disable-line

  // Scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lobbyMessages]);

  // ── Lobby: select game ───────────────────────────────────────────────────────
  async function selectLobbyGame(gameName: string) {
    if (!lobbyRoom) return;
    const res = await fetch("/api/emulator-room", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "selectGame", roomId: lobbyRoom.id, gameName }),
    });
    const room = await res.json() as Room;
    setLobbyRoom(room);
    setShowGamePicker(false);
  }

  // ── Lobby: start game (host only) ────────────────────────────────────────────
  async function startLobbyGame() {
    if (!lobbyRoom || lobbyRoom.host_id !== sessionUserId) return;
    if (!lobbyRoom.guest_id) return; // need both players
    setStartingGame(true);
    const roomId = lobbyRoom.id;
    const gameName = lobbyRoom.game_name;
    const ranked = lobbyRoom.ranked;
    try {
      const res = await fetch("/api/emulator-room", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "startGame", roomId }),
      });
      if (!res.ok) throw new Error("start failed");
      // Immediately launch for host (P1) — don't wait for the next 2s poll tick
      clearInterval(lobbyPollRef.current);
      sessionStorage.removeItem("lobbyRoomId");
      const entry = CATALOG.find(g => g.name === gameName);
      netplayRoomRef.current = roomId;
      netplayRoleRef.current = "host"; // host is always P1
      setLobbyRoom(null);
      setLobbyMessages([]);
      if (entry?.romUrl) loadRomUrl(entry.romUrl, entry.name);
      const params = new URLSearchParams(window.location.search);
      params.set("room", roomId);
      params.set("role", "host");
      params.set("ranked", ranked ? "1" : "0");
      params.set("game", gameName);
      window.history.replaceState({}, "", `?${params.toString()}`);
    } catch { /* ignore */ } finally {
      setStartingGame(false);
    }
  }

  // ── Lobby: send message ──────────────────────────────────────────────────────
  async function sendLobbyMessage() {
    if (!lobbyRoom || !lobbyInput.trim()) return;
    setSendingMsg(true);
    try {
      await fetch("/api/emulator-room", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sendMessage", roomId: lobbyRoom.id, content: lobbyInput.trim() }),
      });
      setLobbyInput("");
      await pollLobby(lobbyRoom.id);
    } catch { /* ignore */ } finally {
      setSendingMsg(false);
    }
  }

  // ── Close a single room from the list ───────────────────────────────────────
  async function closeRoom(roomId: string) {
    setClosingRoomId(roomId);
    try {
      await fetch("/api/emulator-room", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close", roomId }),
      });
      setRooms(prev => prev.filter(r => r.id !== roomId));
    } catch { /* ignore */ } finally {
      setClosingRoomId(null);
    }
  }

  async function refreshRooms() {
    const res = await fetch("/api/emulator-room");
    if (res.ok) { const data = await res.json(); if (Array.isArray(data)) setRooms(data); }
  }

  // ── Boot guest from room (host only) ────────────────────────────────────────
  async function bootGuest() {
    if (!lobbyRoom) return;
    setBootingGuest(true);
    try {
      const res = await fetch("/api/emulator-room", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bootGuest", roomId: lobbyRoom.id }),
      });
      const room = await res.json();
      setLobbyRoom(room as Room);
    } catch { /* ignore */ } finally {
      setBootingGuest(false);
    }
  }

  // ── Claim P2 slot ────────────────────────────────────────────────────────────
  async function claimP2() {
    if (!lobbyRoom) return;
    setClaimingP2(true);
    try {
      const res = await fetch("/api/emulator-room", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", roomId: lobbyRoom.id }),
      });
      const room = await res.json();
      setLobbyRoom(room as Room);
      playSwoopSound();
    } catch { /* ignore */ } finally {
      setClaimingP2(false);
    }
  }

  // ── Persist lobby in sessionStorage so refresh doesn't lose it ───────────────
  useEffect(() => {
    if (lobbyRoom?.id) {
      sessionStorage.setItem("lobbyRoomId", lobbyRoom.id);
    } else {
      sessionStorage.removeItem("lobbyRoomId");
    }
  }, [lobbyRoom?.id]);

  useEffect(() => {
    const savedId = sessionStorage.getItem("lobbyRoomId");
    if (savedId && !lobbyRoom && sessionUserId) {
      fetch(`/api/emulator-room?id=${savedId}`)
        .then(r => r.ok ? r.json() : null)
        .then((data: Room | null) => {
          if (data && !("error" in data) && data.status === "waiting" &&
              (data.host_id === sessionUserId || data.guest_id === sessionUserId)) {
            setLobbyRoom(data);
            startLobbyPoll(savedId);
          } else {
            sessionStorage.removeItem("lobbyRoomId");
          }
        }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUserId]);

  // ── Auto-join lobby from ?joinRoom= URL param ─────────────────────────────────
  const joinRoomParam = searchParams?.get("joinRoom") ?? null;
  useEffect(() => {
    if (joinRoomParam && !lobbyRoom && sessionUserId) {
      joinLobbyRoom(joinRoomParam);
    }
  }, [joinRoomParam, sessionUserId]); // eslint-disable-line

  // ── Rooms list polling (refresh open rooms every 5s when not in a lobby) ─────
  useEffect(() => {
    if (lobbyRoom || !sessionUserId) return;
    const iv = setInterval(() => {
      fetch("/api/emulator-room").then(r => r.json()).then(data => {
        if (Array.isArray(data)) setRooms(data);
      }).catch(() => {});
    }, 5000);
    return () => clearInterval(iv);
  }, [!!lobbyRoom, sessionUserId]); // eslint-disable-line

  // ── Invite friends via DM ─────────────────────────────────────────────────────
  useEffect(() => {
    if (lobbyRoom && inviteFriends.length === 0) {
      fetch("/api/friends").then(r => r.json()).then(data => {
        if (Array.isArray(data)) setInviteFriends(data);
      }).catch(() => {});
    }
  }, [!!lobbyRoom]); // eslint-disable-line

  async function sendDmInvite(friendId: string) {
    if (!lobbyRoom) return;
    setInviteSending(friendId);
    try {
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: friendId, content: `[snes:${lobbyRoom.id}]` }),
      });
      setInvitedIds(prev => new Set([...prev, friendId]));
      playSwoopSound();
    } catch { /* ignore */ } finally {
      setInviteSending(null);
    }
  }

  // ── Netplay auto-join ────────────────────────────────────────────────────────
  // Uses refs (not stale searchParams) so it works after pollLobby/startLobbyGame
  // trigger replaceState — searchParams doesn't update on replaceState in Next.js.
  const autoJoinNetplay = useCallback(() => {
    const roomId = netplayRoomRef.current; // always current
    const role   = netplayRoleRef.current;
    if (!roomId) return;
    const w = window as unknown as Record<string, unknown>;
    const gm = w.EJS_gameManager as Record<string, unknown> | undefined;
    if (gm) {
      const netplayApi = gm.netplay as Record<string, (a: string) => void> | undefined;
      if (netplayApi) {
        if (role === "host") {
          // P1: create/host the room so the guest can join as P2
          if (typeof netplayApi.createRoom === "function") { netplayApi.createRoom(roomId); return; }
          if (typeof netplayApi.create    === "function") { netplayApi.create(roomId);     return; }
          if (typeof netplayApi.host      === "function") { netplayApi.host(roomId);       return; }
        }
        // P2 (guest) or fallback: join existing room
        if (typeof netplayApi.join    === "function") { netplayApi.join(roomId);    return; }
        if (typeof netplayApi.connect === "function") { netplayApi.connect(roomId); return; }
      }
    }
    // Fallback: click the Netplay button in the emulator UI
    const selectors = ['[title="Netplay"]', '[title="netplay"]', 'button[data-id="netplay"]', '.netplay-btn', '[data-type="netplay"]'];
    for (const sel of selectors) {
      const btn = document.querySelector(sel) as HTMLElement | null;
      if (btn) { btn.click(); return; }
    }
  }, []); // no deps — reads from refs, always stable

  // ── Track B helpers ──────────────────────────────────────────────────────────
  // SNES button order matches EmulatorJS setInput names
  const SNES_BTNS = ["b","y","select","start","up","down","left","right","a","x","l","r"];

  function readGamepadMask(gpIdx: number): number {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads[gpIdx];
    if (!gp) return 0;
    let m = 0;
    // Standard gamepad → SNES bit mapping
    // gp button → SNES bit:  0→A(8) 1→B(0) 2→X(9) 3→Y(1) 4→L(10) 5→R(11) 8→Sel(2) 9→Start(3)
    const BM: [number,number][] = [[0,8],[1,0],[2,9],[3,1],[4,10],[5,11],[8,2],[9,3],[12,4],[13,5],[14,6],[15,7]];
    for (const [gi, si] of BM) { if (gp.buttons[gi]?.pressed) m |= (1 << si); }
    // Axes → d-pad
    if ((gp.axes[0]??0) < -0.5) m |= (1<<6);
    if ((gp.axes[0]??0) >  0.5) m |= (1<<7);
    if ((gp.axes[1]??0) < -0.5) m |= (1<<4);
    if ((gp.axes[1]??0) >  0.5) m |= (1<<5);
    return m;
  }

  function emsSetInput(slot: 0|1, mask: number) {
    const w = window as Record<string,unknown>;
    const gm = w.EJS_gameManager as Record<string,(p:number,b:string,v:number)=>void>|undefined;
    if (!gm?.setInput) return;
    for (let i = 0; i < SNES_BTNS.length; i++) gm.setInput(slot, SNES_BTNS[i], (mask>>i)&1);
  }

  function emsSaveState(): string | null {
    try {
      const w = window as Record<string,unknown>;
      const gm = w.EJS_gameManager as Record<string,()=>unknown>|undefined;
      if (!gm?.saveState) return null;
      const st = gm.saveState();
      if (!st) return null;
      const arr = st instanceof Uint8Array ? st : st instanceof ArrayBuffer ? new Uint8Array(st as ArrayBuffer) : null;
      if (!arr) return null;
      let s = ""; for (let i=0; i<arr.length; i++) s += String.fromCharCode(arr[i]);
      return btoa(s);
    } catch { return null; }
  }

  function emsLoadState(b64: string) {
    try {
      const w = window as Record<string,unknown>;
      const gm = w.EJS_gameManager as Record<string,(s:Uint8Array)=>void>|undefined;
      if (!gm?.loadState) return;
      const s = atob(b64);
      const arr = new Uint8Array(s.length);
      for (let i=0; i<s.length; i++) arr[i] = s.charCodeAt(i);
      gm.loadState(arr);
    } catch { /* ignore */ }
  }

  // Tear down Track B
  function destroyCustomNetplay() {
    if (npStateSyncRef.current) { clearInterval(npStateSyncRef.current); npStateSyncRef.current = null; }
    npChannelRef.current?.close();
    npRTCRef.current?.close();
    npWsRef.current?.close();
    npChannelRef.current = null; npRTCRef.current = null; npWsRef.current = null;
    peerInputRef.current = 0;
    setNpConnected(false);
    setNpPing(null);
  }

  // Init Track B — called after EJS game starts in netplay mode
  const initCustomNetplay = useCallback(async () => {
    const roomId = netplayRoomRef.current;
    const role   = netplayRoleRef.current;
    if (!roomId) return;
    destroyCustomNetplay();

    const pkHost = process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999";
    const proto  = pkHost.startsWith("localhost") ? "ws" : "wss";
    const ws     = new WebSocket(`${proto}://${pkHost}/parties/netplay/netplay-${roomId}`);
    npWsRef.current = ws;

    // Fetch ICE servers for WebRTC
    let iceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
    try {
      const r = await fetch("/api/ice-servers");
      if (r.ok) { const d = await r.json(); if (Array.isArray(d)) iceServers = d; }
    } catch { /* use stun-only fallback */ }

    const pc = new RTCPeerConnection({ iceServers });
    npRTCRef.current = pc;

    // Track B DataChannel (input + state sync)
    let channel: RTCDataChannel | null = null;

    function setupChannel(ch: RTCDataChannel) {
      channel = ch;
      npChannelRef.current = ch;
      ch.binaryType = "arraybuffer";
      ch.onopen = () => {
        setNpConnected(true);
        // Start state sync (host → guest every 8s)
        if (role === "host") {
          npStateSyncRef.current = setInterval(() => {
            const st = emsSaveState();
            if (st && ch.readyState === "open") {
              ch.send(JSON.stringify({ type: "np-state", state: st }));
            }
          }, 8000);
        }
      };
      ch.onclose = () => { setNpConnected(false); };
      ch.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string) as Record<string,unknown>;
          if (msg.type === "np-input") {
            peerInputRef.current = msg.mask as number;
          } else if (msg.type === "np-state" && role === "join") {
            // Guest loads host state for desync recovery
            emsLoadState(msg.state as string);
          } else if (msg.type === "np-pong-dc") {
            const rtt = Date.now() - (msg.t as number);
            setNpPing(rtt);
            npPingRef.current = rtt;
          }
        } catch { /* ignore */ }
      };
    }

    if (role === "host") {
      const ch = pc.createDataChannel("netplay", { ordered: false, maxRetransmits: 0 });
      setupChannel(ch);
    } else {
      pc.ondatachannel = (e) => setupChannel(e.channel);
    }

    // ICE candidates → relay via PartyKit
    pc.onicecandidate = (e) => {
      if (e.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "np-ice", candidate: e.candidate }));
      }
    };

    ws.onopen = async () => {
      ws.send(JSON.stringify({ type: "np-join", role, userId: sessionUserId ?? "" }));
      if (role === "host") {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws.send(JSON.stringify({ type: "np-offer", sdp: offer }));
      }
    };

    ws.onmessage = async (e) => {
      try {
        const msg = JSON.parse(e.data as string) as Record<string,unknown>;
        if (msg.type === "np-offer" && role === "join") {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp as RTCSessionDescriptionInit));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(JSON.stringify({ type: "np-answer", sdp: answer }));
        } else if (msg.type === "np-answer" && role === "host") {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp as RTCSessionDescriptionInit));
        } else if (msg.type === "np-ice") {
          await pc.addIceCandidate(new RTCIceCandidate(msg.candidate as RTCIceCandidateInit));
        } else if (msg.type === "np-disconnect") {
          // Peer disconnected — they left the game → auto-show result modal
          setNpConnected(false);
          if (isRanked && !roomCompleted) {
            setReportModal(true);
          }
        } else if (msg.type === "np-peer-count") {
          // Both players present
        }
      } catch { /* ignore */ }
    };

    ws.onerror = () => { setNpConnected(false); };

    // Ping via DataChannel every 3s
    const pingInterval = setInterval(() => {
      const ch = npChannelRef.current;
      if (ch?.readyState === "open") {
        ch.send(JSON.stringify({ type: "np-ping-dc", t: Date.now() }));
      }
    }, 3000);

    return () => { clearInterval(pingInterval); destroyCustomNetplay(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUserId, isRanked]);

  // ── Launch EmulatorJS when a ROM is set ─────────────────────────────────────
  useEffect(() => {
    if (!activeRom || !emulatorContainerRef.current) return;
    const container = emulatorContainerRef.current;
    container.innerHTML = "";
    setEmuLoading(true);
    setNetplayStatus("idle");

    const emuDiv = document.createElement("div");
    emuDiv.id = "game";
    emuDiv.style.cssText = "width:100%;height:100%;";
    container.appendChild(emuDiv);

    const w = window as unknown as Record<string, unknown>;
    w.EJS_player = "#game";
    w.EJS_core = "snes9x";
    w.EJS_gameUrl = activeRom.url;
    w.EJS_pathtodata = "https://cdn.emulatorjs.org/stable/data/";
    w.EJS_startOnLoaded = true;
    w.EJS_color = "#7c5cbf";

    // Use refs (not searchParams) so game-start from lobby correctly enables netplay
    const activeNetplayRoom = netplayRoomRef.current;
    const activeNetplayRole = netplayRoleRef.current;
    if (activeNetplayRoom) {
      w.EJS_Netplay = true;
      // Track A: self-hosted relay (falls back to official if env not set)
      w.EJS_netplayServer = process.env.NEXT_PUBLIC_NETPLAY_SERVER ?? "https://netplay.emulatorjs.org";
      w.EJS_netplayFrameDelay = 2; // 2-frame delay (33ms) — stable for most connections
      // P1 = host, P2 = guest — tells EmulatorJS which controller slot to assign
      w.EJS_netplayPlayer = activeNetplayRole === "host" ? 1 : 2;
    }

    w.EJS_onGameStart = () => {
      setEmuLoading(false);
      if (activeNetplayRoom) {
        setNetplayStatus("waiting");
        setTimeout(() => autoJoinNetplay(), 1500);
        // Track B: start custom layer alongside EJS netplay
        setTimeout(() => initCustomNetplay(), 2000);
      }
    };

    const existing = document.getElementById("ejs-script");
    if (existing) existing.remove();
    const script = document.createElement("script");
    script.id = "ejs-script";
    script.src = "https://cdn.emulatorjs.org/stable/data/loader.js";
    script.async = true;
    document.head.appendChild(script);

    const fallbackTimer = setTimeout(() => setEmuLoading(false), 20000);
    return () => { script.remove(); clearTimeout(fallbackTimer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRom?.url]);

  // Fetch existing emulator room when arriving via challenge link
  useEffect(() => {
    if (!netplayRoom) return;
    fetch(`/api/emulator-room?id=${netplayRoom}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data && !data.error) setActiveRoom(data); })
      .catch(() => {});
  }, [netplayRoom]);

  // Auto-load game from ?game= query param
  useEffect(() => {
    const gameName = searchParams?.get("game");
    if (!gameName) return;
    const entry = CATALOG.find(g => g.name === gameName);
    if (entry?.romUrl) loadRomUrl(entry.romUrl, entry.name);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh room list every 8s
  useEffect(() => {
    const interval = setInterval(refreshRooms, 8000);
    return () => clearInterval(interval);
  }, []);

  // Cleanup lobby poll on unmount
  useEffect(() => {
    return () => { clearInterval(lobbyPollRef.current); killEmulator(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function reportResult(winnerId: string | null) {
    if (!activeRoom) return;
    setReporting(true);
    const res = await fetch("/api/emulator-room", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "report", roomId: activeRoom.id, winnerId }),
    });
    const data = await res.json();
    setActiveRoom(data);
    setRoomPollResult(data);
    setReporting(false);
    setReportModal(false);
  }

  const isInRoom = !!activeRoom;
  const roomCompleted = activeRoom?.status === "completed";
  const iWon = roomCompleted && roomPollResult?.winner_id === sessionUserId;
  const iLost = roomCompleted && roomPollResult?.winner_id && roomPollResult?.winner_id !== sessionUserId;

  // Gamepad detection
  useEffect(() => {
    function onConnected(e: GamepadEvent) { setGamepadConnected(true); void e; }
    function onDisconnected() { setGamepadConnected(false); }
    window.addEventListener("gamepadconnected", onConnected);
    window.addEventListener("gamepaddisconnected", onDisconnected);
    const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
    if (pads.length > 0) setGamepadConnected(true);
    return () => { window.removeEventListener("gamepadconnected", onConnected); window.removeEventListener("gamepaddisconnected", onDisconnected); };
  }, []);

  // Combined game loop: FPS + joystick
  useEffect(() => {
    if (!activeRom || emuLoading) { setFps(null); cancelAnimationFrame(gameLoopRef.current); return; }
    const AXIS_DEAD = 0.35;
    const KEY_MAP = {
      up: { code: "ArrowUp", key: "ArrowUp" }, down: { code: "ArrowDown", key: "ArrowDown" },
      left: { code: "ArrowLeft", key: "ArrowLeft" }, right: { code: "ArrowRight", key: "ArrowRight" },
    } as const;
    function fireKey(dir: keyof typeof KEY_MAP, down: boolean) {
      const { code, key } = KEY_MAP[dir];
      const type = down ? "keydown" : "keyup";
      window.dispatchEvent(new KeyboardEvent(type, { code, key, bubbles: true, cancelable: true }));
      document.dispatchEvent(new KeyboardEvent(type, { code, key, bubbles: true, cancelable: true }));
    }
    let last = performance.now();
    function tick(now: number) {
      const delta = now - last; last = now;
      if (delta > 0) {
        fpsTimestamps.current.push(1000 / delta);
        if (fpsTimestamps.current.length > 60) fpsTimestamps.current.shift();
        if (fpsTimestamps.current.length % 10 === 0) {
          const avg = fpsTimestamps.current.reduce((a, b) => a + b, 0) / fpsTimestamps.current.length;
          setFps(Math.round(avg));
        }
      }
      const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
      const gp = pads.find(p => p != null);
      if (gp) {
        const ax = gp.axes[0] ?? 0; const ay = gp.axes[1] ?? 0;
        const want = { left: ax < -AXIS_DEAD, right: ax > AXIS_DEAD, up: ay < -AXIS_DEAD, down: ay > AXIS_DEAD };
        (Object.keys(want) as (keyof typeof want)[]).forEach(dir => {
          if (want[dir] !== stickState.current[dir]) { fireKey(dir, want[dir]); stickState.current[dir] = want[dir]; }
        });
      }
      // Track B: send local inputs + inject peer inputs every frame
      const frame = npFrameRef.current++;
      if (npChannelRef.current?.readyState === "open") {
        // Read local gamepad index 0 (the player's own gamepad)
        const localMask = readGamepadMask(0);
        if (localMask !== localInputRef.current || frame % 4 === 0) {
          localInputRef.current = localMask;
          npChannelRef.current.send(JSON.stringify({ type: "np-input", mask: localMask }));
        }
        // Inject peer inputs into the REMOTE player slot
        const remoteSlot = netplayRoleRef.current === "host" ? 1 : 0;
        emsSetInput(remoteSlot as 0|1, peerInputRef.current);
      }
      gameLoopRef.current = requestAnimationFrame(tick);
    }
    gameLoopRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(gameLoopRef.current);
      (Object.keys(stickState.current) as (keyof typeof stickState.current)[]).forEach(dir => {
        if (stickState.current[dir]) { fireKey(dir, false); stickState.current[dir] = false; }
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRom, emuLoading]);

  function enterFullscreen() {
    setFsMode(true);
    document.body.style.overflow = "hidden";
    try {
      document.documentElement.requestFullscreen?.();
      (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.("landscape").catch(() => {});
    } catch { /* ignore */ }
  }

  function exitFullscreen() {
    setFsMode(false);
    document.body.style.overflow = "";
    try {
      if (document.fullscreenElement) document.exitFullscreen?.();
      (screen.orientation as unknown as { unlock?: () => void }).unlock?.();
    } catch { /* ignore */ }
  }

  function killEmulator() {
    const w = window as unknown as Record<string, unknown>;
    try {
      const gm = w.EJS_gameManager as Record<string, unknown> | undefined;
      if (gm) {
        if (typeof gm.pause === "function") (gm.pause as () => void)();
        if (typeof gm.stop === "function") (gm.stop as () => void)();
        const ctx = gm.audioContext as AudioContext | undefined;
        if (ctx) { ctx.suspend().catch(() => {}); ctx.close().catch(() => {}); }
      }
    } catch { /* ignore */ }
    document.querySelectorAll<HTMLMediaElement>("audio, video").forEach(el => {
      try { el.pause(); el.muted = true; el.src = ""; el.load(); } catch { /* ignore */ }
    });
    try {
      const iframe = document.querySelector<HTMLIFrameElement>("#game iframe, #emulator-container iframe");
      if (iframe?.contentWindow) {
        iframe.contentWindow.document.querySelectorAll<HTMLMediaElement>("audio, video").forEach(el => {
          try { el.pause(); el.muted = true; el.src = ""; } catch { /* ignore */ }
        });
      }
    } catch { /* cross-origin */ }
    const container = emulatorContainerRef.current;
    if (container) container.innerHTML = "";
    document.getElementById("ejs-script")?.remove();
    Object.keys(w).filter(k => k.startsWith("EJS_")).forEach(k => { try { delete w[k]; } catch { /* */ } });
    document.body.style.overflow = "";
  }

  function closeGameImmediately() {
    destroyCustomNetplay();
    killEmulator();
    exitFullscreen();
    setActiveRom(null);
    setRomFile(null);
    setActiveRoom(null);
    setEmuLoading(false);
    setNetplayStatus("idle");
    setShowExitDialog(false);
  }

  function closeGame() {
    // Show save dialog if game is actually running (not still loading)
    if (activeRom && !emuLoading) {
      setShowExitDialog(true);
    } else {
      closeGameImmediately();
    }
  }

  function copyRoomId() {
    if (!netplayRoom) return;
    navigator.clipboard.writeText(netplayRoom).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Leaderboard helpers
  function LbRow({ entry, i, ratingKey, winsKey, lossesKey }: {
    entry: LeaderboardEntry; i: number;
    ratingKey: keyof LeaderboardEntry; winsKey: keyof LeaderboardEntry; lossesKey: keyof LeaderboardEntry;
  }) {
    return (
      <Link href={`/profile/${entry.username}`} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8, padding: "6px 4px", borderRadius: 7 }}>
        <span style={{ fontSize: 11, color: i < 3 ? ["#ffd700", "#c0c0c0", "#cd7f32"][i] : "var(--text-muted)", fontWeight: 700, width: 20, textAlign: "center" }}>{i + 1}</span>
        <img src={entry.avatar_url || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${entry.username}`}
          alt="" style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid var(--border)" }} />
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.username}</div>
          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{String(entry[winsKey] ?? 0)}W {String(entry[lossesKey] ?? 0)}L</div>
        </div>
        <div style={{ fontSize: 12, fontWeight: 800, color: "var(--accent-purple-bright)" }}>{String(entry[ratingKey] ?? 1200)}</div>
      </Link>
    );
  }

  const currentLb = lbTab === "sf" ? sfLeaderboard : lbTab === "mk" ? mkLeaderboard : leaderboard;
  const lbRatingKey: keyof LeaderboardEntry = lbTab === "sf" ? "sf_rating" : lbTab === "mk" ? "mk_rating" : "snes_rating";
  const lbWinsKey: keyof LeaderboardEntry = lbTab === "sf" ? "sf_wins" : lbTab === "mk" ? "mk_wins" : "snes_wins";
  const lbLossesKey: keyof LeaderboardEntry = lbTab === "sf" ? "sf_losses" : lbTab === "mk" ? "mk_losses" : "snes_losses";

  // Mobile touch controls
  function pressKey(key: string, code: string, down: boolean) {
    const evt = new KeyboardEvent(down ? "keydown" : "keyup", { key, code, bubbles: true, cancelable: true });
    window.dispatchEvent(evt);
    document.dispatchEvent(evt);
  }

  function TouchBtn({ label, btnKey, code, w = 52, h = 52, color = "rgba(255,255,255,0.12)", fontSize = 14, borderRadius = "50%" }: {
    label: string; btnKey: string; code: string; w?: number; h?: number; color?: string; fontSize?: number; borderRadius?: string;
  }) {
    return (
      <button
        onTouchStart={e => { e.preventDefault(); pressKey(btnKey, code, true); }}
        onTouchEnd={e => { e.preventDefault(); pressKey(btnKey, code, false); }}
        onMouseDown={e => { e.preventDefault(); pressKey(btnKey, code, true); }}
        onMouseUp={e => { e.preventDefault(); pressKey(btnKey, code, false); }}
        onMouseLeave={() => pressKey(btnKey, code, false)}
        style={{
          width: w, height: h, background: color,
          border: "2px solid rgba(255,255,255,0.28)", borderRadius,
          color: "#fff", fontSize, fontWeight: 800,
          display: "flex", alignItems: "center", justifyContent: "center",
          touchAction: "none", userSelect: "none", WebkitUserSelect: "none" as const,
          cursor: "pointer", pointerEvents: "all", flexShrink: 0,
          boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
        }}
      >{label}</button>
    );
  }

  const MobileTouchControls = () => (
    <div style={{ position: "absolute", inset: 0, zIndex: 10000, pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 10, left: 10, pointerEvents: "all" }}>
        <TouchBtn label="L" btnKey="q" code="KeyQ" w={56} h={28} borderRadius="8px" fontSize={12} />
      </div>
      <div style={{ position: "absolute", top: 10, right: 60, pointerEvents: "all" }}>
        <TouchBtn label="R" btnKey="w" code="KeyW" w={56} h={28} borderRadius="8px" fontSize={12} />
      </div>
      <button onTouchStart={e => { e.preventDefault(); exitFullscreen(); }} onClick={exitFullscreen}
        style={{ position: "absolute", top: 10, right: 10, pointerEvents: "all", background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 8, padding: "5px 10px", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", touchAction: "manipulation" }}>
        ⛶ Exit
      </button>
      <div style={{ position: "absolute", bottom: 70, left: 20, pointerEvents: "all" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 3 }}>
          <TouchBtn label="▲" btnKey="ArrowUp" code="ArrowUp" />
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          <TouchBtn label="◀" btnKey="ArrowLeft" code="ArrowLeft" />
          <div style={{ width: 52, height: 52, background: "rgba(0,0,0,0.3)", borderRadius: "50%", flexShrink: 0 }} />
          <TouchBtn label="▶" btnKey="ArrowRight" code="ArrowRight" />
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 3 }}>
          <TouchBtn label="▼" btnKey="ArrowDown" code="ArrowDown" />
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 18, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 14, pointerEvents: "all" }}>
        <TouchBtn label="SELECT" btnKey="Shift" code="ShiftLeft" w={64} h={28} borderRadius="14px" fontSize={9} />
        <TouchBtn label="START" btnKey="Enter" code="Enter" w={64} h={28} borderRadius="14px" fontSize={9} />
      </div>
      <div style={{ position: "absolute", bottom: 70, right: 20, pointerEvents: "all" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 3 }}>
          <TouchBtn label="X" btnKey="s" code="KeyS" color="rgba(80,130,255,0.35)" />
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          <TouchBtn label="Y" btnKey="a" code="KeyA" color="rgba(80,200,80,0.35)" />
          <div style={{ width: 52, height: 52, background: "rgba(0,0,0,0.3)", borderRadius: "50%", flexShrink: 0 }} />
          <TouchBtn label="A" btnKey="z" code="KeyZ" color="rgba(255,80,80,0.35)" />
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 3 }}>
          <TouchBtn label="B" btnKey="x" code="KeyX" color="rgba(255,200,40,0.35)" />
        </div>
      </div>
    </div>
  );

  // ── Full-screen Lobby Overlay ─────────────────────────────────────────────────
  const isHost = lobbyRoom?.host_id === sessionUserId;
  const guestJoined = !!lobbyRoom?.guest_id;
  const canStart = isHost && guestJoined;

  const lobbyGame = VS_GAMES.find(g => g.name === (lobbyRoom?.game_name ?? "")) ?? VS_GAMES[0];
  const roomLink = typeof window !== "undefined" ? window.location.origin + "/emulator" : "/emulator";

  function copyLobbyLink() {
    navigator.clipboard.writeText(`${roomLink}?joinRoom=${lobbyRoom?.id}`).catch(() => {});
    playCopySound();
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  const lobbyOverlayJSX = lobbyRoom && !lobbyRoom.game_started && !lobbyMinimized && (
      <div style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "linear-gradient(135deg, #0a0a14 0%, #0d0d1e 100%)",
        display: "flex", flexDirection: "column",
        fontFamily: "var(--font-geist-sans, sans-serif)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 24px", borderBottom: "1px solid rgba(124,92,191,0.2)",
          background: "rgba(124,92,191,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 20 }}>⚔</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "var(--text-primary, #fff)" }}>VS Lobby</div>
              <div style={{ fontSize: 11, color: "var(--text-muted, #888)" }}>Room · {lobbyRoom.id}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {lobbyRoom.ranked
              ? <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-purple-bright, #a78bfa)", background: "rgba(124,92,191,0.15)", borderRadius: 20, padding: "3px 10px" }}>🏆 Ranked</span>
              : <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted, #888)", background: "rgba(90,90,128,0.15)", borderRadius: 20, padding: "3px 10px" }}>🎮 Unranked</span>
            }
            <InviteViaDm gameTag="snes" gameId={lobbyRoom?.id ?? ""} label="📨 Invite" />
            <button onClick={() => setLobbyMinimized(true)} title="Minimize lobby" style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8, padding: "6px 12px", color: "rgba(255,255,255,0.6)",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>— Minimize</button>
            {lobbyRoom.host_id === sessionUserId ? (
              <button onClick={closeHostRoom} style={{
                background: "rgba(220,60,60,0.15)", border: "1px solid rgba(220,60,60,0.3)",
                borderRadius: 8, padding: "6px 14px", color: "#f08080",
                fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}>Close Room ✕</button>
            ) : (
              <button onClick={leaveLobbyRoom} style={{
                background: "rgba(220,60,60,0.15)", border: "1px solid rgba(220,60,60,0.3)",
                borderRadius: 8, padding: "6px 14px", color: "#f08080",
                fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}>Leave ✕</button>
            )}
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          {/* Left: Players + Game */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 24, gap: 24 }}>
            {/* Player cards */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 32 }}>
              {/* Host */}
              <div style={{
                textAlign: "center", background: "rgba(124,92,191,0.08)",
                border: "2px solid rgba(124,92,191,0.4)", borderRadius: 16,
                padding: "20px 28px", minWidth: 160,
              }}>
                <img
                  src={lobbyRoom.host_avatar || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${lobbyRoom.host_username}`}
                  alt="" style={{ width: 72, height: 72, borderRadius: 14, border: "3px solid var(--accent-purple, #7c5cbf)", marginBottom: 10 }}
                />
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary, #fff)", marginBottom: 4 }}>@{lobbyRoom.host_username}</div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--accent-purple-bright, #a78bfa)", background: "rgba(124,92,191,0.15)", borderRadius: 10, padding: "2px 8px", display: "inline-block" }}>
                  ⚡ HOST
                </div>
              </div>

              {/* VS */}
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 32, fontWeight: 900, color: "rgba(255,255,255,0.15)", letterSpacing: 4 }}>VS</div>
              </div>

              {/* Guest / P2 slot */}
              <div style={{
                textAlign: "center", position: "relative",
                background: guestJoined ? "rgba(74,144,217,0.08)" : "rgba(255,255,255,0.03)",
                border: `2px solid ${guestJoined ? "rgba(74,144,217,0.4)" : "rgba(124,92,191,0.25)"}`,
                borderRadius: 16, padding: "20px 28px", minWidth: 180,
                transition: "all 0.3s",
              }}>
                {guestJoined ? (
                  <>
                    <img
                      src={lobbyRoom.guest_avatar || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${lobbyRoom.guest_username}`}
                      alt="" style={{ width: 72, height: 72, borderRadius: 14, border: "3px solid #4a90d9", marginBottom: 10 }}
                    />
                    <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary, #fff)", marginBottom: 4 }}>@{lobbyRoom.guest_username}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#4a90d9", background: "rgba(74,144,217,0.15)", borderRadius: 10, padding: "2px 8px", display: "inline-block", marginBottom: isHost ? 12 : 0 }}>
                      🎮 P2
                    </div>
                    {/* Host can boot P2 */}
                    {isHost && (
                      <div>
                        <button
                          onClick={bootGuest}
                          disabled={bootingGuest}
                          style={{
                            background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
                            borderRadius: 7, padding: "4px 12px", color: "#f87171",
                            fontSize: 10, fontWeight: 700, cursor: "pointer",
                            transition: "all 0.2s",
                          }}
                        >{bootingGuest ? "…" : "✕ Boot"}</button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* Big "+" button — host sees invite dropdown, others see "Join as P2" */}
                    <div style={{ position: "relative", display: "inline-block" }}>
                      <button
                        onClick={() => {
                          if (isHost) {
                            setShowInviteDropdown(v => !v);
                            playSwoopSound();
                          } else {
                            claimP2();
                          }
                        }}
                        style={{
                          width: 72, height: 72, borderRadius: "50%",
                          border: "2.5px dashed rgba(124,92,191,0.6)",
                          background: showInviteDropdown ? "rgba(124,92,191,0.22)" : "rgba(124,92,191,0.08)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 28, color: "#a78bfa", cursor: "pointer",
                          transition: "all 0.18s cubic-bezier(.34,1.56,.64,1)",
                          transform: showInviteDropdown ? "scale(1.12) rotate(45deg)" : "scale(1)",
                          boxShadow: showInviteDropdown ? "0 0 24px rgba(124,92,191,0.4)" : "none",
                          outline: "none", marginBottom: 10,
                          animation: "pulse 2.5s ease-in-out infinite",
                        }}
                      >+</button>

                      {/* Invite dropdown — only for host */}
                      {isHost && showInviteDropdown && (
                        <div style={{
                          position: "absolute", top: "calc(100% + 12px)", left: "50%",
                          transform: "translateX(-50%)",
                          background: "#13131f", border: "1px solid rgba(124,92,191,0.35)",
                          borderRadius: 14, padding: 14, width: 220, zIndex: 100,
                          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                          animation: "slideDown 0.18s cubic-bezier(.34,1.56,.64,1)",
                        }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: "#a78bfa", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
                            🎮 Invite a Friend
                          </div>
                          <div style={{ maxHeight: 160, overflowY: "auto", marginBottom: 10 }}>
                            {inviteFriends.length === 0 ? (
                              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", padding: "6px 0", textAlign: "center" }}>No friends online</div>
                            ) : inviteFriends.map(f => {
                              const sent = invitedIds.has(f.id);
                              return (
                                <div key={f.id} style={{
                                  display: "flex", alignItems: "center", gap: 8,
                                  padding: "6px 4px", borderRadius: 8,
                                  transition: "background 0.15s",
                                }}>
                                  <img src={f.avatar_url ?? `https://api.dicebear.com/9.x/pixel-art/svg?seed=${f.username}`}
                                    alt="" style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0 }} />
                                  <span style={{ flex: 1, fontSize: 12, color: "#e8eaf6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>
                                    @{f.username}
                                  </span>
                                  <button
                                    onClick={() => { sendDmInvite(f.id); }}
                                    disabled={!!inviteSending || sent}
                                    style={{
                                      background: sent ? "rgba(74,222,128,0.2)" : "rgba(124,92,191,0.35)",
                                      border: `1px solid ${sent ? "rgba(74,222,128,0.4)" : "rgba(124,92,191,0.5)"}`,
                                      borderRadius: 6, padding: "3px 10px",
                                      color: sent ? "#4ade80" : "#c4b5fd",
                                      fontSize: 11, fontWeight: 700, cursor: sent ? "default" : "pointer",
                                      flexShrink: 0, transition: "all 0.15s",
                                    }}
                                  >{sent ? "✓ Sent" : inviteSending === f.id ? "…" : "Invite"}</button>
                                </div>
                              );
                            })}
                          </div>
                          <InviteViaDm gameTag="snes" gameId={lobbyRoom?.id ?? ""} label="📨 Invite to P2" style={{ width: "100%", fontSize: 11 }} />
                        </div>
                      )}
                    </div>

                    <div style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa", letterSpacing: 0.5 }}>
                      {isHost ? "Invite to P2" : "Join as P2"}
                    </div>
                    {!isHost && (
                      <button
                        onClick={claimP2}
                        disabled={claimingP2}
                        style={{
                          marginTop: 10, background: "rgba(124,92,191,0.25)",
                          border: "1px solid rgba(124,92,191,0.5)", borderRadius: 8,
                          padding: "6px 16px", color: "#c4b5fd",
                          fontSize: 12, fontWeight: 700, cursor: "pointer",
                          transition: "all 0.2s",
                        }}
                      >{claimingP2 ? "Joining…" : "⚡ Claim Slot"}</button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Game selector */}
            <div style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14, padding: "16px 20px",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "rgba(255,255,255,0.4)", marginBottom: 12 }}>Game</div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ fontSize: 28 }}>
                  {lobbyGame.genre === "Fighting" ? "🥊" : lobbyGame.genre === "Sports" ? "⚽" : lobbyGame.genre === "Racing" ? "🏎" : "🎮"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary, #fff)" }}>{lobbyRoom.game_name}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{lobbyGame.genre}</div>
                </div>
                {isHost && (
                  <button onClick={() => setShowGamePicker(v => !v)} style={{
                    background: "rgba(124,92,191,0.15)", border: "1px solid rgba(124,92,191,0.3)",
                    borderRadius: 8, padding: "7px 14px", color: "var(--accent-purple-bright, #a78bfa)",
                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                  }}>Change ▾</button>
                )}
              </div>
              {/* Game picker dropdown */}
              {showGamePicker && isHost && (
                <div style={{
                  marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 6,
                  maxHeight: 200, overflowY: "auto",
                }}>
                  {VS_GAMES.map(g => (
                    <button key={g.name} onClick={() => selectLobbyGame(g.name)} style={{
                      background: lobbyRoom.game_name === g.name ? "rgba(124,92,191,0.25)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${lobbyRoom.game_name === g.name ? "rgba(124,92,191,0.5)" : "rgba(255,255,255,0.08)"}`,
                      borderRadius: 8, padding: "8px 12px", textAlign: "left", cursor: "pointer",
                      color: "var(--text-primary, #fff)", fontSize: 12, fontWeight: lobbyRoom.game_name === g.name ? 700 : 400,
                    }}>
                      {g.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Start button */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              {isHost ? (
                <>
                  <button
                    onClick={startLobbyGame}
                    disabled={!canStart || startingGame}
                    style={{
                      background: canStart
                        ? "linear-gradient(135deg, #4caf7d, #2e7d52)"
                        : "rgba(255,255,255,0.05)",
                      border: `1px solid ${canStart ? "rgba(76,175,125,0.5)" : "rgba(255,255,255,0.1)"}`,
                      borderRadius: 12, padding: "14px 48px",
                      color: canStart ? "#fff" : "rgba(255,255,255,0.3)",
                      fontSize: 16, fontWeight: 900, cursor: canStart ? "pointer" : "not-allowed",
                      letterSpacing: 1,
                      boxShadow: canStart ? "0 0 24px rgba(76,175,125,0.3)" : "none",
                      transition: "all 0.2s",
                    }}
                  >
                    {startingGame ? "Starting…" : "▶ START GAME"}
                  </button>
                  {!canStart && (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
                      Waiting for opponent to join…
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", padding: "14px 0" }}>
                  {canStart ? "⏳ Waiting for host to start…" : "Waiting for host…"}
                </div>
              )}
            </div>
          </div>

          {/* Right: Chat */}
          <div style={{
            width: 300, borderLeft: "1px solid rgba(255,255,255,0.06)",
            display: "flex", flexDirection: "column",
          }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1 }}>
              Lobby Chat
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              {lobbyMessages.length === 0 ? (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: 20 }}>No messages yet</div>
              ) : lobbyMessages.map(msg => (
                <div key={msg.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <img src={msg.avatar_url || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${msg.username}`}
                    alt="" style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: msg.user_id === sessionUserId ? "var(--accent-purple-bright, #a78bfa)" : "rgba(255,255,255,0.6)", marginRight: 6 }}>
                      @{msg.username}
                    </span>
                    <span style={{ fontSize: 13, color: "var(--text-primary, #fff)" }}>{msg.content}</span>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8 }}>
              <input
                value={lobbyInput}
                onChange={e => setLobbyInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendLobbyMessage(); } }}
                placeholder="Say something…"
                style={{
                  flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8, padding: "8px 12px", color: "var(--text-primary, #fff)", fontSize: 13, outline: "none",
                }}
              />
              <button
                onClick={sendLobbyMessage}
                disabled={!lobbyInput.trim() || sendingMsg}
                style={{
                  background: "rgba(124,92,191,0.25)", border: "1px solid rgba(124,92,191,0.4)",
                  borderRadius: 8, padding: "8px 14px", color: "var(--accent-purple-bright, #a78bfa)",
                  fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}
              >Send</button>
            </div>
          </div>
        </div>
      </div>
  );

  // ─── Main render ─────────────────────────────────────────────────────────────

  return (
    <>
      {/* Full-screen lobby overlay */}
      {lobbyOverlayJSX}

      {/* Minimized lobby pill */}
      {lobbyRoom && !lobbyRoom.game_started && lobbyMinimized && (
        <div
          onClick={() => setLobbyMinimized(false)}
          style={{
            position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
            zIndex: 9001,
            background: "rgba(13,15,20,0.97)", backdropFilter: "blur(16px)",
            border: "1px solid rgba(124,92,191,0.4)", borderRadius: 40,
            padding: "10px 20px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 10,
            boxShadow: "0 8px 40px rgba(124,92,191,0.3)",
            animation: "ringIn 0.3s ease",
          }}
        >
          <span style={{ fontSize: 16 }}>⚔</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>VS Lobby — {lobbyRoom.game_name}</div>
            <div style={{ fontSize: 11, color: "#a78bfa" }}>
              {lobbyRoom.guest_id ? `vs @${lobbyRoom.guest_username}` : "Waiting for opponent…"}
            </div>
          </div>
          <span style={{ fontSize: 11, background: "rgba(124,92,191,0.2)", borderRadius: 8, padding: "3px 8px", color: "#a78bfa", fontWeight: 700 }}>↑ Open</span>
        </div>
      )}

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 14px 80px" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, background: "linear-gradient(135deg, #4a90d9, var(--accent-purple))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              🎮 SNES Arcade
            </h1>
            <a href="/messages" style={{ marginLeft: "auto", fontSize: 12, background: "rgba(124,92,191,0.15)", border: "1px solid rgba(124,92,191,0.3)", color: "var(--accent-purple-bright)", borderRadius: 8, padding: "4px 10px", textDecoration: "none", fontWeight: 700 }}>
              💬 Messages
            </a>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
            Play classics in your browser. Challenge friends in VS lobbies. Compete on the leaderboard.
          </p>
        </div>

        {/* Active emulator */}
        {activeRom && (
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>▶ Now Playing: {activeRom.name}</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {isNetplayMode && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
                    background: isRanked ? "rgba(124,92,191,0.2)" : "rgba(90,90,128,0.15)",
                    color: isRanked ? "var(--accent-purple-bright)" : "var(--text-muted)",
                    border: `1px solid ${isRanked ? "rgba(124,92,191,0.4)" : "var(--border)"}`,
                  }}>
                    {isRanked ? "🏆 Ranked" : "🎮 Unranked"}
                  </span>
                )}
                <button onClick={enterFullscreen} style={{ background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 7, padding: "5px 12px", fontSize: 11, cursor: "pointer" }}>
                  ⛶ Fullscreen
                </button>
                {saveStateAvailable && !emuLoading && (
                  <button onClick={() => loadSaveState(activeRom.name)} style={{ background: "rgba(74,144,217,0.15)", color: "#4a90d9", border: "1px solid rgba(74,144,217,0.4)", borderRadius: 7, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    ▶ Load Save
                  </button>
                )}
                <button onClick={closeGame} style={{ background: "rgba(220,60,60,0.15)", color: "#f08080", border: "1px solid rgba(220,60,60,0.4)", borderRadius: 7, padding: "5px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  ⏹ Stop Game
                </button>
              </div>
            </div>
            <div style={fsMode ? {
              position: "fixed", inset: 0, zIndex: 9998, background: "#000", overflow: "hidden",
            } : {
              position: "relative", width: "100%", aspectRatio: "4/3", background: "#000", borderRadius: "0 0 12px 12px", overflow: "hidden",
            }}>
              <div ref={emulatorContainerRef} style={{ width: "100%", height: "100%" }} />
              {fps !== null && !emuLoading && (
                <div style={{
                  position: "absolute", top: 8, left: 8, zIndex: 9999,
                  background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
                  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "3px 8px",
                  fontSize: 11, fontWeight: 800, fontFamily: "monospace",
                  color: fps >= 55 ? "#4caf7d" : fps >= 40 ? "#f0b429" : "#e05555",
                  pointerEvents: "none", letterSpacing: "0.5px", userSelect: "none",
                }}>
                  {fps} FPS
                </div>
              )}
              {isNetplayMode && !emuLoading && (
                <div style={{
                  position: "absolute", top: 8, right: 8, zIndex: 9999,
                  background: netplayStatus === "connected" ? "rgba(76,175,125,0.85)" : "rgba(0,0,0,0.75)",
                  backdropFilter: "blur(4px)", border: `1px solid ${netplayStatus === "connected" ? "#4caf7d" : "rgba(124,92,191,0.6)"}`,
                  borderRadius: 6, padding: "3px 9px",
                  fontSize: 10, fontWeight: 800, fontFamily: "monospace",
                  color: netplayStatus === "connected" ? "#fff" : "var(--accent-purple-bright)",
                  pointerEvents: "none", letterSpacing: "0.5px",
                }}>
                  {npConnected ? `🔗 P2P ${npPing !== null ? npPing+"ms" : ""}` : netplayStatus === "connected" ? "🔗 RELAY" : netplayStatus === "waiting" ? "⏳ CONNECTING" : "🔗 NETPLAY"}
                </div>
              )}
              {emuLoading && (
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.92)", gap: 20, zIndex: 10, padding: 32 }}>
                  <div style={{ fontSize: 16, color: "#fff", fontWeight: 700 }}>Loading {activeRom.name}…</div>
                  <div style={{ width: 36, height: 36, border: "3px solid rgba(124,92,191,0.3)", borderTop: "3px solid var(--accent-purple)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Downloading &amp; starting emulator…</div>
                </div>
              )}
              {fsMode && <MobileTouchControls />}
            </div>

            {/* Netplay panel */}
            {isNetplayMode && netplayRoom && !emuLoading && (
              <div style={{ padding: "14px 16px", background: "rgba(124,92,191,0.06)", borderTop: "1px solid rgba(124,92,191,0.2)", borderRadius: "0 0 12px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--accent-purple-bright)", marginBottom: 3 }}>🔗 Netplay Room</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 900, letterSpacing: 4, color: "var(--text-primary)", background: "var(--bg-elevated)", padding: "4px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
                        {netplayRoom}
                      </span>
                      <button onClick={copyRoomId} style={{ background: copied ? "var(--accent-green)" : "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 7, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", color: copied ? "#fff" : "var(--text-muted)" }}>
                        {copied ? "✓ Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                  <div style={{ height: 40, width: 1, background: "var(--border)" }} />
                  <div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 3 }}>Your Role</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: netplayRole === "host" ? "var(--accent-green)" : "var(--accent-blue)" }}>
                      {netplayRole === "host" ? "⚡ Player 1 (Host)" : "🎮 Player 2 (Join)"}
                    </div>
                  </div>
                  <div style={{ height: 40, width: 1, background: "var(--border)" }} />
                  <div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 3 }}>Sync</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: npConnected ? "#4caf7d" : "#4caf7d" }}>
                      {npConnected ? `🔗 P2P` : `⚡ Relay`}
                      {npPing !== null && <span style={{ color: npPing < 60 ? "#4caf7d" : npPing < 120 ? "#ffd700" : "#f08080", marginLeft: 6 }}>{npPing}ms</span>}
                    </div>
                  </div>
                </div>
                {isInRoom && !roomCompleted && (
                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {isRanked ? "🏆 Ranked match — report result when done" : "🎮 Unranked — no ELO at stake"}
                    </div>
                    {isRanked && (
                      <button onClick={() => setReportModal(true)} style={{ background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))", color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        Report Result
                      </button>
                    )}
                  </div>
                )}
                {roomCompleted && (
                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12, padding: 12, background: "var(--bg-elevated)", borderRadius: 10, border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 28 }}>{iWon ? "🏆" : iLost ? "💀" : "🤝"}</div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: iWon ? "#4ad990" : iLost ? "#f08080" : "var(--accent-purple-bright)" }}>
                        {iWon ? "Victory!" : iLost ? "Defeat" : "Draw!"}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {isRanked ? `${getGameFranchise(activeRom.name).toUpperCase()} ELO updated` : "Unranked — no ELO change"}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20 }}>
          <div>
            {/* ROM Browser */}
            <div className="panel" style={{ marginBottom: 16 }}>
              <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>ROM Library</span>
                {hasSnesAccess && (
                  <button onClick={() => fileRef.current?.click()} style={{ background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))", color: "#fff", border: "none", borderRadius: 7, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    + Load ROM File
                  </button>
                )}
              </div>
              {!hasSnesAccess ? (
                <div style={{ padding: "32px 20px", textAlign: "center" }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>SNES Access Required</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 320, margin: "0 auto" }}>
                    {sessionUserId
                      ? "Your account hasn't been granted SNES access yet. Ask a moderator to unlock it on your profile."
                      : "Sign in and request SNES access from a moderator to play."}
                  </div>
                </div>
              ) : (
              <div style={{ padding: 14 }}>
                <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, position: "relative", minWidth: 160 }}>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search games..."
                      style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 12px 7px 32px", color: "var(--text-primary)", fontSize: 12, outline: "none", boxSizing: "border-box" }} />
                    <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "var(--text-muted)" }}>🔍</span>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {GENRES.map(g => (
                      <button key={g} onClick={() => setGenre(g)} style={{
                        background: genre === g ? "rgba(124,92,191,0.2)" : "var(--bg-elevated)",
                        color: genre === g ? "var(--accent-purple-bright)" : "var(--text-muted)",
                        border: `1px solid ${genre === g ? "rgba(124,92,191,0.5)" : "var(--border)"}`,
                        borderRadius: 6, padding: "4px 8px", fontSize: 10, fontWeight: genre === g ? 700 : 400, cursor: "pointer",
                      }}>{g}</button>
                    ))}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
                  {filtered.map((game, i) => {
                    const gradients = [
                      "linear-gradient(135deg, #1a0a2e, #3d1b6e)", "linear-gradient(135deg, #0a1a2e, #1b3d6e)",
                      "linear-gradient(135deg, #2e1a0a, #6e3d1b)", "linear-gradient(135deg, #0a2e1a, #1b6e3d)",
                      "linear-gradient(135deg, #2e0a2e, #6e1b5e)", "linear-gradient(135deg, #0a2e2e, #1b5e6e)",
                    ];
                    const franchise = getGameFranchise(game.name);
                    return (
                      <div key={game.name} onClick={() => {
                          if (game.romUrl) loadRomUrl(game.romUrl, game.name);
                          else { (fileRef.current as HTMLInputElement & { dataset: { gamename?: string } })!.dataset.gamename = game.name; fileRef.current?.click(); }
                        }}
                        style={{ background: gradients[i % gradients.length], borderRadius: 10, padding: 12, cursor: "pointer", border: "1px solid rgba(255,255,255,0.06)", transition: "transform 0.1s, box-shadow 0.1s", position: "relative" }}
                        className="game-card"
                      >
                        <div style={{ fontSize: 24, marginBottom: 8, textAlign: "center" }}>
                          {game.genre === "Fighting" ? "🥊" : game.genre === "Sports" ? "⚽" : game.genre === "Racing" ? "🏎" : game.genre === "RPG" ? "⚔" : game.genre === "Adventure" ? "🗺" : "🎮"}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 4, lineHeight: 1.3 }}>{game.name}</div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>{game.genre}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          {game.players === 2 && (
                            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.1)", borderRadius: 4, padding: "2px 5px" }}>2P</div>
                          )}
                          {game.genre === "Fighting" && (
                            <div style={{ fontSize: 9, color: franchise === "sf" ? "#4a90d9" : franchise === "mk" ? "#d94a4a" : "rgba(255,255,255,0.6)", background: "rgba(0,0,0,0.3)", borderRadius: 4, padding: "2px 5px", fontWeight: 700 }}>
                              {franchise === "sf" ? "SF ELO" : franchise === "mk" ? "MK ELO" : "ELO"}
                            </div>
                          )}
                        </div>
                        <div style={{ position: "absolute", bottom: 8, right: 8, fontSize: 9, color: "rgba(255,255,255,0.7)", background: game.romUrl ? "rgba(74,144,217,0.5)" : "rgba(0,0,0,0.4)", borderRadius: 4, padding: "2px 5px" }}>
                          {game.romUrl ? "▶ Play" : "+ Upload"}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 14, padding: 12, background: "rgba(74,144,217,0.08)", borderRadius: 8, border: "1px solid rgba(74,144,217,0.2)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-blue)", marginBottom: 4 }}>How to play</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                    Click any <strong style={{ color: "var(--accent-blue)" }}>▶ Play</strong> game to stream it. Arrow keys=D-pad, Z=A, X=B, Enter=Start. F1/F2=Save/Load.
                  </div>
                </div>
              </div>
              )}
            </div>

            {/* VS Rooms */}
            {sessionUserId && (
              <div className="panel">
                <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>⚔ VS Rooms</span>
                  <button
                    onClick={() => createLobbyRoom(VS_GAMES[0].name, lobbyRanked)}
                    disabled={creatingRoom}
                    style={{ background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))", color: "#fff", border: "none", borderRadius: 7, padding: "5px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                  >
                    {creatingRoom ? "Creating…" : "+ Create Room"}
                  </button>
                </div>
                <div style={{ padding: 12 }}>
                  {rooms.filter(r => r.status !== "completed" && !r.game_started).length === 0 ? (
                    <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "16px 0" }}>
                      No open rooms. Create one and invite a friend!
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {rooms.filter(r => r.status !== "completed" && !r.game_started).map(room => (
                        <div key={room.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--bg-elevated)", borderRadius: 8, padding: "10px 12px" }}>
                          <img src={room.host_avatar || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${room.host_username}`}
                            alt="" style={{ width: 32, height: 32, borderRadius: 7, border: "1px solid var(--border)" }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>{room.game_name}</div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                              @{room.host_username}
                              {room.guest_username ? ` vs @${room.guest_username}` : " · Waiting"}
                              {" · "}{room.ranked !== false ? "🏆 Ranked" : "🎮 Unranked"}
                            </div>
                          </div>
                          {room.host_id !== sessionUserId && !room.guest_id && (
                            <button onClick={() => joinLobbyRoom(room.id)} style={{ background: "var(--accent-purple)", color: "#fff", border: "none", borderRadius: 7, padding: "6px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                              Join
                            </button>
                          )}
                          {room.host_id === sessionUserId && (
                            <button onClick={() => { setLobbyRoom(room); startLobbyPoll(room.id); }} style={{ background: "rgba(124,92,191,0.2)", color: "var(--accent-purple-bright)", border: "1px solid rgba(124,92,191,0.3)", borderRadius: 7, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                              Open
                            </button>
                          )}
                          {(room.host_id === sessionUserId || room.guest_id === sessionUserId) && (
                            <button
                              onClick={() => closeRoom(room.id)}
                              disabled={closingRoomId === room.id}
                              title="Close room"
                              style={{ background: "rgba(220,60,60,0.15)", color: "#f08080", border: "1px solid rgba(220,60,60,0.3)", borderRadius: 6, width: 26, height: 26, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                            >✕</button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: Leaderboard + Controller */}
          <div>
            <div className="panel" style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", borderBottom: "1px solid var(--border)", padding: "0 10px" }}>
                {(["general", "sf", "mk"] as const).map(tab => (
                  <button key={tab} onClick={() => setLbTab(tab)} style={{
                    flex: 1, padding: "8px 4px", background: "none", border: "none",
                    borderBottom: lbTab === tab ? "2px solid var(--accent-purple)" : "2px solid transparent",
                    color: lbTab === tab ? "var(--accent-purple-bright)" : "var(--text-muted)",
                    fontSize: 10, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: 0.5,
                  }}>
                    {tab === "general" ? "🕹 All" : tab === "sf" ? "🥊 SF" : "💀 MK"}
                  </button>
                ))}
              </div>
              <div style={{ padding: 10 }}>
                {currentLb.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "12px 0" }}>
                    No games yet! Create a VS room to get on the board.
                  </div>
                ) : (
                  currentLb.map((entry, i) => (
                    <LbRow key={entry.id} entry={entry} i={i} ratingKey={lbRatingKey} winsKey={lbWinsKey} lossesKey={lbLossesKey} />
                  ))
                )}
              </div>
            </div>

            <div style={{ padding: 14, background: "rgba(124,92,191,0.06)", border: "1px solid rgba(124,92,191,0.2)", borderRadius: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-purple-bright)", marginBottom: 10 }}>Controller Setup</div>
              <div style={{ marginBottom: 12 }}><GamepadMapper /></div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.8 }}>
                <div>Arrow keys — D-Pad</div>
                <div>Z — A button</div>
                <div>X — B button</div>
                <div>A — X button</div>
                <div>S — Y button</div>
                <div>Q — L shoulder</div>
                <div>W — R shoulder</div>
                <div>Enter — Start</div>
                <div>Shift — Select</div>
                <div>F1 — Save state</div>
                <div>F2 — Load state</div>
              </div>
              <div style={{ marginTop: 10 }}>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                  background: gamepadConnected ? "rgba(76,175,125,0.15)" : "rgba(90,90,128,0.15)",
                  border: `1px solid ${gamepadConnected ? "var(--accent-green)" : "var(--border)"}`,
                  color: gamepadConnected ? "var(--accent-green)" : "var(--text-muted)",
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: gamepadConnected ? "var(--accent-green)" : "var(--text-muted)", display: "inline-block", boxShadow: gamepadConnected ? "0 0 6px var(--accent-green)" : "none" }} />
                  {gamepadConnected ? "🎮 Controller connected!" : "No controller detected"}
                </div>
                {!gamepadConnected && (
                  <div style={{ fontSize: 10, color: "#f0b429", marginTop: 4 }}>Already connected? Press any button on your controller.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Hidden file input */}
        <input ref={fileRef} type="file" accept=".sfc,.smc,.zip,.snes" style={{ display: "none" }}
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) {
              const gameName = (fileRef.current as HTMLInputElement & { dataset: { gamename?: string } })?.dataset?.gamename;
              loadRomFile(file, gameName);
            }
            e.target.value = "";
          }}
        />

        {/* Save state exit dialog */}
        {showExitDialog && activeRom && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10001 }}>
            <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 360, textAlign: "center", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>💾</div>
              <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6, color: "var(--text-primary)" }}>Save before leaving?</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>{activeRom.name}</div>
              {getSaveInfo(activeRom.name) && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 16, padding: "5px 10px", background: "var(--bg-elevated)", borderRadius: 8, display: "inline-block" }}>
                  Last save: {new Date(getSaveInfo(activeRom.name)!.savedAt).toLocaleString()}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
                <button
                  onClick={() => { captureAndSaveState(activeRom.name); closeGameImmediately(); }}
                  style={{ background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))", color: "#fff", border: "none", borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  💾 Save &amp; Exit
                </button>
                <button
                  onClick={() => closeGameImmediately()}
                  style={{ background: "rgba(220,60,60,0.15)", color: "#f08080", border: "1px solid rgba(220,60,60,0.4)", borderRadius: 10, padding: "12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  🚪 Exit Without Saving
                </button>
                <button
                  onClick={() => setShowExitDialog(false)}
                  style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", padding: "6px" }}>
                  ✕ Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Report result modal */}
        {reportModal && activeRoom && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}>
            <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 24, width: "100%", maxWidth: 360, textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>Report Result</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>Both players must agree. If you disagree, no ELO changes.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button onClick={() => reportResult(sessionUserId)} disabled={reporting}
                  style={{ background: "rgba(74,217,144,0.15)", color: "#4ad990", border: "1px solid rgba(74,217,144,0.4)", borderRadius: 9, padding: "12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  I Won 🏆
                </button>
                <button onClick={() => {
                  const opId = activeRoom.host_id === sessionUserId
                    ? (activeRoom as unknown as Record<string, string>).guest_id
                    : activeRoom.host_id;
                  reportResult(opId);
                }} disabled={reporting}
                  style={{ background: "rgba(240,128,128,0.15)", color: "#f08080", border: "1px solid rgba(240,128,128,0.4)", borderRadius: 9, padding: "12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  I Lost 💀
                </button>
                <button onClick={() => reportResult(null)} disabled={reporting}
                  style={{ background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 9, padding: "12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Draw 🤝
                </button>
                <button onClick={() => setReportModal(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
