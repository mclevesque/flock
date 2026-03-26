export const dynamic = "force-dynamic";

import { getUserByUsername, getVideosByUser, getWallPosts, getWallRepliesBatch, getFriendshipStatus, getFriends, getUserStorageBytes, getLastChessGame, getUserReplyPrivacy, getLastSnesGame, getPrivileges, getOrCreateAdventureStats } from "@/lib/db";
import { auth } from "@/auth";
import { notFound } from "next/navigation";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;

  let user, videos, wallPosts, friendship, friends, session, storageBytes, lastChessGame, replyPrivacy, lastSnesGame, privileges, adventureStats;
  try {
    [user, session] = await Promise.all([
      getUserByUsername(username),
      auth(),
    ]);
    if (!user) notFound();
    const uid = user.id as string;
    [videos, wallPosts, friendship, friends, storageBytes, lastChessGame, lastSnesGame, privileges, adventureStats] = await Promise.all([
      getVideosByUser(uid),
      getWallPosts(uid),
      session?.user?.id ? getFriendshipStatus(session.user.id, uid) : Promise.resolve(null),
      getFriends(uid),
      getUserStorageBytes(uid),
      getLastChessGame(uid),
      getLastSnesGame(uid).catch(() => null),
      getPrivileges(uid).catch(() => null),
      getOrCreateAdventureStats(uid).catch(() => null),
    ]);
    replyPrivacy = await getUserReplyPrivacy(uid).catch(() => "anyone");
  } catch {
    return <ProfileClient user={null} videos={[]} wallPosts={[]} initialReplies={{}} friendship={null} friends={[]} sessionUserId={null} sessionUsername={null} username={username} storageBytes={0} lastChessGame={null} replyPrivacy="anyone" lastSnesGame={null} privileges={null} adventureStats={null} />;
  }

  // Batch-load all replies SSR — eliminates unreliable client-side per-post fetches
  const postIds = (wallPosts as { id: number }[]).map(p => p.id);
  const allReplies = postIds.length > 0 ? await getWallRepliesBatch(postIds).catch(() => []) : [];
  const initialReplies: Record<number, unknown[]> = {};
  for (const r of allReplies as { post_id: number }[]) {
    if (!initialReplies[r.post_id]) initialReplies[r.post_id] = [];
    initialReplies[r.post_id].push(r);
  }

  return (
    <ProfileClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      user={user as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      videos={videos as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      wallPosts={wallPosts as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialReplies={initialReplies as any}
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
      replyPrivacy={replyPrivacy as string ?? "anyone"}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lastSnesGame={lastSnesGame as any ?? null}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      privileges={privileges as any ?? null}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      adventureStats={adventureStats as any ?? null}
    />
  );
}
