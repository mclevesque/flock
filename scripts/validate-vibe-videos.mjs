/**
 * Checks all hardcoded YouTube video IDs in vibeData.ts against the YouTube Data API.
 * Removes any that are deleted, private, or embedding-blocked.
 * Run: node scripts/validate-vibe-videos.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env
const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach(line => {
    const [k, ...v] = line.split("=");
    if (k && v.length) process.env[k.trim()] = v.join("=").trim().replace(/^["']|["']$/g, "");
  });
}

const API_KEY = process.env.YOUTUBE_API_KEY;
if (!API_KEY) { console.error("Missing YOUTUBE_API_KEY in .env.local"); process.exit(1); }

// Extract video IDs from vibeData.ts
const vibeDataPath = path.join(__dirname, "../app/vibe/vibeData.ts");
const src = fs.readFileSync(vibeDataPath, "utf8");

// Find all id: "XXXXXXXXXXX" entries (11-char YouTube IDs)
const idMatches = [...src.matchAll(/\{ id: "([a-zA-Z0-9_-]{11})"/g)];
const allIds = [...new Set(idMatches.map(m => m[1]))];

console.log(`Found ${allIds.length} unique video IDs. Checking with YouTube API...`);

// Batch into groups of 50 (API max)
async function checkBatch(ids) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=status&id=${ids.join(",")}&key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) { console.error("API error:", data); process.exit(1); }

  const valid = new Set();
  const blocked = new Set();

  for (const item of (data.items || [])) {
    if (item.status?.embeddable === false) {
      blocked.add(item.id);
    } else {
      valid.add(item.id);
    }
  }

  // IDs not in response = deleted/private
  return { valid, blocked };
}

const dead = new Set();
const embeddingBlocked = new Set();

for (let i = 0; i < allIds.length; i += 50) {
  const batch = allIds.slice(i, i + 50);
  const { valid, blocked } = await checkBatch(batch);

  for (const id of batch) {
    if (!valid.has(id) && !blocked.has(id)) dead.add(id);
    if (blocked.has(id)) embeddingBlocked.add(id);
  }
  await new Promise(r => setTimeout(r, 300));
}

console.log(`\n✅ Valid: ${allIds.length - dead.size - embeddingBlocked.size}`);
console.log(`🚫 Dead/private: ${dead.size} — ${[...dead].join(", ")}`);
console.log(`🔒 Embedding blocked: ${embeddingBlocked.size} — ${[...embeddingBlocked].join(", ")}`);

const toRemove = new Set([...dead, ...embeddingBlocked]);

if (toRemove.size === 0) {
  console.log("\n🎉 All videos are valid — nothing to remove!");
  process.exit(0);
}

// Remove dead entries from vibeData.ts
let updated = src;
for (const id of toRemove) {
  // Remove the full line containing this ID
  updated = updated.replace(new RegExp(`  \\{ id: "${id}"[^\\n]+\\n`, "g"), "");
}

fs.writeFileSync(vibeDataPath, updated);
console.log(`\n✅ Removed ${toRemove.size} dead videos from vibeData.ts`);
