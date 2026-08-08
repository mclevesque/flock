/**
 * Emberkin — deterministic game engine.
 *
 * This file contains ZERO AI calls. Every mechanical outcome (how much a stat
 * moves, whether a mutation fires, who wins a battle) is decided here, in code,
 * from a seeded roll. The AI layer (lib/emberkin-ai.ts) only writes *flavour*
 * inside the budget this file hands it — names, descriptions, narration.
 *
 * That split is the whole design:
 *   - the game stays balanced and cheap even when GROQ is rate-limited or down
 *   - the AI can go as wild as it likes without breaking the economy
 *   - every helper here has a procedural fallback the AI layer can fall back to
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type Stage = "egg" | "hatchling" | "juvenile" | "adult" | "ascended";
export type Rarity = "common" | "uncommon" | "rare" | "mythic" | "aberrant";
export type OutcomeTier = "fumble" | "weak" | "normal" | "strong" | "crit" | "wild";
export type MoveKind = "strike" | "guile" | "surge" | "ward" | "chaos";

/** Trait effects are a closed set so the AI can name anything but only ever
 *  wire up mechanics this engine actually understands. */
export const TRAIT_EFFECTS = [
  "atk_up", "def_up", "spd_up", "focus_up", "hp_up",
  "regen", "lifesteal", "thorns", "first_strike",
  "glass_cannon", "lucky", "stubborn", "volatile",
] as const;
export type TraitEffect = (typeof TRAIT_EFFECTS)[number];

export interface Move {
  name: string;
  kind: MoveKind;
  power: number;   // 40–130
  cost: number;    // energy cost, 0–25
  desc: string;
}

export interface Trait {
  name: string;
  desc: string;
  effect: TraitEffect;
}

export interface Creature {
  id: string;
  owner_id: string;
  owner_name?: string;
  name: string;
  species: string;
  description: string;
  stage: Stage;
  rarity: Rarity;
  element: string;
  temperament: string;
  appearance: string;
  sprite: string;
  image_url: string | null;
  hp_max: number;
  atk: number;
  def: number;
  spd: number;
  focus: number;
  level: number;
  xp: number;
  hunger: number;  // 0 starving → 100 full
  energy: number;  // 0 exhausted → 100 rested
  mood: number;    // 0 miserable → 100 delighted
  bond: number;    // 0 stranger → 100 soulbound
  traits: Trait[];
  moves: Move[];
  wins: number;
  losses: number;
  hatched_at: string | null;
  last_tick: string;
}

// ── Seeded RNG (mulberry32) ──────────────────────────────────────────────────

export function makeRng(seed: number) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(...parts: (string | number)[]): number {
  const s = parts.join("|");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// ── Luck ─────────────────────────────────────────────────────────────────────

/**
 * The heart of "you never quite know what you'll get".
 *
 * A d100 with modifiers from bond (a creature that trusts you tries harder),
 * mood and energy (a miserable, exhausted creature fumbles), and the `lucky`
 * and `volatile` traits. `volatile` widens the tails in BOTH directions — that
 * is what makes some lineages chaotic and others dependable.
 */
export function rollOutcome(
  rng: () => number,
  c: Pick<Creature, "bond" | "mood" | "energy" | "traits">,
): { tier: OutcomeTier; roll: number } {
  const effects = new Set(c.traits.map(t => t.effect));
  const isVolatile = effects.has("volatile");

  // `wild` is drawn FIRST, as an independent rare event. It deliberately ignores
  // bond and mood: wild is the dice doing something nobody planned, not a reward
  // for good care. (Folding it into the top of the modified roll made a
  // well-loved creature mutate on ~11% of sessions, which trivialised the tails.)
  const wildChance = isVolatile ? 0.05 : 0.015;
  if (rng() < wildChance) return { tier: "wild", roll: 100 };

  let roll = rng() * 100;

  roll += (c.bond - 50) * 0.14;   // ±7
  roll += (c.mood - 50) * 0.10;   // ±5
  if (c.energy < 25) roll -= 12;  // running on empty
  if (effects.has("lucky")) roll += 8;
  if (isVolatile) {
    // Push away from the middle: chaotic creatures crit and fumble more.
    roll = roll >= 50 ? roll + (roll - 50) * 0.55 : roll - (50 - roll) * 0.55;
  }

  roll = clamp(roll, 0, 100);

  let tier: OutcomeTier;
  if (roll >= 93) tier = "crit";
  else if (roll >= 74) tier = "strong";
  else if (roll >= 33) tier = "normal";
  else if (roll >= 9) tier = "weak";
  else tier = "fumble";

  return { tier, roll: Math.round(roll * 10) / 10 };
}

/** Total stat points a training session is allowed to move. */
export const TIER_BUDGET: Record<OutcomeTier, number> = {
  fumble: -2, weak: 1, normal: 3, strong: 6, crit: 10, wild: 8,
};

export const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "mythic", "aberrant"];

