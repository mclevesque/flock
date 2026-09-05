import { NextResponse } from "next/server";

/**
 * GET /api/draftmasters/portrait?q=<search query>&name=<bare name>
 *
 * Resolves a portrait for a drafted lot. Tries, in order:
 *
 *   1. Google Programmable Search (image mode) — the real "Google it" path.
 *      Needs GOOGLE_CSE_ID plus a key. Google does not offer a public image
 *      search API any more, so this is the supported way in; scraping
 *      images.google.com is against their ToS and breaks constantly.
 *   2. Wikipedia / Wikimedia — free, keyless, CORS-friendly, and genuinely
 *      good at exactly the nouns this game draws (characters, people, animals).
 *   3. HuggingFace FLUX — generates a portrait for anything with no photo.
 *   4. null — the client draws a lettered card instead.
 *
 * Results are memoised per warm instance and cached hard at the edge; the same
 * lot costs one lookup ever, not one per game.
 */

export const runtime = "nodejs";

interface Portrait {
  url: string | null;
  source: "google" | "fandom" | "wikipedia" | "commons" | "generated" | "none";
  credit?: string;
  /** Intrinsic size when the source reports it — lets the card frame it properly */
  w?: number;
  h?: number;
}

/**
 * The card is 4:5. An image near that ratio can be cropped edge-to-edge and
 * look designed; a 3:1 banner cannot. Score candidates so we pick the most
 * portrait-shaped option available rather than just the first hit.
 */
const IDEAL_RATIO = 0.8; // 4:5

function aspectScore(w?: number, h?: number): number {
  if (!w || !h) return 0.5; // unknown — neither preferred nor penalised
  const ratio = w / h;
  if (ratio > 2.2 || ratio < 0.35) return 0; // banner or sliver: unusable
  return 1 / (1 + Math.abs(ratio - IDEAL_RATIO) * 1.6);
}

const memo = new Map<string, Portrait>();
const MEMO_MAX = 500;

function remember(key: string, value: Portrait): Portrait {
  if (memo.size >= MEMO_MAX) {
    const oldest = memo.keys().next().value;
    if (oldest) memo.delete(oldest);
  }
  memo.set(key, value);
  return value;
}

// ── 1. Google Programmable Search ────────────────────────────────────────────

