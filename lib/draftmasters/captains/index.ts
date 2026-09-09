/**
 * Written captains, one file per board.
 *
 * Roughly one card in six should be worth promoting for its own sake — the
 * Tyrion, the Cersei, the Olenna: a card you would spend real money on at
 * auction purely for what it does from behind the line. The other five in six
 * fall back to a ROLE derived from the card itself (see `roleFor` in
 * battle.ts), which is a genuine choice but never an exciting one.
 *
 * Split by board rather than kept in `battle.ts` for a boring reason that
 * matters: this is the part of the game that grows forever, and a single
 * two-thousand-line list is a file nobody can edit two things in at once.
 *
 * A captain here is matched exactly like any other effect — on a fragment of
 * the card's name or variant — and the first match of each kind wins, so a
 * board file can safely name a character another board also has.
 */
import type { CardEffect } from "../battle";

export type CaptainRow = { match: string; fx: CardEffect };

import { GOT_CAPTAINS } from "./got";
import { XMEN_CAPTAINS } from "./xmen";
import { MARVEL_CAPTAINS } from "./marvel";
import { DC_CAPTAINS } from "./dc";
import { STARWARS_CAPTAINS } from "./starwars";
import { LOTR_CAPTAINS } from "./lotr";
import { ANIME_CAPTAINS } from "./anime";
import { GREEK_CAPTAINS } from "./greek";
import { MYTH_CAPTAINS } from "./myth";
import { DBZ_CAPTAINS } from "./dbz";
import { GODZILLA_CAPTAINS } from "./godzilla";
import { TVD_CAPTAINS } from "./tvd";
import { CW_CAPTAINS } from "./cw";
import { SPN_CAPTAINS } from "./spn";
import { HORROR_CAPTAINS } from "./horror";
import { BOSSES_CAPTAINS } from "./bosses";
import { FIGHTERS_CAPTAINS } from "./fighters";
import { MISC_CAPTAINS } from "./misc";
import { YUGIOH_CAPTAINS } from "./yugioh";
import { ANIMALS_CAPTAINS } from "./animals";
import { POKEMON_CAPTAINS } from "./pokemon";

/**
 * Every board's captains, in one list.
 *
 * Order is only significant within a kind — first match wins — so boards are
 * listed most specific first, which in practice means the ones whose names
 * are least likely to collide with anybody else's.
 */
export const CAPTAINS: CaptainRow[] = [
  ...GOT_CAPTAINS,
  // X-Men before Marvel, because sixteen of these people are printed on both
  // boards and the mutant file is the one that writes them as mutants. Cyclops
  // captaining an X-Men squad and an Avengers squad the same way is correct;
  // him captaining them differently because of which pack you opened is not.
  ...XMEN_CAPTAINS,
  ...MARVEL_CAPTAINS,
  ...DC_CAPTAINS,
  // Star Wars before the pantheons: Hera Syndulla is a general with her own
  // command and would otherwise be captained by the queen of the gods, who
  // does not know what a Twi'lek is.
  ...STARWARS_CAPTAINS,
  // Middle-earth before Norse, for Thorin and Denethor, both of whom contain
  // a thunder god and neither of whom would take orders from one.
  ...LOTR_CAPTAINS,
  ...ANIME_CAPTAINS,
  // Greek before world-pantheon, because the Olympians are printed on both
  // boards and the Greek file is the one that writes them properly.
  ...GREEK_CAPTAINS,
  ...MYTH_CAPTAINS,

  // Dragon Ball before the anime board: six of its names are printed on both
  // and this file is the one that knows which character it is talking about.
  ...DBZ_CAPTAINS,
  ...GODZILLA_CAPTAINS,
  ...TVD_CAPTAINS,
  ...CW_CAPTAINS,
  ...SPN_CAPTAINS,
  ...HORROR_CAPTAINS,
  ...BOSSES_CAPTAINS,
  ...FIGHTERS_CAPTAINS,
  ...MISC_CAPTAINS,
  ...YUGIOH_CAPTAINS,
  ...ANIMALS_CAPTAINS,

  // Last on purpose. Six hundred and forty-nine short names is the likeliest
  // place in the game for an accidental reach, so anything already claimed by
  // a hand-written board keeps it.
  ...POKEMON_CAPTAINS,
];
