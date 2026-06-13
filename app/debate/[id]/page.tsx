export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import DebateRoomClient from "./DebateRoomClient";

export default async function DebateRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const { id } = await params;
  return <DebateRoomClient debateId={id} sessionUserId={session.user.id} />;
}
