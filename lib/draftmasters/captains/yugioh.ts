/**
 * Yu-Gi-Oh! captains.
 *
 * The one board in the game where the distinction between a fighter and a
 * captain is already the source material's own. Half these entries are a
 * monster and half are a teenager holding it, and the teenager has never
 * thrown a punch in his life — which is precisely the shape the command
 * mechanic was built for. A duelist IS a captain. That is the whole franchise.
 *
 * So the numbers here are deliberately lopsided: the duelists get grace,
 * substitutions and doom, and the monsters get attack. Blue-Eyes is the most
 * famous card in the hobby and a genuinely poor captaincy, because a Blue-Eyes
 * has never in three decades been asked its opinion about anything.
 *
 * ── Name collisions ────────────────────────────────────────────────────────
 *
 * This board is mostly long distinctive names, but four fragments needed
 * deliberate handling and one of them is an ordering dependency:
 *
 *   dark magician girl   MUST stay above "dark magician", which matches it.
 *                        First match of a kind wins, so if the shorter row
 *                        moves up, the Girl silently inherits the Magician's
 *                        command and loses the one written for her — which is
 *                        the worse outcome twice over, because hers is the
 *                        canonical one. Do not reorder these two.
 *   maximillion pegasus  matched in full rather than on "pegasus", which would
 *                        have handed command of the Greek board's actual
 *                        Pegasus to a man in a red suit who invented a card
 *                        game.
 *   the winged dragon of ra   in full, obviously. "ra" is two letters and
 *                        would reach into most of the game.
 *   kuriboh              DELIBERATELY also matches Winged Kuriboh. They are
 *                        the same joke with wings and they should command
 *                        identically. Left as-is on purpose.
 *
 * "yugi muto" is matched in full rather than on "yugi" — not because anything
 * currently collides, but because this board also contains Yuma, Yuya, Yusei,
 * Yubel and Yuki, and the margin there is one character. It does also reach
 * the Yugi Muto printed on the general anime board, which is intended: same
 * boy, same hair, same command.
 */
import type { CaptainRow } from "./index";

