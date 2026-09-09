/**
 * Backfill portraits into R2, permanently.
 *
 * WHY THIS EXISTS. The game resolves portraits live at play time and the
 * result is not durable: Fandom files move, generation fails, and Wikimedia
 * rate-limits and blocks datacenter IPs, so a call that works from a laptop
 * returns nothing from a serverless function. A curated portrait sits at step
 * 0 of the cascade and beats all of it, so this walks a board once and freezes
 * the best picture it can find for every entry.
 *
 * HOW IT FINDS THEM, in order:
 *
 *   1. THE LIVE RESOLVER on production. This is the fast path and the one that
 *      matters. It has the Google key and, for a board with a `wiki`, Fandom —
 *      which is why House of the Dragon portraits appeared in seconds while
 *      this script used to crawl. It answers forty at a time with no rate
 *      limiting. Anything it returns from a real source gets frozen into R2 so
 *      it can never regress to a letter later.
 *
 *   2. WIKIPEDIA AND COMMONS, from this machine, for whatever step 1 could not
 *      get — an AI-generated placeholder, or nothing at all. Wikimedia throttles
 *      bulk callers hard, so this tier is slow on purpose and is now reserved
 *      for the handful of entries that need it rather than the whole board.
 *
 * It never overwrites a portrait somebody curated by hand, and it checks the
 * Wikipedia page title against the entry name before accepting an image,
 * because "Odin" returns Odin (Marvel Comics) and a board of Norse gods should
 * not show a Marvel character.
 *
 * Usage:
 *   node scripts/draftmasters-backfill-portraits.mjs greek animals
 *   node scripts/draftmasters-backfill-portraits.mjs --dry got
 *   node scripts/draftmasters-backfill-portraits.mjs --live-only pokemon
 */

import sharp from "sharp";

const HOST = process.argv.find((a) => a.startsWith("--host="))?.slice(7) ?? "https://greatsouls.net";
const DRY = process.argv.includes("--dry");
/** Skip the slow Wikimedia tier entirely — useful for big fictional boards. */
const LIVE_ONLY = process.argv.includes("--live-only");
const BOARDS = process.argv.slice(2).filter((a) => !a.startsWith("--"));

const UA = { "User-Agent": "DraftMasters/1.0 (greatsouls.net; portrait backfill)" };
const CARD_W = 900;
const CARD_H = 1125;
/** The live resolver caps a request at this many queries and drops the rest. */
const BATCH = 40;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!BOARDS.length) {
  console.error("give me at least one board id");
  process.exit(1);
}

/**
 * Wikimedia throttles bulk callers hard — a burst of ten gets the next fifty a
 * 429 apiece, which looks exactly like the pages not existing. Honour
 * Retry-After, back off, and keep requests serial.
 */
async function politeFetch(url, opts = {}, tries = 5) {
  for (let attempt = 0; attempt < tries; attempt++) {
    const res = await fetch(url, opts).catch(() => null);
    if (res && res.status !== 429 && res.status !== 503) return res;
    const retryAfter = Number(res?.headers?.get("retry-after")) || 0;
    const wait = retryAfter ? retryAfter * 1000 : Math.min(30000, 1500 * 2 ** attempt);
    process.stdout.write("~");
    await sleep(wait);
  }
  return null;
}

// ── Relevance ────────────────────────────────────────────────────────────────

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * Does this page actually depict the entry?
 *
 * Wikipedia's search is loose — "Odin" surfaces Odin (Marvel Comics) and a
 * Japanese anime film. Requiring every significant word of the name to appear
 * in the title, and rejecting titles that name a DIFFERENT franchise, is what
 * keeps comic art off a board of historical figures.
 */
const FRANCHISE_NOISE = [
  "marvel", "dc comics", "comics", "video game", "film)", "album", "band",
  "song", "tv series", "manga", "anime", "novel", "disambiguation",
];

function titleMatches(entryName, title) {
  const t = norm(title);
  const want = norm(entryName).split(" ").filter((w) => w.length > 2);
  if (!want.length) return false;
  if (FRANCHISE_NOISE.some((n) => t.includes(n))) return false;
  if (want.every((w) => t.includes(w))) return true;
  // Canonical pages are often SHORTER than the entry: the article for
  // "Napoleon Bonaparte" is titled just "Napoleon". Accept a title whose words
  // are all contained in the entry name, which keeps that case without opening
  // the door to unrelated pages.
  const got = t.split(" ").filter((w) => w.length > 2);
  return got.length > 0 && got.every((w) => want.includes(w));
}

