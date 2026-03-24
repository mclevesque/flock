"use client";
import { useEffect, useRef, useState } from "react";
import { EXTERIOR_STYLES, NPC_HOUSE_NAMES, NPC_EXTERIORS } from "@/app/components/houseData";
import HouseRoom from "./HouseRoom";

const HOUSE_W = 200, HOUSE_H = 160, HOUSE_GAP = 60, HOUSE_COLS = 4;
const NS_W = 1600, NS_H = 700;

interface DistrictSlot { userId: string | null; username: string; exteriorStyle: string; isNpc: boolean; }
interface WS { send: (data: string) => void; readyState: number; }

const HOUSE_SLOTS_NS = Array.from({ length: 8 }, (_, i) => ({
  x: 80 + (i % HOUSE_COLS) * (HOUSE_W + HOUSE_GAP),
  y: Math.floor(i / HOUSE_COLS) === 0 ? 80 : 460,
}));

export default function NeighborhoodScene({
  userId, username, avatarUrl, partyId, socketRef, onClose,
}: {
  userId: string; username: string; avatarUrl: string;
  partyId: string | null;
  socketRef: React.RefObject<WS | null>;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<import("phaser").Game | null>(null);
  const [openHouse, setOpenHouse] = useState<{ userId: string; username: string } | null>(null);
  // Map of userId → Phaser container for other players
  const otherSpritesRef = useRef<Map<string, import("phaser").GameObjects.Container>>(new Map());
  const addOrUpdateOtherRef = useRef<((id: string, uname: string, x: number, y: number) => void) | null>(null);
  const removeOtherRef = useRef<((id: string) => void) | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const Phaser = (await import("phaser")).default;
      if (cancelled || !containerRef.current) return;

      let slots: DistrictSlot[] = [];
      try {
        const { houses } = await fetch(`/api/house?district=1&partyId=${partyId ?? ""}`).then(r => r.json());
        const real: DistrictSlot[] = (houses ?? []).map((h: Record<string, unknown>) => ({
          userId: h.id as string, username: h.username as string,
          exteriorStyle: (h.exterior_style as string) ?? "cottage", isNpc: false,
        }));
        const npcCount = Math.max(0, 8 - real.length);
        const npcs = Array.from({ length: npcCount }, (_, i) => ({
          userId: null, username: NPC_HOUSE_NAMES[i % NPC_HOUSE_NAMES.length],
          exteriorStyle: NPC_EXTERIORS[i % NPC_EXTERIORS.length], isNpc: true,
        }));
        slots = [...real, ...npcs];
      } catch { slots = Array.from({ length: 8 }, (_, i) => ({ userId: null, username: NPC_HOUSE_NAMES[i % NPC_HOUSE_NAMES.length], exteriorStyle: NPC_EXTERIORS[i % NPC_EXTERIORS.length], isNpc: true })); }

      if (cancelled || !containerRef.current) return;

      // Capture setOpenHouse for use inside Phaser scene
      let openHouseFn: ((h: { userId: string; username: string }) => void) | null = null;

      const NS_SPEED = 260;

      class NeighScene extends Phaser.Scene {
        player!: Phaser.GameObjects.Container;
        cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
        wasd!: Record<string, Phaser.Input.Keyboard.Key>;
        tapTarget: { x: number; y: number } | null = null;
        wsTimer = 0;

        constructor() { super({ key: "NeighScene" }); }
        create() {
          const W = NS_W, H = NS_H;
          // Background — warm cobblestone
          const bg = this.add.graphics();
          bg.fillStyle(0xc8a87a, 1); bg.fillRect(0, 0, W, H);
          bg.lineStyle(1, 0xaa8855, 0.2);
          for (let y = 0; y < H; y += 64) { bg.moveTo(0, y); bg.lineTo(W, y); }
          for (let x = 0; x < W; x += 80) { bg.moveTo(x, 0); bg.lineTo(x, H); }
          bg.strokePath();

          // Central path between rows
          const path = this.add.graphics();
          path.fillStyle(0xd4b07a, 1); path.fillRect(0, 310, W, 100);
          path.lineStyle(2, 0xb89060, 0.4);
          for (let px = 0; px < W; px += 40) path.strokeRect(px, 310, 38, 98);

          // Title
          this.add.text(W / 2, 20, "🏘️  Neighbourhood", {
            fontSize: "18px", color: "#4a2800", fontFamily: "monospace", fontStyle: "bold",
            backgroundColor: "rgba(240,210,150,0.9)", padding: { x: 16, y: 8 },
          }).setOrigin(0.5, 0).setDepth(5);

          // Trees lining path
          [[120,300],[360,300],[600,300],[840,300],[1080,300],[1320,300],
           [120,418],[360,418],[600,418],[840,418],[1080,418],[1320,418]].forEach(([tx,ty]) => {
            const tg = this.add.graphics();
            tg.fillStyle(0x6a3a12,1); tg.fillRect(tx-3,ty+4,6,16);
            tg.fillStyle(0x0e6622,1); tg.fillTriangle(tx,ty-18,tx-15,ty+5,tx+15,ty+5);
            tg.fillStyle(0x1a9030,1); tg.fillCircle(tx,ty-6,10);
          });

          // Draw houses
          HOUSE_SLOTS_NS.forEach((slot, i) => {
            const info = slots[i];
            if (!info) return;
            const ext = EXTERIOR_STYLES.find(e => e.id === info.exteriorStyle) ?? EXTERIOR_STYLES[0];
            const { x: hx, y: hy } = slot;
            const hw = HOUSE_W, hh = HOUSE_H;

            const houseG = this.add.graphics().setDepth(4);
            houseG.fillStyle(0x000000, 0.18); houseG.fillRoundedRect(hx+8, hy+8, hw, hh, 6);
            houseG.fillStyle(0x8a7a5a, 1); houseG.fillRect(hx-4, hy+hh-4, hw+8, 10);
            const wc = parseInt(ext.wallColor.replace("#",""), 16);
            houseG.fillStyle(wc, 1); houseG.fillRoundedRect(hx, hy+28, hw, hh-28, { tl:0, tr:0, bl:6, br:6 });
            const rc = parseInt(ext.roofColor.replace("#",""), 16);
            houseG.fillStyle(rc, 1); houseG.fillTriangle(hx-8, hy+32, hx+hw/2, hy-18, hx+hw+8, hy+32);
            houseG.fillStyle(wc, 1); houseG.fillRect(hx+hw*0.7, hy-28, 18, 38);
            houseG.fillStyle(0x333333, 0.6); houseG.fillRect(hx+hw*0.7-2, hy-32, 22, 6);
            houseG.fillStyle(0xffd880, 0.9);
            houseG.fillRoundedRect(hx+14, hy+44, 38, 30, 3);
            houseG.fillRoundedRect(hx+hw-52, hy+44, 38, 30, 3);
            houseG.lineStyle(1, 0x8a6a30, 0.4);
            houseG.lineBetween(hx+33,hy+44,hx+33,hy+74); houseG.lineBetween(hx+14,hy+59,hx+52,hy+59);
            houseG.lineBetween(hx+hw-33,hy+44,hx+hw-33,hy+74); houseG.lineBetween(hx+hw-52,hy+59,hx+hw-14,hy+59);
            const dc = parseInt(ext.doorColor.replace("#",""), 16);
            houseG.fillStyle(dc, 1); houseG.fillRoundedRect(hx+hw/2-16, hy+hh-52, 32, 52, { tl:6, tr:6, bl:0, br:0 });
            houseG.fillStyle(0xffcc44, 1); houseG.fillCircle(hx+hw/2+8, hy+hh-28, 3);
            houseG.fillStyle(0x8a7a5a, 1); houseG.fillRect(hx+hw/2-20, hy+hh-4, 40, 8);
            const tc = parseInt(ext.trimColor.replace("#",""), 16);
            houseG.fillStyle(tc, 0.8); houseG.fillRect(hx, hy+26, hw, 4);

            const nameText = this.add.text(hx+hw/2, hy-32, `${ext.emoji} ${info.username}`, {
              fontSize: "10px", color: "#fff", fontFamily: "monospace", fontStyle: "bold",
              backgroundColor: "rgba(0,0,0,0.65)", padding: { x: 6, y: 3 },
            }).setOrigin(0.5, 1).setDepth(8);

            if (!info.isNpc && info.userId === userId) {
              this.add.text(hx+hw/2, hy-48, "🏠 Your Home", {
                fontSize: "9px", color: "#ffd700", fontFamily: "monospace",
                backgroundColor: "rgba(0,0,0,0.5)", padding: { x: 5, y: 2 },
              }).setOrigin(0.5, 1).setDepth(8);
            }

            if (!info.isNpc && info.userId) {
              const zone = this.add.zone(hx+hw/2, hy+hh/2, hw, hh).setInteractive({ cursor: "pointer" }).setDepth(9);
              zone.on("pointerover", () => nameText.setStyle({ color: "#ffd700" }));
              zone.on("pointerout", () => nameText.setStyle({ color: "#fff" }));
              zone.on("pointerdown", () => openHouseFn?.({ userId: info.userId!, username: info.username }));
            }
          });

          // ── Player character ─────────────────────────────────────────────
          const startX = W / 2, startY = 360;
          const body = this.add.graphics();
          body.fillStyle(0x4a90d9, 1); body.fillCircle(0, -8, 14);
          body.fillStyle(0x3a7abf, 1); body.fillRect(-10, 4, 20, 20);
          const label = this.add.text(0, 22, `@${username}`, {
            fontSize: "9px", color: "#fff", fontFamily: "monospace",
            backgroundColor: "rgba(0,0,0,0.55)", padding: { x: 4, y: 2 },
          }).setOrigin(0.5, 0);
          this.player = this.add.container(startX, startY, [body, label]).setDepth(20);

          // Camera follows player across the wide map
          this.cameras.main.setBounds(0, 0, W, H);
          this.cameras.main.startFollow(this.player, true, 0.2, 0.2);
          this.cameras.main.scrollX = startX - this.cameras.main.width / 2;
          this.cameras.main.scrollY = startY - this.cameras.main.height / 2;

          // Input
          this.cursors = this.input.keyboard!.createCursorKeys();
          this.wasd = {
            W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
          };

          // Tap-to-move
          this.input.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
            this.tapTarget = { x: ptr.worldX, y: ptr.worldY };
          });

          // Add/update other player sprite
          addOrUpdateOtherRef.current = (id: string, uname: string, x: number, y: number) => {
            let sprite = otherSpritesRef.current.get(id);
            if (!sprite) {
              const g = this.add.graphics();
              g.fillStyle(0xe07030, 1); g.fillCircle(0, -8, 14);
              g.fillStyle(0xc05020, 1); g.fillRect(-10, 4, 20, 20);
              const lbl = this.add.text(0, 22, `@${uname}`, {
                fontSize: "9px", color: "#fff", fontFamily: "monospace",
                backgroundColor: "rgba(0,0,0,0.55)", padding: { x: 4, y: 2 },
              }).setOrigin(0.5, 0);
              sprite = this.add.container(x, y, [g, lbl]).setDepth(19);
              otherSpritesRef.current.set(id, sprite);
            } else {
              sprite.setPosition(x, y);
            }
          };

          removeOtherRef.current = (id: string) => {
            const sprite = otherSpritesRef.current.get(id);
            if (sprite) { sprite.destroy(); otherSpritesRef.current.delete(id); }
          };
        }

        update(_time: number, delta: number) {
          const dt = delta / 1000;
          let vx = 0, vy = 0;

          if (this.cursors.left?.isDown || this.wasd.A.isDown) { vx = -NS_SPEED; this.tapTarget = null; }
          else if (this.cursors.right?.isDown || this.wasd.D.isDown) { vx = NS_SPEED; this.tapTarget = null; }
          if (this.cursors.up?.isDown || this.wasd.W.isDown) { vy = -NS_SPEED; this.tapTarget = null; }
          else if (this.cursors.down?.isDown || this.wasd.S.isDown) { vy = NS_SPEED; this.tapTarget = null; }

          if (this.tapTarget && vx === 0 && vy === 0) {
            const dx = this.tapTarget.x - this.player.x;
            const dy = this.tapTarget.y - this.player.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < 8) { this.tapTarget = null; }
            else { const s = NS_SPEED / dist; vx = dx * s; vy = dy * s; }
          }

          const nx = Math.round(Phaser.Math.Clamp(this.player.x + vx * dt, 16, NS_W - 16));
          const ny = Math.round(Phaser.Math.Clamp(this.player.y + vy * dt, 16, NS_H - 16));
          this.player.setPosition(nx, ny);

          // Broadcast position every 100ms
          this.wsTimer += delta;
          if (this.wsTimer >= 100 && socketRef.current?.readyState === 1) {
            this.wsTimer = 0;
            socketRef.current.send(JSON.stringify({
              type: "player-update",
              player: { user_id: userId, username, avatar_url: avatarUrl, x: nx, y: ny, zone: "neighborhood", partyId },
            }));
          }
        }
      }

      const game = new Phaser.Game({
        type: Phaser.WEBGL,
        width: containerRef.current.clientWidth || NS_W,
        height: containerRef.current.clientHeight || NS_H,
        parent: containerRef.current,
        scene: [NeighScene],
        scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH, resolution: window.devicePixelRatio || 1 } as object,
        render: { antialias: true, pixelArt: false, powerPreference: "high-performance", roundPixels: false },
        backgroundColor: "#c8a87a",
      });

      // Wire up the openHouse function after game is created
      openHouseFn = (h) => setOpenHouse(h);
      game.events.once("ready", () => setTimeout(() => game.scale?.refresh(), 100));
      gameRef.current = game;
    }

    init();
    return () => {
      cancelled = true;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [userId, partyId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen on the shared socket for other neighbourhood players
  useEffect(() => {
    const ws = socketRef.current as (EventTarget & WS) | null;
    if (!ws) return;

    const handler = (evt: Event) => {
      try {
        const msg = JSON.parse((evt as MessageEvent).data as string);
        if (msg.type === "player-update") {
          const p = msg.player;
          if (p.user_id === userId) return;
          if (p.zone === "neighborhood") {
            addOrUpdateOtherRef.current?.(p.user_id, p.username, p.x, p.y);
          } else {
            removeOtherRef.current?.(p.user_id);
          }
        } else if (msg.type === "player-leave") {
          removeOtherRef.current?.(msg.id);
        } else if (msg.type === "snapshot") {
          const players: Array<{ user_id: string; username: string; x: number; y: number; zone?: string }> = Object.values(msg.state?.players ?? {});
          players.forEach(p => {
            if (p.user_id === userId) return;
            if (p.zone === "neighborhood") addOrUpdateOtherRef.current?.(p.user_id, p.username, p.x, p.y);
          });
        }
      } catch { /* ignore */ }
    };

    (ws as EventTarget).addEventListener("message", handler);
    return () => {
      (ws as EventTarget).removeEventListener("message", handler);
      // Re-announce as town zone so others see us back in town
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: "player-update", player: { user_id: userId, username, zone: "town", x: 0, y: 0 } }));
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10000,
      background: "#c8a87a", display: "flex", flexDirection: "column",
      fontFamily: "monospace",
    }}>
      {/* Header */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 10001,
        display: "flex", alignItems: "center", padding: "10px 16px",
        background: "rgba(50,30,10,0.85)", backdropFilter: "blur(4px)",
        borderBottom: "1px solid rgba(200,160,80,0.3)",
      }}>
        <button onClick={onClose} style={{
          background: "rgba(255,220,140,0.15)", border: "1px solid rgba(200,160,80,0.4)",
          color: "#ffeebb", padding: "6px 14px", borderRadius: 8, cursor: "pointer",
          fontSize: 13, fontWeight: 700, fontFamily: "monospace",
        }}>← Back to Town</button>
        <span style={{ marginLeft: 16, color: "#ffd080", fontWeight: 700, fontSize: 15 }}>🏘️ Neighbourhood</span>
      </div>

      {/* Phaser canvas container */}
      <div ref={containerRef} style={{ flex: 1, marginTop: 44, touchAction: "none" }} />

      {/* House interior overlay */}
      {openHouse && (
        <HouseRoom
          userId={openHouse.userId}
          viewerId={userId}
          username={openHouse.username}
          viewerUsername={username}
          onClose={() => setOpenHouse(null)}
        />
      )}
    </div>
  );
}
