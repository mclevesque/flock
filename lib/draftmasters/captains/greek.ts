/**
 * Greek captains.
 *
 * The largest board in the game and the one with the clearest thesis: nobody
 * here is helping you. A Greek god behind your line is a Greek god who has
 * found a use for you, and the myths are unanimous about how that ends. So the
 * commands on this board are the game's densest cluster of `doom` — the gods
 * are far better at ruining the other side than at improving yours, which is
 * also a fair summary of the Iliad — and several of the strongest belong to
 * entities who have never lifted anything heavier than a grudge.
 *
 * Ordering here is load-bearing and not cosmetic. First match wins, so:
 *
 *   nyx, hypnos, typhon   all three carry "Zeus" inside a variant line, and
 *                         all three would otherwise be captained by him, which
 *                         they would find insulting
 *   aeneas                his mother is named on one of his own variants and
 *                         was, briefly, taking the credit for him
 *   thanatos              is in handcuffs on one of his, and the man who put
 *                         him in them was giving him orders
 *   hera                  matched with a trailing space, so that the queen of
 *                         the gods does not take command of a Pokémon called
 *                         Heracross, or of Heracles, whom she has spent four
 *                         thousand years trying to kill
 *
 * That last one is not a joke about the rules. It is the rules.
 */
import type { CaptainRow } from "./index";

