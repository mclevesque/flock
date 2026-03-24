"use client";
import { useEffect, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface AdventureStats {
  user_id?: string;
  class: string | null;
  level: number;
  xp: number;
  hp: number;
  max_hp: number;
  base_attack: number;
  inventory: AdventureItem[];
  equipped_item_id: string | null;
  wins: number;
  quests_completed: number;
}

interface AdventureItem {
  id: string;
  name: string;
  emoji: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  slot?: string;
  effects: { type: string; value: number }[];
  obtained: string;
}

interface EnemyTemplate {
  name: string;
  emoji: string;
  hp: number;
  attack: number;
  xp: number;
  isBoss?: boolean;
  coinDrop?: [number, number]; // [min, max] coins
}

// Humanoid enemies that get RPG dialogue before combat
const HUMANOID_ENEMIES = new Set([
  "Bandit", "Bandit Captain", "Bandit Lord", "Dragon Guard", "Dragon Elite",
  "Death Knight", "Lich Apprentice", "Bone Knight", "Elite Guard", "Guard",
  "Dark Mage", "Pirate Lookout", "Pirate Captain",
]);
const HUMANOID_DIALOGUE: Record<string, string[]> = {
  "Bandit": ["Stand and deliver! Yer gold or yer life!", "Boss said no one gets through today."],
  "Bandit Captain": ["You've come far enough. Turn back now.", "I've beaten better heroes with one hand tied."],
  "Bandit Lord": ["So... someone actually made it this far.", "I'll give you credit for guts. GUARDS! ...Oh. Right. You killed them."],
  "Dragon Guard": ["HALT! None shall pass the Dragon's Peak!", "Trespassing here is punishable by death. My favorite punishment."],
  "Dragon Elite": ["The dragon will burn your world. Your resistance is FUTILE.", "I've slain a hundred heroes this week alone. You're next."],
  "Lich Apprentice": ["My master shall rise again! And you shall fall first!", "The undead outnumber the living here... considerably."],
  "Death Knight": ["I have died a thousand deaths. Yours will be number one thousand and one.", "You should turn back. The lich lord does not bargain."],
  "Elite Guard": ["You dare challenge the royal guard? Bold.", "Stand down now and I'll make your defeat... swift."],
  "Guard": ["Halt, traveler! This area is restricted!", "You really picked the wrong day to be brave."],
  "Dark Mage": ["Fools rush in where wise men fear to tread...", "I've studied dark arts for thirty years. This will be brief."],
  "Pirate Lookout": ["Arrr! Nobody told me about any heroes today!", "Cap'n's gonna be real upset when I tell 'em I lost..."],
  "Pirate Captain": ["Ahoy! So ye think ye can take me treasure, do ye?", "I've sailed the seven seas and buried me enemies in six of 'em."],
};

interface RoomTemplate {
  enemies: EnemyTemplate[];
  isBoss: boolean;
}

interface MissionData {
  name: string;
  description: string;
  theme: string;
  emoji: string;
  palette: { bg: string; accent: string; floor: string };
  rooms: RoomTemplate[];
  victoryDialogue?: string;
  victoryCharacter?: string;
}

interface TeamMember {
  userId: string;
  username: string;
  avatarUrl: string;
  hp: number;
  maxHp: number;
  playerClass: string | null;
  isDowned: boolean;
}

interface Props {
  userId: string;
  username: string;
  avatarUrl: string;
  myStats: AdventureStats;
  sessionId: string | null;
  missionData: MissionData;
  teamMembers: TeamMember[];
  onClose: () => void;
  onStatsUpdate: (patch: Partial<AdventureStats>) => void;
  onMinimize: (info: { name: string; room: number } | null) => void;
  onCoinsEarned?: (amount: number) => void;
  onOpenInventory?: () => void;
  caveMode?: boolean;
  caveLevel?: number;
  equippedSlots?: Record<string, { id?: string; emoji?: string; name?: string; ability?: string; consumable?: boolean } | null>;
}

// ── Seeded RNG ────────────────────────────────────────────────────────────────
function seededRng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const RARITY_COLORS: Record<string, string> = {
  common: "#aaaaaa",
  uncommon: "#4aee4a",
  rare: "#4488ff",
  epic: "#bb44ff",
  legendary: "#ffaa00",
};

// Ranged classes (mage/archer) have lower HP — they're glass cannons
const CLASS_HP: Record<string, number> = { warrior: 120, mage: 60, archer: 70, rogue: 80 };
// Ranged classes take +30% damage from enemy attacks
const CLASS_DMG_TAKEN: Record<string, number> = { warrior: 1.0, mage: 1.3, archer: 1.3, rogue: 1.0 };
const CLASS_ATK: Record<string, [number, number]> = {
  warrior: [12, 18], mage: [22, 30], archer: [16, 24], rogue: [20, 28],
};

// ── Mission Themes ─────────────────────────────────────────────────────────────
export const THEMES = {
  forest: {
    emoji: "🌲",
    palette: { bg: "#0d1a0a", accent: "#4aee4a", floor: "#1a2e12" },
    words: ["forest", "tree", "woods", "nature", "grove", "jungle", "green", "leaf", "bark", "vine"],
    bgColor: 0x1a3a1a, bgColor2: 0x143214,
    enemies: [
      [{ name: "Wolf", emoji: "🐺", hp: 40, attack: 6, xp: 15 }, { name: "Bandit", emoji: "🗡️", hp: 48, attack: 7, xp: 15 }],
      [{ name: "Dire Wolf", emoji: "🐺", hp: 65, attack: 9, xp: 25 }, { name: "Bandit Captain", emoji: "⚔️", hp: 72, attack: 10, xp: 25 }, { name: "Archer", emoji: "🏹", hp: 55, attack: 8, xp: 25 }],
      [{ name: "Bandit Lord", emoji: "👑", hp: 85, attack: 11, xp: 80, isBoss: true }, { name: "Elite Guard", emoji: "🛡️", hp: 55, attack: 8, xp: 30 }],
    ],
  },
  cave: {
    emoji: "💎",
    palette: { bg: "#0a0d1a", accent: "#44aaff", floor: "#12162e" },
    words: ["cave", "mine", "underground", "crystal", "dark", "stone", "tunnel", "dwarf", "depth"],
    bgColor: 0x0d1020, bgColor2: 0x091018,
    enemies: [
      [{ name: "Cave Spider", emoji: "🕷️", hp: 36, attack: 6, xp: 15 }, { name: "Bat", emoji: "🦇", hp: 44, attack: 5, xp: 15 }],
      [{ name: "Stone Golem", emoji: "🗿", hp: 70, attack: 10, xp: 25 }, { name: "Giant Spider", emoji: "🕷️", hp: 58, attack: 9, xp: 25 }, { name: "Gem Crab", emoji: "🦀", hp: 52, attack: 7, xp: 25 }],
      [{ name: "Cave Dragon", emoji: "🐲", hp: 90, attack: 12, xp: 80, isBoss: true }, { name: "Rock Elemental", emoji: "🗿", hp: 55, attack: 9, xp: 30 }],
    ],
  },
  ruins: {
    emoji: "💀",
    palette: { bg: "#140a1a", accent: "#bb44ff", floor: "#1e1028" },
    words: ["haunted", "ghost", "ruin", "ancient", "undead", "curse", "shadow", "crypt", "tomb", "graveyard", "zombie", "vampire"],
    bgColor: 0x180a24, bgColor2: 0x12061e,
    enemies: [
      [{ name: "Skeleton", emoji: "💀", hp: 38, attack: 6, xp: 15 }, { name: "Wraith", emoji: "👻", hp: 44, attack: 7, xp: 15 }],
      [{ name: "Lich Apprentice", emoji: "🧙", hp: 62, attack: 10, xp: 25 }, { name: "Bone Knight", emoji: "💀", hp: 68, attack: 9, xp: 25 }, { name: "Specter", emoji: "👻", hp: 54, attack: 8, xp: 25 }],
      [{ name: "Lich Lord", emoji: "💀", hp: 92, attack: 12, xp: 80, isBoss: true }, { name: "Death Knight", emoji: "⚔️", hp: 58, attack: 10, xp: 30 }],
    ],
  },
  dragon: {
    emoji: "🐉",
    palette: { bg: "#1a0a0a", accent: "#ff4422", floor: "#2e1212" },
    words: ["dragon", "mountain", "fire", "peak", "volcano", "lava", "inferno", "flame", "wyrm"],
    bgColor: 0x200808, bgColor2: 0x180606,
    enemies: [
      [{ name: "Dragon Guard", emoji: "🛡️", hp: 48, attack: 7, xp: 15 }, { name: "Fire Lizard", emoji: "🦎", hp: 40, attack: 8, xp: 15 }],
      [{ name: "Dragon Elite", emoji: "⚔️", hp: 72, attack: 11, xp: 25 }, { name: "Wyvern", emoji: "🐲", hp: 64, attack: 10, xp: 25 }, { name: "Flame Imp", emoji: "😈", hp: 46, attack: 8, xp: 25 }],
      [{ name: "Ancient Dragon", emoji: "🐉", hp: 100, attack: 13, xp: 80, isBoss: true }, { name: "Dragon Champion", emoji: "⚔️", hp: 60, attack: 10, xp: 30 }],
    ],
  },
  // ── Extra themes for custom text missions ───────────────────────────────
  gym: {
    emoji: "🏋️",
    palette: { bg: "#0a1222", accent: "#ff6622", floor: "#1a1a2e" },
    words: ["gym", "workout", "fitness", "protein", "shake", "muscles", "exercise", "lift", "weights", "cardio", "coach", "trainer", "sports", "athlete", "swole", "gains", "creatine", "supplement", "dumbbell", "treadmill"],
    bgColor: 0x111122, bgColor2: 0x0a0a1a,
    enemies: [
      [{ name: "Gym Bro", emoji: "💪", hp: 44, attack: 7, xp: 15 }, { name: "Cardio Karen", emoji: "🏃", hp: 36, attack: 6, xp: 15 }],
      [{ name: "Protein Shake Warrior", emoji: "🥤", hp: 62, attack: 10, xp: 25 }, { name: "Gym Girl", emoji: "💁", hp: 55, attack: 9, xp: 25 }, { name: "Spin Class Sergeant", emoji: "🚴", hp: 50, attack: 8, xp: 25 }],
      [{ name: "The Gains Goblin", emoji: "👹", hp: 92, attack: 13, xp: 80, isBoss: true }, { name: "Rogue PT", emoji: "💪", hp: 58, attack: 10, xp: 30 }],
    ],
  },
  space: {
    emoji: "🚀",
    palette: { bg: "#020412", accent: "#44ddff", floor: "#060c24" },
    words: ["space", "alien", "planet", "galaxy", "star", "rocket", "laser", "ufo", "cosmos", "orbit", "asteroid", "moon", "nasa", "astronaut", "sci-fi", "robot", "android", "cyborg", "meteor", "nebula", "cosmic", "intergalactic"],
    bgColor: 0x020412, bgColor2: 0x010210,
    enemies: [
      [{ name: "Space Grunt", emoji: "👾", hp: 40, attack: 6, xp: 15 }, { name: "Alien Scout", emoji: "🛸", hp: 38, attack: 7, xp: 15 }],
      [{ name: "Laser Trooper", emoji: "🔫", hp: 65, attack: 11, xp: 25 }, { name: "Alien Brute", emoji: "👽", hp: 70, attack: 10, xp: 25 }, { name: "Plasma Drone", emoji: "🤖", hp: 50, attack: 9, xp: 25 }],
      [{ name: "Galactic Overlord", emoji: "👽", hp: 100, attack: 14, xp: 80, isBoss: true }, { name: "Mech Commander", emoji: "🤖", hp: 60, attack: 10, xp: 30 }],
    ],
  },
  ocean: {
    emoji: "🌊",
    palette: { bg: "#020d1e", accent: "#00aaff", floor: "#041428" },
    words: ["ocean", "sea", "underwater", "pirate", "ship", "island", "treasure", "mermaid", "fish", "shark", "kraken", "nautical", "beach", "wave", "sailor", "deep", "coral", "reef", "submarine", "anchor", "swashbuckler"],
    bgColor: 0x030e20, bgColor2: 0x020b18,
    enemies: [
      [{ name: "Pirate Lookout", emoji: "🏴‍☠️", hp: 40, attack: 6, xp: 15 }, { name: "Sea Serpent", emoji: "🐍", hp: 44, attack: 7, xp: 15 }],
      [{ name: "Pirate Captain", emoji: "🏴‍☠️", hp: 68, attack: 10, xp: 25 }, { name: "Giant Crab", emoji: "🦀", hp: 60, attack: 9, xp: 25 }, { name: "Merman Guard", emoji: "🧜", hp: 54, attack: 8, xp: 25 }],
      [{ name: "Kraken", emoji: "🦑", hp: 100, attack: 13, xp: 80, isBoss: true }, { name: "Shark Knight", emoji: "🦈", hp: 58, attack: 10, xp: 30 }],
    ],
  },
  cyber: {
    emoji: "💾",
    palette: { bg: "#030a0a", accent: "#00ffaa", floor: "#071414" },
    words: ["cyber", "hack", "neon", "digital", "virtual", "matrix", "code", "virus", "program", "glitch", "tech", "data", "network", "arcade", "pixel", "vr", "simulation", "future", "ai", "online", "internet"],
    bgColor: 0x040c0c, bgColor2: 0x030a0a,
    enemies: [
      [{ name: "Rogue Bot", emoji: "🤖", hp: 38, attack: 6, xp: 15 }, { name: "Virus", emoji: "🦠", hp: 42, attack: 7, xp: 15 }],
      [{ name: "Firewall Guardian", emoji: "🔥", hp: 64, attack: 10, xp: 25 }, { name: "Malware Drone", emoji: "🤖", hp: 58, attack: 9, xp: 25 }, { name: "Data Wraith", emoji: "👻", hp: 50, attack: 8, xp: 25 }],
      [{ name: "The Virus King", emoji: "☠️", hp: 96, attack: 13, xp: 80, isBoss: true }, { name: "AI Overlord", emoji: "🤖", hp: 60, attack: 10, xp: 30 }],
    ],
  },
  medieval: {
    emoji: "🏰",
    palette: { bg: "#0d0a06", accent: "#cc8822", floor: "#1e1608" },
    words: ["castle", "knight", "sword", "medieval", "king", "queen", "royal", "siege", "battle", "war", "soldier", "armor", "shield", "lance", "jousting", "crown", "prince", "princess", "wizard"],
    bgColor: 0x100c06, bgColor2: 0x0c0a04,
    enemies: [
      [{ name: "Guard", emoji: "💂", hp: 44, attack: 7, xp: 15 }, { name: "Rogue Knight", emoji: "⚔️", hp: 48, attack: 7, xp: 15 }],
      [{ name: "Dark Knight", emoji: "🏇", hp: 70, attack: 10, xp: 25 }, { name: "Siege Archer", emoji: "🏹", hp: 60, attack: 9, xp: 25 }, { name: "Battle Mage", emoji: "🧙", hp: 56, attack: 10, xp: 25 }],
      [{ name: "Shadow King", emoji: "👑", hp: 96, attack: 13, xp: 80, isBoss: true }, { name: "Royal Champion", emoji: "⚔️", hp: 60, attack: 10, xp: 30 }],
    ],
  },
};

const PRESET_MISSIONS: Record<string, { name: string; description: string; theme: keyof typeof THEMES; victoryDialogue?: string; victoryCharacter?: string }> = {
  forest: { name: "Forest Bandits", description: "Bandits have taken over the old forest road. Clear them out.", theme: "forest" },
  cave: { name: "Crystal Cave", description: "Miners vanished inside the crystal caves. Something lurks in the deep.", theme: "cave" },
  ruins: { name: "Haunted Ruins", description: "The ancient ruins stir at night. The undead walk again.", theme: "ruins" },
  dragon: { name: "Dragon's Peak", description: "The dragon at the mountain's peak threatens the whole kingdom.", theme: "dragon" },
  princess: {
    name: "Rescue Princess Pip!",
    description: "Princess Pip has been kidnapped by Forestwood Bandits! Her father the king offers a generous reward — reportedly some very old coins and a coupon for 10% off the royal bakery. The cheese was fresh when you left.",
    theme: "forest",
    victoryDialogue: "OMG FINALLY! Do you know how BORING it is being held captive?! They made me listen to bandit POETRY for three HOURS. Anyway — you're a hero! Here's some coins and a bakery coupon. ...Please don't tell father about the poetry.",
    victoryCharacter: "👸",
  },
  pizza: {
    name: "The Dragon Stole My Pizza 🍕",
    description: "Old Gustavo the dragon has stolen your pizza delivery. Was it personal? Probably. Was it a supreme with extra cheese? Absolutely. The delivery guy is still crying. This ends TODAY.",
    theme: "dragon",
    victoryDialogue: "I... I just really wanted the pizza. Is that so wrong? I've been on a diet for 300 years and it smelled SO good. ...Fine. Here are some coins. And... sorry about the delivery guy's hat. It was an accident.",
    victoryCharacter: "🐉",
  },
  haunted_manor: {
    name: "The Haunted Manor of Dreadmoor",
    description: "Lord Dreadmoor's ghost has escaped the ancient sealing — and he's been LOUDLY haunting the manor, keeping the whole village awake with his dramatic monologuing. Someone needs to stop him from his third act.",
    theme: "ruins",
    victoryDialogue: "NOOOO! My dramatic third act! I had a WHOLE speech about the inevitable darkness of— ...Actually it was getting a bit long. You know what? Fair. Sleep well, brave adventurer. And tell Lord Belvins I said hello. He knows why.",
    victoryCharacter: "👻",
  },
  pirates: {
    name: "Plunder of the Deep Caves",
    description: "Pirates have taken over the old smuggling caves and are using them to hide stolen treasure. Also they keep singing sea shanties and the cave acoustics make it insufferable for three villages. End the concert.",
    theme: "cave",
    victoryDialogue: "Arrr... ye bested the whole crew? Even Big Barnacle Pete? ...He was our best lad. Well, rules of the sea: winner takes the treasure. Don't spend it all in one place. ...Okay spend it all. We would have.",
    victoryCharacter: "🏴‍☠️",
  },
};

function detectTheme(input: string): keyof typeof THEMES {
  const lower = input.toLowerCase();
  for (const [theme, data] of Object.entries(THEMES)) {
    if ((data as typeof THEMES.forest).words.some((w: string) => lower.includes(w))) return theme as keyof typeof THEMES;
  }
  return "ruins";
}

export function generateMission(input: string, seed: number, key: string): MissionData {
  const preset = PRESET_MISSIONS[key];
  if (preset) {
    const t = THEMES[preset.theme];
    return {
      name: preset.name,
      description: preset.description,
      theme: preset.theme,
      emoji: t.emoji,
      palette: t.palette,
      rooms: t.enemies.map((es, i) => ({ enemies: es.map(e => ({ ...e })), isBoss: i === 2 })),
      victoryDialogue: preset.victoryDialogue,
      victoryCharacter: preset.victoryCharacter,
    };
  }
  const theme = detectTheme(input);
  const t = THEMES[theme];
  const rng = seededRng(seed);
  const words = input.trim().split(/\s+/).slice(0, 3).map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
  const name = words.length > 2 ? words : `The ${words} Mission`;
  return {
    name,
    description: input.slice(0, 120),
    theme,
    emoji: t.emoji,
    palette: t.palette,
    rooms: t.enemies.map((es, i) => ({
      isBoss: i === 2,
      enemies: es.map(e => ({
        ...e,
        hp: Math.round(e.hp * (0.85 + rng() * 0.3)),
        attack: Math.round(e.attack * (0.85 + rng() * 0.3)),
      })),
    })),
  };
}

// ── Item Generation ────────────────────────────────────────────────────────────
const ITEM_PREFIXES = ["Ancient", "Cursed", "Radiant", "Shadow", "Storm", "Arcane", "Iron", "Blessed", "Void", "Ember"];

// Each entry: [baseName, emoji, slot]
const ITEM_TABLE: Record<string, [string, string, string][]> = {
  warrior: [
    ["Sword",      "⚔️",  "weapon"],
    ["Axe",        "🪓",  "weapon"],
    ["Greatsword", "⚔️",  "weapon"],
    ["Warhammer",  "🔨",  "weapon"],
    ["Shield",     "🛡️",  "secondary"],
    ["War-Shield", "🛡️",  "secondary"],
    ["Battle Helm","⛑️",  "helm"],
    ["Iron Crown", "👑",  "helm"],
    ["Sabatons",   "🥾",  "boots"],
    ["Warboots",   "👢",  "boots"],
  ],
  mage: [
    ["Staff",      "🪄",  "weapon"],
    ["Wand",       "🪄",  "weapon"],
    ["Tome",       "📖",  "weapon"],
    ["Orb",        "🔮",  "weapon"],
    ["Grimoire",   "📜",  "weapon"],
    ["Focus",      "🔮",  "secondary"],
    ["Wizard Hat", "🎓",  "helm"],
    ["Arcane Hood","🎩",  "helm"],
    ["Spellboots", "👟",  "boots"],
    ["Mage Shoes", "👟",  "boots"],
  ],
  archer: [
    ["Bow",        "🏹",  "weapon"],
    ["Longbow",    "🏹",  "weapon"],
    ["Crossbow",   "🏹",  "weapon"],
    ["Shortbow",   "🏹",  "weapon"],
    ["Quiver",     "🪃",  "secondary"],
    ["Side Knife", "🔪",  "secondary"],
    ["Ranger Hood","🎩",  "helm"],
    ["Scout Cap",  "🧢",  "helm"],
    ["Swift Boots","👟",  "boots"],
    ["Tracking Boots","🥾","boots"],
  ],
  rogue: [
    ["Dagger",     "🗡️",  "weapon"],
    ["Stiletto",   "🗡️",  "weapon"],
    ["Shiv",       "🔪",  "weapon"],
    ["Knife",      "🔪",  "weapon"],
    ["Shadow Shank","🗡️", "weapon"],
    ["Throwing Star","⭐","secondary"],
    ["Smoke Bomb", "💨",  "secondary"],
    ["Shadow Hood","🎩",  "helm"],
    ["Rogue Mask", "🎭",  "helm"],
    ["Shadowstep Boots","👟","boots"],
    ["Assassin Boots","🥾","boots"],
  ],
  default: [
    ["Sword",      "⚔️",  "weapon"],
    ["Shield",     "🛡️",  "secondary"],
    ["Helm",       "⛑️",  "helm"],
    ["Boots",      "👟",  "boots"],
    ["Dagger",     "🗡️",  "weapon"],
  ],
};
const RARITY_WEIGHTS = [
  { rarity: "common" as const, weight: 65, range: [1, 3] as [number, number] },
  { rarity: "uncommon" as const, weight: 24, range: [4, 7] as [number, number] },
  { rarity: "rare" as const, weight: 9, range: [8, 12] as [number, number] },
  { rarity: "epic" as const, weight: 1.9, range: [13, 18] as [number, number] },
  { rarity: "legendary" as const, weight: 0.1, range: [20, 30] as [number, number] },
];

// Legendary special abilities — insane effects that change gameplay
const LEGENDARY_ABILITIES = [
  { type: "lifesteal", value: 50, label: "Lifesteal 50% of damage dealt" },
  { type: "time_freeze", value: 1, label: "Freeze enemies for 1 turn on special" },
  { type: "aura_damage", value: 8, label: "Passive aura deals 8 dmg/turn to all enemies" },
  { type: "double_strike", value: 2, label: "50% chance to attack twice" },
  { type: "berserker", value: 25, label: "Deal +25% damage below 30% HP" },
];

const EPIC_ABILITIES = [
  { type: "crit_chance", value: 25, label: "25% chance to critical hit (×2 damage)" },
  { type: "poison", value: 5, label: "Poison: 5 dmg/turn to enemy" },
  { type: "shield", value: 10, label: "Block up to 10 damage per hit" },
  { type: "regen", value: 3, label: "Regenerate 3 HP per turn in combat" },
];

function rollRarity(rng: () => number) {
  const r = rng() * 100;
  let cum = 0;
  for (const t of RARITY_WEIGHTS) { cum += t.weight; if (r < cum) return t; }
  return RARITY_WEIGHTS[0];
}

export function generateItem(playerClass: string | null, missionName: string, rng: () => number, playerLevel = 1): AdventureItem {
  const cls = (playerClass ?? "default") as keyof typeof ITEM_TABLE;
  const pool = ITEM_TABLE[cls] ?? ITEM_TABLE.default;
  const [base, emoji, slot] = pool[Math.floor(rng() * pool.length)];
  const prefix = ITEM_PREFIXES[Math.floor(rng() * ITEM_PREFIXES.length)];
  const tier = rollRarity(rng);
  // Level bonus scales item value — same 1.5×/level factor as vendor + event loot
  const levelBonus = Math.floor((Math.max(1, playerLevel) - 1) * 1.5);
  const val = tier.range[0] + Math.floor(rng() * (tier.range[1] - tier.range[0] + 1)) + levelBonus;

  // Choose effect type based on slot
  let effects: { type: string; value: number }[];
  const slotEffect: Record<string, string> = {
    weapon: "attack_boost",
    secondary: "defense",
    helm: "hp_boost",
    boots: "hp_boost",
  };

  if (tier.rarity === "legendary") {
    const ability = LEGENDARY_ABILITIES[Math.floor(rng() * LEGENDARY_ABILITIES.length)];
    effects = [{ type: slotEffect[slot] ?? "attack_boost", value: val }, { type: ability.type, value: ability.value }];
  } else if (tier.rarity === "epic") {
    const ability = EPIC_ABILITIES[Math.floor(rng() * EPIC_ABILITIES.length)];
    effects = [{ type: slotEffect[slot] ?? "attack_boost", value: val }, { type: ability.type, value: ability.value }];
  } else {
    effects = [{ type: slotEffect[slot] ?? "attack_boost", value: val }];
  }

  return {
    id: Math.random().toString(36).slice(2, 10),
    name: `${prefix} ${base}`,
    emoji,
    rarity: tier.rarity,
    slot,
    effects,
    obtained: missionName,
  };
}

function xpToNextLevel(level: number) {
  // Fast early levels: level 1→2 takes 40 XP, then ramps up from level 2
  if (level === 1) return 40;
  return Math.round(60 + (level - 2) * 75);
}
function applyXP(stats: AdventureStats, xpGained: number): Partial<AdventureStats> {
  let { level, xp, max_hp, base_attack } = stats;
  xp += xpGained;
  while (xp >= xpToNextLevel(level) && level < 99) {
    xp -= xpToNextLevel(level);
    level++;
    max_hp += 8;       // +8 HP/level (was +5) — level-up feels more rewarding
    base_attack += 1;
  }
  return { level, xp, max_hp, base_attack };
}

// ── Audio helpers ──────────────────────────────────────────────────────────────
let _audioCtx: AudioContext | null = null;
function getACtx(): AudioContext | null {
  try {
    if (!_audioCtx || _audioCtx.state === "closed") {
      _audioCtx = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    if (_audioCtx.state === "suspended") _audioCtx.resume().catch(() => {});
    return _audioCtx;
  } catch { return null; }
}
function playVictoryMusic() {
  const ctx = getACtx(); if (!ctx) return;
  const melody = [523.25, 659.25, 783.99, 1046.50, 783.99, 1046.50, 1318.51, 1046.50];
  melody.forEach((freq, i) => {
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "square"; osc.frequency.value = freq;
    const t = ctx.currentTime + i * 0.13;
    gain.gain.setValueAtTime(0.12, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.start(t); osc.stop(t + 0.3);
  });
}
function playHitSound(isEnemyHit = true) {
  const ctx = getACtx(); if (!ctx) return;
  const osc = ctx.createOscillator(); const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  if (isEnemyHit) {
    osc.type = "sawtooth"; osc.frequency.setValueAtTime(320, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.18, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.start(); osc.stop(ctx.currentTime + 0.08);
  } else {
    osc.type = "sine"; osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.2, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start(); osc.stop(ctx.currentTime + 0.12);
  }
}
function playDangerStab() {
  const ctx = getACtx(); if (!ctx) return;
  [180, 90].forEach((freq, i) => {
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "triangle"; osc.frequency.value = freq;
    const t = ctx.currentTime + i * 0.08;
    gain.gain.setValueAtTime(0.15, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.start(t); osc.stop(t + 0.35);
  });
}
function playProjectileSound(cls: string) {
  const ctx = getACtx(); if (!ctx) return;
  if (cls === "archer") {
    // Quick bow whoosh
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(900, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.09, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
    osc.start(); osc.stop(ctx.currentTime + 0.14);
  } else if (cls === "mage") {
    // Rising magic zap
    [400, 800, 1400].forEach((freq, i) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine"; osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.04;
      gain.gain.setValueAtTime(0.08, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.start(t); osc.stop(t + 0.1);
    });
  }
}
function playHeartPickup() {
  const ctx = getACtx(); if (!ctx) return;
  // Ascending soft chime ♪
  [523, 659, 784].forEach((freq, i) => {
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sine"; osc.frequency.value = freq;
    const t = ctx.currentTime + i * 0.07;
    gain.gain.setValueAtTime(0.11, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.start(t); osc.stop(t + 0.22);
  });
}
function playCoinPickup() {
  const ctx = getACtx(); if (!ctx) return;
  [880, 1100].forEach((freq, i) => {
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = "triangle"; osc.frequency.value = freq;
    osc.connect(gain); gain.connect(ctx.destination);
    const t = ctx.currentTime + i * 0.05;
    gain.gain.setValueAtTime(0.07, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.start(t); osc.stop(t + 0.15);
  });
}
function playEnemyGrowl(isBoss: boolean) {
  const ctx = getACtx(); if (!ctx) return;
  const osc = ctx.createOscillator(); const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  if (isBoss) {
    // Deep boss roar — low, menacing
    osc.type = "sawtooth"; osc.frequency.setValueAtTime(60, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(28, ctx.currentTime + 0.6);
    gain.gain.setValueAtTime(0.0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.65);
    osc.start(); osc.stop(ctx.currentTime + 0.65);
    // Second harmonic for richness
    const osc2 = ctx.createOscillator(); const gain2 = ctx.createGain();
    osc2.connect(gain2); gain2.connect(ctx.destination);
    osc2.type = "square"; osc2.frequency.setValueAtTime(90, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.5);
    gain2.gain.setValueAtTime(0.08, ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc2.start(); osc2.stop(ctx.currentTime + 0.5);
  } else {
    // Regular enemy growl — short snarl
    osc.type = "sawtooth"; osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.start(); osc.stop(ctx.currentTime + 0.22);
  }
}
function playCoinChestOpen() {
  const ctx = getACtx(); if (!ctx) return;
  [440, 554, 660, 880].forEach((freq, i) => {
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = "triangle"; osc.frequency.value = freq;
    osc.connect(gain); gain.connect(ctx.destination);
    const t = ctx.currentTime + i * 0.08;
    gain.gain.setValueAtTime(0.1, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.start(t); osc.stop(t + 0.3);
  });
}

function playRibbitAdv() {
  try {
    const ctx = getACtx(); if (!ctx) return;
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(320, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.12);
    osc.frequency.setValueAtTime(360, ctx.currentTime + 0.18);
    osc.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + 0.32);
    gain.gain.setValueAtTime(0.28, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
  } catch { /* ignore */ }
}

// ── Scene constants ────────────────────────────────────────────────────────────
const SW = 1200, SH = 680; // scene world size
const PLAYER_SPEED = 160;
const PATROL_SPEED = 42;
const AGGRO_SPEED = 90;          // enemies move faster when chasing
const AGGRO_DIST = 280;          // initial spot distance (was 150)
const AGGRO_HUNT_DIST = 600;     // enemy hunts until this far from player
const MELEE_COMBAT_DIST = 52;    // warrior/rogue trigger combat up close
const RANGED_COMBAT_DIST = 210;  // archer/mage trigger combat from range

// ── Phaser Enemy state (stored in scene) ──────────────────────────────────────
interface EnemyObj {
  id: string;
  container: Phaser.GameObjects.Container;
  hpFill: Phaser.GameObjects.Graphics;
  emojiText: Phaser.GameObjects.Text;
  hp: number;
  maxHp: number;
  attack: number;
  xp: number;
  name: string;
  emoji: string;
  state: "patrol" | "aggro" | "dead";
  patrolTarget: { x: number; y: number };
  patrolWait: number;
  isBoss: boolean;
  spawnX: number;
  spawnY: number;
  aggroLocked: boolean;       // once spotted player, stays hunting
  lastSeenX: number;          // last known player position for hunting
  lastSeenY: number;
  hasGrowled: boolean;        // play growl sound only once on first aggro
  frogged_until?: number;     // timestamp — while active, enemy cannot attack
  frogOverlay?: Phaser.GameObjects.Container; // big frog visual on top of enemy
}

interface HeartPickup {
  id: string;
  container: Phaser.GameObjects.Container;
  value: number;
  picked: boolean;
}

// ── Cave level-scaled enemy generation ───────────────────────────────────────
function caveEnemiesForLevel(level: number, roomIdx: number): EnemyTemplate[] {
  const scale = 1 + (level - 1) * 0.15;          // 15% per level (was 12%)
  const bossHpScale = scale * 1.12;               // slightly tougher boss curve
  const caveEnemies = [
    [
      { name: "Cave Rat", emoji: "🐀", hp: Math.round(34 * scale), attack: Math.round(5 * scale), xp: 12 + level * 2 },
      { name: "Stone Bat", emoji: "🦇", hp: Math.round(38 * scale), attack: Math.round(5 * scale), xp: 12 + level * 2 },
    ],
    [
      { name: "Dire Spider", emoji: "🕷️", hp: Math.round(54 * scale), attack: Math.round(7 * scale), xp: 20 + level * 3 },
      { name: "Rock Crab", emoji: "🦀", hp: Math.round(58 * scale), attack: Math.round(7 * scale), xp: 20 + level * 3 },
      { name: "Cave Worm", emoji: "🪱", hp: Math.round(48 * scale), attack: Math.round(8 * scale), xp: 20 + level * 3 },
    ],
    [
      { name: "Cave Troll", emoji: "👹", hp: Math.round(80 * bossHpScale), attack: Math.round(10 * bossHpScale), xp: 60 + level * 8, isBoss: true },
      { name: "Stone Golem", emoji: "🗿", hp: Math.round(55 * scale), attack: Math.round(7 * scale), xp: 25 + level * 3 },
    ],
  ];
  return caveEnemies[Math.min(roomIdx, 2)];
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AdventureOverlay({
  userId, username, avatarUrl, myStats, sessionId, missionData,
  teamMembers, onClose, onStatsUpdate, onMinimize, onCoinsEarned, onOpenInventory,
  caveMode = false, caveLevel, equippedSlots = {},
}: Props & { caveMode?: boolean; caveLevel?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<unknown>(null);

  // Phase: dungeon = walking, combat = fighting, victory = won, defeat = died
  const [phase, setPhase] = useState<"dungeon" | "combat" | "victory" | "defeat">("dungeon");
  const phaseRef = useRef<"dungeon" | "combat" | "victory" | "defeat">("dungeon");

  // Player HP
  const [playerHp, setPlayerHp] = useState(() => {
    const cls = myStats.class;
    const maxHp = cls ? (CLASS_HP[cls] ?? myStats.max_hp) : myStats.max_hp;
    return Math.min(myStats.hp, maxHp);
  });
  const playerHpRef = useRef(playerHp);
  const playerMaxHp = myStats.class ? (CLASS_HP[myStats.class] ?? myStats.max_hp) : myStats.max_hp;

  // Potions (3 per mission)
  const [potions, setPotions] = useState(3);
  const potionsRef = useRef(3);

  // Special ability cooldown
  const [specialCooldown, setSpecialCooldown] = useState(0);
  const specialCooldownRef = useRef(0);

  // ── Equipped item ability targeting (two-step: click item → click target) ──
  type AdvAbilityMode = { ability: string; itemEmoji: string; itemName: string } | null;
  const [advAbilityMode, setAdvAbilityMode] = useState<AdvAbilityMode>(null);
  const advAbilityModeRef = useRef<AdvAbilityMode>(null);
  const [frogCooldownAdv, setFrogCooldownAdv] = useState(0);
  const frogCooldownAdvRef = useRef(0);
  const equippedSlotsRef = useRef(equippedSlots);
  equippedSlotsRef.current = equippedSlots;

  // Combat
  interface CombatEnemyState { id: string; name: string; emoji: string; hp: number; maxHp: number; attack: number; xp: number; isBoss: boolean; }
  const [combatEnemy, setCombatEnemy] = useState<CombatEnemyState | null>(null);
  const combatEnemyRef = useRef<CombatEnemyState | null>(null);
  const [combatLog, setCombatLog] = useState<string[]>([]);
  const [actionPending, setActionPending] = useState(false);
  const actionPendingRef = useRef(false);

  // Room
  const [roomIndex, setRoomIndex] = useState(0);
  const roomIndexRef = useRef(0);
  const totalRooms = caveMode ? 3 : missionData.rooms.length;

  // Loot
  const [pendingLoot, setPendingLoot] = useState<AdventureItem[]>([]);
  const [showLoot, setShowLoot] = useState(false);

  // Total XP gained this run
  const xpGainedRef = useRef(0);
  // Total coins earned this run (sent to TownClient on victory/exit)
  const coinsEarnedRef = useRef(0);

  // RPG dialogue box — shown before humanoid enemy combat
  interface DialogueState { lines: string[]; character: string; isBoss: boolean; enemyId: string; }
  const [dialoguePending, setDialoguePending] = useState<DialogueState | null>(null);

  // Tap-to-move target (mobile only — desktop uses WASD)
  const tapTargetRef = useRef<{ x: number; y: number } | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  // React-level key tracking — bypasses Phaser keyboard plugin so movement
  // works even when TownClient's Phaser game is also listening at window level
  const keysRef = useRef<Set<string>>(new Set());

  // Ref to enemies in scene (so React combat handler can update them)
  const sceneEnemiesRef = useRef<EnemyObj[]>([]);
  // Callback to remove dead enemy from scene
  const removeEnemyFromSceneRef = useRef<((id: string) => void) | null>(null);
  // Check if all enemies dead
  const checkAllDeadRef = useRef<(() => void) | null>(null);
  // Spawn a heart pickup at world coords
  const spawnHeartRef = useRef<((x: number, y: number, value: number) => void) | null>(null);
  // Fire a projectile toward a target (called from React combat panel)
  const fireProjectileRef = useRef<((tx: number, ty: number) => void) | null>(null);

  const theme = caveMode ? THEMES.cave : THEMES[missionData.theme as keyof typeof THEMES] ?? THEMES.cave;
  const palette = caveMode ? { bg: "#0a0d1a", accent: "#44aaff", floor: "#12162e" } : missionData.palette;

  const getRoomEnemies = (rIdx: number): EnemyTemplate[] => {
    if (caveMode) {
      const lvl = caveLevel ?? myStats.level;
      return caveEnemiesForLevel(lvl, rIdx);
    }
    // Apply level scaling to all theme enemies so the game stays challenging
    // as players level up — not just in the South Cave.
    //   Normal enemies: +7% HP/ATK per level | Boss: +9% per level
    //   XP reward:      +8% per level (keeps leveling rewarding at high levels)
    const baseEnemies = (missionData.rooms[rIdx]?.enemies ?? []) as EnemyTemplate[];
    const lvl = Math.max(1, myStats.level ?? 1);
    if (lvl <= 1) return baseEnemies;
    const normalScale = 1 + (lvl - 1) * 0.07;
    const bossScale   = 1 + (lvl - 1) * 0.09;
    return baseEnemies.map(e => {
      const s = e.isBoss ? bossScale : normalScale;
      return {
        ...e,
        hp:     Math.round(e.hp * s),
        attack: Math.round(e.attack * s),
        xp:     Math.round(e.xp * (1 + (lvl - 1) * 0.08)),
      };
    });
  };

  useEffect(() => {
    setIsTouchDevice("ontouchstart" in window || navigator.maxTouchPoints > 0);
  }, []);

  // Track keys at window level — works regardless of canvas focus or Phaser conflicts
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key); keysRef.current.add(e.key.toLowerCase());
      // C = open inventory (works inside cave/adventure)
      if ((e.key === "c" || e.key === "C") && onOpenInventory) {
        e.preventDefault();
        onOpenInventory();
      }
    };
    const onUp = (e: KeyboardEvent) => { keysRef.current.delete(e.key); keysRef.current.delete(e.key.toLowerCase()); };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, [onOpenInventory]);

  // Re-focus canvas whenever we return to dungeon phase (e.g. after combat, flee, victory)
  useEffect(() => {
    if (phase === "dungeon") {
      setTimeout(() => {
        const canvas = containerRef.current?.querySelector("canvas");
        if (canvas) (canvas as HTMLElement).focus();
      }, 50);
    }
  }, [phase]);


  // ── Init Phaser ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let game: import("phaser").Game | null = null;

    async function initPhaser() {
      const Phaser = (await import("phaser")).default;
      if (!containerRef.current || gameRef.current) return;

      const canvasW = containerRef.current.clientWidth || window.innerWidth;
      const canvasH = containerRef.current.clientHeight || window.innerHeight - 56;

      class AdventureScene extends Phaser.Scene {
        player!: Phaser.GameObjects.Container;
        playerImg!: Phaser.GameObjects.Image;
        cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
        wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
        door!: Phaser.GameObjects.Container;
        doorOpen = false;
        doorGraphic!: Phaser.GameObjects.Graphics;
        doorText!: Phaser.GameObjects.Text;
        exitZone!: Phaser.GameObjects.Zone;
        loadingTexture = false;
        direction = "right";
        roomEnemies: EnemyObj[] = [];
        heartPickups: HeartPickup[] = [];
        hintText!: Phaser.GameObjects.Text;

        constructor() { super({ key: "AdventureScene" }); }

        preload() { /* nothing - load avatar via HTMLImageElement */ }

        drawThemeBackground() {
          const bg = this.add.graphics();
          const t = theme;
          const col1 = t.bgColor;
          const col2 = t.bgColor2;
          const TILE = 40;
          for (let tx = 0; tx < SW; tx += TILE) {
            for (let ty = 0; ty < SH; ty += TILE) {
              const shade = ((tx / TILE + ty / TILE) % 2 === 0) ? col1 : col2;
              bg.fillStyle(shade, 1);
              bg.fillRect(tx, ty, TILE, TILE);
            }
          }
          // Floor detail pattern
          bg.lineStyle(1, 0xffffff, 0.04);
          for (let tx = 0; tx < SW; tx += TILE) { bg.moveTo(tx, 0); bg.lineTo(tx, SH); }
          for (let ty = 0; ty < SH; ty += TILE) { bg.moveTo(0, ty); bg.lineTo(SW, ty); }
          bg.strokePath();
          bg.setDepth(0);
        }

        drawObstacles() {
          const themeKey = caveMode ? "cave" : missionData.theme;
          const rng2 = seededRng(12345 + roomIndexRef.current * 7);
          // Obstacle positions (spread around scene, away from center and edges)
          const positions = Array.from({ length: 14 }, (_, i) => ({
            x: 80 + (rng2() * (SW - 200)),
            y: 80 + (rng2() * (SH - 200)),
          })).filter(p => Math.abs(p.x - SW / 2) > 120 || Math.abs(p.y - SH / 2) > 100);

          positions.forEach(({ x, y }) => {
            const g = this.add.graphics();
            if (themeKey === "forest") {
              // Tree
              g.fillStyle(0x000000, 0.2); g.fillEllipse(x, y + 24, 40, 12);
              g.fillStyle(0x5a2a0e, 1); g.fillRect(x - 4, y + 10, 8, 22);
              g.fillStyle(0x0d4416, 1); g.fillTriangle(x, y - 32, x - 22, y + 12, x + 22, y + 12);
              g.fillStyle(0x1a6824, 1); g.fillTriangle(x, y - 24, x - 18, y + 14, x + 18, y + 14);
              g.fillStyle(0x2a8832, 1); g.fillCircle(x, y - 14, 13);
              g.fillStyle(0x40aa44, 0.4); g.fillCircle(x - 5, y - 20, 7);
            } else if (themeKey === "cave") {
              // Stalagmite / crystal
              g.fillStyle(0x1a1a3a, 0.9); g.fillTriangle(x, y - 30, x - 16, y + 10, x + 16, y + 10);
              g.fillStyle(0x334488, 0.7); g.fillTriangle(x - 8, y - 16, x - 20, y + 10, x + 4, y + 10);
              g.fillStyle(0x4488ff, 0.3); g.fillTriangle(x + 6, y - 10, x - 2, y + 10, x + 18, y + 10);
              // Glowing crystal tip
              g.fillStyle(0x88ccff, 0.8); g.fillCircle(x, y - 32, 4);
            } else if (themeKey === "ruins") {
              // Broken wall segment
              g.fillStyle(0x2a1840, 0.9); g.fillRect(x - 14, y - 20, 28, 40);
              g.fillStyle(0x3a2050, 1); g.fillRect(x - 12, y - 18, 24, 36);
              g.fillStyle(0x4a3060, 1); g.fillRect(x - 10, y - 22, 10, 8);
              g.fillStyle(0x4a3060, 1); g.fillRect(x + 4, y + 14, 8, 8);
              g.lineStyle(1, 0x6a4080, 0.4); g.strokeRect(x - 10, y - 16, 22, 32);
            } else {
              // Dragon theme: lava rock
              g.fillStyle(0x2a0808, 1); g.fillEllipse(x, y, 36, 24);
              g.fillStyle(0x4a1010, 1); g.fillEllipse(x - 2, y - 2, 28, 16);
              g.fillStyle(0xff4400, 0.4); g.fillEllipse(x, y, 10, 6);
              g.fillStyle(0xff8800, 0.2); g.fillCircle(x, y - 2, 5);
            }
            g.setDepth(2);
          });
        }

        drawWalls() {
          const wall = this.add.graphics();
          wall.fillStyle(0x000000, 0.6);
          wall.fillRect(0, 0, SW, 12); // top
          wall.fillRect(0, SH - 12, SW, 12); // bottom
          wall.fillRect(0, 0, 12, SH); // left
          wall.fillRect(SW - 12, 0, 12, SH); // right
          wall.setDepth(1);
        }

        spawnEnemies(roomIdx: number) {
          const templates = getRoomEnemies(roomIdx);
          const count = templates.length;
          this.roomEnemies = [];
          sceneEnemiesRef.current = [];

          templates.forEach((tmpl, i) => {
            // Distribute enemies across the scene
            const spawnX = 200 + (i / Math.max(count - 1, 1)) * (SW - 400);
            const spawnY = 150 + (i % 2 === 0 ? 0 : 200) + Math.random() * 80;

            const container = this.add.container(spawnX, spawnY);
            // Glow circle (boss has larger glow)
            const glowSize = tmpl.isBoss ? 56 : 38;
            const glowColor = tmpl.isBoss ? 0x880000 : 0x440000;
            const glow = this.add.graphics();
            glow.fillStyle(glowColor, 0.6); glow.fillCircle(0, 8, glowSize * 0.7);
            glow.fillStyle(0xff4444, 0.2); glow.fillCircle(0, 0, glowSize * 0.55);
            container.add(glow);

            // Shadow
            const shadow = this.add.graphics();
            shadow.fillStyle(0x000000, 0.35); shadow.fillEllipse(0, 20, 44, 14);
            container.add(shadow);

            // Emoji text
            const emojiSize = tmpl.isBoss ? "42px" : "32px";
            const emojiText = this.add.text(0, -8, tmpl.emoji, {
              fontSize: emojiSize, fontFamily: "serif",
            }).setOrigin(0.5, 0.5);
            container.add(emojiText);

            // Name label
            const label = this.add.text(0, 26, tmpl.isBoss ? `👑 ${tmpl.name}` : tmpl.name, {
              fontSize: "9px", color: tmpl.isBoss ? "#ffcc44" : "#ffaaaa",
              fontFamily: "monospace", fontStyle: "bold",
              backgroundColor: "rgba(0,0,0,0.7)", padding: { x: 3, y: 1 },
            }).setOrigin(0.5, 0);
            container.add(label);

            // HP bar background
            const hpBarBg = this.add.graphics();
            hpBarBg.fillStyle(0x220000, 1); hpBarBg.fillRect(-24, -30, 48, 6);
            hpBarBg.lineStyle(1, 0x440000, 1); hpBarBg.strokeRect(-24, -30, 48, 6);
            container.add(hpBarBg);

            // HP bar fill
            const hpFill = this.add.graphics();
            hpFill.fillStyle(0xff3333, 1); hpFill.fillRect(-23, -29, 46, 4);
            container.add(hpFill);

            container.setDepth(6);

            // Make interactive
            container.setInteractive(new Phaser.Geom.Rectangle(-28, -36, 56, 72), Phaser.Geom.Rectangle.Contains);
            container.on("pointerdown", () => {
              // ── Ability targeting mode: use equipped item on this enemy ───
              const advMode = advAbilityModeRef.current;
              if (advMode) {
                advAbilityModeRef.current = null;
                setAdvAbilityMode(null);
                if (advMode.ability === "frog_hex") {
                  const expiry = Date.now() + 12000;
                  frogCooldownAdvRef.current = expiry;
                  setFrogCooldownAdv(expiry);
                  obj.frogged_until = expiry;

                  // Ribbit + smoke transformation
                  playRibbitAdv();
                  const ex = container.x, ey = container.y;
                  for (let si = 0; si < 7; si++) {
                    const smk = this.add.text(ex+(Math.random()-0.5)*50, ey+(Math.random()-0.5)*35,
                      si % 2 === 0 ? "💨" : "🌫️", { fontSize: "16px" }).setOrigin(0.5).setDepth(60);
                    this.tweens.add({ targets: smk, y: smk.y-32, alpha: 0, duration: 500+Math.random()*200, onComplete: () => smk.destroy() });
                  }

                  // Big frog overlay covering the enemy
                  const frogOvr = this.add.container(0, -4).setDepth(12);
                  const frogBg = this.add.graphics();
                  frogBg.fillStyle(0x1a7a28, 0.94);
                  frogBg.fillRoundedRect(-28, -34, 56, 62, 10);
                  frogBg.lineStyle(2, 0x00ff44, 0.65);
                  frogBg.strokeRoundedRect(-28, -34, 56, 62, 10);
                  const frogTxt = this.add.text(0, -8, "🐸", { fontSize: "44px" }).setOrigin(0.5);
                  frogOvr.add([frogBg, frogTxt]);
                  this.tweens.add({ targets: frogTxt, y: -12, duration: 750, ease: "Sine.easeInOut", yoyo: true, repeat: -1 });
                  container.add(frogOvr);
                  obj.frogOverlay = frogOvr;
                  obj.emojiText.setAlpha(0);

                  // Restore after 12s
                  setTimeout(() => {
                    if (obj.hp > 0) {
                      for (let si2 = 0; si2 < 4; si2++) {
                        const smk2 = this.add.text(container.x+(Math.random()-0.5)*35, container.y+(Math.random()-0.5)*25, "💨", { fontSize: "14px" }).setOrigin(0.5).setDepth(60);
                        this.tweens.add({ targets: smk2, y: smk2.y-25, alpha: 0, duration: 400, onComplete: () => smk2.destroy() });
                      }
                      obj.frogOverlay?.destroy(); obj.frogOverlay = undefined;
                      obj.emojiText.setAlpha(1).setText(obj.emoji);
                      obj.frogged_until = 0;
                    }
                  }, 12000);
                }
                return;
              }
              if (phaseRef.current !== "dungeon") return;
              const cls = myStats.class ?? "warrior";
              if (this.player) this.fireProjectile(this.player.x, this.player.y, container.x, container.y);
              playProjectileSound(cls);
              const snap = obj;
              setTimeout(() => { if (phaseRef.current === "dungeon") this.triggerCombat(container, snap); }, 220);
            });
            container.on("pointerover", () => {
              if (phaseRef.current !== "dungeon") return;
              container.setAlpha(0.85);
            });
            container.on("pointerout", () => container.setAlpha(1));

            const obj: EnemyObj = {
              id: `enemy_${i}_${roomIdx}`,
              container, hpFill, emojiText,
              hp: tmpl.hp,
              maxHp: tmpl.hp,
              attack: tmpl.attack,
              xp: tmpl.xp,
              name: tmpl.name,
              emoji: tmpl.emoji,
              state: "patrol",
              patrolTarget: { x: spawnX, y: spawnY },
              aggroLocked: false,
              lastSeenX: spawnX,
              lastSeenY: spawnY,
              hasGrowled: false,
              patrolWait: Math.random() * 2000,
              isBoss: !!tmpl.isBoss,
              spawnX, spawnY,
            };

            this.roomEnemies.push(obj);
            sceneEnemiesRef.current.push(obj);
          });
        }

        updateEnemyHpBar(obj: EnemyObj) {
          const pct = Math.max(0, obj.hp / obj.maxHp);
          obj.hpFill.clear();
          obj.hpFill.fillStyle(pct > 0.5 ? 0x44ff44 : pct > 0.25 ? 0xffaa00 : 0xff3333, 1);
          obj.hpFill.fillRect(-23, -29, Math.round(46 * pct), 4);
        }

        spawnHeart(wx: number, wy: number, value: number) {
          const id = `heart_${Date.now()}_${Math.random()}`;
          const container = this.add.container(wx, wy - 16).setDepth(15);
          // Glowing red circle
          const circle = this.add.graphics();
          circle.fillStyle(0xff2244, 0.85); circle.fillCircle(0, 0, 15);
          circle.lineStyle(2, 0xff88aa, 1); circle.strokeCircle(0, 0, 15);
          container.add(circle);
          // Heart emoji
          const heart = this.add.text(0, 0, "❤️", { fontSize: "14px", fontFamily: "serif" }).setOrigin(0.5, 0.5);
          container.add(heart);
          // Heal value
          const label = this.add.text(0, 20, `+${value}HP`, {
            fontSize: "9px", color: "#ff88aa", fontFamily: "monospace", fontStyle: "bold",
            backgroundColor: "rgba(0,0,0,0.6)", padding: { x: 2, y: 1 },
          }).setOrigin(0.5, 0);
          container.add(label);
          // Bob up/down
          this.tweens.add({ targets: container, y: container.y - 10, duration: 700, ease: "Sine.easeInOut", yoyo: true, repeat: -1 });
          // Pulse glow
          this.tweens.add({ targets: circle, alpha: 0.5, duration: 500, ease: "Sine.easeInOut", yoyo: true, repeat: -1 });
          const pickup: HeartPickup = { id, container, value, picked: false };
          this.heartPickups.push(pickup);
        }

        triggerCombat(container: Phaser.GameObjects.Container, obj: EnemyObj) {
          if (phaseRef.current !== "dungeon") return;

          // Check for RPG dialogue before combat (humanoid enemies only)
          if (HUMANOID_ENEMIES.has(obj.name)) {
            const dialogueLines = HUMANOID_DIALOGUE[obj.name] ?? [`${obj.emoji} ${obj.name} stands in your way!`];
            setDialoguePending({ lines: dialogueLines, character: obj.emoji, isBoss: obj.isBoss, enemyId: obj.id });
            // We'll actually trigger combat after dialogue is dismissed
            // Store enemy info so we can start combat after dialogue
            const state: CombatEnemyState = { id: obj.id, name: obj.name, emoji: obj.emoji, hp: obj.hp, maxHp: obj.maxHp, attack: obj.attack, xp: obj.xp, isBoss: obj.isBoss };
            combatEnemyRef.current = state;
            this.tweens.add({ targets: container, alpha: 0.5, duration: 100, yoyo: true, repeat: 3 });
            return;
          }

          phaseRef.current = "combat";
          setPhase("combat");
          playDangerStab();
          if (obj.isBoss) { setTimeout(() => playEnemyGrowl(true), 200); }
          const state: CombatEnemyState = {
            id: obj.id, name: obj.name, emoji: obj.emoji,
            hp: obj.hp, maxHp: obj.maxHp,
            attack: obj.attack, xp: obj.xp, isBoss: obj.isBoss,
          };
          combatEnemyRef.current = state;
          setCombatEnemy(state);
          setCombatLog([`${obj.emoji} ${obj.name} wants to fight!`]);
          // Flash enemy
          this.tweens.add({ targets: container, alpha: 0.5, duration: 100, yoyo: true, repeat: 2 });
        }

        fireProjectile(fx: number, fy: number, tx: number, ty: number) {
          const cls = myStats.class ?? "warrior";
          const COLORS: Record<string, number> = { warrior: 0xff6644, mage: 0xaa44ff, archer: 0x88ff44, rogue: 0xee44bb };
          const col = COLORS[cls] ?? 0xffffff;

          // Melee classes (warrior, rogue): slash arc at the enemy — NO flying projectile
          if (cls === "warrior" || cls === "rogue") {
            // Flash the player sprite
            const slashLines = this.add.graphics().setDepth(22).setPosition(tx, ty);
            const angle = Math.atan2(ty - fy, tx - fx);
            // Draw 3 arc slash lines radiating from impact point
            for (let si = -1; si <= 1; si++) {
              const a = angle + si * 0.35;
              slashLines.lineStyle(3, col, 0.9);
              slashLines.beginPath();
              slashLines.moveTo(0, 0);
              slashLines.lineTo(Math.cos(a) * 28, Math.sin(a) * 28);
              slashLines.strokePath();
            }
            slashLines.fillStyle(col, 0.7);
            slashLines.fillCircle(0, 0, 6);
            // Slash text pop
            const slashTxt = this.add.text(tx, ty - 12,
              cls === "warrior" ? "⚔️" : "🗡️",
              { fontSize: "20px" }).setOrigin(0.5).setDepth(23);
            this.tweens.add({
              targets: [slashLines, slashTxt],
              alpha: 0, scaleX: 1.8, scaleY: 1.8,
              duration: 280,
              onComplete: () => { slashLines.destroy(); slashTxt.destroy(); },
            });
            return;
          }

          // Ranged classes: flying projectile
          const proj = this.add.graphics().setDepth(20);
          proj.fillStyle(col, 0.9);
          if (cls === "mage") { proj.fillCircle(0, 0, 8); proj.fillStyle(0xffaa44, 0.7); proj.fillCircle(0, 0, 4); }
          else if (cls === "archer") { proj.fillRect(-12, -2, 24, 4); proj.fillStyle(0xffffff, 0.8); proj.fillTriangle(12, -4, 12, 4, 20, 0); }
          else { proj.fillTriangle(0, -7, -5, 7, 5, 7); }
          proj.setPosition(fx, fy);
          proj.setRotation(Math.atan2(ty - fy, tx - fx));
          this.tweens.add({
            targets: proj, x: tx, y: ty, duration: 220, ease: "Power2",
            onComplete: () => {
              const burst = this.add.graphics().setDepth(20).setPosition(tx, ty);
              burst.fillStyle(col, 0.8); burst.fillCircle(0, 0, 14);
              burst.fillStyle(0xffffff, 0.5); burst.fillCircle(0, 0, 5);
              this.tweens.add({ targets: burst, alpha: 0, scaleX: 2.5, scaleY: 2.5, duration: 220, onComplete: () => burst.destroy() });
              proj.destroy();
            },
          });
        }

        createDoor() {
          this.door = this.add.container(SW - 32, SH / 2);
          this.doorGraphic = this.add.graphics();
          this.doorText = this.add.text(0, -52, "🔒", {
            fontSize: "18px", fontFamily: "serif",
          }).setOrigin(0.5, 0);
          this.drawDoor(false);
          this.door.add([this.doorGraphic, this.doorText]);
          this.door.setDepth(5);
        }

        drawDoor(open: boolean) {
          this.doorGraphic.clear();
          this.doorGraphic.fillStyle(open ? 0x002200 : 0x220000, 1);
          this.doorGraphic.fillRoundedRect(-20, -40, 40, 80, 4);
          this.doorGraphic.lineStyle(3, open ? 0x44ff44 : 0xff4444, 1);
          this.doorGraphic.strokeRoundedRect(-20, -40, 40, 80, 4);
          if (!open) {
            // Portcullis bars
            this.doorGraphic.lineStyle(2, 0x885522, 1);
            for (let b = -14; b <= 14; b += 7) { this.doorGraphic.moveTo(b, -36); this.doorGraphic.lineTo(b, 36); }
            this.doorGraphic.strokePath();
          } else {
            // Open doorway darkness
            this.doorGraphic.fillStyle(0x000000, 0.8); this.doorGraphic.fillRoundedRect(-16, -36, 32, 72, 3);
            this.doorGraphic.fillStyle(0x44ff44, 0.15); this.doorGraphic.fillRoundedRect(-16, -36, 32, 72, 3);
          }
          this.doorText.setText(open ? "▶▶" : "🔒");
          this.doorText.setColor(open ? "#44ff44" : "#ff4444");
        }

        openDoor() {
          this.doorOpen = true;
          this.drawDoor(true);
          this.tweens.add({ targets: this.door, scaleX: 1.1, scaleY: 1.1, duration: 200, yoyo: true });
          const isLastRoom = roomIndexRef.current >= totalRooms - 1;
          if (this.hintText) {
            this.hintText.setText(isLastRoom ? "🏆 Walk right to claim victory!" : "➤ Walk right to next room!").setAlpha(1);
          }
        }

        loadRoom(rIdx: number) {
          // Clear existing enemies
          for (const e of this.roomEnemies) { e.container.destroy(); }
          this.roomEnemies = [];
          sceneEnemiesRef.current = [];
          // Clear any leftover heart pickups
          for (const h of this.heartPickups) { try { h.container.destroy(); } catch { /* ok */ } }
          this.heartPickups = [];

          // Reset door
          this.doorOpen = false;
          this.drawDoor(false);

          // Rebuild obstacles for new room feel
          // (obstacles are drawn once at create time, could re-draw but it's ok)

          // Spawn new enemies
          this.spawnEnemies(rIdx);

          // Move player back to left side
          if (this.player) this.player.setPosition(80, SH / 2);

          if (this.hintText) this.hintText.setAlpha(0);
        }

        create() {
          this.drawThemeBackground();
          this.drawObstacles();
          this.drawWalls();

          // ── Exit zone (left wall) ────────────────────────────────────────────
          const exitG = this.add.graphics();
          exitG.fillStyle(0x004400, 0.5); exitG.fillRoundedRect(0, SH/2 - 40, 20, 80, 4);
          exitG.lineStyle(2, 0x44ff44, 1); exitG.strokeRoundedRect(0, SH/2 - 40, 20, 80, 4);
          exitG.setDepth(4);
          this.add.text(10, SH/2 - 52, "← Exit", {
            fontSize: "8px", color: "#44ff44", fontFamily: "monospace",
            backgroundColor: "rgba(0,0,0,0.7)", padding: { x: 2, y: 1 },
          }).setOrigin(0.5, 1).setDepth(4);

          // ── Hint text ────────────────────────────────────────────────────────
          this.hintText = this.add.text(SW / 2, 22, "", {
            fontSize: "11px", color: "#ffffaa", fontFamily: "monospace",
            backgroundColor: "rgba(0,0,0,0.7)", padding: { x: 8, y: 3 },
          }).setOrigin(0.5, 0).setAlpha(0).setDepth(20);

          // ── Door ─────────────────────────────────────────────────────────────
          this.createDoor();

          // ── Enemies ──────────────────────────────────────────────────────────
          this.spawnEnemies(0);

          // ── Player ───────────────────────────────────────────────────────────
          const startX = 80, startY = SH / 2;
          this.player = this.add.container(startX, startY);

          // Shadow
          const playerShadow = this.add.graphics();
          playerShadow.fillStyle(0x000000, 0.3); playerShadow.fillEllipse(1, 28, 40, 12);
          this.player.add(playerShadow);

          // Glow ring (player class color)
          const cls = myStats.class;
          const glowCol = cls === "warrior" ? 0xff6644 : cls === "mage" ? 0x8844ff : cls === "archer" ? 0x44ff88 : cls === "rogue" ? 0xcc44cc : 0x9966ff;
          const glowRing = this.add.graphics();
          glowRing.fillStyle(glowCol, 0.6); glowRing.fillRoundedRect(-24, -24, 48, 48, 4);
          this.player.add(glowRing);

          // White border
          const border = this.add.graphics();
          border.fillStyle(0xffffff, 1); border.fillRoundedRect(-21, -21, 42, 42, 3);
          this.player.add(border);

          // Avatar image placeholder (will be replaced on load)
          const placeholder = this.add.graphics();
          placeholder.fillStyle(0x444466, 1); placeholder.fillRect(-19, -19, 38, 38);
          this.player.add(placeholder);

          // Load avatar
          const texKey = `adv_player_${userId.replace(/[^a-zA-Z0-9]/g, "_")}`;
          const loadAvatar = (useCors: boolean) => {
            const el = new Image();
            if (useCors) el.crossOrigin = "anonymous";
            el.onload = () => {
              if (this.textures.exists(texKey)) this.textures.remove(texKey);
              this.textures.addImage(texKey, el);
              const img = this.add.image(0, 0, texKey).setDisplaySize(38, 38);
              this.player.add(img);
              placeholder.destroy();
              this.playerImg = img;
            };
            el.onerror = () => { if (useCors) loadAvatar(false); };
            el.src = avatarUrl || `https://api.dicebear.com/9.x/pixel-art/png?seed=${username}`;
          };
          loadAvatar(true);

          // Class emoji badge
          const classEmoji = cls === "warrior" ? "⚔️" : cls === "mage" ? "🪄" : cls === "archer" ? "🏹" : cls === "rogue" ? "🗡️" : "👤";
          this.add.text(0, -38, classEmoji, {
            fontSize: "13px", fontFamily: "serif",
          }).setOrigin(0.5, 0.5).setDepth(1);

          // Username label
          const playerLabel = this.add.text(0, 28, `@${username}`, {
            fontSize: "9px", color: "#ffffff", fontFamily: "monospace",
            backgroundColor: "rgba(0,0,0,0.7)", padding: { x: 3, y: 1 },
          }).setOrigin(0.5, 0);
          this.player.add(playerLabel);

          // ── Weapon sprite (floating next to player) ───────────────────────────
          const weaponEmoji = cls === "warrior" ? "⚔️" : cls === "mage" ? "🪄" : cls === "archer" ? "🏹" : cls === "rogue" ? "🗡️" : "";
          if (weaponEmoji) {
            const weapon = this.add.text(28, -10, weaponEmoji, { fontSize: "15px", fontFamily: "serif" }).setOrigin(0.5, 0.5);
            this.player.add(weapon);
            this.tweens.add({ targets: weapon, y: -16, duration: 900, ease: "Sine.easeInOut", yoyo: true, repeat: -1 });
          }

          // ── Equipped slot item emoji above head (clickable for ability) ─────
          const abilitySlotItem = Object.values(equippedSlotsRef.current).find(
            s => s?.ability
          ) as { ability?: string; emoji?: string; name?: string } | null;
          if (abilitySlotItem?.ability) {
            const itemTxt = this.add.text(0, -70, abilitySlotItem.emoji ?? "✨", {
              fontSize: "22px", fontFamily: "serif",
            }).setOrigin(0.5, 0.5).setDepth(11);
            this.player.add(itemTxt);
            this.tweens.add({ targets: itemTxt, y: -74, duration: 800, ease: "Sine.easeInOut", yoyo: true, repeat: -1 });
            itemTxt.setInteractive(new Phaser.Geom.Rectangle(-14, -14, 28, 28), Phaser.Geom.Rectangle.Contains);
            itemTxt.on("pointerdown", () => {
              if (frogCooldownAdvRef.current > Date.now()) return;
              const mode: AdvAbilityMode = {
                ability: abilitySlotItem.ability!,
                itemEmoji: abilitySlotItem.emoji ?? "✨",
                itemName: abilitySlotItem.name ?? abilitySlotItem.ability!.replace(/_/g, " "),
              };
              advAbilityModeRef.current = mode;
              setAdvAbilityMode(mode);
            });
          }

          this.player.setDepth(10);

          // ── Camera ───────────────────────────────────────────────────────────
          this.cameras.main.setBounds(0, 0, SW, SH);
          this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
          this.cameras.main.setZoom(Math.min(canvasW / 700, canvasH / 420, 1.6));

          // ── Input ─────────────────────────────────────────────────────────────
          this.cursors = this.input.keyboard!.createCursorKeys();
          this.wasd = {
            W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
          };

          // SPACE key → fire projectile at nearest enemy and trigger combat
          this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).on("down", () => {
            if (phaseRef.current !== "dungeon") return;
            const enemies = this.roomEnemies.filter(e => e.state !== "dead");
            if (!enemies.length) return;
            let nearest: EnemyObj | null = null;
            let nearestDist = Infinity;
            for (const e of enemies) {
              const dist = Math.hypot(e.container.x - this.player.x, e.container.y - this.player.y);
              if (dist < nearestDist) { nearestDist = dist; nearest = e; }
            }
            if (nearest && nearestDist < 420) {
              this.fireProjectile(this.player.x, this.player.y, nearest.container.x, nearest.container.y);
              const snap = nearest;
              setTimeout(() => { if (phaseRef.current === "dungeon") this.triggerCombat(snap.container, snap); }, 230);
            }
          });

          // Touch tap-to-move (mobile — sets tapTargetRef for update())
          this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
            if (phaseRef.current !== "dungeon") return;
            if (!pointer.wasTouch) return;
            const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
            tapTargetRef.current = { x: wp.x, y: wp.y };
          });

          // ── Register scene callbacks for React ───────────────────────────────
          removeEnemyFromSceneRef.current = (id: string) => {
            const idx = this.roomEnemies.findIndex(e => e.id === id);
            if (idx !== -1) {
              this.roomEnemies[idx].state = "dead";
              // Capture container ref BEFORE splice — otherwise idx shifts after splice
              // and onComplete would destroy the WRONG enemy's container
              const deadContainer = this.roomEnemies[idx].container;
              this.tweens.add({
                targets: deadContainer,
                alpha: 0, scaleX: 2, scaleY: 2, duration: 400,
                onComplete: () => { try { deadContainer.destroy(); } catch { /* already gone */ } },
              });
              this.roomEnemies.splice(idx, 1);
              sceneEnemiesRef.current = this.roomEnemies;
            }
          };

          checkAllDeadRef.current = () => {
            const alive = this.roomEnemies.filter(e => e.state !== "dead");
            if (alive.length === 0) {
              this.openDoor();
            }
          };

          spawnHeartRef.current = (x: number, y: number, value: number) => {
            this.spawnHeart(x, y, value);
          };

          fireProjectileRef.current = (tx: number, ty: number) => {
            if (this.player) this.fireProjectile(this.player.x, this.player.y, tx, ty);
          };
        }

        update(_time: number, delta: number) {
          // Allow movement during combat (live battle) — only freeze on victory/defeat
          if (phaseRef.current === "victory" || phaseRef.current === "defeat") return;
          if (!this.player) return;

          // ── Player movement ────────────────────────────────────────────────
          // Use React keysRef instead of Phaser keyboard plugin — guaranteed to
          // work even with two Phaser instances sharing window keyboard events
          let vx = 0, vy = 0;
          const keys = keysRef.current;
          if (keys.has("ArrowLeft") || keys.has("a")) { vx = -PLAYER_SPEED; this.direction = "left"; }
          if (keys.has("ArrowRight") || keys.has("d")) { vx = PLAYER_SPEED; this.direction = "right"; }
          if (keys.has("ArrowUp") || keys.has("w")) { vy = -PLAYER_SPEED; }
          if (keys.has("ArrowDown") || keys.has("s")) { vy = PLAYER_SPEED; }
          // Tap-to-move (mobile touch)
          const tapTarget = tapTargetRef.current;
          if (tapTarget && vx === 0 && vy === 0) {
            const tdx = tapTarget.x - this.player.x;
            const tdy = tapTarget.y - this.player.y;
            const tdist = Math.sqrt(tdx * tdx + tdy * tdy);
            if (tdist < 10) { tapTargetRef.current = null; }
            else {
              vx = (tdx / tdist) * PLAYER_SPEED;
              vy = (tdy / tdist) * PLAYER_SPEED;
              if (Math.abs(tdx) > Math.abs(tdy)) this.direction = tdx < 0 ? "left" : "right";
            }
          }
          if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }

          const dt = delta / 1000;
          const nx = Phaser.Math.Clamp(this.player.x + vx * dt, 16, SW - 16);
          const ny = Phaser.Math.Clamp(this.player.y + vy * dt, 16, SH - 16);
          this.player.setPosition(nx, ny);
          if (this.playerImg) this.playerImg.setFlipX(this.direction === "left");

          // ── Exit check (left wall — dungeon phase only) ───────────────────
          if (phaseRef.current === "dungeon" && nx < 24 && Math.abs(ny - SH / 2) < 56) {
            onStatsUpdate({ hp: playerMaxHp }); // restore full HP on exit
            if (coinsEarnedRef.current > 0) { onCoinsEarned?.(coinsEarnedRef.current); coinsEarnedRef.current = 0; }
            onClose();
            return;
          }

          // ── Door check (dungeon phase only) ───────────────────────────────
          if (phaseRef.current === "dungeon" && this.doorOpen && nx > SW - 56 && Math.abs(ny - SH / 2) < 56) {
            const nextRoom = roomIndexRef.current + 1;
            if (nextRoom >= totalRooms) {
              // Last door → victory! Add chest bonus coins
              const chestBonus = 30 + Math.floor(Math.random() * 41); // 30–70 bonus
              coinsEarnedRef.current += chestBonus;
              playCoinChestOpen();
              keysRef.current.clear();
              phaseRef.current = "victory";
              setPhase("victory");
              playVictoryMusic();
            } else {
              roomIndexRef.current = nextRoom;
              setRoomIndex(nextRoom);
              this.loadRoom(nextRoom);
            }
            return;
          }

          // ── Enemy AI ──────────────────────────────────────────────────────
          const cls = myStats.class ?? "warrior";
          const isRangedClass = cls === "archer" || cls === "mage";
          const combatTriggerDist = isRangedClass ? RANGED_COMBAT_DIST : MELEE_COMBAT_DIST;

          for (const enemy of this.roomEnemies) {
            if (enemy.state === "dead") continue;

            // Frogged — freeze in place, no aggro, no combat trigger
            if (enemy.frogged_until && enemy.frogged_until > Date.now()) continue;

            const ex = enemy.container.x, ey = enemy.container.y;
            const dx = nx - ex, dy = ny - ey;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Combat trigger — ranged classes fight from distance, melee needs close contact
            // No projectile here — projectile fires when player clicks Attack in the combat panel
            if (dist < combatTriggerDist && phaseRef.current === "dungeon") {
              this.triggerCombat(enemy.container, enemy);
              return;
            }

            // Update aggro tracking
            if (dist < AGGRO_DIST) {
              if (!enemy.aggroLocked && !enemy.hasGrowled) {
                enemy.hasGrowled = true;
                playEnemyGrowl(enemy.isBoss);
              }
              enemy.aggroLocked = true;
              enemy.lastSeenX = nx;
              enemy.lastSeenY = ny;
            }
            // Lose aggro only when player is very far
            if (dist > AGGRO_HUNT_DIST) {
              enemy.aggroLocked = false;
              enemy.state = "patrol";
            }

            if (enemy.aggroLocked) {
              enemy.state = "aggro";
              // Chase toward player (or last known position when out of sight)
              const targetX = dist < AGGRO_DIST ? nx : enemy.lastSeenX;
              const targetY = dist < AGGRO_DIST ? ny : enemy.lastSeenY;
              const tdx = targetX - ex, tdy = targetY - ey;
              const tlen = Math.max(Math.sqrt(tdx * tdx + tdy * tdy), 0.1);
              const spd = AGGRO_SPEED * dt;
              enemy.container.x = Phaser.Math.Clamp(ex + (tdx / tlen) * spd, 20, SW - 20);
              enemy.container.y = Phaser.Math.Clamp(ey + (tdy / tlen) * spd, 20, SH - 20);
            } else {
              // Patrol near spawn
              enemy.state = "patrol";
              if (enemy.patrolWait > 0) {
                enemy.patrolWait -= delta;
              } else {
                const ptDx = enemy.patrolTarget.x - ex;
                const ptDy = enemy.patrolTarget.y - ey;
                const ptDist = Math.sqrt(ptDx * ptDx + ptDy * ptDy);
                if (ptDist < 8) {
                  enemy.patrolTarget = {
                    x: Phaser.Math.Clamp(enemy.spawnX + (Math.random() - 0.5) * 240, 60, SW - 60),
                    y: Phaser.Math.Clamp(enemy.spawnY + (Math.random() - 0.5) * 160, 60, SH - 60),
                  };
                  enemy.patrolWait = 800 + Math.random() * 1500;
                } else {
                  const spd = PATROL_SPEED * dt;
                  enemy.container.x = ex + (ptDx / ptDist) * spd;
                  enemy.container.y = ey + (ptDy / ptDist) * spd;
                }
              }
            }

            if (enemy.isBoss) {
              enemy.emojiText.setScale(1 + Math.sin(_time / 400) * 0.06);
            }
          }

          // ── Heart pickup check ────────────────────────────────────────────
          for (const heart of this.heartPickups) {
            if (heart.picked) continue;
            const hdx = nx - heart.container.x, hdy = ny - heart.container.y;
            if (Math.sqrt(hdx * hdx + hdy * hdy) < 36) {
              heart.picked = true;
              const healed = Math.min(heart.value, playerMaxHp - playerHpRef.current);
              if (healed > 0) {
                playerHpRef.current = Math.min(playerMaxHp, playerHpRef.current + healed);
                setPlayerHp(playerHpRef.current);
                playHeartPickup();
              }
              this.tweens.add({
                targets: heart.container,
                y: heart.container.y - 45, alpha: 0, duration: 400,
                onComplete: () => { try { heart.container.destroy(); } catch { /* ok */ } },
              });
            }
          }
          this.heartPickups = this.heartPickups.filter(h => !h.picked);

          // ── Proximity hint ───────────────────────────────────────────────
          if (this.hintText) {
            const nearEnemy = this.roomEnemies.some(e => {
              const ddx = nx - e.container.x, ddy = ny - e.container.y;
              return Math.sqrt(ddx * ddx + ddy * ddy) < combatTriggerDist * 1.3;
            });
            const hintMsg = nearEnemy
              ? (isRangedClass ? "🏹 Ranged attack ready!" : "⚔️ Move into melee range!")
              : "";
            this.hintText.setText(hintMsg);
            this.hintText.setAlpha(Phaser.Math.Linear(this.hintText.alpha, nearEnemy ? 1 : 0, 0.1));
          }
        }
      }

      game = new Phaser.Game({
        type: Phaser.AUTO,
        width: canvasW,
        height: canvasH,
        backgroundColor: theme.bgColor,
        parent: containerRef.current,
        scene: AdventureScene,
        physics: { default: "arcade" },
        audio: { disableWebAudio: false },
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        render: { antialias: false, pixelArt: true },
      });

      gameRef.current = game;
      // Focus canvas so keyboard input works immediately without requiring a click
      setTimeout(() => {
        const canvas = containerRef.current?.querySelector("canvas");
        if (canvas) {
          (canvas as HTMLElement).tabIndex = 0;
          (canvas as HTMLElement).focus();
        }
      }, 300);
    }

    initPhaser();
    return () => {
      if (gameRef.current) {
        try { (gameRef.current as import("phaser").Game).destroy(true); } catch { /* ignore */ }
        gameRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Combat actions ────────────────────────────────────────────────────────────
  function dismissDialogue() {
    const pending = dialoguePending;
    if (!pending) return;
    setDialoguePending(null);
    // Now start the actual combat
    const enemy = combatEnemyRef.current;
    if (!enemy) return;
    phaseRef.current = "combat";
    setPhase("combat");
    playDangerStab();
    if (pending.isBoss) { setTimeout(() => playEnemyGrowl(true), 200); }
    setCombatEnemy(enemy);
    setCombatLog([`${enemy.emoji} ${enemy.name} engages in combat!`]);
  }

  async function doAction(action: "attack" | "special" | "potion" | "flee") {
    if (!combatEnemyRef.current || actionPendingRef.current) return;
    if (phaseRef.current !== "combat") return;
    actionPendingRef.current = true;
    setActionPending(true);

    const enemy = combatEnemyRef.current;
    const cls = myStats.class ?? "warrior";
    const baseAtk = myStats.base_attack ?? 10;
    const [atkMin, atkMax] = CLASS_ATK[cls] ?? [8, 14];
    const atkRange = atkMax - atkMin;
    // Equipped item attack bonus
    const equippedItem = myStats.equipped_item_id
      ? (myStats.inventory as AdventureItem[]).find(i => i.id === myStats.equipped_item_id) ?? null
      : null;
    const itemAtkBonus = equippedItem?.effects?.find(e => e.type === "attack_boost")?.value ?? 0;

    let playerDmg = 0;
    let logMsg = "";
    let specialUsed = false;
    let fled = false;

    if (action === "attack") {
      playerDmg = atkMin + Math.floor(Math.random() * (atkRange + 1)) + (baseAtk - 10) + itemAtkBonus;
      playerDmg = Math.max(1, playerDmg);
      // Fire projectile toward the enemy in the scene
      const sceneEnemyAtk = sceneEnemiesRef.current.find(e => e.id === enemy.id);
      if (sceneEnemyAtk) {
        fireProjectileRef.current?.(sceneEnemyAtk.container.x, sceneEnemyAtk.container.y);
        playProjectileSound(cls);
      }
      playHitSound(true);
      logMsg = `⚔️ You hit ${enemy.name} for ${playerDmg} damage!`;
    } else if (action === "special") {
      if (specialCooldownRef.current > 0) {
        setCombatLog(l => [`✖ Special on cooldown (${specialCooldownRef.current} turns)!`, ...l.slice(0, 3)]);
        actionPendingRef.current = false; setActionPending(false); return;
      }
      const multipliers: Record<string, number> = { warrior: 1.5, mage: 2, archer: 1.8, rogue: 2.5 };
      playerDmg = Math.round((atkMin + Math.floor(Math.random() * (atkRange + 1)) + itemAtkBonus) * (multipliers[cls] ?? 1.5));
      // Fire projectile for special too
      const sceneEnemySp = sceneEnemiesRef.current.find(e => e.id === enemy.id);
      if (sceneEnemySp) {
        fireProjectileRef.current?.(sceneEnemySp.container.x, sceneEnemySp.container.y);
        playProjectileSound(cls);
      }
      playHitSound(true);
      specialUsed = true;
      const specialNames: Record<string, string> = { warrior: "Cleave", mage: "Fireball", archer: "Piercing Shot", rogue: "Backstab" };
      logMsg = `✨ ${specialNames[cls] ?? "Special"}! You hit ${enemy.name} for ${playerDmg}!`;
    } else if (action === "potion") {
      if (potionsRef.current <= 0) {
        setCombatLog(l => ["🧪 No potions left!", ...l.slice(0, 3)]);
        actionPendingRef.current = false; setActionPending(false); return;
      }
      const healed = Math.min(30, playerMaxHp - playerHpRef.current);
      playerHpRef.current += healed;
      setPlayerHp(playerHpRef.current);
      potionsRef.current -= 1;
      setPotions(potionsRef.current);
      logMsg = `🧪 Potion! You healed ${healed} HP.`;
      setCombatLog(l => [logMsg, ...l.slice(0, 3)]);
      // Enemy still attacks after potion (unless frogged)
      const sceneEnemyFrogP = sceneEnemiesRef.current.find(e => e.id === enemy.id);
      if (!(sceneEnemyFrogP?.frogged_until && sceneEnemyFrogP.frogged_until > Date.now())) {
        const dmgMultP = CLASS_DMG_TAKEN[cls] ?? 1.0;
        const enemyDmg = Math.round(Math.max(1, enemy.attack - Math.floor(Math.random() * 3)) * dmgMultP);
        playerHpRef.current -= enemyDmg;
        setPlayerHp(Math.max(0, playerHpRef.current));
        const enemyLog = `💥 ${enemy.name} hits you for ${enemyDmg}!`;
        setCombatLog(l => [enemyLog, ...l.slice(0, 3)]);
        if (playerHpRef.current <= 0) { handleDefeat(); }
      } else {
        setCombatLog(l => [`🐸 ${enemy.name} is a frog and cannot attack!`, ...l.slice(0, 3)]);
      }
      actionPendingRef.current = false; setActionPending(false);
      return;
    } else if (action === "flee") {
      const success = Math.random() < 0.6;
      if (success) {
        logMsg = "💨 You fled successfully!";
        setCombatLog(l => [logMsg, ...l.slice(0, 3)]);
        fled = true;
        combatEnemyRef.current = null;
        setCombatEnemy(null);
        keysRef.current.clear();
        phaseRef.current = "dungeon";
        setPhase("dungeon");
        actionPendingRef.current = false; setActionPending(false);
        return;
      } else {
        logMsg = "💨 Failed to flee! Enemy attacks!";
        setCombatLog(l => [logMsg, ...l.slice(0, 3)]);
        const dmgMultF = CLASS_DMG_TAKEN[cls] ?? 1.0;
        const enemyDmg = Math.round(Math.max(1, enemy.attack - Math.floor(Math.random() * 3)) * dmgMultF);
        playerHpRef.current -= enemyDmg;
        setPlayerHp(Math.max(0, playerHpRef.current));
        setCombatLog(l => [`💥 ${enemy.name} hits you for ${enemyDmg}!`, ...l.slice(0, 3)]);
        if (playerHpRef.current <= 0) { handleDefeat(); }
        actionPendingRef.current = false; setActionPending(false);
        return;
      }
    }

    if (specialUsed) {
      specialCooldownRef.current = 3;
      setSpecialCooldown(3);
    } else if (specialCooldownRef.current > 0) {
      specialCooldownRef.current--;
      setSpecialCooldown(specialCooldownRef.current);
    }

    // Apply player damage to enemy
    const newEnemyHp = enemy.hp - playerDmg;
    combatEnemyRef.current = { ...enemy, hp: Math.max(0, newEnemyHp) };
    setCombatEnemy({ ...enemy, hp: Math.max(0, newEnemyHp) });
    // Update enemy HP bar in scene
    const sceneEnemy = sceneEnemiesRef.current.find(e => e.id === enemy.id);
    if (sceneEnemy) {
      sceneEnemy.hp = Math.max(0, newEnemyHp);
      // Update hp bar
      const pct = sceneEnemy.hp / sceneEnemy.maxHp;
      sceneEnemy.hpFill.clear();
      sceneEnemy.hpFill.fillStyle(pct > 0.5 ? 0x44ff44 : pct > 0.25 ? 0xffaa00 : 0xff3333, 1);
      sceneEnemy.hpFill.fillRect(-23, -29, Math.round(46 * pct), 4);
    }
    setCombatLog(l => [logMsg, ...l.slice(0, 3)]);

    if (newEnemyHp <= 0) {
      // Enemy defeated!
      const xpGained = enemy.xp;
      xpGainedRef.current += xpGained;

      // Gold drop scales with player level (+10% per level) — stays rewarding
      const coinLvlMult = 1 + ((myStats.level ?? 1) - 1) * 0.10;
      const coinDrop = enemy.isBoss
        ? Math.round((25 + Math.floor(Math.random() * 26)) * coinLvlMult * 1.5)
        : Math.round((5  + Math.floor(Math.random() * 16)) * coinLvlMult);
      coinsEarnedRef.current += coinDrop;
      playCoinPickup();
      setCombatLog(l => [`🎉 ${enemy.name} defeated! +${xpGained} XP  🪙+${coinDrop}`, ...l.slice(0, 2)]);

      // Roll loot
      const rng2 = seededRng(Date.now());
      const loot: AdventureItem[] = [];
      if (rng2() < 0.4) loot.push(generateItem(myStats.class, caveMode ? "South Cave" : missionData.name, rng2, myStats.level));
      if (enemy.isBoss) {
        loot.push(generateItem(myStats.class, caveMode ? "South Cave" : missionData.name, rng2, myStats.level));
        loot.push(generateItem(myStats.class, caveMode ? "South Cave" : missionData.name, rng2, myStats.level));
      }

      // Spawn heart pickup at enemy's position before removing them
      const dyingEnemy = sceneEnemiesRef.current.find(e => e.id === enemy.id);
      if (dyingEnemy) {
        const healValue = enemy.isBoss ? 40 + Math.floor(Math.random() * 21) : 15 + Math.floor(Math.random() * 16);
        spawnHeartRef.current?.(dyingEnemy.container.x, dyingEnemy.container.y, healValue);
      }

      // Remove from scene
      removeEnemyFromSceneRef.current?.(enemy.id);

      // Clear combat — clear stuck keys so player doesn't drift after combat
      combatEnemyRef.current = null;
      setCombatEnemy(null);
      keysRef.current.clear();
      phaseRef.current = "dungeon";
      setPhase("dungeon");

      // Show loot
      if (loot.length > 0) {
        setPendingLoot(loot);
        setShowLoot(true);
      }

      // Check if all dead
      setTimeout(() => { checkAllDeadRef.current?.(); }, 100);

      // Save XP/stats
      const statsPatch = applyXP(myStats, xpGained);
      onStatsUpdate({ ...statsPatch, hp: Math.max(1, playerHpRef.current), wins: (myStats.wins ?? 0) + (enemy.isBoss ? 1 : 0) });
    } else if (!fled) {
      // Enemy counterattack — ranged classes take more damage
      await new Promise(r => setTimeout(r, 300));
      // Skip attack if enemy is frogged
      const sceneEnemyForFrog = sceneEnemiesRef.current.find(e => e.id === enemy.id);
      if (sceneEnemyForFrog?.frogged_until && sceneEnemyForFrog.frogged_until > Date.now()) {
        setCombatLog(l => [`🐸 ${enemy.name} is a frog and cannot attack!`, ...l.slice(0, 3)]);
        actionPendingRef.current = false; setActionPending(false);
        return;
      }
      const dmgMult = CLASS_DMG_TAKEN[cls] ?? 1.0;
      const rawDmg = Math.max(1, enemy.attack - Math.floor(Math.random() * 4));
      const enemyDmg = Math.round(rawDmg * dmgMult);
      playerHpRef.current = Math.max(0, playerHpRef.current - enemyDmg);
      setPlayerHp(playerHpRef.current);
      playHitSound(false);
      setCombatLog(l => [`💥 ${enemy.name} hits you for ${enemyDmg}!`, ...l.slice(0, 3)]);
      if (playerHpRef.current <= 0) {
        handleDefeat();
        return;
      }
    }

    actionPendingRef.current = false;
    setActionPending(false);
  }

  function handleDefeat() {
    combatEnemyRef.current = null;
    setCombatEnemy(null);
    phaseRef.current = "defeat";
    setPhase("defeat");
    // Auto-collect any pending loot (keep items earned even on death)
    if (pendingLoot.length > 0) {
      const newInv = [...myStats.inventory, ...pendingLoot].slice(-8);
      setPendingLoot([]);
      setShowLoot(false);
      onStatsUpdate({ hp: playerMaxHp, inventory: newInv }); // full HP restored when returning to town
    } else {
      onStatsUpdate({ hp: playerMaxHp });
    }
  }

  const hudBg = palette.bg;
  const accentColor = palette.accent;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10001, display: "flex", flexDirection: "column", background: "#000" }}>
      <style>{`@keyframes slideUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>

      {/* ── HUD Bar ─────────────────────────────────────────────────────────── */}
      <div style={{
        height: 52, flexShrink: 0,
        background: `linear-gradient(135deg, ${hudBg}, rgba(0,0,0,0.95))`,
        borderBottom: `1px solid ${accentColor}44`,
        display: "flex", alignItems: "center", gap: 12, padding: "0 14px",
        zIndex: 10,
      }}>
        <button onClick={() => { onStatsUpdate({ hp: playerMaxHp }); onClose(); }} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "5px 12px", color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 700, flexShrink: 0 }}>← Exit</button>

        <div style={{ fontSize: 14, fontWeight: 800, color: accentColor, flexShrink: 0 }}>
          {caveMode ? "🕳️ South Cave" : `${missionData.emoji} ${missionData.name}`}
        </div>

        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", flexShrink: 0 }}>
          Room {roomIndex + 1}/{totalRooms}
        </div>

        <div style={{ flex: 1 }} />

        {/* HP bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: "#ff6666" }}>❤️</span>
          <div style={{ width: 80, height: 8, background: "rgba(255,0,0,0.2)", borderRadius: 4, overflow: "hidden", border: "1px solid rgba(255,80,80,0.3)" }}>
            <div style={{ height: "100%", width: `${Math.max(0, (playerHp / playerMaxHp) * 100)}%`, background: playerHp > playerMaxHp * 0.5 ? "#44ff44" : playerHp > playerMaxHp * 0.25 ? "#ffaa00" : "#ff3333", transition: "width 0.3s", borderRadius: 4 }} />
          </div>
          <span style={{ fontSize: 11, color: "#ffaaaa", fontFamily: "monospace" }}>{playerHp}/{playerMaxHp}</span>
        </div>

        {/* Level + class */}
        <div style={{ fontSize: 11, color: accentColor, fontFamily: "monospace", flexShrink: 0 }}>
          Lv{myStats.level} {myStats.class ? { warrior: "⚔️", mage: "🪄", archer: "🏹", rogue: "🗡️" }[myStats.class] ?? "" : ""}
        </div>

        <button onClick={() => onMinimize({ name: caveMode ? "South Cave" : missionData.name, room: roomIndex + 1 })}
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "4px 10px", color: "rgba(255,255,255,0.5)", fontSize: 11, cursor: "pointer", flexShrink: 0 }}>—</button>
      </div>

      {/* ── Phaser Canvas Container ─────────────────────────────────────────── */}
      <div ref={containerRef} style={{ flex: 1, position: "relative", overflow: "hidden", cursor: advAbilityMode ? "crosshair" : undefined }}
        onClick={() => { const c = containerRef.current?.querySelector("canvas"); if (c) (c as HTMLElement).focus(); }}>

        {/* ── Left Action Bar (equipped items with abilities) ─────────────── */}
        {(() => {
          const abilityItems = Object.values(equippedSlots).filter(s => s?.ability);
          if (!abilityItems.length) return null;
          const ABILITY_NAMES: Record<string, string> = {
            frog_hex: "Hex", teleport: "Warp", swift_step: "Swift",
            iron_skin: "Shield", coin_magnet: "Magnet", lucky_roll: "Lucky",
            poison_blade: "Poison", frost_bolt: "Frost", smoke_bomb: "Smoke",
            war_banner: "Banner", earth_spike: "Spike", second_wind: "Wind",
            meteor_strike: "Meteor", berserker_rage: "Rage", chain_lightning: "Chain",
            vortex: "Vortex", dark_ritual: "Ritual", phantasm: "Ghost",
            time_warp: "Warp", divine_judgment: "Judge", world_ender: "End",
            time_stop: "Stop", dragon_soul: "Dragon", reality_tear: "Tear",
          };
          return (
            <div style={{
              position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
              zIndex: 100, display: "flex", flexDirection: "column", gap: 8,
              pointerEvents: "all",
            }}>
              {abilityItems.map((item, i) => {
                if (!item?.ability) return null;
                const onCd = (frogCooldownAdv > Date.now()) && item.ability === "frog_hex";
                const cdSec = onCd ? Math.ceil((frogCooldownAdv - Date.now()) / 1000) : 0;
                const isTargeted = advAbilityMode?.ability === item.ability;
                return (
                  <div key={i} style={{ textAlign: "center" }}>
                    <div
                      onClick={() => {
                        if (onCd) return;
                        if (isTargeted) { setAdvAbilityMode(null); advAbilityModeRef.current = null; return; }
                        const mode: AdvAbilityMode = {
                          ability: item.ability!,
                          itemEmoji: item.emoji ?? "✨",
                          itemName: item.name ?? item.ability!.replace(/_/g, " "),
                        };
                        advAbilityModeRef.current = mode;
                        setAdvAbilityMode(mode);
                      }}
                      title={`${item.name}: ${item.ability?.replace(/_/g, " ")}`}
                      style={{
                        width: 48, height: 48,
                        background: isTargeted ? "rgba(0,255,120,0.25)" : onCd ? "rgba(40,40,40,0.8)" : "rgba(10,10,20,0.85)",
                        border: `2px solid ${isTargeted ? "#00ff88" : onCd ? "#333" : "#555"}`,
                        borderRadius: 8,
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        cursor: onCd ? "not-allowed" : "pointer",
                        boxShadow: isTargeted ? "0 0 12px rgba(0,255,120,0.5)" : "none",
                        transition: "transform 0.1s, border-color 0.1s",
                        position: "relative",
                      }}
                      onMouseEnter={e => { if (!onCd) (e.currentTarget as HTMLDivElement).style.transform = "scale(1.1)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "scale(1)"; }}
                    >
                      <span style={{ fontSize: 22, lineHeight: 1 }}>{item.emoji}</span>
                      {onCd
                        ? <span style={{ fontSize: 8, color: "#666" }}>⏳{cdSec}s</span>
                        : <span style={{ fontSize: 8, color: isTargeted ? "#00ff88" : "#aaa", fontFamily: "monospace" }}>{ABILITY_NAMES[item.ability] ?? "Use"}</span>
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* ── Ability targeting overlay ────────────────────────────────────── */}
        {advAbilityMode && (
          <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", zIndex: 100, pointerEvents: "all" }}>
            <div style={{ background: "rgba(0,0,0,0.88)", border: "2px solid rgba(0,255,120,0.6)", borderRadius: 12, padding: "8px 18px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 0 20px rgba(0,255,100,0.3)" }}>
              <span style={{ fontSize: 26 }}>{advAbilityMode.itemEmoji}</span>
              <span style={{ fontSize: 12, color: "#88ffbb", fontWeight: 700 }}>🎯 Click any target to use {advAbilityMode.itemName}</span>
              <button onClick={() => { setAdvAbilityMode(null); advAbilityModeRef.current = null; }}
                style={{ background: "rgba(255,80,80,0.2)", border: "1px solid rgba(255,80,80,0.4)", borderRadius: 6, padding: "2px 8px", color: "#ff8888", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>✕</button>
            </div>
          </div>
        )}

        {/* ── Combat Panel (slides over canvas) ───────────────────────────── */}
        {phase === "combat" && combatEnemy && (
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: 200,
            background: `linear-gradient(0deg, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.92) 100%)`,
            borderTop: `2px solid ${accentColor}66`,
            backdropFilter: "blur(4px)",
            zIndex: 50, padding: "12px 16px",
            display: "flex", flexDirection: "column", gap: 8,
          }}>
            {/* Enemy info + HP */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: combatEnemy.isBoss ? 36 : 28 }}>{combatEnemy.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: combatEnemy.isBoss ? "#ffcc44" : "#ff8888" }}>
                  {combatEnemy.isBoss ? "👑 BOSS: " : ""}{combatEnemy.name}
                </div>
                <div style={{ width: "100%", height: 6, background: "rgba(255,0,0,0.2)", borderRadius: 3, overflow: "hidden", border: "1px solid rgba(255,80,80,0.3)", marginTop: 3 }}>
                  <div style={{ height: "100%", width: `${Math.max(0, (combatEnemy.hp / combatEnemy.maxHp) * 100)}%`, background: "#ff4444", transition: "width 0.3s", borderRadius: 3 }} />
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,150,150,0.7)", marginTop: 2, fontFamily: "monospace" }}>{combatEnemy.hp}/{combatEnemy.maxHp} HP</div>
              </div>
              <div style={{ textAlign: "right", fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "monospace", maxWidth: 120 }}>
                {combatLog[0] && <div style={{ color: "rgba(255,255,255,0.7)" }}>{combatLog[0]}</div>}
                {combatLog[1] && <div>{combatLog[1]}</div>}
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => doAction("attack")} disabled={actionPending} style={{ flex: 1, minWidth: 70, background: "rgba(255,80,80,0.2)", border: "1px solid rgba(255,80,80,0.5)", borderRadius: 10, padding: "9px 6px", fontSize: 13, color: "#ff8888", cursor: "pointer", fontWeight: 700, opacity: actionPending ? 0.5 : 1 }}>⚔️ Attack</button>
              <button onClick={() => doAction("special")} disabled={actionPending || specialCooldown > 0} style={{ flex: 1, minWidth: 70, background: specialCooldown > 0 ? "rgba(100,100,100,0.1)" : "rgba(180,80,255,0.2)", border: `1px solid ${specialCooldown > 0 ? "rgba(100,100,100,0.3)" : "rgba(180,80,255,0.5)"}`, borderRadius: 10, padding: "9px 6px", fontSize: 13, color: specialCooldown > 0 ? "rgba(255,255,255,0.3)" : "#cc88ff", cursor: specialCooldown > 0 ? "not-allowed" : "pointer", fontWeight: 700 }}>
                ✨ {specialCooldown > 0 ? `(${specialCooldown})` : "Special"}
              </button>
              <button onClick={() => doAction("potion")} disabled={actionPending || potions <= 0} style={{ flex: 1, minWidth: 70, background: potions <= 0 ? "rgba(100,100,100,0.1)" : "rgba(80,255,120,0.15)", border: `1px solid ${potions <= 0 ? "rgba(100,100,100,0.3)" : "rgba(80,255,120,0.4)"}`, borderRadius: 10, padding: "9px 6px", fontSize: 13, color: potions <= 0 ? "rgba(255,255,255,0.3)" : "#80ff99", cursor: potions <= 0 ? "not-allowed" : "pointer", fontWeight: 700 }}>
                🧪 Potion ({potions})
              </button>
              <button onClick={() => doAction("flee")} disabled={actionPending} style={{ flex: 1, minWidth: 70, background: "rgba(150,150,150,0.1)", border: "1px solid rgba(150,150,150,0.3)", borderRadius: 10, padding: "9px 6px", fontSize: 13, color: "rgba(255,255,255,0.5)", cursor: "pointer", fontWeight: 700, opacity: actionPending ? 0.5 : 1 }}>💨 Flee</button>
            </div>
          </div>
        )}

        {/* Mobile: tap anywhere to move (handled by Phaser pointerdown with wasTouch check) */}
        {isTouchDevice && phase === "dungeon" && (
          <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, textAlign: "center", pointerEvents: "none" }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>Tap to move · Tap enemy to attack · SPACE to attack</span>
          </div>
        )}
      </div>

      {/* ── Victory Screen ──────────────────────────────────────────────────── */}
      {phase === "victory" && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", background: "linear-gradient(145deg, #0a1a08, #041002)", border: "2px solid rgba(68,255,68,0.4)", borderRadius: 24, padding: 36, maxWidth: 480, width: "90vw", boxShadow: "0 0 60px rgba(68,255,68,0.15)" }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🏆</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#88ff66", marginBottom: 4 }}>
              {caveMode ? "Cave Cleared!" : "Mission Complete!"}
            </div>
            <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 12, fontSize: 13, color: "rgba(255,255,255,0.6)", fontFamily: "monospace" }}>
              <span>+{xpGainedRef.current} XP</span>
              <span>🪙 +{coinsEarnedRef.current} gold</span>
            </div>
            {!caveMode && missionData.victoryDialogue && (
              <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: "14px 16px", marginBottom: 18, textAlign: "left" }}>
                <div style={{ fontSize: 28, textAlign: "center", marginBottom: 8 }}>{missionData.victoryCharacter ?? "🏆"}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", lineHeight: 1.6, fontStyle: "italic" }}>"{missionData.victoryDialogue}"</div>
              </div>
            )}
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              {caveMode && (
                <button onClick={() => {
                  roomIndexRef.current = 0; setRoomIndex(0);
                  xpGainedRef.current = 0; coinsEarnedRef.current = 0; phaseRef.current = "dungeon"; setPhase("dungeon");
                  setPlayerHp(playerMaxHp); playerHpRef.current = playerMaxHp;
                  setPotions(3); potionsRef.current = 3;
                  checkAllDeadRef.current = null;
                  onClose();
                }} style={{ background: "rgba(68,255,68,0.18)", border: "1px solid rgba(68,255,68,0.5)", borderRadius: 12, padding: "10px 24px", fontSize: 13, color: "#88ff66", cursor: "pointer", fontWeight: 700 }}>⚔️ Dive Again</button>
              )}
              <button onClick={() => { onStatsUpdate({ hp: playerMaxHp }); if (coinsEarnedRef.current > 0) { onCoinsEarned?.(coinsEarnedRef.current); coinsEarnedRef.current = 0; } onClose(); }} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 12, padding: "10px 24px", fontSize: 13, color: "#fff", cursor: "pointer", fontWeight: 700 }}>← Return to Town</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Defeat Screen ───────────────────────────────────────────────────── */}
      {phase === "defeat" && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", background: "linear-gradient(145deg, #1a0808, #100404)", border: "2px solid rgba(255,60,60,0.4)", borderRadius: 24, padding: 36, maxWidth: 400, width: "90vw", boxShadow: "0 0 60px rgba(255,60,60,0.1)" }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>💀</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#ff6666", marginBottom: 8 }}>You Fell...</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 20, fontFamily: "monospace" }}>You return to town fully healed.</div>
            <button onClick={() => { onStatsUpdate({ hp: playerMaxHp }); if (coinsEarnedRef.current > 0) { onCoinsEarned?.(coinsEarnedRef.current); coinsEarnedRef.current = 0; } onClose(); }} style={{ background: "rgba(255,80,80,0.15)", border: "1px solid rgba(255,80,80,0.4)", borderRadius: 12, padding: "10px 28px", fontSize: 13, color: "#ff8888", cursor: "pointer", fontWeight: 700 }}>← Retreat to Town</button>
          </div>
        </div>
      )}

      {/* ── RPG Dialogue Box ─────────────────────────────────────────────────── */}
      {dialoguePending && (
        <div style={{ position: "absolute", inset: 0, zIndex: 150, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 20px 80px" }} onClick={dismissDialogue}>
          <div style={{
            background: "linear-gradient(145deg, rgba(10,8,20,0.97), rgba(5,4,14,0.99))",
            border: `2px solid ${dialoguePending.isBoss ? "rgba(255,60,60,0.6)" : "rgba(180,140,255,0.5)"}`,
            borderRadius: 18, padding: "20px 24px", maxWidth: 520, width: "100%",
            boxShadow: `0 0 40px ${dialoguePending.isBoss ? "rgba(255,40,40,0.2)" : "rgba(150,100,255,0.15)"}`,
            animation: "slideUp 0.25s ease-out",
          }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ fontSize: 44, flexShrink: 0, filter: dialoguePending.isBoss ? "drop-shadow(0 0 8px red)" : "none" }}>
                {dialoguePending.character}
              </div>
              <div style={{ flex: 1 }}>
                {dialoguePending.lines.map((line, i) => (
                  <div key={i} style={{
                    fontSize: 14, color: "#fff", lineHeight: 1.6,
                    marginBottom: i < dialoguePending.lines.length - 1 ? 8 : 0,
                    fontFamily: "Georgia, serif", fontStyle: "italic",
                    opacity: 0.92,
                  }}>
                    "{line}"
                  </div>
                ))}
              </div>
            </div>
            <div style={{ textAlign: "right", marginTop: 12, fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>
              Tap / Click anywhere to fight →
            </div>
          </div>
        </div>
      )}

      {/* ── Loot Popup ──────────────────────────────────────────────────────── */}
      {showLoot && pendingLoot.length > 0 && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: hudBg, border: `2px solid ${accentColor}55`, borderRadius: 20, padding: 28, maxWidth: 380, width: "90vw", textAlign: "center", boxShadow: `0 0 40px ${accentColor}22` }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✨</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 14 }}>Loot Dropped!</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginBottom: 18 }}>
              {pendingLoot.map((item, i) => (
                <div key={i} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${RARITY_COLORS[item.rarity]}66`, borderRadius: 12, padding: "10px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 28 }}>{item.emoji}</div>
                  <div style={{ fontSize: 10, color: RARITY_COLORS[item.rarity], fontWeight: 800, marginTop: 3 }}>{item.name}</div>
                  <div style={{ fontSize: 9, color: RARITY_COLORS[item.rarity], opacity: 0.8, textTransform: "uppercase" }}>{item.rarity}</div>
                </div>
              ))}
            </div>
            <button onClick={() => {
              const newInv = [...myStats.inventory, ...pendingLoot].slice(-8);
              onStatsUpdate({ inventory: newInv });
              setShowLoot(false); setPendingLoot([]);
            }} style={{ background: `${accentColor}22`, border: `1px solid ${accentColor}66`, borderRadius: 10, padding: "9px 24px", fontSize: 13, color: accentColor, cursor: "pointer", fontWeight: 700 }}>Pick Up</button>
          </div>
        </div>
      )}
    </div>
  );
}
