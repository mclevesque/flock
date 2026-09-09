/**
 * Fighting-game captains: Mortal Kombat, Street Fighter and Smash.
 *
 * Three boards in one file because they are one argument. Every card here was
 * built to stand alone in a two-person box and win, and the draft asks them to
 * do the one thing the genre has never modelled: tell somebody else what to
 * do. The good captains on these boards are almost entirely the tournament
 * organisers, the emperors and the teachers — the people who were running the
 * event rather than entering it.
 *
 * OWNERSHIP ACROSS BOARDS. `bosses` prints Akuma, M. Bison, Shao Kahn, Goro,
 * Sephiroth, Ganondorf, Ridley and Bowser, and `smash` prints Sephiroth,
 * Ganondorf, Ridley and Bowser again. The split:
 *
 *   Akuma, M. Bison        written here, in the Street Fighter section. They
 *                          are fighters who happen to be the final screen.
 *   Shao Kahn              written here, in the Mortal Kombat section. He is
 *                          an emperor with a tournament, not a boss with a
 *                          health bar.
 *   Sephiroth, Ganondorf   written in `bosses.ts`, not here. Smash borrowed
 *                          them; the boss board is where they live.
 *   Goro, Ridley, Bowser   not captained anywhere. Goro and Ridley for lack of
 *                          anything interesting to say about them as
 *                          commanders, Bowser because the fragment also lands
 *                          on Bowser Jr. (see `bosses.ts`).
 *
 * COLLISION NOTES.
 *
 *   scorpion        Unique among card NAMES, but note the core registry
 *                   already gives "scorpion" a superEffective effect written
 *                   for Qyburn's siege weapon. Different kind, so both apply
 *                   and neither is wrong: the ninja is also very good at
 *                   pulling large flying things towards him.
 *   gill            Word-bounded and clean. Checked specifically against
 *                   Elena Gilbert and Garth Fitzgerald, both of whom survive
 *                   on the letter after the fragment.
 *   m. bison        Written with the initial. "bison" alone reaches an actual
 *                   bison on the animals board, which would be a downgrade
 *                   for one of them.
 *   captain falcon  Full name. "captain" alone reaches Captain America,
 *                   Captain Cold and Captain Rex.
 *   raiden          Unique. There is no Metal Gear Raiden printed in any pack,
 *                   which was checked rather than hoped.
 *   link, joker     NOT captained. "link" also lands on Dark Link over on
 *                   `bosses`; "joker" would reach DC's, who is already
 *                   captained as "the joker" and whose captaincy would be
 *                   silently overwritten depending on file order. Neither is
 *                   worth the risk.
 *   samus           Also reaches "Zero Suit Samus", which is fine and in fact
 *                   correct — same person, one fewer suit. Not captained in
 *                   the end, but recorded here so nobody re-litigates it.
 */
import type { CaptainRow } from "./index";

