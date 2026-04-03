export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { getUserById } from "@/lib/db";
import { redirect } from "next/navigation";
import DodgeGauntletClient from "./DodgeGauntletClient";

export const metadata = { title: "Dodge Gauntlet — Ryft" };

export default async function DodgeGauntletPage() {
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
    <DodgeGauntletClient
      userId={session.user.id}
      username={username}
      avatarUrl={avatarUrl}
    />
  );
}
