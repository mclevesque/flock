/**
 * Moonhaven NPC definitions — 3D world positions, dialogue, and model references.
 * These map directly to the existing Flock NPC character system but with 3D coordinates.
 *
 * Origin (0,0,0) = center of the Moon Fountain in the plaza.
 * Y-axis is UP in Three.js. All positions are world-space.
 */

export interface MoonhavenNPC {
  id: string;
  name: string;
  emoji: string;
  /** 3D world position [x, y, z]. y=0 is ground level. */
  position: [number, number, number];
  /** Patrol waypoints for wandering behavior (optional) */
  patrol?: [number, number, number][];
  /** Billboard color if no GLB model loaded yet */
  color: string;
  /** Role label shown in interaction tooltip */
  role: string;
  /** Which voice lines to cycle (indices into NPC_LINES from generate-npc-voices) */
  dialogueCount: number;
  traitLines: string[];
  /** Zone / landmark NPC belongs to */
  zone: "plaza" | "market" | "castle" | "forest" | "tavern" | "workshop";
  /** Whether NPC is hostile (bandits trigger combat) */
  hostile?: boolean;
  /** Interaction type — determines what opens on talk */
  interaction: "dialogue" | "vendor" | "herald" | "adventure" | "quest";
  /** GLB model path relative to /public (only set when file actually exists) */
  model?: string;
  /** Portrait image path relative to /public (only set when file actually exists) */
  portrait?: string;
}

