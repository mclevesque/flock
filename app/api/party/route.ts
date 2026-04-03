import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  createParty, joinParty, leaveParty, disbandParty,
  getMyParty, getPartyById, kickMember, promoteMember, getFriendParties,
} from "@/lib/party";
import { pushNotification } from "@/lib/pushNotification";

/** Broadcast a message to all members connected to this party's WS room */
function broadcast(partyId: string, msg: Record<string, unknown>) {
  const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST;
  if (!host || host === "DISABLED") return;
  fetch(`https://${host}/parties/main/party-${encodeURIComponent(partyId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(msg),
  }).catch(() => {});
}

async function getUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const u = session.user as { id: string; name?: string | null; image?: string | null };
  return { id: u.id, name: u.name ?? "Anon", image: u.image ?? "" };
}

export async function GET(req: NextRequest) {
  const u = await getUser();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  // Primary lookup — used on mount and after refreshes
  if (action === "mine" || action === "my-party") {
    const party = await getMyParty(u.id).catch(() => null);
    return NextResponse.json({ party });
  }

  // Crash recovery — look up a specific party by ID and verify membership
  if (action === "get") {
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ party: null });
    const party = await getPartyById(id).catch(() => null);
    if (party && party.members.some(m => m.userId === u.id)) {
      return NextResponse.json({ party });
    }
    return NextResponse.json({ party: null });
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
    const party = await createParty(u.id, u.name, u.image);
    // Broadcast so any open tabs pick up the new party immediately
    broadcast(party.id, { type: "party_state", party });
    return NextResponse.json({ ok: true, party });
  }

  if (action === "join") {
    const result = await joinParty(body.partyId, u.id, u.name, u.image)
      .catch(() => ({ ok: false as const, error: "DB error" }));
    const joinedParty = result.ok ? (result as { ok: true; party?: import("@/lib/party").Party }).party : undefined;
    if (joinedParty) {
      // Broadcast full party state — all members update without re-fetching
      broadcast(joinedParty.id, { type: "party_state", party: joinedParty });
    }
    return NextResponse.json(result);
  }

  if (action === "leave") {
    const party = await getMyParty(u.id).catch(() => null);
    await leaveParty(u.id).catch(() => {});
    if (party) {
      broadcast(party.id, { type: "member_left", userId: u.id });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "disband") {
    const party = await getMyParty(u.id).catch(() => null);
    if (!party || party.leaderId !== u.id) {
      return NextResponse.json({ error: "Not party leader" }, { status: 403 });
    }
    await disbandParty(party.id).catch(() => {});
    broadcast(party.id, { type: "party_disbanded" });
    return NextResponse.json({ ok: true });
  }

  if (action === "invite") {
    const party = await getMyParty(u.id).catch(() => null);
    if (!party) return NextResponse.json({ error: "Not in a party" }, { status: 400 });
    if (!body.targetId) return NextResponse.json({ error: "targetId required" }, { status: 400 });
    if (party.members.length >= party.maxSize) {
      return NextResponse.json({ error: "Party full" }, { status: 400 });
    }
    pushNotification(body.targetId, {
      type: "party-invite",
      partyId: party.id,
      inviterId: u.id,
      inviterName: u.name,
      inviterAvatar: u.image,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "kick") {
    const party = await getMyParty(u.id).catch(() => null);
    if (!party || party.leaderId !== u.id) {
      return NextResponse.json({ error: "Not party leader" }, { status: 403 });
    }
    const updated = await kickMember(party.id, body.targetId).catch(() => null);
    if (updated) {
      broadcast(party.id, { type: "party_state", party: updated });
      // Notify the kicked user via push so their widget clears even if WS dropped
      pushNotification(body.targetId, { type: "party-kicked", partyId: party.id });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "promote" || action === "transfer-lead") {
    const party = await getMyParty(u.id).catch(() => null);
    if (!party || party.leaderId !== u.id) {
      return NextResponse.json({ error: "Not party leader" }, { status: 403 });
    }
    const target = party.members.find(m => m.userId === body.targetId);
    if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    const updated = await promoteMember(party.id, target.userId, target.username, target.avatarUrl).catch(() => null);
    if (updated) broadcast(party.id, { type: "party_state", party: updated });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
