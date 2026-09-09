/**
 * Supernatural captains.
 *
 * The premise of this board is two men in a car who have killed most of the
 * things above them on it. Death, the Devil, four archangels, the Darkness and
 * God's own editor are all printed here, and all of them have at some point
 * lost an argument to a high-school dropout with a shotgun and a fake FBI
 * badge. So this file is deliberately the game's densest cluster of `raise`:
 * the board's thesis is not that the Winchesters are strong, it is that they
 * will not stay down, and neither will anybody they like.
 *
 * The second thesis is the car, which is why the car is a captain.
 *
 * OWNERSHIP. Fifteen of these people are also printed on the `cw` board,
 * which is where the show aired. This file owns all of them; `cw.ts`
 * deliberately writes none. Dean commands the same way whichever pack he came
 * out of, and a Dean who did not would be a bug wearing a leather jacket.
 *
 * COLLISION NOTES.
 *
 *   michael     NOT captained, which is a real loss — the archangel is one of
 *               the four best cards on the board. The fragment reaches Michael
 *               Myers on the horror board, and there is no longer form to
 *               lengthen it to: the card is printed as "Michael". An archangel
 *               and a man in a Shatner mask giving the same orders is a joke
 *               the game only gets to make once, and it is not worth it.
 *   amara       NOT captained, same shape of problem. The Darkness shares her
 *               name with a nine-hundred-year-old human on the Vampire Diaries
 *               board and with this board's own "Chuck's Amara sigil", which
 *               is a drawing.
 *   death       NOT captained, and this one is nearly funny enough to keep.
 *               "death" is word-bounded, so it misses Deathstroke, but it does
 *               land squarely on the Death Star. Billie has the reaping
 *               portfolio here instead, and she is the better mechanic anyway.
 *   ash         NOT captained. Reaches this board's own "Ash's chainsaw hand"
 *               over on horror, which belongs to a different man entirely.
 *   *_winchester Every Winchester is written in full. "winchester" alone would
 *               hand Dean's captaincy to Sam, Mary and John, and John
 *               Winchester giving orders to his sons is a thing the show spent
 *               fifteen seasons in therapy about.
 *   jack kline  Full name, so it does not reach Handsome Jack on `bosses`.
 */
import type { CaptainRow } from "./index";

