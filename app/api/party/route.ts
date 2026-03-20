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
    return NextResponse.json(result);
  }

  if (action === "leave") {
    await leaveParty(u.id).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  if (action === "disband") {
    const party = await getPartyForUser(u.id).catch(() => null);
    if (!party || party.leaderId !== u.id) {
      return NextResponse.json({ error: "Not your party" }, { status: 403 });
    }
    await disbandParty(party.id).catch(() => {});
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
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
