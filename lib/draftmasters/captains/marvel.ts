/**
 * Marvel captains.
 *
 * Fury, Captain America, Professor X and Doom are already in the core
 * registry, and between them they cover the obvious reading of the board:
 * command as competence. What is here is the other reading, which Marvel is
 * far better at — the captain whose contribution is not to your line at all.
 * Thanos subtracts from theirs. Mysterio makes them swing at nothing. Aunt May
 * cannot lift a shield and is the best thing that can happen to a team that is
 * losing people.
 *
 * The X-Men on this board are handled in `xmen.ts`, since they are the same
 * characters and this game has no interest in two Magnetos.
 */
import type { CaptainRow } from "./index";

export const MARVEL_CAPTAINS: CaptainRow[] = [
  {
    match: "thanos",
    fx: {
      k: "command", atk: 1, def: 1, swap: 1, doom: { atk: -2, def: -3 },
      label: "Perfectly balanced",
      note:
        "The enemy line arrives at −2/−3 and it lands before the first round, so " +
        "you watch the fight start already decided rather than working out later " +
        "why the numbers looked wrong. Thanos is the only captain in the game whose " +
        "ability is a subtraction. He is not making your team better. He is making " +
        "theirs smaller, and he would tell you that is the same job, done properly.",
    },
  },
  {
    match: "doctor strange",
    fx: {
      k: "command", atk: 1, def: 1, grace: 1, swap: 3,
      label: "Fourteen million outcomes",
      note:
        "Three substitutions, which is as many as anyone gets, and he does not " +
        "waste them — a captain only pulls a card out of a matchup that is already " +
        "lost, and Strange has watched every one of those before it happened. The " +
        "plane gap shortens too, because he keeps telling the line where the thing " +
        "in front of them actually is rather than where it appears to be.",
    },
  },
  {
    match: "loki",
    fx: {
      k: "command", atk: 0, def: 1, swap: 2, when: "allyDown", then: { atk: 2 },
      label: "Glorious purpose",
      note:
        "Nearly worthless while the line is winning; every ally who falls hands the " +
        "survivors two more attack. Draft him for a squad you expect to bleed. It " +
        "is the most honest description of Loki anyone has managed: he is only ever " +
        "useful once things have gone wrong, and he does seem to prefer it that way.",
    },
  },
  {
    match: "ultron",
    fx: {
      k: "command", atk: 1, def: 1, swap: 1, raise: 3,
      label: "There are more of me",
      note:
        "Three of your dead come back up. Ultron does not mourn a body — he has " +
        "never been in one for long and cannot see why anybody makes a fuss. The " +
        "genuinely unpleasant part of promoting him is that he treats your line " +
        "exactly the way he treats himself, and it is the best raise on the board.",
    },
  },
  {
    match: "galactus",
    fx: {
      k: "command", atk: 3, def: 0, when: "kill", then: { heal: 2 },
      label: "The Hunger",
      note:
        "+3 attack, and every kill the line takes puts two health back into " +
        "everyone still standing. He is not commanding anybody. He is eating in the " +
        "same postcode and the overspill is enough. No substitutions and no plane " +
        "grace, because both of those require noticing an individual, and he does " +
        "not.",
    },
  },
  {
    match: "iron man",
    fx: {
      k: "command", atk: 1, def: 3, swap: 2, lends: "ward",
      label: "He builds one for everybody",
      note:
        "+1/+3 and every blow the line takes lands lighter, because all five of " +
        "them are wearing something Tony made and did not ask them about first. He " +
        "is a worse fighter than half the cards he is standing behind and the " +
        "reason the other half get home.",
    },
  },
  {
    match: "mysterio",
    fx: {
      k: "command", atk: 0, def: 0, swap: 1, doom: { atk: -3 },
      label: "None of this is here",
      note:
        "The enemy line loses three attack and keeps swinging with total " +
        "confidence, which is the point. Quentin Beck is a fired effects technician " +
        "with no powers of any kind and a tier-two price tag, and he is one of the " +
        "best captains on this board. Whether that is the funniest thing in the game " +
        "or the bleakest depends entirely on which side of him you drafted.",
    },
  },
  {
    match: "kingpin",
    fx: {
      k: "command", atk: 1, def: 2, swap: 3,
      label: "Everyone here works for me",
      note:
        "Three substitutions. Fisk does not out-fight anyone and does not intend " +
        "to; he decides who is standing where, and he settled most of that weeks " +
        "ago with money. The +1/+2 is not inspiration. It is that nobody on the " +
        "line wants to be the one who disappointed him.",
    },
  },
  {
    match: "aunt may",
    fx: {
      k: "command", atk: 1, def: 1, when: "allyDown", then: { atk: 2, heal: 2 },
      label: "Somebody has to look after them",
      note:
        "Every time one of yours goes down, everyone left gets two attack and two " +
        "health back. She is a tier-one card with no combat value whatsoever and she " +
        "is the single best thing that can happen to a line that is losing people, " +
        "because the rest of them have quietly decided she is not going to see " +
        "another one.",
    },
  },
];
