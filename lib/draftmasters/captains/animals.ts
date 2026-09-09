/**
 * Animal Kingdom captains.
 *
 * A board where a capybara fights a dragon, and the reason it is the funniest
 * board in the game is that none of the jokes are invented. Every note below
 * is a fact somebody wrote down: the emu did win the war, the honey badger
 * genuinely does not care, the pigeons genuinely were decorated for valour,
 * and the inland taipan genuinely could kill a hundred adults with one bite
 * and would genuinely much rather not meet any of them.
 *
 * BOARD_POWER has this board at [3, 11] — the lowest ceiling in the game — so
 * the numbers here are small on purpose. A +3 on Westeros is a nudge. A +3
 * here doubles a wolf.
 *
 * The design thesis, which the file is built around: on a board of animals,
 * COORDINATION is the rarest stat and the most valuable one. Almost everything
 * on this board is a solitary killer that has never worked with anything.
 * Orcas, wolves and ants have, and their captaincies price that in. The
 * capybara is the exception and the best card in the file, on the grounds that
 * getting two hostile species to stop is a rarer skill than either of them has.
 *
 * ── Name collisions ────────────────────────────────────────────────────────
 *
 *   inland taipan       matched in full. Bare "pan" was the exact collision
 *                       that started the audit — it is a Greek god, a Dragon
 *                       Ball character and a cooking implement, and it sits
 *                       inside the world's most venomous snake.
 *   silverback gorilla  in full. "gorilla" would reach Gorilla Grodd on the
 *                       DC board, who is a different kind of problem.
 *   canada goose        in full, for no collision reason at all — purely so
 *                       nobody later adds a "goose" and wonders why the
 *                       Canada Goose stopped being funny.
 *   african elephant    in full; the board prints two of them and they are the
 *                       same animal, so both matching is correct.
 *   grey wolf           in full. Note that this does NOT reach "Wolf Pack",
 *                       "Dire Wolves" or "Wolverine" — the boundary check
 *                       handles all three — and that is intentional: a pack is
 *                       a different card and the wolverine is on this board by
 *                       clerical accident and already has X-Men's regeneration.
 *   orca                bare, and verified clean across every pack. It is four
 *                       letters and it looked dangerous; it is not, because
 *                       nothing else in the game has "orca" standing alone.
 *
 * "sloth" was checked against the deadly-sins cards on the other boards and is
 * clean. If somebody ever adds a Fullmetal Alchemist homunculus to the anime
 * board, this row is the one that breaks, and the fix is to lengthen it to
 * "sloth " — which will then match nothing, because the card is named "Sloth"
 * and nothing follows it. In that event, delete this row instead.
 */
import type { CaptainRow } from "./index";

