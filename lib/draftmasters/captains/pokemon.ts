/**
 * Pokémon captains.
 *
 * Six hundred and forty-nine entries and the great majority of them are a
 * regional bird. So this file is not "one in six of the board" — it is one in
 * six of the cards a player would actually reach for, which on this board
 * means the starters people are sentimental about, the legendaries people
 * outbid each other over, the pseudo-legendaries people know are correct, and
 * the handful of joke picks that are funnier than either.
 *
 * The board's thesis, which the numbers below are trying to print: this is the
 * only franchise in the game where the fighters have a MANAGER. Everything on
 * this board is fought by something that did not choose to be here, on the
 * instruction of somebody standing behind it, and the captains that read best
 * are the ones who are visibly giving orders — Alakazam, Metagross, Slowking —
 * rather than the ones with the biggest number. Charizard is the most popular
 * card ever printed and a mediocre captain, and that is the joke working.
 *
 * ── Name collisions ────────────────────────────────────────────────────────
 *
 * Pokémon names are short, and this is the board most likely to reach into
 * somebody else's. The saving grace is that `hits` is a WORD-boundary match,
 * which kills the whole family of nightmares by itself:
 *
 *   mew        does not reach Mewtwo — the character after the match is "t"
 *   pikachu    was never inside Raichu; they only rhyme
 *   absol      does not reach anything "absolute", and every "Absolute Zero"
 *              on the board is a VARIANT line, which captains no longer read
 *   swan       is not why Swanna is safe, but it is why it is worth saying:
 *              Swanna ends in "na" and the boundary check does the rest
 *
 * The two that needed real handling:
 *
 *   farfetch   matched WITHOUT the trailing apostrophe-d, because the card is
 *              spelled with a curly ’ (U+2019) and a fragment typed with a
 *              straight ' would silently never match anything. "farfetch"
 *              stops at a non-letter either way. Do not "fix" this by adding
 *              the apostrophe back; Sirfetch’d is unaffected either way.
 *   dragonite  keeps the core registry's `dragon` super-effective row as well
 *              as this command, which is correct — they are different kinds
 *              and a card is allowed one of each.
 *
 * One row reaches another board on purpose. The Smash Bros. pack also prints
 * Pikachu, and it picks up the captaincy below. That is correct and matches
 * the precedent index.ts sets for the sixteen people on both Marvel and X-Men:
 * it is the same mouse, and a Pikachu who commands differently depending on
 * which pack you opened would be a bug wearing a hat.
 *
 * Ordering inside this file is not load-bearing anywhere, which is unusual and
 * worth stating so nobody assumes it is and starts being careful for no
 * reason. Every fragment below is a whole card name.
 */
import type { CaptainRow } from "./index";

