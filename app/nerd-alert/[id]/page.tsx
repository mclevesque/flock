export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import NerdAlertRoom from "./NerdAlertRoom";

export default async function NerdAlertRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const code = (id || "").toUpperCase();
  if (code.length !== 4) redirect("/nerd-alert");
  const session = await auth();
  if (!session?.user?.id) redirect(`/signin?next=/nerd-alert/${code}`);

  return (
    <NerdAlertRoom
      roomCode={code}
      userId={session.user.id}
      username={session.user.name ?? "Player"}
      avatarUrl={session.user.image ?? null}
    />
  );
}
