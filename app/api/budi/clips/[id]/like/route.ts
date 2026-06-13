import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { toggleBudiClipLike } from "@/lib/budi";

export const maxDuration = 60;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const liked = await toggleBudiClipLike(id, session.user.id);
  return NextResponse.json({ ok: true, liked });
}
