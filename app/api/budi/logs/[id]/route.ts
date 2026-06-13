import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getBudiLog, getBudiMembers } from "@/lib/db";

export const maxDuration = 60;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const log = await getBudiLog(id, session.user.id).catch(() => null);
  if (!log) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const members = await getBudiMembers(id).catch(() => []);
  return NextResponse.json({ log, members });
}
