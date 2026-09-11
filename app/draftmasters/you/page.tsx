import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getRecord } from "@/lib/draftmasters/db";
import { getUserById } from "@/lib/db";
import { avatarSrc } from "@/lib/avatars";
import Shell from "../Shell";
import AvatarChooser from "./AvatarChooser";
import SignOut from "./SignOut";
import { STYLES } from "../styles";

export const metadata = { title: "You — DraftMasters" };
export const dynamic = "force-dynamic";

/**
 * Your record, and nothing else.
 *
 * The hub's profile is an editor — avatar uploads, a bio, game history across
 * nine titles, a friends count. None of that is this game, and a player who
 * taps "You" from a draft wants one question answered: how am I doing.
 *
 * Editing lives on the hub because that is where the account lives. There is
 * a link at the bottom for anyone who wants it, and no reason to duplicate a
 * working profile editor inside a game.
 */
export default async function Page() {
  const session = await auth();
  if (!session?.user) redirect("/signin?next=/draftmasters/you");

  const me = session.user.id ?? "";
  const [rec, row] = await Promise.all([
    getRecord(me).catch(() => null),
    getUserById(me).catch(() => null),
  ]);
  const avatar = avatarSrc((row?.avatar_url as string | null) ?? null, me);
  const played = (rec?.pvpWins ?? 0) + (rec?.pvpLosses ?? 0) + (rec?.soloWins ?? 0) + (rec?.soloLosses ?? 0);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <Shell title="You" lead={session.user.name ?? undefined}>
        <AvatarChooser userId={me} initial={avatar} />

        {!rec || played === 0 ? (
          <p className="dm-note dm-empty">
            No drafts on record yet. <Link href="/draftmasters">Open a case</Link> and
            the numbers start here.
          </p>
        ) : (
          <>
            <div className="dm-you-rating">
              <b>{rec.rating}</b>
              <em>rating</em>
            </div>

            <div className="dm-you-grid">
              <span><b>{rec.pvpWins}</b><em>wins</em></span>
              <span><b>{rec.pvpLosses}</b><em>losses</em></span>
              <span><b>{rec.soloWins}</b><em>solo wins</em></span>
              <span><b>{rec.streak}</b><em>streak</em></span>
              <span><b>{rec.bestStreak}</b><em>best run</em></span>
              <span><b>{played}</b><em>drafts</em></span>
            </div>
          </>
        )}

        <div className="dm-you-links">
          <Link className="dm-btn dm-btn-ghost" href="/draftmasters/ladder">See the ladder</Link>
          <Link className="dm-btn dm-btn-ghost" href="/profile/edit">Edit your account</Link>
          <SignOut />
        </div>
      </Shell>
    </>
  );
}
