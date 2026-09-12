/**
 * What the model said happened, checked against what was actually drafted.
 *
 * This lives outside the route because it is the part that has to be RIGHT.
 * It is pure -- a told story and the rosters in, a trustworthy story out --
 * and every bug the players have caught in the battle has been in here: a
 * casualty nobody drafted, a card dying twice, an MVP silently dropped
 * because the model wrote its variant into the name, and a fight that carried
 * on after one side was wiped and started killing the winner's own cards.
 * Out here it can be tested; in the route it could only be watched.
 */

export interface CardIn {
  name: string;
  /** What this card is worth, as a band. See power.ts -> bandOf. */
  power?: string | null;
  /** The condition this copy was drafted in, if it rolled one. */
  variant?: string | null;
  /** How good or bad that condition is — our roll, not canon. */
  grade?: string | null;
  abilities?: string[];
}

/**
 * A grade, in words the model can use.
 *
 * This is the only influence we exert on the fight, and it is deliberately
 * qualitative. The model already knows what these characters can do; what it
 * cannot know is which VERSION of them turned up today, because that is our
 * dice roll and not canon.
 */
export interface Body {
  arena?: string | null;
  scenario?: string | null;
  sides?: {
    id: string;
    name: string;
    cards: CardIn[];
    /** The player's own case for why they win, in their words. */
    argument?: string | null;
  }[];
}

/**
 * One paragraph, and who leaves the board while the reader is reading it.
 *
 * The model does not write this shape -- it writes prose and a roll-call, and
 * sanitise works out which paragraph each name belongs to. What is here is
 * what the screen needs: as the crawl reaches this paragraph, these portraits
 * go out.
 */
export interface TellBeat {
  /** One paragraph of the fight. */
  text: string;
  /** Exact card names that die in this beat. Usually none or one. */
  kills?: string[];
  /**
   * Exact card names that CHANGE SIDES in this beat.
   *
   * The Night King raising the dead is not friendly fire and it is not a
   * casualty -- it is the best thing that can happen in a Westeros battle, and
   * with nowhere to record it the story had to pretend it was one or the
   * other. A turned card is gone from the side that drafted it, which is what
   * matters for who is left standing.
   */
  turned?: string[];
  /**
   * Exact card names that are NULLED in this beat.
   *
   * The third way off the board, and the one that only exists because these
   * boards are not all people. A greyscale, a curse, a scorpion on a wall, a
   * wight host -- things that end without dying, because they were never
   * alive. Battles used to hang forever on exactly these: the model would
   * kill nine cards and leave a disease standing, because it could not picture
   * stabbing it.
   */
  nulled?: string[];
}

/** The one card the battle turned on, and what they did. */
export interface TellMvp {
  name: string;
  note: string;
}

export interface Told {
  /**
   * As the MODEL sends it: casualties are roster NUMBERS. What comes back out
   * of sanitise is always resolved card names, which is why the beat type here
   * is wider than TellBeat -- the loose shape goes in, the strict one comes
   * out, and nothing downstream ever sees a number.
   */
  /**
   * The prose, with the roster numbers still in it.
   *
   * "He goes over the rail [2 dead]" -- the bracket says which card leaves
   * the board and how, and sanitise lifts it out before anybody reads the
   * sentence. A paragraph with no bracket takes nobody.
   */
  beats: { text: string }[];
  winner: string;
  /**
   * The side the model committed to losing, before it wrote a word.
   *
   * Declarative: nothing here branches on it. It is in the schema because a
   * storyteller that has decided who loses writes a battle that ends, and one
   * that has not writes until it runs out of paragraphs.
   */
  loser?: string | null;
  /** Named by whoever wrote the fight, since only they know how it went. */
  /**
   * As the MODEL sends it: a number, or a name from an older answer. What
   * comes back out of sanitise is always a resolved {name, note}.
   */
  mvp?: { id?: number | string; name?: string; note?: string } | null;
  /** Why that side won, in plain words. Written in the same call as the
   *  story so the explanation cannot disagree with what was narrated -- and
   *  so one battle costs one request. */
  verdict: string;
  /**
   * What the storyteller did with each player's case.
   *
   * A weight of 0-3 and one sentence. The case's TEXT never comes back from
   * the model: it came from the player, and a model paraphrasing somebody's
   * own words back at them on the screen where they read them is not a thing
   * worth risking.
   */
  cases?: { id?: string | number; weight?: number | string; note?: string }[] | null;
  /**
   * Bands the storyteller overruled, and why.
   *
   * Never shown to anybody. It is a bug report for power.ts written by the
   * only thing that reads every card on every board -- which is how the next
   * Manwe gets found before a player has to screenshot it.
   */
  scaling?: { id?: number | string; note?: string }[] | null;
}

