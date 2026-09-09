/**
 * World-pantheon captains.
 *
 * Same joke as the Greek board and told in more accents: every mythology on
 * earth independently arrived at the conclusion that the most powerful being
 * around is also the one you should least like to be in business with. So this
 * board is trickster-heavy on purpose — Anansi, Wukong and Baba Yaga are three of
 * the best captains here, not one of them can take a straight fight against the
 * gods above them in the tier list, and all three have won by not having one.
 *
 * Loki is written on the Marvel board, which is listed ahead of this one, and
 * Zeus, Hera, Athena, Poseidon, Hades, Ares, Artemis, Medusa, Cerberus and
 * Sisyphus are all captained out of `greek.ts`. That is the registry working
 * exactly as intended: a character does not stop being themselves because they
 * were printed in a different pack. It also means this board carries more
 * captains per card than any other, which is fair — half of it is gods.
 */
import type { CaptainRow } from "./index";

export const MYTH_CAPTAINS: CaptainRow[] = [
  {
    match: "odin",
    fx: {
      k: "command", atk: 2, def: 1, raise: 2,
      when: "allyDown", then: { atk: 2 },
      label: "Collecting for later",
      note:
        "+2/+1, two of your dead back on their feet, and the survivors two attack harder " +
        "for each one that fell. He is not saving them and he is not mourning them. He is " +
        "recruiting, for a battle at the end of the world that he already knows he loses, " +
        "and he traded an eye and nine days on a tree for the information.",
    },
  },
  {
    match: "chulainn",
    fx: {
      k: "command", atk: 3, def: -1, lends: "first",
      when: "alone", then: { atk: 4 },
      label: "The warp spasm",
      note:
        "+3/−1 and the line moves first, and if it comes down to him alone he takes " +
        "the field four attack higher. He held a ford against an army by himself for " +
        "months, and when he finally took the wound that killed him he tied himself " +
        "upright to a standing stone so that nobody would notice for three days. Nobody " +
        "did.",
    },
  },
  { match: "sun wukong", fx: { k: "command", atk: 2, def: 1, grace: 1, swap: 3, when: "kill", then: { atk: 1 }, label: "Seventy-two of him", note: "Three substitutions from a captain who can simply be the substitution, plus a plane of grace and attack on every kill. He ate the peaches, scratched his name on what he was told was the edge of the universe, and fought heaven to a standstill over a job title." } },
  { match: "anansi", fx: { k: "command", atk: 1, def: 1, grace: 1, swap: 3, label: "Owns every story", note: "A spider with no strength at all, three substitutions and a plane of grace. He bought all the stories in the world off the sky god by delivering a hornet swarm, a python, a leopard and a fairy, none of which he could have beaten, all of which he talked into a bag." } },
  { match: "morr", fx: { k: "command", atk: 2, def: 1, doom: { atk: -2, def: -1 }, when: "allyDown", then: { atk: 2 }, label: "She has already picked", note: "The enemy line at −2/−1 and yours harder for every loss. She does not fight the battle; she washes the armour of the man who is going to lose it, in a river, where he can see her, the morning before. Nobody has ever changed the result after that." } },
  { match: "baba yaga", fx: { k: "command", atk: 2, def: 2, swap: 2, raise: 1, when: "round", then: { def: -1 }, label: "Terms and conditions", note: "+2/+2, two substitutions, one of your dead returned — and your line loses a point of health every round for as long as she is behind it. She will help. She has always helped. There is a price, it was never stated up front, and it is being collected right now." } },
  { match: "guan yu", fx: { k: "command", atk: 2, def: 2, lends: "first", when: "alone", then: { atk: 3 }, label: "Oath of the Peach Garden", note: "+2/+2, the line moves first, and +3 attack if it comes down to him. He was captured by the enemy, treated magnificently, given a horse and a title, and walked all of it back across a continent to a brother who was losing. He is a god now for that and not for the fighting." } },
  { match: "amaterasu", fx: { k: "command", atk: 3, def: 2, grace: 1, doom: { def: -1 }, label: "Came out of the cave", note: "+3/+2 and a plane of grace, which is the sun being pointed at your side of the field. Worth remembering how the story goes: she sulked in a hole and put the entire world into permanent night over an argument with her brother, and the other gods got her out by throwing a party outside the door and refusing to explain the noise." } },
];
