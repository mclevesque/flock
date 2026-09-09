/**
 * Godzilla captains.
 *
 * The heaviest board in the game — BOARD_POWER has it at [16, 34], where the
 * Greek gods start at 5 — and that is why the numbers below look wrong next to
 * every other captain file. A +2 that transforms an animal or a Pokémon is
 * noise on a card that starts at twenty-eight. Everything here is scaled to
 * the board it is standing on, and a reader comparing these to `greek.ts`
 * should compare them as percentages or not at all.
 *
 * The other thing that makes this board unusual: almost nothing on it takes
 * orders. `obedienceOf` already prints Godzilla, Ghidorah, Kong, Destoroyah
 * and the Skullcrawler at zero, which means a captain's substitutions are
 * mostly decorative here — you can pull a card out of a losing matchup only if
 * it agrees to come, and it will not. So the good captaincies on this board
 * are the ones that work without cooperation: doom, flat stats, and Mothra.
 *
 * Mothra is written as the best captain in the file on purpose. She is the
 * only kaiju in seventy years of these films who has ever fought FOR anybody,
 * and a board where the correct pick is the giant moth is a board that has
 * understood itself.
 *
 * ── Name collisions ────────────────────────────────────────────────────────
 *
 * The word-boundary match does most of the work here, and it is worth writing
 * down what it saves, because "godzilla" looks like a fragment that should be
 * a disaster on a board with five of them:
 *
 *   Mechagodzilla   safe — the character before the match is "a", so the
 *                   boundary check refuses it. Same for SpaceGodzilla ("e").
 *                   Both keep their own rows or none.
 *   Godzilla Junior and Godzilla Ultima  DO match the "godzilla" row, and are
 *                   left that way deliberately. Junior grows into Godzilla in
 *                   the space of one film and Ultima is Godzilla with the
 *                   numbers turned up; giving either of them a different
 *                   command would be the file disagreeing with the franchise.
 *   Zilla           does not match "godzilla" and never could. It has also
 *                   never beaten anything, which is a separate matter.
 *   king kong       matched in full. Bare "kong" would take Mechani-Kong,
 *                   because the character before it is a hyphen and a hyphen
 *                   is not a letter.
 *   the scar king   matched in full. Bare "scar" reaches across most of the
 *                   game and "king" reaches half of this board.
 *   king ghidorah   Mecha-King Ghidorah and Keizer Ghidorah are VARIANT lines,
 *                   and captains no longer read variants, so this is safe.
 *
 * The horror board also prints a Godzilla, and it takes the row below. That is
 * intended — it is the same lizard, and horror has no better claim on him.
 */
import type { CaptainRow } from "./index";