/**
 * Did this story actually finish the fight?
 *
 * The game's whole promise is a winner and a loser: one roster in the ground,
 * the other still standing. A told story that simply runs out of beats with
 * people alive on both sides leaves the result to be decided on a head-count,
 * which is not a battle anybody watched.
 */
/**
 * A battle as it leaves this file: every card resolved, every state settled.
 *
 * Deliberately a different type from `Told`, which is what the MODEL sends.
 * They stopped being the same shape once a card could leave the board three
 * ways -- the model says "converts" and "nulls" with numbers in them, the
 * screen needs "turned" and "nulled" with names -- and pretending otherwise is
 * how you end up reading a field that is never there.
 */
/** A player's case, and what the battle did with it. */
export interface TellCase {
  sideId: string;
  /** Whose case it was, for the panel. */
  name: string;
  /** Their own words, straight from the body -- never the model's copy. */
  text: string;
  /** 0 ignored, 1 small, 2 shaped the fight, 3 decided it. */
  weight: number;
  note: string;
}

export interface Settled {
  beats: TellBeat[];
  winner: string;
  verdict: string;
  mvp: TellMvp | null;
  /** One entry per side that wrote a case. Empty when nobody did. */
  cases: TellCase[];
}

/** Anything carrying beats, told or settled. */
type HasBeats = {
  beats: { kills?: (string | number)[]; turned?: string[]; nulled?: string[] }[];
};

/**
 * Does the story's own declared winner match the one the bench shows?
 *
 * sanitise recomputes the winner from who is still standing, because the
 * portraits are the one thing a player can check for themselves. When the
 * model has declared the OTHER side, everything it wrote around that is about
 * a different result -- a player read "mclevesque wins!" over a summary
 * explaining why The Shark's numbers had been decisive, both on one screen.
 *
 * A winner we cannot place on this board is not a disagreement we can prove,
 * so it passes: this only ever catches a stated, resolvable contradiction.
 */
export function agreesOnWinner(told: { winner?: string }, settled: Settled, b: Body): boolean {
  const said = String(told.winner ?? "").trim().toLowerCase();
  if (!said) return true;
  const hit = (b.sides ?? []).find(
    (s) => s.id.trim().toLowerCase() === said || s.name.trim().toLowerCase() === said
  );
  return !hit || hit.id === settled.winner;
}

export function finished(told: HasBeats, b: Body): boolean {
  // Gone is gone: a card that changed sides is no longer standing for the
  // side that drafted it, and a roster emptied by conversion is just as
  // finished as one emptied by killing.
  const gone = new Set<string | number>([
    ...(told.beats ?? []).flatMap((x) => x.kills ?? []),
    ...(told.beats ?? []).flatMap((x) => x.turned ?? []),
    ...(told.beats ?? []).flatMap((x) => x.nulled ?? []),
  ]);
  return (b.sides ?? []).some((s) => s.cards.every((c) => gone.has(c.name)));
}

/** Names as given, so a hallucinated casualty cannot cross anybody out. */
/** A casualty given as a roster number rather than a name. */
const isNumber = (raw: unknown): boolean =>
  typeof raw === "number" || /^\s*\d{1,2}\s*$/.test(String(raw ?? ""));

