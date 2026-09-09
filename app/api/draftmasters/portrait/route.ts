import { NextResponse } from "next/server";
import { getBlockedPortraitUrls, getPortraitOverrides } from "@/lib/draftmasters/db";
import { memo, nameKeys, remember, type Portrait } from "@/lib/draftmasters/portrait-memo";

/**
 * GET  /api/draftmasters/portrait?q=<search query>&name=<bare name>&wiki=<fandom>
 * POST /api/draftmasters/portrait  { queries: [{ q, name, wiki? }], wiki? }
 *
 * Resolves a portrait for a drafted lot. Order of trust:
 *
 *   0. A photo a player 👍'd for this exact query — humans beat every API.
 *   1. Google Programmable Search (image mode), when GOOGLE_CSE_ID is set.
 *   2. Fandom — the entry's own wiki, then the board's, then broad ones.
 *      Wikipedia's API omits fair-use files, so nearly every fictional
 *      character comes back empty from it; Fandom is the load-bearing tier.
 *   3. Wikipedia, searched WITH the board context first. Searching the bare
 *      name is how "Jon Snow" returned the Channel 4 newsreader.
 *   4. Wikimedia Commons.
 *   5. HuggingFace FLUX — draw one.
 *   6. null — the client draws a lettered card.
 *
 * Anything a player 👎'd is skipped at every tier.
 */

export const runtime = "nodejs";

const UA = { "User-Agent": "DraftMasters/1.0 (greatsouls.net)" };

/**
 * The card is 4:5. An image near that ratio can be cropped edge-to-edge and
 * look designed; a 3:1 banner cannot. Score candidates so we pick the most
 * portrait-shaped option available rather than just the first hit.
 */
const IDEAL_RATIO = 0.8;

function aspectScore(w?: number, h?: number): number {
  if (!w || !h) return 0.5;
  const ratio = w / h;
  if (ratio > 2.2 || ratio < 0.35) return 0;
  return 1 / (1 + Math.abs(ratio - IDEAL_RATIO) * 1.6);
}

const STOPWORDS = new Set(["the", "a", "an", "of", "and", "in", "at", "de", "von"]);

/** Broad wikis tried after the specific ones miss. */
const FALLBACK_WIKIS = ["villains", "hero", "deathbattle"];

function tokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/**
 * Does this result actually depict the thing we asked for? Requiring the most
 * distinctive token (usually the surname) in the title kills "Spike Jonze"
 * for "Spike Spiegel" without rejecting legitimate alias redirects.
 */
function titleRelevant(name: string, title: string): boolean {
  const want = tokens(name);
  if (!want.length) return true;
  const got = title.toLowerCase();
  if (want.every((t) => got.includes(t))) return true;
  return got.includes(want[want.length - 1]);
}

// ── 1. Google Programmable Search ────────────────────────────────────────────

async function fromGoogle(query: string, blocked: Set<string>): Promise<Portrait | null> {
  const cx = process.env.GOOGLE_CSE_ID;
  const key = process.env.GOOGLE_CSE_API_KEY ?? process.env.YOUTUBE_API_KEY;
  if (!cx || !key) return null;
  try {
    const url =
      `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}` +
      `&searchType=image&num=8&safe=active&imgSize=large&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const json = await res.json();
    interface GoogleItem { link?: string; displayLink?: string; image?: { width?: number; height?: number } }
    const items: GoogleItem[] = Array.isArray(json?.items) ? json.items : [];
    const best = items
      .filter((i) => typeof i.link === "string" && !/\.svg($|\?)/i.test(i.link!) && !blocked.has(i.link!))
      .map((i) => ({ item: i, score: aspectScore(i.image?.width, i.image?.height) }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)[0];
    if (!best) return null;
    return { url: best.item.link!, source: "google", credit: best.item.displayLink, w: best.item.image?.width, h: best.item.image?.height };
  } catch {
    return null;
  }
}

// ── 2. Fandom ────────────────────────────────────────────────────────────────

interface WikiPage {
  index?: number;
  title?: string;
  missing?: string;
  thumbnail?: { source?: string; width?: number; height?: number };
}

/** Exact page lookup following redirects — how "The Mountain" becomes Gregor Clegane. */
async function fandomExact(wiki: string, name: string, blocked: Set<string>): Promise<Portrait | null> {
  try {
    const url =
      `https://${wiki}.fandom.com/api.php?action=query&format=json&redirects=1` +
      `&titles=${encodeURIComponent(name)}&prop=pageimages&piprop=thumbnail&pithumbsize=700`;
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(7000), redirect: "follow" });
    if (!res.ok) return null;
    const pages: Record<string, WikiPage> = (await res.json())?.query?.pages ?? {};
    const page = Object.values(pages).find(
      (p) => p?.thumbnail?.source && p.missing === undefined && !blocked.has(p.thumbnail.source)
    );
    if (!page?.thumbnail?.source) return null;
    return { url: page.thumbnail.source, source: "fandom", credit: page.title, w: page.thumbnail.width, h: page.thumbnail.height };
  } catch {
    return null;
  }
}

