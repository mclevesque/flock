"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  WALLPAPERS, FLOORS, FURNITURE, PETS,
  type HouseConfig, DEFAULT_HOUSE_CONFIG,
} from "@/app/components/houseData";
import HouseInterior from "@/app/components/HouseInterior";

// ─── Constants ──────────────────────────────────────────────────────────────
const WALL_PCT  = 0.30;  // top 30% = wall backdrop, bottom 70% = walkable floor
const SPEED     = 3.8;
const PLAYER_R  = 18;
const CELL      = 56; // px per furniture grid cell

// Categories that block player movement
const SOLID_CATEGORIES = new Set(["bed", "table", "storage", "seating", "special"]);
// Categories you can interact with (click to get a fun message)
const INTERACT_MESSAGES: Record<string, string[]> = {
  seating: ["You take a seat. Very comfy.", "Ah, relaxing...", "Nice chair."],
  bed:     ["Zzz... not yet.", "Looks cozy!", "You resist the urge to nap."],
  table:   ["A fine table.", "Sturdy craftsmanship.", "Dinner time soon?"],
  storage: ["It's locked.", "Wonder what's inside...", "You peek inside. Nothing interesting."],
  special: ["Magical energies swirl...", "You feel a strange power.", "Whoa, spooky!"],
  tech:    ["Beep boop.", "High-tech!", "You poke a button."],
  decor:   ["Very tasteful.", "Nice decoration.", "Lovely!"],
  plant:   ["A healthy plant.", "So green!", "You water it a little."],
  lighting:["It flickers.", "Warm glow.", "Bright!"],
};

interface LivePet {
  instanceId: string;
  petId: string;
  name: string;
  x: number; y: number;
  tx: number; ty: number;
  countdown: number;
}

interface FurnitureBox {
  instanceId: string;
  furnitureId: string;
  fx: number; fy: number;   // center pixel
  bx: number; by: number;   // top-left pixel
  bw: number; bh: number;   // pixel size
  solid: boolean;
  category: string;
}

interface Interaction { msg: string; x: number; y: number; alpha: number; }

interface Props {
  userId: string;
  viewerId: string;
  username: string;
  viewerUsername: string;
  viewerAvatarUrl?: string | null;
  onClose: () => void;
}

