/**
 * DraftMasters — what a card IS, in numbers.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE: price never touches power.
 *
 * The draft tier is a price. It is what a pick should cost at auction, and it
 * is set by what buyers will pay — scarcity, hype, how badly you need a body
 * this round. An earlier version of this used the tier directly as the attack
 * stat, which is the same mistake as reading a footballer's wage off the
 * scoreboard: it squeezed every card in the game between 1/1 and 5/5, and it
 * put Meleys, a dragon, on exactly the same numbers as Jaime Lannister,
 * because the two of them happen to cost the same.
 *
 * Power comes from three things, none of which is money:
 *
 *   THE PLANE. Which weight class of reality the card fights in. This is the
 *   floor and the ceiling — a mortal is a mortal however beloved, and nothing
 *   on plane 1 is coming out of here with a twelve.
 *
 *   ITS STATURE. Within a plane, size and shape still separate things. A
 *   dragon is not a knight in a bigger jacket; it is harder to hurt and it
 *   hits like weather.
 *
 *   WHAT WE DECIDED. Some cards are simply known quantities and arguing them
 *   out of a formula is a waste of everyone's time. Vhagar is the largest
 *   living dragon in Westeros and is written down as such.
 *
 * THE SCALE IS NOT CAPPED AT TEN. Ten is roughly "the biggest thing a mortal
 * story has" — a grown dragon, a kaiju's little brother. Above that the
 * numbers keep going, because the planes above keep going, and a Titan that
 * had to fit under ten would be a Titan in name only.
 */
import type { Trait } from "./traits";
import type { Plane } from "./planes";

/**
 * The middle of each weight class, plane 1 to 7.
 *
 * The gaps widen going up on purpose. The distance from an ordinary person to
 * the world's best fighter is real but finite; the distance from a god to the
 * thing above a god is not the same size of step, and a linear scale flattens
 * exactly the difference the planes exist to express.
 */
export const PLANE_BASE: Record<Plane, number> = {
  1: 3,    // an ordinary person, or an ordinary animal
  2: 6,    // the ceiling of what a human body does
  3: 9,    // past what a body should do — magic, a monster, a dragon
  4: 13,   // fights that level a district
  5: 17,   // Titan
  6: 22,   // the ones the story stops being able to measure
  7: 28,   // above that
};

/**
 * How stature bends the two halves apart.
 *
 * Attack and defence are not the same question. Something enormous is mostly
 * a defensive problem — you cannot get through it — while its offence is one
 * terrible event rather than a flurry. So the big traits give more defence
 * than attack, which is why a dragon reads 10/12 and not 12/10.
 */
const LEAN: Partial<Record<Trait, { atk: number; def: number }>> = {
  dragon:   { atk: 1, def: 3 },
  giant:    { atk: 1, def: 3 },
  large:    { atk: 0, def: 2 },
  sluggish: { atk: -1, def: 2 },
  flying:   { atk: 1, def: 0 },
};

/**
 * Cards written down rather than worked out.
 *
 * Keyed by a lowercase fragment of the name, matched the same generous way
 * traits are. Two numbers: attack, defence, final — no plane base, no lean,
 * no arithmetic. Use it for the handful per board where the derivation gets a
 * famous answer wrong, not as a place to put every card.
 */
