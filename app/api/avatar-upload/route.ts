import { put, list, del } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const runtime = "nodejs";

const MAX_AVATAR_SLOTS = 5;

// Rotate avatar slots: keeps up to MAX_AVATAR_SLOTS files per user.
// New avatar is saved as avatars/{userId}_{timestamp}.ext
// If the user already has MAX_AVATAR_SLOTS, the oldest one is deleted.
async function saveAvatarToBlob(
  userId: string,
  buffer: ArrayBuffer,
  contentType: string
): Promise<string> {
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const timestamp = Date.now();
  const path = `avatars/${userId}_${timestamp}.${ext}`;

  // List existing avatars for this user
  const { blobs } = await list({ prefix: `avatars/${userId}_` });

  // Delete oldest if at capacity
  if (blobs.length >= MAX_AVATAR_SLOTS) {
    const sorted = blobs.sort((a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime());
    for (let i = 0; i <= blobs.length - MAX_AVATAR_SLOTS; i++) {
      await del(sorted[i].url);
    }
  }

  const blob = await put(path, buffer, {
    access: "public",
    contentType,
  });

  return blob.url;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ct = req.headers.get("content-type") ?? "";

  // ── Path A: browser sends raw image bytes as multipart/form-data ──────────
  // Used when "Use This ✓" is clicked — browser POSTs the exact bytes directly.
  if (ct.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

    const buffer = await file.arrayBuffer();
    const contentType = file.type || "image/jpeg";

    const url = await saveAvatarToBlob(session.user.id, buffer, contentType);
    return NextResponse.json({ url });
  }

  // ── Path B: server fetches image from a URL (legacy / fallback) ───────────
  const { imageUrl } = await req.json();
  if (!imageUrl || typeof imageUrl !== "string") {
    return NextResponse.json({ error: "imageUrl required" }, { status: 400 });
  }

  const origin = new URL(req.url).origin;
  const absoluteUrl = imageUrl.startsWith("/") ? `${origin}${imageUrl}` : imageUrl;

  let imgRes: Response;
  try {
    imgRes = await fetch(absoluteUrl, { signal: AbortSignal.timeout(30_000) });
    if (!imgRes.ok) throw new Error(`Upstream ${imgRes.status}`);
  } catch (err) {
    return NextResponse.json({ error: `Failed to fetch image: ${err}` }, { status: 502 });
  }

  const contentType = imgRes.headers.get("content-type") ?? "image/png";
  const buffer = await imgRes.arrayBuffer();

  const url = await saveAvatarToBlob(session.user.id, buffer, contentType);
  return NextResponse.json({ url });
}
