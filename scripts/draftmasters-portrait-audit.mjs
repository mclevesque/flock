/**
 * Portrait audit — find the boards whose pictures are wrong.
 *
 * The game resolves portraits at play time from Google, Fandom, Wikipedia and
 * Commons, and it fails in three distinct ways that look identical on a card:
 *
 *   MISSING    nothing resolved at all; the card shows a letter.
 *   GENERATED  the cascade gave up and asked for an AI image. Better than a
 *              letter, but it is not the character.
 *   BROKEN     a URL resolved but does not actually load, usually a Fandom
 *              file that moved. This is the worst kind because the board looks
 *              fine until you play it.
 *
 * Usage:
 *   node scripts/draftmasters-portrait-audit.mjs                 # every board
 *   node scripts/draftmasters-portrait-audit.mjs mk sf smash     # named boards
 *   node scripts/draftmasters-portrait-audit.mjs --host=http://localhost:3001
 */

const HOST =
  process.argv.find((a) => a.startsWith("--host="))?.slice(7) ?? "https://greatsouls.net";
const WANTED = process.argv.slice(2).filter((a) => !a.startsWith("--"));

/** The resolver caps a request at 40 queries and silently drops the rest. */
const BATCH = 40;

const j = (r) => r.json();

async function boards() {
  const res = await fetch(`${HOST}/api/draftmasters/packs`).catch(() => null);
  if (res?.ok) {
    const d = await j(res);
    if (Array.isArray(d.packs)) return d.packs.map((p) => p.id);
  }
  // No listing endpoint — fall back to the ids we know.
  return [
    "got", "marvel", "pokemon", "animals", "starwars", "horror", "bosses",
    "anime", "dc", "lotr", "myth",
    "berserk", "tmnt", "rangers", "ppg", "invincible", "mk", "sf", "smash",
  ];
}

async function resolveBoard(id) {
  const { pack } = await fetch(`${HOST}/api/draftmasters/pack/${id}`, {
    cache: "no-store",
  }).then(j);
  const ctx = pack.imgContext ?? "";
  const queries = pack.entries.map((e) => ({
    q: `${e.s ? `${e.n} ${e.s}` : e.n} ${ctx}`.trim(),
    name: e.n,
    wiki: e.wiki ?? pack.wiki,
  }));

  const out = [];
  for (let i = 0; i < queries.length; i += BATCH) {
    const slice = queries.slice(i, i + BATCH);
    const { portraits } = await fetch(`${HOST}/api/draftmasters/portrait`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queries: slice, wiki: pack.wiki }),
    }).then(j);
    slice.forEach((qq, k) =>
      out.push({ name: qq.name, url: portraits?.[k]?.url ?? null, source: portraits?.[k]?.source ?? "none" })
    );
  }
  return { pack, rows: out };
}

/** A URL that resolves but 404s is worse than no URL — the board looks fine until you play it. */
async function checkLive(rows, limit = 8) {
  const withUrl = rows.filter((r) => r.url);
  let next = 0;
  const broken = [];
  await Promise.all(
    Array.from({ length: Math.min(limit, withUrl.length) }, async () => {
      while (next < withUrl.length) {
        const r = withUrl[next++];
        try {
          const res = await fetch(r.url, { method: "HEAD", signal: AbortSignal.timeout(12000) });
          if (!res.ok) broken.push({ ...r, status: res.status });
        } catch {
          broken.push({ ...r, status: "unreachable" });
        }
      }
    })
  );
  return broken;
}

const ids = WANTED.length ? WANTED : await boards();
const summary = [];

for (const id of ids) {
  process.stdout.write(`  ${id.padEnd(11)} resolving… `);
  let pack, rows;
  try {
    ({ pack, rows } = await resolveBoard(id));
  } catch (e) {
    console.log(`FAILED (${e.message})`);
    continue;
  }
  const missing = rows.filter((r) => !r.url);
  const generated = rows.filter((r) => r.source === "generated");
  const broken = await checkLive(rows);
  const good = rows.length - missing.length - generated.length - broken.length;
  const pct = Math.round((good / rows.length) * 100);
  summary.push({ id, name: pack.name, total: rows.length, good, pct, missing, generated, broken });
  console.log(`${pct}% real  (${missing.length} missing, ${generated.length} generated, ${broken.length} broken)`);
}

console.log("\n" + "=".repeat(72));
console.log("BOARDS NEEDING WORK (worst first)");
console.log("=".repeat(72));
for (const b of [...summary].sort((a, b2) => a.pct - b2.pct)) {
  if (b.pct >= 95) continue;
  console.log(`\n${b.name} (${b.id}) — ${b.pct}% real of ${b.total}`);
  const show = (label, list) => {
    if (!list.length) return;
    console.log(`  ${label} (${list.length}): ${list.slice(0, 14).map((r) => r.name).join(", ")}${list.length > 14 ? " …" : ""}`);
  };
  show("MISSING", b.missing);
  show("GENERATED", b.generated);
  show("BROKEN", b.broken);
}

const worst = summary.filter((b) => b.pct < 95).length;
console.log(`\n${summary.length} boards audited, ${worst} need attention.`);