export function rollRarity(rng: () => number): Rarity {
  const r = rng() * 100;
  if (r < 48) return "common";
  if (r < 78) return "uncommon";
  if (r < 93) return "rare";
  if (r < 98.5) return "mythic";
  return "aberrant";
}

export const RARITY_STAT_BONUS: Record<Rarity, number> = {
  common: 0, uncommon: 4, rare: 9, mythic: 16, aberrant: 13,
};

export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#9a9a9a",
  uncommon: "#4caf7d",
  rare: "#4a9fd4",
  mythic: "#d4a942",
  aberrant: "#c4531a",
};

// ── Levelling ────────────────────────────────────────────────────────────────

export function xpForLevel(level: number): number {
  return Math.round(40 * Math.pow(level, 1.55));
}

export function stageForLevel(level: number): Stage {
  if (level >= 22) return "ascended";
  if (level >= 12) return "adult";
  if (level >= 5) return "juvenile";
  return "hatchling";
}

/** Levels a creature up as far as its XP allows. Mutates and returns deltas. */
export function applyXp(c: Creature, gained: number): { levels: number; evolvedTo: Stage | null } {
  const before = c.stage;
  c.xp += Math.max(0, Math.round(gained));
  let levels = 0;
  while (c.level < 50 && c.xp >= xpForLevel(c.level)) {
    c.xp -= xpForLevel(c.level);
    c.level += 1;
    levels += 1;
    // Modest automatic growth; the interesting gains come from training.
    c.hp_max += 4;
    c.atk += 1;
    c.def += 1;
    c.spd += 1;
    c.focus += 1;
  }
  const nowStage = stageForLevel(c.level);
  return { levels, evolvedTo: nowStage !== before && c.stage !== "egg" ? nowStage : null };
}

// ── Meter decay ──────────────────────────────────────────────────────────────

/**
 * Applies real-time decay since `last_tick`. Called on every read so a creature
 * left alone for two days is genuinely hungry and sulking when you come back.
 * Bond decays far slower than the physical meters — and never below 20 once
 * earned, because the point of the game is the attachment, not punishing people
 * for having a life.
 */
export function applyDecay(c: Creature, nowMs = Date.now()): number {
  const last = new Date(c.last_tick).getTime();
  if (!Number.isFinite(last)) { c.last_tick = new Date(nowMs).toISOString(); return 0; }
  const hours = (nowMs - last) / 3_600_000;
  if (hours < 0.05) return 0;

  const effects = new Set(c.traits.map(t => t.effect));
  const hungerRate = effects.has("glass_cannon") ? 4.5 : 3.2;

  c.hunger = clamp(c.hunger - hours * hungerRate, 0, 100);
  c.energy = clamp(c.energy + hours * 5.5, 0, 100);   // resting refills energy
  c.mood = clamp(c.mood - hours * 1.9, 0, 100);
  if (c.hunger < 20) c.mood = clamp(c.mood - hours * 2.0, 0, 100);
  c.bond = clamp(c.bond - hours * 0.35, c.bond > 20 ? 20 : 0, 100);

  c.last_tick = new Date(nowMs).toISOString();
  return hours;
}

// ── Derived state ────────────────────────────────────────────────────────────

