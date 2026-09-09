// Fetch verified geek trivia from OpenTDB into a local pool for Nerd Alert!
// Free API, community-verified questions. Run: node scripts/fetch-nerd-alert-clues.mjs
//
// Robustness notes (learned the hard way):
//  - OpenTDB rate-limits ~1 req / 5s. Exceeding it returns response_code 5.
//  - If api_token.php itself gets rate-limited it returns NO token; using an
//    undefined/invalid token then makes every api.php call return code 4.
//  - So: validate tokens, fall back to tokenless (one tokenless request returns
//    up to 50 DISTINCT questions, which fully covers our small categories), and
//    back off on code 5 instead of giving up.

import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "lib", "nerd-alert-pool.json");

const CATS = [
  { id: 15, name: "VIDEO GAMES" },
  { id: 31, name: "ANIME & MANGA" },
  { id: 11, name: "FILM" },
  { id: 14, name: "TELEVISION" },
  { id: 32, name: "CARTOONS" },
  { id: 29, name: "COMICS" },
  { id: 10, name: "BOOKS" },
  { id: 16, name: "BOARD GAMES" },
];
const DIFFS = ["easy", "medium", "hard"];
const DELAY = 6000;          // ms between requests (comfortable margin over 5s)
const BACKOFF = 9000;        // ms to wait after a rate-limit (code 5)
const MAX_PER_COMBO = 150;   // cap per (category, difficulty) — keeps it balanced

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dec = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

async function getTokenValidated() {
  for (let i = 0; i < 6; i++) {
    try {
      const r = await fetch("https://opentdb.com/api_token.php?command=request");
      const j = await r.json();
      if (j.response_code === 0 && j.token) return j.token;
    } catch { /* retry */ }
    await sleep(BACKOFF);
  }
  return null; // caller falls back to tokenless
}

async function fetchBatch(catId, diff, token) {
  let url = `https://opentdb.com/api.php?amount=50&category=${catId}&difficulty=${diff}&type=multiple&encode=url3986`;
  if (token) url += `&token=${token}`;
  const r = await fetch(url);
  return r.json();
}

async function main() {
  const pool = {};
  const seen = new Set();

  for (const cat of CATS) {
    pool[cat.name] = { easy: [], medium: [], hard: [] };
    for (const diff of DIFFS) {
      // Fresh validated token per (category, difficulty). null => tokenless.
      let token = await getTokenValidated();
      await sleep(DELAY);
      let got = 0;
      let fails = 0;
      while (got < MAX_PER_COMBO) {
        await sleep(DELAY);
        let data;
        try {
          data = await fetchBatch(cat.id, diff, token);
        } catch (e) {
          if (++fails > 6) { console.log(`  ${cat.name}/${diff}: giving up (errors)`); break; }
          await sleep(BACKOFF);
          continue;
        }
        const code = data.response_code;
        if (code === 5) {                       // rate limited
          if (++fails > 12) { console.log(`  ${cat.name}/${diff}: giving up (rate limit)`); break; }
          await sleep(BACKOFF);
          continue;
        }
        if (code === 3) {                       // token dead — refresh & retry
          token = await getTokenValidated();
          await sleep(DELAY);
          continue;
        }
        if (code === 4) { break; }              // exhausted for this query
        if (code !== 0 || !data.results || !data.results.length) { break; }
        fails = 0;
        for (const q of data.results) {
          const clue = dec(q.question).trim();
          const answer = dec(q.correct_answer).trim();
          if (!clue || !answer) continue;
          if (answer.length > 60) continue;
          const key = clue.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          pool[cat.name][diff].push({ clue, answer });
          got++;
        }
        console.log(`  ${cat.name}/${diff}: total ${got}${token ? "" : " (tokenless)"}`);
        if (data.results.length < 50) break;    // last page / small pool
        if (!token) break;                       // tokenless can't paginate without dups
      }
    }
    fs.writeFileSync(OUT, JSON.stringify(pool, null, 2));  // progress checkpoint
  }

  let total = 0;
  console.log("\n=== SUMMARY ===");
  for (const c of Object.keys(pool)) {
    const e = pool[c].easy.length, m = pool[c].medium.length, h = pool[c].hard.length;
    total += e + m + h;
    console.log(`  ${c}: ${e + m + h}  (easy ${e} / med ${m} / hard ${h})`);
  }
  console.log(`\nTOTAL: ${total} clues → ${OUT}`);
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
