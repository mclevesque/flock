/**
 * The Vampire Diaries captains.
 *
 * A board where death is a scheduling problem. Nobody on it has stayed dead,
 * most of them have been the villain and the love interest inside the same
 * season, and the family at the top of it has spent a thousand years putting
 * each other in boxes. So the commands here lean on `raise` and on triggers
 * that fire when your own side starts dying, because that is the only weather
 * this show has ever had.
 *
 * OWNERSHIP. Fourteen of these people are also printed on the `cw` board,
 * which is correct — The CW aired them. This file owns every one of them:
 * Klaus, Elijah, Katherine, Silas, Damon, Bonnie and Alaric captain the same
 * way whichever pack you opened them from, which is the only defensible
 * answer. The CW file deliberately writes nobody from Mystic Falls.
 *
 * COLLISION NOTES.
 *
 *   mikael          Safe on its own, which is not obvious. "Mikael" sits
 *                   inside "Mikaelson" five times on this board, but the
 *                   matcher stops at a letter boundary and "Mikaelson" has an
 *                   "s" where the fragment ends. The father does not get to
 *                   command his children by prefix. He has tried everything
 *                   else.
 *   *_salvatore     Damon is written as "damon salvatore" and not "damon",
 *                   and never as "salvatore", which would hand Stefan, Lily
 *                   and Zach the same captaincy. Zach Salvatore is a man who
 *                   was killed off-screen in episode one for being in a house.
 *   katherine       Written in full: "katherine pierce". Nadia Petrova is her
 *                   daughter and shares neither name, so nothing else moves.
 *   amara           NOT captained, and it hurt. The fragment lands on the
 *                   Supernatural board's Amara — a primordial darkness older
 *                   than God — as well as on this one's, who is a nine-hundred
 *                   year-old woman who wants to be allowed to die. Two cards
 *                   with the same name and nothing else in common, so neither
 *                   gets a command.
 *   pearl           NOT captained, same reason. This board's Pearl runs an
 *                   apothecary. The horror board's Pearl runs a farm and an
 *                   axe.
 *
 * KNOWN, AND NOT FIXABLE FROM HERE. Vincent Griffith picks up the Berserk
 * captaincy "The Band of the Hawk", because "griffith" is written into the
 * core registry in battle.ts and the core always resolves before any board
 * file. Vincent is a New Orleans witch who spends the series refusing to lead
 * anybody. The fix belongs in battle.ts, not here.
 */
import type { CaptainRow } from "./index";

