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
  beats: { text: string; kills?: (string | number)[] }[];
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
}

/**
 * Did this story actually finish the fight?
 *
 * The game's whole promise is a winner and a loser: one roster in the ground,
 * the other still standing. A told story that simply runs out of beats with
 * people alive on both sides leaves the result to be decided on a head-count,
 * which is not a battle anybody watched.
 */
export function finished(told: Told, b: Body): boolean {
  const dead = new Set((told.beats ?? []).flatMap((x) => x.kills ?? []));
  return (b.sides ?? []).some((s) => s.cards.every((c) => dead.has(c.name)));
}

/** Names as given, so a hallucinated casualty cannot cross anybody out. */
/** A casualty given as a roster number rather than a name. */
const isNumber = (raw: unknown): boolean =>
  typeof raw === "number" || /^\s*\d{1,2}\s*$/.test(String(raw ?? ""));

export function sanitise(told: Told, b: Body): Told {
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
  /** Set the moment a side runs out. The battle is over; the prose may not be. */
  let over = false;

  for (const raw of told.beats ?? []) {
    const text = String(raw?.text ?? "").trim();
    if (!text) continue;

    /**
     * The fight ends when a side is empty, whatever the model wrote next.
     *
     * Left to itself it sometimes keeps going after one team is wiped out --
     * and with no opponents left to fight, the survivors start killing each
     * other. A player watched their own bench get crossed out one card at a
     * time in a battle they had already won. So the wipe is the end: one more
     * beat for the aftermath, then the story stops and anything past it is
     * dropped along with any casualties it claimed.
     */
    if (over) {
      // Only a genuine aftermath earns the last word. If this beat is still
      // killing people then it is not an aftermath, it is a second fight --
      // and keeping its text while dropping its casualties would narrate a
      // death the roster above never shows.
      if (!(raw?.kills ?? []).length) beats.push({ text });
      break;
    }

    const kills: string[] = [];
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
      usedUp.add(hit);
      kills.push(hit);
      const side = sideOf.get(hit);
      if (side) standing.set(side, (standing.get(side) ?? 1) - 1);
    }
    beats.push(kills.length ? { text, kills } : { text });
    if ([...standing.values()].some((n) => n <= 0)) over = true;
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

  return {
    beats,
    winner: best?.id ?? told.winner,
    verdict: named(String(told.verdict ?? "").trim()),
    mvp,
  };
}
