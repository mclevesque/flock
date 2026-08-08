/**
 * Emberkin — AI flavour layer (GROQ / LLaMA 3.3 70B, free tier).
 *
 * Rules this file lives by:
 *  1. It NEVER decides mechanics. The engine hands it an already-resolved
 *     outcome; the model writes the scene around it. A hallucinating model
 *     can produce a weird sentence, never a broken creature.
 *  2. Every function has a procedural fallback. No GROQ_API_KEY, a 429, a
 *     timeout, malformed JSON — the game keeps working, just less florid.
 *  3. One short call per player action, hard-capped max_tokens. This is sized
 *     to sit inside GROQ's free tier; there is no paid API in this path.
 */

import {
  type Creature, type Move, type Trait, type Rarity, type OutcomeTier,
  type HatchIdentity, type BattleResult, type Combatant, type Stage,
  TRAIT_EFFECTS, STARTER_MOVE_KINDS, ALL_MOVE_KINDS,
  proceduralIdentity, proceduralMove, proceduralTrait,
  makeRng, hashSeed, moodLabel,
} from "./emberkin-engine";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

const STYLE = `You write for EMBERKIN, a creature-raising game set in a grim, warm, candlelit world — Dark Souls bonfire melancholy crossed with the affection of a Tamagotchi. Voice: terse, concrete, a little wry. Sensory detail over adjectives. Never cute-for-cute's-sake, never grimdark posturing. No emoji in prose. No second-person lecturing. Keep to the word limits exactly.`;

/** Low-temperature JSON call with a hard timeout. Returns null on any failure. */
async function groqJson<T>(
  system: string,
  user: string,
  maxTokens: number,
  temperature = 0.9,
): Promise<T | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: `${STYLE}\n\n${system}` },
          { role: "user", content: user },
        ],
        max_tokens: maxTokens,
        temperature,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    if (!text) return null;

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

// ── Sanitisers ───────────────────────────────────────────────────────────────
// Everything the model returns passes through these before it touches state.

function str(v: unknown, max: number, fallback: string): string {
  if (typeof v !== "string") return fallback;
  const s = v.replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : fallback;
}

/** Strips anything that isn't a single emoji-ish glyph. */
function emoji(v: unknown, fallback: string): string {
  if (typeof v !== "string") return fallback;
  const chars = Array.from(v.trim());
  const first = chars[0];
  if (!first || /[a-zA-Z0-9]/.test(first)) return fallback;
  return first;
}

function traitEffect(v: unknown, fallback: Trait["effect"]): Trait["effect"] {
  return (TRAIT_EFFECTS as readonly string[]).includes(v as string)
    ? (v as Trait["effect"])
    : fallback;
}

function creatureBrief(c: Creature): string {
  return [
    `Name: ${c.name}`,
    `Species: ${c.species} (${c.rarity}, ${c.stage}, level ${c.level})`,
    `Element: ${c.element}. Temperament: ${c.temperament}.`,
    `Looks like: ${c.appearance}`,
    `Currently: ${moodLabel(c)} — hunger ${Math.round(c.hunger)}/100, energy ${Math.round(c.energy)}/100, mood ${Math.round(c.mood)}/100, bond ${Math.round(c.bond)}/100.`,
    c.traits.length ? `Traits: ${c.traits.map(t => t.name).join(", ")}.` : "Traits: none yet.",
    c.moves.length ? `Moves: ${c.moves.map(m => m.name).join(", ")}.` : "Moves: none yet.",
  ].join("\n");
}

// ── Hatching ─────────────────────────────────────────────────────────────────

interface HatchJson {
  species?: string; description?: string; element?: string; temperament?: string;
  appearance?: string; sprite?: string;
  trait?: { name?: string; desc?: string; effect?: string };
  move?: { name?: string; desc?: string; kind?: string };
}

/**
 * The whisper is the player's only input into what emerges — combined with a
 * rarity the engine already rolled. Same whisper twice gives different results,
 * because the seed and rarity differ.
 */
