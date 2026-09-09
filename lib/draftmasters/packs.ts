/**
 * DraftMasters — topic packs.
 *
 * An auction draft needs three things from its content:
 *   1. Names people recognise instantly (the pick has to land in under a second)
 *   2. A spread of power tiers, so budget decisions actually hurt
 *   3. Variants — the "(two hands)" mechanic — so the same name can be a
 *      $9 monster one game and a $1 punchline the next.
 *
 * `t` is a power tier 1–5. It drives NPC valuation and the offline fallback
 * scoring. The AI judge sees the roster, not the tiers, so verdicts stay fresh.
 */

/**
 * How much a variant swings the pick — and what colour its chip is.
 *
 * The grade IS the mechanic: it sets the tier the variant lands on, relative
 * to the entry's base tier, so a colour never lies about what it does.
 *
 * The ladder runs cold-and-hot for harm, then climbs for help, so a player can
 * rank two chips they've never seen before by colour alone:
 *
 *   crippling  red            guts them
 *   weakening  light red      hurts, but they're still themselves
 *   neutral    grey           changes little — usually just funny
 *   boon       green          helps a bit
 *   major      blue           a real upgrade
 *   legendary  orange         helps enormously
 *   exalted    deep orange    the best form they have short of myth
 *   mythic     purple         GAME CHANGING — loses only to another mythic,
 *                             or to a couple of oranges on the other side
 *   uber       prismatic      Does not lose. One lot in five hundred.
 */
export type VariantGrade =
  | "crippling"
  | "weakening"
  | "neutral"
  | "boon"
  | "major"
  | "legendary"
  | "exalted"
  | "mythic"
  /**
   * Above mythic, and not a variant of the character at all — a crossover
   * absurdity bolted onto whoever happened to come up. Ser Arthur Dayne with
   * a lightsaber. Roughly one lot in five hundred, so most players will go
   * months without seeing one. See lib/draftmasters/ubers.
   */
  | "uber";

