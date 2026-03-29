import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  createParty,
  joinParty,
  leaveParty,
  getPartyForUser,
  getFriendParties,
  disbandParty,
  transferLead,
} from "@/lib/db";
import { pushNotification } from "@/lib/pushNotification";

/** Push updated party state to all members via PartyKit */
async function broadcastPartyUpdate(partyId: string) {
  const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST;
  if (!host || host === "DISABLED") return;
  // Broadcast to the party-${partyId} room so GlobalPartyWidget picks it up
  // We need to get the fresh party state — but we can't easily fetch it here since
  // the caller already has it. Instead, just send a "refresh" signal.
  fetch(`https://${host}/party/main/party-${encodeURIComponent(partyId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "party_membership", partyId }),
  }).catch(() => {});
}

/** Push party refresh signal to a specific user's notification room */
function notifyPartyChange(userId: string, partyId: string) {
  pushNotification(userId, { type: "party-update", partyId });
}

async function getUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const u = session.user as { id: string; name?: string | null; image?: string | null };
  return { id: u.id, name: u.name ?? "Anon", image: u.image ?? "" };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const u = await getUser();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  if (action === "my-party") {
    const party = await getPartyForUser(u.id).catch(() => null);
    return NextResponse.json({ party });
  }

  if (action === "friend-parties") {
    const parties = await getFriendParties(u.id).catch(() => []);
    return NextResponse.json({ parties });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const u = await getUser();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  if (action === "create") {
    const party = await createParty(u.id, u.name, u.image).catch((e) => {
      throw e;
    });
    return NextResponse.json({ ok: true, party });
  }

  if (action === "join") {
    const result = await joinParty(body.partyId, u.id, u.name, u.image).catch(
      () => ({ ok: false, error: "DB error" })
    );
    if (result.ok) broadcastPartyUpdate(body.partyId);
    return NextResponse.json(result);
  }

  if (action === "leave") {
    const party = await getPartyForUser(u.id).catch(() => null);
    await leaveParty(u.id).catch(() => {});
    if (party) {
      broadcastPartyUpdate(party.id);
      party.members.forEach(m => notifyPartyChange(m.userId, party.id));
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "disband") {
    const party = await getPartyForUser(u.id).catch(() => null);
    if (!party || party.leaderId !== u.id) {
      return NextResponse.json({ error: "Not your party" }, { status: 403 });
    }
    // Notify all members before disbanding
    party.members.forEach(m => notifyPartyChange(m.userId, party.id));
    await disbandParty(party.id).catch(() => {});
    broadcastPartyUpdate(party.id);
    return NextResponse.json({ ok: true });
  }

  if (action === "invite") {
    const party = await getPartyForUser(u.id).catch(() => null);
    if (!party) return NextResponse.json({ error: "Not in a party" }, { status: 400 });
    if (!body.targetId) return NextResponse.json({ error: "targetId required" }, { status: 400 });
    if (party.members.length >= party.maxSize) return NextResponse.json({ error: "Party full" }, { status: 400 });
    pushNotification(body.targetId, {
      type: "party-invite",
      partyId: party.id,
      inviterId: u.id,
      inviterName: u.name,
      inviterAvatar: u.image,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "transfer-lead") {
    const party = await getPartyForUser(u.id).catch(() => null);
    if (!party || party.leaderId !== u.id) {
      return NextResponse.json({ error: "Not your party" }, { status: 403 });
    }
    const target = party.members.find((m) => m.userId === body.targetId);
    if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    await transferLead(party.id, target.userId, target.username, target.avatarUrl).catch(() => {});
    broadcastPartyUpdate(party.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
