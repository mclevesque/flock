"use client";
/**
 * Flock: Outbreak — Vampire Survivors-style game
 *
 * Your Flock avatar vs zombie hordes. Survive 10 minutes.
 * Auto-attacks, WASD movement, level-up upgrades.
 * Party members can join as co-op survivors via PartyKit.
 *
 * Built on Phaser 3 (already in project) — same engine as TownClient.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { WEAPONS, PASSIVE_ITEMS, ENEMY_TYPES, getLevelUpChoices, type EnemyType } from "./weaponData";

const GAME_DURATION = 600; // 10 minutes in seconds
const CANVAS_W = typeof window !== "undefined" ? window.innerWidth : 1280;
const CANVAS_H = typeof window !== "undefined" ? window.innerHeight : 720;
const WORLD_W = 3200;
const WORLD_H = 2400;
const BASE_HP = 100;
const XP_PER_LEVEL = [0, 10, 25, 50, 85, 130, 190, 270, 375, 510, 700];

interface CoopPlayer {
  userId: string;
  username: string;
  avatarUrl: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  level: number;
  kills: number;
}

interface Props {
  userId: string;
  username: string;
  avatarUrl: string;
}

// ── Level-up choice overlay ───────────────────────────────────────────────────
function LevelUpOverlay({
  choices,
  onPick,
  playerLevel,
}: {
  choices: ReturnType<typeof getLevelUpChoices>;
  onPick: (idx: number) => void;
  playerLevel: number;
}) {
  const WEAPONS_MAP = Object.fromEntries(WEAPONS.map(w => [w.id, w]));
  const PASSIVES_MAP = Object.fromEntries(PASSIVE_ITEMS.map(p => [p.id, p]));

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.78)", backdropFilter: "blur(3px)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 16, fontFamily: "monospace",
    }}>
      <div style={{ fontSize: 22, color: "#ffd700", fontWeight: 900, letterSpacing: 3 }}>
        ⬆️ LEVEL {playerLevel}
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,220,100,0.6)", marginTop: -8 }}>Choose an upgrade</div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center", maxWidth: 700 }}>
        {choices.map((choice, i) => {
          const weapon = choice.type === "weapon" || choice.type === "weapon_upgrade"
            ? WEAPONS_MAP[choice.id]
            : null;
          const passive = choice.type === "passive" ? PASSIVES_MAP[choice.id] : null;
          const item = weapon ?? passive;
          if (!item) return null;

          return (
            <button
              key={i}
              onClick={() => onPick(i)}
              style={{
                background: "linear-gradient(160deg, rgba(15,10,35,0.97) 0%, rgba(25,15,60,0.97) 100%)",
                border: "2px solid rgba(180,140,255,0.4)",
                borderRadius: 14, padding: "18px 20px",
                width: 190, cursor: "pointer", textAlign: "left",
                transition: "border-color 0.15s, transform 0.1s",
                color: "#fff",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(220,180,255,0.8)";
                (e.currentTarget as HTMLElement).style.transform = "scale(1.04)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(180,140,255,0.4)";
                (e.currentTarget as HTMLElement).style.transform = "scale(1)";
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 8 }}>{item.emoji}</div>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#ddccff", marginBottom: 4 }}>{item.name}</div>
              {choice.type === "weapon_upgrade" && (
                <div style={{ fontSize: 10, color: "#ffd700", marginBottom: 4 }}>
                  LV {choice.level} UPGRADE
                </div>
              )}
              {choice.type === "weapon" && (
                <div style={{ fontSize: 10, color: "#88ffaa", marginBottom: 4 }}>NEW WEAPON</div>
              )}
              {choice.type === "passive" && (
                <div style={{ fontSize: 10, color: "#88ccff", marginBottom: 4 }}>PASSIVE ITEM</div>
              )}
              <div style={{ fontSize: 11, color: "rgba(200,190,230,0.7)", lineHeight: 1.4 }}>
                {"description" in item ? item.description : ""}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Game Over screen ──────────────────────────────────────────────────────────
function GameOverScreen({ survived, kills, level, time, onRestart }: {
  survived: boolean;
  kills: number;
  level: number;
  time: number;
  onRestart: () => void;
}) {
  const mm = Math.floor(time / 60).toString().padStart(2, "0");
  const ss = (time % 60).toString().padStart(2, "0");

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 300,
      background: survived
        ? "radial-gradient(ellipse at center, rgba(10,30,10,0.97) 0%, rgba(0,10,5,0.99) 100%)"
        : "radial-gradient(ellipse at center, rgba(30,5,5,0.97) 0%, rgba(10,0,0,0.99) 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 16, fontFamily: "monospace",
    }}>
      <div style={{ fontSize: 64 }}>{survived ? "🎉" : "💀"}</div>
      <div style={{
        fontSize: 28, fontWeight: 900, letterSpacing: 4,
        color: survived ? "#44ff88" : "#ff4444",
      }}>
        {survived ? "YOU SURVIVED!" : "YOU FELL"}
      </div>
      <div style={{ fontSize: 13, color: "rgba(200,200,200,0.6)", textAlign: "center", lineHeight: 2 }}>
        Survived: {mm}:{ss}<br />
        Enemies killed: {kills}<br />
        Level reached: {level}
      </div>
      {survived && (
        <div style={{ fontSize: 13, color: "#ffd700", textAlign: "center", lineHeight: 1.6 }}>
          🌙 Moonhaven is safe... for now.<br />
          The Moon Oracle thanks you, survivor.
        </div>
      )}
      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <button onClick={onRestart} style={{
          padding: "10px 28px", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: "pointer",
          background: "rgba(80,200,100,0.2)", border: "1px solid rgba(80,200,100,0.4)",
          color: "#88ffaa",
        }}>
          Play Again
        </button>
        <Link href="/town" style={{
          padding: "10px 28px", borderRadius: 10, fontSize: 14, fontWeight: 800,
          background: "rgba(100,80,200,0.2)", border: "1px solid rgba(100,80,200,0.4)",
          color: "#ccbbff", textDecoration: "none",
        }}>
          Return to Town
        </Link>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SurvivorsClient({ userId, username, avatarUrl }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<unknown>(null);
  const wsRef = useRef<{ send: (d: string) => void; close: () => void } | null>(null);
  const coopRef = useRef<Map<string, CoopPlayer>>(new Map());

  const [gameState, setGameState] = useState<"menu" | "playing" | "paused" | "gameover">("menu");
  const [survived, setSurvived] = useState(false);
  const [kills, setKills] = useState(0);
  const [level, setLevel] = useState(1);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [hp, setHp] = useState(BASE_HP);
  const [maxHp, setMaxHp] = useState(BASE_HP);
  const [xp, setXp] = useState(0);
  const [xpNeeded, setXpNeeded] = useState(XP_PER_LEVEL[1]);
  const [levelUpChoices, setLevelUpChoices] = useState<ReturnType<typeof getLevelUpChoices> | null>(null);
  const [activeWeapons, setActiveWeapons] = useState<string[]>(["moonbolt"]);
  const [activePassives, setActivePassives] = useState<string[]>([]);
  const [coopPlayers, setCoopPlayers] = useState<CoopPlayer[]>([]);

  // Game engine refs (for Phaser callbacks)
  const killsRef = useRef(0);
  const levelRef = useRef(1);
  const xpRef = useRef(0);
  const hpRef = useRef(BASE_HP);
  const maxHpRef = useRef(BASE_HP);
  const timeRef = useRef(GAME_DURATION);
  const weaponsRef = useRef<string[]>(["moonbolt"]);
  const passivesRef = useRef<string[]>([]);
  const statsRef = useRef({
    speedMult: 1, damageMult: 1, xpMult: 1, hpRegenPerSec: 0,
    areaMultiplier: 1, cooldownMult: 1, magnetRange: 120, luck: 0,
  });

  // ── Start game ──────────────────────────────────────────────────────────────
  const startGame = useCallback(async () => {
    if (!containerRef.current) return;
    setGameState("playing");
    setKills(0); setLevel(1); setTimeLeft(GAME_DURATION);
    setHp(BASE_HP); setMaxHp(BASE_HP); setXp(0); setXpNeeded(XP_PER_LEVEL[1]);
    setActiveWeapons(["moonbolt"]); setActivePassives([]);
    setLevelUpChoices(null);
    killsRef.current = 0; levelRef.current = 1; xpRef.current = 0;
    hpRef.current = BASE_HP; maxHpRef.current = BASE_HP; timeRef.current = GAME_DURATION;
    weaponsRef.current = ["moonbolt"]; passivesRef.current = [];
    statsRef.current = { speedMult: 1, damageMult: 1, xpMult: 1, hpRegenPerSec: 0, areaMultiplier: 1, cooldownMult: 1, magnetRange: 120, luck: 0 };

    // Clean up any previous game
    if (gameRef.current) {
      (gameRef.current as { destroy: (b: boolean) => void }).destroy(true);
      gameRef.current = null;
    }

    await initPhaserGame();
  }, [avatarUrl, username, userId]);

  // ── Phaser game init ─────────────────────────────────────────────────────────
  const initPhaserGame = useCallback(async () => {
    if (!containerRef.current) return;
    const Phaser = (await import("phaser")).default;

    class OutbreakScene extends Phaser.Scene {
      // Player
      private player!: Phaser.GameObjects.Container;
      private playerBody!: Phaser.GameObjects.Arc;
      private playerSprite!: Phaser.GameObjects.Image;
      private playerVX = 0;
      private playerVY = 0;

      // Input
      private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
      private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };

      // Enemies
      private enemies!: Phaser.Physics.Arcade.Group;
      private enemyPool: Map<string, Phaser.GameObjects.Container[]> = new Map();

      // Projectiles
      private projectiles!: Phaser.Physics.Arcade.Group;

      // XP gems
      private gems!: Phaser.Physics.Arcade.Group;

      // Weapon cooldowns
      private weaponCooldowns: Map<string, number> = new Map();

      // Orbit weapons
      private orbitAngle = 0;
      private orbitObjects: Phaser.GameObjects.Arc[] = [];

      // Timers
      private gameTimer = 0;
      private spawnTimer = 0;
      private hpRegenTimer = 0;
      private bossTimer = 0;

      // Wave tracking
      private wave = 0;
      private totalKills = 0;

      // Camera
      private cam!: Phaser.Cameras.Scene2D.Camera;

      // Damage flash
      private damageFlashAlpha = 0;

      create() {
        const self = this;
        this.cam = this.cameras.main;
        this.cam.setBounds(0, 0, WORLD_W, WORLD_H);

        // ── Background — moonlit wasteland ───────────────────────────────
        const bg = this.add.graphics();
        // Dark grass tiles
        for (let tx = 0; tx < WORLD_W; tx += 64) {
          for (let ty = 0; ty < WORLD_H; ty += 64) {
            const dark = Math.random() > 0.5;
            bg.fillStyle(dark ? 0x1a2a1a : 0x1e2e1e);
            bg.fillRect(tx, ty, 64, 64);
          }
        }
        // Grid lines
        bg.lineStyle(1, 0x2a3a2a, 0.4);
        for (let gx = 0; gx <= WORLD_W; gx += 64) { bg.lineBetween(gx, 0, gx, WORLD_H); }
        for (let gy = 0; gy <= WORLD_H; gy += 64) { bg.lineBetween(0, gy, WORLD_W, gy); }
        bg.setDepth(0);

        // Decorative dead trees / ruins
        for (let i = 0; i < 80; i++) {
          const tx = Phaser.Math.Between(100, WORLD_W - 100);
          const ty = Phaser.Math.Between(100, WORLD_H - 100);
          const dist = Math.hypot(tx - WORLD_W / 2, ty - WORLD_H / 2);
          if (dist < 250) continue; // keep spawn clear
          const deco = this.add.text(tx, ty, ["🌲", "🪨", "💀", "🌿", "🏚️"][Phaser.Math.Between(0, 4)], { fontSize: "24px" });
          deco.setDepth(1).setAlpha(0.5);
        }

        // ── Physics groups ────────────────────────────────────────────────
        this.enemies = this.physics.add.group();
        this.projectiles = this.physics.add.group();
        this.gems = this.physics.add.group();

        // ── Player ────────────────────────────────────────────────────────
        this.player = this.add.container(WORLD_W / 2, WORLD_H / 2);
        this.physics.world.enable(this.player);
        (this.player.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
        (this.player.body as Phaser.Physics.Arcade.Body).setCircle(18, -18, -18);

        // Glow ring
        const glow = this.add.arc(0, 0, 24, 0, 360, false, 0x88aaff, 0.25);
        this.player.add(glow);

        // Avatar circle
        this.playerBody = this.add.arc(0, 0, 18, 0, 360, false, 0x446688, 1);
        this.player.add(this.playerBody);

        // Load avatar
        const texKey = `avatar_${userId}`;
        if (!this.textures.exists(texKey)) {
          this.load.image(texKey, avatarUrl);
          this.load.once("complete", () => { self.addAvatarSprite(texKey); });
          this.load.start();
        } else {
          this.addAvatarSprite(texKey);
        }

        // Username tag
        const nameStyle = { fontSize: "11px", color: "#ffffff", stroke: "#000000", strokeThickness: 3, fontFamily: "monospace" };
        const nameTag = this.add.text(0, 28, username, nameStyle).setOrigin(0.5, 0);
        this.player.add(nameTag);

        this.player.setDepth(10);
        this.cam.startFollow(this.player, true, 0.1, 0.1);

        // ── Input ─────────────────────────────────────────────────────────
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.wasd = {
          W: this.input.keyboard!.addKey("W"),
          A: this.input.keyboard!.addKey("A"),
          S: this.input.keyboard!.addKey("S"),
          D: this.input.keyboard!.addKey("D"),
        };

        // ── Collisions ────────────────────────────────────────────────────
        this.physics.add.overlap(this.projectiles, this.enemies, (proj, enemy) => {
          self.hitEnemy(proj as Phaser.GameObjects.GameObject, enemy as Phaser.GameObjects.Container);
        });

        this.physics.add.overlap(this.player, this.enemies, (_player, enemy) => {
          self.playerHit(enemy as Phaser.GameObjects.Container);
        });

        this.physics.add.overlap(this.player, this.gems, (_player, gem) => {
          self.collectGem(gem as Phaser.GameObjects.Arc);
        });

        // ── HUD ───────────────────────────────────────────────────────────
        this.setupHUD();

        // ── Initial enemy spawn ───────────────────────────────────────────
        for (let i = 0; i < 5; i++) this.spawnEnemy();

        // ── Damage flash overlay ──────────────────────────────────────────
        const flashOverlay = this.add.rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 0xff0000, 0);
        flashOverlay.setDepth(999);
        flashOverlay.setScrollFactor(0);
        (this as unknown as { flashOverlay: Phaser.GameObjects.Rectangle }).flashOverlay = flashOverlay;
      }

      addAvatarSprite(texKey: string) {
        if (this.playerSprite) this.playerSprite.destroy();
        const mask = this.make.graphics({});
        mask.fillCircle(0, 0, 18);
        this.playerSprite = this.add.image(0, 0, texKey)
          .setDisplaySize(36, 36)
          .setMask(mask.createGeometryMask());
        this.player.addAt(this.playerSprite, 1);
      }

      setupHUD() {
        // HUD is rendered by React, not Phaser — game just calls React state setters
      }

      update(time: number, delta: number) {
        const dt = delta / 1000;
        if (gameState !== "playing") return;

        // ── Timers ────────────────────────────────────────────────────────
        this.gameTimer += dt;
        this.spawnTimer += dt;
        this.hpRegenTimer += dt;
        this.bossTimer += dt;
        timeRef.current = Math.max(0, GAME_DURATION - this.gameTimer);

        // Update React HUD every ~0.5s
        if (Math.floor(this.gameTimer * 2) !== Math.floor((this.gameTimer - dt) * 2)) {
          setTimeLeft(Math.ceil(timeRef.current));
          setHp(Math.round(hpRef.current));
        }

        // Win condition
        if (timeRef.current <= 0) {
          setSurvived(true);
          setKills(killsRef.current);
          setLevel(levelRef.current);
          setTimeLeft(0);
          setGameState("gameover");
          this.scene.pause();
          return;
        }

        // ── Player movement ───────────────────────────────────────────────
        const speed = 180 * statsRef.current.speedMult;
        let vx = 0, vy = 0;
        if (this.cursors.left.isDown || this.wasd.A.isDown) vx -= 1;
        if (this.cursors.right.isDown || this.wasd.D.isDown) vx += 1;
        if (this.cursors.up.isDown || this.wasd.W.isDown) vy -= 1;
        if (this.cursors.down.isDown || this.wasd.S.isDown) vy += 1;

        const len = Math.sqrt(vx * vx + vy * vy);
        if (len > 0) { vx /= len; vy /= len; }

        (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(vx * speed, vy * speed);
        if (len > 0) {
          this.playerVX = vx;
          this.playerVY = vy;
        }

        // ── HP regen ──────────────────────────────────────────────────────
        if (statsRef.current.hpRegenPerSec > 0 && this.hpRegenTimer > 1) {
          this.hpRegenTimer = 0;
          hpRef.current = Math.min(maxHpRef.current, hpRef.current + statsRef.current.hpRegenPerSec);
        }

        // ── Enemy spawning ────────────────────────────────────────────────
        const spawnInterval = Math.max(0.4, 1.8 - this.gameTimer * 0.02);
        if (this.spawnTimer > spawnInterval) {
          this.spawnTimer = 0;
          const count = 2 + Math.floor(this.gameTimer / 60);
          for (let i = 0; i < count; i++) this.spawnEnemy();
        }

        // Boss every 2 minutes
        if (this.bossTimer > 120) {
          this.bossTimer = 0;
          this.spawnBoss();
        }

        // ── Enemy AI ──────────────────────────────────────────────────────
        const px = this.player.x, py = this.player.y;
        this.enemies.getChildren().forEach((enemyObj) => {
          const ec = enemyObj as Phaser.GameObjects.Container;
          if (!ec.active) return;
          const dx = px - ec.x, dy = py - ec.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const eSpeed = (ec.getData("speed") as number ?? 60);
          if (dist > 2) {
            (ec.body as Phaser.Physics.Arcade.Body).setVelocity((dx / dist) * eSpeed, (dy / dist) * eSpeed);
          }
        });

        // ── Weapon firing ─────────────────────────────────────────────────
        for (const wId of weaponsRef.current) {
          this.tickWeapon(wId, dt);
        }

        // ── Orbit weapons ─────────────────────────────────────────────────
        if (weaponsRef.current.includes("lysara_orb")) {
          this.orbitAngle += dt * 2.5;
          const orbitRadius = 90 * statsRef.current.areaMultiplier;
          const weapon = WEAPONS.find(w => w.id === "lysara_orb")!;
          const count = weapon.baseCount;
          for (let i = 0; i < this.orbitObjects.length; i++) {
            const angle = this.orbitAngle + (i / this.orbitObjects.length) * Math.PI * 2;
            this.orbitObjects[i].setPosition(
              px + Math.cos(angle) * orbitRadius,
              py + Math.sin(angle) * orbitRadius,
            );
          }
          // Damage check for orbit
          this.enemies.getChildren().forEach(eObj => {
            const ec = eObj as Phaser.GameObjects.Container;
            for (const orb of this.orbitObjects) {
              const dist = Math.hypot(ec.x - orb.x, ec.y - orb.y);
              if (dist < 28) {
                const dmg = weapon.baseDamage * statsRef.current.damageMult;
                this.damageEnemy(ec, dmg);
              }
            }
          });
        }

        // ── XP gem magnet ─────────────────────────────────────────────────
        const magnetR = statsRef.current.magnetRange;
        this.gems.getChildren().forEach(gemObj => {
          const gem = gemObj as Phaser.GameObjects.Arc;
          const dx = px - gem.x, dy = py - gem.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < magnetR) {
            (gem.body as Phaser.Physics.Arcade.Body).setVelocity((dx / dist) * 200, (dy / dist) * 200);
          }
        });

        // ── Damage flash ──────────────────────────────────────────────────
        const flashOverlay = (this as unknown as { flashOverlay: Phaser.GameObjects.Rectangle }).flashOverlay;
        if (this.damageFlashAlpha > 0) {
          this.damageFlashAlpha = Math.max(0, this.damageFlashAlpha - dt * 4);
          flashOverlay.setAlpha(this.damageFlashAlpha);
        }
      }

      tickWeapon(wId: string, dt: number) {
        const weapon = WEAPONS.find(w => w.id === wId);
        if (!weapon || weapon.targeting === "orbit") return;

        const cooldown = (1 / (weapon.baseFireRate * statsRef.current.cooldownMult));
        const elapsed = (this.weaponCooldowns.get(wId) ?? 999);
        if (elapsed < cooldown) {
          this.weaponCooldowns.set(wId, elapsed + dt);
          return;
        }
        this.weaponCooldowns.set(wId, 0);
        this.fireWeapon(weapon);
      }

      fireWeapon(weapon: (typeof WEAPONS)[0]) {
        const px = this.player.x, py = this.player.y;
        const count = weapon.baseCount;
        const range = weapon.baseRange * statsRef.current.areaMultiplier;

        if (weapon.targeting === "all") {
          // Area blast around player
          const circle = this.add.arc(px, py, range, 0, 360, false, parseInt(weapon.projectileColor.replace("#", ""), 16), 0.35);
          circle.setDepth(8);
          this.tweens.add({ targets: circle, scaleX: 1.5, scaleY: 1.5, alpha: 0, duration: 350, onComplete: () => circle.destroy() });
          // Damage all enemies in range
          this.enemies.getChildren().forEach(eObj => {
            const ec = eObj as Phaser.GameObjects.Container;
            const dist = Math.hypot(ec.x - px, ec.y - py);
            if (dist <= range) {
              const dmg = weapon.baseDamage * statsRef.current.damageMult;
              this.damageEnemy(ec, dmg);
            }
          });
          return;
        }

        // Find target
        let targetAngle = Math.atan2(this.playerVY, this.playerVX);
        if (weapon.targeting === "nearest") {
          let nearestDist = Infinity;
          this.enemies.getChildren().forEach(eObj => {
            const ec = eObj as Phaser.GameObjects.Container;
            if (!ec.active) return;
            const dist = Math.hypot(ec.x - px, ec.y - py);
            if (dist < nearestDist && dist <= range) {
              nearestDist = dist;
              targetAngle = Math.atan2(ec.y - py, ec.x - px);
            }
          });
        }

        // Spread for multi-count
        const spread = count > 1 ? 0.25 : 0;
        for (let i = 0; i < count; i++) {
          const angle = targetAngle + (i - (count - 1) / 2) * spread;
          const proj = this.add.arc(px, py, 7, 0, 360, false, parseInt(weapon.projectileColor.replace("#", ""), 16), 1);
          proj.setDepth(9);
          proj.setData("damage", weapon.baseDamage * statsRef.current.damageMult);
          proj.setData("weaponId", weapon.id);
          proj.setData("range", range);
          proj.setData("startX", px);
          proj.setData("startY", py);
          this.physics.world.enable(proj);
          (proj.body as Phaser.Physics.Arcade.Body).setCircle(7);
          const spd = weapon.baseSpeed;
          (proj.body as Phaser.Physics.Arcade.Body).setVelocity(Math.cos(angle) * spd, Math.sin(angle) * spd);
          this.projectiles.add(proj);

          // Auto-destroy out of range
          this.time.addEvent({
            delay: (range / spd) * 1000 + 200,
            callback: () => { if (proj.active) proj.destroy(); },
          });
        }
      }

      hitEnemy(projObj: Phaser.GameObjects.GameObject, enemyObj: Phaser.GameObjects.Container) {
        const proj = projObj as Phaser.GameObjects.Arc;
        if (!proj.active || !enemyObj.active) return;
        const dmg = proj.getData("damage") as number ?? 10;
        const weaponId = proj.getData("weaponId") as string;
        // Piercing weapons don't destroy on hit
        if (weaponId !== "aldric_lance") proj.destroy();
        this.damageEnemy(enemyObj, dmg);
      }

      damageEnemy(ec: Phaser.GameObjects.Container, dmg: number) {
        if (!ec.active) return;
        const hp = (ec.getData("hp") as number) - dmg;
        ec.setData("hp", hp);

        // Flash red
        ec.list.forEach(child => {
          if (child instanceof Phaser.GameObjects.Arc) {
            (child as Phaser.GameObjects.Arc).setFillStyle(0xffffff);
            this.time.delayedCall(80, () => {
              const c = parseInt((ec.getData("color") as string).replace("#", ""), 16);
              if (child.active) (child as Phaser.GameObjects.Arc).setFillStyle(c);
            });
          }
        });

        // Damage number
        const dmgText = this.add.text(ec.x, ec.y - 10, `-${Math.round(dmg)}`, {
          fontSize: "12px", color: "#ff4444", stroke: "#000", strokeThickness: 2, fontFamily: "monospace",
        }).setDepth(50);
        this.tweens.add({ targets: dmgText, y: ec.y - 40, alpha: 0, duration: 600, onComplete: () => dmgText.destroy() });

        if (hp <= 0) this.killEnemy(ec);
      }

      killEnemy(ec: Phaser.GameObjects.Container) {
        killsRef.current++;
        setKills(killsRef.current);

        // Drop XP gem
        const gemColor = 0x44ff88;
        const xpValue = (ec.getData("xp") as number ?? 2) * statsRef.current.xpMult;
        const gem = this.add.arc(ec.x, ec.y, 6, 0, 360, false, gemColor, 1);
        gem.setDepth(5);
        gem.setData("xpValue", xpValue);
        this.physics.world.enable(gem);
        (gem.body as Phaser.Physics.Arcade.Body).setCircle(8, -2, -2);
        this.gems.add(gem);

        // Death particles
        for (let i = 0; i < 5; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 80 + Math.random() * 80;
          const p = this.add.arc(ec.x, ec.y, 3, 0, 360, false, 0x88ff66, 1);
          p.setDepth(6);
          this.physics.world.enable(p);
          (p.body as Phaser.Physics.Arcade.Body).setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
          this.time.delayedCall(400, () => p.destroy());
        }

        ec.destroy();
        this.totalKills++;
      }

      playerHit(enemy: Phaser.GameObjects.Container) {
        const now = this.time.now;
        const lastHit = (this as unknown as { lastHitTime: number }).lastHitTime ?? 0;
        if (now - lastHit < 800) return; // iframes
        (this as unknown as { lastHitTime: number }).lastHitTime = now;

        const dmg = enemy.getData("damage") as number ?? 10;
        hpRef.current = Math.max(0, hpRef.current - dmg);
        this.damageFlashAlpha = 0.6;

        if (hpRef.current <= 0) {
          setSurvived(false);
          setKills(killsRef.current);
          setLevel(levelRef.current);
          setTimeLeft(Math.ceil(timeRef.current));
          setGameState("gameover");
          this.scene.pause();
        }
      }

      collectGem(gem: Phaser.GameObjects.Arc) {
        if (!gem.active) return;
        const xpValue = gem.getData("xpValue") as number ?? 2;
        gem.destroy();

        xpRef.current += xpValue;
        const needed = XP_PER_LEVEL[Math.min(levelRef.current, XP_PER_LEVEL.length - 1)];
        if (xpRef.current >= needed) {
          xpRef.current -= needed;
          levelRef.current++;
          setLevel(levelRef.current);
          setXp(0);
          setXpNeeded(XP_PER_LEVEL[Math.min(levelRef.current, XP_PER_LEVEL.length - 1)] ?? 9999);

          // Pause and show level-up choices
          const choices = getLevelUpChoices(weaponsRef.current, passivesRef.current, levelRef.current);
          setLevelUpChoices(choices);
          this.scene.pause();
        } else {
          setXp(Math.round(xpRef.current));
        }
      }

      spawnEnemy() {
        const minute = this.gameTimer / 60;
        const available = ENEMY_TYPES.filter(e => !e.isBoss && e.spawnMinute <= minute);
        if (available.length === 0) return;
        const type = available[Phaser.Math.Between(0, available.length - 1)];
        this.doSpawnEnemy(type);
      }

      spawnBoss() {
        const minute = this.gameTimer / 60;
        const bosses = ENEMY_TYPES.filter(e => e.isBoss && e.spawnMinute <= minute);
        if (bosses.length === 0) return;
        const boss = bosses[Phaser.Math.Between(0, bosses.length - 1)];
        this.doSpawnEnemy(boss);
      }

      doSpawnEnemy(type: EnemyType) {
        const px = this.player.x, py = this.player.y;
        // Spawn at edge of screen
        const edge = Phaser.Math.Between(0, 3);
        let ex = px, ey = py;
        const margin = 50;
        const offScreen = 500;
        if (edge === 0) { ex = px + Phaser.Math.Between(-offScreen, offScreen); ey = py - offScreen; }
        else if (edge === 1) { ex = px + offScreen; ey = py + Phaser.Math.Between(-offScreen, offScreen); }
        else if (edge === 2) { ex = px + Phaser.Math.Between(-offScreen, offScreen); ey = py + offScreen; }
        else { ex = px - offScreen; ey = py + Phaser.Math.Between(-offScreen, offScreen); }
        ex = Phaser.Math.Clamp(ex, margin, WORLD_W - margin);
        ey = Phaser.Math.Clamp(ey, margin, WORLD_H - margin);

        const isBoss = type.isBoss ?? false;
        const scale = this.gameTimer / 120 + 1; // enemies get stronger over time

        const container = this.add.container(ex, ey);
        const c = parseInt(type.color.replace("#", ""), 16);
        const body = this.add.arc(0, 0, type.size, 0, 360, false, c, 1);
        const label = this.add.text(0, type.size + 3, type.emoji, { fontSize: isBoss ? "28px" : "18px" }).setOrigin(0.5, 0);
        container.add([body, label]);

        if (isBoss) {
          const bossLabel = this.add.text(0, -type.size - 14, `☠️ ${type.name}`, {
            fontSize: "10px", color: "#ff4444", stroke: "#000", strokeThickness: 2, fontFamily: "monospace",
          }).setOrigin(0.5, 0.5);
          container.add(bossLabel);
        }

        container.setDepth(7);
        container.setData("hp", type.hp * scale);
        container.setData("maxHp", type.hp * scale);
        container.setData("damage", type.damage);
        container.setData("xp", type.xp);
        container.setData("speed", type.speed * (0.9 + scale * 0.1));
        container.setData("color", type.color);
        container.setData("typeId", type.id);

        this.physics.world.enable(container);
        (container.body as Phaser.Physics.Arcade.Body).setCircle(type.size, -type.size, -type.size);
        this.enemies.add(container);
      }

      // Add orbit objects when lysara_orb is picked up
      addOrbitObjects(count: number) {
        while (this.orbitObjects.length > 0) { this.orbitObjects.pop()!.destroy(); }
        for (let i = 0; i < count; i++) {
          const orb = this.add.arc(0, 0, 12, 0, 360, false, 0xcc44ff, 0.9);
          orb.setDepth(11);
          this.orbitObjects.push(orb);
        }
      }
    }

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: containerRef.current?.clientWidth ?? CANVAS_W,
      height: containerRef.current?.clientHeight ?? CANVAS_H,
      parent: containerRef.current ?? undefined,
      backgroundColor: "#0d1a0d",
      physics: {
        default: "arcade",
        arcade: { debug: false, gravity: { x: 0, y: 0 } },
      },
      scene: OutbreakScene,
      audio: { disableWebAudio: false },
    };

    const game = new Phaser.Game(config);
    gameRef.current = game;

    // Expose scene for level-up callback
    (window as unknown as { flockSurvivorsScene: unknown }).flockSurvivorsScene = null;
    game.events.once("ready", () => {
      (window as unknown as { flockSurvivorsScene: unknown }).flockSurvivorsScene = game.scene.getScene("default");
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarUrl, username, userId]);

  // ── Level-up pick handler ──────────────────────────────────────────────────
  const handleLevelUpPick = useCallback((idx: number) => {
    if (!levelUpChoices) return;
    const choice = levelUpChoices[idx];
    if (!choice) return;

    if (choice.type === "weapon") {
      weaponsRef.current = [...weaponsRef.current, choice.id];
      setActiveWeapons([...weaponsRef.current]);
      // If lysara_orb, add orbit objects
      if (choice.id === "lysara_orb") {
        const scene = (gameRef.current as Phaser.Game | null)?.scene?.getScene("OutbreakScene");
        if (scene) (scene as unknown as { addOrbitObjects: (n: number) => void }).addOrbitObjects(2);
      }
    } else if (choice.type === "passive") {
      passivesRef.current = [...passivesRef.current, choice.id];
      setActivePassives([...passivesRef.current]);
      // Apply passive effect
      const passive = PASSIVE_ITEMS.find(p => p.id === choice.id);
      if (passive?.effect) {
        const e = passive.effect;
        if (e.speedMult) statsRef.current.speedMult *= e.speedMult;
        if (e.damageMult) statsRef.current.damageMult *= e.damageMult;
        if (e.xpMult) statsRef.current.xpMult *= e.xpMult;
        if (e.hpAdd) { maxHpRef.current += e.hpAdd; hpRef.current = Math.min(hpRef.current + e.hpAdd, maxHpRef.current); setMaxHp(maxHpRef.current); }
        if (e.hpRegenPerSec) statsRef.current.hpRegenPerSec += e.hpRegenPerSec;
        if (e.areaMultiplier) statsRef.current.areaMultiplier *= e.areaMultiplier;
        if (e.cooldownMult) statsRef.current.cooldownMult *= e.cooldownMult;
        if (e.magnetRange) statsRef.current.magnetRange *= e.magnetRange;
        if (e.luck) statsRef.current.luck += e.luck;
      }
    }

    setLevelUpChoices(null);
    setGameState("playing");
    // Resume Phaser scene
    const game = gameRef.current as Phaser.Game | null;
    game?.scene?.getScene("OutbreakScene")?.scene?.resume();
  }, [levelUpChoices]);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      (gameRef.current as { destroy?: (b: boolean) => void })?.destroy?.(true);
      wsRef.current?.close();
    };
  }, []);

  const mm = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const ss = (timeLeft % 60).toString().padStart(2, "0");
  const hpPct = (hp / maxHp) * 100;
  const xpPct = (xp / (xpNeeded || 1)) * 100;

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", background: "#0d1a0d", overflow: "hidden", fontFamily: "monospace" }}>
      {/* Menu */}
      {gameState === "menu" && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 100,
          background: "radial-gradient(ellipse at center, #0d200d 0%, #050f05 100%)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20,
        }}>
          <div style={{ fontSize: 64 }}>🧟</div>
          <div style={{ fontSize: 28, color: "#44ff88", fontWeight: 900, letterSpacing: 4 }}>FLOCK: OUTBREAK</div>
          <div style={{ fontSize: 13, color: "rgba(100,220,120,0.6)", textAlign: "center", maxWidth: 380, lineHeight: 1.8 }}>
            The dead have risen in Moonhaven.<br />
            Survive 10 minutes. Your Flock avatar is your weapon.
          </div>
          <div style={{ fontSize: 11, color: "rgba(80,180,100,0.4)", textAlign: "center", lineHeight: 2 }}>
            WASD to move • Auto-attack • Level up to gain powers<br />
            Survive 10:00 to win
          </div>
          <button onClick={startGame} style={{
            marginTop: 10, padding: "14px 40px", fontSize: 16, fontWeight: 900, cursor: "pointer",
            background: "rgba(50,200,80,0.2)", border: "2px solid rgba(50,200,80,0.5)",
            borderRadius: 12, color: "#44ff88", letterSpacing: 2,
            transition: "background 0.15s",
          }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(50,200,80,0.35)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(50,200,80,0.2)")}
          >
            ▶ SURVIVE
          </button>
          <Link href="/town" style={{ fontSize: 11, color: "rgba(100,200,120,0.35)", textDecoration: "none", marginTop: 4 }}>
            ← Back to Town
          </Link>
        </div>
      )}

      {/* Game canvas */}
      <div ref={containerRef} style={{ position: "absolute", inset: 0, display: gameState === "menu" ? "none" : "block" }} />

      {/* HUD */}
      {(gameState === "playing" || levelUpChoices) && (
        <>
          {/* Timer */}
          <div style={{
            position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
            zIndex: 60, background: "rgba(0,15,0,0.85)", border: "1px solid rgba(50,200,80,0.3)",
            borderRadius: 10, padding: "6px 18px",
            fontSize: 18, fontWeight: 900, color: timeLeft < 60 ? "#ff4444" : "#44ff88", letterSpacing: 3,
          }}>
            {mm}:{ss}
          </div>

          {/* HP bar */}
          <div style={{
            position: "absolute", bottom: 56, left: 12, zIndex: 60,
            width: 180, background: "rgba(0,10,0,0.8)", border: "1px solid rgba(50,200,80,0.2)", borderRadius: 8, padding: "6px 10px",
          }}>
            <div style={{ fontSize: 10, color: "rgba(50,220,80,0.5)", marginBottom: 3 }}>❤️ {hp}/{maxHp}</div>
            <div style={{ height: 6, background: "rgba(50,80,50,0.5)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${hpPct}%`, background: hpPct > 50 ? "#44ff88" : hpPct > 25 ? "#ffaa22" : "#ff4444", borderRadius: 3, transition: "width 0.2s" }} />
            </div>
          </div>

          {/* XP bar */}
          <div style={{
            position: "absolute", bottom: 36, left: 12, right: 12, zIndex: 60,
            height: 12, background: "rgba(0,10,0,0.8)", border: "1px solid rgba(100,100,255,0.2)", borderRadius: 6, overflow: "hidden",
          }}>
            <div style={{ height: "100%", width: `${xpPct}%`, background: "linear-gradient(to right, #4466ff, #88aaff)", transition: "width 0.1s" }} />
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "rgba(150,180,255,0.7)" }}>
              LV {level} — {Math.round(xp)}/{xpNeeded} XP
            </div>
          </div>

          {/* Kill counter */}
          <div style={{
            position: "absolute", top: 12, right: 12, zIndex: 60,
            background: "rgba(0,10,0,0.8)", border: "1px solid rgba(50,200,80,0.2)", borderRadius: 8, padding: "6px 12px",
            fontSize: 12, color: "#88ff99",
          }}>
            💀 {kills}
          </div>

          {/* Active weapons */}
          <div style={{
            position: "absolute", bottom: 56, right: 12, zIndex: 60,
            display: "flex", gap: 6,
          }}>
            {activeWeapons.map(wId => {
              const w = WEAPONS.find(x => x.id === wId);
              return w ? (
                <div key={wId} title={w.name} style={{
                  width: 34, height: 34, background: "rgba(0,10,0,0.85)", border: "1px solid rgba(50,200,80,0.25)",
                  borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                }}>
                  {w.emoji}
                </div>
              ) : null;
            })}
            {activePassives.map(pId => {
              const p = PASSIVE_ITEMS.find(x => x.id === pId);
              return p ? (
                <div key={pId} title={p.name} style={{
                  width: 34, height: 34, background: "rgba(0,5,20,0.85)", border: "1px solid rgba(50,80,200,0.25)",
                  borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                }}>
                  {p.emoji}
                </div>
              ) : null;
            })}
          </div>
        </>
      )}

      {/* Level-up overlay */}
      {levelUpChoices && (
        <LevelUpOverlay choices={levelUpChoices} onPick={handleLevelUpPick} playerLevel={level} />
      )}

      {/* Game over */}
      {gameState === "gameover" && (
        <GameOverScreen
          survived={survived}
          kills={kills}
          level={level}
          time={GAME_DURATION - timeLeft}
          onRestart={startGame}
        />
      )}
    </div>
  );
}
