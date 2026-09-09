/**
 * Middle-earth captains.
 *
 * Tolkien wrote one book about a war and spent it almost entirely on people
 * deciding whether to try. Half the decisive moments in the legendarium are a
 * speech, a refusal, or somebody's nerve going at the wrong hour, and that is
 * a mechanic before it is a theme: this board leans harder on `doom` than any
 * other, because the standard Middle-earth victory is the enemy line breaking
 * before it is beaten.
 *
 * It is also the only board with a captain who is actively bad for you, and he
 * is correctly priced at nothing. See Denethor.
 *
 * `mouth of sauron` is listed before `sauron ` on purpose — first match wins,
 * and the herald's name contains his master's. The trailing space on `sauron `
 * is doing the same job from the other end: two cards on this board carry the
 * word at the end of a variant line, and neither of them is him.
 *
 * Aragorn and Gandalf are already written in `battle.ts`.
 */
import type { CaptainRow } from "./index";

export const LOTR_CAPTAINS: CaptainRow[] = [
  { match: "mouth of sauron", fx: { k: "command", atk: 1, def: 1, doom: { atk: -1, def: -1 }, label: "Speaks for him", note: "The enemy line comes out at −1/−1 and never learns why. He does not fight, does not ride, and has beaten better men than anyone else on this list by opening a bag and putting a shirt on the table." } },
  {
    match: "fëanor",
    fx: {
      k: "command", atk: 3, def: 1, grace: 1,
      when: "allyDown", then: { atk: 2 },
      label: "The Oath",
      note:
        "+3/+1, a plane of grace, and two more attack for the survivors every time one " +
        "of yours goes down. Greatest of the Noldor, made the finest things ever made, " +
        "swore an oath in front of his seven sons and then spent every one of them and " +
        "several thousand other people keeping it. He is the best captain on this board " +
        "and it is not clear he has ever been on anyone's side but his own.",
    },
  },
  {
    match: "sauron ",
    fx: {
      k: "command", atk: 2, def: 2, grace: 1, raise: 1,
      doom: { def: -1 },
      label: "He is not on the field",
      note:
        "+2/+2, a plane of grace, one of your fallen back up and a point off the enemy's " +
        "health. He does not appear in the fight and has not appeared in a fight in an " +
        "age. He is an eye on a tower and an idea in nine other people's heads, and the " +
        "whole war is being fought at his convenience.",
    },
  },
  { match: "théoden", fx: { k: "command", atk: 3, def: 0, lends: "first", when: "alone", then: { atk: 3 }, label: "Ride now, ride for ruin", note: "+3 attack, the line moves first, and if it comes down to him alone he takes the field three attack higher. He spent years slumped in a chair being told what to think and then got up and led the best cavalry charge anybody has written." } },
  { match: "saruman", fx: { k: "command", atk: 1, def: 1, swap: 3, doom: { atk: -2 }, label: "The Voice", note: "Three substitutions and the enemy line comes out two attack down, having been talked out of some of it on the way in. Every power he has is a voice, a library and the confidence of a man who has read more than you. It works on everybody except a gardener." } },
  // Trailing space: Frodo carries "stung by Shelob" as a variant and was, for one
  // draft, being captained by the thing that stung him.
  { match: "shelob ", fx: { k: "command", atk: 2, def: 1, doom: { atk: -1, def: -1 }, when: "allyDown", then: { def: 2 }, label: "Nothing that follows her comes back", note: "The enemy line at −1/−1, and yours gets tougher every time one of them goes down — because she is eating them, and a fed spider is a calmer spider. She serves nobody, took no side in the war, and has been in that tunnel since before Sauron had a name for himself. Promote her and you are not gaining an ally; you are agreeing on a menu." } },
  { match: "galadriel", fx: { k: "command", atk: 1, def: 3, grace: 1, lends: "ward", label: "All shall love me and despair", note: "+1/+3, a plane of grace, and the whole line takes less from every blow. She was offered the Ring, described in detail exactly what she would become with it, and then handed it back — which is the single most frightening thing anybody does in the book." } },
  { match: "samwise", fx: { k: "command", atk: 1, def: 2, raise: 1, lends: "mend", when: "alone", then: { atk: 3, def: 3 }, label: "I can carry you", note: "+1/+2, a fallen ally back on their feet, life drawn back to you on kills — and if everyone else is gone he takes the field at +3/+3. He is a gardener. He is on this list above four kings and two wizards and the book agrees with the placement." } },
  { match: "thorin", fx: { k: "command", atk: 3, def: 0, swap: 1, when: "kill", then: { atk: 1, def: -1 }, label: "The Arkenstone", note: "+3 attack, and the line gains attack and loses health with every kill — which is exactly what happens to a company the closer it gets to the treasure. He is a genuinely great commander for about eleven-twelfths of a campaign." } },
  {
    match: "denethor",
    fx: {
      k: "command", atk: 3, def: -2, swap: 0,
      when: "allyDown", then: { def: -1 },
      label: "The West has failed",
      note:
        "+3 attack and −2 health, no substitutions, and the line gets frailer every time " +
        "one of them dies. The trap card of the board and it should stay in the game: he " +
        "was a capable steward with better sight than anybody around him, and he used it " +
        "to look at exactly what Sauron wanted him to look at until he was certain it was " +
        "hopeless. Everything he does under this heading is competent. All of it is aimed " +
        "the wrong way.",
    },
  },
];