export async function hatchIdentity(
  whisper: string,
  rarity: Rarity,
  seed: number,
  ai = true,
): Promise<HatchIdentity> {
  const rng = makeRng(seed);
  const fb = proceduralIdentity(rng, rarity, whisper);
  const fbTrait = proceduralTrait(rng, fb.element);
  const fbMove = proceduralMove(rng, fb.element, "normal", STARTER_MOVE_KINDS, whisper);

  const rarityNote: Record<Rarity, string> = {
    common: "Ordinary stock. Make it endearing, not impressive.",
    uncommon: "Slightly off from the norm — one memorable feature.",
    rare: "Genuinely unusual. Someone would stop to look at this.",
    mythic: "Something out of an old story. Awe, not horror.",
    aberrant: "The shell was wrong. This should not have hatched. Unsettling, but the player must still want to keep it.",
  };

  if (!ai) return { ...fb, trait: fbTrait, move: fbMove };

  const json = await groqJson<HatchJson>(
    `You invent a newly hatched creature. Respond ONLY with JSON:
{"species":"<1-3 word invented species name>","element":"<one lowercase word, its material or domain>","temperament":"<one lowercase adjective>","appearance":"<20-35 words, purely physical>","description":"<25-40 words, what it is and how it acts>","sprite":"<ONE emoji that best represents it>","trait":{"name":"<1-3 words>","desc":"<8-15 words>","effect":"<one of: ${TRAIT_EFFECTS.join(", ")}>"},"move":{"name":"<1-3 words>","desc":"<8-15 words>","kind":"<one of: ${STARTER_MOVE_KINDS.join(", ")}>"}}
The trait "effect" must be chosen to genuinely match the creature you described.`,
    `The keeper whispered this over the egg before it hatched:

    "${whisper || "nothing at all"}"

Rarity: ${rarity}. ${rarityNote[rarity]}

THE WHISPER IS THE BRIEF. The keeper must look at what hatches and recognise what they asked for. Carry its imagery, its mood and its intent directly into the species name, the appearance, the element and the temperament. If they asked for something fast, it is visibly built for speed. If they asked for something with too many eyes, count them.

Then twist EXACTLY ONE thing — give them what they asked for with one unexpected consequence, cost, or detail they did not ask for. Not a reinterpretation of the whole wish; one turn of the knife.

Name the move after what they asked for too, and pick its "kind" to match: strike for force, guile for speed and trickery, surge for will and power.

If the whisper is empty or nonsense, invent freely.`,
    500,
  );

  if (!json) {
    return { ...fb, trait: fbTrait, move: fbMove };
  }

  const element = str(json.element, 20, fb.element).toLowerCase().split(" ")[0];
  const kind = STARTER_MOVE_KINDS.includes(json.move?.kind as Move["kind"])
    ? (json.move!.kind as Move["kind"])
    : fbMove.kind;

  return {
    species: str(json.species, 40, fb.species),
    description: str(json.description, 320, fb.description),
    element,
    temperament: str(json.temperament, 24, fb.temperament).toLowerCase().split(" ")[0],
    appearance: str(json.appearance, 320, fb.appearance),
    sprite: emoji(json.sprite, fb.sprite),
    trait: {
      name: str(json.trait?.name, 40, fbTrait.name),
      desc: str(json.trait?.desc, 140, fbTrait.desc),
      effect: traitEffect(json.trait?.effect, fbTrait.effect),
    },
    // Power and cost stay engine-owned; the model only names and flavours.
    move: { ...fbMove, name: str(json.move?.name, 40, fbMove.name), desc: str(json.move?.desc, 140, fbMove.desc), kind },
  };
}

// ── Training ─────────────────────────────────────────────────────────────────

interface TrainJson {
  narration?: string;
  move?: { name?: string; desc?: string; kind?: string };
  trait?: { name?: string; desc?: string; effect?: string };
}

const TIER_BRIEF: Record<OutcomeTier, string> = {
  fumble: "It went badly. The creature got hurt, distracted, or refused outright. The keeper lost ground.",
  weak: "Barely anything landed. A slow, unremarkable session.",
  normal: "Solid, unglamorous progress. Something was learned.",
  strong: "It went well. A real breakthrough in the middle of the session.",
  crit: "Extraordinary. The creature surprised its keeper and itself.",
  wild: "Something unplanned happened. The creature changed in a direction NOBODY aimed for — including the keeper. Lean into the strangeness.",
};

