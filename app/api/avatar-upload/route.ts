import { storagePut, storageDel, storageList } from "@/lib/storage";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const runtime = "nodejs";

const MAX_AVATAR_SLOTS = 5;

async function saveAvatar(userId: string, buffer: ArrayBuffer, contentType: string): Promise<string> {
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const path = `avatars/${userId}_${Date.now()}.${ext}`;

  const existing = await storageList(`avatars/${userId}_`);
  if (existing.length >= MAX_AVATAR_SLOTS) {
    const sorted = existing.sort((a, b) => a.uploadedAt.getTime() - b.uploadedAt.getTime());
    for (let i = 0; i <= existing.length - MAX_AVATAR_SLOTS; i++) {
      await storageDel(sorted[i].url);
    }
  }

  const { url } = await storagePut(path, buffer, { contentType });
  return url;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ct = req.headers.get("content-type") ?? "";

  if (ct.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });
    const buffer = await file.arrayBuffer();
    const url = await saveAvatar(session.user.id, buffer, file.type || "image/jpeg");
    return NextResponse.json({ url });
  }

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
  const url = await saveAvatar(session.user.id, buffer, contentType);
  return NextResponse.json({ url });
}
