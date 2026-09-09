/**
 * DraftMasters — traits and counters.
 *
 * The game leaned entirely on the model to know that a scorpion bolt ruins a
 * dragon and that the same weapon is useless against a man who can step aside.
 * That works when the model is sharp and quietly stops working when it isn't —
 * and it can never work at all on the offline path.
 *
 * So the rules the game actually cares about live here, in code:
 *
 *   TRAITS are inferred from the name, so they work on boards nobody wrote by
 *   hand. "Drogon", "Smaug" and "an ice giant" all resolve to something big
 *   and slow without anyone tagging them, which matters because most boards
 *   are generated at play time from whatever the player typed.
 *
 *   COUNTERS are declared on the card. A counter says "I beat these traits,
 *   this often" — the anti-air siege weapon that shreds dragons and misses
 *   infantry. Declared rather than inferred, because a counter is a design
 *   decision about one card, not a fact about a word.
 *
 * Both are handed to the AI judge as well, so the verdict says the same thing
 * whether a model saw it or not. That consistency is the point.
 */

import type { VariantGrade } from "./packs";

export type Trait =
  /** Winged, breathes fire, hoards things. Drogon, Smaug, a wyvern. */
  | "dragon"
  /** Enormous humanoid. Wun Wun, a frost giant, a titan. */
  | "giant"
  /** Huge but not humanoid — a kraken, a whale, a kaiju. */
  | "large"
  /** Slow to turn, slow to react. An ent, a golem, a shambling dead thing. */
  | "sluggish"
  /** Fights in the air. */
  | "flying"
  /** A person on foot: quick, small, able to dodge. */
  | "infantry";

/**
 * Name fragments that imply a trait, across universes.
 *
 * Deliberately generous: a false positive on "giant" costs a little scoring
 * accuracy, while a miss means the counter card silently does nothing, which
 * is the failure players actually notice.
 */
const TRAIT_WORDS: Record<Trait, string[]> = {
  dragon: [
    "dragon", "drogon", "viserion", "rhaegal", "balerion", "smaug", "wyvern",
    // The Dance of the Dragons. Every one of these was classed as infantry.
    "meleys", "vhagar", "caraxes", "syrax", "seasmoke", "sunfyre", "vermithor", "silverwing", "tessarion", "moondancer", "arrax", "dreamfyre", "vermax", "tyraxes", "morghul", "shrykos", "grey ghost", "cannibal",
    "falkor", "spyro", "mushu", "king ghidorah", "rodan", "blue-eyes white",
    "ancalagon", "glaurung", "shenron", "bahamut", "ridley", "alduin", "toothless",
    "charizard", "dragonite", "salamence", "rayquaza", "reshiram", "zekrom", "haku",
  ],
  giant: [
    "giant", "wun wun", "titan", "colossus", "ogre", "troll", "cyclops", "ent ",
    // Gregor Clegane is eight feet of him and was reading as infantry.
    "the mountain", "gregor clegane", "ser gregor", "sandor", "the hound",
    "treebeard", "groot", "gigantamax", "goliath", "jotun", "frost giant", "ice giant",
    "attack titan", "colossal titan", "regigigas", "golem", "juggernaut",
  ],
  large: [
    "kraken", "whale", "leviathan", "kaiju", "godzilla", "elephant", "mammoth",
    "rhino", "hippopotam", "t-rex", "tyrannosaur", "dinosaur", "sandworm", "shai-hulud",
    "balrog", "wampa", "rancor", "acromantula", "basilisk", "snorlax", "wailord",
    "gyarados", "onix", "steelix", "sperm whale", "giant squid", "orca", "shark",
    "bear", "mecha", "gundam", "at-at", "walker", "tank", "dreadnought",
  ],
  sluggish: [
    "treebeard", "ent ", "golem", "zombie", "shambler", "undead", "wight", "mummy",
    "snorlax", "slaking", "regigigas", "shuckle", "at-at", "sloth", "turtle",
    "torterra", "steelix", "onix", "colossal titan", "frankenstein",
  ],
  flying: [
    "dragon", "drogon", "viserion", "rhaegal", "smaug", "wyvern", "eagle", "hawk",
    "meleys", "vhagar", "caraxes", "syrax", "seasmoke", "sunfyre", "vermithor", "silverwing", "tessarion", "moondancer", "arrax", "dreamfyre", "vermax", "tyraxes", "morghul", "shrykos", "grey ghost", "cannibal",
    "king ghidorah", "rodan", "mothra",
    "falcon", "raven", "owl", "pterodactyl", "charizard", "rayquaza", "zapdos",
    "moltres", "articuno", "superman", "iron man", "thor", "angel", "banshee",
  ],
  infantry: [],
};

