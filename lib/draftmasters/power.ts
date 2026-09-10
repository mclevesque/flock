/**
 * DraftMasters — what a card IS, in numbers.
 *
 * A card is two numbers and its abilities. That is Magic's model: attack,
 * defence, and the text underneath that makes two cards with the same pair
 * behave completely differently.
 *
 * THREE RULES.
 *
 * PRICE NEVER TOUCHES POWER. The draft tier is what a pick COSTS at auction —
 * scarcity, hype, how badly you need a body this round. An earlier version
 * read the stat line straight off it, which is the same mistake as reading a
 * footballer's ability off their wage.
 *
 * THE CEILING IS HIGH AND THE FLOOR IS LOW. Magic tops out near 10 because
 * every card in Magic shares a world. These do not. Base Goku is a 15, Super
 * Saiyan 20, Super Saiyan 4 a 40. Obi-Wan is an 8 with very good abilities.
 * Game of Thrones has nothing in that range — its dragons stop at 14 and its
 * best swordsmen sit at 6 — and that is not a flaw in the board. It is the
 * answer to what happens when Westeros meets a Saiyan.
 *
 * THERE IS NO SEPARATE POWER TIER. Planes are gone. A 40/40 beats a 6/6
 * because it is a 40/40, and the interesting fights are decided by RUSHDOWN
 * and by abilities, not by a gate sitting on top of the arithmetic.
 */
import { hits, type Trait } from "./traits";
import { DBZ_POWER, DBZ_WRITTEN } from "./boards/dbz";

/**
 * What an ordinary member of this cast is worth, and what its very top is.
 *
 * Deliberately not normalised against each other. A board whose ceiling is 14
 * is a weaker board than one whose ceiling is 34, and drafting across both is
 * supposed to feel like that.
 */
export const BOARD_POWER: Record<string, [ordinary: number, top: number]> = {
  // ORDINARY means unremarkable — a household guard, a background ninja, a
  // Putty Patroller. Anyone the audience could name should be written down
  // ABOVE it, not sitting on it. The first pass set these too high and the
  // result was Naruto tying with the crowd he stands out from.
  //
  // Mortal worlds
  got: [5, 14],
  animals: [3, 11],
  tvd: [5, 12],
  spn: [5, 15],
  horror: [4, 15],
  berserk: [6, 18],
  tmnt: [5, 11],
  ppg: [6, 14],
  sf: [6, 14],
  mk: [6, 16],
  rangers: [5, 14],
  cw: [4, 18],

  // Worlds with a ceiling well past a person
  starwars: [5, 20],
  lotr: [5, 20],
  bosses: [7, 20],
  yugioh: [5, 24],
  pokemon: [4, 25],
  xmen: [6, 24],
  greek: [5, 26],
  myth: [6, 26],
  smash: [6, 22],
  invincible: [6, 26],

  // The big ones
  marvel: [5, 30],
  dc: [5, 32],
  anime: [6, 30],
  godzilla: [16, 34],
  dbz: DBZ_POWER,
};

/** A board nobody has written a range for. Mortal-ish, room to move. */
export const DEFAULT_POWER: [number, number] = [6, 18];

/**
 * How stature bends the two halves apart.
 *
 * Attack and defence are not the same question. Something enormous is mostly
 * a defensive problem — you cannot get through it — while its offence is one
 * terrible event rather than a flurry. So the big traits give more defence
 * than attack, which is why a dragon reads 11/14 and not 14/11.
 */
const LEAN: Partial<Record<Trait, { atk: number; def: number }>> = {
  dragon: { atk: 0, def: 3 },
  giant: { atk: 0, def: 3 },
  large: { atk: 0, def: 2 },
  sluggish: { atk: -2, def: 2 },
  flying: { atk: 1, def: 0 },
};

/**
 * Cards written down rather than worked out.
 *
 * Keyed by a lowercase fragment, longest match wins. Two numbers, final. Use
 * it where a formula reading a name would get a famous answer wrong — which
 * is most of the cards anybody actually drafts for.
 */
