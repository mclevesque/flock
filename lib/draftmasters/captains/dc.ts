/**
 * DC captains.
 *
 * Batman and Luthor are in the core registry already, and they set the shape:
 * on this board the man with the plan is priced above the man with the powers.
 * These eight go further in both directions. Darkseid and the Joker are the
 * two ends of what a villain captain can be — one turns your opponent down, the
 * other turns his own line up and does not care what it costs them. Alfred and
 * Oracle are the argument that the two best captains in Gotham have never once
 * been in the fight.
 */
import type { CaptainRow } from "./index";

export const DC_CAPTAINS: CaptainRow[] = [
  {
    match: "darkseid",
    fx: {
      k: "command", atk: 2, def: 1, doom: { atk: -2, def: -2 },
      label: "Anti-Life",
      note:
        "The other line starts at −2/−2, and nothing on it gets a roll to resist. " +
        "Darkseid's entire thesis is that free will is a solvable equation, and an " +
        "ability that reaches across the field and turns five strangers down is the " +
        "only shape that argument has ever taken. He gives his own line a modest " +
        "+2/+1 and no substitutions, because he does not adjust and neither do they.",
    },
  },
  {
    match: "oracle",
    fx: {
      k: "command", atk: 1, def: 1, grace: 1, swap: 3, lends: "first",
      label: "Eyes on everything",
      note:
        "The line moves first, fights a plane closer, and gets pulled out of three " +
        "losing matchups before any of them turn lethal. Barbara Gordon has not " +
        "thrown a punch in years and runs more of this fight than anybody standing " +
        "in it, which the rest of the board keeps failing to price correctly.",
    },
  },
  {
    match: "martian manhunter",
    fx: {
      k: "command", atk: 2, def: 2, grace: 1, swap: 2, lends: "first",
      label: "The one who holds it together",
      note:
        "+2/+2, the line moves first, the plane gap shortens, and two substitutions " +
        "on top. The most complete captain on the board and the least argued about " +
        "— which is also true of J'onn in every version of the League anybody has " +
        "ever written, and is roughly the whole tragedy of him.",
    },
  },
  {
    match: "brainiac", not: ["brainiac 5"],
    fx: {
      k: "command", atk: 1, def: 1, grace: 1, when: "kill", then: { atk: 1, def: 1 },
      label: "Added to the collection",
      note:
        "Every kill the line takes makes everyone still standing permanently " +
        "better, because Brainiac removes something from each body and redistributes " +
        "it. He is not fighting a battle. He is doing fieldwork, and your team is " +
        "the equipment he brought.",
    },
  },
  {
    match: "the joker",
    fx: {
      k: "command", atk: 4, def: -2, when: "allyDown", then: { atk: 2 },
      label: "Introduce a little anarchy",
      note:
        "+4 attack, −2 health, and two more attack for the survivors every time one " +
        "of yours dies. The highest ceiling of any captain in the game, bolted to " +
        "the worst possible person to have standing behind you. Nobody on this line " +
        "is being led. They are being encouraged, which is a different thing and " +
        "hits considerably harder.",
    },
  },
  {
    match: "ra's al ghul",
    fx: {
      k: "command", atk: 2, def: 1, swap: 1, raise: 2,
      label: "The Lazarus Pit",
      note:
        "Two of your dead come back, and they come back wrong, and Ra's has already " +
        "accounted for that. He has been running this operation for six centuries on " +
        "exactly this arithmetic: bodies are renewable, patience is the expensive " +
        "part, and he has plenty.",
    },
  },
  {
    match: "poison ivy",
    fx: {
      k: "command", atk: 1, def: 2, when: "round", then: { heal: 1 },
      label: "The Green",
      note:
        "One health back to the whole line every round, quietly, for as long as she " +
        "is behind it. It is the smallest trigger any captain has and it never " +
        "stops, which is the only thing that matters against anything that wins by " +
        "attrition. Ivy is not on your side. The ground is, and she got to it first.",
    },
  },
  {
    match: "alfred",
    fx: {
      k: "command", atk: 1, def: 1, when: "allyDown", then: { heal: 3 },
      label: "I'll see to it, sir",
      note:
        "Three health back to everyone still up, every time one of yours falls. " +
        "Alfred has stitched most of this line together at three in the morning at " +
        "one point or another and remembers which of them lies about it. The only " +
        "captain on the board whose entire ability is aftercare, and on a long fight " +
        "it beats most of the ones with swords.",
    },
  },
];
