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
 */
export type VariantGrade =
  | "crippling"
  | "weakening"
  | "neutral"
  | "boon"
  | "major"
  | "legendary"
  | "exalted"
  | "mythic";

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
export const MAX_TIER = 10;

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
 * The grade for a variant, from its declared grade or — for the hand-authored
 * boards below, which predate grades — from how far its tier moved.
 */
export function variantGrade(variant: Variant, baseTier: number): VariantGrade {
  if (variant.g && GRADE_DELTA[variant.g] !== undefined) return variant.g;
  const delta = (variant.t ?? baseTier) - baseTier;
  if (delta <= -2) return "crippling";
  if (delta === -1) return "weakening";
  if (delta === 0) return "neutral";
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
  /** Conditions — one is rolled at nomination time */
  variants?: Variant[];
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
  /** Settings this board can be played in; one is rolled per game */
  arenas?: Arena[];
  /** The arena actually rolled for this game, baked in when the board is dealt */
  arenaName?: string;
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
      { n: "Jaime Lannister", t: 4, f: 5, variants: [{ v: "two hands", t: 5 }, { v: "one hand", t: 3 }, { v: "gold hand, drunk", t: 2 }] },
      { n: "The Mountain", s: "Gregor Clegane", t: 5, variants: [{ v: "alive", t: 5 }, { v: "undead, Ser Robert Strong", t: 5 }, { v: "poisoned, dying", t: 3 }] },
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
      { n: "Eddard Stark", t: 4, f: 5, s: "Ned Stark", variants: [{ v: "Warden of the North", t: 4 }, { v: "on the steps of Baelor", t: 1 }] },
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
      { n: "Wight", t: 2, s: "Game of Thrones wight", variants: [{ v: "an army of them", t: 5 }, { v: "a single wight", t: 2 }] },
      { n: "White Walker", t: 4, s: "Game of Thrones Others" },
      { n: "Giant", t: 5, s: "Game of Thrones Wun Wun giant" },
      { n: "Ser Jorah's greyscale", t: 1, s: "greyscale Game of Thrones" },
      { n: "Hot Pie", t: 1, f: 1, s: "Game of Thrones baker" },
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
      { n: "Black Panther", t: 4, f: 5, variants: [{ v: "vibranium suit", t: 4 }, { v: "no suit, herb stripped", t: 2 }] },
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
      { n: "Silver Surfer", t: 5, variants: [{ v: "with the board", t: 5 }, { v: "board confiscated", t: 3 }] },
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
      { n: "Shang-Chi", t: 4, variants: [{ v: "with the Ten Rings", t: 5 }, { v: "fists only", t: 4 }] },
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
    blurb: "One budget, one team, one Elite Four. Good luck.",
    imgContext: "Pokemon",
    wiki: "pokemon",
    scenario:
      "Each drafted team runs the Elite Four gauntlet back to back. No items, no healing between battles.",
    criteria:
      "Stats, typing coverage, and whether the team covers its own weaknesses. Four Fire types lose to one rain team.",
    arenas: [
      { name: "A standard battle field", desc: "Flat, dry ground. No terrain advantage to anyone.", weight: 10 },
      { name: "A flooded arena", desc: "Half the field is deep water. Water and Electric types are in their element.", weight: 3 },
      { name: "A sandstorm", desc: "Constant chip damage to anything not Rock, Ground or Steel.", weight: 2 },
      { name: "Trick Room", desc: "Speed is inverted — the slowest act first.", weight: 2 },
    ],
    entries: [
      { n: "Charizard", t: 4, f: 5, variants: [{ v: "Mega Charizard X", g: "legendary" }, { v: "standard", g: "neutral" }, { v: "still a level 5 Charmander", g: "crippling" }] },
      { n: "Mewtwo", t: 5, f: 5, variants: [{ v: "Mega Mewtwo Y", g: "legendary" }, { v: "standard", g: "neutral" }] },
      { n: "Pikachu", t: 2, f: 5, variants: [{ v: "Ash's Pikachu", t: 4 }, { v: "wild, level 3", t: 1 }] },
      { n: "Gengar", t: 4, f: 5 },
      { n: "Dragonite", t: 5, f: 5 },
      { n: "Snorlax", t: 4, f: 5 },
      { n: "Blissey", t: 4 },
      { n: "Tyranitar", t: 5 },
      { n: "Gyarados", t: 4, f: 5, variants: [{ v: "red Gyarados", t: 5 }, { v: "standard", t: 4 }, { v: "still a Magikarp", t: 1 }] },
      { n: "Lucario", t: 4, f: 5 },
      { n: "Garchomp", t: 5 },
      { n: "Rayquaza", t: 5 },
      { n: "Arceus", t: 5 },
      { n: "Eevee", t: 2, f: 5 },
      { n: "Magikarp", t: 1, f: 5 },
      { n: "Ditto", t: 2 },
      { n: "Alakazam", t: 4 },
      { n: "Machamp", t: 4 },
      { n: "Greninja", t: 4, f: 5 },
      { n: "Metagross", t: 5 },
      { n: "Lapras", t: 3 },
      { n: "Jigglypuff", t: 1, f: 5 },
      { n: "Zapdos", t: 4 },
      { n: "Scizor", t: 4 },
      { n: "Slowpoke", t: 1 },
      { n: "Umbreon", t: 3 },
      { n: "Aggron", t: 3 },
      { n: "Wobbuffet", t: 2 },
      { n: "Blastoise", t: 4 },
      { n: "Venusaur", t: 4 },
      { n: "Typhlosion", t: 4 },
      { n: "Feraligatr", t: 4 },
      { n: "Meganium", t: 3 },
      { n: "Infernape", t: 4 },
      { n: "Empoleon", t: 4 },
      { n: "Salamence", t: 5 },
      { n: "Hydreigon", t: 5 },
      { n: "Goodra", t: 4 },
      { n: "Aegislash", t: 4 },
      { n: "Mimikyu", t: 3 },
      { n: "Toxapex", t: 4 },
      { n: "Corviknight", t: 4 },
      { n: "Dragapult", t: 5 },
      { n: "Cinderace", t: 4 },
      { n: "Rillaboom", t: 4 },
      { n: "Baxcalibur", t: 4 },
      { n: "Annihilape", t: 4 },
      { n: "Gholdengo", t: 5 },
      { n: "Kingambit", t: 5 },
      { n: "Ceruledge", t: 4 },
      { n: "Lucario", t: 4, f: 5 },
      { n: "Sceptile", t: 4 },
      { n: "Milotic", t: 4 },
      { n: "Heracross", t: 3 },
      { n: "Skarmory", t: 3 },
      { n: "Weavile", t: 4 },
      { n: "Chandelure", t: 4 },
      { n: "Volcarona", t: 5 },
      { n: "Rotom", t: 3, variants: [{ v: "Wash form", t: 4 }, { v: "just a lightbulb", t: 1 }] },
      { n: "Sudowoodo", t: 2, f: 1 },
      { n: "Farfetch'd", t: 1 },
      { n: "Luvdisc", t: 1, f: 1 },
      { n: "Feebas", t: 1, f: 1, variants: [{ v: "one level from Milotic", t: 2 }, { v: "as found", t: 1 }] },
      { n: "Delibird", t: 1, f: 1 },
      { n: "Unown", t: 1, f: 1 },
      { n: "Shuckle", t: 2, f: 1, variants: [{ v: "the infinite defence build", t: 4 }, { v: "standard", t: 1 }] },
      { n: "Regigigas", t: 3, variants: [{ v: "after five turns", t: 5 }, { v: "Slow Start, turn one", t: 1 }] },
      { n: "Slaking", t: 3, variants: [{ v: "the turn it attacks", t: 5 }, { v: "the turn it loafs", t: 1 }] },
      { n: "Giratina", t: 5 },
      { n: "Kyogre", t: 5 },
      { n: "Groudon", t: 5 },
      { n: "Darkrai", t: 5 },
      { n: "Zacian", t: 5 },
      { n: "Koraidon", t: 5 },
      { n: "Bidoof", t: 1, f: 1 },
      { n: "Zubat", t: 1, f: 1 },
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
      { n: "Saltwater Crocodile", t: 5, variants: [{ v: "in water", t: 5 }, { v: "on dry land", t: 3 }] },
      { n: "Grizzly Bear", t: 5, f: 5 },
      { n: "Siberian Tiger", t: 5, f: 5 },
      { n: "African Elephant", t: 5, f: 5, variants: [{ v: "bull in musth", g: "boon" }, { v: "calm cow", g: "neutral" }] },
      { n: "Hippopotamus", t: 5, f: 5 },
      { n: "Cape Buffalo", t: 4 },
      { n: "Silverback Gorilla", t: 5, f: 5 },
      { n: "Lion", t: 4, f: 5, variants: [{ v: "male with a full pride", t: 5 }, { v: "lone male", t: 4 }, { v: "old, missing teeth", t: 2 }] },
      { n: "Grey Wolf", t: 3, f: 5, variants: [{ v: "full pack of eight", t: 5 }, { v: "lone wolf", t: 3 }] },
      { n: "Honey Badger", t: 3, f: 5 },
      { n: "Wolverine", s: "Gulo gulo animal", t: 3 },
      { n: "Komodo Dragon", t: 4, f: 5 },
      { n: "Great White Shark", t: 5, f: 5, variants: [{ v: "in water", t: 5 }, { v: "beached", t: 1 }] },
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
      { n: "The Mandalorian", t: 4, f: 5, s: "Din Djarin", variants: [{ v: "beskar armor", t: 4 }, { v: "with the Darksaber", t: 5 }] },
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
      { n: "Jar Jar Binks", t: 1 },
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
      { n: "Kanan Jarrus", t: 4, variants: [{ v: "sighted", t: 4 }, { v: "blinded", t: 3 }] },
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
      { n: "Greedo", t: 1, f: 1, variants: [{ v: "shot first", t: 2 }, { v: "shot second", t: 1 }] },
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
      { n: "Freddy Krueger", t: 5, f: 5, variants: [{ v: "in the dream world", t: 5 }, { v: "pulled into the real world", t: 3 }] },
      { n: "Jason Voorhees", t: 5, f: 5, variants: [{ v: "undead Jason", t: 5 }, { v: "sack-head Jason", t: 4 }, { v: "drowning boy", t: 1 }] },
      { n: "Pennywise", t: 5, f: 5, s: "IT clown", variants: [{ v: "full power", g: "legendary" }, { v: "weakened by belief", g: "crippling" }] },
      { n: "Leatherface", t: 4, f: 5 },
      { n: "Xenomorph", t: 5, f: 5, s: "Alien creature", variants: [{ v: "full grown", g: "boon" }, { v: "facehugger stage", g: "crippling" }] },
      { n: "The Predator", t: 5, f: 5, variants: [{ v: "cloaked, plasma caster", t: 5 }, { v: "weapons stripped", t: 4 }] },
      { n: "Hannibal Lecter", t: 3 },
      { n: "Ghostface", t: 3, f: 5, s: "Scream" },
      { n: "Chucky", t: 2, f: 5, s: "Child's Play doll" },
      { n: "Pinhead", t: 5, s: "Hellraiser" },
      { n: "The Thing", t: 5, s: "1982 John Carpenter creature" },
      { n: "Dracula", t: 5, f: 5, variants: [{ v: "at night", t: 5 }, { v: "at high noon", t: 1 }] },
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
      { n: "Zombie", t: 1, variants: [{ v: "an entire horde", t: 4 }, { v: "one slow shambler", t: 1 }] },
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
      { n: "Godzilla", t: 5, f: 5, variants: [{ v: "Shin Godzilla", t: 5 }, { v: "1954 suit", t: 4 }] },
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
      { n: "Levi Ackerman", t: 4, f: 5, s: "Attack on Titan", variants: [{ v: "with ODM gear", t: 4 }, { v: "no gear, open field", t: 2 }] },
      { n: "Eren Yeager", t: 4, f: 5, s: "Attack on Titan" },
      { n: "Satoru Gojo", t: 5, f: 5, s: "Jujutsu Kaisen", variants: [{ v: "unsealed", t: 5 }, { v: "sealed in the box", t: 1 }] },
      { n: "Tanjiro Kamado", t: 3, s: "Demon Slayer" },
      { n: "All Might", t: 5, f: 5, s: "My Hero Academia", variants: [{ v: "prime", g: "legendary" }, { v: "post-injury, three minutes", g: "weakening" }] },
      { n: "Izuku Midoriya", t: 3, s: "My Hero Academia Deku" },
      { n: "Vegeta", t: 5, f: 5, s: "Dragon Ball" },
      { n: "Light Yagami", t: 2, f: 5, s: "Death Note", variants: [{ v: "with the Death Note", t: 5 }, { v: "no notebook", t: 1 }] },
      { n: "Edward Elric", t: 3, s: "Fullmetal Alchemist" },
      { n: "Guts", t: 4, s: "Berserk", variants: [{ v: "Berserker Armor", t: 5 }, { v: "Black Swordsman", t: 4 }] },
      { n: "Killua Zoldyck", t: 4, s: "Hunter x Hunter" },
      { n: "Gon Freecss", t: 3, s: "Hunter x Hunter" },
      { n: "Meliodas", t: 5, s: "Seven Deadly Sins" },
      { n: "Escanor", t: 5, s: "Seven Deadly Sins", variants: [{ v: "at high noon", g: "exalted" }, { v: "at midnight", g: "crippling" }] },
      { n: "Yusuke Urameshi", t: 4, s: "Yu Yu Hakusho" },
      { n: "Spike Spiegel", t: 3, s: "Cowboy Bebop" },
      { n: "Alucard", t: 5, s: "Hellsing" },
      { n: "Kenshin Himura", t: 4, s: "Rurouni Kenshin" },
      { n: "Yugi Muto", t: 1, f: 1, s: "Yu-Gi-Oh" },
      { n: "Shinji Ikari", t: 1, s: "Evangelion", variants: [{ v: "in Eva Unit 01", t: 5 }, { v: "out of the robot", t: 1 }] },
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

  // ── Apocalypse ────────────────────────────────────────────────────────────
  {
    id: "apocalypse",
    name: "Apocalypse Squad",
    emoji: "☣️",
    blurb: "The world just ended. Draft the five people you want with you.",
    imgContext: "portrait photo",
    scenario:
      "Society collapsed six weeks ago. Each drafted team has to survive one year: food, shelter, defense, and not killing each other.",
    criteria:
      "Practical survival value — medicine, engineering, food production, defense, and morale. Fame is worthless here.",
    arenas: [
      { name: "A temperate valley", desc: "Fresh water, workable soil, four real seasons.", weight: 10 },
      { name: "A hard winter", desc: "Eight months of deep cold with whatever you brought.", weight: 4 },
      { name: "A flooded coastal city", desc: "Water everywhere and none of it drinkable; everything useful is on an upper floor.", weight: 2 },
      { name: "An arid desert basin", desc: "Water is the whole problem and everything else is second.", weight: 2 },
    ],
    entries: [
      { n: "Bear Grylls", t: 5, f: 5 },
      { n: "A trauma surgeon", t: 5, s: "surgeon in scrubs operating room" },
      { n: "A Navy SEAL", t: 5, s: "navy seal soldier" },
      { n: "A farmer", t: 5, s: "farmer in a field" },
      { n: "A civil engineer", t: 4, s: "engineer wearing hard hat" },
      { n: "A veterinarian", t: 4, s: "veterinarian with a dog" },
      { n: "A welder", t: 4, s: "welder at work sparks" },
      { n: "A nurse", t: 4, s: "nurse portrait hospital" },
      { n: "An electrician", t: 4, s: "electrician working wiring" },
      { n: "A chemist", t: 4, s: "chemist in laboratory" },
      { n: "A hunting guide", t: 4, s: "hunter in forest rifle" },
      { n: "A midwife", t: 3, s: "midwife newborn" },
      { n: "A mechanic", t: 4, s: "auto mechanic garage" },
      { n: "A beekeeper", t: 3, s: "beekeeper hives" },
      { n: "A radio operator", t: 3, s: "ham radio operator" },
      { n: "A Marine sniper", t: 4, s: "military sniper ghillie suit" },
      { n: "A chef", t: 3, s: "chef cooking kitchen" },
      { n: "A dentist", t: 3, s: "dentist patient chair" },
      { n: "A schoolteacher", t: 2, s: "teacher in classroom" },
      { n: "A carpenter", t: 4, s: "carpenter woodworking" },
      { n: "A therapist", t: 2, s: "therapist counseling session" },
      { n: "A marathon runner", t: 2, s: "marathon runner racing" },
      { n: "A prepper with a bunker", t: 3, s: "survival bunker shelter" },
      { n: "A crypto influencer", t: 1, s: "influencer filming phone" },
      { n: "A lawyer", t: 1, s: "lawyer in a suit" },
      { n: "A pro bodybuilder", t: 2, s: "bodybuilder posing" },
      { n: "A toddler", t: 1, s: "toddler child" },
      { n: "A golden retriever", t: 3, s: "golden retriever dog" },
      { n: "A wilderness EMT", t: 5, s: "paramedic wilderness rescue" },
      { n: "A well driller", t: 5, s: "water well drilling rig" },
      { n: "A blacksmith", t: 4, s: "blacksmith forge anvil" },
      { n: "A seed librarian", t: 4, s: "seed bank vault" },
      { n: "A water treatment engineer", t: 5, s: "water treatment plant" },
      { n: "A diesel mechanic", t: 4, s: "diesel engine mechanic" },
      { n: "A butcher", t: 4, s: "butcher shop" },
      { n: "A shepherd", t: 3, s: "shepherd with flock" },
      { n: "A fisherman", t: 4, s: "commercial fisherman boat" },
      { n: "A gunsmith", t: 4, s: "gunsmith workshop" },
      { n: "A cartographer", t: 3, s: "cartographer map making" },
      { n: "A survival instructor", t: 5, s: "bushcraft instructor" },
      { n: "A pharmacist", t: 4, s: "pharmacist dispensary" },
      { n: "A psychiatric nurse", t: 3, s: "psychiatric nurse" },
      { n: "A structural engineer", t: 4, s: "structural engineer blueprints" },
      { n: "A solar technician", t: 4, s: "solar panel installer" },
      { n: "A tanner", t: 3, s: "leather tanner workshop" },
      { n: "A brewer", t: 3, s: "brewery brewer" },
      { n: "A locksmith", t: 3, s: "locksmith" },
      { n: "A K9 handler", t: 4, s: "police dog handler" },
      { n: "A long-haul trucker", t: 3, s: "long haul truck driver" },
      { n: "A wildland firefighter", t: 5, s: "wildland firefighter" },
      { n: "A herbalist", t: 3, s: "herbalist drying herbs" },
      { n: "A boat builder", t: 3, s: "wooden boat builder" },
      { n: "A machinist", t: 4, s: "machinist lathe" },
      { n: "An accountant", t: 1, s: "accountant spreadsheets" },
      { n: "A social media manager", t: 1, s: "social media manager laptop" },
      { n: "A wine sommelier", t: 1, s: "sommelier tasting" },
      { n: "A life coach", t: 1, s: "life coach seminar" },
      { n: "A competitive eater", t: 2, s: "competitive eating contest" },
      { n: "A stand-up comedian", t: 2, s: "stand up comedian microphone" },
      { n: "A doomsday podcaster", t: 1, s: "podcaster microphone studio" },
      { n: "A golden eagle falconer", t: 3, s: "falconer with eagle" },
    ],
  },

  // ── History ───────────────────────────────────────────────────────────────
  {
    id: "history",
    name: "Historical Figures",
    emoji: "🏛️",
    blurb: "Rebuild civilization from scratch. Pick your founders.",
    imgContext: "historical portrait",
    scenario:
      "Both drafted councils are dropped on an empty, resource-rich continent and asked to build a functioning society in fifty years.",
    criteria:
      "Breadth of useful knowledge, leadership, ability to organise others, and whether they would cooperate or start a war.",
    arenas: [
      { name: "An empty temperate continent", desc: "Rivers, forests, workable soil, and no one else on it.", weight: 10 },
      { name: "A besieged city", desc: "Walls, a hostile army outside, and dwindling supplies inside.", weight: 3 },
      { name: "A long ocean voyage", desc: "Months at sea, scurvy, and no way off the ship.", weight: 2 },
      { name: "An age of plague", desc: "A disease nobody understands is killing a third of everyone.", weight: 2 },
    ],
    entries: [
      { n: "Leonardo da Vinci", t: 5, f: 5 },
      { n: "Nikola Tesla", t: 5, f: 5 },
      { n: "Marie Curie", t: 5, f: 5 },
      { n: "Genghis Khan", t: 4, f: 5 },
      { n: "Cleopatra", t: 4, f: 5 },
      { n: "Julius Caesar", t: 4, f: 5 },
      { n: "Sun Tzu", t: 4 },
      { n: "Isaac Newton", t: 5, f: 5 },
      { n: "Albert Einstein", t: 4, f: 5 },
      { n: "Benjamin Franklin", t: 5 },
      { n: "Hatshepsut", t: 4 },
      { n: "Alexander the Great", t: 4, f: 5 },
      { n: "Ada Lovelace", t: 4 },
      { n: "Joan of Arc", t: 3, f: 5 },
      { n: "Hannibal Barca", t: 4 },
      { n: "Confucius", t: 3 },
      { n: "Archimedes", t: 5 },
      { n: "Catherine the Great", t: 4 },
      { n: "George Washington Carver", t: 5 },
      { n: "Florence Nightingale", t: 4 },
      { n: "Miyamoto Musashi", t: 3 },
      { n: "Mansa Musa", t: 3 },
      { n: "Socrates", t: 2, f: 1 },
      { n: "Vlad the Impaler", t: 2 },
      { n: "Grigori Rasputin", t: 1 },
      { n: "Napoleon Bonaparte", t: 4, f: 5 },
      { n: "Harriet Tubman", t: 4, f: 5 },
      { n: "Imhotep", t: 5, s: "ancient Egyptian architect" },
      { n: "Hypatia", t: 4, s: "Hypatia of Alexandria" },
      { n: "Al-Khwarizmi", t: 5 },
      { n: "Ibn Sina", t: 5, s: "Avicenna" },
      { n: "Zheng He", t: 4 },
      { n: "Shaka Zulu", t: 4 },
      { n: "Boudica", t: 3 },
      { n: "Tomoe Gozen", t: 4 },
      { n: "Saladin", t: 4 },
      { n: "Charlemagne", t: 4 },
      { n: "Justinian", t: 3 },
      { n: "Ashoka", t: 4, s: "Ashoka the Great" },
      { n: "Qin Shi Huang", t: 4 },
      { n: "Pericles", t: 3 },
      { n: "Cyrus the Great", t: 4 },
      { n: "Eratosthenes", t: 5 },
      { n: "Galileo Galilei", t: 5 },
      { n: "Johannes Gutenberg", t: 5 },
      { n: "James Watt", t: 5 },
      { n: "Michael Faraday", t: 5 },
      { n: "Alan Turing", t: 5, f: 5 },
      { n: "Grace Hopper", t: 5 },
      { n: "Rosalind Franklin", t: 4 },
      { n: "Norman Borlaug", t: 5 },
      { n: "Jonas Salk", t: 5 },
      { n: "Louis Pasteur", t: 5 },
      { n: "Ignaz Semmelweis", t: 4 },
      { n: "John Snow", t: 4, s: "John Snow physician cholera" },
      { n: "Nikolai Vavilov", t: 4, s: "Nikolai Vavilov botanist" },
      { n: "Ada Byron's engine", t: 4, s: "Analytical Engine Babbage" },
      { n: "Sun Yat-sen", t: 3 },
      { n: "Simón Bolívar", t: 4 },
      { n: "Toussaint Louverture", t: 4 },
      { n: "Frederick Douglass", t: 4 },
      { n: "Nikola Tesla's rival", t: 4, s: "Thomas Edison" },
      { n: "Marco Polo", t: 3 },
      { n: "Ferdinand Magellan", t: 3 },
      { n: "Ernest Shackleton", t: 5 },
      { n: "Amelia Earhart", t: 2 },
      { n: "Diogenes", t: 1, f: 1, s: "Diogenes the Cynic" },
      { n: "Nero", t: 1, f: 1 },
      { n: "King John", t: 1, f: 1, s: "King John of England" },
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
      { n: "Green Lantern", t: 5, f: 5, s: "Hal Jordan", variants: [{ v: "ring charged", t: 5 }, { v: "ring out of power", t: 1 }] },
      { n: "Aquaman", t: 4, f: 5 },
      { n: "Martian Manhunter", t: 5, variants: [{ v: "no fire nearby", t: 5 }, { v: "the building is on fire", t: 2 }] },
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
      { n: "The Joker", t: 3, f: 5, variants: [{ v: "with a plan", t: 4 }, { v: "improvising", t: 3 }] },
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
      { n: "Boromir", t: 4, f: 5, variants: [{ v: "before Amon Hen", t: 4 }, { v: "three arrows in", t: 2 }] },
      { n: "Faramir", t: 4 },
      { n: "Éowyn", t: 4, variants: [{ v: "facing the Witch-king", g: "legendary" }, { v: "shieldmaiden of Rohan", g: "neutral" }] },
      { n: "Théoden", t: 3, variants: [{ v: "freed of Saruman", t: 4 }, { v: "under Wormtongue's spell", t: 1 }] },
      { n: "Éomer", t: 4 },
      { n: "Samwise Gamgee", t: 3, f: 5, variants: [{ v: "with Sting and the Phial", t: 4 }, { v: "with a frying pan", t: 2 }] },
      { n: "Frodo", t: 2, f: 5, variants: [{ v: "wearing the Ring", t: 4 }, { v: "stung by Shelob", t: 1 }] },
      { n: "Merry", t: 2 },
      { n: "Pippin", t: 2 },
      { n: "Bilbo", t: 2 },
      { n: "Gollum", t: 2, f: 5, variants: [{ v: "Sméagol, helpful", t: 2 }, { v: "Gollum, at the Cracks of Doom", t: 3 }] },
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
      { n: "The Witch-king", t: 5, variants: [{ v: "no man can kill him", t: 5 }, { v: "facing a woman and a hobbit", t: 3 }] },
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
      { n: "Smaug", t: 5, f: 5, variants: [{ v: "scales intact", t: 5 }, { v: "the gap in the breast", t: 3 }] },
      { n: "The Army of the Dead", t: 5 },
      { n: "Grima Wormtongue", t: 1 },
      { n: "Radagast", t: 3, f: 1 },
      { n: "Denethor", t: 1, f: 1 },
      { n: "Barliman Butterbur", t: 1, f: 1 },
      { n: "The Eagles", t: 4, s: "Great Eagles Gwaihir" },
    ],
  },

  // ── Sport ─────────────────────────────────────────────────────────────────
  {
    id: "athletes",
    name: "Greatest Athletes",
    emoji: "🏆",
    blurb: "Every argument you've ever had at a bar, settled with money.",
    imgContext: "athlete",
    scenario:
      "A decathlon of invented events — strength, endurance, nerve, hand-eye, and one round of pure improvisation. Each drafted team competes as a squad.",
    criteria:
      "Athletic range over specialisation, peak dominance in their sport, and how they perform when the pressure is absurd.",
    arenas: [
      { name: "A neutral stadium", desc: "A running track, a field, and a full set of equipment.", weight: 10 },
      { name: "Open water", desc: "Every event happens in or on deep water.", weight: 2 },
      { name: "High altitude", desc: "Thin air. Endurance athletes suffer least; everyone suffers.", weight: 3 },
      { name: "A pure contest of nerve", desc: "No physical advantage counts — only who holds up under pressure.", weight: 2 },
    ],
    entries: [
      { n: "Michael Jordan", t: 5, f: 5 },
      { n: "LeBron James", t: 5, f: 5 },
      { n: "Serena Williams", t: 5, f: 5 },
      { n: "Muhammad Ali", t: 5, f: 5 },
      { n: "Usain Bolt", t: 5, f: 5 },
      { n: "Simone Biles", t: 5, f: 5 },
      { n: "Wayne Gretzky", t: 5, f: 5 },
      { n: "Lionel Messi", t: 5, f: 5 },
      { n: "Cristiano Ronaldo", t: 5, f: 5 },
      { n: "Pelé", t: 5 },
      { n: "Diego Maradona", t: 5, variants: [{ v: "the goal of the century", t: 5 }, { v: "the Hand of God", t: 4 }] },
      { n: "Tom Brady", t: 4, f: 5 },
      { n: "Jerry Rice", t: 4 },
      { n: "Jim Thorpe", t: 5 },
      { n: "Babe Ruth", t: 4, variants: [{ v: "calling his shot", t: 5 }, { v: "after four hot dogs", t: 3 }] },
      { n: "Jackie Robinson", t: 4 },
      { n: "Shohei Ohtani", t: 5 },
      { n: "Michael Phelps", t: 5 },
      { n: "Katie Ledecky", t: 5 },
      { n: "Eliud Kipchoge", t: 5 },
      { n: "Jesse Owens", t: 5 },
      { n: "Carl Lewis", t: 5 },
      { n: "Florence Griffith Joyner", t: 5 },
      { n: "Nadia Comăneci", t: 4 },
      { n: "Bo Jackson", t: 5 },
      { n: "Deion Sanders", t: 4 },
      { n: "Wilt Chamberlain", t: 5 },
      { n: "Kobe Bryant", t: 5 },
      { n: "Shaquille O'Neal", t: 4 },
      { n: "Roger Federer", t: 5 },
      { n: "Rafael Nadal", t: 5, variants: [{ v: "on clay", t: 5 }, { v: "on grass", t: 4 }] },
      { n: "Novak Djokovic", t: 5 },
      { n: "Tiger Woods", t: 4, f: 5, variants: [{ v: "prime, red shirt Sunday", t: 5 }, { v: "post-surgery", t: 3 }] },
      { n: "Mike Tyson", t: 5, f: 5, variants: [{ v: "1988 prime", g: "legendary" }, { v: "the ear-biting era", g: "weakening" }] },
      { n: "Floyd Mayweather", t: 4 },
      { n: "Georges St-Pierre", t: 4 },
      { n: "Khabib Nurmagomedov", t: 5 },
      { n: "Ronda Rousey", t: 4 },
      { n: "Alexander Karelin", t: 5 },
      { n: "Hafthor Björnsson", t: 4, s: "Thor Bjornsson strongman" },
      { n: "Eddie Hall", t: 4 },
      { n: "Alex Honnold", t: 5, s: "free solo climber" },
      { n: "Lance Armstrong", t: 3, variants: [{ v: "seven yellow jerseys", t: 5 }, { v: "after the asterisk", t: 2 }] },
      { n: "Dennis Rodman", t: 3 },
      { n: "A competitive darts champion", t: 2, s: "darts player" },
      { n: "A curling skip", t: 2, s: "curling athlete" },
      { n: "A chess grandmaster", t: 1, s: "chess grandmaster" },
      { n: "An esports pro", t: 1, s: "esports player" },
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
      { n: "Thor", t: 5, f: 5, s: "Norse god Thor", variants: [{ v: "with Mjölnir", t: 5 }, { v: "hammer stolen", t: 3 }] },
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
      { n: "Cú Chulainn", t: 5, variants: [{ v: "in the ríastrad, warp-spasm", t: 5 }, { v: "bound to a standing stone", t: 3 }] },
      { n: "Beowulf", t: 4 },
      { n: "Grendel", t: 4 },
      { n: "Fenrir", t: 5, variants: [{ v: "unbound at Ragnarök", t: 5 }, { v: "chained by Gleipnir", t: 2 }] },
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
      { n: "Icarus", t: 1, f: 1, variants: [{ v: "on the way up", t: 3 }, { v: "on the way down", t: 1 }] },
      { n: "Sisyphus", t: 1, f: 1 },
      { n: "Narcissus", t: 1, f: 1 },
      { n: "Pandora", t: 2, variants: [{ v: "box closed", t: 1 }, { v: "box open", t: 5 }] },
    ],
  },
];

export function getPack(id: string): Pack | undefined {
  return PACKS.find((p) => p.id === id);
}
