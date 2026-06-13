import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { leaveBudiLog } from "@/lib/db";

export const maxDuration = 60;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const left = await leaveBudiLog(id, session.user.id);
  if (!left) return NextResponse.json({ error: "Could not leave (solo logs can't be left)" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
