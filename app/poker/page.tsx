export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { getPokerLobbies } from "@/lib/db";
import PokerLobby from "./PokerLobby";

export default async function PokerPage() {
  const session = await auth();
  let lobbies: Record<string, unknown>[] = [];
  try { lobbies = await getPokerLobbies(); } catch { /* tables may not exist yet */ }

  return (
    <PokerLobby
      lobbies={lobbies as never}
      sessionUserId={session?.user?.id ?? null}
      sessionUsername={session?.user?.name ?? null}
    />
  );
}
