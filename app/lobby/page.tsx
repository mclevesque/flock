export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import LobbyClient from "./LobbyClient";

export const metadata = { title: "Game Lobby — Great Souls" };

export default async function LobbyPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  return (
    <LobbyClient
      userId={session.user.id}
      username={session.user.name ?? "Player"}
      avatarUrl={`/api/avatar/${session.user.id}?v=2`}
    />
  );
}