export function effectiveStats(c: Creature) {
  const effects = new Set(c.traits.map(t => t.effect));
  let { hp_max: hp, atk, def, spd, focus } = c;

  if (effects.has("hp_up")) hp = Math.round(hp * 1.15);
  if (effects.has("atk_up")) atk = Math.round(atk * 1.15);
  if (effects.has("def_up")) def = Math.round(def * 1.15);
  if (effects.has("spd_up")) spd = Math.round(spd * 1.15);
  if (effects.has("focus_up")) focus = Math.round(focus * 1.15);
  if (effects.has("glass_cannon")) { atk = Math.round(atk * 1.35); def = Math.round(def * 0.7); }

  // A starving or miserable creature underperforms — care is not decorative.
  const care = (c.hunger * 0.5 + c.mood * 0.3 + c.bond * 0.2) / 100;
  const mult = 0.7 + care * 0.45;

  return {
    hp: Math.max(10, Math.round(hp * (0.85 + care * 0.2))),
    atk: Math.max(1, Math.round(atk * mult)),
    def: Math.max(1, Math.round(def * mult)),
    spd: Math.max(1, Math.round(spd * mult)),
    focus: Math.max(1, Math.round(focus * mult)),
    careMult: Math.round(mult * 100) / 100,
  };
}

export function moodLabel(c: Creature): string {
  if (c.hunger < 15) return "starving";
  if (c.energy < 15) return "exhausted";
  if (c.mood < 20) return "sulking";
  if (c.mood > 85 && c.bond > 70) return "devoted";
  if (c.mood > 80) return "delighted";
  if (c.mood > 55) return "content";
  return "restless";
}

// ── Procedural generation (fallbacks when GROQ is unavailable) ────────────────

const ELEMENTS = [
  "ember", "ash", "cinder", "frost", "storm", "bramble", "tide", "dusk",
  "gloam", "quartz", "rust", "moth", "static", "brine", "hollow", "wax",
];
const TEMPERAMENTS = [
  "skittish", "imperious", "devoted", "sardonic", "feral", "dreamy",
  "meticulous", "reckless", "watchful", "theatrical", "sullen", "giddy",
];
const PREFIX = [
  "Cin", "Vor", "Mur", "Ash", "Quel", "Bram", "Thal", "Nyx", "Ordo", "Pyre",
  "Grell", "Sable", "Wick", "Umbra", "Fen", "Cor",
];
const SUFFIX = [
  "ling", "wisp", "mote", "grub", "kin", "spawn", "thing", "wretch",
  "hound", "moth", "drake", "eater", "singer", "warden",
];
const SPRITES = [
  "🔥", "🪱", "🦎", "🦇", "🐛", "🕷️", "🐙", "🦂", "🐉", "🦅", "🐺", "🦊",
  "👁️", "🌑", "🪸", "🍄", "🦴", "⚗️", "🕯️", "🪶", "🐚", "🦑", "🐸", "🦔",
];

/**
 * Keyword → element/temperament/move-kind maps.
 *
 * These exist so the keeper's whisper still shapes the creature when GROQ is
 * unavailable. Without them the procedural fallback ignored the whisper
 * entirely, which made "be fast and cruel" and "be gentle" produce
 * indistinguishable creatures.
 */
const WHISPER_ELEMENTS: [RegExp, string][] = [
  [/\b(fire|burn|flame|ember|blaz|scorch|heat|ash)/i, "ember"],
  [/\b(ice|cold|frost|freez|winter|snow|chill)/i, "frost"],
  [/\b(storm|lightning|thunder|electric|spark|shock)/i, "storm"],
  [/\b(water|sea|ocean|tide|wave|drown|swim|rain)/i, "tide"],
  [/\b(dark|shadow|night|black|gloom|void|dusk)/i, "dusk"],
  [/\b(plant|tree|thorn|vine|forest|root|green|grow)/i, "bramble"],
  [/\b(stone|rock|crystal|metal|iron|steel|hard)/i, "quartz"],
  [/\b(rot|rust|decay|corrode|old|ruin|broken)/i, "rust"],
  [/\b(bone|skull|dead|death|grave|corpse)/i, "hollow"],
  [/\b(light|bright|sun|glow|shine|holy|gold)/i, "cinder"],
  [/\b(bug|insect|moth|wing|flutter|silk)/i, "moth"],
  [/\b(salt|brine|blood|bitter)/i, "brine"],
];

