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
  beats: {
    text: string;
    kills?: (string | number)[];
    converts?: (string | number)[];
    nulls?: (string | number)[];
    by?: string | number;
  }[];
  winner: string;
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

/** The drafted parenthetical, e.g. "Goku (GT)" -> "Goku". */
const PAREN = /\s*\(.*\)\s*$/;
const WORDS = /[^a-z0-9']+/;

/** Does this paragraph name this card, by full name or a distinctive word? */
function mentions(text: string, card: string): boolean {
  const hay = text.toLowerCase();
  const bare = card.replace(PAREN, "").trim().toLowerCase();
  if (!bare) return false;
  if (hay.includes(bare)) return true;
  return bare
    .split(WORDS)
    .filter((w) => w.length >= 4)
    .some((w) => hay.includes(w));
}

/**
 * Cards the board says are gone that the prose never mentions.
 *
 * Casualties arrive as roster numbers and a number is taken at its word, so a
 * portrait can grey out in silence -- the reader watches a card leave the
 * board in the middle of a sentence about somebody else. The route asks for
 * the battle again when this comes back with anybody in it.
 */
export function unnamedRemovals(s: Settled): string[] {
  const missed: string[] = [];
  for (const beat of s.beats) {
    for (const name of [...(beat.kills ?? []), ...(beat.turned ?? []), ...(beat.nulled ?? [])]) {
      if (!mentions(beat.text, name)) missed.push(name);
    }
  }
  return missed;
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

  /**
   * Does this beat's prose back up a casualty given BY NAME?
   *
   * Only ever applied to the name fallback, never to a number. A number is
   * proof: it points at one card and the portrait dies, whatever the prose
   * decided to call them -- "the Great Ape", "the overgrown monkey", or a
   * pronoun three sentences after the introduction. A NAME is a guess, and a
   * guess the paragraph does not support would grey somebody out in the middle
   * of a sentence about somebody else.
   *
   * Matched on the bare name first, then on any distinctive word in it, since
   * prose properly writes "Clegane" or "Hightower" after the introduction
   * rather than the full name every time.
   */
  const namedIn = (text: string, card: string): boolean => {
    const hay = text.toLowerCase();
    const bare = card.replace(/\s*\(.*\)\s*$/, "").toLowerCase().trim();
    if (bare && hay.includes(bare)) return true;
    return bare
      .split(/[^a-z0-9']+/)
      .filter((w) => w.length >= 4)
      .some((w) => hay.includes(w));
  };

  /** Which side each card belongs to, and how many of each are still up. */
  const sideOf = new Map<string, string>();
  const standing = new Map<string, number>();
  for (const s of b.sides ?? []) {
    standing.set(s.id, s.cards.length);
    for (const c of s.cards) sideOf.set(c.name, s.id);
  }

  const usedUp = new Set<string>();
  const beats: TellBeat[] = [];
  /**
   * Where each card left the board, so the dead can still be raised.
   *
   * The Night King kills a man and then stands him back up wearing blue --
   * which is the best thing he does, and the board could not hold it: one
   * state per card meant the raise was dropped and the bench said DEAD under
   * prose about him getting up. A conversion may take somebody already
   * killed, and it moves them from the dead list to the turned one.
   */
  const placed = new Map<string, { beat: TellBeat; list: "kills" | "turned" | "nulled" }>();
  /**
   * Whether a card has already been taken out by its own side this battle.
   *
   * Allies do not attack allies. A player watched Meleys burn her own line one
   * teammate after another with nothing in the prose saying why, and that
   * reads as the game being broken rather than as a story. So a same-side kill
   * is honoured only in a paragraph that headlines it -- opening "FRIENDLY
   * FIRE!" or "BETRAYAL!" -- only once a battle, and never to the last card on
   * a side, because a team may not finish itself off.
   */
  const CALLOUT = /^(friendly fire|betrayal)\s*[!:]+\s*/i;
  /**
   * Two paragraphs joined, or null when the join would run long.
   *
   * Folding a set-up into its kill is only worth it while the result is still
   * short: live, a 34-word set-up landed on a 28-word kill and made a 62-word
   * block, which is the wall of text "short and sweet" was asked to remove.
   * Past the cap the set-up is cut, and the kill reads on its own.
   */
  const fold = (a: string, b: string) =>
    `${a} ${b}`.split(/\s+/).length <= 50 ? `${a} ${b}` : null;
  let ownGoal = false;
  /** Set the moment a side runs out. The battle is over; one closing paragraph may follow. */
  let over = false;
  /** Paragraphs seen since the wipe, so the search for an ending is bounded. */
  let pastWipe = 0;
  /**
   * Prose from beats that took nobody off the board, held for the next one
   * that does.
   *
   * Every paragraph changes a portrait -- that is the rhythm the screen
   * promises. A set-up paragraph is not thrown away, because the kill after it
   * usually leans on it; it becomes the opening of the paragraph it sets up.
   */
  let carry = "";

  for (const raw of told.beats ?? []) {
    let text = String(raw?.text ?? "").trim();
    if (!text) continue;

    /**
     * The fight ends when a side is empty, whatever the model wrote next.
     *
     * Left to itself it sometimes keeps going after one team is wiped out --
     * and with no opponents left to fight, the survivors start killing each
     * other. A player watched their own bench get crossed out one card at a
     * time in a battle they had already won. So the wipe is the end of the
     * killing: one closing paragraph may follow -- the survivors eyeing each
     * other, what it cost -- and then the story stops.
     */
    if (over) {
      /**
       * Past the wipe, the only thing still worth having is the ending.
       *
       * A paragraph that is still killing is a second fight -- keeping its
       * text while dropping its casualties would narrate deaths the bench
       * never shows. But the model often writes one of those and THEN the
       * real closing paragraph, and cutting at the first one threw the
       * ending away with it. So the killing ones are dropped and the next
       * quiet paragraph closes the story, within a couple of tries.
       */
      const removes =
        (raw?.kills ?? []).length + (raw?.converts ?? []).length + (raw?.nulls ?? []).length;
      if (!removes) {
        beats.push({ text: text.replace(CALLOUT, "").trim() });
        break;
      }
      if (++pastWipe >= 3) break;
      continue;
    }

    // The headline is read, taken off, and put back only if the beat really
    // does what it announces -- see `loudHere` below.
    const callout = CALLOUT.exec(text);
    const loud = callout ? `${callout[1].toUpperCase()}!` : "";
    if (callout) text = text.slice(callout[0].length).trim();

    const kills: string[] = [];
    const turned: string[] = [];
    const nulled: string[] = [];
    /** Blows refused for landing on their own side without a headline. */
    let refused = 0;
    let ownHere = false;
    // Who swung. Given as a roster number like the casualties are, so a side
    // can be read off it without guessing at names in the prose.
    const killerSide = sideOf.get(resolve(raw?.by) ?? "");

    /**
     * The two quiet ways off the board, counted before the killing.
     *
     * DEAD, CONVERTED and NULLED are the three states, and a roster loses when
     * every card on it is in one of them. Any of the three may take the last
     * card on a side: a team wiped out, a team turned, a team of things that
     * simply stopped -- all of those are endings the game has.
     */
    const takeOut = (
      list: (string | number)[] | undefined,
      into: string[],
      changesSides = false
    ) => {
      for (const c of list ?? []) {
        const hit = resolve(c);
        if (!hit) continue;
        if (usedUp.has(hit)) {
          // Raising somebody this battle already killed: they change lists,
          // and they change sides. Anything else is a card leaving twice.
          const was = placed.get(hit);
          if (!changesSides || !was || was.list !== "kills") continue;
          was.beat.kills = (was.beat.kills ?? []).filter((x) => x !== hit);
          if (!was.beat.kills.length) delete was.beat.kills;
          into.push(hit);
          const old = sideOf.get(hit);
          const to = (b.sides ?? []).find((x) => x.id !== old)?.id;
          if (to) sideOf.set(hit, to);
          continue;
        }
        const from = sideOf.get(hit);
        if (!from) continue;
        usedUp.add(hit);
        into.push(hit);
        standing.set(from, (standing.get(from) ?? 1) - 1);
        // A turned card fights for the other team from here. Without this the
        // board still had Jon Snow down as a Stark after the Night King raised
        // him, so his next blow read as friendly fire and was thrown out.
        if (changesSides) {
          const to = (b.sides ?? []).find((x) => x.id !== from)?.id;
          if (to) sideOf.set(hit, to);
        }
      }
    };
    /**
     * Does everything this beat kills belong to the striker's own side?
     *
     * A paragraph can hold a TRADE -- one side's blow and the answer to it --
     * and there is only one "by" for the whole paragraph, so it cannot
     * describe both. Read as the killer of everybody, it turned Fingolfin
     * killing Achilles into Hermes killing his own teammate: the kill was
     * refused, the prose still said he died, and the battle could not finish.
     * Friendly fire is only refused when EVERY card the beat takes is on the
     * striker's own side, which is what Meleys burning her own line looks like.
     */
    const victimSides = new Set(
      (raw?.kills ?? [])
        .map((k) => {
          const who = resolve(k);
          return who ? sideOf.get(who) : undefined;
        })
        .filter((x): x is string => Boolean(x))
    );
    const oneSided = victimSides.size <= 1;

    takeOut(raw?.converts, turned, true);
    takeOut(raw?.nulls, nulled);
    for (const k of raw?.kills ?? []) {
      const byNum = isNumber(k);
      const hit = resolve(k);
      // Unknown card, or somebody who already died: dropped rather than
      // trusted. The story survives a missing crossing-out; it does not
      // survive a card dying twice or a card that was never drafted dying.
      if (!hit || usedUp.has(hit)) continue;
      // A number is taken at its word. A NAME the paragraph never supports is
      // not -- see namedIn.
      if (!byNum && !namedIn(text, hit)) continue;

      const victimSide = sideOf.get(hit);
      if (killerSide && victimSide && killerSide === victimSide && oneSided) {
        // Not headlined, this battle's one already spent, or the last card
        // that side has. Any of those and the story does not get to have it.
        if (!loud || ownGoal || (standing.get(victimSide) ?? 0) <= 1) {
          refused += 1;
          continue;
        }
        ownGoal = true;
        ownHere = true;
      }

      usedUp.add(hit);
      kills.push(hit);
      const side = sideOf.get(hit);
      if (side) standing.set(side, (standing.get(side) ?? 1) - 1);
    }

    if (!kills.length && !turned.length && !nulled.length) {
      // Every blow it claimed was refused as friendly fire, so the prose
      // narrates allies dying who stay up on the bench. A small jump in the
      // story is better than a paragraph that lies about the portraits.
      if (refused) continue;

      /**
       * A paragraph that takes nobody is allowed -- but never two running.
       *
       * A kill in every single one made the battle a list of executions with
       * no room to breathe; letting them pile up made it a story where
       * nothing happens. So one quiet paragraph stands, and a second folds
       * into the next one that lands a blow.
       */
      const last = beats[beats.length - 1];
      const lastWasQuiet =
        !!last && !(last.kills?.length || last.turned?.length || last.nulled?.length);
      if (!last || lastWasQuiet || carry) {
        carry = carry ? fold(carry, text) ?? carry : text;
        continue;
      }
      beats.push({ text });
      continue;
    }

    // A headline the beat does not earn -- "BETRAYAL!" over an ordinary kill --
    // is dropped. One it does earn has to open the paragraph, so set-up that
    // is waiting goes on the end of the paragraph before instead.
    const loudHere = loud && (ownHere || turned.length > 0) ? loud : "";
    const prev = beats[beats.length - 1];
    if (loudHere && carry && prev) {
      prev.text = fold(prev.text, carry) ?? prev.text;
      carry = "";
    }
    const body = carry ? fold(carry, text) ?? text : text;
    carry = "";
    const settledBeat: TellBeat = {
      text: loudHere ? `${loudHere} ${body}` : body,
      ...(kills.length ? { kills } : {}),
      ...(turned.length ? { turned } : {}),
      ...(nulled.length ? { nulled } : {}),
    };
    beats.push(settledBeat);
    for (const [list, names] of [
      ["kills", kills],
      ["turned", turned],
      ["nulled", nulled],
    ] as const) {
      for (const name of names) placed.set(name, { beat: settledBeat, list });
    }
    if ([...standing.values()].some((n) => n <= 0)) over = true;
  }

  // Set-up that never paid off: the model stopped before the kill it was
  // building to. Kept on the last paragraph rather than lost.
  if (carry) {
    const last = beats[beats.length - 1];
    if (last) last.text = fold(last.text, carry) ?? last.text;
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
  for (const row of told.cases ?? []) {
    const want = String(row?.id ?? "").trim().toLowerCase();
    const side = (b.sides ?? []).find(
      (s) => s.id.toLowerCase() === want || s.name.trim().toLowerCase() === want
    );
    if (!side) continue;
    const weight = Math.max(0, Math.min(3, Math.round(Number(row?.weight)) || 0));
    rulings.set(side.id, { weight, note: named(String(row?.note ?? "").trim()) });
  }
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
