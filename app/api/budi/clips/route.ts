import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getBudiClips, createBudiClips } from "@/lib/budi";
import { storagePut, storagePresign } from "@/lib/storage";

export const maxDuration = 60;
const MAX_SIZE = 30 * 1024 * 1024; // 30 MB
const PRESIGN_TTL = 7200;          // 2h

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const logId = new URL(req.url).searchParams.get("log");
  if (!logId) return NextResponse.json({ error: "Missing log" }, { status: 400 });
  const clips = await getBudiClips(logId, session.user.id).catch(() => null);
  if (clips === null) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const signed = await Promise.all((clips as Record<string, unknown>[]).map(async (c) => {
    const media_url = await storagePresign(c.video_key as string, PRESIGN_TTL).catch(() => null);
    const thumb_url = c.thumb_key ? await storagePresign(c.thumb_key as string, PRESIGN_TTL).catch(() => null) : null;
    const rest = { ...c };
    delete rest.video_key; delete rest.thumb_key;
    return { ...rest, media_url, thumb_url };
  }));
  return NextResponse.json({ clips: signed });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as { id: string; name?: string | null; image?: string | null };

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

  const media = form.get("media") as File | null;
  const thumb = form.get("thumbnail") as File | null;
  const duration = parseFloat((form.get("duration") as string) ?? "0");
  const caption = ((form.get("caption") as string) ?? "").slice(0, 200);
  const mediaType = (form.get("mediaType") as string) === "audio" ? "audio" : "video";
  let logIds: string[] = [];
  try { logIds = JSON.parse((form.get("logIds") as string) ?? "[]"); } catch { /* keep empty */ }

  if (!media) return NextResponse.json({ error: "No media" }, { status: 400 });
  if (media.size > MAX_SIZE) return NextResponse.json({ error: "Clip too large (max 30 MB)" }, { status: 400 });
  if (!Array.isArray(logIds) || logIds.length === 0) return NextResponse.json({ error: "Pick at least one log" }, { status: 400 });
  if (duration > 31) return NextResponse.json({ error: "Clips are max 30 seconds" }, { status: 400 });

  // One R2 object, shared across every destination log
  const mediaId = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  const mediaKey = `budi/${u.id}/${mediaId}`;
  await storagePut(mediaKey, Buffer.from(await media.arrayBuffer()), {
    contentType: media.type || (mediaType === "audio" ? "audio/webm" : "video/webm"),
  });

  let thumbKey: string | null = null;
  if (thumb && thumb.size > 0 && mediaType === "video") {
    thumbKey = `budi/${u.id}/${mediaId}_thumb.jpg`;
    await storagePut(thumbKey, Buffer.from(await thumb.arrayBuffer()), { contentType: "image/jpeg" });
  }

  const count = await createBudiClips({
    userId: u.id,
    username: u.name ?? "anon",
    avatarUrl: u.image ?? null,
    logIds,
    videoKey: mediaKey,
    thumbKey,
    durationSeconds: Math.min(duration, 30),
    caption,
    mediaType,
  });
  if (count === 0) return NextResponse.json({ error: "You're not a member of those logs" }, { status: 403 });
  return NextResponse.json({ ok: true, count });
}
