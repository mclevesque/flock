import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getChronicleEntry, updateChronicleEntry, deleteChronicleEntry,
  toggleChronicleLike, addChronicleComment, getChronicleComments, deleteChronicleComment,
} from "@/lib/db";
import { moderateText } from "@/lib/moderation";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;
  const { searchParams } = new URL(req.url);

  if (searchParams.get("comments") === "1") {
    const comments = await getChronicleComments(id).catch(() => []);
    return NextResponse.json(comments);
  }

  const entry = await getChronicleEntry(id, session?.user?.id).catch(() => null);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(entry);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { title, body, mood, visibility } = await req.json();
  await updateChronicleEntry(id, session.user.id, { title, body, mood, visibility });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await deleteChronicleEntry(id, session.user.id);
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as { id: string; name?: string | null; image?: string | null };
  const { id } = await params;
  const body = await req.json();

  if (body.action === "like") {
    const liked = await toggleChronicleLike(id, u.id);
    return NextResponse.json({ liked });
  }

  if (body.action === "comment") {
    const content = body.content?.trim?.();
    if (!content) return NextResponse.json({ error: "Empty comment" }, { status: 400 });
    const mod = moderateText(content);
    if (!mod.ok) return NextResponse.json({ error: mod.reason }, { status: 400 });
    const comment = await addChronicleComment(id, u.id, u.name ?? "user", u.image ?? null, content.slice(0, 1000));
    return NextResponse.json(comment);
  }

  if (body.action === "delete-comment") {
    await deleteChronicleComment(Number(body.commentId), u.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
