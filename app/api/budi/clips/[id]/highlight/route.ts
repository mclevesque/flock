import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { setBudiHighlight } from "@/lib/budi";

export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const ok = await setBudiHighlight(id, session.user.id, !!body.highlight);
  if (!ok) return NextResponse.json({ error: "Only the author can save a highlight" }, { status: 403 });
  return NextResponse.json({ ok: true, highlight: !!body.highlight });
}
