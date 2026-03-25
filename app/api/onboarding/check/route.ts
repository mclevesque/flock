import { NextRequest, NextResponse } from "next/server";
import { getUserById } from "@/lib/db";

// Internal endpoint called by middleware to check if a Clerk user already has a username in DB.
// Only trusted when called with the x-flock-internal header set by middleware itself.
export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-ryft-uid");
  if (!userId) return NextResponse.json({ hasUsername: false });

  const user = await getUserById(userId).catch(() => null);
  const hasUsername = !!(user?.username);
  return NextResponse.json({ hasUsername });
}
