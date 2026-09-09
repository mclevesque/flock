/**
 * DraftMasters — Dragon Ball Z.
 *
 * This board exists to break the price/power link harder than any other. Every
 * franchise has a gap between what a name costs and what it does; Dragon Ball
 * has a chasm, because thirty years of power creep left a cast where the most
 * beloved faces on the board — Krillin, Yamcha, Mr. Satan — are objectively
 * furniture, and the cast's actual ceiling belongs to a butler nobody drafts.
 *
 * So `t` here is a MARKET PRICE and it is wrong on purpose. Mr. Satan is a 3
 * with a 2/3 stat line, because people bid on him. Vados is a 3 with a 43/41
 * line, because people don't. That divergence is the whole game and the tiers
 * below should be read as "what a room full of fans would pay", never as a
 * power ranking.
 *
 * ── Where the ceiling actually is ──────────────────────────────────────────
 *
 * Base Goku is 15 and the board goes to the high forties, which makes Dragon
 * Ball the second-heaviest board in the game after Godzilla — but only at the
 * top. The ordinary is 6, lower than Westeros, because the joke tier is not a
 * weak fighter, it is a man in a suit who has never landed a punch. A board
 * whose floor is Oolong and whose roof is Ultra Instinct is the correct shape
 * for this franchise, and BOARD_POWER was set at [6, 45] to say exactly that.
 *
 * ── Rushdown is the board's identity ───────────────────────────────────────
 *
 * On most boards, rushdown 0 is the default and a speedster is a luxury pick.
 * Here it inverts: almost every fighter has some, because the defining visual
 * of the franchise is the person who was standing there a moment ago. That
 * makes the zeroes meaningful in the other direction — drafting Mr. Satan is
 * drafting someone who takes the blow before he throws one, forever.
 */
import type { Pack } from "../packs";

/**
 * Ordinary and top, for BOARD_POWER.
 *
 * The ordinary is deliberately the lowest of any non-animal board. It has to
 * cover the unwritten background of this cast — a Frieza Force grunt, a
 * spectator at the World Tournament — and the alternative, pinning it around
 * a Krillin at 6, would have quietly promoted every nameless soldier to the
 * level of a Z-fighter who has fought Frieza.
 */
export const DBZ_POWER: [number, number] = [6, 45];

/**
 * Explicit ATK/DEF, keyed by lowercase fragment, longest match wins.
 *
 * The anchors at the top of this table restate lines that already exist in
 * power.ts. That duplication is intentional: the numbers are the calibration
 * for everything below them, and a reader working out why Kale is a 26 should
 * not have to open another file to learn that base Goku is a 15. If either
 * copy ever moves, both move.
 *
 * Three things about keys, all learned the hard way from the way powerOf
 * resolves them:
 *
 * A NAMED FORM NEEDS A KEY LONGER THAN THE CHARACTER'S OWN. "Golden Frieza"
 * contains "frieza", so without its own line the lookup finds the base entry
 * and — because the variant text contains the matched key — treats it as an
 * already-transformed card and refuses to apply the grade. Golden Frieza came
 * out at 18/17, identical to the first form. Every named transformation below
 * therefore has an explicit line, and "imperfect cell" has one purely because
 * it contains "perfect cell" and would otherwise read as the upgrade.
 *
 * A CONDITION MUST NOT NAME ITS OWN CHARACTER. The mirror of the same rule:
 * a variant written as "Frieza, first form" would suppress its own crippling
 * grade. So the conditions below are phrased around the character rather than
 * with them — "the one with the chair", not "Frieza in the chair" — and the
 * grade multiplier does the work, which is what it is for.
 *
 * A SHORT KEY IS A LANDMINE IN A GLOBAL TABLE. This table gets merged into the
 * one in power.ts, which every board is looked up in, and four names here are
 * short enough to appear inside cards that have nothing to do with Dragon Ball.
 * "hit" is a substring of "down to its last hit point" and would have handed
 * roughly forty wounded Pokémon a Universe 6 assassin's stat line. "nail" sits
 * inside Talos's "the nail is out and the ichor is running" — and worse than
 * the wrong numbers, the match would have read as a written FORM and cancelled
 * Talos's crippling grade outright. "frost" reaches Emma Frost and Killer
 * Frost; "pan" reaches the Inland Taipan and the Greek god of the same name;
 * and "tien" — the one that took longest to spot — lives inside "patience".
 *
 * The fix is in the card names rather than here, because there is nowhere to
 * put a word boundary: Hit is drafted as "Hit the Assassin", Nail as "Nail of
 * Namek", Frost as "Frost of Universe 6" and Pan as "Pan (GT)"; Tien only
 * needed his surname, which he has. Trailing a
 * space onto the key was tried first and only half works — it saves "launch "
 * from "launched", which is why that one line still carries one, and does
 * nothing at all for "hit ", which is followed by a space in the Pokémon text
 * too. Portraits are unaffected; they resolve through `s`, not `n`.
 */