export const ANIMALS_CAPTAINS: CaptainRow[] = [
  {
    match: "capybara",
    fx: {
      k: "command", atk: 0, def: 1, swap: 2,
      doom: { atk: -2 },
      label: "Everyone has decided it is fine",
      note:
        "The other side comes out two attack short and your line gets a point of " +
        "health and a shrug. This is a tier-one rodent that weighs as much as a dog " +
        "and it is the best captain on this board, because the capybara has solved the " +
        "problem every other card here has: nothing wants to hurt it. Birds sit on it. " +
        "Crocodilians sunbathe next to it. Somewhere in the enemy line, something is " +
        "having second thoughts and cannot explain why.",
    },
  },
  {
    match: "orca",
    fx: {
      k: "command", atk: 2, def: 1, grace: 2, swap: 3,
      label: "It has been taught how",
      note:
        "Two planes of any gap stop counting and there are three substitutions, which " +
        "is the most defensible captaincy on the board: orcas hunt in coordinated pods " +
        "with assigned roles, teach each other techniques, keep regional dialects, and " +
        "have been observed flipping great white sharks upside down to paralyse them " +
        "and then eating only the liver. They do not do that because they are hungry. " +
        "They do it because somebody showed them.",
    },
  },
  {
    match: "grey wolf",
    fx: {
      k: "command", atk: 1, def: 1, swap: 3, lends: "first",
      label: "They run it down",
      note:
        "Three substitutions and the whole line moves first. One wolf is a middling " +
        "card on this board and loses to most of the bears. What a wolf actually does " +
        "is arrive with seven others, at a jog, for the next nine miles, and take turns. " +
        "The bonus here is not strength. It is a rota.",
    },
  },
  {
    match: "army ant swarm",
    fx: {
      k: "command", atk: 1, def: 0, raise: 3,
      label: "There is always another one",
      note:
        "Almost nothing for the line and three of your dead back on their feet, which " +
        "is the only honest way to print a column twenty million strong. An army ant " +
        "colony has no permanent nest — it builds one out of its own bodies each night, " +
        "out of ants, holding each other. Losing some is not a setback in the way it is " +
        "for everything else on this board.",
    },
  },
  {
    match: "silverback gorilla",
    fx: {
      k: "command", atk: 2, def: 2,
      when: "allyDown", then: { atk: 3 },
      label: "It is standing in front of the troop",
      note:
        "+2/+2, and +3 attack to everything still standing the moment one of yours " +
        "goes down. The hundred-men question is the wrong question and the silverback's " +
        "actual job is the right one: he is the one who stays between the troop and " +
        "whatever has arrived, and the fights he loses are the ones he was never going " +
        "to walk away from anyway.",
    },
  },
  {
    match: "african elephant",
    fx: {
      k: "command", atk: 1, def: 2, grace: 2,
      label: "It remembers who did that",
      note:
        "+1/+2 and two planes of any gap stop counting, on a board where nothing else " +
        "gets more than one. Elephants recognise individual humans by voice, hold " +
        "grudges across decades, return to the bones of their dead, and have been " +
        "recorded going out of their way, years later, to find a specific person. It is " +
        "not that the elephant is clever. It is that the elephant has a file on you.",
    },
  },
  {
    match: "hippopotamus",
    fx: {
      k: "command", atk: 3, def: 2,
      doom: { atk: -1 },
      label: "The actual answer to the question",
      note:
        "+3/+2 and the other side a point weaker. Everyone comes to this board " +
        "expecting the lion or the bear, and the hippo kills more people every year " +
        "than both of them and the crocodile combined. It is a five-tonne herbivore " +
        "that can outrun you on land, holds territory in water it cannot swim in, and " +
        "bites through a canoe out of what appears to be principle.",
    },
  },
  {
    match: "honey badger",
    fx: {
      k: "command", atk: 3, def: -1,
      when: "allyDown", then: { atk: 2 },
      label: "It genuinely does not care",
      note:
        "+3 attack, −1 health, and it climbs every time one of yours falls. This is " +
        "the Ares captaincy of the animal board: your line will hit harder than it has " +
        "any right to and die faster for it. Honey badgers have been filmed taking a " +
        "kill off a pride of lions, shaking off a puff adder bite by having a nap and " +
        "then getting up and finishing the snake, and digging out of concrete " +
        "enclosures using a rake they were not supposed to have.",
    },
  },
  {
    match: "emu",
    fx: {
      k: "command", atk: 2, def: 2,
      when: "allyDown", then: { atk: 2 },
      label: "Undefeated in open warfare",
      note:
        "+2/+2 and another +2 every time one of yours goes down, which is a strange " +
        "amount of command ability for a large confused bird until you check the " +
        "record. In 1932 the Australian government deployed soldiers with two Lewis " +
        "machine guns against the emus of Western Australia. The emus split into small " +
        "groups, adopted what the commanding officer's report described as guerrilla " +
        "tactics, and the operation was withdrawn. There was a second attempt. It also " +
        "failed.",
    },
  },
  {
    match: "inland taipan",
    fx: {
      k: "command", atk: 0, def: 0,
      doom: { atk: -2, def: -3 },
      label: "One bite, a hundred people",
      note:
        "Nothing for your line and −2/−3 for theirs, the heaviest doom on the board " +
        "from a card that will not be joining in. The inland taipan's venom is the most " +
        "toxic of any snake on earth by a factor of about fifty, and a single defensive " +
        "bite carries enough of it to kill roughly a hundred adults. It is also " +
        "famously shy, lives where nobody goes, and has never killed anybody at all.",
    },
  },
  {
    match: "canada goose",
    fx: {
      k: "command", atk: 1, def: 0, swap: 2,
      doom: { atk: -2, def: -1 },
      label: "It has decided this is its car park",
      note:
        "−2/−1 to the entire enemy line, delivered by a bird that weighs four " +
        "kilograms and has no weapons of any kind. Nothing on that side wants this " +
        "problem. It is not that the goose can win — it is that the goose will not " +
        "stop, will follow you to your vehicle, and is prepared to make the next twenty " +
        "minutes about itself. Every animal in the game understands this instinctively " +
        "except humans, who keep trying to feed it.",
    },
  },
  {
    match: "pigeon",
    fx: {
      k: "command", atk: 0, def: 1, grace: 2, swap: 1,
      label: "It knows the way back",
      note:
        "Two planes of any gap stop counting, from a tier-one bird with one foot. " +
        "Pigeons navigate by the earth's magnetic field, recognise themselves in " +
        "mirrors, can distinguish a Monet from a Picasso, and carried dispatches " +
        "through artillery fire in both wars — one of them finished the flight that " +
        "saved a trapped battalion having been shot through the chest and lost a leg, " +
        "and was decorated for it. The bin is a career change, not a résumé.",
    },
  },
  {
    match: "chihuahua",
    fx: {
      k: "command", atk: 4, def: -2,
      label: "It has no idea how big it is",
      note:
        "+4 attack and −2 health to your entire line, which on a board with a ceiling " +
        "of eleven is the most violent thing in this file. Nobody following a chihuahua " +
        "is going to survive contact and every one of them is going in first. It weighs " +
        "two kilograms. It has never once assessed a situation. It is shaking, and that " +
        "is not fear, and everyone has been getting that wrong for years.",
    },
  },
  {
    match: "sloth",
    fx: {
      k: "command", atk: 0, def: 2, swap: 0,
      when: "round", then: { def: 1 },
      label: "It has a plan and it starts on Thursday",
      note:
        "+0/+2 and another point of health every round, forever, and not one " +
        "substitution — because a sloth cannot pull anybody out of anything and would " +
        "not arrive in time if it could. Everything about this captaincy is patience. " +
        "It digests a leaf in a month, moves at two metres a minute, grows its own " +
        "algae, and has outlasted the ground sloth, the sabre-tooth and most of what " +
        "used to eat it. It is winning. It is just not doing it today.",
    },
  },
];
