// Targeted gap-fill for the Nerd Alert pool.
// OpenTDB throttles an IP after ~15-20 requests/session, so the first category
// in a full run fills and the rest starve. This script instead does a SMALL,
// tokenless pass (one request grabs up to 50 distinct questions) for only the
// empty categories + missing hard tiers, then MERGES into the existing pool.
// Stays well under the throttle ceiling. Run AFTER a cooldown from any full run.

import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "lib", "nerd-alert-pool.json");
const DELAY = 6500;

// Only the gaps: 3 empty categories + the hard tiers that came back empty + thin Books.
const TARGETS = [
  { id: 32, name: "CARTOONS",       diffs: ["easy", "medium", "hard"] },
  { id: 29, name: "COMICS",         diffs: ["easy", "medium", "hard"] },
  { id: 16, name: "BOARD GAMES",    diffs: ["easy", "medium", "hard"] },
  { id: 31, name: "ANIME & MANGA",  diffs: ["hard"] },
  { id: 11, name: "FILM",           diffs: ["hard"] },
  { id: 14, name: "TELEVISION",     diffs: ["hard"] },
  { id: 10, name: "BOOKS",          diffs: ["easy", "hard"] },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dec = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

// OpenTDB returns code 1 (zero results) if you ask for more than the combo has.
// Try decreasing amounts until one succeeds. One tokenless request returns up
// to `amount` DISTINCT questions — enough to drain these small pools in one go.
const AMOUNTS = [40, 20, 10, 5];

async function fetchBatch(catId, diff, amount) {
  const url = `https://opentdb.com/api.php?amount=${amount}&category=${catId}&difficulty=${diff}&type=multiple&encode=url3986`;
  const r = await fetch(url);
  return r.json();
}

async function main() {
  const pool = JSON.parse(fs.readFileSync(OUT, "utf8"));

  // Build the global seen-set from everything already stored.
  const seen = new Set();
  for (const c of Object.keys(pool)) {
    for (const d of ["easy", "medium", "hard"]) {
      for (const q of pool[c][d] || []) seen.add(q.clue.toLowerCase());
    }
  }

  for (const t of TARGETS) {
    if (!pool[t.name]) pool[t.name] = { easy: [], medium: [], hard: [] };
    for (const diff of t.diffs) {
      let added = 0;
      for (const amount of AMOUNTS) {
        await sleep(DELAY);
        let data;
        try { data = await fetchBatch(t.id, diff, amount); }
        catch (e) { console.log(`  ${t.name}/${diff}: error ${e.message}`); break; }
        if (data.response_code === 5) {        // rate limited — wait & retry same amount
          console.log(`  ${t.name}/${diff}@${amount}: rate limited, waiting`);
          await sleep(DELAY * 2);
          continue;
        }
        if (data.response_code === 1) {        // too many requested — try a smaller amount
          console.log(`  ${t.name}/${diff}@${amount}: too few available, shrinking`);
          continue;
        }
        if (data.response_code !== 0 || !data.results || !data.results.length) {
          console.log(`  ${t.name}/${diff}@${amount}: no results (code ${data.response_code})`);
          break;
        }
        for (const q of data.results) {
          const clue = dec(q.question).trim();
          const answer = dec(q.correct_answer).trim();
          if (!clue || !answer || answer.length > 60) continue;
          const key = clue.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          pool[t.name][diff].push({ clue, answer });
          added++;
        }
        console.log(`  ${t.name}/${diff}@${amount}: +${added}`);
        break;                                 // got a successful grab — done with this combo
      }
    }
    fs.writeFileSync(OUT, JSON.stringify(pool, null, 2));
  }

  let total = 0;
  console.log("\n=== MERGED SUMMARY ===");
  for (const c of Object.keys(pool)) {
    const e = pool[c].easy.length, m = pool[c].medium.length, h = pool[c].hard.length;
    total += e + m + h;
    console.log(`  ${c}: ${e + m + h}  (easy ${e} / med ${m} / hard ${h})`);
  }
  console.log(`\nTOTAL: ${total} clues → ${OUT}`);
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
