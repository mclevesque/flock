import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ chronicleReplies: 0 });

  const since = req.nextUrl.searchParams.get("since");
  // If no `since`, return 0 (first load — caller will set the baseline)
  if (!since) return NextResponse.json({ chronicleReplies: 0 });

  const sinceDate = new Date(Number(since));
  if (isNaN(sinceDate.getTime())) return NextResponse.json({ chronicleReplies: 0 });

  try {
    const rows = await sql`
      SELECT COUNT(*) AS cnt
      FROM chronicle_comments cc
      JOIN chronicle_entries ce ON ce.id = cc.entry_id
      WHERE ce.user_id = ${session.user.id}
        AND cc.author_id != ${session.user.id}
        AND cc.created_at > ${sinceDate.toISOString()}
    `;
    const count = Number(rows[0]?.cnt ?? 0);
    return NextResponse.json({ chronicleReplies: count });
  } catch {
    return NextResponse.json({ chronicleReplies: 0 });
  }
}
