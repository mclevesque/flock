import { auth } from "@/auth";
import { getDrawRoom } from "@/lib/db";
import { redirect } from "next/navigation";
import DrawRoom from "./DrawRoom";

export default async function DrawRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, room] = await Promise.all([auth(), getDrawRoom(id)]);
  if (!room) redirect("/draw");
  const isHost = session?.user?.id === room.host_id;
  return <DrawRoom roomId={id} isHost={isHost} initialTitle={room.title as string} />;
}
