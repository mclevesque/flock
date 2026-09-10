/**
 * Which cards on which boards have no power written for them?
 *
 * Four separate "the AI is judging badly" reports have turned out to be the
 * same thing: a card nobody rated, falling through to its board's ordinary
 * value. Feanor rated below Gregor Clegane. Every god in every pantheon rated
 * below a mid-tier Saiyan. Manwe, King of the Valar, lost to an elf.
 *
 * This lists them, worst first, so the class can be closed instead of
 * answered one screenshot at a time.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = "lib/draftmasters";

// The written keys, straight out of the source: every ["name", [n, n]] row.
function writtenKeys(): string[] {
  const files = [
    path.join(ROOT, "power.ts"),
    ...fs.readdirSync(path.join(ROOT, "boards")).map((f) => path.join(ROOT, "boards", f)),
  ];
  const keys: string[] = [];
  for (const f of files) {
    if (!f.endsWith(".ts")) continue;
    const src = fs.readFileSync(f, "utf8");
    for (const m of src.matchAll(/\["([^"]+)",\s*\[\s*\d+/g)) keys.push(m[1].toLowerCase());
  }
  return keys;
}

const keys = writtenKeys();
const isWritten = (name: string) => {
  const hay = name.toLowerCase();
  return keys.some((k) => hay.includes(k) || k.includes(hay));
};

// Every board's roster, read out of the pack files.
const packs = path.join(ROOT, "packs.ts");
const src = fs.existsSync(packs) ? fs.readFileSync(packs, "utf8") : "";
const boards = [...src.matchAll(/id:\s*"([a-z0-9-]+)"[\s\S]*?entries:\s*\[([\s\S]*?)\n\s*\]/g)];

let totalMissing = 0;
const rows: { board: string; missing: string[]; total: number }[] = [];

for (const [, id, block] of boards) {
  const names = [...block.matchAll(/n:\s*"([^"]+)"/g)].map((m) => m[1]);
  if (!names.length) continue;
  const missing = names.filter((n) => !isWritten(n));
  totalMissing += missing.length;
  rows.push({ board: id, missing, total: names.length });
}

rows.sort((a, b) => b.missing.length - a.missing.length);
console.log(`${keys.length} written entries; ${totalMissing} cards with none\n`);
for (const r of rows) {
  if (!r.missing.length) continue;
  console.log(`${r.board}  ${r.missing.length}/${r.total} unwritten`);
  console.log("   " + r.missing.slice(0, 14).join(", ") + (r.missing.length > 14 ? " …" : ""));
}
