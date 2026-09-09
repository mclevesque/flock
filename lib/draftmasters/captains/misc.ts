/**
 * Captains for the five small boards: Berserk, TMNT, Power Rangers, The
 * Powerpuff Girls and Invincible.
 *
 * Kept in one file because none of them is big enough to be worth its own,
 * and because they turn out to share a thesis. Every one of these five is a
 * franchise about a small fixed team taking orders from somebody who is not
 * in the fight — a rat, a face in a tube, a professor, a man with a headset,
 * or a demon in a crab suit. The genre these boards belong to is not "action".
 * It is "management".
 *
 * ALREADY CAPTAINED ELSEWHERE, so deliberately absent here:
 *
 *   Griffith   core registry, battle.ts — "The Band of the Hawk".
 *   Splinter   core registry, battle.ts — "My sons".
 *   Zordon     core registry, battle.ts — "It's morphin time".
 *
 * All three are the obvious first pick on their board and all three were
 * written before this file existed, which is why Berserk, TMNT and Power
 * Rangers get fewer new commands than their card counts would suggest.
 *
 * COLLISION NOTES. All of these are short, and all were run against every
 * card name in all twenty-six packs before being committed:
 *
 *   void       Berserk's is the only card in the game containing the word.
 *              Genuinely surprising for a four-letter noun; verified twice.
 *   him        Unique, and only because the matcher stops at letter
 *              boundaries — otherwise the most dangerous fragment in this
 *              repository. There is no longer form available: the character's
 *              full legal name is HIM.
 *   robot      Unique. Invincible's Robot is the only card so named; the trait
 *              system has its own separate list of robot words and does not
 *              interact with this.
 *   april o'neil  Full name, with the apostrophe, so it cannot reach Camille
 *              O'Connell on the Vampire Diaries board.
 *   tommy oliver  Full name. "oliver" alone reaches Oliver Queen on `cw` and
 *              Oliver Grayson on `invincible`, and putting the Green Ranger in
 *              charge of the Arrowverse is a bit.
 *   ms. bellum  Written with the honorific, because "bellum" on its own is a
 *              Latin word and this game contains a Greek board.
 *   blossom    NOT captained. The Powerpuff leader shares her fragment with
 *              Cheryl Blossom of Riverdale, and the two of them running the
 *              same line would end Townsville.
 *   thunder    NOT captained, from the other direction — see `cw.ts`. The
 *              Thunder Megazord is safe because nobody claimed the word.
 */
import type { CaptainRow } from "./index";

