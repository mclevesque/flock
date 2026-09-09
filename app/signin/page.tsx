import { isStandaloneSite } from "@/lib/draftmasters/site";
import SignInClient from "./SignInClient";

/**
 * The sign-in shell, per domain.
 *
 * The form itself needs `next` from the query string, which makes it a client
 * component; the host is only knowable on the server. So this reads the one and
 * hands it to the other, and there is exactly one form, one set of endpoints
 * and one accounts table underneath both names.
 */
export async function generateMetadata() {
  const dm = await isStandaloneSite();
  return dm
    ? {
        title: "Sign in \u2014 DraftMasters",
        description: "Travel the multiverse and draft a team to fight for you.",
      }
    : {
        title: "Sign in \u2014 Great Souls",
        description: "A gathering of legends.",
      };
}

/**
 * The host decides, and only the host.
 *
 * An earlier version also branded on where you were HEADED, so signing in for
 * the game from greatsouls.net put the other product's name on the hub's own
 * front door. Wrong: greatsouls.net is Great Souls whatever you are about to
 * play, and draftmasters.net is DraftMasters. One rule, no exceptions in
 * production.
 *
 * The `next` heuristic survives in development only, so the standalone front
 * door can be worked on against localhost without a hosts-file entry.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (await isStandaloneSite()) return <SignInClient dm />;

  if (process.env.NODE_ENV !== "production") {
    const next = (await searchParams).next;
    if (typeof next === "string" && next.startsWith("/draftmasters")) {
      return <SignInClient dm />;
    }
  }
  return <SignInClient dm={false} />;
}