export const TVD_CAPTAINS: CaptainRow[] = [
  {
    match: "klaus mikaelson",
    fx: {
      k: "command", atk: 3, def: 0, raise: 2,
      when: "kill", then: { atk: 1 },
      label: "The sire line",
      note:
        "+3 attack, nothing for health, two of your dead back on their feet and the line " +
        "gets angrier with every body. The best card on the board and the worst person on " +
        "it, which the show would like you to know is the same fact. Every vampire he has " +
        "ever made is still technically his, and he has spent a thousand years proving it " +
        "by daggering the ones who disagreed and keeping them in the attic.",
    },
  },
  {
    match: "elijah mikaelson",
    fx: {
      k: "command", atk: 1, def: 3, grace: 1, lends: "ward",
      label: "I will always...",
      note:
        "+1/+3 and every blow that reaches the line reaches it lighter. Elijah is the only " +
        "Original who has ever kept a promise, and the whole board runs on the fact that " +
        "his brother knows it and uses it. He will hold the line for people he has met " +
        "twice. Somebody should have stopped him.",
    },
  },
  {
    // Written before the rest of the family for reading order rather than for
    // the matcher — see the header. He would insist on it anyway.
    match: "mikael",
    fx: {
      k: "command", atk: 2, def: -1,
      doom: { atk: -2, def: -2 },
      label: "The Destroyer",
      note:
        "The enemy line opens at −2/−2 and yours takes a point of health off the top to " +
        "pay for it. Mikael is the reason vampires on this board are afraid of anything, " +
        "and the reason is that he hunts them specifically, for sport, including the five " +
        "he raised. Draft him for what he does to the other side and do not stand too " +
        "close.",
    },
  },
  {
    match: "esther mikaelson",
    fx: {
      k: "command", atk: 0, def: 2, raise: 1,
      doom: { atk: -2, def: -1 },
      label: "She made them, she can unmake them",
      note:
        "Almost nothing for your attack, −2/−1 to theirs, and one of your fallen back up. " +
        "Esther invented vampirism in an afternoon to keep her children alive and has spent " +
        "every century since trying to take it back. She is the only witch on the board who " +
        "has already solved the hardest problem on it, twice, in opposite directions.",
    },
  },
  {
    match: "katherine pierce",
    fx: {
      k: "command", atk: 1, def: 0, swap: 4,
      label: "Five hundred years of not being there",
      note:
        "Four substitutions — nobody in the game has more — and a single point of attack " +
        "to show for it. Katerina Petrova has been running since 1492 and has never once " +
        "lost. She has also never once won, fought, held ground or stayed in a room, and " +
        "she will pull your best card out of a bad matchup with the total, untroubled " +
        "confidence of a woman who has done this to actual gods.",
    },
  },
  {
    match: "bonnie bennett",
    fx: {
      k: "command", atk: 0, def: 1, grace: 1, raise: 2,
      label: "Expression, and what it costs",
      note:
        "Two of your dead get up and the line fights a plane closer, for almost no stats. " +
        "Bonnie is the most powerful thing on this board and the only one who is charged " +
        "for it. Every resurrection here has a bill attached and the show has never once " +
        "sent it to the person who asked for the favour.",
    },
  },
  {
    match: "silas",
    fx: {
      k: "command", atk: 0, def: 0, grace: 2, swap: 2,
      doom: { atk: -1 },
      label: "You are seeing what he wants",
      note:
        "Two planes of any gap stop counting, two substitutions, and not one point of " +
        "attack or health anywhere. The world's first immortal has never had a fair fight " +
        "because he has never had a fight — he shows you your dead girlfriend, waits, and " +
        "walks past. Two thousand years and the only thing he has ever actually wanted is " +
        "to stop.",
    },
  },
  {
    match: "damon salvatore",
    fx: {
      k: "command", atk: 3, def: -2,
      when: "alone", then: { atk: 3, def: 3 },
      label: "The bad brother, allegedly",
      note:
        "+3 attack, −2 health, and if it comes down to him alone he picks up another " +
        "+3/+3 and stops apologising. Damon leads exactly one way: forward, immediately, " +
        "having thought about it for none of the seconds available. It works far more " +
        "often than it has any right to and everybody standing near him pays the health.",
    },
  },
  {
    match: "alaric saltzman",
    fx: {
      k: "command", atk: 1, def: 2, raise: 1,
      when: "round", then: { def: 1 },
      label: "The ring only works on the supernatural",
      note:
        "+1/+2, a point of health back to the line every round, and one of your fallen " +
        "returned. Alaric is a history teacher who has died more often than most of the " +
        "vampires on this board and been buried by fewer people. The ring brings him back " +
        "from anything with fangs and precisely nothing else, which is the single most " +
        "load-bearing piece of small print in Mystic Falls.",
    },
  },
  {
    match: "marcel gerard",
    fx: {
      k: "command", atk: 2, def: 1, grace: 1, swap: 1,
      label: "The King of New Orleans",
      note:
        "+2/+1 and the line fights a plane closer, which is a captain's captaincy and not " +
        "a monster's. Marcel took the city off Klaus Mikaelson without being older, " +
        "stronger or better connected, by the entirely unfamiliar method of being liked " +
        "and running the place well. Klaus has still not got over it.",
    },
  },
];
