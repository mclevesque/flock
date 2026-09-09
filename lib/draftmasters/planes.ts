/**
 * DraftMasters — planar tiers.
 *
 * The problem a pure ATK/DEF game has is that numbers are flat. A 10/10 Jedi
 * and a 10/10 Super Saiyan trade blows and someone wins on a coin toss, which
 * is exactly the argument the whole game exists to settle — and exactly the
 * wrong answer. Goku does not edge that fight. He is not in it.
 *
 * So every card carries a PLANE alongside its stats: which weight class of
 * reality it fights in. Planes do not make you hit harder in general. They
 * decide whether you can hurt someone AT ALL:
 *
 *   - One plane above you and two thirds of your hit lands. Two planes, one
 *     third. Three planes and NOTHING lands — Ash Ketchum with a ten-attack
 *     Pikachu does not chip a Super Saiyan down, however long he stands there.
 *   - Fighting DOWN is worth a point per plane, capped at three, because
 *     stepping on an ant is not more impressive for being a bigger boot.
 *
 * The falloff is a fraction rather than a flat subtraction, and that matters
 * more than it sounds. Taking three off every hit meant anything with a small
 * attack did literally nothing one plane up: a 3/10 could stand in front of a
 * 10/10 all day and never scratch it, which is both wrong and boring. As a
 * fraction that same 3 does 3, 2, 1, 0 as the gap opens — it always counts for
 * something until the wall, and the wall is where it should be.
 *
 * Two things this deliberately does not do:
 *
 *   Planes are not a power level. Hercule is plane 2 and proud of it — he'd
 *   flatten most of Westeros, because plane 2 with a real attack stat beats
 *   plane 1, and he'd lose health doing it. Bulma is plane 1 on the same
 *   board Goku is 6 on. A world does not sit on one plane; its people don't
 *   either.
 *
 *   Planes never touch the damage that gets past a defender to the player.
 *   That number is raw attack minus whatever health it had left, always, so
 *   the figure on the card is the figure that comes through. See `battle.ts`.
 */

/**
 * Seven weight classes of reality, low to high.
 *
 * The scale has to hold every board at once — a knight, a Pokémon and a god
 * are all going to end up on it — so the rungs are defined by what a fight
 * against that thing physically looks like, not by feats or power scaling.
 */
export type Plane = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface PlaneInfo {
  plane: Plane;
  label: string;
  /** Shown on the card's detail sheet. */
  note: string;
}

export const PLANES: PlaneInfo[] = [
  {
    plane: 1,
    label: "Mortal",
    note:
      "An ordinary person, or an ordinary animal. Can be killed by a fall, a knife " +
      "or a bad week. Most of any cast is here, including plenty of people the " +
      "story treats as important.",
  },
  {
    plane: 2,
    label: "Exceptional",
    note:
      "The ceiling of what a human body does — the world's best fighter, the " +
      "trained killer, the champion. Still flesh, still stoppable, but a whole " +
      "class above anyone on plane 1 and usually the reason they lose.",
  },
  {
    plane: 3,
    label: "Enhanced",
    note:
      "Past what a body should do. Superhuman strength or speed, real magic, a " +
      "monster large enough that ordinary weapons stop mattering. Bullets are an " +
      "annoyance rather than an answer.",
  },
  {
    plane: 4,
    label: "Superhuman",
    note:
      "Fights that level a district. Force applied at a scale buildings are not " +
      "built for. Anyone below plane 2 is a bystander in this fight, not a " +
      "participant.",
  },
  {
    plane: 5,
    label: "Titan",
    note:
      "Threatens a country or a world. Continues after being hit with things " +
      "that would end plane 4. The upper end of what most franchises ever field.",
  },
  {
    plane: 6,
    label: "Cosmic",
    note:
      "Fights measured in planets. Physics is a suggestion. There is no weapon on " +
      "plane 3 that registers, and there is no amount of standing there patiently " +
      "that makes one work.",
  },
  {
    plane: 7,
    label: "Absolute",
    note:
      "Rewrites the terms. Does not fight so much as decide. Reserved for the " +
      "handful of cards that are genuinely absurd to have drafted at all.",
  },
];

export const planeInfo = (p: Plane): PlaneInfo => PLANES[p - 1];

// ── The rules planes actually enforce ────────────────────────────────────────

/** Planes above you that make you completely unable to land a hit. */
export const PLANE_WALL = 3;
/** Damage gained per plane, fighting down — capped, because it caps out fast. */
export const PLANE_MAX_BONUS = 3;

/** The share of a hit that survives each plane of the gap, fighting up. */
export const PLANE_FALLOFF = [1, 2 / 3, 1 / 3, 0] as const;

