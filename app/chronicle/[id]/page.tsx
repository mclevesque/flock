import { auth } from "@/auth";
import { getChronicleEntry, getChronicleComments } from "@/lib/db";
import { notFound } from "next/navigation";
import ChronicleEntryClient from "./ChronicleEntryClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = await getChronicleEntry(id, null).catch(() => null);
  if (!entry) return { title: "Entry not found — FLOCK" };
  return { title: `${(entry as unknown as { title: string }).title} — Chronicle — FLOCK` };
}

export default async function ChronicleEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const [entry, comments] = await Promise.all([
    getChronicleEntry(id, userId).catch(() => null),
    getChronicleComments(id).catch(() => []),
  ]);

  if (!entry) return notFound();

  return (
    <ChronicleEntryClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      entry={entry as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      comments={comments as any}
      sessionUserId={userId}
      sessionUsername={session?.user?.name ?? null}
      sessionImage={session?.user?.image ?? null}
    />
  );
}
