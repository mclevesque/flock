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
 * Cards that are not in any board's rotation and turn up only on the
 * one-in-five-hundred roll — on ANY board, whatever it is about.
 *
 * GATED BY FRANCHISE. Eru can appear on a Tolkien board, or on any crossover
 * that has Tolkien in it — but never on a Pokémon draft. The author of
 * Middle-earth turning up in a contest that has nothing to do with
 * Middle-earth is not a crossover, it is a non sequitur: there is no joke
 * because there is no collision, just a card nobody at the table has a reason
 * to care about.
 *
 * `match` is checked against everything the board is made of — its name, its
 * scenario, AND its entry names — so "Thrones vs LOTR" qualifies through
 * Aragorn and Gandalf even if the topic string never says Tolkien.
 *
 * Each is the top of its own cosmology, so none is arguably beatable by the
 * others — fine, since two in one game is a one-in-250,000 event.
 */
export interface UberCard {
  /** Name as drafted. */
  n: string;
  /** Extra words for the portrait search. */
  s?: string;
  /** The variant it always wears. */
  v: string;
  /**
   * Lowercase fragments. The board must mention at least one of these
   * somewhere — topic, scenario, or any entry name — for this card to be
   * eligible at all.
   */
  match: string[];
}

export const UBER_CARDS: UberCard[] = [
  {
    n: "Eru Ilúvatar",
    s: "Tolkien Eru Iluvatar the One",
    v: "Supreme Creator",
    match: [
      "lotr", "lord of the rings", "tolkien", "middle-earth", "middle earth",
      "hobbit", "silmarillion", "gandalf", "aragorn", "frodo", "sauron",
      "gollum", "legolas", "gimli", "saruman", "balrog", "mordor", "rivendell",
      "galadriel", "boromir", "treebeard", "isildur", "numenor", "valar",
    ],
  },
  {
    n: "The One Above All",
    s: "Marvel Comics",
    v: "above all others",
    match: [
      "marvel", "avengers", "x-men", "spider-man", "spiderman", "thanos",
      "iron man", "captain america", "doctor strange", "mcu",
      "infinity gauntlet", "asgard", "magneto", "galactus",
    ],
  },
  {
    n: "The Living Tribunal",
    s: "Marvel Comics",
    v: "passing judgement on the multiverse",
    match: [
      "marvel", "avengers", "x-men", "spider-man", "spiderman", "thanos",
      "iron man", "captain america", "doctor strange", "mcu", "galactus",
    ],
  },
  {
    n: "The Presence",
    s: "DC Comics",
    v: "the Voice from the whirlwind",
    match: [
      "dc comics", "superman", "batman", "justice league", "wonder woman",
      "green lantern", "aquaman", "darkseid", "gotham", "krypton", "metropolis",
    ],
  },
  {
    n: "Zeno",
    s: "Dragon Ball Omni-King Zen-Oh",
    v: "Omni-King, erasing with a gesture",
    match: [
      "dragon ball", "dragonball", "goku", "vegeta", "saiyan", "frieza",
      "beerus", "gohan", "namek", "kamehameha",
    ],
  },
  {
    n: "The Truth",
    s: "Fullmetal Alchemist",
    v: "All is One, One is All",
    match: ["fullmetal", "full metal alchemist", "elric", "amestris", "homunculus"],
  },
  {
    n: "Azathoth",
    s: "Lovecraft blind idiot god",
    v: "stirring in its sleep",
    match: [
      "lovecraft", "cthulhu", "eldritch", "cosmic horror", "mythos",
      "nyarlathotep", "innsmouth", "necronomicon", "shoggoth", "elder god",
    ],
  },
  {
    n: "Haruhi Suzumiya",
    s: "anime",
    v: "rewriting reality without noticing",
    match: ["haruhi", "suzumiya", "sos brigade", "kyon"],
  },
];

/**
 * Cards whose universe is actually present on this board.
 *
 * Matched on WORD BOUNDARIES, not substrings. A plain `includes` put Eru on
 * the anime and horror boards because "ent " appears inside "opponent ", which
 * is exactly the kind of silent nonsense this gate exists to prevent.
 */
export function eligibleUberCards(boardText: string): UberCard[] {
  // Pad the ends so a keyword at the very start or end still has a boundary.
  const hay = ` ${boardText.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  const mentions = (needle: string) => {
    const cleaned = needle.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    return cleaned.length > 0 && hay.includes(` ${cleaned} `);
  };
  return UBER_CARDS.filter((c) => c.match.some(mentions));
}

/**
 * Variants whose contribution is not a number.
 *
 * Eru Ilúvatar did not help win the contest; he is the author of the world the
 * contest happens in. Printing "20/10" beside that is a category error, so the
 * scorecard prints an infinity instead — and the same goes for every card in
 * UBER_CARDS, each of which sits at the top of its own cosmology.
 */
export const BEYOND_MEASURE: string[] = UBER_CARDS.map((c) => c.v);

/**
 * Pick one cosmic card for a board, at the same one-in-five-hundred odds —
 * but only from the ones whose universe this board actually touches.
 *
 * Most boards make none of them eligible, and that is correct: the rate is a
 * ceiling, not a quota.
 */
export function rollUberCard(rng: () => number, boardText: string): UberCard | null {
  if (rng() >= UBER_CHANCE) return null;
  const pool = eligibleUberCards(boardText);
  if (!pool.length) return null;
  return pool[Math.floor(rng() * pool.length)] ?? pool[0];
}

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
    `UBER IN PLAY — ${name} ${uber}.
` +
    `This is not flavour and not an exaggeration. It is the rarest thing in the ` +
    `game (about one lot in five hundred) and it genuinely overrides the ` +
    `character's normal limits. Whoever they were before, they now have this, ` +
    `and it decides the contest. Treat the mismatch as the story: the joke is ` +
    `that this specific character has it, and your reasoning should enjoy that ` +
    `rather than argue them out of it.
` +
    `THE SIDE HOLDING IT WINS unless the other side is holding one too. Never ` +
    `write that it is flavour, cosmetic, or provides no mechanical advantage — ` +
    `that is exactly backwards, and a player who drew a one-in-five-hundred card ` +
    `and read that would be right to think the game was broken. Its contribution ` +
    `is beyond measurement, so do not score it out of ten; say what it did to ` +
    `the other roster instead.
`
  );
}
