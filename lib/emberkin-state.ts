/**
 * Emberkin — adapters between the DB row shape and the engine's Creature type,
 * plus the public (client-facing) projection. Shared by the two API routes.
 */

import {
  type Creature, type Move, type Trait, type Stage, type Rarity, type MoveKind,
  TRAIT_EFFECTS, effectiveStats, moodLabel, xpForLevel, RARITY_COLOR, clamp,
} from "./emberkin-engine";

const MOVE_KINDS: MoveKind[] = ["strike", "guile", "surge", "ward", "chaos"];

/** DB rows carry traits/moves as loose JSON — validate before the engine sees them. */
function asTraits(v: unknown): Trait[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((t): Trait[] => {
    const o = t as Record<string, unknown>;
    if (!o || typeof o.name !== "string") return [];
    const effect = (TRAIT_EFFECTS as readonly string[]).includes(o.effect as string)
      ? (o.effect as Trait["effect"])
      : "atk_up";
    return [{ name: o.name, desc: typeof o.desc === "string" ? o.desc : "", effect }];
  }).slice(0, 6);
}

function asMoves(v: unknown): Move[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((m): Move[] => {
    const o = m as Record<string, unknown>;
    if (!o || typeof o.name !== "string") return [];
    return [{
      name: o.name,
      kind: MOVE_KINDS.includes(o.kind as MoveKind) ? (o.kind as MoveKind) : "strike",
      power: clamp(Number(o.power) || 60, 20, 160),
      cost: clamp(Number(o.cost) || 8, 0, 30),
      desc: typeof o.desc === "string" ? o.desc : "",
    }];
  }).slice(0, 8);
}

/** The subset of a DB row the engine needs. */
export interface EmberkinRow {
  id: string; owner_id: string; owner_name?: string; name: string; species: string;
  description: string; stage: string; rarity: string; element: string; temperament: string;
  appearance: string; sprite: string; image_url: string | null; whisper: string; seed: number;
  hp_max: number; atk: number; def: number; spd: number; focus: number;
  level: number; xp: number; hunger: number; energy: number; mood: number; bond: number;
  traits: unknown[]; moves: unknown[]; wins: number; losses: number;
  hatched_at: string | null; last_tick: string;
}

const STAGES: Stage[] = ["egg", "hatchling", "juvenile", "adult", "ascended"];
const RARITIES: Rarity[] = ["common", "uncommon", "rare", "mythic", "aberrant"];

export function asCreature(row: EmberkinRow): Creature & { whisper: string; seed: number } {
  return {
    id: row.id,
    owner_id: row.owner_id,
    owner_name: row.owner_name,
    name: row.name,
    species: row.species,
    description: row.description,
    stage: STAGES.includes(row.stage as Stage) ? (row.stage as Stage) : "hatchling",
    rarity: RARITIES.includes(row.rarity as Rarity) ? (row.rarity as Rarity) : "common",
    element: row.element,
    temperament: row.temperament,
    appearance: row.appearance,
    sprite: row.sprite,
    image_url: row.image_url,
    hp_max: row.hp_max, atk: row.atk, def: row.def, spd: row.spd, focus: row.focus,
    level: row.level, xp: row.xp,
    hunger: row.hunger, energy: row.energy, mood: row.mood, bond: row.bond,
    traits: asTraits(row.traits),
    moves: asMoves(row.moves),
    wins: row.wins, losses: row.losses,
    hatched_at: row.hatched_at,
    last_tick: row.last_tick,
    whisper: row.whisper,
    seed: row.seed,
  };
}

/** Everything the client needs to render, including derived values. */
export function publicCreature(c: Creature) {
  const eff = effectiveStats(c);
  return {
    id: c.id,
    ownerId: c.owner_id,
    ownerName: c.owner_name ?? null,
    name: c.name,
    species: c.species,
    description: c.description,
    stage: c.stage,
    rarity: c.rarity,
    rarityColor: RARITY_COLOR[c.rarity],
    element: c.element,
    temperament: c.temperament,
    appearance: c.appearance,
    sprite: c.sprite,
    imageUrl: c.image_url,
    level: c.level,
    xp: c.xp,
    xpNeeded: xpForLevel(c.level),
    base: { hp: c.hp_max, atk: c.atk, def: c.def, spd: c.spd, focus: c.focus },
    effective: eff,
    hunger: Math.round(c.hunger),
    energy: Math.round(c.energy),
    mood: Math.round(c.mood),
    bond: Math.round(c.bond),
    moodLabel: moodLabel(c),
    traits: c.traits,
    moves: c.moves,
    wins: c.wins,
    losses: c.losses,
    hatchedAt: c.hatched_at,
  };
}

/** Persist-shape for saveEmberkin(). */
export function toSaveShape(c: Creature) {
  return {
    id: c.id, name: c.name, species: c.species, description: c.description,
    stage: c.stage, rarity: c.rarity, element: c.element, temperament: c.temperament,
    appearance: c.appearance, sprite: c.sprite,
    hp_max: c.hp_max, atk: c.atk, def: c.def, spd: c.spd, focus: c.focus,
    level: c.level, xp: c.xp,
    hunger: c.hunger, energy: c.energy, mood: c.mood, bond: c.bond,
    traits: c.traits as unknown[], moves: c.moves as unknown[],
    wins: c.wins, losses: c.losses,
    hatched_at: c.hatched_at, last_tick: c.last_tick,
  };
}
