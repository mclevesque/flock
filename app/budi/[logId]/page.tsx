import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getBudiLog, getBudiMembers } from "@/lib/db";
import BudiLogView from "./BudiLogView";

export const dynamic = "force-dynamic";

export default async function BudiLogPage({ params }: { params: Promise<{ logId: string }> }) {
  const { logId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/budi");

  const log = await getBudiLog(logId, session.user.id).catch(() => null);
  if (!log) redirect("/budi"); // not a member or doesn't exist

  const members = await getBudiMembers(logId).catch(() => []);

  return (
    <BudiLogView
      log={JSON.parse(JSON.stringify(log))}
      members={JSON.parse(JSON.stringify(members))}
      meId={session.user.id}
    />
  );
}