/**
 * What one card's attack becomes against a defender on another plane.
 *
 * Returns the damage before card effects and before the defender's ward. The
 * raw attack is kept separately by the caller because breakthrough damage to
 * the player never goes through this function.
 */
export function planarAttack(attack: number, attacker: Plane, defender: Plane): number {
  const gap = defender - attacker;
  if (gap >= PLANE_WALL) return 0;
  // A fraction of the hit, never a flat toll — so a small attack still counts
  // for something right up to the wall, and a large one still loses most of
  // itself. A 3 does 3, 2, 1, 0 as the gap opens; a 10 does 10, 7, 3, 0.
  if (gap > 0) return Math.max(0, Math.round(attack * PLANE_FALLOFF[gap]));
  if (gap < 0) return attack + Math.min(PLANE_MAX_BONUS, -gap);
  return attack;
}

/** One line explaining a matchup's planar situation, for the battle log. */
export function planarNote(
  attackerName: string,
  attacker: Plane,
  defenderName: string,
  defender: Plane
): string | null {
  const gap = defender - attacker;
  if (gap >= PLANE_WALL) {
    return `${attackerName} cannot reach ${defenderName} — ${planeInfo(defender).label} is ${gap} planes up, and nothing ${attackerName} does lands at all.`;
  }
  if (gap === 2) return `${defenderName} is two planes above ${attackerName} — a third of it lands.`;
  if (gap === 1) return `${defenderName} is a plane above ${attackerName} and shrugs off a third of it.`;
  if (gap <= -2) return `${attackerName} is ${-gap} planes above ${defenderName}. It is not really a fight.`;
  if (gap === -1) return `${attackerName} is a plane above ${defenderName} and hits through the difference.`;
  return null;
}

// ── Where a card sits ────────────────────────────────────────────────────────

/**
 * The band a board's cast occupies.
 *
 * A world is a range, never a point. Middle-earth runs from a hobbit to a
 * Balrog; Invincible runs from Debbie Grayson to Thragg. The board declares
 * the range and a card's power tier places it inside — which is right for the
 * bulk of any cast, because in most fiction the strong characters are also
 * the ones operating at a higher scale of reality.
 *
 * The exceptions are what `PLANE_OVERRIDES` is for, and they are nearly all
 * one shape: the peak human who is a top-tier draft pick and still, physically,
 * a person. Batman is a tier 5 and a plane 2. That is the whole character.
 */
export const BOARD_PLANES: Record<string, [Plane, Plane]> = {
  got: [1, 3],
  animals: [1, 2],
  tmnt: [1, 3],
  ppg: [2, 4],
  sf: [2, 4],
  rangers: [2, 4],
  starwars: [2, 4],
  horror: [1, 4],
  mk: [2, 5],
  berserk: [1, 5],
  pokemon: [2, 6],
  bosses: [2, 6],
  anime: [1, 6],
  invincible: [1, 6],
  smash: [1, 6],
  lotr: [1, 6],
  greek: [1, 6],
  marvel: [1, 7],
  dc: [1, 7],
  myth: [2, 7],

  // Vampires are strong, fast and very hard to kill, and none of that is
  // planetary. An Original is the ceiling of this world and would still be a
  // mid-card problem on the Marvel board, which is exactly right.
  tvd: [1, 4],
  // Mutants run from a schoolteacher to Legion, so the band is nearly the whole
  // scale. Most of the cast sits in the middle.
  xmen: [1, 6],
  // The only board with no floor worth having: the smallest thing here is still
  // measured in city blocks. Nothing on this board is Mortal.
  godzilla: [3, 6],
  // Duelists are people. Their monsters are not, and the Egyptian Gods are
  // written as literal gods, so the band has to hold both.
  yugioh: [1, 6],
  // Every CW show at once, which means a Riverdale teenager and an archangel on
  // the same board. The widest honest band in the game.
  cw: [1, 6],
  // The one board where the band is nearly meaningless on its own: two men in a
  // car are plane 2 and they have killed most of the things at the top of it.
  // The counters carry this board, not the scale.
  spn: [1, 7],
};

/**
 * A board with no declared band — every custom board, until the generator
 * gives it one. Wide enough that a player who typed "Dragon Ball" gets a
 * usable spread, narrow enough that it does not hand out plane 7.
 */
export const DEFAULT_BAND: [Plane, Plane] = [1, 5];

