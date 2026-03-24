import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteStory, incrementStoryViews } from "@/lib/db";
import { storageDel } from "@/lib/storage";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { action } = await req.json().catch(() => ({ action: "" }));
  if (action === "view") {
    incrementStoryViews(id).catch(() => {});
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  // Delete from R2 (fire-and-forget, don't block on errors)
  storageDel(`stories/${userId}/${id}.webm`).catch(() => {});
  storageDel(`stories/${userId}/${id}_thumb.jpg`).catch(() => {});
  // Delete from DB
  await deleteStory(id, userId);
  return NextResponse.json({ ok: true });
}
