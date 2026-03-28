export const dynamic = "force-dynamic";

import { getUserByUsername, getVideosByUser, getFriendshipStatus, getFriends, getUserStorageBytes, getLastChessGame, getLastSnesGame, getPrivileges, getOrCreateAdventureStats } from "@/lib/db";
import { auth } from "@/auth";
import { notFound } from "next/navigation";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;

  let user, videos, friendship, friends, session, storageBytes, lastChessGame, lastSnesGame, privileges, adventureStats;
  try {
    [user, session] = await Promise.all([
      getUserByUsername(username),
      auth(),
    ]);
    if (!user) notFound();
    const uid = user.id as string;
    [videos, friendship, friends, storageBytes, lastChessGame, lastSnesGame, privileges, adventureStats] = await Promise.all([
      getVideosByUser(uid).catch(() => []),
      session?.user?.id ? getFriendshipStatus(session.user.id, uid).catch(() => null) : Promise.resolve(null),
      getFriends(uid).catch(() => []),
      getUserStorageBytes(uid).catch(() => 0),
      getLastChessGame(uid).catch(() => null),
      getLastSnesGame(uid).catch(() => null),
      getPrivileges(uid).catch(() => null),
      getOrCreateAdventureStats(uid).catch(() => null),
    ]);
  } catch {
    return <ProfileClient user={null} videos={[]} friendship={null} friends={[]} sessionUserId={null} sessionUsername={null} username={username} storageBytes={0} lastChessGame={null} lastSnesGame={null} privileges={null} adventureStats={null} />;
  }

  return (
    <ProfileClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      user={user as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      videos={videos as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      friendship={friendship as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      friends={friends as any}
      sessionUserId={session?.user?.id ?? null}
      sessionUsername={session?.user?.name ?? null}
      username={username}
      storageBytes={storageBytes as number ?? 0}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lastChessGame={lastChessGame as any ?? null}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lastSnesGame={lastSnesGame as any ?? null}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      privileges={privileges as any ?? null}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      adventureStats={adventureStats as any ?? null}
    />
  );
}