export const DBZ_WRITTEN: [string, [number, number]][] = [
  // ── The anchors, copied from power.ts ─────────────────────────────────
  ["ultra instinct", [45, 42]],
  ["super saiyan 4", [40, 40]],
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
  ["hercule", [2, 3]],
  ["mr. satan", [2, 3]],
  ["bulma", [1, 2]],

  // ── Named transformations ─────────────────────────────────────────────
  ["super saiyan rosé", [34, 32]],
  ["super saiyan rose", [34, 32]],
  ["legendary super saiyan", [34, 33]],
  ["super saiyan rage", [30, 28]],
  ["ultimate gohan", [30, 28]],
  ["majin vegeta", [26, 24]],
  ["orange piccolo", [30, 28]],
  ["golden frieza", [30, 28]],
  ["metal cooler", [30, 28]],
  ["super perfect cell", [30, 28]],
  ["imperfect cell", [12, 12]],
  ["perfect cell", [26, 25]],
  ["fused zamasu", [34, 33]],
  ["vegito blue", [46, 44]],
  ["super vegito", [40, 38]],
  ["gogeta blue", [46, 44]],
  // The Great Saiyaman is a 10 and that is not a joke about the costume: the
  // suppression is the point of the gag, and a card that reads as full-power
  // Gohan in a helmet would kill the only thing the variant is for.
  ["great saiyaman", [10, 10]],

  // ── Fusions and the Saiyans ───────────────────────────────────────────
  ["vegito", [38, 36]],
  ["gogeta", [30, 29]],
  ["gotenks", [20, 19]],
  ["future trunks", [16, 15]],
  ["trunks", [13, 13]],
  ["goten", [10, 10]],
  ["broly", [30, 28]],
  ["turles", [16, 15]],
  ["bardock", [16, 15]],
  ["raditz", [11, 11]],
  ["nappa", [12, 13]],
  ["king vegeta", [12, 12]],
  ["paragus", [7, 7]],
  ["kale", [26, 24]],
  ["caulifla", [18, 17]],
  ["cabba", [14, 13]],
  ["goku black", [30, 28]],
  ["zamasu", [24, 23]],
  ["uub", [22, 21]],
  ["great ape", [26, 26]],
  ["grandpa gohan", [8, 8]],
  ["pan (gt", [10, 9]],

  // ── Humans, and the tier the franchise forgot ─────────────────────────
  // Tien at 10 is the highest a pure human gets and it is still below Raditz,
  // which is the entire tragedy of the Saiyan arc rendered as two numbers.
  ["tien shinhan", [10, 10]],
  ["chiaotzu", [5, 6]],
  ["videl", [5, 5]],
  ["yajirobe", [3, 4]],
  ["chi-chi", [4, 5]],
  ["mercenary tao", [6, 6]],
  ["oolong", [1, 2]],
  ["puar", [1, 2]],
  ["launch ", [2, 3]],
  ["fortuneteller baba", [2, 4]],
  ["korin", [3, 5]],
  ["mr. popo", [8, 9]],
  ["emperor pilaf", [1, 2]],
  ["android 18", [22, 21]],
  ["android 17", [22, 21]],
  ["android 16", [26, 28]],
  ["android 19", [10, 11]],
  ["android 13", [16, 15]],
  ["dr. gero", [8, 9]],
  ["cell jr", [9, 8]],

  // ── Namek ─────────────────────────────────────────────────────────────
  ["king piccolo", [13, 13]],
  ["lord slug", [16, 16]],
  ["nail of namek", [14, 14]],
  ["kami", [9, 10]],
  ["dende", [2, 4]],
  ["grand elder guru", [2, 5]],
  ["shenron", [4, 8]],
  ["porunga", [4, 8]],

  // ── The Frieza Force, in order of who Vegeta was rude to ──────────────
  ["cooler", [22, 21]],
  ["king cold", [20, 19]],
  ["ginyu", [14, 13]],
  ["zarbon", [12, 12]],
  ["dodoria", [11, 11]],
  ["recoome", [12, 14]],
  ["burter", [11, 10]],
  ["jeice", [11, 10]],
  ["guldo", [5, 6]],
  ["sorbet", [4, 5]],
  ["saibaman", [5, 5]],
  ["appule", [4, 5]],

  // ── Buu saga ──────────────────────────────────────────────────────────
  ["dabura", [16, 15]],
  ["supreme kai", [15, 16]],
  ["kibito", [10, 11]],
  ["old kai", [3, 6]],
  ["king kai", [4, 7]],
  ["babidi", [3, 5]],
  ["spopovich", [6, 7]],
  ["pui pui", [5, 6]],
  ["yakon", [7, 8]],

  // ── Universe survival ─────────────────────────────────────────────────
  // Jiren tops out at 34, which reads low until you apply his own major grade
  // and land on 43 — a shade under Whis and a shade under Ultra Instinct's 45.
  // Written at 40 he beat the form that was written to beat him.
  ["jiren", [34, 34]],
  ["toppo", [32, 32]],
  ["dyspo", [24, 22]],
  ["kefla", [28, 26]],
  ["frost of universe", [16, 15]],
  ["ribrianne", [12, 13]],
  ["champa", [34, 33]],
  ["vados", [43, 41]],
  ["grand priest", [50, 48]],
  ["zeno", [55, 50]],
  ["hit the assassin", [30, 28]],

  // ── Films ─────────────────────────────────────────────────────────────
  ["bojack", [22, 21]],
  ["janemba", [30, 28]],
  ["garlic jr", [12, 14]],
];

