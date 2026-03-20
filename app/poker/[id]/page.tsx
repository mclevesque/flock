import { auth } from "@/auth";
import PokerTable from "./PokerTable";

type Props = { params: Promise<{ id: string }> };

export default async function PokerRoomPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  return (
    <PokerTable
      roomId={id}
      sessionUserId={session?.user?.id ?? null}
      sessionUsername={session?.user?.name ?? null}
      sessionAvatar={session?.user?.image ?? null}
    />
  );
}