const WHISPER_TEMPERAMENTS: [RegExp, string][] = [
  [/\b(fast|quick|swift|speed|nimble|dart)/i, "reckless"],
  [/\b(cruel|mean|vicious|savage|brutal|kill|violent)/i, "feral"],
  [/\b(gentle|kind|soft|sweet|calm|peace|love)/i, "devoted"],
  [/\b(coward|afraid|scared|timid|hide|shy|flinch)/i, "skittish"],
  [/\b(proud|king|queen|noble|regal|command|rule)/i, "imperious"],
  [/\b(clever|smart|cunning|wise|think|careful)/i, "meticulous"],
  [/\b(sad|mourn|grief|lonely|sorrow|quiet)/i, "sullen"],
  [/\b(funny|joke|laugh|silly|clown|play)/i, "theatrical"],
  [/\b(watch|guard|patient|wait|still)/i, "watchful"],
  [/\b(dream|strange|weird|odd|drift)/i, "dreamy"],
];

const KIND_KEYWORDS: [RegExp, MoveKind][] = [
  [/\b(hit|punch|strike|smash|bite|claw|tear|slam|attack|hard|strong|violent|brutal)/i, "strike"],
  [/\b(fast|quick|dodge|sneak|trick|feint|slip|evade|cunning|steal)/i, "guile"],
  [/\b(mind|will|focus|magic|spell|burn|blast|energy|power|scream|sing)/i, "surge"],
  [/\b(guard|block|defend|shield|protect|endure|tank|survive|patient|wait)/i, "ward"],
  [/\b(chaos|wild|random|strange|mad|weird|unpredictable|luck)/i, "chaos"],
];

function matchKeyword<T>(text: string, table: [RegExp, T][]): T | null {
  if (!text) return null;
  for (const [re, val] of table) if (re.test(text)) return val;
  return null;
}

export function elementFromWhisper(whisper: string, rng: () => number): string {
  return matchKeyword(whisper, WHISPER_ELEMENTS) ?? pick(rng, ELEMENTS);
}

export function temperamentFromWhisper(whisper: string, rng: () => number): string {
  return matchKeyword(whisper, WHISPER_TEMPERAMENTS) ?? pick(rng, TEMPERAMENTS);
}

/** Picks a move kind from what the keeper actually typed, falling back to chance. */
export function moveKindFromText(
  text: string,
  allowed: MoveKind[],
  rng: () => number,
): MoveKind {
  const hit = matchKeyword(text, KIND_KEYWORDS);
  return hit && allowed.includes(hit) ? hit : pick(rng, allowed);
}

export function proceduralIdentity(rng: () => number, rarity: Rarity, whisper = "") {
  const element = elementFromWhisper(whisper, rng);
  const temperament = temperamentFromWhisper(whisper, rng);
  const species = `${pick(rng, PREFIX)}${pick(rng, SUFFIX)}`;
  return {
    species,
    element,
    temperament,
    sprite: pick(rng, SPRITES),
    appearance: `A ${temperament} thing of ${element}, small enough to sit in cupped hands.`,
    description:
      rarity === "aberrant"
        ? `Something went wrong in the shell. It is ${temperament}, it is made of ${element}, and it is watching you back.`
        : `A ${rarity} ${element}-touched ${species}. ${temperament.charAt(0).toUpperCase() + temperament.slice(1)} by nature.`,
  };
}

export const ALL_MOVE_KINDS: MoveKind[] = ["strike", "guile", "surge", "ward", "chaos"];
/** Kinds a creature may HATCH with. `ward` and `chaos` are situational — good as
 *  spice on an existing kit, ruinous as the only thing a creature can do. They
 *  are earned through mutation instead. */
export const STARTER_MOVE_KINDS: MoveKind[] = ["strike", "guile", "surge"];

