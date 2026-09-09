/**
 * Star Wars captains.
 *
 * Two armies, and the joke is that neither one is any good at this. The Empire
 * has infinite materiel and a command culture where the man in charge kills his
 * own officers for bad news; the Rebellion has four working ships and everybody
 * on them has met each other. So the Imperial captains here buy attack with
 * health and with `doom`, and the Rebel ones buy substitutions and `raise` —
 * the same fight, funded two different ways.
 *
 * Palpatine, Yoda and Thrawn are already written in `battle.ts`.
 */
import type { CaptainRow } from "./index";

export const STARWARS_CAPTAINS: CaptainRow[] = [
  {
    match: "darth vader",
    fx: {
      k: "command", atk: 3, def: 1, grace: 1, swap: 1,
      when: "allyDown", then: { atk: 2 },
      label: "You have failed me for the last time",
      note:
        "+3/+1, a plane of grace, and the line hits two harder every time one of them " +
        "dies — which on any other board would be grief and here is simply the vacancy " +
        "being noticed. Vader has personally killed more of his own officers than the " +
        "Rebellion managed in three films, and every survivor on this line has done the " +
        "arithmetic on that and is fighting accordingly.",
    },
  },
  {
    match: "grand moff tarkin",
    fx: {
      k: "command", atk: 3, def: -1, swap: 2,
      doom: { def: -1 },
      label: "The Tarkin Doctrine",
      note:
        "+3 attack, −1 health, and the other side comes out a point down before anybody " +
        "moves. Rule through fear of force rather than force itself: he wrote it down, " +
        "published it, got a moon-sized budget for it and then stood on the moon while " +
        "it was shot. The doctrine works right up until the moment it does not.",
    },
  },
  { match: "ackbar", fx: { k: "command", atk: 1, def: 2, grace: 1, swap: 3, doom: { atk: -1 }, label: "It's a trap", note: "Three substitutions and the enemy comes out a point of attack short, because he is the only person in the fleet who reads the sensor board before committing. Everybody remembers the line. Nobody remembers that he was right." } },
  { match: "obi-wan", fx: { k: "command", atk: 1, def: 3, lends: "first", label: "The high ground", note: "+1/+3 and the whole line moves first. He has spent forty years teaching people to wait, and every fight he has ever won he won by standing somewhere better than the other man and saying so out loud first." } },
  { match: "captain rex", fx: { k: "command", atk: 2, def: 2, swap: 2, when: "allyDown", then: { atk: 1, def: 1 }, label: "CT-7567", note: "+2/+2, and the line closes up and gets tougher every time one of them falls. He has buried more brothers with his own face than anybody should, kept every one of their names, and has never once been late." } },
  { match: "princess leia", fx: { k: "command", atk: 2, def: 2, swap: 2, raise: 1, label: "Somebody has to run this", note: "+2/+2, two substitutions and one of your fallen back on their feet. Watched her planet get shot, finished the debrief, and is the only character in the original trilogy who is doing her actual job in every scene she appears in." } },
  { match: "hera syndulla", fx: { k: "command", atk: 1, def: 2, swap: 3, when: "allyDown", then: { def: 2 }, label: "Spectre One", note: "Three substitutions, and the line gets two health tougher each time somebody drops. She flies the ship that everybody else jumps out of, which means she is the one who has to still be there when they come back." } },
  { match: "grogu", fx: { k: "command", atk: 0, def: 2, raise: 2, label: "Puts them back", note: "No attack bonus whatsoever and two of your dead get up. He is fifty years old, weighs nothing, cannot be reasoned with, and will sleep for a day and a half afterwards. Worth every credit and impossible to explain to a new player." } },
  { match: "jar jar", fx: { k: "command", atk: 3, def: -2, grace: 1, swap: 3, when: "round", then: { atk: 1, def: -1 }, label: "Meesa in charge", note: "+3/−2, three substitutions, a plane of grace, and it gets more extreme every round. Nobody on the field knows what is about to happen, including Jar Jar, and that has been true of every fight he has ever accidentally won. The highest-variance captain in the game and the only one whose best-case and worst-case are both entirely his fault." } },
];