/**
 * Traits for a drafted pick, from its name and its rolled condition.
 *
 * The variant is read too, because it can change what the thing IS — "Rock Lee
 * (eight gates open)" is still infantry, but "Viserion (wight, blue fire)" is a
 * dragon whichever way you look at it, and a variant that says "on a dragon"
 * puts an otherwise ordinary pick in the air.
 */
/**
 * Words meaning small, young or not yet hatched.
 *
 * Deliberately narrow. "young" is NOT here: a young Robert Baratheon with the
 * warhammer is a monster, and a list that catches it would quietly gut every
 * prime-of-their-life variant on the board.
 */
const DIMINUTIVE = [
  "newborn", "new-born", "hatchling", "unhatched", "infant", "baby", "cub", "pup",
  "kitten", "chick", "egg", "runt", "larval", "just hatched", "days old",
];

/** States that make a big grade implausible whatever the model claimed. */
const DIMINISHED = [
  ...DIMINUTIVE,
  "wounded", "dying", "injured", "crippled", "blinded", "poisoned", "starving",
  "exhausted", "imprisoned", "in chains", "maimed", "sick", "feverish", "bleeding",
  "half-dead", "barely", "malnourished", "drained", "sealed away", "de-powered",
];

const hasAny = (text: string, words: string[]) => {
  const t = text.toLowerCase();
  return words.some((w) => t.includes(w));
};

/** True when the condition describes something small or young rather than grown. */
export function isDiminutive(text: string): boolean {
  return hasAny(text, DIMINUTIVE);
}

/**
 * Cap a grade the words cannot support.
 *
 * "Daenerys with three newborn dragons" came back MYTHIC — three dragons reads
 * as overwhelming, and the word doing all the work is "newborn". Hatchlings
 * are the weakest Daenerys ever is. The model is not reliably careful about
 * this, and it is trivially checkable, so the game checks it.
 *
 * Capped at "boon" rather than "neutral": three baby dragons are still worth
 * something, just not the contest.
 */
export function clampGradeToText(grade: VariantGrade, variantText: string): VariantGrade {
  const big: VariantGrade[] = ["legendary", "exalted", "mythic", "major"];
  if (big.includes(grade)) {
    return hasAny(variantText, DIMINISHED) ? "boon" : grade;
  }
  return softenPartialHandicap(grade, variantText);
}

/**
 * States that take SOMETHING away without taking away the character.
 *
 * The counterpart to DIMINISHED, and it exists because the model kept reaching
 * for the bottom of the ladder for what is really a dent. "Thanos, gauntlet
 * missing one stone" came back CRIPPLING, which dropped a tier-5 to a tier-2
 * and then to 0/10 on the scorecard — while five infinity stones is still
 * stronger than almost anything else on a Marvel board.
 *
 * The rule these all share: the thing is incomplete, not broken.
 */
const PARTIAL = [
  "missing one", "missing a", "one short", "short one", "one stone", "without one",
  "minus one", "down one", "all but one", "incomplete", "not at full", "less than full",
  "reduced power", "reduced", "partially", "partial", "slightly", "a little",
  "out of practice", "rusty", "tired", "distracted", "outnumbered", "off guard",
  "unarmed", "no weapon", "weapon lost", "low on ammo", "out of ammo",
];

