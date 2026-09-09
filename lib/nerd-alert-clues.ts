// Nerd Alert! — clue bank
//
// Questions come from OpenTDB (free, community-verified) via
// scripts/fetch-nerd-alert-clues.mjs, stored in nerd-alert-pool.json as a
// pool grouped by category → difficulty. buildBoard() assembles a fresh
// 6-category board each game, mapping difficulty to $ values, so a large pool
// yields near-infinite board combinations.

import poolData from "./nerd-alert-pool.json";

export interface Clue {
  value: number;
  clue: string;
  answer: string;
  accept?: string[];
  isDailyDouble?: boolean;
}

export interface Category {
  name: string;
  clues: Clue[];          // 5 clues, ordered by value $200..$1000
}

export interface Board {
  id: string;
  categories: Category[]; // 6 categories
}

export interface FinalClue {
  category: string;
  clue: string;
  answer: string;
  accept?: string[];
}

// ── Pool typing ───────────────────────────────────────────────────────────────
type Difficulty = "easy" | "medium" | "hard";
interface PoolEntry { clue: string; answer: string; accept?: string[] }
type PoolCategory = Record<Difficulty, PoolEntry[]>;
type Pool = Record<string, PoolCategory>;

const POOL = poolData as Pool;

// Map each board row's $ value to a source difficulty.
const VALUE_DIFFICULTY: Array<[number, Difficulty]> = [
  [200, "easy"],
  [400, "easy"],
  [600, "medium"],
  [800, "medium"],
  [1000, "hard"],
];

const CATEGORIES_PER_BOARD = 6;
const ROWS_PER_CATEGORY = 5;
const DAILY_DOUBLES_PER_BOARD = 2;

function shuffle<T>(arr: readonly T[]): T[] {
  const r = arr.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

// Total clues available in a category across all tiers.
function categoryTotal(c: PoolCategory): number {
  return c.easy.length + c.medium.length + c.hard.length;
}

// Pick a distinct clue, preferring the target difficulty then falling back.
function pickDistinct(
  tiers: PoolCategory,
  diff: Difficulty,
  used: Set<string>,
): PoolEntry | null {
  const order: Difficulty[] =
    diff === "easy" ? ["easy", "medium", "hard"]
    : diff === "medium" ? ["medium", "easy", "hard"]
    : ["hard", "medium", "easy"];
  for (const t of order) {
    for (const q of tiers[t]) {
      if (!used.has(q.clue)) { used.add(q.clue); return q; }
    }
  }
  return null;
}

/** Assemble a fresh random board from the pool. */
export function buildBoard(): Board {
  // Categories with enough clues to fill a 5-row column.
  const eligible = Object.keys(POOL).filter(
    (name) => categoryTotal(POOL[name]) >= ROWS_PER_CATEGORY,
  );
  const chosen = shuffle(eligible).slice(0, CATEGORIES_PER_BOARD);

  const categories: Category[] = chosen.map((name) => {
    const src = POOL[name];
    // Shuffle each tier once per board so clues vary game-to-game.
    const tiers: PoolCategory = {
      easy: shuffle(src.easy),
      medium: shuffle(src.medium),
      hard: shuffle(src.hard),
    };
    const used = new Set<string>();
    const clues: Clue[] = VALUE_DIFFICULTY.map(([value, diff]) => {
      const q = pickDistinct(tiers, diff, used);
      return {
        value,
        clue: q ? q.clue : "(clue unavailable)",
        answer: q ? q.answer : "",
        accept: q?.accept ?? [],
      };
    });
    return { name, clues };
  });

  // Assign daily doubles to random non-top-row cells (classic Jeopardy style).
  const candidates = shuffle(
    categories.flatMap((_, ci) => [1, 2, 3, 4].map((ri) => ({ ci, ri }))),
  ).slice(0, DAILY_DOUBLES_PER_BOARD);
  for (const { ci, ri } of candidates) {
    if (categories[ci] && categories[ci].clues[ri]) {
      categories[ci].clues[ri].isDailyDouble = true;
    }
  }

  return { id: `pool-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, categories };
}

// How many distinct clues are currently loaded (for diagnostics / display).
export function poolSize(): number {
  return Object.values(POOL).reduce((sum, c) => sum + categoryTotal(c), 0);
}

// ── Final Nerd Alert clues (hand-curated, mainstream, accuracy-checked) ───────
export const FINAL_CLUES: FinalClue[] = [
  {
    category: "BLOCKBUSTERS",
    clue: "This 2019 Marvel film concluded the Infinity Saga and briefly became the highest-grossing movie of all time.",
    answer: "Avengers: Endgame",
    accept: ["Endgame"],
  },
  {
    category: "ANIME LEGENDS",
    clue: "The Dragon Ball mangaka who passed away in March 2024 — full real name.",
    answer: "Akira Toriyama",
    accept: ["Toriyama"],
  },
  {
    category: "MOVIE MILESTONES",
    clue: "James Cameron's 2009 sci-fi film, set on Pandora, briefly overtook Titanic as the highest-grossing movie ever.",
    answer: "Avatar",
  },
  {
    category: "FANTASY SAGAS",
    clue: "The seventh and final Harry Potter book — split into two movies.",
    answer: "Harry Potter and the Deathly Hallows",
    accept: ["The Deathly Hallows", "Deathly Hallows"],
  },
  {
    category: "GHIBLI",
    clue: "The 2001 Miyazaki film, the only non-English-language animated movie to win the Best Animated Feature Oscar.",
    answer: "Spirited Away",
  },
  {
    category: "GAMING HISTORY",
    clue: "The 1985 NES game starring an Italian plumber, often credited with reviving the home video game industry after the 1983 crash.",
    answer: "Super Mario Bros.",
    accept: ["Super Mario Bros", "Super Mario Brothers", "Mario Bros"],
  },
];
