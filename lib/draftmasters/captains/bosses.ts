/**
 * Video-game boss captains.
 *
 * Every card on this board was, in its own game, the thing standing between a
 * player and the credits — which means almost none of them have ever had to
 * work with anybody. That is the tension worth printing: a board full of final
 * encounters, being asked to give four other people orders. The ones who are
 * good at it are almost all the ones who were never physically in the fight to
 * begin with — a computer, a brain in a jar, a voice on the radio, a man with
 * a hologram and a monologue.
 *
 * OWNERSHIP, WITH THREE OTHER BOARDS.
 *
 *   Ganondorf, Sephiroth   Also on `smash`. Written here, because they are
 *                          bosses first and guest fighters second, and the
 *                          smash file deliberately writes neither.
 *   Akuma, M. Bison        Also on this board, written in `fighters.ts`
 *                          instead — they are Street Fighter characters who
 *                          got promoted, not bosses who learned to fight.
 *   Shao Kahn, Goro        Same arrangement with Mortal Kombat.
 *   Hades                  Already captained out of `greek.ts` and left
 *                          alone. Supergiant's Hades is a fairly faithful
 *                          reading of the Greek one — chronically reasonable,
 *                          universally disliked, does not leave the office.
 *   Dracula                Already captained out of `horror.ts`.
 *
 * COLLISION NOTES.
 *
 *   sephiroth      Also reaches this board's own "Sephiroth's Supernova",
 *                  which is an attack rather than a person, and there is no
 *                  way to lengthen the fragment past it. Left in: a card that
 *                  is literally a summoned meteor, running the line, is not
 *                  the strangest thing that happens in Final Fantasy VII.
 *   bowser         NOT captained. The fragment reaches "Bowser Jr." as well,
 *                  and a captaincy that silently applies to a small child in a
 *                  clown car is a worse outcome than not having one.
 *   handsome jack  Full name, or it takes Jack Kline off the Supernatural
 *                  board, who is a toddler.
 *   andrew ryan    Full name. "ryan" alone reaches Ryan Wilder on `cw`.
 *   the boss       Word-bounded and unique across all packs; checked, because
 *                  a three-letter noun this generic had no business being
 *                  safe.
 *   death, goro    NOT captained here. Both are shared, and both are owned
 *                  elsewhere or dropped for collisions — see `spn.ts` and
 *                  `fighters.ts`.
 */
import type { CaptainRow } from "./index";

