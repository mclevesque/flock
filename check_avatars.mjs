import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const env = readFileSync('C:/Users/Thehu/flock/.env.local', 'utf8');
for (const line of env.split('\n')) {
  const m = line.match(/^([^=]+)=["']?(.+?)["']?\s*$/);
  if (m) process.env[m[1]] = m[2];
}

const sql = neon(process.env.DATABASE_URL);
const users = await sql`SELECT id, username, avatar_url FROM users ORDER BY created_at DESC`;
for (const u of users) {
  console.log(`${u.username} | ${u.id} | ${u.avatar_url ?? '(none)'}`);
}
