import { auth } from "@/auth";
import SocialProvider from "./SocialProvider";

/**
 * Friends, chat and voice sit here, above every DraftMasters page, so that
 * moving between the shelf, Ladder and You does not hang up a call or reset a
 * badge. Signed-out visitors get the pages alone; every page that needs an
 * account redirects them to sign in anyway.
 */
export default async function DraftMastersLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const me = session?.user?.id;
  if (!me) return <>{children}</>;
  return (
    <SocialProvider meId={me} meName={session.user?.name ?? "Drafter"}>
      {children}
    </SocialProvider>
  );
}
