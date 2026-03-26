export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { getUserById, getUserByUsername, createUser } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function ProfileRedirect() {
  try {
    const session = await auth();
    if (!session?.user?.id) redirect("/signin");

    // 1. Try by ID (the normal path)
    let user = await getUserById(session.user.id).catch(() => null);

    // 2. Fallback: look up by username (session.user.name = username for credentials users)
    if (!user && session.user.name) {
      const clean = session.user.name.toLowerCase().replace(/[^a-z0-9_]/g, "");
      user = await getUserByUsername(clean).catch(() => null);
    }

    // 3. Still nothing — auto-create from session data
    if (!user) {
      const rawName = session.user.name ?? "";
      const base = rawName.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20) || `user${session.user.id.slice(-6)}`;
      try {
        await createUser(session.user.id, base, rawName || base, session.user.image ?? "");
      } catch {
        try {
          await createUser(session.user.id, `${base}${Math.floor(Math.random() * 99)}`, rawName || base, session.user.image ?? "");
        } catch { /* give up */ }
      }
      user = await getUserById(session.user.id).catch(() => null);
    }

    if (user) redirect(`/profile/${user.username}`);
  } catch (e) {
    // next/navigation redirects throw — rethrow them, swallow real errors
    const msg = String(e);
    if (msg.includes("NEXT_REDIRECT")) throw e;
  }
  redirect("/watch");
}