export function sanitise(told: Told, b: Body): Settled {
  const real = new Map<string, string>();
  /**
   * Every card on the board, numbered.
   *
   * The brief hands the model these numbers and asks for casualties BY number,
   * which takes the whole class of name-matching problem off the table: no
   * variant folded into a name ("Ultimate Gohan" for a card called "Gohan"),
   * no two Gokus to tell apart, no fuzzy containment match that has to decide
   * how close is close enough. A number means exactly one card or nothing.
   *
   * Numbers run straight through both rosters -- 1..5 for the first side,
   * 6..10 for the second -- and never appear on screen.
   */
  const byNumber = new Map<number, string>();
  let n = 0;
  for (const s of b.sides ?? []) {
    for (const c of s.cards) {
      real.set(c.name.toLowerCase(), c.name);
      byNumber.set(++n, c.name);
    }
  }

  /**
   * Whatever the model wrote, resolved back to a card that was actually
   * drafted. A NUMBER is the intended path and settles it outright.
   *
   * The rest is the fallback for a model that answers with names anyway.
   * Exact match first, then containment, because a model writing names folds
   * the drafted CONDITION into them -- calling a card named "Gohan" carrying
   * the variant "Ultimate Gohan" exactly that, which is right in the prose and
   * unmatchable as a key. Containment only counts when EXACTLY ONE card can be
   * meant: on a board holding both "Goku" and "Goku (GT)", a bare "Goku" is
   * dropped rather than guessed at, because crossing out the wrong card is
   * worse than crossing out none.
   */
  const resolve = (raw: unknown): string | undefined => {
    // A number is the whole answer when it is one.
    if (isNumber(raw)) return byNumber.get(Number(raw));
    const q = String(raw ?? "").toLowerCase().trim();
    if (q.length < 3) return undefined;
    const exact = real.get(q);
    if (exact) return exact;
    const hits = [...real.entries()].filter(([k]) => k.includes(q) || q.includes(k));
    return hits.length === 1 ? hits[0][1] : undefined;
  };

  /** Which side each card belongs to, and how many of each are still up. */
  const sideOf = new Map<string, string>();
  const standing = new Map<string, number>();
  for (const s of b.sides ?? []) {
    standing.set(s.id, s.cards.length);
    for (const c of s.cards) sideOf.set(c.name, s.id);
  }

  /**
   * A headline the paragraph has to earn -- see `loud` below.
   *
   * Allies do not attack allies. A player watched Meleys burn her own line one
   * teammate after another with nothing in the prose saying why, and that
   * reads as the game being broken rather than as a story.
   */
  const CALLOUT = /^(friendly fire|betrayal)\s*[!:]+\s*/i;
  /**
   * Two paragraphs joined, or null when the join would run long.
   *
   * Folding a set-up into its blow is only worth it while the result is still
   * short: live, a 34-word set-up landed on a 28-word kill and made a 62-word
   * block, which is the wall of text "short and sweet" was asked to remove.
   * Past the cap the set-up is cut, and the blow reads on its own.
   */
  const fold = (x: string, y: string) =>
    `${x} ${y}`.split(/\s+/).length <= 50 ? `${x} ${y}` : null;

  /**
   * THE NUMBER IN THE PROSE IS THE RESULT.
   *
   * Every card has a roster number, and the storyteller writes that number
   * into the sentence where the card goes down: "he goes over the rail
   * [2 dead]". The bracket is lifted out before anybody reads it -- the
   * player sees the sentence, and the board crosses out number 2 in that
   * exact paragraph.
   *
   * There is no name matching left in this file. It used to work out which
   * paragraph a casualty belonged to by looking for the card's name in the
   * prose, which meant guessing: "Clegane" for Gregor Clegane, and "his
   * vision blurred" for Vision. A number cannot be guessed at. It means one
   * card, and it sits in one paragraph.
   */
  const MARK = /\[\s*(\d+)\s*([a-z]*)\s*\]/gi;
  /** The fate a marker names. Anything unrecognised is a death. */
  const fateOf = (word: string): "kills" | "turned" | "nulled" =>
    /^(conv|turn|betr|rais|join|defect)/i.test(word)
      ? "turned"
      : /^null/i.test(word)
        ? "nulled"
        : "kills";
  /** Whitespace and orphaned punctuation left where a marker was lifted out. */
  const tidy = (s: string) =>
    s
      .replace(/\s+/g, " ")
      .replace(/\s+([.,;:!?])/g, "$1")
      .trim();

  const usedUp = new Set<string>();
  /**
   * Each paragraph with its markers read off and taken out of the text.
   *
   * Read in order, so a number written twice only counts the first time --
   * a card does not leave the board twice, whatever the prose does later.
   */
  /**
   * The fight ends when a roster is empty, whatever the prose does next.
   *
   * Left to itself the model sometimes keeps going after one team is wiped
   * out -- and with no opponents left, the survivors start killing each
   * other. A player watched their own bench get crossed out one card at a
   * time in a battle they had already won. So markers past the wipe are read
   * and thrown away: the brackets come out of the text either way, and
   * nobody dies after the last opponent falls.
   */
  let over = false;
  const read = (told.beats ?? [])
    .map((b) => {
      const raw = String(b?.text ?? "");
      const falls: { name: string; how: "kills" | "turned" | "nulled" }[] = [];
      for (const m of raw.matchAll(MARK)) {
        const name = byNumber.get(Number(m[1]));
        if (over || !name || usedUp.has(name)) continue;
        usedUp.add(name);
        falls.push({ name, how: fateOf(m[2] ?? "") });
        const side = sideOf.get(name);
        if (side) standing.set(side, (standing.get(side) ?? 1) - 1);
        if ([...standing.values()].some((x) => x <= 0)) over = true;
      }
      return { text: tidy(raw.replace(MARK, " ")), falls };
    })
    .filter((x) => x.text);

  /** The paragraph the last card goes down in. The fight is over after it. */
  let ending = -1;
  read.forEach((x, i) => {
    if (x.falls.length) ending = i;
  });

  const beats: TellBeat[] = [];
  /**
   * Prose from a paragraph that takes nobody, held for the next one that
   * does. Every paragraph changes a portrait -- that is the rhythm the screen
   * promises -- and a set-up paragraph is not thrown away, because the blow
   * after it usually leans on it. It becomes the opening of the paragraph it
   * sets up.
   */
  let carry = "";
  for (let i = 0; i < read.length; i++) {
    // Past the last card going down: one closing paragraph, and the story
    // stops. Anything after that is a second fight nobody asked for.
    if (ending >= 0 && i > ending + 1) break;
    const here = read[i].falls;
    const callout = CALLOUT.exec(read[i].text);
    const text = callout ? read[i].text.slice(callout[0].length).trim() : read[i].text;
    // A headline is only earned by somebody changing sides. "BETRAYAL!" over
    // an ordinary blow is just shouting, and gets taken off.
    const loud =
      callout && here.some((x) => x.how === "turned") ? `${callout[1].toUpperCase()}!` : "";

    if (!here.length) {
      /**
       * A paragraph that takes nobody is allowed -- but never two running.
       *
       * A death in every single one made the battle a list of executions with
       * no room to breathe; letting them pile up made it a story where
       * nothing happens. So one quiet paragraph stands, and a second folds
       * into the next one that lands a blow.
       */
      if (ending < 0) {
        beats.push({ text });
        continue;
      }
      const prev = beats[beats.length - 1];
      const prevWasQuiet =
        !!prev && !(prev.kills?.length || prev.turned?.length || prev.nulled?.length);
      if (!prev || prevWasQuiet || carry) {
        carry = carry ? fold(carry, text) ?? carry : text;
        continue;
      }
      beats.push({ text });
      continue;
    }

    // A headline has to open its paragraph, so set-up that is still waiting
    // goes on the end of the paragraph before instead.
    const prev = beats[beats.length - 1];
    if (loud && carry && prev) {
      prev.text = fold(prev.text, carry) ?? prev.text;
      carry = "";
    }
    const body = carry ? fold(carry, text) ?? text : text;
    carry = "";
    const beat: TellBeat = { text: loud ? `${loud} ${body}` : body };
    for (const { name, how } of here) beat[how] = [...(beat[how] ?? []), name];
    beats.push(beat);
  }

  // Set-up that never paid off: the model stopped before the blow it was
  // building to. Kept on the last paragraph rather than lost.
  if (carry) {
    const tail = beats[beats.length - 1];
    if (tail) tail.text = fold(tail.text, carry) ?? tail.text;
    else beats.push({ text: carry });
  }


  // Whoever still has somebody standing won, whatever the model wrote in the
  // field -- this is the one fact the prose is not allowed to contradict.
  const alive = (b.sides ?? []).map((s) => ({
    id: s.id,
    left: s.cards.filter((c) => !usedUp.has(c.name)).length,
  }));
  const best = alive.slice().sort((x, y) => y.left - x.left)[0];

  /**
   * "Side B" is a label for the model, not a word either player has seen.
   *
   * The brief says so and it mostly holds, but the verdict and the MVP note
   * are the two lines everybody reads twice, so they get a deterministic
   * backstop rather than another paragraph of prompt asking nicely.
   */
  const named = (text: string) => {
    let out = text;
    for (const side of b.sides ?? []) {
      const id = side.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(`\\bside\\s+${id}\\b`, "gi"), side.name);
    }
    return out;
  };

  // Checked against the real roster like the casualties are. A made-up name
  // here would put a card on the payoff screen that nobody drafted.
  const rawMvp = told.mvp;
  const mvpName = resolve(rawMvp?.id ?? rawMvp?.name);
  const mvp = mvpName
    ? { name: mvpName, note: named(String(rawMvp?.note ?? "").trim()) }
    : null;

  /**
   * Each case, put back beside the ruling it earned.
   *
   * The words come from the BODY, not from the answer: the model is told what
   * somebody wrote and rules on it, and the player reads their own sentence
   * back exactly as they typed it with the ruling underneath.
   */
  const rulings = new Map<string, { weight: number; note: string }>();
  const stray: { weight: number; note: string }[] = [];
  for (const row of told.cases ?? []) {
    const want = String(row?.id ?? "").trim().toLowerCase();
    const side = (b.sides ?? []).find(
      (s) => s.id.toLowerCase() === want || s.name.trim().toLowerCase() === want
    );
    const weight = Math.max(0, Math.min(3, Math.round(Number(row?.weight)) || 0));
    const ruling = { weight, note: named(String(row?.note ?? "").trim()) };
    if (side && !rulings.has(side.id)) rulings.set(side.id, ruling);
    else if (ruling.note) stray.push(ruling);
  }
  // A ruling under an id we cannot place, with exactly one case left
  // unanswered: that is whose it is. Anything less certain stays unassigned
  // rather than putting one player's ruling under the other's words.
  const unanswered = (b.sides ?? []).filter(
    (s) => (s.argument ?? "").trim() && !rulings.has(s.id)
  );
  if (stray.length === 1 && unanswered.length === 1) rulings.set(unanswered[0].id, stray[0]);
  const cases: TellCase[] = (b.sides ?? [])
    .filter((s) => (s.argument ?? "").trim())
    .map((s) => ({
      sideId: s.id,
      name: s.name,
      text: (s.argument ?? "").trim(),
      weight: rulings.get(s.id)?.weight ?? 0,
      note: rulings.get(s.id)?.note ?? "",
    }));

  return {
    beats,
    winner: best?.id ?? told.winner,
    verdict: named(String(told.verdict ?? "").trim()),
    mvp,
    cases,
  };
}