export const YUGIOH_CAPTAINS: CaptainRow[] = [
  // ── The duelists, who are the actual captains of this franchise ──────────
  {
    match: "yugi muto",
    fx: {
      k: "command", atk: 1, def: 1, grace: 1, swap: 3,
      when: "allyDown", then: { atk: 2 },
      label: "Heart of the cards",
      note:
        "Three substitutions, a plane of grace, and the line gets angrier every time " +
        "one of yours goes down. Yugi has never won a duel by having the better deck. " +
        "He wins them by drawing the one card in forty that solves the board, at the " +
        "exact moment somebody he cares about is about to lose something, and then " +
        "explaining afterwards that this is a real mechanic. Nobody has managed to " +
        "disprove it in twenty-five years.",
    },
  },
  {
    match: "seto kaiba",
    fx: {
      k: "command", atk: 2, def: 1, swap: 4,
      label: "Screw the rules",
      note:
        "Four substitutions, the joint most in the game, and the reason is not " +
        "tactical: Kaiba owns the company that prints the cards, the stadium the fight " +
        "is happening in, and the satellite watching it. Anyone else pulling a card out " +
        "of a losing matchup is making a difficult call. Kaiba is placing an order.",
    },
  },
  {
    match: "maximillion pegasus",
    fx: {
      k: "command", atk: 0, def: 1, grace: 2,
      doom: { atk: -2, def: -1 },
      label: "He has already read your hand",
      note:
        "Two planes of grace for your line and −2/−1 for theirs, from a man who has " +
        "never held anything heavier than a wine glass. The Millennium Eye shows him " +
        "exactly what the other side is holding, and the thing people forget is that he " +
        "also INVENTED the game — every card on this board is something he drew, costed " +
        "and decided to allow.",
    },
  },
  { match: "marik ishtar", fx: { k: "command", atk: 3, def: 0, doom: { atk: -2 }, label: "The Rod does the asking", note: "+3 attack for your line and −2 for theirs. Marik does not motivate anybody; the Millennium Rod takes the decision out of it entirely, which is a considerably more reliable management technique than the one Yugi uses and reads much worse in the write-up." } },
  { match: "ishizu ishtar", fx: { k: "command", atk: 0, def: 2, grace: 2, swap: 1, label: "The Necklace shows her the end", note: "Two planes of any gap stop counting and almost nothing else. Ishizu has seen how this fight finishes, in order, and can describe it to everyone in your line before it starts. She is also the only person in this franchise who has ever used a Millennium Item to prevent something rather than to win with it." } },
  { match: "bakura", fx: { k: "command", atk: 2, def: 1, raise: 2, doom: { atk: -1 }, label: "There are two of him", note: "+2/+1, two of your fallen back on their feet, and the other side a point weaker. Bakura is a polite, quiet British schoolboy sharing a body with a three-thousand-year-old thief, and the arrangement has never once been clarified to anybody's satisfaction. Whichever one you promoted, the other one is also captaining." } },

  // ── The monsters, in descending order of how much command they represent ─
  {
    match: "exodia",
    fx: {
      k: "command", atk: 0, def: 0,
      when: "round", then: { atk: 2, def: 2 },
      label: "Assembling",
      note:
        "Nothing whatsoever on the bell, and then +2/+2 to the whole line every round " +
        "with no ceiling, which makes this the largest snowball in the game. It is also " +
        "exactly what the card does: Exodia is five pieces, does not fight, cannot be " +
        "summoned, and simply ends the duel the moment all of it is in the same place. " +
        "The only thing standing between you and that is time, and time is on the board.",
    },
  },
  { match: "obelisk the tormentor", fx: { k: "command", atk: 2, def: 2, when: "allyDown", then: { atk: 3 }, label: "Two tributes", note: "+2/+2, and +3 attack to everyone still standing every time one of yours falls. This is Obelisk's actual printed effect rendered honestly: it converts your own monsters into damage, on purpose, as the intended line of play. The Egyptian God that asks the most of its own side, and the one that gives the most back for it." } },
  { match: "slifer the sky dragon", fx: { k: "command", atk: 3, def: 1, when: "round", then: { atk: 1 }, label: "It counts what you are holding", note: "+3/+1 and another point of attack every round, forever. Slifer's power has always been a function of resources in reserve rather than of Slifer, which is the closest a giant red sky-serpent has ever come to being an economic argument." } },
  { match: "the winged dragon of ra", fx: { k: "command", atk: 4, def: 0, raise: 2, label: "Phoenix mode", note: "+4 attack and two of your dead get up. Ra is the one Egyptian God that is genuinely difficult to use — the summoning chant is in hieratic, most duelists cannot read it, and it has burned its own controller more than once — and it is also the only one that has ever brought anything back." } },
  {
    match: "dark magician girl",
    fx: {
      k: "command", atk: 1, def: 1,
      when: "allyDown", then: { atk: 2 },
      label: "Every fallen magician counts",
      note:
        "+2 attack to the survivors each time one of yours goes down, which is not a " +
        "reading of the character — it is her printed effect, word for word: she gains " +
        "power for every magician already in the graveyard. She is the apprentice. The " +
        "mechanic is grief, and it is on the card.\n\n(This row must stay above " +
        "\"dark magician\", which also matches her name. If it moves, she silently " +
        "inherits his command and loses her own.)",
    },
  },
  { match: "dark magician", fx: { k: "command", atk: 2, def: 2, grace: 1, lends: "first", label: "The ultimate wizard in terms of attack and defence", note: "+2/+2, a plane of grace and the line moves first. Yugi's ace, three thousand years of continuous service, and a monster whose official English flavour text is a sentence that has been quoted mockingly at conventions since 2002 and is, annoyingly, accurate." } },
  { match: "jinzo", fx: { k: "command", atk: 2, def: 1, doom: { atk: -2, def: -1 }, label: "No traps", note: "+2/+1 and −2/−1 to the other side, because Jinzo's whole existence is the removal of the other player's options. Everything clever the opposition had set up quietly stops functioning, and there is no counterplay written anywhere, which is why it was in every single deck for four years." } },
  {
    match: "blue-eyes white dragon",
    fx: {
      k: "command", atk: 5, def: 0, swap: 0,
      label: "It does not take instruction",
      note:
        "+5 attack — the largest flat bonus in this file — no health, and not one " +
        "substitution. The most recognisable card in the hobby is a terrible captain " +
        "and it is worth understanding why: a Blue-Eyes has never been asked anything. " +
        "It is summoned, it is pointed at something, and the something stops existing. " +
        "Your line will hit like nothing else on this board and it will be entirely on " +
        "its own out there.",
    },
  },
  {
    match: "kuriboh",
    fx: {
      k: "command", atk: 0, def: 1, lends: "ward",
      label: "It takes the hit for you",
      note:
        "A single point of health and every blow that reaches your line reaches it " +
        "lighter, from a 300-attack ball of fur that has decided the correct response " +
        "to a nine-foot dragon is to stand in front of it. Kuriboh has swung more duels " +
        "than most of the monsters above it and has never dealt a point of damage in " +
        "its life.\n\n(Winged Kuriboh matches this row too. That is deliberate — it is " +
        "the same joke with wings, and it should command the same way.)",
    },
  },
];
