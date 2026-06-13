import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getBudiUserVlog } from "@/lib/budi";
import { storagePresign } from "@/lib/storage";
import BudiVlogView from "./BudiVlogView";

export const dynamic = "force-dynamic";

export default async function BudiVlogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/budi");

  const data = await getBudiUserVlog(session.user.id, id).catch(() => null);
  if (!data) redirect("/budi"); // not allowed or user not found

  const clips = await Promise.all((data.clips as Record<string, unknown>[]).map(async (c) => {
    const media_url = await storagePresign(c.video_key as string, 7200).catch(() => null);
    const thumb_url = c.thumb_key ? await storagePresign(c.thumb_key as string, 7200).catch(() => null) : null;
    const rest = { ...c };
    delete rest.video_key; delete rest.thumb_key;
    return { ...rest, media_url, thumb_url };
  }));

  return (
    <BudiVlogView
      user={JSON.parse(JSON.stringify(data.user))}
      clips={JSON.parse(JSON.stringify(clips))}
      meId={session.user.id}
    />
  );
}
