import { auth } from "@/auth";
import { getWaddabiLobbies } from "@/lib/db";
import WaddabiLobby from "./WaddabiLobby";

export const dynamic = "force-dynamic";

export default async function WaddabiPage() {
  const session = await auth();
  const lobbies = await getWaddabiLobbies().catch(() => []);
  return (
    <WaddabiLobby
      lobbies={lobbies as any[]}
      sessionUserId={session?.user?.id ?? null}
      sessionUsername={session?.user?.name ?? null}
      sessionImage={session?.user?.image ?? null}
    />
  );
}
