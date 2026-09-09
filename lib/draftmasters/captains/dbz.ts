/**
 * Dragon Ball Z captains.
 *
 * The board file (`boards/dbz.ts`) already states the thesis better than this
 * one can: `t` is a market price and it is wrong on purpose, the beloved cards
 * are furniture, and the actual ceiling belongs to a butler nobody drafts.
 * This file is that argument continued into the command layer — which is where
 * it should be loudest, because a captain's whole job is to be worth more than
 * their stat line, and Dragon Ball's cast is nothing but stat line.
 *
 * So: Whis and Vados are the two best captaincies here and neither of them
 * will ever be the most expensive card in the room. Mr. Satan is a 2/3 with
 * the largest flat bonus in the file. Bulma has never thrown a punch and gets
 * the schemer package. If the auction prices any of those correctly, the file
 * has failed.
 *
 * ── What is already in the core registry, and therefore not here ───────────
 *
 * `battle.ts` gets first refusal on every effect kind, so four of this board's
 * headliners are already spoken for and writing them again would do nothing:
 *
 *   goku, gohan   already carry `ascend`. A command here would still apply —
 *                 different kind — but the transformation is the character and
 *                 a second ability would only dilute the card.
 *   vegeta        ALREADY HAS A COMMAND in EFFECTS_CORE (+2/0, "Fight
 *                 properly") plus lastStand. Anything written here for him is
 *                 dead code. Left out deliberately; do not add him.
 *   cell          already carries `bloodlust`, and "cell" matches "Cell Jr."
 *                 as a word, so anything given to one is given to both.
 *
 * ── Name collisions ────────────────────────────────────────────────────────
 *
 *   piccolo       DELIBERATELY also matches King Piccolo. They are the same
 *                 person — Piccolo is his reincarnation and spent an arc being
 *                 told so — and one command for both is correct.
 *   whis          survives the boundary check against Whiscash and Whismur on
 *                 the Pokémon board (the character after the match is a
 *                 letter, so neither fires). Verified, not assumed.
 *   mr. satan     matched with the honorific. Bare "satan" reaches the horror
 *                 and myth boards, where it means something else and is worth
 *                 considerably less at auction.
 *   dr. gero      matched with the honorific for symmetry and because "gero"
 *                 is four letters in a game with several thousand names.
 *   king kai      in full. Bare "kai" sits inside Supreme Kai, Old Kai and,
 *                 on the Yu-Gi-Oh board, Seto Kaiba — the last of which the
 *                 boundary check would have caught and the first two of which
 *                 it would not.
 *   captain ginyu in full, so that the Ginyu Force's other members keep their
 *                 own cards. Only the man who does the body-swapping gets the
 *                 body-swapping mechanic.
 *   frieza        clean — Golden Frieza and Mecha Frieza are VARIANT lines and
 *                 captains no longer read variants.
 *
 * Six of these rows also reach the general anime board, which prints its own
 * Frieza, Piccolo, Krillin, Master Roshi, Bardock and Beerus. Left that way
 * deliberately, on the precedent index.ts sets for Marvel and X-Men: they are
 * the same characters, and this is the file that writes them as Dragon Ball
 * characters rather than as anime ones.
 */
import type { CaptainRow } from "./index";