// ── Sources ──────────────────────────────────────────────────────────────────

/**
 * Ask production to resolve a whole batch the way the game does.
 *
 * Returns one row per query: the URL it found and which tier produced it.
 * "generated" means the cascade gave up and drew something, which is exactly
 * what we are here to replace.
 */
async function fromLiveResolver(queries, boardWiki) {
  const res = await fetch(`${HOST}/api/draftmasters/portrait`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ queries, wiki: boardWiki }),
    signal: AbortSignal.timeout(60000),
  }).catch(() => null);
  if (!res?.ok) return queries.map(() => null);
  const data = await res.json().catch(() => null);
  return queries.map((_, i) => data?.portraits?.[i] ?? null);
}

async function fromWikipedia(query, entryName) {
  const url =
    "https://en.wikipedia.org/w/api.php?action=query&format=json&generator=search" +
    `&gsrlimit=6&gsrnamespace=0&gsrsearch=${encodeURIComponent(query)}` +
    "&prop=pageimages&piprop=thumbnail|original&pithumbsize=1200";
  const res = await politeFetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
  if (!res || !res.ok) return null;
  const pages = Object.values((await res.json())?.query?.pages ?? {});
  const hit = pages
    .filter((p) => p?.thumbnail?.source && titleMatches(entryName, p.title ?? ""))
    .sort((a, b) => (a.index ?? 99) - (b.index ?? 99))[0];
  return hit ? { url: hit.original?.source ?? hit.thumbnail.source, credit: hit.title } : null;
}

/** Commons is the fallback for things with no article — a role, an animal, an object. */
async function fromCommons(query) {
  const url =
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search" +
    `&gsrlimit=8&gsrnamespace=6&gsrsearch=${encodeURIComponent(query)}` +
    "&prop=imageinfo&iiprop=url|size&iiurlwidth=1200";
  const res = await politeFetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
  if (!res || !res.ok) return null;
  const pages = Object.values((await res.json())?.query?.pages ?? {});
  const hit = pages
    .map((p) => p?.imageinfo?.[0])
    .filter((i) => i?.thumburl && i.width && i.height)
    // Portrait-ish only: a 3:1 banner cannot be cropped into a card.
    .filter((i) => i.height / i.width > 0.75)[0];
  return hit ? { url: hit.thumburl, credit: "Wikimedia Commons" } : null;
}

// ── Store ────────────────────────────────────────────────────────────────────