/**
 * Cap how hard a negative grade is allowed to hit when the words describe a
 * partial loss.
 *
 * CRIPPLING is three steps down and means "cannot meaningfully fight" — a
 * newborn, a corpse, someone in chains. An elite who has merely lost one of
 * several advantages is WEAKENING, one step, which is what the colour is for.
 * Without this the ladder had no way to say "dented but still terrifying", and
 * the strongest cards in the game were the easiest to write to zero.
 */
export function softenPartialHandicap(grade: VariantGrade, variantText: string): VariantGrade {
  if (grade !== "crippling") return grade;
  // A state that is BOTH partial and genuinely diminishing stays crippling —
  // "missing one arm, and dying" is not a dent.
  if (hasAny(variantText, DIMINISHED)) return grade;
  return hasAny(variantText, PARTIAL) ? "weakening" : grade;
}

/**
 * Does this fragment appear in the name?
 *
 * Substring for anything long enough to be unambiguous, whole-word for the
 * short ones. "ent " is in the giant list for Treebeard and the Ents, and as
 * a plain substring it also matched AlicENT Hightower -- which put a queen on
 * the same plane as a dragon.
 */
export function hits(hay: string, word: string): boolean {
  const w = word.trim();
  // Every fragment in the table is plain letters, spaces and hyphens, so there
  // is nothing here a regex would read as punctuation.
  const i = hay.indexOf(w);
  if (i < 0) return false;
  const before = i === 0 ? "" : hay[i - 1];
  const after = hay[i + w.length] ?? "";
  return !/[a-z]/.test(before) && !/[a-z]/.test(after);
}

export function traitsOf(name: string, variant?: string | null): Trait[] {
  const hay = `${name} ${variant ?? ""}`.toLowerCase();
  const found = new Set<Trait>();

  for (const [trait, words] of Object.entries(TRAIT_WORDS) as [Trait, string[]][]) {
    if (words.some((w) => hits(hay, w))) found.add(trait);
  }

  // A hatchling is not a siege target. Without this, "with three newborn
  // dragons" reads as dragon-sized to every counter on the board and Qyburn's
  // scorpion gets a 60% shot at something the size of a dog.
  if (isDiminutive(hay)) {
    found.delete("dragon");
    found.delete("giant");
    found.delete("large");
    found.delete("sluggish");
  }

  // Anything huge is, for siege purposes, a big target — a dragon and a giant
  // are both "large" even though the word never appears in their name.
  if (found.has("dragon") || found.has("giant")) found.add("large");

  // Nothing enormous also counts as a nimble target on foot. The distinction is
  // the whole reason a siege weapon can be devastating and useless at once.
  if (!found.has("large") && !found.has("giant") && !found.has("dragon")) {
    found.add("infantry");
  }

  return [...found];
}

// ── Counters ─────────────────────────────────────────────────────────────────

export interface Counter {
  /** Traits this card is built to destroy. */
  strongAgainst: Trait[];
  /** Chance of removing a target that has one of those traits, 0-1. */
  hitChance: number;
  /** Chance against everything else — usually poor, that being the trade. */
  baseChance: number;
  /** One line, shown to the player and handed to the AI so both tell the same story. */
  note: string;
}

/**
 * Counters keyed by a fragment of the card's name, so a board the model
 * invented gets the same rules as a hand-written one if it names the same
 * weapon. The variant is checked first — a card's mythic form can be a
 * different weapon entirely.
 */
