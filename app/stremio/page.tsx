export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { getOpenWatchRooms, getTheaterState, getTheaterChat } from "@/lib/db";
import StremioLobby from "./StremioLobby";

const THEATER_PARTY_ID = "stremio-main";

export default async function StremioPage() {
  const session = await auth();
  let rooms: Record<string, unknown>[] = [];
  let theaterState = null;
  let theaterChat: unknown[] = [];

  await Promise.all([
    getOpenWatchRooms().then(r => { rooms = r; }).catch(() => {}),
    getTheaterState(THEATER_PARTY_ID).then(s => { theaterState = s; }).catch(() => {}),
    getTheaterChat(THEATER_PARTY_ID).then(c => { theaterChat = c; }).catch(() => {}),
  ]);

  return (
    <StremioLobby
      rooms={rooms as never}
      sessionUserId={session?.user?.id ?? null}
      sessionUsername={session?.user?.name ?? null}
      sessionAvatar={session?.user?.image ?? null}
      initialTheaterState={theaterState}
      initialTheaterChat={theaterChat as never}
    />
  );
}
