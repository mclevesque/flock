import Link from "next/link";
import { auth } from "@/auth";
import { getLeaderboard, getRecord } from "@/lib/draftmasters/db";
import Shell from "../Shell";
import { STYLES } from "../styles";

export const metadata = { title: "Ladder — DraftMasters" };
export const dynamic = "force-dynamic";

/**
 * The ladder, and only this game's ladder.
 *
 * The hub's leaderboard ranks nine games at once behind a game picker, which
 * on a site that only has one game is a control with nothing to control. This
 * is the same data with the chrome taken off: rating, record, streak.
 *
 * Rendered on the server because it is a table of numbers that does not change
 * while you look at it, and a spinner for that would be theatre.
 */
export default async function Page() {
  const session = await auth();
  const me = session?.user?.id ?? "";

  const [ladder, mine] = await Promise.all([
    getLeaderboard(50).catch(() => []),
    me ? getRecord(me).catch(() => null) : Promise.resolve(null),
  ]);

  const onBoard = ladder.some((r) => String(r.userId) === me);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <Shell title="Ladder" lead="Every draft anybody has finished.">
        {!ladder.length && (
          <p className="dm-note dm-empty">
            Nothing on record yet. Win a draft and you are the top of it.
          </p>
        )}

        {ladder.map((r, i) => (
          <div key={String(r.userId)} className="dm-rank" data-me={String(r.userId) === me ? "1" : "0"}>
            <span className="dm-rank-n">{i + 1}</span>
            <span className="dm-rank-who">
              <b>{r.name}</b>
              <em>
                {r.pvpWins}W {r.pvpLosses}L
                {r.streak > 1 ? ` · ${r.streak} in a row` : ""}
              </em>
            </span>
            <span className="dm-rank-rating">{r.rating}</span>
          </div>
        ))}

        {/* Somebody who has played and is not in the top fifty still wants to
            know where they are, and "not listed" is not an answer. */}
        {mine && !onBoard && (
          <>
            <p className="dm-eyebrow dm-sub">You</p>
            <div className="dm-rank" data-me="1">
              <span className="dm-rank-n">—</span>
              <span className="dm-rank-who">
                <b>{mine.name}</b>
                <em>{mine.pvpWins}W {mine.pvpLosses}L</em>
              </span>
              <span className="dm-rank-rating">{mine.rating}</span>
            </div>
          </>
        )}

        <p className="dm-note dm-empty">
          <Link href="/draftmasters">Back to the shelf</Link>
        </p>
      </Shell>
    </>
  );
}
