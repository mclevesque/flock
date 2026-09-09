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

export default async function SignInPage() {
  return <SignInClient dm={await isStandaloneSite()} />;
}
