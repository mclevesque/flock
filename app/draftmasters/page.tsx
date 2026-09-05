export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { auth } from "@/auth";
import { PACKS } from "@/lib/draftmasters/packs";
import DraftMastersClient from "./DraftMastersClient";

export const metadata: Metadata = {
  title: "DraftMasters — Great Souls",
  description:
    "Auction draft any topic. $20, five picks, one winner. Bid against a friend or the house.",
};

/**
 * DraftMasters is deliberately playable signed-out — it's a standalone game
 * that happens to live on Great Souls. A session just means your name and
 * avatar carry into the room instead of a guest handle.
 */
export default async function DraftMastersPage() {
  const session = await auth();

  const sessionUser = session?.user?.id
    ? {
        id: session.user.id,
        name: session.user.name ?? "Drafter",
        avatarUrl: (session.user as { image?: string | null }).image ?? null,
      }
    : null;

  // Strip entries — the client only needs pack metadata to render the picker,
  // and the full board is fetched when a topic is actually chosen.
  const packSummaries = PACKS.map((p) => ({
    id: p.id,
    name: p.name,
    emoji: p.emoji,
    blurb: p.blurb,
  }));

  return <DraftMastersClient sessionUser={sessionUser} packs={packSummaries} />;
}
