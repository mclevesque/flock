/**
 * Emberkin — stage changes. Lives outside the route files because both the
 * care route and the battle route can trigger an evolution, and Next.js route
 * modules may only export HTTP handlers.
 */

import { addEmberkinEvent, getEmberkinHistory } from "./db";
import { narrateEvolution } from "./emberkin-ai";
import { type Creature, type Stage, type Trait, proceduralTrait } from "./emberkin-engine";

export interface EvolutionResult {
  narration: string;
  species: string;
  sprite: string;
  stage: Stage;
}

/**
 * Rewrites a creature's form from everything its keeper has actually done with
 * it, and grants a trait if it has room. Mutates `c` in place — the caller is
 * responsible for persisting it.
 */
export async function runEvolution(
  c: Creature,
  newStage: Stage,
  rng: () => number,
  ai = true,
): Promise<EvolutionResult> {
  const history = await getEmberkinHistory(c.id).catch((): string[] => []);
  const gainedTrait: Trait | null = c.traits.length < 5 ? proceduralTrait(rng, c.element) : null;

  const evo = await narrateEvolution(c, history, newStage, gainedTrait, ai);

  c.stage = newStage;
  c.species = evo.species;
  c.description = evo.description;
  c.appearance = evo.appearance;
  c.sprite = evo.sprite;
  if (evo.trait) c.traits = [...c.traits, evo.trait];

  // Stage changes are a real power spike — the payoff for the grind.
  c.hp_max = Math.round(c.hp_max * 1.18);
  c.atk = Math.round(c.atk * 1.12);
  c.def = Math.round(c.def * 1.12);
  c.spd = Math.round(c.spd * 1.12);
  c.focus = Math.round(c.focus * 1.12);

  await addEmberkinEvent(c.id, "evolve", evo.narration, `evolved into a ${evo.species} (${newStage})`);

  return { narration: evo.narration, species: evo.species, sprite: evo.sprite, stage: newStage };
}
