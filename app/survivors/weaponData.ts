/**
 * Flock: Outbreak — Weapon & Item Data
 * Themed around the Moonhaven/Flock universe.
 */

export interface Weapon {
  id: string;
  name: string;
  emoji: string;
  description: string;
  baseDamage: number;
  baseFireRate: number; // shots per second
  baseRange: number;
  baseSpeed: number;  // projectile speed px/s
  baseCount: number;  // simultaneous projectiles
  projectileColor: string;
  /** Targeting mode */
  targeting: "nearest" | "all" | "direction" | "orbit";
}

export interface WeaponUpgrade {
  weaponId: string;
  level: number; // 1-8
  damageMult?: number;
  fireRateMult?: number;
  rangeMult?: number;
  speedMult?: number;
  countAdd?: number;
  special?: string;
  description: string;
}

export interface PassiveItem {
  id: string;
  name: string;
  emoji: string;
  description: string;
  effect: Partial<{
    speedMult: number;
    hpAdd: number;
    hpRegenPerSec: number;
    damageMult: number;
    xpMult: number;
    areaMultiplier: number;
    projectileMult: number;
    cooldownMult: number;
    magnetRange: number;
    luck: number;
  }>;
}

// ── WEAPONS ───────────────────────────────────────────────────────────────────

export const WEAPONS: Weapon[] = [
  {
    id: "moonbolt",
    name: "Moonbolt",
    emoji: "🌙",
    description: "Fires crescent bolts at the nearest enemy.",
    baseDamage: 12,
    baseFireRate: 1.5,
    baseRange: 280,
    baseSpeed: 380,
    baseCount: 1,
    projectileColor: "#aaddff",
    targeting: "nearest",
  },
  {
    id: "flock_shot",
    name: "Flock Shot",
    emoji: "🐦",
    description: "Launches a burst of birds in your facing direction.",
    baseDamage: 8,
    baseFireRate: 3,
    baseRange: 340,
    baseSpeed: 500,
    baseCount: 3,
    projectileColor: "#88ffaa",
    targeting: "direction",
  },
  {
    id: "pip_pebble",
    name: "Pip's Pebble",
    emoji: "🪨",
    description: "Bounces between enemies like Pip throwing rocks.",
    baseDamage: 18,
    baseFireRate: 0.8,
    baseRange: 200,
    baseSpeed: 300,
    baseCount: 1,
    projectileColor: "#ffcc44",
    targeting: "nearest",
  },
  {
    id: "lysara_orb",
    name: "Lysara's Orb",
    emoji: "🔮",
    description: "Orbiting arcane spheres that damage nearby enemies.",
    baseDamage: 22,
    baseFireRate: 0,
    baseRange: 120,
    baseSpeed: 0,
    baseCount: 2,
    projectileColor: "#cc44ff",
    targeting: "orbit",
  },
  {
    id: "herald_shout",
    name: "Herald's Shout",
    emoji: "📯",
    description: "Area shockwave around you — damages all nearby enemies.",
    baseDamage: 35,
    baseFireRate: 0.4,
    baseRange: 160,
    baseSpeed: 0,
    baseCount: 1,
    projectileColor: "#ffaa22",
    targeting: "all",
  },
  {
    id: "aldric_lance",
    name: "Aldric's Lance",
    emoji: "🛡️",
    description: "A piercing lance that goes through multiple enemies.",
    baseDamage: 28,
    baseFireRate: 0.9,
    baseRange: 400,
    baseSpeed: 600,
    baseCount: 1,
    projectileColor: "#4488ff",
    targeting: "nearest",
  },
  {
    id: "theron_hammer",
    name: "Theron's Hammer",
    emoji: "⚒️",
    description: "Slow but devastating. Slams down dealing massive area damage.",
    baseDamage: 65,
    baseFireRate: 0.3,
    baseRange: 100,
    baseSpeed: 0,
    baseCount: 1,
    projectileColor: "#ff6622",
    targeting: "all",
  },
  {
    id: "mira_curse",
    name: "Mira's Curse",
    emoji: "🧙‍♀️",
    description: "A slow-moving curse that poisons all enemies it passes through.",
    baseDamage: 5,  // per tick
    baseFireRate: 1.2,
    baseRange: 320,
    baseSpeed: 150,
    baseCount: 1,
    projectileColor: "#8855cc",
    targeting: "nearest",
  },
];

// ── WEAPON UPGRADES (level 2-8) ───────────────────────────────────────────────

