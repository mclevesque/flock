import { sql } from "@/lib/db";

export async function GET() {
  try {
    const rows = await sql`
      SELECT s.id, s.topic, s.created_at, COUNT(r.id) as result_count
      FROM blindrank_sessions s
      LEFT JOIN blindrank_results r ON s.id = r.session_id
      GROUP BY s.id, s.topic, s.created_at
      ORDER BY s.created_at DESC
    `;
    return Response.json({
      sessions: rows.map(r => ({
        id: r.id as string,
        topic: r.topic as string,
        createdAt: (r.created_at as Date).toISOString(),
        resultCount: parseInt(r.result_count as any, 10),
      })),
    });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }
}
