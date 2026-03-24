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
import StashPanel from "@/app/components/StashPanel";
import VendorPanel from "@/app/components/VendorPanel";
import HeraldPanel from "@/app/components/HeraldPanel";
import CharacterPanel from "@/app/components/CharacterPanel";
import {
  MOONHAVEN_NPCS, MOONHAVEN_BUILDINGS, MOONHAVEN_SPAWN,
  MOONHAVEN_ZONES, MOONHAVEN_DIALOGUE, type MoonhavenNPC,
} from "./npcData";

// ── Re-use town player shape ──────────────────────────────────────────────────
interface TownPlayer {
  user_id: string;
  username: string;
  avatar_url: string;
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

interface Props {
  userId: string;
  username: string;
  avatarUrl: string;
  partyId?: string | null;
}

const TAG_GAME_DURATION = 120;
const NPC_VOICE_PATH = "/audio/npc";
const MOONHAVEN_WS_ROOM = "moonhaven-town";

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
  canvas.width = 256; canvas.height = 48;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 256, 48);
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.roundRect(4, 6, 248, 36, 8);
  ctx.fill();
  ctx.font = "bold 18px monospace";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name.length > 16 ? name.slice(0, 14) + "…" : name, 128, 24);
  return canvas;
}

// ── Chat bubble canvas ─────────────────────────────────────────────────────────
function makeChatCanvas(text: string): HTMLCanvasElement {
  const maxLen = 30;
  const display = text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
  const canvas = document.createElement("canvas");
  canvas.width = 280; canvas.height = 60;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(240,240,255,0.93)";
  ctx.strokeStyle = "#9977cc";
  ctx.lineWidth = 2;
  ctx.roundRect(4, 4, 272, 52, 12);
  ctx.fill();
  ctx.stroke();
  ctx.font = "bold 15px sans-serif";
  ctx.fillStyle = "#220044";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(display, 140, 30);
  return canvas;
}

