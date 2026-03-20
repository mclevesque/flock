import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
const env = readFileSync('C:/Users/Thehu/flock/.env.local', 'utf8');
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=[\"']?(.+?)[\"']?\s*$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}
const sql = neon(process.env.DATABASE_URL);
const users = await sql`SELECT id, username, avatar_url, bio FROM users WHERE LOWER(username) LIKE '%tinybeat%' LIMIT 3`;
console.log(JSON.stringify(users, null, 2));