export const POKEMON_CAPTAINS: CaptainRow[] = [
  // ── The ones who are the reason the board has a top end ──────────────────
  {
    match: "arceus",
    fx: {
      k: "command", atk: 2, def: 2, grace: 2, swap: 1,
      label: "It made the room",
      note:
        "+2/+2, two planes of any gap stop counting, and a substitution on top. The " +
        "single best captaincy on this board and it should be — the lore is not that " +
        "Arceus is strong, it is that Arceus made time, space and antimatter and then " +
        "delegated them to three other cards you can also draft. Everything opposite " +
        "your line is standing on something it built.",
    },
  },
  {
    match: "mewtwo",
    fx: {
      k: "command", atk: 3, def: 1, grace: 2,
      when: "kill", then: { atk: 1 },
      label: "Made for exactly this",
      note:
        "+3/+1, two planes of grace, and the line gets permanently sharper with every " +
        "kill. Mewtwo was commissioned, funded and grown to be the strongest thing " +
        "alive, which makes it the only card on the board with a written specification " +
        "and a grudge about it. It runs your line the way it was run: results first, " +
        "feelings never.",
    },
  },
  {
    match: "mew",
    fx: {
      k: "command", atk: 1, def: 1, grace: 1, swap: 4,
      label: "It can already do that",
      note:
        "Four substitutions — joint most in the game — because Mew learns every move " +
        "there is and therefore has, somewhere in it, the answer to whatever is " +
        "standing in front of your worst matchup. It will not tell you which answer " +
        "until it has already used it, and it thinks the whole thing is very funny.",
    },
  },
  {
    match: "rayquaza",
    fx: {
      k: "command", atk: 1, def: 1,
      doom: { atk: -3 },
      label: "Everyone stops fighting",
      note:
        "Almost nothing for your line and −3 attack to theirs. Rayquaza's entire " +
        "recorded history is two enormous things having a fight, Rayquaza coming down " +
        "out of the ozone layer, and the fight being over. It does not pick a side. It " +
        "arrives, and the volume goes down.",
    },
  },
  { match: "groudon", fx: { k: "command", atk: 3, def: 1, doom: { def: -2 }, label: "Drought", note: "+3/+1 and the enemy line comes out two health short, because the weather now belongs to your captain and it has decided on drought. Groudon does not fight the other team so much as make the continent inhospitable to it." } },
  { match: "kyogre", fx: { k: "command", atk: 2, def: 2, when: "round", then: { heal: 1 }, label: "Drizzle", note: "+2/+2 and a point back to everybody, every round, forever. Kyogre expanded the sea. Standing in it is apparently good for you, which is the closest this board comes to a medic." } },
  { match: "dialga", fx: { k: "command", atk: 1, def: 1, grace: 2, when: "round", then: { atk: 1 }, label: "It has all the time there is", note: "Two planes of grace and the line gains attack every single round with no cap on it, which makes this the best captain in the game in a long fight and a distinctly ordinary one in a short. Dialga is not making anybody stronger. It is giving them longer." } },
  { match: "palkia", fx: { k: "command", atk: 1, def: 1, grace: 1, swap: 3, label: "The distance was negotiable", note: "Three substitutions and a plane of grace. Palkia does not pull a card out of a bad matchup by shouting at it; it shortens the room until the card is somewhere else." } },
  { match: "giratina", fx: { k: "command", atk: 2, def: 1, raise: 2, label: "Sent away for being like this", note: "+2/+1 and two of your dead get up, because Giratina lives in the place things go when they are removed from the world and has never accepted that removal is permanent. It was banished by Arceus for being violent. It has been quietly running a lost-property office ever since." } },
  {
    match: "darkrai",
    fx: {
      k: "command", atk: 0, def: 1,
      doom: { atk: -3 },
      label: "Nobody on that side slept",
      note:
        "One point of health for your line and −3 attack to theirs. Darkrai does not " +
        "want anything. It causes nightmares the way a radiator causes heat, has been " +
        "chased out of every town it has ever wandered into, and is on record as being " +
        "extremely apologetic about all of it.",
    },
  },
  {
    match: "regigigas",
    fx: {
      k: "command", atk: 0, def: 0,
      when: "round", then: { atk: 1, def: 1 },
      label: "Slow Start",
      note:
        "Nothing at all on the bell. Not a point of attack, not a point of health, not " +
        "one substitution — and then +1/+1 to the whole line every round, forever, with " +
        "no ceiling. Regigigas towed the continents into position and has been asleep " +
        "since. Draft it if you expect a long fight and do not draft it if you are " +
        "hoping to be somewhere by seven.",
    },
  },
  { match: "ho-oh", fx: { k: "command", atk: 1, def: 1, raise: 3, label: "It has done this before", note: "Three of your fallen back on their feet, the joint-best raise in the game, and it is not a metaphor: Ho-Oh's one canonical act is finding three dead Pokémon in a burned tower and simply deciding they were not going to be dead. Everything else about it is a rainbow." } },
  { match: "lugia", fx: { k: "command", atk: 0, def: 3, grace: 1, lends: "ward", label: "It stays down there for a reason", note: "+0/+3, a plane of grace, and every blow that reaches the line reaches it lighter. Lugia lives at the bottom of the sea and comes up as little as possible, because a single beat of its wings is a forty-day storm and it has thought carefully about that." } },
  { match: "zacian", fx: { k: "command", atk: 4, def: 0, lends: "first", label: "It brought the sword", note: "+4 attack and the whole line moves first. Zacian is a wolf that picks up a sword in its mouth and is, on the numbers, the single hardest-hitting thing in the franchise. There is no defensive half of this captaincy. The defensive half is a different card and you can also draft it." } },
  { match: "zamazenta", fx: { k: "command", atk: 1, def: 4, lends: "ward", label: "It brought the shield", note: "+1/+4 and everything that reaches your line reaches it lighter. The other half. Zamazenta's entire design is standing between the fight and the people behind it, which is what a captain is, and it is the only card on this board that would agree to the job in writing." } },
  { match: "eternatus", fx: { k: "command", atk: 2, def: 0, doom: { atk: -2, def: -2 }, label: "The energy was never yours", note: "+2 for your line and −2/−2 for theirs. Eternatus is a parasite the size of a skyscraper that arrived on a meteor and started drinking the planet, and the reason everything in Galar can grow enormous is that it is standing near the leak." } },

  // ── The ones who run the fight without being in it ───────────────────────
  {
    match: "alakazam",
    fx: {
      k: "command", atk: 0, def: 1, grace: 2, swap: 3,
      label: "Five thousand, allegedly",
      note:
        "Two planes of grace, three substitutions and effectively no stat bonus, which " +
        "makes it the purest schemer on the board. The Pokédex claims an IQ of 5,000 " +
        "and a memory that has never lost anything, and then, in the same entry, notes " +
        "that its head is too heavy for its neck and it holds it up telekinetically. " +
        "Both facts are load-bearing here.",
    },
  },
  {
    match: "slowking",
    fx: {
      k: "command", atk: 1, def: 1, grace: 2, swap: 2,
      label: "The shellder bit down and it all came together",
      note:
        "Two planes of grace and two substitutions from a card whose entire origin is " +
        "a shellfish biting a very stupid pink animal on the head. The Pokédex says it " +
        "is now capable of understanding all languages and has grasped the fundamental " +
        "principles of the universe. It loses all of it the moment the shellder lets " +
        "go. Nobody has ever asked what happens if you draft it in autumn.",
    },
  },
  {
    match: "metagross",
    fx: {
      k: "command", atk: 1, def: 2, grace: 2, swap: 2,
      label: "Four brains, one answer",
      note:
        "+1/+2, two planes of grace and two substitutions. Metagross is four Beldum " +
        "fused into one body and running as a single machine, and the Pokédex is quite " +
        "clear that this arrangement out-thinks a supercomputer. It is also, and this " +
        "is the part that matters at auction, the only card here that gets better the " +
        "less it is asked to do personally.",
    },
  },
  { match: "gardevoir", fx: { k: "command", atk: 1, def: 2, when: "allyDown", then: { def: 2, heal: 2 }, label: "It will put itself in the way", note: "Every time one of yours goes down, the survivors get +2 health and 2 back. Gardevoir's dex entry is that it will create a small black hole to protect its trainer and that doing so costs it its own life. It is captaining, so it does not get to. It just keeps patching everyone else." } },
  { match: "lucario", fx: { k: "command", atk: 1, def: 1, grace: 2, label: "Reads the aura", note: "Two planes of any gap stop counting. Lucario sees intent as a shape in the air — where the blow is going before the arm has moved — and can describe it to four people at once. On a board where half the fights are decided by who guessed the type correctly, that is worth more than the punch." } },
  { match: "absol", fx: { k: "command", atk: 1, def: 0, grace: 2, label: "It was trying to warn you", note: "Two planes of grace and almost nothing else. Absol appears immediately before earthquakes, floods and tsunamis, which is why it has been hunted out of every populated area on the continent — for centuries, people took the correlation and drew exactly the wrong conclusion from it. It is still turning up. It is still right." } },
  { match: "sableye", fx: { k: "command", atk: 1, def: 1, lends: "first", label: "It goes before you do", note: "The whole line moves first. Sableye is a small thing in a cave with gemstones for eyes that has never once been the strongest card in a fight and has, on Prankster, been legal-in-format for a decade on the strength of going earlier than everyone. Speed is not a stat here; it is a job." } },

  // ── Walls, and one of them is genuinely the best card on its board ───────
  { match: "blissey", fx: { k: "command", atk: 0, def: 3, when: "round", then: { heal: 2 }, label: "Softboiled", note: "+0/+3 and two health back to everybody, every round. Blissey has the highest health stat in the franchise and an attack stat you could describe as an apology. It is a nurse. It has always been a nurse. Promote it and your line stops dying of things that were nearly survivable." } },
  {
    match: "shuckle",
    fx: {
      k: "command", atk: 0, def: 4,
      when: "round", then: { def: 1 },
      label: "Nothing has ever got through",
      note:
        "+0/+4 and another point of health for the whole line every round. Shuckle has " +
        "the highest defence in the game, an attack of 10, and — via a chain of " +
        "multipliers nobody has ever assembled in an actual match — the highest attack " +
        "figure ever legally reached in Pokémon. It is a mould that lives in a rock. " +
        "Both of those things are true at once.",
    },
  },
  { match: "snorlax", fx: { k: "command", atk: 1, def: 3, swap: 0, when: "round", then: { heal: 1 }, label: "It is not moving", note: "+1/+3 and a point back each round, and no substitutions whatsoever, because the defining Snorlax fact is that it once blocked a road for an entire generation of players and no amount of shouting achieved anything. It will hold your line together. It will not reorganise it." } },
  { match: "wobbuffet", fx: { k: "command", atk: 0, def: 2, swap: 0, doom: { atk: -2, def: -1 }, label: "Nobody is leaving", note: "−2/−1 to the other side and almost nothing for yours. Wobbuffet cannot attack. It has never been able to attack. Its entire twenty-five-year competitive career is Shadow Tag: the other side does not get to disengage, does not get to reposition, and slowly works out that this was always going to be the whole fight." } },
  { match: "umbreon", fx: { k: "command", atk: 0, def: 3, when: "round", then: { def: 1 }, label: "Very little happens for a long time", note: "+0/+3 and the line hardens a point every round. Umbreon is the answer to the question of what happens if you take the most beloved cute card in the game and evolve it at night into something that just refuses to die. Nothing about a fight it is running is fun to watch. It wins a lot of them." } },

  // ── The ones people actually bid on ──────────────────────────────────────
  {
    match: "charizard",
    fx: {
      k: "command", atk: 3, def: 0,
      when: "alone", then: { atk: 3 },
      label: "The most expensive card in the room",
      note:
        "+3 attack, no health, and another +3 the moment there is nobody left to send " +
        "in front of it. Charizard is the single most valuable piece of cardboard in " +
        "the hobby, has headlined more boxes than the mascot, and is a Fire type that " +
        "takes quadruple from a rock. Every one of those facts is priced in. You will " +
        "still bid on it.",
    },
  },
  { match: "blastoise", fx: { k: "command", atk: 1, def: 3, lends: "ward", label: "The cannons are aimed past you", note: "+1/+3 and every blow that reaches the line reaches it lighter. Blastoise is the starter that grew up into artillery: the shell is not for it, the water jets are rated in the dex as capable of punching through steel, and the whole thing reads as a vehicle with a crew." } },
  { match: "venusaur", fx: { k: "command", atk: 1, def: 2, when: "round", then: { heal: 1 }, label: "It runs on sunlight", note: "+1/+2 and a point back to everybody each round. Venusaur is the quiet one of the three and the only one carrying a functioning ecosystem on its back — the flower's scent is documented as calming people down, which on this board counts as a command ability." } },
  {
    match: "pikachu",
    fx: {
      k: "command", atk: 1, def: 1, grace: 1,
      when: "alone", then: { atk: 4 },
      label: "It has never been very good and it has never stopped",
      note:
        "+1/+1, a plane of grace, and +4 the moment it is the last one standing. On " +
        "raw numbers Pikachu has been outclassed by its own evolution since 1996 and " +
        "outclassed by roughly four hundred other cards since. It is also the reason " +
        "everyone at this table knows what any of this is. Both halves of that are in " +
        "the price.",
    },
  },
  {
    match: "eevee",
    fx: {
      k: "command", atk: 0, def: 0, swap: 4,
      label: "It has not decided yet",
      note:
        "No stat bonus of any kind and four substitutions, the joint most in the game. " +
        "Eevee's whole biology is an unstable genetic code that becomes whatever the " +
        "situation asks for — eight different answers and counting — and a captain who " +
        "cannot make anybody stronger but can always produce a better matchup is the " +
        "most honest way to print that.",
    },
  },
  { match: "gengar", fx: { k: "command", atk: 2, def: 0, doom: { atk: -1, def: -2 }, label: "It has been behind you the whole time", note: "+2 for your line, −1/−2 for theirs. The dex entries about Gengar are the most unpleasant in the franchise — it is your own shadow, it is the chill on the back of your neck, it is looking for a travelling companion and it means that in the worst way — and none of it is combat text. It is all about the other side's morale." } },
  { match: "gyarados", fx: { k: "command", atk: 4, def: -1, when: "allyDown", then: { atk: 2 }, label: "Thirty years of being a joke", note: "+4/−1 and another +2 attack every time one of yours goes down. Gyarados is the only card in the franchise whose entire personality is what it used to be. Nothing on this board converts a casualty into violence faster, and nothing on this board has a better reason." } },
  {
    match: "magikarp",
    fx: {
      k: "command", atk: 0, def: 0,
      when: "alone", then: { atk: 9, def: 7 },
      label: "Give it a minute",
      note:
        "The worst captain on the board by a distance: no bonus, no grace, no " +
        "substitutions, nothing whatsoever, for as long as anybody else on your side is " +
        "still standing. And then they are not, and Magikarp walks onto the field at " +
        "+9/+7 on top of the usual, and the fight is a different fight. This is the " +
        "single most Pokémon thing in this file. It is also, at the right price, theft.",
    },
  },
  { match: "mimikyu", fx: { k: "command", atk: 0, def: 0, lends: "undying", label: "Everyone gets a disguise", note: "Not one point of attack or health — and the first killing blow aimed at anyone on your line does not take. Mimikyu wears a bad Pikachu costume because it wanted, once, to be looked at the way Pikachu is looked at, and the rag holds together for exactly one hit. It has made four of those and handed them out." } },
  { match: "zoroark", fx: { k: "command", atk: 2, def: 0, swap: 3, label: "That was never who you were fighting", note: "+2 attack and three substitutions. Zoroark's illusion makes the front of your line look like whatever it wants the other side to see, which is why the substitution reads as a trick rather than a retreat: nobody on that side is sure anything was pulled." } },
  { match: "aegislash", fx: { k: "command", atk: 3, def: 0, lends: "ward", label: "Stance change", note: "+3 attack and every incoming blow lands lighter, which is both halves of a card that is a sword and a shield and cannot be both in the same instant. Aegislash is a haunted royal weapon and the dex says it can tell a rightful ruler from a pretender. It has looked at your line. It is here anyway." } },

  // ── Dragons, and the people who breed them ───────────────────────────────
  { match: "dragonite", fx: { k: "command", atk: 1, def: 2, raise: 1, lends: "ward", label: "It delivers the post", note: "+1/+2, one of your fallen back up, and the line takes less from every blow. Dragonite is a 600-point pseudo-legendary that flies faster than sound, and the dex has it rescuing drowning sailors and carrying mail across oceans. It is the kindest card on this board and it is not close." } },
  { match: "tyranitar", fx: { k: "command", atk: 3, def: 1, doom: { def: -1 }, label: "Sand Stream", note: "+3/+1 and the enemy line comes out a point short, because the weather changed the moment your captain arrived and it is not going to change back. Tyranitar's dex entry is that it brings down mountains to make a nest. The sandstorm is not an attack. It is the commute." } },
  { match: "garchomp", fx: { k: "command", atk: 2, def: 1, lends: "first", label: "Nothing saw it coming", note: "+2/+1 and the whole line goes first. Garchomp flies at the speed of sound, is covered in scales shaped like an aeroplane's leading edge, and has spent three generations being the card that decides whether your team gets to have a turn." } },
  { match: "dragapult", fx: { k: "command", atk: 2, def: 0, grace: 1, lends: "first", label: "The children are the ammunition", note: "+2 attack, a plane of grace and the line goes first. Dragapult keeps two Dreepy in horn-shaped holes in its head and fires them at three hundred kilometres an hour, and the dex is entirely relaxed about this. Fastest thing on the board. Worst parenting in the franchise." } },
  { match: "greninja", fx: { k: "command", atk: 2, def: 1, swap: 3, lends: "first", label: "It was never where you looked", note: "+2/+1, three substitutions, and the whole line moves first. Greninja is a frog ninja with water swords, and it is on this list rather than the two hundred other cool cards because Protean means it has never once fought as the type you prepared for." } },

  // ── The ones whose whole ability is somebody else's misfortune ───────────
  {
    match: "kingambit",
    fx: {
      k: "command", atk: 1, def: 1,
      when: "allyDown", then: { atk: 2 },
      label: "Supreme Overlord",
      note:
        "+2 attack to everyone still standing every single time one of yours falls, " +
        "with no cap. This is not an interpretation of the card; it is the card. " +
        "Kingambit's actual printed ability counts the corpses on its own side and " +
        "converts them into damage, and it climbed to the rank by outliving the " +
        "Bisharp above it. Draft it knowing what it is quietly hoping for.",
    },
  },
  { match: "annihilape", fx: { k: "command", atk: 1, def: 1, when: "round", then: { atk: 1 }, label: "Rage Fist", note: "+1 attack to the whole line every round, forever. Annihilape is the only Pokémon that has canonically died — a Primeape that got so angry it left its own body and kept going — and its signature move gets stronger every time it is hit. The line does not calm down. That is the entire mechanism." } },
  { match: "gholdengo", fx: { k: "command", atk: 1, def: 1, swap: 2, when: "kill", then: { heal: 1 }, label: "Make It Rain", note: "Two substitutions and a point of health back to the whole line every time you take something down. Gholdengo is a thousand coins with a ghost in them, and the mechanic is exactly what it looks like: the fight is profitable, and the profit is spent on the team." } },
  { match: "farfetch", fx: { k: "command", atk: 2, def: 1, when: "alone", then: { atk: 3 }, label: "It brought its own leek", note: "+2/+1, and +3 more once there is nobody left in front of it. Farfetch’d is a duck that carries a spring onion as a weapon, is named after a proverb about a duck turning up carrying its own garnish, and was hunted to near-extinction because of it. It has thought about this more than you have.\n\n(Matched on \"farfetch\" without the apostrophe — the card uses a curly ’ and a fragment typed with a straight one would silently never fire. Sirfetch’d is unaffected.)" } },
];