export function proceduralMove(
  rng: () => number,
  element: string,
  tier: OutcomeTier,
  kinds: MoveKind[] = ALL_MOVE_KINDS,
  hint = "",
): Move {
  // `hint` is whatever the keeper typed (a whisper, a training instruction), so
  // even the no-AI path produces a move that reflects what they asked for.
  const kind = moveKindFromText(hint, kinds, rng);
  const verbs = ["Lash", "Rend", "Coil", "Sear", "Fracture", "Swallow", "Unmake", "Kindle", "Hush", "Splinter"];
  const power = clamp(
    50 + Math.floor(rng() * 30) + (tier === "crit" ? 25 : tier === "wild" ? 20 : tier === "strong" ? 12 : 0),
    40, 130,
  );
  return {
    name: `${element.charAt(0).toUpperCase() + element.slice(1)} ${pick(rng, verbs)}`,
    kind,
    power,
    cost: clamp(Math.round(power / 9), 3, 25),
    desc: `A ${kind} move drawn from ${element}.`,
  };
}

export function proceduralTrait(rng: () => number, element: string): Trait {
  const effect = pick(rng, TRAIT_EFFECTS);
  const names: Record<TraitEffect, string> = {
    atk_up: "Sharpened", def_up: "Hidebound", spd_up: "Quickblood", focus_up: "Clearsighted",
    hp_up: "Deep-Rooted", regen: "Slow-Knitting", lifesteal: "Thirsting", thorns: "Barbed",
    first_strike: "Ill-Omened", glass_cannon: "Brittle Fury", lucky: "Fortune-Bit",
    stubborn: "Immovable", volatile: `Unstable ${element.charAt(0).toUpperCase() + element.slice(1)}`,
  };
  return { name: names[effect], desc: `Something in its ${element} has shifted.`, effect };
}

// ── Creature construction ────────────────────────────────────────────────────

export interface HatchIdentity {
  species: string;
  description: string;
  element: string;
  temperament: string;
  appearance: string;
  sprite: string;
  trait: Trait;
  move: Move;
}

export function baseStatsFor(rng: () => number, rarity: Rarity) {
  const bonus = RARITY_STAT_BONUS[rarity];
  // Spread a small random allocation so two same-rarity creatures still differ.
  const spread = () => Math.floor(rng() * 5) - 2;
  return {
    hp_max: 40 + bonus + Math.floor(rng() * 8),
    atk: 10 + Math.round(bonus / 2) + spread(),
    def: 10 + Math.round(bonus / 2) + spread(),
    spd: 10 + Math.round(bonus / 2) + spread(),
    focus: 10 + Math.round(bonus / 2) + spread(),
  };
}

// ── Battle simulation ────────────────────────────────────────────────────────

export interface Combatant {
  name: string;
  species: string;
  sprite: string;
  level: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  focus: number;
  moves: Move[];
  traits: Trait[];
}

export interface BattleBeat {
  side: "a" | "b";
  move: string;
  kind: MoveKind;
  damage: number;
  crit: boolean;
  missed: boolean;
  note: string;
  hpA: number;
  hpB: number;
}

export interface BattleResult {
  winner: "a" | "b";
  beats: BattleBeat[];
  rounds: number;
  finalHpA: number;
  finalHpB: number;
}

export function toCombatant(c: Creature): Combatant {
  const s = effectiveStats(c);
  return {
    name: c.name, species: c.species, sprite: c.sprite, level: c.level,
    hp: s.hp, atk: s.atk, def: s.def, spd: s.spd, focus: s.focus,
    moves: c.moves.length ? c.moves : [proceduralMove(makeRng(hashSeed(c.id)), c.element, "normal")],
    traits: c.traits,
  };
}

/**
 * Auto-resolved turn-based battle. Deterministic given `seed`, so a battle can
 * be re-simulated from the stored seed and always produce the same log.
 */
