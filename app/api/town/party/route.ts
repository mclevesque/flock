import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  createPartyInvite, getPendingPartyInvite, updatePartyInviteStatus,
  getOrCreateCaveSession, joinCaveSession, leaveCaveSession, getSessionTeamData,
  createAdventureSession, joinAdventureSession,
} from "@/lib/db";

function nanoid(n = 10) {
  return Math.random().toString(36).slice(2, 2 + n);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as { id: string };
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  if (action === "pending-invite") {
    const invite = await getPendingPartyInvite(u.id);
    return NextResponse.json(invite ?? null);
  }

  if (action === "cave-session") {
    const sess = await getOrCreateCaveSession();
    const teamData = await getSessionTeamData(sess.id);
    return NextResponse.json({ sessionId: sess.id, team: teamData.members, count: sess.team_user_ids.length });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as { id: string; name?: string | null };
  const body = await req.json().catch(() => ({}));
  const { action } = body;

  // ── Send party invite ──────────────────────────────────────────────────────
  if (action === "invite") {
    const { toUserId, missionKey, missionData } = body;
    if (!toUserId) return NextResponse.json({ error: "toUserId required" }, { status: 400 });
    const sessionId = nanoid(12);
    const mission = missionData ?? { name: "Party Quest", description: "Adventure awaits!", theme: "dungeon", emoji: "⚔️", palette: { bg: "#1a0d2e", accent: "#cc44ff", floor: "#2a1a40" }, rooms: [] };
    await createAdventureSession(u.id, sessionId, missionKey ?? "party", mission);
    const inviteId = await createPartyInvite(u.id, u.name ?? "someone", toUserId, sessionId, missionKey ?? "party", mission);
    // Push instant notification via PartyKit — eliminates 10s poll on recipient
    const pkHost = process.env.NEXT_PUBLIC_PARTYKIT_HOST;
    if (pkHost && pkHost !== "DISABLED") {
      fetch(`https://${pkHost}/parties/notifications/${toUserId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "party_invite", inviteId, sessionId, inviterName: u.name ?? "Someone", missionData: mission }),
      }).catch(() => {});
    }
    return NextResponse.json({ ok: true, sessionId });
  }

  // ── Accept party invite ────────────────────────────────────────────────────
  if (action === "accept") {
    const { inviteId, sessionId } = body;
    if (!inviteId || !sessionId) return NextResponse.json({ error: "inviteId and sessionId required" }, { status: 400 });
    await updatePartyInviteStatus(inviteId, "accepted");
    await joinAdventureSession(sessionId, u.id);
    return NextResponse.json({ ok: true, sessionId });
  }

  // ── Decline party invite ───────────────────────────────────────────────────
  if (action === "decline") {
    const { inviteId } = body;
    if (!inviteId) return NextResponse.json({ error: "inviteId required" }, { status: 400 });
    await updatePartyInviteStatus(inviteId, "declined");
    return NextResponse.json({ ok: true });
  }

  // ── Join cave session ──────────────────────────────────────────────────────
  if (action === "join-cave") {
    const sess = await getOrCreateCaveSession();
    await joinCaveSession(sess.id, u.id);
    const teamData = await getSessionTeamData(sess.id);
    return NextResponse.json({ ok: true, sessionId: sess.id, team: teamData.members, count: (sess.team_user_ids.length) });
  }

  // ── Leave cave session ─────────────────────────────────────────────────────
  if (action === "leave-cave") {
    const { sessionId } = body;
    if (sessionId) await leaveCaveSession(sessionId, u.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