async function fromGoogle(query: string): Promise<Portrait | null> {
  const cx = process.env.GOOGLE_CSE_ID;
  const key = process.env.GOOGLE_CSE_API_KEY ?? process.env.YOUTUBE_API_KEY;
  if (!cx || !key) return null;

  try {
    // Ask for several so we can choose on shape instead of taking hit #1.
    const url =
      `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}` +
      `&searchType=image&num=8&safe=active&imgSize=large` +
      `&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const json = await res.json();

    interface GoogleItem {
      link?: string;
      displayLink?: string;
      mime?: string;
      image?: { width?: number; height?: number };
    }
    const items: GoogleItem[] = Array.isArray(json?.items) ? json.items : [];

    const best = items
      .filter((i) => typeof i.link === "string" && !/\.svg($|\?)/i.test(i.link!))
      .map((i) => ({ item: i, score: aspectScore(i.image?.width, i.image?.height) }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)[0];

    if (!best) return null;
    return {
      url: best.item.link!,
      source: "google",
      credit: best.item.displayLink,
      w: best.item.image?.width,
      h: best.item.image?.height,
    };
  } catch {
    return null;
  }
}

// ── 2. Wikipedia / Wikimedia ─────────────────────────────────────────────────

async function fromWikipedia(term: string): Promise<Portrait | null> {
  try {
    // pithumbsize caps the LONGEST edge, so 800 gives a card-sized image
    // whatever the orientation, without pulling a 4000px original.
    const url =
      "https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*" +
      "&generator=search&gsrlimit=4&gsrnamespace=0" +
      `&gsrsearch=${encodeURIComponent(term)}` +
      "&prop=pageimages&piprop=thumbnail&pithumbsize=800";
    const res = await fetch(url, {
      headers: { "User-Agent": "DraftMasters/1.0 (greatsouls.net)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const json = await res.json();

    interface WikiPage {
      index?: number;
      title?: string;
      thumbnail?: { source?: string; width?: number; height?: number };
    }
    const pages: Record<string, WikiPage> = json?.query?.pages ?? {};

    // Rank by search relevance first (`index`), then break ties on shape —
    // the top hit is usually right, so relevance shouldn't lose to a nicer crop.
    const ranked = Object.values(pages)
      // Without this guard a search for "Spike Spiegel" happily returns the
      // article on Spike Jonze — a real person, on a card about a cartoon.
      .filter((p) => p?.thumbnail?.source && titleRelevant(term, p.title ?? ""))
      .map((p) => ({
        page: p,
        score:
          (10 - Math.min(9, p.index ?? 9)) * 2 +
          aspectScore(p.thumbnail?.width, p.thumbnail?.height) * 3,
      }))
      .sort((a, b) => b.score - a.score);

    const hit = ranked[0]?.page;
    if (!hit?.thumbnail?.source) return null;
    return {
      url: hit.thumbnail.source,
      source: "wikipedia",
      credit: hit.title,
      w: hit.thumbnail.width,
      h: hit.thumbnail.height,
    };
  } catch {
    return null;
  }
}

// ── 2. Fandom franchise wikis ────────────────────────────────────────────────
//
// The load-bearing tier for fictional boards. Wikipedia's `pageimages` API
// omits non-free files, and virtually every fictional character's infobox image
// is fair-use — so Jaime Lannister and Iron Man both come back empty from
// Wikipedia even though their articles clearly show a picture. Fandom wikis
// host their own art and serve it through the same MediaWiki API, portrait-
// shaped and character-accurate.

const STOPWORDS = new Set(["the", "a", "an", "of", "and", "in", "at", "de", "von"]);

/** Significant, lowercased tokens of a subject name. */
function tokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/**
 * Does this result actually depict the thing we asked for?
 *
 * Fuzzy wiki search is happy to hand back a tangentially related page — a
 * search for "Spike Spiegel" returning the article on Spike Jonze, or
 * "Escanor" returning some unrelated versus episode. Requiring the most
 * distinctive token (usually the surname) to appear in the title kills those
 * without rejecting legitimate alias redirects, which are resolved separately
 * by exact lookup.
 */
function titleRelevant(name: string, title: string): boolean {
  const want = tokens(name);
  if (!want.length) return true;
  const got = title.toLowerCase();
  if (want.every((t) => got.includes(t))) return true;
  // Fall back to the last significant token — the identifying one.
  return got.includes(want[want.length - 1]);
}

/**
 * Exact page lookup, following the wiki's own redirects.
 * This is how "The Mountain" correctly resolves to Gregor Clegane: the wiki
 * knows the alias, so we don't have to guess at it with fuzzy search.
 */
async function fandomExact(wiki: string, name: string): Promise<Portrait | null> {
  try {
    const url =
      `https://${wiki}.fandom.com/api.php?action=query&format=json&redirects=1` +
      `&titles=${encodeURIComponent(name)}` +
      "&prop=pageimages&piprop=thumbnail&pithumbsize=700";
    const res = await fetch(url, {
      headers: { "User-Agent": "DraftMasters/1.0 (greatsouls.net)" },
      signal: AbortSignal.timeout(7000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const json = await res.json();
    const pages: Record<
      string,
      { title?: string; missing?: string; thumbnail?: { source?: string; width?: number; height?: number } }
    > = json?.query?.pages ?? {};
    const page = Object.values(pages).find((p) => p?.thumbnail?.source && p.missing === undefined);
    if (!page?.thumbnail?.source) return null;
    return {
      url: page.thumbnail.source,
      source: "fandom",
      credit: page.title,
      w: page.thumbnail.width,
      h: page.thumbnail.height,
    };
  } catch {
    return null;
  }
}

async function fromFandom(wiki: string, name: string): Promise<Portrait | null> {
  if (!/^[a-z0-9-]{2,40}$/i.test(wiki)) return null;

  // Exact title (with redirects) is precise — try it before fuzzy search.
  const exact = await fandomExact(wiki, name);
  if (exact) return exact;

  try {
    const url =
      `https://${wiki}.fandom.com/api.php?action=query&format=json` +
      "&generator=search&gsrlimit=6&gsrnamespace=0" +
      `&gsrsearch=${encodeURIComponent(name)}` +
      "&prop=pageimages&piprop=thumbnail&pithumbsize=700";
    const res = await fetch(url, {
      headers: { "User-Agent": "DraftMasters/1.0 (greatsouls.net)" },
      signal: AbortSignal.timeout(7000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const json = await res.json();

    interface FandomPage {
      index?: number;
      title?: string;
      thumbnail?: { source?: string; width?: number; height?: number };
    }
    const pages: Record<string, FandomPage> = json?.query?.pages ?? {};
    const target = name.toLowerCase().trim();

    const ranked = Object.values(pages)
      .filter(
        (p) =>
          p?.thumbnail?.source &&
          !/disambiguation/i.test(p.title ?? "") &&
          titleRelevant(name, p.title ?? "")
      )
      .map((p) => {
        const title = (p.title ?? "").toLowerCase();
        // "Charizard" must beat "Ash's Charizard"; "Darth Vader" must beat
        // "Darth Vader (The Star Wars)". Exact title wins outright.
        const exact = title === target ? 30 : 0;
        // A parenthetical qualifier usually means an alternate continuity.
        const variantPenalty = /\(.*\)/.test(title) ? -4 : 0;
        return {
          page: p,
          score:
            exact +
            variantPenalty +
            (10 - Math.min(9, p.index ?? 9)) * 1.5 +
            aspectScore(p.thumbnail?.width, p.thumbnail?.height) * 5,
        };
      })
      .sort((a, b) => b.score - a.score);

    const hit = ranked[0]?.page;
    if (!hit?.thumbnail?.source) return null;
    return {
      url: hit.thumbnail.source,
      source: "fandom",
      credit: hit.title,
      w: hit.thumbnail.width,
      h: hit.thumbnail.height,
    };
  } catch {
    return null;
  }
}

// ── 3. Wikimedia Commons ─────────────────────────────────────────────────────
// Wikipedia only has a lead image if the subject has an article. Commons is the
// media library underneath it — ~100M freely licensed files — so it catches the
// long tail an article search misses. Free, keyless, no rate limit worth caring
// about at our volume.

const JUNK_TITLE = /\b(map|logo|flag|diagram|chart|icon|coat of arms|signature|location|graph|timeline|seal)\b/i;

async function fromCommons(term: string): Promise<Portrait | null> {
  try {
    const url =
      "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*" +
      "&generator=search&gsrnamespace=6&gsrlimit=10" +
      `&gsrsearch=${encodeURIComponent(term)}` +
      "&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=800";
    const res = await fetch(url, {
      headers: { "User-Agent": "DraftMasters/1.0 (greatsouls.net)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const json = await res.json();

    interface CommonsPage {
      index?: number;
      title?: string;
      imageinfo?: {
        thumburl?: string;
        thumbwidth?: number;
        thumbheight?: number;
        mime?: string;
      }[];
    }
    const pages: Record<string, CommonsPage> = json?.query?.pages ?? {};

    const ranked = Object.values(pages)
      .filter((p) => {
        const info = p.imageinfo?.[0];
        if (!info?.thumburl) return false;
        // Vector art and schematics make terrible portraits.
        if (info.mime && !/^image\/(jpeg|png|webp)$/.test(info.mime)) return false;
        if (p.title && JUNK_TITLE.test(p.title)) return false;
        return true;
      })
      .map((p) => {
        const info = p.imageinfo![0];
        return {
          page: p,
          info,
          score:
            (10 - Math.min(9, p.index ?? 9)) * 1.5 +
            aspectScore(info.thumbwidth, info.thumbheight) * 4,
        };
      })
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score);

    const best = ranked[0];
    if (!best) return null;
    return {
      url: best.info.thumburl!,
      source: "commons",
      credit: best.page.title?.replace(/^File:/, ""),
      w: best.info.thumbwidth,
      h: best.info.thumbheight,
    };
  } catch {
    return null;
  }
}

// ── 4. HuggingFace FLUX ──────────────────────────────────────────────────────

function generatedUrl(prompt: string): string | null {
  if (!process.env.HUGGINGFACE_TOKEN) return null;
  // The existing /api/generate-image GET handler streams FLUX bytes for a
  // prompt+seed, so this stays a plain <img src> the browser can cache.
  const seed = Math.abs(hash(prompt)) % 99999;
  return `/api/generate-image?prompt=${encodeURIComponent(prompt)}&seed=${seed}`;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().slice(0, 200);
  const name = (searchParams.get("name") ?? "").trim().slice(0, 120);
  const wiki = (searchParams.get("wiki") ?? "").trim().slice(0, 40);
  if (!q && !name) {
    return NextResponse.json({ url: null, source: "none" } satisfies Portrait);
  }

  const key = `${wiki}|${q || name}`;
  const cached = memo.get(key);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800" },
    });
  }

  const found = await resolve(q, name, wiki || undefined);
  return cachedJson(key, found);
}

/**
 * The cascade, in order of how good the result tends to look on a card.
 * Every tier is optional except the last two, so a missing key or a dead
 * upstream degrades instead of failing.
 */
async function resolve(q: string, name: string, wiki?: string): Promise<Portrait> {
  // Google first when it's configured — much the widest net.
  const google = await fromGoogle(q || name);
  if (google) return google;

  // Franchise wiki next — the only keyless source that covers fictional characters.
  if (wiki && name) {
    const fandom = await fromFandom(wiki, name);
    if (fandom) return fandom;
  }

  // Wikipedia: bare name first (cleaner hit rate), then the full query.
  const article = (await fromWikipedia(name || q)) ?? (name && q ? await fromWikipedia(q) : null);
  if (article) return article;

  // Commons picks up everything without its own article.
  const commons = await fromCommons(q || name);
  if (commons) return commons;

  // Last resort that still produces a picture: draw one.
  const gen = generatedUrl(
    `portrait of ${q || name}, dramatic lighting, painted character art, head and shoulders`
  );
  if (gen) return { url: gen, source: "generated" };

  return { url: null, source: "none" };
}

function cachedJson(key: string, portrait: Portrait) {
  remember(key, portrait);
  return NextResponse.json(portrait, {
    headers: {
      "Cache-Control": "public, max-age=86400, s-maxage=604800",
      // Netlify's CDN keys on path only unless told to vary — without this,
      // one portrait would be served for every ?q=.
      "Netlify-Vary": "query",
    },
  });
}

/**
 * POST /api/draftmasters/portrait  { queries: [{ q, name }] }
 *
 * Batch resolve for the prep screen — the whole board's portraits land before
 * the first lot drops, so the auction never stalls waiting on an image.
 * Runs a small concurrency window so we don't hammer Wikipedia with 30 at once.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    queries?: { q?: string; name?: string }[];
    /** Board-level Fandom subdomain — applies to every query in the batch */
    wiki?: string;
  } | null;
  const queries = (body?.queries ?? []).slice(0, 40);
  const wiki = (body?.wiki ?? "").trim().slice(0, 40) || undefined;
  if (!queries.length) return NextResponse.json({ portraits: [] });

  const results: Portrait[] = new Array(queries.length);
  const CONCURRENCY = 6;
  let next = 0;

  async function worker() {
    while (next < queries.length) {
      const i = next++;
      const { q = "", name = "" } = queries[i];
      if (!q && !name) {
        results[i] = { url: null, source: "none" };
        continue;
      }
      const key = `${wiki ?? ""}|${q || name}`;
      const cached = memo.get(key);
      if (cached) {
        results[i] = cached;
        continue;
      }
      results[i] = remember(key, await resolve(q, name, wiki));
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queries.length) }, worker));

  return NextResponse.json(
    { portraits: results },
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );
}
