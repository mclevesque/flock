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

export interface Variant {
  /** Parenthetical shown after the name, e.g. "two hands" */
  v: string;
  /** Tier override for this condition */
  t: number;
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
  /** Conditions — one is rolled at nomination time */
  variants?: Variant[];
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
    entries: [
      { n: "Jaime Lannister", t: 4, variants: [{ v: "two hands", t: 5 }, { v: "one hand", t: 3 }, { v: "gold hand, drunk", t: 2 }] },
      { n: "The Mountain", s: "Gregor Clegane", t: 5, variants: [{ v: "alive", t: 5 }, { v: "undead, Ser Robert Strong", t: 5 }, { v: "poisoned, dying", t: 3 }] },
      { n: "Arya Stark", t: 4, variants: [{ v: "Faceless assassin", t: 5 }, { v: "blind beggar", t: 2 }, { v: "Winterfell child", t: 1 }] },
      { n: "The Hound", s: "Sandor Clegane", t: 5, variants: [{ v: "prime", t: 5 }, { v: "burned leg, feverish", t: 3 }] },
      { n: "Brienne of Tarth", t: 4 },
      { n: "Jon Snow", t: 4, variants: [{ v: "resurrected", t: 4 }, { v: "Lord Commander", t: 4 }, { v: "green recruit", t: 2 }] },
      { n: "Daenerys Targaryen", t: 3, variants: [{ v: "with three dragons", t: 5 }, { v: "with one dragon", t: 4 }, { v: "alone in the Dothraki Sea", t: 1 }] },
      { n: "Tyrion Lannister", t: 2, variants: [{ v: "Hand of the King", t: 3 }, { v: "on trial, in chains", t: 1 }] },
      { n: "Khal Drogo", t: 5, variants: [{ v: "prime", t: 5 }, { v: "infected wound", t: 1 }] },
      { n: "Oberyn Martell", t: 5, s: "Red Viper" },
      { n: "Bronn", t: 4 },
      { n: "Ser Barristan Selmy", t: 4, variants: [{ v: "prime, Barristan the Bold", t: 5 }, { v: "old man", t: 3 }] },
      { n: "Night King", t: 5, s: "Game of Thrones" },
      { n: "Cersei Lannister", t: 2 },
      { n: "Ramsay Bolton", t: 3 },
      { n: "Grey Worm", t: 4 },
      { n: "Syrio Forel", t: 4 },
      { n: "Ygritte", t: 3 },
      { n: "Tormund Giantsbane", t: 4 },
      { n: "Melisandre", t: 3, variants: [{ v: "with her ruby", t: 4 }, { v: "without her necklace", t: 1 }] },
      { n: "Podrick Payne", t: 2 },
      { n: "Samwell Tarly", t: 1 },
      { n: "Hodor", t: 3 },
      { n: "Euron Greyjoy", t: 4 },
      { n: "Beric Dondarrion", t: 4, s: "flaming sword" },
      { n: "Robb Stark", t: 4, s: "Young Wolf" },
      { n: "Littlefinger", t: 1, s: "Petyr Baelish" },
      { n: "Varys", t: 1, s: "Game of Thrones eunuch spymaster" },
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
    entries: [
      { n: "Iron Man", t: 5, variants: [{ v: "Mark 85 armor", t: 5 }, { v: "Mark I, cave build", t: 2 }, { v: "no suit, just Tony", t: 1 }] },
      { n: "Thor", t: 5, variants: [{ v: "with Stormbreaker", t: 5 }, { v: "with Mjolnir", t: 5 }, { v: "Bro Thor, no hammer", t: 3 }] },
      { n: "Captain America", t: 4, variants: [{ v: "with the shield", t: 4 }, { v: "no shield", t: 3 }, { v: "worthy, wielding Mjolnir", t: 5 }] },
      { n: "Hulk", t: 5, variants: [{ v: "enraged", t: 5 }, { v: "Professor Hulk", t: 4 }, { v: "Bruce Banner, calm", t: 1 }] },
      { n: "Scarlet Witch", t: 5, s: "Wanda Maximoff" },
      { n: "Doctor Strange", t: 5, variants: [{ v: "Sorcerer Supreme", t: 5 }, { v: "with the Time Stone", t: 5 }, { v: "shaky hands, pre-training", t: 1 }] },
      { n: "Spider-Man", t: 4 },
      { n: "Black Panther", t: 4, variants: [{ v: "vibranium suit", t: 4 }, { v: "no suit, herb stripped", t: 2 }] },
      { n: "Wolverine", t: 4, s: "Marvel Logan", variants: [{ v: "adamantium claws", t: 5 }, { v: "bone claws", t: 3 }, { v: "Old Man Logan", t: 3 }] },
      { n: "Deadpool", t: 3 },
      { n: "Magneto", t: 5, variants: [{ v: "with the helmet", t: 5 }, { v: "no helmet", t: 3 }] },
      { n: "Thanos", t: 5, variants: [{ v: "full Infinity Gauntlet", t: 5 }, { v: "no stones, just the blade", t: 4 }] },
      { n: "Storm", t: 4, s: "X-Men Ororo Munroe" },
      { n: "Loki", t: 3 },
      { n: "Black Widow", t: 3 },
      { n: "Hawkeye", t: 2 },
      { n: "Vision", t: 4, variants: [{ v: "with the Mind Stone", t: 5 }, { v: "stone removed", t: 3 }] },
      { n: "Captain Marvel", t: 5, s: "Carol Danvers" },
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
    entries: [
      { n: "Charizard", t: 4, variants: [{ v: "Mega Charizard X", t: 5 }, { v: "standard", t: 4 }, { v: "still a level 5 Charmander", t: 1 }] },
      { n: "Mewtwo", t: 5, variants: [{ v: "Mega Mewtwo Y", t: 5 }, { v: "standard", t: 5 }] },
      { n: "Pikachu", t: 2, variants: [{ v: "Ash's Pikachu", t: 4 }, { v: "wild, level 3", t: 1 }] },
      { n: "Gengar", t: 4 },
      { n: "Dragonite", t: 5 },
      { n: "Snorlax", t: 4 },
      { n: "Blissey", t: 4 },
      { n: "Tyranitar", t: 5 },
      { n: "Gyarados", t: 4, variants: [{ v: "red Gyarados", t: 5 }, { v: "standard", t: 4 }, { v: "still a Magikarp", t: 1 }] },
      { n: "Lucario", t: 4 },
      { n: "Garchomp", t: 5 },
      { n: "Rayquaza", t: 5 },
      { n: "Arceus", t: 5 },
      { n: "Eevee", t: 2 },
      { n: "Magikarp", t: 1 },
      { n: "Ditto", t: 2 },
      { n: "Alakazam", t: 4 },
      { n: "Machamp", t: 4 },
      { n: "Greninja", t: 4 },
      { n: "Metagross", t: 5 },
      { n: "Lapras", t: 3 },
      { n: "Jigglypuff", t: 1 },
      { n: "Zapdos", t: 4 },
      { n: "Scizor", t: 4 },
      { n: "Slowpoke", t: 1 },
      { n: "Umbreon", t: 3 },
      { n: "Aggron", t: 3 },
      { n: "Wobbuffet", t: 2 },
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
    entries: [
      { n: "Saltwater Crocodile", t: 5, variants: [{ v: "in water", t: 5 }, { v: "on dry land", t: 3 }] },
      { n: "Grizzly Bear", t: 5 },
      { n: "Siberian Tiger", t: 5 },
      { n: "African Elephant", t: 5, variants: [{ v: "bull in musth", t: 5 }, { v: "calm cow", t: 4 }] },
      { n: "Hippopotamus", t: 5 },
      { n: "Cape Buffalo", t: 4 },
      { n: "Silverback Gorilla", t: 5 },
      { n: "Lion", t: 4, variants: [{ v: "male with a full pride", t: 5 }, { v: "lone male", t: 4 }, { v: "old, missing teeth", t: 2 }] },
      { n: "Grey Wolf", t: 3, variants: [{ v: "full pack of eight", t: 5 }, { v: "lone wolf", t: 3 }] },
      { n: "Honey Badger", t: 3 },
      { n: "Wolverine", s: "Gulo gulo animal", t: 3 },
      { n: "Komodo Dragon", t: 4 },
      { n: "Great White Shark", t: 5, variants: [{ v: "in water", t: 5 }, { v: "beached", t: 1 }] },
      { n: "Rhinoceros", t: 5 },
      { n: "Moose", t: 4 },
      { n: "Canada Goose", t: 2 },
      { n: "Cassowary", t: 4 },
      { n: "Chimpanzee", t: 4 },
      { n: "Anaconda", t: 4 },
      { n: "Polar Bear", t: 5 },
      { n: "Ostrich", t: 3 },
      { n: "Spotted Hyena", t: 3, variants: [{ v: "clan of six", t: 4 }, { v: "single", t: 2 }] },
      { n: "Red Kangaroo", t: 3 },
      { n: "Housecat", t: 1 },
      { n: "Emu", t: 3 },
      { n: "Wild Boar", t: 3 },
      { n: "Bald Eagle", t: 2 },
      { n: "Sloth", t: 1 },
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
    entries: [
      { n: "Darth Vader", t: 5, variants: [{ v: "prime, Rogue One hallway", t: 5 }, { v: "damaged suit", t: 3 }] },
      { n: "Anakin Skywalker", t: 5, variants: [{ v: "Clone Wars prime", t: 5 }, { v: "burned on Mustafar", t: 1 }, { v: "podracing kid", t: 1 }] },
      { n: "Yoda", t: 5, variants: [{ v: "prime", t: 5 }, { v: "900 years old, dying", t: 2 }] },
      { n: "Obi-Wan Kenobi", t: 5, variants: [{ v: "Clone Wars prime", t: 5 }, { v: "Old Ben", t: 3 }] },
      { n: "Luke Skywalker", t: 4, variants: [{ v: "Jedi Master", t: 5 }, { v: "Return of the Jedi", t: 4 }, { v: "farm boy", t: 1 }] },
      { n: "Darth Maul", t: 5 },
      { n: "Mace Windu", t: 5 },
      { n: "Emperor Palpatine", t: 5 },
      { n: "Boba Fett", t: 4 },
      { n: "The Mandalorian", t: 4, s: "Din Djarin", variants: [{ v: "beskar armor", t: 4 }, { v: "with the Darksaber", t: 5 }] },
      { n: "Ahsoka Tano", t: 5 },
      { n: "Han Solo", t: 3, variants: [{ v: "with the Falcon", t: 4 }, { v: "frozen in carbonite", t: 1 }] },
      { n: "Chewbacca", t: 3 },
      { n: "General Grievous", t: 4 },
      { n: "Count Dooku", t: 5 },
      { n: "Kylo Ren", t: 4 },
      { n: "Rey", t: 4 },
      { n: "Qui-Gon Jinn", t: 4 },
      { n: "Princess Leia", t: 3 },
      { n: "Lando Calrissian", t: 2 },
      { n: "Jar Jar Binks", t: 1 },
      { n: "R2-D2", t: 2 },
      { n: "C-3PO", t: 1 },
      { n: "Stormtrooper", t: 1 },
      { n: "Jango Fett", t: 4 },
      { n: "Captain Rex", t: 3 },
      { n: "Grand Admiral Thrawn", t: 3 },
      { n: "Ewok", t: 1 },
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
    entries: [
      { n: "Michael Myers", t: 5, s: "Halloween" },
      { n: "Freddy Krueger", t: 5, variants: [{ v: "in the dream world", t: 5 }, { v: "pulled into the real world", t: 3 }] },
      { n: "Jason Voorhees", t: 5, variants: [{ v: "undead Jason", t: 5 }, { v: "sack-head Jason", t: 4 }, { v: "drowning boy", t: 1 }] },
      { n: "Pennywise", t: 5, s: "IT clown", variants: [{ v: "full power", t: 5 }, { v: "weakened by belief", t: 2 }] },
      { n: "Leatherface", t: 4 },
      { n: "Xenomorph", t: 5, s: "Alien creature", variants: [{ v: "full grown", t: 5 }, { v: "facehugger stage", t: 2 }] },
      { n: "The Predator", t: 5, variants: [{ v: "cloaked, plasma caster", t: 5 }, { v: "weapons stripped", t: 4 }] },
      { n: "Hannibal Lecter", t: 3 },
      { n: "Ghostface", t: 3, s: "Scream" },
      { n: "Chucky", t: 2, s: "Child's Play doll" },
      { n: "Pinhead", t: 5, s: "Hellraiser" },
      { n: "The Thing", t: 5, s: "1982 John Carpenter creature" },
      { n: "Dracula", t: 5, variants: [{ v: "at night", t: 5 }, { v: "at high noon", t: 1 }] },
      { n: "Frankenstein's Monster", t: 4 },
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
    entries: [
      { n: "Bowser", t: 4, s: "Super Mario", variants: [{ v: "Giga Bowser", t: 5 }, { v: "standard", t: 4 }, { v: "on a bridge with an axe behind him", t: 1 }] },
      { n: "Ganondorf", t: 5, s: "Zelda" },
      { n: "Sephiroth", t: 5, s: "Final Fantasy VII" },
      { n: "Malenia", t: 5, s: "Elden Ring Blade of Miquella" },
      { n: "Ornstein and Smough", t: 5, s: "Dark Souls" },
      { n: "Nemesis", t: 4, s: "Resident Evil 3" },
      { n: "Mr. X", t: 3, s: "Resident Evil 2 Tyrant" },
      { n: "Psycho Mantis", t: 3, s: "Metal Gear Solid" },
      { n: "GLaDOS", t: 4, s: "Portal" },
      { n: "Ridley", t: 4, s: "Metroid" },
      { n: "Mother Brain", t: 4, s: "Metroid" },
      { n: "Doctor Eggman", t: 2, s: "Sonic Robotnik" },
      { n: "M. Bison", t: 4, s: "Street Fighter" },
      { n: "Akuma", t: 5, s: "Street Fighter" },
      { n: "Shao Kahn", t: 5, s: "Mortal Kombat" },
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
      { n: "Whispy Woods", t: 1, s: "Kirby tree boss" },
      { n: "The Devil", t: 4, s: "Cuphead final boss" },
      { n: "Sans", t: 4, s: "Undertale" },
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
    entries: [
      { n: "Goku", t: 5, s: "Dragon Ball", variants: [{ v: "Ultra Instinct", t: 5 }, { v: "Super Saiyan", t: 4 }, { v: "base form, kid Goku", t: 1 }] },
      { n: "Saitama", t: 5, s: "One Punch Man" },
      { n: "Naruto Uzumaki", t: 4, variants: [{ v: "Six Paths Sage Mode", t: 5 }, { v: "Sage Mode", t: 4 }, { v: "Academy student", t: 1 }] },
      { n: "Sasuke Uchiha", t: 4 },
      { n: "Monkey D. Luffy", t: 4, s: "One Piece", variants: [{ v: "Gear 5", t: 5 }, { v: "Gear 2", t: 3 }, { v: "East Blue rookie", t: 1 }] },
      { n: "Roronoa Zoro", t: 4, s: "One Piece" },
      { n: "Ichigo Kurosaki", t: 4, s: "Bleach" },
      { n: "Levi Ackerman", t: 4, s: "Attack on Titan", variants: [{ v: "with ODM gear", t: 4 }, { v: "no gear, open field", t: 2 }] },
      { n: "Eren Yeager", t: 4, s: "Attack on Titan" },
      { n: "Satoru Gojo", t: 5, s: "Jujutsu Kaisen", variants: [{ v: "unsealed", t: 5 }, { v: "sealed in the box", t: 1 }] },
      { n: "Tanjiro Kamado", t: 3, s: "Demon Slayer" },
      { n: "All Might", t: 5, s: "My Hero Academia", variants: [{ v: "prime", t: 5 }, { v: "post-injury, three minutes", t: 3 }] },
      { n: "Izuku Midoriya", t: 3, s: "My Hero Academia Deku" },
      { n: "Vegeta", t: 5, s: "Dragon Ball" },
      { n: "Light Yagami", t: 2, s: "Death Note", variants: [{ v: "with the Death Note", t: 5 }, { v: "no notebook", t: 1 }] },
      { n: "Edward Elric", t: 3, s: "Fullmetal Alchemist" },
      { n: "Guts", t: 4, s: "Berserk", variants: [{ v: "Berserker Armor", t: 5 }, { v: "Black Swordsman", t: 4 }] },
      { n: "Killua Zoldyck", t: 4, s: "Hunter x Hunter" },
      { n: "Gon Freecss", t: 3, s: "Hunter x Hunter" },
      { n: "Meliodas", t: 5, s: "Seven Deadly Sins" },
      { n: "Escanor", t: 5, s: "Seven Deadly Sins", variants: [{ v: "at high noon", t: 5 }, { v: "at midnight", t: 1 }] },
      { n: "Yusuke Urameshi", t: 4, s: "Yu Yu Hakusho" },
      { n: "Spike Spiegel", t: 3, s: "Cowboy Bebop" },
      { n: "Alucard", t: 5, s: "Hellsing" },
      { n: "Kenshin Himura", t: 4, s: "Rurouni Kenshin" },
      { n: "Yugi Muto", t: 1, s: "Yu-Gi-Oh" },
      { n: "Shinji Ikari", t: 1, s: "Evangelion", variants: [{ v: "in Eva Unit 01", t: 5 }, { v: "out of the robot", t: 1 }] },
      { n: "Mob", t: 5, s: "Mob Psycho 100 Shigeo Kageyama" },
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
    entries: [
      { n: "Bear Grylls", t: 5 },
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
    entries: [
      { n: "Leonardo da Vinci", t: 5 },
      { n: "Nikola Tesla", t: 5 },
      { n: "Marie Curie", t: 5 },
      { n: "Genghis Khan", t: 4 },
      { n: "Cleopatra", t: 4 },
      { n: "Julius Caesar", t: 4 },
      { n: "Sun Tzu", t: 4 },
      { n: "Isaac Newton", t: 5 },
      { n: "Albert Einstein", t: 4 },
      { n: "Benjamin Franklin", t: 5 },
      { n: "Hatshepsut", t: 4 },
      { n: "Alexander the Great", t: 4 },
      { n: "Ada Lovelace", t: 4 },
      { n: "Joan of Arc", t: 3 },
      { n: "Hannibal Barca", t: 4 },
      { n: "Confucius", t: 3 },
      { n: "Archimedes", t: 5 },
      { n: "Catherine the Great", t: 4 },
      { n: "George Washington Carver", t: 5 },
      { n: "Florence Nightingale", t: 4 },
      { n: "Miyamoto Musashi", t: 3 },
      { n: "Mansa Musa", t: 3 },
      { n: "Socrates", t: 2 },
      { n: "Vlad the Impaler", t: 2 },
      { n: "Grigori Rasputin", t: 1 },
      { n: "Napoleon Bonaparte", t: 4 },
      { n: "Harriet Tubman", t: 4 },
      { n: "Imhotep", t: 5, s: "ancient Egyptian architect" },
    ],
  },
];

export function getPack(id: string): Pack | undefined {
  return PACKS.find((p) => p.id === id);
}