export const MOONHAVEN_NPCS: MoonhavenNPC[] = [
  // ── PLAZA ──────────────────────────────────────────────────────────────────
  {
    id: "elder_mira",
    name: "Elder Mira",
    emoji: "🧙‍♀️",
    position: [-8, 0, 3],
    patrol: [[-8, 0, 3], [-6, 0, 5], [-4, 0, 4], [-6, 0, 2]],
    color: "#8855cc",
    role: "Village Elder",
    dialogueCount: 8,
    traitLines: ["class_warrior","class_mage","class_archer","class_rogue","class_none","rich","veteran"],
    zone: "plaza",
    interaction: "dialogue",
  },
  {
    id: "town_herald",
    name: "Town Herald",
    emoji: "📯",
    position: [0, 0, -6],
    patrol: [[-2, 0, -6], [0, 0, -7], [2, 0, -6], [0, 0, -5]],
    color: "#cc3322",
    role: "Town Herald",
    dialogueCount: 8,
    traitLines: ["class_warrior","class_mage","class_archer","class_rogue","class_none","rich","veteran"],
    zone: "plaza",
    interaction: "herald",
  },
  {
    id: "village_kid_pip",
    name: "Pip",
    emoji: "🧒",
    position: [4, 0, 2],
    patrol: [[4, 0, 2], [6, 0, 4], [5, 0, 6], [3, 0, 5], [2, 0, 3]],
    color: "#ffaa33",
    role: "Village Kid",
    dialogueCount: 20,
    traitLines: ["class_warrior","class_mage","class_archer","class_rogue","class_none","rich","veteran"],
    zone: "plaza",
    interaction: "dialogue",
  },

  // ── MARKET ──────────────────────────────────────────────────────────────────
  {
    id: "innkeeper_bessie",
    name: "Innkeeper Bessie",
    emoji: "🍺",
    position: [14, 0, -2],
    patrol: [[14, 0, -2], [16, 0, -3], [16, 0, -1], [14, 0, -1]],
    color: "#cc7733",
    role: "Innkeeper",
    dialogueCount: 8,
    traitLines: ["class_warrior","class_mage","class_archer","class_rogue","class_none","rich","veteran"],
    zone: "tavern",
    interaction: "vendor",
  },
  {
    id: "blacksmith_theron",
    name: "Blacksmith Theron",
    emoji: "⚒️",
    position: [-14, 0, 2],
    patrol: [[-14, 0, 2], [-16, 0, 3], [-16, 0, 1]],
    color: "#553311",
    role: "Blacksmith",
    dialogueCount: 8,
    traitLines: ["class_warrior","class_mage","class_archer","class_rogue","class_none","rich","veteran"],
    zone: "workshop",
    interaction: "vendor",
  },

  // ── CASTLE ──────────────────────────────────────────────────────────────────
  {
    id: "guard_captain_aldric",
    name: "Captain Aldric",
    emoji: "🛡️",
    position: [0, 0, -22],
    patrol: [[-2, 0, -22], [2, 0, -22]],
    color: "#445566",
    role: "Guard Captain",
    dialogueCount: 8,
    traitLines: ["class_warrior","class_mage","class_archer","class_rogue","class_none","rich","veteran"],
    zone: "castle",
    interaction: "quest",
  },
  {
    id: "queen_aelindra",
    name: "Queen Aelindra",
    emoji: "👑",
    position: [0, 0, -30],
    color: "#ddaa11",
    role: "Queen of Moonhaven",
    dialogueCount: 8,
    traitLines: ["class_warrior","class_mage","class_archer","class_rogue","class_none","rich","veteran"],
    zone: "castle",
    interaction: "dialogue",
  },
  {
    id: "court_wizard_lysara",
    name: "Wizard Lysara",
    emoji: "🔮",
    position: [6, 0, -26],
    patrol: [[6, 0, -26], [8, 0, -28], [6, 0, -30], [4, 0, -28]],
    color: "#3311aa",
    role: "Court Wizard",
    dialogueCount: 8,
    traitLines: ["class_warrior","class_mage","class_archer","class_rogue","class_none","rich","veteran"],
    zone: "castle",
    interaction: "dialogue",
  },

  // ── FOREST EDGE (hostile bandits) ───────────────────────────────────────────
  {
    id: "bandit_cutpurse",
    name: "Cutpurse",
    emoji: "🗡️",
    position: [-20, 0, 18],
    patrol: [[-20, 0, 18], [-22, 0, 20], [-18, 0, 22], [-16, 0, 20]],
    color: "#332211",
    role: "Bandit",
    dialogueCount: 8,
    traitLines: [],
    zone: "forest",
    hostile: true,
    interaction: "adventure",
  },
  {
    id: "bandit_shadowblade",
    name: "Shadowblade",
    emoji: "🌑",
    position: [-24, 0, 14],
    patrol: [[-24, 0, 14], [-26, 0, 16], [-22, 0, 18], [-20, 0, 14]],
    color: "#111122",
    role: "Bandit",
    dialogueCount: 8,
    traitLines: [],
    zone: "forest",
    hostile: true,
    interaction: "adventure",
  },
  {
    id: "bandit_ironclub",
    name: "Ironclub",
    emoji: "🪓",
    position: [-18, 0, 22],
    patrol: [[-18, 0, 22], [-20, 0, 24], [-16, 0, 24]],
    color: "#221100",
    role: "Bandit",
    dialogueCount: 8,
    traitLines: [],
    zone: "forest",
    hostile: true,
    interaction: "adventure",
  },

  // ── MOONHAVEN ORIGINALS ──────────────────────────────────────────────────────
  {
    id: "moonhaven_oracle",
    name: "The Oracle",
    emoji: "🌙",
    position: [0, 0.5, 8],
    patrol: [[-2, 0.5, 8], [0, 0.8, 10], [2, 0.5, 8], [0, 0.3, 6]],
    color: "#aaccff",
    role: "Oracle of the Moon",
    dialogueCount: 5,
    traitLines: [],
    zone: "plaza",
    interaction: "dialogue",
  },
  {
    id: "moonhaven_keeper",
    name: "Moon Keeper",
    emoji: "⭐",
    position: [0, 0, 12],
    color: "#8899bb",
    role: "Keeper of Moonhaven",
    dialogueCount: 5,
    traitLines: [],
    zone: "plaza",
    interaction: "dialogue",
  },

  // ── DRIVE-IN ───────────────────────────────────────────────────────────────
  {
    id: "stella_projectionist",
    name: "Stella",
    emoji: "🎬",
    position: [15, 0, 34],
    patrol: [[15, 0, 34], [16, 0, 36], [15, 0, 38], [14, 0, 36]],
    color: "#cc4488",
    role: "Drive-In Projectionist",
    dialogueCount: 4,
    traitLines: [],
    zone: "market",
    interaction: "dialogue",
  },
];