export const SPN_CAPTAINS: CaptainRow[] = [
  {
    match: "dean winchester",
    fx: {
      k: "command", atk: 2, def: 1, raise: 2,
      when: "allyDown", then: { atk: 2 },
      label: "Nobody stays dead in this family",
      note:
        "+2/+1, two of your fallen back on their feet, and everybody left gets +2 attack " +
        "every time one goes down. The obvious money card on the board and the correct " +
        "one: Dean has personally died over a hundred times, gone to Hell, come back, and " +
        "sold his soul to undo a death that had already happened. He has no powers. He has " +
        "a shotgun full of salt and an unshakeable refusal to accept an outcome.",
    },
  },
  {
    match: "sam winchester",
    fx: {
      k: "command", atk: 1, def: 1, grace: 2, swap: 2,
      label: "He looked it up",
      note:
        "Two planes of any gap stop counting and you get two substitutions, which is the " +
        "whole difference between the brothers rendered as numbers. Sam is the reason the " +
        "car has a library in it. Whatever is standing over your line, he has read the " +
        "Latin, found the lore, worked out what it is allergic to, and is telling the man " +
        "in front which of the three shotguns to pick up.",
    },
  },
  {
    match: "bobby singer",
    fx: {
      k: "command", atk: 2, def: 2, swap: 2, raise: 1,
      label: "Family don't end with blood",
      note:
        "+2/+2, two substitutions and one of your dead back up, from a man in a trucker " +
        "cap standing in a scrapyard. Bobby is the switchboard for every hunter in North " +
        "America, runs six phones under six fake federal agencies, and is the closest " +
        "thing to a functioning adult the series has. He will also call your best card an " +
        "idjit and be right about it.",
    },
  },
  {
    match: "castiel",
    fx: {
      k: "command", atk: 0, def: 2, raise: 2, lends: "ward",
      label: "Gripped you tight and raised you from perdition",
      note:
        "Two of your fallen return and the whole line takes less from every blow, for " +
        "almost no offence at all. Cas's first act in the series is walking into Hell and " +
        "carrying a man out of it, and nine years of increasingly catastrophic decisions " +
        "later that is still the only thing he is unambiguously good at. He does not " +
        "understand the fight. He understands who is not getting left in it.",
    },
  },
  {
    match: "crowley",
    fx: {
      k: "command", atk: 1, def: 1, swap: 3,
      doom: { atk: -1 },
      label: "Everything is a deal",
      note:
        "Three substitutions and the other side comes out a point of attack short. The " +
        "King of Hell was a Scottish tailor who worked his way up through crossroads " +
        "paperwork, and his entire method is knowing what everybody in both lines " +
        "privately wants. He is never the strongest thing in the room and he has never " +
        "once been the one who dies in it.",
    },
  },
  {
    match: "rowena macleod",
    fx: {
      k: "command", atk: 1, def: 0, raise: 3,
      doom: { atk: -1 },
      label: "The resurrection spell",
      note:
        "Three of your dead get back up — the highest raise in the game — and the enemy " +
        "line opens a point down. Rowena is a three-hundred-year-old witch who was thrown " +
        "out of her coven, murdered by roughly everyone she has met, and holds the only " +
        "working resurrection in the book. She has used it on herself more than once, out " +
        "of spite, which is a legitimate magical school.",
    },
  },
  {
    match: "chuck shurley",
    fx: {
      k: "command", atk: 3, def: 2,
      when: "allyDown", then: { atk: -1 },
      label: "He only cares about the ending",
      note:
        "+3/+2, the biggest flat line on the board, and every time one of yours falls the " +
        "survivors get one point WORSE. That is not a typo and it is not a nerf. Chuck is " +
        "God and God is a mid-list writer who kills people for pacing, and the moment your " +
        "team starts losing he decides that is the more interesting story and leans into " +
        "it. No substitutions, no grace, no resurrections. He does not do rewrites for you.",
    },
  },
  {
    match: "billie",
    fx: {
      k: "command", atk: 0, def: 1, grace: 1,
      doom: { atk: -1, def: -2 },
      label: "Everybody has a book",
      note:
        "The enemy line opens at −1/−2 and yours gets a plane off the gap and nothing " +
        "else. In particular it gets no resurrections, on a board where seven other " +
        "captains hand them out like napkins, and that is the entire character. Billie " +
        "inherited a library containing the exact circumstances of everyone's death and " +
        "has strong opinions about the Winchesters' overdraft.",
    },
  },
  {
    match: "jack kline",
    fx: {
      k: "command", atk: 1, def: 0,
      when: "alone", then: { atk: 5, def: 3 },
      label: "Nobody taught him a limit",
      note:
        "One point of attack and nothing else for as long as anyone else on your side is " +
        "standing, then +5/+3 the moment they are not. Jack is Lucifer's son, was three " +
        "days old when he started, and has the power of an archangel with the impulse " +
        "control of a toddler who wants very badly to be liked. Everything terrible he has " +
        "done, he did while trying to help.",
    },
  },
  {
    match: "the impala",
    fx: {
      k: "command", atk: 1, def: 2, swap: 2, raise: 1,
      label: "Baby",
      note:
        "A 1967 Chevrolet Impala is a legitimate captain on this board and will out-draft " +
        "several angels. +1/+2, two substitutions and one of your dead back up, because " +
        "everything this show is about happens inside it: the weapons are in the boot, the " +
        "research is on the back seat, and it has been destroyed twice, rebuilt by hand " +
        "both times, and is the only home either of them has ever had.",
    },
  },
];