/**
 * Rushdown, keyed the same way.
 *
 * The distribution is upside down compared to every other board. Ten of the
 * hundred are zero and the bulk sits between 5 and 7. That is not generosity,
 * it is the franchise — a fight where neither side can see the other move is
 * the normal case here, and a table full of zeroes would mean every Dragon
 * Ball card traded blows like two knights in a field.
 *
 * The zeroes are therefore doing real work. Mr. Satan, Oolong, Pilaf and
 * Babidi are 0 against a board where nearly everyone is 5 or better, which
 * means they eat a free hit in essentially every exchange they are in. That
 * is the correct outcome and it is why they are cheap to nobody.
 */
export const DBZ_RUSH: [string, number][] = [
  // ── The anchors, copied from rush.ts ──────────────────────────────────
  ["ultra instinct", 11],
  ["super saiyan 4", 10],
  ["super saiyan blue", 10],
  ["super saiyan 3", 9],
  ["super saiyan 2", 9],
  ["super saiyan", 8],
  ["goku", 8],
  ["vegeta", 8],
  ["gohan", 7],
  ["piccolo", 6],
  ["frieza", 8],
  ["cell", 7],
  ["majin buu", 6],
  ["trunks", 7],
  ["krillin", 4],
  ["tien shinhan", 5],
  ["yamcha", 3],
  ["master roshi", 3],
  ["hercule", 0],
  ["mr. satan", 0],
  ["bulma", 0],
  ["beerus", 10],
  ["whis", 11],

  // ── Above the anchors ─────────────────────────────────────────────────
  // Dyspo is faster than Jiren and loses to him anyway, which is exactly the
  // shape rushdown was built for: going first is not the same as winning.
  ["grand priest", 12],
  ["zeno", 12],
  ["vados", 11],
  ["dyspo", 10],
  ["vegito", 9],
  ["gogeta", 9],
  ["jiren", 9],
  ["champa", 9],
  ["golden frieza", 9],
  ["hit the assassin", 9],
  ["goku black", 8],
  ["broly", 8],
  ["janemba", 8],
  ["kefla", 8],
  ["kale", 7],
  ["caulifla", 7],
  ["zamasu", 7],
  ["toppo", 7],
  ["uub", 7],
  ["gotenks", 7],
  ["future trunks", 7],
  ["android 17", 7],
  ["android 18", 7],
  ["bojack", 7],

  // ── The middle, which is most of the board ────────────────────────────
  ["bardock", 6],
  ["turles", 6],
  ["cooler", 8],
  ["lord slug", 6],
  ["cell jr", 6],
  ["burter", 6],
  ["jeice", 6],
  ["ginyu", 6],
  ["supreme kai", 6],
  ["dabura", 5],
  ["king piccolo", 5],
  ["nail of namek", 5],
  ["raditz", 5],
  ["king vegeta", 5],
  ["cabba", 5],
  ["goten", 5],
  ["zarbon", 5],
  ["king cold", 6],
  ["android 13", 5],
  ["android 16", 5],
  ["frost of universe", 5],
  ["kami", 4],
  ["nappa", 4],
  ["dodoria", 4],
  ["recoome", 4],
  ["garlic jr", 4],
  ["mercenary tao", 4],
  ["kibito", 4],
  ["korin", 3],
  ["guldo", 3],
  ["saibaman", 3],
  ["android 19", 3],
  ["dr. gero", 3],
  ["great ape", 3],
  ["ribrianne", 3],
  ["chiaotzu", 2],
  ["videl", 2],
  ["chi-chi", 2],
  ["mr. popo", 2],
  ["grandpa gohan", 2],
  ["pan (gt", 5],
  ["paragus", 2],
  ["appule", 2],
  ["spopovich", 2],
  ["pui pui", 2],
  ["yakon", 2],
  ["sorbet", 1],
  ["yajirobe", 1],
  ["launch ", 1],
  ["puar", 1],
  ["dende", 1],
  ["king kai", 1],

  // ── The zeroes ────────────────────────────────────────────────────────
  ["oolong", 0],
  ["emperor pilaf", 0],
  ["fortuneteller baba", 0],
  ["grand elder guru", 0],
  ["old kai", 0],
  ["babidi", 0],
  ["shenron", 0],
  ["porunga", 0],
];