/**
 * Cards whose plane their power tier gets wrong, keyed by board.
 *
 * Two kinds live here, and only two:
 *
 *   TOO HIGH — the elite mortal. Enormously valuable to draft, still a person.
 *   Batman, the Punisher, Guts, Johnny Cage, Hercule. Their tier says 5 and
 *   their plane says 2, and the gap between those numbers is the character.
 *
 *   TOO LOW — the joke pick who is secretly load-bearing, and the god who
 *   happens to be written at a modest tier because they never fight.
 *
 * Matched on a name fragment, lower-cased, so a board the model generated gets
 * the same ruling as a hand-written one when it names the same character. Order
 * matters: the first match wins, so put "super saiyan" above "goku".
 */
const PLANE_OVERRIDES: Record<string, [string, Plane][]> = {
  got: [
    ["night king", 3],
    ["white walker", 2],
    ["drogon", 3], ["rhaegal", 3], ["viserion", 3], ["balerion", 3],
    ["meleys", 3], ["vhagar", 3], ["caraxes", 3], ["syrax", 3], ["sunfyre", 3],
    ["dragon", 3],
    ["wight", 1],
    ["wun wun", 2], ["giant", 2],
    ["the mountain", 2], ["gregor", 2], ["arthur dayne", 2], ["barristan", 2],
    ["bronn", 2], ["the hound", 2], ["sandor", 2], ["brienne", 2], ["arya", 2],
    ["jaime", 2], ["jon snow", 2], ["daario", 2], ["khal drogo", 2],
    ["melisandre", 2], ["bran", 2],
    ["hot pie", 1], ["sam", 1], ["varys", 1], ["littlefinger", 1], ["tyrion", 1],
  ],
  marvel: [
    ["squirrel girl", 3],
    ["punisher", 2], ["hawkeye", 2], ["black widow", 2], ["nick fury", 2],
    ["daredevil", 2], ["shang-chi", 3], ["iron fist", 3],
    ["franklin richards", 7], ["living tribunal", 7], ["eternity", 7],
    ["thanos", 6], ["galactus", 7], ["scarlet witch", 6], ["dormammu", 6],
    ["hulk", 5], ["thor", 5], ["silver surfer", 6], ["captain marvel", 5],
    ["sentry", 6], ["doctor strange", 5], ["professor x", 4], ["magneto", 5],
    ["captain america", 3], ["spider-man", 4], ["wolverine", 3],
  ],
  dc: [
    ["batman", 2], ["green arrow", 2], ["question", 2], ["nightwing", 2],
    ["deathstroke", 3], ["red hood", 2], ["catwoman", 2],
    ["spectre", 7], ["doctor manhattan", 7], ["anti-monitor", 7],
    ["darkseid", 6], ["superman", 6], ["superboy prime", 6], ["doomsday", 5],
    ["flash", 5], ["martian manhunter", 5], ["wonder woman", 5], ["shazam", 5],
    ["green lantern", 5], ["lex luthor", 2], ["joker", 2], ["harley", 2],
  ],
  anime: [
    ["ultra instinct", 7], ["super saiyan blue", 6], ["super saiyan", 6],
    ["saitama", 7], ["beerus", 7], ["zeno", 7],
    ["goku", 5], ["vegeta", 5], ["gohan", 5], ["frieza", 5], ["broly", 6],
    ["bulma", 1], ["hercule", 2], ["mr. satan", 2], ["krillin", 3], ["yamcha", 3],
    ["luffy", 4], ["zoro", 4], ["naruto", 4], ["sasuke", 4], ["ichigo", 4],
    ["light yagami", 1], ["lelouch", 1], ["edward elric", 3], ["eren", 4],
    ["deku", 4], ["all might", 4], ["gojo", 5], ["sukuna", 5],
    ["tanjiro", 3], ["yusuke", 4], ["kenshin", 2], ["guts", 2],
  ],
  invincible: [
    ["debbie", 1], ["cecil", 1], ["art rosenbaum", 1], ["william", 1],
    ["amber", 1], ["eve", 5], ["atom eve", 5],
    ["thragg", 6], ["omni-man", 5], ["nolan", 5], ["allen", 5],
    ["conquest", 5], ["anissa", 5], ["battle beast", 5],
    ["mark", 4], ["invincible", 4], ["rex splode", 3], ["robot", 3],
    ["immortal", 4],
  ],
  lotr: [
    ["eru", 7], ["morgoth", 6], ["melkor", 6], ["sauron", 5], ["tom bombadil", 6],
    ["balrog", 4], ["ancalagon", 6], ["glaurung", 5], ["smaug", 4],
    ["gandalf the white", 4], ["gandalf", 3], ["saruman", 3], ["galadriel", 4],
    ["elrond", 3], ["witch-king", 3], ["nazgul", 3], ["nazgûl", 3],
    ["treebeard", 3], ["shelob", 3],
    ["aragorn", 2], ["boromir", 2], ["legolas", 2], ["gimli", 2], ["éowyn", 2],
    ["eowyn", 2], ["frodo", 1], ["sam", 1], ["merry", 1], ["pippin", 1], ["bilbo", 1],
  ],
  greek: [
    ["chaos", 7], ["ananke", 7], ["nyx", 7], ["gaia", 6], ["ouranos", 6],
    ["zeus", 6], ["poseidon", 6], ["hades", 6], ["kronos", 6], ["typhon", 6],
    ["athena", 5], ["ares", 5], ["apollo", 5], ["artemis", 5], ["hera", 5],
    ["hercules", 4], ["heracles", 4], ["achilles", 3], ["perseus", 3],
    ["theseus", 2], ["jason", 2], ["odysseus", 2], ["atalanta", 2],
    ["medusa", 3], ["minotaur", 3], ["hydra", 4], ["cerberus", 4],
    ["helen", 1], ["cassandra", 1], ["icarus", 1],
  ],
  myth: [
    ["yahweh", 7], ["brahma", 7], ["amaterasu", 6], ["ra", 6], ["odin", 6],
    ["thor", 5], ["anubis", 5], ["quetzalcoatl", 5], ["sun wukong", 6],
    ["fenrir", 5], ["jormungandr", 5], ["jörmungandr", 5], ["baba yaga", 4],
    ["valkyrie", 3], ["banshee", 3], ["kelpie", 2],
  ],
  starwars: [
    ["palpatine", 4], ["sidious", 4], ["darth vader", 4], ["yoda", 4],
    ["luke", 4], ["rey", 3], ["obi-wan", 3], ["mace windu", 4], ["maul", 3],
    ["dooku", 3], ["ahsoka", 3], ["grievous", 3], ["kylo", 3],
    ["boba fett", 2], ["jango", 2], ["han solo", 2], ["chewbacca", 2],
    ["leia", 2], ["mandalorian", 2], ["din djarin", 2], ["cad bane", 2],
    ["stormtrooper", 1], ["jar jar", 1], ["c-3po", 1], ["ewok", 1],
    ["dark lord of the sith", 6],
  ],
  bosses: [
    ["kefka", 5], ["sephiroth", 5], ["ganon", 4], ["ganondorf", 4],
    ["bowser", 3], ["dracula", 4], ["mother brain", 4], ["gaping dragon", 3],
    ["gwyn", 4], ["malenia", 3], ["radahn", 4], ["ornstein", 3],
    ["sans", 2], ["glados", 2], ["wheatley", 1], ["m. bison", 3],
    ["giygas", 6], ["ridley", 4], ["nemesis", 3], ["pyramid head", 3],
  ],
  berserk: [
    ["femto", 6], ["griffith", 5], ["god hand", 6], ["void", 6], ["slan", 6],
    ["skull knight", 4], ["zodd", 4], ["grunbeld", 4], ["ganishka", 5],
    ["guts", 2], ["casca", 2], ["serpico", 2], ["schierke", 3], ["farnese", 1],
    ["puck", 1], ["isidro", 1],
  ],
  mk: [
    ["one being", 7], ["elder god", 6], ["shinnok", 6], ["shao kahn", 5],
    ["raiden", 5], ["quan chi", 4], ["shang tsung", 4], ["kronika", 6],
    ["goro", 4], ["motaro", 4], ["ermac", 4], ["scorpion", 3], ["sub-zero", 3],
    ["johnny cage", 2], ["sonya", 2], ["jax", 2], ["kano", 2], ["stryker", 2],
    ["liu kang", 3], ["kitana", 3], ["mileena", 3],
  ],
  sf: [
    ["gill", 4], ["akuma", 4], ["gouki", 4], ["oni", 4], ["seth", 4],
    ["bison", 3], ["ryu", 3], ["ken", 3], ["sagat", 3], ["gouken", 3],
    ["chun-li", 2], ["guile", 2], ["zangief", 2], ["blanka", 2], ["dhalsim", 3],
    ["dan", 1], ["birdie", 1],
  ],
  smash: [
    ["master hand", 6], ["crazy hand", 6], ["galeem", 7], ["dharkon", 7],
    ["kirby", 5], ["palutena", 5], ["rosalina", 5], ["bayonetta", 5],
    ["sonic", 4], ["samus", 4], ["ganondorf", 4], ["mewtwo", 5],
    ["mario", 3], ["link", 3], ["fox", 3], ["pikachu", 3], ["donkey kong", 3],
    ["villager", 1], ["mr. game", 2], ["wii fit", 1], ["pichu", 1],
    ["jigglypuff", 2],
  ],
  pokemon: [
    // The trainers are children with backpacks. Whatever their card is worth at
    // auction, they are not the ones absorbing a hit.
    ["ash ketchum", 2], ["ash", 2], ["misty", 1], ["brock", 1], ["team rocket", 1],
    ["arceus", 6], ["dialga", 6], ["palkia", 6], ["giratina", 6],
    ["mewtwo", 5], ["mew", 5], ["rayquaza", 5], ["kyogre", 5], ["groudon", 5],
    ["lugia", 5], ["ho-oh", 5], ["darkrai", 5], ["deoxys", 5],
    ["magikarp", 1], ["caterpie", 1], ["weedle", 1], ["metapod", 1],
    ["kakuna", 1], ["ditto", 2], ["wobbuffet", 2], ["unown", 2],
  ],
  horror: [
    ["cthulhu", 6], ["pennywise", 5], ["freddy", 3], ["dream world", 5],
    ["candyman", 3], ["the thing", 4], ["pinhead", 4], ["samara", 3],
    ["michael myers", 2], ["jason voorhees", 3], ["leatherface", 2],
    ["ghostface", 1], ["chucky", 1], ["hannibal", 1], ["norman bates", 1],
    ["xenomorph", 3], ["predator", 3],
  ],
  ppg: [
    ["him", 5], ["mojo jojo", 2], ["fuzzy lumpkins", 2], ["princess", 2],
    ["blossom", 4], ["bubbles", 4], ["buttercup", 4],
    ["professor utonium", 1], ["mayor", 1], ["ms. bellum", 1],
  ],
  tmnt: [
    ["krang", 3], ["shredder", 2], ["splinter", 2],
    ["leonardo", 2], ["raphael", 2], ["donatello", 2], ["michelangelo", 2],
    ["casey jones", 2], ["april", 1], ["bebop", 2], ["rocksteady", 2],
    ["super shredder", 3],
  ],
  rangers: [
    ["zordon", 3], ["megazord", 4], ["zord", 4], ["lord zedd", 4],
    ["rita", 3], ["ivan ooze", 4], ["goldar", 3], ["putty", 1],
    ["green ranger", 3], ["ranger", 2], ["bulk", 1], ["skull", 1],
  ],
  tvd: [
    // The Originals are the ceiling and they are all on it together — a
    // thousand years is a thousand years whether or not you are the interesting
    // one. Everything below them is an ordinary vampire, and vampires are not
    // gods; they are very hard to kill people.
    ["hope mikaelson", 4], ["tribrid", 4],
    ["klaus", 4], ["mikael", 4], ["elijah", 4], ["rebekah", 4], ["kol", 4],
    ["finn", 3], ["esther", 4], ["dahlia", 4], ["freya", 3],
    ["silas", 4], ["qetsiyah", 3], ["the hollow", 4], ["malivore", 4],
    ["marcel", 3], ["lucien", 4], ["alaric", 2], ["kai parker", 3],
    ["bonnie", 3], ["davina", 3], ["rayna", 3], ["papa tunde", 3],
    ["damon", 2], ["stefan", 2], ["katherine", 2], ["caroline", 2],
    ["enzo", 2], ["tyler", 2], ["hayley", 2], ["josie", 3], ["lizzie", 2],
    ["elena", 2], ["matt donovan", 1], ["jenna", 1], ["liz forgot", 1],
    ["sheriff", 1], ["camille", 1], ["jeremy", 1], ["zach", 1], ["landon", 1],
  ],
  xmen: [
    ["onslaught", 7], ["dark phoenix", 7], ["phoenix force", 7],
    ["legion", 6], ["proteus", 6], ["nate grey", 6], ["vulcan", 5],
    ["professor x", 5], ["magneto", 5], ["apocalypse", 6], ["nimrod", 5],
    ["jean grey", 5], ["storm", 5], ["iceman", 5], ["exodus", 5],
    ["juggernaut", 5], ["magik", 4], ["cable", 4], ["emma frost", 4],
    ["colossus", 4], ["rogue", 4], ["cyclops", 4], ["psylocke", 4],
    ["quicksilver", 4], ["mister sinister", 4], ["shadow king", 4],
    ["selene", 4], ["sebastian shaw", 4], ["stryfe", 4], ["bastion", 4],
    ["omega red", 4], ["archangel", 4], ["havok", 4], ["polaris", 4],
    ["master mold", 4], ["a sentinel", 4], ["mojo", 4], ["spiral", 4],
    // The clawed ones are terrifying and they are not planetary. This is the
    // whole reason the plane scale exists separately from the tier scale.
    ["wolverine", 3], ["sabretooth", 3], ["x-23", 3], ["deadpool", 3],
    ["lady deathstrike", 3], ["silver samurai", 3], ["nightcrawler", 3],
    ["gambit", 3], ["kitty pryde", 3], ["bishop", 3], ["beast", 3],
    ["mystique", 2], ["domino", 2], ["jubilee", 2], ["forge", 1],
    ["moira", 1], ["husk", 2], ["marrow", 2], ["toad", 2],
  ],
  godzilla: [
    ["godzilla earth", 6], ["bagan", 6], ["godzilla ultima", 6],
    ["keizer", 6], ["burning godzilla", 6],
    ["godzilla", 5], ["king ghidorah", 6], ["destoroyah", 5],
    ["spacegodzilla", 5], ["mechagodzilla", 5], ["biollante", 5],
    ["monster x", 5], ["mothra", 4], ["rodan", 4], ["king kong", 4],
    ["gigan", 4], ["hedorah", 4], ["orga", 4], ["megaguirus", 4],
    ["battra", 4], ["queen muto", 4], ["muto prime", 4], ["behemoth", 4],
    ["skull devil", 4], ["methuselah", 4], ["tiamat", 4], ["shimo", 4],
    ["scar king", 4], ["dagon", 4],
    ["anguirus", 3], ["baragon", 3], ["varan", 3], ["gorosaurus", 3],
    ["kumonga", 3], ["kamacuras", 3], ["ebirah", 3], ["manda", 3],
    ["skullcrawler", 3], ["scylla", 3], ["warbat", 3], ["gabara", 3],
    ["minilla", 3], ["jet jaguar", 3], ["mechani-kong", 3],
  ],
  yugioh: [
    // The gods are written as gods. Everything else is a monster, and the
    // people holding the cards are people.
    ["exodia", 6], ["slifer", 6], ["obelisk", 6], ["winged dragon of ra", 6],
    ["zorc", 6], ["don thousand", 5], ["zarc", 5], ["z-one", 5],
    ["five-headed dragon", 5], ["blue-eyes twin burst", 5],
    ["blue-eyes ultimate", 5], ["blue-eyes shining", 5],
    ["blue-eyes", 4], ["dark magician", 4], ["red-eyes", 4],
    ["black luster soldier", 4], ["stardust dragon", 4], ["red dragon archfiend", 4],
    ["black rose dragon", 4], ["cyber end", 4], ["elemental hero neos", 4],
    ["thousand-eyes", 4], ["gate guardian", 4], ["yubel", 4], ["astral", 4],
    ["number 39", 3], ["summoned skull", 3], ["buster blader", 3],
    ["gaia", 3], ["jinzo", 3], ["relinquished", 3], ["dark magician girl", 3],
    ["toon dragon", 3], ["celtic guardian", 2], ["mystical elf", 2],
    ["baby dragon", 2], ["time wizard", 2], ["kuriboh", 1], ["slime token", 1],
    ["copycat", 1],
    // Duelists. Atem is the exception and only because he is a dead pharaoh.
    ["atem", 3], ["yugi", 1], ["kaiba", 1], ["joey", 1], ["marik", 2],
    ["bakura", 2], ["pegasus", 2], ["jaden", 2], ["yusei", 1], ["jack atlas", 1],
    ["yuma", 1], ["yuya", 1], ["declan", 1], ["mai", 1], ["ishizu", 1],
    ["weevil", 1], ["rex raptor", 1], ["tea", 1], ["tristan", 1],
    ["bandit keith", 1], ["mako", 1], ["duke devlin", 1], ["rebecca", 1],
    ["akiza", 2], ["crow", 1], ["kalin", 1], ["zane", 2], ["chazz", 1],
    ["aster", 1], ["alexis", 1], ["syrus", 1], ["vector", 3],
  ],
  cw: [
    // Six power scales that were never meant to meet. Placed by what each
    // person could actually survive, which is the only honest way to do it.
    ["chuck shurley", 7], ["amara", 7], ["the spectre", 7],
    ["death", 6], ["lucifer", 6], ["michael", 6], ["jack kline", 6],
    ["clark kent", 6], ["kara zor-el", 6], ["general zod", 6], ["doomsday", 6],
    ["bizarro", 6], ["brainiac", 6], ["reign", 6],
    ["barry allen", 5], ["eobard", 5], ["zoom", 5], ["savitar", 5],
    ["black flash", 5], ["martian manhunter", 5], ["astra", 5], ["non", 5],
    ["godspeed", 5], ["wally west", 5], ["jesse quick", 5], ["jay garrick", 5],
    ["castiel", 5], ["damien darhk", 5], ["silas", 4],
    ["firestorm", 4], ["killer frost", 4], ["gorilla grodd", 4],
    ["bloodwork", 4], ["vandal savage", 4], ["constantine", 4], ["crowley", 4],
    ["mallus", 4], ["neron", 4], ["rowena", 4], ["klaus", 4], ["hope", 4],
    ["elijah", 4], ["rebekah", 4], ["brainiac 5", 3], ["macy", 4],
    ["jefferson pierce", 4], ["solomon grundy", 4], ["icicle", 4],
    ["courtney whitmore", 4], ["starman", 4], ["naomi", 4],
    ["vibe", 3], ["thunder", 3], ["lightning", 3], ["nia nal", 3],
    ["livewire", 3], ["silver banshee", 3], ["ray palmer", 3], ["hawkman", 3],
    ["hawkgirl", 3], ["nate heywood", 3], ["zari", 3], ["liv moore", 3],
    ["max evans", 3], ["mel vera", 3], ["maggie vera", 3], ["bonnie", 3],
    ["kai parker", 3], ["damon", 2], ["stefan", 2], ["caroline", 2],
    ["katherine", 2],
    // The billionaires with bows. Elite, mortal, and nothing on this board
    // makes that untrue.
    ["oliver queen", 2], ["slade wilson", 2], ["malcolm merlyn", 2],
    ["ras al ghul", 2], ["ra's al ghul", 2], ["nyssa", 2], ["sara lance", 2],
    ["laurel", 2], ["roy harper", 2], ["thea queen", 2], ["prometheus", 2],
    ["kate kane", 2], ["ryan wilder", 2], ["alice", 2], ["nicky shen", 2],
    ["captain cold", 2], ["heat wave", 2], ["weather wizard", 2],
    ["cicada", 2], ["tobias whale", 2], ["dean winchester", 2],
    ["sam winchester", 2], ["bobby singer", 2], ["blaine", 2],
    ["octavia", 2], ["lexa", 2], ["clarke", 1], ["raven reyes", 1],
    ["john diggle", 2], ["alex danvers", 2], ["lex luthor", 2],
    ["lionel", 1], ["chloe", 1], ["lana lang", 1], ["jonathan kent", 1],
    ["tess mercer", 1], ["jor-el", 3], ["felicity", 1], ["lena luthor", 1],
    ["rip hunter", 1], ["archie", 1], ["jughead", 1], ["betty cooper", 1],
    ["cheryl", 1], ["veronica", 1],
  ],
  spn: [
    ["chuck", 7], ["god", 7], ["amara", 7], ["the darkness", 7],
    ["death", 6], ["billie", 6], ["lucifer", 6], ["michael", 6],
    ["gabriel", 5], ["raphael", 5], ["jack kline", 6], ["jack", 6],
    ["castiel", 5], ["metatron", 5], ["eve", 5], ["cain", 5],
    ["abaddon", 4], ["alastair", 4], ["azazel", 4], ["lilith", 4],
    ["crowley", 4], ["rowena", 4], ["dick roman", 4], ["a leviathan", 4],
    ["zachariah", 4], ["naomi", 4], ["gadreel", 4], ["balthazar", 4],
    ["anna milton", 4], ["uriel", 4], ["meg", 3], ["ruby", 3],
    ["a hellhound", 3], ["benny", 3], ["a wendigo", 3], ["a rugaru", 3],
    // The brothers. Plane 2 and they have killed most of the list above, which
    // is the entire show and exactly what the counter system is for.
    ["dean winchester", 2], ["sam winchester", 2], ["john winchester", 2],
    ["mary winchester", 2], ["bobby", 2], ["arthur ketch", 2], ["garth", 2],
    ["jody", 2], ["donna", 2], ["jo harvelle", 2], ["ellen", 2],
    ["rufus", 2], ["bela", 2], ["claire", 2], ["missouri", 2],
    ["charlie", 1], ["kevin tran", 1], ["adam milligan", 1], ["ash", 1],
    ["the impala", 1], ["sigil", 1],
  ],
  animals: [
    ["elephant", 2], ["blue whale", 2], ["hippo", 2], ["rhino", 2],
    ["saltwater crocodile", 2], ["polar bear", 2], ["grizzly", 2],
    ["great white", 2], ["orca", 2], ["tiger", 2], ["lion", 2],
    ["cape buffalo", 2], ["gorilla", 2],
  ],
};