async function store(name, buffer, imgQuery) {
  const cropped = await sharp(buffer)
    .rotate()
    .resize(CARD_W, CARD_H, { fit: "cover", position: "top" })
    .webp({ quality: 90 })
    .toBuffer();

  const put = await fetch(`${HOST}/.netlify/functions/portrait-store`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, dataUrl: "data:image/webp;base64," + cropped.toString("base64") }),
  });
  const stored = await put.json().catch(() => null);
  if (!stored?.url) throw new Error(stored?.error ?? `store failed (${put.status})`);

  // Recorded as curated so it wins on every board this character appears on.
  await fetch(`${HOST}/api/draftmasters/portrait/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imgQuery, url: stored.url, source: "curated", verdict: "good", name }),
  });
  return stored.url;
}

/** Download, crop and freeze one image. Returns true when it landed. */
async function freeze(name, imgQuery, srcUrl) {
  const abs = srcUrl.startsWith("http") ? srcUrl : `${HOST}${srcUrl}`;
  const img = await politeFetch(abs, { headers: UA, signal: AbortSignal.timeout(25000) });
  if (!img || !img.ok) throw new Error(`fetch ${img?.status ?? "failed"}`);
  const buf = Buffer.from(await img.arrayBuffer());
  if (buf.length < 1000) throw new Error("image too small to be real");
  await store(name, buf, imgQuery);
  return true;
}

// ── Run ──────────────────────────────────────────────────────────────────────

/**
 * Where the board's ENTRY LIST comes from.
 *
 * Production, normally — it is the deployed truth and needs no build step. But
 * a board that has just been written does not exist there yet, and requiring a
 * deploy before you can fetch pictures for it gets the order exactly backwards:
 * you want the portraits curated BEFORE anyone sees the board, not after.
 *
 * So `--packs=<file.json>` reads the list locally instead. Only the list — the
 * pictures still come from the production resolver, which is the part with the
 * Google key and the Fandom access and the reason this is fast.
 *
 *   node scripts/build-packs-json.mjs > /tmp/packs.json
 *   node scripts/draftmasters-backfill-portraits.mjs --packs=/tmp/packs.json spn cw
 */
const PACKS_FILE = process.argv.find((a) => a.startsWith("--packs="))?.slice(8);
let LOCAL_PACKS = null;
if (PACKS_FILE) {
  const { readFileSync } = await import("node:fs");
  LOCAL_PACKS = JSON.parse(readFileSync(PACKS_FILE, "utf8"));
  console.log(`Reading board contents from ${PACKS_FILE} (${LOCAL_PACKS.length} boards).`);
}

async function loadPack(id) {
  if (LOCAL_PACKS) {
    const found = LOCAL_PACKS.find((p) => p.id === id);
    if (!found) throw new Error(`no board "${id}" in ${PACKS_FILE}`);
    return found;
  }
  const { pack } = await fetch(`${HOST}/api/draftmasters/pack/${id}`, { cache: "no-store" }).then((r) => r.json());
  return pack;
}

for (const id of BOARDS) {
  const pack = await loadPack(id);
  const ctx = pack.imgContext ?? "";
  console.log(`\n${pack.name} (${id}) — ${pack.entries.length} entries`);

  const rows = pack.entries.map((e) => ({
    name: e.n,
    imgQuery: `${e.s ? `${e.n} ${e.s}` : e.n} ${ctx}`.trim(),
    wiki: e.wiki ?? pack.wiki,
  }));

  let frozen = 0, skipped = 0, failed = 0;
  const needsSlowPath = [];
  const misses = [];

  // ── Tier 1: the live resolver, forty at a time ────────────────────────────
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const found = await fromLiveResolver(
      slice.map((r) => ({ q: r.imgQuery, name: r.name, wiki: r.wiki })),
      pack.wiki
    );

    for (let k = 0; k < slice.length; k++) {
      const row = slice[k];
      const hit = found[k];

      // Already curated by a human or an earlier run — never clobber it.
      if (hit?.source === "curated") { skipped++; process.stdout.write("="); continue; }

      // A drawn placeholder is the thing we are replacing, not a result.
      if (!hit?.url || hit.source === "generated" || hit.source === "none") {
        needsSlowPath.push(row);
        continue;
      }

      if (DRY) { console.log(`   would freeze ${row.name.padEnd(28)} <- ${hit.source}`); frozen++; continue; }

      try {
        await freeze(row.name, row.imgQuery, hit.url);
        frozen++;
        process.stdout.write(".");
      } catch {
        needsSlowPath.push(row);
      }
    }
  }

  // ── Tier 2: Wikimedia, only for what tier 1 could not get ─────────────────
  if (needsSlowPath.length && !LIVE_ONLY) {
    console.log(`\n   ${needsSlowPath.length} left for the slow tier (Wikipedia/Commons)`);
    for (const row of needsSlowPath) {
      // Bare name first: "Leonardo da Vinci" beats "Leonardo da Vinci portrait".
      let src = await fromWikipedia(row.name, row.name).catch(() => null);
      if (!src) src = await fromWikipedia(row.imgQuery, row.name).catch(() => null);
      if (!src) src = await fromCommons(`${row.name} ${ctx}`).catch(() => null);
      if (!src) { failed++; misses.push(row.name); await sleep(700); continue; }

      if (DRY) { console.log(`   would set ${row.name.padEnd(28)} <- ${src.credit}`); frozen++; await sleep(700); continue; }

      try {
        await freeze(row.name, row.imgQuery, src.url);
        frozen++;
        process.stdout.write(".");
      } catch (err) {
        failed++;
        misses.push(`${row.name} (${err.message})`);
        process.stdout.write("x");
      }
      // Wikimedia asks for politeness and this is a bulk job.
      await sleep(700);
    }
  } else if (needsSlowPath.length) {
    failed += needsSlowPath.length;
    misses.push(...needsSlowPath.map((r) => r.name));
  }

  console.log(`\n   ${frozen} frozen, ${skipped} already curated, ${failed} not found`);
  if (misses.length) {
    console.log(`   no source: ${misses.slice(0, 20).join(", ")}${misses.length > 20 ? " …" : ""}`);
  }
}
