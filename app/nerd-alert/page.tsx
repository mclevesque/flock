export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import NerdAlertHub from "./NerdAlertHub";

export default async function NerdAlertPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?next=/nerd-alert");
  return (
    <NerdAlertHub
      userId={session.user.id}
      username={session.user.name ?? "Player"}
    />
  );
}
