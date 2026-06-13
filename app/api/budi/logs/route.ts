import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getBudiLogsForUser, createBudiLog } from "@/lib/db";

export const maxDuration = 60;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ logs: [] }, { status: 401 });
  const logs = await getBudiLogsForUser(session.user.id).catch(() => []);
  return NextResponse.json({ logs });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const name = ((body?.name as string) ?? "").trim();
  if (name.length < 1) return NextResponse.json({ error: "Give your log a name" }, { status: 400 });
  const log = await createBudiLog(session.user.id, name);
  return NextResponse.json({ ok: true, log });
}