const WRITTEN: [string, [number, number]][] = [
  // ── Dragon Ball ───────────────────────────────────────────────────────
  // The forms are the clearest statement of what this scale is for: one
  // character, five times over, an order of magnitude apart.
  ["ultra instinct", [45, 42]],
  ["super saiyan 4", [40, 40]],
  ["ssj4", [40, 40]],
  ["super saiyan blue", [32, 30]],
  ["super saiyan 3", [28, 26]],
  ["super saiyan 2", [24, 23]],
  ["super saiyan", [20, 20]],
  ["goku", [15, 15]],
  ["vegeta", [14, 14]],
  ["gohan", [13, 13]],
  ["piccolo", [11, 12]],
  ["frieza", [18, 17]],
  ["cell", [17, 17]],
  ["majin buu", [19, 18]],
  ["beerus", [38, 36]],
  ["whis", [42, 40]],
  ["krillin", [6, 6]],
  ["yamcha", [4, 5]],
  ["master roshi", [7, 7]],
  // Peak human and the reigning champion of a tournament full of them. He is
  // only a punchline against ki users, and that joke does not need him to
  // lose to a knight.
  ["hercule", [7, 8]],
  ["mr. satan", [7, 8]],
  ["bulma", [1, 2]],

  // ── Shinobi ───────────────────────────────────────────────────────────
  // Naruto is a 9 in base form and Goku is a 15, which is the gap it should
  // be: both are the hero of their world, and only one of them fights gods.
  ["naruto uzumaki", [9, 9]],
  ["naruto", [9, 9]],
  ["sasuke", [9, 9]],
  ["kakashi", [8, 8]],
  ["itachi", [10, 8]],
  ["minato", [11, 9]],
  ["madara", [14, 13]],
  ["pain", [13, 12]],
  ["nagato", [13, 12]],
  ["gaara", [8, 11]],
  ["rock lee", [8, 6]],
  ["hinata", [6, 6]],
  ["jiraiya", [10, 10]],
  ["orochimaru", [10, 11]],

  // ── Rangers ───────────────────────────────────────────────────────────
  // The strongest Ranger, and it still only buys him an 8 — the board's
  // ceiling belongs to the Zords, not to anyone wearing a suit.
  ["green ranger", [8, 8]],
  ["tommy oliver", [8, 8]],
  ["white ranger", [8, 8]],
  ["lord zedd", [11, 10]],
  ["rita repulsa", [8, 8]],
  ["goldar", [8, 9]],
  ["a putty patroller", [2, 3]],
  ["bulk and skull", [1, 2]],

  // ── Star Wars ─────────────────────────────────────────────────────────
  ["darth vader", [11, 12]],   // mythic takes him to 19/21, which is where he belongs
  ["obi-wan", [8, 9]],
  ["obi wan", [8, 9]],
  ["yoda", [13, 10]],
  ["palpatine", [15, 12]],
  ["darth sidious", [15, 12]],
  ["luke skywalker", [12, 11]],
  ["anakin skywalker", [12, 11]],
  ["darth maul", [10, 9]],
  ["mace windu", [10, 9]],
  ["han solo", [5, 6]],
  ["chewbacca", [7, 8]],
  ["boba fett", [6, 7]],
  ["jar jar", [1, 2]],
  ["ewok", [2, 3]],

  // ── The dragons of Westeros, largest to smallest ──────────────────────
  // Size is the whole story here and it tracks nothing else: Vhagar is old
  // enough to have outgrown every other dragon alive.
  ["balerion", [14, 18]],
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
  ["arrax", [6, 8]],
  ["tessarion", [7, 9]],
  ["moondancer", [6, 8]],
  ["ice dragon", [12, 15]],
  ["night king", [12, 14]],

  // ── Westeros, the ones worth naming ───────────────────────────────────
  // Everybody unwritten sits at the board's ordinary 5, which is right for a
  // household guard and wrong for the people the show is about.
  ["arthur dayne", [9, 7]],
  ["the hound", [7, 9]],
  ["sandor clegane", [7, 9]],
  ["khal drogo", [8, 7]],
  ["jaime lannister", [7, 7]],
  ["brienne of tarth", [7, 8]],
  ["barristan selmy", [8, 7]],
  ["oberyn martell", [8, 5]],
  ["syrio forel", [7, 5]],
  ["jon snow", [7, 7]],
  ["daemon targaryen", [8, 7]],
  ["criston cole", [6, 6]],
  ["aemond", [7, 6]],
  ["arya stark", [6, 5]],
  ["robert baratheon", [7, 6]],
  ["eddard stark", [6, 6]],
  ["grey worm", [6, 6]],
  ["tormund", [6, 7]],
  ["euron greyjoy", [7, 6]],
  ["beric dondarrion", [6, 6]],
  ["wun wun", [9, 10]],
  ["white walker", [7, 8]],

  // ── Speedsters and other DC/Marvel names the ordinary would insult ────
  ["the flash", [10, 8]],
  ["barry allen", [10, 8]],
  ["superman", [28, 28]],
  ["batman", [8, 9]],
  ["wonder woman", [22, 22]],
  ["darkseid", [30, 30]],
  ["doomsday", [28, 26]],
  ["hulk", [26, 28]],
  ["thor", [24, 23]],
  ["thanos", [27, 27]],
  ["iron man", [16, 18]],
  ["captain america", [11, 14]],
  ["spider-man", [14, 12]],
  ["wolverine", [11, 16]],
  ["aunt may", [1, 2]],

  // ── People who are not what their reputation says ─────────────────────
  ["olenna tyrell", [1, 4]],
  ["tyrion lannister", [2, 5]],
  ["varys", [1, 4]],
  ["littlefinger", [2, 4]],
  ["petyr baelish", [2, 4]],
  ["samwell tarly", [2, 4]],
  ["bran stark", [1, 5]],
  ["qyburn", [1, 4]],
  ["the mountain", [8, 11]],
  ["gregor clegane", [8, 11]],

  // ── Middle-earth ──────────────────────────────────────────────────────
  // Everybody unwritten was landing on the board's ordinary 5, which is a
  // Gondorian foot soldier and not any of these.
  // A Maia, the same order of being as a Balrog or Sauron -- and he killed one
  // of the former. He sits above the greatest of the elves, who died to them.
  ["gandalf", [16, 14]],
  ["saruman", [12, 11]],
  ["the witch-king", [12, 12]],
  ["witch king", [12, 12]],
  ["balrog", [16, 15]],
  ["sauron", [18, 17]],
  ["glorfindel", [11, 10]],
  ["elrond", [10, 10]],
  ["galadriel", [12, 11]],
  ["aragorn", [9, 9]],
  ["legolas", [8, 7]],
  ["gimli", [8, 8]],
  ["boromir", [7, 7]],
  ["faramir", [6, 6]],
  ["eowyn", [7, 6]],
  ["theoden", [6, 6]],
  ["treebeard", [12, 16]],
  ["shelob", [10, 12]],
  ["gollum", [3, 4]],
  ["frodo", [2, 4]],
  ["samwise", [4, 6]],
  ["sam gamgee", [4, 6]],
  ["merry", [3, 4]],
  ["pippin", [3, 4]],
  ["bilbo", [2, 4]],
  ["tom bombadil", [20, 20]],

  // The First Age, which was missing entirely -- so every one of these was
  // landing on the board's ordinary 5 and rating BELOW Gregor Clegane. A
  // player watched exactly that happen and it is the reason the bands exist.
  ["feanor", [15, 13]],           // fought Balrogs; it took several to end him
  ["f\u00ebanor", [15, 13]],
  ["fingolfin", [16, 14]],        // wounded Morgoth seven times, alone
  ["morgoth", [22, 21]],          // Sauron's master, and above him
  ["melkor", [22, 21]],
  ["ungoliant", [18, 17]],
  ["luthien", [15, 14]],          // sang Morgoth himself to sleep
  ["l\u00fathien", [15, 14]],
  ["beren", [8, 8]],
  ["turin", [10, 9]],
  ["t\u00farin", [10, 9]],
  ["earendil", [14, 13]],
  ["e\u00e4rendil", [14, 13]],
  ["gil-galad", [13, 12]],
  ["celeborn", [9, 9]],
  ["thranduil", [9, 9]],
  ["thingol", [11, 10]],
  ["ancalagon", [24, 22]],        // the largest dragon that ever flew
  ["glaurung", [17, 16]],
  ["smaug", [15, 15]],
  ["gothmog", [17, 16]],          // lord of Balrogs

  // A baker. He was rating "a serious, capable fighter" on the board floor.
  ["hot pie", [2, 3]],

  // ── Kaiju are big and strong, which is the point of them ──────────────
  ["king ghidorah", [32, 30]],
  ["mechagodzilla", [28, 30]],
  ["godzilla", [30, 32]],
  ["king kong", [24, 26]],
  ["mothra", [20, 24]],
  ["rodan", [22, 20]],
];