/**
 * Cross-board overrides — words that mean a plane wherever they turn up.
 *
 * These matter most on generated boards, where nobody has written a table and
 * the model may or may not have said anything useful. "A god of" is a god on
 * any board somebody types.
 */
const UNIVERSAL: [string, Plane][] = [
  ["ultra instinct", 7],
  ["super saiyan", 6],
  ["dark lord of the sith", 6],
  ["one above all", 7],
  ["omnipotent", 7],
  ["with the infinity gauntlet", 7],
  ["infinity gauntlet", 6],
  ["god of ", 6],
  ["goddess of ", 6],
  ["as a god", 6],
  ["ascended", 5],
  ["newborn", 1],
  ["as a child", 1],
  ["as a baby", 1],
  ["depowered", 1],
  ["de-powered", 1],
  ["powers removed", 1],
  ["stripped of ", 1],
];

const clampPlane = (n: number): Plane =>
  Math.max(1, Math.min(7, Math.round(n))) as Plane;

/**
 * How much a variant moves a card's plane.
 *
 * Almost nothing does — a boon is a better sword, not a bigger reality. Only
 * the top of the ladder moves the needle, because that is where the ladder
 * stops meaning "improved" and starts meaning "transformed": Super Saiyan is
 * not Goku with more attack, it is Goku somewhere else.
 */
