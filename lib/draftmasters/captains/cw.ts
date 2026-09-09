/**
 * CW captains.
 *
 * One hundred and seventeen cards and eleven shows, which makes this the
 * broadest board in the game and the one with the strangest internal logic:
 * a Kryptonian, a speedster, a witch, a time-travelling assassin and a man
 * from Riverdale can all end up in the same four-card line, and the show that
 * did it aired for nine years. So the commands here are written around the
 * thing the network is actually good at — somebody in a chair with a headset
 * telling four people who cannot beat what they are facing exactly how to beat
 * it anyway. This board has more `grace` and more `swap` than any other.
 *
 * OWNERSHIP, WHICH IS THE WHOLE PROBLEM WITH THIS FILE.
 *
 *   Mystic Falls    Not written here. Klaus, Damon, Stefan, Elena, Bonnie,
 *                   Caroline, Katherine, Elijah, Rebekah, Kai, Silas, Hope
 *                   and Alaric all sit on the `tvd` board and are captained
 *                   from `tvd.ts`. They pick those commands up here for free.
 *   The Winchesters Same arrangement with `spn.ts`: Dean, Sam, Castiel,
 *                   Crowley, Lucifer, Chuck, Rowena, Jack, Bobby and Billie
 *                   are written once, on the board where they belong.
 *   Arrowverse DC   Superman, Lex Luthor, Brainiac, Martian Manhunter and
 *                   Ra's al Ghul are already captained out of `dc.ts` and the
 *                   core registry, and none of them are rewritten here. Same
 *                   character, same orders.
 *
 * COLLISION NOTES.
 *
 *   lena luthor     Full name, because "luthor" would take Lex and Lionel as
 *                   well, and Lex is already captained in the core registry.
 *   jonathan kent   Full name. "kent" alone reaches Clark, which would put a
 *                   Kansas farmer in charge of his own son. Tempting; wrong.
 *   alice           Genuinely unique across all twenty-six packs, which was
 *                   checked rather than assumed, because a four-letter
 *                   fragment on a board this size is how you end up with the
 *                   Mad Hatter commanding a Pokémon.
 *   damien darhk    Full name, and note the spelling: "damien" alone also
 *                   lands on Damien Thorn, the Antichrist, on the horror
 *                   board. They would get on.
 *   malcolm merlyn  Full name. Merlyn with a Y is an archer from Starling
 *                   City; Merlin with an I is on the myth board and would
 *                   like it on the record that they are unrelated.
 *   thunder         NOT captained. Black Lightning's daughter shares the
 *                   fragment with the Thunder Megazord, and one of them is a
 *                   hundred-foot robot.
 *
 * KNOWN, AND LEFT ALONE. Brainiac 5 inherits Brainiac's captaincy from
 * `dc.ts`, because the fragment "brainiac" reaches him and he is, in fairness,
 * named after it. Arrow's Prometheus inherits the Titan's from `greek.ts`.
 * Both men are defined entirely by a plan that ruins them personally, so the
 * game is arguably ahead of us here.
 */
import type { CaptainRow } from "./index";

