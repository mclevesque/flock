/**
 * Per-instance memo of resolved portraits, shared between the resolver and the
 * feedback route so a 👍/👎 can evict what it just changed. Keys are
 * `${wiki}|${query}`; feedback only knows the query, so eviction is by suffix.
 */

export interface Portrait {
  url: string | null;
  source: "curated" | "google" | "fandom" | "wikipedia" | "commons" | "generated" | "none";
  credit?: string;
  w?: number;
  h?: number;
}

export const memo = new Map<string, Portrait>();
const MEMO_MAX = 500;

export function remember(key: string, value: Portrait): Portrait {
  if (memo.size >= MEMO_MAX) {
    const oldest = memo.keys().next().value;
    if (oldest) memo.delete(oldest);
  }
  memo.set(key, value);
  return value;
}

/** Drop every memo entry for this query, whatever wiki it was resolved under. */
export function forget(query: string): void {
  for (const key of [...memo.keys()]) {
    if (key === query || key.endsWith(`|${query}`)) memo.delete(key);
  }
}
