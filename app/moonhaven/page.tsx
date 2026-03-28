export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { getUserByUsername, getUserById } from "@/lib/db";
import { redirect } from "next/navigation";
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

  return (
    <MoonhavenClient
      userId={session.user.id}
      username={username}
      avatarUrl={`/api/avatar/${session.user.id}`}
      avatarConfig={avatarConfig as import("./MoonhavenClient").AvatarConfig | null}
    />
  );
}