async function fromFandom(wiki: string, name: string, blocked: Set<string>): Promise<Portrait | null> {
  if (!/^[a-z0-9-]{2,40}$/i.test(wiki)) return null;
  const exact = await fandomExact(wiki, name, blocked);
  if (exact) return exact;
  try {
    const url =
      `https://${wiki}.fandom.com/api.php?action=query&format=json&generator=search&gsrlimit=6&gsrnamespace=0` +
      `&gsrsearch=${encodeURIComponent(name)}&prop=pageimages&piprop=thumbnail&pithumbsize=700`;
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(7000), redirect: "follow" });
    if (!res.ok) return null;
    const pages: Record<string, WikiPage> = (await res.json())?.query?.pages ?? {};
    const target = name.toLowerCase().trim();
    const ranked = Object.values(pages)
      .filter(
        (p) =>
          p?.thumbnail?.source &&
          !blocked.has(p.thumbnail.source) &&
          !/disambiguation/i.test(p.title ?? "") &&
          titleRelevant(name, p.title ?? "")
      )
      .map((p) => {
        const title = (p.title ?? "").toLowerCase();
        return {
          page: p,
          score:
            (title === target ? 30 : 0) +
            (/\(.*\)/.test(title) ? -4 : 0) +
            (10 - Math.min(9, p.index ?? 9)) * 1.5 +
            aspectScore(p.thumbnail?.width, p.thumbnail?.height) * 5,
        };
      })
      .sort((a, b) => b.score - a.score);
    const hit = ranked[0]?.page;
    if (!hit?.thumbnail?.source) return null;
    return { url: hit.thumbnail.source, source: "fandom", credit: hit.title, w: hit.thumbnail.width, h: hit.thumbnail.height };
  } catch {
    return null;
  }
}

// ── 3. Wikipedia ─────────────────────────────────────────────────────────────

/**
 * @param search   what to search for — the FULL query with board context
 * @param guardName the bare name results are validated against
 */
async function fromWikipedia(search: string, guardName: string, blocked: Set<string>): Promise<Portrait | null> {
  try {
    const url =
      "https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrlimit=5&gsrnamespace=0" +
      `&gsrsearch=${encodeURIComponent(search)}&prop=pageimages&piprop=thumbnail&pithumbsize=800`;
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const pages: Record<string, WikiPage> = (await res.json())?.query?.pages ?? {};
    const ranked = Object.values(pages)
      .filter((p) => p?.thumbnail?.source && !blocked.has(p.thumbnail.source) && titleRelevant(guardName, p.title ?? ""))
      .map((p) => ({
        page: p,
        score: (10 - Math.min(9, p.index ?? 9)) * 2 + aspectScore(p.thumbnail?.width, p.thumbnail?.height) * 3,
      }))
      .sort((a, b) => b.score - a.score);
    const hit = ranked[0]?.page;
    if (!hit?.thumbnail?.source) return null;
    return { url: hit.thumbnail.source, source: "wikipedia", credit: hit.title, w: hit.thumbnail.width, h: hit.thumbnail.height };
  } catch {
    return null;
  }
}

