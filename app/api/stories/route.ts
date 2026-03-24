import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createStory, getActiveStories, purgeExpiredStories } from "@/lib/db";
import { storagePut, storagePresign } from "@/lib/storage";
import { nanoid } from "nanoid";

export const maxDuration = 60;

const MAX_SIZE = 30 * 1024 * 1024; // 30 MB max for 30s video
const STORY_DURATION_MAX = 31; // seconds (client enforces 30, allow 1s buffer)
// Presigned URLs are valid for 2 hours — clients must re-fetch to get a fresh URL
const PRESIGN_TTL = 7200;

export async function GET() {
  // Stories are friends-only — require auth
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ stories: [] });

  purgeExpiredStories().catch(() => {});

  // Returns own story + stories from accepted friends only
  const stories = await getActiveStories(session.user.id).catch(() => []);

  // Generate short-lived presigned URLs — the R2 bucket is private so
  // these are the only way to access the content. URLs expire in 2h.
  const signed = await Promise.all(
    (stories as Record<string, unknown>[]).map(async (s) => {
      const videoUrl = await storagePresign(s.video_url as string, PRESIGN_TTL).catch(() => null);
      const thumbnailUrl = s.thumbnail_url
        ? await storagePresign(s.thumbnail_url as string, PRESIGN_TTL).catch(() => null)
        : null;
      return { ...s, video_url: videoUrl, thumbnail_url: thumbnailUrl };
    })
  );

  return NextResponse.json({ stories: signed });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as { id: string; name?: string | null; image?: string | null };

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

  const videoBlob = formData.get("video") as File | null;
  const thumbnailBlob = formData.get("thumbnail") as File | null;
  const duration = parseFloat((formData.get("duration") as string) ?? "0");

  if (!videoBlob) return NextResponse.json({ error: "No video" }, { status: 400 });
  if (videoBlob.size > MAX_SIZE) return NextResponse.json({ error: "Video too large (max 30 MB)" }, { status: 400 });
  if (duration > STORY_DURATION_MAX) return NextResponse.json({ error: "Stories max 30 seconds" }, { status: 400 });

  const storyId = nanoid(16);
  // Store the R2 key (path), NOT the public URL — bucket is private
  const videoPath = `stories/${u.id}/${storyId}.webm`;
  const videoBuffer = Buffer.from(await videoBlob.arrayBuffer());
  await storagePut(videoPath, videoBuffer, { contentType: "video/webm" });

  let thumbPath: string | null = null;
  if (thumbnailBlob && thumbnailBlob.size > 0) {
    thumbPath = `stories/${u.id}/${storyId}_thumb.jpg`;
    const thumbBuffer = Buffer.from(await thumbnailBlob.arrayBuffer());
    await storagePut(thumbPath, thumbBuffer, { contentType: "image/jpeg" });
  }

  // Save R2 paths to DB — never public URLs
  await createStory(storyId, u.id, u.name ?? "anon", u.image ?? null, videoPath, thumbPath, Math.min(duration, 30));

  return NextResponse.json({ ok: true, storyId });
}
