import { notFound } from "next/navigation";
import { getBlindRankSession, getBlindRankResults } from "@/lib/db";
import BlindRankResultsClient from "./BlindRankResultsClient";

export const dynamic = "force-dynamic";

export default async function BlindRankResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, results] = await Promise.all([
    getBlindRankSession(id).catch(() => null),
    getBlindRankResults(id).catch(() => []),
  ]);
  if (!session) notFound();
  return (
    <BlindRankResultsClient
      sessionId={id}
      topic={session.topic}
      items={session.items}
      useImages={session.useImages}
      createdBy={session.createdBy}
      initialResults={results}
    />
  );
}