export const MISC_CAPTAINS: CaptainRow[] = [
  // ── Berserk ──────────────────────────────────────────────────────────────
  {
    match: "void",
    fx: {
      k: "command", atk: 0, def: 0,
      doom: { atk: -3, def: -2 },
      label: "Causality",
      note:
        "Your line receives nothing at all. The other one opens at −3/−2, which is the " +
        "largest single tax in the game. Void does not fight, has not moved in five " +
        "hundred years, and does not regard anything happening on the board as an event " +
        "so much as a scheduled consequence. Whatever the other team thought they had " +
        "decided was arranged before the draft.",
    },
  },
  {
    match: "skull knight",
    fx: {
      k: "command", atk: 2, def: 2, grace: 1, lends: "first",
      label: "Arrives at the worst moment, for them",
      note:
        "+2/+2, a plane off the gap and the line moves first. The Skull Knight has been " +
        "fighting the same five entities for a thousand years, has never once won, and " +
        "has never once been late. He turns up exactly when the people he is not " +
        "particularly fond of are about to die, says something unhelpful, and leaves.",
    },
  },
  {
    match: "schierke",
    fx: {
      k: "command", atk: 0, def: 2, grace: 2, swap: 1,
      label: "The only one doing the reading",
      note:
        "Two planes of any gap stop counting, on a card with no attack. Schierke is twelve, " +
        "weighs very little, and is the sole member of the party who knows what the things " +
        "they are fighting actually are, how they are bound, and which of the four large " +
        "men should be standing where. The large men have learned to listen.",
    },
  },
  {
    match: "rickert",
    fx: {
      k: "command", atk: 1, def: 1,
      when: "alone", then: { atk: 4, def: 2 },
      label: "He slapped him",
      note:
        "Ordinary until there is nobody left, then +4/+2. Rickert is the smallest, " +
        "youngest and least dangerous person on this board, and he is on this list for one " +
        "reason: in a room containing a resurrected god-emperor and everyone too " +
        "frightened to speak, he walked up and hit him across the face. Nothing else on " +
        "the board has done that.",
    },
  },

  // ── Teenage Mutant Ninja Turtles ─────────────────────────────────────────
  {
    match: "krang",
    fx: {
      k: "command", atk: 0, def: 1, grace: 2, swap: 2, raise: 2,
      label: "A brain in a robot's stomach",
      note:
        "Two planes off the gap, two substitutions and two of your dead back up, from a " +
        "card with zero attack. Krang is a disembodied brain from Dimension X being driven " +
        "around inside an android's abdomen, which makes him the most literal captain in " +
        "the game: he has never once been the thing doing the fighting and has always been " +
        "the thing deciding it.",
    },
  },
  {
    match: "shredder",
    fx: {
      k: "command", atk: 3, def: 1, swap: 2,
      label: "The Foot is not four people",
      note:
        "+3/+1 and two substitutions, because he can afford them. Oroku Saki's advantage " +
        "over the other side of this board has never been skill — Splinter trained him " +
        "too — it is that he arrived with an organisation and they arrived with a van. " +
        "Every fight he loses costs him men he can replace by Tuesday.",
    },
  },
  {
    match: "april o'neil",
    fx: {
      k: "command", atk: 1, def: 1, swap: 3,
      label: "Somebody has to book the room",
      note:
        "Three substitutions off a completely unremarkable stat line. April is a " +
        "journalist with no training who is somehow the only member of this operation with " +
        "a phone, an address and the ability to enter a building through the door. Every " +
        "plan the turtles have ever executed was one she made a call about first.",
    },
  },

  // ── Power Rangers ────────────────────────────────────────────────────────
  {
    match: "rita repulsa",
    fx: {
      k: "command", atk: 1, def: 1, raise: 3,
      doom: { atk: -1 },
      label: "Make my monster grow",
      note:
        "Three of your fallen get back on their feet — the top of the scale — and the " +
        "enemy line opens a point of attack short. This is the least invented captaincy in " +
        "the entire game. Rita's monster loses, Rita throws her wand, the monster returns " +
        "immediately at ten times the size, and she did this every single week for three " +
        "years without anybody on either side remarking on it.",
    },
  },
  {
    match: "lord zedd",
    fx: {
      k: "command", atk: 3, def: 1,
      doom: { def: -1 },
      label: "He fired her",
      note:
        "+3/+1 and a point of health off the other line. Zedd's arrival is the only " +
        "genuine escalation the franchise has ever managed: he turned up, reviewed Rita's " +
        "performance, sealed her in the space dumpster she came out of, and started " +
        "building monsters that actually worked. He is a skinless man with a staff and he " +
        "is the only villain here who has ever frightened anyone.",
    },
  },
  {
    match: "tommy oliver",
    fx: {
      k: "command", atk: 2, def: 2, grace: 1, swap: 1,
      label: "Five colours, one man",
      note:
        "+2/+2 and a plane off the gap. Tommy has been Green, White, Red, Black and a " +
        "doctor, has led three separate teams, and is the only ranger in the history of " +
        "the show who has been on the other side and come back. Whatever your line is " +
        "facing, there is a decent chance he has worn it.",
    },
  },

  // ── The Powerpuff Girls ──────────────────────────────────────────────────
  {
    match: "him",
    fx: {
      k: "command", atk: 1, def: 1, grace: 2,
      doom: { atk: -2, def: -1 },
      label: "Not his real name",
      note:
        "Two planes off the gap for yours and −2/−1 for theirs, which on a children's " +
        "cartoon board is an unreasonable amount of captaincy. HIM has never thrown a " +
        "punch in any episode. He arranges things — a rumour, a doll, a bad day, an " +
        "argument between three sisters — and then watches from somewhere slightly off " +
        "screen with his voice doing two pitches at once.",
    },
  },
  {
    match: "mojo jojo",
    fx: {
      k: "command", atk: 2, def: 1, grace: 1, swap: 2,
      label: "Which is to say, a plan",
      note:
        "+2/+1, a plane off the gap and two substitutions. Mojo Jojo has the highest " +
        "strategic ceiling on the board and the lowest execution floor, because every one " +
        "of his plans is announced in full, at length, with each clause restated in " +
        "slightly different words, before it begins, which is to say before it starts, " +
        "which is to say prior to its commencement.",
    },
  },
  {
    match: "ms. bellum",
    fx: {
      k: "command", atk: 2, def: 2, swap: 3,
      label: "Nobody has seen her face",
      note:
        "+2/+2 and three substitutions, the most complete captaincy on this board. Sara " +
        "Bellum runs the city of Townsville: she writes what the Mayor says, decides when " +
        "the girls are called, and handles every crisis the show does not have time for. " +
        "The camera has never once been above her shoulders and it has never once " +
        "mattered.",
    },
  },

  // ── Invincible ───────────────────────────────────────────────────────────
  {
    match: "cecil stedman",
    fx: {
      k: "command", atk: 1, def: 1, swap: 4, raise: 2,
      label: "He will trade any of you",
      note:
        "Four substitutions and two resurrections, from a short man with a scarred face " +
        "and an earpiece. Cecil has no powers and runs everyone who does, keeps a " +
        "teleporter on him at all times, and has already decided which of your cards is " +
        "acceptable to lose. He was right about the last four times as well, which is " +
        "exactly why nobody on his own side likes him.",
    },
  },
  {
    match: "omni-man",
    fx: {
      k: "command", atk: 4, def: 0,
      when: "kill", then: { atk: 1 },
      label: "Think, Mark",
      note:
        "+4 attack, nothing for health, and it climbs with every body. Nolan Grayson is " +
        "the strongest thing on the board and spent twenty years pretending the job was " +
        "protecting people, and the numbers here are the moment he stopped: everything " +
        "forward, nothing held back, no substitutions and no resurrections. He does not " +
        "believe your line will be there in five hundred years.",
    },
  },
  {
    match: "thragg",
    fx: {
      k: "command", atk: 3, def: 2,
      doom: { def: -1 },
      label: "Grand Regent",
      note:
        "+3/+2 and a point of health off the other line, which is a better all-round " +
        "captaincy than Omni-Man's and the entire argument between them. Thragg is what " +
        "the empire produces when it works: no doubts, no attachments, no twenty years " +
        "off in Illinois. He has never once been distracted and it has never once made him " +
        "more interesting.",
    },
  },
  {
    match: "robot",
    fx: {
      k: "command", atk: 0, def: 1, grace: 2, swap: 2,
      label: "He has never been in the body",
      note:
        "Two planes off the gap and two substitutions on a card with no attack. Rudolph " +
        "Conners has run every Teen Team operation from inside a drone he was never " +
        "physically present in — the actual man is a small, dying thing in a tank several " +
        "miles away — and the tactical work has always been the best in the book. The " +
        "problem has never been his planning.",
    },
  },
];
