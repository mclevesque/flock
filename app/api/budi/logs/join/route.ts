import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { joinBudiLogByCode } from "@/lib/db";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const code = ((body?.code as string) ?? "").trim();
  const result = await joinBudiLogByCode(session.user.id, code);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, log: result.log });
}