export async function narrateTraining(
  c: Creature,
  instruction: string,
  focusLabel: string,
  tier: OutcomeTier,
  newMove: Move | null,
  newTrait: Trait | null,
  ai = true,
): Promise<{ narration: string; move: Move | null; trait: Trait | null }> {
  const fallback =
    tier === "fumble"
      ? `${c.name} would not settle. The session ends with nothing gained and a bruise to show for it.`
      : tier === "wild"
        ? `Something shifts in ${c.name} mid-session — not what you were training for at all.`
        : `${c.name} works at ${focusLabel.toLowerCase()} until the light goes. Progress, of a kind.`;

  const asks: string[] = [`"narration":"<35-55 words, past tense, concrete>"`];
  if (newMove) asks.push(`"move":{"name":"<1-3 words>","desc":"<8-15 words>","kind":"<one of: ${ALL_MOVE_KINDS.join(", ")}>"}`);
  if (newTrait) asks.push(`"trait":{"name":"<1-3 words>","desc":"<8-15 words>","effect":"<one of: ${TRAIT_EFFECTS.join(", ")}>"}`);

  if (!ai) return { narration: fallback, move: newMove, trait: newTrait };

  const json = await groqJson<TrainJson>(
    `You narrate one training session. Respond ONLY with JSON:
{${asks.join(",")}}`,
    `${creatureBrief(c)}

The keeper trained it toward: ${focusLabel}
The keeper's instruction: "${instruction || "no particular instruction"}"

HOW IT WENT (this is fixed — narrate this outcome, do not change it): ${TIER_BRIEF[tier]}
${newMove ? `\nIt came away with a NEW MOVE. Name it, describe it, and choose its "kind" so that BOTH the move and its kind clearly follow from what the keeper asked for above — they should read the name and see their own instruction in it. (strike = force, guile = speed/trickery, surge = will/power, ward = defence/endurance, chaos = unpredictable.)` : ""}${newTrait ? `\nIt came away with a NEW TRAIT. Name and describe it, and pick the effect that fits what you wrote.` : ""}`,
    360,
  );

  return {
    narration: str(json?.narration, 500, fallback),
    // Power and cost stay engine-owned; the model may steer name, prose and kind.
    move: newMove
      ? {
          ...newMove,
          name: str(json?.move?.name, 40, newMove.name),
          desc: str(json?.move?.desc, 140, newMove.desc),
          kind: ALL_MOVE_KINDS.includes(json?.move?.kind as Move["kind"])
            ? (json!.move!.kind as Move["kind"])
            : newMove.kind,
        }
      : null,
    trait: newTrait
      ? {
          name: str(json?.trait?.name, 40, newTrait.name),
          desc: str(json?.trait?.desc, 140, newTrait.desc),
          effect: traitEffect(json?.trait?.effect, newTrait.effect),
        }
      : null,
  };
}

// ── Talking ──────────────────────────────────────────────────────────────────

/**
 * Creatures do not speak human language. They answer in behaviour — which
 * keeps them feeling like animals rather than chatbots, and keeps responses
 * short enough to be nearly free.
 */
export async function speakTo(
  c: Creature,
  message: string,
  recent: string[],
  ai = true,
): Promise<string> {
  const fallback = `${c.name} tilts its head at the sound of your voice, and does not look away.`;
  if (!ai) return fallback;

  const json = await groqJson<{ reply?: string }>(
    `You write how a creature REACTS to something its keeper said. It cannot talk. It answers with body language, sound, and action only. Respond ONLY with JSON: {"reply":"<25-45 words, present tense, third person>"}`,
    `${creatureBrief(c)}
${recent.length ? `\nEarlier today:\n${recent.slice(-3).map(r => `- ${r}`).join("\n")}` : ""}

The keeper says: "${message}"

React in character. A ${c.temperament} creature at bond ${Math.round(c.bond)}/100 — low bond means wary or indifferent, high bond means it seeks contact. If it is ${moodLabel(c)}, that shows.`,
    220,
    1.0,
  );

  return str(json?.reply, 400, fallback);
}

// ── Evolution ────────────────────────────────────────────────────────────────

interface EvolveJson {
  species?: string; description?: string; appearance?: string; sprite?: string;
  narration?: string;
  trait?: { name?: string; desc?: string; effect?: string };
}

/**
 * Evolution reads the creature's whole history — every training instruction,
 * every meal, every conversation — and pushes the form in that direction.
 * Two players who both raised a "fast" creature will still diverge, because
 * their logs differ and the rolls differed.
 */
