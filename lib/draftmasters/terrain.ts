/**
 * DraftMasters — what the ground does.
 *
 * Every board already rolls an arena, and until now that arena was a sentence.
 * It went into the judge's prompt, the judge weighed it however it felt, and
 * on the offline path it did nothing whatsoever — so "open water" and "a
 * frozen godswood" produced identical fights.
 *
 * That is a waste of the best variable the game has. The arena is the one
 * thing that changes what a whole roster is worth AFTER it has been drafted:
 * five cavalry picks are a different team on a mountain pass than on a plain,
 * and the moment where a player realises the ground has ruined them is the
 * moment the draft becomes a game rather than a shopping list.
 *
 * So terrain now has rules. They are INFERRED from the arena's own words
 * rather than declared, for the same reason traits are: most boards in this
 * game are generated at play time from whatever somebody typed, and a rule
 * that only works on hand-written boards is a rule that mostly does not work.
 * "Open water" reads as open water whether a person or a model wrote it.
 *
 * The AI still gets the arena text and still writes it beautifully. It no
 * longer decides what it means.
 */

import type { Plane } from "./planes";
import type { Trait } from "./traits";

export interface TerrainRule {
  /** Traits this ground helps or hurts. */
  traits: Trait[];
  /** Attack swing for a card with one of those traits. */
  atk: number;
  /** Health swing for a card with one of those traits. */
  def: number;
  /** Shown to the player when they tap the arena pin, and handed to the judge. */
  note: string;
}

export interface Terrain {
  /** The arena's own name, for the log. */
  name: string;
  rules: TerrainRule[];
  /**
   * Swing on the single-blow breakthrough cap.
   *
   * Open ground means more of a killing blow carries on into you; somewhere
   * tight and walled means less does. Small numbers — this is a nudge on a cap
   * that is already the game's safety rail.
   */
  breakthrough: number;
  /**
   * A ceiling every card on the field is dragged down to.
   *
   * The most dramatic thing an arena can do, and the reason it exists: a red-sun
   * room, a power-dampening field, a domain where nobody can use their strongest
   * technique. Superman on plane 6 and Batman on plane 2 are a fight nobody
   * needs to watch. Cap the room at 2 and it is the best fight on the board.
   *
   * It does not touch attack or health — only which weight class of reality
   * everyone is fighting in. A god who has been dragged down to Exceptional is
   * still a god with a god's stat line; they simply cannot ignore you any more.
   */
  planeCap?: Plane;
}

/**
 * Ground types, matched on words that appear in an arena's name or
 * description.
 *
 * Ordered most specific first, and a single arena can pick up several — "a
 * frozen lake at night" is open, cold and dark, and all three should count.
 */
