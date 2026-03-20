import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteWallPost } from "@/lib/db";

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const ok = await deleteWallPost(id, session.user.id);
  if (!ok) return NextResponse.json({ error: "Not found or not authorized" }, { status: 403 });
  return NextResponse.json({ ok: true });
}
