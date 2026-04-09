export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { getUserById } from "@/lib/db";
import { redirect } from "next/navigation";
import WinterfellsClient from "./WinterfellsClient";

export const metadata = { title: "Winterfells — Great Souls" };

export default async function WinterfellsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  let username = session.user.name ?? "player";
  let avatarUrl = `/api/avatar/${session.user.id}`;

  try {
    const user = await getUserById(session.user.id).catch(() => null);
    if (user) {
      username = (user as { username: string }).username ?? username;
    }
  } catch { /* use session data */ }

  return (
    <WinterfellsClient
      userId={session.user.id}
      username={username}
      avatarUrl={avatarUrl}
    />
  );
}
