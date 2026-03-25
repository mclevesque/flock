"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "@/lib/use-session";
import Link from "next/link";
import PartySocket from "partysocket";
import UserContextMenu, { ContextMenuUser } from "@/app/components/UserContextMenu";

// ── Constants ──────────────────────────────────────────────────────────────────
const AW = 1920, AH = 1080;
type Tool = "pencil" | "brush" | "spray" | "eraser" | "rect" | "ellipse" | "line" | "arrow" | "fill" | "eye" | "text";

const PALETTE = [
  "#000000","#ffffff","#e8e8e8","#888888","#444444",
  "#ff4757","#ff6b6b","#ffa502","#ffd32a","#7bed9f",
  "#2ed573","#1e90ff","#70a1ff","#5352ed","#a29bfe",
  "#fd79a8","#e84393","#6c5ce7","#00b894","#00cec9",
  "#fdcb6e","#e17055","#74b9ff","#dfe6e9","#636e72",
];

const TRACKS = [
  { id: "V91JExU7z7I", title: "Deep Study Flow", label: "Focus · 1h+" },
  { id: "jfKfPfyJRdk", title: "Lofi Hip Hop Radio", label: "Lofi Girl · 24/7" },
  { id: "5qap5aO4i9A", title: "Lofi Beats Mix", label: "Chill · 2h" },
  { id: "DWcJFNfaw9c", title: "Studio Ghibli Piano", label: "Relaxing · 3h" },
  { id: "lTRiuFIWV54", title: "Rain & Ambient Sounds", label: "Nature · 2h" },
  { id: "gWJpBpfNiME", title: "Celtic Fantasy Music", label: "Epic · 1h" },
  { id: "b73BI9eUkjM", title: "Dark Cinematic Ambient", label: "Moody · 1h" },
  { id: "YJVmu6yttiI", title: "Smooth Jazz for Art", label: "Jazz · 1h" },
];

const COLORING_TEMPLATES = [
  { name: "mandala", label: "Mandala", emoji: "🌀", ai: false },
  { name: "flower", label: "Flower", emoji: "🌸", ai: false },
  { name: "butterfly", label: "Butterfly", emoji: "🦋", ai: false },
  { name: "star", label: "Star Burst", emoji: "⭐", ai: false },
  { name: "tree", label: "Forest", emoji: "🌲", ai: false },
  { name: "ocean", label: "Ocean", emoji: "🌊", ai: false },
  { name: "space", label: "Space", emoji: "🚀", ai: false },
];

// Pre-generated coloring book presets — static files in /public/coloring/
// Run scripts/generate-coloring.mjs once to generate all images
const COLORING_CATEGORIES = [
  {
    category: "Fantasy Creatures", emoji: "🐉",
    presets: [
      { label: "Dragon",    emoji: "🐉", file: "dragon" },
      { label: "Unicorn",   emoji: "🦄", file: "unicorn" },
      { label: "Mermaid",   emoji: "🧜", file: "mermaid" },
      { label: "Phoenix",   emoji: "🔥", file: "phoenix" },
      { label: "Griffin",   emoji: "🦅", file: "griffin" },
      { label: "Pegasus",   emoji: "🐎", file: "pegasus" },
      { label: "Kraken",    emoji: "🐙", file: "kraken" },
      { label: "Fairy",     emoji: "🧚", file: "fairy" },
      { label: "Centaur",   emoji: "🏹", file: "centaur" },
      { label: "Medusa",    emoji: "🐍", file: "medusa" },
      { label: "Sphinx",    emoji: "🏛️", file: "sphinx" },
      { label: "Hydra",     emoji: "🐲", file: "hydra" },
    ],
  },
  {
    category: "Animals & Wildlife", emoji: "🦁",
    presets: [
      { label: "Wolf Moon",   emoji: "🐺", file: "wolf-moon" },
      { label: "Galaxy Owl",  emoji: "🦉", file: "owl" },
      { label: "Koi Fish",    emoji: "🐠", file: "koi" },
      { label: "Tiger",       emoji: "🐯", file: "tiger" },
      { label: "Elephant",    emoji: "🐘", file: "elephant" },
      { label: "Butterfly",   emoji: "🦋", file: "butterfly" },
      { label: "Hummingbird", emoji: "🐦", file: "hummingbird" },
      { label: "Seahorse",    emoji: "🌊", file: "seahorse" },
      { label: "Peacock",     emoji: "🦚", file: "peacock" },
      { label: "Fox",         emoji: "🦊", file: "fox" },
      { label: "Bear",        emoji: "🐻", file: "bear" },
      { label: "Whale",       emoji: "🐋", file: "whale" },
    ],
  },
  {
    category: "Architecture", emoji: "🏰",
    presets: [
      { label: "Castle",      emoji: "🏰", file: "castle" },
      { label: "Lighthouse",  emoji: "🗼", file: "lighthouse" },
      { label: "Cathedral",   emoji: "⛪", file: "cathedral" },
      { label: "Treehouse",   emoji: "🌳", file: "treehouse" },
      { label: "Pagoda",      emoji: "🏯", file: "pagoda" },
      { label: "Ruins",       emoji: "🏚️", file: "ruins" },
    ],
  },
  {
    category: "Cultural & Mythological", emoji: "⚔️",
    presets: [
      { label: "Samurai",  emoji: "⚔️", file: "samurai" },
      { label: "Wizard",   emoji: "🔮", file: "wizard" },
      { label: "Viking",   emoji: "🪓", file: "viking" },
      { label: "Aztec",    emoji: "☀️", file: "aztec" },
      { label: "Celtic",   emoji: "🍀", file: "celtic" },
      { label: "Geisha",   emoji: "🪷", file: "geisha" },
      { label: "Pharaoh",  emoji: "𓂀", file: "pharaoh" },
    ],
  },
  {
    category: "Nature & Botanical", emoji: "🌸",
    presets: [
      { label: "Mandala",    emoji: "🌺", file: "mandala" },
      { label: "Geometric",  emoji: "🔷", file: "geometric" },
      { label: "Roses",      emoji: "🌹", file: "roses" },
      { label: "Mushrooms",  emoji: "🍄", file: "mushrooms" },
      { label: "Underwater", emoji: "🐡", file: "underwater" },
      { label: "Autumn",     emoji: "🍂", file: "autumn" },
      { label: "Succulent",  emoji: "🪴", file: "succulent" },
      { label: "Lotus",      emoji: "🪷", file: "lotus" },
    ],
  },
  {
    category: "Space & Cosmic", emoji: "🌌",
    presets: [
      { label: "Galaxy",       emoji: "🌌", file: "galaxy" },
      { label: "Astronaut",    emoji: "👨‍🚀", file: "astronaut" },
      { label: "Space Dragon", emoji: "🐉", file: "dragon-space" },
      { label: "Moon Fairy",   emoji: "🌙", file: "moon-fairy" },
      { label: "Solar System", emoji: "🪐", file: "solar-system" },
    ],
  },
  {
    category: "Seasonal", emoji: "🎃",
    presets: [
      { label: "Christmas", emoji: "🎄", file: "christmas" },
      { label: "Halloween", emoji: "🎃", file: "halloween" },
      { label: "Spring",    emoji: "🌷", file: "spring" },
      { label: "Winter",    emoji: "❄️", file: "winter" },
    ],
  },
];

interface DrawMsg { id: number; user_id: string; username: string; avatar_url: string | null; content: string; created_at: string; }
interface DrawViewer { user_id: string; username: string; avatar_url: string | null; is_collaborator?: boolean; }

// ── Flood fill ─────────────────────────────────────────────────────────────────
function floodFill(ctx: CanvasRenderingContext2D, sx: number, sy: number, fill: [number, number, number, number]) {
  if (sx < 0 || sx >= AW || sy < 0 || sy >= AH) return;
  const img = ctx.getImageData(0, 0, AW, AH);
  const d = img.data, w = AW;
  const ti = (sy * w + sx) * 4;
  const tgt = [d[ti], d[ti + 1], d[ti + 2], d[ti + 3]];
  const match = (i: number) => Math.abs(d[i] - tgt[0]) + Math.abs(d[i + 1] - tgt[1]) + Math.abs(d[i + 2] - tgt[2]) + Math.abs(d[i + 3] - tgt[3]) < 80;
  if (match(ti) && d[ti] === fill[0] && d[ti + 1] === fill[1] && d[ti + 2] === fill[2]) return;
  const stack = [ti], seen = new Uint8Array(d.length / 4);
  while (stack.length) {
    const i = stack.pop()!; const pi = i / 4;
    if (seen[pi] || !match(i)) continue;
    seen[pi] = 1; d[i] = fill[0]; d[i + 1] = fill[1]; d[i + 2] = fill[2]; d[i + 3] = fill[3];
    const x = pi % w, y = Math.floor(pi / w);
    if (x > 0) stack.push(i - 4); if (x < w - 1) stack.push(i + 4);
    if (y > 0) stack.push(i - w * 4); if (y < AH - 1) stack.push(i + w * 4);
  }
  ctx.putImageData(img, 0, 0);
}

