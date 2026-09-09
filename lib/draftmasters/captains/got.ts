/**
 * Westeros captains.
 *
 * The board that proves the rule: nobody in Game of Thrones wins a fight by
 * being the strongest person in it, and the captains are where that finally
 * shows up in the rules. Olenna Tyrell has never thrown a punch and is one of
 * the best cards in the game from behind the line.
 *
 * The heavy hitters — Tywin, Cersei, Littlefinger, Varys, Olenna, Davos,
 * Sansa, Bran, Roose — are written in `battle.ts` alongside the rest of the
 * core registry. What is left here is the three the board actually still
 * needed: the one who brings your dead back, the one who never loses a battle,
 * and the one who wins without attending.
 */
import type { CaptainRow } from "./index";

export const GOT_CAPTAINS: CaptainRow[] = [
  {
    match: "qyburn",
    fx: {
      k: "command", atk: 0, def: 1, swap: 1, raise: 2,
      label: "The work continues",
      note:
        "Two of your fallen get back on their feet at half health. Qyburn does not " +
        "accept a corpse as a finished conversation — he was stripped of his chain " +
        "for exactly this and the Citadel was right about him. He offers your line " +
        "almost nothing while it is alive, which is consistent: he has never been " +
        "very interested in the living.",
    },
  },
  {
    match: "robb stark",
    fx: {
      k: "command", atk: 2, def: 1, when: "kill", then: { atk: 1 },
      label: "The Young Wolf",
      note:
        "Every time the line takes somebody down, everyone still standing gains " +
        "another point of attack, permanently, and it compounds for the rest of the " +
        "fight. Robb never lost a battle. He is the best snowball captain on the " +
        "board and the standing argument for why that is not the same thing as " +
        "winning.",
    },
  },
  {
    match: "walder frey",
    fx: {
      k: "command", atk: 0, def: 0, swap: 1, doom: { atk: -1, def: -3 },
      label: "Guest right",
      note:
        "Your line gets nothing at all. The other line starts at −1/−3, before a " +
        "single blow, because the damage was done somewhere they were not looking. " +
        "Walder is ninety, contributes less than any card on the board and is " +
        "personally responsible for more of its corpses than the Mountain. " +
        "Everything he has ever done happened to people who thought they were safe.",
    },
  },
];
