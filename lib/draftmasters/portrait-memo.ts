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

/**
 * Curated portraits are keyed by CHARACTER, not by the board-specific query,
 * so a photo saved for Jon Snow applies on every board he turns up on.
 * "name:jon snow" — lowercase, punctuation stripped, spaces collapsed.
 */
export function nameKey(name: string): string {
  return "name:" + normalizeName(name);
}

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const HONORIFICS = /^(ser|sir|lord|lady|king|queen|prince|princess|the|dr|doctor|captain|master)\s+/;

/** Every key a name might be curated under: exact, and without a leading honorific. */
export function nameKeys(name: string): string[] {
  const norm = normalizeName(name);
  const keys = [`name:${norm}`];
  const bare = norm.replace(HONORIFICS, "");
  if (bare !== norm) keys.push(`name:${bare}`);
  return keys;
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