export const GREEK_CAPTAINS: CaptainRow[] = [
  // ── The three who must outrank Zeus in this list, and know it ────────────
  // (Heracles follows them for a different reason: he is simply better placed
  // above his stepmother than below her.)
  {
    match: "nyx",
    fx: {
      k: "command", atk: 2, def: 2, grace: 1,
      doom: { atk: -2, def: -1 },
      label: "Older than any of them",
      note:
        "The enemy line comes out at −2/−1 and your own fights a plane closer. Zeus once " +
        "went looking for someone who had wronged him, found them standing behind Night, " +
        "and went home. She is the only entity in the pantheon who has ever ended an " +
        "argument with him by being present.",
    },
  },
  { match: "hypnos", fx: { k: "command", atk: 1, def: 1, swap: 3, doom: { atk: -2 }, label: "Terms agreed in advance", note: "Three substitutions and the other side comes out two attack short, which is what happens when the god of sleep has been at the enemy's camp all night. He has put Zeus under twice. The second time he negotiated a wife out of it first, in writing, because he had learned something from the first time." } },
  { match: "typhon", fx: { k: "command", atk: 4, def: -1, doom: { atk: -1, def: -2 }, label: "The gods ran to Egypt", note: "+4 attack, −1 health, and the enemy line at −1/−2 before a blow lands. The entire Olympian pantheon fled the continent and hid in animal form rather than take this fight, and they were right to. It took a mountain dropped on him to finish it." } },
  {
    match: "heracles",
    fx: {
      k: "command", atk: 2, def: 2, swap: 1,
      when: "alone", then: { atk: 4 },
      label: "Twelve of these already",
      note:
        "+2/+2 while he waits, and +4 attack the moment there is nobody left to send in " +
        "front of him. He is a mediocre captain and the note is the reason: he has never " +
        "in his life solved a problem by delegating it, and every one of the Labours is a " +
        "story about him being told to stand back and going anyway.",
    },
  },

  // ── Olympus, in descending order of how much they want to be here ────────
  {
    match: "hera ",
    fx: {
      k: "command", atk: 1, def: 1, swap: 2,
      doom: { atk: -3, def: -1 },
      label: "A grudge, professionally maintained",
      note:
        "−3/−1 to the entire enemy line and only +1/+1 to yours, and she is still one of " +
        "the best cards on the board. Hera has never fought anybody. She has arranged " +
        "madness, monsters, delayed births, a lifetime of impossible tasks and one very " +
        "long detour home, all of it aimed at people who mostly did not do the thing she " +
        "was angry about. Promote her for what she does to the other team.",
    },
  },
  { match: "zeus", fx: { k: "command", atk: 3, def: 1, grace: 1, when: "kill", then: { atk: 1 }, label: "Because he can", note: "+3/+1, a plane of grace, and more attack with every kill. Strongest captain on the board on paper and the least reliable person on it in every other respect. He will absolutely help you win, and afterwards this becomes a story about him." } },
  {
    // Trailing space again. Two cards on this board name her in a variant and
    // both of them are victims: Ajax, maddened by Athena, and Medusa, before
    // Athena's curse. A comma and an apostrophe are the only things standing
    // between those two and a promotion they have earned nothing but grief from.
    match: "athena ",
    fx: {
      k: "command", atk: 1, def: 2, grace: 1, swap: 3,
      when: "round", then: { def: 1 },
      label: "Strategos",
      note:
        "Three substitutions, a plane of grace, and the line quietly hardens every round. " +
        "The cleanest captain in the game and the only Olympian who turns up before the " +
        "fight rather than during it. Every hero she sponsors survives the story; that is " +
        "not a coincidence and she would like you to notice.",
    },
  },
  { match: "odysseus", fx: { k: "command", atk: 2, def: 1, grace: 1, swap: 3, label: "Polytropos", note: "Athena's numbers without Athena, done by a man with no divine parentage, a middling spear arm and an unbeatable willingness to lie. He is the answer to the question of what a mortal captain is even for." } },
  { match: "ares", fx: { k: "command", atk: 4, def: -2, label: "Enthusiasm", note: "+4 attack and −2 health to your whole line, which is the god of war rendered honestly. He loses to Athena, loses to Heracles, loses to two mortals in the Iliad and goes home crying to his father each time. Your line will hit like nothing else on this board for exactly as long as it lasts." } },
  { match: "aeneas", fx: { k: "command", atk: 1, def: 2, swap: 2, raise: 2, lends: "ward", label: "The one who leaves", note: "Two of your fallen back on their feet, two substitutions and the line harder to break — no attack bonus worth the name. He is the only figure in the Iliad whose job is getting people out of it. He carried his father on his back through a burning city, lost his wife on the way, and founded a bigger empire than the one that won." } },
  { match: "hades", fx: { k: "command", atk: 1, def: 1, raise: 3, label: "The one with the inventory", note: "Only +1/+1, and three of your dead get up. Nothing else in the game raises three. He keeps every promise he makes, never leaves the office, has interfered in a mortal life roughly twice, and is treated by everyone including his own family as the villain of the pantheon." } },
  { match: "prometheus", fx: { k: "command", atk: 1, def: 2, raise: 2, lends: "ward", label: "Knew, told them anyway", note: "+1/+2, two fallen back on their feet, and the whole line takes less from every blow. He could see how it went for him and did it regardless, which is the only genuinely admirable act on this entire board." } },

  // ── The ones with no muscle at all, several of whom win boards ───────────
  {
    match: "cassandra",
    fx: {
      k: "command", atk: 0, def: 0, grace: 2,
      label: "Nobody ever listens",
      note:
        "No stat bonus of any kind and two planes of any gap above your line stop " +
        "counting, which is the joint-largest grace in the game. She knows precisely how " +
        "this fight goes, in order, and can tell all four of them. The curse was that she " +
        "would never be believed; the draft is the one place in the setting where " +
        "somebody can simply pay to believe her.",
    },
  },
  { match: "moirai", fx: { k: "command", atk: 1, def: 1, grace: 1, swap: 1, when: "round", then: { def: 1 }, label: "Already written", note: "Steady, unspectacular, and it never stops improving. The three of them outrank Zeus, do not attend Olympus, and have been doing needlework through every event on this board including the ones he thinks were his idea." } },
  { match: "erinyes", fx: { k: "command", atk: 1, def: 1, when: "allyDown", then: { atk: 3 }, label: "They do not forget", note: "+1/+1 and nothing else until one of yours goes down, at which point the survivors gain three attack and keep it. The Furies do not care who started it, who was provoked, or what the circumstances were. Somebody is owed and they have the name." } },
  { match: "circe", fx: { k: "command", atk: 1, def: 0, swap: 2, doom: { atk: -3 }, label: "Everyone becomes a pig", note: "−3 attack to the entire enemy line and almost nothing for yours. She has never lost a fight because she has never had one; people arrive at her island armed and leave it in a pen. The only man who got past her did it with a plant and a threat, and then stayed a year anyway." } },
  // Before Sisyphus, who is on his card as the reason he is in handcuffs and
  // was, until this line, also his commanding officer.
  { match: "thanatos", fx: { k: "command", atk: 0, def: 2, swap: 1, doom: { atk: -1, def: -2 }, label: "Everyone, eventually", note: "+0/+2 for you and −1/−2 for them, which is Death showing up with a list and reading one side of it out. He does not hate anybody, does not take bribes and cannot be argued with, and the only two people who have ever beaten him did it with rope and a technicality." } },
  { match: "sisyphus", fx: { k: "command", atk: 1, def: 1, raise: 2, when: "round", then: { def: 1 }, label: "It rolls back down", note: "Two of your fallen back up and a point of health every round, forever, from a man with no powers whatsoever. He put Death in handcuffs — nobody on earth could die until it was sorted out — and talked his way out of the underworld twice. The eternal punishment is on the record. So is the fact that he has beaten this system more times than anyone else on the board." } },
];