export function planeShiftForGrade(grade: string | null | undefined): number {
  switch (grade) {
    case "uber": return 2;
    case "mythic": return 2;
    case "exalted": return 1;
    case "legendary": return 1;
    case "crippling": return -1;
    default: return 0;
  }
}

export interface PlaneQuery {
  name: string;
  variant?: string | null;
  /** The card's effective tier, 1-12. */
  tier: number;
  /**
   * The entry's own tier before any variant, 1-5.
   *
   * Passed rather than inferred, because inferring it from the effective tier
   * meant every mythic variant on any board reverse-engineered to a base 5,
   * placed at the top of its band, and then took the grade bonus on top —
   * which quietly made every purple chip in the game a god.
   */
  baseTier?: number;
  /** The board it was drafted from. */
  packId?: string;
  /** The variant's grade, if it has one. */
  grade?: string | null;
  /** The board's band, if the board declares one directly. */
  band?: [Plane, Plane];
  /** The board's base tier ceiling — 5 for every hand-written board. */
  baseCeiling?: number;
}

/**
 * The plane a card fights on.
 *
 * Resolution order, most specific first:
 *   1. A universal phrase in the variant — "Super Saiyan" is plane 6 anywhere.
 *   2. The board's own override table.
 *   3. The board's band, with the card's base tier placing it inside.
 * Then the variant's grade shifts the result, and the whole thing is clamped.
 */
