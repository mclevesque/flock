import { storagePut, storageDel, storageList } from "@/lib/storage";
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
  const isAdmin = ADMIN_USERS.includes(sName.toLowerCase());

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const targetUserId = formData.get("targetUserId") as string | null;

  if (!file || !targetUserId) {
    return NextResponse.json({ error: "file and targetUserId required" }, { status: 400 });
  }

  // Allow if admin OR uploading to own account
  const sessionUserId = (session.user as { id?: string }).id ?? "";
  if (!isAdmin && sessionUserId !== targetUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const buffer = await file.arrayBuffer();
  const contentType = file.type || "image/jpeg";
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const path = `avatars/${targetUserId}_${Date.now()}.${ext}`;

  const existing = await storageList(`avatars/${targetUserId}_`);
  if (existing.length >= MAX_AVATAR_SLOTS) {
    const sorted = existing.sort((a, b) => a.uploadedAt.getTime() - b.uploadedAt.getTime());
    for (let i = 0; i <= existing.length - MAX_AVATAR_SLOTS; i++) {
      await storageDel(sorted[i].url);
    }
  }

  const { url } = await storagePut(path, buffer, { contentType });
  await updateUser(targetUserId, { avatar_url: url });
  return NextResponse.json({ url });
}