export const GODZILLA_CAPTAINS: CaptainRow[] = [
  {
    match: "mothra",
    fx: {
      k: "command", atk: 3, def: 4, swap: 2, raise: 2, lends: "ward",
      label: "The only one who came to help",
      note:
        "+3/+4, two substitutions, two of your fallen back on their feet and every " +
        "blow that reaches the line reaches it lighter. The best captaincy on this " +
        "board and the least likely one, and the reason is the whole of her filmography: " +
        "Mothra is the only Titan that has ever turned up on purpose, on somebody " +
        "else's behalf, at a cost to herself. She has died doing it repeatedly. There " +
        "is always another egg.",
    },
  },
  {
    match: "king ghidorah",
    fx: {
      k: "command", atk: 4, def: 1, swap: 3,
      doom: { atk: -2, def: -1 },
      label: "Everything on Earth heard that",
      note:
        "+4/+1, three substitutions, and the other line comes out at −2/−1. Ghidorah " +
        "is not from here, which is the point — when it calls, every other Titan on the " +
        "planet stops what it is doing and starts working for it, and none of them were " +
        "asked. This is the only card on the board that commands things that do not " +
        "want to be commanded, and it is why it is worth outbidding somebody for.",
    },
  },
  {
    match: "godzilla",
    fx: {
      k: "command", atk: 5, def: 3, swap: 0,
      when: "kill", then: { atk: 2 },
      label: "The King is watching this",
      note:
        "+5/+3 and another +2 attack to the whole line every time it takes something " +
        "down — and not one substitution, ever, because Godzilla has never given an " +
        "order and would not know how. Nothing on your side is being told where to " +
        "stand. They are simply fighting harder than they would otherwise, because of " +
        "who is behind them and what he is like when a fight goes badly.\n\n" +
        "(Godzilla Junior and Godzilla Ultima match this row as well. That is " +
        "deliberate: one becomes him and the other is him.)",
    },
  },
  {
    match: "mechagodzilla",
    fx: {
      k: "command", atk: 3, def: 3, grace: 2, swap: 3,
      label: "Somebody read the file",
      note:
        "Two planes of any gap stop counting and there are three substitutions to " +
        "spend, from the one card on this board that was DESIGNED. Every Mechagodzilla " +
        "is the product of a government that measured the original, worked out where it " +
        "was weak and built a machine specifically for that. It is the Batman answer " +
        "rendered at four hundred feet, and on a board full of animals it is worth more " +
        "than another twenty points of attack.",
    },
  },
  {
    match: "king kong",
    fx: {
      k: "command", atk: 3, def: 2, grace: 1, swap: 4,
      label: "He works with people",
      note:
        "Four substitutions, more than anything else in this file, from the only Titan " +
        "that has ever taken a suggestion. Kong looks at the small things on the ground, " +
        "works out what they want, and — this is the part no other kaiju manages — " +
        "sometimes agrees with them. Everything else on this board is weather. Kong is " +
        "a colleague.",
    },
  },
  {
    match: "destoroyah",
    fx: {
      k: "command", atk: 6, def: -2,
      when: "kill", then: { atk: 2 },
      label: "It was a weapon before it was alive",
      note:
        "+6 attack, −2 health, and it keeps climbing with every kill. Destoroyah is a " +
        "colony of crustaceans woken up and rearranged by the Oxygen Destroyer — the " +
        "device that killed the original Godzilla in 1954 and was never used again " +
        "because of what it did. It is the only thing on this board that has actually " +
        "finished him. Your line will hit like nothing else here for as long as it lasts.",
    },
  },
  {
    match: "biollante",
    fx: {
      k: "command", atk: 1, def: 4, raise: 1,
      when: "round", then: { heal: 2 },
      label: "It does not stay dead and it does not want to be here",
      note:
        "+1/+4, two health back to everybody every round, and one of your fallen up " +
        "again. Biollante is a rose, a Godzilla cell and a dead girl in one organism, " +
        "created by a grieving scientist who wanted his daughter back and got this " +
        "instead. It dissolves into spores when beaten and reassembles somewhere else. " +
        "Nothing else on this board heals, and nothing else on this board is sad.",
    },
  },
  {
    match: "the scar king",
    fx: {
      k: "command", atk: 4, def: 0, swap: 4,
      doom: { atk: -1 },
      label: "Somebody else's freeze breath",
      note:
        "Four substitutions and −1 to the other line, from an ape who is physically " +
        "unremarkable by the standards of this board and has never needed to be. The " +
        "Scar King's entire method is a crystal, a much larger monster on the end of " +
        "it, and a willingness to point. He is the closest thing this franchise has to " +
        "a general, and every one of his troops is a hostage.",
    },
  },
  {
    match: "minilla",
    fx: {
      k: "command", atk: 0, def: 0,
      doom: { atk: -3, def: -1 },
      label: "Whose son is that",
      note:
        "Your line receives nothing at all. Not a point, not a substitution. The other " +
        "line comes out at −3/−1 and stays there, and every one of them knows exactly " +
        "why: this is a small, soft, blowing-smoke-rings creature that cannot fight, and " +
        "somewhere over the horizon there is a consequence for touching it. The purest " +
        "tax in the game, levied by the least threatening card on the board.",
    },
  },
];