export function simulateBattle(a: Combatant, b: Combatant, seed: number): BattleResult {
  const rng = makeRng(seed);
  const beats: BattleBeat[] = [];
  let hpA = a.hp;
  let hpB = b.hp;

  const effA = new Set(a.traits.map(t => t.effect));
  const effB = new Set(b.traits.map(t => t.effect));

  const firstA = effA.has("first_strike") ? 1000 : 0;
  const firstB = effB.has("first_strike") ? 1000 : 0;
  let aGoesFirst = a.spd + firstA >= b.spd + firstB;

  const maxRounds = 24;
  let round = 0;

  while (hpA > 0 && hpB > 0 && round < maxRounds) {
    round++;
    for (const attackerIsA of aGoesFirst ? [true, false] : [false, true]) {
      if (hpA <= 0 || hpB <= 0) break;

      const atkC = attackerIsA ? a : b;
      const defC = attackerIsA ? b : a;
      const atkEff = attackerIsA ? effA : effB;
      const defEff = attackerIsA ? effB : effA;

      const move = pick(rng, atkC.moves);

      // Accuracy: fast attackers connect more; chaos moves are unreliable.
      const acc = 0.82 + Math.min(0.15, (atkC.spd - defC.spd) * 0.01) - (move.kind === "chaos" ? 0.15 : 0);
      if (rng() > acc) {
        beats.push({
          side: attackerIsA ? "a" : "b", move: move.name, kind: move.kind,
          damage: 0, crit: false, missed: true,
          note: "misses", hpA: Math.max(0, hpA), hpB: Math.max(0, hpB),
        });
        continue;
      }

      // Which stat the move scales off.
      const scale =
        move.kind === "surge" ? atkC.focus :
        move.kind === "guile" ? atkC.spd :
        move.kind === "ward" ? atkC.def :
        move.kind === "chaos" ? Math.round((atkC.atk + atkC.focus + atkC.spd) / 3) :
        atkC.atk;

      const critChance = 0.07 + (atkEff.has("lucky") ? 0.06 : 0) + (move.kind === "chaos" ? 0.12 : 0);
      const crit = rng() < critChance;

      const variance = move.kind === "chaos" ? 0.55 + rng() * 1.15 : 0.85 + rng() * 0.3;

      // Mitigation is RELATIVE (offense vs defense), not against a fixed
      // constant. A fixed constant makes the same percentage advantage hit far
      // harder at high absolute stats, which made late-game opponents
      // unwinnable and early-game ones trivial at identical difficulty.
      // Scale-free keeps a tier meaning the same thing at every level.
      const guard = defC.def * (defEff.has("stubborn") ? 1.2 : 1);
      const mitigation = scale / (scale + guard);

      let dmg = (move.power / 100) * scale * variance * mitigation * 1.6;
      if (crit) dmg *= 1.7;
      if (move.kind === "ward") dmg *= 0.7; // ward trades damage for sustain
      dmg = Math.max(1, Math.round(dmg));

      let note = crit ? "lands clean" : "connects";

      if (attackerIsA) hpB -= dmg; else hpA -= dmg;

      // Trait reactions
      if (defEff.has("thorns")) {
        const back = Math.max(1, Math.round(dmg * 0.18));
        if (attackerIsA) hpA -= back; else hpB -= back;
        note += ", recoils";
      }
      if (atkEff.has("lifesteal")) {
        const heal = Math.max(1, Math.round(dmg * 0.22));
        if (attackerIsA) hpA = Math.min(a.hp, hpA + heal); else hpB = Math.min(b.hp, hpB + heal);
        note += ", drinks deep";
      }
      if (move.kind === "ward") {
        const heal = Math.max(2, Math.round(atkC.def * 0.45));
        if (attackerIsA) hpA = Math.min(a.hp, hpA + heal); else hpB = Math.min(b.hp, hpB + heal);
        note += ", steadies";
      }

      beats.push({
        side: attackerIsA ? "a" : "b", move: move.name, kind: move.kind,
        damage: dmg, crit, missed: false, note,
        hpA: Math.max(0, hpA), hpB: Math.max(0, hpB),
      });
    }

    // End-of-round regeneration
    if (effA.has("regen") && hpA > 0) hpA = Math.min(a.hp, hpA + Math.max(1, Math.round(a.hp * 0.04)));
    if (effB.has("regen") && hpB > 0) hpB = Math.min(b.hp, hpB + Math.max(1, Math.round(b.hp * 0.04)));

    aGoesFirst = !aGoesFirst && rng() < 0.5 ? true : aGoesFirst;
  }

  const winner: "a" | "b" = hpA <= 0 ? "b" : hpB <= 0 ? "a" : hpA >= hpB ? "a" : "b";
  return { winner, beats, rounds: round, finalHpA: Math.max(0, hpA), finalHpB: Math.max(0, hpB) };
}