// ── 4. Wikimedia Commons ─────────────────────────────────────────────────────

const JUNK_TITLE = /\b(map|logo|flag|diagram|chart|icon|coat of arms|signature|location|graph|timeline|seal)\b/i;

async function fromCommons(term: string, blocked: Set<string>): Promise<Portrait | null> {
  try {
    const url =
      "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=10" +
      `&gsrsearch=${encodeURIComponent(term)}&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=800`;
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    interface CommonsPage { index?: number; title?: string; imageinfo?: { thumburl?: string; thumbwidth?: number; thumbheight?: number; mime?: string }[] }
    const pages: Record<string, CommonsPage> = (await res.json())?.query?.pages ?? {};
    const ranked = Object.values(pages)
      .filter((p) => {
        const info = p.imageinfo?.[0];
        if (!info?.thumburl || blocked.has(info.thumburl)) return false;
        if (info.mime && !/^image\/(jpeg|png|webp)$/.test(info.mime)) return false;
        return !(p.title && JUNK_TITLE.test(p.title));
      })
      .map((p) => {
        const info = p.imageinfo![0];
        return { page: p, info, score: (10 - Math.min(9, p.index ?? 9)) * 1.5 + aspectScore(info.thumbwidth, info.thumbheight) * 4 };
      })
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score);
    const best = ranked[0];
    if (!best) return null;
    return { url: best.info.thumburl!, source: "commons", credit: best.page.title?.replace(/^File:/, ""), w: best.info.thumbwidth, h: best.info.thumbheight };
  } catch {
    return null;
  }
}

// ── 5. HuggingFace FLUX ──────────────────────────────────────────────────────

