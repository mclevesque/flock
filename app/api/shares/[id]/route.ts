import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { toggleShareLike, deleteShare, flagShare, getShareById } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;
  const share = await getShareById(id, session?.user?.id).catch(() => null);
  if (!share) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(share);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { action } = await req.json();

  if (action === "like") {
    const liked = await toggleShareLike(id, session.user.id);
    return NextResponse.json({ liked });
  }
  if (action === "delete") {
    await deleteShare(id, session.user.id);
    return NextResponse.json({ ok: true });
  }
  if (action === "flag") {
    const result = await flagShare(id, session.user.id);
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