export const DBZ_CAPTAINS: CaptainRow[] = [
  // ── The two nobody bids on ───────────────────────────────────────────────
  {
    match: "whis",
    fx: {
      k: "command", atk: 3, def: 3, grace: 2, swap: 4,
      label: "He is not going to be joining in",
      note:
        "+3/+3, two planes of any gap stop counting, and four substitutions — the " +
        "densest captaincy in the game, on a card most tables let through for the price " +
        "of a Krillin. Whis is a butler. He trains the God of Destruction, is explicitly " +
        "stronger than him, has never fought anybody on screen, and can rewind the last " +
        "three minutes of anything if he decides it went badly. The correct pick on " +
        "this board is a man holding a staff and a plate of food.",
    },
  },
  {
    match: "vados",
    fx: {
      k: "command", atk: 2, def: 2, grace: 1, swap: 4,
      when: "round", then: { heal: 1 },
      label: "Older sister, better numbers",
      note:
        "Four substitutions, a plane of grace and a point back to the line every " +
        "round. Vados is Whis's older sister, has stated on the record that she is " +
        "stronger than he is, and has never been given a reason to demonstrate it. She " +
        "costs a third of what he does at auction for the sole reason that she was in " +
        "fewer episodes.",
    },
  },
  {
    match: "bulma",
    fx: {
      k: "command", atk: 1, def: 0, grace: 2, swap: 3,
      label: "She built the thing you are standing on",
      note:
        "Two planes of grace, three substitutions and essentially no stat bonus — the " +
        "Tyrion pick, on a board where the alternative is a man who can destroy a " +
        "planet. Bulma built the Dragon Radar, reverse-engineered a Saiyan scouter in " +
        "an afternoon, repaired an alien spacecraft with no manual, and built the time " +
        "machine that is the reason there is anybody left to draft. She has a power " +
        "level of five.",
    },
  },

  // ── Gods, and the one that is a child ────────────────────────────────────
  {
    match: "beerus",
    fx: {
      k: "command", atk: 4, def: 0,
      doom: { atk: -4, def: -2 },
      label: "He is only awake for the food",
      note:
        "+4 attack for your line and −4/−2 for theirs, which is the heaviest doom on " +
        "the board. Beerus destroys planets for a living, sleeps for decades at a time " +
        "so that the universe can catch its breath, and has erased entire civilisations " +
        "over a disappointing meal. Nothing on the other side is fighting worse because " +
        "of a tactic. They are fighting worse because of the arithmetic.",
    },
  },
  {
    match: "zeno",
    fx: {
      k: "command", atk: 0, def: 0, swap: 0,
      doom: { atk: -5, def: -4 },
      label: "He is not angry, which is the frightening part",
      note:
        "Your line receives nothing. Not a point, not a substitution, not a word of " +
        "advice. The other line comes out at −5/−4 and stays there. Zeno is a small " +
        "cheerful child who holds hands with people he likes and has, twice, erased " +
        "every universe in existence because a tournament was not going well. He is not " +
        "helping you. He has simply removed some of them.",
    },
  },
  {
    match: "shenron",
    fx: {
      k: "command", atk: 0, def: 0, raise: 3,
      label: "Name your wish",
      note:
        "No stat bonus of any kind and three of your dead get back up, the joint-best " +
        "raise in the game and the only one on this board that is simply the card's " +
        "printed function. Shenron does not fight, does not advise and does not have " +
        "opinions. He appears, he asks what you want, he does it, and he leaves for a " +
        "year. Everybody on this board has died at least once and it has never stuck.",
    },
  },

  // ── The people who actually taught everybody ─────────────────────────────
  {
    match: "king kai",
    fx: {
      k: "command", atk: 2, def: 1, grace: 2, swap: 3,
      label: "Everyone can hear everyone",
      note:
        "Two planes of grace and three substitutions from a small blue man with " +
        "antennae who lives on a planet the size of a garden and has lost every fight " +
        "he has ever been in. King Kai teaches the Spirit Bomb and the Kaio-ken, and — " +
        "the part that matters here — links the entire team's minds telepathically " +
        "across any distance, which is the single most useful thing anybody on this " +
        "board can do. He will also tell a joke first and wait.",
    },
  },
  {
    match: "master roshi",
    fx: {
      k: "command", atk: 2, def: 2, grace: 1, swap: 2,
      label: "He taught the ones who taught the rest",
      note:
        "+2/+2, a plane of grace and two substitutions from a card most tables treat " +
        "as a joke pick. Roshi invented the Kamehameha, trained Goku and Krillin from " +
        "nothing, trained Goku's ADOPTIVE GRANDFATHER before that, and at three hundred " +
        "years old turned up to a tournament of gods and made a genuine contribution. " +
        "Every serious card on this board traces back through him.",
    },
  },
  {
    match: "piccolo",
    fx: {
      k: "command", atk: 3, def: 3, grace: 1, swap: 3, lends: "ward",
      label: "The only one who plans anything",
      note:
        "+3/+3, three substitutions and the whole line takes less from every blow. " +
        "Piccolo is the tactician of this cast by default, because the alternative is " +
        "several men who fight better when they are losing. He worked out the Cell " +
        "strategy, trained Gohan into the strongest thing on the board, fused twice " +
        "when the numbers demanded it, and is the only person here who has ever " +
        "voluntarily left a fight.\n\n(King Piccolo matches this row too. He is the " +
        "same person, and was told so at length.)",
    },
  },
  {
    match: "bardock",
    fx: {
      k: "command", atk: 3, def: 0, grace: 2,
      when: "alone", then: { atk: 4 },
      label: "He has already seen how this goes",
      note:
        "+3 attack, two planes of grace, and +4 more once there is nobody left to send " +
        "in front of him. Bardock is a low-class Saiyan soldier who was given " +
        "precognition as an injury, spent the rest of his very short life watching his " +
        "own death and everybody else's, told them, and was not believed by a single " +
        "person. He went up alone anyway.",
    },
  },

  // ── The ones whose mechanic is somebody else's body ──────────────────────
  {
    match: "captain ginyu",
    fx: {
      k: "command", atk: 2, def: 1, swap: 4,
      label: "Change places with me",
      note:
        "Four substitutions, joint most in the game, and it is the least metaphorical " +
        "substitution in this file: Ginyu's actual technique is swapping bodies with " +
        "whoever is in front of him. He is a middling fighter who has spent a career " +
        "borrowing better ones, insists on the poses first, and has ended up in a frog " +
        "more than once for exactly that reason.",
    },
  },
  {
    match: "babidi",
    fx: {
      k: "command", atk: 1, def: 0, swap: 3,
      doom: { atk: -2, def: -1 },
      label: "The M goes on the forehead",
      note:
        "Three substitutions and −2/−1 to the other line, from a small yellow wizard " +
        "with no combat ability whatsoever who has never once won a fight and has " +
        "commanded most of the strongest cards on this board. Babidi does not recruit. " +
        "He finds the worst thing a person is already thinking, turns the volume up, " +
        "and puts his initial on them.",
    },
  },
  {
    match: "dr. gero",
    fx: {
      k: "command", atk: 1, def: 1, raise: 3,
      label: "He does not recruit, he manufactures",
      note:
        "Three of your fallen back on their feet, the best raise on this board, from a " +
        "scientist who worked out that the reliable way to have an unbeatable fighter " +
        "on your side is to build one. Gero made the Androids, made Cell out of stolen " +
        "cell samples, and — when his own body became the bottleneck — took his brain " +
        "out and put it in a machine. Every single one of them turned on him.",
    },
  },

  // ── The ones who are simply violence ─────────────────────────────────────
  {
    match: "frieza",
    fx: {
      k: "command", atk: 5, def: -1,
      when: "kill", then: { atk: 2 },
      doom: { atk: -2 },
      label: "He has never fought fair and considers that the point",
      note:
        "+5/−1, −2 to the other line, and it keeps climbing with every kill. The " +
        "single most aggressive captaincy in the file. Frieza runs an interstellar " +
        "empire built on subordinates he is entirely willing to spend, has destroyed " +
        "planets to save himself an argument, and came back from being cut in half by " +
        "his own attack because hell was boring. Your line will hit like nothing else " +
        "on this board and he will not mind how many of them come home.",
    },
  },
  {
    match: "jiren",
    fx: {
      k: "command", atk: 4, def: 4, swap: 0,
      when: "alone", then: { atk: 6 },
      label: "He does not need you",
      note:
        "+4/+4 and not one substitution, then +6 more the instant he is the last one " +
        "standing. Jiren is the strongest mortal in any universe on this board and his " +
        "entire arc is the belief that trusting other people is what got his family " +
        "killed. He fights alone, he says so out loud, and the one thing that has ever " +
        "beaten him was somebody who had four people behind him.",
    },
  },
  {
    match: "krillin",
    fx: {
      k: "command", atk: 1, def: 1, raise: 2,
      when: "allyDown", then: { atk: 3 },
      label: "Somebody always dies and it is usually him",
      note:
        "+3 attack to everyone still standing every time one of yours falls, and two " +
        "of them get back up. Krillin has died more times than anybody in this " +
        "franchise and each one of them was the trigger for something enormous — the " +
        "first Kaio-ken, the first Super Saiyan, most of Goku's worst days. He is a " +
        "2/3 who has never won a serious fight, and his captaincy is the single most " +
        "load-bearing mechanic in the entire series.",
    },
  },
  {
    match: "mr. satan",
    fx: {
      k: "command", atk: 5, def: 3, swap: 0,
      label: "Every single person believes him",
      note:
        "+5/+3 to your whole line — the largest flat bonus in this file — from a man " +
        "with a 2/3 stat line who has never landed a meaningful punch and whose " +
        "championship belt is a clerical error that got out of hand. It is not " +
        "misprinted. The Spirit Bomb that killed Buu failed, twice, because the planet " +
        "would not give its energy to Goku, whom nobody had heard of; it worked on the " +
        "third attempt because Mr. Satan asked. Morale is a real stat and this is the " +
        "only card on the board that has it.",
    },
  },
];
