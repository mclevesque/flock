/**
 * restore_avatars.mjs
 * Regenerates AI avatars using Pollinations.ai (free, no API key)
 * and saves them permanently to Vercel Blob. Patches the DB with new URLs.
 */
import { neon } from '@neondatabase/serverless';
import { put } from '@vercel/blob';
import { readFileSync } from 'fs';

const env = readFileSync('C:/Users/Thehu/flock/.env.local', 'utf8');
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=["']?(.+?)["']?\s*$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const BLOB_TOKEN   = process.env.BLOB_READ_WRITE_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;

const sql = neon(DATABASE_URL);

const users = await sql`
  SELECT id, username, avatar_url
  FROM users
  WHERE avatar_url LIKE '/api/generate-image%'
  ORDER BY created_at DESC
`;

console.log(`Found ${users.length} users with AI-generated avatars to migrate:\n`);
for (const u of users) console.log(`  @${u.username}`);
console.log();

async function generateAndUpload(user) {
  const relUrl = new URL('http://x' + user.avatar_url);
  const prompt = relUrl.searchParams.get('prompt');
  const seed   = parseInt(relUrl.searchParams.get('seed') ?? '0') || 0;

  if (!prompt) { console.warn(`  [SKIP] @${user.username}: no prompt`); return null; }

  console.log(`🎨 Generating avatar for @${user.username} (seed=${seed})...`);

  // Try Pollinations.ai (free, no API key)
  // Use simple URL without extra params that might cause issues
  const pollinationsUrl =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?seed=${seed}&width=512&height=512&nologo=true`;

  console.log(`   URL: ${pollinationsUrl.slice(0, 100)}...`);

  const imgRes = await fetch(pollinationsUrl, {
    signal: AbortSignal.timeout(120_000),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Flock/1.0)' },
  });

  if (!imgRes.ok) {
    const txt = await imgRes.text().catch(() => '');
    console.error(`  ❌ Pollinations error ${imgRes.status}: ${txt.slice(0, 200)}`);
    return null;
  }

  const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg';
  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
  const buffer = await imgRes.arrayBuffer();
  console.log(`   ✓ Generated ${Math.round(buffer.byteLength / 1024)}KB ${contentType}`);

  const blob = await put(`avatars/${user.id}.${ext}`, buffer, {
    access: 'public',
    allowOverwrite: true,
    contentType,
    token: BLOB_TOKEN,
  });

  console.log(`   ✓ Blob: ${blob.url}`);
  return blob.url;
}

let ok = 0;
for (const user of users) {
  try {
    const blobUrl = await generateAndUpload(user);
    if (blobUrl) {
      await sql`UPDATE users SET avatar_url = ${blobUrl} WHERE id = ${user.id}`;
      console.log(`   ✅ @${user.username} saved permanently\n`);
      ok++;
    }
  } catch (err) {
    console.error(`  ❌ @${user.username} failed:`, err.message, '\n');
  }
  await new Promise(r => setTimeout(r, 3000));
}

console.log(`\n🎉 Migrated ${ok}/${users.length} avatars to permanent Vercel Blob URLs.`);