export function planeOf(q: PlaneQuery): Plane {
  const name = q.name.toLowerCase();
  const variant = (q.variant ?? "").toLowerCase();
  const both = `${name} ${variant}`;

  const shift = planeShiftForGrade(q.grade);

  // A named phrase is already the ruling — "Super Saiyan" is plane 6 whatever
  // grade somebody attached to it, so the grade does not also apply.
  for (const [frag, plane] of UNIVERSAL) {
    if (variant.includes(frag) || name.includes(frag)) return clampPlane(plane);
  }

  const table = q.packId ? PLANE_OVERRIDES[q.packId] : undefined;
  if (table) {
    for (const [frag, plane] of table) {
      if (both.includes(frag)) return clampPlane(plane + shift);
    }
  }

  // No ruling for this one: place it in the board's band by the character's own
  // tier, then let the variant's grade nudge it. The effective tier is
  // deliberately NOT used for placement — that is what `shift` is for, and
  // counting the variant twice made every purple chip in the game a god.
  const [lo, hi] = q.band ?? (q.packId ? BOARD_PLANES[q.packId] : undefined) ?? DEFAULT_BAND;
  const ceiling = q.baseCeiling ?? 5;
  const base = Math.max(1, Math.min(ceiling, q.baseTier ?? q.tier));
  const t = (base - 1) / Math.max(1, ceiling - 1); // 0..1
  const placed = lo + t * (hi - lo);

  // A grade can push a card one rung past the top of its own world, and no
  // further. ABSOLUTE is not something a dice roll hands out — it is reserved
  // for the handful of names written into the tables above, so that when a
  // card does show up on plane 7, it means somebody decided it should.
  const ceilingPlane = Math.min(6, Math.max(hi, hi + (shift > 0 ? 1 : 0)));
  return clampPlane(Math.min(ceilingPlane, placed + shift));
}
