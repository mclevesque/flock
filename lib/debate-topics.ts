/**
 * The Great Debate — preset topic library.
 * Escape Pod DNA: heated rankings, specific recency takes, anatomical absurdities,
 * hypotheticals, deep fandom arguments. Broad franchise coverage across:
 * Star Wars, LOTR, Marvel, DC, anime, prestige TV, animation, video games, film canon.
 *
 * A topic with sideA/sideB renders as a pick-a-side challenge.
 * A topic without sides is an open-ended question — each debater labels their own stance when they accept.
 */

export type DebateCategory =
  | "star_wars"
  | "lotr"
  | "marvel"
  | "dc"
  | "anime"
  | "tv"
  | "animation"
  | "games"
  | "film"
  | "wild";

export interface PresetTopic {
  id: string;
  title: string;
  category: DebateCategory;
  sideA?: string;
  sideB?: string;
}

export const CATEGORY_LABELS: Record<DebateCategory, string> = {
  star_wars: "Star Wars",
  lotr: "LOTR / Tolkien",
  marvel: "Marvel",
  dc: "DC",
  anime: "Anime",
  tv: "Prestige TV",
  animation: "Animation",
  games: "Games",
  film: "Film Canon",
  wild: "Hypotheticals & Wild Takes",
};

export const PRESET_TOPICS: PresetTopic[] = [
  // ── Star Wars ────────────────────────────────────────────────────────────
  { id: "sw-best-movie", title: "What's the best Star Wars movie?", category: "star_wars" },
  { id: "sw-prequels-sequels", title: "Prequels vs Sequels — which trilogy is worse?", category: "star_wars", sideA: "Prequels are worse", sideB: "Sequels are worse" },
  { id: "sw-last-jedi", title: "Was The Last Jedi a good movie?", category: "star_wars", sideA: "Yes, it's good", sideB: "No, it's terrible" },
  { id: "sw-luke-vader", title: "Luke vs Vader — who's the better character?", category: "star_wars", sideA: "Luke", sideB: "Vader" },
  { id: "sw-eu-canon", title: "Should the Expanded Universe be canon again?", category: "star_wars", sideA: "Bring it back", sideB: "Leave it dead" },
  { id: "sw-andor-mando", title: "Andor or The Mandalorian — better Star Wars TV?", category: "star_wars", sideA: "Andor", sideB: "Mandalorian" },
  { id: "sw-hayden", title: "Hayden Christensen's prequel performance: bad or misunderstood?", category: "star_wars", sideA: "Misunderstood", sideB: "Just bad" },
  { id: "sw-rey-anakin", title: "Rey vs Anakin — better protagonist arc?", category: "star_wars", sideA: "Rey", sideB: "Anakin" },
  { id: "sw-best-duel", title: "Best lightsaber duel in all of Star Wars?", category: "star_wars" },
  { id: "sw-order-66", title: "Did Order 66 actually make sense as written?", category: "star_wars", sideA: "Makes sense", sideB: "Plot hole city" },

  // ── LOTR / Tolkien ───────────────────────────────────────────────────────
  { id: "lotr-balrog-wings", title: "Do Balrogs have wings?", category: "lotr", sideA: "Yes, wings", sideB: "No wings" },
  { id: "lotr-hobbit-trilogy", title: "The Hobbit trilogy: secretly good or bloated mess?", category: "lotr", sideA: "Secretly good", sideB: "Bloated mess" },
  { id: "lotr-rings-of-power", title: "Is Rings of Power worth defending?", category: "lotr", sideA: "Worth defending", sideB: "Indefensible" },
  { id: "lotr-bombadil", title: "Tom Bombadil should have been in the films", category: "lotr", sideA: "Yes, include him", sideB: "Correctly cut" },
  { id: "lotr-extended", title: "Extended editions vs theatrical cuts", category: "lotr", sideA: "Extended always", sideB: "Theatrical is tighter" },
  { id: "lotr-eagles", title: "Why didn't they just fly the eagles to Mordor?", category: "lotr", sideA: "Valid criticism", sideB: "Explained in lore" },
  { id: "lotr-book-vs-film", title: "LOTR books or Peter Jackson films — which is the canon experience?", category: "lotr", sideA: "Books", sideB: "Films" },
  { id: "lotr-silmarillion", title: "Should Amazon adapt The Silmarillion?", category: "lotr", sideA: "Adapt it", sideB: "Leave it alone" },

  // ── Marvel ──────────────────────────────────────────────────────────────
  { id: "mcu-nwh-since-endgame", title: "Is No Way Home the best MCU movie since Endgame?", category: "marvel", sideA: "Yes, nothing tops it", sideB: "Something else is better" },
  { id: "mcu-best-phase", title: "What's the best MCU phase?", category: "marvel" },
  { id: "mcu-endgame-iw", title: "Endgame vs Infinity War — which is the real peak?", category: "marvel", sideA: "Endgame", sideB: "Infinity War" },
  { id: "mcu-multiverse-cooked", title: "The Multiverse Saga is cooked", category: "marvel", sideA: "Agree — it's cooked", sideB: "Disagree — still works" },
  { id: "mcu-best-spidey", title: "Best live-action Spider-Man: Maguire, Garfield, or Holland?", category: "marvel" },
  { id: "mcu-fox-purchase", title: "Disney buying Fox was a mistake", category: "marvel", sideA: "Mistake", sideB: "Worth it" },
  { id: "mcu-xmen97", title: "X-Men '97 is better than anything live-action Marvel has done in years", category: "marvel", sideA: "Yes", sideB: "No" },
  { id: "mcu-born-again", title: "Daredevil: Born Again — hit or miss?", category: "marvel", sideA: "Hit", sideB: "Miss" },
  { id: "mcu-rdj-doom", title: "RDJ as Doctor Doom: genius casting or creative bankruptcy?", category: "marvel", sideA: "Genius", sideB: "Creatively bankrupt" },
  { id: "mcu-netflix-vs-disney", title: "Netflix Marvel shows > Disney+ Marvel shows", category: "marvel", sideA: "Netflix wins", sideB: "Disney+ wins" },

  // ── DC ──────────────────────────────────────────────────────────────────
  { id: "dc-snyder-cut", title: "Snyder Cut: masterpiece or overrated bloat?", category: "dc", sideA: "Masterpiece", sideB: "Overrated bloat" },
  { id: "dc-best-batman", title: "Best live-action Batman actor of all time?", category: "dc" },
  { id: "dc-pattinson-bale", title: "Pattinson vs Bale — better Batman?", category: "dc", sideA: "Pattinson", sideB: "Bale" },
  { id: "dc-joker-2019", title: "Joker (2019) is a shallow edgelord movie", category: "dc", sideA: "Shallow", sideB: "Actually great" },
  { id: "dc-peacemaker-boys", title: "Peacemaker is better than The Boys", category: "dc", sideA: "Peacemaker wins", sideB: "The Boys wins" },
  { id: "dc-dceu-dead", title: "Is the DCEU officially dead?", category: "dc", sideA: "Dead and buried", sideB: "Not quite" },
  { id: "dc-btas-best-animated", title: "Batman: The Animated Series is the best animated show ever made", category: "dc", sideA: "Agreed", sideB: "Something else tops it" },
  { id: "dc-man-of-steel", title: "Man of Steel is the best Superman movie", category: "dc", sideA: "Yes", sideB: "No, another one is" },
  { id: "dc-gunn-reboot", title: "James Gunn's DCU reboot will work", category: "dc", sideA: "It'll work", sideB: "Doomed already" },

  // ── Anime ───────────────────────────────────────────────────────────────
  { id: "anime-goat", title: "What's the greatest anime of all time?", category: "anime" },
  { id: "anime-aot-vs-bb", title: "Attack on Titan is a greater story than Breaking Bad", category: "anime", sideA: "AoT is greater", sideB: "Breaking Bad is greater" },
  { id: "anime-dbz-strongest", title: "Who's the strongest DBZ character — Goku, Vegeta, or Gohan?", category: "anime" },
  { id: "anime-one-piece-worth", title: "One Piece is worth 1000+ episodes", category: "anime", sideA: "Worth every episode", sideB: "Not worth it" },
  { id: "anime-naruto-bleach", title: "Naruto vs Bleach — better shonen?", category: "anime", sideA: "Naruto", sideB: "Bleach" },
  { id: "anime-aot-ending", title: "Did Attack on Titan stick the landing?", category: "anime", sideA: "Yes", sideB: "No" },
  { id: "anime-sub-dub", title: "Subs vs dubs — which is the correct way to watch anime?", category: "anime", sideA: "Subs", sideB: "Dubs" },
  { id: "anime-jjk-fall-off", title: "Did Jujutsu Kaisen fall off?", category: "anime", sideA: "Hard fall", sideB: "Still good" },
  { id: "anime-demon-slayer-overrated", title: "Demon Slayer is overrated", category: "anime", sideA: "Overrated", sideB: "Deserves the hype" },
  { id: "anime-ghibli-pixar", title: "Studio Ghibli or Pixar — who's the GOAT of animation?", category: "anime", sideA: "Ghibli", sideB: "Pixar" },

  // ── Prestige TV ─────────────────────────────────────────────────────────
  { id: "tv-best-show-ever", title: "Best TV show ever made?", category: "tv" },
  { id: "tv-got-ending", title: "Is Game of Thrones' ending as bad as people say?", category: "tv", sideA: "Yes, it's that bad", sideB: "Overhated" },
  { id: "tv-bb-vs-sopranos", title: "Breaking Bad vs The Sopranos — which is the real GOAT?", category: "tv", sideA: "Breaking Bad", sideB: "The Sopranos" },
  { id: "tv-succession-better", title: "Succession is better than every HBO drama before it", category: "tv", sideA: "Agree", sideB: "Disagree" },
  { id: "tv-the-boys-peaked", title: "The Boys already peaked", category: "tv", sideA: "Peaked", sideB: "Still climbing" },
  { id: "tv-invincible-animation", title: "Invincible is the best adult animated show right now", category: "tv", sideA: "Agree", sideB: "Something else is better" },
  { id: "tv-severance-wow", title: "Severance is overhyped", category: "tv", sideA: "Overhyped", sideB: "Deserved every award" },
  { id: "tv-stranger-things-fell", title: "Stranger Things fell off after season 2", category: "tv", sideA: "Fell off", sideB: "Still great" },
  { id: "tv-lost-ending", title: "Lost's ending ruined the show", category: "tv", sideA: "Ruined it", sideB: "Ending was fine" },

  // ── Animation ───────────────────────────────────────────────────────────
  { id: "anim-btas-best", title: "Is Batman: The Animated Series the best animated series ever?", category: "animation", sideA: "Yes, BTAS wins", sideB: "Something else wins" },
  { id: "anim-atla-korra", title: "Avatar: The Last Airbender vs Korra", category: "animation", sideA: "ATLA", sideB: "Korra" },
  { id: "anim-arcane-best", title: "Arcane is the best animated show of the decade", category: "animation", sideA: "Yes", sideB: "No" },
  { id: "anim-spiderverse-live", title: "Spider-Verse films are better than any live-action Spider-Man movie", category: "animation", sideA: "Agree", sideB: "Disagree" },
  { id: "anim-simpsons-goat", title: "The Simpsons' golden era is still the GOAT of TV comedy", category: "animation", sideA: "Still GOAT", sideB: "Been surpassed" },
  { id: "anim-adventure-time-peak", title: "Adventure Time is the most ambitious Cartoon Network show ever", category: "animation", sideA: "Yes", sideB: "No" },

  // ── Games ───────────────────────────────────────────────────────────────
  { id: "games-goat", title: "Greatest video game of all time?", category: "games" },
  { id: "games-botw-totk", title: "Breath of the Wild vs Tears of the Kingdom", category: "games", sideA: "BOTW", sideB: "TOTK" },
  { id: "games-elden-souls", title: "Elden Ring is better than every previous Souls game", category: "games", sideA: "Yes", sideB: "No" },
  { id: "games-gta6-delay", title: "GTA 6 will disappoint when it finally drops", category: "games", sideA: "Will disappoint", sideB: "Will deliver" },
  { id: "games-open-world-dead", title: "Open-world design is creatively exhausted", category: "games", sideA: "Exhausted", sideB: "Still has life" },
  { id: "games-adaptations-stop", title: "Video game movie/TV adaptations should stop", category: "games", sideA: "Stop them", sideB: "Keep making them" },
  { id: "games-last-of-us-2", title: "The Last of Us Part II is a masterpiece", category: "games", sideA: "Masterpiece", sideB: "Overrated" },
  { id: "games-nintendo-ip", title: "Nintendo has the strongest IP library in all entertainment", category: "games", sideA: "Strongest", sideB: "Disney tops them" },

  // ── Film Canon ──────────────────────────────────────────────────────────
  { id: "film-nolan-overrated", title: "Christopher Nolan is overrated", category: "film", sideA: "Overrated", sideB: "Deserves every bit of praise" },
  { id: "film-dune-21-84", title: "Dune (2021) vs Dune (1984) — which adaptation wins?", category: "film", sideA: "Villeneuve's Dune", sideB: "Lynch's Dune" },
  { id: "film-streaming-kills", title: "Streaming is killing cinema", category: "film", sideA: "Killing it", sideB: "Not really" },
  { id: "film-oppenheimer-best", title: "Oppenheimer is Nolan's best film", category: "film", sideA: "His best", sideB: "Not his best" },
  { id: "film-marvel-cinema", title: "Martin Scorsese was right about Marvel movies", category: "film", sideA: "He was right", sideB: "He was wrong" },
  { id: "film-everything-everywhere", title: "Everything Everywhere All at Once deserved Best Picture", category: "film", sideA: "Deserved it", sideB: "Overrated win" },
  { id: "film-hp-ranking", title: "What's the best Harry Potter film?", category: "film" },
  { id: "film-jaws-goat", title: "Jaws is still the greatest summer blockbuster ever made", category: "film", sideA: "Still GOAT", sideB: "Surpassed" },

  // ── Wild / Hypotheticals — Escape Pod absurdity tier ────────────────────
  { id: "wild-hulk-thanos-hung", title: "Who's more hung — Hulk or Thanos?", category: "wild", sideA: "Hulk", sideB: "Thanos" },
  { id: "wild-penguins-death-star", title: "If the Penguins of Madagascar were dropped on the Death Star, would they survive?", category: "wild", sideA: "They survive", sideB: "They die" },
  { id: "wild-vader-gandalf", title: "Darth Vader vs Gandalf the White — who wins?", category: "wild", sideA: "Vader", sideB: "Gandalf" },
  { id: "wild-goku-superman", title: "Goku vs Superman — who actually wins?", category: "wild", sideA: "Goku", sideB: "Superman" },
  { id: "wild-saitama-cheating", title: "Saitama in any crossover fight is cheating — he's uninteresting", category: "wild", sideA: "Agreed, boring", sideB: "Still fun" },
  { id: "wild-homelander-omniman", title: "Homelander vs Omni-Man — who wins and it's not close?", category: "wild", sideA: "Homelander", sideB: "Omni-Man" },
  { id: "wild-hogwarts-sorting", title: "Slytherin is unfairly vilified — it's the best house", category: "wild", sideA: "Agree", sideB: "Disagree" },
  { id: "wild-harry-snape", title: "Harry Potter should have ended up with Hermione", category: "wild", sideA: "Yes", sideB: "No" },
  { id: "wild-rocky-vs-creed", title: "Could prime Rocky Balboa beat Adonis Creed?", category: "wild", sideA: "Rocky", sideB: "Creed" },
  { id: "wild-batman-no-gadgets", title: "Batman without gadgets is just a rich guy in a costume — he's overrated", category: "wild", sideA: "Overrated", sideB: "Still the man" },
  { id: "wild-yoda-palpatine", title: "Yoda should have killed Palpatine in their duel — he choked", category: "wild", sideA: "He choked", sideB: "Had to retreat" },
  { id: "wild-thanos-morally-right", title: "Thanos was morally right", category: "wild", sideA: "He was right", sideB: "He was wrong" },
  { id: "wild-villain-most-justified", title: "Which villain across all media had the most justified cause?", category: "wild" },
  { id: "wild-pickle-rick", title: "Pickle Rick is the funniest thing Rick and Morty ever did", category: "wild", sideA: "Funniest", sideB: "Not even close" },
];

export function topicsByCategory(cat: DebateCategory): PresetTopic[] {
  return PRESET_TOPICS.filter(t => t.category === cat);
}

export function findPreset(id: string): PresetTopic | undefined {
  return PRESET_TOPICS.find(t => t.id === id);
}
