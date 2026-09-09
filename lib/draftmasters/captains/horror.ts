/**
 * Horror captains.
 *
 * The organising fact of this board is that almost nothing on it can be
 * killed, only postponed. Every headline villain here has a filmography of
 * being definitively finished in the last ten minutes and appearing again two
 * years later with a higher budget, and the game should say so out loud. So
 * this file leans on `raise` and on `when: "round"` — commands that do not
 * win the fight in front of them so much as decline to end.
 *
 * The exception, and the best joke available on the board, is the Final Girl,
 * whose entire genre function is being the last one standing. She is the
 * purest `when: "alone"` card in the game and she is worth nothing at all
 * until she is worth everything.
 *
 * OWNERSHIP.
 *
 *   dracula     Written here rather than on `bosses`, which also prints him.
 *               The Castlevania boss is a video-game adaptation of the novel
 *               and inherits this captaincy, which is the right way round.
 *   godzilla    NOT written here, though horror prints him, because he has a
 *               whole board of his own and it is not mine.
 *
 * COLLISION NOTES.
 *
 *   jigsaw          Also reaches this board's own "Jigsaw's Pig", which is a
 *                   mask. Left deliberately: a rubber pig head running the
 *                   line to John Kramer's specification is exactly what
 *                   happens in the films, since he is dead for five of them
 *                   and the traps keep working anyway.
 *   the thing       Checked against all twenty-six packs before writing, on
 *                   the assumption that Marvel would have Ben Grimm on it.
 *                   It does not. The fragment is clean.
 *   michael myers   Full name, always. "michael" alone is the Supernatural
 *                   archangel and half a dozen other people; the horror board
 *                   is why the Supernatural file cannot captain its Michael
 *                   at all, and the least this file can do is not make it
 *                   worse.
 *   pearl           NOT captained. Ti West's Pearl shares the fragment with a
 *                   Vampire Diaries apothecary owner.
 *   ash             NOT captained. "Ash's chainsaw hand" is printed here and
 *                   there is an unrelated Ash on the Supernatural board.
 *
 * ALREADY TAKEN. Hannibal Lecter is captained out of the core registry in
 * battle.ts, along with "Hannibal's muzzle", which the core also claims. A
 * leather mask commanding four people is, if anything, on theme.
 */
import type { CaptainRow } from "./index";

export const HORROR_CAPTAINS: CaptainRow[] = [
  {
    match: "jigsaw",
    fx: {
      k: "command", atk: 1, def: 1, grace: 2, swap: 3,
      doom: { def: -1 },
      label: "The rules were explained",
      note:
        "Three substitutions, two planes off the gap, and the other line starts a point of " +
        "health down. The best captain on the board and the only one who has never once " +
        "touched anybody: John Kramer builds the room, writes the rules, records the tape " +
        "and dies of cancer in act two, and the machine goes on running for six more " +
        "films. Nobody in the game is further from the fighting or more responsible for it.",
    },
  },
  {
    match: "final girl",
    fx: {
      k: "command", atk: 0, def: 0,
      when: "alone", then: { atk: 6, def: 5 },
      label: "The last one",
      note:
        "Nothing. No attack, no health, no substitutions, no grace — the worst captaincy " +
        "in the game for as long as anybody else on your side is alive. The moment they " +
        "are not, she takes the field at +6/+5 and the genre changes direction. Everyone " +
        "on this board has spent forty years learning that the useful thing to do with the " +
        "quiet one is to leave her until last, and none of them have ever managed it.",
    },
  },
  {
    match: "herbert west",
    fx: {
      k: "command", atk: 0, def: 0, raise: 3,
      when: "kill", then: { atk: 1 },
      label: "The reagent works",
      note:
        "Three of your dead back on their feet and the line improves with every body it " +
        "makes, on a stat line of exactly zero. It works. That was never the question. " +
        "The question was whether anything he brought back should have been, and West has " +
        "declined to engage with it since the cat, which he also brought back, twice, and " +
        "then had to do something about.",
    },
  },
  {
    match: "the thing",
    fx: {
      k: "command", atk: 1, def: 1, raise: 2,
      doom: { def: -1 },
      label: "It was one of them by then",
      note:
        "Two of your fallen come back and the enemy line opens a point of health short. " +
        "The raise is the honest reading of the creature: it does not heal your dead, it " +
        "wears them, and what walks back into your line is the right shape, the right " +
        "voice and the right blood type. Nobody at the outpost worked out who was still " +
        "themselves. The film declines to tell you either.",
    },
  },
  {
    match: "alien queen",
    fx: {
      k: "command", atk: 2, def: 2, raise: 2,
      when: "allyDown", then: { def: 1 },
      label: "There are always more",
      note:
        "+2/+2, two of your dead back up, and the line hardens every time one falls. She " +
        "is the only villain on this board who reproduces on an industrial schedule, which " +
        "makes her the cheapest resurrection in the game to justify — she is not raising " +
        "anybody, she is producing a replacement. Also the only one who has ever lost a " +
        "fight to a forklift.",
    },
  },
  {
    match: "michael myers",
    fx: {
      k: "command", atk: 1, def: 2, raise: 1,
      when: "round", then: { atk: 1 },
      label: "Does not stop, does not hurry",
      note:
        "+1/+2, one of your fallen returned, and a point of attack to the whole line every " +
        "single round with no ceiling on it. Nothing here is fast and nothing here is " +
        "clever. He has been shot, burned, decapitated and buried, and the total effect on " +
        "his schedule has been a delay. Draft him for round nine.",
    },
  },
  {
    match: "freddy krueger",
    fx: {
      k: "command", atk: 2, def: 0, grace: 2,
      doom: { def: -1 },
      label: "You are on his ground",
      note:
        "Two planes of any gap stop counting, which is the whole trick and the reason the " +
        "gap exists in the first place. Freddy cannot lose a fight he chose the location " +
        "of, and he chooses all of them, because everyone in both lines eventually has to " +
        "sleep. Beat him and he is a man with a glove. Meet him on his ground and the " +
        "walls are a suggestion.",
    },
  },
  {
    match: "pennywise",
    fx: {
      k: "command", atk: 2, def: 1,
      when: "allyDown", then: { atk: 2 },
      label: "It salts the meat",
      note:
        "+2/+1 and another +2 attack to everyone still standing every time one of yours " +
        "goes down, uncapped. It is not a clown and does not particularly enjoy being one; " +
        "the clown is a delivery mechanism. It wants the line frightened before it eats, " +
        "and every casualty on your side makes the rest of them better at exactly the " +
        "thing it feeds on.",
    },
  },
  {
    match: "dracula",
    fx: {
      k: "command", atk: 2, def: 2, grace: 1, swap: 1, lends: "mend",
      label: "The oldest arrangement in the genre",
      note:
        "+2/+2, a plane off the gap, and every kill your line takes puts life back into " +
        "you. Dracula is the first entry in this whole catalogue and the only one with " +
        "manners: he is invited in, he is hospitable, he keeps to terms, and every single " +
        "monster printed after him is a variation on the argument he started in 1897.",
    },
  },
];
