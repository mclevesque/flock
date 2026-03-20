import { storagePut, storageDel } from "@/lib/storage";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const runtime = "nodejs";

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const oldUrl = form.get("oldUrl") as string | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const isAudio = file.type.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|flac|aac|opus|weba)$/i.test(file.name);
  if (!isAudio) return NextResponse.json({ error: "Audio files only" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Max 20 MB" }, { status: 400 });

  const ext = file.name.split(".").pop() ?? "mp3";
  const path = `songs/${session.user.id}.${ext}`;

  const { url } = await storagePut(path, file, { contentType: file.type });

  if (oldUrl && oldUrl !== url) {
    await storageDel(oldUrl).catch(() => {});
  }

  return NextResponse.json({ url });
}