const COUNTERS: { match: string; variant?: string; counter: Counter }[] = [
  {
    match: "scorpion",
    variant: "rapid",
    counter: {
      // The mythic form widens from "dragons and giants" to anything big and
      // slow, in any universe — Smaug, Treebeard, an ice giant, Drogon alike.
      strongAgainst: ["dragon", "giant", "large", "sluggish"],
      hitChance: 0.9,
      baseChance: 0.1,
      note:
        "Rapid-fire scorpion: reloads faster than anything that size can turn. " +
        "Near-certain to bring down a dragon, a giant, or any large, sluggish creature. " +
        "Still close to useless against anyone quick enough to walk out of the firing line.",
    },
  },
  {
    match: "scorpion",
    counter: {
      strongAgainst: ["dragon", "giant"],
      hitChance: 0.6,
      baseChance: 0.1,
      note:
        "Qyburn's scorpion: a dragon-killing bolt thrower. Devastating against dragons " +
        "and giants, which are too big to miss and too slow to close the distance. " +
        "Against anyone on foot it is a slow, heavy machine that rarely lands a shot.",
    },
  },
];

/** The counter this pick carries, if any. */
export function counterOf(name: string, variant?: string | null): Counter | null {
  const n = name.toLowerCase();
  const v = (variant ?? "").toLowerCase();
  for (const row of COUNTERS) {
    if (!n.includes(row.match)) continue;
    if (row.variant && !v.includes(row.variant)) continue;
    return row.counter;
  }
  return null;
}

// ── Applying counters to a matchup ───────────────────────────────────────────

export interface CounterHit {
  attacker: string;
  target: string;
  /** Share of the target's strength this removes, 0-1. */
  effect: number;
  note: string;
}

interface Pickish {
  name: string;
  variant?: string | null;
  tier: number;
}

/**
 * Work out what one side's counters do to the other's roster.
 *
 * Resolved as expected value rather than a coin flip: a 60% chance to kill a
 * dragon removes 60% of that dragon's strength. Rolling it would be more
 * dramatic but would also mean the verdict screen and the battle could
 * disagree about whether the dragon actually died — the exact inconsistency
 * the plan and cast notes exist to prevent. The odds are still handed to the
 * battle writer, so the fight can dramatise the shot without the score
 * depending on how it lands.
 *
 * Each counter spends itself on the single biggest legitimate target, so
 * stacking one scorpion does not quietly delete an entire enemy roster.
 */
export function counterHits(attackers: Pickish[], defenders: Pickish[]): CounterHit[] {
  const hits: CounterHit[] = [];
  const claimed = new Set<string>();

  for (const a of attackers) {
    const counter = counterOf(a.name, a.variant);
    if (!counter) continue;

    const candidates = defenders
      .filter((d) => !claimed.has(d.name))
      .map((d) => {
        const traits = traitsOf(d.name, d.variant);
        const matched = counter.strongAgainst.some((t) => traits.includes(t));
        return { d, effect: matched ? counter.hitChance : counter.baseChance, matched };
      })
      // Prefer a real target; among those, the one that hurts most to lose.
      .sort((x, y) =>
        x.matched === y.matched ? y.d.tier - x.d.tier : x.matched ? -1 : 1
      );

    const best = candidates[0];
    if (!best) continue;
    claimed.add(best.d.name);
    hits.push({
      attacker: a.name,
      target: best.d.name,
      effect: best.effect,
      note: best.matched
        ? `${a.name} is built for exactly this: ${best.d.name} is the kind of target it cannot miss.`
        : `${a.name} has nothing worth shooting at — ${best.d.name} is far too quick for it.`,
    });
  }

  return hits;
}

/** Render the counters into prompt text, so the AI judge rules the same way the engine scores. */
export function counterBriefing(
  sideName: string,
  hits: CounterHit[]
): string {
  if (!hits.length) return "";
  const lines = hits.map(
    (h) =>
      `  - ${h.attacker} vs ${h.target}: ${Math.round(h.effect * 100)}% to take it out. ${h.note}`
  );
  return `HARD COUNTERS on ${sideName}'s side — these are game rules, not opinions, and your verdict must respect them:\n${lines.join("\n")}\n`;
}