export default function MoonhavenClient({ userId, username, avatarUrl, partyId }: Props) {
  const router = useRouter();
  const mountRef = useRef<HTMLDivElement>(null);
  const partyIdRef = useRef<string | null>(partyId ?? null);

  // ── Loading ───────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [loadMsg, setLoadMsg] = useState("Entering Moonhaven…");

  // ── Chat ──────────────────────────────────────────────────────────────────
  const [chatInput, setChatInput] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [nearbyPlayers, setNearbyPlayers] = useState<TownPlayer[]>([]);
  const [playerCount, setPlayerCount] = useState(1);

  // ── NPC dialogue ──────────────────────────────────────────────────────────
  const [activeNPC, setActiveNPC] = useState<{ npc: MoonhavenNPC; line: string } | null>(null);
  const npcVoiceIndexRef = useRef<Record<string, number>>({});
  const npcDialogueCooldownRef = useRef<Record<string, number>>({});

  // ── Party ─────────────────────────────────────────────────────────────────
  const [myParty, setMyParty] = useState<{ id: string; members: { userId: string; username: string }[] } | null>(null);

  // ── Economy ───────────────────────────────────────────────────────────────
  const [myCoins, setMyCoins] = useState(0);

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

  // ── Tag game ──────────────────────────────────────────────────────────────
  const [tagItId, setTagItId] = useState<string | null>(null);
  const [tagMsg, setTagMsg] = useState<string | null>(null);
  const [tagGameActive, setTagGameActive] = useState(false);
  const [tagTimeLeft, setTagTimeLeft] = useState(TAG_GAME_DURATION);
  const tagTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tagItIdRef = useRef<string | null>(null);
  const tagGameActiveRef = useRef(false);

  // ── Zone ─────────────────────────────────────────────────────────────────
  const [currentZone, setCurrentZone] = useState("plaza");

  // ── WS / Three.js refs ────────────────────────────────────────────────────
  const townSocketRef = useRef<{ send: (d: string) => void; close: () => void; readyState: number } | null>(null);
  const rendererRef = useRef<import("three").WebGLRenderer | null>(null);
  const sceneRef = useRef<import("three").Scene | null>(null);
  const cameraRef = useRef<import("three").PerspectiveCamera | null>(null);
  const playerMeshRef = useRef<import("three").Group | null>(null);
  const playerPosRef = useRef<[number, number, number]>([...MOONHAVEN_SPAWN]);
  const otherMeshesRef = useRef<Map<string, import("three").Group>>(new Map());
  const npcMeshesRef = useRef<Map<string, import("three").Group>>(new Map());
  const clockRef = useRef<import("three").Clock | null>(null);
  const frameIdRef = useRef<number>(0);
  const keysRef = useRef<Set<string>>(new Set());
  const targetPosRef = useRef<[number, number, number] | null>(null);
  // Camera orbit state
  const camOrbitRef = useRef({ theta: 0.8, phi: Math.PI / 5, radius: 16, dragging: false, lastX: 0, lastY: 0 });

  // ── Load economy on mount ─────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/town-economy?action=get")
      .then(r => r.json())
      .then(d => { if (d.coins !== undefined) setMyCoins(d.coins); })
      .catch(() => {});
  }, []);

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
    } else if (npc.interaction === "adventure" || npc.hostile) {
      const mission = generateMission(npc.id, Date.now(), "moonhaven");
      setActiveMission(mission);
      setTimeout(() => setShowAdventure(true), 1000);
    }

    setTimeout(() => setActiveNPC(null), 4000);
  }, [playNPCVoice]);

  // ── WebSocket (PartyKit) ───────────────────────────────────────────────────
  useEffect(() => {
    let ws: { send: (d: string) => void; close: () => void; readyState: number } | null = null;
    let pollTimer: ReturnType<typeof setInterval>;

    const connect = async () => {
      const { PartySocket } = await import("partysocket");
      ws = new PartySocket({
        host: process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999",
        room: partyIdRef.current ? `party-${partyIdRef.current}` : MOONHAVEN_WS_ROOM,
      }) as unknown as typeof ws;
      townSocketRef.current = ws;

      (ws as unknown as { onmessage: (e: MessageEvent) => void }).onmessage = (e: MessageEvent) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "player_update" && msg.player?.user_id !== userId) {
            updateOtherPlayer(msg.player);
          } else if (msg.type === "player_leave") {
            removeOtherPlayer(msg.userId);
          } else if (msg.type === "chat" && msg.userId !== userId) {
            showRemoteChat(msg.userId, msg.text);
          }
        } catch { /* ignore */ }
      };
    };

    const sendPosition = () => {
      const [px, , pz] = playerPosRef.current;
      const payload = JSON.stringify({
        type: "player_update",
        player: {
          user_id: userId,
          username,
          avatar_url: avatarUrl,
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
      pollTimer = setInterval(sendPosition, 2000);
    });

    return () => {
      ws?.close();
      clearInterval(pollTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, username, avatarUrl]);

  // ── Three.js scene setup ───────────────────────────────────────────────────
  useEffect(() => {
    if (!mountRef.current) return;
    let destroyed = false;
    let THREE: ThreeModule;
    let GLTFLoader: unknown;

    const init = async () => {
      THREE = await getThree();
      const gltfMod = await import("three/examples/jsm/loaders/GLTFLoader.js").catch(() => null);
      GLTFLoader = gltfMod?.GLTFLoader ?? null;

      if (destroyed || !mountRef.current) return;

      // ── Renderer ──────────────────────────────────────────────────────────
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.85;
      mountRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // ── Scene ─────────────────────────────────────────────────────────────
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0a0820);
      scene.fog = new THREE.Fog(0x0a0820, 45, 90);
      sceneRef.current = scene;

      // ── Camera ────────────────────────────────────────────────────────────
      const camera = new THREE.PerspectiveCamera(
        60, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 200
      );
      cameraRef.current = camera;
      updateCameraOrbit(camera);

      // ── Lights — moonlit night ────────────────────────────────────────────
      const ambient = new THREE.AmbientLight(0x223366, 0.5);
      scene.add(ambient);

      // Moon — cool blue-white directional
      const moon = new THREE.DirectionalLight(0xaabbff, 1.2);
      moon.position.set(20, 40, -10);
      moon.castShadow = true;
      moon.shadow.mapSize.setScalar(2048);
      moon.shadow.camera.near = 1;
      moon.shadow.camera.far = 120;
      moon.shadow.camera.left = -60;
      moon.shadow.camera.right = 60;
      moon.shadow.camera.top = 60;
      moon.shadow.camera.bottom = -60;
      scene.add(moon);

      // Fountain glow — soft blue-white point
      const fountainGlow = new THREE.PointLight(0x88aaff, 2.5, 20);
      fountainGlow.position.set(0, 2, 0);
      scene.add(fountainGlow);

      // Lantern lights (warm orange)
      const lanternPositions: [number, number, number][] = [
        [8, 2.5, 0], [-8, 2.5, 0], [0, 2.5, 8], [0, 2.5, -8],
        [12, 2.5, 12], [-12, 2.5, 12], [12, 2.5, -12], [-12, 2.5, -12],
      ];
      for (const pos of lanternPositions) {
        const lantern = new THREE.PointLight(0xffaa44, 1.2, 12);
        lantern.position.set(...pos);
        scene.add(lantern);
      }

      // ── Ground — cobblestone plaza ────────────────────────────────────────
      const groundGeo = new THREE.PlaneGeometry(120, 120, 24, 24);
      const groundMat = new THREE.MeshStandardMaterial({
        color: 0x3a3835,
        roughness: 0.95,
        metalness: 0.05,
      });
      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);

      // Grass ring beyond plaza
      const grassGeo = new THREE.RingGeometry(56, 90, 48);
      const grassMat = new THREE.MeshStandardMaterial({ color: 0x1a3a18, roughness: 1 });
      const grass = new THREE.Mesh(grassGeo, grassMat);
      grass.rotation.x = -Math.PI / 2;
      grass.position.y = 0.02;
      scene.add(grass);

      // ── Moon Fountain (central) ───────────────────────────────────────────
      buildFountain(THREE, scene);

      // ── Lantern posts ─────────────────────────────────────────────────────
      for (const pos of lanternPositions) {
        buildLanternPost(THREE, scene, pos);
      }

      // ── Buildings ─────────────────────────────────────────────────────────
      for (const bld of MOONHAVEN_BUILDINGS) {
        buildBuilding(THREE, scene, bld);
      }

      // ── Stars backdrop ────────────────────────────────────────────────────
      buildStars(THREE, scene);

      // ── Player mesh ───────────────────────────────────────────────────────
      const playerGroup = await buildBillboard(THREE, avatarUrl, username, 0xffffff);
      playerGroup.position.set(...MOONHAVEN_SPAWN);
      scene.add(playerGroup);
      playerMeshRef.current = playerGroup;
      playerPosRef.current = [...MOONHAVEN_SPAWN];

      // ── NPCs ──────────────────────────────────────────────────────────────
      setLoadMsg("Summoning NPCs…");
      for (const npc of MOONHAVEN_NPCS) {
        const group = await buildNPCBillboard(THREE, npc, GLTFLoader);
        group.position.set(...npc.position);
        scene.add(group);
        npcMeshesRef.current.set(npc.id, group);
      }

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

      // ── Camera orbit (mouse drag) ─────────────────────────────────────────
      const onMouseDown = (e: MouseEvent) => {
        if (e.button !== 2) return; // right-drag to orbit
        camOrbitRef.current.dragging = true;
        camOrbitRef.current.lastX = e.clientX;
        camOrbitRef.current.lastY = e.clientY;
      };
      const onMouseMove = (e: MouseEvent) => {
        if (!camOrbitRef.current.dragging) return;
        const dx = e.clientX - camOrbitRef.current.lastX;
        const dy = e.clientY - camOrbitRef.current.lastY;
        camOrbitRef.current.theta -= dx * 0.005;
        camOrbitRef.current.phi = Math.max(0.15, Math.min(1.2, camOrbitRef.current.phi + dy * 0.005));
        camOrbitRef.current.lastX = e.clientX;
        camOrbitRef.current.lastY = e.clientY;
      };
      const onMouseUp = () => { camOrbitRef.current.dragging = false; };
      const onWheel = (e: WheelEvent) => {
        camOrbitRef.current.radius = Math.max(5, Math.min(40, camOrbitRef.current.radius + e.deltaY * 0.02));
      };
      renderer.domElement.addEventListener("mousedown", onMouseDown);
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      renderer.domElement.addEventListener("wheel", onWheel, { passive: true });
      renderer.domElement.addEventListener("contextmenu", e => e.preventDefault());

      // ── Keyboard ─────────────────────────────────────────────────────────
      const onKeyDown = (e: KeyboardEvent) => {
        keysRef.current.add(e.code);
        if (e.code === "Enter" && !chatOpen) { setChatOpen(true); e.preventDefault(); }
        if (e.code === "Escape") { setChatOpen(false); setActiveNPC(null); }
      };
      const onKeyUp = (e: KeyboardEvent) => { keysRef.current.delete(e.code); };
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);

      // ── Resize ────────────────────────────────────────────────────────────
      const onResize = () => {
        if (!mountRef.current) return;
        const w = mountRef.current.clientWidth;
        const h = mountRef.current.clientHeight;
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

      const animate = () => {
        frameIdRef.current = requestAnimationFrame(animate);
        const dt = Math.min(clock.getDelta(), 0.1);
        const [px, , pz] = playerPosRef.current;

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

        if (keysRef.current.has("KeyW") || keysRef.current.has("ArrowUp")) {
          mx -= camFwd.x; mz -= camFwd.z;
        }
        if (keysRef.current.has("KeyS") || keysRef.current.has("ArrowDown")) {
          mx += camFwd.x; mz += camFwd.z;
        }
        if (keysRef.current.has("KeyA") || keysRef.current.has("ArrowLeft")) {
          mx -= camRight.x; mz -= camRight.z;
        }
        if (keysRef.current.has("KeyD") || keysRef.current.has("ArrowRight")) {
          mx += camRight.x; mz += camRight.z;
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

        const len = Math.sqrt(mx * mx + mz * mz);
        if (len > 0) {
          const newX = Math.max(-55, Math.min(55, px + (mx / len) * speed * dt));
          const newZ = Math.max(-55, Math.min(55, pz + (mz / len) * speed * dt));
          playerPosRef.current = [newX, 0, newZ];
          if (playerMeshRef.current) {
            playerMeshRef.current.position.set(newX, 0, newZ);
            // Face movement direction
            playerMeshRef.current.rotation.y = Math.atan2(mx, mz);
          }
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

        // Fountain glow pulse
        fountainGlow.intensity = 2 + Math.sin(clock.elapsedTime * 1.5) * 0.5;

        renderer.render(scene, camera);
      };

      animate();
      setLoading(false);

      return () => {
        destroyed = true;
        cancelAnimationFrame(frameIdRef.current);
        renderer.domElement.removeEventListener("click", onCanvasClick);
        renderer.domElement.removeEventListener("mousedown", onMouseDown);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        renderer.domElement.removeEventListener("wheel", onWheel);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        window.removeEventListener("resize", onResize);
        renderer.dispose();
        mountRef.current?.removeChild(renderer.domElement);
      };
    };

    const cleanup = init();
    return () => { destroyed = true; cleanup.then(fn => fn?.()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (!group) {
      group = await buildBillboard(THREE, player.avatar_url, player.username, 0x88ffaa);
      scene.add(group);
      otherMeshesRef.current.set(player.user_id, group);
    }
    group.position.set(player.x, 0, player.y);

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
      return [...filtered, player].slice(-20);
    });
    setPlayerCount(c => Math.max(c, otherMeshesRef.current.size + 1));
  }, []);

  const removeOtherPlayer = useCallback((id: string) => {
    const mesh = otherMeshesRef.current.get(id);
    if (mesh && sceneRef.current) {
      sceneRef.current.remove(mesh);
      otherMeshesRef.current.delete(id);
    }
    setNearbyPlayers(prev => prev.filter(p => p.user_id !== id));
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: "relative", width: "100%", height: "100vh", background: "#0a0820", overflow: "hidden", fontFamily: "monospace" }}>
      {/* Three.js canvas mount */}
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />

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

      {/* HUD — top bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px",
        background: "linear-gradient(to bottom, rgba(5,3,20,0.85) 0%, transparent 100%)",
        pointerEvents: "none",
      }}>
        <div style={{ pointerEvents: "all", display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/town" style={{ fontSize: 11, color: "rgba(150,170,255,0.5)", textDecoration: "none", padding: "4px 10px", border: "1px solid rgba(100,120,255,0.2)", borderRadius: 6, background: "rgba(0,0,20,0.5)" }}>
            ← Classic Town
          </Link>
          <div style={{ fontSize: 10, color: "rgba(150,170,255,0.4)" }}>
            {currentZone === "plaza" ? "🌙 Moon Plaza" :
             currentZone === "market" ? "🏪 Market Row" :
             currentZone === "castle" ? "🏰 Castle Aurvale" :
             currentZone === "forest" ? "🌲 Moonwood Forest" :
             currentZone === "tavern" ? "🍺 Silver Moon Tavern" :
             currentZone === "workshop" ? "⚒️ Forge District" :
             "🌙 Moonhaven"}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, pointerEvents: "all" }}>
          <div style={{ fontSize: 12, color: "#ffd700", fontWeight: 700 }}>🪙 {myCoins}</div>
          <div style={{ fontSize: 11, color: "rgba(150,170,255,0.5)" }}>👥 {playerCount}</div>
        </div>
      </div>

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
              <div style={{ fontSize: 13, fontWeight: 900, color: "#ccbbff" }}>{activeNPC.npc.name}</div>
              <div style={{ fontSize: 10, color: "rgba(150,130,200,0.5)" }}>{activeNPC.npc.role}</div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: "rgba(220,215,255,0.9)", lineHeight: 1.5, fontStyle: "italic" }}>
            "{activeNPC.line}"
          </div>
        </div>
      )}

      {/* Chat input */}
      {chatOpen && (
        <div style={{
          position: "absolute", bottom: 70, left: "50%", transform: "translateX(-50%)",
          zIndex: 60, display: "flex", gap: 8, alignItems: "center",
        }}>
          <input
            autoFocus
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") sendChat(); if (e.key === "Escape") setChatOpen(false); }}
            placeholder="Say something…"
            style={{
              padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(130,110,220,0.4)",
              background: "rgba(10,8,30,0.95)", color: "#fff", fontSize: 13,
              width: 280, outline: "none",
            }}
          />
          <button onClick={sendChat} style={{
            padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(130,110,220,0.4)",
            background: "rgba(80,60,180,0.6)", color: "#ccbbff", fontSize: 12, cursor: "pointer",
          }}>Send</button>
        </div>
      )}

      {/* Bottom toolbar */}
      {((): React.ReactNode => {
        const toolbarBtns: Array<{ icon: string; label: string; onClick: () => void }> = [
          { icon: "💬", label: "Chat [Enter]", onClick: () => setChatOpen(o => !o) },
          { icon: "🎒", label: "Stash", onClick: () => { setShowStash(true); fetchStash(); } },
          { icon: "⚔️", label: "Adventure", onClick: () => setShowAdventure(true) },
          { icon: "🧙", label: "Character", onClick: () => setShowCharacter(true) },
          { icon: "🗞️", label: "Herald", onClick: () => { setShowHerald(true); fetchHerald(); } },
        ];
        return (
          <div style={{
            position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
            zIndex: 50, display: "flex", gap: 8, alignItems: "center",
            background: "rgba(5,3,20,0.85)", border: "1px solid rgba(100,80,200,0.3)",
            borderRadius: 14, padding: "8px 14px",
          }}>
            {toolbarBtns.map(btn => (
              <button key={btn.icon} onClick={btn.onClick} title={btn.label} style={{
                padding: "7px 10px", fontSize: 18, background: "rgba(80,60,180,0.25)",
                border: "1px solid rgba(100,80,200,0.25)", borderRadius: 9, cursor: "pointer",
                color: "#ccbbff", transition: "background 0.15s",
              }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(100,80,220,0.45)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(80,60,180,0.25)")}
              >{btn.icon}</button>
            ))}
            <div style={{ width: 1, height: 28, background: "rgba(100,80,200,0.2)" }} />
            <Link href="/feed" style={{ padding: "7px 10px", fontSize: 12, color: "rgba(150,130,220,0.5)", textDecoration: "none" }}>Feed</Link>
          </div>
        );
      })()}

      {/* Controls hint */}
      {!loading && (
        <div style={{
          position: "absolute", bottom: 70, right: 14, zIndex: 40,
          fontSize: 9, color: "rgba(100,90,180,0.4)", lineHeight: 1.8, textAlign: "right",
        }}>
          WASD / ↑↓←→ move<br />
          Click ground to walk<br />
          Right-drag to orbit<br />
          Scroll to zoom<br />
          Click NPC to talk<br />
          Enter to chat
        </div>
      )}

      {/* Panels (same components as town) */}
      {showStash && (
        <StashPanel
          stashItems={[]}
          inventoryItems={[]}
          equippedSlots={{}}
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
          stock={vendorStock as Parameters<typeof VendorPanel>[0]["stock"]}
          inventoryItems={[]}
          stashItems={[]}
          coins={myCoins}
          onClose={() => setShowVendor(false)}
          onBuy={handleVendorBuy}
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
          adventureStats={null}
          backpack={[]}
          equippedSlots={{}}
          username={username}
          myCoins={myCoins}
          onClose={() => setShowCharacter(false)}
          onEquipSlot={() => {}}
        />
      )}
      {showAdventure && activeMission != null && (
        <AdventureOverlay
          userId={userId}
          username={username}
          avatarUrl={avatarUrl}
          myStats={{ class: null, level: 1, hp: 100, max_hp: 100, base_attack: 10, xp: 0, inventory: [], equipped_item_id: null, wins: 0, quests_completed: 0 }}
          sessionId={null}
          missionData={activeMission as Parameters<typeof AdventureOverlay>[0]["missionData"]}
          teamMembers={nearbyPlayers.map(p => ({ userId: p.user_id, username: p.username, avatarUrl: p.avatar_url, hp: 100, maxHp: 100, playerClass: null, isDowned: false }))}
          onClose={() => { setShowAdventure(false); setActiveMission(null); }}
          onStatsUpdate={() => {}}
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
        <div style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
          zIndex: 80, background: "rgba(0,0,0,0.85)", borderRadius: 12,
          padding: "16px 28px", fontSize: 16, color: "#fff", textAlign: "center",
          border: "1px solid rgba(255,80,80,0.4)",
        }}>
          {tagMsg}
          <br />
          <button onClick={() => setTagMsg(null)} style={{ marginTop: 10, padding: "4px 14px", borderRadius: 7, border: "none", background: "rgba(255,100,100,0.3)", color: "#fff", cursor: "pointer", fontSize: 12 }}>OK</button>
        </div>
      )}

      <style>{`
        @keyframes npc-pop { from { opacity:0; transform:translateX(-50%) translateY(8px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
      `}</style>
    </div>
  );

  // ── Utility fetch functions ───────────────────────────────────────────────
  function fetchStash() {
    fetch(`/api/stash?userId=${userId}`)
      .then(r => r.json())
      .then(d => setStashData(d))
      .catch(() => {});
  }
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