const WRITTEN: [string, [number, number]][] = [
  // ── The dragons of Westeros, largest to smallest ──────────────────────
  // Size is the whole story with these and it does not track anything else:
  // Vhagar is old enough to have outgrown every other dragon alive, and no
  // formula reading traits off a name is going to know that.
  ["balerion", [14, 18]],      // the Black Dread, largest ever flown
  ["vhagar", [11, 14]],
  ["drogon", [11, 13]],
  ["caraxes", [10, 12]],
  ["meleys", [10, 12]],
  ["vermithor", [10, 13]],
  ["sunfyre", [9, 11]],
  ["seasmoke", [9, 11]],
  ["viserion", [9, 11]],
  ["rhaegal", [9, 11]],
  ["syrax", [8, 10]],
  ["arrax", [6, 8]],           // a boy's dragon, and it shows
  ["tessarion", [7, 9]],
  ["moondancer", [6, 8]],
  ["ice dragon", [12, 15]],    // Viserion raised, whatever it is now

  // ── People who are not what their reputation says ─────────────────────
  // The formula reads plane and size. It cannot read "brilliant but frail",
  // and these are cards whose whole point is the gap between the two.
  ["olenna tyrell", [1, 4]],
  ["tyrion lannister", [2, 5]],
  ["varys", [1, 4]],
  ["littlefinger", [2, 4]],
  ["petyr baelish", [2, 4]],
  ["samwell tarly", [2, 4]],
  ["bran stark", [1, 5]],
  ["qyburn", [1, 4]],
  ["hercule", [4, 4]],         // plane 2 and proud of it — see planes.ts
  ["bulma", [1, 3]],
];

/** Longest key first, so "ice dragon" beats "dragon". */
const WRITTEN_SORTED = [...WRITTEN].sort((a, b) => b[0].length - a[0].length);

/**
 * A variant is a condition, not a price tag.
 *
 * Grades exist to move the auction value, but the reason they move it is that
 * the card genuinely changed: a one-handed Jaime is a worse swordsman, a
 * prime Drogo is a better one. So the grade's shape is allowed in here — what
 * is NOT allowed is the tier it produced, which has the market's fingerprints
 * on it. Deliberately gentler than GRADE_DELTA: a crippling condition should
 * hurt, not delete.
 */
const GRADE_POWER: Record<string, number> = {
  crippling: -3,
  weakening: -1,
  neutral: 0,
  boon: 1,
  major: 2,
  legendary: 3,
  exalted: 4,
  mythic: 5,
  uber: 7,
};

export interface PowerInput {
  name: string;
  variant?: string | null;
  plane: Plane;
  traits: Trait[];
  /** The variant's grade, if it rolled one. Its shape counts; its price does not. */
  grade?: string | null;
  /**
   * True when the grade already lifted this card's PLANE.
   *
   * A big variant is paid for once. "Jaime Lannister (two hands)" moves him up
   * a weight class, which is the whole of what being at his best means; adding
   * the grade bonus on top of the plane it just bought made him an 18/18 who
   * levels city blocks.
   */
  planeAlreadyPaid?: boolean;
}

/** Attack and defence for a card. Never a function of what it cost. */
export function powerOf(
  { name, variant, plane, traits, grade, planeAlreadyPaid }: PowerInput
): { atk: number; def: number } {
  const hay = `${name} ${variant ?? ""}`.toLowerCase();
  const written = WRITTEN_SORTED.find(([key]) => hay.includes(key));

  let atk: number;
  let def: number;

  if (written) {
    [atk, def] = written[1];
  } else {
    const base = PLANE_BASE[plane] ?? PLANE_BASE[1];
    atk = base;
    def = base;
    for (const t of traits) {
      const lean = LEAN[t];
      if (!lean) continue;
      atk += lean.atk;
      def += lean.def;
    }
  }

  // The condition it is in, applied to both halves. A written-down card still
  // feels its variant — a wounded Vhagar is a wounded Vhagar.
  const raw = grade ? (GRADE_POWER[grade] ?? 0) : 0;
  // A boon that bought a plane has already been spent. A wound never buys one,
  // so a crippling condition always lands here.
  const shift = planeAlreadyPaid && raw > 0 ? 0 : raw;
  atk += shift;
  def += shift;

  // Nothing drops out of the fight entirely: 0 attack is a card that cannot
  // ever matter, and Olenna at 1/4 is the point, not a bug.
  return { atk: Math.max(0, Math.round(atk)), def: Math.max(1, Math.round(def)) };
}
