/**
 * X-Men captains.
 *
 * The densest captain board in the game, and it should be: this is the one
 * franchise where the interesting question was never who wins the fight but
 * who is allowed to give the orders. Professor X is already in the core
 * registry. Everything after him is somebody who thinks he was wrong about it.
 *
 * Several of these also sit on the Marvel board, which is correct — they are
 * the same characters, and a Magneto who commands differently depending on
 * which pack you drafted him from would be a bug wearing a costume.
 */
import type { CaptainRow } from "./index";

export const XMEN_CAPTAINS: CaptainRow[] = [
  {
    match: "magneto",
    fx: {
      k: "command", atk: 2, def: 1, grace: 1, swap: 1,
      when: "allyDown", then: { atk: 2, def: 1 },
      label: "This is what they do to us",
      note:
        "The line opens at +2/+1 and takes another +2/+1 every single time one of " +
        "yours goes down, with no cap on it. Nothing else on the board converts a " +
        "casualty into an argument this efficiently, and that is not a joke at his " +
        "expense — it is the character, printed. He needs you to lose people. Draft " +
        "him knowing that, and do not be surprised by the fight you get.",
    },
  },
  {
    match: "cyclops",
    fx: {
      k: "command", atk: 1, def: 1, grace: 2, swap: 2, lends: "first",
      label: "Around the one eye",
      note:
        "Two planes of any gap stop counting and the line moves first. Everything " +
        "here is built around a single eye that never closes and never stops calling " +
        "it — where to stand, when to move, what is coming through the wall in four " +
        "seconds. Nobody enjoys taking the order. Nobody has ever had a better idea " +
        "at the time.",
    },
  },
  {
    match: "emma frost",
    fx: {
      k: "command", atk: 0, def: 1, grace: 2, swap: 2,
      label: "She is already in there",
      note:
        "Two planes off the gap on an almost non-existent stat line, which makes " +
        "her the purest grace captain in the game. Emma does not make anybody " +
        "stronger and would find the suggestion vulgar. She tells them, continuously " +
        "and without being asked, precisely what the thing opposite them intends to " +
        "do next.",
    },
  },
  {
    match: "mister sinister",
    fx: {
      k: "command", atk: 1, def: 0, swap: 1, raise: 3,
      label: "There were always spares",
      note:
        "Three of your fallen get back on their feet. Sinister has been growing " +
        "copies of half this board in a basement since the 1890s and is genuinely " +
        "puzzled that anyone finds it distasteful. The best raise in the game, " +
        "attached to the worst available reason for one.",
    },
  },
  {
    match: "moira mactaggert",
    fx: {
      k: "command", atk: 0, def: 2, grace: 1, swap: 3, raise: 1,
      label: "The tenth life",
      note:
        "Three substitutions, a plane off the gap and one of your dead back up — " +
        "from a tier-two human scientist with no powers, which pound for pound makes " +
        "her the most expensive thing on this board and the pick nobody at the table " +
        "sees coming. She has run this fight before. She has run it nine times. She " +
        "knows which of your picks dies first and she is not going to mention it.",
    },
  },
  {
    match: "kitty pryde",
    fx: {
      k: "command", atk: 1, def: 1, swap: 4,
      label: "Walks them out through the wall",
      note:
        "Four substitutions, more than any other captain in the game. Everyone else " +
        "pulls a card out of a losing matchup by shouting at it and hoping. Kitty " +
        "goes in and collects them. You still pay the usual price — the pulled card " +
        "goes to the back of the line — but the pull itself does not fail.",
    },
  },
  {
    match: "shadow king",
    fx: {
      k: "command", atk: 0, def: 0, doom: { atk: -2, def: -2 },
      label: "In the back of their heads",
      note:
        "Your line receives nothing. Not one point, not one substitution. The other " +
        "line starts at −2/−2 and cannot account for it. Amahl Farouk has never in " +
        "his existence been interested in helping anybody, and this is the only " +
        "captaincy in the game that is purely a tax on the opposition.",
    },
  },
  {
    match: "bastion",
    fx: {
      k: "command", atk: 0, def: 1, when: "kill", then: { atk: 1, def: 1 },
      label: "Learns from the body",
      note:
        "The whole line gets permanently better with every kill it takes. Bastion is " +
        "a Sentinel that taught itself to pass for a man, and its real weapon has " +
        "always been that it takes notes. Nothing that works on it works twice, and " +
        "it extends that courtesy to whoever it happens to be running.",
    },
  },
  {
    match: "master mold",
    fx: {
      k: "command", atk: 1, def: 2, swap: 1, raise: 2,
      label: "A production run",
      note:
        "Two of your dead get back up, because Master Mold's single function is that " +
        "there is always another one. It builds Sentinels. It does not distinguish " +
        "between manufacturing one and repairing yours, and nobody has ever managed " +
        "to explain the difference to it.",
    },
  },
  {
    match: "domino",
    fx: {
      k: "command", atk: 1, def: 1, swap: 2, when: "round", then: { heal: 1 },
      label: "It keeps going her way",
      note:
        "One health back to everyone, every round, for no stated reason. Neena's " +
        "mutation is probability and this is the only honest way to print it: " +
        "nothing spectacular ever happens, the numbers are never impressive, and " +
        "somehow the line is still standing in round nine.",
    },
  },
  {
    match: "polaris",
    fx: {
      k: "command", atk: 1, def: 3, swap: 1, lends: "ward",
      label: "Everything metal, held off",
      note:
        "+1/+3 and every blow that reaches the line reaches it lighter. Lorna does " +
        "the half of her father's power he never bothered to develop — the half that " +
        "keeps things off other people — and on this board it is worth more than the " +
        "half he uses.",
    },
  },
  {
    match: "nate grey",
    fx: {
      k: "command", atk: 0, def: 0, when: "alone", then: { atk: 6, def: 4 },
      label: "Nobody left to be careful for",
      note:
        "The worst captain on the board: no bonus, no grace, no substitutions, " +
        "nothing, for as long as anybody else on your side is alive. The moment they " +
        "are not, he walks on at +6/+4 on top of the usual and rewrites the rest of " +
        "it. Nate Grey was grown in a tank as a weapon and never taught to work with " +
        "people, and pretending otherwise would be the game lying to you.",
    },
  },
];
