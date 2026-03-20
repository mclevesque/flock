import { NextRequest, NextResponse } from "next/server";
import { advanceStoryline, getLatestStorylines, cleanupExpiredGroundItems, forceInitialHeraldPost } from "@/lib/db";

export const maxDuration = 60;

/** Internal admin endpoint — protected by secret header. Not for public use. */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-town-admin-secret");
  const envSecret = process.env.TOWN_ADMIN_SECRET;

  // If a secret is configured, enforce it; otherwise allow (dev/first-deploy)
  if (envSecret && secret !== envSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  if (action === "advance-storyline") {
    try {
      const content = await advanceStoryline();
      return NextResponse.json({ ok: true, content });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  if (action === "get-storyline") {
    const chapters = await getLatestStorylines(10);
    return NextResponse.json({ chapters });
  }

  if (action === "cleanup") {
    await cleanupExpiredGroundItems();
    return NextResponse.json({ ok: true });
  }

  if (action === "init-herald") {
    try {
      const shareId = await forceInitialHeraldPost();
      return NextResponse.json({ ok: true, shareId });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