/** Tier movement each grade is worth, applied to the entry's base tier. */
export const GRADE_DELTA: Record<VariantGrade, number> = {
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

export const GRADES = Object.keys(GRADE_DELTA) as VariantGrade[];

/**
 * Tiers run 1-10, not 1-5.
 *
 * 1-5 is the base scale a board is written on; 6-10 only exist because a big
 * variant on an already-huge pick has to actually be worth more at auction
 * than the plain version. The ceiling is 10 rather than 8 so the top of the
 * ladder stays legible: at 8, a tier-5 pick's exalted and mythic forms both
 * clamped to the same number and the two chips promised different things
 * while doing the same thing.
 */
export const MAX_TIER = 12;

export function clampTierValue(n: number): number {
  return Math.max(1, Math.min(MAX_TIER, Math.round(n)));
}

/** Where a variant of this grade lands, given the entry's base tier. */
export function gradedTier(baseTier: number, grade: VariantGrade): number {
  return clampTierValue(baseTier + GRADE_DELTA[grade]);
}

/**
 * The tier a variant actually lands on.
 *
 * A declared grade wins, because the 1-5 scale the hand-authored boards are
 * written on has no room above a 5: "Ultra Instinct" on a tier-5 Goku had to
 * be written as another 5, which then read back as a *neutral* variant and
 * showed the player a grey chip on a god form. Declaring the grade instead
 * lets it land at 8 where it belongs. Variants with no grade keep their
 * authored tier, so every board that predates grades is untouched.
 */
export function effectiveTier(variant: Variant, baseTier: number): number {
  return variant.g && GRADE_DELTA[variant.g] !== undefined
    ? gradedTier(baseTier, variant.g)
    : variant.t ?? baseTier;
}

/**
 * Words that mean a variant is doing something, whatever its tier says.
 *
 * The safety net under the delta-0 trap. An ungraded variant whose tier equals
 * the base tier computes to NEUTRAL, which the player reads as a grey FLAVOUR
 * chip and the judge is told means "changes nothing" — and on the 1-5 scale the
 * boards are authored on, a tier-5 character has no headroom, so their single
 * most dangerous state had to be written as another 5. That is how "Freddy
 * Krueger, in the dream world" came back as flavour and the verdict said his
 * dream powers did not apply.
 *
 * The authored boards now declare their grades, so this should never fire on
 * them. It exists for what comes later: a generated board, a hand-written entry
 * somebody adds without a grade. Deliberately conservative — it says "this is
 * not nothing", not "this is legendary", because guessing high from keywords
 * would be its own kind of lie.
 */
const POWER_WORDS = [
  "prime", "unsealed", "unbound", "unleashed", "awakened", "ascended", "full power",
  "at full", "peak", "in his prime", "in her prime", "in their prime", "true form",
  "final form", "perfected", "mastered", "empowered", "charged", "armed", "armour",
  "armor", "suit", "riding", "mounted", "astride", "on ", "with the", "with his",
  "with her", "wielding", "holding", "the dream world", "home ground", "in water",
  "at night", "transformed", "berserk", "enraged", "possessed", "god mode",
];
const HANDICAP_WORDS = [
  "only", "without", "no weapon", "unarmed", "alone", "lone", "outnumbered",
  "sealed", "chained", "bound", "trapped", "confiscated", "stripped", "drained",
  "exhausted", "wounded", "injured", "dying", "blinded", "de-powered", "depowered",
  "cornered", "on the way down", "shot second", "out of the",
];

const saysAny = (text: string, words: string[]) => {
  const t = ` ${text.toLowerCase()} `;
  return words.some((w) => t.includes(w));
};

/**
 * The grade for a variant, from its declared grade or — for the hand-authored
 * boards below, which predate grades — from how far its tier moved.
 */
export function variantGrade(variant: Variant, baseTier: number): VariantGrade {
  if (variant.g && GRADE_DELTA[variant.g] !== undefined) return variant.g;
  const delta = (variant.t ?? baseTier) - baseTier;
  if (delta <= -2) return "crippling";
  if (delta === -1) return "weakening";
  if (delta === 0) {
    // Only reached by an ungraded variant that did not move the tier. If the
    // words plainly describe a state, "flavour" is the one answer that is
    // certainly wrong.
    if (saysAny(variant.v, HANDICAP_WORDS)) return "weakening";
    if (saysAny(variant.v, POWER_WORDS)) return "major";
    return "neutral";
  }
  if (delta === 1) return "boon";
  if (delta === 2) return "major";
  if (delta === 3) return "legendary";
  if (delta === 4) return "exalted";
  return "mythic";
}

export interface Variant {
  /** Parenthetical shown after the name, e.g. "two hands" */
  v: string;
  /**
   * Tier override for this condition. Only needed on ungraded variants — when
   * `g` is set the grade computes the tier, so declaring both invites drift.
   */
  t?: number;
  /** Impact grade — the source of truth for both the chip colour and the tier */
  g?: VariantGrade;
}

export interface Entry {
  /** Canonical name */
  n: string;
  /** Base power tier 1–5 */
  t: number;
  /** Extra words to disambiguate the portrait search */
  s?: string;
  /**
   * This entry's own Fandom wiki, for crossover boards where one board-level
   * wiki can't cover everyone — Jon Snow on an "epic clash" board still needs
   * gameofthrones, or Wikipedia hands you the newsreader.
   */
  wiki?: string;
  /**
   * How often this one should turn up, 1–5. Default 3.
   *
   * Prominence, not power: Jon Snow is a 5 and Strong Belwas is a 1, even
   * though Belwas would win that fight. Deep cuts stay in the pool and still
   * surface now and then — that's the surprise — they just don't headline
   * every draft. Nothing is guaranteed to appear.
   */
  f?: number;
  /**
   * The board this card actually came from.
   *
   * Only set on a mixed board, where the pack id is `mix:got+xmen` and means
   * nothing to the planar tables. Without it every card on a crossover fell
   * back to the default band and Khal Drogo came out a Titan standing next to
   * Wolverine — which is exactly the thing a crossover has to get right.
   */
  from?: string;
  /** Conditions — one is rolled at nomination time */
  variants?: Variant[];
  /**
   * Never enters the pool normally — only on the one-in-five-hundred uber
   * roll, and always wearing its declared uber variant.
   *
   * For cards that are absurd to draft at all. Eru Ilúvatar is not a fighter
   * you outbid someone for; he is the thing that wrote the fight. Putting him
   * in the ordinary rotation would be silly, so he simply is not there — until
   * the rarest roll in the game puts him there.
   */
  uberOnly?: boolean;
}

/**
 * A setting the draft is judged in. Picked per game, weighted — an animal
 * draft is usually a field and just occasionally open water, and that one
 * change turns the whole board upside down.
 */
export interface Arena {
  name: string;
  /** Appended to the pack's scenario, so the judge and the battle both see it */
  desc: string;
  /** Relative likelihood against the pack's other arenas */
  weight: number;
}

export interface Pack {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  /** Portrait search context appended to every name */
  imgContext: string;
  /**
   * Fandom subdomain to search first, e.g. "gameofthrones".
   * Wikipedia has no lead image for most fictional characters (non-free image
   * policy), so franchise wikis are the only keyless source that actually
   * covers them. Leave unset for real-world boards — Wikipedia is better there.
   */
  wiki?: string;
  /** The scenario the rosters are judged against */
  scenario: string;
  /** What "winning" means — feeds the AI judge */
  criteria: string;
  /**
   * The kind of contest this board is — a `FormatId` from ./contest.
   *
   * A hint, not a ruling: the judge reads the scenario and decides for itself,
   * because the rolled arena can change what the contest even is. Setting it
   * keeps a Pokémon board from being judged as a knife fight on the occasions
   * the scenario reads ambiguously.
   */
  format?: string;
  /**
   * The wildness dial (0-10) this board was generated at.
   *
   * Kept on the board rather than in game setup so it travels: a PvP room gets
   * the host's setting for free when the pack is broadcast, and a rematch on
   * the same board keeps the same temperament.
   */
  variantWild?: number;
  /**
   * The frequency dial (0-10) this board is played at. Same reason as
   * `variantWild`: it travels with the board so a PvP guest and a rematch both
   * get the host's setting without a second channel to keep in sync.
   */
  variantRate?: number;
  /**
   * Whether this game runs the pre-battle argument round. On the board for the
   * same reason as the dials — it's the host's setting, and a guest has to
   * know the draft ends at the sealed box rather than the verdict.
   */
  argumentsOn?: boolean;
  /**
   * Whether lots on this board can come up shiny.
   *
   * Pokémon-shaped boards only. A shiny is not a power-up — it is the rarest
   * cosmetic in the franchise and the whole point is the reveal — so it rides
   * on top of whatever variant was already rolled and leaves its grade alone.
   * A shiny Mega Charizard X is still legendary; a shiny Charmeleon is still
   * a bad night.
   */
  shinies?: boolean;
  /** Settings this board can be played in; one is rolled per game */
  arenas?: Arena[];
  /** The arena actually rolled for this game, baked in when the board is dealt */
  arenaName?: string;
  /**
   * That arena's own description, kept separately as well as folded into the
   * scenario. The scenario is written for the judge; this is what a player
   * gets when they tap the pin to ask what "a frozen godswood" means for the
   * pick they are about to bid on.
   */
  arenaDesc?: string;
  entries: Entry[];
}

export const PACKS: Pack[] = [
  // ── Game of Thrones ───────────────────────────────────────────────────────
  {
    id: "got",
    name: "Game of Thrones",
    emoji: "🐉",
    blurb: "Draft a squad. Last team standing takes the Iron Throne.",
    imgContext: "Game of Thrones character",
    wiki: "gameofthrones",
    scenario:
      "Two drafted squads meet in a melee at the gates of King's Landing. No allies, no armies — just the drafted fighters, exactly as they were drafted.",
    criteria:
      "Raw combat ability, tactical mind, and whether they would actually show up. Bodies matter more than titles.",
    arenas: [
      { name: "The gates of King's Landing", desc: "They fight in the open square before the gates — stone underfoot, no cover.", weight: 10 },
      { name: "A frozen godswood", desc: "Snow to the knee, black ice underfoot, and the cold saps anyone not born to it.", weight: 4 },
      { name: "The deck of a Greyjoy longship", desc: "Cramped, pitching, and the sea takes anyone in heavy armour who goes over.", weight: 2 },
      { name: "A feast hall, mid-wedding", desc: "No armour, few weapons, and everyone has had a great deal of wine.", weight: 2 },
      { name: "Beyond the Wall at night", desc: "Open tundra, no fire, and the dark belongs to something else.", weight: 2 },
    ],
    entries: [
      { n: "Jaime Lannister", t: 4, f: 5, variants: [{ v: "two hands", g: "mythic" }, { v: "one hand", g: "weakening" }, { v: "gold hand, drunk", g: "crippling" }] },
      { n: "The Mountain", s: "Gregor Clegane", t: 5, variants: [{ v: "alive", t: 5 }, { v: "undead, Ser Robert Strong", g: "major" }, { v: "poisoned, dying", t: 3 }] },
      { n: "Arya Stark", t: 4, f: 5, variants: [{ v: "Faceless assassin", t: 5 }, { v: "blind beggar", t: 2 }, { v: "Winterfell child", t: 1 }] },
      { n: "The Hound", s: "Sandor Clegane", t: 5, variants: [{ v: "prime", g: "boon" }, { v: "burned leg, feverish", g: "crippling" }] },
      { n: "Brienne of Tarth", t: 4, f: 5 },
      { n: "Jon Snow", t: 4, f: 5, variants: [{ v: "resurrected", g: "boon" }, { v: "Lord Commander", g: "neutral" }, { v: "green recruit", g: "crippling" }] },
      { n: "Daenerys Targaryen", t: 3, f: 5, variants: [{ v: "with three dragons", t: 5 }, { v: "with one dragon", t: 4 }, { v: "alone in the Dothraki Sea", t: 1 }] },
      { n: "Tyrion Lannister", t: 2, f: 5, variants: [{ v: "Hand of the King", t: 3 }, { v: "on trial, in chains", t: 1 }] },
      { n: "Khal Drogo", t: 5, f: 5, variants: [{ v: "prime", g: "boon" }, { v: "infected wound", g: "crippling" }] },
      { n: "Oberyn Martell", t: 5, s: "Red Viper" },
      { n: "Bronn", t: 4 },
      { n: "Ser Barristan Selmy", t: 4, variants: [{ v: "prime, Barristan the Bold", t: 5 }, { v: "old man", t: 3 }] },
      { n: "Night King", t: 5, f: 5, s: "Game of Thrones" },
      { n: "Cersei Lannister", t: 2, f: 5 },
      { n: "Ramsay Bolton", t: 3 },
      { n: "Grey Worm", t: 4 },
      { n: "Syrio Forel", t: 4 },
      { n: "Ygritte", t: 3 },
      { n: "Tormund Giantsbane", t: 4 },
      { n: "Melisandre", t: 3, variants: [{ v: "with her ruby", t: 4 }, { v: "without her necklace", t: 1 }] },
      { n: "Podrick Payne", t: 2, f: 1 },
      { n: "Samwell Tarly", t: 1, f: 5 },
      { n: "Hodor", t: 3 },
      { n: "Euron Greyjoy", t: 4 },
      { n: "Beric Dondarrion", t: 4, s: "flaming sword" },
      { n: "Robb Stark", t: 4, s: "Young Wolf" },
      { n: "Littlefinger", t: 1, s: "Petyr Baelish" },
      { n: "Varys", t: 1, s: "Game of Thrones eunuch spymaster" },
      { n: "Eddard Stark", t: 4, f: 5, s: "Ned Stark", variants: [{ v: "Warden of the North", g: "boon" }, { v: "on the steps of Baelor", t: 1 }] },
      { n: "Ser Arthur Dayne", t: 5, s: "Sword of the Morning", variants: [{ v: "with Dawn, at the Tower of Joy", g: "legendary" }, { v: "outnumbered seven to two", g: "weakening" }] },
      { n: "Sansa Stark", t: 2, f: 5 },
      { n: "Bran Stark", t: 2, variants: [{ v: "the Three-Eyed Raven", t: 4 }, { v: "before the fall", t: 1 }] },
      { n: "Theon Greyjoy", t: 2, variants: [{ v: "Prince of the Iron Islands", t: 3 }, { v: "Reek", t: 1 }] },
      { n: "Yara Greyjoy", t: 3 },
      { n: "Jorah Mormont", t: 4 },
      { n: "Ser Davos Seaworth", t: 2 },
      { n: "Stannis Baratheon", t: 4 },
      { n: "Robert Baratheon", t: 4, variants: [{ v: "young, with the warhammer", t: 5 }, { v: "fat king, drunk", t: 2 }] },
      { n: "Gendry", t: 3 },
      { n: "Tywin Lannister", t: 3 },
      { n: "Olenna Tyrell", t: 2 },
      { n: "Margaery Tyrell", t: 2 },
      { n: "Qyburn", t: 2 },
      // A counter card, not a power card: tier 3 on its own, and a monster
      // only when the other side drafted something enormous. See lib/traits.
      {
        n: "Qyburn's Scorpion",
        t: 3,
        s: "Game of Thrones scorpion ballista dragon killer",
        variants: [
          { v: "rapid-fire, mounted on the walls", g: "mythic" },
          { v: "loaded and aimed", g: "boon" },
          { v: "still being winched into position", g: "crippling" },
        ],
      },
      { n: "Walder Frey", t: 1, f: 1 },
      { n: "Roose Bolton", t: 3 },
      { n: "The High Sparrow", t: 2 },
      { n: "Lysa Arryn", t: 1, f: 1 },
      { n: "Daario Naharis", t: 3, f: 1 },
      { n: "Missandei", t: 1, f: 1 },
      { n: "Gilly", t: 1, f: 1 },
      { n: "Shaggydog", t: 3, f: 1, s: "direwolf" },
      { n: "Ghost", t: 4, s: "Jon Snow direwolf" },
      { n: "Nymeria", t: 4, s: "Arya direwolf wolf pack" },
      { n: "Drogon", t: 5, f: 5, s: "Game of Thrones dragon" },
      { n: "Viserion", t: 5, s: "Game of Thrones dragon", variants: [{ v: "wight, blue fire", g: "legendary" }, { v: "alive", g: "neutral" }] },
      { n: "Wight", t: 2, s: "Game of Thrones wight", variants: [{ v: "an army of them", t: 5 }, { v: "a single wight", g: "weakening" }] },
      { n: "White Walker", t: 4, s: "Game of Thrones Others" },
      { n: "Giant", t: 5, s: "Game of Thrones Wun Wun giant" },
      { n: "Ser Jorah's greyscale", t: 1, s: "greyscale Game of Thrones" },
      { n: "Hot Pie", t: 1, f: 1, s: "Game of Thrones baker" },

      // ── House of the Dragon — the Dance, two centuries earlier ──────
      { n: "Daemon Targaryen", t: 5, f: 5, s: "House of the Dragon", variants: [
        { v: "with Dark Sister, riding Caraxes", g: "mythic" },
        { v: "the Rogue Prince, exiled and bored", g: "neutral" },
        { v: "at the Stepstones, half-mad", g: "boon" },
      ] },
      { n: "Aemond Targaryen", t: 5, f: 5, s: "House of the Dragon one-eyed", variants: [
        { v: "One-Eye, astride Vhagar", g: "mythic" },
        { v: "sapphire eye, no dragon to hand", g: "weakening" },
        { v: "a boy with no dragon at all", g: "crippling" },
      ] },
      { n: "Rhaenyra Targaryen", t: 3, f: 5, s: "House of the Dragon", variants: [
        { v: "the Realm's Delight, on Syrax", g: "boon" },
        { v: "the Half-Year Queen, besieged", g: "weakening" },
      ] },
      { n: "Aegon II Targaryen", t: 3, s: "House of the Dragon", variants: [
        { v: "resurrected, with Sunfyre", g: "mythic" },
        { v: "crowned in the Dragonpit", g: "neutral" },
        { v: "burned at Rook's Rest", g: "crippling" },
      ] },
      { n: "Rhaenys Targaryen", t: 4, f: 5, s: "House of the Dragon Queen Who Never Was", variants: [
        { v: "the Queen Who Never Was, on Meleys", g: "legendary" },
      ] },
      { n: "Corlys Velaryon", t: 4, s: "House of the Dragon Sea Snake", variants: [
        { v: "the Sea Snake in his prime", g: "major" },
        { v: "old, and slow to heal", g: "weakening" },
      ] },
      { n: "Criston Cole", t: 4, s: "House of the Dragon Kingsguard", variants: [
        { v: "the Kingmaker, having crowned Aegon himself", g: "legendary" },
        { v: "with the morningstar in hand", g: "boon" },
        { v: "rejected by the princess", g: "weakening" },
      ] },
      { n: "Harwin Strong", t: 4, s: "House of the Dragon Breakbones", variants: [
        { v: "Breakbones, strongest man in the Seven Kingdoms", g: "major" },
      ] },
      { n: "Alicent Hightower", t: 2, f: 5, s: "House of the Dragon" },
      { n: "Otto Hightower", t: 2, s: "House of the Dragon Hand of the King" },
      { n: "Larys Strong", t: 1, f: 1, s: "House of the Dragon Clubfoot" },
      { n: "Jacaerys Velaryon", t: 3, s: "House of the Dragon", variants: [
        { v: "on Vermax, flying the realm", g: "boon" },
      ] },
      { n: "Lucerys Velaryon", t: 2, s: "House of the Dragon", variants: [
        { v: "on Arrax, caught in the storm", g: "crippling" },
      ] },
      { n: "Baela Targaryen", t: 3, s: "House of the Dragon", variants: [
        { v: "on Moondancer", g: "boon" },
      ] },
      { n: "Cregan Stark", t: 4, s: "House of the Dragon Lord of Winterfell", variants: [
        { v: "the Hour of the Wolf", g: "major" },
      ] },
      { n: "Mysaria", t: 1, f: 1, s: "House of the Dragon White Worm" },
      { n: "Vhagar", t: 5, f: 5, s: "House of the Dragon dragon", variants: [
        { v: "the oldest and largest dragon in the world", g: "mythic" },
        { v: "ancient, and slow to turn", g: "weakening" },
      ] },
      { n: "Caraxes", t: 5, s: "House of the Dragon dragon Blood Wyrm", variants: [
        { v: "the Blood Wyrm, shrieking down", g: "legendary" },
      ] },
      { n: "Meleys", t: 4, s: "House of the Dragon dragon Red Queen", variants: [
        { v: "the Red Queen, fastest of them all", g: "major" },
      ] },
      { n: "Sunfyre", t: 4, s: "House of the Dragon dragon", variants: [
        { v: "the Golden, unmatched in beauty", g: "major" },
        { v: "broken-winged, crawling", g: "crippling" },
      ] },
      { n: "Syrax", t: 3, s: "House of the Dragon dragon" },
    ],
  },

  // ── Marvel ────────────────────────────────────────────────────────────────
  {
    id: "marvel",
    name: "Marvel",
    emoji: "🦸",
    blurb: "Assemble a team. One of you saves the world; one of you explains the property damage.",
    imgContext: "Marvel character",
    wiki: "marvel",
    scenario:
      "A world-ending threat lands in a major city. Each drafted team gets 48 hours and no backup.",
    criteria:
      "Power level, but also range, versatility, and whether the team can function together without imploding.",
    arenas: [
      { name: "Midtown Manhattan", desc: "City blocks, civilians to protect, and a great deal to knock over.", weight: 10 },
      { name: "A collapsing orbital station", desc: "No gravity, thin air, and a hull breach every few minutes.", weight: 3 },
      { name: "The Savage Land", desc: "Jungle, no technology that works reliably, and dinosaurs with opinions.", weight: 2 },
      { name: "A power-dampening field", desc: "Powers run at a fraction of normal. Training and gear decide it.", weight: 2 },
    ],
    entries: [
      { n: "Iron Man", t: 5, f: 5, variants: [{ v: "Mark 85 armor", g: "legendary" }, { v: "Mark I, cave build", g: "crippling" }, { v: "no suit, just Tony", g: "crippling" }] },
      { n: "Thor", t: 5, f: 5, variants: [{ v: "with Stormbreaker", g: "legendary" }, { v: "with Mjolnir", g: "boon" }, { v: "Bro Thor, no hammer", g: "crippling" }] },
      { n: "Captain America", t: 4, f: 5, variants: [{ v: "with the shield", g: "neutral" }, { v: "no shield", g: "weakening" }, { v: "worthy, wielding Mjolnir", g: "mythic" }] },
      { n: "Hulk", t: 5, f: 5, variants: [{ v: "enraged", g: "legendary" }, { v: "Professor Hulk", g: "weakening" }, { v: "Bruce Banner, calm", g: "crippling" }] },
      { n: "Scarlet Witch", t: 5, f: 5, s: "Wanda Maximoff" },
      { n: "Doctor Strange", t: 5, f: 5, variants: [{ v: "Sorcerer Supreme", g: "boon" }, { v: "with the Time Stone", g: "mythic" }, { v: "shaky hands, pre-training", g: "crippling" }] },
      { n: "Spider-Man", t: 4, f: 5 },
      { n: "Black Panther", t: 4, f: 5, variants: [{ v: "vibranium suit", g: "major" }, { v: "no suit, herb stripped", t: 2 }] },
      { n: "Wolverine", t: 4, f: 5, s: "Marvel Logan", variants: [{ v: "adamantium claws", g: "major" }, { v: "bone claws", g: "weakening" }, { v: "Old Man Logan", g: "weakening" }] },
      { n: "Deadpool", t: 3, f: 5 },
      { n: "Magneto", t: 5, f: 5, variants: [{ v: "with the helmet", g: "boon" }, { v: "no helmet", g: "crippling" }] },
      { n: "Thanos", t: 5, f: 5, variants: [{ v: "full Infinity Gauntlet", g: "mythic" }, { v: "no stones, just the blade", g: "weakening" }] },
      { n: "Storm", t: 4, s: "X-Men Ororo Munroe" },
      { n: "Loki", t: 3, f: 5 },
      { n: "Black Widow", t: 3, f: 5 },
      { n: "Hawkeye", t: 2 },
      { n: "Vision", t: 4, variants: [{ v: "with the Mind Stone", t: 5 }, { v: "stone removed", t: 3 }] },
      { n: "Captain Marvel", t: 5, f: 5, s: "Carol Danvers" },
      { n: "Groot", t: 3, variants: [{ v: "full grown", t: 4 }, { v: "baby Groot", t: 1 }] },
      { n: "Rocket Raccoon", t: 3 },
      { n: "Star-Lord", t: 2 },
      { n: "Daredevil", t: 3 },
      { n: "Ghost Rider", t: 5 },
      { n: "Silver Surfer", t: 5, variants: [{ v: "with the board", g: "legendary" }, { v: "board confiscated", t: 3 }] },
      { n: "Ant-Man", t: 3 },
      { n: "Nick Fury", t: 2 },
      { n: "Punisher", t: 2, s: "Frank Castle" },
      { n: "Kingpin", t: 2, s: "Wilson Fisk" },
      { n: "Professor X", t: 5, s: "Charles Xavier" },
      { n: "Jean Grey", t: 5, variants: [{ v: "Dark Phoenix", g: "mythic" }, { v: "before the Phoenix", g: "weakening" }] },
      { n: "Cyclops", t: 4 },
      { n: "Nightcrawler", t: 3 },
      { n: "Colossus", t: 4 },
      { n: "Rogue", t: 4, variants: [{ v: "after absorbing Ms. Marvel", t: 5 }, { v: "gloves on", t: 3 }] },
      { n: "Beast", t: 3 },
      { n: "Gambit", t: 3 },
      { n: "Emma Frost", t: 4, variants: [{ v: "diamond form", g: "boon" }, { v: "flesh, telepathy only", g: "weakening" }] },
      { n: "Apocalypse", t: 5, s: "Marvel En Sabah Nur" },
      { n: "Mister Sinister", t: 4 },
      { n: "Juggernaut", t: 4, variants: [{ v: "helmet on, moving", t: 5 }, { v: "helmet off", t: 3 }] },
      { n: "Sentinel", t: 4, s: "Marvel Sentinel robot" },
      { n: "Doctor Doom", t: 5 },
      { n: "Galactus", t: 5 },
      { n: "Ultron", t: 5 },
      { n: "Red Skull", t: 2 },
      { n: "Winter Soldier", t: 3, s: "Bucky Barnes" },
      { n: "Falcon", t: 3, s: "Sam Wilson" },
      { n: "War Machine", t: 4 },
      { n: "Shang-Chi", t: 4, variants: [{ v: "with the Ten Rings", t: 5 }, { v: "fists only", g: "weakening" }] },
      { n: "Moon Knight", t: 3 },
      { n: "Blade", t: 4 },
      { n: "Namor", t: 5 },
      { n: "She-Hulk", t: 4 },
      { n: "Hercules", t: 5, s: "Marvel Hercules" },
      { n: "Adam Warlock", t: 5 },
      { n: "Nova", t: 4, s: "Marvel Richard Rider" },
      { n: "Gamora", t: 3 },
      { n: "Drax", t: 3 },
      { n: "Mantis", t: 2, f: 1, s: "Marvel Mantis" },
      { n: "Yondu", t: 3 },
      { n: "Venom", t: 4, f: 5 },
      { n: "Carnage", t: 4 },
      { n: "Green Goblin", t: 3 },
      { n: "Doctor Octopus", t: 3 },
      { n: "Mysterio", t: 2 },
      { n: "Kraven the Hunter", t: 3 },
      { n: "Jessica Jones", t: 3 },
      { n: "Luke Cage", t: 3 },
      { n: "Iron Fist", t: 3 },
      { n: "Squirrel Girl", t: 3, variants: [{ v: "canonically undefeated", g: "exalted" }, { v: "on paper", g: "crippling" }] },
      { n: "Howard the Duck", t: 1, f: 1 },
      { n: "Aunt May", t: 1, f: 1 },
      { n: "Stan Lee's cameo", t: 1, s: "Stan Lee" },
    ],
  },

  // ── Pokemon ───────────────────────────────────────────────────────────────
  {
    id: "pokemon",
    name: "Pokémon",
    emoji: "⚡",
    blurb: "The whole National Dex. One budget, one team, one Elite Four.",
    imgContext: "Pokemon",
    wiki: "pokemon",
    shinies: true,
    scenario:
      "Each drafted team runs the Elite Four gauntlet back to back. No items, no healing between battles.",
    criteria:
      "Stats, typing coverage, and whether the team covers its own weaknesses. Four Fire types lose to one rain team. A Legendary is not automatically the answer — a well-covered team of fully evolved Pokémon beats a box art legendary with three type weaknesses on the field.",
    arenas: [
      { name: "A standard battle field", desc: "Flat, dry ground. No terrain advantage to anyone.", weight: 10 },
      { name: "A flooded arena", desc: "Half the field is deep water. Water and Electric types are in their element.", weight: 3 },
      { name: "A sandstorm", desc: "Constant chip damage to anything not Rock, Ground or Steel.", weight: 2 },
      { name: "Trick Room", desc: "Speed is inverted — the slowest act first.", weight: 2 },
    ],
    entries: [
      { n: "Bulbasaur", t: 2, f: 5, variants: [{ v: "holding a Life Orb", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Venusaur", t: 4, f: 5, variants: [{ v: "Mega Venusaur", g: "legendary" }, { v: "Gigantamax Venusaur", g: "major" }, { v: "still an Ivysaur", g: "crippling" }, { v: "Terastallized", g: "major" }] },
      { n: "Charmander", t: 1, f: 5, variants: [{ v: "running its Hidden Ability", g: "boon" }, { v: "paralysed", g: "weakening" }] },
      { n: "Charizard", t: 4, f: 5, variants: [{ v: "Mega Charizard X", g: "legendary" }, { v: "Mega Charizard Y", g: "legendary" }, { v: "Gigantamax Charizard", g: "major" }, { v: "still a Charmeleon", g: "crippling" }, { v: "two turns into a set-up sweep", g: "major" }] },
      { n: "Squirtle", t: 2, f: 5, variants: [{ v: "Focus Sash intact", g: "boon" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Blastoise", t: 4, f: 5, variants: [{ v: "Mega Blastoise", g: "legendary" }, { v: "Gigantamax Blastoise", g: "major" }, { v: "still a Wartortle", g: "crippling" }, { v: "holding an Assault Vest", g: "boon" }] },
      { n: "Caterpie", t: 1, f: 4, variants: [{ v: "perfect IVs, competitively bred", g: "major" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Metapod", t: 1, f: 4, variants: [{ v: "still a Caterpie", g: "crippling" }, { v: "a Choice Band and nothing to lose", g: "boon" }] },
      { n: "Weedle", t: 1, f: 4, variants: [{ v: "holding a Life Orb", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Kakuna", t: 1, f: 4, variants: [{ v: "still a Weedle", g: "crippling" }, { v: "holding a Choice Scarf", g: "boon" }] },
      { n: "Pidgey", t: 1, f: 4, variants: [{ v: "running its Hidden Ability", g: "boon" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Pidgeot", t: 3, f: 4, variants: [{ v: "Mega Pidgeot", g: "legendary" }, { v: "still a Pidgeotto", g: "crippling" }, { v: "two turns into a set-up sweep", g: "major" }] },
      { n: "Rattata", t: 1, f: 4, variants: [{ v: "Alolan Rattata", g: "neutral" }, { v: "Focus Sash intact", g: "boon" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Pikachu", t: 2, f: 5, variants: [{ v: "Gigantamax Pikachu", g: "major" }, { v: "still a Pichu", g: "crippling" }, { v: "Ash's Pikachu, in the League final", g: "major" }, { v: "a wild one, level 3", g: "crippling" }, { v: "holding a Life Orb", g: "boon" }] },
      { n: "Raichu", t: 3, f: 5, variants: [{ v: "Alolan Raichu", g: "neutral" }, { v: "Mega Raichu X", g: "legendary" }, { v: "Mega Raichu Y", g: "legendary" }, { v: "still a Pikachu", g: "crippling" }, { v: "holding a Choice Scarf", g: "boon" }] },
      { n: "Nidoqueen", t: 3, f: 4, variants: [{ v: "still a Nidorina", g: "crippling" }, { v: "Focus Sash intact", g: "boon" }] },
      { n: "Nidoking", t: 3, f: 4, variants: [{ v: "still a Nidorino", g: "crippling" }, { v: "perfect IVs, competitively bred", g: "major" }] },
      { n: "Clefable", t: 3, f: 4, variants: [{ v: "Mega Clefable", g: "legendary" }, { v: "still a Clefairy", g: "crippling" }, { v: "level 100, fully EV trained", g: "major" }] },
      { n: "Ninetales", t: 3, f: 5, variants: [{ v: "Alolan Ninetales", g: "neutral" }, { v: "still a Vulpix", g: "crippling" }, { v: "holding a Choice Scarf", g: "boon" }] },
      { n: "Jigglypuff", t: 1, f: 5, variants: [{ v: "still an Igglybuff", g: "crippling" }, { v: "Terastallized", g: "major" }] },
      { n: "Zubat", t: 1, f: 4, variants: [{ v: "holding Leftovers, and in no hurry", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Vileplume", t: 3, f: 4, variants: [{ v: "still a Gloom", g: "crippling" }, { v: "holding an Assault Vest", g: "boon" }] },
      { n: "Diglett", t: 1, f: 4, variants: [{ v: "Alolan Diglett", g: "neutral" }, { v: "holding a Choice Scarf", g: "boon" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Meowth", t: 1, f: 5, variants: [{ v: "Alolan Meowth", g: "neutral" }, { v: "Galarian Meowth", g: "neutral" }, { v: "Gigantamax Meowth", g: "major" }, { v: "running its Hidden Ability", g: "boon" }, { v: "paralysed", g: "weakening" }] },
      { n: "Psyduck", t: 2, f: 5, variants: [{ v: "two turns into a set-up sweep", g: "major" }, { v: "out of PP on everything but Struggle", g: "crippling" }] },
      { n: "Golduck", t: 3, f: 4, variants: [{ v: "still a Psyduck", g: "crippling" }, { v: "Focus Sash intact", g: "boon" }] },
      { n: "Arcanine", t: 4, f: 5, variants: [{ v: "Hisuian Arcanine", g: "neutral" }, { v: "still a Growlithe", g: "crippling" }, { v: "a Choice Band and nothing to lose", g: "boon" }] },
      { n: "Poliwrath", t: 3, f: 4, variants: [{ v: "still a Poliwhirl", g: "crippling" }, { v: "holding a Choice Scarf", g: "boon" }] },
      { n: "Alakazam", t: 3, f: 5, variants: [{ v: "Mega Alakazam", g: "legendary" }, { v: "still a Kadabra", g: "crippling" }, { v: "holding Leftovers, and in no hurry", g: "boon" }] },
      { n: "Machamp", t: 3, f: 5, variants: [{ v: "Gigantamax Machamp", g: "major" }, { v: "still a Machoke", g: "crippling" }, { v: "max Dynamax, three turns of it", g: "major" }] },
      { n: "Bellsprout", t: 1, f: 4, variants: [{ v: "holding an Assault Vest", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Victreebel", t: 3, f: 4, variants: [{ v: "Mega Victreebel", g: "legendary" }, { v: "still a Weepinbell", g: "crippling" }, { v: "a Choice Band and nothing to lose", g: "boon" }] },
      { n: "Tentacool", t: 2, f: 4, variants: [{ v: "level 100, fully EV trained", g: "major" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Tentacruel", t: 3, f: 4, variants: [{ v: "still a Tentacool", g: "crippling" }, { v: "holding a Life Orb", g: "boon" }] },
      { n: "Geodude", t: 1, f: 4, variants: [{ v: "Alolan Geodude", g: "neutral" }, { v: "holding a Choice Scarf", g: "boon" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Golem", t: 3, f: 4, variants: [{ v: "Alolan Golem", g: "neutral" }, { v: "still a Graveler", g: "crippling" }, { v: "running its Hidden Ability", g: "boon" }] },
      { n: "Rapidash", t: 3, f: 4, variants: [{ v: "Galarian Rapidash", g: "neutral" }, { v: "still a Ponyta", g: "crippling" }, { v: "two turns into a set-up sweep", g: "major" }] },
      { n: "Slowpoke", t: 2, f: 5, variants: [{ v: "Galarian Slowpoke", g: "neutral" }, { v: "Focus Sash intact", g: "boon" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Slowbro", t: 3, f: 4, variants: [{ v: "Mega Slowbro", g: "legendary" }, { v: "Galarian Slowbro", g: "neutral" }, { v: "still a Slowpoke", g: "crippling" }, { v: "max Dynamax, three turns of it", g: "major" }] },
      { n: "Magnemite", t: 2, f: 4, variants: [{ v: "holding an Assault Vest", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Farfetch’d", t: 2, f: 5, variants: [{ v: "Galarian Farfetch’d", g: "neutral" }, { v: "a Choice Band and nothing to lose", g: "boon" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Dodrio", t: 3, f: 4, variants: [{ v: "still a Doduo", g: "crippling" }, { v: "holding a Life Orb", g: "boon" }] },
      { n: "Dewgong", t: 3, f: 4, variants: [{ v: "still a Seel", g: "crippling" }, { v: "Terastallized", g: "major" }] },
      { n: "Grimer", t: 2, f: 4, variants: [{ v: "Alolan Grimer", g: "neutral" }, { v: "running its Hidden Ability", g: "boon" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Muk", t: 3, f: 4, variants: [{ v: "Alolan Muk", g: "neutral" }, { v: "still a Grimer", g: "crippling" }, { v: "holding Leftovers, and in no hurry", g: "boon" }] },
      { n: "Cloyster", t: 4, f: 4, variants: [{ v: "still a Shellder", g: "crippling" }, { v: "Focus Sash intact", g: "boon" }] },
      { n: "Gengar", t: 3, f: 5, variants: [{ v: "Mega Gengar", g: "legendary" }, { v: "Gigantamax Gengar", g: "major" }, { v: "still a Haunter", g: "crippling" }, { v: "perfect IVs, competitively bred", g: "major" }] },
      { n: "Onix", t: 2, f: 5, variants: [{ v: "a Choice Band and nothing to lose", g: "boon" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Hypno", t: 3, f: 4, variants: [{ v: "still a Drowzee", g: "crippling" }, { v: "holding a Life Orb", g: "boon" }] },
      { n: "Krabby", t: 2, f: 4, variants: [{ v: "holding a Choice Scarf", g: "boon" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Kingler", t: 3, f: 4, variants: [{ v: "Gigantamax Kingler", g: "major" }, { v: "still a Krabby", g: "crippling" }, { v: "Terastallized", g: "major" }] },
      { n: "Voltorb", t: 2, f: 4, variants: [{ v: "Hisuian Voltorb", g: "neutral" }, { v: "running its Hidden Ability", g: "boon" }, { v: "paralysed", g: "weakening" }] },
      { n: "Electrode", t: 3, f: 4, variants: [{ v: "Hisuian Electrode", g: "neutral" }, { v: "still a Voltorb", g: "crippling" }, { v: "holding Leftovers, and in no hurry", g: "boon" }] },
      { n: "Exeggcute", t: 2, f: 4, variants: [{ v: "two turns into a set-up sweep", g: "major" }, { v: "out of PP on everything but Struggle", g: "crippling" }] },
      { n: "Exeggutor", t: 4, f: 4, variants: [{ v: "Alolan Exeggutor", g: "neutral" }, { v: "still an Exeggcute", g: "crippling" }, { v: "Focus Sash intact", g: "boon" }] },
      { n: "Cubone", t: 2, f: 4, variants: [{ v: "max Dynamax, three turns of it", g: "major" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Lickitung", t: 2, f: 4, variants: [{ v: "level 100, fully EV trained", g: "major" }, { v: "paralysed", g: "weakening" }] },
      { n: "Koffing", t: 2, f: 4, variants: [{ v: "holding a Life Orb", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Weezing", t: 3, f: 4, variants: [{ v: "Galarian Weezing", g: "neutral" }, { v: "still a Koffing", g: "crippling" }, { v: "holding a Choice Scarf", g: "boon" }] },
      { n: "Tangela", t: 2, f: 4, variants: [{ v: "two turns into a set-up sweep", g: "major" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Kangaskhan", t: 3, f: 4, variants: [{ v: "Mega Kangaskhan", g: "legendary" }, { v: "Focus Sash intact", g: "boon" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Horsea", t: 1, f: 4, variants: [{ v: "max Dynamax, three turns of it", g: "major" }, { v: "paralysed", g: "weakening" }] },
      { n: "Goldeen", t: 2, f: 4, variants: [{ v: "perfect IVs, competitively bred", g: "major" }, { v: "out of PP on everything but Struggle", g: "crippling" }] },
      { n: "Staryu", t: 2, f: 4, variants: [{ v: "level 100, fully EV trained", g: "major" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Starmie", t: 4, f: 4, variants: [{ v: "Mega Starmie", g: "legendary" }, { v: "still a Staryu", g: "crippling" }, { v: "holding a Life Orb", g: "boon" }] },
      { n: "Scyther", t: 3, f: 5, variants: [{ v: "Terastallized", g: "major" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Magmar", t: 3, f: 4, variants: [{ v: "still a Magby", g: "crippling" }, { v: "two turns into a set-up sweep", g: "major" }] },
      { n: "Pinsir", t: 3, f: 4, variants: [{ v: "Mega Pinsir", g: "legendary" }, { v: "Focus Sash intact", g: "boon" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Tauros", t: 3, f: 4, variants: [{ v: "max Dynamax, three turns of it", g: "major" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Magikarp", t: 1, f: 5, variants: [{ v: "one Splash away from evolving", g: "boon" }, { v: "holding an Assault Vest", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Gyarados", t: 4, f: 5, variants: [{ v: "Mega Gyarados", g: "legendary" }, { v: "still a Magikarp", g: "crippling" }, { v: "the Red Gyarados of the Lake of Rage", g: "major" }, { v: "perfect IVs, competitively bred", g: "major" }] },
      { n: "Lapras", t: 4, f: 5, variants: [{ v: "Gigantamax Lapras", g: "major" }, { v: "a Choice Band and nothing to lose", g: "boon" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Ditto", t: 1, f: 5, variants: [{ v: "transformed into whatever it just saw", g: "major" }, { v: "a bad copy — the face is still wrong", g: "weakening" }, { v: "level 100, fully EV trained", g: "major" }, { v: "paralysed", g: "weakening" }] },
      { n: "Eevee", t: 2, f: 5, variants: [{ v: "Gigantamax Eevee", g: "major" }, { v: "one stone away from being anything", g: "boon" }, { v: "holding a Life Orb", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Vaporeon", t: 4, f: 5, variants: [{ v: "still an Eevee", g: "crippling" }, { v: "holding a Choice Scarf", g: "boon" }] },
      { n: "Jolteon", t: 4, f: 5, variants: [{ v: "still an Eevee", g: "crippling" }, { v: "Terastallized", g: "major" }] },
      { n: "Flareon", t: 4, f: 5, variants: [{ v: "still an Eevee", g: "crippling" }, { v: "running its Hidden Ability", g: "boon" }] },
      { n: "Porygon", t: 2, f: 4, variants: [{ v: "holding Leftovers, and in no hurry", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Omastar", t: 3, f: 4, variants: [{ v: "still an Omanyte", g: "crippling" }, { v: "Focus Sash intact", g: "boon" }] },
      { n: "Kabutops", t: 3, f: 4, variants: [{ v: "still a Kabuto", g: "crippling" }, { v: "holding an Assault Vest", g: "boon" }] },
      { n: "Aerodactyl", t: 3, f: 5, variants: [{ v: "Mega Aerodactyl", g: "legendary" }, { v: "perfect IVs, competitively bred", g: "major" }, { v: "out of PP on everything but Struggle", g: "crippling" }] },
      { n: "Snorlax", t: 4, f: 5, variants: [{ v: "Gigantamax Snorlax", g: "major" }, { v: "still a Munchlax", g: "crippling" }, { v: "asleep in the road, and nobody has the flute", g: "crippling" }, { v: "a Choice Band and nothing to lose", g: "boon" }] },
      { n: "Articuno", t: 4, f: 5, variants: [{ v: "Galarian Articuno", g: "neutral" }, { v: "level 100, fully EV trained", g: "major" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Zapdos", t: 4, f: 5, variants: [{ v: "Galarian Zapdos", g: "neutral" }, { v: "holding a Life Orb", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Moltres", t: 4, f: 5, variants: [{ v: "Galarian Moltres", g: "neutral" }, { v: "holding a Choice Scarf", g: "boon" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Dragonite", t: 5, f: 5, variants: [{ v: "Mega Dragonite", g: "legendary" }, { v: "still a Dragonair", g: "crippling" }, { v: "holding Leftovers, and in no hurry", g: "boon" }] },
      { n: "Mewtwo", t: 5, f: 5, variants: [{ v: "Mega Mewtwo X", g: "legendary" }, { v: "Mega Mewtwo Y", g: "legendary" }, { v: "Armored Mewtwo", g: "major" }, { v: "two turns into a set-up sweep", g: "major" }, { v: "out of PP on everything but Struggle", g: "crippling" }] },
      { n: "Mew", t: 5, f: 5, variants: [{ v: "Focus Sash intact", g: "boon" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Chikorita", t: 2, f: 4, variants: [{ v: "max Dynamax, three turns of it", g: "major" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Meganium", t: 4, f: 5, variants: [{ v: "Mega Meganium", g: "legendary" }, { v: "still a Bayleef", g: "crippling" }, { v: "perfect IVs, competitively bred", g: "major" }] },
      { n: "Cyndaquil", t: 1, f: 4, variants: [{ v: "a Choice Band and nothing to lose", g: "boon" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Typhlosion", t: 4, f: 5, variants: [{ v: "Hisuian Typhlosion", g: "neutral" }, { v: "still a Quilava", g: "crippling" }, { v: "holding a Life Orb", g: "boon" }] },
      { n: "Totodile", t: 2, f: 4, variants: [{ v: "holding a Choice Scarf", g: "boon" }, { v: "out of PP on everything but Struggle", g: "crippling" }] },
      { n: "Feraligatr", t: 4, f: 5, variants: [{ v: "Mega Feraligatr", g: "legendary" }, { v: "still a Croconaw", g: "crippling" }, { v: "running its Hidden Ability", g: "boon" }] },
      { n: "Sentret", t: 1, variants: [{ v: "holding Leftovers, and in no hurry", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Hoothoot", t: 1, variants: [{ v: "Focus Sash intact", g: "boon" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Ledyba", t: 1, variants: [{ v: "holding an Assault Vest", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Spinarak", t: 1, variants: [{ v: "a Choice Band and nothing to lose", g: "boon" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Crobat", t: 4, variants: [{ v: "still a Golbat", g: "crippling" }, { v: "holding a Life Orb", g: "boon" }] },
      { n: "Lanturn", t: 3, variants: [{ v: "still a Chinchou", g: "crippling" }, { v: "Terastallized", g: "major" }] },
      { n: "Togepi", t: 1, f: 5, variants: [{ v: "Focus Sash intact", g: "boon" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Natu", t: 2, variants: [{ v: "holding an Assault Vest", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Xatu", t: 3, variants: [{ v: "still a Natu", g: "crippling" }, { v: "perfect IVs, competitively bred", g: "major" }] },
      { n: "Ampharos", t: 3, variants: [{ v: "Mega Ampharos", g: "legendary" }, { v: "still a Flaaffy", g: "crippling" }, { v: "holding a Life Orb", g: "boon" }] },
      { n: "Bellossom", t: 3, variants: [{ v: "still a Gloom", g: "crippling" }, { v: "holding a Choice Scarf", g: "boon" }] },
      { n: "Marill", t: 1, variants: [{ v: "still an Azurill", g: "crippling" }, { v: "Terastallized", g: "major" }] },
      { n: "Politoed", t: 3, variants: [{ v: "still a Poliwhirl", g: "crippling" }, { v: "two turns into a set-up sweep", g: "major" }] },
      { n: "Jumpluff", t: 3, variants: [{ v: "still a Skiploom", g: "crippling" }, { v: "holding an Assault Vest", g: "boon" }] },
      { n: "Sunkern", t: 1, variants: [{ v: "a Choice Band and nothing to lose", g: "boon" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Wooper", t: 1, variants: [{ v: "Paldean Wooper", g: "neutral" }, { v: "holding a Choice Scarf", g: "boon" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Espeon", t: 4, f: 5, variants: [{ v: "still an Eevee", g: "crippling" }, { v: "running its Hidden Ability", g: "boon" }] },
      { n: "Umbreon", t: 4, f: 5, variants: [{ v: "still an Eevee", g: "crippling" }, { v: "holding Leftovers, and in no hurry", g: "boon" }] },
      { n: "Slowking", t: 3, variants: [{ v: "Galarian Slowking", g: "neutral" }, { v: "still a Slowpoke", g: "crippling" }, { v: "Focus Sash intact", g: "boon" }] },
      { n: "Unown", t: 2, variants: [{ v: "all twenty-eight of them at once", g: "major" }, { v: "holding an Assault Vest", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Wobbuffet", t: 2, f: 5, variants: [{ v: "still a Wynaut", g: "crippling" }, { v: "Counter, Mirror Coat, and nothing else", g: "neutral" }, { v: "perfect IVs, competitively bred", g: "major" }] },
      { n: "Forretress", t: 3, variants: [{ v: "still a Pineco", g: "crippling" }, { v: "holding a Life Orb", g: "boon" }] },
      { n: "Dunsparce", t: 2, variants: [{ v: "holding a Choice Scarf", g: "boon" }, { v: "out of PP on everything but Struggle", g: "crippling" }] },
      { n: "Steelix", t: 3, variants: [{ v: "Mega Steelix", g: "legendary" }, { v: "still an Onix", g: "crippling" }, { v: "running its Hidden Ability", g: "boon" }] },
      { n: "Scizor", t: 3, f: 5, variants: [{ v: "Mega Scizor", g: "legendary" }, { v: "still a Scyther", g: "crippling" }, { v: "max Dynamax, three turns of it", g: "major" }] },
      { n: "Shuckle", t: 3, variants: [{ v: "fed Berry Juice, defence off the chart", g: "boon" }, { v: "holding an Assault Vest", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Heracross", t: 3, f: 5, variants: [{ v: "Mega Heracross", g: "legendary" }, { v: "perfect IVs, competitively bred", g: "major" }, { v: "out of PP on everything but Struggle", g: "crippling" }] },
      { n: "Octillery", t: 3, variants: [{ v: "still a Remoraid", g: "crippling" }, { v: "max Dynamax, three turns of it", g: "major" }] },
      { n: "Delibird", t: 2, variants: [{ v: "holding an Assault Vest", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Mantine", t: 3, variants: [{ v: "still a Mantyke", g: "crippling" }, { v: "perfect IVs, competitively bred", g: "major" }] },
      { n: "Skarmory", t: 3, f: 5, variants: [{ v: "Mega Skarmory", g: "legendary" }, { v: "a Choice Band and nothing to lose", g: "boon" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Houndoom", t: 3, variants: [{ v: "Mega Houndoom", g: "legendary" }, { v: "still a Houndour", g: "crippling" }, { v: "holding a Life Orb", g: "boon" }] },
      { n: "Kingdra", t: 4, variants: [{ v: "still a Seadra", g: "crippling" }, { v: "holding a Choice Scarf", g: "boon" }] },
      { n: "Donphan", t: 3, variants: [{ v: "still a Phanpy", g: "crippling" }, { v: "running its Hidden Ability", g: "boon" }] },
      { n: "Stantler", t: 3, variants: [{ v: "two turns into a set-up sweep", g: "major" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Smeargle", t: 1, variants: [{ v: "Sketched every move in the game", g: "legendary" }, { v: "Focus Sash intact", g: "boon" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Tyrogue", t: 1, f: 5, variants: [{ v: "max Dynamax, three turns of it", g: "major" }, { v: "paralysed", g: "weakening" }] },
      { n: "Miltank", t: 3, variants: [{ v: "holding a Life Orb", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Blissey", t: 4, variants: [{ v: "still a Chansey", g: "crippling" }, { v: "holding a Choice Scarf", g: "boon" }] },
      { n: "Raikou", t: 4, f: 4, variants: [{ v: "Terastallized", g: "major" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Entei", t: 4, f: 4, variants: [{ v: "running its Hidden Ability", g: "boon" }, { v: "paralysed", g: "weakening" }] },
      { n: "Suicune", t: 4, f: 4, variants: [{ v: "holding Leftovers, and in no hurry", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Tyranitar", t: 5, f: 5, variants: [{ v: "Mega Tyranitar", g: "legendary" }, { v: "still a Pupitar", g: "crippling" }, { v: "max Dynamax, three turns of it", g: "major" }] },
      { n: "Lugia", t: 5, f: 5, variants: [{ v: "holding an Assault Vest", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Ho-Oh", t: 5, f: 5, variants: [{ v: "perfect IVs, competitively bred", g: "major" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Celebi", t: 5, f: 5, variants: [{ v: "a Choice Band and nothing to lose", g: "boon" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Treecko", t: 2, f: 4, variants: [{ v: "level 100, fully EV trained", g: "major" }, { v: "paralysed", g: "weakening" }] },
      { n: "Sceptile", t: 4, f: 5, variants: [{ v: "Mega Sceptile", g: "legendary" }, { v: "still a Grovyle", g: "crippling" }, { v: "holding a Choice Scarf", g: "boon" }] },
      { n: "Torchic", t: 2, f: 4, variants: [{ v: "Terastallized", g: "major" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Blaziken", t: 4, f: 5, variants: [{ v: "Mega Blaziken", g: "legendary" }, { v: "still a Combusken", g: "crippling" }, { v: "holding Leftovers, and in no hurry", g: "boon" }] },
      { n: "Mudkip", t: 2, f: 4, variants: [{ v: "two turns into a set-up sweep", g: "major" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Swampert", t: 4, f: 5, variants: [{ v: "Mega Swampert", g: "legendary" }, { v: "still a Marshtomp", g: "crippling" }, { v: "max Dynamax, three turns of it", g: "major" }] },
      { n: "Zigzagoon", t: 1, f: 2, variants: [{ v: "Galarian Zigzagoon", g: "neutral" }, { v: "a Choice Band and nothing to lose", g: "boon" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Wurmple", t: 1, f: 2, variants: [{ v: "holding a Life Orb", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Ludicolo", t: 3, f: 2, variants: [{ v: "still a Lombre", g: "crippling" }, { v: "max Dynamax, three turns of it", g: "major" }] },
      { n: "Shiftry", t: 3, f: 2, variants: [{ v: "still a Nuzleaf", g: "crippling" }, { v: "a Choice Band and nothing to lose", g: "boon" }] },
      { n: "Gardevoir", t: 3, f: 5, variants: [{ v: "Mega Gardevoir", g: "legendary" }, { v: "still a Kirlia", g: "crippling" }, { v: "two turns into a set-up sweep", g: "major" }] },
      { n: "Breloom", t: 3, f: 2, variants: [{ v: "still a Shroomish", g: "crippling" }, { v: "perfect IVs, competitively bred", g: "major" }] },
      { n: "Slaking", t: 5, variants: [{ v: "still a Vigoroth", g: "crippling" }, { v: "Truant — it only moves every other turn", g: "weakening" }, { v: "holding a Life Orb", g: "boon" }] },
      { n: "Whismur", t: 1, f: 2, variants: [{ v: "holding Leftovers, and in no hurry", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Exploud", t: 3, f: 2, variants: [{ v: "still a Loudred", g: "crippling" }, { v: "Focus Sash intact", g: "boon" }] },
      { n: "Makuhita", t: 1, f: 2, variants: [{ v: "max Dynamax, three turns of it", g: "major" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Hariyama", t: 3, f: 2, variants: [{ v: "still a Makuhita", g: "crippling" }, { v: "holding an Assault Vest", g: "boon" }] },
      { n: "Nosepass", t: 2, f: 2, variants: [{ v: "a Choice Band and nothing to lose", g: "boon" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Sableye", t: 2, f: 5, variants: [{ v: "Mega Sableye", g: "legendary" }, { v: "Prankster, going first out of nowhere", g: "boon" }, { v: "holding a Choice Scarf", g: "boon" }, { v: "out of PP on everything but Struggle", g: "crippling" }] },
      { n: "Aggron", t: 4, variants: [{ v: "Mega Aggron", g: "legendary" }, { v: "still a Lairon", g: "crippling" }, { v: "two turns into a set-up sweep", g: "major" }] },
      { n: "Manectric", t: 3, f: 2, variants: [{ v: "Mega Manectric", g: "legendary" }, { v: "still an Electrike", g: "crippling" }, { v: "perfect IVs, competitively bred", g: "major" }] },
      { n: "Plusle", t: 2, f: 2, variants: [{ v: "a Choice Band and nothing to lose", g: "boon" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Minun", t: 2, f: 2, variants: [{ v: "level 100, fully EV trained", g: "major" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Swalot", t: 3, f: 2, variants: [{ v: "still a Gulpin", g: "crippling" }, { v: "holding Leftovers, and in no hurry", g: "boon" }] },
      { n: "Sharpedo", t: 3, f: 2, variants: [{ v: "Mega Sharpedo", g: "legendary" }, { v: "still a Carvanha", g: "crippling" }, { v: "Focus Sash intact", g: "boon" }] },
      { n: "Wailord", t: 3, variants: [{ v: "still a Wailmer", g: "crippling" }, { v: "holding an Assault Vest", g: "boon" }] },
      { n: "Camerupt", t: 3, f: 2, variants: [{ v: "Mega Camerupt", g: "legendary" }, { v: "still a Numel", g: "crippling" }, { v: "a Choice Band and nothing to lose", g: "boon" }] },
      { n: "Torkoal", t: 3, f: 2, variants: [{ v: "level 100, fully EV trained", g: "major" }, { v: "paralysed", g: "weakening" }] },
      { n: "Grumpig", t: 3, f: 2, variants: [{ v: "still a Spoink", g: "crippling" }, { v: "holding a Choice Scarf", g: "boon" }] },
      { n: "Flygon", t: 4, variants: [{ v: "still a Vibrava", g: "crippling" }, { v: "two turns into a set-up sweep", g: "major" }] },
      { n: "Cacturne", t: 3, f: 2, variants: [{ v: "still a Cacnea", g: "crippling" }, { v: "max Dynamax, three turns of it", g: "major" }] },
      { n: "Altaria", t: 3, f: 2, variants: [{ v: "Mega Altaria", g: "legendary" }, { v: "still a Swablu", g: "crippling" }, { v: "perfect IVs, competitively bred", g: "major" }] },
      { n: "Lunatone", t: 3, f: 2, variants: [{ v: "holding a Life Orb", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Solrock", t: 3, f: 2, variants: [{ v: "holding a Choice Scarf", g: "boon" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Whiscash", t: 3, f: 2, variants: [{ v: "still a Barboach", g: "crippling" }, { v: "running its Hidden Ability", g: "boon" }] },
      { n: "Crawdaunt", t: 3, f: 2, variants: [{ v: "still a Corphish", g: "crippling" }, { v: "two turns into a set-up sweep", g: "major" }] },
      { n: "Claydol", t: 3, variants: [{ v: "still a Baltoy", g: "crippling" }, { v: "max Dynamax, three turns of it", g: "major" }] },
      { n: "Cradily", t: 3, f: 2, variants: [{ v: "still a Lileep", g: "crippling" }, { v: "perfect IVs, competitively bred", g: "major" }] },
      { n: "Armaldo", t: 3, f: 2, variants: [{ v: "still an Anorith", g: "crippling" }, { v: "level 100, fully EV trained", g: "major" }] },
      { n: "Feebas", t: 1, f: 2, variants: [{ v: "holding a Life Orb", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Milotic", t: 4, variants: [{ v: "still a Feebas", g: "crippling" }, { v: "holding a Choice Scarf", g: "boon" }] },
      { n: "Tropius", t: 3, f: 2, variants: [{ v: "holding an Assault Vest", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Absol", t: 3, f: 5, variants: [{ v: "Mega Absol", g: "legendary" }, { v: "a Choice Band and nothing to lose", g: "boon" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Glalie", t: 3, f: 2, variants: [{ v: "Mega Glalie", g: "legendary" }, { v: "still a Snorunt", g: "crippling" }, { v: "holding a Choice Scarf", g: "boon" }] },
      { n: "Walrein", t: 4, variants: [{ v: "still a Sealeo", g: "crippling" }, { v: "holding Leftovers, and in no hurry", g: "boon" }] },
      { n: "Huntail", t: 3, f: 2, variants: [{ v: "still a Clamperl", g: "crippling" }, { v: "Focus Sash intact", g: "boon" }] },
      { n: "Gorebyss", t: 3, f: 2, variants: [{ v: "still a Clamperl", g: "crippling" }, { v: "max Dynamax, three turns of it", g: "major" }] },
      { n: "Relicanth", t: 3, f: 2, variants: [{ v: "holding an Assault Vest", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Luvdisc", t: 2, f: 2, variants: [{ v: "perfect IVs, competitively bred", g: "major" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Salamence", t: 5, f: 5, variants: [{ v: "Mega Salamence", g: "legendary" }, { v: "still a Shelgon", g: "crippling" }, { v: "holding a Life Orb", g: "boon" }] },
      { n: "Metagross", t: 5, f: 5, variants: [{ v: "Mega Metagross", g: "legendary" }, { v: "still a Metang", g: "crippling" }, { v: "running its Hidden Ability", g: "boon" }] },
      { n: "Regirock", t: 4, f: 4, variants: [{ v: "holding Leftovers, and in no hurry", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Regice", t: 4, f: 4, variants: [{ v: "two turns into a set-up sweep", g: "major" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Registeel", t: 4, f: 4, variants: [{ v: "Focus Sash intact", g: "boon" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Latias", t: 5, f: 4, variants: [{ v: "Mega Latias", g: "legendary" }, { v: "max Dynamax, three turns of it", g: "major" }, { v: "paralysed", g: "weakening" }] },
      { n: "Latios", t: 5, f: 4, variants: [{ v: "Mega Latios", g: "legendary" }, { v: "holding an Assault Vest", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Kyogre", t: 5, f: 5, variants: [{ v: "Primal Kyogre", g: "mythic" }, { v: "perfect IVs, competitively bred", g: "major" }, { v: "out of PP on everything but Struggle", g: "crippling" }] },
      { n: "Groudon", t: 5, f: 5, variants: [{ v: "Primal Groudon", g: "mythic" }, { v: "a Choice Band and nothing to lose", g: "boon" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Rayquaza", t: 5, f: 5, variants: [{ v: "Mega Rayquaza", g: "legendary" }, { v: "level 100, fully EV trained", g: "major" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Jirachi", t: 5, f: 5, variants: [{ v: "holding a Life Orb", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Deoxys", t: 5, f: 5, variants: [{ v: "Attack Forme", g: "boon" }, { v: "Defense Forme", g: "boon" }, { v: "Speed Forme", g: "boon" }, { v: "holding a Choice Scarf", g: "boon" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Turtwig", t: 2, f: 4, variants: [{ v: "Terastallized", g: "major" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Torterra", t: 4, variants: [{ v: "still a Grotle", g: "crippling" }, { v: "holding Leftovers, and in no hurry", g: "boon" }] },
      { n: "Chimchar", t: 1, f: 4, variants: [{ v: "two turns into a set-up sweep", g: "major" }, { v: "out of PP on everything but Struggle", g: "crippling" }] },
      { n: "Infernape", t: 4, f: 5, variants: [{ v: "still a Monferno", g: "crippling" }, { v: "max Dynamax, three turns of it", g: "major" }] },
      { n: "Piplup", t: 2, f: 4, variants: [{ v: "holding an Assault Vest", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Empoleon", t: 4, variants: [{ v: "still a Prinplup", g: "crippling" }, { v: "a Choice Band and nothing to lose", g: "boon" }] },
      { n: "Staraptor", t: 3, f: 2, variants: [{ v: "Mega Staraptor", g: "legendary" }, { v: "still a Staravia", g: "crippling" }, { v: "holding a Choice Scarf", g: "boon" }] },
      { n: "Bidoof", t: 1, f: 2, variants: [{ v: "Terastallized", g: "major" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Shinx", t: 1, f: 2, variants: [{ v: "Focus Sash intact", g: "boon" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Luxray", t: 4, variants: [{ v: "still a Luxio", g: "crippling" }, { v: "holding an Assault Vest", g: "boon" }] },
      { n: "Roserade", t: 3, variants: [{ v: "still a Roselia", g: "crippling" }, { v: "a Choice Band and nothing to lose", g: "boon" }] },
      { n: "Rampardos", t: 3, f: 2, variants: [{ v: "still a Cranidos", g: "crippling" }, { v: "holding a Life Orb", g: "boon" }] },
      { n: "Bastiodon", t: 3, f: 2, variants: [{ v: "still a Shieldon", g: "crippling" }, { v: "Terastallized", g: "major" }] },
      { n: "Combee", t: 1, f: 2, variants: [{ v: "Focus Sash intact", g: "boon" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Vespiquen", t: 3, f: 2, variants: [{ v: "still a Combee", g: "crippling" }, { v: "max Dynamax, three turns of it", g: "major" }] },
      { n: "Buizel", t: 2, f: 2, variants: [{ v: "perfect IVs, competitively bred", g: "major" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Floatzel", t: 3, f: 2, variants: [{ v: "still a Buizel", g: "crippling" }, { v: "a Choice Band and nothing to lose", g: "boon" }] },
      { n: "Cherubi", t: 1, f: 2, variants: [{ v: "level 100, fully EV trained", g: "major" }, { v: "paralysed", g: "weakening" }] },
      { n: "Gastrodon", t: 3, f: 2, variants: [{ v: "still a Shellos", g: "crippling" }, { v: "Terastallized", g: "major" }] },
      { n: "Ambipom", t: 3, f: 2, variants: [{ v: "still an Aipom", g: "crippling" }, { v: "running its Hidden Ability", g: "boon" }] },
      { n: "Drifblim", t: 3, f: 2, variants: [{ v: "still a Drifloon", g: "crippling" }, { v: "two turns into a set-up sweep", g: "major" }] },
      { n: "Lopunny", t: 3, f: 2, variants: [{ v: "Mega Lopunny", g: "legendary" }, { v: "still a Buneary", g: "crippling" }, { v: "max Dynamax, three turns of it", g: "major" }] },
      { n: "Mismagius", t: 3, f: 2, variants: [{ v: "still a Misdreavus", g: "crippling" }, { v: "holding an Assault Vest", g: "boon" }] },
      { n: "Honchkrow", t: 3, variants: [{ v: "still a Murkrow", g: "crippling" }, { v: "perfect IVs, competitively bred", g: "major" }] },
      { n: "Skuntank", t: 3, f: 2, variants: [{ v: "still a Stunky", g: "crippling" }, { v: "Terastallized", g: "major" }] },
      { n: "Bronzor", t: 1, f: 2, variants: [{ v: "running its Hidden Ability", g: "boon" }, { v: "paralysed", g: "weakening" }] },
      { n: "Bronzong", t: 3, variants: [{ v: "still a Bronzor", g: "crippling" }, { v: "holding Leftovers, and in no hurry", g: "boon" }] },
      { n: "Happiny", t: 1, f: 2, variants: [{ v: "max Dynamax, three turns of it", g: "major" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Chatot", t: 2, f: 2, variants: [{ v: "holding an Assault Vest", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Spiritomb", t: 3, f: 2, variants: [{ v: "perfect IVs, competitively bred", g: "major" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Garchomp", t: 5, f: 5, variants: [{ v: "Mega Garchomp", g: "legendary" }, { v: "still a Gabite", g: "crippling" }, { v: "holding a Life Orb", g: "boon" }] },
      { n: "Lucario", t: 4, f: 5, variants: [{ v: "Mega Lucario", g: "legendary" }, { v: "still a Riolu", g: "crippling" }, { v: "running its Hidden Ability", g: "boon" }] },
      { n: "Hippopotas", t: 2, f: 2, variants: [{ v: "holding Leftovers, and in no hurry", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Hippowdon", t: 4, variants: [{ v: "still a Hippopotas", g: "crippling" }, { v: "two turns into a set-up sweep", g: "major" }] },
      { n: "Drapion", t: 3, variants: [{ v: "still a Skorupi", g: "crippling" }, { v: "max Dynamax, three turns of it", g: "major" }] },
      { n: "Toxicroak", t: 3, f: 2, variants: [{ v: "still a Croagunk", g: "crippling" }, { v: "perfect IVs, competitively bred", g: "major" }] },
      { n: "Lumineon", t: 3, f: 2, variants: [{ v: "still a Finneon", g: "crippling" }, { v: "holding a Life Orb", g: "boon" }] },
      { n: "Abomasnow", t: 3, f: 2, variants: [{ v: "Mega Abomasnow", g: "legendary" }, { v: "still a Snover", g: "crippling" }, { v: "running its Hidden Ability", g: "boon" }] },
      { n: "Weavile", t: 3, variants: [{ v: "still a Sneasel", g: "crippling" }, { v: "holding Leftovers, and in no hurry", g: "boon" }] },
      { n: "Magnezone", t: 4, variants: [{ v: "still a Magneton", g: "crippling" }, { v: "two turns into a set-up sweep", g: "major" }] },
      { n: "Lickilicky", t: 3, variants: [{ v: "still a Lickitung", g: "crippling" }, { v: "Focus Sash intact", g: "boon" }] },
      { n: "Rhyperior", t: 4, variants: [{ v: "still a Rhydon", g: "crippling" }, { v: "max Dynamax, three turns of it", g: "major" }] },
      { n: "Tangrowth", t: 4, variants: [{ v: "still a Tangela", g: "crippling" }, { v: "holding an Assault Vest", g: "boon" }] },
      { n: "Electivire", t: 4, variants: [{ v: "still an Electabuzz", g: "crippling" }, { v: "perfect IVs, competitively bred", g: "major" }] },
      { n: "Magmortar", t: 4, variants: [{ v: "still a Magmar", g: "crippling" }, { v: "a Choice Band and nothing to lose", g: "boon" }] },
      { n: "Togekiss", t: 4, variants: [{ v: "still a Togetic", g: "crippling" }, { v: "level 100, fully EV trained", g: "major" }] },
      { n: "Yanmega", t: 3, variants: [{ v: "still a Yanma", g: "crippling" }, { v: "holding a Life Orb", g: "boon" }] },
      { n: "Leafeon", t: 4, f: 5, variants: [{ v: "still an Eevee", g: "crippling" }, { v: "holding a Choice Scarf", g: "boon" }] },
      { n: "Glaceon", t: 4, f: 5, variants: [{ v: "still an Eevee", g: "crippling" }, { v: "Terastallized", g: "major" }] },
      { n: "Gliscor", t: 3, variants: [{ v: "still a Gligar", g: "crippling" }, { v: "running its Hidden Ability", g: "boon" }] },
      { n: "Mamoswine", t: 4, variants: [{ v: "still a Piloswine", g: "crippling" }, { v: "holding Leftovers, and in no hurry", g: "boon" }] },
      { n: "Porygon-Z", t: 4, variants: [{ v: "still a Porygon2", g: "crippling" }, { v: "two turns into a set-up sweep", g: "major" }] },
      { n: "Gallade", t: 3, variants: [{ v: "Mega Gallade", g: "legendary" }, { v: "still a Kirlia", g: "crippling" }, { v: "Focus Sash intact", g: "boon" }] },
      { n: "Probopass", t: 4, variants: [{ v: "still a Nosepass", g: "crippling" }, { v: "max Dynamax, three turns of it", g: "major" }] },
      { n: "Dusknoir", t: 4, variants: [{ v: "still a Dusclops", g: "crippling" }, { v: "holding an Assault Vest", g: "boon" }] },
      { n: "Froslass", t: 3, f: 2, variants: [{ v: "Mega Froslass", g: "legendary" }, { v: "still a Snorunt", g: "crippling" }, { v: "perfect IVs, competitively bred", g: "major" }] },
      { n: "Rotom", t: 2, f: 5, variants: [{ v: "Rotom Wash", g: "boon" }, { v: "Rotom Heat", g: "boon" }, { v: "a Choice Band and nothing to lose", g: "boon" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Uxie", t: 4, f: 4, variants: [{ v: "level 100, fully EV trained", g: "major" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Mesprit", t: 4, f: 4, variants: [{ v: "holding a Life Orb", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Azelf", t: 4, f: 4, variants: [{ v: "holding a Choice Scarf", g: "boon" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Dialga", t: 5, f: 5, variants: [{ v: "Origin Forme", g: "legendary" }, { v: "Terastallized", g: "major" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Palkia", t: 5, f: 5, variants: [{ v: "Origin Forme", g: "legendary" }, { v: "running its Hidden Ability", g: "boon" }, { v: "paralysed", g: "weakening" }] },
      { n: "Heatran", t: 5, f: 4, variants: [{ v: "Mega Heatran", g: "legendary" }, { v: "holding Leftovers, and in no hurry", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Regigigas", t: 5, f: 4, variants: [{ v: "two turns into a set-up sweep", g: "major" }, { v: "out of PP on everything but Struggle", g: "crippling" }] },
      { n: "Giratina", t: 5, f: 5, variants: [{ v: "Origin Forme", g: "legendary" }, { v: "Focus Sash intact", g: "boon" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Cresselia", t: 4, f: 4, variants: [{ v: "max Dynamax, three turns of it", g: "major" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Phione", t: 4, f: 4, variants: [{ v: "holding an Assault Vest", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Manaphy", t: 5, f: 4, variants: [{ v: "perfect IVs, competitively bred", g: "major" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Darkrai", t: 5, f: 5, variants: [{ v: "Mega Darkrai", g: "legendary" }, { v: "a Choice Band and nothing to lose", g: "boon" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Shaymin", t: 5, f: 4, variants: [{ v: "Sky Forme", g: "major" }, { v: "level 100, fully EV trained", g: "major" }, { v: "paralysed", g: "weakening" }] },
      { n: "Arceus", t: 5, f: 5, variants: [{ v: "holding all eighteen plates", g: "mythic" }, { v: "holding a Life Orb", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Victini", t: 5, f: 5, variants: [{ v: "holding a Choice Scarf", g: "boon" }, { v: "out of PP on everything but Struggle", g: "crippling" }] },
      { n: "Snivy", t: 1, f: 4, variants: [{ v: "Terastallized", g: "major" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Serperior", t: 4, variants: [{ v: "still a Servine", g: "crippling" }, { v: "holding Leftovers, and in no hurry", g: "boon" }] },
      { n: "Tepig", t: 1, f: 4, variants: [{ v: "two turns into a set-up sweep", g: "major" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Emboar", t: 4, variants: [{ v: "Mega Emboar", g: "legendary" }, { v: "still a Pignite", g: "crippling" }, { v: "max Dynamax, three turns of it", g: "major" }] },
      { n: "Oshawott", t: 1, f: 4, variants: [{ v: "holding an Assault Vest", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Samurott", t: 4, variants: [{ v: "Hisuian Samurott", g: "neutral" }, { v: "still a Dewott", g: "crippling" }, { v: "a Choice Band and nothing to lose", g: "boon" }] },
      { n: "Patrat", t: 1, f: 2, variants: [{ v: "level 100, fully EV trained", g: "major" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Lillipup", t: 1, f: 2, variants: [{ v: "holding a Choice Scarf", g: "boon" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Stoutland", t: 3, variants: [{ v: "still a Herdier", g: "crippling" }, { v: "running its Hidden Ability", g: "boon" }] },
      { n: "Purrloin", t: 1, f: 2, variants: [{ v: "holding Leftovers, and in no hurry", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Simisage", t: 3, f: 2, variants: [{ v: "still a Pansage", g: "crippling" }, { v: "max Dynamax, three turns of it", g: "major" }] },
      { n: "Simisear", t: 3, f: 2, variants: [{ v: "still a Pansear", g: "crippling" }, { v: "perfect IVs, competitively bred", g: "major" }] },
      { n: "Simipour", t: 3, f: 2, variants: [{ v: "still a Panpour", g: "crippling" }, { v: "level 100, fully EV trained", g: "major" }] },
      { n: "Munna", t: 1, f: 2, variants: [{ v: "holding a Life Orb", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Musharna", t: 3, f: 2, variants: [{ v: "still a Munna", g: "crippling" }, { v: "holding a Choice Scarf", g: "boon" }] },
      { n: "Unfezant", t: 3, f: 2, variants: [{ v: "still a Tranquill", g: "crippling" }, { v: "holding Leftovers, and in no hurry", g: "boon" }] },
      { n: "Zebstrika", t: 3, f: 2, variants: [{ v: "still a Blitzle", g: "crippling" }, { v: "Focus Sash intact", g: "boon" }] },
      { n: "Gigalith", t: 3, variants: [{ v: "still a Boldore", g: "crippling" }, { v: "perfect IVs, competitively bred", g: "major" }] },
      { n: "Woobat", t: 2, f: 2, variants: [{ v: "a Choice Band and nothing to lose", g: "boon" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Drilbur", t: 2, f: 2, variants: [{ v: "holding a Life Orb", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Excadrill", t: 3, variants: [{ v: "Mega Excadrill", g: "legendary" }, { v: "still a Drilbur", g: "crippling" }, { v: "holding a Choice Scarf", g: "boon" }] },
      { n: "Audino", t: 2, f: 2, variants: [{ v: "Mega Audino", g: "legendary" }, { v: "Terastallized", g: "major" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Conkeldurr", t: 3, variants: [{ v: "still a Gurdurr", g: "crippling" }, { v: "two turns into a set-up sweep", g: "major" }] },
      { n: "Tympole", t: 1, f: 2, variants: [{ v: "Focus Sash intact", g: "boon" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Seismitoad", t: 3, variants: [{ v: "still a Palpitoad", g: "crippling" }, { v: "holding an Assault Vest", g: "boon" }] },
      { n: "Throh", t: 3, f: 2, variants: [{ v: "perfect IVs, competitively bred", g: "major" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Sawk", t: 3, f: 2, variants: [{ v: "a Choice Band and nothing to lose", g: "boon" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Leavanny", t: 3, variants: [{ v: "still a Swadloon", g: "crippling" }, { v: "holding a Choice Scarf", g: "boon" }] },
      { n: "Scolipede", t: 3, f: 2, variants: [{ v: "Mega Scolipede", g: "legendary" }, { v: "still a Whirlipede", g: "crippling" }, { v: "holding Leftovers, and in no hurry", g: "boon" }] },
      { n: "Whimsicott", t: 3, f: 2, variants: [{ v: "still a Cottonee", g: "crippling" }, { v: "Focus Sash intact", g: "boon" }] },
      { n: "Lilligant", t: 3, f: 2, variants: [{ v: "Hisuian Lilligant", g: "neutral" }, { v: "still a Petilil", g: "crippling" }, { v: "holding an Assault Vest", g: "boon" }] },
      { n: "Basculin", t: 3, f: 2, variants: [{ v: "perfect IVs, competitively bred", g: "major" }, { v: "out of PP on everything but Struggle", g: "crippling" }] },
      { n: "Krookodile", t: 3, variants: [{ v: "still a Krokorok", g: "crippling" }, { v: "holding a Life Orb", g: "boon" }] },
      { n: "Darmanitan", t: 3, f: 2, variants: [{ v: "Zen Mode", g: "major" }, { v: "Galarian Zen Mode", g: "legendary" }, { v: "still a Darumaka", g: "crippling" }, { v: "Terastallized", g: "major" }] },
      { n: "Maractus", t: 3, f: 2, variants: [{ v: "running its Hidden Ability", g: "boon" }, { v: "paralysed", g: "weakening" }] },
      { n: "Dwebble", t: 2, f: 2, variants: [{ v: "holding Leftovers, and in no hurry", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Crustle", t: 3, f: 2, variants: [{ v: "still a Dwebble", g: "crippling" }, { v: "two turns into a set-up sweep", g: "major" }] },
      { n: "Scraggy", t: 2, f: 2, variants: [{ v: "Focus Sash intact", g: "boon" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Scrafty", t: 3, f: 2, variants: [{ v: "Mega Scrafty", g: "legendary" }, { v: "still a Scraggy", g: "crippling" }, { v: "max Dynamax, three turns of it", g: "major" }] },
      { n: "Sigilyph", t: 3, f: 2, variants: [{ v: "holding an Assault Vest", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Cofagrigus", t: 3, f: 2, variants: [{ v: "still a Yamask", g: "crippling" }, { v: "a Choice Band and nothing to lose", g: "boon" }] },
      { n: "Carracosta", t: 3, f: 2, variants: [{ v: "still a Tirtouga", g: "crippling" }, { v: "holding a Life Orb", g: "boon" }] },
      { n: "Archeops", t: 4, variants: [{ v: "still an Archen", g: "crippling" }, { v: "Terastallized", g: "major" }] },
      { n: "Trubbish", t: 2, f: 2, variants: [{ v: "running its Hidden Ability", g: "boon" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Garbodor", t: 3, f: 2, variants: [{ v: "Gigantamax Garbodor", g: "major" }, { v: "still a Trubbish", g: "crippling" }, { v: "holding Leftovers, and in no hurry", g: "boon" }] },
      { n: "Zoroark", t: 3, f: 5, variants: [{ v: "Hisuian Zoroark", g: "neutral" }, { v: "still a Zorua", g: "crippling" }, { v: "Focus Sash intact", g: "boon" }] },
      { n: "Minccino", t: 1, f: 2, variants: [{ v: "max Dynamax, three turns of it", g: "major" }, { v: "paralysed", g: "weakening" }] },
      { n: "Cinccino", t: 3, f: 2, variants: [{ v: "still a Minccino", g: "crippling" }, { v: "holding an Assault Vest", g: "boon" }] },
      { n: "Gothitelle", t: 3, f: 2, variants: [{ v: "still a Gothorita", g: "crippling" }, { v: "level 100, fully EV trained", g: "major" }] },
      { n: "Reuniclus", t: 3, f: 2, variants: [{ v: "still a Duosion", g: "crippling" }, { v: "Terastallized", g: "major" }] },
      { n: "Swanna", t: 3, f: 2, variants: [{ v: "still a Ducklett", g: "crippling" }, { v: "holding Leftovers, and in no hurry", g: "boon" }] },
      { n: "Vanilluxe", t: 4, variants: [{ v: "still a Vanillish", g: "crippling" }, { v: "max Dynamax, three turns of it", g: "major" }] },
      { n: "Sawsbuck", t: 3, f: 2, variants: [{ v: "still a Deerling", g: "crippling" }, { v: "perfect IVs, competitively bred", g: "major" }] },
      { n: "Escavalier", t: 3, f: 2, variants: [{ v: "still a Karrablast", g: "crippling" }, { v: "holding a Life Orb", g: "boon" }] },
      { n: "Amoonguss", t: 3, f: 2, variants: [{ v: "still a Foongus", g: "crippling" }, { v: "Terastallized", g: "major" }] },
      { n: "Jellicent", t: 3, f: 2, variants: [{ v: "still a Frillish", g: "crippling" }, { v: "holding Leftovers, and in no hurry", g: "boon" }] },
      { n: "Alomomola", t: 3, f: 2, variants: [{ v: "two turns into a set-up sweep", g: "major" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Galvantula", t: 3, f: 2, variants: [{ v: "still a Joltik", g: "crippling" }, { v: "max Dynamax, three turns of it", g: "major" }] },
      { n: "Ferrothorn", t: 3, f: 2, variants: [{ v: "still a Ferroseed", g: "crippling" }, { v: "perfect IVs, competitively bred", g: "major" }] },
      { n: "Klinklang", t: 4, variants: [{ v: "still a Klang", g: "crippling" }, { v: "holding a Life Orb", g: "boon" }] },
      { n: "Eelektross", t: 3, variants: [{ v: "Mega Eelektross", g: "legendary" }, { v: "still an Eelektrik", g: "crippling" }, { v: "running its Hidden Ability", g: "boon" }] },
      { n: "Beheeyem", t: 3, f: 2, variants: [{ v: "still an Elgyem", g: "crippling" }, { v: "two turns into a set-up sweep", g: "major" }] },
      { n: "Chandelure", t: 4, variants: [{ v: "Mega Chandelure", g: "legendary" }, { v: "still a Lampent", g: "crippling" }, { v: "holding an Assault Vest", g: "boon" }] },
      { n: "Haxorus", t: 4, variants: [{ v: "still a Fraxure", g: "crippling" }, { v: "level 100, fully EV trained", g: "major" }] },
      { n: "Beartic", t: 3, variants: [{ v: "still a Cubchoo", g: "crippling" }, { v: "holding a Choice Scarf", g: "boon" }] },
      { n: "Cryogonal", t: 3, variants: [{ v: "Terastallized", g: "major" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Accelgor", t: 3, f: 2, variants: [{ v: "still a Shelmet", g: "crippling" }, { v: "holding Leftovers, and in no hurry", g: "boon" }] },
      { n: "Stunfisk", t: 3, f: 2, variants: [{ v: "Galarian Stunfisk", g: "neutral" }, { v: "two turns into a set-up sweep", g: "major" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Mienshao", t: 3, variants: [{ v: "still a Mienfoo", g: "crippling" }, { v: "max Dynamax, three turns of it", g: "major" }] },
      { n: "Druddigon", t: 3, f: 2, variants: [{ v: "holding an Assault Vest", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Golurk", t: 3, f: 2, variants: [{ v: "Mega Golurk", g: "legendary" }, { v: "still a Golett", g: "crippling" }, { v: "a Choice Band and nothing to lose", g: "boon" }] },
      { n: "Bouffalant", t: 3, f: 2, variants: [{ v: "holding a Choice Scarf", g: "boon" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Braviary", t: 3, variants: [{ v: "Hisuian Braviary", g: "neutral" }, { v: "still a Rufflet", g: "crippling" }, { v: "running its Hidden Ability", g: "boon" }] },
      { n: "Mandibuzz", t: 3, variants: [{ v: "still a Vullaby", g: "crippling" }, { v: "two turns into a set-up sweep", g: "major" }] },
      { n: "Heatmor", t: 3, f: 2, variants: [{ v: "Focus Sash intact", g: "boon" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Durant", t: 3, f: 2, variants: [{ v: "max Dynamax, three turns of it", g: "major" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Hydreigon", t: 5, f: 5, variants: [{ v: "still a Zweilous", g: "crippling" }, { v: "a Choice Band and nothing to lose", g: "boon" }] },
      { n: "Volcarona", t: 4, f: 5, variants: [{ v: "still a Larvesta", g: "crippling" }, { v: "holding a Life Orb", g: "boon" }] },
      { n: "Cobalion", t: 4, f: 4, variants: [{ v: "holding a Choice Scarf", g: "boon" }, { v: "out of PP on everything but Struggle", g: "crippling" }] },
      { n: "Terrakion", t: 4, f: 4, variants: [{ v: "Terastallized", g: "major" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Virizion", t: 4, f: 4, variants: [{ v: "running its Hidden Ability", g: "boon" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Tornadus", t: 4, f: 4, variants: [{ v: "Therian Forme", g: "major" }, { v: "holding Leftovers, and in no hurry", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Thundurus", t: 4, f: 4, variants: [{ v: "Therian Forme", g: "major" }, { v: "two turns into a set-up sweep", g: "major" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Reshiram", t: 5, f: 5, variants: [{ v: "Focus Sash intact", g: "boon" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Zekrom", t: 5, f: 5, variants: [{ v: "max Dynamax, three turns of it", g: "major" }, { v: "paralysed", g: "weakening" }] },
      { n: "Landorus", t: 5, f: 4, variants: [{ v: "Therian Forme", g: "major" }, { v: "holding an Assault Vest", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Kyurem", t: 5, f: 5, variants: [{ v: "Black Kyurem, fused with Zekrom", g: "legendary" }, { v: "White Kyurem, fused with Reshiram", g: "legendary" }, { v: "perfect IVs, competitively bred", g: "major" }, { v: "out of PP on everything but Struggle", g: "crippling" }] },
      { n: "Keldeo", t: 4, f: 5, variants: [{ v: "Resolute Forme", g: "boon" }, { v: "a Choice Band and nothing to lose", g: "boon" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Meloetta", t: 5, f: 5, variants: [{ v: "Pirouette Forme", g: "boon" }, { v: "level 100, fully EV trained", g: "major" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Genesect", t: 5, f: 5, variants: [{ v: "holding a Life Orb", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Chespin", t: 2, f: 4, variants: [{ v: "holding a Choice Scarf", g: "boon" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Chesnaught", t: 4, variants: [{ v: "Mega Chesnaught", g: "legendary" }, { v: "still a Quilladin", g: "crippling" }, { v: "running its Hidden Ability", g: "boon" }] },
      { n: "Fennekin", t: 1, f: 4, variants: [{ v: "holding Leftovers, and in no hurry", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Delphox", t: 4, variants: [{ v: "Mega Delphox", g: "legendary" }, { v: "still a Braixen", g: "crippling" }, { v: "Focus Sash intact", g: "boon" }] },
      { n: "Froakie", t: 2, f: 4, variants: [{ v: "max Dynamax, three turns of it", g: "major" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Greninja", t: 4, f: 5, variants: [{ v: "Mega Greninja", g: "legendary" }, { v: "still a Frogadier", g: "crippling" }, { v: "Ash-Greninja, the Bond Phenomenon", g: "legendary" }, { v: "perfect IVs, competitively bred", g: "major" }] },
      { n: "Bunnelby", t: 1, f: 2, variants: [{ v: "a Choice Band and nothing to lose", g: "boon" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Fletchling", t: 1, f: 2, variants: [{ v: "holding a Life Orb", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Talonflame", t: 3, f: 2, variants: [{ v: "still a Fletchinder", g: "crippling" }, { v: "Terastallized", g: "major" }] },
      { n: "Scatterbug", t: 1, f: 2, variants: [{ v: "running its Hidden Ability", g: "boon" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Litleo", t: 2, f: 2, variants: [{ v: "Focus Sash intact", g: "boon" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Pyroar", t: 3, variants: [{ v: "Mega Pyroar", g: "legendary" }, { v: "still a Litleo", g: "crippling" }, { v: "max Dynamax, three turns of it", g: "major" }] },
      { n: "Flabébé", t: 1, f: 2, variants: [{ v: "holding an Assault Vest", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Florges", t: 4, variants: [{ v: "still a Floette", g: "crippling" }, { v: "a Choice Band and nothing to lose", g: "boon" }] },
      { n: "Skiddo", t: 2, f: 2, variants: [{ v: "level 100, fully EV trained", g: "major" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Gogoat", t: 4, variants: [{ v: "still a Skiddo", g: "crippling" }, { v: "holding a Life Orb", g: "boon" }] },
      { n: "Pancham", t: 2, f: 2, variants: [{ v: "holding a Choice Scarf", g: "boon" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Pangoro", t: 3, f: 2, variants: [{ v: "still a Pancham", g: "crippling" }, { v: "Terastallized", g: "major" }] },
      { n: "Furfrou", t: 3, f: 2, variants: [{ v: "running its Hidden Ability", g: "boon" }, { v: "paralysed", g: "weakening" }] },
      { n: "Espurr", t: 2, f: 2, variants: [{ v: "holding Leftovers, and in no hurry", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Meowstic", t: 3, f: 2, variants: [{ v: "still an Espurr", g: "crippling" }, { v: "two turns into a set-up sweep", g: "major" }] },
      { n: "Honedge", t: 2, f: 2, variants: [{ v: "Focus Sash intact", g: "boon" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Aegislash", t: 3, f: 5, variants: [{ v: "Blade Forme", g: "boon" }, { v: "still a Doublade", g: "crippling" }, { v: "King's Shield up", g: "boon" }, { v: "holding an Assault Vest", g: "boon" }] },
      { n: "Aromatisse", t: 3, f: 2, variants: [{ v: "still a Spritzee", g: "crippling" }, { v: "a Choice Band and nothing to lose", g: "boon" }] },
      { n: "Slurpuff", t: 3, f: 2, variants: [{ v: "still a Swirlix", g: "crippling" }, { v: "holding a Life Orb", g: "boon" }] },
      { n: "Inkay", t: 1, f: 2, variants: [{ v: "holding a Choice Scarf", g: "boon" }, { v: "out of PP on everything but Struggle", g: "crippling" }] },
      { n: "Malamar", t: 3, f: 2, variants: [{ v: "Mega Malamar", g: "legendary" }, { v: "still an Inkay", g: "crippling" }, { v: "Terastallized", g: "major" }] },
      { n: "Barbaracle", t: 3, variants: [{ v: "Mega Barbaracle", g: "legendary" }, { v: "still a Binacle", g: "crippling" }, { v: "holding Leftovers, and in no hurry", g: "boon" }] },
      { n: "Dragalge", t: 3, f: 2, variants: [{ v: "Mega Dragalge", g: "legendary" }, { v: "still a Skrelp", g: "crippling" }, { v: "Focus Sash intact", g: "boon" }] },
      { n: "Clawitzer", t: 3, variants: [{ v: "still a Clauncher", g: "crippling" }, { v: "holding an Assault Vest", g: "boon" }] },
      { n: "Heliolisk", t: 3, f: 2, variants: [{ v: "still a Helioptile", g: "crippling" }, { v: "a Choice Band and nothing to lose", g: "boon" }] },
      { n: "Tyrantrum", t: 4, variants: [{ v: "still a Tyrunt", g: "crippling" }, { v: "holding a Life Orb", g: "boon" }] },
      { n: "Aurorus", t: 4, variants: [{ v: "still an Amaura", g: "crippling" }, { v: "Terastallized", g: "major" }] },
      { n: "Sylveon", t: 4, f: 5, variants: [{ v: "still an Eevee", g: "crippling" }, { v: "running its Hidden Ability", g: "boon" }] },
      { n: "Hawlucha", t: 3, variants: [{ v: "Mega Hawlucha", g: "legendary" }, { v: "holding Leftovers, and in no hurry", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Carbink", t: 3, variants: [{ v: "Focus Sash intact", g: "boon" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Goodra", t: 5, f: 5, variants: [{ v: "Hisuian Goodra", g: "neutral" }, { v: "still a Sliggoo", g: "crippling" }, { v: "perfect IVs, competitively bred", g: "major" }] },
      { n: "Klefki", t: 3, f: 2, variants: [{ v: "a Choice Band and nothing to lose", g: "boon" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Trevenant", t: 3, f: 2, variants: [{ v: "still a Phantump", g: "crippling" }, { v: "holding a Life Orb", g: "boon" }] },
      { n: "Gourgeist", t: 3, f: 2, variants: [{ v: "still a Pumpkaboo", g: "crippling" }, { v: "Terastallized", g: "major" }] },
      { n: "Bergmite", t: 1, f: 2, variants: [{ v: "running its Hidden Ability", g: "boon" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Avalugg", t: 3, variants: [{ v: "Hisuian Avalugg", g: "neutral" }, { v: "still a Bergmite", g: "crippling" }, { v: "holding Leftovers, and in no hurry", g: "boon" }] },
      { n: "Noibat", t: 1, f: 2, variants: [{ v: "two turns into a set-up sweep", g: "major" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Noivern", t: 4, variants: [{ v: "still a Noibat", g: "crippling" }, { v: "Focus Sash intact", g: "boon" }] },
      { n: "Xerneas", t: 5, f: 5, variants: [{ v: "max Dynamax, three turns of it", g: "major" }, { v: "paralysed", g: "weakening" }] },
      { n: "Yveltal", t: 5, f: 5, variants: [{ v: "holding an Assault Vest", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Zygarde", t: 5, f: 5, variants: [{ v: "Complete Forme, all 100 cells", g: "mythic" }, { v: "10 Percent Forme, barely assembled", g: "weakening" }, { v: "perfect IVs, competitively bred", g: "major" }, { v: "out of PP on everything but Struggle", g: "crippling" }] },
      { n: "Diancie", t: 5, f: 4, variants: [{ v: "Mega Diancie", g: "legendary" }, { v: "a Choice Band and nothing to lose", g: "boon" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Hoopa", t: 5, f: 5, variants: [{ v: "Hoopa Unbound", g: "legendary" }, { v: "level 100, fully EV trained", g: "major" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Volcanion", t: 5, f: 5, variants: [{ v: "holding a Life Orb", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Rowlet", t: 2, f: 4, variants: [{ v: "holding a Choice Scarf", g: "boon" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Decidueye", t: 4, f: 5, variants: [{ v: "Hisuian Decidueye", g: "neutral" }, { v: "still a Dartrix", g: "crippling" }, { v: "running its Hidden Ability", g: "boon" }] },
      { n: "Litten", t: 2, f: 4, variants: [{ v: "holding Leftovers, and in no hurry", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Incineroar", t: 4, f: 5, variants: [{ v: "still a Torracat", g: "crippling" }, { v: "Focus Sash intact", g: "boon" }] },
      { n: "Popplio", t: 2, f: 4, variants: [{ v: "max Dynamax, three turns of it", g: "major" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Primarina", t: 4, f: 5, variants: [{ v: "still a Brionne", g: "crippling" }, { v: "perfect IVs, competitively bred", g: "major" }] },
      { n: "Pikipek", t: 1, f: 2, variants: [{ v: "a Choice Band and nothing to lose", g: "boon" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Toucannon", t: 3, f: 2, variants: [{ v: "still a Trumbeak", g: "crippling" }, { v: "holding a Life Orb", g: "boon" }] },
      { n: "Yungoos", t: 1, f: 2, variants: [{ v: "holding a Choice Scarf", g: "boon" }, { v: "out of PP on everything but Struggle", g: "crippling" }] },
      { n: "Grubbin", t: 1, f: 2, variants: [{ v: "running its Hidden Ability", g: "boon" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Vikavolt", t: 3, variants: [{ v: "still a Charjabug", g: "crippling" }, { v: "two turns into a set-up sweep", g: "major" }] },
      { n: "Crabrawler", t: 2, f: 2, variants: [{ v: "Focus Sash intact", g: "boon" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Crabominable", t: 3, f: 2, variants: [{ v: "Mega Crabominable", g: "legendary" }, { v: "still a Crabrawler", g: "crippling" }, { v: "max Dynamax, three turns of it", g: "major" }] },
      { n: "Oricorio", t: 3, f: 2, variants: [{ v: "holding an Assault Vest", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Cutiefly", t: 1, f: 2, variants: [{ v: "perfect IVs, competitively bred", g: "major" }, { v: "out of PP on everything but Struggle", g: "crippling" }] },
      { n: "Ribombee", t: 3, f: 2, variants: [{ v: "still a Cutiefly", g: "crippling" }, { v: "a Choice Band and nothing to lose", g: "boon" }] },
      { n: "Rockruff", t: 1, f: 2, variants: [{ v: "level 100, fully EV trained", g: "major" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Lycanroc", t: 3, f: 2, variants: [{ v: "Dusk Mane Necrozma", g: "legendary" }, { v: "still a Rockruff", g: "crippling" }, { v: "holding a Life Orb", g: "boon" }] },
      { n: "Wishiwashi", t: 1, f: 2, variants: [{ v: "School Form, the whole shoal at once", g: "major" }, { v: "holding a Choice Scarf", g: "boon" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Mareanie", t: 1, f: 2, variants: [{ v: "Terastallized", g: "major" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Toxapex", t: 3, f: 2, variants: [{ v: "still a Mareanie", g: "crippling" }, { v: "running its Hidden Ability", g: "boon" }] },
      { n: "Mudsdale", t: 3, variants: [{ v: "still a Mudbray", g: "crippling" }, { v: "two turns into a set-up sweep", g: "major" }] },
      { n: "Lurantis", t: 3, f: 2, variants: [{ v: "still a Fomantis", g: "crippling" }, { v: "perfect IVs, competitively bred", g: "major" }] },
      { n: "Salazzle", t: 3, f: 2, variants: [{ v: "still a Salandit", g: "crippling" }, { v: "holding a Choice Scarf", g: "boon" }] },
      { n: "Stufful", t: 2, f: 2, variants: [{ v: "Terastallized", g: "major" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Bewear", t: 3, variants: [{ v: "still a Stufful", g: "crippling" }, { v: "running its Hidden Ability", g: "boon" }] },
      { n: "Bounsweet", t: 1, f: 2, variants: [{ v: "holding Leftovers, and in no hurry", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Tsareena", t: 3, variants: [{ v: "still a Steenee", g: "crippling" }, { v: "Focus Sash intact", g: "boon" }] },
      { n: "Comfey", t: 3, f: 2, variants: [{ v: "max Dynamax, three turns of it", g: "major" }, { v: "paralysed", g: "weakening" }] },
      { n: "Oranguru", t: 3, f: 2, variants: [{ v: "holding an Assault Vest", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Passimian", t: 3, f: 2, variants: [{ v: "perfect IVs, competitively bred", g: "major" }, { v: "out of PP on everything but Struggle", g: "crippling" }] },
      { n: "Golisopod", t: 4, variants: [{ v: "Mega Golisopod", g: "legendary" }, { v: "still a Wimpod", g: "crippling" }, { v: "level 100, fully EV trained", g: "major" }] },
      { n: "Palossand", t: 3, f: 2, variants: [{ v: "still a Sandygast", g: "crippling" }, { v: "holding a Choice Scarf", g: "boon" }] },
      { n: "Type: Null", t: 4, f: 4, variants: [{ v: "running its Hidden Ability", g: "boon" }, { v: "paralysed", g: "weakening" }] },
      { n: "Silvally", t: 4, f: 4, variants: [{ v: "still a Type: Null", g: "crippling" }, { v: "holding Leftovers, and in no hurry", g: "boon" }] },
      { n: "Komala", t: 3, f: 2, variants: [{ v: "Focus Sash intact", g: "boon" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Turtonator", t: 3, f: 2, variants: [{ v: "max Dynamax, three turns of it", g: "major" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Mimikyu", t: 3, f: 5, variants: [{ v: "busted — the disguise is gone", g: "weakening" }, { v: "perfect IVs, competitively bred", g: "major" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Bruxish", t: 3, f: 2, variants: [{ v: "a Choice Band and nothing to lose", g: "boon" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Drampa", t: 3, f: 2, variants: [{ v: "Mega Drampa", g: "legendary" }, { v: "level 100, fully EV trained", g: "major" }, { v: "paralysed", g: "weakening" }] },
      { n: "Dhelmise", t: 3, variants: [{ v: "holding a Life Orb", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Kommo-o", t: 5, variants: [{ v: "still a Hakamo-o", g: "crippling" }, { v: "running its Hidden Ability", g: "boon" }] },
      { n: "Tapu Koko", t: 4, f: 4, variants: [{ v: "holding Leftovers, and in no hurry", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Tapu Lele", t: 4, f: 4, variants: [{ v: "two turns into a set-up sweep", g: "major" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Tapu Bulu", t: 4, f: 4, variants: [{ v: "Focus Sash intact", g: "boon" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Tapu Fini", t: 4, f: 4, variants: [{ v: "max Dynamax, three turns of it", g: "major" }, { v: "paralysed", g: "weakening" }] },
      { n: "Cosmog", t: 4, f: 4, variants: [{ v: "it does nothing but Teleport away", g: "crippling" }, { v: "holding an Assault Vest", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Cosmoem", t: 4, f: 4, variants: [{ v: "still a Cosmog", g: "crippling" }, { v: "perfect IVs, competitively bred", g: "major" }] },
      { n: "Solgaleo", t: 5, f: 5, variants: [{ v: "still a Cosmoem", g: "crippling" }, { v: "a Choice Band and nothing to lose", g: "boon" }] },
      { n: "Lunala", t: 5, f: 5, variants: [{ v: "still a Cosmoem", g: "crippling" }, { v: "level 100, fully EV trained", g: "major" }] },
      { n: "Nihilego", t: 4, variants: [{ v: "holding a Life Orb", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Buzzwole", t: 4, variants: [{ v: "holding a Choice Scarf", g: "boon" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Pheromosa", t: 4, variants: [{ v: "Terastallized", g: "major" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Xurkitree", t: 4, variants: [{ v: "running its Hidden Ability", g: "boon" }, { v: "paralysed", g: "weakening" }] },
      { n: "Celesteela", t: 4, variants: [{ v: "holding Leftovers, and in no hurry", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Kartana", t: 4, variants: [{ v: "two turns into a set-up sweep", g: "major" }, { v: "out of PP on everything but Struggle", g: "crippling" }] },
      { n: "Guzzlord", t: 4, variants: [{ v: "Focus Sash intact", g: "boon" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Necrozma", t: 5, f: 5, variants: [{ v: "Dusk Mane Necrozma", g: "legendary" }, { v: "Dawn Wings Necrozma", g: "legendary" }, { v: "Ultra Necrozma", g: "mythic" }, { v: "max Dynamax, three turns of it", g: "major" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Magearna", t: 5, f: 5, variants: [{ v: "Mega Magearna", g: "legendary" }, { v: "holding an Assault Vest", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Marshadow", t: 5, f: 5, variants: [{ v: "perfect IVs, competitively bred", g: "major" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Naganadel", t: 4, variants: [{ v: "still a Poipole", g: "crippling" }, { v: "level 100, fully EV trained", g: "major" }] },
      { n: "Stakataka", t: 4, variants: [{ v: "holding a Life Orb", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Blacephalon", t: 4, variants: [{ v: "holding a Choice Scarf", g: "boon" }, { v: "out of PP on everything but Struggle", g: "crippling" }] },
      { n: "Zeraora", t: 5, f: 5, variants: [{ v: "Mega Zeraora", g: "legendary" }, { v: "Terastallized", g: "major" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Meltan", t: 4, f: 4, variants: [{ v: "running its Hidden Ability", g: "boon" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Melmetal", t: 5, f: 5, variants: [{ v: "Gigantamax Melmetal", g: "major" }, { v: "still a Meltan", g: "crippling" }, { v: "holding Leftovers, and in no hurry", g: "boon" }] },
      { n: "Grookey", t: 2, f: 4, variants: [{ v: "two turns into a set-up sweep", g: "major" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Rillaboom", t: 4, f: 5, variants: [{ v: "Gigantamax Rillaboom", g: "major" }, { v: "still a Thwackey", g: "crippling" }, { v: "max Dynamax, three turns of it", g: "major" }] },
      { n: "Scorbunny", t: 2, f: 4, variants: [{ v: "holding an Assault Vest", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Cinderace", t: 4, f: 5, variants: [{ v: "Gigantamax Cinderace", g: "major" }, { v: "still a Raboot", g: "crippling" }, { v: "a Choice Band and nothing to lose", g: "boon" }] },
      { n: "Sobble", t: 2, f: 4, variants: [{ v: "level 100, fully EV trained", g: "major" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Inteleon", t: 4, f: 5, variants: [{ v: "Gigantamax Inteleon", g: "major" }, { v: "still a Drizzile", g: "crippling" }, { v: "holding a Choice Scarf", g: "boon" }] },
      { n: "Skwovet", t: 1, f: 2, variants: [{ v: "Terastallized", g: "major" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Greedent", t: 3, f: 2, variants: [{ v: "still a Skwovet", g: "crippling" }, { v: "running its Hidden Ability", g: "boon" }] },
      { n: "Rookidee", t: 1, f: 2, variants: [{ v: "holding Leftovers, and in no hurry", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Corviknight", t: 3, f: 5, variants: [{ v: "Gigantamax Corviknight", g: "major" }, { v: "still a Corvisquire", g: "crippling" }, { v: "Focus Sash intact", g: "boon" }] },
      { n: "Blipbug", t: 1, f: 2, variants: [{ v: "max Dynamax, three turns of it", g: "major" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Orbeetle", t: 3, variants: [{ v: "Gigantamax Orbeetle", g: "major" }, { v: "still a Dottler", g: "crippling" }, { v: "perfect IVs, competitively bred", g: "major" }] },
      { n: "Nickit", t: 1, f: 2, variants: [{ v: "a Choice Band and nothing to lose", g: "boon" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Gossifleur", t: 1, f: 2, variants: [{ v: "holding a Life Orb", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Eldegoss", t: 3, f: 2, variants: [{ v: "still a Gossifleur", g: "crippling" }, { v: "holding a Choice Scarf", g: "boon" }] },
      { n: "Dubwool", t: 3, f: 2, variants: [{ v: "still a Wooloo", g: "crippling" }, { v: "running its Hidden Ability", g: "boon" }] },
      { n: "Chewtle", t: 1, f: 2, variants: [{ v: "holding Leftovers, and in no hurry", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Drednaw", t: 3, f: 2, variants: [{ v: "Gigantamax Drednaw", g: "major" }, { v: "still a Chewtle", g: "crippling" }, { v: "two turns into a set-up sweep", g: "major" }] },
      { n: "Yamper", t: 1, f: 2, variants: [{ v: "Focus Sash intact", g: "boon" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Boltund", t: 3, f: 2, variants: [{ v: "still a Yamper", g: "crippling" }, { v: "max Dynamax, three turns of it", g: "major" }] },
      { n: "Rolycoly", t: 1, f: 2, variants: [{ v: "holding an Assault Vest", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Coalossal", t: 3, variants: [{ v: "Gigantamax Coalossal", g: "major" }, { v: "still a Carkol", g: "crippling" }, { v: "a Choice Band and nothing to lose", g: "boon" }] },
      { n: "Applin", t: 1, f: 2, variants: [{ v: "level 100, fully EV trained", g: "major" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Flapple", t: 3, f: 2, variants: [{ v: "Gigantamax Flapple", g: "major" }, { v: "still an Applin", g: "crippling" }, { v: "holding a Life Orb", g: "boon" }] },
      { n: "Appletun", t: 3, f: 2, variants: [{ v: "Gigantamax Appletun", g: "major" }, { v: "still an Applin", g: "crippling" }, { v: "holding a Choice Scarf", g: "boon" }] },
      { n: "Silicobra", t: 2, f: 2, variants: [{ v: "Terastallized", g: "major" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Sandaconda", t: 3, variants: [{ v: "Gigantamax Sandaconda", g: "major" }, { v: "still a Silicobra", g: "crippling" }, { v: "running its Hidden Ability", g: "boon" }] },
      { n: "Cramorant", t: 3, f: 2, variants: [{ v: "Gulping Form, mid-swallow", g: "boon" }, { v: "holding Leftovers, and in no hurry", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Arrokuda", t: 1, f: 2, variants: [{ v: "two turns into a set-up sweep", g: "major" }, { v: "out of PP on everything but Struggle", g: "crippling" }] },
      { n: "Barraskewda", t: 3, f: 2, variants: [{ v: "still an Arrokuda", g: "crippling" }, { v: "Focus Sash intact", g: "boon" }] },
      { n: "Toxel", t: 1, f: 2, variants: [{ v: "max Dynamax, three turns of it", g: "major" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Toxtricity", t: 3, f: 5, variants: [{ v: "still a Toxel", g: "crippling" }, { v: "holding an Assault Vest", g: "boon" }] },
      { n: "Sizzlipede", t: 1, f: 2, variants: [{ v: "perfect IVs, competitively bred", g: "major" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Centiskorch", t: 4, variants: [{ v: "Gigantamax Centiskorch", g: "major" }, { v: "still a Sizzlipede", g: "crippling" }, { v: "a Choice Band and nothing to lose", g: "boon" }] },
      { n: "Clobbopus", t: 2, f: 2, variants: [{ v: "level 100, fully EV trained", g: "major" }, { v: "paralysed", g: "weakening" }] },
      { n: "Grapploct", t: 3, f: 2, variants: [{ v: "still a Clobbopus", g: "crippling" }, { v: "holding a Life Orb", g: "boon" }] },
      { n: "Sinistea", t: 1, f: 2, variants: [{ v: "holding a Choice Scarf", g: "boon" }, { v: "out of PP on everything but Struggle", g: "crippling" }] },
      { n: "Polteageist", t: 3, variants: [{ v: "still a Sinistea", g: "crippling" }, { v: "Terastallized", g: "major" }] },
      { n: "Hatenna", t: 1, f: 2, variants: [{ v: "running its Hidden Ability", g: "boon" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Hatterene", t: 3, variants: [{ v: "Gigantamax Hatterene", g: "major" }, { v: "still a Hattrem", g: "crippling" }, { v: "two turns into a set-up sweep", g: "major" }] },
      { n: "Impidimp", t: 1, f: 2, variants: [{ v: "Focus Sash intact", g: "boon" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Grimmsnarl", t: 3, variants: [{ v: "Gigantamax Grimmsnarl", g: "major" }, { v: "still a Morgrem", g: "crippling" }, { v: "holding an Assault Vest", g: "boon" }] },
      { n: "Obstagoon", t: 4, variants: [{ v: "still a Linoone", g: "crippling" }, { v: "perfect IVs, competitively bred", g: "major" }] },
      { n: "Cursola", t: 3, variants: [{ v: "still a Corsola", g: "crippling" }, { v: "level 100, fully EV trained", g: "major" }] },
      { n: "Sirfetch’d", t: 3, variants: [{ v: "still a Farfetch’d", g: "crippling" }, { v: "holding a Life Orb", g: "boon" }] },
      { n: "Mr. Rime", t: 4, variants: [{ v: "still a Mr. Mime", g: "crippling" }, { v: "holding a Choice Scarf", g: "boon" }] },
      { n: "Runerigus", t: 3, f: 2, variants: [{ v: "still a Yamask", g: "crippling" }, { v: "Terastallized", g: "major" }] },
      { n: "Milcery", t: 1, f: 2, variants: [{ v: "running its Hidden Ability", g: "boon" }, { v: "paralysed", g: "weakening" }] },
      { n: "Alcremie", t: 3, f: 2, variants: [{ v: "Gigantamax Alcremie", g: "major" }, { v: "still a Milcery", g: "crippling" }, { v: "holding Leftovers, and in no hurry", g: "boon" }] },
      { n: "Falinks", t: 3, f: 2, variants: [{ v: "Mega Falinks", g: "legendary" }, { v: "two turns into a set-up sweep", g: "major" }, { v: "out of PP on everything but Struggle", g: "crippling" }] },
      { n: "Frosmoth", t: 3, f: 2, variants: [{ v: "still a Snom", g: "crippling" }, { v: "holding an Assault Vest", g: "boon" }] },
      { n: "Stonjourner", t: 3, f: 2, variants: [{ v: "perfect IVs, competitively bred", g: "major" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Eiscue", t: 3, f: 2, variants: [{ v: "No Ice Face", g: "weakening" }, { v: "a Choice Band and nothing to lose", g: "boon" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Indeedee", t: 3, f: 2, variants: [{ v: "level 100, fully EV trained", g: "major" }, { v: "paralysed", g: "weakening" }] },
      { n: "Copperajah", t: 3, variants: [{ v: "Gigantamax Copperajah", g: "major" }, { v: "still a Cufant", g: "crippling" }, { v: "Terastallized", g: "major" }] },
      { n: "Dracozolt", t: 3, variants: [{ v: "running its Hidden Ability", g: "boon" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Arctozolt", t: 3, variants: [{ v: "holding Leftovers, and in no hurry", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Dracovish", t: 3, variants: [{ v: "two turns into a set-up sweep", g: "major" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Arctovish", t: 3, variants: [{ v: "Focus Sash intact", g: "boon" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Dragapult", t: 5, f: 5, variants: [{ v: "still a Drakloak", g: "crippling" }, { v: "a Choice Band and nothing to lose", g: "boon" }] },
      { n: "Zacian", t: 5, f: 5, variants: [{ v: "level 100, fully EV trained", g: "major" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Zamazenta", t: 5, f: 5, variants: [{ v: "holding a Life Orb", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Eternatus", t: 5, f: 5, variants: [{ v: "Eternamax", g: "mythic" }, { v: "holding a Choice Scarf", g: "boon" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Kubfu", t: 4, f: 4, variants: [{ v: "Terastallized", g: "major" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Urshifu", t: 4, f: 4, variants: [{ v: "Rapid Strike Style", g: "neutral" }, { v: "still a Kubfu", g: "crippling" }, { v: "running its Hidden Ability", g: "boon" }] },
      { n: "Zarude", t: 5, f: 4, variants: [{ v: "holding Leftovers, and in no hurry", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Regieleki", t: 4, f: 4, variants: [{ v: "two turns into a set-up sweep", g: "major" }, { v: "out of PP on everything but Struggle", g: "crippling" }] },
      { n: "Regidrago", t: 4, f: 4, variants: [{ v: "Focus Sash intact", g: "boon" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Glastrier", t: 4, f: 4, variants: [{ v: "max Dynamax, three turns of it", g: "major" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Spectrier", t: 4, f: 4, variants: [{ v: "holding an Assault Vest", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Calyrex", t: 4, f: 4, variants: [{ v: "Ice Rider, on Glastrier", g: "legendary" }, { v: "Shadow Rider, on Spectrier", g: "legendary" }, { v: "perfect IVs, competitively bred", g: "major" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Wyrdeer", t: 4, variants: [{ v: "still a Stantler", g: "crippling" }, { v: "a Choice Band and nothing to lose", g: "boon" }] },
      { n: "Kleavor", t: 3, variants: [{ v: "still a Scyther", g: "crippling" }, { v: "level 100, fully EV trained", g: "major" }] },
      { n: "Ursaluna", t: 4, variants: [{ v: "still an Ursaring", g: "crippling" }, { v: "holding a Life Orb", g: "boon" }] },
      { n: "Basculegion", t: 4, variants: [{ v: "still a Basculin", g: "crippling" }, { v: "holding a Choice Scarf", g: "boon" }] },
      { n: "Sneasler", t: 3, variants: [{ v: "still a Sneasel", g: "crippling" }, { v: "Terastallized", g: "major" }] },
      { n: "Overqwil", t: 3, variants: [{ v: "still a Qwilfish", g: "crippling" }, { v: "running its Hidden Ability", g: "boon" }] },
      { n: "Enamorus", t: 4, f: 4, variants: [{ v: "Therian Forme", g: "major" }, { v: "holding Leftovers, and in no hurry", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Sprigatito", t: 2, f: 4, variants: [{ v: "two turns into a set-up sweep", g: "major" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Meowscarada", t: 4, f: 5, variants: [{ v: "still a Floragato", g: "crippling" }, { v: "max Dynamax, three turns of it", g: "major" }] },
      { n: "Fuecoco", t: 2, f: 4, variants: [{ v: "holding an Assault Vest", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Skeledirge", t: 4, f: 5, variants: [{ v: "still a Crocalor", g: "crippling" }, { v: "a Choice Band and nothing to lose", g: "boon" }] },
      { n: "Quaxly", t: 2, f: 4, variants: [{ v: "level 100, fully EV trained", g: "major" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Quaquaval", t: 4, f: 5, variants: [{ v: "still a Quaxwell", g: "crippling" }, { v: "holding a Choice Scarf", g: "boon" }] },
      { n: "Lechonk", t: 1, f: 2, variants: [{ v: "Terastallized", g: "major" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Oinkologne", t: 3, f: 2, variants: [{ v: "still a Lechonk", g: "crippling" }, { v: "running its Hidden Ability", g: "boon" }] },
      { n: "Tarountula", t: 1, f: 2, variants: [{ v: "holding Leftovers, and in no hurry", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Nymble", t: 1, f: 2, variants: [{ v: "Focus Sash intact", g: "boon" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Pawmi", t: 1, f: 2, variants: [{ v: "holding an Assault Vest", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Pawmot", t: 3, f: 2, variants: [{ v: "still a Pawmo", g: "crippling" }, { v: "a Choice Band and nothing to lose", g: "boon" }] },
      { n: "Tandemaus", t: 1, f: 2, variants: [{ v: "level 100, fully EV trained", g: "major" }, { v: "paralysed", g: "weakening" }] },
      { n: "Maushold", t: 3, f: 2, variants: [{ v: "still a Tandemaus", g: "crippling" }, { v: "holding a Life Orb", g: "boon" }] },
      { n: "Fidough", t: 2, f: 2, variants: [{ v: "holding a Choice Scarf", g: "boon" }, { v: "out of PP on everything but Struggle", g: "crippling" }] },
      { n: "Dachsbun", t: 3, f: 2, variants: [{ v: "still a Fidough", g: "crippling" }, { v: "Terastallized", g: "major" }] },
      { n: "Smoliv", t: 1, f: 2, variants: [{ v: "running its Hidden Ability", g: "boon" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Arboliva", t: 3, variants: [{ v: "still a Dolliv", g: "crippling" }, { v: "two turns into a set-up sweep", g: "major" }] },
      { n: "Nacli", t: 1, f: 2, variants: [{ v: "max Dynamax, three turns of it", g: "major" }, { v: "paralysed", g: "weakening" }] },
      { n: "Garganacl", t: 3, variants: [{ v: "still a Naclstack", g: "crippling" }, { v: "perfect IVs, competitively bred", g: "major" }] },
      { n: "Armarouge", t: 4, variants: [{ v: "still a Charcadet", g: "crippling" }, { v: "level 100, fully EV trained", g: "major" }] },
      { n: "Ceruledge", t: 4, variants: [{ v: "still a Charcadet", g: "crippling" }, { v: "holding a Life Orb", g: "boon" }] },
      { n: "Tadbulb", t: 1, f: 2, variants: [{ v: "holding a Choice Scarf", g: "boon" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Bellibolt", t: 3, f: 2, variants: [{ v: "still a Tadbulb", g: "crippling" }, { v: "Terastallized", g: "major" }] },
      { n: "Wattrel", t: 1, f: 2, variants: [{ v: "running its Hidden Ability", g: "boon" }, { v: "paralysed", g: "weakening" }] },
      { n: "Kilowattrel", t: 3, f: 2, variants: [{ v: "still a Wattrel", g: "crippling" }, { v: "holding Leftovers, and in no hurry", g: "boon" }] },
      { n: "Maschiff", t: 2, f: 2, variants: [{ v: "two turns into a set-up sweep", g: "major" }, { v: "out of PP on everything but Struggle", g: "crippling" }] },
      { n: "Mabosstiff", t: 3, variants: [{ v: "still a Maschiff", g: "crippling" }, { v: "Focus Sash intact", g: "boon" }] },
      { n: "Shroodle", t: 1, f: 2, variants: [{ v: "max Dynamax, three turns of it", g: "major" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Grafaiai", t: 3, f: 2, variants: [{ v: "still a Shroodle", g: "crippling" }, { v: "holding an Assault Vest", g: "boon" }] },
      { n: "Bramblin", t: 1, f: 2, variants: [{ v: "perfect IVs, competitively bred", g: "major" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Brambleghast", t: 3, f: 2, variants: [{ v: "still a Bramblin", g: "crippling" }, { v: "a Choice Band and nothing to lose", g: "boon" }] },
      { n: "Toedscruel", t: 3, variants: [{ v: "still a Toedscool", g: "crippling" }, { v: "holding a Life Orb", g: "boon" }] },
      { n: "Scovillain", t: 3, f: 2, variants: [{ v: "Mega Scovillain", g: "legendary" }, { v: "still a Capsakid", g: "crippling" }, { v: "running its Hidden Ability", g: "boon" }] },
      { n: "Rabsca", t: 3, f: 2, variants: [{ v: "still a Rellor", g: "crippling" }, { v: "two turns into a set-up sweep", g: "major" }] },
      { n: "Flittle", t: 1, f: 2, variants: [{ v: "Focus Sash intact", g: "boon" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Espathra", t: 3, f: 2, variants: [{ v: "still a Flittle", g: "crippling" }, { v: "max Dynamax, three turns of it", g: "major" }] },
      { n: "Tinkaton", t: 3, f: 5, variants: [{ v: "still a Tinkatuff", g: "crippling" }, { v: "a Choice Band and nothing to lose", g: "boon" }] },
      { n: "Bombirdier", t: 3, f: 2, variants: [{ v: "holding a Choice Scarf", g: "boon" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Finizen", t: 2, f: 2, variants: [{ v: "Terastallized", g: "major" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Varoom", t: 1, f: 2, variants: [{ v: "holding Leftovers, and in no hurry", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Revavroom", t: 3, variants: [{ v: "still a Varoom", g: "crippling" }, { v: "two turns into a set-up sweep", g: "major" }] },
      { n: "Cyclizar", t: 3, variants: [{ v: "Focus Sash intact", g: "boon" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Orthworm", t: 3, f: 2, variants: [{ v: "max Dynamax, three turns of it", g: "major" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Glimmora", t: 4, variants: [{ v: "Mega Glimmora", g: "legendary" }, { v: "still a Glimmet", g: "crippling" }, { v: "perfect IVs, competitively bred", g: "major" }] },
      { n: "Houndstone", t: 3, f: 2, variants: [{ v: "still a Greavard", g: "crippling" }, { v: "level 100, fully EV trained", g: "major" }] },
      { n: "Flamigo", t: 3, variants: [{ v: "holding a Life Orb", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Cetitan", t: 4, variants: [{ v: "still a Cetoddle", g: "crippling" }, { v: "Terastallized", g: "major" }] },
      { n: "Veluza", t: 3, f: 2, variants: [{ v: "running its Hidden Ability", g: "boon" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Dondozo", t: 4, variants: [{ v: "holding Leftovers, and in no hurry", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Tatsugiri", t: 3, f: 2, variants: [{ v: "two turns into a set-up sweep", g: "major" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Annihilape", t: 4, f: 5, variants: [{ v: "still a Primeape", g: "crippling" }, { v: "Focus Sash intact", g: "boon" }] },
      { n: "Farigiraf", t: 4, variants: [{ v: "still a Girafarig", g: "crippling" }, { v: "holding an Assault Vest", g: "boon" }] },
      { n: "Dudunsparce", t: 4, variants: [{ v: "Three-Segment Form", g: "boon" }, { v: "still a Dunsparce", g: "crippling" }, { v: "perfect IVs, competitively bred", g: "major" }] },
      { n: "Kingambit", t: 4, f: 5, variants: [{ v: "still a Bisharp", g: "crippling" }, { v: "a Choice Band and nothing to lose", g: "boon" }] },
      { n: "Great Tusk", t: 4, variants: [{ v: "level 100, fully EV trained", g: "major" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Scream Tail", t: 4, variants: [{ v: "holding a Life Orb", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Brute Bonnet", t: 4, variants: [{ v: "holding a Choice Scarf", g: "boon" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Flutter Mane", t: 4, variants: [{ v: "Terastallized", g: "major" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Slither Wing", t: 4, variants: [{ v: "running its Hidden Ability", g: "boon" }, { v: "paralysed", g: "weakening" }] },
      { n: "Sandy Shocks", t: 4, variants: [{ v: "holding Leftovers, and in no hurry", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Iron Treads", t: 4, variants: [{ v: "two turns into a set-up sweep", g: "major" }, { v: "out of PP on everything but Struggle", g: "crippling" }] },
      { n: "Iron Bundle", t: 4, variants: [{ v: "Focus Sash intact", g: "boon" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Iron Hands", t: 4, variants: [{ v: "max Dynamax, three turns of it", g: "major" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Iron Jugulis", t: 4, variants: [{ v: "holding an Assault Vest", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Iron Moth", t: 4, variants: [{ v: "perfect IVs, competitively bred", g: "major" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Iron Thorns", t: 4, variants: [{ v: "a Choice Band and nothing to lose", g: "boon" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Baxcalibur", t: 5, f: 5, variants: [{ v: "Mega Baxcalibur", g: "legendary" }, { v: "still an Arctibax", g: "crippling" }, { v: "holding a Choice Scarf", g: "boon" }] },
      { n: "Gholdengo", t: 4, f: 5, variants: [{ v: "still a Gimmighoul", g: "crippling" }, { v: "running its Hidden Ability", g: "boon" }] },
      { n: "Wo-Chien", t: 4, f: 4, variants: [{ v: "holding Leftovers, and in no hurry", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Chien-Pao", t: 4, f: 4, variants: [{ v: "two turns into a set-up sweep", g: "major" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Ting-Lu", t: 4, f: 4, variants: [{ v: "Focus Sash intact", g: "boon" }, { v: "freshly caught, level 5", g: "crippling" }] },
      { n: "Chi-Yu", t: 4, f: 4, variants: [{ v: "max Dynamax, three turns of it", g: "major" }, { v: "paralysed", g: "weakening" }] },
      { n: "Roaring Moon", t: 4, variants: [{ v: "holding an Assault Vest", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Iron Valiant", t: 4, variants: [{ v: "perfect IVs, competitively bred", g: "major" }, { v: "out of PP on everything but Struggle", g: "crippling" }] },
      { n: "Koraidon", t: 5, f: 5, variants: [{ v: "a Choice Band and nothing to lose", g: "boon" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Miraidon", t: 5, f: 5, variants: [{ v: "level 100, fully EV trained", g: "major" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Walking Wake", t: 4, variants: [{ v: "holding a Life Orb", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Iron Leaves", t: 4, variants: [{ v: "holding a Choice Scarf", g: "boon" }, { v: "down to its last hit point", g: "weakening" }] },
      { n: "Sinistcha", t: 3, variants: [{ v: "still a Poltchageist", g: "crippling" }, { v: "holding Leftovers, and in no hurry", g: "boon" }] },
      { n: "Okidogi", t: 4, f: 4, variants: [{ v: "two turns into a set-up sweep", g: "major" }, { v: "out of PP on everything but Struggle", g: "crippling" }] },
      { n: "Munkidori", t: 4, f: 4, variants: [{ v: "Focus Sash intact", g: "boon" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Fezandipiti", t: 4, f: 4, variants: [{ v: "max Dynamax, three turns of it", g: "major" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Ogerpon", t: 4, f: 4, variants: [{ v: "wearing the Wellspring Mask", g: "boon" }, { v: "wearing the Hearthflame Mask", g: "boon" }, { v: "wearing the Cornerstone Mask", g: "boon" }, { v: "holding an Assault Vest", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
      { n: "Archaludon", t: 5, variants: [{ v: "still a Duraludon", g: "crippling" }, { v: "perfect IVs, competitively bred", g: "major" }] },
      { n: "Hydrapple", t: 4, variants: [{ v: "still a Dipplin", g: "crippling" }, { v: "a Choice Band and nothing to lose", g: "boon" }] },
      { n: "Gouging Fire", t: 4, variants: [{ v: "level 100, fully EV trained", g: "major" }, { v: "paralysed", g: "weakening" }] },
      { n: "Raging Bolt", t: 4, variants: [{ v: "holding a Life Orb", g: "boon" }, { v: "confused, hitting itself", g: "weakening" }] },
      { n: "Iron Boulder", t: 4, variants: [{ v: "holding a Choice Scarf", g: "boon" }, { v: "out of PP on everything but Struggle", g: "crippling" }] },
      { n: "Iron Crown", t: 4, variants: [{ v: "Terastallized", g: "major" }, { v: "burned, attack halved", g: "weakening" }] },
      { n: "Terapagos", t: 4, f: 4, variants: [{ v: "Terastallized, Stellar type", g: "legendary" }, { v: "running its Hidden Ability", g: "boon" }, { v: "badly poisoned", g: "weakening" }] },
      { n: "Pecharunt", t: 5, f: 4, variants: [{ v: "holding Leftovers, and in no hurry", g: "boon" }, { v: "asleep, and nobody packed a Full Heal", g: "weakening" }] },
    ],
  },

  // ── Animals ───────────────────────────────────────────────────────────────
  {
    id: "animals",
    name: "Animal Kingdom",
    emoji: "🦁",
    blurb: "Deadliest squad wins. Yes, the goose is a real pick.",
    imgContext: "animal",
    scenario:
      "Both drafted packs are released into a neutral arena the size of a football field. Last pack standing wins.",
    criteria:
      "Bite force, speed, armour, aggression, and pack coordination. Size helps but does not decide it.",
    arenas: [
      { name: "An open grass field", desc: "Flat, dry grassland the size of a football pitch. No cover, no water.", weight: 12 },
      { name: "Dense forest", desc: "Close quarters, broken sightlines, and climbers have the run of it.", weight: 4 },
      { name: "Open water", desc: "Deep water, no shore in reach. Anything that cannot swim is in serious trouble.", weight: 2 },
      { name: "Arctic tundra", desc: "Killing cold, ice underfoot, and nothing to eat.", weight: 2 },
      { name: "A narrow river crossing", desc: "Waist-deep water and slick rock — half a fight on land, half in the shallows.", weight: 3 },
    ],
    entries: [
      { n: "Saltwater Crocodile", t: 5, variants: [{ v: "in water", g: "major" }, { v: "on dry land", t: 3 }] },
      { n: "Grizzly Bear", t: 5, f: 5 },
      { n: "Siberian Tiger", t: 5, f: 5 },
      { n: "African Elephant", t: 5, f: 5, variants: [{ v: "bull in musth", g: "boon" }, { v: "calm cow", g: "neutral" }] },
      { n: "Hippopotamus", t: 5, f: 5 },
      { n: "Cape Buffalo", t: 4 },
      { n: "Silverback Gorilla", t: 5, f: 5 },
      { n: "Lion", t: 4, f: 5, variants: [{ v: "male with a full pride", t: 5 }, { v: "lone male", g: "weakening" }, { v: "old, missing teeth", t: 2 }] },
      { n: "Grey Wolf", t: 3, f: 5, variants: [{ v: "full pack of eight", t: 5 }, { v: "lone wolf", g: "weakening" }] },
      { n: "Honey Badger", t: 3, f: 5 },
      { n: "Wolverine", s: "Gulo gulo animal", t: 3 },
      { n: "Komodo Dragon", t: 4, f: 5 },
      { n: "Great White Shark", t: 5, f: 5, variants: [{ v: "in water", g: "major" }, { v: "beached", t: 1 }] },
      { n: "Rhinoceros", t: 5 },
      { n: "Moose", t: 4 },
      { n: "Canada Goose", t: 2 },
      { n: "Cassowary", t: 4 },
      { n: "Chimpanzee", t: 4 },
      { n: "Anaconda", t: 4, f: 5 },
      { n: "Polar Bear", t: 5, f: 5 },
      { n: "Ostrich", t: 3 },
      { n: "Spotted Hyena", t: 3, variants: [{ v: "clan of six", t: 4 }, { v: "single", t: 2 }] },
      { n: "Red Kangaroo", t: 3 },
      { n: "Housecat", t: 1, f: 1 },
      { n: "Emu", t: 3 },
      { n: "Wild Boar", t: 3 },
      { n: "Bald Eagle", t: 2 },
      { n: "Sloth", t: 1, f: 1 },
      // Pinned: Mark photographed these, so they're guaranteed to be dealt.
      { n: "Dire Wolves", t: 5, s: "dire wolf Aenocyon dirus", variants: [{ v: "a pack of six, de-extincted", g: "boon" }, { v: "one lone dire wolf", g: "weakening" }] },
      { n: "Liger", t: 5, s: "liger lion tiger hybrid" },
      { n: "Orca", t: 5, f: 5, s: "killer whale", variants: [{ v: "hunting pod, coordinated", g: "boon" }, { v: "beached", g: "crippling" }] },
      { n: "African Elephant", t: 5, f: 5, variants: [{ v: "bull in musth", g: "boon" }, { v: "calm cow", g: "neutral" }] },
      { n: "Anaconda", t: 4, f: 5, s: "green anaconda" },
      { n: "Polar Bear", t: 5, f: 5 },
      { n: "Moose", t: 4, variants: [{ v: "bull in rut", t: 5 }, { v: "yearling", t: 2 }] },
      // Wider pool — more of the board is unfamiliar each game.
      { n: "Wolf Pack", t: 5, s: "grey wolf pack hunting" },
      { n: "Jaguar", t: 4 },
      { n: "Leopard", t: 4 },
      { n: "Snow Leopard", t: 3 },
      { n: "Black Bear", t: 4 },
      { n: "Kodiak Bear", t: 5 },
      { n: "Sun Bear", t: 2, f: 1 },
      { n: "Nile Crocodile", t: 5 },
      { n: "Alligator Snapping Turtle", t: 3 },
      { n: "King Cobra", t: 4 },
      { n: "Black Mamba", t: 4 },
      { n: "Inland Taipan", t: 4, s: "inland taipan snake" },
      { n: "Reticulated Python", t: 4 },
      { n: "Gila Monster", t: 2, f: 1 },
      { n: "Tiger Shark", t: 4 },
      { n: "Bull Shark", t: 4 },
      { n: "Sperm Whale", t: 5 },
      { n: "Giant Squid", t: 4 },
      { n: "Blue-Ringed Octopus", t: 3, s: "blue ringed octopus" },
      { n: "Box Jellyfish", t: 3 },
      { n: "Electric Eel", t: 3 },
      { n: "Piranha Shoal", t: 3, s: "piranha school" },
      { n: "Golden Eagle", t: 3 },
      { n: "Harpy Eagle", t: 4 },
      { n: "Great Horned Owl", t: 3 },
      { n: "Secretary Bird", t: 3 },
      { n: "Swan", t: 2, s: "mute swan aggressive" },
      { n: "Wolverine", s: "Gulo gulo animal", t: 3 },
      { n: "Tasmanian Devil", t: 2 },
      { n: "Warthog", t: 3 },
      { n: "Bison", t: 5, s: "American bison" },
      { n: "Musk Ox", t: 4 },
      { n: "Giraffe", t: 4, variants: [{ v: "kicking, and it connects", t: 5 }, { v: "just eating leaves", t: 2 }] },
      { n: "Zebra", t: 3 },
      { n: "Baboon", t: 3 },
      { n: "Orangutan", t: 4 },
      { n: "Mantis Shrimp", t: 2, s: "peacock mantis shrimp" },
      { n: "Army Ant Swarm", t: 4, s: "army ants swarm" },
      { n: "Africanized Bees", t: 3, s: "killer bee swarm" },
      { n: "Pufferfish", t: 1, f: 1 },
      { n: "Chihuahua", t: 1, f: 1 },
      { n: "Pigeon", t: 1, f: 1 },
      { n: "Koala", t: 1, f: 1 },
      { n: "Capybara", t: 1, f: 1 },
      { n: "Platypus", t: 2, f: 1, variants: [{ v: "male, venomous spur", t: 3 }, { v: "female, no spur", t: 1 }] },
    ],
  },

  // ── Star Wars ─────────────────────────────────────────────────────────────
  {
    id: "starwars",
    name: "Star Wars",
    emoji: "⚔️",
    blurb: "Lightsabers, blasters, and one guy with a very good hat.",
    imgContext: "Star Wars character",
    wiki: "starwars",
    scenario:
      "Both squads board opposite ends of a derelict Star Destroyer. One team walks off it.",
    criteria:
      "Force ability, combat skill, and equipment. A great pilot is worth much less in a corridor fight.",
    arenas: [
      { name: "A derelict Star Destroyer", desc: "Corridors and hangar bays. Blasters are useful; a lightsaber is better.", weight: 10 },
      { name: "Mustafar", desc: "Lava, unbearable heat, and platforms that will not hold forever.", weight: 3 },
      { name: "Open space, EVA", desc: "Vacuum, no gravity, and only sealed suits survive the first minute.", weight: 2 },
      { name: "A Coruscant rooftop chase", desc: "Speeder traffic, thousand-metre drops, and no room to plant your feet.", weight: 2 },
    ],
    entries: [
      { n: "Darth Vader", t: 5, f: 5, variants: [{ v: "prime, Rogue One hallway", g: "legendary" }, { v: "damaged suit", g: "weakening" }] },
      { n: "Anakin Skywalker", t: 5, f: 5, variants: [{ v: "Clone Wars prime", g: "legendary" }, { v: "burned on Mustafar", g: "crippling" }, { v: "podracing kid", g: "crippling" }] },
      { n: "Yoda", t: 5, f: 5, variants: [{ v: "prime", g: "legendary" }, { v: "900 years old, dying", g: "crippling" }] },
      { n: "Obi-Wan Kenobi", t: 5, f: 5, variants: [{ v: "Clone Wars prime", g: "legendary" }, { v: "Old Ben", g: "weakening" }] },
      { n: "Luke Skywalker", t: 4, f: 5, variants: [{ v: "Jedi Master", g: "legendary" }, { v: "Return of the Jedi", g: "boon" }, { v: "farm boy", g: "crippling" }] },
      { n: "Darth Maul", t: 5, f: 5 },
      { n: "Mace Windu", t: 5 },
      { n: "Emperor Palpatine", t: 5, f: 5 },
      { n: "Boba Fett", t: 4, f: 5 },
      { n: "The Mandalorian", t: 4, f: 5, s: "Din Djarin", variants: [{ v: "beskar armor", g: "major" }, { v: "with the Darksaber", t: 5 }] },
      { n: "Ahsoka Tano", t: 5 },
      { n: "Han Solo", t: 3, f: 5, variants: [{ v: "with the Falcon", t: 4 }, { v: "frozen in carbonite", t: 1 }] },
      { n: "Chewbacca", t: 3, f: 5 },
      { n: "General Grievous", t: 4 },
      { n: "Count Dooku", t: 5 },
      { n: "Kylo Ren", t: 4, f: 5 },
      { n: "Rey", t: 4, f: 5 },
      { n: "Qui-Gon Jinn", t: 4 },
      { n: "Princess Leia", t: 3, f: 5 },
      { n: "Lando Calrissian", t: 2 },
      { n: "Jar Jar Binks", t: 1, f: 4, variants: [
        // The single best payoff on this board: the worst card in the game,
        // and one roll in a while it is the best one. Mythic floors a pick at
        // 10/10, so a tier-1 Gungan genuinely wins the contest when it lands.
        { v: "Darth Jar Jar, Dark Lord of the Sith", g: "mythic" },
        { v: "meesa helping", g: "crippling" },
      ] },
      { n: "R2-D2", t: 2 },
      { n: "C-3PO", t: 1 },
      { n: "Stormtrooper", t: 1 },
      { n: "Jango Fett", t: 4 },
      { n: "Captain Rex", t: 3 },
      { n: "Grand Admiral Thrawn", t: 3 },
      { n: "Ewok", t: 1 },
      { n: "Padmé Amidala", t: 2 },
      { n: "Ahsoka's Fulcrum", t: 4, s: "Ahsoka Tano Rebels" },
      { n: "Ezra Bridger", t: 3 },
      { n: "Kanan Jarrus", t: 4, variants: [{ v: "sighted", g: "major" }, { v: "blinded", t: 3 }] },
      { n: "Sabine Wren", t: 3 },
      { n: "Hera Syndulla", t: 3 },
      { n: "Cad Bane", t: 4 },
      { n: "Asajj Ventress", t: 4 },
      { n: "Savage Opress", t: 4 },
      { n: "Grand Inquisitor", t: 4 },
      { n: "Cal Kestis", t: 4 },
      { n: "The Second Sister", t: 4, s: "Trilla Suduri" },
      { n: "Bo-Katan Kryze", t: 4 },
      { n: "Moff Gideon", t: 3 },
      { n: "Grogu", t: 3, f: 5, s: "Baby Yoda", variants: [{ v: "after a nap", t: 4 }, { v: "hungry, mid-tantrum", t: 1 }] },
      { n: "IG-11", t: 3 },
      { n: "Fennec Shand", t: 4 },
      { n: "Wrecker", t: 3, s: "Bad Batch" },
      { n: "Hunter", t: 3, s: "Bad Batch clone" },
      { n: "Commander Cody", t: 3 },
      { n: "Plo Koon", t: 4 },
      { n: "Kit Fisto", t: 4 },
      { n: "Aayla Secura", t: 4 },
      { n: "Shaak Ti", t: 4 },
      { n: "Jar Jar's tongue", t: 1, s: "Jar Jar Binks" },
      { n: "Wicket", t: 1, f: 1, s: "Ewok Wicket" },
      { n: "Salacious Crumb", t: 1, f: 1 },
      { n: "Rancor", t: 4, s: "Star Wars rancor" },
      { n: "Sarlacc", t: 3, s: "Star Wars sarlacc pit" },
      { n: "Wampa", t: 3 },
      { n: "AT-AT", t: 4, s: "Star Wars AT-AT walker" },
      { n: "Death Star", t: 5, s: "Star Wars Death Star", variants: [{ v: "fully operational", g: "legendary" }, { v: "with an exhaust port", g: "crippling" }] },
      { n: "Millennium Falcon", t: 4 },
      { n: "Admiral Ackbar", t: 2, f: 1 },
      { n: "Wedge Antilles", t: 3, f: 1 },
      { n: "Grand Moff Tarkin", t: 2 },
      { n: "Watto", t: 1, f: 1 },
      { n: "Greedo", t: 1, f: 1, variants: [{ v: "shot first", t: 2 }, { v: "shot second", g: "crippling" }] },
    ],
  },

  // ── Horror ────────────────────────────────────────────────────────────────
  {
    id: "horror",
    name: "Horror Villains",
    emoji: "🔪",
    blurb: "Draft the nightmare. Camp counselors not included.",
    imgContext: "horror movie villain",
    wiki: "villains",
    scenario:
      "Both drafted rosters are loosed in the same small town on the same night. Whoever's team is still standing at sunrise wins.",
    criteria:
      "Kill efficiency, durability, and whether they can be stopped at all. Supernatural beats merely strong.",
    arenas: [
      { name: "A small town at night", desc: "Suburban streets, dark houses, and a sunrise deadline.", weight: 10 },
      { name: "A single locked house", desc: "One building, no exit, and everyone inside is very close together.", weight: 4 },
      { name: "A summer camp by a lake", desc: "Woods, cabins, water, and no help within twenty miles.", weight: 3 },
      { name: "Broad daylight", desc: "The sun is up and stays up. Anything that needs the dark is diminished.", weight: 2 },
    ],
    entries: [
      { n: "Michael Myers", t: 5, f: 5, s: "Halloween" },
      { n: "Freddy Krueger", t: 5, f: 5, variants: [{ v: "in the dream world", g: "legendary" }, { v: "pulled into the real world", t: 3 }] },
      { n: "Jason Voorhees", t: 5, f: 5, variants: [{ v: "undead Jason", g: "major" }, { v: "sack-head Jason", t: 4 }, { v: "drowning boy", t: 1 }] },
      { n: "Pennywise", t: 5, f: 5, s: "IT clown", variants: [{ v: "full power", g: "legendary" }, { v: "weakened by belief", g: "crippling" }] },
      { n: "Leatherface", t: 4, f: 5 },
      { n: "Xenomorph", t: 5, f: 5, s: "Alien creature", variants: [{ v: "full grown", g: "boon" }, { v: "facehugger stage", g: "crippling" }] },
      { n: "The Predator", t: 5, f: 5, variants: [{ v: "cloaked, plasma caster", g: "major" }, { v: "weapons stripped", t: 4 }] },
      { n: "Hannibal Lecter", t: 3 },
      { n: "Ghostface", t: 3, f: 5, s: "Scream" },
      { n: "Chucky", t: 2, f: 5, s: "Child's Play doll" },
      { n: "Pinhead", t: 5, s: "Hellraiser" },
      { n: "The Thing", t: 5, s: "1982 John Carpenter creature" },
      { n: "Dracula", t: 5, f: 5, variants: [{ v: "at night", g: "major" }, { v: "at high noon", t: 1 }] },
      { n: "Frankenstein's Monster", t: 4, f: 5 },
      { n: "The Babadook", t: 3 },
      { n: "Samara", t: 4, s: "The Ring girl" },
      { n: "Annabelle", t: 2, s: "haunted doll" },
      { n: "Norman Bates", t: 2, s: "Psycho" },
      { n: "The Invisible Man", t: 3 },
      { n: "Werewolf", t: 4, variants: [{ v: "full moon", t: 5 }, { v: "human form, daytime", t: 1 }] },
      { n: "Art the Clown", t: 4, s: "Terrifier" },
      { n: "Jigsaw", t: 2, s: "Saw Billy puppet" },
      { n: "The Mummy", t: 3 },
      { n: "Candyman", t: 4 },
      { n: "Zombie", t: 1, variants: [{ v: "an entire horde", t: 4 }, { v: "one slow shambler", g: "weakening" }] },
      { n: "Gremlins", t: 2, s: "Gremlins Stripe" },
      { n: "Creature from the Black Lagoon", t: 3 },
      { n: "Carrie White", t: 4, s: "Carrie prom scene" },
      { n: "Regan MacNeil", t: 4, s: "The Exorcist possessed" },
      { n: "Damien Thorn", t: 3, s: "The Omen" },
      { n: "The Grabber", t: 3, s: "Black Phone" },
      { n: "Jigsaw's Pig", t: 2, s: "Saw pig mask" },
      { n: "Valak", t: 4, s: "The Nun demon" },
      { n: "The Entity", t: 4, s: "It Follows" },
      { n: "Bughuul", t: 4, s: "Sinister Mr Boogie" },
      { n: "Sadako", t: 4, s: "Ringu" },
      { n: "Kayako", t: 4, s: "The Grudge" },
      { n: "Pyramid Head", t: 5, s: "Silent Hill" },
      { n: "The Shape", t: 5, s: "Halloween Michael Myers" },
      { n: "Tiffany Valentine", t: 2, s: "Bride of Chucky" },
      { n: "The Tall Man", t: 4, s: "Phantasm" },
      { n: "Djinn", t: 4, s: "Wishmaster" },
      { n: "The Crawlers", t: 3, s: "The Descent creatures" },
      { n: "Alien Queen", t: 5, s: "Aliens queen" },
      { n: "Deadites", t: 3, s: "Evil Dead" },
      { n: "Ash's chainsaw hand", t: 3, s: "Evil Dead Ash Williams" },
      { n: "Herbert West", t: 2, f: 1, s: "Re-Animator" },
      { n: "The Blob", t: 4 },
      { n: "Godzilla", t: 5, f: 5, variants: [{ v: "Shin Godzilla", g: "legendary" }, { v: "1954 suit", t: 4 }] },
      { n: "Gremlin Stripe", t: 2, s: "Gremlins" },
      { n: "Killer Klowns", t: 2, s: "Killer Klowns from Outer Space" },
      { n: "Chucky's Good Guy box", t: 1, s: "Child's Play doll box" },
      { n: "The Babysitter", t: 1, s: "horror movie babysitter" },
      { n: "Final Girl", t: 3, s: "horror final girl" },
      { n: "M3GAN", t: 4 },
      { n: "Pearl", t: 3, s: "Pearl 2022 Mia Goth" },
      { n: "The Firefly Family", t: 3, s: "House of 1000 Corpses" },
      { n: "Hannibal's muzzle", t: 3, s: "Hannibal Lecter mask" },
      { n: "Cujo", t: 3 },
      { n: "Christine", t: 3, s: "Christine 1958 Plymouth Fury" },
    ],
  },

  // ── Video Game Bosses ─────────────────────────────────────────────────────
  {
    id: "bosses",
    name: "Video Game Bosses",
    emoji: "🎮",
    blurb: "Boss rush. No estus, no save points, no mercy.",
    imgContext: "video game boss",
    wiki: "villains",
    scenario:
      "Each drafted roster becomes a boss gauntlet. The team whose gauntlet is harder to clear wins.",
    criteria:
      "Difficulty, moveset variety, punish potential, and how badly they break the player's spirit.",
    arenas: [
      { name: "A classic boss arena", desc: "A sealed circular room. The doors lock and only one side leaves.", weight: 10 },
      { name: "A tight corridor", desc: "No room to dodge, no room to circle. Reach wins.", weight: 3 },
      { name: "A collapsing platform gauntlet", desc: "The floor is falling away in sections. Positioning is everything.", weight: 3 },
      { name: "A New Game Plus run", desc: "Everything hits far harder and the player has seen it all before.", weight: 2 },
    ],
    entries: [
      { n: "Bowser", t: 4, f: 5, s: "Super Mario", variants: [{ v: "Giga Bowser", t: 5 }, { v: "standard", t: 4 }, { v: "on a bridge with an axe behind him", t: 1 }] },
      { n: "Ganondorf", t: 5, f: 5, s: "Zelda" },
      { n: "Sephiroth", t: 5, f: 5, s: "Final Fantasy VII" },
      { n: "Malenia", t: 5, f: 5, s: "Elden Ring Blade of Miquella" },
      { n: "Ornstein and Smough", t: 5, s: "Dark Souls" },
      { n: "Nemesis", t: 4, f: 5, s: "Resident Evil 3" },
      { n: "Mr. X", t: 3, s: "Resident Evil 2 Tyrant" },
      { n: "Psycho Mantis", t: 3, s: "Metal Gear Solid" },
      { n: "GLaDOS", t: 4, f: 5, s: "Portal" },
      { n: "Ridley", t: 4, s: "Metroid" },
      { n: "Mother Brain", t: 4, s: "Metroid" },
      { n: "Doctor Eggman", t: 2, s: "Sonic Robotnik" },
      { n: "M. Bison", t: 4, s: "Street Fighter" },
      { n: "Akuma", t: 5, f: 5, s: "Street Fighter" },
      { n: "Shao Kahn", t: 5, f: 5, s: "Mortal Kombat" },
      { n: "The Valkyries", t: 4, s: "God of War Valkyrie Sigrun" },
      { n: "The Nameless King", t: 5, s: "Dark Souls III" },
      { n: "Vergil", t: 5, s: "Devil May Cry" },
      { n: "Handsome Jack", t: 3, s: "Borderlands 2" },
      { n: "Andrew Ryan", t: 2, s: "BioShock" },
      { n: "Big Daddy", t: 4, s: "BioShock" },
      { n: "Lavos", t: 5, s: "Chrono Trigger" },
      { n: "Kefka", t: 5, s: "Final Fantasy VI" },
      { n: "Goro", t: 3, s: "Mortal Kombat" },
      { n: "King Dedede", t: 2, s: "Kirby" },
      { n: "Whispy Woods", t: 1, f: 1, s: "Kirby tree boss" },
      { n: "The Devil", t: 4, s: "Cuphead final boss" },
      { n: "Sans", t: 4, f: 5, s: "Undertale" },
      { n: "Radahn", t: 5, s: "Elden Ring Starscourge Radahn" },
      { n: "Godrick", t: 3, s: "Elden Ring Godrick the Grafted" },
      { n: "Margit", t: 4, s: "Elden Ring Margit the Fell Omen" },
      { n: "Gwyn", t: 4, s: "Dark Souls Lord of Cinder" },
      { n: "Artorias", t: 5, s: "Dark Souls Abysswalker" },
      { n: "Sister Friede", t: 5, s: "Dark Souls III" },
      { n: "Isshin", t: 5, s: "Sekiro Sword Saint" },
      { n: "Genichiro", t: 4, s: "Sekiro" },
      { n: "Lady Maria", t: 5, s: "Bloodborne" },
      { n: "Father Gascoigne", t: 4, s: "Bloodborne" },
      { n: "Ludwig", t: 5, s: "Bloodborne Holy Blade" },
      { n: "The Nameless One", t: 4, s: "Planescape Torment" },
      { n: "Dracula", t: 4, f: 5, s: "Castlevania" },
      { n: "Death", t: 4, s: "Castlevania Death boss" },
      { n: "Bowser Jr.", t: 2, s: "Super Mario" },
      { n: "King Boo", t: 3, s: "Luigi's Mansion" },
      { n: "Wario", t: 2 },
      { n: "Metal Gear REX", t: 4, s: "Metal Gear Solid" },
      { n: "The Boss", t: 5, s: "Metal Gear Solid 3" },
      { n: "Revolver Ocelot", t: 4, s: "Metal Gear Solid" },
      { n: "Alduin", t: 4, s: "Skyrim dragon" },
      { n: "Sephiroth's Supernova", t: 5, s: "Final Fantasy VII Sephiroth" },
      { n: "Ultimecia", t: 4, s: "Final Fantasy VIII" },
      { n: "Yu Yevon", t: 2, s: "Final Fantasy X final boss" },
      { n: "Emerald Weapon", t: 5, s: "Final Fantasy VII" },
      { n: "The Skeleton King", t: 3, s: "Diablo" },
      { n: "Diablo", t: 5, s: "Diablo Lord of Terror" },
      { n: "Cerberus", t: 3, s: "God of War" },
      { n: "Baldur", t: 4, s: "God of War 2018" },
      { n: "Sigrun", t: 5, s: "God of War Valkyrie Queen" },
      { n: "The Radiance", t: 5, s: "Hollow Knight" },
      { n: "Nightmare King Grimm", t: 5, s: "Hollow Knight" },
      { n: "Hades", t: 4, f: 5, s: "Hades game boss" },
      { n: "The Bull", t: 3, s: "Cuphead Grim Matchstick" },
      { n: "Dark Link", t: 3, s: "Zelda" },
      { n: "Demise", t: 5, s: "Zelda Skyward Sword" },
      { n: "Waluigi", t: 1, f: 1 },
      { n: "Glass Joe", t: 1, f: 1, s: "Punch-Out" },
      { n: "Wall Master", t: 1, f: 1, s: "Zelda Wallmaster" },
    ],
  },

  // ── Anime ─────────────────────────────────────────────────────────────────
  {
    id: "anime",
    name: "Anime Protagonists",
    emoji: "🗾",
    blurb: "Power-scaling arguments, but with a budget.",
    imgContext: "anime character",
    wiki: "deathbattle",
    scenario:
      "A tournament arena, one-on-one bracket, both drafted teams entering every fighter they drafted.",
    criteria:
      "Raw power, speed, hax abilities, and stamina across multiple fights. Series-canon peak, not endgame asspulls.",
    arenas: [
      { name: "A tournament arena", desc: "A stone platform, a ring-out rule, and a crowd.", weight: 10 },
      { name: "A ruined city", desc: "Rubble, cover, and a great deal of collateral to hide behind or drop on someone.", weight: 4 },
      { name: "A sealed barrier domain", desc: "No escape and no outside help until one side is finished.", weight: 3 },
      { name: "A place where nobody can use their strongest technique", desc: "Trump cards are off the table. Fundamentals decide it.", weight: 2 },
    ],
    entries: [
      { n: "Goku", t: 5, f: 5, s: "Dragon Ball", variants: [{ v: "Ultra Instinct", g: "mythic" }, { v: "Super Saiyan", g: "boon" }, { v: "base form, kid Goku", g: "crippling" }] },
      { n: "Saitama", t: 5, f: 5, s: "One Punch Man" },
      { n: "Naruto Uzumaki", t: 4, f: 5, variants: [{ v: "Six Paths Sage Mode", g: "mythic" }, { v: "Sage Mode", g: "boon" }, { v: "Academy student", g: "crippling" }] },
      { n: "Sasuke Uchiha", t: 4, f: 5 },
      { n: "Monkey D. Luffy", t: 4, f: 5, s: "One Piece", variants: [{ v: "Gear 5", g: "mythic" }, { v: "Gear 2", g: "boon" }, { v: "East Blue rookie", g: "crippling" }] },
      { n: "Roronoa Zoro", t: 4, f: 5, s: "One Piece" },
      { n: "Ichigo Kurosaki", t: 4, s: "Bleach" },
      { n: "Levi Ackerman", t: 4, f: 5, s: "Attack on Titan", variants: [{ v: "with ODM gear", g: "major" }, { v: "no gear, open field", t: 2 }] },
      { n: "Eren Yeager", t: 4, f: 5, s: "Attack on Titan" },
      { n: "Satoru Gojo", t: 5, f: 5, s: "Jujutsu Kaisen", variants: [{ v: "unsealed", g: "legendary" }, { v: "sealed in the box", t: 1 }] },
      { n: "Tanjiro Kamado", t: 3, s: "Demon Slayer" },
      { n: "All Might", t: 5, f: 5, s: "My Hero Academia", variants: [{ v: "prime", g: "legendary" }, { v: "post-injury, three minutes", g: "weakening" }] },
      { n: "Izuku Midoriya", t: 3, s: "My Hero Academia Deku" },
      { n: "Vegeta", t: 5, f: 5, s: "Dragon Ball" },
      { n: "Light Yagami", t: 2, f: 5, s: "Death Note", variants: [{ v: "with the Death Note", t: 5 }, { v: "no notebook", t: 1 }] },
      { n: "Edward Elric", t: 3, s: "Fullmetal Alchemist" },
      { n: "Guts", t: 4, s: "Berserk", variants: [{ v: "Berserker Armor", t: 5 }, { v: "Black Swordsman", g: "major" }] },
      { n: "Killua Zoldyck", t: 4, s: "Hunter x Hunter" },
      { n: "Gon Freecss", t: 3, s: "Hunter x Hunter" },
      { n: "Meliodas", t: 5, s: "Seven Deadly Sins" },
      { n: "Escanor", t: 5, s: "Seven Deadly Sins", variants: [{ v: "at high noon", g: "exalted" }, { v: "at midnight", g: "crippling" }] },
      { n: "Yusuke Urameshi", t: 4, s: "Yu Yu Hakusho" },
      { n: "Spike Spiegel", t: 3, s: "Cowboy Bebop" },
      { n: "Alucard", t: 5, s: "Hellsing" },
      { n: "Kenshin Himura", t: 4, s: "Rurouni Kenshin" },
      { n: "Yugi Muto", t: 1, f: 1, s: "Yu-Gi-Oh" },
      { n: "Shinji Ikari", t: 1, s: "Evangelion", variants: [{ v: "in Eva Unit 01", t: 5 }, { v: "out of the robot", g: "crippling" }] },
      { n: "Mob", t: 5, s: "Mob Psycho 100 Shigeo Kageyama" },
      { n: "Sukuna", t: 5, s: "Jujutsu Kaisen" },
      { n: "Yuji Itadori", t: 4, s: "Jujutsu Kaisen" },
      { n: "Nobara Kugisaki", t: 3, s: "Jujutsu Kaisen" },
      { n: "Toji Fushiguro", t: 5, s: "Jujutsu Kaisen" },
      { n: "Zenitsu", t: 3, s: "Demon Slayer", variants: [{ v: "asleep", t: 5 }, { v: "awake and terrified", t: 1 }] },
      { n: "Inosuke", t: 3, s: "Demon Slayer" },
      { n: "Rengoku", t: 4, s: "Demon Slayer Flame Hashira" },
      { n: "Muzan", t: 5, s: "Demon Slayer" },
      { n: "Shanks", t: 5, s: "One Piece" },
      { n: "Whitebeard", t: 5, s: "One Piece" },
      { n: "Doflamingo", t: 4, s: "One Piece" },
      { n: "Sanji", t: 4, s: "One Piece" },
      { n: "Nami", t: 2, f: 1, s: "One Piece" },
      { n: "Usopp", t: 2, f: 1, s: "One Piece" },
      { n: "Kakashi", t: 4, f: 5, s: "Naruto", variants: [{ v: "with the Sharingan", t: 5 }, { v: "post-war, no Sharingan", t: 3 }] },
      { n: "Itachi Uchiha", t: 5, f: 5, s: "Naruto" },
      { n: "Madara Uchiha", t: 5, s: "Naruto" },
      { n: "Rock Lee", t: 3, s: "Naruto", variants: [{ v: "eight gates open", g: "exalted" }, { v: "weights on", g: "weakening" }] },
      { n: "Might Guy", t: 5, s: "Naruto" },
      { n: "Frieza", t: 5, f: 5, s: "Dragon Ball" },
      { n: "Cell", t: 5, s: "Dragon Ball" },
      { n: "Piccolo", t: 4, s: "Dragon Ball" },
      { n: "Krillin", t: 2, f: 1, s: "Dragon Ball" },
      { n: "Master Roshi", t: 3, s: "Dragon Ball" },
      { n: "Yamcha", t: 1, f: 1, s: "Dragon Ball" },
      { n: "Bardock", t: 4, s: "Dragon Ball" },
      { n: "Beerus", t: 5, s: "Dragon Ball Super" },
      { n: "Garou", t: 5, s: "One Punch Man" },
      { n: "Genos", t: 4, s: "One Punch Man" },
      { n: "Tatsumaki", t: 5, s: "One Punch Man" },
      { n: "Hisoka", t: 4, s: "Hunter x Hunter" },
      { n: "Meruem", t: 5, s: "Hunter x Hunter" },
      { n: "Chrollo", t: 4, s: "Hunter x Hunter" },
      { n: "Mikasa Ackerman", t: 4, s: "Attack on Titan" },
      { n: "Armin", t: 2, s: "Attack on Titan", variants: [{ v: "Colossal Titan", t: 5 }, { v: "just Armin", t: 1 }] },
      { n: "Reiner Braun", t: 4, s: "Attack on Titan" },
      { n: "Griffith", t: 5, s: "Berserk" },
      { n: "Casca", t: 3, s: "Berserk" },
      { n: "Vash the Stampede", t: 4, s: "Trigun" },
      { n: "Kenshiro", t: 5, s: "Fist of the North Star" },
      { n: "Jotaro Kujo", t: 5, s: "JoJo's Bizarre Adventure" },
      { n: "Dio Brando", t: 5, s: "JoJo's Bizarre Adventure" },
      { n: "Joseph Joestar", t: 4, s: "JoJo's Bizarre Adventure" },
      { n: "Ryuk", t: 3, s: "Death Note shinigami" },
      { n: "Anya Forger", t: 1, f: 1, s: "Spy x Family" },
      { n: "Chainsaw Man", t: 5, s: "Denji Chainsaw Man" },
      { n: "Power", t: 3, s: "Chainsaw Man" },
      { n: "Makima", t: 5, s: "Chainsaw Man" },
      { n: "Ainz Ooal Gown", t: 5, s: "Overlord" },
    ],
  },

  // ── Superheroes beyond Marvel ─────────────────────────────────────────────
  {
    id: "dc",
    name: "DC Comics",
    emoji: "🦇",
    blurb: "Gods, detectives, and one man with a lot of money and a lot of issues.",
    imgContext: "DC Comics character",
    wiki: "dc",
    scenario:
      "A reality-level threat cracks the sky over Metropolis. Each drafted team is all that answers the call.",
    criteria:
      "Raw power, but also whether the team has a plan. One genius with prep time has beaten worse odds than this.",
    arenas: [
      { name: "Metropolis under attack", desc: "Skyscrapers, civilians, and daylight.", weight: 10 },
      { name: "Arkham Asylum in a blackout", desc: "Corridors, no power, and the cells are open.", weight: 3 },
      { name: "Apokolips", desc: "Fire pits, hostile ground, and Darkseid's home advantage.", weight: 2 },
      { name: "A red-sun room", desc: "Kryptonian powers are gone. Everyone else fights as usual.", weight: 2 },
    ],
    entries: [
      { n: "Superman", t: 5, f: 5, variants: [{ v: "full power, yellow sun", g: "legendary" }, { v: "under a red sun", g: "crippling" }, { v: "kryptonite in the room", g: "crippling" }] },
      { n: "Batman", t: 4, f: 5, variants: [{ v: "with prep time", t: 5 }, { v: "ambushed, no belt", t: 2 }] },
      { n: "Wonder Woman", t: 5, f: 5 },
      { n: "The Flash", t: 5, f: 5, s: "Barry Allen", variants: [{ v: "Speed Force unlocked", g: "legendary" }, { v: "held to normal speed", g: "crippling" }] },
      { n: "Green Lantern", t: 5, f: 5, s: "Hal Jordan", variants: [{ v: "ring charged", g: "major" }, { v: "ring out of power", t: 1 }] },
      { n: "Aquaman", t: 4, f: 5 },
      { n: "Martian Manhunter", t: 5, variants: [{ v: "no fire nearby", g: "major" }, { v: "the building is on fire", t: 2 }] },
      { n: "Cyborg", t: 4 },
      { n: "Shazam", t: 5, f: 5 },
      { n: "Zatanna", t: 4 },
      { n: "Constantine", t: 3, s: "John Constantine" },
      { n: "Doctor Fate", t: 5 },
      { n: "Swamp Thing", t: 5 },
      { n: "Raven", t: 4, s: "Teen Titans Raven" },
      { n: "Starfire", t: 4 },
      { n: "Beast Boy", t: 3 },
      { n: "Nightwing", t: 3 },
      { n: "Red Hood", t: 3, s: "Jason Todd" },
      { n: "Batgirl", t: 3, s: "Barbara Gordon" },
      { n: "Oracle", t: 3, s: "Barbara Gordon Oracle" },
      { n: "Green Arrow", t: 3 },
      { n: "Black Canary", t: 4 },
      { n: "Hawkgirl", t: 4 },
      { n: "Booster Gold", t: 2 },
      { n: "Blue Beetle", t: 3 },
      { n: "The Joker", t: 3, f: 5, variants: [{ v: "with a plan", t: 4 }, { v: "improvising", g: "boon" }] },
      { n: "Harley Quinn", t: 3, f: 5 },
      { n: "Poison Ivy", t: 4 },
      { n: "Bane", t: 4, f: 5, variants: [{ v: "on Venom", t: 5 }, { v: "tubes cut", t: 2 }] },
      { n: "Scarecrow", t: 2 },
      { n: "The Riddler", t: 2 },
      { n: "Two-Face", t: 2, variants: [{ v: "coin lands scarred", t: 3 }, { v: "coin lands clean", t: 1 }] },
      { n: "Mr. Freeze", t: 3 },
      { n: "Clayface", t: 3 },
      { n: "Deathstroke", t: 4 },
      { n: "Deadshot", t: 3 },
      { n: "Lex Luthor", t: 4, f: 5, variants: [{ v: "in the warsuit", t: 5 }, { v: "in a business suit", t: 2 }] },
      { n: "Brainiac", t: 5 },
      { n: "Darkseid", t: 5, f: 5 },
      { n: "Doomsday", t: 5 },
      { n: "Black Adam", t: 5 },
      { n: "Sinestro", t: 5 },
      { n: "Reverse-Flash", t: 5, s: "Eobard Thawne" },
      { n: "Solomon Grundy", t: 4 },
      { n: "Killer Croc", t: 3 },
      { n: "Ra's al Ghul", t: 3 },
      { n: "Alfred Pennyworth", t: 2 },
      { n: "Krypto", t: 4, s: "Krypto the Superdog" },
      { n: "Bat-Mite", t: 1, f: 1 },
      { n: "Matter-Eater Lad", t: 1, f: 1 },
    ],
  },

  // ── Middle-earth ──────────────────────────────────────────────────────────
  {
    id: "lotr",
    name: "Middle-earth",
    emoji: "💍",
    blurb: "One does not simply draft into Mordor. Except you're about to.",
    imgContext: "Lord of the Rings character",
    wiki: "lotr",
    scenario:
      "Both drafted fellowships set out from Rivendell for the Black Gate. Only one gets there.",
    criteria:
      "Skill at arms, endurance on a long road, and whether the company can survive its own weakest member.",
    arenas: [
      { name: "The plains before the Black Gate", desc: "Open ground, no cover, and a very long walk behind them.", weight: 10 },
      { name: "The mines of Moria", desc: "Dark, close, echoing, and something is already awake down there.", weight: 4 },
      { name: "Helm's Deep at night", desc: "A wall to hold, rain, and no way out but through.", weight: 3 },
      { name: "The slopes of Caradhras", desc: "Snow, thin air, and a mountain that does not want them there.", weight: 2 },
    ],
    entries: [
      { n: "Gandalf", t: 5, f: 5, variants: [{ v: "the White", g: "legendary" }, { v: "the Grey", g: "neutral" }, { v: "no staff, no sword", g: "crippling" }] },
      { n: "Aragorn", t: 5, f: 5, variants: [{ v: "crowned, with Andúril", g: "legendary" }, { v: "Strider, ranger of the North", g: "neutral" }, { v: "wounded but walking", g: "weakening" }] },
      { n: "Legolas", t: 4, f: 5 },
      { n: "Gimli", t: 4, f: 5 },
      { n: "Boromir", t: 4, f: 5, variants: [{ v: "before Amon Hen", g: "boon" }, { v: "three arrows in", t: 2 }] },
      { n: "Faramir", t: 4 },
      { n: "Éowyn", t: 4, variants: [{ v: "facing the Witch-king", g: "legendary" }, { v: "shieldmaiden of Rohan", g: "neutral" }] },
      { n: "Théoden", t: 3, variants: [{ v: "freed of Saruman", t: 4 }, { v: "under Wormtongue's spell", t: 1 }] },
      { n: "Éomer", t: 4 },
      { n: "Samwise Gamgee", t: 3, f: 5, variants: [{ v: "with Sting and the Phial", t: 4 }, { v: "with a frying pan", t: 2 }] },
      { n: "Frodo", t: 2, f: 5, variants: [{ v: "wearing the Ring", t: 4 }, { v: "stung by Shelob", t: 1 }] },
      { n: "Merry", t: 2 },
      { n: "Pippin", t: 2 },
      { n: "Bilbo", t: 2 },
      { n: "Gollum", t: 2, f: 5, variants: [{ v: "Sméagol, helpful", g: "weakening" }, { v: "Gollum, at the Cracks of Doom", t: 3 }] },
      { n: "Galadriel", t: 5, f: 5 },
      { n: "Elrond", t: 4 },
      { n: "Arwen", t: 3 },
      { n: "Glorfindel", t: 5 },
      { n: "Treebeard", t: 5 },
      { n: "Tom Bombadil", t: 5, variants: [{ v: "as himself", t: 5 }, { v: "unbothered, singing", t: 5 }] },
      { n: "Beorn", t: 5 },
      { n: "Bard the Bowman", t: 4 },
      { n: "Thorin Oakenshield", t: 4 },
      { n: "Sauron", t: 5, f: 5, variants: [{ v: "with the One Ring", g: "mythic" }, { v: "a lidless eye only", g: "weakening" }] },
      { n: "The Witch-king", t: 5, variants: [{ v: "no man can kill him", g: "legendary" }, { v: "facing a woman and a hobbit", t: 3 }] },
      { n: "Saruman", t: 4, f: 5, variants: [{ v: "staff unbroken", t: 5 }, { v: "staff broken", t: 1 }] },
      { n: "A Nazgûl", t: 4, s: "Ringwraith" },
      { n: "The Balrog", t: 5, f: 5 },
      { n: "Shelob", t: 4 },
      { n: "The Mouth of Sauron", t: 2 },
      { n: "Lurtz", t: 3, s: "Uruk-hai captain" },
      { n: "An Uruk-hai", t: 3 },
      { n: "A cave troll", t: 3 },
      { n: "An Oliphaunt", t: 4, s: "Mumakil" },
      { n: "A Warg", t: 3 },
      { n: "Smaug", t: 5, f: 5, variants: [{ v: "scales intact", g: "major" }, { v: "the gap in the breast", t: 3 }] },
      { n: "The Army of the Dead", t: 5 },
      { n: "Grima Wormtongue", t: 1 },
      { n: "Radagast", t: 3, f: 1 },
      { n: "Denethor", t: 1, f: 1 },
      { n: "Barliman Butterbur", t: 1, f: 1 },
      { n: "The Eagles", t: 4, s: "Great Eagles Gwaihir" },

      // ── The Silmarillion — the Elder Days ───────────────────
      { n: "Fëanor", t: 5, f: 5, s: "Silmarillion Feanor Noldor", variants: [
        { v: "oath sworn, the Silmarils newly made", g: "mythic" },
        { v: "alone against Balrogs at Dor Daedeloth", g: "legendary" },
      ] },
      { n: "Fingolfin", t: 5, f: 5, s: "Silmarillion High King of the Noldor", variants: [
        { v: "challenging Morgoth at the gates of Angband", g: "mythic" },
        { v: "High King, the host at his back", g: "legendary" },
      ] },
      { n: "Maedhros", t: 5, s: "Silmarillion Maedhros the Tall", variants: [
        { v: "the Tall, fighting left-handed", g: "legendary" },
        { v: "hanging from Thangorodrim", g: "crippling" },
      ] },
      { n: "Fingon", t: 4, s: "Silmarillion Fingon the Valiant", variants: [
        { v: "the Valiant, at the Nirnaeth", g: "major" },
      ] },
      { n: "Turgon", t: 4, s: "Silmarillion King of Gondolin", variants: [
        { v: "in Gondolin, unfound for four hundred years", g: "major" },
      ] },
      { n: "Ecthelion", t: 4, s: "Silmarillion Ecthelion of the Fountain", variants: [
        { v: "drowning Gothmog in the fountain", g: "legendary" },
      ] },
      { n: "Lúthien", t: 5, f: 5, s: "Silmarillion Luthien Tinuviel", variants: [
        { v: "singing Morgoth himself to sleep", g: "mythic" },
        { v: "dancing in the woods of Neldoreth", g: "boon" },
      ] },
      { n: "Beren", t: 3, s: "Silmarillion Beren Erchamion", variants: [
        { v: "with Lúthien beside him", g: "legendary" },
        { v: "Erchamion, the One-handed", g: "weakening" },
      ] },
      { n: "Thingol", t: 4, s: "Silmarillion Elu Thingol Doriath", variants: [
        { v: "with Aranrúth in Menegroth", g: "major" },
      ] },
      { n: "Melian", t: 5, s: "Silmarillion Melian the Maia", variants: [
        { v: "her Girdle unbroken about Doriath", g: "legendary" },
        { v: "the Girdle undone", g: "weakening" },
      ] },
      { n: "Túrin Turambar", t: 5, f: 5, s: "Silmarillion Turin Turambar", variants: [
        { v: "with Gurthang, standing over Glaurung", g: "legendary" },
        { v: "under the Curse of Morgoth", g: "crippling" },
      ] },
      { n: "Húrin", t: 4, s: "Silmarillion Hurin Thalion", variants: [
        { v: "Aurë entuluva — seventy trolls dead", g: "legendary" },
        { v: "chained to a chair on Thangorodrim", g: "crippling" },
      ] },
      { n: "Beleg", t: 4, s: "Silmarillion Beleg Cuthalion", variants: [
        { v: "Cúthalion, with Belthronding strung", g: "major" },
      ] },
      { n: "Tuor", t: 4, s: "Silmarillion Tuor of Gondolin", variants: [
        { v: "in the armour of Nevrast", g: "major" },
      ] },
      { n: "Idril", t: 3, s: "Silmarillion Idril Celebrindal" },
      { n: "Eärendil", t: 5, f: 5, s: "Silmarillion Earendil the Mariner", variants: [
        { v: "with the Silmaril, aboard Vingilot", g: "mythic" },
        { v: "a mariner with no star to steer by", g: "weakening" },
      ] },
      { n: "Gil-galad", t: 5, s: "Silmarillion Gil-galad last High King", variants: [
        { v: "with Aeglos at the Last Alliance", g: "legendary" },
      ] },
      { n: "Elendil", t: 4, s: "Silmarillion Elendil the Tall Numenor", variants: [
        { v: "with Narsil, before it broke", g: "major" },
      ] },
      { n: "Isildur", t: 3, s: "Silmarillion Isildur", variants: [
        { v: "cutting the Ring from the hand of Sauron", g: "legendary" },
        { v: "at the Gladden Fields, ambushed", g: "crippling" },
      ] },
      { n: "Celebrimbor", t: 3, s: "Silmarillion Celebrimbor Eregion", variants: [
        { v: "forging the Three, unlooked-for by Sauron", g: "major" },
      ] },
      { n: "Círdan", t: 3, s: "Silmarillion Cirdan the Shipwright" },
      { n: "Manwë", t: 5, s: "Silmarillion Manwe Sulimo Elder King", variants: [
        { v: "Elder King of Arda, the winds his to command", g: "mythic" },
      ] },
    ],
  },

  // ── Mythology ─────────────────────────────────────────────────────────────
  {
    id: "myth",
    name: "Gods & Monsters",
    emoji: "⚡",
    blurb: "Every pantheon in one arena. Somebody's getting smited.",
    imgContext: "mythology god statue art",
    scenario:
      "The pantheons have been thrown into one arena with their powers intact and no worshippers to draw on. Two drafted pantheons, one left standing.",
    criteria:
      "Domain of power, feats in their own myths, and whether their weakness is the kind an opponent can actually exploit.",
    arenas: [
      { name: "A neutral arena", desc: "Stone ground, open sky, no home advantage to any pantheon.", weight: 10 },
      { name: "Mount Olympus", desc: "The Greek gods are home and the ground itself favours them.", weight: 2 },
      { name: "The underworld", desc: "No sunlight, the dead underfoot, and gods of death are at their strongest.", weight: 3 },
      { name: "A world without worshippers", desc: "Every god runs on their own strength alone. Faith gives nobody anything.", weight: 3 },
    ],
    entries: [
      { n: "Zeus", t: 5, f: 5 },
      { n: "Odin", t: 5, f: 5 },
      { n: "Thor", t: 5, f: 5, s: "Norse god Thor", variants: [{ v: "with Mjölnir", g: "legendary" }, { v: "hammer stolen", t: 3 }] },
      { n: "Loki", t: 4, f: 5, s: "Norse god Loki" },
      { n: "Hades", t: 5, f: 5, s: "Greek god of the underworld" },
      { n: "Poseidon", t: 5, f: 5 },
      { n: "Ares", t: 4 },
      { n: "Athena", t: 5, f: 5 },
      { n: "Artemis", t: 4 },
      { n: "Apollo", t: 4, s: "Greek god Apollo" },
      { n: "Hephaestus", t: 3 },
      { n: "Hermes", t: 3 },
      { n: "Hera", t: 4 },
      { n: "Persephone", t: 4 },
      { n: "Ra", t: 5, f: 5, s: "Egyptian sun god" },
      { n: "Anubis", t: 4, f: 5 },
      { n: "Set", t: 4, s: "Egyptian god Set" },
      { n: "Sekhmet", t: 5 },
      { n: "Horus", t: 4 },
      { n: "Amaterasu", t: 5 },
      { n: "Susanoo", t: 5 },
      { n: "Raijin", t: 4 },
      { n: "Sun Wukong", t: 5, f: 5, s: "Monkey King" },
      { n: "Guan Yu", t: 4 },
      { n: "Kali", t: 5, s: "Hindu goddess Kali" },
      { n: "Shiva", t: 5 },
      { n: "Hanuman", t: 5 },
      { n: "Quetzalcoatl", t: 5 },
      { n: "Huitzilopochtli", t: 4 },
      { n: "The Morrígan", t: 4 },
      { n: "Cú Chulainn", t: 5, variants: [{ v: "in the ríastrad, warp-spasm", g: "legendary" }, { v: "bound to a standing stone", t: 3 }] },
      { n: "Beowulf", t: 4 },
      { n: "Grendel", t: 4 },
      { n: "Fenrir", t: 5, variants: [{ v: "unbound at Ragnarök", g: "mythic" }, { v: "chained by Gleipnir", t: 2 }] },
      { n: "Jörmungandr", t: 5, s: "Midgard Serpent" },
      { n: "The Kraken", t: 4 },
      { n: "Medusa", t: 4, f: 5, variants: [{ v: "eye contact", t: 5 }, { v: "against a polished shield", t: 2 }] },
      { n: "The Minotaur", t: 4 },
      { n: "Cerberus", t: 4, s: "three headed dog mythology" },
      { n: "The Sphinx", t: 3 },
      { n: "The Hydra", t: 4, variants: [{ v: "no fire in the arena", t: 5 }, { v: "someone brought a torch", t: 2 }] },
      { n: "Chimera", t: 4 },
      { n: "Baba Yaga", t: 4 },
      { n: "Anansi", t: 3 },
      { n: "Coyote", t: 3, s: "trickster Coyote mythology" },
      { n: "Icarus", t: 1, f: 1, variants: [{ v: "on the way up", t: 3 }, { v: "on the way down", g: "crippling" }] },
      { n: "Sisyphus", t: 1, f: 1 },
      { n: "Narcissus", t: 1, f: 1 },
      { n: "Pandora", t: 2, variants: [{ v: "box closed", t: 1 }, { v: "box open", t: 5 }] },
    ],
  },

  // ── Greek myth ────────────────────────────────────────────────────────────
  {
    id: "greek",
    name: "Greek Mythology",
    emoji: "🏛️",
    blurb: "Gods, heroes, and the monsters that ate the last people who tried this.",
    /* No `wiki` on purpose. Fandom is the load-bearing tier for invented
       characters because Wikipedia omits fair-use images — but every figure
       here has been painted, carved and put on a vase for three thousand
       years, all of it public domain and all of it on Wikipedia. Naming a
       Fandom wiki would put fan art in front of the Louvre. */
    imgContext: "Greek mythology",
    format: "melee",
    scenario:
      "The Fates have set a contest on the plain below Olympus. Each drafted side stands as itself — no armies, no worshippers, no divine rescue at the last moment. What a figure managed in the myths is what they can manage here.",
    criteria:
      "Divine rank counts, but never on its own: half these stories are about a god caught out of their element losing to a mortal with the right weapon. Cleverness is worth as much as strength — Odysseus is a real answer to a monster — and a famous weakness is a real liability if the other side can reach it.",
    arenas: [
      { name: "The plain before Troy", desc: "Open ground, no cover, and both cities watching from the walls.", weight: 10 },
      { name: "The slopes of Olympus", desc: "Home ground for anything divine. A mortal up here is a very long way from help.", weight: 3 },
      { name: "The Underworld, past the ferry", desc: "Nothing dies here that is not already dead, and Hades rules inside his own house.", weight: 2 },
      { name: "The open sea", desc: "Poseidon's water, no land in sight, and nothing to stand on.", weight: 2 },
      { name: "The Labyrinth", desc: "No sightlines, no straight paths, and something else is already in here with you.", weight: 2 },
    ],
    entries: [
      // ── The first powers ────────────────────────────────────────────────
      { n: "Gaia", t: 5, f: 4, s: "Greek primordial goddess earth", variants: [
        { v: "the earth itself, and everything standing on it", g: "mythic" },
        { v: "raising the Giants against Olympus", g: "legendary" },
      ] },
      { n: "Nyx", t: 5, f: 3, s: "Greek primordial goddess night", variants: [
        { v: "the one thing Zeus was ever afraid of", g: "mythic" },
        { v: "night falling early, and all of it hers", g: "legendary" },
      ] },
      { n: "Uranus", t: 4, f: 2, s: "Greek primordial sky god Ouranos", variants: [
        { v: "before the sickle", g: "major" },
        { v: "after the sickle", g: "crippling" },
      ] },
      { n: "Cronus", t: 5, f: 4, s: "Greek Titan Kronos", variants: [
        { v: "the adamantine sickle, and his children still inside him", g: "mythic" },
        { v: "the Golden Age, unchallenged", g: "legendary" },
        { v: "in Tartarus, where they put him", g: "crippling" },
      ] },
      { n: "Rhea", t: 3, f: 2, s: "Greek Titaness mother of the gods" },
      { n: "Oceanus", t: 4, f: 2, s: "Greek Titan of the ocean river" },
      { n: "Hyperion", t: 4, f: 2, s: "Greek Titan of light" },
      { n: "Atlas", t: 4, f: 4, s: "Greek Titan holding up the sky", variants: [
        { v: "having talked somebody else into holding the sky", g: "major" },
        { v: "holding up the sky, both hands full", g: "weakening" },
      ] },
      { n: "Prometheus", t: 4, f: 4, s: "Greek Titan of fire", variants: [
        { v: "who knows how every plan ends before it starts", g: "legendary" },
        { v: "handing mankind the fire", g: "major" },
        { v: "chained to the rock, and the eagle is due", g: "crippling" },
      ] },
      { n: "Epimetheus", t: 1, f: 1, s: "Greek Titan afterthought" },
      { n: "Themis", t: 3, f: 1, s: "Greek Titaness of divine law" },
      { n: "Helios", t: 4, f: 3, s: "Greek sun god chariot", variants: [
        { v: "at noon, in the chariot", g: "major" },
        { v: "Phaethon has the reins", g: "crippling" },
      ] },
      { n: "Selene", t: 3, f: 2, s: "Greek moon goddess" },
      { n: "Eos", t: 2, f: 1, s: "Greek goddess of the dawn" },

      // ── Olympus ─────────────────────────────────────────────────────────
      { n: "Zeus", t: 5, f: 5, s: "Greek king of the gods", variants: [
        { v: "the master bolt, and no reason left to hold back", g: "mythic" },
        { v: "with the aegis and the storm behind him", g: "legendary" },
        { v: "disguised as a swan, mid-scheme", g: "weakening" },
        { v: "an infant hidden on Crete", g: "crippling" },
      ] },
      { n: "Poseidon", t: 5, f: 5, s: "Greek god of the sea", variants: [
        { v: "the trident, and the sea standing up behind him", g: "legendary" },
        { v: "a long way inland", g: "weakening" },
      ] },
      { n: "Hades", t: 5, f: 5, s: "Greek god of the underworld", variants: [
        { v: "wearing the Helm of Darkness — you cannot see him at all", g: "mythic" },
        { v: "on his own ground, where the dead answer to him", g: "legendary" },
        { v: "up top, and unwelcome", g: "weakening" },
      ] },
      { n: "Hera", t: 4, f: 4, s: "Greek queen of the gods", variants: [
        { v: "queen of Olympus, with a grudge and time to spend on it", g: "legendary" },
      ] },
      { n: "Athena", t: 5, f: 5, s: "Greek goddess of wisdom and war", variants: [
        { v: "aegis raised, the gorgoneion facing you", g: "legendary" },
        { v: "picking the battlefield a week in advance", g: "major" },
      ] },
      { n: "Apollo", t: 5, f: 5, s: "Greek god of the sun and archery", variants: [
        { v: "the silver bow, and he does not miss", g: "legendary" },
        { v: "serving a year as a mortal, no powers at all", g: "crippling" },
      ] },
      { n: "Artemis", t: 4, f: 4, s: "Greek goddess of the hunt", variants: [
        { v: "in the wild, at night, with the hounds out", g: "legendary" },
      ] },
      { n: "Ares", t: 4, f: 4, s: "Greek god of war", variants: [
        { v: "in a battle rage with Phobos and Deimos on the field", g: "major" },
        { v: "wounded by a mortal, and crying to his father about it", g: "weakening" },
      ] },
      { n: "Hephaestus", t: 4, f: 4, s: "Greek god of the forge", variants: [
        { v: "at the forge, arming his whole side with divine work", g: "legendary" },
        { v: "lamed, and thrown off Olympus once already", g: "weakening" },
      ] },
      { n: "Aphrodite", t: 3, f: 4, s: "Greek goddess of love", variants: [
        { v: "wearing the girdle — nobody wants to fight her", g: "legendary" },
        { v: "on an actual battlefield", g: "crippling" },
      ] },
      { n: "Hermes", t: 4, f: 5, s: "Greek messenger god", variants: [
        { v: "faster than anything else here, and he already has your weapon", g: "major" },
        { v: "guiding souls, and not much interested in fighting", g: "weakening" },
      ] },
      { n: "Dionysus", t: 4, f: 4, s: "Greek god of wine", variants: [
        { v: "divine madness — your own side turns on you", g: "legendary" },
        { v: "extremely drunk", g: "weakening" },
      ] },
      { n: "Demeter", t: 4, f: 3, s: "Greek goddess of the harvest", variants: [
        { v: "grieving, and nothing grows anywhere until she stops", g: "legendary" },
      ] },
      { n: "Hestia", t: 2, f: 2, s: "Greek goddess of the hearth" },
      { n: "Persephone", t: 4, f: 4, s: "Greek queen of the underworld", variants: [
        { v: "Queen of the Dead, six months in", g: "legendary" },
        { v: "picking flowers, and the ground is opening", g: "crippling" },
      ] },
      { n: "Hecate", t: 4, f: 3, s: "Greek goddess of witchcraft", variants: [
        { v: "at the crossroads at midnight with the torches lit", g: "legendary" },
      ] },
      { n: "Pan", t: 3, f: 3, s: "Greek god Pan satyr pipes", variants: [
        { v: "the shout that gave panic its name", g: "major" },
      ] },
      { n: "Nike", t: 3, f: 2, s: "Greek winged goddess of victory" },
      { n: "Eros", t: 3, f: 3, s: "Greek god of love bow arrow", variants: [
        { v: "one arrow, and your best pick is in love with theirs", g: "major" },
      ] },
      { n: "Nemesis", t: 3, f: 2, s: "Greek goddess of retribution" },
      { n: "Iris", t: 2, f: 1, s: "Greek rainbow messenger goddess" },
      { n: "Thanatos", t: 3, f: 2, s: "Greek god of death", variants: [
        { v: "nothing on this field can die while he stands", g: "major" },
        { v: "in chains — Sisyphus got him", g: "crippling" },
      ] },
      { n: "Hypnos", t: 3, f: 2, s: "Greek god of sleep", variants: [
        { v: "he has put Zeus to sleep before", g: "legendary" },
      ] },
      { n: "Asclepius", t: 3, f: 2, s: "Greek god of medicine", variants: [
        { v: "raising the dead, which is what got him killed", g: "major" },
      ] },
      { n: "Charon", t: 2, f: 3, s: "Greek ferryman of the dead", variants: [
        { v: "you have a coin", g: "neutral" },
        { v: "you have no coin", g: "crippling" },
      ] },
      { n: "The Erinyes", t: 4, f: 2, s: "Greek Furies avenging goddesses", variants: [
        { v: "on the trail of a kinslayer, and they do not stop", g: "legendary" },
      ] },
      { n: "The Moirai", t: 4, f: 2, s: "Greek Fates three sisters thread", variants: [
        { v: "holding your thread, with the shears open", g: "mythic" },
      ] },
      { n: "The Muses", t: 2, f: 2, s: "Greek Muses nine sisters" },

      // ── Heroes and mortals ──────────────────────────────────────────────
      { n: "Heracles", t: 5, f: 5, s: "Greek hero Hercules lion skin club", variants: [
        { v: "ascended — a god on Olympus now", g: "mythic" },
        { v: "mid-Labours, in the Nemean lion's skin", g: "legendary" },
        { v: "driven mad by Hera", g: "weakening" },
        { v: "in the poisoned shirt of Nessus", g: "crippling" },
      ] },
      { n: "Achilles", t: 5, f: 5, s: "Greek hero Trojan War", variants: [
        { v: "in the armour Hephaestus made, avenging Patroclus", g: "mythic" },
        { v: "invulnerable everywhere but the heel", g: "legendary" },
        { v: "sulking in his tent and not coming out", g: "crippling" },
      ] },
      { n: "Perseus", t: 4, f: 5, s: "Greek hero Medusa head", variants: [
        { v: "winged sandals, cap of invisibility, and the head in the bag", g: "legendary" },
        { v: "a boy with a bag and no idea", g: "crippling" },
      ] },
      { n: "Odysseus", t: 4, f: 5, s: "Greek hero Ulysses Odyssey", variants: [
        { v: "given one night to think about it first", g: "legendary" },
        { v: "with the bow nobody else can string", g: "major" },
        { v: "ten years from home and out of crew", g: "weakening" },
      ] },
      { n: "Theseus", t: 4, f: 4, s: "Greek hero of Athens Minotaur", variants: [
        { v: "with the thread, and he knows the way back", g: "major" },
      ] },
      { n: "Jason", t: 3, f: 3, s: "Greek hero Argonauts Golden Fleece", variants: [
        { v: "wearing the Golden Fleece", g: "major" },
        { v: "abandoned by Medea, and out of luck for good", g: "crippling" },
      ] },
      { n: "Bellerophon", t: 4, f: 3, s: "Greek hero Pegasus Chimera", variants: [
        { v: "on Pegasus, above all of it", g: "legendary" },
        { v: "thrown from Pegasus", g: "crippling" },
      ] },
      { n: "Atalanta", t: 4, f: 3, s: "Greek heroine huntress", variants: [
        { v: "first to draw blood on the Calydonian Boar", g: "major" },
        { v: "stopping for the golden apples", g: "weakening" },
      ] },
      { n: "Hector", t: 4, f: 4, s: "Greek Trojan prince warrior", variants: [
        { v: "before the walls of Troy, with the city watching", g: "major" },
        { v: "dragged behind a chariot", g: "crippling" },
      ] },
      { n: "Ajax the Great", t: 4, f: 3, s: "Greek hero Ajax Telamon shield", variants: [
        { v: "the tower shield, holding the ships on his own", g: "major" },
        { v: "maddened by Athena, fighting livestock", g: "crippling" },
      ] },
      { n: "Diomedes", t: 4, f: 2, s: "Greek hero Trojan War", variants: [
        { v: "the night he wounded two gods", g: "legendary" },
      ] },
      { n: "Orpheus", t: 3, f: 4, s: "Greek musician lyre", variants: [
        { v: "playing — nothing that hears him will raise a hand", g: "legendary" },
        { v: "looking back", g: "crippling" },
      ] },
      { n: "Agamemnon", t: 3, f: 3, s: "Greek king of Mycenae Trojan War" },
      { n: "Menelaus", t: 3, f: 2, s: "Greek king of Sparta Trojan War" },
      { n: "Patroclus", t: 3, f: 3, s: "Greek hero Trojan War", variants: [
        { v: "in Achilles' armour, and everyone believes it", g: "major" },
      ] },
      { n: "Paris", t: 2, f: 4, s: "Greek Trojan prince archer", variants: [
        { v: "with Apollo guiding the arrow", g: "major" },
        { v: "in single combat, on his own", g: "crippling" },
      ] },
      { n: "Aeneas", t: 4, f: 3, s: "Greek Trojan hero", variants: [
        { v: "with his mother Aphrodite watching over him", g: "major" },
      ] },
      { n: "Chiron", t: 4, f: 3, s: "Greek centaur teacher of heroes", variants: [
        { v: "immortal, and he trained half the other side", g: "major" },
      ] },
      { n: "Daedalus", t: 2, f: 3, s: "Greek inventor of the Labyrinth", variants: [
        { v: "given a week and a workshop first", g: "major" },
      ] },
      { n: "Icarus", t: 1, f: 4, s: "Greek Icarus wings sun", variants: [
        { v: "wings still whole, and staying low", g: "boon" },
        { v: "the wax is melting", g: "crippling" },
      ] },
      { n: "Cadmus", t: 3, f: 2, s: "Greek hero founder of Thebes", variants: [
        { v: "sowing the dragon's teeth — a whole army stands up", g: "legendary" },
      ] },
      { n: "Oedipus", t: 2, f: 3, s: "Greek king of Thebes Sphinx", variants: [
        { v: "having just solved the riddle", g: "boon" },
        { v: "blinded, and led by a child", g: "crippling" },
      ] },
      { n: "Circe", t: 4, f: 4, s: "Greek sorceress witch", variants: [
        { v: "and everyone who lands on her island leaves as a pig", g: "legendary" },
      ] },
      { n: "Medea", t: 4, f: 3, s: "Greek sorceress of Colchis", variants: [
        { v: "and she will do the thing nobody believes she will do", g: "legendary" },
      ] },
      { n: "Helen of Troy", t: 2, f: 4, s: "Greek Helen of Sparta Troy", variants: [
        { v: "the face that launched a thousand ships", g: "major" },
      ] },
      { n: "Cassandra", t: 2, f: 3, s: "Greek Trojan prophetess", variants: [
        { v: "she knows exactly what you are going to do", g: "major" },
        { v: "and nobody believes a word of it", g: "weakening" },
      ] },
      { n: "Penelope", t: 2, f: 2, s: "Greek queen of Ithaca" },
      { n: "Ariadne", t: 2, f: 3, s: "Greek princess of Crete thread" },
      { n: "Antigone", t: 2, f: 2, s: "Greek Theban princess" },
      { n: "Pandora", t: 1, f: 4, s: "Greek Pandora jar", variants: [
        { v: "the jar still shut", g: "neutral" },
        { v: "the jar open, and only hope left inside", g: "crippling" },
      ] },
      { n: "Sisyphus", t: 2, f: 4, s: "Greek king boulder punishment", variants: [
        { v: "he has out-thought death twice already", g: "major" },
        { v: "the boulder rolls back down", g: "crippling" },
      ] },
      { n: "Tantalus", t: 1, f: 2, s: "Greek Tantalus punishment" },
      { n: "Midas", t: 2, f: 4, s: "Greek King Midas golden touch", variants: [
        { v: "everything he touches turns to gold", g: "major" },
        { v: "including his dinner", g: "crippling" },
      ] },
      { n: "Narcissus", t: 1, f: 3, s: "Greek Narcissus reflection", variants: [
        { v: "cannot be made to look away from the water", g: "crippling" },
      ] },
      { n: "Arachne", t: 2, f: 3, s: "Greek weaver Arachne", variants: [
        { v: "the finest weaver alive, and she said so out loud", g: "boon" },
        { v: "a spider", g: "crippling" },
      ] },
      { n: "Orion", t: 3, f: 3, s: "Greek giant hunter Orion", variants: [
        { v: "who swore he could kill everything that walks", g: "major" },
        { v: "and then a scorpion got him", g: "crippling" },
      ] },
      { n: "Pegasus", t: 3, f: 4, s: "Pegasus winged horse Greek myth" },
      { n: "An oracle of Delphi", t: 1, f: 2, s: "Pythia oracle of Delphi Greek", variants: [
        { v: "she has already told you how this ends", g: "major" },
      ] },

      // ── Monsters ────────────────────────────────────────────────────────
      { n: "Typhon", t: 5, f: 3, s: "Greek monster Typhoeus", variants: [
        { v: "storming Olympus — the gods ran to Egypt", g: "mythic" },
        { v: "under Etna, where Zeus left him", g: "crippling" },
      ] },
      { n: "Echidna", t: 4, f: 2, s: "Greek mother of monsters" },
      { n: "Medusa", t: 4, f: 5, s: "Greek Gorgon Medusa", variants: [
        { v: "meeting your eyes", g: "legendary" },
        { v: "before Athena's curse", g: "weakening" },
        { v: "beheaded — somebody else is holding her", g: "crippling" },
      ] },
      { n: "The Lernaean Hydra", t: 4, f: 4, s: "Greek Hydra many heads", variants: [
        { v: "two heads back for every one you cut", g: "legendary" },
        { v: "somebody brought a torch", g: "crippling" },
      ] },
      { n: "Cerberus", t: 4, f: 5, s: "Greek three headed dog underworld", variants: [
        { v: "all three heads awake at the gate", g: "major" },
        { v: "somebody is playing a lyre", g: "crippling" },
      ] },
      { n: "The Chimera", t: 4, f: 4, s: "Greek Chimera lion goat serpent" },
      { n: "The Minotaur", t: 4, f: 5, s: "Greek Minotaur Labyrinth", variants: [
        { v: "loose in the Labyrinth, on home ground", g: "major" },
        { v: "the thread is laid and everyone knows the way out", g: "weakening" },
      ] },
      { n: "The Sphinx", t: 3, f: 4, s: "Greek Sphinx riddle Thebes", variants: [
        { v: "nobody here has heard the riddle before", g: "major" },
        { v: "somebody answers it", g: "crippling" },
      ] },
      { n: "Polyphemus", t: 3, f: 4, s: "Greek Cyclops Polyphemus", variants: [
        { v: "between you and the only way out of the cave", g: "major" },
        { v: "blinded, feeling along the walls", g: "crippling" },
      ] },
      { n: "Scylla", t: 4, f: 3, s: "Greek sea monster Scylla", variants: [
        { v: "in the strait, and the only other way is Charybdis", g: "legendary" },
      ] },
      { n: "Charybdis", t: 4, f: 3, s: "Greek sea monster whirlpool" },
      { n: "The Sirens", t: 3, f: 4, s: "Greek Sirens singing", variants: [
        { v: "singing, and nobody thought to bring wax", g: "legendary" },
        { v: "everyone has wax in their ears", g: "crippling" },
      ] },
      { n: "The Nemean Lion", t: 4, f: 3, s: "Greek Nemean Lion", variants: [
        { v: "a hide no blade will cut", g: "major" },
      ] },
      { n: "The Cretan Bull", t: 3, f: 2, s: "Greek Cretan Bull" },
      { n: "The Erymanthian Boar", t: 3, f: 1, s: "Greek Erymanthian Boar" },
      { n: "The Stymphalian Birds", t: 2, f: 1, s: "Greek Stymphalian Birds bronze" },
      { n: "The Harpies", t: 2, f: 3, s: "Greek Harpies" },
      { n: "Ladon", t: 3, f: 2, s: "Greek dragon Ladon golden apples", variants: [
        { v: "a hundred heads, and it never sleeps", g: "major" },
      ] },
      { n: "Argus Panoptes", t: 3, f: 2, s: "Greek Argus hundred eyes", variants: [
        { v: "a hundred eyes, and half of them always open", g: "major" },
        { v: "Hermes has started telling a story", g: "crippling" },
      ] },
      { n: "Talos", t: 4, f: 3, s: "Greek bronze giant automaton Talos", variants: [
        { v: "bronze, and it circles the whole island three times a day", g: "major" },
        { v: "the nail is out and the ichor is running", g: "crippling" },
      ] },
      { n: "The Graeae", t: 2, f: 2, s: "Greek Graeae three sisters one eye", variants: [
        { v: "somebody has taken the eye", g: "crippling" },
      ] },
      { n: "Lamia", t: 3, f: 1, s: "Greek Lamia monster" },
      { n: "Empusa", t: 2, f: 1, s: "Greek Empusa monster" },
      { n: "The Python of Delphi", t: 3, f: 2, s: "Greek Python serpent Delphi" },
      { n: "The Ceryneian Hind", t: 2, f: 1, s: "Greek Ceryneian Hind golden" },
      { n: "A centaur", t: 2, f: 2, s: "Greek centaur", variants: [
        { v: "and it has been drinking", g: "weakening" },
      ] },
      { n: "A satyr", t: 1, f: 2, s: "Greek satyr" },
      { n: "A Cyclops of the forge", t: 3, f: 2, s: "Greek Cyclops forge Hephaestus" },
      { n: "A Gigante", t: 4, f: 1, s: "Greek Giant Gigantomachy" },
    ],
  },

  // ── Berserk ───────────────────────────────────────────────────────────────
  {
    id: "berserk",
    name: "Berserk",
    emoji: "⚔️",
    blurb: "Draft from the Band of the Hawk. Causality is not on your side.",
    imgContext: "Berserk manga character",
    wiki: "berserk",
    scenario:
      "The drafted parties meet on a field already gone wrong — the air thick, the moon low, and something watching from outside causality. Whoever is still standing when it lifts has won.",
    criteria:
      "Raw violence counts, but so does what a fighter is: an apostle eats an ordinary swordsman, and a witch can undo an apostle. Armour, will, and whether they break under horror all matter.",
    arenas: [
      { name: "A blood-soaked battlefield", desc: "Open mud and corpses, no cover, and nothing supernatural interfering — just steel.", weight: 10 },
      { name: "The Eclipse", desc: "Causality itself is hostile. Branded flesh draws demons, and the God Hand are watching. Only the truly monstrous are comfortable here.", weight: 3 },
      { name: "The Tower of Conviction", desc: "Close stone corridors and fanatics. Big apostle forms can barely turn around.", weight: 3 },
      { name: "Elfhelm's shore", desc: "Warded ground where astral things are weakened and magic answers readily.", weight: 2 },
      { name: "The Misty Valley at dusk", desc: "Fog, forest and flight. Anything that cannot get off the ground is at a real disadvantage.", weight: 2 },
    ],
    entries: [
      { n: "Guts", t: 5, f: 5, s: "Berserk Black Swordsman", variants: [
        { v: "in the Berserker Armor", g: "mythic" },
        { v: "the Black Swordsman, Dragonslayer drawn", g: "legendary" },
        { v: "one eye, one arm, still coming", g: "neutral" },
        { v: "a boy in Gambino's band", g: "crippling" },
      ] },
      { n: "Griffith", t: 5, f: 5, s: "Berserk", variants: [
        { v: "Femto, of the God Hand", g: "mythic" },
        { v: "reborn, leading the new Band of the Hawk", g: "legendary" },
        { v: "a year in the Tower of Rebirth", g: "crippling" },
      ] },
      { n: "Zodd", t: 5, f: 5, s: "Berserk Nosferatu Zodd apostle", variants: [
        { v: "apostle form, Immortal Zodd", g: "legendary" },
        { v: "human form, two swords", g: "boon" },
      ] },
      { n: "Skull Knight", t: 5, f: 5, s: "Berserk", variants: [
        { v: "with the Sword of Resonance", g: "legendary" },
        { v: "riding out of the Eclipse", g: "major" },
      ] },
      { n: "Void", t: 5, s: "Berserk God Hand", variants: [
        { v: "God Hand, bending causality", g: "mythic" },
      ] },
      { n: "Slan", t: 5, s: "Berserk God Hand", variants: [
        { v: "manifested in flesh and blood", g: "legendary" },
        { v: "a presence only", g: "neutral" },
      ] },
      { n: "Ubik", t: 4, s: "Berserk God Hand" },
      { n: "Conrad", t: 4, s: "Berserk God Hand" },
      { n: "Emperor Ganishka", t: 5, s: "Berserk apostle", variants: [
        { v: "the Shiva colossus", g: "mythic" },
        { v: "apostle form, lightning", g: "legendary" },
        { v: "on his throne, human", g: "weakening" },
      ] },
      { n: "Grunbeld", t: 5, s: "Berserk apostle Flame Dragon", variants: [
        { v: "Apostle of the Flame Dragon", g: "legendary" },
        { v: "in armour, human-sized", g: "boon" },
      ] },
      { n: "Wyald", t: 4, s: "Berserk apostle Black Dog Knights", variants: [
        { v: "apostle form", g: "major" },
        { v: "as a man, all boast", g: "weakening" },
      ] },
      { n: "Mozgus", t: 4, s: "Berserk Holy Iron Chain", variants: [
        { v: "apostle, burning and winged", g: "legendary" },
        { v: "the torturer, human", g: "weakening" },
      ] },
      { n: "Rosine", t: 4, s: "Berserk apostle Misty Valley", variants: [
        { v: "Queen of the Misty Valley", g: "major" },
        { v: "a runaway child", g: "crippling" },
      ] },
      { n: "Casca", t: 4, f: 5, s: "Berserk", variants: [
        { v: "commander of the Band of the Hawk", g: "boon" },
        { v: "mind restored at Elfhelm", g: "major" },
        { v: "after the Eclipse, lost", g: "crippling" },
      ] },
      { n: "Serpico", t: 4, s: "Berserk", variants: [
        { v: "with the wind sylph's cloak", g: "major" },
        { v: "fencing bare, no wind", g: "neutral" },
      ] },
      { n: "Schierke", t: 4, s: "Berserk witch", variants: [
        { v: "casting from the astral world", g: "legendary" },
        { v: "a frightened apprentice", g: "weakening" },
      ] },
      { n: "Farnese", t: 2, s: "Berserk", variants: [
        { v: "trained as a witch", g: "boon" },
        { v: "Holy Iron Chain Knights, all zeal", g: "weakening" },
      ] },
      { n: "Locus", t: 5, s: "Berserk Moonlight Knight apostle", variants: [
        { v: "Moonlight Knight, lance couched", g: "legendary" },
      ] },
      { n: "Irvine", t: 4, s: "Berserk apostle archer", variants: [
        { v: "longbow, apostle form", g: "major" },
        { v: "at close range", g: "weakening" },
      ] },
      { n: "Silat", t: 3, s: "Berserk Bakiraka", variants: [
        { v: "Bakiraka weapons, full arsenal", g: "boon" },
      ] },
      { n: "Judeau", t: 3, s: "Berserk Band of the Hawk" },
      { n: "Pippin", t: 3, s: "Berserk Band of the Hawk" },
      { n: "Rickert", t: 2, s: "Berserk", variants: [
        { v: "grown, with Elfhelm behind him", g: "boon" },
        { v: "a boy minding the camp", g: "crippling" },
      ] },
      { n: "Isidro", t: 2, f: 1, s: "Berserk", variants: [
        { v: "with the salamander dagger", g: "boon" },
        { v: "a thief with no training", g: "crippling" },
      ] },
      { n: "Puck", t: 1, f: 5, s: "Berserk elf", variants: [
        { v: "elf dust, healing the party", g: "boon" },
        { v: "commentating", g: "neutral" },
      ] },
      { n: "Corkus", t: 2, f: 1, s: "Berserk Band of the Hawk" },
      { n: "Daiba", t: 3, s: "Berserk onmyoji" },
      { n: "Sonia", t: 2, s: "Berserk" },
      { n: "Charlotte", t: 1, f: 1, s: "Berserk princess" },
    ],
  },
  // ── Teenage Mutant Ninja Turtles ────────────────────────
  {
    id: "tmnt",
    name: "Ninja Turtles",
    emoji: "\ud83d\udc22",
    blurb: "Draft from the sewers. Pizza is not a strategy.",
    imgContext: "TMNT character",
    wiki: "tmnt",
    scenario:
      "Two drafted crews meet in the streets and storm drains of New York after dark. No cameras, no police, and whoever is still standing at sunrise owns the city.",
    criteria:
      "Ninjutsu, raw strength and gadgets all count, but so does teamwork \u2014 the Turtles are dangerous together and beatable apart. Mutant bulk beats a trained human until the human is trained enough.",
    arenas: [
      { name: "A rooftop chase at night", desc: "Rain-slick tiles and long drops. Agility matters more than muscle up here.", weight: 10 },
      { name: "The storm drains", desc: "Cramped tunnels, low ceilings and black water. Anything huge can barely turn around.", weight: 4 },
      { name: "The Technodrome", desc: "Krang\u0027s war machine, full of mousers and heavy weapons. Tech beats training here.", weight: 3 },
      { name: "A crowded Times Square", desc: "Civilians everywhere, so anyone with scruples fights at half strength.", weight: 2 },
      { name: "Dimension X", desc: "Alien gravity and no rules. Everything mutant or otherworldly is at home; humans are not.", weight: 2 },
    ],
    entries: [
      { n: "Leonardo", t: 4, f: 5, s: "TMNT Leonardo katana blue", variants: [
        { v: "leading, katanas drawn", g: "major" },
        { v: "second-guessing every call", g: "weakening" },
      ] },
      { n: "Raphael", t: 4, f: 5, s: "TMNT Raphael sai red", variants: [
        { v: "furious, and finally focused", g: "major" },
        { v: "off on his own again", g: "weakening" },
      ] },
      { n: "Donatello", t: 3, f: 5, s: "TMNT Donatello bo staff purple", variants: [
        { v: "with a week to prepare and a workshop", g: "legendary" },
        { v: "caught without a single gadget", g: "weakening" },
      ] },
      { n: "Michelangelo", t: 3, f: 5, s: "TMNT Michelangelo nunchaku orange", variants: [
        { v: "genuinely trying for once", g: "major" },
        { v: "distracted by pizza", g: "crippling" },
      ] },
      { n: "Splinter", t: 4, f: 5, s: "TMNT Master Splinter rat sensei", variants: [
        { v: "in his prime as Hamato Yoshi", g: "legendary" },
        { v: "old, and slower than he was", g: "weakening" },
      ] },
      { n: "Shredder", t: 5, f: 5, s: "TMNT Shredder Oroku Saki armor", variants: [
        { v: "Super Shredder, mutated and unhinged", g: "mythic" },
        { v: "Oroku Saki, blades out", g: "legendary" },
        { v: "unmasked and outnumbered", g: "weakening" },
      ] },
      { n: "Krang", t: 4, s: "TMNT Krang android body", variants: [
        { v: "in the android body", g: "major" },
        { v: "a brain in a jar", g: "crippling" },
      ] },
      { n: "Casey Jones", t: 3, f: 5, s: "TMNT Casey Jones hockey mask", variants: [
        { v: "with a full golf bag of weapons", g: "boon" },
      ] },
      { n: "April O\u0027Neil", t: 2, f: 5, s: "TMNT April ONeil reporter" },
      { n: "Karai", t: 4, s: "TMNT Karai Foot Clan", variants: [
        { v: "commanding the Foot", g: "major" },
        { v: "torn between two loyalties", g: "weakening" },
      ] },
      { n: "Bebop", t: 3, s: "TMNT Bebop warthog mutant", variants: [
        { v: "charging in a straight line", g: "boon" },
        { v: "thinking about it too hard", g: "crippling" },
      ] },
      { n: "Rocksteady", t: 3, s: "TMNT Rocksteady rhino mutant", variants: [
        { v: "with a machine gun and no aim", g: "boon" },
      ] },
      { n: "Baxter Stockman", t: 2, s: "TMNT Baxter Stockman scientist", variants: [
        { v: "with a mouser army", g: "major" },
        { v: "mutated into a fly", g: "weakening" },
      ] },
      { n: "Leatherhead", t: 4, s: "TMNT Leatherhead alligator mutant", variants: [
        { v: "in a blind rage", g: "major" },
      ] },
      { n: "Slash", t: 4, s: "TMNT Slash snapping turtle mutant" },
      { n: "Rat King", t: 3, s: "TMNT Rat King", variants: [
        { v: "with every rat in the city", g: "legendary" },
      ] },
      { n: "Usagi Yojimbo", t: 4, s: "Usagi Yojimbo rabbit ronin", variants: [
        { v: "one draw, one cut", g: "legendary" },
      ] },
      { n: "Tokka and Rahzar", t: 3, s: "TMNT Tokka Rahzar mutants" },
      { n: "A Foot Soldier", t: 1, f: 1, s: "TMNT Foot Clan ninja soldier", variants: [
        { v: "a hundred of them", g: "major" },
        { v: "one, alone", g: "crippling" },
      ] },
      { n: "Metalhead", t: 3, s: "TMNT Metalhead robot turtle" },
      { n: "Mondo Gecko", t: 2, f: 1, s: "TMNT Mondo Gecko skateboard" },
      { n: "A Triceraton", t: 4, s: "TMNT Triceraton soldier" },
    ],
  },

  // ── Power Rangers ───────────────────────────────────
  {
    id: "rangers",
    name: "Power Rangers",
    emoji: "\u26a1",
    blurb: "Morph first, ask questions never. Zords sold separately.",
    imgContext: "Power Rangers character",
    wiki: "powerrangers",
    scenario:
      "Two drafted teams are dropped into Angel Grove as the sky goes dark. Monsters are growing, zords are launching, and only one side is walking away from the rubble.",
    criteria:
      "Morphed combat, weapon skill and zord access. A ranger without a morph is a teenager; a monster that has grown is a building with fists. Teamwork unlocks the big machines, so a lone ranger is worth far less than a squad.",
    arenas: [
      { name: "Downtown Angel Grove", desc: "Open streets with room for anything to grow. Zord-scale fighters are at their best.", weight: 10 },
      { name: "The Command Center", desc: "Indoors and cramped. Nothing enormous fits, so it comes down to hand-to-hand.", weight: 3 },
      { name: "The Moon Palace", desc: "Rita\u0027s ground, low gravity, and every villain fights with reinforcements.", weight: 3 },
      { name: "A quarry, as always", desc: "The traditional venue. Flat, empty, and absolutely nothing to hide behind.", weight: 4 },
      { name: "Before anyone can morph", desc: "The fight starts too fast. Ranger powers are unavailable and everyone is just a person.", weight: 2 },
    ],
    entries: [
      { n: "Tommy Oliver", t: 5, f: 5, s: "Power Rangers Tommy Oliver Green Ranger", variants: [
        { v: "the Green Ranger, Dragonzord summoned", g: "mythic" },
        { v: "the White Ranger, Saba in hand", g: "legendary" },
        { v: "green powers failing again", g: "crippling" },
      ] },
      { n: "Jason Lee Scott", t: 4, f: 5, s: "Power Rangers Jason Red Ranger", variants: [
        { v: "Red Ranger, leading the team", g: "major" },
      ] },
      { n: "Kimberly Hart", t: 3, f: 5, s: "Power Rangers Kimberly Pink Ranger", variants: [
        { v: "with the Power Bow", g: "boon" },
      ] },
      { n: "Billy Cranston", t: 3, s: "Power Rangers Billy Blue Ranger", variants: [
        { v: "given time to build something", g: "major" },
      ] },
      { n: "Zack Taylor", t: 3, s: "Power Rangers Zack Black Ranger" },
      { n: "Trini Kwan", t: 3, s: "Power Rangers Trini Yellow Ranger" },
      { n: "Rita Repulsa", t: 4, f: 5, s: "Power Rangers Rita Repulsa", variants: [
        { v: "making a monster grow", g: "legendary" },
        { v: "sealed in the dumpster", g: "crippling" },
      ] },
      { n: "Lord Zedd", t: 5, f: 5, s: "Power Rangers Lord Zedd", variants: [
        { v: "Emperor of Evil, staff raised", g: "legendary" },
      ] },
      { n: "Goldar", t: 4, s: "Power Rangers Goldar", variants: [
        { v: "grown to zord scale", g: "major" },
        { v: "losing yet again", g: "weakening" },
      ] },
      { n: "Ivan Ooze", t: 5, s: "Power Rangers Ivan Ooze", variants: [
        { v: "free after six thousand years", g: "legendary" },
      ] },
      { n: "Scorpina", t: 3, s: "Power Rangers Scorpina" },
      { n: "The Megazord", t: 5, f: 5, s: "Power Rangers Megazord", variants: [
        { v: "Power Sword summoned from the sky", g: "mythic" },
        { v: "mid-formation, not yet assembled", g: "crippling" },
      ] },
      { n: "The Dragonzord", t: 5, s: "Power Rangers Dragonzord", variants: [
        { v: "called up out of the sea", g: "legendary" },
      ] },
      { n: "The Thunder Megazord", t: 5, s: "Power Rangers Thunder Megazord" },
      { n: "Titanus", t: 4, s: "Power Rangers Titanus carrierzord" },
      { n: "Zordon", t: 2, s: "Power Rangers Zordon", variants: [
        { v: "the energy wave that ended it all", g: "mythic" },
        { v: "a face in a tube", g: "crippling" },
      ] },
      { n: "Alpha 5", t: 1, f: 1, s: "Power Rangers Alpha 5 robot" },
      { n: "A Putty Patroller", t: 1, f: 1, s: "Power Rangers Putty Patrol", variants: [
        { v: "an entire swarm of them", g: "boon" },
        { v: "one, and it is made of clay", g: "crippling" },
      ] },
      { n: "Ninjor", t: 4, s: "Power Rangers Ninjor" },
      { n: "Andros", t: 4, s: "Power Rangers Andros Red Space Ranger" },
      { n: "Jen Scotts", t: 3, s: "Power Rangers Jen Time Force Pink" },
      { n: "Wes Collins", t: 3, s: "Power Rangers Wes Time Force Red" },
      { n: "Master Vile", t: 4, s: "Power Rangers Master Vile" },
      { n: "Bulk and Skull", t: 1, f: 1, s: "Power Rangers Bulk Skull" },
    ],
  },

  // ── The Powerpuff Girls ─────────────────────────────
  {
    id: "ppg",
    name: "Powerpuff Girls",
    emoji: "\ud83d\udc9e",
    blurb: "Sugar, spice, and a truly disproportionate amount of violence.",
    imgContext: "Powerpuff Girls character",
    wiki: "powerpuffgirls",
    scenario:
      "The City of Townsville is under attack, again, and two drafted sides are fighting over it. Buildings are optional. School night rules apply.",
    criteria:
      "Raw power is wildly out of proportion to size here \u2014 a kindergartener can throw a bus. Weigh flight, super strength and sheer temper, and remember that the smartest villain usually loses to the angriest little girl.",
    arenas: [
      { name: "Downtown Townsville", desc: "Skyscrapers to throw and civilians to protect. Fliers dominate.", weight: 10 },
      { name: "Pokey Oaks Kindergarten", desc: "Tiny chairs, low ceilings, and a teacher watching. Nobody can go all out.", weight: 3 },
      { name: "Mojo Jojo\u0027s observatory", desc: "Full of half-finished doomsday machines that anyone might switch on.", weight: 3 },
      { name: "Bedtime, mid-fight", desc: "The Professor calls them in. Anyone who has to be home fights distracted.", weight: 2 },
    ],
    entries: [
      { n: "Blossom", t: 4, f: 5, s: "Powerpuff Girls Blossom pink", variants: [
        { v: "ice breath, and a plan", g: "major" },
        { v: "over-thinking the leadership thing", g: "weakening" },
      ] },
      { n: "Bubbles", t: 4, f: 5, s: "Powerpuff Girls Bubbles blue", variants: [
        { v: "finally, genuinely angry", g: "legendary" },
        { v: "crying about it", g: "crippling" },
      ] },
      { n: "Buttercup", t: 4, f: 5, s: "Powerpuff Girls Buttercup green", variants: [
        { v: "swinging first, as usual", g: "major" },
      ] },
      { n: "Mojo Jojo", t: 3, f: 5, s: "Powerpuff Girls Mojo Jojo monkey", variants: [
        { v: "in a giant robot of his own design", g: "legendary" },
        { v: "explaining his plan at length", g: "crippling" },
      ] },
      { n: "HIM", t: 5, f: 5, s: "Powerpuff Girls HIM villain", variants: [
        { v: "voice dropping, reality bending", g: "mythic" },
        { v: "being polite about it", g: "neutral" },
      ] },
      { n: "Princess Morbucks", t: 2, s: "Powerpuff Girls Princess Morbucks", variants: [
        { v: "having simply bought better equipment", g: "major" },
      ] },
      { n: "Fuzzy Lumpkins", t: 3, s: "Powerpuff Girls Fuzzy Lumpkins", variants: [
        { v: "someone touched his property", g: "major" },
      ] },
      { n: "Brick", t: 3, s: "Powerpuff Girls Brick Rowdyruff Boys" },
      { n: "Boomer", t: 3, s: "Powerpuff Girls Boomer Rowdyruff Boys" },
      { n: "Butch", t: 3, s: "Powerpuff Girls Butch Rowdyruff Boys" },
      { n: "Sedusa", t: 3, s: "Powerpuff Girls Sedusa" },
      { n: "The Gangreen Gang", t: 2, s: "Powerpuff Girls Gangreen Gang Ace" },
      { n: "Professor Utonium", t: 2, s: "Powerpuff Girls Professor Utonium", variants: [
        { v: "with a fresh batch of Chemical X", g: "legendary" },
      ] },
      { n: "The Mayor", t: 1, f: 1, s: "Powerpuff Girls Mayor Townsville" },
      { n: "Ms. Bellum", t: 2, s: "Powerpuff Girls Miss Sara Bellum" },
      { n: "Bunny", t: 3, s: "Powerpuff Girls Bunny", variants: [
        { v: "unstable, and about to come apart", g: "crippling" },
      ] },
      { n: "The Talking Dog", t: 1, f: 1, s: "Powerpuff Girls talking dog" },
      { n: "The Amoeba Boys", t: 1, f: 1, s: "Powerpuff Girls Amoeba Boys" },
    ],
  },

  // ── Invincible ──────────────────────────────────────
  {
    id: "invincible",
    name: "Invincible",
    emoji: "\ud83e\ude78",
    blurb: "Think Viltrumite. It is going to hurt either way.",
    imgContext: "Invincible comic character",
    wiki: "invincibleuniverse",
    scenario:
      "Two drafted sides meet somewhere with too many people in it. This is a universe where fights leave craters and casualty numbers, and nobody pulls a punch twice.",
    criteria:
      "Viltrumite physiology outclasses almost everything, so weigh who can actually hurt whom. Durability matters more than technique. A clever human with the right tech is not useless, but they get exactly one shot.",
    arenas: [
      { name: "A city street at rush hour", desc: "Civilians everywhere. Anyone who cares about them fights at a fraction of their strength.", weight: 10 },
      { name: "Low orbit", desc: "No air, no ground, no witnesses. Only fliers and the unkillable belong here.", weight: 3 },
      { name: "The Pentagon, with Cecil watching", desc: "Reanimen, Darkwing traps and a man with a button. Raw power is not the only currency.", weight: 3 },
      { name: "Viltrum itself", desc: "Their ground, their rules, and reinforcements are always a minute away.", weight: 2 },
      { name: "A collapsing alternate Earth", desc: "Angstrom\u0027s doing. The ground is unreliable and the exits keep moving.", weight: 2 },
    ],
    entries: [
      { n: "Mark Grayson", t: 5, f: 5, s: "Invincible Mark Grayson costume", variants: [
        { v: "years older, and finished holding back", g: "legendary" },
        { v: "still learning, still pulling punches", g: "weakening" },
      ] },
      { n: "Omni-Man", t: 5, f: 5, s: "Invincible Omni-Man Nolan Grayson", variants: [
        { v: "no longer pretending", g: "mythic" },
        { v: "playing the hero for the cameras", g: "neutral" },
      ] },
      { n: "Thragg", t: 5, f: 5, s: "Invincible Thragg Viltrumite", variants: [
        { v: "Grand Regent, the strongest Viltrumite alive", g: "mythic" },
      ] },
      { n: "Conquest", t: 5, s: "Invincible Conquest Viltrumite", variants: [
        { v: "smiling, and only now getting started", g: "legendary" },
      ] },
      { n: "Battle Beast", t: 5, f: 5, s: "Invincible Battle Beast", variants: [
        { v: "finally facing someone worth fighting", g: "legendary" },
        { v: "bored, and barely trying", g: "weakening" },
      ] },
      { n: "Allen the Alien", t: 4, s: "Invincible Allen the Alien", variants: [
        { v: "upgraded, after the beating", g: "major" },
      ] },
      { n: "Atom Eve", t: 5, f: 5, s: "Invincible Atom Eve", variants: [
        { v: "no longer limiting herself", g: "mythic" },
        { v: "refusing to work on living things", g: "weakening" },
      ] },
      { n: "Cecil Stedman", t: 2, f: 5, s: "Invincible Cecil Stedman GDA", variants: [
        { v: "with every contingency already in place", g: "legendary" },
      ] },
      { n: "The Immortal", t: 4, s: "Invincible The Immortal", variants: [
        { v: "getting back up again", g: "major" },
      ] },
      { n: "Rex Splode", t: 3, s: "Invincible Rex Splode" },
      { n: "Robot", t: 3, s: "Invincible Robot Rudy Waller", variants: [
        { v: "with a plan three years in motion", g: "legendary" },
      ] },
      { n: "Monster Girl", t: 3, s: "Invincible Monster Girl", variants: [
        { v: "fully transformed", g: "major" },
        { v: "younger with every fight", g: "weakening" },
      ] },
      { n: "Dupli-Kate", t: 2, s: "Invincible Dupli-Kate" },
      { n: "Titan", t: 3, s: "Invincible Titan rock" },
      { n: "Angstrom Levy", t: 3, s: "Invincible Angstrom Levy", variants: [
        { v: "opening a door to somewhere worse", g: "legendary" },
      ] },
      { n: "Anissa", t: 5, s: "Invincible Anissa Viltrumite" },
      { n: "Oliver Grayson", t: 4, s: "Invincible Oliver Kid Omni-Man" },
      { n: "Debbie Grayson", t: 1, f: 1, s: "Invincible Debbie Grayson" },
      { n: "Darkwing", t: 2, s: "Invincible Darkwing" },
      { n: "Doc Seismic", t: 2, s: "Invincible Doc Seismic" },
      { n: "The Mauler Twins", t: 3, s: "Invincible Mauler Twins" },
      { n: "Machine Head", t: 2, f: 1, s: "Invincible Machine Head" },
      { n: "Thaedus", t: 4, s: "Invincible Thaedus Viltrumite" },
      { n: "A Reanimen", t: 2, f: 1, s: "Invincible Reanimen GDA" },
    ],
  },

  // ── Mortal Kombat ──────────────────────────────────
  {
    id: "mk",
    name: "Mortal Kombat",
    emoji: "\ud83d\udc80",
    blurb: "Draft your kombatants. Finish them.",
    imgContext: "Mortal Kombat character",
    wiki: "mortalkombat",
    scenario:
      "The tournament is called and two drafted sides answer. Souls are on the table, the realms are watching, and there is no such thing as a draw.",
    criteria:
      "Martial skill, sorcery and sheer inhumanity. A god or an elder sorcerer outclasses a special forces officer no matter how good she is with a gun \u2014 but the tournament has rules, and rules have been used to beat gods before.",
    arenas: [
      { name: "The Pit", desc: "A bridge over spikes. One good throw ends it, whoever you are.", weight: 8 },
      { name: "Shang Tsung\u0027s island", desc: "Tournament rules, one on one, sorcery permitted and encouraged.", weight: 10 },
      { name: "Outworld\u0027s wastes", desc: "Shao Kahn\u0027s ground. Anything native fights stronger; anything from Earthrealm does not.", weight: 4 },
      { name: "The Netherrealm", desc: "Fire, torment and the already-dead. Revenants and demons are simply at home.", weight: 3 },
      { name: "The Living Forest", desc: "The trees eat people. Nobody has the advantage except whatever is hungry.", weight: 2 },
    ],
    entries: [
      { n: "Scorpion", t: 5, f: 5, s: "Mortal Kombat Scorpion yellow ninja", variants: [
        { v: "Hellfire, spear already out", g: "legendary" },
        { v: "Hanzo Hasashi, still alive and human", g: "weakening" },
      ] },
      { n: "Sub-Zero", t: 5, f: 5, s: "Mortal Kombat Sub-Zero blue ninja", variants: [
        { v: "Grandmaster of the Lin Kuei", g: "legendary" },
        { v: "the younger brother, still learning", g: "weakening" },
      ] },
      { n: "Raiden", t: 5, f: 5, s: "Mortal Kombat Raiden thunder god", variants: [
        { v: "full god, unbound by the Elder Gods", g: "mythic" },
        { v: "made mortal for the tournament", g: "crippling" },
      ] },
      { n: "Liu Kang", t: 5, f: 5, s: "Mortal Kombat Liu Kang", variants: [
        { v: "the Fire God, remaking history", g: "mythic" },
        { v: "champion of Earthrealm", g: "legendary" },
      ] },
      { n: "Shao Kahn", t: 5, f: 5, s: "Mortal Kombat Shao Kahn", variants: [
        { v: "with the hammer, in Outworld", g: "legendary" },
        { v: "weakened by an unearned merger", g: "weakening" },
      ] },
      { n: "Shang Tsung", t: 5, s: "Mortal Kombat Shang Tsung sorcerer", variants: [
        { v: "young again, souls freshly taken", g: "legendary" },
        { v: "an old man running out of souls", g: "crippling" },
      ] },
      { n: "Quan Chi", t: 4, s: "Mortal Kombat Quan Chi sorcerer", variants: [
        { v: "with an army of revenants", g: "legendary" },
      ] },
      { n: "Shinnok", t: 5, s: "Mortal Kombat Shinnok fallen elder god", variants: [
        { v: "with the amulet, corrupted form", g: "mythic" },
      ] },
      { n: "Kronika", t: 5, s: "Mortal Kombat Kronika titan", variants: [
        { v: "rewinding the hourglass", g: "mythic" },
      ] },
      { n: "Goro", t: 4, s: "Mortal Kombat Goro four arms Shokan", variants: [
        { v: "nine-time undefeated champion", g: "major" },
      ] },
      { n: "Kitana", t: 4, f: 5, s: "Mortal Kombat Kitana fan blades", variants: [
        { v: "with the steel fans, ten thousand years of practice", g: "major" },
      ] },
      { n: "Mileena", t: 4, s: "Mortal Kombat Mileena sai teeth", variants: [
        { v: "completely off the leash", g: "major" },
      ] },
      { n: "Sonya Blade", t: 3, f: 5, s: "Mortal Kombat Sonya Blade special forces" },
      { n: "Johnny Cage", t: 3, f: 5, s: "Mortal Kombat Johnny Cage", variants: [
        { v: "green energy, and genuinely trying", g: "major" },
        { v: "playing to the crowd", g: "weakening" },
      ] },
      { n: "Jax Briggs", t: 3, s: "Mortal Kombat Jax metal arms", variants: [
        { v: "with the cybernetic arms", g: "boon" },
      ] },
      { n: "Kung Lao", t: 4, s: "Mortal Kombat Kung Lao razor hat", variants: [
        { v: "hat spinning, at his absolute peak", g: "legendary" },
      ] },
      { n: "Kano", t: 3, s: "Mortal Kombat Kano Black Dragon eye" },
      { n: "Reptile", t: 3, s: "Mortal Kombat Reptile green ninja", variants: [
        { v: "invisible, and already behind you", g: "major" },
      ] },
      { n: "Ermac", t: 4, s: "Mortal Kombat Ermac", variants: [
        { v: "many souls, one purpose", g: "major" },
      ] },
      { n: "Noob Saibot", t: 4, s: "Mortal Kombat Noob Saibot shadow" },
      { n: "Smoke", t: 3, s: "Mortal Kombat Smoke cyber ninja" },
      { n: "Baraka", t: 3, s: "Mortal Kombat Baraka Tarkatan blades" },
      { n: "Sindel", t: 4, s: "Mortal Kombat Sindel scream hair", variants: [
        { v: "the scream, at full volume", g: "major" },
      ] },
      { n: "Nightwolf", t: 3, s: "Mortal Kombat Nightwolf" },
      { n: "Kabal", t: 3, s: "Mortal Kombat Kabal hookswords", variants: [
        { v: "moving faster than anyone can react", g: "major" },
      ] },
      { n: "Jade", t: 3, s: "Mortal Kombat Jade staff green" },
      { n: "Rain", t: 3, s: "Mortal Kombat Rain purple demigod" },
      { n: "Kenshi", t: 4, s: "Mortal Kombat Kenshi blind swordsman", variants: [
        { v: "with Sento, ancestors guiding the blade", g: "major" },
      ] },
      { n: "Sheeva", t: 4, s: "Mortal Kombat Sheeva Shokan" },
      { n: "Motaro", t: 4, s: "Mortal Kombat Motaro centaur" },
      { n: "Cassie Cage", t: 3, s: "Mortal Kombat Cassie Cage" },
      { n: "A Tarkatan foot soldier", t: 1, f: 1, s: "Mortal Kombat Tarkatan soldier" },
    ],
  },

  // ── Street Fighter ────────────────────────────────
  {
    id: "sf",
    name: "Street Fighter",
    emoji: "\ud83d\udc4a",
    blurb: "Draft your fighters. Round one, fight.",
    imgContext: "Street Fighter character",
    wiki: "streetfighter",
    scenario:
      "The World Warrior tournament brackets are drawn and two drafted sides face off. One on one, no weapons, and the only thing that matters is who is still standing.",
    criteria:
      "Pure martial ability, ki and conditioning. Weigh style matchups honestly \u2014 a grappler who closes the distance beats a zoner, and a zoner who never lets them close beats the grappler. Murderous intent counts for a lot here.",
    arenas: [
      { name: "A tournament stage", desc: "Flat ground, a crowd, and a referee. Pure one-on-one skill decides it.", weight: 10 },
      { name: "Guile\u0027s airbase", desc: "Open runway with nowhere to hide. Projectile users own this ground.", weight: 3 },
      { name: "A Bangkok temple at night", desc: "Sagat\u0027s ground. Close quarters, statues to break, and honour on the line.", weight: 3 },
      { name: "Shadaloo\u0027s base", desc: "Bison\u0027s ground, full of Psycho Power. Anything he has touched fights harder.", weight: 3 },
      { name: "A moving cargo ship", desc: "Uneven footing and a lot of ways to go overboard. Balance beats power.", weight: 2 },
    ],
    entries: [
      { n: "Ryu", t: 5, f: 5, s: "Street Fighter Ryu headband", variants: [
        { v: "the Satsui no Hado awakened", g: "mythic" },
        { v: "Power of Nothingness, calm and complete", g: "legendary" },
        { v: "still just a wandering student", g: "weakening" },
      ] },
      { n: "Ken Masters", t: 4, f: 5, s: "Street Fighter Ken Masters blonde", variants: [
        { v: "Shoryuken, fully on fire", g: "major" },
      ] },
      { n: "Chun-Li", t: 5, f: 5, s: "Street Fighter Chun-Li", variants: [
        { v: "the strongest woman in the world, and she knows it", g: "legendary" },
      ] },
      { n: "Akuma", t: 5, f: 5, s: "Street Fighter Akuma Gouki", variants: [
        { v: "Raging Demon, and he means it", g: "mythic" },
        { v: "holding back to test them", g: "neutral" },
      ] },
      { n: "M. Bison", t: 5, f: 5, s: "Street Fighter M Bison Vega dictator", variants: [
        { v: "full Psycho Power, a fresh body ready", g: "legendary" },
        { v: "in a body that is failing him", g: "weakening" },
      ] },
      { n: "Sagat", t: 5, s: "Street Fighter Sagat eyepatch Muay Thai", variants: [
        { v: "the Emperor of Muay Thai, scar and all", g: "legendary" },
      ] },
      { n: "Guile", t: 4, f: 5, s: "Street Fighter Guile flat top", variants: [
        { v: "charged and waiting, Sonic Boom ready", g: "major" },
      ] },
      { n: "Zangief", t: 4, f: 5, s: "Street Fighter Zangief wrestler", variants: [
        { v: "close enough to grab you", g: "legendary" },
        { v: "kept at arm\u0027s length all match", g: "crippling" },
      ] },
      { n: "Blanka", t: 3, s: "Street Fighter Blanka green" },
      { n: "Dhalsim", t: 4, s: "Street Fighter Dhalsim yoga", variants: [
        { v: "limbs at full stretch, nobody getting in", g: "major" },
      ] },
      { n: "Cammy", t: 4, s: "Street Fighter Cammy White", variants: [
        { v: "free of Shadaloo\u0027s conditioning", g: "major" },
        { v: "still under Bison\u0027s control", g: "weakening" },
      ] },
      { n: "Vega", t: 3, s: "Street Fighter Vega claw mask Balrog", variants: [
        { v: "claw on, cage to climb", g: "boon" },
        { v: "mask broken, and vain about it", g: "crippling" },
      ] },
      { n: "Balrog", t: 3, s: "Street Fighter Balrog boxer" },
      { n: "Sakura", t: 3, f: 5, s: "Street Fighter Sakura schoolgirl" },
      { n: "Juri", t: 4, s: "Street Fighter Juri Han", variants: [
        { v: "Feng Shui Engine active", g: "legendary" },
      ] },
      { n: "Gouken", t: 5, s: "Street Fighter Gouken", variants: [
        { v: "having survived the Raging Demon", g: "legendary" },
      ] },
      { n: "Oro", t: 5, s: "Street Fighter Oro hermit", variants: [
        { v: "using both arms", g: "mythic" },
        { v: "one arm sealed, as always", g: "neutral" },
      ] },
      { n: "Gill", t: 5, s: "Street Fighter Gill Illuminati", variants: [
        { v: "resurrecting mid-fight", g: "legendary" },
      ] },
      { n: "Urien", t: 4, s: "Street Fighter Urien" },
      { n: "Alex", t: 3, s: "Street Fighter Alex" },
      { n: "Q", t: 3, s: "Street Fighter Q trenchcoat" },
      { n: "Dudley", t: 3, s: "Street Fighter Dudley boxer gentleman" },
      { n: "Makoto", t: 3, s: "Street Fighter Makoto karate" },
      { n: "Ibuki", t: 3, s: "Street Fighter Ibuki ninja" },
      { n: "Elena", t: 3, s: "Street Fighter Elena capoeira" },
      { n: "Rose", t: 3, s: "Street Fighter Rose scarf fortune" },
      { n: "E. Honda", t: 3, s: "Street Fighter E Honda sumo" },
      { n: "Fei Long", t: 3, s: "Street Fighter Fei Long" },
      { n: "Luke", t: 3, s: "Street Fighter Luke Sullivan" },
      { n: "Dan Hibiki", t: 1, f: 5, s: "Street Fighter Dan Hibiki pink", variants: [
        { v: "somehow, inexplicably, winning", g: "legendary" },
        { v: "taunting instead of attacking", g: "crippling" },
      ] },
    ],
  },

  // ── Super Smash Bros. ─────────────────────────────
  {
    id: "smash",
    name: "Smash Bros.",
    emoji: "\ud83c\udfae",
    blurb: "Four stock, no items, Final Destination. Draft accordingly.",
    imgContext: "Super Smash Bros character",
    wiki: "supersmashbros",
    scenario:
      "Two drafted rosters take the stage for a set nobody agreed on the rules for. Stocks, percentages and blast zones \u2014 this is decided by who gets knocked off, not who gets knocked out.",
    criteria:
      "This is a FIGHTING GAME, so judge it like one: frame data, recovery, kill confirms and matchup spreads. A character who is merely powerful in their own series can still be bottom tier here, and a puffball with a rest confirm can be terrifying. Which GAME a fighter is from matters enormously \u2014 the same character is a different fighter in Melee and in Brawl.",
    arenas: [
      { name: "Final Destination", desc: "No platforms, no items, no excuses. Pure neutral-game skill.", weight: 10 },
      { name: "Battlefield", desc: "Three platforms. Combo-heavy and fast-fallers thrive.", weight: 6 },
      { name: "Items on, Hyrule Castle", desc: "Total chaos. Skill matters far less than luck and a well-timed Bob-omb.", weight: 3 },
      { name: "A tournament grand final, bracket reset", desc: "Crowd, cameras and nerves. Composure counts as much as skill.", weight: 3 },
      { name: "Sudden death at 300%", desc: "One hit ends it. Anything with a fast, far-reaching move is enormously favoured.", weight: 2 },
    ],
    entries: [
      { n: "Fox McCloud", t: 5, f: 5, s: "Super Smash Bros Melee Fox", variants: [
        { v: "Melee Fox, shine into absolutely everything", g: "mythic" },
        { v: "Brawl Fox, and everything is slower", g: "crippling" },
      ] },
      { n: "Falco Lombardi", t: 5, f: 5, s: "Super Smash Bros Melee Falco", variants: [
        { v: "Melee Falco, the way Mang0 played him", g: "mythic" },
        { v: "laser, laser, laser, dair", g: "legendary" },
        { v: "recovering low, and everyone knows it", g: "crippling" },
      ] },
      { n: "Jigglypuff", t: 4, f: 5, s: "Super Smash Bros Jigglypuff", variants: [
        { v: "Melee Puff, Hungrybox reading the rest", g: "mythic" },
        { v: "Brawl Jigglypuff, bottom of the tier list", g: "crippling" },
      ] },
      { n: "Marth", t: 5, f: 5, s: "Super Smash Bros Melee Marth", variants: [
        { v: "Melee Marth, tipper on every hit", g: "legendary" },
        { v: "hitting with the hilt every time", g: "crippling" },
      ] },
      { n: "Sheik", t: 4, s: "Super Smash Bros Melee Sheik", variants: [
        { v: "Melee Sheik, chaingrab into everything", g: "legendary" },
        { v: "Ultimate Sheik, no kill power at all", g: "weakening" },
      ] },
      { n: "Captain Falcon", t: 4, f: 5, s: "Super Smash Bros Captain Falcon", variants: [
        { v: "the knee, and it connected", g: "legendary" },
        { v: "whiffing the knee entirely", g: "crippling" },
      ] },
      { n: "Peach", t: 4, s: "Super Smash Bros Melee Peach", variants: [
        { v: "Melee Peach, floated the way Armada did", g: "legendary" },
        { v: "pulling a stitchface turnip", g: "major" },
      ] },
      { n: "Ice Climbers", t: 4, s: "Super Smash Bros Ice Climbers", variants: [
        { v: "wobbling, back when it was legal", g: "mythic" },
        { v: "Nana desynced and wandering off", g: "crippling" },
      ] },
      { n: "Meta Knight", t: 5, f: 5, s: "Super Smash Bros Brawl Meta Knight", variants: [
        { v: "Brawl Meta Knight, banned in most regions", g: "mythic" },
      ] },
      { n: "Bayonetta", t: 5, s: "Super Smash Bros Bayonetta", variants: [
        { v: "Smash 4 Bayonetta, ladder combo from zero", g: "mythic" },
      ] },
      { n: "Steve", t: 5, s: "Super Smash Bros Ultimate Steve Minecraft", variants: [
        { v: "given a moment to build scaffolding", g: "legendary" },
        { v: "out of materials", g: "crippling" },
      ] },
      { n: "Pikachu", t: 5, f: 5, s: "Super Smash Bros Pikachu", variants: [
        { v: "Ultimate Pikachu, quick attack recovery", g: "legendary" },
      ] },
      { n: "Kirby", t: 3, f: 5, s: "Super Smash Bros Kirby", variants: [
        { v: "Smash 64 Kirby, utterly dominant", g: "legendary" },
        { v: "Brawl Kirby, and nothing kills", g: "weakening" },
      ] },
      { n: "Mario", t: 4, f: 5, s: "Super Smash Bros Mario", variants: [
        { v: "the most balanced fighter on the roster", g: "boon" },
      ] },
      { n: "Link", t: 3, f: 5, s: "Super Smash Bros Link", variants: [
        { v: "Ultimate Link, remote bombs set", g: "major" },
        { v: "Melee Link, bottom tier and sluggish", g: "crippling" },
      ] },
      { n: "Samus", t: 3, s: "Super Smash Bros Samus", variants: [
        { v: "fully charged shot held", g: "major" },
      ] },
      { n: "Zero Suit Samus", t: 4, s: "Super Smash Bros Zero Suit Samus" },
      { n: "Ganondorf", t: 3, f: 5, s: "Super Smash Bros Ganondorf", variants: [
        { v: "warlock punch, and it somehow landed", g: "legendary" },
        { v: "trying to recover from off-stage", g: "crippling" },
      ] },
      { n: "Little Mac", t: 3, s: "Super Smash Bros Little Mac", variants: [
        { v: "on the ground, KO punch ready", g: "legendary" },
        { v: "knocked off-stage even slightly", g: "crippling" },
      ] },
      { n: "Sonic", t: 4, s: "Super Smash Bros Sonic", variants: [
        { v: "up one stock and running the clock", g: "legendary" },
      ] },
      { n: "Snake", t: 4, s: "Super Smash Bros Brawl Snake", variants: [
        { v: "Brawl Snake, the stage already mined", g: "legendary" },
      ] },
      { n: "Pichu", t: 2, f: 1, s: "Super Smash Bros Melee Pichu", variants: [
        { v: "Ultimate Pichu, genuinely high tier", g: "legendary" },
        { v: "Melee Pichu, hurting itself in confusion", g: "crippling" },
      ] },
      { n: "Cloud Strife", t: 4, s: "Super Smash Bros Cloud", variants: [
        { v: "Limit Break charged", g: "major" },
      ] },
      { n: "Sephiroth", t: 4, s: "Super Smash Bros Sephiroth", variants: [
        { v: "one winged angel, at low stocks", g: "legendary" },
      ] },
      { n: "Joker", t: 5, s: "Super Smash Bros Joker Persona", variants: [
        { v: "Arsene summoned", g: "legendary" },
      ] },
      { n: "Ridley", t: 3, s: "Super Smash Bros Ultimate Ridley" },
      { n: "King K. Rool", t: 3, s: "Super Smash Bros King K Rool" },
      { n: "Bowser", t: 4, s: "Super Smash Bros Bowser", variants: [
        { v: "Ultimate Bowser, tough guy armour", g: "major" },
      ] },
      { n: "Donkey Kong", t: 3, s: "Super Smash Bros Donkey Kong", variants: [
        { v: "cargo throw into a spike", g: "major" },
      ] },
      { n: "Ness", t: 3, s: "Super Smash Bros Ness", variants: [
        { v: "PK Thunder recovery, executed cleanly", g: "boon" },
        { v: "PK Thunder into himself, off-stage", g: "crippling" },
      ] },
      { n: "Mr. Game and Watch", t: 3, s: "Super Smash Bros Mr Game and Watch", variants: [
        { v: "judge hammer, and it rolled a nine", g: "legendary" },
      ] },
      { n: "Terry Bogard", t: 4, s: "Super Smash Bros Terry Bogard" },
      { n: "Kazuya Mishima", t: 4, s: "Super Smash Bros Kazuya", variants: [
        { v: "electric wind god fist, frame perfect", g: "legendary" },
      ] },
      { n: "Pyra and Mythra", t: 4, s: "Super Smash Bros Pyra Mythra" },
      { n: "Banjo and Kazooie", t: 3, s: "Super Smash Bros Banjo Kazooie" },
      { n: "Sora", t: 3, s: "Super Smash Bros Sora Kingdom Hearts" },
      { n: "Olimar", t: 3, s: "Super Smash Bros Olimar Pikmin", variants: [
        { v: "a full line of purple Pikmin", g: "major" },
        { v: "no Pikmin left at all", g: "crippling" },
      ] },
      { n: "Diddy Kong", t: 4, s: "Super Smash Bros Diddy Kong", variants: [
        { v: "Smash 4 Diddy, hoo-hah into everything", g: "legendary" },
      ] },
    ],
  },

  // ── The Vampire Diaries ───────────────────────────────────────────────────
  {
    id: "tvd",
    name: "The Vampire Diaries",
    emoji: "\ud83e\ude78",
    blurb: "Mystic Falls and New Orleans. Everybody has died at least once.",
    imgContext: "The Vampire Diaries character",
    wiki: "vampirediaries",
    scenario:
      "Two drafted sides meet after dark in Mystic Falls. Daylight rings are assumed, invitations are not, and nobody stays dead reliably.",
    criteria:
      "Age is power here — an Original outclasses a century-old vampire almost regardless of who they are. Witches decide fights they are not physically in. Humans are leverage, not fighters.",
    arenas: [
      { name: "The Mystic Grill, after close", desc: "Indoors, cramped, wooden furniture everywhere and a stake in every chair leg.", weight: 8 },
      { name: "The Salvatore boarding house", desc: "A private home. Nobody uninvited crosses the threshold, and everyone knows where the vervain is.", weight: 5 },
      { name: "The French Quarter at night", desc: "Open streets, packed with people, and every witch in the city is watching.", weight: 5 },
      { name: "A consecrated churchyard at noon", desc: "Full sun, open ground. Anything without a daylight ring is already losing.", weight: 3 },
      { name: "The Bennett family cemetery", desc: "Ancestral ground. Magic runs strong here and it does not run evenly.", weight: 3 },
    ],
    entries: [
      { n: "Klaus Mikaelson", t: 5, f: 5, variants: [
        { v: "hybrid curse broken, sire line intact", g: "legendary" },
        { v: "daggered in a box", g: "crippling" },
        { v: "white oak stake at his throat", g: "weakening" },
      ] },
      { n: "Elijah Mikaelson", t: 4, f: 5, variants: [
        { v: "the Red Door open", g: "legendary" },
        { v: "compelled to forget", g: "weakening" },
      ] },
      { n: "Rebekah Mikaelson", t: 4, f: 4 },
      { n: "Kol Mikaelson", t: 4, f: 3, variants: [{ v: "witch again, and furious", g: "major" }] },
      { n: "Finn Mikaelson", t: 3, f: 2 },
      { n: "Freya Mikaelson", t: 4, f: 3, variants: [{ v: "a century of borrowed power", g: "major" }] },
      { n: "Mikael", t: 5, f: 3, s: "The Destroyer", variants: [
        { v: "with the white oak stake", g: "legendary" },
        { v: "no weapon, only hands", g: "weakening" },
      ] },
      { n: "Esther Mikaelson", t: 4, f: 3, s: "The Original Witch", variants: [
        { v: "channelling the Bennett line", g: "legendary" },
      ] },
      { n: "Dahlia", t: 5, f: 2, variants: [{ v: "awake, on the century", g: "legendary" }] },
      { n: "Hope Mikaelson", t: 4, f: 4, variants: [
        { v: "tribrid, fully activated", g: "mythic" },
        { v: "a child in hiding", g: "crippling" },
      ] },
      { n: "Silas", t: 5, f: 3, variants: [{ v: "in your head, wearing your face", g: "legendary" }] },
      { n: "Qetsiyah", t: 4, f: 2 },
      { n: "Marcel Gerard", t: 3, f: 4, variants: [
        { v: "the Beast, after the serum", g: "legendary" },
        { v: "human again", g: "crippling" },
      ] },
      { n: "Lucien Castle", t: 4, f: 2, s: "the first Upgraded Original" },
      { n: "Damon Salvatore", t: 3, f: 5, variants: [
        { v: "humanity switched off", g: "major" },
        { v: "desiccated in a cell", g: "crippling" },
      ] },
      { n: "Stefan Salvatore", t: 3, f: 5, variants: [
        { v: "the Ripper of Monterey", g: "legendary" },
        { v: "on a bunny diet", g: "weakening" },
      ] },
      { n: "Elena Gilbert", t: 2, f: 5, variants: [
        { v: "a vampire, humanity off", g: "major" },
        { v: "the human doppelganger", g: "weakening" },
      ] },
      { n: "Katherine Pierce", t: 3, f: 4, variants: [
        { v: "five hundred years of running and winning", g: "major" },
        { v: "the cure in her, dying", g: "crippling" },
      ] },
      { n: "Caroline Forbes", t: 3, f: 5, variants: [{ v: "no humanity", g: "major" }] },
      { n: "Bonnie Bennett", t: 4, f: 5, variants: [
        { v: "expression magic", g: "legendary" },
        { v: "no magic at all", g: "crippling" },
      ] },
      { n: "Alaric Saltzman", t: 2, f: 5, variants: [
        { v: "Enhanced Original, built to kill Originals", g: "legendary" },
        { v: "a history teacher with a crossbow", g: "weakening" },
      ] },
      { n: "Kai Parker", t: 4, f: 4, variants: [
        { v: "merged, siphoning everything in reach", g: "legendary" },
        { v: "sealed in a prison world", g: "crippling" },
      ] },
      { n: "Davina Claire", t: 4, f: 3, variants: [{ v: "all four Harvest girls in her", g: "legendary" }] },
      { n: "Tyler Lockwood", t: 3, f: 3, variants: [
        { v: "a full hybrid, no longer sired", g: "major" },
        { v: "mid-turn on a full moon", g: "weakening" },
      ] },
      { n: "Hayley Marshall", t: 3, f: 4, variants: [{ v: "Crescent alpha, hybrid, turning at will", g: "legendary" }] },
      { n: "Enzo St. John", t: 3, f: 3 },
      { n: "Jeremy Gilbert", t: 2, f: 3, variants: [{ v: "hunter's mark complete", g: "major" }] },
      { n: "The Hollow", t: 5, f: 2, s: "Inadu Vampire Diaries" },
      { n: "Malivore", t: 5, f: 1, s: "Legacies Malivore" },
      { n: "Josie Saltzman", t: 3, f: 2, variants: [{ v: "Dark Josie, fully merged", g: "legendary" }] },
      { n: "Lizzie Saltzman", t: 3, f: 2 },
      { n: "Rayna Cruz", t: 4, f: 2, variants: [{ v: "with the Phoenix Sword", g: "legendary" }] },
      { n: "Papa Tunde", t: 3, f: 2, variants: [{ v: "with the blade", g: "major" }] },
      { n: "Aurora de Martel", t: 3, f: 2 },
      { n: "Tristan de Martel", t: 3, f: 2 },
      { n: "Vincent Griffith", t: 3, f: 2 },
      { n: "Lily Salvatore", t: 3, f: 2 },
      { n: "Julian", t: 3, f: 1 },
      { n: "Nora Hildegard", t: 3, f: 1 },
      { n: "Mary Louise", t: 3, f: 1 },
      { n: "Beau", t: 3, f: 1 },
      { n: "Lexi Branson", t: 3, f: 2 },
      { n: "Sage", t: 3, f: 1 },
      { n: "Rose", t: 3, f: 2 },
      { n: "Trevor", t: 2, f: 1 },
      { n: "Mason Lockwood", t: 2, f: 2 },
      { n: "Jules", t: 2, f: 1 },
      { n: "Anna", t: 2, f: 1 },
      { n: "Pearl", t: 2, f: 1 },
      { n: "Nadia Petrova", t: 3, f: 1 },
      { n: "Liv Parker", t: 3, f: 1 },
      { n: "Luke Parker", t: 3, f: 1 },
      { n: "Joshua Parker", t: 3, f: 1 },
      { n: "Josh Rosza", t: 2, f: 2 },
      { n: "Ansel", t: 3, f: 1 },
      { n: "Matt Donovan", t: 1, f: 4 },
      { n: "Jenna Sommers", t: 1, f: 2 },
      { n: "Sheriff Liz Forbes", t: 1, f: 2 },
      { n: "Camille O'Connell", t: 1, f: 2 },
      { n: "Vicki Donovan", t: 2, f: 1 },
      { n: "Amara", t: 2, f: 1 },
      { n: "Landon Kirby", t: 2, f: 1 },
      { n: "Zach Salvatore", t: 1, f: 1 },
    ],
  },

  // ── X-Men ─────────────────────────────────────────────────────────────────
  {
    id: "xmen",
    name: "X-Men",
    emoji: "\ud83e\uddec",
    blurb: "Mutants only. Everyone here was born into this argument.",
    imgContext: "X-Men Marvel mutant character",
    wiki: "xmen",
    scenario:
      "Two drafted mutant squads meet on open ground. No Avengers, no gods — this is a mutant fight, decided by mutant rules.",
    criteria:
      "Raw output matters less than control. An Omega-level mutant who can end the fight without moving beats four brawlers, and a telepath decides most fights before anyone throws a punch — unless somebody on the other side is built to stop one.",
    arenas: [
      { name: "The grounds of the Xavier Institute", desc: "Open lawn, no cover, and the Danger Room is not available to either side.", weight: 8 },
      { name: "A plastic prison, no metal anywhere", desc: "Purpose-built. Nothing ferrous within a mile, by design.", weight: 3 },
      { name: "Asteroid M, in vacuum", desc: "No air, no ground, no sound. Anything that needs to breathe is on a clock.", weight: 3 },
      { name: "A Sentinel factory floor", desc: "Machines everywhere, metal underfoot, and the assembly line is still running.", weight: 4 },
      { name: "The Morlock tunnels", desc: "Pitch black, cramped, and the ceiling is low enough to matter.", weight: 3 },
    ],
    entries: [
      { n: "Professor X", s: "Charles Xavier", t: 5, f: 5, variants: [
        { v: "Onslaught", g: "mythic" },
        { v: "amplified by Cerebro", g: "legendary" },
        { v: "a man in a chair, no telepathy", g: "crippling" },
      ] },
      { n: "Magneto", t: 5, f: 5, variants: [
        { v: "on a battlefield of steel", g: "legendary" },
        { v: "in a plastic cell", g: "crippling" },
      ] },
      { n: "Wolverine", t: 4, f: 5, variants: [
        { v: "adamantium bonded, berserker rage", g: "legendary" },
        { v: "bone claws only", g: "weakening" },
        { v: "Old Man Logan", g: "neutral" },
      ] },
      { n: "Jean Grey", t: 4, f: 5, variants: [
        { v: "Dark Phoenix", g: "mythic" },
        { v: "the Phoenix Force, controlled", g: "legendary" },
        { v: "psychic blocks intact", g: "weakening" },
      ] },
      { n: "Cyclops", t: 4, f: 5, variants: [{ v: "visor off, full aperture", g: "major" }] },
      { n: "Storm", t: 4, f: 5, variants: [
        { v: "unshackled, in open sky", g: "legendary" },
        { v: "claustrophobic, underground", g: "crippling" },
      ] },
      { n: "Rogue", t: 4, f: 5, variants: [
        { v: "holding Ms. Marvel's powers", g: "legendary" },
        { v: "gloves on, no contact", g: "weakening" },
      ] },
      { n: "Nightcrawler", t: 3, f: 4 },
      { n: "Colossus", t: 4, f: 4, variants: [{ v: "the Juggernaut, with the Crimson Gem", g: "legendary" }] },
      { n: "Iceman", t: 4, f: 4, variants: [{ v: "Omega-level, fully realised", g: "legendary" }] },
      { n: "Beast", s: "Hank McCoy", t: 3, f: 4 },
      { n: "Gambit", t: 3, f: 4, variants: [{ v: "charging everything he touches", g: "major" }] },
      { n: "Kitty Pryde", t: 3, f: 4, variants: [{ v: "phased, and phasing you", g: "major" }] },
      { n: "Emma Frost", t: 4, f: 4, variants: [
        { v: "diamond form", g: "major" },
        { v: "diamond form, and telepathy gone with it", g: "neutral" },
      ] },
      { n: "Psylocke", t: 4, f: 3, variants: [{ v: "psychic knife drawn", g: "major" }] },
      { n: "Magik", s: "Illyana Rasputin", t: 4, f: 3, variants: [
        { v: "Darkchylde, with the Soulsword", g: "legendary" },
      ] },
      { n: "Cable", t: 4, f: 4, variants: [{ v: "techno-organic virus contained", g: "major" }] },
      { n: "Deadpool", t: 3, f: 5 },
      { n: "Bishop", t: 3, f: 3 },
      { n: "Apocalypse", t: 5, f: 5, variants: [
        { v: "with all four Horsemen", g: "legendary" },
        { v: "mid-regeneration, out of the pod", g: "weakening" },
      ] },
      { n: "Mister Sinister", t: 4, f: 3 },
      { n: "Sabretooth", t: 4, f: 4 },
      { n: "Juggernaut", t: 5, f: 4, variants: [
        { v: "at full momentum, unstoppable", g: "legendary" },
        { v: "helmet off", g: "weakening" },
      ] },
      { n: "Mystique", t: 3, f: 4 },
      { n: "Legion", s: "David Haller", t: 5, f: 3, variants: [
        { v: "every personality aligned at once", g: "mythic" },
        { v: "fractured, arguing with himself", g: "crippling" },
      ] },
      { n: "Proteus", t: 5, f: 2 },
      { n: "Nate Grey", s: "X-Man", t: 5, f: 2 },
      { n: "Vulcan", t: 5, f: 1 },
      { n: "Exodus", t: 4, f: 1 },
      { n: "Archangel", t: 3, f: 3, variants: [{ v: "Horseman of Death, metal wings", g: "legendary" }] },
      { n: "Havok", t: 4, f: 3 },
      { n: "Polaris", t: 4, f: 3 },
      { n: "Quicksilver", t: 4, f: 4 },
      { n: "X-23", s: "Laura Kinney", t: 4, f: 4 },
      { n: "Hope Summers", t: 4, f: 2 },
      { n: "Jubilee", t: 2, f: 3 },
      { n: "Banshee", t: 3, f: 2 },
      { n: "Domino", t: 3, f: 3, variants: [{ v: "luck field wide open", g: "major" }] },
      { n: "Cannonball", t: 3, f: 3, variants: [{ v: "blast field up, invulnerable while flying", g: "major" }] },
      { n: "Sunspot", t: 3, f: 2, variants: [{ v: "at high noon, fully charged", g: "major" }] },
      { n: "Wolfsbane", t: 2, f: 2 },
      { n: "Forge", t: 2, f: 2 },
      { n: "Dazzler", t: 3, f: 2 },
      { n: "Longshot", t: 3, f: 1 },
      { n: "Multiple Man", t: 3, f: 2 },
      { n: "Northstar", t: 3, f: 2 },
      { n: "Sunfire", t: 3, f: 2 },
      { n: "Blink", t: 3, f: 2 },
      { n: "Warpath", t: 3, f: 1 },
      { n: "Synch", t: 3, f: 1 },
      { n: "Chamber", t: 3, f: 1 },
      { n: "Husk", t: 2, f: 1 },
      { n: "Marrow", t: 2, f: 1 },
      { n: "Omega Red", t: 4, f: 2 },
      { n: "Lady Deathstrike", t: 3, f: 2 },
      { n: "Silver Samurai", t: 3, f: 1 },
      { n: "Shadow King", t: 4, f: 2 },
      { n: "Selene", t: 4, f: 1 },
      { n: "Sebastian Shaw", t: 4, f: 2, variants: [{ v: "already absorbed a great deal", g: "major" }] },
      { n: "Stryfe", t: 4, f: 2 },
      { n: "Bastion", t: 4, f: 2 },
      { n: "Nimrod", t: 5, f: 2 },
      { n: "Master Mold", t: 4, f: 1 },
      { n: "A Sentinel", t: 3, f: 3, s: "X-Men Sentinel robot" },
      { n: "Pyro", t: 3, f: 2 },
      { n: "Avalanche", t: 3, f: 2 },
      { n: "The Blob", t: 3, f: 2 },
      { n: "Toad", t: 2, f: 2 },
      { n: "Mojo", t: 3, f: 1 },
      { n: "Spiral", t: 3, f: 1 },
      { n: "Dark Beast", t: 3, f: 1 },
      { n: "Moira MacTaggert", t: 2, f: 2 },
      { n: "Gorgon", t: 3, f: 1 },
    ],
  },

  // ── Godzilla ──────────────────────────────────────────────────────────────
  {
    id: "godzilla",
    name: "Godzilla",
    emoji: "\ud83e\udd8e",
    blurb: "Kaiju only. Everything here is measured in city blocks.",
    imgContext: "Godzilla kaiju monster",
    wiki: "godzilla",
    scenario:
      "Two drafted kaiju meet where they always meet: somewhere with a great many people in it. There is no human element to this fight. There never is.",
    criteria:
      "Mass, durability and whether it has a beam. Regeneration decides long fights. Anything that flies decides short ones. Nothing here is stopped by conventional weapons, so do not weigh them.",
    arenas: [
      { name: "Tokyo Bay", desc: "Half water, half city. Amphibious things own this and things that only walk do not.", weight: 8 },
      { name: "Open ocean, mid-Pacific", desc: "No ground at all. Swimmers and fliers only; everything else is fighting the sea first.", weight: 4 },
      { name: "Hollow Earth", desc: "Enclosed, inverted gravity, and the ceiling is a long way up but it is still a ceiling.", weight: 3 },
      { name: "Antarctica, mid-blizzard", desc: "Ice, whiteout and nothing to hide behind. The cold reaches things that thought it would not.", weight: 3 },
      { name: "A city already burning", desc: "Fire everywhere, no clean footing, and the ground gives way at the worst moments.", weight: 4 },
    ],
    entries: [
      { n: "Godzilla", t: 5, f: 5, variants: [
        { v: "Burning Godzilla, meltdown imminent", g: "legendary" },
        { v: "Shin Godzilla, fourth form", g: "legendary" },
        { v: "Godzilla Earth", g: "mythic" },
        { v: "1954, no atomic breath yet", g: "weakening" },
        { v: "Godzilla Evolved, with the pink beam", g: "legendary" },
      ] },
      { n: "King Ghidorah", t: 5, f: 5, variants: [
        { v: "Mecha-King Ghidorah", g: "legendary" },
        { v: "Keizer Ghidorah", g: "mythic" },
        { v: "one head short", g: "weakening" },
      ] },
      { n: "Mothra", t: 4, f: 5, variants: [
        { v: "imago, in full sun", g: "major" },
        { v: "still a larva", g: "crippling" },
      ] },
      { n: "Rodan", t: 4, f: 4, variants: [{ v: "Fire Rodan", g: "legendary" }] },
      { n: "Mechagodzilla", t: 5, f: 4, variants: [
        { v: "Kiryu, Absolute Zero charged", g: "legendary" },
        { v: "out of ammunition", g: "weakening" },
      ] },
      { n: "King Kong", t: 4, f: 5, variants: [
        { v: "with the Beast Glove", g: "legendary" },
        { v: "with the axe", g: "major" },
        { v: "young, on Skull Island", g: "weakening" },
      ] },
      { n: "Destoroyah", t: 5, f: 3, variants: [{ v: "perfect form", g: "legendary" }] },
      { n: "SpaceGodzilla", t: 5, f: 3, variants: [{ v: "crystals up, on open ground", g: "major" }] },
      { n: "Biollante", t: 5, f: 2, variants: [{ v: "final plant beast form", g: "major" }] },
      { n: "Gigan", t: 4, f: 3, variants: [{ v: "chainsaw hands", g: "major" }] },
      { n: "Hedorah", t: 4, f: 3, variants: [{ v: "flying form, over a city", g: "major" }] },
      { n: "Monster X", t: 5, f: 2, variants: [{ v: "Keizer Ghidorah", g: "legendary" }] },
      { n: "Orga", t: 4, f: 2 },
      { n: "Megaguirus", t: 4, f: 2 },
      { n: "Battra", t: 4, f: 2 },
      { n: "Anguirus", t: 3, f: 3 },
      { n: "King Caesar", t: 3, f: 2 },
      { n: "Jet Jaguar", t: 3, f: 2, variants: [{ v: "grown to kaiju scale", g: "legendary" }] },
      { n: "Megalon", t: 3, f: 2 },
      { n: "Titanosaurus", t: 3, f: 2 },
      { n: "Baragon", t: 3, f: 2 },
      { n: "Varan", t: 3, f: 1 },
      { n: "Manda", t: 2, f: 1 },
      { n: "Kumonga", t: 3, f: 2 },
      { n: "Kamacuras", t: 2, f: 2 },
      { n: "Ebirah", t: 3, f: 2 },
      { n: "Gorosaurus", t: 3, f: 1 },
      { n: "Gabara", t: 2, f: 1 },
      { n: "Minilla", t: 1, f: 2 },
      { n: "Godzilla Junior", t: 3, f: 2 },
      { n: "Zilla", t: 3, f: 2, s: "Godzilla 1998" },
      { n: "Mechani-Kong", t: 3, f: 1 },
      { n: "Skullcrawler", t: 3, f: 3 },
      { n: "The Skull Devil", t: 4, f: 2 },
      { n: "Behemoth", t: 4, f: 2 },
      { n: "Scylla", t: 3, f: 2 },
      { n: "Methuselah", t: 4, f: 1 },
      { n: "Queen MUTO", t: 4, f: 3 },
      { n: "MUTO Prime", t: 4, f: 2 },
      { n: "Warbat", t: 3, f: 1 },
      { n: "Tiamat", t: 4, f: 1, s: "Godzilla Titanus Tiamat" },
      { n: "Shimo", t: 4, f: 2 },
      { n: "The Scar King", t: 4, f: 2 },
      { n: "Dagon", t: 4, f: 1 },
      { n: "Bagan", t: 5, f: 1 },
      { n: "Godzilla Ultima", t: 5, f: 1 },
    ],
  },

  // ── Yu-Gi-Oh! ─────────────────────────────────────────────────────────────
  {
    id: "yugioh",
    name: "Yu-Gi-Oh!",
    emoji: "\ud83c\udccf",
    blurb: "Duelists and their monsters. It's time to d-d-d-draft.",
    imgContext: "Yu-Gi-Oh character or monster card art",
    wiki: "yugioh",
    scenario:
      "A drafted side is a duelist and whatever they brought with them. Monsters fight as monsters; duelists fight by having the right card, which is the same thing here.",
    criteria:
      "A monster's raw power matters, but so does what a duelist can actually get onto the field. Egyptian Gods break the game on purpose. Exodia does not fight so much as end things.",
    arenas: [
      { name: "Battle City rooftop", desc: "Open, high, and the rules are being enforced by someone who cheats.", weight: 8 },
      { name: "The Shadow Realm", desc: "Losing costs more than the duel here, and the field itself is against somebody.", weight: 5 },
      { name: "Duelist Kingdom, the island", desc: "Open ground, field-power bonuses everywhere, and the terrain favours whoever read the map.", weight: 4 },
      { name: "The Millennium World", desc: "Ancient Egypt. The monsters are real, the stakes are real, and nobody is holding cards.", weight: 3 },
    ],
    entries: [
      { n: "Yugi Muto", t: 4, f: 5, variants: [
        { v: "Atem, the Pharaoh, heart of the cards", g: "legendary" },
        { v: "just Yugi, no Puzzle", g: "crippling" },
      ] },
      { n: "Seto Kaiba", t: 4, f: 5, variants: [
        { v: "three Blue-Eyes on the field", g: "legendary" },
        { v: "opening hand of monster removal", g: "major" },
      ] },
      { n: "Joey Wheeler", t: 3, f: 5, variants: [
        { v: "top-decking exactly what he needed", g: "legendary" },
        { v: "the worst hand of his life", g: "crippling" },
      ] },
      { n: "Marik Ishtar", t: 4, f: 4, variants: [{ v: "Yami Marik, the Winged Dragon of Ra", g: "legendary" }] },
      { n: "Bakura", t: 4, f: 4, variants: [{ v: "Yami Bakura, the Ring active", g: "legendary" }] },
      { n: "Maximillion Pegasus", t: 4, f: 4, variants: [
        { v: "the Millennium Eye, reading every card", g: "legendary" },
        { v: "the Eye taken", g: "crippling" },
      ] },
      { n: "Zorc Necrophades", t: 5, f: 2 },
      { n: "Mai Valentine", t: 3, f: 3 },
      { n: "Ishizu Ishtar", t: 2, f: 2 },
      { n: "Bandit Keith", t: 2, f: 2, variants: [{ v: "a card up his sleeve, literally", g: "major" }] },
      { n: "Mako Tsunami", t: 2, f: 2 },
      { n: "Duke Devlin", t: 2, f: 2 },
      { n: "Rebecca Hawkins", t: 2, f: 1 },
      { n: "Weevil Underwood", t: 1, f: 2 },
      { n: "Rex Raptor", t: 1, f: 2 },
      { n: "Tea Gardner", t: 1, f: 2 },
      { n: "Tristan Taylor", t: 1, f: 2 },
      { n: "Jaden Yuki", t: 4, f: 4, variants: [{ v: "the Supreme King", g: "legendary" }] },
      { n: "Yubel", t: 4, f: 2 },
      { n: "Zane Truesdale", t: 4, f: 2, variants: [{ v: "Hell Kaiser, underground duelling", g: "major" }] },
      { n: "Chazz Princeton", t: 3, f: 2 },
      { n: "Aster Phoenix", t: 3, f: 2 },
      { n: "Alexis Rhodes", t: 3, f: 2 },
      { n: "Syrus Truesdale", t: 2, f: 2 },
      { n: "Yusei Fudo", t: 4, f: 4, variants: [{ v: "Accel Synchro", g: "legendary" }] },
      { n: "Jack Atlas", t: 4, f: 3 },
      { n: "Crow Hogan", t: 3, f: 2 },
      { n: "Akiza Izinski", t: 3, f: 2, variants: [{ v: "psychic duelist, damage is real", g: "major" }] },
      { n: "Kalin Kessler", t: 3, f: 2 },
      { n: "Z-one", t: 5, f: 1 },
      { n: "Yuma Tsukumo", t: 3, f: 3 },
      { n: "Astral", t: 4, f: 2 },
      { n: "Vector", t: 4, f: 2 },
      { n: "Don Thousand", t: 5, f: 1 },
      { n: "Yuya Sakaki", t: 3, f: 3 },
      { n: "Declan Akaba", t: 4, f: 2 },
      { n: "Zarc", t: 5, f: 2, variants: [{ v: "the Supreme King Dragon, all four", g: "legendary" }] },

      { n: "Exodia the Forbidden One", t: 5, f: 3, variants: [
        { v: "all five pieces assembled", g: "mythic" },
        { v: "four pieces, one missing", g: "crippling" },
      ] },
      { n: "Slifer the Sky Dragon", t: 5, f: 4, variants: [{ v: "a full hand behind it", g: "legendary" }] },
      { n: "Obelisk the Tormentor", t: 5, f: 4, variants: [{ v: "two tributes fed to it", g: "legendary" }] },
      { n: "The Winged Dragon of Ra", t: 5, f: 4, variants: [
        { v: "Phoenix mode", g: "legendary" },
        { v: "in sphere mode, still asleep", g: "crippling" },
      ] },
      { n: "Blue-Eyes White Dragon", t: 4, f: 5, variants: [
        { v: "Blue-Eyes Ultimate Dragon, all three fused", g: "legendary" },
        { v: "Blue-Eyes Shining Dragon", g: "legendary" },
      ] },
      { n: "Dark Magician", t: 4, f: 5, variants: [
        { v: "Dark Paladin", g: "legendary" },
        { v: "with the Magician's Circle open", g: "major" },
      ] },
      { n: "Dark Magician Girl", t: 3, f: 4, variants: [{ v: "powered by every fallen magician", g: "major" }] },
      { n: "Red-Eyes Black Dragon", t: 3, f: 4, variants: [{ v: "Red-Eyes Darkness Dragon", g: "legendary" }] },
      { n: "Black Luster Soldier", t: 4, f: 3, variants: [{ v: "Envoy of the Beginning", g: "legendary" }] },
      { n: "Summoned Skull", t: 3, f: 3 },
      { n: "Buster Blader", t: 3, f: 3, variants: [{ v: "facing a deck full of dragons", g: "legendary" }] },
      { n: "Gaia the Fierce Knight", t: 3, f: 3 },
      { n: "Jinzo", t: 3, f: 3, variants: [{ v: "every trap on the field dead", g: "major" }] },
      { n: "Relinquished", t: 3, f: 2, variants: [{ v: "having absorbed your best monster", g: "legendary" }] },
      { n: "Thousand-Eyes Restrict", t: 4, f: 2 },
      { n: "Five-Headed Dragon", t: 5, f: 2 },
      { n: "Gate Guardian", t: 4, f: 2 },
      { n: "Stardust Dragon", t: 4, f: 3, variants: [{ v: "Shooting Star Dragon", g: "legendary" }] },
      { n: "Red Dragon Archfiend", t: 4, f: 3 },
      { n: "Black Rose Dragon", t: 4, f: 2 },
      { n: "Number 39: Utopia", t: 3, f: 3, variants: [{ v: "Utopia Ray, at 100 life points", g: "legendary" }] },
      { n: "Elemental HERO Neos", t: 4, f: 3 },
      { n: "Cyber End Dragon", t: 4, f: 2 },
      { n: "Blue-Eyes Twin Burst Dragon", t: 5, f: 2 },
      { n: "Kuriboh", t: 1, f: 4, variants: [
        { v: "multiplied, the whole wall of them", g: "legendary" },
        { v: "one Kuriboh, alone", g: "crippling" },
      ] },
      { n: "Winged Kuriboh", t: 1, f: 2 },
      { n: "Time Wizard", t: 2, f: 3, variants: [
        { v: "the roulette landed", g: "legendary" },
        { v: "the roulette did not", g: "crippling" },
      ] },
      { n: "Copycat", t: 2, f: 1 },
      { n: "Mystical Elf", t: 2, f: 2 },
      { n: "Celtic Guardian", t: 2, f: 2 },
      { n: "Baby Dragon", t: 1, f: 2 },
      { n: "Blue-Eyes Toon Dragon", t: 3, f: 2 },
      { n: "Obnoxious Celtic Guard", t: 2, f: 1 },
      { n: "Slime Token", t: 1, f: 1 },
    ],
  },

  // ── The CW ────────────────────────────────────────────────────────────────
  {
    id: "cw",
    name: "The CW",
    emoji: "\ud83d\udcfa",
    blurb: "Smallville, the Arrowverse, Mystic Falls and everyone else on the network.",
    imgContext: "CW television series character",
    scenario:
      "Every CW show at once. A Kryptonian, a speedster, an Original vampire and an archangel are on the same field and none of them have met before.",
    criteria:
      "These shows do not share a power scale, so use the honest one: what could this person survive, and what could they end. A billionaire with a bow is not in the same fight as a speedster, however many seasons he headlined.",
    arenas: [
      { name: "Star City, downtown", desc: "Streets, rooftops and cover everywhere. Built for people who fight from the dark.", weight: 7 },
      { name: "The Speed Force", desc: "Not a place so much as a condition. Anything without a connection to it is barely here.", weight: 3 },
      { name: "Smallville, under a meteor shower", desc: "Open farmland, kryptonite raining down, and it is affecting exactly one person very badly.", weight: 4 },
      { name: "The Mystic Falls town square, at night", desc: "Small, dark, and full of people who cannot be killed the ordinary way.", weight: 5 },
      { name: "A crossover event, the sky red", desc: "Reality is coming apart. Everybody is somewhere they should not be, including the dead.", weight: 3 },
    ],
    entries: [
      { n: "Clark Kent", t: 5, f: 5, s: "Smallville Clark Kent", variants: [
        { v: "the suit on, fully realised", g: "legendary" },
        { v: "kryptonite in the room", g: "crippling" },
        { v: "red kryptonite, no conscience", g: "major" },
      ] },
      { n: "Kara Zor-El", t: 5, f: 5, s: "Supergirl CW", variants: [{ v: "solar flared, powers spent", g: "crippling" }], wiki: "arrow" },
      { n: "General Zod", t: 5, f: 3, s: "Smallville Zod", wiki: "smallville" },
      { n: "Doomsday", t: 5, f: 3, s: "Smallville Doomsday Davis Bloome", wiki: "smallville" },
      { n: "Brainiac", t: 5, f: 3, s: "Smallville Brainiac", wiki: "smallville" },
      { n: "Bizarro", t: 5, f: 2, s: "Smallville Bizarro", wiki: "smallville" },
      { n: "Martian Manhunter", t: 5, f: 3, s: "Smallville Martian Manhunter", wiki: "smallville" },
      { n: "Lex Luthor", t: 3, f: 5, s: "Smallville Lex Luthor", wiki: "smallville" },
      { n: "Lionel Luthor", t: 2, f: 2, wiki: "smallville" },
      { n: "Chloe Sullivan", t: 2, f: 3, wiki: "smallville" },
      { n: "Lana Lang", t: 1, f: 3, variants: [{ v: "the kryptonite suit", g: "major" }], wiki: "smallville" },
      { n: "Jonathan Kent", t: 1, f: 2, wiki: "smallville" },
      { n: "Tess Mercer", t: 2, f: 2, wiki: "smallville" },
      { n: "Jor-El", t: 3, f: 2, wiki: "smallville" },

      { n: "Barry Allen", t: 5, f: 5, s: "The Flash CW Barry Allen", variants: [
        { v: "full Speed Force, phasing", g: "legendary" },
        { v: "speed stolen", g: "crippling" },
      ] },
      { n: "Eobard Thawne", t: 5, f: 4, s: "Reverse Flash", variants: [{ v: "negative Speed Force", g: "legendary" }], wiki: "arrow" },
      { n: "Zoom", t: 5, f: 3, s: "The Flash Hunter Zolomon Zoom", wiki: "arrow" },
      { n: "Savitar", t: 5, f: 3, wiki: "arrow" },
      { n: "Godspeed", t: 4, f: 2, wiki: "arrow" },
      { n: "The Black Flash", t: 5, f: 1, wiki: "arrow" },
      { n: "Wally West", t: 4, f: 3, s: "Kid Flash CW", wiki: "arrow" },
      { n: "Jesse Quick", t: 4, f: 2, wiki: "arrow" },
      { n: "Jay Garrick", t: 4, f: 2, wiki: "arrow" },
      { n: "Killer Frost", t: 4, f: 4, s: "The Flash Killer Frost Caitlin Snow", wiki: "arrow" },
      { n: "Vibe", t: 3, f: 3, s: "The Flash Cisco Ramon Vibe", wiki: "arrow" },
      { n: "Gorilla Grodd", t: 4, f: 3, wiki: "arrow" },
      { n: "Captain Cold", t: 3, f: 4, s: "Leonard Snart CW", wiki: "arrow" },
      { n: "Heat Wave", t: 3, f: 3, s: "Mick Rory CW", wiki: "arrow" },
      { n: "Weather Wizard", t: 3, f: 2, wiki: "arrow" },
      { n: "Bloodwork", t: 4, f: 2, s: "The Flash Ramsey Rosso", wiki: "arrow" },
      { n: "Cicada", t: 3, f: 2, wiki: "arrow" },

      { n: "Oliver Queen", t: 3, f: 5, s: "Arrow Green Arrow", variants: [
        { v: "the Spectre", g: "mythic" },
        { v: "five years in hell, at his hardest", g: "major" },
      ] },
      { n: "John Diggle", t: 2, f: 4, wiki: "arrow" },
      { n: "Felicity Smoak", t: 1, f: 4, wiki: "arrow" },
      { n: "Thea Queen", t: 3, f: 3, s: "Arrow Speedy", wiki: "arrow" },
      { n: "Malcolm Merlyn", t: 4, f: 4, s: "Arrow Dark Archer", wiki: "arrow" },
      { n: "Slade Wilson", t: 4, f: 4, s: "Arrow Deathstroke", variants: [{ v: "on Mirakuru", g: "legendary" }], wiki: "arrow" },
      { n: "Ra's al Ghul", t: 4, f: 3, s: "Arrow Ras al Ghul", wiki: "arrow" },
      { n: "Nyssa al Ghul", t: 3, f: 3, wiki: "arrow" },
      { n: "Damien Darhk", t: 5, f: 3, variants: [
        { v: "with the idol, fully charged", g: "legendary" },
        { v: "magic drained", g: "crippling" },
      ] },
      { n: "Prometheus", t: 3, f: 2, s: "Arrow Adrian Chase", wiki: "arrow" },
      { n: "Laurel Lance", t: 3, f: 3, s: "Black Canary CW", wiki: "arrow" },
      { n: "Sara Lance", t: 4, f: 4, s: "White Canary Legends of Tomorrow", wiki: "arrow" },
      { n: "Roy Harper", t: 3, f: 2, s: "Arsenal CW", wiki: "arrow" },

      { n: "Alex Danvers", t: 2, f: 3, wiki: "arrow" },
      { n: "Lena Luthor", t: 2, f: 3, wiki: "arrow" },
      { n: "Reign", t: 5, f: 2, s: "Supergirl Reign Worldkiller", wiki: "arrow" },
      { n: "Astra", t: 4, f: 2, s: "Supergirl Astra In-Ze", wiki: "arrow" },
      { n: "Non", t: 4, f: 1, wiki: "arrow" },
      { n: "Livewire", t: 3, f: 2, wiki: "arrow" },
      { n: "Silver Banshee", t: 3, f: 1, wiki: "arrow" },
      { n: "Brainiac 5", t: 3, f: 2, wiki: "arrow" },
      { n: "Nia Nal", t: 3, f: 2, s: "Supergirl Dreamer", wiki: "arrow" },

      { n: "Rip Hunter", t: 2, f: 2, wiki: "arrow" },
      { n: "Ray Palmer", t: 3, f: 3, s: "The Atom CW", wiki: "arrow" },
      { n: "Firestorm", t: 4, f: 3, s: "Legends of Tomorrow Firestorm", wiki: "arrow" },
      { n: "Hawkman", t: 3, f: 2, s: "Legends of Tomorrow Hawkman", wiki: "arrow" },
      { n: "Hawkgirl", t: 3, f: 2, s: "Legends of Tomorrow Hawkgirl", wiki: "arrow" },
      { n: "Vandal Savage", t: 4, f: 3, wiki: "arrow" },
      { n: "Nate Heywood", t: 3, f: 2, s: "Citizen Steel Legends", wiki: "arrow" },
      { n: "Zari Tomaz", t: 3, f: 2, wiki: "arrow" },
      { n: "John Constantine", t: 4, f: 4, s: "Constantine CW", variants: [
        { v: "a demon owing him a favour", g: "major" },
        { v: "no time to prepare a circle", g: "weakening" },
      ] },
      { n: "Mallus", t: 4, f: 1, wiki: "arrow" },
      { n: "Neron", t: 4, f: 1, wiki: "arrow" },

      { n: "Jefferson Pierce", t: 4, f: 3, s: "Black Lightning", wiki: "arrow" },
      { n: "Thunder", t: 3, f: 2, s: "Black Lightning Anissa Pierce", wiki: "arrow" },
      { n: "Lightning", t: 3, f: 2, s: "Black Lightning Jennifer Pierce", wiki: "arrow" },
      { n: "Tobias Whale", t: 3, f: 2, wiki: "arrow" },
      { n: "Kate Kane", t: 3, f: 3, s: "Batwoman CW", wiki: "arrow" },
      { n: "Alice", t: 2, f: 2, s: "Batwoman Alice Beth Kane", wiki: "arrow" },
      { n: "Ryan Wilder", t: 3, f: 2, s: "Batwoman Ryan Wilder", wiki: "arrow" },
      { n: "Courtney Whitmore", t: 4, f: 2, s: "Stargirl DC", wiki: "arrow" },
      { n: "Icicle", t: 4, f: 1, s: "Stargirl Icicle", wiki: "arrow" },
      { n: "Solomon Grundy", t: 4, f: 2, s: "Stargirl Solomon Grundy", wiki: "arrow" },
      { n: "Starman", t: 4, f: 1, s: "Stargirl Starman", wiki: "arrow" },
      { n: "Naomi McDuffie", t: 4, f: 1, s: "Naomi CW", wiki: "arrow" },

      { n: "Klaus Mikaelson", t: 5, f: 4, wiki: "vampirediaries" },
      { n: "Damon Salvatore", t: 3, f: 4, wiki: "vampirediaries" },
      { n: "Stefan Salvatore", t: 3, f: 3, wiki: "vampirediaries" },
      { n: "Elena Gilbert", t: 2, f: 3, wiki: "vampirediaries" },
      { n: "Bonnie Bennett", t: 4, f: 3, wiki: "vampirediaries" },
      { n: "Caroline Forbes", t: 3, f: 3, wiki: "vampirediaries" },
      { n: "Katherine Pierce", t: 3, f: 2, wiki: "vampirediaries" },
      { n: "Elijah Mikaelson", t: 4, f: 3, wiki: "vampirediaries" },
      { n: "Rebekah Mikaelson", t: 4, f: 2, wiki: "vampirediaries" },
      { n: "Kai Parker", t: 4, f: 2, wiki: "vampirediaries" },
      { n: "Silas", t: 5, f: 2, wiki: "vampirediaries" },
      { n: "Hope Mikaelson", t: 4, f: 2, wiki: "vampirediaries" },
      { n: "Alaric Saltzman", t: 2, f: 2, wiki: "vampirediaries" },

      { n: "Dean Winchester", t: 3, f: 5, s: "Supernatural Dean", variants: [
        { v: "the Mark of Cain and the First Blade", g: "legendary" },
      ] },
      { n: "Sam Winchester", t: 3, f: 5, s: "Supernatural Sam", variants: [
        { v: "on demon blood", g: "major" },
      ] },
      { n: "Castiel", t: 4, f: 5, s: "Supernatural Castiel", variants: [
        { v: "with the souls of Purgatory", g: "mythic" },
        { v: "grace burned out, human", g: "crippling" },
      ] },
      { n: "Crowley", t: 4, f: 3, s: "Supernatural Crowley", wiki: "supernatural" },
      { n: "Lucifer", t: 5, f: 4, s: "Supernatural Lucifer", wiki: "supernatural" },
      { n: "Michael", t: 5, f: 3, s: "Supernatural Michael archangel", wiki: "supernatural" },
      { n: "Death", t: 5, f: 3, s: "Supernatural Death Horseman", wiki: "supernatural" },
      { n: "Chuck Shurley", t: 5, f: 2, s: "Supernatural God Chuck", wiki: "supernatural" },
      { n: "Amara", t: 5, f: 2, s: "Supernatural The Darkness Amara", wiki: "supernatural" },
      { n: "Rowena MacLeod", t: 4, f: 3, wiki: "supernatural" },
      { n: "Jack Kline", t: 5, f: 2, s: "Supernatural Jack Nephilim", wiki: "supernatural" },
      { n: "Bobby Singer", t: 2, f: 3, wiki: "supernatural" },

      { n: "Liv Moore", t: 3, f: 2, s: "iZombie Liv Moore", wiki: "izombie" },
      { n: "Blaine DeBeers", t: 2, f: 1, s: "iZombie Blaine", wiki: "izombie" },
      { n: "Macy Vaughn", t: 4, f: 2, s: "Charmed 2018 Macy", wiki: "charmed" },
      { n: "Mel Vera", t: 3, f: 1, s: "Charmed 2018 Mel", wiki: "charmed" },
      { n: "Maggie Vera", t: 3, f: 1, s: "Charmed 2018 Maggie", wiki: "charmed" },
      { n: "Max Evans", t: 3, f: 1, s: "Roswell New Mexico Max", wiki: "roswell" },
      { n: "Nicky Shen", t: 3, f: 1, s: "Kung Fu CW Nicky Shen", wiki: "kungfu2021" },
      { n: "Octavia Blake", t: 3, f: 2, s: "The 100 Octavia", wiki: "the100" },
      { n: "Clarke Griffin", t: 2, f: 2, s: "The 100 Clarke", wiki: "the100" },
      { n: "Lexa", t: 2, f: 2, s: "The 100 Lexa Commander", wiki: "the100" },
      { n: "Raven Reyes", t: 1, f: 1, s: "The 100 Raven", wiki: "the100" },
      { n: "Archie Andrews", t: 1, f: 3, s: "Riverdale Archie", wiki: "riverdale" },
      { n: "Jughead Jones", t: 1, f: 2, s: "Riverdale Jughead", wiki: "riverdale" },
      { n: "Betty Cooper", t: 1, f: 2, s: "Riverdale Betty", wiki: "riverdale" },
      { n: "Cheryl Blossom", t: 1, f: 2, s: "Riverdale Cheryl", wiki: "riverdale" },
      { n: "Veronica Lodge", t: 1, f: 2, s: "Riverdale Veronica", wiki: "riverdale" },
    ],
  },


  // ── Supernatural ──────────────────────────────────────────────────────────
  {
    id: "spn",
    name: "Supernatural",
    emoji: "\ud83d\udd4a\ufe0f",
    blurb: "Fifteen seasons of things that should not exist. Everybody has died.",
    imgContext: "Supernatural TV series character",
    wiki: "supernatural",
    scenario:
      "Two drafted sides meet somewhere warded. Angels, demons, monsters and two men with a trunk full of options, and the only rule anybody respects is that the right weapon beats the bigger opponent.",
    criteria:
      "This show runs on counters, not on power. An archangel outclasses everything on the board and loses to a blade somebody brought specifically for archangels. Weigh what each side could actually kill the other WITH — and weigh humans generously, because on this show they win.",
    arenas: [
      { name: "A warded barn, devil's trap on the floor", desc: "Sigils on every beam. Anything demonic is fighting the room as well as the enemy.", weight: 8 },
      { name: "A dark stretch of highway", desc: "Open road at night, nothing for miles, and whatever is out here got here first.", weight: 5 },
      { name: "Purgatory", desc: "No angels, no demons, no rules — just every monster that ever died, all at once, forever.", weight: 4 },
      { name: "The bunker, doors sealed", desc: "Indoors, cramped, warded to the rafters and stocked with every weapon the Men of Letters ever catalogued.", weight: 4 },
      { name: "The Empty", desc: "Nothing is here and nothing is supposed to be awake. Everything that is, is furious about it.", weight: 2 },
    ],
    entries: [
      { n: "Dean Winchester", t: 3, f: 5, variants: [
        { v: "the Mark of Cain and the First Blade", g: "legendary" },
        { v: "a demon, black-eyed", g: "major" },
        { v: "Michael's vessel, said yes", g: "legendary" },
        { v: "no weapons, no salt, no time", g: "crippling" },
      ] },
      { n: "Sam Winchester", t: 3, f: 5, variants: [
        { v: "on demon blood, at full", g: "legendary" },
        { v: "soulless", g: "major" },
        { v: "Lucifer's vessel, said yes", g: "legendary" },
      ] },
      { n: "Castiel", t: 4, f: 5, variants: [
        { v: "the souls of Purgatory", g: "mythic" },
        { v: "the Leviathans wearing him", g: "legendary" },
        { v: "grace burned out, human", g: "crippling" },
      ] },
      { n: "Chuck Shurley", t: 5, f: 4, s: "Supernatural God Chuck", variants: [
        { v: "God, no longer pretending", g: "mythic" },
        { v: "powers taken, an ordinary man", g: "crippling" },
      ] },
      { n: "Amara", t: 5, f: 3, s: "Supernatural The Darkness", variants: [
        { v: "the Darkness, fully grown", g: "legendary" },
      ] },
      { n: "Lucifer", t: 5, f: 5, variants: [
        { v: "in a true vessel", g: "legendary" },
        { v: "in a decaying vessel", g: "weakening" },
        { v: "in the Cage", g: "crippling" },
      ] },
      { n: "Michael", t: 5, f: 4, s: "Supernatural Michael archangel", variants: [
        { v: "Apocalypse World Michael", g: "legendary" },
      ] },
      { n: "Death", t: 5, f: 4, s: "Supernatural Death Horseman", variants: [
        { v: "with his ring, unbound", g: "legendary" },
        { v: "bound by Crowley's spell", g: "weakening" },
      ] },
      { n: "Billie", t: 5, f: 3, s: "Supernatural Billie reaper Death", variants: [
        { v: "the new Death, with the book", g: "legendary" },
      ] },
      { n: "Jack Kline", t: 4, f: 4, s: "Supernatural Jack nephilim", variants: [
        { v: "at full nephilim power", g: "legendary" },
        { v: "soul burned away", g: "major" },
        { v: "grace gone, human", g: "crippling" },
      ] },
      { n: "Gabriel", t: 4, f: 4, variants: [
        { v: "the Trickster, on his own ground", g: "major" },
      ] },
      { n: "Raphael", t: 4, f: 2 },
      { n: "Crowley", t: 4, f: 5, variants: [
        { v: "King of Hell, hellhounds at heel", g: "major" },
        { v: "in a devil's trap", g: "crippling" },
      ] },
      { n: "Rowena MacLeod", t: 4, f: 4, variants: [
        { v: "the Book of the Damned", g: "legendary" },
      ] },
      { n: "Abaddon", t: 4, f: 3, s: "Supernatural Abaddon Knight of Hell" },
      { n: "Cain", t: 5, f: 2, s: "Supernatural Cain Father of Murder", variants: [
        { v: "with the First Blade", g: "legendary" },
      ] },
      { n: "Alastair", t: 4, f: 2 },
      { n: "Azazel", t: 4, f: 3, s: "Supernatural Azazel yellow eyed demon" },
      { n: "Lilith", t: 4, f: 3 },
      { n: "Metatron", t: 4, f: 2, variants: [{ v: "with the angel tablet", g: "legendary" }] },
      { n: "Eve", t: 4, f: 2, s: "Supernatural Eve Mother of All" },
      { n: "Dick Roman", t: 4, f: 3, s: "Supernatural Dick Roman Leviathan" },
      { n: "Zachariah", t: 3, f: 2 },
      { n: "Naomi", t: 3, f: 2 },
      { n: "Gadreel", t: 3, f: 2 },
      { n: "Balthazar", t: 3, f: 2 },
      { n: "Anna Milton", t: 3, f: 2 },
      { n: "Uriel", t: 3, f: 2 },
      { n: "Meg Masters", t: 3, f: 4 },
      { n: "Ruby", t: 3, f: 3, variants: [{ v: "with her knife", g: "major" }] },
      { n: "Bela Talbot", t: 2, f: 2 },
      { n: "Bobby Singer", t: 2, f: 5, variants: [
        { v: "every book in the house and time to read them", g: "major" },
      ] },
      { n: "Mary Winchester", t: 3, f: 3 },
      { n: "John Winchester", t: 3, f: 3, variants: [{ v: "with the Colt", g: "legendary" }] },
      { n: "Adam Milligan", t: 1, f: 2, variants: [{ v: "Michael's vessel", g: "legendary" }] },
      { n: "Benny Lafitte", t: 3, f: 2 },
      { n: "Arthur Ketch", t: 3, f: 2 },
      { n: "Garth Fitzgerald", t: 2, f: 2, variants: [{ v: "a werewolf, and fine about it", g: "major" }] },
      { n: "Jody Mills", t: 2, f: 3 },
      { n: "Donna Hanscum", t: 2, f: 2 },
      { n: "Charlie Bradbury", t: 1, f: 3 },
      { n: "Kevin Tran", t: 1, f: 3, variants: [{ v: "reading the demon tablet", g: "major" }] },
      { n: "Claire Novak", t: 2, f: 2 },
      { n: "Jo Harvelle", t: 2, f: 2 },
      { n: "Ellen Harvelle", t: 2, f: 2 },
      { n: "Rufus Turner", t: 2, f: 2 },
      { n: "Missouri Moseley", t: 2, f: 1 },
      { n: "Ash", t: 1, f: 2, s: "Supernatural Ash Roadhouse" },
      { n: "Chuck's Amara sigil", t: 1, f: 1, s: "Supernatural warding sigil" },
      { n: "A hellhound", t: 3, f: 3, s: "Supernatural hellhound" },
      { n: "A Leviathan", t: 4, f: 2, s: "Supernatural Leviathan" },
      { n: "A wendigo", t: 2, f: 2, s: "Supernatural wendigo" },
      { n: "A rugaru", t: 2, f: 1, s: "Supernatural rugaru" },
      { n: "The Impala", t: 2, f: 4, s: "Supernatural Impala 1967 Chevrolet" },
    ],
  },


];

export function getPack(id: string): Pack | undefined {
  return PACKS.find((p) => p.id === id);
}