// The board's own table goes AFTER the global one, so a line written by hand
// here still wins over the board file's convenience copy of it.
const WRITTEN_SORTED = [...WRITTEN, ...DBZ_WRITTEN].sort((a, b) => b[0].length - a[0].length);

/**
 * A variant is a condition, not a price tag.
 *
 * Grades exist to move the auction value, but the REASON they move it is that
 * the card genuinely changed — a one-handed Jaime is a worse swordsman, a
 * prime Drogo a better one. So the grade's shape is allowed in here; the tier
 * it produced is not, because that has the market's fingerprints on it.
 *
 * Multiplicative rather than flat, because a board is no longer a fixed
 * scale: +5 is a transformation on Game of Thrones and a rounding error on
 * the Godzilla board.
 */
const GRADE_FACTOR: Record<string, number> = {
  crippling: 0.55,
  weakening: 0.8,
  neutral: 1,
  boon: 1.12,
  major: 1.25,
  legendary: 1.4,
  exalted: 1.55,
  mythic: 1.75,
  uber: 2.2,
};

export interface PowerInput {
  name: string;
  variant?: string | null;
  /** The board this card is really from — for a mix, its own board. */
  board?: string;
  traits: Trait[];
  /** The variant's grade, if it rolled one. Its shape counts; its price does not. */
  grade?: string | null;
}

