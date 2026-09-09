export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { auth } from "@/auth";
import { PACKS } from "@/lib/draftmasters/packs";
import { BRAND, isStandaloneSite } from "@/lib/draftmasters/site";
import { redirect } from "next/navigation";
import DraftMastersClient from "./DraftMastersClient";

/**
 * The tab title followed the deployment, not the domain — a visitor on
 * draftmasters.net got "DraftMasters — Great Souls", naming a site they have
 * never been to. On its own domain the game is simply itself.
 */
export async function generateMetadata(): Promise<Metadata> {
  const standalone = await isStandaloneSite();
  return {
    title: standalone ? `${BRAND} — Auction draft anything` : `${BRAND} — Great Souls`,
    description:
      "Auction draft any topic. $20, five picks, one winner. Bid against a friend or the house.",
  };
}

/**
 * DraftMasters requires an account.
 *
 * It used to be playable signed-out, with a guest handle standing in for a
 * name. That cost more than it gave: a guest has no ladder rating, no record,
 * no friends list to be invited from, and nothing to come back to — so every
 * guest game was a game the site could not build on.
 *
 * The redirect carries the full path INCLUDING the query, which is the part
 * that matters. Following an invite to /draftmasters?room=A1B2C3 while signed
 * out used to land you on a sign-in page and then drop you at the hub with the
 * room code gone; now signing in or signing up returns you to the invite.
 */
export default async function DraftMastersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [session, standalone, params] = await Promise.all([
    auth(),
    isStandaloneSite(),
    searchParams,
  ]);

  if (!session?.user?.id) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (typeof v === "string") qs.set(k, v);
    }
    const here = `/draftmasters${qs.size ? `?${qs}` : ""}`;
    redirect(`/signin?next=${encodeURIComponent(here)}`);
  }

  const sessionUser = {
    id: session.user.id,
    name: session.user.name ?? "Drafter",
    avatarUrl: (session.user as { image?: string | null }).image ?? null,
  };

  /**
   * Strip entries — the client only needs pack metadata to render the picker,
   * and the full board is fetched when a topic is actually chosen.
   *
   * `hero` is the exception, and it is what turns a row of text buttons into a
   * row of cards. Every board's most prominent entry already has a curated
   * portrait sitting in R2, so the picker can be built out of the same art the
   * game deals — Charizard fronting Pokémon, the Mountain fronting Thrones —
   * without a single new image being made or a live lookup at render time.
   */
  const packSummaries = PACKS.map((p) => {
    const hero = [...p.entries]
      .filter((e) => !e.uberOnly)
      .sort((a, b) => (b.f ?? 3) - (a.f ?? 3) || b.t - a.t)[0];
    return {
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      blurb: p.blurb,
      heroName: hero?.n ?? "",
      heroQuery: hero ? `${hero.s ? `${hero.n} ${hero.s}` : hero.n} ${p.imgContext}`.trim() : "",
      heroWiki: hero?.wiki ?? p.wiki ?? "",
    };
  });

  return <DraftMastersClient sessionUser={sessionUser} packs={packSummaries} standalone={standalone} />;
}
