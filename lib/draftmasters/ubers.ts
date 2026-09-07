/**
 * DraftMasters — Ubers.
 *
 * A variant describes the character. An UBER does not: it is a crossover
 * absurdity bolted onto whoever happened to come up, and the joke is entirely
 * in the collision. Ser Arthur Dayne with a lightsaber. Hot Pie in Super
 * Saiyan. That is why they live here rather than on the entries — an uber has
 * to work on anyone, so it can never be authored per character.
 *
 * Roughly ONE LOT IN FIVE HUNDRED. That number is doing the real work. Ubers
 * are strictly better than anything else in the game, so they are only fun
 * while they stay a story people tell afterwards — "I got Hot Pie with the
 * Infinity Gauntlet" — rather than a thing you plan around. A generous rate
 * would turn every draft into a lottery for them.
 *
 * They are written to read naturally after ANY name, which is the constraint
 * that shapes the whole list: no pronouns, no assumptions about species,
 * gender, size, or whether the thing has hands.
 */

/**
 * The pool. Each reads as "<name> (<uber>)".
 *
 * Deliberately drawn from across fiction — the point is the crossover, so a
 * Game of Thrones board pulling a Dragon Ball transformation is the feature,
 * not a bug.
 */
export const UBERS: string[] = [
  // Weapons and artefacts
  "with a lightsaber",
  "wielding Mjolnir, and worthy",
  "holding the full Infinity Gauntlet",
  "carrying the One Ring, and using it",
  "with the Death Note and your real name",
  "armed with the Buster Sword",
  "holding Excalibur, drawn from the stone",

  // Transformations
  "in Super Saiyan",
  "having gone Ultra Instinct",
  "in Mega Evolution",
  "having eaten a Devil Fruit",
  "in Bankai",
  "having activated their Domain Expansion",

  // Powers and states
  "with the Speed Force",
  "under a yellow sun",
  "wearing a Green Lantern ring",
  "with a Stand",
  "having achieved Nirvana mid-fight",

  // Situational nonsense
  "riding a fully grown dragon",
  "with a save point and infinite retries",
];

/**
 * Variants whose contribution is not a number.
 *
 * Eru Ilúvatar did not help win the contest; he is the author of the world the
 * contest happens in. Printing "20/10" beside that is a category error, so the
 * scorecard prints an infinity instead. Matched on the variant text because
 * that string is declared in exactly one place, on the card itself.
 */
export const BEYOND_MEASURE = ["Supreme Creator"];

/** Sentinel contribution meaning "do not render a number here". */
export const IMMEASURABLE = 999;

export function isBeyondMeasure(variant?: string | null): boolean {
  return Boolean(variant && BEYOND_MEASURE.includes(variant));
}

/** One lot in five hundred. Kept here so the rate is stated once. */
export const UBER_CHANCE = 1 / 500;

/**
 * Roll for an uber.
 *
 * Takes the draft's own seeded rng so a replayed game produces the same one,
 * and returns null the overwhelming majority of the time.
 */
export function rollUber(rng: () => number): string | null {
  if (rng() >= UBER_CHANCE) return null;
  return UBERS[Math.floor(rng() * UBERS.length)] ?? UBERS[0];
}

/**
 * The line handed to the judge and the battle writer when one lands.
 *
 * Stated as a rule rather than flavour, because a model shown "Hot Pie (with
 * a lightsaber)" will otherwise reason about Hot Pie the baker and hand the
 * contest to the other side — which is the one outcome that makes an uber
 * feel broken instead of extraordinary.
 */
export function uberBriefing(name: string, uber: string): string {
  return (
    `UBER IN PLAY — ${name} ${uber}.\n` +
    `This is not flavour and not an exaggeration. It is the rarest thing in the ` +
    `game (about one lot in five hundred) and it genuinely overrides the ` +
    `character's normal limits. Whoever they were before, they now have this, ` +
    `and it should decide the contest almost on its own. Treat the mismatch as ` +
    `the story: the joke is that this specific character has it, and your ` +
    `reasoning should enjoy that rather than argue them out of it.\n`
  );
}
