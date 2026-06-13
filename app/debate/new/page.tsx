export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PRESET_TOPICS, CATEGORY_LABELS } from "@/lib/debate-topics";
import { getFriends } from "@/lib/db";
import NewDebateClient from "./NewDebateClient";

export default async function NewDebatePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const friends = await getFriends(session.user.id).catch(() => [] as Record<string, unknown>[]);

  return (
    <NewDebateClient
      presets={PRESET_TOPICS}
      categories={CATEGORY_LABELS}
      friends={friends as Array<{ id: string; username: string; avatar_url: string | null }>}
    />
  );
}
