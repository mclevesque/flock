import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getOrCreateAdventureStats, updateAdventureStats,
  createAdventureSession, getAdventureSession,
  joinAdventureSession, updateAdventureState,
  getActiveSessionForUser,
} from "@/lib/db";

function nanoid(n = 10) {
  return Math.random().toString(36).slice(2, 2 + n);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as { id: string };
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  if (sessionId) {
    const adv = await getAdventureSession(sessionId);
    return NextResponse.json(adv ?? { error: "Not found" });
  }

  // Return player stats + active session
  const [stats, activeSession] = await Promise.all([
    getOrCreateAdventureStats(u.id),
    getActiveSessionForUser(u.id),
  ]);
  return NextResponse.json({ stats, activeSession });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as { id: string };
  const body = await req.json();
  const { action } = body;

  if (action === "get-stats") {
    const stats = await getOrCreateAdventureStats(u.id);
    return NextResponse.json(stats);
  }

  if (action === "update-stats") {
    try {
      await updateAdventureStats(u.id, body.patch ?? {});
    } catch (e) {
      console.error("[adventure] updateAdventureStats failed:", e);
      return NextResponse.json({ error: "Failed to save stats", detail: String(e) }, { status: 500 });
    }
    const stats = await getOrCreateAdventureStats(u.id);
    return NextResponse.json(stats);
  }

  if (action === "create-session") {
    const { missionKey, missionData } = body;
    if (!missionKey || !missionData) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    const id = nanoid(12);
    const adv = await createAdventureSession(u.id, id, missionKey, missionData);
    return NextResponse.json(adv);
  }

  if (action === "join-session") {
    const { sessionId } = body;
    if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    await joinAdventureSession(sessionId, u.id);
    const adv = await getAdventureSession(sessionId);
    return NextResponse.json(adv);
  }

  if (action === "update-state") {
    const { sessionId, state, teamStats, status } = body;
    if (!sessionId || !state) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    await updateAdventureState(sessionId, state, teamStats, status);
    const adv = await getAdventureSession(sessionId);
    return NextResponse.json(adv);
  }

  if (action === "leave-session") {
    const { sessionId } = body;
    if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    // Mark abandoned if host leaves, otherwise just remove from team
    const adv = await getAdventureSession(sessionId);
    if (!adv) return NextResponse.json({ ok: true });
    if (adv.host_user_id === u.id) {
      await updateAdventureState(sessionId, adv.state, adv.team_stats, "abandoned");
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
