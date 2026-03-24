import { auth } from "@/auth";
import { getUserByUsername, getUserById } from "@/lib/db";
import { redirect } from "next/navigation";
import SurvivorsClient from "./SurvivorsClient";

export const metadata = { title: "Flock: Outbreak — Survive 10 Minutes" };

export default async function SurvivorsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  let username = session.user.name ?? "survivor";
  let avatarUrl = "";

  try {
    const user = await getUserById(session.user.id).catch(() => null)
      ?? (session.user.name
        ? await getUserByUsername(session.user.name.toLowerCase().replace(/[^a-z0-9_]/g, "")).catch(() => null)
        : null);
    if (user) {
      username = (user as { username: string }).username ?? username;
      avatarUrl = (user as { avatar_url: string }).avatar_url ?? avatarUrl;
    }
  } catch { /* session fallback */ }

  return (
    <SurvivorsClient
      userId={session.user.id}
      username={username}
      avatarUrl={`/api/avatar/${session.user.id}`}
    />
  );
}