const GROUNDS: {
  words: string[];
  rule?: TerrainRule;
  breakthrough?: number;
  planeCap?: Plane;
}[] = [
  {
    words: [
      "power-dampening", "power dampening", "dampening field", "red-sun", "red sun",
      "no powers", "depowered", "null field", "anti-magic", "antimagic",
      "nobody can use their strongest", "sealed barrier", "powers suppressed",
    ],
    planeCap: 2,
    rule: {
      traits: ["infantry"],
      atk: 1,
      def: 1,
      note:
        "Nothing works here. Every card on the field fights as though they were merely " +
        "exceptional, whatever they are outside this room — which is very good news for " +
        "everybody who was already only that, and the worst possible news for a god.",
    },
  },
  {
    words: ["holy ground", "consecrated", "hallowed", "sanctified"],
    planeCap: 4,
    rule: {
      traits: ["infantry"],
      atk: 1,
      def: 0,
      note: "Consecrated ground. Whatever is standing on it is standing on it diminished.",
    },
  },
  {
    words: ["open water", "the sea", "at sea", "ocean", "the gullet", "deep water", "mid-ocean"],
    rule: {
      traits: ["flying"],
      atk: 2,
      def: 2,
      note:
        "Open water. Anything that flies owns this outright — there is no cover, no high " +
        "ground and nowhere to close the distance on foot. Everything else is standing on a " +
        "deck waiting to find out how the day goes.",
    },
    breakthrough: 1,
  },
  {
    words: ["sky", "in the air", "airborne", "above the clouds", "orbit", "in flight"],
    rule: {
      traits: ["flying", "dragon"],
      atk: 3,
      def: 1,
      note: "Fought in the air. If you cannot get up here you are not in this fight at all.",
    },
    breakthrough: 1,
  },
  {
    words: ["narrow", "corridor", "tunnel", "bridge", "pass", "doorway", "alley", "stairwell", "sewer"],
    rule: {
      traits: ["giant", "large", "dragon"],
      atk: -2,
      def: -1,
      note:
        "Too narrow to be big in. Size stops being an advantage the moment there is nowhere " +
        "to swing, and one competent fighter in a doorway is worth five in a field.",
    },
    breakthrough: -2,
  },
  {
    words: ["cramped", "cave", "indoors", "cellar", "vault", "hold", "crypt", "basement", "underground"],
    rule: {
      traits: ["giant", "large", "flying"],
      atk: -2,
      def: 0,
      note: "Enclosed. Nothing enormous fits and nothing airborne gets off the ground.",
    },
    breakthrough: -1,
  },
  {
    words: ["open field", "plain", "steppe", "desert", "dunes", "moor", "flat ground", "wide open", "arena floor"],
    rule: {
      traits: ["large", "giant", "dragon"],
      atk: 1,
      def: 1,
      note: "Open ground with nowhere to hide. Room to build up speed and room to be seen doing it.",
    },
    breakthrough: 2,
  },
  {
    words: ["forest", "woods", "jungle", "godswood", "undergrowth", "thicket", "swamp", "marsh"],
    rule: {
      traits: ["infantry"],
      atk: 1,
      def: 1,
      note:
        "Broken ground and cover everywhere. Anyone quick and on foot can pick their moment; " +
        "anything huge is announcing itself with every step.",
    },
    breakthrough: -1,
  },
  {
    words: ["at night", "dark", "pitch black", "no light", "blackout", "moonless"],
    rule: {
      traits: ["infantry"],
      atk: 1,
      def: 0,
      note: "Dark. Favours whoever is willing to be somewhere they cannot be seen.",
    },
  },
  {
    words: ["frozen", "ice", "snow", "blizzard", "the wall", "tundra", "glacier"],
    rule: {
      traits: ["sluggish", "large"],
      atk: -1,
      def: 0,
      note: "Ice underfoot. Anything heavy and slow is fighting the ground as well as the enemy.",
    },
  },
  {
    words: ["fire", "burning", "lava", "volcanic", "ash", "inferno", "the pit"],
    rule: {
      traits: ["dragon"],
      atk: 1,
      def: 2,
      note: "Everything is on fire, which is a problem for most things and a homecoming for a few.",
    },
    breakthrough: 1,
  },
  {
    words: ["ruins", "rubble", "city", "streets", "rooftops", "market", "castle", "keep", "fortress"],
    rule: {
      traits: ["infantry"],
      atk: 0,
      def: 1,
      note: "Walls, corners and rooftops. Cover for anyone small enough to use it.",
    },
    breakthrough: -1,
  },
];

const hasAny = (hay: string, words: string[]) => words.some((w) => hay.includes(w));

/**
 * Read an arena into rules.
 *
 * Returns terrain with no rules rather than null when nothing matches, so the
 * caller never has to branch — a featureless arena is simply one that does not
 * change anything, which is a perfectly good arena.
 */
export function terrainFor(name: string, desc?: string | null): Terrain {
  const hay = `${name} ${desc ?? ""}`.toLowerCase();
  const rules: TerrainRule[] = [];
  let breakthrough = 0;
  let planeCap: Plane | undefined;

  for (const g of GROUNDS) {
    if (!hasAny(hay, g.words)) continue;
    if (g.rule) rules.push(g.rule);
    breakthrough += g.breakthrough ?? 0;
    // The lowest ceiling wins — two things suppressing the room do not cancel.
    if (g.planeCap && (planeCap === undefined || g.planeCap < planeCap)) planeCap = g.planeCap;
  }

  // Two grounds that both push the cap the same way is still one fight. Clamp
  // it so a florid arena description cannot quietly double the game's rail.
  return { name, rules, planeCap, breakthrough: Math.max(-2, Math.min(2, breakthrough)) };
}

/** What this ground does to one card, as a flat swing on its stats. */
export function terrainSwing(
  terrain: Terrain | null | undefined,
  traits: Trait[]
): { atk: number; def: number; notes: string[] } {
  if (!terrain) return { atk: 0, def: 0, notes: [] };
  let atk = 0;
  let def = 0;
  const notes: string[] = [];
  for (const r of terrain.rules) {
    if (!r.traits.some((t) => traits.includes(t))) continue;
    atk += r.atk;
    def += r.def;
    notes.push(r.note);
  }
  return { atk, def, notes };
}

/** The arena rendered for the judge, so its prose agrees with the rules. */
export function terrainBriefing(terrain: Terrain | null | undefined): string {
  if (!terrain || (!terrain.rules.length && !terrain.planeCap)) return "";
  const lines = terrain.rules.map((r) => `  - ${r.note}`);
  if (terrain.planeCap) {
    lines.push(
      `  - Every card here fights at plane ${terrain.planeCap} or below, whatever they are ` +
        `elsewhere. Nobody is out of anybody's reach in this room.`
    );
  }
  return (
    `THE GROUND — ${terrain.name}. These are rules the battle already applied, not ` +
    `atmosphere for you to weigh:\n${lines.join("\n")}\n`
  );
}