export const DBZ_BOARD: Pack = {
  id: "dbz",
  name: "Dragon Ball Z",
  emoji: "🐉",
  blurb: "Everyone is a god now. Some of them are still worth what you paid.",
  imgContext: "Dragon Ball Z character",
  wiki: "dragonball",
  format: "duel-series",
  scenario:
    "A tournament ring on a rock over nothing, one-on-one, no time limit and no ring-out. Both teams enter everyone they drafted. Nobody is dead until the fight is over, and nobody is coming back afterwards either — there are no Dragon Balls in this one.",
  criteria:
    "Speed first, then output. Almost everyone here can destroy a planet or nothing at all, so the question is who lands the first exchange and whether the other one is still standing to answer it. Transformations count only if the card says they have one.",
  arenas: [
    { name: "A tournament ring over open sky", desc: "A flat rock, a long drop, and a crowd who will not be able to follow any of it.", weight: 10 },
    { name: "Namek, with five minutes left", desc: "The ground is coming apart and the sky is going white. Whoever needs time does not have it.", weight: 4 },
    { name: "The Hyperbolic Time Chamber", desc: "Blank white nothing, crushing gravity, and no way out for either of them.", weight: 3 },
    { name: "A populated city, midday", desc: "Collateral everywhere. Anyone who cares about the people below is fighting with one hand.", weight: 3 },
    { name: "The World Martial Arts Tournament", desc: "A canvas ring, a referee, and rules nobody present has ever been able to obey.", weight: 2 },
  ],
  entries: [
    // ── Saiyans ─────────────────────────────────────────────────────────
    // Goku's three variants skip Super Saiyan 2 and Blue on purpose. Three
    // chips is the ceiling before a lot stops reading at a glance, so the
    // ladder here is one boon, one legendary and one mythic — a shape a player
    // can price — rather than six rungs of the same colour. Blue lives on
    // Vegeta and Super Saiyan 4 on the GT card, which also gives those two
    // cards a reason to exist next to this one.
    {
      n: "Goku",
      t: 5,
      f: 5,
      s: "Dragon Ball Z Goku",
      variants: [
        { v: "Super Saiyan", g: "boon" },
        { v: "Super Saiyan 3", g: "legendary" },
        { v: "Ultra Instinct", g: "mythic" },
      ],
    },
    {
      n: "Goku (GT)",
      t: 4,
      s: "Dragon Ball GT Goku",
      variants: [
        { v: "Super Saiyan 4", g: "mythic" },
        { v: "back in a child's body, and it shows", g: "weakening" },
      ],
    },
    {
      n: "Vegeta",
      t: 5,
      f: 5,
      s: "Dragon Ball Z Vegeta",
      variants: [
        { v: "Super Saiyan 2", g: "major" },
        { v: "Super Saiyan Blue", g: "legendary" },
        { v: "Majin Vegeta", g: "boon" },
      ],
    },
    // Priced at 5 on a 13/13 stat line, which is the single biggest overpay on
    // the board and completely correct. Nobody bidding on Gohan is bidding on
    // the man who fought Buu; they are bidding on eleven years old at the Cell
    // Games, and the legendary chip is the only place that exists.
    {
      n: "Gohan",
      t: 5,
      f: 5,
      s: "Dragon Ball Z Gohan",
      variants: [
        { v: "Super Saiyan 2, at the Cell Games", g: "legendary" },
        { v: "Ultimate Gohan", g: "exalted" },
        { v: "the Great Saiyaman", g: "crippling" },
      ],
    },
    {
      n: "Future Trunks",
      t: 4,
      f: 5,
      s: "Dragon Ball Z Future Trunks",
      variants: [
        { v: "Super Saiyan Rage", g: "legendary" },
        { v: "sword drawn, straight off the time machine", g: "boon" },
      ],
    },
    { n: "Trunks", t: 2, s: "Dragon Ball Z Trunks child" },
    { n: "Goten", t: 2, s: "Dragon Ball Z Goten" },
    {
      n: "Gotenks",
      t: 3,
      s: "Dragon Ball Z Gotenks",
      variants: [
        { v: "Super Saiyan 3", g: "legendary" },
        { v: "thirty minutes up, and the two of them fall apart", g: "crippling" },
      ],
    },
    {
      n: "Vegito",
      t: 5,
      s: "Dragon Ball Z Vegito",
      variants: [
        { v: "Vegito Blue", g: "exalted" },
        { v: "Super Vegito", g: "major" },
      ],
    },
    {
      n: "Gogeta",
      t: 5,
      s: "Dragon Ball Gogeta",
      variants: [
        { v: "Super Saiyan 4", g: "mythic" },
        { v: "Gogeta Blue", g: "exalted" },
      ],
    },
    { n: "Bardock", t: 4, f: 5, s: "Dragon Ball Z Bardock" },
    { n: "Raditz", t: 2, s: "Dragon Ball Z Raditz" },
    { n: "Nappa", t: 2, s: "Dragon Ball Z Nappa" },
    { n: "King Vegeta", t: 2, f: 1, s: "Dragon Ball Z King Vegeta" },
    { n: "Turles", t: 3, s: "Dragon Ball Z Turles" },
    {
      n: "Broly",
      t: 5,
      f: 5,
      s: "Dragon Ball Z Broly",
      variants: [
        { v: "Legendary Super Saiyan", g: "exalted" },
        { v: "the crown is still on and his father is still talking", g: "crippling" },
      ],
    },
    { n: "Paragus", t: 1, f: 1, s: "Dragon Ball Z Paragus" },
    {
      n: "Kale",
      t: 3,
      s: "Dragon Ball Super Kale",
      variants: [
        { v: "berserk, and aiming at nothing in particular", g: "major" },
        { v: "too shy to throw the first punch", g: "weakening" },
      ],
    },
    { n: "Caulifla", t: 3, s: "Dragon Ball Super Caulifla" },
    { n: "Cabba", t: 2, s: "Dragon Ball Super Cabba" },
    // A card the arena decides. Written at 26/26 with rushdown 3, so it is a
    // wall that arrives late — and the transformation needs a moon, which the
    // Hyperbolic Time Chamber does not have and the tournament rock does.
    {
      n: "Great Ape",
      t: 3,
      s: "Dragon Ball Z Great Ape Oozaru",
      variants: [
        { v: "a full moon and nobody nearby with a sword", g: "major" },
        { v: "the tail comes off", g: "crippling" },
      ],
    },
    {
      n: "Goku Black",
      t: 5,
      f: 5,
      s: "Dragon Ball Super Goku Black",
      variants: [
        { v: "Super Saiyan Rosé", g: "legendary" },
        { v: "still wearing the ring and still explaining himself", g: "weakening" },
      ],
    },
    {
      n: "Zamasu",
      t: 4,
      s: "Dragon Ball Super Zamasu",
      variants: [
        { v: "Fused Zamasu", g: "exalted" },
        { v: "immortal, and in no hurry whatsoever", g: "boon" },
      ],
    },
    { n: "Uub", t: 2, f: 1, s: "Dragon Ball Z Uub" },
    { n: "Pan (GT)", t: 1, f: 1, s: "Dragon Ball GT Pan" },

    // ── The humans, and the joke tier ───────────────────────────────────
    // Krillin is the whole thesis of this board in one lot. Six attack, six
    // defence, the weakest fighter anybody would actually put in the ring —
    // and priced at 2 with two of the best-remembered techniques in the show
    // on his chips, because a room of fans will bid on him and be pleased
    // about it. The Solar Flare chip is a major on a card that cannot use it
    // to win, only to survive, which is exactly how Krillin has always worked.
    {
      n: "Krillin",
      t: 2,
      f: 5,
      s: "Dragon Ball Z Krillin",
      variants: [
        { v: "Solar Flare, then a Destructo Disc at the neck", g: "major" },
        { v: "already ate the senzu", g: "boon" },
      ],
    },
    { n: "Tien Shinhan", t: 2, s: "Dragon Ball Z Tien Shinhan" },
    { n: "Chiaotzu", t: 1, f: 1, s: "Dragon Ball Z Chiaotzu" },
    // A 2 for a 4/5, which is the meme tax and it is real: nobody prices
    // Yamcha at what Yamcha is, they price him at what he is famous for.
    {
      n: "Yamcha",
      t: 2,
      f: 5,
      s: "Dragon Ball Z Yamcha",
      variants: [
        { v: "Wolf Fang Fist, and he means it this time", g: "major" },
        { v: "face down in a crater before the round starts", g: "crippling" },
      ],
    },
    { n: "Videl", t: 1, s: "Dragon Ball Z Videl" },
    // Tier 3 on a 2/3. The most expensive genuinely worthless card in
    // DraftMasters, and the number is not a mistake — he is the single most
    // recognisable non-fighter in the franchise and somebody at the table will
    // spend real budget on the bit. The neutral chip is the cruel one: being
    // the world champion changes nothing at all.
    {
      n: "Mr. Satan",
      t: 3,
      f: 5,
      s: "Dragon Ball Z Mr. Satan Hercule",
      variants: [
        { v: "World Martial Arts Champion, live on television", g: "neutral" },
        { v: "somebody actually swings at him", g: "crippling" },
      ],
    },
    {
      n: "Master Roshi",
      t: 3,
      s: "Dragon Ball Z Master Roshi",
      variants: [
        { v: "Max Power, and the shirt comes off", g: "major" },
        { v: "distracted by absolutely anything else", g: "weakening" },
      ],
    },
    // Rushdown 1 and a major chip for showing up behind someone. He has cut
    // off exactly one tail in his life and it decided a fight neither Goku nor
    // Vegeta was winning, which is the only argument this card needs.
    {
      n: "Yajirobe",
      t: 1,
      s: "Dragon Ball Z Yajirobe",
      variants: [
        { v: "behind them, with the katana, unnoticed", g: "major" },
        { v: "seen coming", g: "crippling" },
      ],
    },
    { n: "Chi-Chi", t: 1, s: "Dragon Ball Z Chi-Chi" },
    { n: "Bulma", t: 1, f: 5, s: "Dragon Ball Z Bulma" },
    { n: "Oolong", t: 1, f: 1, s: "Dragon Ball Oolong" },
    { n: "Puar", t: 1, f: 1, s: "Dragon Ball Puar" },
    {
      n: "Launch",
      t: 1,
      f: 1,
      s: "Dragon Ball Launch",
      variants: [
        { v: "blonde, and armed", g: "boon" },
        { v: "blue-haired and pleasant", g: "crippling" },
      ],
    },
    { n: "Fortuneteller Baba", t: 1, f: 1, s: "Dragon Ball Fortuneteller Baba" },
    { n: "Korin", t: 1, f: 1, s: "Dragon Ball Korin" },
    { n: "Mr. Popo", t: 2, s: "Dragon Ball Z Mr. Popo" },
    { n: "Grandpa Gohan", t: 2, f: 1, s: "Dragon Ball Grandpa Gohan" },
    { n: "Mercenary Tao", t: 2, f: 1, s: "Dragon Ball Mercenary Tao" },
    { n: "Emperor Pilaf", t: 1, f: 1, s: "Dragon Ball Emperor Pilaf" },

    // ── Androids ────────────────────────────────────────────────────────
    { n: "Android 18", t: 4, f: 5, s: "Dragon Ball Z Android 18" },
    {
      n: "Android 17",
      t: 4,
      s: "Dragon Ball Z Android 17",
      variants: [
        { v: "with a universe standing behind him", g: "major" },
        { v: "park ranger, out of practice", g: "weakening" },
      ],
    },
    // Priced at 3 for a 26/28 — the best raw value on the board, because
    // nobody has ever wanted Android 16 and everybody wants the pair either
    // side of him. The self-destruct chip is legendary and the head chip is
    // crippling, and both of them are the same scene.
    {
      n: "Android 16",
      t: 3,
      s: "Dragon Ball Z Android 16",
      variants: [
        { v: "the bomb is still fitted and armed", g: "legendary" },
        { v: "a head on the ground, talking", g: "crippling" },
      ],
    },
    { n: "Android 19", t: 2, f: 1, s: "Dragon Ball Z Android 19" },
    { n: "Dr. Gero", t: 2, s: "Dragon Ball Z Dr. Gero Android 20" },
    { n: "Android 13", t: 3, f: 1, s: "Dragon Ball Z Android 13" },
    {
      n: "Cell",
      t: 5,
      f: 5,
      s: "Dragon Ball Z Cell",
      variants: [
        { v: "Perfect Cell", g: "legendary" },
        { v: "Super Perfect Cell", g: "exalted" },
        { v: "Imperfect Cell", g: "crippling" },
      ],
    },
    { n: "Cell Jr.", t: 2, s: "Dragon Ball Z Cell Junior" },

    // ── Namek ───────────────────────────────────────────────────────────
    {
      n: "Piccolo",
      t: 4,
      f: 5,
      s: "Dragon Ball Z Piccolo",
      variants: [
        { v: "Orange Piccolo", g: "exalted" },
        { v: "fused with Kami", g: "major" },
        { v: "the weighted cape and turban are still on", g: "weakening" },
      ],
    },
    { n: "Kami", t: 3, s: "Dragon Ball Z Kami" },
    { n: "Nail of Namek", t: 2, s: "Dragon Ball Z Nail" },
    { n: "Dende", t: 1, s: "Dragon Ball Z Dende" },
    { n: "Grand Elder Guru", t: 1, f: 1, s: "Dragon Ball Z Grand Elder Guru" },
    {
      n: "King Piccolo",
      t: 4,
      s: "Dragon Ball King Piccolo",
      variants: [
        { v: "young again, and unhurried about it", g: "major" },
        { v: "old, and coughing", g: "weakening" },
      ],
    },
    { n: "Lord Slug", t: 3, f: 1, s: "Dragon Ball Z Lord Slug" },
    // Four attack and eight defence, rushdown zero, and worth drafting anyway:
    // he is the only card on the board whose whole function is what happens
    // after the fight. The judge is told there are no Dragon Balls in this
    // scenario, which makes him a very expensive dragon-shaped bluff.
    { n: "Shenron", t: 3, s: "Dragon Ball Z Shenron" },
    { n: "Porunga", t: 2, f: 1, s: "Dragon Ball Z Porunga" },

    // ── The Frieza Force ────────────────────────────────────────────────
    {
      n: "Frieza",
      t: 5,
      f: 5,
      s: "Dragon Ball Z Frieza",
      variants: [
        { v: "Golden Frieza", g: "exalted" },
        { v: "final form, at a hundred per cent", g: "legendary" },
        { v: "first form, still sitting in the chair", g: "crippling" },
      ],
    },
    {
      n: "Cooler",
      t: 4,
      s: "Dragon Ball Z Cooler",
      variants: [
        { v: "Metal Cooler, and there are more of him coming", g: "legendary" },
        { v: "fifth form", g: "major" },
      ],
    },
    { n: "King Cold", t: 2, s: "Dragon Ball Z King Cold" },
    {
      n: "Zarbon",
      t: 2,
      s: "Dragon Ball Z Zarbon",
      variants: [
        { v: "monstrous, and embarrassed about it", g: "major" },
        { v: "unwilling to ruin the face", g: "weakening" },
      ],
    },
    { n: "Dodoria", t: 2, f: 1, s: "Dragon Ball Z Dodoria" },
    // The body swap is a major rather than a legendary because the joke of
    // Ginyu has always been that he cannot drive what he steals. He gets
    // Goku's frame at 18/16, well short of the 15/15 card's ceiling once that
    // card transforms, and he never learns why.
    {
      n: "Captain Ginyu",
      t: 3,
      s: "Dragon Ball Z Captain Ginyu",
      variants: [
        { v: "wearing somebody else's body", g: "major" },
        { v: "wearing a frog", g: "crippling" },
      ],
    },
    { n: "Recoome", t: 2, s: "Dragon Ball Z Recoome" },
    { n: "Burter", t: 2, s: "Dragon Ball Z Burter" },
    { n: "Jeice", t: 2, s: "Dragon Ball Z Jeice" },
    {
      n: "Guldo",
      t: 1,
      s: "Dragon Ball Z Guldo",
      variants: [
        { v: "holding his breath, and time with it", g: "legendary" },
        { v: "made to exhale", g: "crippling" },
      ],
    },
    { n: "Sorbet", t: 1, f: 1, s: "Dragon Ball Z Sorbet" },
    { n: "Saibaman", t: 1, s: "Dragon Ball Z Saibaman" },
    { n: "Appule", t: 1, f: 1, s: "Dragon Ball Z Appule" },

    // ── The Buu saga ────────────────────────────────────────────────────
    // Buu's forms are graded rather than written, unlike Frieza's and Cell's,
    // because none of them carry his own name — "Kid Buu" does not contain
    // "majin buu", so the multiplier applies cleanly and the ladder comes out
    // 15 / 19 / 27 / 29 without a single extra table line.
    {
      n: "Majin Buu",
      t: 5,
      f: 5,
      s: "Dragon Ball Z Majin Buu",
      variants: [
        { v: "Kid Buu", g: "legendary" },
        { v: "Super Buu, with Gotenks inside him", g: "exalted" },
        { v: "fat, and mostly wants a friend", g: "weakening" },
      ],
    },
    { n: "Babidi", t: 1, s: "Dragon Ball Z Babidi" },
    { n: "Dabura", t: 3, s: "Dragon Ball Z Dabura" },
    { n: "Supreme Kai", t: 3, s: "Dragon Ball Z Supreme Kai" },
    { n: "Kibito", t: 2, f: 1, s: "Dragon Ball Z Kibito" },
    { n: "Old Kai", t: 1, f: 1, s: "Dragon Ball Z Elder Kai" },
    { n: "Spopovich", t: 1, f: 1, s: "Dragon Ball Z Spopovich" },
    { n: "Pui Pui", t: 1, f: 1, s: "Dragon Ball Z Pui Pui" },
    { n: "Yakon", t: 1, f: 1, s: "Dragon Ball Z Yakon" },
    { n: "King Kai", t: 2, s: "Dragon Ball Z King Kai" },

    // ── Universe survival ───────────────────────────────────────────────
    {
      n: "Jiren",
      t: 5,
      f: 5,
      s: "Dragon Ball Super Jiren",
      variants: [
        { v: "full power, and the barrier goes", g: "major" },
        { v: "arms folded, waiting to be interested", g: "weakening" },
      ],
    },
    {
      n: "Toppo",
      t: 3,
      s: "Dragon Ball Super Toppo",
      variants: [
        { v: "as a God of Destruction", g: "major" },
        { v: "still doing the Pride Trooper pose", g: "weakening" },
      ],
    },
    { n: "Dyspo", t: 3, s: "Dragon Ball Super Dyspo" },
    // Rushdown 9 on a 30/28. Time-Skip is not modelled as an ability, it is
    // modelled as arriving first against nearly everything on the board, which
    // is the same thing from where the other fighter is standing.
    {
      n: "Hit the Assassin",
      t: 4,
      s: "Dragon Ball Super Hit",
      variants: [
        { v: "Time-Skip, freely used", g: "major" },
        { v: "already read once by the same opponent", g: "weakening" },
      ],
    },
    {
      n: "Kefla",
      t: 4,
      s: "Dragon Ball Super Kefla",
      variants: [
        { v: "hair up, and it stops being funny", g: "major" },
        { v: "the earrings come apart", g: "crippling" },
      ],
    },
    { n: "Frost of Universe 6", t: 2, f: 1, s: "Dragon Ball Super Frost" },
    { n: "Ribrianne", t: 1, f: 1, s: "Dragon Ball Super Ribrianne" },
    { n: "Champa", t: 4, s: "Dragon Ball Super Champa" },
    // Tier 3 on a 40/38. The inverse of the Mr. Satan card and the reason both
    // are on the board: one is a fortune for nothing and the other is nothing
    // for a fortune, and a table that has learned this board knows which is
    // which. Vados is stated to be stronger than Whis and almost nobody at the
    // table will remember that while the bidding is open.
    { n: "Vados", t: 3, s: "Dragon Ball Super Vados" },

    // ── Gods ────────────────────────────────────────────────────────────
    // Beerus gets no upward chip. His written 38/36 already sits under Whis at
    // 42/40, and a boon would have put him over his own teacher — which the
    // franchise is explicit about never happening. Both his variants point
    // down, so the ceiling of the card is the card.
    {
      n: "Beerus",
      t: 5,
      f: 5,
      s: "Dragon Ball Super Beerus",
      variants: [
        { v: "woken early and in a foul mood", g: "weakening" },
        { v: "asleep for the next three years", g: "crippling" },
      ],
    },
    // No variants at all, deliberately. Whis has never been shown trying, so
    // there is no honest chip to put on him — and a card whose one number is
    // simply the second-highest on the board, at a price of 4, is a cleaner
    // statement than any parenthetical.
    { n: "Whis", t: 4, s: "Dragon Ball Super Whis" },
    { n: "Grand Priest", t: 4, s: "Dragon Ball Super Grand Minister" },
    // The mythic is both of them, which is the only correct way to put Zeno on
    // a card. He does not fight and he does not lose; the crippling chip is
    // him losing interest, which is the actual counterplay the show gives you.
    {
      n: "Zeno",
      t: 5,
      f: 5,
      s: "Dragon Ball Super Zeno",
      variants: [
        { v: "both of them, side by side", g: "mythic" },
        { v: "bored, and looking at something else", g: "crippling" },
      ],
    },

    // ── Films ───────────────────────────────────────────────────────────
    { n: "Bojack", t: 3, f: 1, s: "Dragon Ball Z Bojack" },
    {
      n: "Janemba",
      t: 4,
      s: "Dragon Ball Z Janemba",
      variants: [
        { v: "the small red one, folding space", g: "legendary" },
        { v: "the large yellow one, slow and stupid", g: "weakening" },
      ],
    },
    { n: "Garlic Jr.", t: 2, f: 1, s: "Dragon Ball Z Garlic Jr." },
  ],
};