// Dialogue for Moonhaven-original NPCs (not in ElevenLabs set yet)
export const MOONHAVEN_DIALOGUE: Record<string, string[]> = {
  moonhaven_oracle: [
    "The moon speaks to those who listen. You are… listening now.",
    "I see three paths before you. The fourth is the one you'll actually take.",
    "Time here flows differently. Has it been hours? Days? Yes.",
    "You carry something old with you. A memory, or perhaps a destiny.",
    "Ask me anything. But know that the answer may change the question.",
  ],
  moonhaven_keeper: [
    "Welcome to Moonhaven. The light here never truly fades.",
    "I have kept this plaza for longer than the kingdom remembers.",
    "The fountain has run since before the first stone was laid. No one knows why.",
    "Moonhaven exists between places. That's why visitors always find it.",
    "Rest here. This is a safe square. The moon promises it.",
  ],
  stella_projectionist: [
    "Tonight's showing starts whenever you walk up to the screen. 🎬",
    "Best seat in Moonhaven? Any spot with a good view of the moon. 🌙",
    "I've been running the projector since the first night. The film never runs out.",
    "Grab some popcorn from the cart. The show's about to begin. 🍿",
  ],
};

// Town square building layout for the 3D scene
export interface MoonhavenBuilding {
  id: string;
  label: string;
  position: [number, number, number];
  size: [number, number, number]; // width, height, depth
  color: string;
  roofColor: string;
  zone: string;
  enterable?: boolean;
}

export const MOONHAVEN_BUILDINGS: MoonhavenBuilding[] = [
  // Moon Fountain plaza is open — no building, fountain prop at origin
  {
    id: "tavern",
    label: "The Silver Moon Tavern",
    position: [18, 0, -4],
    size: [10, 7, 8],
    color: "#5c3d1e",
    roofColor: "#7a2c10",
    zone: "tavern",
    enterable: true,
  },
  {
    id: "blacksmith",
    label: "Theron's Forge",
    position: [-18, 0, 0],
    size: [8, 6, 7],
    color: "#3a2a1a",
    roofColor: "#2a1a0a",
    zone: "workshop",
    enterable: true,
  },
  {
    id: "wizard_tower",
    label: "Lysara's Tower",
    position: [10, 0, -28],
    size: [5, 18, 5],
    color: "#1a1040",
    roofColor: "#3322aa",
    zone: "castle",
    enterable: true,
  },
  {
    id: "castle_gate",
    label: "Castle Aurvale",
    position: [0, 0, -36],
    size: [22, 14, 16],
    color: "#555566",
    roofColor: "#334455",
    zone: "castle",
    enterable: true,
  },
  {
    id: "market_stalls",
    label: "Market Row",
    position: [0, 0, 16],
    size: [24, 4, 6],
    color: "#8B6914",
    roofColor: "#cc3311",
    zone: "market",
    enterable: false,
  },
  {
    id: "forest_edge",
    label: "Moonwood Forest",
    position: [-30, 0, 20],
    size: [20, 12, 20],
    color: "#1a3a1a",
    roofColor: "#0a2a0a",
    zone: "forest",
    enterable: false,
  },
];

// Spawn point for the player entering Moonhaven
export const MOONHAVEN_SPAWN: [number, number, number] = [0, 0, 6];

// Zone trigger areas — entering these zones plays ambient audio / changes lighting
export const MOONHAVEN_ZONES = [
  { id: "plaza",    bounds: { minX: -12, maxX: 12, minZ: -12, maxZ: 12 }, ambient: "moonlight" },
  { id: "market",   bounds: { minX: -14, maxX: 14, minZ: 10, maxZ: 22 },  ambient: "market" },
  { id: "castle",   bounds: { minX: -14, maxX: 14, minZ: -40, maxZ: -16 }, ambient: "castle" },
  { id: "forest",   bounds: { minX: -40, maxX: -14, minZ: 8, maxZ: 36 }, ambient: "forest" },
  { id: "tavern",   bounds: { minX: 10, maxX: 26, minZ: -10, maxZ: 2 },   ambient: "tavern" },
  { id: "workshop", bounds: { minX: -26, maxX: -10, minZ: -6, maxZ: 8 },  ambient: "forge" },
  { id: "drive_in", bounds: { minX: 4,  maxX: 76, minZ: 20, maxZ: 86 },   ambient: "outdoor" },
];