export const WEAPON_UPGRADES: WeaponUpgrade[] = [
  // moonbolt upgrades
  { weaponId: "moonbolt", level: 2, damageMult: 1.3, description: "+30% damage" },
  { weaponId: "moonbolt", level: 3, countAdd: 1, description: "+1 bolt" },
  { weaponId: "moonbolt", level: 4, fireRateMult: 1.25, description: "+25% fire rate" },
  { weaponId: "moonbolt", level: 5, damageMult: 1.5, description: "+50% damage" },
  { weaponId: "moonbolt", level: 6, countAdd: 1, description: "+1 bolt (now 3)" },
  { weaponId: "moonbolt", level: 7, rangeMult: 1.3, description: "+30% range" },
  { weaponId: "moonbolt", level: 8, damageMult: 2.0, special: "lunar", description: "Lunar Barrage — bolts split on impact" },

  // flock_shot upgrades
  { weaponId: "flock_shot", level: 2, countAdd: 2, description: "+2 birds" },
  { weaponId: "flock_shot", level: 3, damageMult: 1.4, description: "+40% damage" },
  { weaponId: "flock_shot", level: 4, fireRateMult: 1.3, description: "+30% fire rate" },
  { weaponId: "flock_shot", level: 5, countAdd: 3, description: "+3 birds (now 8)" },
  { weaponId: "flock_shot", level: 6, speedMult: 1.5, description: "+50% speed" },
  { weaponId: "flock_shot", level: 7, damageMult: 1.6, description: "+60% damage" },
  { weaponId: "flock_shot", level: 8, special: "murder", description: "Murder of Crows — birds home on enemies" },

  // lysara_orb upgrades
  { weaponId: "lysara_orb", level: 2, damageMult: 1.3, description: "+30% orb damage" },
  { weaponId: "lysara_orb", level: 3, countAdd: 1, description: "+1 orb" },
  { weaponId: "lysara_orb", level: 4, rangeMult: 1.25, description: "+25% orbit radius" },
  { weaponId: "lysara_orb", level: 5, damageMult: 1.5, description: "+50% damage" },
  { weaponId: "lysara_orb", level: 6, countAdd: 2, description: "+2 orbs (now 5)" },
  { weaponId: "lysara_orb", level: 7, damageMult: 1.8, description: "+80% damage" },
  { weaponId: "lysara_orb", level: 8, special: "arcane_nova", description: "Arcane Nova — orbs explode on contact" },
];

// ── PASSIVE ITEMS ─────────────────────────────────────────────────────────────

export const PASSIVE_ITEMS: PassiveItem[] = [
  {
    id: "bessie_pie",
    name: "Bessie's Pie",
    emoji: "🥧",
    description: "+20 Max HP. Bessie's pies make everyone brave.",
    effect: { hpAdd: 20 },
  },
  {
    id: "aldric_boots",
    name: "Guard Boots",
    emoji: "👢",
    description: "+15% movement speed.",
    effect: { speedMult: 1.15 },
  },
  {
    id: "theron_anvil",
    name: "Theron's Anvil",
    emoji: "⚙️",
    description: "+20% damage to all weapons.",
    effect: { damageMult: 1.2 },
  },
  {
    id: "mira_tome",
    name: "Elder's Tome",
    emoji: "📖",
    description: "+20% XP gain.",
    effect: { xpMult: 1.2 },
  },
  {
    id: "herald_scroll",
    name: "Herald's Scroll",
    emoji: "📜",
    description: "+15% weapon area.",
    effect: { areaMultiplier: 1.15 },
  },
  {
    id: "lysara_crystal",
    name: "Ley Crystal",
    emoji: "💎",
    description: "-15% weapon cooldown.",
    effect: { cooldownMult: 0.85 },
  },
  {
    id: "pip_charm",
    name: "Pip's Lucky Charm",
    emoji: "🍀",
    description: "+10 luck. More item drops.",
    effect: { luck: 10 },
  },
  {
    id: "moon_amulet",
    name: "Moon Amulet",
    emoji: "🌙",
    description: "Regenerate 0.5 HP per second.",
    effect: { hpRegenPerSec: 0.5 },
  },
  {
    id: "flock_magnet",
    name: "Flock Magnet",
    emoji: "🧲",
    description: "Double XP gem pickup range.",
    effect: { magnetRange: 2 },
  },
  {
    id: "queen_crown",
    name: "Crown Fragment",
    emoji: "👑",
    description: "+25% damage, +25% XP gain.",
    effect: { damageMult: 1.25, xpMult: 1.25 },
  },
];

// ── ZOMBIE / ENEMY TYPES ──────────────────────────────────────────────────────

export interface EnemyType {
  id: string;
  name: string;
  emoji: string;
  hp: number;
  speed: number;       // px/s
  damage: number;      // per hit
  xp: number;
  size: number;        // radius
  color: string;
  spawnMinute: number; // earliest minute to spawn
  isBoss?: boolean;
  special?: "split" | "explode" | "fast" | "armored" | "healer";
}

