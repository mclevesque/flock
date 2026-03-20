import { auth } from "@/auth";
import { getWaddabiRoom, getWaddabiPlayers } from "@/lib/db";
import { notFound } from "next/navigation";
import WaddabiGame from "./WaddabiGame";

export const dynamic = "force-dynamic";

export default async function WaddabiRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const [room, players] = await Promise.all([
    getWaddabiRoom(id).catch(() => null),
    getWaddabiPlayers(id).catch(() => []),
  ]);
  if (!room || room.status === "closed") return notFound();
  return (
    <WaddabiGame
      roomId={id}
      initialRoom={room as any}
      initialPlayers={players as any[]}
      sessionUserId={session?.user?.id ?? null}
      sessionUsername={session?.user?.name ?? "Guest"}
      sessionImage={session?.user?.image ?? null}
    />
  );
}
