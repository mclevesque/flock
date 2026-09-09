/**
 * DraftMasters — custom boards, without the model.
 *
 * Custom used to mean: send the player's typed phrase to a language model, wait
 * twenty-odd seconds, and hope it comes back with eighty real characters at
 * sensible tiers and a JSON shape that parses. It was the slowest thing in the
 * game, the most expensive, and by a distance the most likely to fail — a
 * timeout there is a player staring at a progress bar, and every board it built
 * was thrown away the moment the game ended.
 *
 * It was also, looking at what people actually typed, mostly unnecessary.
 * "Marvel vs DC". "Anime vs video games". "Everything". What they wanted was
 * not a new board; it was two boards at once — the crossover the game is
 * secretly about.
 *
 * So Custom is now a mixer. Pick two or more of the boards that already exist
 * and it deals a single pool from them. No call, no wait, no failure mode, and
 * every card arrives with the tiers, variants, planes, traits, effects and
 * portraits somebody already got right.
 *
 * The model is still there for the case this genuinely cannot serve — a world
 * with no board yet — but that is now a rare path rather than the default one.
 */

import { PACKS, type Arena, type Entry, type Pack } from "./packs";
import { BOARD_PLANES, DEFAULT_BAND, type Plane } from "./planes";

/** Deterministic, so the same picks in the same order deal the same board. */
function makeRandom(seed: number) {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface MixOptions {
  /** How many cards the mixed board should hold. */
  size?: number;
  /** Name shown on the case. Defaults to the boards, joined. */
  name?: string;
  seed?: number;
}

/** The default pool size — big enough that two drafts off it differ. */
const DEFAULT_SIZE = 90;

/**
 * Name the mix the way a person would say it out loud.
 *
 * Two boards get "X vs Y", because that is what a crossover is and what the
 * player typed. Three or more stops being a versus and becomes a description.
 */
export function mixName(packs: Pack[]): string {
  const names = packs.map((p) => p.name);
  if (names.length === 2) return `${names[0]} vs ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]} & ${names[2]}`;
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}

/**
 * The planar band a mixed board spans.
 *
 * The union, never an average. Mixing Game of Thrones into Marvel does not make
 * Westeros cosmic and it does not make the Hulk medieval — it puts a knight on
 * the same board as a Titan and lets the planar rules say what that means,
 * which is the entire appeal of a crossover and the thing the old generated
 * boards were worst at.
 */
export function mixBand(ids: string[]): [Plane, Plane] {
  const bands = ids.map((id) => BOARD_PLANES[id]).filter(Boolean);
  if (!bands.length) return DEFAULT_BAND;
  return [
    Math.min(...bands.map((b) => b[0])) as Plane,
    Math.max(...bands.map((b) => b[1])) as Plane,
  ];
}

/**
 * Deal one board from several.
 *
 * Cards are drawn by prominence rather than uniformly, so a mixed board leads
 * with the names people recognise instead of burying them under deep cuts from
 * four franchises at once — that failure was the single most common complaint
 * about the generated boards. Each source contributes a fair share of the pool,
 * so picking one enormous board and one small one does not silently produce the
 * enormous board with a garnish.
 */
export function mixPacks(ids: string[], opts: MixOptions = {}): Pack {
  const packs = ids.map((id) => PACKS.find((p) => p.id === id)).filter((p): p is Pack => !!p);
  if (!packs.length) throw new Error("mixPacks: no known boards in " + ids.join(", "));
  if (packs.length === 1) return packs[0];

  const size = opts.size ?? DEFAULT_SIZE;
  const rnd = makeRandom(opts.seed ?? seedFrom(ids.join("+")));
  const share = Math.ceil(size / packs.length);

  const taken: Entry[] = [];
  const seen = new Set<string>();

  for (const pack of packs) {
    // Weight by prominence, then shuffle within the weighting. A frequency-5
    // headliner is roughly five times as likely to be dealt as a deep cut, and
    // the deep cut is still genuinely possible — which is where the surprise in
    // this game has always come from.
    const pool = pack.entries
      .filter((e) => !e.uberOnly)
      .map((e) => ({ e, key: rnd() / Math.max(1, e.f ?? 3) }))
      .sort((x, y) => x.key - y.key)
      .map((x) => x.e);

    let n = 0;
    for (const entry of pool) {
      if (n >= share) break;
      const key = entry.n.toLowerCase();
      // The same person can be on several boards — Klaus is on both The Vampire
      // Diaries and The CW. Whoever is dealt first keeps the slot, and the
      // portrait context follows them, so a mix never deals two of anybody.
      if (seen.has(key)) continue;
      seen.add(key);
      // Carry the source board's portrait context and wiki onto the card, or a
      // crossover pool has no way to look half its cast up.
      taken.push({
        ...entry,
        s: entry.s ?? pack.imgContext,
        wiki: entry.wiki ?? pack.wiki,
        // Which world this is from, so the planar tables still apply. A
        // crossover is only interesting if Westeros stays Westeros.
        from: entry.from ?? pack.id,
      });
      n++;
    }
  }

  // Interleave rather than concatenate, so the draft does not run one franchise
  // at a time. A crossover that deals eight Pokémon and then eight Originals is
  // two drafts in a trench coat.
  const shuffled = taken
    .map((e) => ({ e, key: rnd() }))
    .sort((x, y) => x.key - y.key)
    .map((x) => x.e);

  const arenas: Arena[] = packs.flatMap((p) =>
    (p.arenas ?? []).slice(0, 2).map((a) => ({ ...a, weight: Math.max(1, Math.round(a.weight / 2)) }))
  );

  const names = packs.map((p) => p.name);
  return {
    id: `mix:${ids.join("+")}`,
    name: opts.name ?? mixName(packs),
    emoji: "✴",
    blurb: `${names.join(" and ")} in one pool. Nobody here has met before.`,
    imgContext: "character",
    scenario:
      `Cards drafted from ${names.join(", ")} meet on one field. None of these worlds ` +
      `share a power scale, so the fight is settled by what each of them could actually ` +
      `survive and what each of them could actually end.`,
    criteria:
      "Cross-world honesty. A world's strongest is not automatically another world's " +
      "strongest, and being the protagonist of your own show counts for nothing here.",
    arenas: arenas.length ? arenas : undefined,
    entries: shuffled.slice(0, size),
  };
}

// ── Finding a board to add ───────────────────────────────────────────────────

export interface SearchHit {
  pack: Pack;
  /** Why it matched — the board's own name, or somebody on it. */
  because: "board" | string;
  /** Lower is better. */
  rank: number;
}

/**
 * Search the boards by name, and by who is on them.
 *
 * Typing a board's name is the obvious path and covers most of it. Typing a
 * CHARACTER is the one that makes this feel like it knows anything: a player
 * who wants Klaus does not necessarily know he is on two boards, and "klaus"
 * should show them both rather than nothing. Same query box, same results list.
 */
export function searchPacks(query: string, limit = 8): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return PACKS.map((p, i) => ({ pack: p, because: "board" as const, rank: i }));

  const hits: SearchHit[] = [];
  for (const pack of PACKS) {
    const name = pack.name.toLowerCase();
    if (name.startsWith(q)) {
      hits.push({ pack, because: "board", rank: 0 });
      continue;
    }
    if (name.includes(q)) {
      hits.push({ pack, because: "board", rank: 1 });
      continue;
    }

    // Prominent people first, so "clark" surfaces the board Clark Kent
    // headlines rather than one he happens to be a footnote on.
    let best: { n: string; rank: number } | null = null;
    for (const e of pack.entries) {
      const n = e.n.toLowerCase();
      if (!n.includes(q)) continue;
      const rank = (n.startsWith(q) ? 2 : 4) + (5 - (e.f ?? 3)) * 0.1;
      if (!best || rank < best.rank) best = { n: e.n, rank };
    }
    if (best) hits.push({ pack, because: best.n, rank: best.rank });
  }

  return hits.sort((a, b) => a.rank - b.rank).slice(0, limit);
}

/** Every board, for the browse-all picker. */
export const allPacks = (): Pack[] => PACKS;