export const BOSSES_CAPTAINS: CaptainRow[] = [
  {
    match: "glados",
    fx: {
      k: "command", atk: 0, def: 1, grace: 2,
      doom: { atk: -1, def: -1 },
      label: "This next test may involve your team",
      note:
        "Two planes off the gap for your line and −1/−1 for theirs, from a card with no " +
        "attack whatsoever. GLaDOS has never hit anything. She has a building, a public " +
        "address system, an unlimited supply of turrets she did not build either, and a " +
        "genuine scientific interest in what your four cards do under stress. She will " +
        "report the results in a tone.",
    },
  },
  {
    match: "doctor eggman",
    fx: {
      k: "command", atk: 1, def: 0, swap: 4, raise: 2,
      label: "There is always another badnik",
      note:
        "Four substitutions and two of your fallen back on the field, which is the most " +
        "material any captain in the game moves around. Eggman has an IQ of three hundred, " +
        "a factory, and a career win rate hovering somewhere near zero, and the two facts " +
        "have never once slowed him down. Whatever you lose, he has more of it in a crate.",
    },
  },
  {
    match: "sephiroth",
    fx: {
      k: "command", atk: 4, def: 1, grace: 1,
      when: "kill", then: { atk: 1 },
      label: "The one-winged angel",
      note:
        "+4/+1, a plane off the gap and more attack with every body — the biggest offensive " +
        "captaincy on the board and the card the table will bid stupidly for. He was the " +
        "company's best soldier, read one file about where he came from, and reduced the " +
        "argument to a sword long enough to reach anything on the screen. He has never " +
        "commanded troops. He has simply never needed to be near them.",
    },
  },
  {
    match: "ganondorf",
    fx: {
      k: "command", atk: 3, def: 2, raise: 1,
      label: "In every timeline",
      note:
        "+3/+2 and one of your dead back up. The raise is not a power he has; it is his " +
        "release schedule. Sealed in the Sacred Realm, sealed in the Twilight, executed " +
        "with a sword through the chest in front of witnesses, and back for the next one " +
        "in a slightly different hat. He is the only villain here who has lost more times " +
        "than Eggman and is still taken seriously.",
    },
  },
  {
    match: "kefka",
    fx: {
      k: "command", atk: 4, def: -1,
      doom: { atk: -1, def: -1 },
      label: "He actually did it",
      note:
        "+4 attack, −1 health, and the enemy line at −1/−1: everything goes forward and " +
        "nothing comes home. Worth remembering that Kefka is not a threat the story " +
        "eventually contains. He wins in the middle of the game, breaks the world, and " +
        "spends the second half of it sitting on a tower of corpses being worshipped. " +
        "Almost nobody else in the genre managed that.",
    },
  },
  {
    match: "psycho mantis",
    fx: {
      k: "command", atk: 0, def: 0, grace: 2, swap: 3,
      label: "He has read your other drafts",
      note:
        "Three substitutions and two planes off the gap on a completely blank stat line — " +
        "the most pure information a captain can be. Mantis does not want to fight your " +
        "cards, he wants to tell you which ones you always pick, how many auctions you " +
        "have lost this month, and what you were going to do next. Historically the " +
        "counterplay was to unplug something.",
    },
  },
  {
    match: "mother brain",
    fx: {
      k: "command", atk: 1, def: 3, raise: 2,
      label: "Life support and an army",
      note:
        "+1/+3 and two of your dead back up. Mother Brain is a brain in a jar wired to a " +
        "planet's worth of hardware, and every single thing that has ever attacked anyone " +
        "on her behalf was attached to something else. She does not move. She has not " +
        "needed to move since 1986.",
    },
  },
  {
    match: "handsome jack",
    fx: {
      k: "command", atk: 3, def: 0,
      doom: { atk: -1 },
      when: "kill", then: { atk: 1 },
      label: "You're the bandit",
      note:
        "+3 attack, nothing for health, and it climbs with every kill. Jack runs the " +
        "largest corporation on the planet, holds the payroll of everyone shooting at you, " +
        "and is entirely convinced he is the hero of this — which is why his line goes " +
        "forward and never once gets told to hold. He will narrate your losses back to you " +
        "over the intercom, warmly, by name.",
    },
  },
  {
    match: "andrew ryan",
    fx: {
      k: "command", atk: 2, def: 2,
      when: "round", then: { def: 1 },
      label: "Would you kindly",
      note:
        "+2/+2 and the line hardens every round, with no substitutions and no grace, " +
        "because Ryan does not adjust the plan and does not take questions. He built a " +
        "city on the principle that a man chooses and a slave obeys, and then discovered " +
        "the far more useful principle that a phrase in the right place makes the " +
        "distinction academic. Your line obeys. It thinks it chose.",
    },
  },
  {
    match: "yu yevon",
    fx: {
      k: "command", atk: 0, def: 0, raise: 3,
      when: "round", then: { def: 1 },
      label: "A thousand years of the same fight",
      note:
        "Three of your dead get up and the line gains health every round, forever, from a " +
        "card with no attack and no health of its own. Yu Yevon is not a person any more, " +
        "it is a summoning that has been running unattended for a millennium: kill the " +
        "thing it is wearing and it puts on another one and starts the cycle again. The " +
        "final boss of the game is an admin task.",
    },
  },
  {
    match: "whispy woods",
    fx: {
      k: "command", atk: 0, def: 1,
      when: "round", then: { heal: 1 },
      label: "It is a tree",
      note:
        "+0/+1 and a point of health back to the line each round, which is comfortably the " +
        "least any written captain in the game does. Whispy is the first boss of almost " +
        "every Kirby game, has never been the last boss of any of them, and its entire " +
        "combat repertoire is blowing at you and dropping fruit. The fruit is the ability. " +
        "Somebody at this table is going to bid on it.",
    },
  },
];