export async function narrateEvolution(
  c: Creature,
  history: string[],
  newStage: Stage,
  gainedTrait: Trait | null,
  ai = true,
): Promise<{
  species: string; description: string; appearance: string; sprite: string;
  narration: string; trait: Trait | null;
}> {
  const rng = makeRng(hashSeed(c.id, newStage, c.level));
  const fbTrait = gainedTrait ?? proceduralTrait(rng, c.element);

  const asks = [
    `"species":"<1-3 words, clearly an evolved form of ${c.species}>"`,
    `"appearance":"<20-35 words, purely physical, showing what changed>"`,
    `"description":"<25-40 words>"`,
    `"sprite":"<ONE emoji>"`,
    `"narration":"<40-60 words, the moment of change>"`,
  ];
  if (gainedTrait) asks.push(`"trait":{"name":"<1-3 words>","desc":"<8-15 words>","effect":"<one of: ${TRAIT_EFFECTS.join(", ")}>"}`);

  const json = ai ? await groqJson<EvolveJson>(
    `A creature is changing form. Respond ONLY with JSON:
{${asks.join(",")}}`,
    `${creatureBrief(c)}

It is becoming: ${newStage}

EVERYTHING ITS KEEPER HAS DONE WITH IT, in order:
${history.length ? history.slice(-14).map(h => `- ${h}`).join("\n") : "- almost nothing; it was left largely alone"}

Let that history visibly shape the new form. A creature drilled in violence and fed strange things should not become the same thing as one that was talked to and rested. If it was neglected, show that too.`,
    620,
  ) : null;

  return {
    species: str(json?.species, 40, `Elder ${c.species}`),
    description: str(json?.description, 320, c.description),
    appearance: str(json?.appearance, 320, c.appearance),
    sprite: emoji(json?.sprite, c.sprite),
    narration: str(json?.narration, 500, `${c.name} comes apart and puts itself back together larger, stranger, and unmistakably yours.`),
    trait: gainedTrait
      ? {
          name: str(json?.trait?.name, 40, fbTrait.name),
          desc: str(json?.trait?.desc, 140, fbTrait.desc),
          effect: traitEffect(json?.trait?.effect, fbTrait.effect),
        }
      : null,
  };
}

// ── Battle narration ─────────────────────────────────────────────────────────

/** One call per battle, narrating an already-decided fight. */
export async function narrateBattle(
  a: Combatant,
  b: Combatant,
  result: BattleResult,
  playerIsA: boolean,
  ai = true,
): Promise<{ opening: string; closing: string }> {
  const playerWon = (result.winner === "a") === playerIsA;
  const fallback = {
    opening: `${a.name} and ${b.name} circle each other in the ash.`,
    closing: playerWon
      ? `${(playerIsA ? a : b).name} is left standing, breathing hard.`
      : `${(playerIsA ? a : b).name} goes down. It will remember this.`,
  };

  if (!ai) return fallback;

  // Only the decisive beats go in the prompt — keeps tokens tiny.
  const highlights = result.beats
    .filter(x => x.crit || x.missed || x.damage > 0)
    .slice(-6)
    .map(x => `${x.side === "a" ? a.name : b.name} used ${x.move} — ${x.missed ? "missed" : `${x.damage} damage${x.crit ? ", critical" : ""}`}`)
    .join("\n");

  const json = await groqJson<{ opening?: string; closing?: string }>(
    `You bookend a duel that has already been fought. Respond ONLY with JSON: {"opening":"<20-30 words setting the scene>","closing":"<25-40 words on how it ended>"}`,
    `${a.name} the ${a.species} (level ${a.level}) versus ${b.name} the ${b.species} (level ${b.level}).

How it went:
${highlights || "a short, ugly scuffle"}

Winner: ${result.winner === "a" ? a.name : b.name}, after ${result.rounds} rounds, finishing at ${result.winner === "a" ? result.finalHpA : result.finalHpB} HP.`,
    300,
  );

  return {
    opening: str(json?.opening, 300, fallback.opening),
    closing: str(json?.closing, 400, fallback.closing),
  };
}

// ── Feeding ──────────────────────────────────────────────────────────────────

export async function narrateFeeding(
  c: Creature,
  foodLabel: string,
  mutated: boolean,
  ai = true,
): Promise<string> {
  const fallback = mutated
    ? `${c.name} eats the ${foodLabel.toLowerCase()} and something behind its eyes changes.`
    : `${c.name} eats the ${foodLabel.toLowerCase()}, then looks up for more.`;

  if (!ai) return fallback;

  const json = await groqJson<{ reply?: string }>(
    `Respond ONLY with JSON: {"reply":"<20-35 words, present tense, third person>"}`,
    `${creatureBrief(c)}

You feed it: ${foodLabel}
${mutated ? "IT IS CHANGING as it eats — the food did something to it. Show the beginning of that." : "Nothing unusual happens. Show how THIS creature specifically eats."}`,
    200,
    1.0,
  );

  return str(json?.reply, 400, fallback);
}