function hexToRgba(hex: string, a: number): [number, number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b, Math.round(a * 255)];
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function DrawRoom({ roomId, isHost, initialTitle }: { roomId: string; isHost: boolean; initialTitle: string }) {
  const { data: session } = useSession();

  // Reactive mobile detection + landscape tracking
  const [isMobile, setIsMobile] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  useEffect(() => {
    // Use screen portrait width so landscape doesn't break fullscreen mode
    function checkMobile() {
      setIsMobile(Math.min(screen.width, screen.height) < 768);
      setIsLandscape(window.innerWidth > window.innerHeight);
    }
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Drawing
  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState("#1a1a28");
  const [size, setSize] = useState(10);
  const [opacity, setOpacity] = useState(1);
  const [recentColors, setRecentColors] = useState<string[]>(["#000000", "#ffffff", "#ff4757", "#1e90ff", "#2ed573"]);
  const [symmetry, setSymmetry] = useState<"none" | "h" | "v">("none");
  const symmetryR = useRef<"none" | "h" | "v">("none");
  const [showGrid, setShowGrid] = useState(false);
  const gridRef = useRef(false);

  // Canvas transform
  const [zoom, setZoom] = useState(0.48);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  // UI
  const [chatOpen, setChatOpen] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [trackListOpen, setTrackListOpen] = useState(false);
  const [messages, setMessages] = useState<DrawMsg[]>([]);
  const [viewers, setViewers] = useState<DrawViewer[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [title] = useState(initialTitle);
  const [allowViewers, setAllowViewers] = useState(true);
  const [contextMenu, setContextMenu] = useState<ContextMenuUser | null>(null);
  const [isCollaborator, setIsCollaborator] = useState(false);
  const isCollaboratorRef = useRef(false);

  // Coloring book modal & locked layer
  const [coloringBookOpen, setColoringBookOpen] = useState(false);
  const [coloringConfirm, setColoringConfirm] = useState<string | null>(null);
  const [coloringCategory, setColoringCategory] = useState(0);
  const [aiColoringPrompt, setAiColoringPrompt] = useState("");
  const [aiColoringLoading, setAiColoringLoading] = useState(false);
  const [aiColoringError, setAiColoringError] = useState<string | null>(null);
  const coloringBookLayerRef = useRef<HTMLCanvasElement | null>(null); // locked outline layer

  // Music
  const [trackIdx, setTrackIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(60);

  // Mobile UI
  const [mobileToolOpen, setMobileToolOpen] = useState(false);
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);

  // Refs
  const drawSocketRef = useRef<PartySocket | null>(null);
  const sessionRef = useRef(session);
  useEffect(() => { sessionRef.current = session; }, [session]);
  const displayRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const artboard = useRef<HTMLCanvasElement | null>(null);
  const undoStack = useRef<ImageData[]>([]);
  const redoStack = useRef<ImageData[]>([]);
  const isDrawing = useRef(false);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const lastPos = useRef({ x: 0, y: 0 });
  const shapeStart = useRef({ x: 0, y: 0 });
  const savedSnap = useRef<ImageData | null>(null);
  const spaceHeld = useRef(false);
  const ytPlayer = useRef<Record<string, unknown> | null>(null);
  const ytReady = useRef(false);
  const trackIdxRef = useRef(0);
  const snapshotTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const lastPinchDistRef = useRef(0);

  // Stabilizer + pressure simulation refs
  const smoothedPosRef = useRef({ x: 0, y: 0 });
  const lastDrawTimeRef = useRef(0);
  const lastDrawVelRef = useRef(0);
  const isTouchDrawRef = useRef(false);
  const [stabilizerOn, setStabilizerOn] = useState(true);
  const stabilizerOnRef = useRef(true);
  useEffect(() => { stabilizerOnRef.current = stabilizerOn; }, [stabilizerOn]);

  // Mutable refs for drawing closures
  const zR = useRef(zoom); const pxR = useRef(panX); const pyR = useRef(panY);
  const toolR = useRef(tool); const colorR = useRef(color); const sizeR = useRef(size); const opR = useRef(opacity);
  useEffect(() => { zR.current = zoom; }, [zoom]);
  useEffect(() => { pxR.current = panX; }, [panX]);
  useEffect(() => { pyR.current = panY; }, [panY]);
  useEffect(() => { toolR.current = tool; }, [tool]);
  useEffect(() => { colorR.current = color; }, [color]);
  useEffect(() => { sizeR.current = size; }, [size]);
  useEffect(() => { opR.current = opacity; }, [opacity]);
  useEffect(() => { trackIdxRef.current = trackIdx; }, [trackIdx]);
  useEffect(() => { symmetryR.current = symmetry; render(); }, [symmetry]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { gridRef.current = showGrid; render(); }, [showGrid]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ──────────────────────────────────────────────────────────────────
  const render = useCallback(() => {
    const display = displayRef.current, ab = artboard.current;
    if (!display || !ab) return;
    const ctx = display.getContext("2d")!;
    const z = zR.current, px = pxR.current, py = pyR.current;
    ctx.clearRect(0, 0, display.width, display.height);
    // Workspace bg
    ctx.fillStyle = "#131320"; ctx.fillRect(0, 0, display.width, display.height);
    // Grid dots
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    const gs = Math.max(20, 40 * z);
    for (let gx = (px % gs); gx < display.width; gx += gs)
      for (let gy = (py % gs); gy < display.height; gy += gs)
        ctx.fillRect(gx, gy, 1.5, 1.5);
    // Artboard shadow
    ctx.save(); ctx.translate(px, py); ctx.scale(z, z);
    ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 30 / z; ctx.shadowOffsetY = 6 / z;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, AW, AH); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.drawImage(ab, 0, 0);
    // Draw locked coloring book outline layer ON TOP (cannot be painted over)
    const cbLayer = coloringBookLayerRef.current;
    if (cbLayer) ctx.drawImage(cbLayer, 0, 0);
    ctx.restore();

    // Grid overlay
    if (gridRef.current) {
      const gridSize = 100;
      ctx.save(); ctx.translate(px, py); ctx.scale(z, z);
      ctx.strokeStyle = "rgba(100,100,200,0.2)"; ctx.lineWidth = 1 / z;
      for (let gx2 = 0; gx2 <= AW; gx2 += gridSize) { ctx.beginPath(); ctx.moveTo(gx2, 0); ctx.lineTo(gx2, AH); ctx.stroke(); }
      for (let gy2 = 0; gy2 <= AH; gy2 += gridSize) { ctx.beginPath(); ctx.moveTo(0, gy2); ctx.lineTo(AW, gy2); ctx.stroke(); }
      ctx.restore();
    }

    // Symmetry axis line
    const sym = symmetryR.current;
    if (sym !== "none") {
      ctx.save(); ctx.translate(px, py); ctx.scale(z, z);
      ctx.setLineDash([8 / z, 6 / z]);
      ctx.lineWidth = 1.5 / z;
      if (sym === "h") {
        ctx.strokeStyle = "rgba(255,80,80,0.7)";
        ctx.beginPath(); ctx.moveTo(0, AH / 2); ctx.lineTo(AW, AH / 2); ctx.stroke();
      } else if (sym === "v") {
        ctx.strokeStyle = "rgba(80,120,255,0.7)";
        ctx.beginPath(); ctx.moveTo(AW / 2, 0); ctx.lineTo(AW / 2, AH); ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
    }
  }, []);

  // ── Init artboard ──────────────────────────────────────────────────────────
  useEffect(() => {
    const c = document.createElement("canvas"); c.width = AW; c.height = AH;
    const ctx = c.getContext("2d")!; ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, AW, AH);
    artboard.current = c;
    setTimeout(async () => {
      const container = containerRef.current;
      if (!container) return;
      const sw = (container.clientWidth - 60) / AW, sh = (container.clientHeight - 60) / AH;
      const nz = Math.min(sw, sh, 0.9);
      const npx = (container.clientWidth - AW * nz) / 2, npy = (container.clientHeight - AH * nz) / 2;
      zR.current = nz; pxR.current = npx; pyR.current = npy;
      setZoom(nz); setPanX(npx); setPanY(npy);
      try {
        const r = await fetch(`/api/draw-room/${roomId}`);
        const d = await r.json();
        if (d.canvas_snapshot) {
          const img = new Image();
          img.onload = () => {
            const ab = artboard.current;
            if (!ab) return;
            const ctx2 = ab.getContext("2d")!;
            ctx2.drawImage(img, 0, 0, AW, AH);
            render();
          };
          img.src = d.canvas_snapshot;
          return;
        }
      } catch { /* ignore */ }
      render();
    }, 50);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Resize canvases ────────────────────────────────────────────────────────
  useEffect(() => {
    function resize() {
      const c = displayRef.current, o = overlayRef.current, cont = containerRef.current;
      if (!c || !o || !cont) return;
      c.width = cont.clientWidth; c.height = cont.clientHeight;
      o.width = cont.clientWidth; o.height = cont.clientHeight;
      // Re-fit artboard on orientation change / resize
      const sw = (cont.clientWidth - 60) / AW, sh = (cont.clientHeight - 60) / AH;
      const nz = Math.min(sw, sh, 0.9);
      const npx = (cont.clientWidth - AW * nz) / 2, npy = (cont.clientHeight - AH * nz) / 2;
      zR.current = nz; pxR.current = npx; pyR.current = npy;
      setZoom(nz); setPanX(npx); setPanY(npy);
      render();
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [render]);

  // ── PartyKit real-time connection ─────────────────────────────────────────
  function sendJoin(socket: PartySocket) {
    const s = sessionRef.current;
    if (!s?.user?.id) return;
    socket.send(JSON.stringify({
      type: "join",
      userId: s.user.id,
      username: s.user.name ?? "Anonymous",
      avatarUrl: (s.user as { image?: string }).image ?? null,
      isHost,
      isCollaborator: isCollaboratorRef.current,
    }));
  }

  useEffect(() => {
    const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST;
    if (!host) return;
    const socket = new PartySocket({ host, room: roomId, party: "draw" });
    drawSocketRef.current = socket;

    socket.addEventListener("open", () => sendJoin(socket));

    socket.addEventListener("message", (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data as string) as Record<string, unknown>;

        if (msg.type === "snapshot") {
          if (isCollaboratorRef.current || isHost) return; // drawers handle canvas locally
          const data = msg.data as string;
          if (!data) return;
          const img = new Image();
          img.onload = () => {
            const ab = artboard.current; if (!ab) return;
            const ctx = ab.getContext("2d")!;
            ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, AW, AH);
            ctx.drawImage(img, 0, 0, AW, AH); render();
          };
          img.src = data;

        } else if (msg.type === "viewers") {
          type PKViewer = { userId: string; username: string; avatarUrl: string | null; isCollaborator: boolean };
          const list = (msg.viewers as PKViewer[]) ?? [];
          setViewers(list.map(v => ({ user_id: v.userId, username: v.username, avatar_url: v.avatarUrl, is_collaborator: v.isCollaborator })));
          const myId = sessionRef.current?.user?.id;
          if (myId) {
            const me = list.find(v => v.userId === myId);
            const collab = !!(me?.isCollaborator);
            if (collab !== isCollaboratorRef.current) {
              isCollaboratorRef.current = collab;
              setIsCollaborator(collab);
            }
          }

        } else if (msg.type === "chat") {
          type PKChat = { userId: string; username: string; avatarUrl: string | null; content: string; createdAt: number };
          const pkMsgs = (msg.messages as PKChat[]) ?? [];
          setMessages(pkMsgs.map((m, i) => ({
            id: i, user_id: m.userId, username: m.username,
            avatar_url: m.avatarUrl, content: m.content,
            created_at: new Date(m.createdAt).toISOString(),
          })));

        } else if (msg.type === "collaborator-status") {
          const isCollab = !!(msg.isCollaborator);
          isCollaboratorRef.current = isCollab;
          setIsCollaborator(isCollab);

        } else if (msg.type === "clear") {
          if (isHost || isCollaboratorRef.current) return;
          const ab = artboard.current; if (!ab) return;
          const ctx = ab.getContext("2d")!;
          ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, AW, AH); render();

        } else if (msg.type === "fill") {
          if (isHost || isCollaboratorRef.current) return;
          const ab = artboard.current; if (!ab) return;
          const ctx = ab.getContext("2d")!;
          floodFill(ctx, msg.x as number, msg.y as number, hexToRgba(msg.color as string, msg.opacity as number));
          render();
        }
      } catch { /* ignore */ }
    });

    return () => { socket.close(); drawSocketRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, roomId]);

  // Re-send join when session resolves (socket may already be open)
  useEffect(() => {
    const socket = drawSocketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || !session?.user?.id) return;
    sendJoin(socket);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  // ── Snapshot save ─────────────────────────────────────────────────────────
  const scheduleSave = useCallback(() => {
    if (!isHost && !isCollaboratorRef.current) return;
    if (snapshotTimer.current) clearTimeout(snapshotTimer.current);
    snapshotTimer.current = setTimeout(() => {
      const ab = artboard.current;
      if (!ab) return;
      const snapshot = ab.toDataURL("image/jpeg", 0.8);
      // Broadcast via PartySocket for instant viewer update
      drawSocketRef.current?.send(JSON.stringify({ type: "snapshot", data: snapshot }));
      // Also persist to DB
      fetch(`/api/draw-room/${roomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "snapshot", snapshot }),
      }).catch(() => {});
    }, 3000);
  }, [isHost, roomId]);

  // ── YouTube music ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    w.onYouTubeIframeAPIReady = () => {
      ytPlayer.current = new w.YT.Player("yt-player-hidden", {
        height: "1", width: "1",
        videoId: TRACKS[0].id,
        playerVars: { autoplay: 0, controls: 0, modestbranding: 1, rel: 0 },
        events: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onReady: () => { ytReady.current = true; (ytPlayer.current as any).setVolume?.(volume); },
          onStateChange: (e: Record<string, unknown>) => { setIsPlaying(e.data === 1); },
        },
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function playTrack(idx: number) {
    setTrackIdx(idx); trackIdxRef.current = idx;
    if (ytReady.current && ytPlayer.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ytPlayer.current as any).loadVideoById?.(TRACKS[idx].id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ytPlayer.current as any).playVideo?.();
    }
  }

  function togglePlay() {
    if (!ytReady.current) return;
    if (isPlaying) // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ytPlayer.current as any).pauseVideo?.();
    else // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ytPlayer.current as any).playVideo?.();
  }

  function setVol(v: number) {
    setVolume(v); if (ytReady.current && ytPlayer.current) // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ytPlayer.current as any).setVolume?.(v);
  }

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const shortcuts: Record<string, () => void> = {
      p: () => setTool("pencil"), b: () => setTool("brush"), e: () => setTool("eraser"),
      r: () => setTool("rect"), o: () => setTool("ellipse"), l: () => setTool("line"),
      a: () => setTool("arrow"), f: () => setTool("fill"), i: () => setTool("eye"),
      s: () => setTool("spray"), t: () => setTool("text"),
      "[": () => setSize(s => Math.max(1, s - 2)), "]": () => setSize(s => Math.min(200, s + 2)),
    };
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === " ") { spaceHeld.current = true; e.preventDefault(); return; }
      if (e.ctrlKey && e.key === "z") { e.preventDefault(); undo(); return; }
      if ((e.ctrlKey && e.key === "y") || (e.ctrlKey && e.shiftKey && e.key === "Z")) { e.preventDefault(); redo(); return; }
      if (e.key === "0") fitToWindow();
      const fn = shortcuts[e.key.toLowerCase()];
      if (fn) { fn(); e.preventDefault(); }
    }
    function onKeyUp(e: KeyboardEvent) { if (e.key === " ") spaceHeld.current = false; }
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKeyUp); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Scroll to chat bottom ──────────────────────────────────────────────────
  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // ── Drawing helpers ────────────────────────────────────────────────────────
  function getCoords(clientX: number, clientY: number) {
    const rect = displayRef.current!.getBoundingClientRect();
    return {
      x: Math.floor((clientX - rect.left - pxR.current) / zR.current),
      y: Math.floor((clientY - rect.top - pyR.current) / zR.current),
    };
  }

  function getArtCtx() { return artboard.current?.getContext("2d") ?? null; }

  function saveUndoState() {
    const ctx = getArtCtx(); if (!ctx) return;
    undoStack.current.push(ctx.getImageData(0, 0, AW, AH));
    if (undoStack.current.length > 40) undoStack.current.shift();
    redoStack.current = [];
  }

  function undo() {
    const ctx = getArtCtx(); if (!ctx || !undoStack.current.length) return;
    redoStack.current.push(ctx.getImageData(0, 0, AW, AH));
    ctx.putImageData(undoStack.current.pop()!, 0, 0); render(); scheduleSave();
  }

  function redo() {
    const ctx = getArtCtx(); if (!ctx || !redoStack.current.length) return;
    undoStack.current.push(ctx.getImageData(0, 0, AW, AH));
    ctx.putImageData(redoStack.current.pop()!, 0, 0); render(); scheduleSave();
  }

  function fitToWindow() {
    const cont = containerRef.current; if (!cont) return;
    const sw = (cont.clientWidth - 60) / AW, sh = (cont.clientHeight - 60) / AH;
    const nz = Math.min(sw, sh, 1);
    const npx = (cont.clientWidth - AW * nz) / 2, npy = (cont.clientHeight - AH * nz) / 2;
    zR.current = nz; pxR.current = npx; pyR.current = npy;
    setZoom(nz); setPanX(npx); setPanY(npy);
    render();
  }

  function applyColor(c: string) {
    setColor(c); colorR.current = c;
    setRecentColors(prev => [c, ...prev.filter(x => x !== c)].slice(0, 8));
  }

  function clearCanvas() {
    const ctx = getArtCtx(); if (!ctx) return;
    saveUndoState();
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, AW, AH);
    render(); scheduleSave();
    drawSocketRef.current?.send(JSON.stringify({ type: "clear" }));
  }

  // ── Coloring book: load AI image as locked layer ──────────────────────────
  function loadColoringBookImage(dataUrl: string) {
    const img = new Image();
    img.onload = () => {
      // Create locked layer canvas
      const c = document.createElement("canvas"); c.width = AW; c.height = AH;
      const ctx = c.getContext("2d")!;
      // Draw source image scaled to fit
      ctx.drawImage(img, 0, 0, AW, AH);
      // Convert white/near-white pixels to transparent (keep dark lines only)
      const id = ctx.getImageData(0, 0, AW, AH); const d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const brightness = (d[i] + d[i+1] + d[i+2]) / 3;
        if (brightness > 200) {
          d[i+3] = 0; // transparent
        } else {
          // Force near-black for clean lines
          d[i] = 0; d[i+1] = 0; d[i+2] = 0;
          d[i+3] = Math.min(255, Math.round((200 - brightness) * 2));
        }
      }
      ctx.putImageData(id, 0, 0);
      coloringBookLayerRef.current = c;
      // Clear artboard to white so user starts fresh
      const ab = artboard.current;
      if (ab) { const ac = ab.getContext("2d")!; ac.fillStyle = "#ffffff"; ac.fillRect(0, 0, AW, AH); }
      render(); scheduleSave();
    };
    img.src = dataUrl;
  }

  async function generateAiColoringBook(prompt: string) {
    setAiColoringLoading(true); setAiColoringError(null);
    try {
      const r = await fetch("/api/coloring-book", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const d = await r.json();
      if (!r.ok) { setAiColoringError(d.error ?? "Generation failed"); return; }
      loadColoringBookImage(d.dataUrl);
      setColoringBookOpen(false);
    } catch { setAiColoringError("Network error — try again"); }
    finally { setAiColoringLoading(false); }
  }

  // ── Coloring book templates (procedural) ────────────────────────────────────
  function drawColoringTemplate(name: string) {
    // Draw outlines to the locked layer canvas (NOT artboard)
    const c = document.createElement("canvas"); c.width = AW; c.height = AH;
    const ctx = c.getContext("2d")!;
    ctx.strokeStyle = "#111111"; ctx.lineWidth = 5; ctx.lineCap = "round";

    const cx = AW / 2, cy = AH / 2;

    if (name === "mandala") {
      for (let ring = 1; ring <= 6; ring++) {
        const r = ring * 80;
        const petals = ring * 6;
        for (let i = 0; i < petals; i++) {
          const angle = (i / petals) * Math.PI * 2;
          const x1 = cx + Math.cos(angle) * (r - 30), y1 = cy + Math.sin(angle) * (r - 30);
          const x2 = cx + Math.cos(angle) * (r + 30), y2 = cy + Math.sin(angle) * (r + 30);
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
          const px = cx + Math.cos(angle) * r, py = cy + Math.sin(angle) * r;
          ctx.beginPath(); ctx.arc(px, py, 18, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.stroke();
    } else if (name === "flower") {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const px = cx + Math.cos(a) * 150, py = cy + Math.sin(a) * 150;
        ctx.beginPath(); ctx.ellipse(px, py, 70, 35, a, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(cx, cy, 80, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy + 80); ctx.lineTo(cx, cy + 400); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx + 80, cy + 250, 80, 35, -0.5, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx - 80, cy + 320, 80, 35, 0.5, 0, Math.PI * 2); ctx.stroke();
    } else if (name === "butterfly") {
      ctx.beginPath(); ctx.ellipse(cx, cy, 20, 80, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx - 150, cy - 60, 160, 100, -0.4, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx + 150, cy - 60, 160, 100, 0.4, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx - 100, cy + 80, 110, 70, 0.3, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx + 100, cy + 80, 110, 70, -0.3, 0, Math.PI * 2); ctx.stroke();
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.arc(cx + side * 160, cy - 80, 40, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx + side * 130, cy - 40, 20, 0, Math.PI * 2); ctx.stroke();
      }
    } else if (name === "star") {
      const points = 8, outer = 400, inner = 180;
      ctx.beginPath();
      for (let i = 0; i < points * 2; i++) {
        const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
        const r2 = i % 2 === 0 ? outer : inner;
        const x2 = cx + Math.cos(a) * r2, y2 = cy + Math.sin(a) * r2;
        if (i === 0) ctx.moveTo(x2, y2); else ctx.lineTo(x2, y2);
      }
      ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, 100, 0, Math.PI * 2); ctx.stroke();
    } else if (name === "tree") {
      ctx.beginPath(); ctx.moveTo(cx - 40, AH - 50); ctx.lineTo(cx - 40, cy + 100); ctx.lineTo(cx + 40, cy + 100); ctx.lineTo(cx + 40, AH - 50); ctx.stroke();
      for (let l = 0; l < 4; l++) {
        const ty = cy + 80 - l * 120;
        const hw = 280 - l * 40;
        ctx.beginPath(); ctx.moveTo(cx, ty - 150); ctx.lineTo(cx - hw, ty + 50); ctx.lineTo(cx + hw, ty + 50); ctx.closePath(); ctx.stroke();
      }
    } else if (name === "house") {
      ctx.beginPath(); ctx.rect(cx - 250, cy + 50, 500, 350); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 280, cy + 50); ctx.lineTo(cx, cy - 200); ctx.lineTo(cx + 280, cy + 50); ctx.stroke();
      ctx.beginPath(); ctx.rect(cx - 50, cy + 220, 100, 180); ctx.stroke();
      ctx.beginPath(); ctx.rect(cx - 180, cy + 120, 100, 80); ctx.stroke();
      ctx.beginPath(); ctx.rect(cx + 80, cy + 120, 100, 80); ctx.stroke();
      ctx.beginPath(); ctx.rect(cx + 100, cy - 260, 60, 100); ctx.stroke();
    } else if (name === "ocean") {
      for (let i = 0; i < 6; i++) {
        const wy = cy - 100 + i * 90;
        ctx.beginPath(); ctx.moveTo(0, wy);
        for (let wx = 0; wx < AW; wx += 100) {
          ctx.quadraticCurveTo(wx + 25, wy - 40, wx + 50, wy);
          ctx.quadraticCurveTo(wx + 75, wy + 40, wx + 100, wy);
        }
        ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(200, 200, 120, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(200 + Math.cos(a) * 130, 200 + Math.sin(a) * 130);
        ctx.lineTo(200 + Math.cos(a) * 180, 200 + Math.sin(a) * 180); ctx.stroke();
      }
    } else if (name === "space") {
      ctx.beginPath(); ctx.arc(cx - 200, cy + 100, 200, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx - 200, cy + 100, 320, 60, -0.2, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + 350, cy - 100, 80, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 30; i++) {
        const sx = (i * 137 + 100) % AW, sy = (i * 89 + 80) % AH;
        const sr = 8 + (i % 3) * 4;
        ctx.beginPath();
        for (let p = 0; p < 5; p++) {
          const a1 = (p * 4 / 5 - 0.5) * Math.PI * 2;
          const a2 = ((p * 4 + 2) / 5 - 0.5) * Math.PI * 2;
          ctx.lineTo(sx + Math.cos(a1) * sr, sy + Math.sin(a1) * sr);
          ctx.lineTo(sx + Math.cos(a2) * sr * 0.4, sy + Math.sin(a2) * sr * 0.4);
        }
        ctx.closePath(); ctx.stroke();
      }
    }

    // Store to locked layer and clear artboard to white
    coloringBookLayerRef.current = c;
    const ab = artboard.current;
    if (ab) { const ac = ab.getContext("2d")!; ac.fillStyle = "#ffffff"; ac.fillRect(0, 0, AW, AH); }
    render(); scheduleSave();
  }

  // ── Pointer events ─────────────────────────────────────────────────────────
  function startDraw(clientX: number, clientY: number, button = 0) {
    if (!isHost && !isCollaboratorRef.current) return;
    if (button === 1 || (button === 0 && spaceHeld.current)) {
      isPanning.current = true;
      panStart.current = { x: clientX, y: clientY, px: pxR.current, py: pyR.current };
      return;
    }
    if (button !== 0) return;
    const { x, y } = getCoords(clientX, clientY);
    if (x < 0 || x >= AW || y < 0 || y >= AH) return;
    const ctx = getArtCtx(); if (!ctx) return;
    const t = toolR.current;

    if (t === "fill") {
      saveUndoState();
      floodFill(ctx, x, y, hexToRgba(colorR.current, opR.current));
      render(); scheduleSave();
      drawSocketRef.current?.send(JSON.stringify({ type: "fill", x, y, color: colorR.current, opacity: opR.current }));
      return;
    }
    if (t === "eye") {
      const px = ctx.getImageData(x, y, 1, 1).data;
      const hex = "#" + [px[0], px[1], px[2]].map(v => v.toString(16).padStart(2, "0")).join("");
      applyColor(hex); return;
    }
    if (t === "text") {
      const txt = prompt("Enter text:");
      if (!txt) return;
      saveUndoState();
      ctx.font = `${sizeR.current * 2}px sans-serif`;
      ctx.fillStyle = colorR.current;
      ctx.globalAlpha = opR.current;
      ctx.fillText(txt, x, y);
      ctx.globalAlpha = 1;
      render(); scheduleSave(); return;
    }

    saveUndoState();
    isDrawing.current = true; lastPos.current = { x, y }; shapeStart.current = { x, y };
    smoothedPosRef.current = { x, y }; lastDrawTimeRef.current = performance.now(); lastDrawVelRef.current = 0;
    savedSnap.current = ctx.getImageData(0, 0, AW, AH);

    if (t === "pencil") {
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = opR.current;
      ctx.strokeStyle = colorR.current; ctx.lineWidth = sizeR.current;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 0.1, y + 0.1); ctx.stroke();
      render();
    } else if (t === "eraser") {
      ctx.globalCompositeOperation = "destination-out"; ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(0,0,0,1)"; ctx.lineWidth = sizeR.current;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(x, y);
    }
  }

  function drawMirroredStroke(ctx: CanvasRenderingContext2D, drawFn: (cx: CanvasRenderingContext2D, mx: number, my: number) => void, x: number, y: number) {
    const sym = symmetryR.current;
    if (sym === "h") drawFn(ctx, x, AH - y);
    else if (sym === "v") drawFn(ctx, AW - x, y);
  }

  function moveDraw(clientX: number, clientY: number) {
    if (!isHost && !isCollaboratorRef.current) return;
    if (isPanning.current) {
      const nx = panStart.current.px + (clientX - panStart.current.x);
      const ny = panStart.current.py + (clientY - panStart.current.y);
      pxR.current = nx; pyR.current = ny; setPanX(nx); setPanY(ny); render(); return;
    }
    if (!isDrawing.current) return;
    const { x, y } = getCoords(clientX, clientY);
    const ctx = getArtCtx(); if (!ctx) return;
    const t = toolR.current;

    if (t === "pencil") {
      // Line stabilizer: blend touch input to reduce jitter
      let sx = x, sy = y;
      if (stabilizerOnRef.current && isTouchDrawRef.current) {
        smoothedPosRef.current.x = smoothedPosRef.current.x * 0.65 + x * 0.35;
        smoothedPosRef.current.y = smoothedPosRef.current.y * 0.65 + y * 0.35;
        sx = smoothedPosRef.current.x; sy = smoothedPosRef.current.y;
      }
      // Pressure simulation: faster strokes = thinner line (like real pen pressure)
      const now = performance.now();
      const dt = Math.max(1, now - lastDrawTimeRef.current);
      const vel = Math.hypot(sx - lastPos.current.x, sy - lastPos.current.y) / dt;
      lastDrawVelRef.current = lastDrawVelRef.current * 0.6 + vel * 0.4;
      lastDrawTimeRef.current = now;
      const pressureMult = isTouchDrawRef.current ? Math.max(0.35, 1 - Math.min(lastDrawVelRef.current * 10, 0.65)) : 1;
      ctx.lineWidth = sizeR.current * pressureMult;
      const mx = (sx + lastPos.current.x) / 2, my = (sy + lastPos.current.y) / 2;
      ctx.quadraticCurveTo(lastPos.current.x, lastPos.current.y, mx, my);
      ctx.stroke(); ctx.beginPath(); ctx.moveTo(mx, my);
      // Symmetry
      const sym = symmetryR.current;
      if (sym !== "none") {
        const lmx2 = sym === "h" ? lastPos.current.x : AW - lastPos.current.x;
        const lmy2 = sym === "h" ? AH - lastPos.current.y : lastPos.current.y;
        const mmx2 = sym === "h" ? mx : AW - mx;
        const mmy2 = sym === "h" ? AH - my : my;
        const mx2 = sym === "h" ? sx : AW - sx;
        const my2 = sym === "h" ? AH - sy : sy;
        ctx.save();
        ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = opR.current;
        ctx.strokeStyle = colorR.current; ctx.lineWidth = sizeR.current * pressureMult;
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.beginPath(); ctx.moveTo(lmx2, lmy2);
        ctx.quadraticCurveTo(mmx2, mmy2, (mx2 + mmx2) / 2, (my2 + mmy2) / 2);
        ctx.stroke();
        ctx.restore();
      }
      lastPos.current = { x: sx, y: sy }; render();
    } else if (t === "brush") {
      const steps = Math.max(1, Math.ceil(Math.hypot(x - lastPos.current.x, y - lastPos.current.y) / 3));
      for (let i = 0; i <= steps; i++) {
        const ix = lastPos.current.x + (x - lastPos.current.x) * (i / steps);
        const iy = lastPos.current.y + (y - lastPos.current.y) * (i / steps);
        const r = sizeR.current * 0.55;
        const grd = ctx.createRadialGradient(ix, iy, 0, ix, iy, r);
        const col = colorR.current;
        grd.addColorStop(0, col + "cc"); grd.addColorStop(0.5, col + "55"); grd.addColorStop(1, col + "00");
        ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = opR.current * 0.18;
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(ix, iy, r, 0, Math.PI * 2); ctx.fill();
        // Symmetry mirror
        const sym = symmetryR.current;
        if (sym !== "none") {
          const mix = sym === "h" ? ix : AW - ix;
          const miy = sym === "h" ? AH - iy : iy;
          const mgrd = ctx.createRadialGradient(mix, miy, 0, mix, miy, r);
          mgrd.addColorStop(0, col + "cc"); mgrd.addColorStop(0.5, col + "55"); mgrd.addColorStop(1, col + "00");
          ctx.fillStyle = mgrd; ctx.beginPath(); ctx.arc(mix, miy, r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      lastPos.current = { x, y }; render();
    } else if (t === "spray") {
      const r = sizeR.current * 1.5;
      const dots = Math.max(10, sizeR.current);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = opR.current * 0.1;
      ctx.fillStyle = colorR.current;
      const sym = symmetryR.current;
      for (let i = 0; i < dots; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * r;
        const sx = x + Math.cos(angle) * dist;
        const sy = y + Math.sin(angle) * dist;
        ctx.beginPath(); ctx.arc(sx, sy, 1.5, 0, Math.PI * 2); ctx.fill();
        if (sym !== "none") {
          const mx2 = sym === "h" ? sx : AW - sx;
          const my2 = sym === "h" ? AH - sy : sy;
          ctx.beginPath(); ctx.arc(mx2, my2, 1.5, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      lastPos.current = { x, y }; render();
    } else if (t === "eraser") {
      ctx.quadraticCurveTo(lastPos.current.x, lastPos.current.y, (x + lastPos.current.x) / 2, (y + lastPos.current.y) / 2);
      ctx.stroke(); ctx.beginPath(); ctx.moveTo((x + lastPos.current.x) / 2, (y + lastPos.current.y) / 2);
      // Symmetry for eraser
      drawMirroredStroke(ctx, (c, mx2, my2) => {
        c.save();
        c.globalCompositeOperation = "destination-out"; c.globalAlpha = 1;
        c.strokeStyle = "rgba(0,0,0,1)"; c.lineWidth = sizeR.current;
        c.lineCap = "round"; c.lineJoin = "round";
        c.beginPath(); c.arc(mx2, my2, sizeR.current / 2, 0, Math.PI * 2); c.fill();
        c.restore();
      }, x, y);
      lastPos.current = { x, y }; render();
    } else if (["rect", "ellipse", "line", "arrow"].includes(t)) {
      if (savedSnap.current) ctx.putImageData(savedSnap.current, 0, 0);
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = opR.current;
      ctx.strokeStyle = colorR.current; ctx.lineWidth = sizeR.current; ctx.lineCap = "round";
      const sx = shapeStart.current.x, sy = shapeStart.current.y;
      ctx.beginPath();
      if (t === "rect") { ctx.rect(sx, sy, x - sx, y - sy); ctx.stroke(); }
      else if (t === "ellipse") { ctx.ellipse((sx + x) / 2, (sy + y) / 2, Math.abs(x - sx) / 2, Math.abs(y - sy) / 2, 0, 0, Math.PI * 2); ctx.stroke(); }
      else if (t === "line") { ctx.moveTo(sx, sy); ctx.lineTo(x, y); ctx.stroke(); }
      else if (t === "arrow") {
        ctx.moveTo(sx, sy); ctx.lineTo(x, y); ctx.stroke();
        const angle = Math.atan2(y - sy, x - sx), hs = Math.min(20, sizeR.current * 3);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - hs * Math.cos(angle - 0.4), y - hs * Math.sin(angle - 0.4));
        ctx.lineTo(x - hs * Math.cos(angle + 0.4), y - hs * Math.sin(angle + 0.4));
        ctx.closePath(); ctx.fillStyle = colorR.current; ctx.fill();
      }
      render();
    }
  }

  function endDraw(clientX: number, clientY: number) {
    if (isPanning.current) { isPanning.current = false; return; }
    if (!isDrawing.current) return;
    isDrawing.current = false;
    moveDraw(clientX, clientY);
    const ctx = getArtCtx();
    if (ctx) { ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1; }
    render(); scheduleSave();
  }

  // Mouse events
  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) { e.preventDefault(); isTouchDrawRef.current = false; startDraw(e.clientX, e.clientY, e.button); }
  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) { moveDraw(e.clientX, e.clientY); }
  function onMouseUp(e: React.MouseEvent<HTMLCanvasElement>) { endDraw(e.clientX, e.clientY); }
  function onMouseLeave(e: React.MouseEvent<HTMLCanvasElement>) { if (isDrawing.current || isPanning.current) endDraw(e.clientX, e.clientY); }

  // Touch events with pinch-to-zoom
  function onTouchStart(e: React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if (e.touches.length === 2) {
      isPanning.current = true;
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      panStart.current = { x: cx, y: cy, px: pxR.current, py: pyR.current };
      lastPinchDistRef.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      return;
    }
    isTouchDrawRef.current = true;
    startDraw(e.touches[0].clientX, e.touches[0].clientY, 0);
  }

  function onTouchMove(e: React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if (e.touches.length === 2) {
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const newDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (lastPinchDistRef.current > 0) {
        const scale = newDist / lastPinchDistRef.current;
        const rect = displayRef.current!.getBoundingClientRect();
        const mx = cx - rect.left, my = cy - rect.top;
        const nz = Math.min(4, Math.max(0.05, zR.current * scale));
        const npx = mx - (mx - pxR.current) * (nz / zR.current);
        const npy = my - (my - pyR.current) * (nz / zR.current);
        zR.current = nz; pxR.current = npx; pyR.current = npy;
        setZoom(nz); setPanX(npx); setPanY(npy);
      }
      lastPinchDistRef.current = newDist;
      // also pan
      const nx = panStart.current.px + (cx - panStart.current.x);
      const ny = panStart.current.py + (cy - panStart.current.y);
      pxR.current = nx; pyR.current = ny; setPanX(nx); setPanY(ny);
      render(); return;
    }
    moveDraw(e.touches[0].clientX, e.touches[0].clientY);
  }

  function onTouchEnd(e: React.TouchEvent<HTMLCanvasElement>) {
    lastPinchDistRef.current = 0;
    if (e.changedTouches[0]) endDraw(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  }

  // Wheel zoom
  function onWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const rect = displayRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    const nz = Math.min(4, Math.max(0.05, zR.current * factor));
    const npx = mx - (mx - pxR.current) * (nz / zR.current);
    const npy = my - (my - pyR.current) * (nz / zR.current);
    zR.current = nz; pxR.current = npx; pyR.current = npy;
    setZoom(nz); setPanX(npx); setPanY(npy); render();
  }

  // Chat
  function sendMessage() {
    if (!chatInput.trim() || !session?.user?.id) return;
    const txt = chatInput.trim(); setChatInput("");
    // Broadcast via PartySocket (server sends updated messages array to all)
    drawSocketRef.current?.send(JSON.stringify({
      type: "chat",
      userId: session.user.id,
      username: session.user.name ?? "Anonymous",
      avatarUrl: (session.user as { image?: string }).image ?? null,
      content: txt,
    }));
    // Persist to DB (fire and forget)
    fetch(`/api/draw-room/${roomId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "message", content: txt }),
    }).catch(() => {});
  }

  // Export
  function exportPNG() {
    const ab = artboard.current; if (!ab) return;
    const link = document.createElement("a"); link.download = `${title || "drawing"}.png`; link.href = ab.toDataURL("image/png"); link.click();
  }

  // Share to feed
  async function shareToFeed() {
    const ab = artboard.current; if (!ab || !session?.user?.id) return;
    const snapshot = ab.toDataURL("image/jpeg", 0.85);
    try {
      await fetch("/api/shares", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "art", title, caption: "", imageData: snapshot }) });
      alert("Shared to feed! ✨");
    } catch { alert("Share failed"); }
  }

  // Boot
  async function bootUser(userId: string) {
    await fetch(`/api/draw-room/${roomId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "boot", userId }) }).catch(() => {});
    setViewers(prev => prev.filter(v => v.user_id !== userId));
  }

  // ── Tool button ────────────────────────────────────────────────────────────
  const TB = ({ t, icon, label }: { t: Tool; icon: string; label: string }) => (
    <button
      title={label}
      onClick={() => setTool(t)}
      style={{
        width: 40, height: 40, borderRadius: 10, border: "none", cursor: "pointer",
        background: tool === t ? "rgba(124,92,191,0.35)" : "transparent",
        color: tool === t ? "var(--accent-purple-bright)" : "var(--text-muted)",
        fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: tool === t ? "0 0 0 1.5px rgba(124,92,191,0.6)" : "none",
        transition: "all 0.12s",
      }}
    >{icon}</button>
  );

  const canDraw = isHost || isCollaborator;

  // Shared button style helper
  const topBarBtn = (active = false, accent = "rgba(255,255,255,0.06)"): React.CSSProperties => ({
    background: active ? accent : "rgba(0,0,0,0.65)",
    backdropFilter: "blur(8px)",
    border: `1px solid ${active ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)"}`,
    borderRadius: 10,
    padding: "6px 10px",
    fontSize: 14,
    color: active ? "#fff" : "var(--text-muted)",
    cursor: "pointer",
    fontWeight: active ? 700 : 400,
    transition: "all 0.15s",
    display: "flex", alignItems: "center", justifyContent: "center",
    minWidth: 36, height: 32,
  });

  return (
    <div
      style={{
        display: "flex",
        ...(isMobile
          ? { position: "fixed", inset: 0, zIndex: 1000 }
          : { height: "calc(100vh - 52px)" }),
        overflow: "hidden",
        position: isMobile ? "fixed" : "relative",
        background: "#131320",
        overscrollBehavior: "none",
        touchAction: "none",
      } as React.CSSProperties}
    >
      {/* ── Portrait overlay: prompt user to rotate ── */}
      {isMobile && !isLandscape && (
        <div style={{ position: "absolute", inset: 0, zIndex: 200, background: "rgba(10,10,20,0.97)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, color: "#fff", padding: 24 }}>
          <div style={{ fontSize: 72 }}>🔄</div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>Rotate to Draw</div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", textAlign: "center", maxWidth: 260, lineHeight: 1.6 }}>
            Turn your phone sideways for the full canvas. You can still save your work below.
          </div>
          {/* Preview thumbnail of current canvas */}
          <div style={{ width: 200, height: 113, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.15)", background: "#fff" }}>
            {artboard.current && <canvas ref={el => { if (el && artboard.current) { el.width = 200; el.height = 113; el.getContext("2d")?.drawImage(artboard.current, 0, 0, 200, 113); } }} width={200} height={113} />}
          </div>
          <button onClick={exportPNG} style={{ background: "rgba(124,92,191,0.7)", border: "1px solid rgba(124,92,191,0.5)", borderRadius: 12, padding: "10px 24px", fontSize: 14, color: "#fff", cursor: "pointer", fontWeight: 700 }}>
            ⬇ Save Drawing
          </button>
        </div>
      )}

      {/* Hidden YouTube player */}
      <div id="yt-player-hidden" style={{ position: "absolute", left: -9999, top: -9999, width: 1, height: 1, overflow: "hidden" }} />

      {/* ── Left Tool Panel (desktop only) ── */}
      {!isMobile && (
        <div style={{
          width: 52, background: "var(--bg-surface)", borderRight: "1px solid var(--border)",
          flexDirection: "column", alignItems: "center", padding: "8px 6px", gap: 3,
          overflowY: "auto", flexShrink: 0, display: "flex",
        } as React.CSSProperties}>
          {canDraw && (<>
            <TB t="pencil" icon="✏️" label="Pencil (P)" />
            <TB t="brush" icon="🖌️" label="Brush (B)" />
            <TB t="spray" icon="💨" label="Spray (S)" />
            <TB t="eraser" icon="🩹" label="Eraser (E)" />
            <div style={{ width: 28, height: 1, background: "var(--border)", margin: "4px 0" }} />
            <TB t="rect" icon="⬜" label="Rectangle (R)" />
            <TB t="ellipse" icon="⭕" label="Ellipse (O)" />
            <TB t="line" icon="╱" label="Line (L)" />
            <TB t="arrow" icon="➡️" label="Arrow (A)" />
            <div style={{ width: 28, height: 1, background: "var(--border)", margin: "4px 0" }} />
            <TB t="fill" icon="🪣" label="Fill (F)" />
            <TB t="eye" icon="💧" label="Eyedropper (I)" />
            <TB t="text" icon="T" label="Text (T)" />
            <div style={{ width: 28, height: 1, background: "var(--border)", margin: "4px 0" }} />
            <button onClick={undo} title="Undo (Ctrl+Z)" style={{ width: 40, height: 40, borderRadius: 10, border: "none", background: "transparent", color: "var(--text-muted)", fontSize: 16, cursor: "pointer" }}>↩</button>
            <button onClick={redo} title="Redo (Ctrl+Y)" style={{ width: 40, height: 40, borderRadius: 10, border: "none", background: "transparent", color: "var(--text-muted)", fontSize: 16, cursor: "pointer" }}>↪</button>
            <div style={{ width: 28, height: 1, background: "var(--border)", margin: "4px 0" }} />
            {/* Symmetry toggle */}
            <button
              title={`Symmetry: ${symmetry}`}
              onClick={() => setSymmetry(s => s === "none" ? "v" : s === "v" ? "h" : "none")}
              style={{
                width: 40, height: 40, borderRadius: 10, border: "none", cursor: "pointer",
                background: symmetry !== "none" ? "rgba(255,120,80,0.25)" : "transparent",
                color: symmetry !== "none" ? "#ff7850" : "var(--text-muted)",
                fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: symmetry !== "none" ? "0 0 0 1.5px rgba(255,120,80,0.5)" : "none",
              }}
            >{symmetry === "none" ? "◫" : symmetry === "v" ? "⇔" : "⇕"}</button>
            <div style={{ width: 28, height: 1, background: "var(--border)", margin: "4px 0" }} />
            {/* Color swatch */}
            <div style={{ position: "relative" }}>
              <label title="Pick color" style={{ cursor: "pointer" }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, border: "2px solid rgba(255,255,255,0.25)", background: color, boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }} />
                <input type="color" value={color} onChange={e => applyColor(e.target.value)} style={{ position: "absolute", opacity: 0, width: 0, height: 0, top: 0, left: 0 }} />
              </label>
            </div>
          </>)}
          <div style={{ flex: 1 }} />
          <button onClick={fitToWindow} title="Fit canvas (0)" style={{ width: 40, height: 40, borderRadius: 10, border: "none", background: "transparent", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>⊡</button>
        </div>
      )}

      {/* ── Canvas Workspace ── */}
      <div ref={containerRef} style={{ flex: 1, position: "relative", overflow: "hidden", minWidth: 0 }}>
        <canvas
          ref={displayRef}
          style={{ position: "absolute", inset: 0, cursor: canDraw ? (tool === "eye" ? "crosshair" : tool === "fill" ? "cell" : spaceHeld.current ? "grab" : "crosshair") : "default", touchAction: "none" }}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseLeave}
          onWheel={onWheel}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
          onContextMenu={e => e.preventDefault()}
        />
        <canvas ref={overlayRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />

        {/* Top bar */}
        <div style={{ position: "absolute", top: 10, left: 10, right: 10, display: "flex", alignItems: "center", gap: 6, pointerEvents: "none" }}>
          {/* Title */}
          <div style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "6px 14px", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", maxWidth: isMobile ? 120 : 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {title}
          </div>
          {/* Viewer count — hide on mobile to save space */}
          {!isMobile && (
            <div style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "6px 12px", fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
              👁️ {viewers.length} watching
            </div>
          )}
          <div style={{ flex: 1 }} />
          {/* Action buttons */}
          <div style={{ display: "flex", gap: 5, pointerEvents: "all" }}>
            {/* Grid toggle */}
            {canDraw && (
              <button onClick={() => setShowGrid(g => !g)} style={topBarBtn(showGrid, "rgba(100,100,200,0.3)")} title="Toggle grid">
                ⊞
              </button>
            )}
            {/* Coloring book */}
            {canDraw && (
              <button onClick={() => setColoringBookOpen(true)} style={topBarBtn(false)} title="Coloring book templates">
                🎨
              </button>
            )}
            {/* Clear canvas */}
            {canDraw && (
              <button
                onClick={() => { if (confirm("Clear canvas? This can be undone.")) clearCanvas(); }}
                style={topBarBtn(false)}
                title="Clear canvas"
              >
                🗑️
              </button>
            )}
            {/* Save / Share */}
            <button onClick={exportPNG} style={{ ...topBarBtn(), padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "#fff" }}>⬇ Save</button>
            {isHost && <button onClick={shareToFeed} style={{ background: "rgba(124,92,191,0.7)", backdropFilter: "blur(8px)", border: "1px solid rgba(124,92,191,0.5)", borderRadius: 10, padding: "6px 12px", fontSize: 12, color: "#fff", cursor: "pointer", fontWeight: 700 }}>✨ Share</button>}
          </div>
        </div>

        {/* Zoom indicator */}
        <div style={{ position: "absolute", bottom: isMobile ? 72 : 54, left: 10, background: "rgba(0,0,0,0.5)", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "var(--text-muted)", display: "flex", gap: 6, alignItems: "center" }}>
          <button onClick={() => { const nz = Math.min(4, zoom * 1.25); zR.current = nz; setZoom(nz); render(); }} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>+</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={() => { const nz = Math.max(0.05, zoom * 0.8); zR.current = nz; setZoom(nz); render(); }} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>−</button>
          <span style={{ opacity: 0.5 }}>·</span>
          <button onClick={fitToWindow} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 11 }}>Fit</button>
        </div>

        {/* ── Bottom options bar (desktop only, host/collaborator) ── */}
        {canDraw && !isMobile && (
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(13,13,18,0.9)", backdropFilter: "blur(8px)", borderTop: "1px solid var(--border)", padding: "8px 14px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            {/* Brush size */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 28, userSelect: "none" }}>Size</span>
              <input type="range" min={1} max={120} value={size} onChange={e => { const v = +e.target.value; setSize(v); sizeR.current = v; }} style={{ width: 100, accentColor: "var(--accent-purple)" }} />
              <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 20 }}>{size}</span>
            </div>
            {/* Opacity */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 28, userSelect: "none" }}>Opacity</span>
              <input type="range" min={1} max={100} value={Math.round(opacity * 100)} onChange={e => { const v = +e.target.value / 100; setOpacity(v); opR.current = v; }} style={{ width: 100, accentColor: "var(--accent-purple)" }} />
              <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 20 }}>{Math.round(opacity * 100)}%</span>
            </div>
            {/* Palette */}
            <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
              {PALETTE.slice(0, 20).map(c => (
                <button key={c} onClick={() => applyColor(c)} style={{ width: 20, height: 20, borderRadius: 5, background: c, border: color === c ? "2px solid #fff" : "1px solid rgba(255,255,255,0.2)", cursor: "pointer", flexShrink: 0 }} />
              ))}
              <label title="Custom color" style={{ cursor: "pointer", position: "relative" }}>
                <div style={{ width: 20, height: 20, borderRadius: 5, background: "conic-gradient(red,yellow,lime,cyan,blue,magenta,red)", border: "1px solid rgba(255,255,255,0.3)" }} />
                <input type="color" value={color} onChange={e => applyColor(e.target.value)} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
              </label>
            </div>
            {/* Recent colors */}
            {recentColors.length > 0 && (
              <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Recent:</span>
                {recentColors.slice(0, 6).map((c, i) => (
                  <button key={i} onClick={() => applyColor(c)} style={{ width: 18, height: 18, borderRadius: 4, background: c, border: color === c ? "2px solid #fff" : "1px solid rgba(255,255,255,0.15)", cursor: "pointer" }} />
                ))}
              </div>
            )}
            <div style={{ flex: 1 }} />
            {/* Chat + Music toggles */}
            <button onClick={() => setChatOpen(o => !o)} style={{ background: chatOpen ? "rgba(124,92,191,0.3)" : "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 10px", fontSize: 12, color: chatOpen ? "var(--accent-purple-bright)" : "var(--text-muted)", cursor: "pointer" }}>💬 Chat</button>
            <button onClick={() => setMusicOpen(o => !o)} style={{ background: musicOpen ? "rgba(74,144,217,0.25)" : "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 10px", fontSize: 12, color: musicOpen ? "#4a90d9" : "var(--text-muted)", cursor: "pointer" }}>🎵 Music</button>
          </div>
        )}

        {/* Viewer bottom bar (desktop, non-collaborator viewers only) */}
        {!canDraw && !isMobile && (
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(13,13,18,0.85)", backdropFilter: "blur(8px)", borderTop: "1px solid var(--border)", padding: "8px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>👁 Watching live</span>
            <div style={{ flex: 1 }} />
            <button onClick={() => setChatOpen(o => !o)} style={{ background: chatOpen ? "rgba(124,92,191,0.3)" : "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 10px", fontSize: 12, color: chatOpen ? "var(--accent-purple-bright)" : "var(--text-muted)", cursor: "pointer" }}>💬 Chat</button>
          </div>
        )}

        {/* ── Mobile floating toolbar ── */}
        {isMobile && canDraw && (
          <div style={{ position: "absolute", bottom: 16, left: 12, display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start", zIndex: 10 }}>
            {/* Tool picker popup */}
            {mobileToolOpen && (
              <div style={{ background: "rgba(13,13,22,0.92)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: "10px 8px", display: "flex", flexDirection: "column", gap: 6, boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
                {/* Tool row */}
                <div style={{ display: "flex", gap: 4 }}>
                  {([
                    { t: "pencil" as Tool, icon: "✏️" }, { t: "brush" as Tool, icon: "🖌️" }, { t: "spray" as Tool, icon: "💨" },
                    { t: "eraser" as Tool, icon: "🩹" }, { t: "fill" as Tool, icon: "🪣" }, { t: "text" as Tool, icon: "T" },
                    { t: "rect" as Tool, icon: "⬜" }, { t: "ellipse" as Tool, icon: "⭕" },
                  ]).map(({ t, icon }) => (
                    <button key={t} onClick={() => { setTool(t); setMobileToolOpen(false); }}
                      style={{ width: 38, height: 38, borderRadius: 9, border: "none", cursor: "pointer", background: tool === t ? "rgba(124,92,191,0.4)" : "rgba(255,255,255,0.06)", color: tool === t ? "var(--accent-purple-bright)" : "var(--text-muted)", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: tool === t ? "0 0 0 1.5px rgba(124,92,191,0.6)" : "none" }}
                    >{icon}</button>
                  ))}
                </div>
                {/* Size slider */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 2 }}>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", width: 28 }}>Size</span>
                  <input type="range" min={1} max={120} value={size} onChange={e => { const v = +e.target.value; setSize(v); sizeR.current = v; }} style={{ flex: 1, accentColor: "var(--accent-purple)", minWidth: 100 }} />
                  <span style={{ fontSize: 10, color: "var(--text-muted)", width: 22 }}>{size}</span>
                </div>
                {/* Opacity slider */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", width: 28 }}>Opacity</span>
                  <input type="range" min={1} max={100} value={Math.round(opacity * 100)} onChange={e => { const v = +e.target.value / 100; setOpacity(v); opR.current = v; }} style={{ flex: 1, accentColor: "var(--accent-purple)", minWidth: 100 }} />
                  <span style={{ fontSize: 10, color: "var(--text-muted)", width: 22 }}>{Math.round(opacity * 100)}%</span>
                </div>
                {/* Undo/Redo */}
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={undo} style={{ flex: 1, height: 32, borderRadius: 8, border: "none", background: "rgba(255,255,255,0.06)", color: "var(--text-muted)", fontSize: 14, cursor: "pointer" }}>↩ Undo</button>
                  <button onClick={redo} style={{ flex: 1, height: 32, borderRadius: 8, border: "none", background: "rgba(255,255,255,0.06)", color: "var(--text-muted)", fontSize: 14, cursor: "pointer" }}>↪ Redo</button>
                </div>
                {/* Symmetry */}
                <button
                  onClick={() => setSymmetry(s => s === "none" ? "v" : s === "v" ? "h" : "none")}
                  style={{ height: 32, borderRadius: 8, border: "none", cursor: "pointer", background: symmetry !== "none" ? "rgba(255,120,80,0.25)" : "rgba(255,255,255,0.06)", color: symmetry !== "none" ? "#ff7850" : "var(--text-muted)", fontSize: 12 }}
                >
                  {symmetry === "none" ? "◫ No Symmetry" : symmetry === "v" ? "⇔ Vertical Mirror" : "⇕ Horizontal Mirror"}
                </button>
                {/* Stabilizer + pressure toggle */}
                <button
                  onClick={() => setStabilizerOn(s => !s)}
                  style={{ height: 32, borderRadius: 8, border: "none", cursor: "pointer", background: stabilizerOn ? "rgba(80,200,120,0.2)" : "rgba(255,255,255,0.06)", color: stabilizerOn ? "#50c878" : "var(--text-muted)", fontSize: 12 }}
                >
                  {stabilizerOn ? "✦ Stabilizer + Pressure ON" : "○ Stabilizer OFF"}
                </button>
              </div>
            )}

            {/* Color palette popup */}
            {mobilePaletteOpen && (
              <div style={{ background: "rgba(13,13,22,0.92)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: "10px", display: "flex", flexWrap: "wrap", gap: 4, width: 220, boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
                {PALETTE.map(c => (
                  <button key={c} onClick={() => { applyColor(c); setMobilePaletteOpen(false); }} style={{ width: 26, height: 26, borderRadius: 6, background: c, border: color === c ? "2px solid #fff" : "1px solid rgba(255,255,255,0.15)", cursor: "pointer", flexShrink: 0 }} />
                ))}
                <label style={{ cursor: "pointer", position: "relative", width: 26, height: 26 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 6, background: "conic-gradient(red,yellow,lime,cyan,blue,magenta,red)", border: "1px solid rgba(255,255,255,0.3)" }} />
                  <input type="color" value={color} onChange={e => { applyColor(e.target.value); setMobilePaletteOpen(false); }} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
                </label>
              </div>
            )}

            {/* Floating pill buttons */}
            <div style={{ display: "flex", gap: 8 }}>
              {/* Color pill */}
              <button
                onClick={() => { setMobilePaletteOpen(o => !o); setMobileToolOpen(false); }}
                style={{ width: 44, height: 44, borderRadius: 14, border: "2px solid rgba(255,255,255,0.25)", background: color, cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.5)", flexShrink: 0 }}
                title="Color"
              />
              {/* Tool pill */}
              <button
                onClick={() => { setMobileToolOpen(o => !o); setMobilePaletteOpen(false); }}
                style={{ width: 44, height: 44, borderRadius: 14, border: "none", background: mobileToolOpen ? "rgba(124,92,191,0.8)" : "rgba(13,13,22,0.85)", backdropFilter: "blur(8px)", color: "#fff", cursor: "pointer", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}
                title="Tools"
              >
                {mobileToolOpen ? "×" : "🔧"}
              </button>
              {/* Chat pill */}
              <button
                onClick={() => setChatOpen(o => !o)}
                style={{ width: 44, height: 44, borderRadius: 14, border: "none", background: chatOpen ? "rgba(124,92,191,0.7)" : "rgba(13,13,22,0.85)", backdropFilter: "blur(8px)", color: "#fff", cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}
                title="Chat"
              >
                💬
              </button>
            </div>
          </div>
        )}

        {/* Mobile viewer pill */}
        {isMobile && !canDraw && (
          <div style={{ position: "absolute", bottom: 16, left: 12, display: "flex", gap: 8 }}>
            <div style={{ background: "rgba(13,13,22,0.8)", backdropFilter: "blur(8px)", borderRadius: 14, padding: "10px 14px", fontSize: 12, color: "var(--text-muted)" }}>👁 Watching</div>
            <button onClick={() => setChatOpen(o => !o)} style={{ width: 44, height: 44, borderRadius: 14, border: "none", background: chatOpen ? "rgba(124,92,191,0.7)" : "rgba(13,13,22,0.85)", color: "#fff", cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>💬</button>
          </div>
        )}

        {/* ── Music Player ── */}
        {musicOpen && (
          <div style={{ position: "absolute", bottom: canDraw ? (isMobile ? 16 : 56) : 48, right: chatOpen ? (isMobile ? 0 : 288) : 10, background: "rgba(13,13,22,0.95)", backdropFilter: "blur(12px)", border: "1px solid rgba(74,144,217,0.3)", borderRadius: 16, padding: "14px 16px", width: 280, boxShadow: "0 12px 40px rgba(0,0,0,0.6)", zIndex: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#4a90d9" }}>🎵 Focus Music</span>
              <button onClick={() => setMusicOpen(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ background: "rgba(74,144,217,0.1)", borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{TRACKS[trackIdx].title}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{TRACKS[trackIdx].label}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <button onClick={() => playTrack((trackIdx - 1 + TRACKS.length) % TRACKS.length)} style={{ background: "rgba(255,255,255,0.06)", border: "none", color: "#fff", borderRadius: 7, width: 32, height: 32, cursor: "pointer", fontSize: 14 }}>⏮</button>
              <button onClick={togglePlay} style={{ background: isPlaying ? "rgba(74,144,217,0.4)" : "rgba(74,144,217,0.15)", border: "1px solid rgba(74,144,217,0.5)", color: "#fff", borderRadius: 10, width: 44, height: 44, cursor: "pointer", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {isPlaying ? "⏸" : "▶"}
              </button>
              <button onClick={() => playTrack((trackIdx + 1) % TRACKS.length)} style={{ background: "rgba(255,255,255,0.06)", border: "none", color: "#fff", borderRadius: 7, width: 32, height: 32, cursor: "pointer", fontSize: 14 }}>⏭</button>
              <div style={{ flex: 1 }}>
                <input type="range" min={0} max={100} value={volume} onChange={e => setVol(+e.target.value)} style={{ width: "100%", accentColor: "#4a90d9" }} />
              </div>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{volume}</span>
            </div>
            <button onClick={() => setTrackListOpen(o => !o)} style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 11, color: "var(--text-muted)", cursor: "pointer", textAlign: "left" }}>
              {trackListOpen ? "▲ Hide tracks" : "▼ All tracks"}
            </button>
            {trackListOpen && (
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 2 }}>
                {TRACKS.map((tr, i) => (
                  <button key={i} onClick={() => { playTrack(i); setTrackListOpen(false); }} style={{ background: i === trackIdx ? "rgba(74,144,217,0.2)" : "transparent", border: "none", color: i === trackIdx ? "#4a90d9" : "var(--text-secondary)", borderRadius: 7, padding: "7px 10px", fontSize: 12, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                    {i === trackIdx && isPlaying ? "♪ " : ""}{tr.title}
                    <span style={{ float: "right", fontSize: 10, color: "var(--text-muted)" }}>{tr.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Coloring Book Modal ── */}
        {coloringBookOpen && (
          <div
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
            onClick={e => { if (e.target === e.currentTarget) { setColoringBookOpen(false); setColoringConfirm(null); setAiColoringError(null); } }}
          >
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 20, padding: "24px", width: isMobile ? "96vw" : 580, boxShadow: "0 24px 80px rgba(0,0,0,0.9)", maxHeight: "88vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 0 }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>🎨 Coloring Book</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Lines lock — draw freely inside. Blank canvas always available.</div>
                </div>
                <button onClick={() => { setColoringBookOpen(false); setColoringConfirm(null); setAiColoringError(null); }} style={{ background: "rgba(255,255,255,0.06)", border: "none", color: "var(--text-muted)", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 18 }}>×</button>
              </div>

              {/* Blank canvas shortcut */}
              <button onClick={() => { clearCanvas(); coloringBookLayerRef.current = null; setColoringBookOpen(false); }}
                style={{ marginBottom: 12, padding: "9px 16px", borderRadius: 12, border: "1px dashed rgba(255,255,255,0.2)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: 13, textAlign: "left" }}>
                🖊 Blank canvas — just draw freely
              </button>

              {/* Category tabs — horizontal scroll */}
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 12, scrollbarWidth: "none" }}>
                {COLORING_CATEGORIES.map((cat, i) => (
                  <button key={cat.category} onClick={() => { setColoringCategory(i); setColoringConfirm(null); }}
                    style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
                      background: coloringCategory === i ? "var(--accent-purple)" : "rgba(255,255,255,0.06)",
                      color: coloringCategory === i ? "#fff" : "var(--text-muted)" }}>
                    {cat.emoji} {cat.category}
                  </button>
                ))}
                {/* Custom AI tab */}
                <button onClick={() => { setColoringCategory(-1); setColoringConfirm(null); }}
                  style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
                    background: coloringCategory === -1 ? "var(--accent-purple)" : "rgba(255,255,255,0.06)",
                    color: coloringCategory === -1 ? "#fff" : "var(--text-muted)" }}>
                  🔮 Custom AI
                </button>
              </div>

              {/* Confirm overlay */}
              {coloringConfirm ? (
                <div style={{ textAlign: "center", padding: "16px 0" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>
                    {COLORING_CATEGORIES.flatMap(c => c.presets).find(p => p.file === coloringConfirm)?.emoji}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
                    Load {COLORING_CATEGORIES.flatMap(c => c.presets).find(p => p.file === coloringConfirm)?.label}?
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Canvas will clear. Lines will be locked on top.</div>
                  <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                    <button onClick={() => setColoringConfirm(null)} style={{ padding: "8px 20px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: 13 }}>Cancel</button>
                    <button onClick={() => { loadColoringBookImage(`/coloring/${coloringConfirm}.png`); setColoringConfirm(null); setColoringBookOpen(false); }}
                      style={{ padding: "8px 20px", borderRadius: 10, border: "none", background: "var(--accent-purple)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Yes, Load It!</button>
                  </div>
                </div>

              ) : coloringCategory === -1 ? (
                /* Custom AI generation */
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>Describe anything — dragons, fairies, abstract patterns, your favorite scene…</div>
                  <textarea
                    value={aiColoringPrompt}
                    onChange={e => setAiColoringPrompt(e.target.value)}
                    placeholder="e.g. a wizard casting spells in an ancient library with magical runes…"
                    rows={3}
                    style={{ width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", color: "var(--text-primary)", fontSize: 14, outline: "none", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
                  />
                  <button
                    onClick={() => { if (aiColoringPrompt.trim()) generateAiColoringBook(aiColoringPrompt.trim()); }}
                    disabled={aiColoringLoading || !aiColoringPrompt.trim()}
                    style={{ marginTop: 12, width: "100%", padding: "11px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))", color: "#fff", fontSize: 14, fontWeight: 700, cursor: aiColoringLoading || !aiColoringPrompt.trim() ? "not-allowed" : "pointer", opacity: aiColoringPrompt.trim() && !aiColoringLoading ? 1 : 0.5 }}
                  >
                    {aiColoringLoading ? "✨ Generating…" : "✨ Generate Coloring Page"}
                  </button>
                  {aiColoringError && <div style={{ color: "#f87171", fontSize: 12, marginTop: 10, textAlign: "center" }}>{aiColoringError}</div>}
                </div>

              ) : (
                /* Pre-generated presets grid */
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  {COLORING_CATEGORIES[coloringCategory]?.presets.map(preset => (
                    <button key={preset.file} onClick={() => setColoringConfirm(preset.file)}
                      style={{ aspectRatio: "1", borderRadius: 14, border: "1px solid var(--border)", background: "rgba(255,255,255,0.04)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, padding: 8, transition: "all 0.15s", overflow: "hidden", position: "relative" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(124,92,191,0.25)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; }}>
                      {/* Thumbnail preview if image exists */}
                      <img src={`/coloring/${preset.file}.png`} alt={preset.label}
                        style={{ width: "100%", height: "60%", objectFit: "cover", borderRadius: 8, background: "#fff" }}
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                      <span style={{ fontSize: 22 }}>{preset.emoji}</span>
                      <span style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 600, textAlign: "center", lineHeight: 1.2 }}>{preset.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Chat Panel ── */}
      {chatOpen && (
        <div style={{ width: isMobile ? "100%" : 280, background: "var(--bg-surface)", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", flexShrink: 0, position: isMobile ? "absolute" : "relative", inset: isMobile ? "0" : "auto", zIndex: isMobile ? 50 : "auto" }}>
          {/* Chat header */}
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>💬 Live Chat</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {isHost && (
                <button
                  onClick={async () => { const a = !allowViewers; setAllowViewers(a); await fetch(`/api/draw-room/${roomId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "set-viewers", allow: a }) }); }}
                  title={allowViewers ? "Disable viewer chat" : "Enable viewer chat"}
                  style={{ background: "transparent", border: "none", color: allowViewers ? "var(--accent-green)" : "var(--text-muted)", cursor: "pointer", fontSize: 16, lineHeight: 1 }}
                >{allowViewers ? "👁" : "🚫"}</button>
              )}
              <button onClick={() => setChatOpen(false)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
          </div>

          {/* Viewers */}
          {viewers.length > 0 && (
            <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: 5 }}>👁 {viewers.length} watching</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {viewers.map(v => (
                  <div
                    key={v.user_id}
                    title={v.is_collaborator ? `${v.username} — can draw (right-click to revoke)` : isHost ? `${v.username} — right-click to grant draw access` : `@${v.username}`}
                    style={{ display: "flex", alignItems: "center", gap: 4, background: v.is_collaborator ? "rgba(124,92,191,0.15)" : "rgba(255,255,255,0.04)", borderRadius: 6, padding: "3px 7px", cursor: "pointer", border: v.is_collaborator ? "1px solid rgba(124,92,191,0.35)" : "1px solid transparent" }}
                    onContextMenu={e => { e.preventDefault(); setContextMenu({ username: v.username, userId: v.user_id, x: e.clientX, y: e.clientY }); }}
                  >
                    <img src={v.avatar_url ?? `https://api.dicebear.com/9.x/pixel-art/svg?seed=${v.username}`} style={{ width: 16, height: 16, borderRadius: 4 }} alt="" />
                    <Link href={`/profile/${v.username}`} style={{ fontSize: 11, color: v.is_collaborator ? "var(--accent-purple-bright)" : "var(--text-secondary)", textDecoration: "none", fontWeight: v.is_collaborator ? 700 : 400 }} onClick={e => e.stopPropagation()}>@{v.username}</Link>
                    {v.is_collaborator && <span style={{ fontSize: 10 }}>🎨</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
            {messages.map(msg => (
              <div key={msg.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <Link href={`/profile/${msg.username}`}>
                  <img src={msg.avatar_url ?? `https://api.dicebear.com/9.x/pixel-art/svg?seed=${msg.username}`} style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 2 }} alt="" />
                </Link>
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                    <Link href={`/profile/${msg.username}`} style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-purple-bright)", textDecoration: "none" }} onContextMenu={e => { e.preventDefault(); setContextMenu({ username: msg.username, userId: msg.user_id, x: e.clientX, y: e.clientY }); }}>@{msg.username}</Link>
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.4, marginTop: 1 }}>{msg.content}</div>
                </div>
              </div>
            ))}
            <div ref={chatBottomRef} />
          </div>

          {/* Chat input */}
          {session?.user?.id ? (
            <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border)", display: "flex", gap: 6 }}>
              <input
                value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Say something..."
                style={{ flex: 1, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 11px", color: "var(--text-primary)", fontSize: 13, outline: "none", fontFamily: "inherit" }}
              />
              <button onClick={sendMessage} style={{ background: "var(--accent-purple)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>→</button>
            </div>
          ) : (
            <div style={{ padding: "12px", borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
              <Link href="/signin" style={{ color: "var(--accent-purple-bright)" }}>Sign in</Link> to chat
            </div>
          )}
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <UserContextMenu
          user={contextMenu}
          isHost={isHost}
          onClose={() => setContextMenu(null)}
          onBoot={isHost ? bootUser : undefined}
          extraItems={isHost ? (() => {
            const viewer = viewers.find(v => v.user_id === contextMenu.userId);
            if (!viewer) return [];
            const isCollab = !!viewer.is_collaborator;
            return [{
              label: isCollab ? "Revoke Draw Access" : "Grant Draw Access",
              icon: isCollab ? "🚫" : "🎨",
              onClick: async () => {
                await fetch(`/api/draw-room/${roomId}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: isCollab ? "revoke-collab" : "grant-collab", userId: contextMenu.userId }),
                });
                // Broadcast collab change via PartySocket (viewers list updates for everyone)
                drawSocketRef.current?.send(JSON.stringify({ type: "set-collaborator", userId: contextMenu.userId, isCollaborator: !isCollab }));
              },
            }];
          })() : []}
        />
      )}
    </div>
  );
}