function generatedUrl(prompt: string): string | null {
  if (!process.env.HUGGINGFACE_TOKEN) return null;
  const seed = Math.abs(hash(prompt)) % 99999;
  return `/api/generate-image?prompt=${encodeURIComponent(prompt)}&seed=${seed}`;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

// ── The cascade ──────────────────────────────────────────────────────────────

async function resolve(q: string, name: string, wiki: string | undefined, blocked: Set<string>): Promise<Portrait> {
  const google = await fromGoogle(q || name, blocked);
  if (google) return google;

  // Fandom is for FICTIONAL boards only.
  //
  // A board with no wiki is a real-world one — historical figures, athletes,
  // animals — and Wikipedia is the right source for those. Running the
  // fallback wikis anyway meant Genghis Khan was searched against the
  // villains, hero and deathbattle wikis BEFORE Wikipedia was tried, which is
  // how comic art and a picture of Jon Snow ended up on the history board.
  if (name && wiki) {
    const wikis = [wiki, ...FALLBACK_WIKIS].filter((w): w is string => Boolean(w));
    for (const w of [...new Set(wikis)]) {
      const hit = (await fromFandom(w, name, blocked)) ?? (q && q !== name && w === wiki ? await fromFandom(w, q, blocked) : null);
      if (hit) return hit;
    }
  }

  // Context first. The bare name is a last resort precisely because it's the
  // query that hands you the newsreader instead of the character.
  const guard = name || q;
  const article =
    (await fromWikipedia(q || name, guard, blocked)) ??
    (name && q && q !== name ? await fromWikipedia(name, guard, blocked) : null);
  if (article) return article;

  const commons = (await fromCommons(q || name, blocked)) ?? (name && q && q !== name ? await fromCommons(name, blocked) : null);
  if (commons) return commons;

  const gen = generatedUrl(`portrait of ${q || name}, dramatic lighting, painted character art, head and shoulders`);
  if (gen && !blocked.has(gen)) return { url: gen, source: "generated" };

  return { url: null, source: "none" };
}

/** Player-curated photo first, then the memo (unless it's been 👎'd), then the cascade. */
async function lookup(
  q: string,
  name: string,
  wiki: string | undefined,
  override: { url: string; source: string } | undefined,
  blocked: Set<string>
): Promise<Portrait> {
  if (override && !blocked.has(override.url)) return { url: override.url, source: "curated" };
  const key = `${wiki ?? ""}|${q || name}`;
  const cached = memo.get(key);
  if (cached && (!cached.url || !blocked.has(cached.url))) return cached;
  return remember(key, await resolve(q, name, wiki, blocked));
}

type Overrides = Map<string, { url: string; source: string }>;
type Blocked = Map<string, Set<string>>;

/**
 * Curation is looked up under the exact query AND the character's name keys,
 * so an imported photo of Jon Snow wins on any board, whatever its context.
 */
async function curation(queries: string[], names: string[]) {
  const keys = [...new Set([...queries, ...names.flatMap(nameKeys)])];
  // Records are a nice-to-have; a DB hiccup must never blank a board.
  try {
    const [overrides, blocked] = await Promise.all([getPortraitOverrides(keys), getBlockedPortraitUrls(keys)]);
    return { overrides, blocked };
  } catch {
    return { overrides: new Map() as Overrides, blocked: new Map() as Blocked };
  }
}

/** The override for this lot: exact query first, then the character's name. */
function pickOverride(overrides: Overrides, key: string, name: string) {
  return overrides.get(key) ?? nameKeys(name).map((k) => overrides.get(k)).find(Boolean);
}

/** Everything 👎'd for this lot under any of its keys. */
function pickBlocked(blocked: Blocked, key: string, name: string): Set<string> {
  const out = new Set<string>(blocked.get(key) ?? []);
  for (const k of nameKeys(name)) for (const u of blocked.get(k) ?? []) out.add(u);
  return out;
}

// ── Handlers ─────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().slice(0, 200);
  const name = (searchParams.get("name") ?? "").trim().slice(0, 120);
  const wiki = (searchParams.get("wiki") ?? "").trim().slice(0, 40) || undefined;
  // A 👎 re-fetch must bypass every cache between the player and this code.
  const fresh = searchParams.get("fresh") === "1";
  if (!q && !name) return NextResponse.json({ url: null, source: "none" } satisfies Portrait);

  const key = q || name;
  const { overrides, blocked } = await curation([key], name ? [name] : []);
  const portrait = await lookup(q, name, wiki, pickOverride(overrides, key, name), pickBlocked(blocked, key, name));

  return NextResponse.json(portrait, {
    headers: fresh
      ? { "Cache-Control": "no-store" }
      : { "Cache-Control": "public, max-age=86400, s-maxage=604800", "Netlify-Vary": "query" },
  });
}

/**
 * Batch resolve for the prep screen — the whole board's portraits land before
 * the first lot drops. Each query may carry its own wiki (crossover boards),
 * falling back to the board's.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    queries?: { q?: string; name?: string; wiki?: string }[];
    wiki?: string;
  } | null;
  const queries = (body?.queries ?? []).slice(0, 40);
  const boardWiki = (body?.wiki ?? "").trim().slice(0, 40) || undefined;
  if (!queries.length) return NextResponse.json({ portraits: [] });

  const keys = queries.map((x) => (x.q || x.name || "").trim()).filter(Boolean);
  const names = queries.map((x) => (x.name ?? "").trim()).filter(Boolean);
  const { overrides, blocked } = await curation(keys, names);

  const results: Portrait[] = new Array(queries.length);
  const CONCURRENCY = 6;
  let next = 0;

  async function worker() {
    while (next < queries.length) {
      const i = next++;
      const { q = "", name = "" } = queries[i];
      const wiki = (queries[i].wiki ?? "").trim().slice(0, 40) || boardWiki;
      if (!q && !name) {
        results[i] = { url: null, source: "none" };
        continue;
      }
      const key = q || name;
      results[i] = await lookup(q, name, wiki, pickOverride(overrides, key, name), pickBlocked(blocked, key, name));
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queries.length) }, worker));
  return NextResponse.json({ portraits: results }, { headers: { "Cache-Control": "no-store" } });
}
