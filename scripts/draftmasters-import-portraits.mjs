// Import hand-picked character portraits into DraftMasters.
//
//   node scripts/draftmasters-import-portraits.mjs [folder]
//
// Folder layout (default: the CHARACTERS folder on the OneDrive Desktop):
//   CHARACTERS/<franchise>/<CharacterName>.png|jpg|webp
//
// Filenames become names: "SerArthurDayne" -> "Ser Arthur Dayne",
// "JON SNOW" -> "Jon Snow". Each image is resized to card size, converted to
// WebP, uploaded to the R2 bucket under draftmasters/portraits/, and saved as
// a curated portrait keyed by character name — so it wins on any board that
// character appears on, ahead of every API lookup. Re-running is safe.

import fs from "node:fs";
import path from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import postgres from "postgres";

const ROOT = process.argv[2] || "C:/Users/Thehu/OneDrive/Desktop/CHARACTERS";
const PREFIX = "draftmasters/portraits";
const MAX_W = 900;
const MAX_H = 1125; // 4:5 at 900 wide

// ── env ──────────────────────────────────────────────────────────────────────
const env = {};
for (const line of fs.readFileSync(path.resolve(".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
for (const k of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_URL", "DATABASE_URL"]) {
  if (!env[k]) throw new Error(`missing ${k} in .env.local`);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
});
const sql = postgres(env.DATABASE_URL, { ssl: "require" });

// sharp ships with Next; if it's somehow missing we upload the original.
let sharp = null;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.warn("sharp not available — uploading originals without resizing");
}

// ── names ────────────────────────────────────────────────────────────────────

/** "SerArthurDayne" / "JON SNOW" / "eddard_stark" -> "Ser Arthur Dayne" etc. */
function nameFromFile(file) {
  let base = path.basename(file, path.extname(file)).replace(/[_-]+/g, " ").trim();
  if (!/\s/.test(base)) base = base.replace(/([a-z])([A-Z])/g, "$1 $2"); // CamelCase -> words
  return base
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Mirrors lib/draftmasters/portrait-memo.ts — keep the two in step.
function normalizeName(name) {
  return name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
const HONORIFICS = /^(ser|sir|lord|lady|king|queen|prince|princess|the|dr|doctor|captain|master)\s+/;
function nameKeys(name) {
  const norm = normalizeName(name);
  const keys = [`name:${norm}`];
  const bare = norm.replace(HONORIFICS, "");
  if (bare !== norm) keys.push(`name:${bare}`);
  return keys;
}

/** Well-known aliases so "Ned Stark" finds the Eddard photo, etc. Add freely. */
const ALIASES = {
  "eddard stark": ["ned stark"],
  "arthur dayne": ["sword of the morning"],
  "jaime lannister": ["kingslayer"],
  "gregor clegane": ["the mountain"],
  "sandor clegane": ["the hound"],
  "petyr baelish": ["littlefinger"],
  "daenerys targaryen": ["dany", "khaleesi"],
};

function slug(s) {
  return normalizeName(s).replace(/\s+/g, "-");
}

// ── main ─────────────────────────────────────────────────────────────────────

await sql`
  CREATE TABLE IF NOT EXISTS draftmasters_portraits (
    img_query TEXT PRIMARY KEY, url TEXT NOT NULL, source TEXT, chosen_by TEXT, updated_at TIMESTAMPTZ DEFAULT NOW()
  )
`;

const files = [];
for (const franchise of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (!franchise.isDirectory()) continue;
  for (const f of fs.readdirSync(path.join(ROOT, franchise.name))) {
    if (/\.(png|jpe?g|webp)$/i.test(f)) files.push({ franchise: franchise.name, file: path.join(ROOT, franchise.name, f) });
  }
}
if (!files.length) {
  console.log("no images found under", ROOT);
  process.exit(0);
}

let ok = 0;
for (const { franchise, file } of files) {
  const name = nameFromFile(file);
  const key = `${PREFIX}/${slug(franchise)}/${slug(name)}.webp`;
  const original = fs.readFileSync(file);

  let body = original;
  let contentType = "image/png";
  if (sharp) {
    body = await sharp(original).rotate().resize(MAX_W, MAX_H, { fit: "inside", withoutEnlargement: true }).webp({ quality: 86 }).toBuffer();
    contentType = "image/webp";
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  const url = `${env.R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`;

  const keys = new Set(nameKeys(name));
  const bare = normalizeName(name).replace(HONORIFICS, "");
  for (const alias of ALIASES[bare] ?? []) for (const k of nameKeys(alias)) keys.add(k);

  for (const k of keys) {
    await sql`
      INSERT INTO draftmasters_portraits (img_query, url, source, chosen_by)
      VALUES (${k}, ${url}, ${"curated"}, ${"import:" + slug(franchise)})
      ON CONFLICT (img_query) DO UPDATE SET url = EXCLUDED.url, source = EXCLUDED.source, chosen_by = EXCLUDED.chosen_by, updated_at = NOW()
    `;
  }

  ok++;
  console.log(
    `✓ ${name.padEnd(20)} ${(original.length / 1024 / 1024).toFixed(1)} MB -> ${(body.length / 1024).toFixed(0)} KB  keys: ${[...keys].map((k) => k.slice(5)).join(", ")}`
  );
  console.log(`   ${url}`);
}

console.log(`\n${ok}/${files.length} imported.`);
await sql.end();
