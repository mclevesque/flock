export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { getUserByUsername, getUserById, getPartyForUser } from "@/lib/db";
import { redirect } from "next/navigation";
import { pushNotification } from "@/lib/pushNotification";
import MoonhavenClient from "./MoonhavenClient";

export const metadata = { title: "Moonhaven — Ryft" };

export default async function MoonhavenPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  let username = session.user.name ?? "player";
  let avatarConfig = null;

  try {
    const user = await getUserById(session.user.id).catch(() => null)
      ?? (session.user.name
        ? await getUserByUsername(session.user.name.toLowerCase().replace(/[^a-z0-9_]/g, "")).catch(() => null)
        : null);
    if (user) {
      username = (user as { username: string }).username ?? username;
      avatarConfig = (user as { avatar_config?: unknown }).avatar_config ?? null;
    }
  } catch { /* use session data */ }

  // Look up party membership server-side
  const party = await getPartyForUser(session.user.id).catch(() => null);
  const partyId = party?.id ?? null;
  const partyLeaderId = party?.leaderId ?? null;
  const isLeader = party?.leaderId === session.user.id;

  // If the party leader is entering Moonhaven, pull all members in
  if (party && isLeader) {
    party.members
      .filter(m => m.userId !== session.user!.id)
      .forEach(m => {
        pushNotification(m.userId, {
          type: "moonhaven-pull",
          partyId: party.id,
          leaderName: username,
        });
      });
  }

  return (
    <MoonhavenClient
      userId={session.user.id}
      username={username}
      avatarUrl={`/api/avatar/${session.user.id}`}
      avatarConfig={avatarConfig as import("./MoonhavenClient").AvatarConfig | null}
      partyId={partyId}
      partyLeaderId={partyLeaderId}
    />
  );
}