export const CW_CAPTAINS: CaptainRow[] = [
  {
    match: "eobard thawne",
    fx: {
      k: "command", atk: 1, def: 1, grace: 2, swap: 2,
      when: "round", then: { atk: 1 },
      label: "Run, Barry, run",
      note:
        "Two planes off the gap, two substitutions, and the line gets a point of attack " +
        "every round it survives. The most expensive card on the board and it is not close. " +
        "Thawne has been running the other side's team since before the draft: he built " +
        "the particle accelerator, he trained the hero, he chose which of your friends " +
        "died and in what order, and the season finale is always him explaining it.",
    },
  },
  {
    match: "jonathan kent",
    fx: {
      k: "command", atk: 2, def: 3, swap: 1,
      label: "Raised him right",
      note:
        "+2/+3, which is a better line than most of the Kryptonians on this board give " +
        "you. Jonathan Kent is a farmer with no powers, a bad heart and one genuinely " +
        "world-historical achievement: the strongest man alive is not a problem, and the " +
        "only reason for that is this man's opinion of how you treat people.",
    },
  },
  {
    match: "felicity smoak",
    fx: {
      k: "command", atk: 0, def: 1, grace: 2, swap: 3,
      label: "The woman in the chair",
      note:
        "Three substitutions and two planes off the gap for a stat line of essentially " +
        "nothing, which makes her one of the best captains in the game and one of the " +
        "worst fighters in it. Everything Team Arrow has ever accomplished was somebody " +
        "in a warehouse being told, calmly and in real time, where the roof access is.",
    },
  },
  {
    match: "rip hunter",
    fx: {
      k: "command", atk: 2, def: 0, swap: 3,
      when: "allyDown", then: { atk: 2 },
      label: "Chosen for being expendable",
      note:
        "+2 attack, three substitutions, and another +2 to everyone left every time one " +
        "of yours goes down. Rip assembled the Legends by scanning the timeline for people " +
        "whose deaths would change nothing, told them they were legends, and only mentioned " +
        "the criteria later. He is very good at this. That is the unsettling part.",
    },
  },
  {
    match: "sara lance",
    fx: {
      k: "command", atk: 2, def: 1, grace: 1, swap: 2, raise: 1,
      label: "Captain Lance",
      note:
        "The most rounded captaincy on the board — attack, health, a plane off the gap, " +
        "substitutions and one of your dead back up. She is also the only person here " +
        "whose literal job title is captain. Trained by the League, drowned, resurrected " +
        "into a homicidal fugue, talked down, and then handed a timeship, which she flies " +
        "better than the man who built it.",
    },
  },
  {
    match: "malcolm merlyn",
    fx: {
      k: "command", atk: 3, def: 0,
      doom: { def: -1 },
      label: "The Undertaking",
      note:
        "+3 attack for your line and a point of health off theirs. Malcolm's response to " +
        "personal grief was a five-year plan to level a postcode with an earthquake " +
        "machine, executed on schedule, on budget, and with a second one in reserve for " +
        "when the first was stopped. Everything he touches works and nobody who follows " +
        "him is glad they did.",
    },
  },
  {
    match: "damien darhk",
    fx: {
      k: "command", atk: 1, def: 1, lends: "ward",
      doom: { atk: -2, def: -1 },
      label: "Insufferable, and correct",
      note:
        "−2/−1 to the enemy line and every blow that lands on yours lands lighter. Darhk " +
        "does magic, which nothing else in Star City can answer, and he does it while " +
        "making small talk about your haircut. He is the only villain on this board who " +
        "appears to be enjoying himself, and the only one who came back with his daughter " +
        "and got a better arc out of it.",
    },
  },
  {
    match: "vandal savage",
    fx: {
      k: "command", atk: 1, def: 1, raise: 1,
      when: "round", then: { atk: 1, def: 1 },
      label: "He has done this before",
      note:
        "Modest to open and it never stops climbing — the whole line takes +1/+1 every " +
        "round, with no ceiling, and one of your fallen gets up. Savage is an immortal " +
        "Egyptian priest who has fought this exact battle for four thousand years and has " +
        "notes. Lose to him early and you will not notice. Lose to him in round eight and " +
        "you will not have a line.",
    },
  },
  {
    match: "gorilla grodd",
    fx: {
      k: "command", atk: 2, def: 1, grace: 1,
      doom: { atk: -1 },
      label: "Grodd is displeased",
      note:
        "+2/+1, a plane off the gap and a point of attack off theirs. Grodd is a telepath " +
        "with an army and a city, and the reason he is on this list rather than in the " +
        "line is that his best weapon has always been standing somewhere else deciding " +
        "what your team does next.",
    },
  },
  {
    match: "lena luthor",
    fx: {
      k: "command", atk: 2, def: 2,
      when: "allyDown", then: { atk: 2 },
      label: "Everyone lies to her eventually",
      note:
        "+2/+2, and another +2 attack to everyone still standing every time one of yours " +
        "falls. Lena is the smartest person on the board and the plot's designated " +
        "punching bag: four consecutive seasons of being kept in the dark by people who " +
        "love her, each of which made her materially more dangerous. This is that, printed.",
    },
  },
  {
    match: "john diggle",
    fx: {
      k: "command", atk: 1, def: 2, lends: "first",
      label: "Actually a soldier",
      note:
        "+1/+2 and the whole line moves first. No magic, no speed force, no ring — " +
        "Diggle is a man with two tours behind him standing in a room full of people who " +
        "learned to fight on an island, and he is the only one of them who has been taught " +
        "to do it as a unit. He also carries every emotional beat in the building.",
    },
  },
  {
    match: "alice",
    fx: {
      k: "command", atk: 2, def: 0, swap: 2,
      doom: { atk: -1, def: -1 },
      when: "alone", then: { atk: 4 },
      label: "Nobody left to disappoint",
      note:
        "+2 attack, two substitutions, the enemy line at −1/−1, and +4 more the moment " +
        "there is nobody on your side but her. Beth Kane spent eleven years in a basement " +
        "waiting for a sister who had stopped looking, and everything she has done since " +
        "is an elaborate way of asking why. She is much better on her own and that is not " +
        "a compliment.",
    },
  },
  {
    match: "chloe sullivan",
    fx: {
      k: "command", atk: 0, def: 0, grace: 1, swap: 2,
      doom: { atk: -2 },
      label: "The Wall of Weird",
      note:
        "The enemy line comes out two attack short and yours gets no stats at all. Chloe " +
        "was keeping a corkboard on every meteor freak in Kansas while the actual " +
        "superheroes were still working out whether to have a costume. She knows what the " +
        "other side is, where it came from and what happened to it in 1989, and the entire " +
        "value of that is what it takes away from them.",
    },
  },
  {
    match: "jay garrick",
    fx: {
      k: "command", atk: 1, def: 2, grace: 1, raise: 1,
      label: "The first one",
      note:
        "+1/+2, a plane off the gap and one of your dead back on their feet. Jay is the " +
        "Flash from before this Flash, from a world that mostly did not survive, and his " +
        "entire remaining function is making sure the young one does. Every board should " +
        "have one card whose ability is having already been through it.",
    },
  },
];
