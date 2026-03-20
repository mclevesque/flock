import { auth } from "@/auth";
import WatchRoom from "./WatchRoom";

type Props = { params: Promise<{ id: string }> };

export default async function WatchRoomPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  return (
    <WatchRoom
      roomId={id}
      sessionUserId={session?.user?.id ?? null}
      sessionUsername={session?.user?.name ?? null}
      sessionAvatar={session?.user?.image ?? null}
    />
  );
}