// ── NPC opponents ────────────────────────────────────────────────────────────

const NPC_NAMES = [
  "Kiln-Warden", "The Gutter Saint", "Mourncoil", "Ashbite", "Tallow Knight",
  "Nine-Legged Prior", "Rustmother", "The Patient Thing", "Emberglut", "Sill-Watcher",
  "Bogfather", "Vellum Wretch", "Cradlecrow", "The Long Sigh", "Gristlemoth",
];

export interface NpcTier {
  id: string;
  label: string;
  levelOffset: number;
  /** Opponent power as a fraction of the player's own BASE stats. */
  difficulty: number;
  xp: number;
  blurb: string;
}

export const NPC_TIERS: NpcTier[] = [
  // Calibrated by simulation across 30 random builds × 120 fights at each of
  // levels 3–30, not guessed. Measured win rates: ~95% / ~68% / ~39% / ~15%.
  { id: "stray", label: "Stray", levelOffset: -2, difficulty: 0.90, xp: 26, blurb: "Something small and half-starved." },
  { id: "warden", label: "Warden", levelOffset: 0, difficulty: 1.05, xp: 48, blurb: "An even match, if you've been feeding it." },
  { id: "elder", label: "Elder", levelOffset: 3, difficulty: 1.15, xp: 88, blurb: "Older than your creature. Meaner, too." },
  { id: "horror", label: "Horror", levelOffset: 7, difficulty: 1.25, xp: 165, blurb: "You should not win this. You might." },
];

export interface BaseStats { hp_max: number; atk: number; def: number; spd: number; focus: number }

/**
 * Opponents scale off the player's BASE stats, not off level.
 *
 * Level alone is a bad yardstick here: most of a creature's power comes from
 * training, which two keepers at the same level will have done wildly different
 * amounts of. Scaling to base stats keeps every tier meaning the same thing for
 * everyone. Deliberately BASE and not effective stats — otherwise a starving
 * creature would face a proportionally weakened opponent, and neglect would
 * cost nothing.
 */
export function makeNpc(tier: NpcTier, playerLevel: number, playerBase: BaseStats, seed: number): Combatant {
  const rng = makeRng(seed);
  const level = Math.max(1, playerLevel + tier.levelOffset);
  const rarity = tier.id === "horror" ? "mythic" : tier.id === "elder" ? "rare" : rollRarity(rng);
  const identity = proceduralIdentity(rng, rarity);

  // ±10% jitter so two fights at the same tier aren't identical.
  const d = tier.difficulty;
  const jitter = () => 0.9 + rng() * 0.2;
  const scale = (v: number, floor: number) => Math.max(floor, Math.round(v * d * jitter()));

  return {
    name: pick(rng, NPC_NAMES),
    species: identity.species,
    sprite: identity.sprite,
    level,
    hp: scale(playerBase.hp_max, 20),
    atk: scale(playerBase.atk, 4),
    def: scale(playerBase.def, 4),
    spd: scale(playerBase.spd, 4),
    focus: scale(playerBase.focus, 4),
    moves: [
      proceduralMove(rng, identity.element, "normal"),
      proceduralMove(rng, identity.element, tier.id === "horror" ? "strong" : "normal"),
    ],
    traits: tier.id === "stray" ? [] : [proceduralTrait(rng, identity.element)],
  };
}

// ── Care actions ─────────────────────────────────────────────────────────────

export interface FoodItem {
  id: string;
  label: string;
  emoji: string;
  hunger: number;
  mood: number;
  energy: number;
  mutationChance: number;
  blurb: string;
}

