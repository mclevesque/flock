/**
 * save_babachoo_avatar.mjs
 * Looks up babachoo's bio/description, generates a wizard pixel art avatar,
 * saves it permanently to Vercel Blob, and updates the DB.
 */
import { neon } from '@neondatabase/serverless';
import { put } from '@vercel/blob';
import { readFileSync } from 'fs';

const env = readFileSync('C:/Users/Thehu/flock/.env.local', 'utf8');
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=[\"']?(.+?)[\"']?\s*$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const BLOB_TOKEN   = process.env.BLOB_READ_WRITE_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;
const HF_TOKEN     = process.env.HUGGINGFACE_TOKEN;

if (!HF_TOKEN) { console.error('HUGGINGFACE_TOKEN not set'); process.exit(1); }

const sql = neon(DATABASE_URL);

const users = await sql`
  SELECT id, username, bio, avatar_url FROM users
  WHERE LOWER(username) LIKE '%babachoo%'
  LIMIT 5
`;

if (users.length === 0) {
  console.error('Could not find babachoo user.');
  process.exit(1);
}

const user = users[0];
console.log(`Found user: @${user.username} (${user.id})`);
console.log(`Current avatar: ${user.avatar_url}`);
console.log(`Bio: ${user.bio ?? '(none)'}`);

const WIZARD_PROMPT =
  'pixel art avatar portrait, male wizard with long grey beard, pointed hat with stars, blue robes, wise glowing eyes, magical staff, retro 16bit game sprite, vibrant colors, clean background';

console.log('\nGenerating wizard image via HuggingFace FLUX...');
const imgRes = await fetch(
  'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell',
  {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs: WIZARD_PROMPT, parameters: { seed: 88421 } }),
    signal: AbortSignal.timeout(120_000),
  }
);

if (!imgRes.ok) {
  console.error(`HuggingFace error: ${imgRes.status} ${await imgRes.text().catch(() => '')}`);
  process.exit(1);
}

const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg';
const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
const buffer = await imgRes.arrayBuffer();
console.log(`✓ Fetched ${Math.round(buffer.byteLength / 1024)}KB ${contentType}`);

const blob = await put(`avatars/${user.id}_wizard.${ext}`, buffer, {
  access: 'public',
  allowOverwrite: true,
  contentType,
  token: BLOB_TOKEN,
});

console.log(`✓ Saved to Vercel Blob: ${blob.url}`);

await sql`UPDATE users SET avatar_url = ${blob.url} WHERE id = ${user.id}`;
console.log(`✅ @${user.username}'s avatar updated permanently!`);
