import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getBlindRankSession } from "@/lib/db";
import BlindRankGameClient from "./BlindRankGameClient";

export const dynamic = "force-dynamic";

export default async function BlindRankPlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, authSession] = await Promise.all([
    getBlindRankSession(id).catch(() => null),
    auth(),
  ]);
  if (!session) notFound();
  return (
    <BlindRankGameClient
      sessionId={id}
      topic={session.topic}
      items={session.items}
      createdBy={session.createdBy}
      username={authSession?.user?.name ?? null}
    />
  );
}
