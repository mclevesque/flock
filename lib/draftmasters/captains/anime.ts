/**
 * Anime captains.
 *
 * The board where the power-scaling argument finally has to pay rent. Every
 * table on this board wants to promote whoever hits hardest, and on this board
 * specifically that is the losing play: the fights that actually turn in the
 * source material turn because somebody watched one exchange and understood it,
 * or because somebody died in front of the wrong person.
 *
 * So the commands here are built around `allyDown` more than anywhere else.
 * Anime is a genre with one recurring plot beat — the friend goes down, and the
 * survivor becomes a different card — and a captain who converts that into
 * numbers is the captain who wins the tournament.
 *
 * Griffith, Vegeta and Light Yagami are already written in `battle.ts` and are
 * deliberately not repeated here.
 */
import type { CaptainRow } from "./index";

export const ANIME_CAPTAINS: CaptainRow[] = [
  {
    match: "madara uchiha",
    fx: {
      k: "command", atk: 3, def: 2, grace: 1, swap: 1,
      when: "allyDown", then: { atk: 2 },
      label: "Wake up to reality",
      note:
        "The best card on this board and he never throws a punch for you. +3/+2 and the " +
        "line fights a plane closer, and every time one of yours goes down the survivors " +
        "gain two more attack, because Madara has been treating your team as a resource " +
        "since before the draft. He fought five kage at once for fun. Standing behind " +
        "four people and telling them where the war actually is costs him nothing and " +
        "costs you the fourth-highest bid at the table.",
    },
  },
  {
    match: "gojo",
    fx: {
      k: "command", atk: 1, def: 3, grace: 2, swap: 0,
      when: "round", then: { def: 1 },
      label: "Throughout heaven and earth",
      note:
        "Two planes of any gap above your line stop counting, which is the largest number " +
        "in the game and belongs to the one man arrogant enough to hand it out. Note the " +
        "zero substitutions: Gojo does not pull anybody. He believes you will figure it " +
        "out, because he did, and he has been an insufferable teacher about it ever since.",
    },
  },
  {
    match: "makima",
    fx: {
      k: "command", atk: 1, def: 2, swap: 3,
      doom: { atk: -2, def: -1 },
      label: "Control",
      note:
        "The enemy line comes out at −2/−1 and stays there, and she moves your people " +
        "around three times like the dogs she has decided they are. She has never once " +
        "raised her voice at anybody. That is the entire point of her and the reason she " +
        "is worth more than most of the tier fives above her.",
    },
  },
  {
    match: "whitebeard",
    fx: {
      k: "command", atk: 2, def: 2, raise: 2,
      when: "allyDown", then: { atk: 2 },
      label: "My sons",
      note:
        "+2/+2, two of your fallen get back up, and the ones still standing hit harder " +
        "for every one that fell. He drafted a crew of people nobody else wanted and " +
        "never called them anything but family, and the rules here are just that " +
        "sentence with numbers in it.",
    },
  },
  { match: "shanks", fx: { k: "command", atk: 1, def: 1, swap: 1, doom: { atk: -3 }, label: "Conqueror's haki", note: "The enemy line loses three attack the moment he takes the chair. He has one arm, has not drawn a sword on screen in twenty-five years, and ends more fights than anyone on this board by walking into them." } },
  { match: "kakashi", fx: { k: "command", atk: 1, def: 1, swap: 3, when: "kill", then: { atk: 1 }, label: "Copy Ninja", note: "Three substitutions — the most on the board — and the line gets a point of attack every time it takes something down, because he has already worked out what did it and told everybody else. A thousand techniques, none of them his." } },
  { match: "itachi", fx: { k: "command", atk: 2, def: 1, grace: 1, doom: { atk: -2 }, label: "Tsukuyomi", note: "The enemy line spends three days somewhere unpleasant, comes back one second later at −2 attack, and cannot explain to anybody what happened. He is doing this while dying of a disease and lying to his brother about why." } },
  { match: "meruem", fx: { k: "command", atk: 2, def: 1, when: "kill", then: { atk: 1, def: 1 }, label: "Learns", note: "+2/+1, and the line gets better every time it kills, permanently, for the rest of the battle. He learned three board games well enough to beat world champions in under a month. He is doing that to your team now, in real time, and it is only round two." } },
  { match: "hisoka", fx: { k: "command", atk: 3, def: -1, grace: 1, label: "Only if it stays interesting", note: "+3 attack and −1 health to your entire line, plus a plane of grace. He is not helping you win. He is arranging the most entertaining possible version of this fight and has correctly judged that a dangerous team makes better viewing than a safe one." } },
  // Listed for her own sake, and because one of her variants hands her a
  // weather stick called Zeus, which was quietly getting her captained by the
  // king of the Greek gods.
  { match: "nami", fx: { k: "command", atk: 1, def: 1, grace: 1, swap: 3, label: "Somebody has to think", note: "Three substitutions and a plane of grace from a card that cannot fight at all. She is the navigator, the treasurer and the only member of that crew who has ever read a chart, and every plan they have survived was hers with somebody else's name on it." } },
  { match: "usopp", fx: { k: "command", atk: 2, def: 1, swap: 2, when: "allyDown", then: { atk: 2 }, label: "Captain Usopp, of eight thousand men", note: "A liar and a coward with a slingshot, and the whole crew fights at +2/+1 behind him. Every word he says about his own record is false and every word he says about theirs lands. When one of them drops, the rest go up two attack, which is the only kind of courage he has ever actually had." } },
];