export const FOODS: FoodItem[] = [
  { id: "ashcap", label: "Ashcap Mushroom", emoji: "🍄", hunger: 28, mood: 4, energy: 6, mutationChance: 0.02, blurb: "Grows thick around the bonfire. Reliable." },
  { id: "emberfruit", label: "Emberfruit", emoji: "🍎", hunger: 34, mood: 12, energy: 10, mutationChance: 0.04, blurb: "Sweet, and faintly warm to the touch." },
  { id: "greasebread", label: "Grease Bread", emoji: "🍞", hunger: 46, mood: -3, energy: 14, mutationChance: 0.03, blurb: "Filling. Nobody enjoys it." },
  { id: "soulbrine", label: "Soul Brine", emoji: "🧪", hunger: 18, mood: 20, energy: -8, mutationChance: 0.14, blurb: "Strange things happen. Sometimes good ones." },
  { id: "godsmeat", label: "Godsmeat", emoji: "🍖", hunger: 55, mood: 25, energy: 20, mutationChance: 0.22, blurb: "You should not have this. It should not be eaten." },
];

export const TRAINING_FOCUS = [
  { id: "atk", label: "Violence", stat: "atk" as const, emoji: "⚔️" },
  { id: "def", label: "Endurance", stat: "def" as const, emoji: "🛡️" },
  { id: "spd", label: "Speed", stat: "spd" as const, emoji: "💨" },
  { id: "focus", label: "Will", stat: "focus" as const, emoji: "🔮" },
];

/**
 * Turns a training session into concrete stat deltas. The AI never picks these
 * numbers — it only gets told what happened and writes the scene.
 */
export function resolveTraining(
  rng: () => number,
  c: Creature,
  focusStat: "atk" | "def" | "spd" | "focus",
  tier: OutcomeTier,
  /** What the keeper typed — steers the kind of move a mutation produces. */
  hint = "",
): {
  deltas: Record<string, number>;
  newMove: Move | null;
  newTrait: Trait | null;
  xp: number;
} {
  const budget = TIER_BUDGET[tier];
  const deltas: Record<string, number> = {};

  if (tier === "wild") {
    // Wild sessions scatter points somewhere other than where you aimed.
    const stats = ["atk", "def", "spd", "focus"] as const;
    let left = budget;
    while (left > 0) {
      const s = pick(rng, stats);
      const amt = Math.min(left, 1 + Math.floor(rng() * 3));
      deltas[s] = (deltas[s] ?? 0) + amt;
      left -= amt;
    }
    deltas.hp_max = 3 + Math.floor(rng() * 6);
  } else if (budget < 0) {
    deltas[focusStat] = budget;                 // fumble: you actually lose ground
    deltas.hp_max = 0;
  } else {
    const primary = Math.max(1, Math.round(budget * 0.7));
    deltas[focusStat] = primary;
    const leftover = budget - primary;
    if (leftover > 0) {
      const other = pick(rng, (["atk", "def", "spd", "focus"] as const).filter(s => s !== focusStat));
      deltas[other] = leftover;
    }
    deltas.hp_max = tier === "crit" ? 6 : tier === "strong" ? 3 : 1;
  }

  // Mutations: only the tails of the distribution create new mechanics.
  const moveChance = tier === "wild" ? 0.75 : tier === "crit" ? 0.4 : tier === "strong" ? 0.12 : 0;
  const traitChance = tier === "wild" ? 0.5 : tier === "crit" ? 0.15 : 0;

  const newMove =
    rng() < moveChance && c.moves.length < 6
      ? proceduralMove(rng, c.element, tier, ALL_MOVE_KINDS, hint)
      : null;
  const newTrait =
    rng() < traitChance && c.traits.length < 5 ? proceduralTrait(rng, c.element) : null;

  const xp = tier === "fumble" ? 4 : Math.round(12 + budget * 3);

  return { deltas, newMove, newTrait, xp };
}

export function applyDeltas(c: Creature, deltas: Record<string, number>) {
  for (const [k, v] of Object.entries(deltas)) {
    if (k === "hp_max") c.hp_max = clamp(c.hp_max + v, 20, 900);
    else if (k === "atk") c.atk = clamp(c.atk + v, 1, 300);
    else if (k === "def") c.def = clamp(c.def + v, 1, 300);
    else if (k === "spd") c.spd = clamp(c.spd + v, 1, 300);
    else if (k === "focus") c.focus = clamp(c.focus + v, 1, 300);
  }
}

export { clamp };