export const FIGHTERS_CAPTAINS: CaptainRow[] = [
  // ── Mortal Kombat ────────────────────────────────────────────────────────
  {
    match: "shao kahn",
    fx: {
      k: "command", atk: 4, def: 1,
      doom: { atk: -1 },
      label: "You will never win",
      note:
        "+4/+1 and a point of attack off the other line. Shao Kahn's actual method has " +
        "never been the hammer: it is that he runs the tournament, sets the terms, and " +
        "has conquered nine realms by making everyone agree to fight him under rules he " +
        "wrote. He is also the only card on this board contractually required to comment " +
        "on your performance.",
    },
  },
  {
    match: "kronika",
    fx: {
      k: "command", atk: 1, def: 1, raise: 3,
      when: "round", then: { def: 1 },
      label: "She has run this timeline before",
      note:
        "Three of your fallen come back and the line hardens every round, off a modest " +
        "opening. Kronika is a Titan who keeps time and has restarted the entire history " +
        "of the franchise at least twice when the ending displeased her. Losing a card " +
        "under her is a first draft.",
    },
  },
  {
    match: "shang tsung",
    fx: {
      k: "command", atk: 1, def: 1,
      when: "kill", then: { atk: 2 },
      label: "Your soul is mine",
      note:
        "+2 attack to the entire line every time it takes somebody down, permanently and " +
        "with no cap — the steepest kill-scaling in the game. Shang Tsung does not get " +
        "stronger by training. He gets stronger by winning, which is why he looks eighty " +
        "at the start of every tournament and thirty by the end of it.",
    },
  },
  {
    match: "raiden",
    fx: {
      k: "command", atk: 1, def: 2, grace: 2, lends: "first",
      label: "Sends mortals to fight gods",
      note:
        "Two planes off the gap and the whole line moves first, which is the purest " +
        "statement of what the man does. Raiden is a thunder god forbidden from " +
        "intervening directly, so his entire contribution across a decade of apocalypses " +
        "has been finding four ordinary people, telling them exactly how to beat something " +
        "that outclasses them, and watching. His record is mixed. His method is the game.",
    },
  },
  {
    match: "quan chi",
    fx: {
      k: "command", atk: 2, def: 0, raise: 2,
      doom: { def: -1 },
      label: "They serve better dead",
      note:
        "+2 attack, two of your fallen back on their feet, and a point of health off the " +
        "other line. Quan Chi's roster is built entirely from people who fought him " +
        "honourably and lost, which he considers a recruitment pipeline. Everyone he " +
        "raises comes back wrong and none of them are consulted.",
    },
  },

  // ── Street Fighter ───────────────────────────────────────────────────────
  {
    match: "akuma",
    fx: {
      k: "command", atk: 5, def: -2,
      label: "Satsui no Hado",
      note:
        "+5 attack and −2 health, the most violent trade any captain in the game offers. " +
        "Akuma has no interest in your team, your draft or the outcome. He is looking for " +
        "one fight worth having, has killed his own master finding it, and any line " +
        "standing near him inherits the search whether it wanted to or not. It will not " +
        "last long and it will hit like nothing else on the board.",
    },
  },
  {
    match: "m. bison",
    fx: {
      k: "command", atk: 2, def: 2, grace: 1, raise: 2,
      label: "For you, the day was the most important",
      note:
        "+2/+2, a plane off the gap and two of your dead back up — and the raise is the " +
        "least metaphorical in the game, because Bison has done exactly this to himself " +
        "four times. Psycho Power keeps a spare body in a tank. He has been killed on " +
        "screen, repeatedly, by several different people, and has treated each occasion as " +
        "an administrative inconvenience.",
    },
  },
  {
    match: "gill",
    fx: {
      k: "command", atk: 1, def: 1, raise: 2,
      when: "round", then: { heal: 1 },
      label: "Resurrection is a super art",
      note:
        "Two of your fallen return and everyone tops up a point every round. Gill is the " +
        "chairman of a secret organisation, is painted half red and half blue, and holds " +
        "the distinction of being the only fighter in the genre whose signature move is " +
        "getting up after you have already beaten him. Beating him twice is the actual " +
        "fight.",
    },
  },
  {
    match: "gouken",
    fx: {
      k: "command", atk: 1, def: 3, grace: 1, lends: "ward",
      label: "The half of the art he kept",
      note:
        "+1/+3, a plane off the gap and every blow arriving lighter — no offence worth " +
        "mentioning anywhere on it. Gouken took the same style as his brother, threw away " +
        "the part that kills, and produced Ryu and Ken out of the remainder. Akuma murdered " +
        "him for it and he came back anyway, which settles the argument fairly clearly.",
    },
  },
  {
    match: "dan hibiki",
    fx: {
      k: "command", atk: 0, def: 0, swap: 1,
      when: "alone", then: { atk: 3, def: 3 },
      label: "Saikyo-ryu",
      note:
        "One substitution and nothing else, which is worse than the captaincy every card " +
        "in the game gets for free, right up until he is the last one standing and picks " +
        "up +3/+3. Dan founded his own school, is its only student, and named it 'the " +
        "strongest'. He is on this list because a board full of world warriors needs " +
        "exactly one card that punishes you for believing the label, and because the " +
        "taunt has genuinely won matches.",
    },
  },

  // ── Smash ────────────────────────────────────────────────────────────────
  {
    match: "olimar",
    fx: {
      k: "command", atk: 0, def: 1, swap: 4, raise: 3,
      label: "There are one hundred of them",
      note:
        "Four substitutions and three resurrections — jointly the most bodies any captain " +
        "in the game moves, on a card with no attack at all. Captain Olimar is a small " +
        "salaryman with a spaceship and a debt, and his entire method is sending waves of " +
        "expendable plant creatures at a problem until it stops. He counts them at the end " +
        "of each day. He always has fewer.",
    },
  },
  {
    match: "meta knight",
    fx: {
      k: "command", atk: 2, def: 1, grace: 1, lends: "first",
      label: "He has a crew",
      note:
        "+2/+1, a plane off the gap and the line moves first. Meta Knight is the only " +
        "fighter on this board who owns a battleship, employs a crew and issues orders to " +
        "them, and he is roughly the size of a football. Everyone else here is a solo act " +
        "in a suit; he turned up with logistics.",
    },
  },
  {
    match: "mr. game and watch",
    fx: {
      k: "command", atk: 1, def: 1, grace: 2,
      label: "Two dimensions",
      note:
        "Two planes off the gap, which is the strongest grace in the game and, for once, " +
        "a literal reading of the rule. He is a flat black silhouette running at nine " +
        "frames a second. Whatever is standing above your line has to work out how to be " +
        "above something with no depth, and the answer has never been satisfactory.",
    },
  },
  {
    match: "king k. rool",
    fx: {
      k: "command", atk: 2, def: 3,
      doom: { atk: -1 },
      label: "Belly armour and a blunderbuss",
      note:
        "+2/+3 and a point of attack off the other line — the sturdiest captaincy on this " +
        "board. K. Rool has been a pirate captain, a mad scientist and a boxing promoter, " +
        "changes career every game, and has never once delegated the actual fighting, " +
        "which is why the numbers here are so defensive. He is protecting the bananas.",
    },
  },
  {
    match: "captain falcon",
    fx: {
      k: "command", atk: 3, def: 0, grace: 1,
      label: "It is in the name",
      note:
        "+3 attack, no health, a plane off the gap. Worth being clear that the rank is " +
        "unexplained: Douglas Jay Falcon is a bounty hunter and a Grand Prix driver, has " +
        "never been shown commanding anything, and is called Captain in every piece of " +
        "material ever produced about him. The draft has decided to take him at his word.",
    },
  },
  {
    match: "steve",
    fx: {
      k: "command", atk: 1, def: 2, swap: 2,
      when: "round", then: { def: 1 },
      label: "He is building something",
      note:
        "+1/+2, two substitutions and the line hardens every round it survives. Steve does " +
        "not have a fighting style, a rivalry, a backstory or a face. He has a workbench, " +
        "and given four uninterrupted rounds he will have walled your entire line into " +
        "something the other side has to mine through. Nobody in the genre has ever found " +
        "this less funny than the people who play against him.",
    },
  },
];
