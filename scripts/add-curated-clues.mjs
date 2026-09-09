// Hand-curated "fan favorite" clues for Nerd Alert!
// Style: signature attacks, iconic lines, famous moments. The kind of thing
// any fan of the show/game knows in their bones. Difficulty calibration:
//   easy   ($200/$400): one-step fan recall (Goku's real name)
//   medium ($600/$800): iconic moments / lines (what Aragorn says at the Gate)
//   hard   ($1000):     real fan deep-cuts, still answerable if you watched
//
// Merges into lib/nerd-alert-pool.json alongside the OpenTDB pool.
// Each entry: { clue, answer, accept? } — accept is alt spellings/forms.

import fs from "node:fs";
import path from "node:path";

const CURATED = {
  "DRAGON BALL": {
    easy: [
      { clue: "Goku's birth name on Planet Vegeta.", answer: "Kakarot", accept: ["Kakarrot", "Kakaroto"] },
      { clue: "The number of Dragon Balls you need to collect to summon the dragon.", answer: "7", accept: ["Seven"] },
      { clue: "The wish-granting dragon summoned by the Dragon Balls on Earth.", answer: "Shenron", accept: ["Shen Long"] },
      { clue: "Goku's signature blue energy beam, charged with both hands.", answer: "Kamehameha" },
      { clue: "Goku's wife.", answer: "Chi-Chi", accept: ["Chichi"] },
      { clue: "Vegeta's home planet, destroyed by Frieza.", answer: "Planet Vegeta", accept: ["Vegeta"] },
    ],
    medium: [
      { clue: "Goku's older Saiyan brother who comes to Earth in the first DBZ arc.", answer: "Raditz" },
      { clue: "Vegeta's iconic line about Goku's power level: \"It's over ____!\"", answer: "9000", accept: ["nine thousand", "9,000", "8000"] },
      { clue: "Goku's transformation that turns his hair golden and his eyes green.", answer: "Super Saiyan", accept: ["Super Saiyan 1", "SSJ"] },
      { clue: "Vegeta's bald, hulking Saiyan partner who arrives on Earth with him.", answer: "Nappa" },
      { clue: "Goku's mentor — the turtle hermit who teaches him the Kamehameha.", answer: "Master Roshi", accept: ["Muten Roshi", "Roshi"] },
      { clue: "The pink demon villain of the final Z arc — has multiple forms including a fat one.", answer: "Majin Buu", accept: ["Buu", "Majin Boo"] },
    ],
    hard: [
      { clue: "Goku's father, a low-class Saiyan warrior killed by Frieza on Planet Vegeta.", answer: "Bardock" },
      { clue: "Vegeta's chest mark in the Buu Saga that signals his fall back to evil.", answer: "M", accept: ["Majin", "Majin M"] },
      { clue: "Trunks' future timeline mentor — the Saiyan who taught him to fight.", answer: "Gohan", accept: ["Future Gohan"] },
    ],
  },

  "NARUTO": {
    easy: [
      { clue: "Naruto's signature multi-clone technique he learns in episode 1.", answer: "Shadow Clone Jutsu", accept: ["Kage Bunshin", "Kage Bunshin no Jutsu", "Shadow Clones"] },
      { clue: "The Nine-Tailed Fox demon sealed inside Naruto.", answer: "Kurama", accept: ["Nine-Tails", "Kyuubi", "Nine Tailed Fox", "Kyubi"] },
      { clue: "Naruto's hidden village.", answer: "Hidden Leaf", accept: ["Konoha", "Konohagakure", "Leaf Village", "Village Hidden in the Leaves"] },
      { clue: "Naruto's signature spinning ball of chakra, taught by Jiraiya.", answer: "Rasengan" },
      { clue: "Naruto's pink-haired teammate.", answer: "Sakura", accept: ["Sakura Haruno"] },
      { clue: "Naruto's Uchiha rival and teammate, the brooding black-haired one.", answer: "Sasuke", accept: ["Sasuke Uchiha"] },
    ],
    medium: [
      { clue: "The white-haired pervy sage who teaches Naruto the Rasengan.", answer: "Jiraiya" },
      { clue: "Sasuke's older brother, who massacred the Uchiha clan.", answer: "Itachi", accept: ["Itachi Uchiha"] },
      { clue: "Naruto's father — the Fourth Hokage, nicknamed the Yellow Flash.", answer: "Minato", accept: ["Minato Namikaze", "Fourth Hokage", "Yondaime"] },
      { clue: "Kakashi's signature copy-jutsu eye, inherited from a dead friend.", answer: "Sharingan" },
      { clue: "Rock Lee's bushy-browed sensei in the green spandex jumpsuit.", answer: "Might Guy", accept: ["Guy Sensei", "Maito Gai", "Might Gai", "Gai"] },
      { clue: "Sasuke's iconic lightning blade jutsu, signature of Kakashi.", answer: "Chidori", accept: ["Lightning Cutter", "Raikiri"] },
    ],
    hard: [
      { clue: "Itachi's signature genjutsu that traps you in 72 hours of psychological torture.", answer: "Tsukuyomi" },
      { clue: "The masked Akatsuki member who is revealed late in the series to be Obito Uchiha.", answer: "Tobi" },
      { clue: "The Akatsuki member who controls the Six Paths of Pain from a distance.", answer: "Nagato" },
    ],
  },

  "ONE PIECE": {
    easy: [
      { clue: "The captain of the Straw Hat Pirates.", answer: "Luffy", accept: ["Monkey D. Luffy", "Strawhat Luffy"] },
      { clue: "Luffy's dream — the legendary treasure he's searching for.", answer: "One Piece", accept: ["The One Piece"] },
      { clue: "The Devil Fruit that turned Luffy's body to rubber.", answer: "Gomu Gomu no Mi", accept: ["Gum-Gum Fruit", "Gum Gum Fruit", "Rubber Fruit", "Gomu Gomu"] },
      { clue: "The Straw Hats' green-haired swordsman, fights with three swords — one in his mouth.", answer: "Zoro", accept: ["Roronoa Zoro", "Zolo"] },
      { clue: "The orange-haired thief-turned-navigator of the Straw Hats.", answer: "Nami" },
      { clue: "The Red-Haired Yonko who gave Luffy his straw hat as a kid.", answer: "Shanks", accept: ["Red-Haired Shanks"] },
    ],
    medium: [
      { clue: "Luffy's flame-powered older brother who dies at Marineford.", answer: "Ace", accept: ["Portgas D. Ace", "Fire Fist Ace"] },
      { clue: "The Straw Hats' chivalrous cook — never hits women.", answer: "Sanji", accept: ["Black Leg Sanji", "Vinsmoke Sanji"] },
      { clue: "The Straw Hats' tiny blue-nosed reindeer doctor.", answer: "Chopper", accept: ["Tony Tony Chopper"] },
      { clue: "Luffy's Marine vice-admiral grandfather.", answer: "Garp", accept: ["Monkey D. Garp"] },
      { clue: "The Pirate King executed at the start of the series — Luffy's idol.", answer: "Gol D. Roger", accept: ["Roger", "Gold Roger"] },
      { clue: "The skeleton musician of the Straw Hats — ate the Revive-Revive Fruit.", answer: "Brook" },
    ],
    hard: [
      { clue: "Roger's first mate, who later teaches Luffy Haki on Rusukaina.", answer: "Rayleigh", accept: ["Silvers Rayleigh", "Dark King Rayleigh"] },
      { clue: "Luffy's awakened Devil Fruit form revealed in Wano, named after the Sun God.", answer: "Gear Fifth", accept: ["Gear 5", "Nika", "Sun God Nika"] },
      { clue: "The three colors of Haki: Observation, Armament, and ____.", answer: "Conqueror's", accept: ["Conqueror", "Conquerors Haki", "Haoshoku", "King's Haki"] },
    ],
  },

  "STAR WARS": {
    easy: [
      { clue: "The bounty hunter who freezes Han in carbonite.", answer: "Boba Fett", accept: ["Boba"] },
      { clue: "Luke's twin sister.", answer: "Leia", accept: ["Princess Leia", "Leia Organa"] },
      { clue: "Han Solo's beat-up freighter.", answer: "Millennium Falcon", accept: ["The Falcon"] },
      { clue: "The wise green Jedi Master who trains Luke on Dagobah.", answer: "Yoda" },
      { clue: "Vader's pre-Sith name.", answer: "Anakin Skywalker", accept: ["Anakin"] },
      { clue: "Luke's home desert planet with two suns.", answer: "Tatooine" },
    ],
    medium: [
      { clue: "The Jedi Master killed by Darth Maul on Naboo at the end of Episode I.", answer: "Qui-Gon Jinn", accept: ["Qui Gon", "Qui-Gon", "Qui Gon Jinn"] },
      { clue: "Yoda's line: \"Do, or do not. There is no ____.\"", answer: "try" },
      { clue: "The Sith Emperor's famous line: \"I AM the ____.\"", answer: "Senate", accept: ["senate"] },
      { clue: "Princess Leia's home planet, blown up by the Death Star.", answer: "Alderaan" },
      { clue: "Lando Calrissian's city in the clouds above Bespin.", answer: "Cloud City", accept: ["Bespin"] },
      { clue: "Mace Windu's distinctive lightsaber color.", answer: "Purple" },
    ],
    hard: [
      { clue: "The Imperial officer Vader force-chokes for finding his lack of faith disturbing.", answer: "Motti", accept: ["Admiral Motti", "Conan Motti"] },
      { clue: "Ahsoka Tano's Jedi master during the Clone Wars.", answer: "Anakin", accept: ["Anakin Skywalker", "Skywalker"] },
      { clue: "Rey's desert junkyard home planet in The Force Awakens.", answer: "Jakku" },
    ],
  },

  "LORD OF THE RINGS": {
    easy: [
      { clue: "Frodo's loyal gardener best friend.", answer: "Samwise", accept: ["Sam", "Sam Gamgee", "Samwise Gamgee"] },
      { clue: "The white wizard who betrays Gandalf — lives in the tower of Orthanc.", answer: "Saruman" },
      { clue: "The volcano where the One Ring must be destroyed.", answer: "Mount Doom", accept: ["Orodruin"] },
      { clue: "Gollum's two-word nickname for the One Ring.", answer: "My Precious", accept: ["Precious", "The Precious"] },
      { clue: "The leader of the Ents who marches on Isengard.", answer: "Treebeard" },
      { clue: "Aragorn's reforged sword, given to him by Elrond.", answer: "Andúril", accept: ["Anduril", "Flame of the West"] },
    ],
    medium: [
      { clue: "Aragorn's rallying line just before he charges the Black Gate.", answer: "For Frodo", accept: ["For Frodo!"] },
      { clue: "Gandalf's iconic line to the Balrog on the bridge of Khazad-dûm.", answer: "You Shall Not Pass", accept: ["You Cannot Pass", "You shall not pass!"] },
      { clue: "Aragorn's elven love interest — Elrond's daughter.", answer: "Arwen" },
      { clue: "The fortress where the Battle of the Hornburg takes place in The Two Towers.", answer: "Helm's Deep", accept: ["Helms Deep"] },
      { clue: "The horse-lord kingdom ruled by King Théoden.", answer: "Rohan" },
      { clue: "Boromir's home, also called the White City.", answer: "Minas Tirith", accept: ["Gondor"] },
    ],
    hard: [
      { clue: "Éowyn's line to the Witch-King right before she kills him.", answer: "I am no man", accept: ["I'm no man", "No man"] },
      { clue: "Boromir's younger brother who befriends Frodo and Sam at Henneth Annûn.", answer: "Faramir" },
      { clue: "The number of Rings of Power given to Men.", answer: "9", accept: ["Nine"] },
    ],
  },

  "MARVEL MCU": {
    easy: [
      { clue: "Tony Stark's superhero identity.", answer: "Iron Man" },
      { clue: "Captain America's shield material.", answer: "Vibranium" },
      { clue: "The name of Thor's hammer.", answer: "Mjolnir", accept: ["Mjölnir"] },
      { clue: "Thanos collects six of these colored gems for his gauntlet.", answer: "Infinity Stones", accept: ["Infinity Gems", "The Stones"] },
      { clue: "Steve Rogers' superhero name.", answer: "Captain America", accept: ["Cap"] },
      { clue: "The 2008 film that launched the MCU.", answer: "Iron Man" },
    ],
    medium: [
      { clue: "Tony's iconic closing line in Iron Man (2008): \"I am ____.\"", answer: "Iron Man" },
      { clue: "Cap's WW2 best friend who becomes the Winter Soldier.", answer: "Bucky Barnes", accept: ["Bucky", "James Barnes", "James Buchanan Barnes"] },
      { clue: "Tilda Swinton's bald sorcerer who trains Doctor Strange.", answer: "The Ancient One", accept: ["Ancient One"] },
      { clue: "Thanos' line after the Snap: \"I am ____.\"", answer: "Inevitable" },
      { clue: "T'Challa's high-tech African kingdom.", answer: "Wakanda" },
      { clue: "Star-Lord's real name.", answer: "Peter Quill" },
    ],
    hard: [
      { clue: "Tony's final words before the snap in Endgame: \"And I... am ____.\"", answer: "Iron Man" },
      { clue: "The Asgardian goddess of death — villain of Thor: Ragnarok.", answer: "Hela" },
      { clue: "Michael B. Jordan's Black Panther villain.", answer: "Killmonger", accept: ["Erik Killmonger", "Erik Stevens", "N'Jadaka"] },
    ],
  },

  "HARRY POTTER": {
    easy: [
      { clue: "Harry's snowy white owl.", answer: "Hedwig" },
      { clue: "The Hogwarts class Snape teaches.", answer: "Potions" },
      { clue: "Hagrid's three-headed dog.", answer: "Fluffy" },
      { clue: "Voldemort's giant snake.", answer: "Nagini" },
      { clue: "The school Harry attends.", answer: "Hogwarts" },
      { clue: "Where Harry's lightning-bolt scar is.", answer: "Forehead", accept: ["His forehead", "On his forehead"] },
    ],
    medium: [
      { clue: "The killing curse, two words.", answer: "Avada Kedavra" },
      { clue: "The form Harry's Patronus takes.", answer: "Stag", accept: ["A stag"] },
      { clue: "Snape's Patronus, matching Lily Potter's.", answer: "Doe", accept: ["A doe"] },
      { clue: "The wizarding bank run by goblins.", answer: "Gringotts" },
      { clue: "Harry's godfather, escaped from Azkaban.", answer: "Sirius Black", accept: ["Sirius", "Padfoot"] },
      { clue: "Dumbledore's pet phoenix.", answer: "Fawkes" },
    ],
    hard: [
      { clue: "Snape's one-word answer to Dumbledore that reveals his lifelong love for Lily.", answer: "Always" },
      { clue: "The total number of Horcruxes Voldemort created (including Nagini and the accidental one).", answer: "7", accept: ["Seven"] },
      { clue: "The kindly Auror with the metamorphmagus powers and pink hair.", answer: "Tonks", accept: ["Nymphadora Tonks", "Nymphadora"] },
    ],
  },

  "POKÉMON": {
    easy: [
      { clue: "Ash's first Pokémon, given by Professor Oak.", answer: "Pikachu" },
      { clue: "Bulbasaur's final evolution.", answer: "Venusaur" },
      { clue: "Squirtle's final evolution.", answer: "Blastoise" },
      { clue: "Charmander's final evolution.", answer: "Charizard" },
      { clue: "Ash's Gen 1 rival, grandson of Professor Oak.", answer: "Gary", accept: ["Gary Oak", "Blue"] },
      { clue: "The legendary pink mythical Pokémon that Mewtwo was cloned from.", answer: "Mew" },
    ],
    medium: [
      { clue: "Charizard is Fire and what other type? (Not Dragon!)", answer: "Flying" },
      { clue: "The legendary bird trio: Articuno, Zapdos, and ____.", answer: "Moltres" },
      { clue: "Brock's specialty type as a gym leader.", answer: "Rock" },
      { clue: "Misty's specialty type as a gym leader.", answer: "Water" },
      { clue: "Team Rocket's motto starts: \"Prepare for ____.\"", answer: "Trouble" },
      { clue: "Pikachu's electric-type pre-evolution introduced in Gen 2.", answer: "Pichu" },
    ],
    hard: [
      { clue: "The glitch Pokémon found at Cinnabar Island in Red/Blue via the old-man trick.", answer: "MissingNo", accept: ["MissingNo.", "Missing No"] },
      { clue: "Ash's first Kanto gym badge, earned from Brock.", answer: "Boulder Badge" },
      { clue: "The three Gen 4 starters were Turtwig, Chimchar, and ____.", answer: "Piplup" },
    ],
  },

  "NINTENDO": {
    easy: [
      { clue: "Mario's taller, thinner brother in green.", answer: "Luigi" },
      { clue: "Mario's archnemesis Koopa King.", answer: "Bowser", accept: ["King Bowser", "King Koopa"] },
      { clue: "The princess Mario keeps rescuing.", answer: "Princess Peach", accept: ["Peach"] },
      { clue: "Link's annoying fairy companion in Ocarina of Time who shouts \"Hey, Listen!\"", answer: "Navi" },
      { clue: "Link's legendary blade — the Blade of Evil's Bane.", answer: "Master Sword" },
      { clue: "Ganondorf's giant pig-monster form.", answer: "Ganon" },
    ],
    medium: [
      { clue: "Mario's green dinosaur sidekick.", answer: "Yoshi" },
      { clue: "Princess Peach's purple-clad counterpart from Sarasaland.", answer: "Daisy", accept: ["Princess Daisy"] },
      { clue: "The three pieces of the Triforce: Power, Wisdom, and ____.", answer: "Courage" },
      { clue: "Bowser's miniature crown-wearing son with the paintbrush.", answer: "Bowser Jr.", accept: ["Bowser Junior"] },
      { clue: "The plateau where Link wakes up in Breath of the Wild.", answer: "Great Plateau" },
      { clue: "The Kingdom Mario tries to save from Bowser.", answer: "Mushroom Kingdom" },
    ],
    hard: [
      { clue: "The cat-like race of merchant villagers Link helps in Wind Waker. Also Beedle's people. (Single word)", answer: "Rito" },
      { clue: "Mario's purple-and-yellow evil counterpart.", answer: "Waluigi" },
      { clue: "Link's beloved horse companion across multiple games.", answer: "Epona" },
    ],
  },

  "ANIME CLASSICS": {
    easy: [
      { clue: "Edward Elric's younger brother whose soul is bonded to a suit of armor.", answer: "Alphonse", accept: ["Al", "Alphonse Elric"] },
      { clue: "Bleach's spiky orange-haired Soul Reaper protagonist.", answer: "Ichigo", accept: ["Ichigo Kurosaki", "Kurosaki Ichigo"] },
      { clue: "Death Note's high-school protagonist with the god complex.", answer: "Light", accept: ["Light Yagami", "Yagami Light", "Kira"] },
      { clue: "The grinning Shinigami who drops the Death Note in episode 1.", answer: "Ryuk", accept: ["Ryuuk"] },
      { clue: "Demon Slayer's protagonist with the green-and-black checkered haori.", answer: "Tanjiro", accept: ["Tanjiro Kamado", "Kamado Tanjiro"] },
      { clue: "Attack on Titan's protagonist, who can transform into a Titan himself.", answer: "Eren", accept: ["Eren Yeager", "Eren Jaeger"] },
    ],
    medium: [
      { clue: "Rurouni Kenshin's signature blade — a reverse-edged katana.", answer: "Sakabato", accept: ["Sakabatō", "Reverse-Blade Sword", "Reverse Blade", "Sakabatou"] },
      { clue: "Ichigo's giant cleaver-like Zanpakuto.", answer: "Zangetsu" },
      { clue: "FMA's seven Homunculi are named after these.", answer: "Seven Deadly Sins", accept: ["Deadly Sins", "Seven Sins", "Sins"] },
      { clue: "Cowboy Bebop's lanky bounty hunter protagonist.", answer: "Spike", accept: ["Spike Spiegel"] },
      { clue: "Sailor Moon's civilian name in the original Japanese.", answer: "Usagi", accept: ["Usagi Tsukino", "Tsukino Usagi", "Serena"] },
      { clue: "JoJo Part 3's protagonist whose Stand is Star Platinum.", answer: "Jotaro", accept: ["Jotaro Kujo", "Kujo Jotaro"] },
    ],
    hard: [
      { clue: "The black-armored swordsman of Berserk who wields the Dragonslayer.", answer: "Guts" },
      { clue: "Cowboy Bebop's other male bounty hunter, ex-cop with a cybernetic arm.", answer: "Jet", accept: ["Jet Black"] },
      { clue: "Light's notebook-wielding partner — second Kira, a model.", answer: "Misa", accept: ["Misa Amane", "Amane Misa", "Second Kira"] },
    ],
  },
};

const OUT = path.join(process.cwd(), "lib", "nerd-alert-pool.json");
const pool = JSON.parse(fs.readFileSync(OUT, "utf8"));

const seen = new Set();
for (const c of Object.keys(pool)) {
  for (const d of ["easy", "medium", "hard"]) {
    for (const q of pool[c][d] || []) seen.add(q.clue.toLowerCase());
  }
}

let added = 0;
for (const [name, tiers] of Object.entries(CURATED)) {
  if (!pool[name]) pool[name] = { easy: [], medium: [], hard: [] };
  for (const diff of ["easy", "medium", "hard"]) {
    for (const q of tiers[diff] || []) {
      const key = q.clue.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      pool[name][diff].push(q);
      added++;
    }
  }
}

fs.writeFileSync(OUT, JSON.stringify(pool, null, 2));

let total = 0;
console.log("=== POOL AFTER MERGE ===");
for (const c of Object.keys(pool)) {
  const e = pool[c].easy.length, m = pool[c].medium.length, h = pool[c].hard.length;
  total += e + m + h;
  console.log(`  ${c.padEnd(18)} e${e} m${m} h${h}`);
}
console.log(`\nAdded ${added} curated clues   |   total now ${total}`);