/**
 * The same power, in words, for whoever writes the battle.
 *
 * The story is told by a model, and a model asked to judge "Gandalf without
 * his staff against Gregor Clegane" reaches for what the characters LOOK like:
 * an old man with no weapon against an enormous knight. It gets that wrong
 * every time, and no amount of prose in the brief has moved it -- a player
 * watched five Westerosi soldiers beat Tom Bombadil, Galadriel and Feanor.
 *
 * These bands are the answer, because the numbers behind them already know:
 * Bombadil is a 20, Gandalf a 14, Gregor an 8. Handing over a BAND rather than
 * a number keeps the promise that no stat line ever reaches the screen, while
 * giving the fight an ordering it cannot talk itself out of.
 *
 * Read off ATK because that is what settles a fight; the variant and grade
 * have already been applied by the time this sees it, so a diminished Gandalf
 * really does land a band lower.
 *
 * THE TOP NEEDS AS MANY BANDS AS THE BOTTOM. The first version stopped at
 * "30 and above", which put Vados on 43 in the same band as Golden Frieza on
 * 30 -- and a same-band fight is an open one, so Frieza killed an Angel. A
 * scale that runs to 55 cannot have its last band be a quarter of the range.
 */
export function bandOf(atk: number): string {
  if (atk >= 41) return "ABOVE THE STORY — the fight is not a fight";
  if (atk >= 33) return "BEYOND MEASURE — reality bends around them";
  if (atk >= 26) return "WORLD-ENDING — a planet is the unit of damage";
  if (atk >= 20) return "WORLD-SHAPING — a power the world itself answers to";
  if (atk >= 15) return "FAR BEYOND MORTAL — armies are not the right unit";
  if (atk >= 11) return "MYTHIC — greater than any mortal, short of a god";
  if (atk >= 8) return "PEERLESS MORTAL — the best a mortal ever gets";
  if (atk >= 5) return "DANGEROUS — a serious, capable fighter";
  return "ORDINARY — a person";
}

/** Attack and defence. Never a function of what the card cost. */
export function powerOf({ name, variant, board, traits, grade }: PowerInput): { atk: number; def: number } {
  const hay = `${name} ${variant ?? ""}`.toLowerCase();
  const vary = (variant ?? "").toLowerCase();
  const written = WRITTEN_SORTED.find(([key]) => hits(hay, key));

  // Did the written line match the FORM rather than the character? If so it
  // already describes the transformed card and the grade must not apply on
  // top of it — that is what turned Super Saiyan 4 Goku into an 88/88.
  const formIsWritten = !!written && vary.length > 0 && vary.includes(written[0]);

  let atk: number;
  let def: number;

  if (written) {
    [atk, def] = written[1];
  } else {
    const [ordinary, top] = (board ? BOARD_POWER[board] : undefined) ?? DEFAULT_POWER;
    // Something enormous is at the top of its world. Everybody else is an
    // ordinary member of the cast until somebody writes them down.
    const big = traits.includes("dragon") || traits.includes("giant") || traits.includes("large");
    const base = big ? top : ordinary;
    atk = base;
    def = base;
    for (const t of traits) {
      const lean = LEAN[t];
      if (!lean) continue;
      atk += lean.atk;
      def += lean.def;
    }
  }

  const factor = grade && !formIsWritten ? (GRADE_FACTOR[grade] ?? 1) : 1;
  atk *= factor;
  def *= factor;

  // Nothing drops out of the fight entirely: 0 attack is a card that can never
  // matter, and Olenna at 1/4 is the point rather than a bug.
  return { atk: Math.max(0, Math.round(atk)), def: Math.max(1, Math.round(def)) };
}
