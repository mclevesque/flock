import { put, del } from "@vercel/blob";
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

  // Accept audio/* MIME type or common audio extensions (some OS don't set MIME properly)
  const isAudio = file.type.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|flac|aac|opus|weba)$/i.test(file.name);
  if (!isAudio) return NextResponse.json({ error: "Audio files only" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Max 20 MB" }, { status: 400 });

  const ext = file.name.split(".").pop() ?? "mp3";
  // Use a fixed path per user (overwrite) to store only one song at a time
  const blob = await put(`songs/${session.user.id}.${ext}`, file, { access: "public", allowOverwrite: true });

  // Delete old blob if it's a different Vercel Blob URL (different extension)
  if (oldUrl && oldUrl.includes("vercel-storage.com") && oldUrl !== blob.url) {
    try { await del(oldUrl); } catch { /* ignore if already gone */ }
  }

  return NextResponse.json({ url: blob.url });
}
