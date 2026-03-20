import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateLastSeen } from "@/lib/db";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false });
  await updateLastSeen(session.user.id);
  return NextResponse.json({ ok: true });
}
