/**
 * One-time migration: Vercel Blob → Cloudflare R2
 * Migrates avatars/, songs/, shares/ — updates DB avatar_url values too.
 *
 * Run with:
 *   node scripts/migrate-blob-to-r2.mjs
 *
 * Requires .env.local to have both BLOB_READ_WRITE_TOKEN and R2_* vars set.
 */

import { list, head } from "@vercel/blob";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ── Load .env.local manually ───────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");
const envLines = readFileSync(envPath, "utf8").split("\n");
for (const line of envLines) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const val = match[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

// ── Config ─────────────────────────────────────────────────────────────────
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;
const DATABASE_URL = process.env.DATABASE_URL;

if (!BLOB_TOKEN || !R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !R2_PUBLIC_URL || !DATABASE_URL) {
  console.error("Missing required env vars. Check .env.local");
  process.exit(1);
}

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

const sql = neon(DATABASE_URL);

// ── Helpers ────────────────────────────────────────────────────────────────
async function listAllBlobs(prefix) {
  const blobs = [];
  let cursor;
  do {
    const res = await list({ prefix, token: BLOB_TOKEN, cursor, limit: 1000 });
    blobs.push(...res.blobs);
    cursor = res.cursor;
  } while (cursor);
  return blobs;
}

async function migrateBlob(blob) {
  const key = new URL(blob.url).pathname.slice(1); // strip leading /
  console.log(`  ↓ Downloading ${key}...`);

  const res = await fetch(blob.url);
  if (!res.ok) {
    console.warn(`  ⚠ Failed to download ${blob.url} (${res.status}) — skipping`);
    return null;
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "application/octet-stream";

  console.log(`  ↑ Uploading to R2: ${key}`);
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));

  return `${R2_PUBLIC_URL}/${key}`;
}

// ── Main ───────────────────────────────────────────────────────────────────
console.log("🚀 Starting Vercel Blob → Cloudflare R2 migration\n");

// 1. Migrate avatars and update DB
console.log("📸 Migrating avatars/...");
const avatarBlobs = await listAllBlobs("avatars/");
console.log(`   Found ${avatarBlobs.length} avatar(s)`);

for (const blob of avatarBlobs) {
  const r2Url = await migrateBlob(blob);
  if (!r2Url) continue;

  // Update any user whose avatar_url matches this blob URL
  const result = await sql`
    UPDATE users SET avatar_url = ${r2Url}
    WHERE avatar_url = ${blob.url}
    RETURNING id, username
  `;
  if (result.length > 0) {
    console.log(`  ✅ Updated DB for user: ${result[0].username} (${result[0].id})`);
  } else {
    console.log(`  ℹ No DB row matched for ${blob.url}`);
  }
}

// 2. Migrate songs
console.log("\n🎵 Migrating songs/...");
const songBlobs = await listAllBlobs("songs/");
console.log(`   Found ${songBlobs.length} song(s)`);

for (const blob of songBlobs) {
  const r2Url = await migrateBlob(blob);
  if (!r2Url) continue;

  // Update profile_song_url in users table
  const result = await sql`
    UPDATE users SET profile_song_url = ${r2Url}
    WHERE profile_song_url = ${blob.url}
    RETURNING id, username
  `;
  if (result.length > 0) {
    console.log(`  ✅ Updated song for user: ${result[0].username}`);
  } else {
    console.log(`  ℹ No DB row matched for ${blob.url}`);
  }
}

// 3. Migrate shares (if any)
console.log("\n🔗 Migrating shares/...");
const shareBlobs = await listAllBlobs("shares/");
console.log(`   Found ${shareBlobs.length} share(s)`);

for (const blob of shareBlobs) {
  await migrateBlob(blob);
  // shares are referenced by URL in share records — no DB update needed for now
}

console.log("\n✅ Migration complete!");
console.log("   New uploads will go to R2 automatically.");
console.log("   You can now revoke the Vercel Blob token and cancel Vercel.");