export const ENEMY_TYPES: EnemyType[] = [
  // ── MINUTE 0-2 ──────────────────────────────────────────────────────────────
  {
    id: "shambler",
    name: "Shambler",
    emoji: "🧟",
    hp: 20, speed: 55, damage: 8, xp: 2, size: 14,
    color: "#558855", spawnMinute: 0,
  },
  {
    id: "raven_zombie",
    name: "Zombie Raven",
    emoji: "🐦",
    hp: 12, speed: 120, damage: 5, xp: 3, size: 10,
    color: "#225522", spawnMinute: 0,
    special: "fast",
  },
  // ── MINUTE 2-5 ──────────────────────────────────────────────────────────────
  {
    id: "bloated",
    name: "Bloated One",
    emoji: "🧟‍♂️",
    hp: 80, speed: 30, damage: 18, xp: 6, size: 22,
    color: "#33aa33", spawnMinute: 2,
    special: "explode",
  },
  {
    id: "bandit_zombie",
    name: "Bandit Risen",
    emoji: "💀",
    hp: 45, speed: 75, damage: 12, xp: 5, size: 16,
    color: "#885533", spawnMinute: 2,
  },
  {
    id: "runner",
    name: "Runner",
    emoji: "🏃",
    hp: 25, speed: 160, damage: 6, xp: 4, size: 12,
    color: "#226622", spawnMinute: 3,
    special: "fast",
  },
  // ── MINUTE 5-8 ──────────────────────────────────────────────────────────────
  {
    id: "armored_knight",
    name: "Risen Knight",
    emoji: "⚔️",
    hp: 180, speed: 40, damage: 25, xp: 12, size: 20,
    color: "#445566", spawnMinute: 5,
    special: "armored",
  },
  {
    id: "witch_spawn",
    name: "Corrupted Mage",
    emoji: "🧙",
    hp: 60, speed: 55, damage: 15, xp: 8, size: 16,
    color: "#441166", spawnMinute: 5,
    special: "healer",
  },
  {
    id: "horde_grunt",
    name: "Horde Grunt",
    emoji: "🧟‍♀️",
    hp: 35, speed: 80, damage: 10, xp: 4, size: 14,
    color: "#446633", spawnMinute: 5,
    special: "split",
  },
  // ── MINUTE 8+ ───────────────────────────────────────────────────────────────
  {
    id: "ancient_beast",
    name: "Ancient Beast",
    emoji: "👹",
    hp: 400, speed: 65, damage: 35, xp: 25, size: 32,
    color: "#882200", spawnMinute: 8,
    special: "armored",
  },
  // ── BOSSES (spawn every 2 minutes starting at 2) ───────────────────────────
  {
    id: "boss_bandit_lord",
    name: "Bandit Warlord",
    emoji: "💣",
    hp: 500, speed: 50, damage: 40, xp: 100, size: 36,
    color: "#cc4411", spawnMinute: 2,
    isBoss: true,
  },
  {
    id: "boss_dragon_zombie",
    name: "Zombie Dragon",
    emoji: "🐉",
    hp: 1200, speed: 80, damage: 60, xp: 250, size: 48,
    color: "#116622", spawnMinute: 6,
    isBoss: true,
    special: "split",
  },
  {
    id: "boss_moon_wraith",
    name: "Moon Wraith",
    emoji: "👻",
    hp: 2000, speed: 100, damage: 80, xp: 500, size: 52,
    color: "#2222aa", spawnMinute: 9,
    isBoss: true,
    special: "fast",
  },
];

// ── LEVEL-UP UPGRADE POOLS ────────────────────────────────────────────────────

/** Returns 3 random upgrade choices for the player at level up */
export function getLevelUpChoices(
  currentWeapons: string[],
  currentPassives: string[],
  playerLevel: number,
): Array<{ type: "weapon" | "weapon_upgrade" | "passive"; id: string; level?: number }> {
  const choices: Array<{ type: "weapon" | "weapon_upgrade" | "passive"; id: string; level?: number }> = [];

  // Prioritize weapon upgrades for owned weapons
  for (const wId of currentWeapons) {
    const currentLevel = (currentPassives.filter(p => p === wId).length ?? 0) + 1;
    if (currentLevel < 8) {
      choices.push({ type: "weapon_upgrade", id: wId, level: currentLevel + 1 });
    }
  }

  // New weapons (if under 6 slots)
  if (currentWeapons.length < 6) {
    const newWeapons = WEAPONS.filter(w => !currentWeapons.includes(w.id));
    for (const w of newWeapons) {
      choices.push({ type: "weapon", id: w.id });
    }
  }

  // Passives
  const newPassives = PASSIVE_ITEMS.filter(p => !currentPassives.includes(p.id));
  for (const p of newPassives) {
    choices.push({ type: "passive", id: p.id });
  }

  // Shuffle and return 3
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }

  return choices.slice(0, 3);
}
