import { put, list, del } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateUser } from "@/lib/db";

export const runtime = "nodejs";

const ADMIN_USERS = ["mclevesque"];
const MAX_AVATAR_SLOTS = 5;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sName = (session.user as { name?: string | null }).name ?? "";
  if (!ADMIN_USERS.includes(sName.toLowerCase())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const targetUserId = formData.get("targetUserId") as string | null;

  if (!file || !targetUserId) {
    return NextResponse.json({ error: "file and targetUserId required" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const contentType = file.type || "image/jpeg";
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const path = `avatars/${targetUserId}_${Date.now()}.${ext}`;

  // Rotate old blobs (keep max 5)
  const { blobs } = await list({ prefix: `avatars/${targetUserId}_` });
  if (blobs.length >= MAX_AVATAR_SLOTS) {
    const sorted = blobs.sort((a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime());
    for (let i = 0; i <= blobs.length - MAX_AVATAR_SLOTS; i++) {
      await del(sorted[i].url);
    }
  }

  const blob = await put(path, buffer, { access: "public", contentType });

  // Persist to users table
  await updateUser(targetUserId, { avatar_url: blob.url });

  return NextResponse.json({ url: blob.url });
}
