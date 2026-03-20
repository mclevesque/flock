import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

// One-time endpoint: adds all users as accepted friends of mclevesque
export async function GET() {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const target = await sql`SELECT id FROM users WHERE username = 'mclevesque' LIMIT 1`;
    if (!target[0]) return NextResponse.json({ error: "mclevesque not found" }, { status: 404 });
    const myId = target[0].id;

    const others = await sql`SELECT id FROM users WHERE username != 'mclevesque'`;

    let count = 0;
    for (const u of others) {
      await sql`
        INSERT INTO friendships (requester_id, addressee_id, status)
        VALUES (${myId}, ${u.id}, 'accepted')
        ON CONFLICT DO NOTHING
      `;
      await sql`
        UPDATE friendships SET status = 'accepted'
        WHERE (requester_id = ${u.id} AND addressee_id = ${myId})
           OR (requester_id = ${myId} AND addressee_id = ${u.id})
      `;
      count++;
    }

    return NextResponse.json({ ok: true, friendsAdded: count });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
