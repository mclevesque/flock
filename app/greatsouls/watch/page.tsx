export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import SoulCinema from "./SoulCinema";

export default async function SoulCinemaPage() {
  const session = await auth();
  if (!session?.user) redirect("/greatsouls");

  return (
    <SoulCinema
      sessionUserId={session.user.id ?? null}
      sessionUsername={session.user.name ?? null}
    />
  );
}