// ── Three.js scene building helpers ──────────────────────────────────────────

async function buildBillboard(
  THREE: ThreeModule,
  imageUrl: string,
  name: string,
  glowColor: number,
): Promise<import("three").Group> {
  const group = new THREE.Group();

  // Body sprite (avatar image on a plane)
  const canvas = document.createElement("canvas");
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = `#${glowColor.toString(16).padStart(6, "0")}22`;
  ctx.beginPath(); ctx.arc(64, 64, 60, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffffff44";
  ctx.beginPath(); ctx.arc(64, 64, 56, 0, Math.PI * 2); ctx.fill();

  // Try to load avatar image
  const bodyTex = new THREE.CanvasTexture(canvas);
  const bodyGeo = new THREE.PlaneGeometry(1.4, 1.4);
  const bodyMat = new THREE.MeshBasicMaterial({ map: bodyTex, transparent: true, depthWrite: false });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.position.set(0, 1.2, 0);
  bodyMesh.userData.billboard = true;

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    const tc = document.createElement("canvas");
    tc.width = 128; tc.height = 128;
    const tc2 = tc.getContext("2d")!;
    tc2.beginPath(); tc2.arc(64, 64, 60, 0, Math.PI * 2); tc2.clip();
    tc2.drawImage(img, 0, 0, 128, 128);
    bodyTex.image = tc;
    bodyTex.needsUpdate = true;
  };
  img.src = imageUrl;

  group.add(bodyMesh);

  // Username label
  const nameTex = new THREE.CanvasTexture(makeUsernameCanvas(name));
  const nameGeo = new THREE.PlaneGeometry(1.6, 0.3);
  const nameMat = new THREE.MeshBasicMaterial({ map: nameTex, transparent: true, depthWrite: false });
  const nameMesh = new THREE.Mesh(nameGeo, nameMat);
  nameMesh.position.set(0, 2.1, 0);
  nameMesh.userData.billboard = true;
  group.add(nameMesh);

  // Chat bubble (starts hidden)
  const bubbleTex = new THREE.CanvasTexture(makeChatCanvas(""));
  const bubbleGeo = new THREE.PlaneGeometry(1.8, 0.38);
  const bubbleMat = new THREE.MeshBasicMaterial({ map: bubbleTex, transparent: true, depthWrite: false });
  const bubbleMesh = new THREE.Mesh(bubbleGeo, bubbleMat);
  bubbleMesh.name = "chat_bubble";
  bubbleMesh.position.set(0, 2.55, 0);
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

  // Try to load GLB model first
  const glbPath = `/models/moonhaven/${npc.id}.glb`;
  if (GLTFLoader) {
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

  // Fallback: emoji billboard
  const emojiTex = new THREE.CanvasTexture(makeEmojiCanvas(npc.emoji, 256));
  const emojiGeo = new THREE.PlaneGeometry(1.4, 1.4);
  const emojiMat = new THREE.MeshBasicMaterial({ map: emojiTex, transparent: true, depthWrite: false });
  const emojiMesh = new THREE.Mesh(emojiGeo, emojiMat);
  emojiMesh.position.set(0, 1.2, 0);
  emojiMesh.userData.billboard = true;

  // NPC portrait image (from generate-npc-images)
  const imgPath = `/images/npcs/${npc.id}.png`;
  const imgEl = new Image();
  imgEl.crossOrigin = "anonymous";
  imgEl.onload = () => {
    const tc = document.createElement("canvas");
    tc.width = 256; tc.height = 256;
    const tc2 = tc.getContext("2d")!;
    tc2.beginPath(); tc2.arc(128, 128, 120, 0, Math.PI * 2); tc2.clip();
    tc2.drawImage(imgEl, 0, 0, 256, 256);
    emojiTex.image = tc;
    emojiTex.needsUpdate = true;
  };
  imgEl.src = imgPath;

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
  return new Promise((resolve) => {
    const loader = new (GLTFLoader as new () => { load: (p: string, ok: (g: { scene: import("three").Object3D }) => void, _: unknown, err: () => void) => void })();
    loader.load(path, gltf => resolve(gltf.scene), undefined, () => resolve(null));
  });
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

function buildBuilding(THREE: ThreeModule, scene: import("three").Scene, bld: { position: [number, number, number]; size: [number, number, number]; color: string; roofColor: string; label: string }) {
  const [bx, , bz] = bld.position;
  const [bw, bh, bd] = bld.size;

  const wallMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(bld.color), roughness: 0.9, metalness: 0 });
  const roofMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(bld.roofColor), roughness: 0.85 });

  // Walls
  const wallGeo = new THREE.BoxGeometry(bw, bh, bd);
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.position.set(bx, bh / 2, bz);
  wall.castShadow = true; wall.receiveShadow = true;
  scene.add(wall);

  // Roof (pyramid / gable shape)
  const roofH = bh * 0.5;
  const roofGeo = new THREE.ConeGeometry(Math.max(bw, bd) * 0.72, roofH, 4);
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(bx, bh + roofH / 2, bz);
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  scene.add(roof);

  // Windows glow
  const winMat = new THREE.MeshStandardMaterial({ color: 0xffcc66, emissive: new THREE.Color(0x553300), emissiveIntensity: 1.5, roughness: 0.1 });
  for (let wi = 0; wi < Math.floor(bw / 3); wi++) {
    const wx = bx - bw / 2 + 1.5 + wi * 3;
    const winGeo = new THREE.BoxGeometry(0.6, 0.8, 0.05);
    const win = new THREE.Mesh(winGeo, winMat);
    win.position.set(wx, bh * 0.55, bz + bd / 2 + 0.01);
    scene.add(win);
  }
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