export default function HouseRoom({
  userId, viewerId, username,
  viewerUsername, viewerAvatarUrl, onClose,
}: Props) {
  const isOwner = userId === viewerId;

  const [config, setConfig]     = useState<HouseConfig>({ ...DEFAULT_HOUSE_CONFIG, userId });
  const [loading, setLoading]   = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const keysRef        = useRef<Set<string>>(new Set());
  const playerRef      = useRef({ x: 0, y: 0, initDone: false });
  const targetRef      = useRef<{ x: number; y: number } | null>(null);
  const rafRef         = useRef<number>(0);
  const configRef      = useRef(config);
  const avatarImgRef   = useRef<HTMLImageElement | null>(null);
  const petsRef        = useRef<LivePet[]>([]);
  const boxesRef       = useRef<FurnitureBox[]>([]); // computed once per config change
  const interactionRef = useRef<Interaction | null>(null);

  // ── Load config ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/house?userId=${userId}`)
      .then(r => r.json())
      .then(({ config: c }) => {
        if (c) {
          const loaded: HouseConfig = {
            userId: c.user_id,
            exteriorStyle: c.exterior_style ?? "cottage",
            wallpaper: c.wallpaper ?? "cream",
            floorType: c.floor_type ?? "hardwood",
            furniture: c.furniture ?? [],
            pets: c.pets ?? [],
          };
          setConfig(loaded);
          configRef.current = loaded;
        }
      })
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => { configRef.current = config; }, [config]);

  // ── Load avatar ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!viewerAvatarUrl) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = viewerAvatarUrl;
    img.onload = () => { avatarImgRef.current = img; };
  }, [viewerAvatarUrl]);

  // ── Reload after edit ────────────────────────────────────────────────────
  const reloadConfig = useCallback(() => {
    fetch(`/api/house?userId=${userId}`)
      .then(r => r.json())
      .then(({ config: c }) => {
        if (c) {
          const reloaded: HouseConfig = {
            userId: c.user_id,
            exteriorStyle: c.exterior_style ?? "cottage",
            wallpaper: c.wallpaper ?? "cream",
            floorType: c.floor_type ?? "hardwood",
            furniture: c.furniture ?? [],
            pets: c.pets ?? [],
          };
          setConfig(reloaded);
          configRef.current = reloaded;
          petsRef.current = [];
          boxesRef.current = [];
        }
      });
  }, [userId]);

  // ── Compute furniture collision boxes ────────────────────────────────────
  function buildBoxes(W: number, ft: number, fb: number) {
    const cfg = configRef.current;
    const floorH = fb - ft;
    boxesRef.current = cfg.furniture.map(pf => {
      const item = FURNITURE.find(f => f.id === pf.furnitureId)!;
      if (!item) return null!;
      const bw = item.w * CELL;
      const bh = item.h * CELL;
      const fx = (pf.x / 100) * W;
      const fy = ft + (pf.y / 100) * floorH * 0.88 + 36;
      return {
        instanceId: pf.instanceId,
        furnitureId: pf.furnitureId,
        fx, fy,
        bx: fx - bw / 2,
        by: fy - bh,
        bw, bh,
        solid: SOLID_CATEGORIES.has(item.category),
        category: item.category,
      };
    }).filter(Boolean);
  }

  // ── AABB circle vs rectangle push-out ───────────────────────────────────
  function resolveCollisions(px: number, py: number): { x: number; y: number } {
    let x = px, y = py;
    for (const box of boxesRef.current) {
      if (!box.solid) continue;
      // Nearest point on rect to circle center
      const nx = Math.max(box.bx, Math.min(x, box.bx + box.bw));
      const ny = Math.max(box.by, Math.min(y, box.by + box.bh));
      const dx = x - nx, dy = y - ny;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < PLAYER_R && dist > 0) {
        // Push out
        const push = (PLAYER_R - dist) / dist;
        x += dx * push;
        y += dy * push;
      }
    }
    return { x, y };
  }

  // ── Main loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      canvas!.width  = window.innerWidth;
      canvas!.height = window.innerHeight;
      boxesRef.current = []; // invalidate, rebuild next frame
    }
    resize();
    window.addEventListener("resize", resize);

    const floorTop    = () => canvas!.height * WALL_PCT;
    const floorBottom = () => canvas!.height * 0.94;

    if (!playerRef.current.initDone) {
      playerRef.current = {
        x: canvas.width / 2,
        y: floorTop() + (floorBottom() - floorTop()) * 0.35,
        initDone: true,
      };
    }

    function spawnPets() {
      const cfg = configRef.current;
      if (petsRef.current.length === cfg.pets.length) return;
      const ft = floorTop(), fb = floorBottom();
      petsRef.current = cfg.pets.map((p, i) => {
        const x = canvas!.width * (0.2 + (i / Math.max(cfg.pets.length, 1)) * 0.6);
        const y = ft + (fb - ft) * 0.4 + Math.random() * (fb - ft) * 0.3;
        return { ...p, x, y, tx: x, ty: y, countdown: 1500 + Math.random() * 3000 };
      });
    }
    spawnPets();

    let lastTime = performance.now();

    function loop(now: number) {
      const delta = Math.min(now - lastTime, 50);
      lastTime = now;

      const W  = canvas!.width;
      const H  = canvas!.height;
      const ft = H * WALL_PCT;
      const fb = H * 0.94;

      // Build boxes if invalidated
      if (boxesRef.current.length === 0 && configRef.current.furniture.length > 0) {
        buildBoxes(W, ft, fb);
      }

      // Player movement
      const keys = keysRef.current;
      let dx = 0, dy = 0;
      if (keys.has("ArrowLeft")  || keys.has("a") || keys.has("A")) dx -= SPEED;
      if (keys.has("ArrowRight") || keys.has("d") || keys.has("D")) dx += SPEED;
      if (keys.has("ArrowUp")    || keys.has("w") || keys.has("W")) dy -= SPEED;
      if (keys.has("ArrowDown")  || keys.has("s") || keys.has("S")) dy += SPEED;

      const p = playerRef.current;
      const tgt = targetRef.current;
      if (tgt && dx === 0 && dy === 0) {
        const tdx = tgt.x - p.x, tdy = tgt.y - p.y;
        const dist = Math.sqrt(tdx * tdx + tdy * tdy);
        if (dist < SPEED * 1.5) { targetRef.current = null; }
        else { dx = (tdx / dist) * SPEED; dy = (tdy / dist) * SPEED; }
      }

      const sideWall = Math.round(W * 0.045) + PLAYER_R + 4;
      let nx = Math.max(sideWall, Math.min(W - sideWall, p.x + dx));
      let ny = Math.max(ft + PLAYER_R + 8, Math.min(fb - PLAYER_R - 4, p.y + dy));

      // Resolve furniture collisions
      const resolved = resolveCollisions(nx, ny);
      p.x = resolved.x;
      p.y = resolved.y;

      // Pet wander
      spawnPets();
      for (const pet of petsRef.current) {
        pet.countdown -= delta;
        if (pet.countdown <= 0) {
          pet.tx = W * 0.08 + Math.random() * W * 0.84;
          pet.ty = ft + 16 + Math.random() * (fb - ft - 32);
          pet.countdown = 1800 + Math.random() * 4000;
        }
        const pdx = pet.tx - pet.x, pdy = pet.ty - pet.y;
        const dist = Math.sqrt(pdx * pdx + pdy * pdy);
        if (dist > 2) {
          const spd = 0.028 * delta;
          pet.x += (pdx / dist) * spd;
          pet.y += (pdy / dist) * spd;
        }
      }

      // Fade interaction popup
      if (interactionRef.current) {
        interactionRef.current.alpha -= delta * 0.001;
        interactionRef.current.y -= delta * 0.02;
        if (interactionRef.current.alpha <= 0) interactionRef.current = null;
      }

      // ── Draw ────────────────────────────────────────────────────────────
      ctx!.clearRect(0, 0, W, H);

      // Side walls (left + right strips — drawn over CSS background to frame room)
      const sideW = Math.round(W * 0.045); // ~4.5% wide side walls
      ctx!.fillStyle = "rgba(0,0,0,0.22)";
      ctx!.fillRect(0, 0, sideW, H);
      ctx!.fillRect(W - sideW, 0, sideW, H);
      // Side wall highlight (inner edge)
      ctx!.fillStyle = "rgba(255,255,255,0.06)";
      ctx!.fillRect(sideW, 0, 3, H);
      ctx!.fillRect(W - sideW - 3, 0, 3, H);

      // Crown molding (where wall meets ceiling)
      ctx!.fillStyle = "rgba(0,0,0,0.18)";
      ctx!.fillRect(0, ft * 0.7, W, ft * 0.3);
      ctx!.fillStyle = "rgba(255,255,255,0.08)";
      ctx!.fillRect(sideW, ft * 0.7, W - sideW * 2, 2);

      // Windows on the wall area (2 symmetric windows)
      const winY = ft * 0.18, winH = ft * 0.55, winW = W * 0.11;
      const win1X = W * 0.22, win2X = W * 0.67;
      [win1X, win2X].forEach(wx => {
        // Window frame (outer)
        ctx!.fillStyle = "rgba(0,0,0,0.35)";
        ctx!.fillRect(wx - 4, winY - 4, winW + 8, winH + 8);
        // Sky inside window
        const skyGrad = ctx!.createLinearGradient(0, winY, 0, winY + winH);
        skyGrad.addColorStop(0, "rgba(100,160,255,0.55)");
        skyGrad.addColorStop(1, "rgba(170,210,255,0.35)");
        ctx!.fillStyle = skyGrad;
        ctx!.fillRect(wx, winY, winW, winH);
        // Window dividers (cross)
        ctx!.fillStyle = "rgba(255,255,255,0.55)";
        ctx!.fillRect(wx + winW/2 - 1, winY, 2, winH);
        ctx!.fillRect(wx, winY + winH/2 - 1, winW, 2);
        // Window sill
        ctx!.fillStyle = "rgba(180,140,80,0.7)";
        ctx!.fillRect(wx - 6, winY + winH, winW + 12, 6);
      });

      // Ceiling shadow (near top)
      const cg = ctx!.createLinearGradient(0, 0, 0, ft * 0.15);
      cg.addColorStop(0, "rgba(0,0,0,0.4)");
      cg.addColorStop(1, "rgba(0,0,0,0)");
      ctx!.fillStyle = cg;
      ctx!.fillRect(0, 0, W, ft * 0.15);

      // Baseboard (wall→floor divider)
      ctx!.fillStyle = "rgba(101,67,20,0.9)";
      ctx!.fillRect(sideW, ft - 12, W - sideW * 2, 14);
      ctx!.fillStyle = "rgba(200,160,70,0.6)";
      ctx!.fillRect(sideW, ft - 12, W - sideW * 2, 3);
      ctx!.fillStyle = "rgba(60,30,5,0.7)";
      ctx!.fillRect(sideW, ft + 2, W - sideW * 2, 3);

      // Floor shadow (near baseboard)
      const fg = ctx!.createLinearGradient(0, ft, 0, ft + 50);
      fg.addColorStop(0, "rgba(0,0,0,0.25)");
      fg.addColorStop(1, "rgba(0,0,0,0)");
      ctx!.fillStyle = fg;
      ctx!.fillRect(sideW, ft, W - sideW * 2, 50);

      // Door
      const doorCX = W / 2, doorW2 = 56, doorH2 = 76, doorY = fb - doorH2 + 4;
      ctx!.fillStyle = "#5a3a10";
      ctx!.fillRect(doorCX - doorW2/2 - 4, doorY - 4, doorW2 + 8, doorH2 + 4);
      ctx!.fillStyle = "#3d2000";
      ctx!.fillRect(doorCX - doorW2/2, doorY, doorW2, doorH2);
      ctx!.beginPath();
      ctx!.arc(doorCX, doorY, doorW2/2, Math.PI, 0);
      ctx!.fillStyle = "#3d2000";
      ctx!.fill();
      ctx!.strokeStyle = "#5a3a10";
      ctx!.lineWidth = 4;
      ctx!.stroke();
      ctx!.beginPath();
      ctx!.arc(doorCX + 18, doorY + doorH2/2, 5, 0, Math.PI*2);
      ctx!.fillStyle = "#d4a017";
      ctx!.fill();
      ctx!.font = "bold 11px monospace";
      ctx!.fillStyle = "rgba(255,208,90,0.85)";
      ctx!.textAlign = "center";
      ctx!.textBaseline = "bottom";
      ctx!.fillText("🚪 EXIT", doorCX, doorY - 6);

      const nearDoor = Math.abs(p.x - doorCX) < 55 && p.y > fb - 90;
      if (nearDoor) {
        ctx!.font = "12px monospace";
        ctx!.fillStyle = "#ffd070";
        ctx!.fillText("Press E to leave", doorCX, doorY - 22);
      }

      // ── Furniture (depth-sorted) ───────────────────────────────────────
      const cfg = configRef.current;
      const sortedFurniture = [...cfg.furniture].sort((a, b) => a.y - b.y);
      for (const pf of sortedFurniture) {
        const item = FURNITURE.find(f => f.id === pf.furnitureId);
        if (!item) continue;
        const box = boxesRef.current.find(b => b.instanceId === pf.instanceId);
        if (!box) continue;
        const { fx, fy } = box;
        const size = Math.round(32 + item.w * 10);
        const isSolid = box.solid;

        // Collision box outline (debug-style tint) — subtle highlight for solid items
        if (isSolid) {
          ctx!.globalAlpha = 0.08;
          ctx!.fillStyle = "#ffffff";
          ctx!.fillRect(box.bx, box.by, box.bw, box.bh);
          ctx!.globalAlpha = 1;
        }

        // Drop shadow
        ctx!.globalAlpha = 0.22;
        ctx!.font = `${size}px serif`;
        ctx!.textAlign = "center";
        ctx!.textBaseline = "bottom";
        ctx!.fillStyle = "#000";
        ctx!.fillText(item.emoji, fx + 3, fy + 5);
        ctx!.globalAlpha = 1;
        ctx!.fillText(item.emoji, fx, fy);

        // Name
        ctx!.font = "9px monospace";
        ctx!.fillStyle = "rgba(255,255,255,0.65)";
        ctx!.textBaseline = "top";
        ctx!.fillText(item.name, fx, fy + 2);
        ctx!.textBaseline = "bottom";

        // Interaction hint if player is close and item is interactable
        const distToPlayer = Math.sqrt((fx - p.x) ** 2 + (fy - p.y) ** 2);
        if (distToPlayer < 80 && !isSolid) {
          ctx!.font = "10px monospace";
          ctx!.fillStyle = "rgba(255,220,80,0.85)";
          ctx!.textAlign = "center";
          ctx!.textBaseline = "bottom";
          ctx!.fillText("Press F", fx, fy - size - 2);
        }
      }

      // ── Pets ──────────────────────────────────────────────────────────
      for (const pet of petsRef.current) {
        const petData = PETS.find(pt => pt.id === pet.petId);
        if (!petData) continue;
        ctx!.font = "26px serif";
        ctx!.textAlign = "center";
        ctx!.textBaseline = "bottom";
        ctx!.globalAlpha = 1;
        ctx!.fillText(petData.emoji, pet.x, pet.y);
        ctx!.font = "9px monospace";
        ctx!.fillStyle = "rgba(255,255,255,0.75)";
        ctx!.textBaseline = "top";
        ctx!.fillText(pet.name || petData.name, pet.x, pet.y + 1);
      }

      // ── Player ────────────────────────────────────────────────────────
      ctx!.globalAlpha = 0.18;
      ctx!.fillStyle = "#000";
      ctx!.beginPath();
      ctx!.ellipse(p.x, p.y + PLAYER_R - 2, PLAYER_R * 0.9, 5, 0, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.globalAlpha = 1;

      ctx!.save();
      ctx!.beginPath();
      ctx!.arc(p.x, p.y, PLAYER_R, 0, Math.PI * 2);
      ctx!.clip();
      if (avatarImgRef.current) {
        ctx!.drawImage(avatarImgRef.current, p.x - PLAYER_R, p.y - PLAYER_R, PLAYER_R*2, PLAYER_R*2);
      } else {
        ctx!.fillStyle = "#5b6de8";
        ctx!.fill();
        ctx!.font = `bold ${PLAYER_R}px sans-serif`;
        ctx!.fillStyle = "#fff";
        ctx!.textAlign = "center";
        ctx!.textBaseline = "middle";
        ctx!.fillText((viewerUsername[0] || "?").toUpperCase(), p.x, p.y);
      }
      ctx!.restore();

      ctx!.beginPath();
      ctx!.arc(p.x, p.y, PLAYER_R, 0, Math.PI * 2);
      ctx!.strokeStyle = "#fff";
      ctx!.lineWidth = 2;
      ctx!.stroke();

      ctx!.font = "bold 11px monospace";
      ctx!.fillStyle = "#fff";
      ctx!.textAlign = "center";
      ctx!.textBaseline = "top";
      ctx!.shadowColor = "rgba(0,0,0,0.7)";
      ctx!.shadowBlur = 4;
      ctx!.fillText(viewerUsername, p.x, p.y + PLAYER_R + 3);
      ctx!.shadowBlur = 0;

      // ── Interaction popup ─────────────────────────────────────────────
      if (interactionRef.current) {
        const it = interactionRef.current;
        ctx!.globalAlpha = Math.max(0, it.alpha);
        ctx!.font = "bold 13px monospace";
        ctx!.fillStyle = "#fff";
        ctx!.strokeStyle = "rgba(0,0,0,0.6)";
        ctx!.lineWidth = 3;
        ctx!.textAlign = "center";
        ctx!.textBaseline = "bottom";
        ctx!.strokeText(it.msg, it.x, it.y);
        ctx!.fillText(it.msg, it.x, it.y);
        ctx!.globalAlpha = 1;
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);

    // ── Input ────────────────────────────────────────────────────────────
    function onKeyDown(e: KeyboardEvent) {
      keysRef.current.add(e.key);

      if (e.key === "Escape") { onClose(); return; }

      if (e.key === "e" || e.key === "E") {
        const W2 = canvas!.width;
        const fb2 = canvas!.height * 0.94;
        if (Math.abs(playerRef.current.x - W2 / 2) < 60 && playerRef.current.y > fb2 - 100) {
          onClose();
        }
      }

      if (e.key === "f" || e.key === "F") {
        // Interact with nearest non-solid furniture
        const p2 = playerRef.current;
        let closest: FurnitureBox | null = null;
        let closestDist = 90;
        for (const box of boxesRef.current) {
          if (box.solid) continue;
          const d = Math.sqrt((box.fx - p2.x) ** 2 + (box.fy - p2.y) ** 2);
          if (d < closestDist) { closestDist = d; closest = box; }
        }
        if (closest) {
          const msgs = INTERACT_MESSAGES[closest.category] ?? ["...", "Hmm.", "Interesting."];
          const msg = msgs[Math.floor(Math.random() * msgs.length)];
          interactionRef.current = { msg, x: closest.fx, y: closest.fy - 20, alpha: 1.4 };
        }
      }
    }
    function onKeyUp(e: KeyboardEvent) { keysRef.current.delete(e.key); }

    function getCanvasXY(clientX: number, clientY: number) {
      const rect = canvas!.getBoundingClientRect();
      return {
        cx: (clientX - rect.left) * (canvas!.width  / rect.width),
        cy: (clientY - rect.top)  * (canvas!.height / rect.height),
      };
    }

    function onClick(e: MouseEvent) {
      const { cx, cy } = getCanvasXY(e.clientX, e.clientY);
      const ft2 = canvas!.height * WALL_PCT;
      const fb2 = canvas!.height * 0.94;
      if (cy < ft2 || cy > fb2) return;

      // Check furniture click → interact
      for (const box of boxesRef.current) {
        if (cx >= box.bx && cx <= box.bx + box.bw && cy >= box.by && cy <= box.by + box.bh) {
          const item = FURNITURE.find(f => f.id === box.furnitureId);
          const msgs = INTERACT_MESSAGES[box.category] ?? ["Hmm."];
          const msg = msgs[Math.floor(Math.random() * msgs.length)];
          interactionRef.current = { msg, x: box.fx, y: box.fy - 20, alpha: 1.4 };
          if (item && !box.solid) {
            // Walk to nearby position, not inside solid items
            targetRef.current = { x: box.fx + 50, y: Math.min(fb2 - PLAYER_R - 5, box.fy + 30) };
          }
          return;
        }
      }

      // Otherwise: walk there
      targetRef.current = { x: cx, y: cy };
    }

    function onTouchStart(e: TouchEvent) {
      if (!e.touches.length) return;
      const t = e.touches[0];
      const { cx, cy } = getCanvasXY(t.clientX, t.clientY);
      const ft2 = canvas!.height * WALL_PCT;
      const fb2 = canvas!.height * 0.94;
      if (cy > ft2 && cy < fb2) targetRef.current = { x: cx, y: cy };
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup",   onKeyUp);
    canvas.addEventListener("click",      onClick);
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize",  resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup",   onKeyUp);
      canvas.removeEventListener("click",       onClick);
      canvas.removeEventListener("touchstart",  onTouchStart);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const wallCss  = WALLPAPERS.find(w => w.id === config.wallpaper)?.css  ?? "#F5F0E8";
  const floorCss = FLOORS.find(f => f.id === config.floorType)?.css ?? "#8B6914";

  if (loading) return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50, background: "#1a1a2e",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#ffd070", fontFamily: "monospace", fontSize: 16,
    }}>
      Loading…
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, overflow: "hidden" }}>

      {/* CSS room backgrounds */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: `${WALL_PCT * 100}%`, background: wallCss }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "10%", background: "linear-gradient(to bottom,rgba(0,0,0,0.32),transparent)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${(1 - WALL_PCT) * 100}%`, background: floorCss }} />

      {/* Canvas */}
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />

      {/* HUD */}
      <div style={{ position: "absolute", top: 12, left: 12, right: 12, display: "flex", justifyContent: "space-between", alignItems: "center", pointerEvents: "none" }}>
        <span style={{ color: "#ffd070", fontFamily: "monospace", fontSize: 14, background: "rgba(0,0,0,0.55)", padding: "4px 12px", borderRadius: 8 }}>
          🏠 {username}&apos;s House
        </span>
        <div style={{ display: "flex", gap: 8, pointerEvents: "all" }}>
          {isOwner && (
            <button onClick={() => setEditOpen(true)} style={{ background: "rgba(60,40,10,0.88)", color: "#ffd070", border: "1px solid #8B6914", borderRadius: 8, padding: "5px 13px", fontFamily: "monospace", cursor: "pointer", fontSize: 13 }}>
              ✏️ Edit Room
            </button>
          )}
          <button onClick={onClose} style={{ background: "rgba(60,10,10,0.88)", color: "#ff9090", border: "1px solid #8b2020", borderRadius: 8, padding: "5px 13px", fontFamily: "monospace", cursor: "pointer", fontSize: 13 }}>
            ✕ Leave
          </button>
        </div>
      </div>

      {/* Controls hint */}
      <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", color: "rgba(255,255,255,0.45)", fontFamily: "monospace", fontSize: 11, pointerEvents: "none", textAlign: "center" }}>
        WASD / arrows to move · Click to walk · F or click to interact · E near door to exit
      </div>

      {/* Mobile d-pad */}
      <div style={{ position: "absolute", bottom: 36, left: 12, display: "grid", gridTemplateColumns: "44px 44px 44px", gridTemplateRows: "44px 44px", gap: 4, userSelect: "none" }}>
        {(["↑","←","↓","→"] as const).map((arrow) => {
          const keyMap: Record<string, string> = { "↑":"ArrowUp","↓":"ArrowDown","←":"ArrowLeft","→":"ArrowRight" };
          const gridPos: Record<string, React.CSSProperties> = {
            "↑": { gridColumn: 2, gridRow: 1 }, "←": { gridColumn: 1, gridRow: 2 },
            "↓": { gridColumn: 2, gridRow: 2 }, "→": { gridColumn: 3, gridRow: 2 },
          };
          return (
            <button key={arrow} style={{ ...gridPos[arrow], background: "rgba(0,0,0,0.55)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 8, fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none" }}
              onPointerDown={() => keysRef.current.add(keyMap[arrow])}
              onPointerUp={()   => keysRef.current.delete(keyMap[arrow])}
              onPointerLeave={() => keysRef.current.delete(keyMap[arrow])}
            >{arrow}</button>
          );
        })}
      </div>

      {/* Edit overlay */}
      {editOpen && (
        <HouseInterior userId={userId} viewerId={viewerId} username={username}
          onClose={() => { setEditOpen(false); reloadConfig(); }} />
      )}
    </div>
  );
}
